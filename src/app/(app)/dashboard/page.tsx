import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/services/supabase/server';
import { TopBar } from '@/components/shell/TopBar';
import { Badge } from '@/components/ui/Badge';
import { AnomalyBadge } from '@/components/activity/AnomalyBadge';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { ArrowRight, ShieldAlert } from 'lucide-react';
import type { MembershipRow, ReportingPeriodRow, AnomalySeverity } from '@/types/database';

export const metadata: Metadata = { title: 'Panel' };

export function formatearCo2e(kg: number): { valor: string; unidad: string } {
  if (kg === 0) return { valor: '0', unidad: 'kg' };
  if (kg >= 1_000_000) return { valor: (kg / 1_000_000).toFixed(2), unidad: 'MtCO₂e' };
  if (kg >= 1_000) return { valor: (kg / 1_000).toFixed(3), unidad: 'tCO₂e' };
  return { valor: kg.toFixed(1), unidad: 'kg CO₂e' };
}

const FUENTE_LABELS: Record<string, string> = {
  stationary_combustion: 'Combustión estacionaria',
  mobile_combustion: 'Combustión móvil',
  purchased_electricity: 'Electricidad',
  purchased_steam: 'Vapor',
  fugitive: 'Fugitivo',
  electricity: 'Electricidad',
  steam: 'Vapor',
};

const ESTADO_LABELS: Record<string, string> = {
  draft: 'Borrador',
  submitted: 'Enviado',
  validated: 'Validado',
  rejected: 'Rechazado',
};

const MESES_ES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

function traducirMensajeAnomalia(msg: string): string {
  if (!msg) return msg;
  // Already Spanish (new AnomalyService format)
  if (msg.includes('sobre la media histórica') || msg.includes('Verificar datos')) return msg;
  // Seed format: "X consumption of Y Z in P is Nσ above the Q baseline of B Z. Verify ..."
  const m1 = msg.match(
    /^(.+?)\s+consumption of ([\d,\.]+)\s+(\S+)\s+in\s+(.+?)\s+is\s+([\d\.]+)σ\s+above the\s+(.+?)\s+baseline of\s+([\d,\.]+)\s+\S+\./i,
  );
  if (m1) {
    const [, fuel, qty, unit, period, zscore, basePeriod, baseQty] = m1;
    return `${fuel}: ${qty} ${unit} en ${period} es ${zscore}σ sobre la línea base de ${basePeriod} (${baseQty} ${unit}). Verificar facturas.`;
  }
  // Old AnomalyService English format
  const m2 = msg.match(
    /^(\S+)\s+quantity\s+([\d\.]+)\s+(\S+)\s+is\s+([\d\.]+)σ\s+above historical mean of\s+([\d\.]+)/i,
  );
  if (m2) {
    const SOURCE_LABELS: Record<string, string> = {
      stationary_combustion: 'Combustión estacionaria',
      mobile_combustion: 'Combustión móvil',
      purchased_electricity: 'Electricidad',
      purchased_steam: 'Vapor',
      fugitive: 'Emisiones fugitivas',
    };
    const [, sourceType = '', qty = '', unit = '', zscore = '', mean = ''] = m2;
    return `${SOURCE_LABELS[sourceType] ?? sourceType}: ${qty} ${unit} es ${zscore}σ sobre la media histórica (${mean} ${unit}). Verificar datos.`;
  }
  return msg;
}

