import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { createServerClient } from '@/services/supabase/server';
import { TopBar } from '@/components/shell/TopBar';
import { AnomalyBadge } from '@/components/activity/AnomalyBadge';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { YearSelector } from '@/components/ui/YearSelector';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import { traducirMensajeAnomalia } from '@/lib/anomaly';
import type { MembershipRow, AnomalySeverity } from '@/types/database';

export const metadata: Metadata = { title: 'Panel' };

export function formatearCo2e(kg: number): { valor: string; unidad: string } {
  if (kg === 0) return { valor: '0', unidad: 'kg' };
  if (kg >= 1_000_000) return { valor: (kg / 1_000_000).toFixed(2), unidad: 'ktCO₂e' };
  if (kg >= 1_000) return { valor: (kg / 1_000).toFixed(3), unidad: 'tCO₂e' };
  return { valor: kg.toFixed(1), unidad: 'kg CO₂e' };
}

const FUENTE_LABELS: Record<string, string> = {
  stationary_combustion: 'Combustión estacionaria',
  mobile_combustion: 'Combustión móvil',
  purchased_electricity: 'Electricidad comprada',
  purchased_steam: 'Vapor comprado',
  fugitive: 'Emisiones fugitivas',
  electricity: 'Electricidad',
  steam: 'Vapor',
  water_use: 'Consumo de agua',
  waste: 'Residuos',
};

const ESTADO_COLOR: Record<string, string> = {
  locked: 'var(--color-accent)',
  under_review: 'var(--color-signal-md)',
  open: 'var(--color-ink-3)',
};

const ESTADO_BG: Record<string, string> = {
  locked: 'var(--color-accent-soft)',
  under_review: 'oklch(70% 0.14 85 / 16%)',
  open: 'var(--color-surface-2)',
};

const ESTADO_LABEL: Record<string, string> = {
  locked: 'Cerrado',
  under_review: 'En revisión',
  open: 'Abierto',
};

const MESES_ES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

interface PageProps {
  searchParams: Promise<{ year?: string }>;
}

