'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';


type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
}


const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}


const VARIANT_STYLES: Record<ToastVariant, { background: string; color: string; border: string }> =
  {
    success: {
      background: 'var(--color-signal-ok-bg)',
      color: 'var(--color-signal-ok)',
      border: '1px solid oklch(42% 0.12 155 / 25%)',
    },
    error: {
      background: 'var(--color-signal-hi-bg)',
      color: 'var(--color-signal-hi)',
      border: '1px solid rgba(192, 57, 43, 0.2)',
    },
    info: {
      background: 'var(--color-surface-2)',
      color: 'var(--color-ink-2)',
      border: '1px solid var(--color-border)',
    },
  };

function ToastBubble({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const styles = VARIANT_STYLES[item.variant];

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-3) var(--space-4)',
        borderRadius: 'var(--radius-md)',
        background: styles.background,
        border: styles.border,
        boxShadow: 'var(--shadow-md)',
        minWidth: '260px',
        maxWidth: '400px',
        animation: 'toast-in 220ms var(--ease-out-expo) forwards',
      }}
    >
      <span
        style={{
          fontSize: 'var(--text-sm)',
          color: styles.color,
          fontFamily: 'var(--font-mono)',
          flex: 1,
          lineHeight: 1.4,
        }}
      >
        {item.message}
      </span>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: styles.color,
          opacity: 0.5,
          fontSize: 'var(--text-xs)',
          padding: '2px',
          lineHeight: 1,
          flexShrink: 0,
        }}
        aria-label="Cerrar notificación"
      >
        ✕
      </button>
    </div>
  );
}


let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, message, variant }]);
      const timer = setTimeout(() => dismiss(id), 4000);
      timersRef.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
    };
  }, []);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {mounted &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              bottom: 'var(--space-6)',
              right: 'var(--space-6)',
              zIndex: 'var(--z-toast)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
              alignItems: 'flex-end',
              pointerEvents: 'none',
            }}
          >
            {toasts.map((t) => (
              <div key={t.id} style={{ pointerEvents: 'auto' }}>
                <ToastBubble item={t} onDismiss={dismiss} />
              </div>
            ))}
          </div>,
          document.getElementById('toast-root') ?? document.body,
        )}
    </ToastContext.Provider>
  );
}
