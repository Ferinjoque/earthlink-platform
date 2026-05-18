import type { Metadata } from 'next';
import { createServerClient } from '@/services/supabase/server';
import { TopBar } from '@/components/shell/TopBar';

export const metadata: Metadata = { title: 'Reports' };

export default async function ReportsPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <TopBar title="Reports" email={user?.email} />
      <main style={{ padding: 'var(--space-8)' }}>
        <p
          style={{
            color: 'var(--color-ink-2)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-sm)',
          }}
        >
          Phase 7 — PDF and CSV export with sha256 verification coming soon.
        </p>
      </main>
    </>
  );
}
