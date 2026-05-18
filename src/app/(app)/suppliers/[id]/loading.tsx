import { Skeleton } from '@/components/ui/Skeleton';

export default function SupplierDetailLoading() {
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
      {/* Back link */}
      <Skeleton width="140px" height="12px" />

      {/* Header */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 'var(--space-6)',
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Skeleton width="80px" height="12px" />
          <Skeleton width="320px" height="36px" borderRadius="var(--radius-md)" />
          <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
            <Skeleton width="160px" height="12px" />
            <Skeleton width="100px" height="12px" />
          </div>
        </div>
        <Skeleton width="160px" height="80px" borderRadius="var(--radius-lg)" />
      </section>

      {/* Periods section */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Skeleton width="160px" height="12px" />
          <Skeleton width="120px" height="34px" borderRadius="var(--radius-md)" />
        </div>
        <div
          style={{
            background: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1.4fr 1fr 1fr 1fr',
              gap: 'var(--space-4)',
              padding: 'var(--space-3) var(--space-4)',
              borderBottom: '1px solid var(--color-border)',
              background: 'var(--color-surface-2)',
            }}
          >
            {['80px', '140px', '70px', '90px', '40px'].map((w, i) => (
              <Skeleton key={i} width={w} height="10px" />
            ))}
          </div>
          {[1, 2, 3].map((i, idx) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1.4fr 1fr 1fr 1fr',
                gap: 'var(--space-4)',
                alignItems: 'center',
                padding: 'var(--space-4) var(--space-4)',
                borderBottom: idx < 2 ? '1px solid var(--color-border)' : 'none',
              }}
            >
              <Skeleton width="70px" height="13px" />
              <Skeleton width="120px" height="11px" />
              <Skeleton width="65px" height="22px" borderRadius="var(--radius-sm)" />
              <Skeleton width="80px" height="12px" />
              <Skeleton width="24px" height="12px" />
            </div>
          ))}
        </div>
      </section>

      {/* Activity entries section */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <Skeleton width="200px" height="12px" />
        <div
          style={{
            background: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          {[1, 2, 3, 4, 5].map((i, idx) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.5fr 1fr 1fr 1fr',
                gap: 'var(--space-4)',
                alignItems: 'center',
                padding: 'var(--space-4) var(--space-4)',
                borderBottom: idx < 4 ? '1px solid var(--color-border)' : 'none',
              }}
            >
              <Skeleton width={`${100 + (i % 3) * 20}px`} height="13px" />
              <Skeleton width="80px" height="11px" />
              <Skeleton width="60px" height="22px" borderRadius="var(--radius-sm)" />
              <Skeleton width="70px" height="11px" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
