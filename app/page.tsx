/**
 * EarthLink landing page — placeholder for Phase 4 (feat/phase-4-auth-rls).
 * Shows the product concept and links to the app shell once auth is wired.
 */

export default function LandingPage() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-8)',
        background: 'var(--color-surface-0)',
        gap: 'var(--space-6)',
      }}
    >
      {/* Wordmark */}
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 'var(--text-3xl)',
          fontWeight: 600,
          color: 'var(--color-ink-1)',
          letterSpacing: 'var(--tracking-tight)',
        }}
      >
        EarthLink
      </div>

      {/* Status badge */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-1) var(--space-3)',
          borderRadius: 'var(--radius-pill)',
          background: 'var(--color-signal-ok-bg)',
          border: '1px solid var(--color-signal-ok)',
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--fw-semibold)',
          letterSpacing: 'var(--tracking-widest)',
          color: 'var(--color-signal-ok)',
          textTransform: 'uppercase',
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--color-signal-ok)',
            flexShrink: 0,
          }}
        />
        Phase 0 · Foundation
      </div>

      {/* Headline */}
      <h1
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-4xl)',
          fontWeight: 'var(--fw-bold)',
          color: 'var(--color-ink-1)',
          textAlign: 'center',
          letterSpacing: 'var(--tracking-tight)',
          lineHeight: 'var(--leading-tight)',
          maxWidth: '14ch',
          margin: 0,
        }}
      >
        Automated GHG Auditing for Scope 1 & 2
      </h1>

      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-lg)',
          color: 'var(--color-ink-2)',
          textAlign: 'center',
          maxWidth: '52ch',
          lineHeight: 'var(--leading-relaxed)',
          margin: 0,
        }}
      >
        Every tCO₂e traced back to its raw input, emission factor version, and
        calculation engine version. Built on GHG Protocol. Powered by immutable audit logs.
      </p>

      {/* Architecture callout */}
      <div
        style={{
          marginTop: 'var(--space-4)',
          padding: 'var(--space-4) var(--space-6)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          gap: 'var(--space-8)',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        {[
          { label: 'Domain model', tag: 'OOP', desc: 'EmissionSource hierarchy' },
          { label: 'Calc engine', tag: 'FP', desc: 'Pure pipeline, big.js' },
          { label: 'Storage', tag: 'DB', desc: '15-table Supabase schema' },
        ].map(({ label, tag, desc }) => (
          <div key={tag} style={{ textAlign: 'center', minWidth: '120px' }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--fw-bold)',
                color: 'var(--color-accent)',
                letterSpacing: 'var(--tracking-wide)',
                marginBottom: 'var(--space-1)',
              }}
            >
              {tag}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--fw-semibold)',
                color: 'var(--color-ink-1)',
              }}
            >
              {label}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-ink-3)',
              }}
            >
              {desc}
            </div>
          </div>
        ))}
      </div>

      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-ink-3)',
          marginTop: 'var(--space-8)',
        }}
      >
        App shell coming in Phase 4 — feat/phase-4-auth-rls
      </p>
    </main>
  );
}
