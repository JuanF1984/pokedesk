'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { fetchPokemonList, fetchPokemonBatch } from '@/lib/api';
import type { Pokemon } from '@/lib/types';
import { PokemonCard } from './PokemonCard';
import { PokeballLoader } from './PokeballLoader';

const BATCH = 20;
const LAST_ID_KEY = 'pokedex-last-id';

// Module-level cache — survives unmount/remount within the same browser session
let cachedPokemons: Pokemon[] = [];
let cachedOffset: number = 0;
let cachedHasMore: boolean = true;

export function PokemonGrid() {
  const [pokemon, setPokemon] = useState<Pokemon[]>(cachedPokemons);
  const [offset, setOffset] = useState(cachedOffset);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(cachedHasMore);
  const [restoring, setRestoring] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  // Read target id once synchronously before any effects.
  // useState lazy initializer runs exactly once even in StrictMode's double-invoke,
  // so removing the sessionStorage key here is safe — no race with cleanup/remount.
  const [targetId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const id = sessionStorage.getItem(LAST_ID_KEY);
    if (!id) return null;
    sessionStorage.removeItem(LAST_ID_KEY);
    // If cache is cold (page reload, hot-reload in dev) skip restoration
    if (cachedPokemons.length === 0) {
      console.log('[pokedex] cache vacío, omitiendo restauración de scroll');
      return null;
    }
    return id;
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

  // Scroll restoration: wait for the target card to appear in the DOM, then scrollIntoView.
  // Uses setTimeout for the 3s safety net (clearable) + rAF loop to find the element fast.
  useEffect(() => {
    if (!targetId) return;

    console.log('[pokedex] restaurando posición para card:', targetId);
    console.log('[pokedex] tarjetas en DOM:',
      Array.from(document.querySelectorAll('[id^="pokemon-card-"]')).map((el) => el.id));

    setRestoring(true);
    let cancelled = false;

    const timeout = setTimeout(() => {
      console.warn('[pokedex] elemento no encontrado después de 3s, liberando overlay');
      if (!cancelled) setRestoring(false);
    }, 3000);

    const waitForElement = () => {
      if (cancelled) return;
      const el = document.getElementById(`pokemon-card-${String(targetId)}`);
      if (el) {
        clearTimeout(timeout);
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
        setRestoring(false);
      } else {
        requestAnimationFrame(waitForElement);
      }
    };

    requestAnimationFrame(waitForElement);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [targetId]);

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
      {/* Restoration overlay — covers the screen while scrollIntoView positions the grid */}
      {restoring && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: '#0d0d1a' }}
        >
          <PokeballLoader size={64} />
        </div>
      )}

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
