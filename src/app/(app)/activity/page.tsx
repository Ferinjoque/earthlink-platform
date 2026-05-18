import type { Metadata } from 'next';
import { TopBar } from '@/components/shell/TopBar';
import { createServerClient } from '@/services/supabase/server';

export const metadata: Metadata = { title: 'Actividad' };

export default async function ActividadPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <TopBar title="Registros de actividad" email={user?.email} />
      <main style={{ padding: 'var(--space-8)' }}>
        <p
          style={{
            color: 'var(--color-ink-2)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-sm)',
          }}
        >
          Fase 5 — formulario de envío de actividad próximamente.
        </p>
      </main>
    </>
  );
}
