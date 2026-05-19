import { Skeleton } from '@/components/ui/Skeleton';

export default function DashboardLoading() {
  return (
    <main
      style={{
        padding: 'var(--space-8)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-8)',
        maxWidth: 'var(--max-w-content)',
      }}
    >
      {/* Titular skeleton */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <Skeleton width="120px" height="12px" />
        <Skeleton width="380px" height="36px" borderRadius="var(--radius-md)" />
        <Skeleton width="260px" height="14px" />
      </section>

      {/* KPI strip skeleton */}
      <section
        style={{
          background: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6) var(--space-8)',
          display: 'grid',
          gridTemplateColumns: '1fr auto auto',
          gap: 'var(--space-6)',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <Skeleton width="80px" height="10px" />
          <Skeleton width="160px" height="48px" borderRadius="var(--radius-md)" />
          <Skeleton width="120px" height="10px" />
        </div>
        <div
          style={{
            borderLeft: '1px solid var(--color-border)',
            paddingLeft: 'var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
          }}
        >
          <Skeleton width="60px" height="10px" />
          <Skeleton width="100px" height="28px" borderRadius="var(--radius-md)" />
        </div>
        <div
          style={{
            borderLeft: '1px solid var(--color-border)',
            paddingLeft: 'var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
          }}
        >
          <Skeleton width="60px" height="10px" />
          <Skeleton width="100px" height="28px" borderRadius="var(--radius-md)" />
        </div>
      </section>

      {/* Distribution bar skeleton */}
      <section
        style={{
          background: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}
      >
        <Skeleton width="140px" height="10px" />
        {[1, 2].map((i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Skeleton width="140px" height="10px" />
              <Skeleton width="80px" height="10px" />
            </div>
            <Skeleton height="5px" borderRadius="9999px" />
          </div>
        ))}
      </section>

      {/* Modules list skeleton */}
      <section>
        <Skeleton width="160px" height="10px" style={{ marginBottom: 'var(--space-4)' }} />
        <div
          style={{
            background: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          {[1, 2, 3, 4].map((i, idx) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                alignItems: 'center',
                gap: 'var(--space-4)',
                padding: 'var(--space-4) var(--space-6)',
                borderBottom: idx < 3 ? '1px solid var(--color-border)' : 'none',
              }}
            >
              <Skeleton width="34px" height="34px" borderRadius="var(--radius-md)" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <Skeleton width="180px" height="13px" />
                <Skeleton width="240px" height="10px" />
              </div>
              <Skeleton width="50px" height="10px" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
