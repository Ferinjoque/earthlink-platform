import type { Metadata } from 'next';
import { TopBar } from '@/components/shell/TopBar';
import { createServerClient } from '@/services/supabase/server';

export const metadata: Metadata = { title: 'Audit' };

export default async function AuditPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <TopBar title="Audit Console" email={user?.email} />
      <main style={{ padding: 'var(--space-8)' }}>
        <p
          style={{
            color: 'var(--color-ink-2)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-sm)',
          }}
        >
          Phase 6 — audit console and immutable audit trail coming soon.
        </p>
      </main>
    </>
  );
}
