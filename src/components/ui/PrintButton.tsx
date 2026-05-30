'use client';

interface PrintButtonProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function PrintButton({ children, style }: PrintButtonProps) {
  return (
    <>
      <style>{`.print-btn { transition: background 120ms, color 120ms, border-color 120ms, opacity 120ms; }
.print-btn:hover { background: var(--color-surface-2) !important; color: var(--color-ink-1) !important; }`}</style>
      <button type="button" className="print-btn" onClick={() => window.print()} style={style}>
        {children}
      </button>
    </>
  );
}
