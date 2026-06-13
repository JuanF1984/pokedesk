export const typeColors: Record<string, string> = {
  normal: '#A8A878',
  fire: '#F08030',
  water: '#6890F0',
  electric: '#F8D030',
  grass: '#78C850',
  ice: '#98D8D8',
  fighting: '#C03028',
  poison: '#A040A0',
  ground: '#E0C068',
  flying: '#A890F0',
  psychic: '#F85888',
  bug: '#A8B820',
  rock: '#B8A038',
  ghost: '#705898',
  dragon: '#7038F8',
  dark: '#705848',
  steel: '#B8B8D0',
  fairy: '#EE99AC',
};

export const typeTextColors: Record<string, string> = {
  electric: '#1a1a00',
  ice: '#003333',
  normal: '#1a1a00',
  ground: '#1a0a00',
  steel: '#0a0a1a',
};

export function getTypeColor(type: string): string {
  return typeColors[type] ?? '#A8A878';
}

export function getTypeTextColor(type: string): string {
  return typeTextColors[type] ?? '#ffffff';
}
