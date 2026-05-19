import { Skeleton } from '@/components/ui/Skeleton';

export default function AuditLoading() {
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
        <Skeleton width="90px" height="12px" />
        <Skeleton width="300px" height="36px" borderRadius="var(--radius-md)" />
        <Skeleton width="260px" height="14px" />
      </div>

      {/* Status chips */}
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        {['80px', '100px', '110px', '80px'].map((w, i) => (
          <Skeleton key={i} width={w} height="30px" borderRadius="9999px" />
        ))}
      </div>

      {/* Periods table */}
      <section
        style={{
          background: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        {/* Table header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr',
            gap: 'var(--space-4)',
            padding: 'var(--space-3) var(--space-6)',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-surface-2)',
          }}
        >
          {['120px', '80px', '90px', '80px', '70px'].map((w, i) => (
            <Skeleton key={i} width={w} height="10px" />
          ))}
        </div>
        {/* Rows */}
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i, idx) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr',
              gap: 'var(--space-4)',
              alignItems: 'center',
              padding: 'var(--space-4) var(--space-6)',
              borderBottom: idx < 7 ? '1px solid var(--color-border)' : 'none',
            }}
          >
            <Skeleton width={`${120 + (i % 3) * 25}px`} height="13px" />
            <Skeleton width="70px" height="13px" />
            <Skeleton width="75px" height="22px" borderRadius="var(--radius-sm)" />
            <Skeleton width="90px" height="13px" />
            <Skeleton width="80px" height="30px" borderRadius="var(--radius-md)" />
          </div>
        ))}
      </section>
    </main>
  );
}
