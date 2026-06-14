'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { fetchPokemonList, fetchPokemonBatch } from '@/lib/api';
import type { Pokemon } from '@/lib/types';
import { PokemonCard } from './PokemonCard';
import { PokeballLoader } from './PokeballLoader';

const BATCH = 20;
const SCROLL_KEY = 'pokedex-scroll';

// Module-level cache — survives unmount/remount within the same browser session
let cachedPokemons: Pokemon[] = [];
let cachedOffset: number = 0;
let cachedHasMore: boolean = true;

export function PokemonGrid() {
  const [pokemon, setPokemon] = useState<Pokemon[]>(cachedPokemons);
  const [offset, setOffset] = useState(cachedOffset);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(cachedHasMore);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  // Read scroll once, synchronously, before any effects run.
  // Only restore if the cache is warm (same session); ignore on page reload.
  const [savedScroll] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    const val = sessionStorage.getItem(SCROLL_KEY);
    if (!val) return null;
    sessionStorage.removeItem(SCROLL_KEY);
    return cachedPokemons.length > 0 ? parseInt(val, 10) : null;
  });

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoading(true);

    try {
      const list = await fetchPokemonList(offset, BATCH);
      if (!list.next) {
        cachedHasMore = false;
        setHasMore(false);
      }
      const batch = await fetchPokemonBatch(list.results);
      cachedPokemons = [...cachedPokemons, ...batch];
      cachedOffset = offset + BATCH;
      setPokemon(cachedPokemons);
      setOffset(cachedOffset);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [offset, hasMore]);

  // Initial load — skip if cache already has data
  useEffect(() => {
    if (cachedPokemons.length === 0) {
      loadMore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore scroll after first paint
  useEffect(() => {
    if (savedScroll !== null) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: savedScroll, behavior: 'instant' });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingRef.current) {
          loadMore();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div className="p-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {pokemon.map((p) => (
          <div
            key={p.id}
            className="animate-[fadeIn_0.3s_ease-out]"
            style={{ animationFillMode: 'both' }}
          >
            <PokemonCard pokemon={p} />
          </div>
        ))}
      </div>

      {/* Sentinel for infinite scroll */}
      <div ref={sentinelRef} className="h-4" />

      {loading && (
        <div className="flex justify-center py-8">
          <PokeballLoader size={48} />
        </div>
      )}

      {!hasMore && !loading && (
        <p
          className="text-center text-[#4a5568] text-xs py-6"
          style={{ fontFamily: 'var(--font-pixel)' }}
        >
          ¡Todos los Pokémon!
        </p>
      )}
    </div>
  );
}
