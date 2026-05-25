import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/services/supabase/server';
import { TopBar } from '@/components/shell/TopBar';
import { ConsumoPanel } from '@/components/meters/ConsumoPanel';
import type { EntryWithPeriod } from '@/lib/meters';
import type {
  MembershipRow,
  SupplierRow,
  ReportingPeriodRow,
  ActivityEntryRow,
  Json,
  EmissionSourceType,
} from '@/types/database';

export const metadata: Metadata = { title: 'Consumo' };

function extractSecondary(activityKind: Json): string {
  if (typeof activityKind !== 'object' || activityKind === null || Array.isArray(activityKind))
    return '';
  const k = activityKind as Record<string, unknown>;
  return String(k['fuel'] ?? k['gridRegion'] ?? k['refrigerant'] ?? k['subtype'] ?? '');
}

export default async function ConsumoPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: rawMemberships } = await supabase
    .from('memberships')
    .select('organization_id, supplier_id, role')
    .eq('user_id', user.id);
  const memberships = (rawMemberships ?? []) as Pick<
    MembershipRow,
    'organization_id' | 'supplier_id' | 'role'
  >[];

  const supplierRoleIds = memberships
    .map((m) => m.supplier_id)
    .filter((id): id is string => id !== null);

  const adminOrgIds = memberships
    .filter((m) => m.role === 'admin' || m.role === 'consultant')
    .map((m) => m.organization_id);

  const adminSupplierIds: string[] = [];
  if (adminOrgIds.length) {
    const { data } = await supabase
      .from('suppliers')
      .select('id')
      .in('organization_id', adminOrgIds)
      .is('archived_at', null);
    if (data) adminSupplierIds.push(...(data as Pick<SupplierRow, 'id'>[]).map((s) => s.id));
  }

  const supplierIds = [...new Set([...supplierRoleIds, ...adminSupplierIds])];

  const suppliersData: Pick<SupplierRow, 'id' | 'name'>[] = [];
  if (supplierIds.length) {
    const { data } = await supabase
      .from('suppliers')
      .select('id, name')
      .in('id', supplierIds)
      .is('archived_at', null);
    if (data) suppliersData.push(...data);
  }
  const supplierMap = new Map(suppliersData.map((s) => [s.id, s.name]));

  // Todos los periodos (todos los estados) — vista histórica
  const periodsData: Pick<ReportingPeriodRow, 'id' | 'start_date' | 'supplier_id'>[] = [];
  if (supplierIds.length) {
    const { data } = await supabase
      .from('reporting_periods')
      .select('id, start_date, supplier_id')
      .in('supplier_id', supplierIds);
    if (data) periodsData.push(...data);
  }
  const periodMap = new Map(periodsData.map((p) => [p.id, p]));
  const periodIds = periodsData.map((p) => p.id);

  type EntryFetch = Pick<
    ActivityEntryRow,
    'source_type' | 'raw_quantity' | 'raw_unit' | 'activity_kind' | 'reporting_period_id'
  >;
  const entriesData: EntryFetch[] = [];
  if (periodIds.length) {
    const { data } = await supabase
      .from('activity_entries')
      .select('source_type, raw_quantity, raw_unit, activity_kind, reporting_period_id')
      .in('reporting_period_id', periodIds)
      .is('voided_at', null)
      .limit(5000);
    if (data) entriesData.push(...(data as EntryFetch[]));
  }

  const entries: EntryWithPeriod[] = entriesData.flatMap((e) => {
    const period = periodMap.get(e.reporting_period_id);
    if (!period) return [];
    return [
      {
        source_type: e.source_type as EmissionSourceType,
        secondary: extractSecondary(e.activity_kind),
        raw_quantity: e.raw_quantity,
        raw_unit: e.raw_unit,
        period_start: period.start_date,
        supplier_name: supplierMap.get(period.supplier_id) ?? 'Proveedor desconocido',
        supplier_id: period.supplier_id,
      },
    ];
  });

  const { data: rawConversions } = await supabase
    .from('unit_conversions')
    .select('from_unit, to_unit, factor')
    .in('to_unit', ['kWh', 'm3', 'kg']);

  const convRows = (rawConversions ?? []) as { from_unit: string; to_unit: string; factor: number }[];
  const toKwh: Record<string, number> = Object.fromEntries(
    convRows.filter((r) => r.to_unit === 'kWh').map((r) => [r.from_unit, r.factor]),
  );
  const toM3: Record<string, number> = Object.fromEntries(
    convRows.filter((r) => r.to_unit === 'm3').map((r) => [r.from_unit, r.factor]),
  );
  const toKg: Record<string, number> = Object.fromEntries(
    convRows.filter((r) => r.to_unit === 'kg').map((r) => [r.from_unit, r.factor]),
  );

  return (
    <>
      <TopBar title="Consumo energético" email={user?.email} section="Medidores virtuales" />
      <main
        style={{
          padding: 'var(--space-8)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-8)',
        }}
      >
        <div className="animate-fade-up stagger-1">
          <ConsumoPanel
            entries={entries}
            suppliers={suppliersData}
            toKwh={toKwh}
            toM3={toM3}
            toKg={toKg}
          />
        </div>
      </main>
    </>
  );
}
