import type { CSSProperties, ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export function Card({ children, style, className }: CardProps) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
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
        borderLeft: accent ? '3px solid var(--color-accent)' : undefined,
      }}
    >
      <span
        style={{
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--fw-medium)',
          color: 'var(--color-ink-2)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--tracking-widest)',
        }}
      >
        {label}
      </span>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-3xl)',
            fontWeight: 'var(--fw-bold)',
            color: 'var(--color-ink-1)',
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
              color: 'var(--color-ink-2)',
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
            fontWeight: 'var(--fw-medium)',
          }}
        >
          {delta.positive ? '↑' : '↓'} {delta.value}
        </span>
      )}
    </Card>
  );
}
