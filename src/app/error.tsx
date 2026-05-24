'use client';

import { useEffect } from 'react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Registrar el error en el servidor/monitoreo sería ideal aquí
    // Por ahora solo se manifiesta en desarrollo para no exponer detalles en producción
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error(error);
    }
  }, [error]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60dvh',
        padding: 'var(--space-8)',
        textAlign: 'center',
        gap: 'var(--space-4)',
      }}
    >
      <p className="eyebrow" style={{ color: 'var(--color-signal-hi)' }}>
        Error inesperado
      </p>
      <h2
        className="font-editorial"
        style={{ fontSize: 'var(--text-2xl)', color: 'var(--color-ink-1)' }}
      >
        Algo salió mal.
      </h2>
      <p style={{ color: 'var(--color-ink-2)', fontSize: 'var(--text-sm)', maxWidth: '40ch' }}>
        Ocurrió un error al cargar esta sección. Puedes intentar de nuevo o volver al panel.
      </p>
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
        <button
          onClick={reset}
          style={{
            padding: 'var(--space-2) var(--space-5)',
            background: 'var(--color-accent)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
          }}
        >
          Intentar de nuevo
        </button>
        <a
          href="/dashboard"
          style={{
            padding: 'var(--space-2) var(--space-5)',
            background: 'var(--color-surface-2)',
            color: 'var(--color-ink-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-sans)',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          Ir al panel
        </a>
      </div>
    </div>
  );
}
