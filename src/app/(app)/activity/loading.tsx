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
        <Skeleton width="110px" height="12px" />
        <Skeleton width="350px" height="36px" borderRadius="var(--radius-md)" />
        <Skeleton width="280px" height="14px" />
      </div>

      {/* Two-column layout: form + list */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.6fr',
          gap: 'var(--space-6)',
          alignItems: 'start',
        }}
      >
        {/* Form skeleton */}
        <section
          style={{
            background: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-5)',
          }}
        >
          <Skeleton width="180px" height="14px" />
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
            >
              <Skeleton width="100px" height="10px" />
              <Skeleton height="38px" borderRadius="var(--radius-md)" />
            </div>
          ))}
          <Skeleton
            height="38px"
            borderRadius="var(--radius-md)"
            style={{ marginTop: 'var(--space-2)' }}
          />
        </section>

        {/* Activity list skeleton */}
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
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr 1fr 1fr',
              gap: 'var(--space-3)',
              padding: 'var(--space-3) var(--space-5)',
              borderBottom: '1px solid var(--color-border)',
              background: 'var(--color-surface-2)',
            }}
          >
            {['120px', '80px', '80px', '60px'].map((w, i) => (
              <Skeleton key={i} width={w} height="10px" />
            ))}
          </div>
          {[1, 2, 3, 4, 5, 7, 8].map((i, idx) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr 1fr 1fr',
                gap: 'var(--space-3)',
                alignItems: 'center',
                padding: 'var(--space-4) var(--space-5)',
                borderBottom: idx < 6 ? '1px solid var(--color-border)' : 'none',
              }}
            >
              <Skeleton width={`${100 + (i % 4) * 20}px`} height="12px" />
              <Skeleton width="70px" height="12px" />
              <Skeleton width="60px" height="22px" borderRadius="var(--radius-sm)" />
              <Skeleton width="50px" height="11px" />
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
