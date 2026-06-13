import type { Pokemon, PokemonListResponse } from './types';

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

export function capitalize(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ');
}

export function formatId(id: number): string {
  return `#${String(id).padStart(3, '0')}`;
}
