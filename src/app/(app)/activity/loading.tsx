import { Skeleton } from '@/components/ui/Skeleton';

export default function ActivityLoading() {
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
        <Skeleton width="140px" height="12px" />
        <Skeleton width="340px" height="36px" borderRadius="var(--radius-md)" />
        <Skeleton width="260px" height="14px" />
      </div>

      {/* Activity form section */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <Skeleton width="140px" height="16px" />
          <Skeleton width="280px" height="13px" />
        </div>
        <div
          style={{
            background: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)',
            maxWidth: '560px',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
              >
                <Skeleton width="90px" height="10px" />
                <Skeleton height="36px" borderRadius="var(--radius-md)" />
              </div>
            ))}
          </div>
          <Skeleton height="36px" borderRadius="var(--radius-md)" style={{ maxWidth: '160px' }} />
        </div>
      </section>

      {/* CSV import section */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <Skeleton width="160px" height="16px" />
          <Skeleton width="320px" height="13px" />
        </div>
        <div
          style={{
            background: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)',
            maxWidth: '800px',
          }}
        >
          <Skeleton height="80px" borderRadius="var(--radius-lg)" />
        </div>
      </section>

      {/* Activity list section */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <Skeleton width="180px" height="16px" />
          <Skeleton width="200px" height="13px" />
        </div>
        <div
          style={{
            background: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          {/* Filter bar */}
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-3)',
              padding: 'var(--space-3) var(--space-4)',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <Skeleton width="50px" height="10px" />
            <Skeleton width="130px" height="26px" borderRadius="var(--radius-md)" />
            <Skeleton width="130px" height="26px" borderRadius="var(--radius-md)" />
          </div>
          {/* Table header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1.2fr 1fr 0.8fr 0.8fr',
              gap: 'var(--space-3)',
              padding: 'var(--space-2) var(--space-3)',
              borderBottom: '1px solid var(--color-border)',
              background: 'var(--color-surface-2)',
            }}
          >
            {['80px', '80px', '100px', '70px', '60px', '80px'].map((w, i) => (
              <Skeleton key={i} width={w} height="10px" />
            ))}
          </div>
          {/* Rows */}
          {[1, 2, 3, 4, 5].map((i, idx) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1.2fr 1fr 0.8fr 0.8fr',
                gap: 'var(--space-3)',
                alignItems: 'center',
                padding: 'var(--space-3) var(--space-3)',
                borderBottom: idx < 4 ? '1px solid var(--color-border)' : 'none',
              }}
            >
              <Skeleton width="70px" height="12px" />
              <Skeleton width="75px" height="12px" />
              <Skeleton width={`${80 + (i % 3) * 15}px`} height="12px" />
              <Skeleton width="60px" height="22px" borderRadius="var(--radius-sm)" />
              <Skeleton width="50px" height="11px" />
              <Skeleton width="70px" height="11px" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
