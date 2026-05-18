import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/services/supabase/server';
import { TopBar } from '@/components/shell/TopBar';
import { Badge } from '@/components/ui/Badge';
import { AuditTable } from '@/components/audit/AuditTable';
import type {
  MembershipRow,
  SupplierRow,
  ReportingPeriodRow,
  EmissionResultRow,
  ActivityEntryRow,
  AnomalyFlagRow,
} from '@/types/database';
import type { PeriodStatus } from '@/domain/ReportingPeriod';
import type {
  PeriodoFila,
  ResultadoDetalle,
  AnomaliaDetalle,
  ResumenEmisiones,
} from '@/components/audit/AuditTable';

export const metadata: Metadata = { title: 'Auditoría' };

function variantEstado(
  status: PeriodStatus,
): 'open' | 'calculating' | 'under_review' | 'locked' | 'neutral' {
  if (status === 'open') return 'open';
  if (status === 'calculating') return 'calculating';
  if (status === 'under_review') return 'under_review';
  if (status === 'locked') return 'locked';
  return 'neutral';
}

function etiquetaEstado(status: PeriodStatus): string {
  if (status === 'open') return 'Abierto';
  if (status === 'calculating') return 'Calculando…';
  if (status === 'under_review') return 'En revisión';
  if (status === 'locked') return 'Bloqueado';
  return status;
}

