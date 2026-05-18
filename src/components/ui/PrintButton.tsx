'use client';

interface PrintButtonProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function PrintButton({ children, style }: PrintButtonProps) {
  return (
    <button type="button" onClick={() => window.print()} style={style}>
      {children}
    </button>
  );
}
