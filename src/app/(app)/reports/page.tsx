import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/services/supabase/server';
import { TopBar } from '@/components/shell/TopBar';
import { ReportsPanel } from '@/components/reports/ReportsPanel';
import type {
  MembershipRow,
  SupplierRow,
  ReportingPeriodRow,
  ReportExportRow,
} from '@/types/database';
import type { PeriodoExportable, ExportHistorial } from '@/components/reports/ReportsPanel';

export const metadata: Metadata = { title: 'Reportes' };

export default async function ReportesPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: rawMemberships } = await supabase
    .from('memberships')
    .select('organization_id')
    .eq('user_id', user.id);
  const memberships = (rawMemberships ?? []) as Pick<MembershipRow, 'organization_id'>[];

  const orgIds = [...new Set(memberships.map((m) => m.organization_id).filter((id): id is string => id !== null))];

  const suppliersData: Pick<SupplierRow, 'id' | 'name'>[] = [];
  if (orgIds.length) {
    const { data } = await supabase
      .from('suppliers')
      .select('id, name')
      .in('organization_id', orgIds);
    if (data) suppliersData.push(...(data as Pick<SupplierRow, 'id' | 'name'>[]));
  }
  const supplierMap = new Map(suppliersData.map((s) => [s.id, s.name]));
  const allSupplierIds = suppliersData.map((s) => s.id);

  // Fetch exportable periods (under_review or locked)
  type FilaPeriodo = Pick<ReportingPeriodRow, 'id' | 'label' | 'supplier_id' | 'status'>;
  const periodsData: FilaPeriodo[] = [];
  if (allSupplierIds.length) {
    const { data } = await supabase
      .from('reporting_periods')
      .select('id, label, supplier_id, status')
      .in('supplier_id', allSupplierIds)
      .in('status', ['under_review', 'locked'])
      .order('label', { ascending: true });
    if (data) periodsData.push(...(data as FilaPeriodo[]));
  }

  // Fetch emission result summaries for these periods
  const periodIds = periodsData.map((p) => p.id);
  const mapaResumen = new Map<string, { totalCo2eKg: number; nResultados: number }>();
  if (periodIds.length) {
    const { data } = await supabase
      .from('emission_results')
      .select('reporting_period_id, co2e_kg')
      .in('reporting_period_id', periodIds);
    if (data) {
      for (const r of data as Array<{ reporting_period_id: string; co2e_kg: number }>) {
        const prev = mapaResumen.get(r.reporting_period_id) ?? { totalCo2eKg: 0, nResultados: 0 };
        mapaResumen.set(r.reporting_period_id, {
          totalCo2eKg: prev.totalCo2eKg + r.co2e_kg,
          nResultados: prev.nResultados + 1,
        });
      }
    }
  }

  const periodos: PeriodoExportable[] = periodsData.map((p) => {
    const resumen = mapaResumen.get(p.id);
    return {
      id: p.id,
      label: p.label,
      supplier_name: supplierMap.get(p.supplier_id) ?? '—',
      status: p.status as 'under_review' | 'locked',
      totalCo2eKg: resumen?.totalCo2eKg ?? 0,
      nResultados: resumen?.nResultados ?? 0,
    };
  });

  // Fetch export history for user's orgs
  type FilaExport = Pick<
    ReportExportRow,
    'id' | 'format' | 'generated_at' | 'file_sha256' | 'reporting_period_ids'
  >;
  const historialData: FilaExport[] = [];
  if (orgIds.length) {
    const { data } = await supabase
      .from('report_exports')
      .select('id, format, generated_at, file_sha256, reporting_period_ids')
      .in('organization_id', orgIds)
      .order('generated_at', { ascending: false })
      .limit(50);
    if (data) historialData.push(...(data as FilaExport[]));
  }

  const historial: ExportHistorial[] = historialData.map((h) => ({
    id: h.id,
    format: h.format,
    generated_at: h.generated_at,
    file_sha256: h.file_sha256,
    reporting_period_ids: h.reporting_period_ids,
  }));

  return (
    <>
      <TopBar title="Reportes" email={user?.email} section="Exportaciones y certificados" />
      <main
        style={{
          padding: 'var(--space-8)',
          maxWidth: 'var(--max-w-content)',
        }}
      >
        {/* Editorial header */}
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <p className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>
            Protocolo GHG · Exportación de datos
          </p>
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'var(--text-3xl)',
              fontWeight: 400,
              fontStyle: 'italic',
              color: 'var(--color-ink-1)',
              margin: '0 0 var(--space-2)',
              letterSpacing: '-0.032em',
              lineHeight: 1.1,
            }}
          >
            Exportar emisiones verificadas
          </h2>
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-ink-2)',
              margin: 0,
              maxWidth: '52ch',
            }}
          >
            Genera reportes CSV con huella de emisiones trazables. Cada archivo incluye un
            hash sha256 para verificación de integridad.
          </p>
        </div>

        <ReportsPanel periodos={periodos} historial={historial} />
      </main>
    </>
  );
}