export default async function AuditoriaPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: rawMemberships } = await supabase
    .from('memberships')
    .select('organization_id, supplier_id')
    .eq('user_id', user.id);
  const memberships = (rawMemberships ?? []) as Pick<
    MembershipRow,
    'organization_id' | 'supplier_id'
  >[];

  const orgIds = [
    ...new Set(memberships.map((m) => m.organization_id).filter((x): x is string => x !== null)),
  ];
  const memberSupplierIds = [
    ...new Set(memberships.map((m) => m.supplier_id).filter((x): x is string => x !== null)),
  ];

  const suppliersData: Pick<SupplierRow, 'id' | 'name'>[] = [];
  if (orgIds.length) {
    const { data } = await supabase
      .from('suppliers')
      .select('id, name')
      .in('organization_id', orgIds)
      .order('name', { ascending: true });
    if (data) suppliersData.push(...(data as Pick<SupplierRow, 'id' | 'name'>[]));
  }
  const supplierMap = new Map(suppliersData.map((s) => [s.id, s.name]));

  const allSupplierIds = [...new Set([...memberSupplierIds, ...suppliersData.map((s) => s.id)])];

  type FilaPeriodo = Pick<
    ReportingPeriodRow,
    'id' | 'label' | 'supplier_id' | 'status' | 'start_date' | 'end_date'
  >;
  const periodsData: FilaPeriodo[] = [];
  if (allSupplierIds.length) {
    const { data } = await supabase
      .from('reporting_periods')
      .select('id, label, supplier_id, status, start_date, end_date')
      .in('supplier_id', allSupplierIds)
      .order('start_date', { ascending: false });
    if (data) periodsData.push(...(data as FilaPeriodo[]));
  }

  const allPeriodIds = periodsData.map((p) => p.id);
  const nonOpenPeriodIds = periodsData.filter((p) => p.status !== 'open').map((p) => p.id);

  // Parallel fetch: emission_results + all activity_entries (both depend only on period IDs)
  type FilaResultado = Pick<
    EmissionResultRow,
    | 'id'
    | 'activity_entry_id'
    | 'reporting_period_id'
    | 'scope'
    | 'co2e_kg'
    | 'factor_used'
    | 'factor_unit'
    | 'calculated_at'
  >;
  type FilaEntradaMin = Pick<ActivityEntryRow, 'id' | 'reporting_period_id' | 'source_type'>;

  const [resultsRaw, allEntriesRaw] = await Promise.all([
    nonOpenPeriodIds.length
      ? supabase
          .from('emission_results')
          .select(
            'id, activity_entry_id, reporting_period_id, scope, co2e_kg, factor_used, factor_unit, calculated_at',
          )
          .in('reporting_period_id', nonOpenPeriodIds)
      : Promise.resolve({ data: [] as FilaResultado[] }),
    allPeriodIds.length
      ? supabase
          .from('activity_entries')
          .select('id, reporting_period_id, source_type')
          .in('reporting_period_id', allPeriodIds)
      : Promise.resolve({ data: [] as FilaEntradaMin[] }),
  ]);

  const resultsData = (resultsRaw.data ?? []) as FilaResultado[];
  const allEntriesData = (allEntriesRaw.data ?? []) as FilaEntradaMin[];
  const entryPeriodMap = new Map(allEntriesData.map((e) => [e.id, e]));
  const allEntryIds = allEntriesData.map((e) => e.id);

  // Parallel fetch: entries for result detail + anomaly flags (both ready to run now)
  type FilaEntrada = Pick<ActivityEntryRow, 'id' | 'source_type' | 'raw_quantity' | 'raw_unit'>;
  type FilaFlag = Pick<
    AnomalyFlagRow,
    'id' | 'activity_entry_id' | 'severity' | 'z_score' | 'message' | 'flagged_at'
  >;
  const resultEntryIds = [...new Set(resultsData.map((r) => r.activity_entry_id))];

  const [entriesForResultsRaw, flagsRaw] = await Promise.all([
    resultEntryIds.length
      ? supabase
          .from('activity_entries')
          .select('id, source_type, raw_quantity, raw_unit')
          .in('id', resultEntryIds)
      : Promise.resolve({ data: [] as FilaEntrada[] }),
    allEntryIds.length
      ? supabase
          .from('anomaly_flags')
          .select('id, activity_entry_id, severity, z_score, message, flagged_at')
          .in('activity_entry_id', allEntryIds)
          .eq('is_resolved', false)
          .order('flagged_at', { ascending: false })
      : Promise.resolve({ data: [] as FilaFlag[] }),
  ]);

  const entriesForResults = (entriesForResultsRaw.data ?? []) as FilaEntrada[];
  const flagsData = (flagsRaw.data ?? []) as FilaFlag[];
  const entryMap = new Map(entriesForResults.map((e) => [e.id, e]));

  // Build per-period maps
  const mapaResumen = new Map<string, ResumenEmisiones>();
  const mapaResultados = new Map<string, ResultadoDetalle[]>();
  for (const r of resultsData) {
    const entrada = entryMap.get(r.activity_entry_id);
    const prev = mapaResumen.get(r.reporting_period_id) ?? {
      totalCo2eKg: 0,
      scope1Co2eKg: 0,
      scope2Co2eKg: 0,
      nResultados: 0,
    };
    mapaResumen.set(r.reporting_period_id, {
      totalCo2eKg: prev.totalCo2eKg + r.co2e_kg,
      scope1Co2eKg: prev.scope1Co2eKg + (r.scope === 1 ? r.co2e_kg : 0),
      scope2Co2eKg: prev.scope2Co2eKg + (r.scope === 2 ? r.co2e_kg : 0),
      nResultados: prev.nResultados + 1,
    });

    if (entrada) {
      const detalle: ResultadoDetalle = {
        id: r.id,
        source_type: entrada.source_type,
        raw_quantity: entrada.raw_quantity,
        raw_unit: entrada.raw_unit,
        scope: r.scope,
        co2e_kg: r.co2e_kg,
        factor_used: r.factor_used,
        factor_unit: r.factor_unit,
        calculated_at: r.calculated_at,
      };
      const list = mapaResultados.get(r.reporting_period_id) ?? [];
      list.push(detalle);
      mapaResultados.set(r.reporting_period_id, list);
    }
  }

  const mapaAnomalias = new Map<string, AnomaliaDetalle[]>();
  for (const f of flagsData) {
    const entradaInfo = entryPeriodMap.get(f.activity_entry_id);
    if (!entradaInfo) continue;
    const detalle: AnomaliaDetalle = {
      id: f.id,
      activity_entry_id: f.activity_entry_id,
      source_type: entradaInfo.source_type,
      severity: f.severity as 'low' | 'medium' | 'high',
      z_score: f.z_score,
      message: f.message,
      flagged_at: f.flagged_at,
    };
    const list = mapaAnomalias.get(entradaInfo.reporting_period_id) ?? [];
    list.push(detalle);
    mapaAnomalias.set(entradaInfo.reporting_period_id, list);
  }

  const conteoPorEstado: Record<PeriodStatus, number> = {
    open: 0,
    calculating: 0,
    under_review: 0,
    locked: 0,
  };
  for (const p of periodsData) {
    const s = p.status as PeriodStatus;
    conteoPorEstado[s] = (conteoPorEstado[s] ?? 0) + 1;
  }

  const periodos: PeriodoFila[] = periodsData.map((p) => ({
    id: p.id,
    label: p.label,
    supplier_id: p.supplier_id,
    supplier_name: supplierMap.get(p.supplier_id) ?? '—',
    status: p.status as PeriodStatus,
    start_date: p.start_date,
    end_date: p.end_date,
    resumen: mapaResumen.get(p.id),
    results: mapaResultados.get(p.id) ?? [],
    anomalias: mapaAnomalias.get(p.id) ?? [],
  }));

  const bloqueadosConResumen = periodos.filter(
    (p) => p.status === 'locked' && p.resumen !== undefined,
  );

  function formatearKg(kg: number): string {
    if (kg === 0) return '—';
    if (kg >= 1_000) return `${(kg / 1_000).toFixed(3)} tCO₂e`;
    return `${kg.toFixed(2)} kg`;
  }

  return (
    <>
      <TopBar title="Consola de auditoría" email={user?.email} section="Registro inmutable" />
      <main
        style={{
          padding: 'var(--space-8)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-8)',
        }}
      >
        {/* Chips de estado */}
        <section
          style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center' }}
        >
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-ink-3)',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-wide)',
            }}
          >
            Periodos:
          </span>
          {(
            [
              ['open', 'Abierto'],
              ['calculating', 'Calculando'],
              ['under_review', 'En revisión'],
              ['locked', 'Bloqueado'],
            ] as [PeriodStatus, string][]
          ).map(([s]) => (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Badge variant={variantEstado(s)}>{etiquetaEstado(s)}</Badge>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-ink-2)',
                }}
              >
                {conteoPorEstado[s]}
              </span>
            </span>
          ))}
        </section>

        {/* Tabla de periodos con filtro y paneles expandibles */}
        <section>
          <AuditTable periodos={periodos} suppliers={suppliersData} />
        </section>

        {/* Tarjetas de periodos bloqueados */}
        {bloqueadosConResumen.length > 0 && (
          <section>
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <h2
                style={{
                  fontSize: 'var(--text-base)',
                  fontWeight: 600,
                  color: 'var(--color-ink-1)',
                  margin: 0,
                }}
              >
                Resumen de periodos bloqueados
              </h2>
              <p
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-ink-3)',
                  margin: 'var(--space-1) 0 0',
                }}
              >
                Registros CO₂e inmutables — estas cifras ya no pueden modificarse.
              </p>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 'var(--space-4)',
              }}
            >
              {bloqueadosConResumen.map((p) => {
                const r = p.resumen!;
                return (
                  <div
                    key={p.id}
                    style={{
                      background: 'var(--color-accent-soft)',
                      border: '1px solid oklch(42% 0.12 155 / 22%)',
                      borderRadius: 'var(--radius-lg)',
                      padding: 'var(--space-5)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-3)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'var(--text-xs)',
                          color: 'var(--color-ink-3)',
                        }}
                      >
                        {p.supplier_name} · {p.label}
                      </span>
                      <Badge variant="locked">Bloqueado</Badge>
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--text-2xl)',
                        fontWeight: 700,
                        color: 'var(--color-ink-1)',
                        letterSpacing: 'var(--tracking-tight)',
                      }}
                    >
                      {formatearKg(r.totalCo2eKg)}
                    </div>
                    <div
                      style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--text-xs)' }}
                    >
                      <span style={{ color: 'var(--color-ink-3)' }}>
                        Alcance 1:{' '}
                        <span
                          style={{ color: 'var(--color-ink-1)', fontFamily: 'var(--font-mono)' }}
                        >
                          {formatearKg(r.scope1Co2eKg)}
                        </span>
                      </span>
                      <span style={{ color: 'var(--color-ink-3)' }}>
                        Alcance 2:{' '}
                        <span
                          style={{ color: 'var(--color-ink-1)', fontFamily: 'var(--font-mono)' }}
                        >
                          {formatearKg(r.scope2Co2eKg)}
                        </span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
