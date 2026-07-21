import { capitalize } from './api';
import { TYPE_NAMES_ES } from './typeNames';
import type { Pokemon, SpeciesResponse } from './types';

const POKEAPI_BASE = 'https://pokeapi.co/api/v2';

// Flavor texts are already short (usually <200 chars); this caps the rare
// long entry so the TTS request stays cheap and the CYD's download stays
// small.
const MAX_DESCRIPTION_LENGTH = 400;

export class PokemonNotFoundError extends Error {}
export class PokemonUpstreamError extends Error {}
export class PokemonDescriptionUnavailableError extends Error {}

export interface PokemonAudioText {
  id: number;
  name: string;
  text: string;
  descriptionLang: 'es' | 'en';
}

const CONTROL_CHAR_MAX = 0x1f;
const DEL_CHAR = 0x7f;
const PRIVATE_USE_START = 0xe000;
const PRIVATE_USE_END = 0xf8ff;

// Strips control characters (line breaks, form feeds, tabs, etc.) and the
// Unicode Private Use Area codepoints PokeAPI sometimes carries over from
// old game text, then collapses whitespace so the TTS provider gets a
// clean single-line string.
function normalizeSpokenText(text: string): string {
  let cleaned = '';
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    const isControl = code <= CONTROL_CHAR_MAX || code === DEL_CHAR;
    const isPrivateUse = code >= PRIVATE_USE_START && code <= PRIVATE_USE_END;
    cleaned += isControl || isPrivateUse ? ' ' : char;
  }
  return cleaned.replace(/\s+/g, ' ').trim();
}

function buildTypeText(pokemon: Pokemon): string {
  const tipos = pokemon.types.map((t) => TYPE_NAMES_ES[t.type.name] ?? t.type.name);
  return tipos.length === 1 ? `Tipo ${tipos[0]}` : `Tipos ${tipos.join(' y ')}`;
}

function pickDescription(species: SpeciesResponse): { text: string; lang: 'es' | 'en' } | null {
  const entries = species.flavor_text_entries ?? [];
  const esEntries = entries.filter((e) => e.language.name === 'es');
  const pool = esEntries.length > 0 ? esEntries : entries.filter((e) => e.language.name === 'en');
  if (pool.length === 0) return null;

  const normalized = normalizeSpokenText(pool[0].flavor_text).slice(0, MAX_DESCRIPTION_LENGTH);
  if (!normalized) return null;

  return { text: normalized, lang: esEntries.length > 0 ? 'es' : 'en' };
}

// Builds the exact spoken-text summary (name + types + Spanish description,
// with an English fallback) used for /api/pokemon/[id]/audio. Kept separate
// from app/api/pokemon/[id]/route.js's own species-description fetch so that
// endpoint's behavior is untouched.
export async function buildPokemonAudioText(idOrName: string): Promise<PokemonAudioText> {
  let pokemonRes: Response;
  try {
    pokemonRes = await fetch(`${POKEAPI_BASE}/pokemon/${idOrName}`);
  } catch {
    throw new PokemonUpstreamError('Network error fetching pokemon');
  }
  if (pokemonRes.status === 404) {
    throw new PokemonNotFoundError(`Pokemon not found: ${idOrName}`);
  }
  if (!pokemonRes.ok) {
    throw new PokemonUpstreamError(`Upstream error fetching pokemon: ${pokemonRes.status}`);
  }
  const pokemon: Pokemon = await pokemonRes.json();

  let speciesRes: Response;
  try {
    speciesRes = await fetch(pokemon.species.url);
  } catch {
    throw new PokemonUpstreamError('Network error fetching species');
  }
  if (!speciesRes.ok) {
    throw new PokemonDescriptionUnavailableError(`Species unavailable for ${idOrName}`);
  }
  const species: SpeciesResponse = await speciesRes.json();

  const description = pickDescription(species);
  if (!description) {
    throw new PokemonDescriptionUnavailableError(`No description available for ${idOrName}`);
  }

  const name = capitalize(pokemon.name);
  const typeText = buildTypeText(pokemon);
  const text = normalizeSpokenText(`${name}. ${typeText}. ${description.text}.`);

  return { id: pokemon.id, name, text, descriptionLang: description.lang };
}
