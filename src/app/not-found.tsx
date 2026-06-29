import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '404 · Página no encontrada',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <>
      <style>{`
        .nf-root {
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: var(--space-10) var(--space-8) var(--space-32);
          background: var(--color-surface-0);
          text-align: center;
          gap: var(--space-6);
        }
        .nf-illustration {
          opacity: 0.55;
        }
        .nf-back:hover {
          background: var(--color-accent) !important;
          color: white !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .nf-illustration { opacity: 0.45; }
        }
      `}</style>

      <main className="nf-root">
        {/* Ilustración SVG - árbol con hoja caída, paleta forest */}
        <svg
          className="nf-illustration"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 220 200"
          width="200"
          height="182"
          aria-hidden="true"
          fill="none"
        >
          {/* Tronco */}
          <rect x="102" y="130" width="16" height="52" rx="4" fill="#4A8A6F" opacity="0.6" />
          {/* Sombra de copa */}
          <ellipse cx="110" cy="132" rx="55" ry="14" fill="#1F5C45" opacity="0.08" />
          {/* Copa principal */}
          <ellipse cx="110" cy="82" rx="52" ry="56" fill="#2E7D5B" opacity="0.18" />
          {/* Copa interior */}
          <ellipse cx="110" cy="76" rx="38" ry="44" fill="#1F5C45" opacity="0.28" />
          {/* Destello de copa */}
          <ellipse cx="98" cy="58" rx="16" ry="18" fill="#4DD0A8" opacity="0.15" />

          {/* Hoja caída desconectada */}
          <g transform="translate(158, 120) rotate(-35)">
            <path d="M0 0 C6 -14 18 -18 22 -8 C26 2 14 14 0 0Z" fill="#1F5C45" opacity="0.45" />
            <line x1="0" y1="0" x2="11" y2="-9" stroke="#4A8A6F" strokeWidth="0.8" opacity="0.5" />
          </g>

          {/* "404" tipográfico integrado en la copa */}
          <text
            x="110"
            y="78"
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="Georgia, serif"
            fontStyle="italic"
            fontSize="36"
            fontWeight="400"
            fill="#1F5C45"
            opacity="0.55"
            letterSpacing="-1"
          >
            404
          </text>
        </svg>

        {/* Eyebrow */}
        <p className="eyebrow" style={{ color: 'var(--color-ink-3)', letterSpacing: '0.12em' }}>
          Ruta no encontrada
        </p>

        {/* Headline editorial */}
        <h1
          className="font-display"
          style={{
            fontSize: 'var(--text-3xl)',
            color: 'var(--color-ink-1)',
            margin: 0,
            maxWidth: '18ch',
          }}
        >
          Esta página se perdió en el bosque.
        </h1>

        {/* Subcopy */}
        <p
          style={{
            color: 'var(--color-ink-2)',
            fontSize: 'var(--text-sm)',
            maxWidth: '38ch',
            margin: 0,
          }}
        >
          La ruta que buscas no existe o fue movida. Vuelve al panel para continuar.
        </p>

        {/* CTA */}
        <Link
          href="/dashboard"
          className="nf-back"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-6)',
            background: 'var(--color-surface-1)',
            color: 'var(--color-accent)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            textDecoration: 'none',
            transition: 'background var(--duration-fast), color var(--duration-fast)',
          }}
        >
          Volver al panel
        </Link>
      </main>
    </>
  );
}
