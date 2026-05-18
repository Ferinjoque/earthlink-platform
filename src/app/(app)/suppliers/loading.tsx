import { Skeleton } from '@/components/ui/Skeleton';

export default function SuppliersLoading() {
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
        <Skeleton width="100px" height="12px" />
        <Skeleton width="320px" height="36px" borderRadius="var(--radius-md)" />
        <Skeleton width="240px" height="14px" />
      </div>

      {/* Table */}
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
            gridTemplateColumns: '2fr 1fr 2fr 1fr',
            gap: 'var(--space-4)',
            padding: 'var(--space-3) var(--space-6)',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-surface-2)',
          }}
        >
          {['160px', '80px', '180px', '60px'].map((w, i) => (
            <Skeleton key={i} width={w} height="10px" />
          ))}
        </div>
        {/* Rows */}
        {[1, 2, 3, 4, 5, 6].map((i, idx) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 2fr 1fr',
              gap: 'var(--space-4)',
              alignItems: 'center',
              padding: 'var(--space-4) var(--space-6)',
              borderBottom: idx < 5 ? '1px solid var(--color-border)' : 'none',
            }}
          >
            <Skeleton width={`${130 + (i % 3) * 30}px`} height="13px" />
            <Skeleton width="70px" height="22px" borderRadius="var(--radius-sm)" />
            <Skeleton width={`${140 + (i % 2) * 40}px`} height="11px" />
            <Skeleton width="24px" height="13px" />
          </div>
        ))}
      </section>
    </main>
  );
}
