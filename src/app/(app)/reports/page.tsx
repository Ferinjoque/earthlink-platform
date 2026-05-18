import type { Metadata } from 'next';
import { TopBar } from '@/components/shell/TopBar';
import { createServerClient } from '@/services/supabase/server';

export const metadata: Metadata = { title: 'Reportes' };

export default async function ReportesPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <TopBar title="Reportes" email={user?.email} section="Exportaciones y certificados" />
      <main style={{ padding: 'var(--space-8)' }}>
        <p
          style={{
            color: 'var(--color-ink-2)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-sm)',
          }}
        >
          Fase 7 — exportación PDF y CSV con verificación sha256 próximamente.
        </p>
      </main>
    </>
  );
}
