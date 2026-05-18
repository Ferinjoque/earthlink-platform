'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warm';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

const VARIANT_STYLES: Record<Variant, React.CSSProperties> = {
  primary: {
    background: 'var(--color-accent)',
    color: 'white',
    border: 'none',
    boxShadow: 'var(--shadow-glow)',
  },
  secondary: {
    background: 'var(--color-surface-2)',
    color: 'var(--color-ink-1)',
    border: '1px solid var(--color-border)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--color-ink-2)',
    border: '1px solid transparent',
  },
  danger: {
    background: 'var(--color-signal-hi-bg)',
    color: 'var(--color-signal-hi)',
    border: '1px solid oklch(50% 0.16 20 / 30%)',
  },
  warm: {
    background: 'var(--color-warm-soft)',
    color: 'var(--color-warm)',
    border: '1px solid oklch(62% 0.14 40 / 25%)',
  },
};

const SIZE_STYLES: Record<Size, React.CSSProperties> = {
  sm: {
    padding: 'var(--space-1) var(--space-3)',
    fontSize: 'var(--text-sm)',
  },
  md: {
    padding: 'var(--space-2) var(--space-5)',
    fontSize: 'var(--text-base)',
  },
  lg: {
    padding: 'var(--space-3) var(--space-6)',
    fontSize: 'var(--text-lg)',
  },
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-2)',
        borderRadius: 'var(--radius-md)',
        fontFamily: 'var(--font-sans)',
        fontWeight: 'var(--fw-semibold)',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.5 : 1,
        transition: `opacity var(--duration-fast) var(--ease-out-expo), transform var(--duration-fast) var(--ease-out-expo), box-shadow var(--duration-fast)`,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        letterSpacing: 'var(--tracking-normal)',
        ...VARIANT_STYLES[variant],
        ...SIZE_STYLES[size],
        ...style,
      }}
      {...props}
    >
      {loading ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span
            style={{
              width: '12px',
              height: '12px',
              border: '2px solid currentColor',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              display: 'inline-block',
              animation: 'ringSpin 0.7s linear infinite',
            }}
          />
          Cargando…
        </span>
      ) : (
        children
      )}
    </button>
  );
}
