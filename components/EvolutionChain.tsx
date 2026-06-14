'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { capitalize, formatId } from '@/lib/api';
import type { EvolutionNode } from '@/lib/types';

interface EvolutionChainProps {
  chains: EvolutionNode[][];
  currentId: number;
  accentColor: string;
}

function getCommonPrefix(chains: EvolutionNode[][]): EvolutionNode[] {
  if (chains.length === 0) return [];
  const prefix: EvolutionNode[] = [];
  for (let i = 0; i < chains[0].length; i++) {
    const id = chains[0][i].id;
    if (chains.every((c) => c[i]?.id === id)) {
      prefix.push(chains[0][i]);
    } else {
      break;
    }
  }
  return prefix;
}

function spriteUrl(id: number) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

function EvoNode({
  node,
  currentId,
  accentColor,
  size = 'md',
}: {
  node: EvolutionNode;
  currentId: number;
  accentColor: string;
  size?: 'sm' | 'md';
}) {
  const isCurrent = node.id === currentId;
  const imgSize = size === 'md' ? 64 : 52;
  const maxNameWidth = size === 'md' ? 'max-w-[80px]' : 'max-w-[64px]';

  return (
    <Link
      href={`/pokemon/${node.id}`}
      className="flex flex-col items-center gap-0.5 group"
      onClick={(e) => { if (isCurrent) e.preventDefault(); }}
    >
      <div
        className="rounded-full transition-all duration-200 group-active:scale-90"
        style={{
          padding: '5px',
          background: isCurrent ? `${accentColor}22` : 'rgba(255,255,255,0.04)',
          border: `2px solid ${isCurrent ? accentColor : 'rgba(255,255,255,0.1)'}`,
          boxShadow: isCurrent
            ? `0 0 20px ${accentColor}44, 0 0 8px ${accentColor}66`
            : undefined,
        }}
      >
        <Image
          src={spriteUrl(node.id)}
          alt={capitalize(node.name)}
          width={imgSize}
          height={imgSize}
          unoptimized
          className={`transition-opacity duration-200 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] ${
            !isCurrent ? 'opacity-60 group-hover:opacity-100' : ''
          }`}
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
      <span
        className="mt-1 text-[7px]"
        style={{ fontFamily: 'var(--font-pixel)', color: 'rgba(255,255,255,0.28)' }}
      >
        {formatId(node.id)}
      </span>
      <span
        className={`text-[10px] font-bold text-center leading-tight truncate ${maxNameWidth}`}
        style={{
          fontFamily: 'var(--font-nunito)',
          color: isCurrent ? '#ffffff' : 'rgba(255,255,255,0.55)',
        }}
      >
        {capitalize(node.name)}
      </span>
    </Link>
  );
}

function ArrowRight({ color }: { color: string }) {
  // mt-[34px] aligns the arrow with the vertical center of the 64px sprite
  // (5px padding + 32px half-image = 37px, minus 3px for SVG half-height)
  return (
    <div className="flex items-center mt-[34px] px-1 shrink-0">
      <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
        <path
          d="M0 5h12M8 1l6 4-6 4"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.4"
        />
      </svg>
    </div>
  );
}

function ArrowDown({ color }: { color: string }) {
  return (
    <div className="flex justify-center py-0.5">
      <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
        <path
          d="M5 0v12M1 8l4 6 4-6"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.4"
        />
      </svg>
    </div>
  );
}

export function EvolutionChain({ chains, currentId, accentColor }: EvolutionChainProps) {
  if (chains.length === 0) return null;

  const prefix = getCommonPrefix(chains);
  const suffixes = chains.map((c) => c.slice(prefix.length)).filter((s) => s.length > 0);

  // Single Pokémon, no evolution
  if (prefix.length <= 1 && suffixes.length === 0) return null;

  const allSingleNode = suffixes.every((s) => s.length === 1);

  return (
    <div
      className="rounded-2xl p-4 border border-white/10"
      style={{ background: 'rgba(255,255,255,0.04)' }}
    >
      <h2
        className="text-[10px] text-white/50 uppercase tracking-widest mb-4"
        style={{ fontFamily: 'var(--font-pixel)' }}
      >
        Evoluciones
      </h2>

      {/* Case 1: Single linear chain — horizontal row */}
      {suffixes.length === 0 && (
        <div className="flex items-start justify-center">
          {prefix.map((node, i) => (
            <Fragment key={node.id}>
              <EvoNode node={node} currentId={currentId} accentColor={accentColor} />
              {i < prefix.length - 1 && <ArrowRight color={accentColor} />}
            </Fragment>
          ))}
        </div>
      )}

      {/* Case 2: All branches end in a single node (Eevee, Slowpoke, Tyrogue)
          Layout: prefix nodes centered → arrow down → 2-column grid */}
      {suffixes.length > 0 && allSingleNode && (
        <div className="flex flex-col items-center">
          <div className="flex items-start justify-center">
            {prefix.map((node, i) => (
              <Fragment key={node.id}>
                <EvoNode node={node} currentId={currentId} accentColor={accentColor} />
                {i < prefix.length - 1 && <ArrowRight color={accentColor} />}
              </Fragment>
            ))}
          </div>
          <ArrowDown color={accentColor} />
          <div
            className={`grid gap-x-3 gap-y-2 ${
              suffixes.length === 2 ? 'grid-cols-2 max-w-[180px]' :
              suffixes.length <= 4 ? 'grid-cols-2 sm:grid-cols-4' :
              'grid-cols-2 sm:grid-cols-4'
            }`}
          >
            {suffixes.map((suffix) => (
              <div key={suffix[0].id} className="flex justify-center">
                <EvoNode
                  node={suffix[0]}
                  currentId={currentId}
                  accentColor={accentColor}
                  size="sm"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Case 3: Multi-stage branches (Wurmple) — one row per branch */}
      {suffixes.length > 0 && !allSingleNode && (
        <div className="space-y-3">
          {suffixes.map((suffix, i) => (
            <div key={i} className="flex items-start justify-center">
              {prefix.map((node, j) => (
                <Fragment key={node.id}>
                  <EvoNode node={node} currentId={currentId} accentColor={accentColor} size="sm" />
                  {j < prefix.length - 1 && <ArrowRight color={accentColor} />}
                </Fragment>
              ))}
              {prefix.length > 0 && <ArrowRight color={accentColor} />}
              {suffix.map((node, j) => (
                <Fragment key={node.id}>
                  <EvoNode node={node} currentId={currentId} accentColor={accentColor} size="sm" />
                  {j < suffix.length - 1 && <ArrowRight color={accentColor} />}
                </Fragment>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
