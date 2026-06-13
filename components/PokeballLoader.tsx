export function PokeballLoader({ size = 48 }: { size?: number }) {
  return (
    <div
      className="animate-spin"
      style={{ width: size, height: size }}
      aria-label="Cargando..."
    >
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        {/* Top half */}
        <path d="M 10 50 A 40 40 0 0 1 90 50 Z" fill="#ef4444" />
        {/* Bottom half */}
        <path d="M 10 50 A 40 40 0 0 0 90 50 Z" fill="white" />
        {/* Border */}
        <circle cx="50" cy="50" r="40" fill="none" stroke="#111" strokeWidth="4" />
        {/* Middle line */}
        <line x1="10" y1="50" x2="90" y2="50" stroke="#111" strokeWidth="4" />
        {/* Center button */}
        <circle cx="50" cy="50" r="10" fill="white" stroke="#111" strokeWidth="4" />
        <circle cx="50" cy="50" r="5" fill="#e5e7eb" />
      </svg>
    </div>
  );
}
