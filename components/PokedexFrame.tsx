interface PokedexFrameProps {
  children: React.ReactNode;
}

export function PokedexFrame({ children }: PokedexFrameProps) {
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #DD0000 0%, #AA0000 40%, #880000 100%)' }}>
      {/* Top panel */}
      <div className="px-3 pt-3 pb-2">
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-2 border-b-4 border-black/30"
          style={{ background: 'linear-gradient(to bottom, #CC0000, #AA0000)' }}
        >
          {/* Blue LED indicator */}
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-full bg-sky-400 border-[3px] border-sky-200 shadow-[0_0_0_3px_rgba(255,255,255,0.3),0_0_16px_6px_rgba(56,189,248,0.7)]" />
            <div className="absolute inset-1 rounded-full bg-gradient-to-br from-white/60 to-transparent" />
          </div>

          {/* Small decorative lights */}
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400 border border-red-200 shadow-[0_0_6px_2px_rgba(248,113,113,0.6)]" />
            <div className="w-3 h-3 rounded-full bg-yellow-300 border border-yellow-100 shadow-[0_0_6px_2px_rgba(253,224,71,0.6)]" />
            <div className="w-3 h-3 rounded-full bg-green-400 border border-green-200 shadow-[0_0_6px_2px_rgba(74,222,128,0.6)]" />
          </div>

          <div className="flex-1" />

          {/* Title */}
          <span
            className="text-white text-[10px] font-bold tracking-widest drop-shadow-md"
            style={{ fontFamily: 'var(--font-pixel)' }}
          >
            POKÉDEX
          </span>
        </div>

        {/* Hinge detail */}
        <div className="h-1.5 mx-6 rounded-b-full bg-black/20" />
      </div>

      {/* Screen area */}
      <div className="mx-2 mb-3 rounded-2xl overflow-hidden border-4 border-black shadow-[inset_0_0_0_2px_rgba(255,255,255,0.1),0_8px_32px_rgba(0,0,0,0.5)]">
        {/* Screen inner glow border */}
        <div className="border-2 border-black/40 rounded-xl overflow-hidden">
          <div
            className="min-h-[calc(100vh-120px)] relative"
            style={{ background: '#0d0d1a' }}
          >
            {/* Scanlines overlay */}
            <div
              className="absolute inset-0 pointer-events-none z-10 opacity-[0.03]"
              style={{
                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,1) 2px, rgba(255,255,255,1) 4px)',
              }}
            />
            {/* Screen content glow */}
            <div className="relative z-0">
              {children}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom panel with speaker holes */}
      <div className="px-6 pb-3 flex justify-end items-center gap-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="w-1 h-4 rounded-full bg-black/30" />
        ))}
      </div>
    </div>
  );
}
