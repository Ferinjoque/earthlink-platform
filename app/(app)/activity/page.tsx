import type { Metadata } from 'next';
import { createServerClient } from '@/services/supabase/server';
import { TopBar } from '@/components/shell/TopBar';
import { ActivityForm } from '@/components/activity/ActivityForm';
import { ActivityList } from '@/components/activity/ActivityList';
import { CsvImportPanel } from '@/components/activity/CsvImportPanel';
import type { ActivityEntryView } from '@/components/activity/ActivityList';
import type {
  MembershipRow,
  SupplierRow,
  ReportingPeriodRow,
  ActivityEntryRow,
  AnomalyFlagRow,
} from '@/types/database';

export const metadata: Metadata = { title: 'Activity Entries' };

export default async function ActivityPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // User's supplier IDs via memberships
  const { data: rawMemberships } = await supabase
    .from('memberships')
    .select('*')
    .eq('user_id', user?.id ?? '');
  const memberships = (rawMemberships ?? []) as MembershipRow[];

  const supplierIds = memberships
    .map((m) => m.supplier_id)
    .filter((id): id is string => id !== null);

  // Suppliers for label enrichment
  const suppliersData: Pick<SupplierRow, 'id' | 'name'>[] = [];
  if (supplierIds.length) {
    const { data } = await supabase.from('suppliers').select('id, name').in('id', supplierIds);
    if (data) suppliersData.push(...data);
  }
  const supplierMap = new Map(suppliersData.map((s) => [s.id, s.name]));

  // Open reporting periods for the user's suppliers
  const periodsData: Pick<ReportingPeriodRow, 'id' | 'label' | 'supplier_id' | 'status'>[] = [];
  if (supplierIds.length) {
    const { data } = await supabase
      .from('reporting_periods')
      .select('id, label, supplier_id, status')
      .in('supplier_id', supplierIds)
      .eq('status', 'open')
      .order('label', { ascending: true });
    if (data) periodsData.push(...data);
  }

  const periods = periodsData.map((p) => ({
    id: p.id,
    label: p.label,
    supplier_name: supplierMap.get(p.supplier_id) ?? 'Unknown Supplier',
  }));

  const periodIds = periodsData.map((p) => p.id);

  // Recent activity entries
  const entriesData: Pick<
    ActivityEntryRow,
    | 'id'
    | 'reporting_period_id'
    | 'source_type'
    | 'raw_quantity'
    | 'raw_unit'
    | 'status'
    | 'submitted_at'
    | 'notes'
  >[] = [];
  if (periodIds.length) {
    const { data } = await supabase
      .from('activity_entries')
      .select(
        'id, reporting_period_id, source_type, raw_quantity, raw_unit, status, submitted_at, notes',
      )
      .in('reporting_period_id', periodIds)
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) entriesData.push(...data);
  }

  const entryIds = entriesData.map((e) => e.id);

  // Anomaly flags for entries (unresolved only)
  const flagsData: Pick<
    AnomalyFlagRow,
    'activity_entry_id' | 'severity' | 'z_score' | 'message'
  >[] = [];
  if (entryIds.length) {
    const { data } = await supabase
      .from('anomaly_flags')
      .select('activity_entry_id, severity, z_score, message')
      .in('activity_entry_id', entryIds)
      .eq('is_resolved', false)
      .order('flagged_at', { ascending: false });
    if (data) flagsData.push(...data);
  }

  // One flag per entry (first = highest severity by flagged_at desc)
  const flagMap = new Map<
    string,
    { severity: 'low' | 'medium' | 'high'; z_score: number | null; message: string }
  >();
  for (const f of flagsData) {
    if (!flagMap.has(f.activity_entry_id)) {
      flagMap.set(f.activity_entry_id, {
        severity: f.severity as 'low' | 'medium' | 'high',
        z_score: f.z_score,
        message: f.message,
      });
    }
  }

  const periodLabelMap = new Map(periodsData.map((p) => [p.id, p.label]));

  const entries: ActivityEntryView[] = entriesData.map((e) => ({
    id: e.id,
    period_label: periodLabelMap.get(e.reporting_period_id) ?? '—',
    source_type: e.source_type,
    raw_quantity: e.raw_quantity,
    raw_unit: e.raw_unit,
    status: e.status,
    submitted_at: e.submitted_at,
    notes: e.notes,
    anomaly: flagMap.get(e.id),
  }));

  return (
    <>
      <TopBar title="Activity Entries" email={user?.email} />
      <main
        style={{
          padding: 'var(--space-8)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-8)',
        }}
      >
        {/* Submit form */}
        <section>
          <SectionHeader
            title="Submit Entry"
            subtitle="Record a single activity entry for an open reporting period."
          />
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-6)',
              maxWidth: '560px',
            }}
          >
            <ActivityForm periods={periods} />
          </div>
        </section>

        {/* CSV import */}
        <section>
          <SectionHeader
            title="Bulk Import"
            subtitle="Upload or paste a CSV to import multiple entries at once."
          />
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-6)',
              maxWidth: '800px',
            }}
          >
            <CsvImportPanel />
          </div>
        </section>

        {/* Entry list */}
        <section>
          <SectionHeader
            title="Recent Entries"
            subtitle={`${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} across open periods.`}
          />
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-4) 0',
            }}
          >
            <ActivityList entries={entries} />
          </div>
        </section>
      </main>
    </>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <h2
        style={{
          fontSize: 'var(--text-base)',
          fontWeight: 600,
          color: 'var(--color-ink-1)',
          margin: 0,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--color-ink-3)',
          margin: 'var(--space-1) 0 0',
        }}
      >
        {subtitle}
      </p>
    </div>
  );
}
