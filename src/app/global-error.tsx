'use client';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// Este componente reemplaza el root layout cuando hay un error crítico.
// Debe incluir sus propios <html> y <body>.
export default function GlobalError({ reset }: GlobalErrorProps) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, sans-serif',
          background: '#FAF7F0',
          color: '#0F1F1B',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100dvh',
          textAlign: 'center',
          padding: '2rem',
          gap: '1rem',
        }}
      >
        <p
          style={{
            fontSize: '0.75rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#C0392B',
            fontWeight: 500,
          }}
        >
          Error crítico
        </p>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 600, margin: 0 }}>
          La aplicación no pudo cargarse.
        </h1>
        <p style={{ color: '#4A5854', fontSize: '0.9rem', maxWidth: '38ch' }}>
          Ocurrió un error en el núcleo de la aplicación. Intenta recargar la página.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem 1.5rem',
            background: '#1F5C45',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          Recargar
        </button>
      </body>
    </html>
  );
}
