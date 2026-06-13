interface TypeIconProps {
  type: string;
  size?: number;
}

export function TypeIcon({ type, size = 16 }: TypeIconProps) {
  return (
    <img
      src={`https://raw.githubusercontent.com/duiker101/pokemon-type-svg-icons/master/icons/${type}.svg`}
      alt={type}
      width={size}
      height={size}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    />
  );
}
