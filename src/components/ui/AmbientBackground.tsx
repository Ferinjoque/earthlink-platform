'use client';

export function AmbientBackground() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      {/* Mesh gradient base */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(ellipse 90% 70% at 20% 10%, oklch(58% 0.12 155 / 14%) 0%, transparent 60%),
            radial-gradient(ellipse 60% 50% at 80% 90%, oklch(58% 0.12 155 / 10%) 0%, transparent 55%),
            radial-gradient(ellipse 50% 40% at 60% 30%, oklch(60% 0.10 40 / 8%) 0%, transparent 50%),
            var(--color-surface-0)
          `,
        }}
      />

      {/* Grid topográfico SVG */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0.11,
        }}
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id="topo-grid" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
            <path
              d="M0 40 Q20 20 40 40 Q60 60 80 40"
              fill="none"
              stroke="oklch(58% 0.12 155)"
              strokeWidth="0.6"
              opacity="0.5"
            />
            <path
              d="M0 60 Q20 40 40 60 Q60 80 80 60"
              fill="none"
              stroke="oklch(58% 0.12 155)"
              strokeWidth="0.4"
              opacity="0.3"
            />
            <path
              d="M0 20 Q20 5 40 20 Q60 35 80 20"
              fill="none"
              stroke="oklch(58% 0.12 155)"
              strokeWidth="0.4"
              opacity="0.3"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#topo-grid)" />
      </svg>

      {/* Constellation de puntos */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0.14,
        }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Líneas de constelación */}
        <line
          x1="15%"
          y1="25%"
          x2="30%"
          y2="15%"
          stroke="oklch(58% 0.12 155)"
          strokeWidth="0.5"
          opacity="0.6"
        />
        <line
          x1="30%"
          y1="15%"
          x2="45%"
          y2="30%"
          stroke="oklch(58% 0.12 155)"
          strokeWidth="0.5"
          opacity="0.6"
        />
        <line
          x1="45%"
          y1="30%"
          x2="35%"
          y2="55%"
          stroke="oklch(58% 0.12 155)"
          strokeWidth="0.5"
          opacity="0.4"
        />
        <line
          x1="20%"
          y1="65%"
          x2="35%"
          y2="55%"
          stroke="oklch(58% 0.12 155)"
          strokeWidth="0.5"
          opacity="0.4"
        />
        <line
          x1="20%"
          y1="65%"
          x2="10%"
          y2="80%"
          stroke="oklch(58% 0.12 155)"
          strokeWidth="0.5"
          opacity="0.3"
        />
        <line
          x1="35%"
          y1="55%"
          x2="25%"
          y2="85%"
          stroke="oklch(58% 0.12 155)"
          strokeWidth="0.5"
          opacity="0.3"
        />
        {/* Puntos */}
        <circle cx="15%" cy="25%" r="2.5" fill="oklch(58% 0.12 155)" opacity="0.5" />
        <circle cx="30%" cy="15%" r="2" fill="oklch(58% 0.12 155)" opacity="0.4" />
        <circle cx="45%" cy="30%" r="3" fill="oklch(58% 0.12 155)" opacity="0.5" />
        <circle cx="35%" cy="55%" r="2" fill="oklch(58% 0.12 155)" opacity="0.4" />
        <circle cx="20%" cy="65%" r="2.5" fill="oklch(58% 0.12 155)" opacity="0.45" />
        <circle cx="10%" cy="80%" r="1.5" fill="oklch(58% 0.12 155)" opacity="0.3" />
        <circle cx="25%" cy="85%" r="2" fill="oklch(58% 0.12 155)" opacity="0.35" />
      </svg>

      {/* Orbe 1: verde musgo grande */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          left: '-5%',
          width: '55vw',
          height: '55vw',
          maxWidth: '600px',
          maxHeight: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, oklch(58% 0.16 155 / 9%) 0%, transparent 70%)',
          animation: 'orbDrift 22s ease-in-out infinite',
        }}
      />

      {/* Orbe 2: terracota medio */}
      <div
        style={{
          position: 'absolute',
          bottom: '10%',
          left: '20%',
          width: '35vw',
          height: '35vw',
          maxWidth: '380px',
          maxHeight: '380px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, oklch(62% 0.14 40 / 6%) 0%, transparent 70%)',
          animation: 'orbDrift 28s ease-in-out infinite reverse',
          animationDelay: '-8s',
        }}
      />

      {/* Orbe 3: mostaza pequeño */}
      <div
        style={{
          position: 'absolute',
          top: '40%',
          left: '5%',
          width: '22vw',
          height: '22vw',
          maxWidth: '240px',
          maxHeight: '240px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, oklch(72% 0.12 85 / 5%) 0%, transparent 70%)',
          animation: 'orbDrift 18s ease-in-out infinite',
          animationDelay: '-4s',
        }}
      />

      {/* Noise grain overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '200px 200px',
          opacity: 0.6,
          mixBlendMode: 'multiply',
        }}
      />
    </div>
  );
}
