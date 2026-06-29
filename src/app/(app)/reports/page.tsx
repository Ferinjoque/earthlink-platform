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
  OrganizationRow,
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

  const orgIds = [
    ...new Set(memberships.map((m) => m.organization_id).filter((id): id is string => id !== null)),
  ];

  // Cargar nombre de org para encabezado del reporte
  let orgName = 'EarthLink';
  if (orgIds.length) {
    const { data: orgsData } = await supabase
      .from('organizations')
      .select('name')
      .in('id', orgIds)
      .limit(1);
    const orgs = (orgsData ?? []) as Pick<OrganizationRow, 'name'>[];
    if (orgs[0]) orgName = orgs[0].name;
  }

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

  // Cargar periodos exportables (en revisión o bloqueados) con start_date para agrupar por año
  type FilaPeriodo = Pick<
    ReportingPeriodRow,
    'id' | 'label' | 'supplier_id' | 'status' | 'start_date'
  >;
  const periodsData: FilaPeriodo[] = [];
  if (allSupplierIds.length) {
    const { data } = await supabase
      .from('reporting_periods')
      .select('id, label, supplier_id, status, start_date')
      .in('supplier_id', allSupplierIds)
      .in('status', ['under_review', 'locked'])
      .order('start_date', { ascending: true });
    if (data) periodsData.push(...(data as FilaPeriodo[]));
  }

  // Cargar resúmenes de resultados de emisión con desglose por alcance
  const periodIds = periodsData.map((p) => p.id);

  // Construir set de IDs de entradas anuladas para excluirlas del resumen
  const voidedEntryIds = new Set<string>();
  if (periodIds.length) {
    const { data } = await supabase
      .from('activity_entries')
      .select('id')
      .in('reporting_period_id', periodIds)
      .not('voided_at', 'is', null);
    for (const e of (data ?? []) as Array<{ id: string }>) {
      voidedEntryIds.add(e.id);
    }
  }

  const mapaResumen = new Map<
    string,
    { totalCo2eKg: number; scope1Kg: number; scope2Kg: number; nResultados: number }
  >();
  if (periodIds.length) {
    const { data } = await supabase
      .from('emission_results')
      .select('reporting_period_id, activity_entry_id, co2e_kg, scope')
      .in('reporting_period_id', periodIds);
    if (data) {
      for (const r of data as Array<{
        reporting_period_id: string;
        activity_entry_id: string | null;
        co2e_kg: number;
        scope: number;
      }>) {
        if (r.activity_entry_id && voidedEntryIds.has(r.activity_entry_id)) continue;
        const prev = mapaResumen.get(r.reporting_period_id) ?? {
          totalCo2eKg: 0,
          scope1Kg: 0,
          scope2Kg: 0,
          nResultados: 0,
        };
        mapaResumen.set(r.reporting_period_id, {
          totalCo2eKg: prev.totalCo2eKg + r.co2e_kg,
          scope1Kg: prev.scope1Kg + (r.scope === 1 ? r.co2e_kg : 0),
          scope2Kg: prev.scope2Kg + (r.scope === 2 ? r.co2e_kg : 0),
          nResultados: prev.nResultados + 1,
        });
      }
    }
  }

  const periodos: PeriodoExportable[] = periodsData.map((p) => {
    const resumen = mapaResumen.get(p.id);
    const year = new Date(p.start_date).getUTCFullYear();
    return {
      id: p.id,
      label: p.label,
      supplier_name: supplierMap.get(p.supplier_id) ?? '-',
      status: p.status as 'under_review' | 'locked',
      totalCo2eKg: resumen?.totalCo2eKg ?? 0,
      scope1Kg: resumen?.scope1Kg ?? 0,
      scope2Kg: resumen?.scope2Kg ?? 0,
      nResultados: resumen?.nResultados ?? 0,
      year,
    };
  });

  // Cargar historial de exportaciones de las orgs del usuario
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
      <style>{`
        @media print {
          aside, header { display: none !important; }
          [data-no-print] { display: none !important; }
          main { padding: 12mm 0 0 !important; max-width: 100% !important; }
          @page { margin: 15mm 20mm; size: A4 portrait; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
        }
      `}</style>
      <TopBar title="Reportes" email={user?.email} section="Exportaciones y certificados" />
      <main
        style={{
          padding: 'var(--space-8)',
          maxWidth: 'var(--max-w-content)',
        }}
      >
        {/* Cabecera editorial: oculta en impresión (reemplazada por portada dentro de ReportsPanel) */}
        <div
          data-no-print
          className="animate-fade-up stagger-1"
          style={{ marginBottom: 'var(--space-8)' }}
        >
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
            Genera reportes CSV con huella de emisiones trazables. Cada archivo incluye un hash
            sha256 para verificación de integridad.
          </p>
        </div>

        <div className="animate-fade-up stagger-2">
          <ReportsPanel periodos={periodos} historial={historial} orgName={orgName} />
        </div>
      </main>
    </>
  );
}
