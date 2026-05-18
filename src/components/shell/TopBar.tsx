interface TopBarProps {
  title: string;
  email?: string | undefined;
  section?: string | undefined;
}

export function TopBar({ title, email, section }: TopBarProps) {
  const inicial = email?.charAt(0).toUpperCase() ?? '?';

  return (
    <header
      style={{
        height: 'var(--topbar-h)',
        borderBottom: '1px solid var(--color-border)',
        background: 'color-mix(in oklch, var(--color-surface-0) 85%, transparent)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--space-6)',
        position: 'sticky',
        top: 0,
        zIndex: 'var(--z-raised)',
      }}
    >
      {/* Título + sección */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)' }}>
        <h1
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-base)',
            fontWeight: 'var(--fw-semibold)',
            color: 'var(--color-ink-1)',
            margin: 0,
            letterSpacing: 'var(--tracking-tight)',
          }}
        >
          {title}
        </h1>
        {section && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-ink-3)',
              letterSpacing: 'var(--tracking-wide)',
            }}
          >
            / {section}
          </span>
        )}
      </div>

      {/* Derecha: hint cmd-K + avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        {/* Cmd-K hint visual */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface-2)',
            cursor: 'default',
            opacity: 0.7,
          }}
        >
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-ink-3)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            Buscar…
          </span>
          <kbd
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '1px 5px',
              borderRadius: '4px',
              background: 'var(--color-surface-3)',
              border: '1px solid var(--color-border-strong)',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-ink-3)',
              lineHeight: 1.4,
            }}
          >
            ⌘K
          </kbd>
        </div>

        {/* Avatar */}
        {email && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--color-ink-2)',
                fontFamily: 'var(--font-sans)',
                maxWidth: '160px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {email}
            </span>
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: 'var(--radius-pill)',
                background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-2) 100%)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                boxShadow: '0 0 0 2px var(--color-surface-0), 0 0 0 3px var(--color-accent-soft)',
              }}
            >
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--fw-bold)',
                  color: 'white',
                  lineHeight: 1,
                }}
              >
                {inicial}
              </span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
