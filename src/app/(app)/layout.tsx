import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
import { createServerClient } from '@/services/supabase/server';
import { Sidebar } from '@/components/shell/Sidebar';
import { PageTransition } from '@/components/shell/PageTransition';
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

  // Cargar proveedores para búsqueda global
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
  let anomaliaCount = 0;

  if (orgIds.length) {
    const [suppliersResult, anomaliaResult] = await Promise.all([
      supabase
        .from('suppliers')
        .select('id, name, category')
        .in('organization_id', orgIds)
        .is('archived_at', null)
        .order('name'),
      supabase
        .from('anomaly_flags')
        .select('id, activity_entries!inner(reporting_periods!inner(suppliers!inner(organization_id)))', { count: 'exact', head: true })
        .eq('is_resolved', false)
        .in('activity_entries.reporting_periods.suppliers.organization_id', orgIds),
    ]);
    if (suppliersResult.data) searchSuppliers.push(...(suppliersResult.data as SupplierOption[]));
    anomaliaCount = anomaliaResult.count ?? 0;
  }

  return (
    <SearchProvider suppliers={searchSuppliers}>
      <ToastProvider>
        <div data-app-root style={{ display: 'flex', height: '100dvh', overflow: 'hidden' }}>
          <Sidebar anomaliaCount={anomaliaCount} />
          <div data-app-main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
            <PageTransition>{children}</PageTransition>
          </div>
        </div>
        <div id="toast-root" />
      </ToastProvider>
    </SearchProvider>
  );
}