export default async function PanelPage() {
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

  const orgIds = [
    ...new Set(memberships.map((m) => m.organization_id).filter((id): id is string => id !== null)),
  ];
  const memberSupplierIds = [
    ...new Set(memberships.map((m) => m.supplier_id).filter((id): id is string => id !== null)),
  ];

  const supplierNameMap = new Map<string, string>();
  const allSupplierIds: string[] = [...memberSupplierIds];
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

  type FilaPeriodo = Pick<ReportingPeriodRow, 'id' | 'status' | 'supplier_id'>;
  const periodsData: FilaPeriodo[] = [];
  if (allSupplierIds.length) {
    const { data } = await supabase
      .from('reporting_periods')
      .select('id, status, supplier_id')
      .in('supplier_id', allSupplierIds);
    if (data) periodsData.push(...(data as FilaPeriodo[]));
  }

  const periodosAbiertos = periodsData.filter((p) => p.status === 'open').length;
  const periodIds = periodsData.map((p) => p.id);

  // Period → supplier map for activity feed
  const periodSupplierMap = new Map<string, string>();
  for (const p of periodsData) {
    periodSupplierMap.set(p.id, p.supplier_id);
  }

  // ── KPI + trend data ──
  type EmissionRow = { co2e_kg: number; scope: number; calculated_at: string };
  const emissionRows: EmissionRow[] = [];
  let totalCo2eKg = 0;
  let scope1Co2eKg = 0;
  let scope2Co2eKg = 0;

  if (periodIds.length) {
    const { data } = await supabase
      .from('emission_results')
      .select('co2e_kg, scope, calculated_at')
      .in('reporting_period_id', periodIds);
    if (data) {
      for (const r of data as EmissionRow[]) {
        emissionRows.push(r);
        totalCo2eKg += r.co2e_kg;
        if (r.scope === 1) scope1Co2eKg += r.co2e_kg;
        else scope2Co2eKg += r.co2e_kg;
      }
    }
  }

  // ── Trend: group by month (last 6) ──
  const ahora = new Date();
  type MesDatum = { label: string; kg: number };
  const mesesMap = new Map<string, MesDatum>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${MESES_ES[d.getMonth()] ?? '?'} ${String(d.getFullYear()).slice(2)}`;
    mesesMap.set(key, { label, kg: 0 });
  }
  for (const r of emissionRows) {
    const d = new Date(r.calculated_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const existing = mesesMap.get(key);
    if (existing) existing.kg += r.co2e_kg;
  }
  const trendData = [...mesesMap.values()];
  const maxKg = Math.max(...trendData.map((m) => m.kg), 1);
  const hayTrend = trendData.some((m) => m.kg > 0);

  // ── Activity feed: last 8 entries ──
  type EntradaFeed = {
    id: string;
    source_type: string;
    raw_quantity: number;
    raw_unit: string;
    status: string;
    created_at: string;
    reporting_period_id: string;
    anomaly?: { severity: AnomalySeverity; z_score: number } | null;
  };
  const entradaFeed: EntradaFeed[] = [];

  if (periodIds.length) {
    const { data: rawEntries } = await supabase
      .from('activity_entries')
      .select('id, source_type, raw_quantity, raw_unit, status, created_at, reporting_period_id')
      .in('reporting_period_id', periodIds)
      .order('created_at', { ascending: false })
      .limit(8);

    if (rawEntries) {
      const entryIds = (rawEntries as { id: string }[]).map((e) => e.id);
      const { data: flags } = await supabase
        .from('anomaly_flags')
        .select('activity_entry_id, severity, z_score')
        .in('activity_entry_id', entryIds)
        .eq('is_resolved', false);

      const flagMap = new Map<string, { severity: AnomalySeverity; z_score: number }>();
      for (const f of (flags ?? []) as {
        activity_entry_id: string;
        severity: AnomalySeverity;
        z_score: number;
      }[]) {
        flagMap.set(f.activity_entry_id, { severity: f.severity, z_score: f.z_score });
      }

      for (const e of rawEntries as EntradaFeed[]) {
        entradaFeed.push({ ...e, anomaly: flagMap.get(e.id) ?? null });
      }
    }
  }

  // ── Anomaly alerts ──
  type AnomalyAlert = {
    id: string;
    activity_entry_id: string;
    severity: AnomalySeverity;
    z_score: number | null;
    message: string;
    flagged_at: string;
    supplierName: string | undefined;
  };
  const anomalyAlerts: AnomalyAlert[] = [];

  if (periodIds.length) {
    const { data: rawEntryIds } = await supabase
      .from('activity_entries')
      .select('id, reporting_period_id')
      .in('reporting_period_id', periodIds);

    if (rawEntryIds && (rawEntryIds as { id: string }[]).length > 0) {
      const allEntryIds = (rawEntryIds as { id: string; reporting_period_id: string }[]).map(
        (e) => e.id,
      );
      const entryPeriodMap = new Map<string, string>();
      for (const e of rawEntryIds as { id: string; reporting_period_id: string }[]) {
        entryPeriodMap.set(e.id, e.reporting_period_id);
      }

      const { data: rawFlags } = await supabase
        .from('anomaly_flags')
        .select('id, activity_entry_id, severity, z_score, message, flagged_at')
        .in('activity_entry_id', allEntryIds)
        .eq('is_resolved', false)
        .order('severity', { ascending: false })
        .order('z_score', { ascending: false })
        .limit(20);

      if (rawFlags) {
        for (const f of rawFlags as AnomalyAlert[]) {
          const periodId = entryPeriodMap.get(f.activity_entry_id);
          const supplierId = periodId ? periodSupplierMap.get(periodId) : undefined;
          const supplierName = supplierId ? supplierNameMap.get(supplierId) : undefined;
          anomalyAlerts.push({ ...f, supplierName });
        }
      }
    }
  }

  const totalAnomalias = anomalyAlerts.length;
  const top3Anomalias = anomalyAlerts.slice(0, 3);

  const tieneDatos = totalCo2eKg > 0;
  const total = formatearCo2e(totalCo2eKg);
  const s1 = formatearCo2e(scope1Co2eKg);
  const s2 = formatearCo2e(scope2Co2eKg);

  return (
    <>
      <TopBar title="Panel" email={user?.email} section="Visión general" />

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
        {/* ── Titular editorial ── */}
        <section>
          <p className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>
            Protocolo GHG · Alcances 1 y 2
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
            Huella de carbono de la cadena de suministro
          </h2>
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-ink-2)',
              margin: 0,
              maxWidth: '52ch',
            }}
          >
            {tieneDatos
              ? 'Acumulado en todos los periodos calculados.'
              : 'Los datos aparecerán cuando los proveedores envíen sus registros de actividad.'}
          </p>
        </section>

        {/* ── KPI strip editorial ── */}
        <section
          style={{
            background: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6) var(--space-8)',
            display: 'grid',
            gridTemplateColumns: tieneDatos ? '1fr auto auto' : '1fr',
            gap: 'var(--space-6)',
            alignItems: 'center',
          }}
        >
          <div>
            <p
              className="eyebrow"
              style={{ marginBottom: 'var(--space-2)', color: 'var(--color-accent)' }}
            >
              Total CO₂e
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)' }}>
              <span
                className="numeric-tabular"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-4xl)',
                  fontWeight: 700,
                  color: 'var(--color-ink-1)',
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                }}
              >
                {tieneDatos ? total.valor : '—'}
              </span>
              {tieneDatos && (
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)' }}>
                  {total.unidad}
                </span>
              )}
            </div>
            <p
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--color-ink-3)',
                marginTop: 'var(--space-1)',
              }}
            >
              {tieneDatos ? 'acumulado en periodos calculados' : 'sin datos aún'}
            </p>
          </div>

          {tieneDatos && (
            <div
              style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: 'var(--space-6)' }}
            >
              <p className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>
                Alcance 1
              </p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
                <span
                  className="numeric-tabular"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-2xl)',
                    fontWeight: 700,
                    color: 'var(--color-accent)',
                    letterSpacing: '-0.025em',
                    lineHeight: 1,
                  }}
                >
                  {s1.valor}
                </span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-3)' }}>
                  {s1.unidad}
                </span>
              </div>
              <p
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-ink-3)',
                  marginTop: 'var(--space-1)',
                }}
              >
                Emisiones directas
              </p>
            </div>
          )}

          {tieneDatos && (
            <div
              style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: 'var(--space-6)' }}
            >
              <p className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>
                Alcance 2
              </p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
                <span
                  className="numeric-tabular"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-2xl)',
                    fontWeight: 700,
                    color: 'var(--color-scope2)',
                    letterSpacing: '-0.025em',
                    lineHeight: 1,
                  }}
                >
                  {s2.valor}
                </span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-3)' }}>
                  {s2.unidad}
                </span>
              </div>
              <p
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-ink-3)',
                  marginTop: 'var(--space-1)',
                }}
              >
                Emisiones indirectas
              </p>
            </div>
          )}
        </section>

        {/* ── Indicador periodos abiertos ── */}
        {periodosAbiertos > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              marginTop: 'calc(var(--space-8) * -0.6)',
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: 'var(--color-signal-ok)',
                flexShrink: 0,
                boxShadow: '0 0 0 3px oklch(42% 0.12 155 / 16%)',
              }}
            />
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)' }}>
              <strong style={{ color: 'var(--color-ink-1)', fontFamily: 'var(--font-mono)' }}>
                {periodosAbiertos}
              </strong>{' '}
              periodo{periodosAbiertos !== 1 ? 's' : ''} abierto{periodosAbiertos !== 1 ? 's' : ''}{' '}
              pendientes de actividad
            </span>
          </div>
        )}

        {/* ── Distribución por alcance ── */}
        {tieneDatos && (
          <section
            style={{
              background: 'var(--color-surface-1)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-6)',
            }}
          >
            <p className="eyebrow" style={{ marginBottom: 'var(--space-5)' }}>
              Distribución por alcance
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {[
                {
                  etiqueta: 'Alcance 1 — Directas',
                  valor: scope1Co2eKg,
                  color: 'var(--color-accent)',
                },
                {
                  etiqueta: 'Alcance 2 — Indirectas',
                  valor: scope2Co2eKg,
                  color: 'var(--color-scope2)',
                },
              ].map(({ etiqueta, valor, color }) => {
                const pct = totalCo2eKg > 0 ? (valor / totalCo2eKg) * 100 : 0;
                const fmt = formatearCo2e(valor);
                return (
                  <div key={etiqueta}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        marginBottom: 'var(--space-2)',
                      }}
                    >
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-2)' }}>
                        {etiqueta}
                      </span>
                      <span
                        className="numeric-tabular"
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'var(--text-xs)',
                          color: 'var(--color-ink-1)',
                        }}
                      >
                        {fmt.valor} {fmt.unidad} ({pct.toFixed(1)}%)
                      </span>
                    </div>
                    <div
                      style={{
                        height: '5px',
                        background: 'var(--color-surface-2)',
                        borderRadius: '9999px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${pct}%`,
                          background: color,
                          borderRadius: '9999px',
                          transition: 'width 700ms cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Tendencia mensual CO₂e (SVG artesanal) ── */}
        <section
          style={{
            background: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)',
          }}
        >
          <p className="eyebrow" style={{ marginBottom: 'var(--space-5)' }}>
            Tendencia mensual CO₂e
          </p>
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
              Sin datos de emisiones en los últimos 6 meses.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <svg
                viewBox="0 0 540 178"
                style={{ width: '100%', minWidth: '320px', display: 'block' }}
                aria-label="Tendencia mensual de emisiones CO₂e"
              >
                {trendData.map((mes, i) => {
                  const barW = 60;
                  const gap = 30;
                  const x = i * (barW + gap) + gap / 2;
                  const maxH = 88;
                  const baseline = 128;
                  const barH = mes.kg > 0 ? Math.max((mes.kg / maxKg) * maxH, 4) : 2;
                  const y = baseline - barH;
                  const fmt = formatearCo2e(mes.kg);
                  return (
                    <g key={mes.label}>
                      <rect
                        x={x}
                        y={y}
                        width={barW}
                        height={barH}
                        rx="3"
                        fill="var(--color-accent)"
                        opacity={mes.kg === 0 ? 0.2 : 0.85}
                      />
                      {mes.kg > 0 && (
                        <text
                          x={x + barW / 2}
                          y={Math.max(y - 5, 12)}
                          textAnchor="middle"
                          fontSize="9"
                          fill="var(--color-ink-2)"
                          fontFamily="var(--font-mono)"
                        >
                          {fmt.valor}
                        </text>
                      )}
                      <text
                        x={x + barW / 2}
                        y={146}
                        textAnchor="middle"
                        fontSize="9"
                        fill="var(--color-ink-3)"
                        fontFamily="var(--font-mono)"
                      >
                        {mes.label}
                      </text>
                    </g>
                  );
                })}
                <line
                  x1="15"
                  y1="128"
                  x2="525"
                  y2="128"
                  stroke="var(--color-border)"
                  strokeWidth="1"
                />
              </svg>
            </div>
          )}
        </section>

        {/* ── Anomalías pendientes ── */}
        {totalAnomalias > 0 && (
          <section
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
                <ShieldAlert size={16} style={{ color: 'var(--color-signal-hi)' }} />
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
                Ver en auditoría <ArrowRight size={12} />
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {top3Anomalias.map((a) => (
                <div
                  key={a.id}
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

        {/* ── Feed actividad reciente ── */}
        {entradaFeed.length > 0 && (
          <section>
            <p className="eyebrow" style={{ marginBottom: 'var(--space-4)' }}>
              Actividad reciente
            </p>
            <div
              style={{
                background: 'var(--color-surface-1)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
              }}
            >
              {entradaFeed.map((e, i) => {
                const supplierId = periodSupplierMap.get(e.reporting_period_id);
                const supplierName = supplierId ? supplierNameMap.get(supplierId) : undefined;
                return (
                  <div
                    key={e.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      alignItems: 'center',
                      gap: 'var(--space-4)',
                      padding: 'var(--space-4) var(--space-5)',
                      borderBottom:
                        i < entradaFeed.length - 1 ? '1px solid var(--color-border)' : 'none',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-3)',
                          flexWrap: 'wrap',
                        }}
                      >
                        <p
                          style={{
                            fontWeight: 'var(--fw-medium)',
                            fontSize: 'var(--text-sm)',
                            color: 'var(--color-ink-1)',
                            margin: 0,
                          }}
                        >
                          {FUENTE_LABELS[e.source_type] ?? e.source_type}
                        </p>
                        {supplierName && (
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-3)' }}>
                            {supplierName}
                          </span>
                        )}
                        {e.anomaly && (
                          <AnomalyBadge severity={e.anomaly.severity} zScore={e.anomaly.z_score} />
                        )}
                      </div>
                      <p
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--color-ink-3)',
                          margin: 'var(--space-1) 0 0',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {e.raw_quantity} {e.raw_unit} ·{' '}
                        {new Date(e.created_at).toLocaleDateString('es-PE')}
                      </p>
                    </div>
                    <Badge variant={e.status as 'draft' | 'submitted' | 'validated' | 'rejected'}>
                      {ESTADO_LABELS[e.status] ?? e.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
      </div>
    </>
  );
}
