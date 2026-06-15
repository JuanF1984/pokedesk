export interface PokemonListItem {
  name: string;
  url: string;
}

export interface PokemonType {
  slot: number;
  type: { name: string; url: string };
}

export interface PokemonStat {
  base_stat: number;
  stat: { name: string };
}

export interface Pokemon {
  id: number;
  name: string;
  types: PokemonType[];
  stats: PokemonStat[];
  sprites: {
    front_default: string | null;
    other: {
      'official-artwork': { front_default: string };
    };
  };
  height: number;
  weight: number;
  species: { url: string };
}

export interface PokemonListResponse {
  count: number;
  next: string | null;
  results: PokemonListItem[];
}

export interface FlavorTextEntry {
  flavor_text: string;
  language: { name: string };
}

export interface SpeciesResponse {
  evolution_chain: { url: string };
  flavor_text_entries: FlavorTextEntry[];
}

export interface ChainLink {
  species: { name: string; url: string };
  evolves_to: ChainLink[];
}

export interface EvolutionChainResponse {
  chain: ChainLink;
}

export interface EvolutionNode {
  id: number;
  name: string;
}
