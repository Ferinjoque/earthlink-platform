export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--space-6)',
        background:
          'radial-gradient(ellipse 80% 60% at 50% -10%, oklch(58% 0.16 155 / 8%) 0%, transparent 70%), var(--color-surface-0)',
      }}
    >
      {children}
    </div>
  );
}
