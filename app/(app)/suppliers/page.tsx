import type { Metadata } from 'next';
import { createServerClient } from '@/services/supabase/server';
import { TopBar } from '@/components/shell/TopBar';

export const metadata: Metadata = { title: 'Suppliers' };

export default async function SuppliersPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <TopBar title="Suppliers" email={user?.email} />
      <main style={{ padding: 'var(--space-8)' }}>
        <p
          style={{
            color: 'var(--color-ink-2)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-sm)',
          }}
        >
          Phase 5 — supplier management coming soon.
        </p>
      </main>
    </>
  );
}
