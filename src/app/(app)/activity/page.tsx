import type { Metadata } from 'next';
import { TopBar } from '@/components/shell/TopBar';
import { createServerClient } from '@/services/supabase/server';

export const metadata: Metadata = { title: 'Activity' };

export default async function ActivityPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <TopBar title="Activity Entries" email={user?.email} />
      <main style={{ padding: 'var(--space-8)' }}>
        <p
          style={{
            color: 'var(--color-ink-2)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-sm)',
          }}
        >
          Phase 5 — activity entry submission form coming soon.
        </p>
      </main>
    </>
  );
}
