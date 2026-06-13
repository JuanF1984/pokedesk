'use client';

import { useEffect, useState } from 'react';

const STAT_LABELS: Record<string, string> = {
  hp: 'HP',
  attack: 'Ataque',
  defense: 'Defensa',
  'special-attack': 'Atq. Esp.',
  'special-defense': 'Def. Esp.',
  speed: 'Velocidad',
};

const STAT_COLORS: Record<string, string> = {
  hp: '#ff5959',
  attack: '#f5ac78',
  defense: '#fae078',
  'special-attack': '#9db7f5',
  'special-defense': '#a7db8d',
  speed: '#fa92b2',
};

interface StatBarProps {
  statName: string;
  value: number;
  max?: number;
}

export function StatBar({ statName, value, max = 255 }: StatBarProps) {
  const [mounted, setMounted] = useState(false);
  const label = STAT_LABELS[statName] ?? statName;
  const color = STAT_COLORS[statName] ?? '#a0a0a0';
  const pct = Math.round((value / max) * 100);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex items-center gap-3">
      <span
        className="text-[9px] font-bold text-right shrink-0 uppercase tracking-wide"
        style={{ fontFamily: 'var(--font-nunito)', width: '72px', color: '#9ca3af' }}
      >
        {label}
      </span>
      <span
        className="text-white font-bold text-sm shrink-0 w-8 text-right"
        style={{ fontFamily: 'var(--font-pixel)' }}
      >
        {value}
      </span>
      <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden border border-white/5">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: mounted ? `${pct}%` : '0%',
            backgroundColor: color,
            boxShadow: `0 0 6px ${color}88`,
          }}
        />
      </div>
    </div>
  );
}