export default async function PanelPage({ searchParams }: PageProps) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const params = await searchParams;

  const { data: rawMemberships } = await supabase
    .from('memberships')
    .select('organization_id, supplier_id, role')
    .eq('user_id', user.id);
  const memberships = (rawMemberships ?? []) as Pick<
    MembershipRow,
    'organization_id' | 'supplier_id' | 'role'
  >[];

  const orgIds = [
    ...new Set(
      memberships.map((m) => m.organization_id).filter((id): id is string => id !== null),
    ),
  ];
  const memberSupplierIds = [
    ...new Set(
      memberships.map((m) => m.supplier_id).filter((id): id is string => id !== null),
    ),
  ];

  const allSupplierIds: string[] = [...memberSupplierIds];
  const supplierNameMap = new Map<string, string>();

  if (orgIds.length) {
    const { data } = await supabase
      .from('suppliers')
      .select('id, name')
      .in('organization_id', orgIds);
    if (data) {
      for (const s of data as Array<{ id: string; name: string }>) {
        supplierNameMap.set(s.id, s.name);
        if (!allSupplierIds.includes(s.id)) allSupplierIds.push(s.id);
      }
    }
  }

  type PeriodRow = {
    id: string;
    status: string;
    supplier_id: string;
    start_date: string;
    label: string;
  };
  const allPeriodsData: PeriodRow[] = [];
  if (allSupplierIds.length) {
    const { data } = await supabase
      .from('reporting_periods')
      .select('id, status, supplier_id, start_date, label')
      .in('supplier_id', allSupplierIds)
      .order('start_date', { ascending: true });
    if (data) allPeriodsData.push(...(data as PeriodRow[]));
  }

  // Derivar años disponibles de los periodos
  const yearSet = new Set<number>();
  for (const p of allPeriodsData) {
    yearSet.add(new Date(p.start_date).getUTCFullYear());
  }
  const nowYear = new Date().getUTCFullYear();
  yearSet.add(nowYear);
  const availableYears = [...yearSet].sort((a, b) => b - a);

  const selectedYear =
    params.year && /^\d{4}$/.test(params.year)
      ? parseInt(params.year, 10)
      : (availableYears[0] ?? nowYear);

  // Filtrar periodos al año seleccionado
  const periodsData = allPeriodsData.filter(
    (p) => new Date(p.start_date).getUTCFullYear() === selectedYear,
  );

  const periodIds = periodsData.map((p) => p.id);
  const periodSupplierMap = new Map<string, string>();
  const periodStatusMap = new Map<string, string>();
  const periodStartMap = new Map<string, string>();
  for (const p of periodsData) {
    periodSupplierMap.set(p.id, p.supplier_id);
    periodStatusMap.set(p.id, p.status);
    periodStartMap.set(p.id, p.start_date);
  }

  type EmissionRow = {
    co2e_kg: number;
    scope: number;
    reporting_period_id: string;
    activity_entry_id: string | null;
  };
  type ActivityEntryRaw = {
    id: string;
    source_type: string;
    reporting_period_id: string;
  };

  const [emissionsResult, activityEntriesResult] = periodIds.length
    ? await Promise.all([
        supabase
          .from('emission_results')
          .select('co2e_kg, scope, reporting_period_id, activity_entry_id')
          .in('reporting_period_id', periodIds),
        supabase
          .from('activity_entries')
          .select('id, source_type, reporting_period_id')
          .in('reporting_period_id', periodIds),
      ])
    : [{ data: null }, { data: null }];

  const emissionRows = (emissionsResult.data as EmissionRow[] | null) ?? [];
  const activityEntries = (activityEntriesResult.data as ActivityEntryRaw[] | null) ?? [];

  const entrySourceMap = new Map<string, string>();
  for (const e of activityEntries) {
    entrySourceMap.set(e.id, e.source_type);
  }

  let totalCo2eKg = 0;
  let scope1Co2eKg = 0;
  let scope2Co2eKg = 0;
  let verifiedCo2eKg = 0;

  const supplierCo2eMap = new Map<string, { s1: number; s2: number }>();
  const sourceTypeCo2eMap = new Map<string, number>();

  for (const r of emissionRows) {
    totalCo2eKg += r.co2e_kg;
    if (r.scope === 1) scope1Co2eKg += r.co2e_kg;
    else scope2Co2eKg += r.co2e_kg;

    if (periodStatusMap.get(r.reporting_period_id) === 'locked') {
      verifiedCo2eKg += r.co2e_kg;
    }

    const supplierId = periodSupplierMap.get(r.reporting_period_id);
    if (supplierId) {
      const cur = supplierCo2eMap.get(supplierId) ?? { s1: 0, s2: 0 };
      if (r.scope === 1) cur.s1 += r.co2e_kg;
      else cur.s2 += r.co2e_kg;
      supplierCo2eMap.set(supplierId, cur);
    }

    if (r.activity_entry_id) {
      const st = entrySourceMap.get(r.activity_entry_id);
      if (st) {
        sourceTypeCo2eMap.set(st, (sourceTypeCo2eMap.get(st) ?? 0) + r.co2e_kg);
      }
    }
  }

  const suppliersWithEntries = new Set<string>();
  for (const e of activityEntries) {
    const supplierId = periodSupplierMap.get(e.reporting_period_id);
    if (supplierId) suppliersWithEntries.add(supplierId);
  }

  const periodosAbiertos = periodsData.filter((p) => p.status === 'open').length;
  const periodosEnRevision = periodsData.filter((p) => p.status === 'under_review').length;

  const currentMonthKey = `${nowYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const trendMap = new Map<string, number>();
  for (let m = 1; m <= 12; m++) {
    trendMap.set(`${selectedYear}-${String(m).padStart(2, '0')}`, 0);
  }
  for (const r of emissionRows) {
    const startDate = periodStartMap.get(r.reporting_period_id);
    if (!startDate) continue;
    const monthKey = startDate.slice(0, 7);
    const existing = trendMap.get(monthKey);
    if (existing !== undefined) {
      trendMap.set(monthKey, existing + r.co2e_kg);
    }
  }
  const trendData = [...trendMap.entries()].map(([key, kg]) => {
    const parts = key.split('-');
    const mm = parts[1];
    const monthIdx = parseInt(mm ?? '1', 10) - 1;
    return { label: MESES_ES[monthIdx] ?? '?', kg, key };
  });
  const maxTrendKg = Math.max(...trendData.map((m) => m.kg), 1);
  const hayTrend = trendData.some((m) => m.kg > 0);

  const leaderboard = [...supplierCo2eMap.entries()]
    .map(([id, { s1, s2 }]) => ({
      id,
      name: supplierNameMap.get(id) ?? '(Sin nombre)',
      s1,
      s2,
      total: s1 + s2,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
  const maxLeaderboardKg = Math.max(...leaderboard.map((l) => l.total), 1);

  const sourceMix = [...sourceTypeCo2eMap.entries()]
    .map(([sourceType, kg]) => ({
      sourceType,
      label: FUENTE_LABELS[sourceType] ?? sourceType,
      kg,
    }))
    .sort((a, b) => b.kg - a.kg)
    .slice(0, 6);
  const maxSourceKg = Math.max(...sourceMix.map((s) => s.kg), 1);

  const labelStartMap = new Map<string, string>();
  for (const p of periodsData) {
    const existing = labelStartMap.get(p.label);
    if (!existing || p.start_date < existing) {
      labelStartMap.set(p.label, p.start_date);
    }
  }
  const pipelineLabels = [...labelStartMap.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([label]) => label)
    .slice(-6);

  const pipelineLabelSet = new Set(pipelineLabels);
  const pipelineMatrix = new Map<string, Map<string, string>>();
  for (const p of periodsData) {
    if (!pipelineLabelSet.has(p.label)) continue;
    let row = pipelineMatrix.get(p.supplier_id);
    if (!row) {
      row = new Map();
      pipelineMatrix.set(p.supplier_id, row);
    }
    row.set(p.label, p.status);
  }
  const pipelineSupplierIds = [...pipelineMatrix.keys()];

  const allEntryIds = activityEntries.map((e) => e.id);
  type AnomalyFlagRow = {
    id: string;
    activity_entry_id: string;
    severity: AnomalySeverity;
    z_score: number | null;
    message: string;
    flagged_at: string;
  };

  const alertFlagsResult = allEntryIds.length
    ? await supabase
        .from('anomaly_flags')
        .select('id, activity_entry_id, severity, z_score, message, flagged_at')
        .in('activity_entry_id', allEntryIds)
        .eq('is_resolved', false)
        .order('severity', { ascending: false })
        .order('z_score', { ascending: false })
        .limit(20)
    : { data: null };

  const entryPeriodMap = new Map<string, string>();
  for (const e of activityEntries) {
    entryPeriodMap.set(e.id, e.reporting_period_id);
  }

  type AnomalyAlert = AnomalyFlagRow & { supplierName: string | undefined };
  const anomalyAlerts: AnomalyAlert[] = [];
  for (const f of (alertFlagsResult.data ?? []) as AnomalyFlagRow[]) {
    const periodId = entryPeriodMap.get(f.activity_entry_id);
    const supplierId = periodId ? periodSupplierMap.get(periodId) : undefined;
    anomalyAlerts.push({
      ...f,
      supplierName: supplierId ? supplierNameMap.get(supplierId) : undefined,
    });
  }
  const totalAnomalias = anomalyAlerts.length;
  const top3Anomalias = anomalyAlerts.slice(0, 3);

  const coberturaPercent =
    allSupplierIds.length > 0
      ? Math.round((suppliersWithEntries.size / allSupplierIds.length) * 100)
      : 0;
  const tieneDatos = totalCo2eKg > 0;
  const verified = formatearCo2e(verifiedCo2eKg);

  return (
    <>
      <TopBar title="Panel" email={user?.email} section="Portafolio ESG" />
      <style>{`
        .leader-row { transition: background 120ms; }
        .leader-row:hover { background: var(--color-surface-2) !important; }
        .pipeline-cell { transition: opacity 120ms; cursor: default; }
        .pipeline-cell:hover { opacity: 0.75; }
        .anomaly-item { transition: box-shadow 160ms var(--ease-out-expo), transform 160ms var(--ease-out-expo); }
        .anomaly-item:hover { box-shadow: var(--shadow-sm); transform: translateY(-1px); }
      `}</style>

      <div style={{ position: 'relative' }}>
        <AmbientBackground />
        <main
          style={{
            padding: 'var(--space-8)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-8)',
            maxWidth: 'var(--max-w-content)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* ── Editorial header ── */}
          <section className="animate-fade-up stagger-1">
            <p className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>
              Protocolo GHG · Alcances 1 y 2
            </p>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 'var(--space-4)',
                flexWrap: 'wrap',
                marginBottom: 'var(--space-2)',
              }}
            >
              <h2
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 'var(--text-3xl)',
                  fontWeight: 400,
                  fontStyle: 'italic',
                  color: 'var(--color-ink-1)',
                  margin: 0,
                  letterSpacing: '-0.032em',
                  lineHeight: 1.1,
                }}
              >
                Portafolio de emisiones de la cadena de suministro
              </h2>
              <Suspense>
                <YearSelector availableYears={availableYears} selectedYear={selectedYear} />
              </Suspense>
            </div>
            <p
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--color-ink-2)',
                margin: 0,
                maxWidth: '56ch',
              }}
            >
              {tieneDatos
                ? `Vista consolidada del portafolio de proveedores para ${selectedYear}: emisiones verificadas, cobertura y estado de auditoría.`
                : `Los datos aparecerán cuando los proveedores envíen sus registros de actividad para ${selectedYear}.`}
            </p>
          </section>

          {/* ── Scorecard strip: 4 KPIs ── */}
          <section
            className="animate-fade-up stagger-2"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 'var(--space-4)',
            }}
          >
            {/* CO₂e verificado */}
            <div
              style={{
                background: 'var(--color-surface-1)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-5)',
              }}
            >
              <p
                className="eyebrow"
                style={{ color: 'var(--color-accent)', marginBottom: 'var(--space-3)' }}
              >
                CO₂e verificado
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 'var(--space-2)',
                  marginBottom: 'var(--space-1)',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-2xl)',
                    fontWeight: 700,
                    color: 'var(--color-ink-1)',
                    lineHeight: 1,
                  }}
                >
                  {verifiedCo2eKg > 0 ? verified.valor : '—'}
                </span>
                {verifiedCo2eKg > 0 && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-3)' }}>
                    {verified.unidad}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-3)', margin: 0 }}>
                Periodos bloqueados · auditados
              </p>
            </div>

            {/* Cobertura */}
            <div
              style={{
                background: 'var(--color-surface-1)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-5)',
              }}
            >
              <p className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>
                Cobertura
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 'var(--space-2)',
                  marginBottom: 'var(--space-1)',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-2xl)',
                    fontWeight: 700,
                    color: 'var(--color-ink-1)',
                    lineHeight: 1,
                  }}
                >
                  {coberturaPercent}
                </span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-3)' }}>%</span>
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-3)', margin: 0 }}>
                {suppliersWithEntries.size} de {allSupplierIds.length} proveedores con datos
              </p>
            </div>

            {/* Anomalías activas */}
            <div
              style={{
                background:
                  totalAnomalias > 0 ? 'var(--color-signal-hi-bg)' : 'var(--color-surface-1)',
                border: `1px solid ${totalAnomalias > 0 ? 'oklch(50% 0.16 20 / 20%)' : 'var(--color-border)'}`,
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-5)',
              }}
            >
              <p
                className="eyebrow"
                style={{
                  color:
                    totalAnomalias > 0 ? 'var(--color-signal-hi)' : 'var(--color-ink-3)',
                  marginBottom: 'var(--space-3)',
                }}
              >
                Anomalías activas
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 'var(--space-2)',
                  marginBottom: 'var(--space-1)',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-2xl)',
                    fontWeight: 700,
                    color:
                      totalAnomalias > 0 ? 'var(--color-signal-hi)' : 'var(--color-ink-1)',
                    lineHeight: 1,
                  }}
                >
                  {totalAnomalias}
                </span>
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-3)', margin: 0 }}>
                {totalAnomalias === 0 ? 'Sin alertas pendientes' : 'requieren revisión'}
              </p>
            </div>

            {/* En revisión */}
            <div
              style={{
                background:
                  periodosEnRevision > 0
                    ? 'oklch(70% 0.14 85 / 8%)'
                    : 'var(--color-surface-1)',
                border: `1px solid ${periodosEnRevision > 0 ? 'oklch(70% 0.14 85 / 24%)' : 'var(--color-border)'}`,
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-5)',
              }}
            >
              <p
                className="eyebrow"
                style={{
                  color:
                    periodosEnRevision > 0
                      ? 'var(--color-signal-md)'
                      : 'var(--color-ink-3)',
                  marginBottom: 'var(--space-3)',
                }}
              >
                En revisión
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 'var(--space-2)',
                  marginBottom: 'var(--space-1)',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-2xl)',
                    fontWeight: 700,
                    color: 'var(--color-ink-1)',
                    lineHeight: 1,
                  }}
                >
                  {periodosEnRevision}
                </span>
                {periodosAbiertos > 0 && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-3)' }}>
                    +{periodosAbiertos} abiertos
                  </span>
                )}
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-3)', margin: 0 }}>
                Periodos pendientes de auditoría
              </p>
            </div>
          </section>

          {/* ── Leaderboard + Source mix (2 columns) ── */}
          {tieneDatos && (
            <section
              className="animate-fade-up stagger-3"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 300px',
                gap: 'var(--space-6)',
                alignItems: 'start',
              }}
            >
              {/* Leaderboard */}
              <div
                style={{
                  background: 'var(--color-surface-1)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                }}
              >
                <div style={{ padding: 'var(--space-5) var(--space-6) var(--space-4)' }}>
                  <p className="eyebrow">Ranking por emisiones</p>
                  <p
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-ink-3)',
                      margin: 'var(--space-1) 0 0',
                    }}
                  >
                    Alcance 1 (verde) + Alcance 2 (violeta) · ordenado por total · {selectedYear}
                  </p>
                </div>
                {leaderboard.length === 0 ? (
                  <p
                    style={{
                      padding: 'var(--space-6)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--color-ink-3)',
                      margin: 0,
                    }}
                  >
                    Sin datos calculados aún.
                  </p>
                ) : (
                  <div>
                    {leaderboard.map((supplier, i) => {
                      const s1Pct = (supplier.s1 / maxLeaderboardKg) * 100;
                      const s2Pct = (supplier.s2 / maxLeaderboardKg) * 100;
                      const totalFmt = formatearCo2e(supplier.total);
                      return (
                        <Link
                          key={supplier.id}
                          href={`/suppliers/${supplier.id}`}
                          className="leader-row"
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '24px 1fr 72px',
                            alignItems: 'center',
                            gap: 'var(--space-4)',
                            padding: 'var(--space-3) var(--space-6)',
                            borderTop: '1px solid var(--color-border)',
                            textDecoration: 'none',
                            background: 'var(--color-surface-1)',
                          }}
                        >
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 'var(--text-xs)',
                              color: 'var(--color-ink-3)',
                              textAlign: 'right',
                            }}
                          >
                            {i + 1}
                          </span>
                          <div>
                            <p
                              style={{
                                fontSize: 'var(--text-sm)',
                                fontWeight: 'var(--fw-medium)',
                                color: 'var(--color-ink-1)',
                                margin: '0 0 var(--space-2)',
                              }}
                            >
                              {supplier.name}
                            </p>
                            <div
                              style={{
                                height: '5px',
                                borderRadius: '9999px',
                                background: 'var(--color-surface-2)',
                                display: 'flex',
                                overflow: 'hidden',
                              }}
                            >
                              {supplier.s1 > 0 && (
                                <div
                                  className="bar-animate"
                                  style={{
                                    width: `${s1Pct}%`,
                                    background: 'var(--color-accent)',
                                    flexShrink: 0,
                                  }}
                                />
                              )}
                              {supplier.s2 > 0 && (
                                <div
                                  className="bar-animate"
                                  style={{
                                    width: `${s2Pct}%`,
                                    background: 'var(--color-scope2)',
                                    flexShrink: 0,
                                  }}
                                />
                              )}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: 'var(--text-sm)',
                                fontWeight: 600,
                                color: 'var(--color-ink-1)',
                              }}
                            >
                              {totalFmt.valor}
                            </span>
                            <span
                              style={{
                                fontSize: 'var(--text-xs)',
                                color: 'var(--color-ink-3)',
                                display: 'block',
                              }}
                            >
                              {totalFmt.unidad}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
                <div
                  style={{
                    padding: 'var(--space-3) var(--space-6)',
                    borderTop: '1px solid var(--color-border)',
                    display: 'flex',
                    gap: 'var(--space-5)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span
                      style={{
                        width: '10px',
                        height: '4px',
                        borderRadius: '9999px',
                        background: 'var(--color-accent)',
                        display: 'inline-block',
                      }}
                    />
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-3)' }}>
                      Alcance 1
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span
                      style={{
                        width: '10px',
                        height: '4px',
                        borderRadius: '9999px',
                        background: 'var(--color-scope2)',
                        display: 'inline-block',
                      }}
                    />
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-3)' }}>
                      Alcance 2
                    </span>
                  </div>
                </div>
              </div>

              {/* Source mix */}
              <div
                style={{
                  background: 'var(--color-surface-1)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-5)',
                }}
              >
                <p className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>
                  Mezcla de fuentes
                </p>
                <p
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-ink-3)',
                    margin: '0 0 var(--space-5)',
                  }}
                >
                  CO₂e por tipo de fuente · {selectedYear}
                </p>
                {sourceMix.length === 0 ? (
                  <p
                    style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-3)', margin: 0 }}
                  >
                    Sin datos.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {sourceMix.map((s) => {
                      const pct = (s.kg / maxSourceKg) * 100;
                      const fmt = formatearCo2e(s.kg);
                      return (
                        <div key={s.sourceType}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              marginBottom: 'var(--space-1)',
                              gap: 'var(--space-2)',
                            }}
                          >
                            <span
                              style={{
                                fontSize: 'var(--text-xs)',
                                color: 'var(--color-ink-2)',
                                minWidth: 0,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {s.label}
                            </span>
                            <span
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: 'var(--text-xs)',
                                color: 'var(--color-ink-1)',
                                flexShrink: 0,
                              }}
                            >
                              {fmt.valor} {fmt.unidad}
                            </span>
                          </div>
                          <div
                            style={{
                              height: '4px',
                              background: 'var(--color-surface-2)',
                              borderRadius: '9999px',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              className="bar-animate"
                              style={{
                                height: '100%',
                                width: `${pct}%`,
                                background: 'var(--color-accent)',
                                borderRadius: '9999px',
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── Audit pipeline matrix ── */}
          {pipelineSupplierIds.length > 0 && pipelineLabels.length > 0 && (
            <section
              className="animate-fade-up stagger-4"
              style={{
                background: 'var(--color-surface-1)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: 'var(--space-5) var(--space-6) 0' }}>
                <p className="eyebrow" style={{ marginBottom: 'var(--space-1)' }}>
                  Pipeline de auditoría
                </p>
                <p
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-ink-3)',
                    margin: '0 0 var(--space-5)',
                  }}
                >
                  Estado de cada proveedor por periodo de reporte · {selectedYear}
                </p>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{ width: '100%', borderCollapse: 'collapse', minWidth: '480px' }}
                >
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <th
                        style={{
                          padding: 'var(--space-3) var(--space-6)',
                          textAlign: 'left',
                          fontSize: 'var(--text-xs)',
                          color: 'var(--color-ink-3)',
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                          background: 'var(--color-surface-1)',
                        }}
                      >
                        Proveedor
                      </th>
                      {pipelineLabels.map((label) => (
                        <th
                          key={label}
                          style={{
                            padding: 'var(--space-3) var(--space-4)',
                            textAlign: 'center',
                            fontSize: 'var(--text-xs)',
                            color: 'var(--color-ink-3)',
                            fontWeight: 500,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pipelineSupplierIds.map((supplierId, i) => {
                      const periods = pipelineMatrix.get(supplierId);
                      const name = supplierNameMap.get(supplierId) ?? '(Sin nombre)';
                      return (
                        <tr
                          key={supplierId}
                          style={{
                            borderBottom:
                              i < pipelineSupplierIds.length - 1
                                ? '1px solid var(--color-border)'
                                : 'none',
                          }}
                        >
                          <td style={{ padding: 'var(--space-3) var(--space-6)', whiteSpace: 'nowrap' }}>
                            <Link
                              href={`/suppliers/${supplierId}`}
                              style={{
                                fontSize: 'var(--text-sm)',
                                color: 'var(--color-ink-1)',
                                fontWeight: 'var(--fw-medium)',
                                textDecoration: 'none',
                              }}
                            >
                              {name}
                            </Link>
                          </td>
                          {pipelineLabels.map((label) => {
                            const status = periods?.get(label);
                            if (!status) {
                              return (
                                <td
                                  key={label}
                                  style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}
                                >
                                  <span
                                    style={{
                                      fontSize: 'var(--text-xs)',
                                      color: 'var(--color-ink-3)',
                                    }}
                                  >
                                    —
                                  </span>
                                </td>
                              );
                            }
                            const color = ESTADO_COLOR[status] ?? 'var(--color-ink-3)';
                            const bg = ESTADO_BG[status] ?? 'var(--color-surface-2)';
                            const lbl = ESTADO_LABEL[status] ?? status;
                            return (
                              <td
                                key={label}
                                style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}
                              >
                                <span
                                  className="pipeline-cell"
                                  style={{
                                    display: 'inline-block',
                                    padding: 'var(--space-1) var(--space-3)',
                                    borderRadius: 'var(--radius-md)',
                                    background: bg,
                                    color,
                                    fontSize: 'var(--text-xs)',
                                    fontWeight: 500,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {lbl}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div
                style={{
                  padding: 'var(--space-3) var(--space-6)',
                  borderTop: '1px solid var(--color-border)',
                  display: 'flex',
                  gap: 'var(--space-5)',
                  flexWrap: 'wrap',
                }}
              >
                {(
                  [
                    { status: 'locked', label: 'Cerrado' },
                    { status: 'under_review', label: 'En revisión' },
                    { status: 'open', label: 'Abierto' },
                  ] as const
                ).map(({ status, label }) => (
                  <div
                    key={status}
                    style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: ESTADO_COLOR[status] ?? 'var(--color-ink-3)',
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-3)' }}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Tendencia anual CO₂e ── */}
          <section
            className="animate-fade-up stagger-5"
            style={{
              background: 'var(--color-surface-1)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-6)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 'var(--space-5)',
              }}
            >
              <div>
                <p className="eyebrow">Tendencia anual CO₂e</p>
                <p
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-ink-3)',
                    margin: 'var(--space-1) 0 0',
                  }}
                >
                  Agrupado por inicio del periodo de reporte · {selectedYear}
                </p>
              </div>
            </div>
            {!hayTrend ? (
              <p
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-ink-3)',
                  textAlign: 'center',
                  padding: 'var(--space-8) 0',
                  margin: 0,
                }}
              >
                Sin datos calculados para {selectedYear}.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <svg
                  viewBox="0 0 780 130"
                  style={{ width: '100%', minWidth: '480px', display: 'block' }}
                  aria-label={`Tendencia de emisiones CO₂e ${selectedYear}`}
                  role="img"
                >
                  <title>Tendencia de emisiones CO₂e {selectedYear}</title>
                  {[0.25, 0.5, 0.75, 1].map((pct) => {
                    const y = 96 - pct * 72;
                    return (
                      <line
                        key={pct}
                        x1="32"
                        y1={y}
                        x2="772"
                        y2={y}
                        stroke="var(--color-border)"
                        strokeWidth="0.5"
                        strokeDasharray="3,3"
                      />
                    );
                  })}
                  <line
                    x1="32"
                    y1="96"
                    x2="772"
                    y2="96"
                    stroke="var(--color-border)"
                    strokeWidth="0.8"
                  />
                  {trendData.map((mes, i) => {
                    const step = (772 - 32) / 12;
                    const barW = step * 0.6;
                    const x = 32 + i * step + step / 2 - barW / 2;
                    const maxH = 72;
                    const barH = mes.kg > 0 ? Math.max((mes.kg / maxTrendKg) * maxH, 3) : 1;
                    const y = 96 - barH;
                    const fmt = formatearCo2e(mes.kg);
                    const isCurrent = mes.key === currentMonthKey && selectedYear === nowYear;
                    return (
                      <g key={mes.key}>
                        <rect
                          x={x}
                          y={mes.kg === 0 ? 95 : y}
                          width={barW}
                          height={mes.kg === 0 ? 1 : barH}
                          rx="2"
                          fill="var(--color-accent)"
                          opacity={mes.kg === 0 ? 0.18 : isCurrent ? 1 : 0.72}
                        />
                        {mes.kg > 0 && (
                          <text
                            x={x + barW / 2}
                            y={Math.max(y - 4, 10)}
                            textAnchor="middle"
                            fontSize="7.5"
                            fill="var(--color-ink-2)"
                            fontFamily="var(--font-mono)"
                          >
                            {fmt.valor}
                          </text>
                        )}
                        <text
                          x={x + barW / 2}
                          y={113}
                          textAnchor="middle"
                          fontSize="8"
                          fill={isCurrent ? 'var(--color-ink-1)' : 'var(--color-ink-3)'}
                          fontFamily="var(--font-mono)"
                          fontWeight={isCurrent ? 600 : 400}
                        >
                          {mes.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
          </section>

          {/* ── Anomalías pendientes ── */}
          {totalAnomalias > 0 && (
            <section
              className="animate-fade-up stagger-6"
              style={{
                background: 'var(--color-signal-hi-bg)',
                border: '1px solid oklch(50% 0.16 20 / 20%)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-6)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 'var(--space-5)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <ShieldAlert size={16} style={{ color: 'var(--color-signal-hi)' }} aria-hidden="true" />
                  <p className="eyebrow" style={{ color: 'var(--color-signal-hi)' }}>
                    {totalAnomalias} anomalía{totalAnomalias !== 1 ? 's' : ''} pendiente
                    {totalAnomalias !== 1 ? 's' : ''}
                  </p>
                </div>
                <Link
                  href="/audit"
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-signal-hi)',
                    fontWeight: 'var(--fw-medium)',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-1)',
                  }}
                >
                  Ver en auditoría <ArrowRight size={12} aria-hidden="true" />
                </Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {top3Anomalias.map((a) => (
                  <div
                    key={a.id}
                    className="anomaly-item"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-4)',
                      padding: 'var(--space-3) var(--space-4)',
                      background: 'var(--color-surface-1)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <AnomalyBadge severity={a.severity} zScore={a.z_score ?? undefined} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--color-ink-1)',
                          margin: 0,
                          fontWeight: 'var(--fw-medium)',
                        }}
                      >
                        {a.supplierName ?? 'Proveedor'}
                      </p>
                      <p
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--color-ink-3)',
                          margin: 'var(--space-1) 0 0',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {traducirMensajeAnomalia(a.message)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </>
  );
}
