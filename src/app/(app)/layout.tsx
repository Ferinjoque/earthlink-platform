import { redirect } from 'next/navigation';
import { createServerClient } from '@/services/supabase/server';
import { Sidebar } from '@/components/shell/Sidebar';
import { ToastProvider } from '@/components/ui/Toast';
import { SearchProvider } from '@/components/shell/SearchContext';
import type { MembershipRow } from '@/types/database';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch suppliers for global search
  const { data: rawMemberships } = await supabase
    .from('memberships')
    .select('organization_id')
    .eq('user_id', user.id);

  const orgIds = [
    ...new Set(
      ((rawMemberships ?? []) as Pick<MembershipRow, 'organization_id'>[])
        .map((m) => m.organization_id)
        .filter((id): id is string => id !== null),
    ),
  ];

  type SupplierOption = { id: string; name: string; category: string };
  const searchSuppliers: SupplierOption[] = [];
  if (orgIds.length) {
    const { data } = await supabase
      .from('suppliers')
      .select('id, name, category')
      .in('organization_id', orgIds)
      .is('archived_at', null)
      .order('name');
    if (data) searchSuppliers.push(...(data as SupplierOption[]));
  }

  return (
    <SearchProvider suppliers={searchSuppliers}>
      <ToastProvider>
        <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden' }}>
          <Sidebar />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
            {children}
          </div>
        </div>
        <div id="toast-root" />
      </ToastProvider>
    </SearchProvider>
  );
}
