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
    other: {
      "official-artwork": { front_default: string };
    };
  };
  height: number;
  weight: number;
}

export interface PokemonListResponse {
  count: number;
  next: string | null;
  results: PokemonListItem[];
}
