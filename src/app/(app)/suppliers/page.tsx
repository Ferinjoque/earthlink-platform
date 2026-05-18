import type { Metadata } from 'next';
import { TopBar } from '@/components/shell/TopBar';
import { createServerClient } from '@/services/supabase/server';

export const metadata: Metadata = { title: 'Proveedores' };

export default async function ProveedoresPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <TopBar title="Proveedores" email={user?.email} />
      <main style={{ padding: 'var(--space-8)' }}>
        <p
          style={{
            color: 'var(--color-ink-2)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-sm)',
          }}
        >
          Fase 5 — gestión de proveedores próximamente.
        </p>
      </main>
    </>
  );
}
