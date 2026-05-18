import { Skeleton } from '@/components/ui/Skeleton';

export default function SettingsLoading() {
  return (
    <main
      style={{
        padding: 'var(--space-8)',
        maxWidth: '720px',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-8)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <Skeleton width="120px" height="12px" />
        <Skeleton width="340px" height="36px" borderRadius="var(--radius-md)" />
        <Skeleton width="200px" height="14px" />
      </div>

      {/* Three info sections */}
      {[1, 2, 3].map((section) => (
        <section
          key={section}
          style={{
            background: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          {/* Section header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-5) var(--space-6)',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <Skeleton width="32px" height="32px" borderRadius="var(--radius-md)" />
            <Skeleton width="80px" height="13px" />
          </div>
          {/* Rows */}
          {[1, section === 2 ? 2 : 1].map((row, i) => (
            <div
              key={row}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 'var(--space-4) var(--space-6)',
                borderBottom: i === 0 && section === 2 ? '1px solid var(--color-border)' : 'none',
              }}
            >
              <Skeleton width="100px" height="12px" />
              <Skeleton width="140px" height="12px" />
            </div>
          ))}
        </section>
      ))}
    </main>
  );
}
