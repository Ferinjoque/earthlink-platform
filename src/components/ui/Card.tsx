import type { CSSProperties, ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  variant?: 'default' | 'elevated' | 'accent' | 'surface';
}

export function Card({ children, style, className, variant = 'default' }: CardProps) {
  const variantStyles: CSSProperties =
    variant === 'elevated'
      ? { boxShadow: 'var(--shadow-md)' }
      : variant === 'accent'
        ? { background: 'var(--color-accent-soft)', border: '1px solid oklch(42% 0.12 155 / 22%)' }
        : variant === 'surface'
          ? { background: 'var(--color-surface-2)', border: 'none' }
          : {};

  return (
    <div
      className={className}
      style={{
        background: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        ...variantStyles,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: { value: string; positive: boolean };
  accent?: boolean;
}

export function StatCard({ label, value, unit, delta, accent }: StatCardProps) {
  return (
    <Card
      style={{
        padding: 'var(--space-6)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        background: accent ? 'var(--color-accent-soft)' : undefined,
        border: accent ? '1px solid oklch(42% 0.12 155 / 22%)' : undefined,
        transition: 'box-shadow var(--duration-fast) var(--ease-out-expo)',
      }}
    >
      <span className="eyebrow">{label}</span>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
        <span
          className="numeric-tabular"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-3xl)',
            fontWeight: 'var(--fw-bold)',
            color: accent ? 'var(--color-accent)' : 'var(--color-ink-1)',
            lineHeight: 'var(--leading-tight)',
            letterSpacing: 'var(--tracking-tight)',
          }}
        >
          {value}
        </span>
        {unit && (
          <span
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-ink-3)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {unit}
          </span>
        )}
      </div>

      {delta && (
        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: delta.positive ? 'var(--color-signal-ok)' : 'var(--color-signal-hi)',
            fontWeight: 'var(--fw-semibold)',
            fontFamily: 'var(--font-mono)',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
          }}
        >
          {delta.positive ? '↑' : '↓'} {delta.value}
        </span>
      )}
    </Card>
  );
}
