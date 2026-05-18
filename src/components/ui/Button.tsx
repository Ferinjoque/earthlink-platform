'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
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
    border: '1px solid var(--color-signal-hi)',
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
        opacity: isDisabled ? 0.55 : 1,
        transition: `opacity var(--duration-fast) var(--ease-out-expo), transform var(--duration-fast) var(--ease-out-expo)`,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        ...VARIANT_STYLES[variant],
        ...SIZE_STYLES[size],
        ...style,
      }}
      {...props}
    >
      {loading ? '…' : children}
    </button>
  );
}
