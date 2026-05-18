import type { CSSProperties } from 'react';

type BadgeVariant =
  | 'low'
  | 'medium'
  | 'high'
  | 'draft'
  | 'submitted'
  | 'validated'
  | 'rejected'
  | 'open'
  | 'calculating'
  | 'under_review'
  | 'locked'
  | 'neutral';

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
}

const VARIANT_STYLES: Record<BadgeVariant, CSSProperties> = {
  low: {
    background: 'color-mix(in oklch, var(--color-accent) 15%, transparent)',
    color: 'var(--color-accent)',
  },
  medium: {
    background: 'color-mix(in oklch, #f59e0b 15%, transparent)',
    color: '#d97706',
  },
  high: {
    background: 'var(--color-signal-hi-bg)',
    color: 'var(--color-signal-hi)',
  },
  draft: {
    background: 'color-mix(in oklch, var(--color-ink-3) 20%, transparent)',
    color: 'var(--color-ink-2)',
  },
  submitted: {
    background: 'color-mix(in oklch, #3b82f6 15%, transparent)',
    color: '#2563eb',
  },
  validated: {
    background: 'color-mix(in oklch, var(--color-accent) 15%, transparent)',
    color: 'var(--color-accent)',
    boxShadow: '0 0 0 1px oklch(58% 0.16 155 / 20%)',
  },
  rejected: {
    background: 'var(--color-signal-hi-bg)',
    color: 'var(--color-signal-hi)',
  },
  open: {
    background: 'color-mix(in oklch, var(--color-accent) 15%, transparent)',
    color: 'var(--color-accent)',
  },
  calculating: {
    background: 'color-mix(in oklch, #f59e0b 15%, transparent)',
    color: '#d97706',
  },
  under_review: {
    background: 'color-mix(in oklch, #8b5cf6 15%, transparent)',
    color: '#7c3aed',
  },
  locked: {
    background: 'color-mix(in oklch, var(--color-ink-3) 20%, transparent)',
    color: 'var(--color-ink-2)',
  },
  neutral: {
    background: 'color-mix(in oklch, var(--color-ink-3) 20%, transparent)',
    color: 'var(--color-ink-2)',
  },
};

export function Badge({ variant, children }: BadgeProps) {
  return (
    <span
      style={{
        ...VARIANT_STYLES[variant],
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 'var(--radius-pill)',
        fontSize: 'var(--text-xs)',
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        lineHeight: '1.4',
      }}
    >
      {children}
    </span>
  );
}
