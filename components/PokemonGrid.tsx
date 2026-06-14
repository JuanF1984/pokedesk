'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { fetchPokemonList, fetchPokemonBatch } from '@/lib/api';
import type { Pokemon } from '@/lib/types';
import { PokemonCard } from './PokemonCard';
import { PokeballLoader } from './PokeballLoader';

const BATCH = 20;
const SCROLL_KEY = 'pokedex-scroll';
const COUNT_KEY = 'pokedex-loaded-count';

export function PokemonGrid() {
  const [pokemon, setPokemon] = useState<Pokemon[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const pendingScrollRef = useRef<number | null>(null);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoading(true);

    try {
      const list = await fetchPokemonList(offset, BATCH);
      if (!list.next) setHasMore(false);
      const batch = await fetchPokemonBatch(list.results);
      sessionStorage.setItem(COUNT_KEY, (offset + batch.length).toString());
      setPokemon((prev) => [...prev, ...batch]);
      setOffset((prev) => prev + BATCH);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [offset, hasMore]);

  // Initial load — restore saved state or start fresh
  useEffect(() => {
    const savedScroll = sessionStorage.getItem(SCROLL_KEY);
    const savedCount = sessionStorage.getItem(COUNT_KEY);

    if (savedScroll && savedCount) {
      const count = parseInt(savedCount, 10);
      pendingScrollRef.current = parseInt(savedScroll, 10);
      sessionStorage.removeItem(SCROLL_KEY);
      sessionStorage.removeItem(COUNT_KEY);

      loadingRef.current = true;
      setLoading(true);

      fetchPokemonList(0, count)
        .then(async (list) => {
          if (!list.next) setHasMore(false);
          const batch = await fetchPokemonBatch(list.results);
          setOffset(batch.length);
          setPokemon(batch);
        })
        .catch(console.error)
        .finally(() => {
          setLoading(false);
          loadingRef.current = false;
        });
    } else {
      loadMore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore scroll position after pokemon list renders
  useEffect(() => {
    if (pendingScrollRef.current !== null && pokemon.length > 0) {
      const y = pendingScrollRef.current;
      pendingScrollRef.current = null;
      requestAnimationFrame(() => {
        window.scrollTo({ top: y, behavior: 'instant' });
      });
    }
  }, [pokemon]);

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

      {/* Loading indicator */}
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
