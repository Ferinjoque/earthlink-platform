import { Skeleton } from '@/components/ui/Skeleton';

export default function LoadingDetallePeriodo() {
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
      <Skeleton width="140px" height="14px" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <Skeleton width="420px" height="40px" borderRadius="var(--radius-md)" />
        <Skeleton width="200px" height="12px" />
      </div>

      <Skeleton height="96px" borderRadius="var(--radius-lg)" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <Skeleton width="180px" height="16px" />
        <Skeleton height="240px" borderRadius="var(--radius-lg)" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <Skeleton width="160px" height="16px" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} height="40px" borderRadius="var(--radius-md)" />
        ))}
      </div>
    </main>
  );
}
