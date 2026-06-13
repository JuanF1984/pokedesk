'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { fetchPokemon, capitalize, formatId } from '@/lib/api';
import { getTypeColor } from '@/lib/typeColors';
import type { Pokemon } from '@/lib/types';
import { TypeBadge } from '@/components/TypeBadge';
import { StatBar } from '@/components/StatBar';
import { PokedexFrame } from '@/components/PokedexFrame';
import { PokeballLoader } from '@/components/PokeballLoader';

export default function PokemonDetail() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [pokemon, setPokemon] = useState<Pokemon | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setPokemon(null);
    fetchPokemon(id)
      .then(setPokemon)
      .catch(() => router.push('/'))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading || !pokemon) {
    return (
      <PokedexFrame>
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] gap-4">
          <PokeballLoader size={64} />
          <p
            className="text-white/40 text-[9px] tracking-widest"
            style={{ fontFamily: 'var(--font-pixel)' }}
          >
            Cargando...
          </p>
        </div>
      </PokedexFrame>
    );
  }

  const primaryType = pokemon.types[0]?.type.name ?? 'normal';
  const accentColor = getTypeColor(primaryType);
  const artwork = pokemon.sprites.other['official-artwork'].front_default;
  const prevId = pokemon.id > 1 ? pokemon.id - 1 : null;
  const nextId = pokemon.id < 1025 ? pokemon.id + 1 : null;

  return (
    <PokedexFrame>
      <div className="flex flex-col min-h-[calc(100vh-120px)]">
        {/* Header bar */}
        <div
          className="px-4 py-3 flex items-center justify-between border-b border-white/10"
          style={{ background: `linear-gradient(to right, ${accentColor}33, transparent)` }}
        >
          <Link
            href="/"
            className="flex items-center gap-2 text-white/70 hover:text-white transition-colors active:scale-95"
            style={{ minHeight: 44 }}
          >
            <span className="text-lg">←</span>
            <span
              className="text-[9px] uppercase tracking-wider"
              style={{ fontFamily: 'var(--font-pixel)' }}
            >
              Volver
            </span>
          </Link>
          <p
            className="text-white/40 text-[9px]"
            style={{ fontFamily: 'var(--font-pixel)' }}
          >
            {formatId(pokemon.id)}
          </p>
        </div>

        {/* Main content */}
        <div className="flex-1 px-4 py-4 space-y-5">
          {/* Artwork */}
          <div className="relative flex flex-col items-center">
            <div
              className="absolute w-48 h-48 rounded-full blur-3xl opacity-30"
              style={{ background: accentColor }}
            />
            {artwork ? (
              <Image
                src={artwork}
                alt={capitalize(pokemon.name)}
                width={200}
                height={200}
                className="relative z-10 drop-shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
                priority
                unoptimized
              />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-7xl opacity-40">?</div>
            )}
          </div>

          {/* Name & types */}
          <div className="text-center space-y-2">
            <h1
              className="text-2xl font-black text-white tracking-tight"
              style={{ fontFamily: 'var(--font-nunito)' }}
            >
              {capitalize(pokemon.name)}
            </h1>
            <div className="flex justify-center gap-2 flex-wrap">
              {pokemon.types.map(({ type }) => (
                <TypeBadge key={type.name} type={type.name} size="lg" />
              ))}
            </div>
          </div>

          {/* Height & Weight */}
          <div className="flex justify-center gap-6">
            {[
              { icon: '📏', value: `${(pokemon.height / 10).toFixed(1)} m`, label: 'Altura' },
              { icon: '⚖️', value: `${(pokemon.weight / 10).toFixed(1)} kg`, label: 'Peso' },
            ].map(({ icon, value, label }) => (
              <div
                key={label}
                className="flex flex-col items-center px-4 py-2 rounded-xl border border-white/10"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                <span className="text-xl">{icon}</span>
                <span className="text-white font-bold text-sm" style={{ fontFamily: 'var(--font-nunito)' }}>
                  {value}
                </span>
                <span
                  className="text-white/40 text-[9px] uppercase tracking-wider"
                  style={{ fontFamily: 'var(--font-pixel)' }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div
            className="rounded-2xl p-4 border border-white/10 space-y-3"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            <h2
              className="text-[10px] text-white/50 uppercase tracking-widest mb-3"
              style={{ fontFamily: 'var(--font-pixel)' }}
            >
              Estadísticas
            </h2>
            {pokemon.stats.map((s) => (
              <StatBar key={s.stat.name} statName={s.stat.name} value={s.base_stat} />
            ))}
          </div>
        </div>

        {/* Prev / Next navigation */}
        <div className="p-4 flex gap-3 border-t border-white/10">
          {prevId ? (
            <Link
              href={`/pokemon/${prevId}`}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl border-2 border-white/20 text-white font-bold transition-all active:scale-95 hover:border-white/40"
              style={{ minHeight: 56, fontFamily: 'var(--font-nunito)', background: 'rgba(255,255,255,0.06)' }}
            >
              <span className="text-xl">←</span>
              <span className="text-sm">#{String(prevId).padStart(3, '0')}</span>
            </Link>
          ) : (
            <div className="flex-1" />
          )}
          {nextId ? (
            <Link
              href={`/pokemon/${nextId}`}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl border-2 border-white/20 text-white font-bold transition-all active:scale-95 hover:border-white/40"
              style={{ minHeight: 56, fontFamily: 'var(--font-nunito)', background: 'rgba(255,255,255,0.06)' }}
            >
              <span className="text-sm">#{String(nextId).padStart(3, '0')}</span>
              <span className="text-xl">→</span>
            </Link>
          ) : (
            <div className="flex-1" />
          )}
        </div>
      </div>
    </PokedexFrame>
  );
}
