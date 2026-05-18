interface TopBarProps {
  title: string;
  email?: string | undefined;
}

export function TopBar({ title, email }: TopBarProps) {
  return (
    <header
      style={{
        height: 'var(--topbar-h)',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface-0)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--space-6)',
        position: 'sticky',
        top: 0,
        zIndex: 'var(--z-raised)',
      }}
    >
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

      {email && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-ink-2)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {email}
          </span>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--color-accent)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--fw-semibold)',
                color: 'white',
                lineHeight: 1,
              }}
            >
              {email.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      )}
    </header>
  );
}
