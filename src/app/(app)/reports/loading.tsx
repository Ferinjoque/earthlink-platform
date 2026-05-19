import { Skeleton } from '@/components/ui/Skeleton';

export default function ReportsLoading() {
  return (
    <main
      style={{
        padding: 'var(--space-8)',
        maxWidth: 'var(--max-w-content)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-8)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <Skeleton width="190px" height="12px" />
        <Skeleton width="360px" height="36px" borderRadius="var(--radius-md)" />
        <Skeleton width="320px" height="14px" />
      </div>

      {/* Exportable periods panel */}
      <section
        style={{
          background: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: 'var(--space-5) var(--space-6)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Skeleton width="180px" height="14px" />
          <Skeleton width="120px" height="34px" borderRadius="var(--radius-md)" />
        </div>
        {[1, 2, 3, 4].map((i, idx) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr',
              gap: 'var(--space-4)',
              alignItems: 'center',
              padding: 'var(--space-4) var(--space-6)',
              borderBottom: idx < 3 ? '1px solid var(--color-border)' : 'none',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <Skeleton width={`${140 + (i % 2) * 30}px`} height="13px" />
              <Skeleton width="80px" height="10px" />
            </div>
            <Skeleton width="65px" height="22px" borderRadius="var(--radius-sm)" />
            <Skeleton width="90px" height="13px" />
            <Skeleton width="100px" height="32px" borderRadius="var(--radius-md)" />
          </div>
        ))}
      </section>

      {/* Export history */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <Skeleton width="160px" height="14px" />
        <div
          style={{
            background: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          {[1, 2, 3].map((i, idx) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 2fr',
                gap: 'var(--space-4)',
                alignItems: 'center',
                padding: 'var(--space-4) var(--space-6)',
                borderBottom: idx < 2 ? '1px solid var(--color-border)' : 'none',
              }}
            >
              <Skeleton width="60px" height="22px" borderRadius="var(--radius-sm)" />
              <Skeleton width="100px" height="12px" />
              <Skeleton width="220px" height="11px" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
