import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/services/supabase/server';
import { TopBar } from '@/components/shell/TopBar';
import { Badge } from '@/components/ui/Badge';
import { AuditTable } from '@/components/audit/AuditTable';
import { LockedPeriodsTable } from '@/components/audit/LockedPeriodsTable';
import type {
  MembershipRow,
  SupplierRow,
  ReportingPeriodRow,
  EmissionResultRow,
  ActivityEntryRow,
  AnomalyFlagRow,
} from '@/types/database';
import { variantEstadoPeriodo, etiquetaEstadoPeriodo } from '@/lib/reporting-period';
import type { PeriodStatus } from '@/domain/ReportingPeriod';
import type {
  PeriodoFila,
  ResultadoDetalle,
  AnomaliaDetalle,
  ResumenEmisiones,
} from '@/components/audit/AuditTable';

export const metadata: Metadata = { title: 'Auditoría' };

interface PageProps {
  searchParams: Promise<{ year?: string }>;
}

export default async function AuditoriaPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const nowYear = new Date().getFullYear();
  const selectedYear =
    params.year && /^\d{4}$/.test(params.year)
      ? parseInt(params.year, 10)
      : nowYear;
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

  const isAdmin = memberships.some((m) => m.role === 'admin');
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
      .is('archived_at', null)
      .order('name', { ascending: true });
    if (data) suppliersData.push(...(data as Pick<SupplierRow, 'id' | 'name'>[]));
  }
  const supplierMap = new Map(suppliersData.map((s) => [s.id, s.name]));

  // Resolver IDs de proveedor directos (rol supplier) que no cubra la consulta por org
  const unresolvedMemberIds = memberSupplierIds.filter((id) => !supplierMap.has(id));
  if (unresolvedMemberIds.length) {
    const { data } = await supabase
      .from('suppliers')
      .select('id, name')
      .in('id', unresolvedMemberIds)
      .is('archived_at', null);
    if (data) {
      for (const s of data as Pick<SupplierRow, 'id' | 'name'>[]) {
        supplierMap.set(s.id, s.name);
        suppliersData.push(s);
      }
    }
  }

  const allSupplierIds = suppliersData.map((s) => s.id);

  type FilaPeriodo = Pick<
    ReportingPeriodRow,
    'id' | 'label' | 'supplier_id' | 'status' | 'start_date' | 'end_date'
  >;
  const periodsData: FilaPeriodo[] = [];
  if (allSupplierIds.length) {
    const startOfYear = `${selectedYear}-01-01`;
    const endOfYear = `${selectedYear}-12-31`;
    const { data } = await supabase
      .from('reporting_periods')
      .select('id, label, supplier_id, status, start_date, end_date')
      .in('supplier_id', allSupplierIds)
      .gte('start_date', startOfYear)
      .lte('start_date', endOfYear)
      .order('start_date', { ascending: false });
    if (data) periodsData.push(...(data as FilaPeriodo[]));
  }

  const allPeriodIds = periodsData.map((p) => p.id);
  const nonOpenPeriodIds = periodsData.filter((p) => p.status !== 'open').map((p) => p.id);

  // Fetch paralelo: emission_results y activity_entries (ambos dependen solo de los period IDs)
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
  type FilaEntradaMin = Pick<ActivityEntryRow, 'id' | 'reporting_period_id' | 'source_type' | 'raw_quantity' | 'raw_unit' | 'voided_at'>;

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
          .select('id, reporting_period_id, source_type, raw_quantity, raw_unit, voided_at')
          .in('reporting_period_id', allPeriodIds)
      : Promise.resolve({ data: [] as FilaEntradaMin[] }),
  ]);

  const resultsData = (resultsRaw.data ?? []) as FilaResultado[];
  const allEntriesData = (allEntriesRaw.data ?? []) as FilaEntradaMin[];

  // Excluir emission_results de entradas anuladas en los resúmenes
  const voidedEntryIds = new Set(
    allEntriesData.filter((e) => e.voided_at !== null).map((e) => e.id),
  );
  const activeEntriesData = allEntriesData.filter((e) => e.voided_at === null);

  const entryPeriodMap = new Map(activeEntriesData.map((e) => [e.id, e]));
  const allEntryIds = activeEntriesData.map((e) => e.id);

  // Tipos de fuente únicos por periodo (solo entradas activas, sin anuladas)
  const mapaSourceTypes = new Map<string, Set<string>>();
  for (const e of activeEntriesData) {
    const set = mapaSourceTypes.get(e.reporting_period_id) ?? new Set<string>();
    set.add(e.source_type);
    mapaSourceTypes.set(e.reporting_period_id, set);
  }

  // Fetch paralelo: entradas para detalle y anomaly_flags
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
          .is('voided_at', null)
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

  // Construir mapas por periodo para renderizado
  const mapaResumen = new Map<string, ResumenEmisiones>();
  const mapaResultados = new Map<string, ResultadoDetalle[]>();
  for (const r of resultsData) {
    if (voidedEntryIds.has(r.activity_entry_id)) continue;
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
        activity_entry_id: r.activity_entry_id,
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
      raw_quantity: entradaInfo.raw_quantity,
      raw_unit: entradaInfo.raw_unit,
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
    sourceTypes: [...(mapaSourceTypes.get(p.id) ?? [])],
  }));

  const bloqueadosConResumen = periodos.filter(
    (p) => p.status === 'locked' && p.resumen !== undefined,
  );

  const lockedRows = bloqueadosConResumen.map((p) => ({
    id: p.id,
    supplier_name: p.supplier_name,
    label: p.label,
    start_date: p.start_date,
    totalCo2eKg: p.resumen!.totalCo2eKg,
    scope1Co2eKg: p.resumen!.scope1Co2eKg,
    scope2Co2eKg: p.resumen!.scope2Co2eKg,
    nResultados: p.resumen!.nResultados,
  }));

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
        {/* Cabecera con filtro de año + chips de estado */}
        <section
          className="animate-fade-up stagger-1"
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
            {selectedYear}:
          </span>
          {(
            [
              ['open', 'Abierto'],
              ['under_review', 'En revisión'],
              ['locked', 'Bloqueado'],
            ] as [PeriodStatus, string][]
          ).map(([s]) => (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Badge variant={variantEstadoPeriodo(s)}>{etiquetaEstadoPeriodo(s)}</Badge>
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
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-2)' }}>
            {[nowYear - 1, nowYear, nowYear + 1].filter((y) => y >= 2024).map((y) => (
              <Link
                key={y}
                href={`/audit?year=${y}`}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-xs)',
                  padding: '3px var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: y === selectedYear ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                  background: y === selectedYear ? 'var(--color-accent-soft)' : 'transparent',
                  color: y === selectedYear ? 'var(--color-accent)' : 'var(--color-ink-3)',
                  textDecoration: 'none',
                }}
              >
                {y}
              </Link>
            ))}
          </div>
        </section>

        {/* Tabla de periodos con filtro y paneles expandibles */}
        <section className="animate-fade-up stagger-2">
          <AuditTable periodos={periodos} isAdmin={isAdmin} />
        </section>

        {/* Resumen compacto de periodos bloqueados */}
        {lockedRows.length > 0 && (
          <section className="animate-fade-up stagger-3">
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
                Registros CO₂e inmutables para {selectedYear} — estas cifras ya no pueden modificarse.
              </p>
            </div>
            <LockedPeriodsTable rows={lockedRows} />
          </section>
        )}
      </main>
    </>
  );
}
