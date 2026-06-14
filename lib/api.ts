import type { Pokemon, PokemonListResponse, SpeciesResponse, EvolutionChainResponse, ChainLink, EvolutionNode } from './types';

const BASE = 'https://pokeapi.co/api/v2';

export async function fetchPokemonList(offset: number, limit = 20): Promise<PokemonListResponse> {
  const res = await fetch(`${BASE}/pokemon?limit=${limit}&offset=${offset}`);
  if (!res.ok) throw new Error('Failed to fetch pokemon list');
  return res.json();
}

export async function fetchPokemon(idOrName: string | number): Promise<Pokemon> {
  const res = await fetch(`${BASE}/pokemon/${idOrName}`);
  if (!res.ok) throw new Error(`Failed to fetch pokemon: ${idOrName}`);
  return res.json();
}

export async function fetchPokemonBatch(items: { name: string; url: string }[]): Promise<Pokemon[]> {
  const ids = items.map((item) => {
    const parts = item.url.split('/').filter(Boolean);
    return parts[parts.length - 1];
  });
  return Promise.all(ids.map((id) => fetchPokemon(id)));
}

export async function fetchSpecies(url: string): Promise<SpeciesResponse> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch species');
  return res.json();
}

export async function fetchEvolutionChainData(url: string): Promise<EvolutionChainResponse> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch evolution chain');
  return res.json();
}

function extractSpeciesId(url: string): number {
  const parts = url.replace(/\/$/, '').split('/');
  return parseInt(parts[parts.length - 1], 10);
}

export function flattenEvolutionChain(chain: ChainLink): EvolutionNode[][] {
  function traverse(node: ChainLink, path: EvolutionNode[]): EvolutionNode[][] {
    const current: EvolutionNode[] = [
      ...path,
      { id: extractSpeciesId(node.species.url), name: node.species.name },
    ];
    if (node.evolves_to.length === 0) return [current];
    return node.evolves_to.flatMap((child) => traverse(child, current));
  }
  return traverse(chain, []);
}

export function capitalize(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ');
}

export function formatId(id: number): string {
  return `#${String(id).padStart(3, '0')}`;
}
