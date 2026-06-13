import { TypeIcon } from './TypeIcon';
import { getTypeColor, getTypeTextColor } from '@/lib/typeColors';

interface TypeBadgeProps {
  type: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'text-[8px] px-1.5 py-0.5 gap-1',
  md: 'text-[10px] px-2 py-1 gap-1.5',
  lg: 'text-xs px-3 py-1.5 gap-2',
};

const iconSizes = { sm: 12, md: 14, lg: 18 };

export function TypeBadge({ type, size = 'md' }: TypeBadgeProps) {
  const bg = getTypeColor(type);
  const color = getTypeTextColor(type);

  return (
    <span
      className={`inline-flex items-center rounded-full font-bold uppercase tracking-wider border border-black/20 shadow-sm ${sizeClasses[size]}`}
      style={{ backgroundColor: bg, color }}
    >
      <TypeIcon type={type} size={iconSizes[size]} />
      {type}
    </span>
  );
}
