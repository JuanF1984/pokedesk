import Link from 'next/link';
import Image from 'next/image';
import type { Pokemon } from '@/lib/types';
import { getTypeColor } from '@/lib/typeColors';
import { TypeBadge } from './TypeBadge';
import { capitalize, formatId } from '@/lib/api';

interface PokemonCardProps {
  pokemon: Pokemon;
}

export function PokemonCard({ pokemon }: PokemonCardProps) {
  const primaryType = pokemon.types[0]?.type.name ?? 'normal';
  const bgColor = getTypeColor(primaryType);
  const artwork = pokemon.sprites.other['official-artwork'].front_default;

  return (
    <Link
      id={`pokemon-card-${pokemon.id}`}
      href={`/pokemon/${pokemon.id}`}
      className="group block"
      onClick={() => sessionStorage.setItem('pokedex-last-id', pokemon.id.toString())}
    >
      <div
        className="relative rounded-2xl overflow-hidden border-2 border-black/30 shadow-[0_4px_12px_rgba(0,0,0,0.4)] transition-all duration-200 active:scale-95 hover:scale-105 hover:shadow-[0_8px_24px_rgba(0,0,0,0.5)] cursor-pointer"
        style={{ background: `linear-gradient(135deg, ${bgColor}ee, ${bgColor}99)` }}
      >
        {/* Number */}
        <div className="absolute top-2 right-2 z-10">
          <span
            className="text-[9px] font-bold opacity-60 text-white"
            style={{ fontFamily: 'var(--font-pixel)' }}
          >
            {formatId(pokemon.id)}
          </span>
        </div>

        {/* White circle glow behind image */}
        <div className="absolute bottom-0 right-0 w-28 h-28 rounded-full bg-white/20 translate-x-4 translate-y-4" />
        <div className="absolute bottom-0 right-0 w-20 h-20 rounded-full bg-white/10 translate-x-2 translate-y-2" />

        {/* Artwork */}
        <div className="flex justify-center pt-3 pb-1">
          {artwork ? (
            <Image
              src={artwork}
              alt={pokemon.name}
              width={96}
              height={96}
              className="drop-shadow-[0_4px_8px_rgba(0,0,0,0.4)] transition-transform duration-200 group-hover:-translate-y-1"
              priority={pokemon.id <= 20}
              unoptimized
            />
          ) : (
            <div className="w-24 h-24 flex items-center justify-center text-4xl opacity-50">?</div>
          )}
        </div>

        {/* Info */}
        <div className="px-2 pb-2 space-y-1">
          <p
            className="text-white font-extrabold text-sm leading-tight truncate"
            style={{ fontFamily: 'var(--font-nunito)' }}
          >
            {capitalize(pokemon.name)}
          </p>
          <div className="flex flex-wrap gap-1">
            {pokemon.types.map(({ type }) => (
              <TypeBadge key={type.name} type={type.name} size="sm" />
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}
