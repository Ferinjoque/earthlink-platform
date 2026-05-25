import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Lock } from 'lucide-react';
import { createServerClient } from '@/services/supabase/server';
import { TopBar } from '@/components/shell/TopBar';
import { Badge } from '@/components/ui/Badge';
import { PrintButton } from '@/components/ui/PrintButton';
import { EvidenceSection } from '@/components/activity/EvidenceSection';
import type {
  ReportingPeriodRow,
  SupplierRow,
  EmissionResultRow,
  ActivityEntryRow,
  AuditLogRow,
  MembershipRow,
  AnomalyFlagRow,
  AnomalySeverity,
} from '@/types/database';
import { variantEstadoPeriodo, etiquetaEstadoPeriodo } from '@/lib/reporting-period';
import type { PeriodStatus } from '@/domain/ReportingPeriod';
import { AnomaliaItem, type AnomaliaDetalle } from '@/components/audit/AnomaliaItem';

export const metadata: Metadata = { title: 'Detalle de periodo' };

const FUENTE_LABELS: Record<string, string> = {
  stationary_combustion: 'Combustión estacionaria',
  mobile_combustion: 'Combustión móvil',
  purchased_electricity: 'Electricidad',
  purchased_steam: 'Vapor',
  fugitive: 'Emisiones fugitivas',
};

function formatearKg(kg: number): string {
  if (kg === 0) return '—';
  if (kg >= 1_000_000) return `${(kg / 1_000_000).toFixed(3)} ktCO₂e`;
  if (kg >= 1_000) return `${(kg / 1_000).toFixed(3)} tCO₂e`;
  return `${kg.toFixed(2)} kg CO₂e`;
}

export default async function DetallePeriodoPage({
  params,
}: {
  params: Promise<{ periodId: string }>;
}) {
  const { periodId } = await params;
  if (!periodId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(periodId)) notFound();

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Cargar periodo y proveedor
  type PeriodoCompleto = Pick<
    ReportingPeriodRow,
    'id' | 'label' | 'supplier_id' | 'status' | 'start_date' | 'end_date'
  >;
  const { data: rawPeriod } = await supabase
    .from('reporting_periods')
    .select('id, label, supplier_id, status, start_date, end_date')
    .eq('id', periodId)
    .maybeSingle();

  if (!rawPeriod) notFound();
  const period = rawPeriod as PeriodoCompleto;

  const { data: rawSupplier } = await supabase
    .from('suppliers')
    .select('id, name, organization_id')
    .eq('id', period.supplier_id)
    .maybeSingle();

  if (!rawSupplier) notFound();
  const supplier = rawSupplier as Pick<SupplierRow, 'id' | 'name' | 'organization_id'>;

  // Verificar membresía del usuario en la org
  const { data: memCheck } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', supplier.organization_id)
    .maybeSingle();

  if (!memCheck) notFound();
  const membership = memCheck as Pick<MembershipRow, 'role'>;

  // Fetch paralelo: resultados de emisión y registro de auditoría
  type FilaResultado = Pick<
    EmissionResultRow,
    | 'id'
    | 'activity_entry_id'
    | 'scope'
    | 'co2e_kg'
    | 'factor_used'
    | 'factor_unit'
    | 'calc_hash'
    | 'calc_version'
    | 'calculated_at'
    | 'calculated_by'
    | 'normalized_quantity'
    | 'normalized_unit'
  >;
  type FilaAuditLog = Pick<
    AuditLogRow,
    'id' | 'action' | 'performed_at' | 'performed_by' | 'new_values'
  >;

  const [resultsRaw, auditLogRaw] = await Promise.all([
    supabase
      .from('emission_results')
      .select(
        'id, activity_entry_id, scope, co2e_kg, factor_used, factor_unit, calc_hash, calc_version, calculated_at, calculated_by, normalized_quantity, normalized_unit',
      )
      .eq('reporting_period_id', periodId)
      .order('scope', { ascending: true })
      .order('co2e_kg', { ascending: false }),
    supabase
      .from('audit_log')
      .select('id, action, performed_at, performed_by, new_values')
      .eq('record_id', periodId)
      .order('performed_at', { ascending: true }),
  ]);

  const results = (resultsRaw.data ?? []) as FilaResultado[];
  const auditLog = (auditLogRaw.data ?? []) as FilaAuditLog[];

  type FilaEntrada = Pick<ActivityEntryRow, 'id' | 'source_type' | 'raw_quantity' | 'raw_unit'>;
  type FilaFlag = Pick<
    AnomalyFlagRow,
    'id' | 'activity_entry_id' | 'severity' | 'z_score' | 'message' | 'flagged_at'
  >;

  // IDs de entradas con resultados (para tabla de emisiones)
  const resultEntryIds = [...new Set(results.map((r) => r.activity_entry_id))];

  // Todas las entradas del periodo (para sección de evidencias — incluye no calculadas)
  const { data: allEntriesRaw } = await supabase
    .from('activity_entries')
    .select('id, source_type, raw_quantity, raw_unit')
    .eq('reporting_period_id', periodId)
    .order('created_at', { ascending: true });

  const allEntries = (allEntriesRaw ?? []) as FilaEntrada[];
  const entryIds = allEntries.map((e) => e.id);

  const flagsRaw = entryIds.length
    ? await supabase
        .from('anomaly_flags')
        .select('id, activity_entry_id, severity, z_score, message, flagged_at')
        .in('activity_entry_id', entryIds)
        .eq('is_resolved', false)
        .order('flagged_at', { ascending: false })
    : { data: [] as FilaFlag[] };

  const entryMap = new Map<string, FilaEntrada>();
  for (const e of allEntries) {
    entryMap.set(e.id, e);
  }

  // Mapa limitado a entradas con resultados (para tabla de emisiones)
  void resultEntryIds;

  const flagsData = (flagsRaw.data ?? []) as FilaFlag[];

  const anomaliasDetalle: AnomaliaDetalle[] = flagsData.map((f) => {
    const entrada = entryMap.get(f.activity_entry_id);
    return {
      id: f.id,
      activity_entry_id: f.activity_entry_id,
      source_type: entrada?.source_type ?? '',
      severity: f.severity as AnomalySeverity,
      z_score: f.z_score,
      message: f.message,
      flagged_at: f.flagged_at,
      raw_quantity: entrada?.raw_quantity ?? null,
      raw_unit: entrada?.raw_unit ?? null,
    };
  });

  // Totales agregados
  let totalCo2e = 0;
  let scope1Co2e = 0;
  let scope2Co2e = 0;
  for (const r of results) {
    totalCo2e += r.co2e_kg;
    if (r.scope === 1) scope1Co2e += r.co2e_kg;
    else scope2Co2e += r.co2e_kg;
  }

  const inicioFmt = new Date(period.start_date).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const finFmt = new Date(period.end_date).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <>
      <style>{`
        @media print {
          aside, header { display: none !important; }
          [data-no-print] { display: none !important; }
          main { padding: 12mm 0 0 !important; max-width: 100% !important; }
          @page { margin: 15mm 20mm; size: A4 landscape; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
        }
      `}</style>
      <TopBar
        title={`Periodo ${period.label}`}
        email={user?.email}
        section="Detalle de auditoría"
      />
      <main
        style={{
          padding: 'var(--space-8)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-8)',
          maxWidth: 'var(--max-w-content)',
        }}
      >
        {/* ── Back link + print ── */}
        <div
          data-no-print
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Link
            href="/audit"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              fontSize: 'var(--text-sm)',
              color: 'var(--color-ink-3)',
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={14} />
            Volver a auditoría
          </Link>
          <PrintButton
            style={{
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-ink-2)',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '4px var(--space-3)',
              cursor: 'pointer',
            }}
          >
            Imprimir / PDF
          </PrintButton>
        </div>

        {/* ── Header ── */}
        <section
          className="animate-fade-up stagger-1"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-4)',
              flexWrap: 'wrap',
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
              {supplier.name} — {period.label}
            </h2>
            <Badge variant={variantEstadoPeriodo(period.status as PeriodStatus)}>
              {etiquetaEstadoPeriodo(period.status as PeriodStatus)}
            </Badge>
          </div>
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-ink-3)',
              margin: 0,
              fontFamily: 'var(--font-mono)',
            }}
          >
            {inicioFmt} — {finFmt}
          </p>
        </section>

        {/* ── KPI strip ── */}
        {results.length > 0 && (
          <section
            className="animate-fade-up stagger-2"
            style={{
              background: 'var(--color-surface-1)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-6) var(--space-8)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 'var(--space-6)',
            }}
          >
            {[
              { label: 'Total CO₂e', valor: formatearKg(totalCo2e), color: 'var(--color-ink-1)' },
              { label: 'Alcance 1', valor: formatearKg(scope1Co2e), color: 'var(--color-accent)' },
              { label: 'Alcance 2', valor: formatearKg(scope2Co2e), color: 'var(--color-scope2)' },
              { label: 'Entradas', valor: String(results.length), color: 'var(--color-ink-1)' },
            ].map(({ label, valor, color }) => (
              <div key={label}>
                <p className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>
                  {label}
                </p>
                <span
                  className="numeric-tabular"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xl)',
                    fontWeight: 700,
                    color,
                    letterSpacing: 'var(--tracking-tight)',
                    lineHeight: 1,
                  }}
                >
                  {valor}
                </span>
              </div>
            ))}
          </section>
        )}

        {/* ── Anomalías activas ── */}
        {flagsData.length > 0 && (
          <section className="animate-fade-up stagger-3">
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <h3
                style={{
                  fontWeight: 600,
                  color: 'var(--color-signal-md)',
                  margin: 0,
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase',
                  letterSpacing: 'var(--tracking-wide)',
                  fontSize: 'var(--text-xs)',
                }}
              >
                Anomalías activas ({flagsData.length})
              </h3>
            </div>
            <div
              style={{
                background: 'var(--color-surface-1)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '0 var(--space-4)',
              }}
            >
              {anomaliasDetalle.map((a) => (
                <AnomaliaItem key={a.id} anomalia={a} />
              ))}
            </div>
          </section>
        )}

        {/* ── Tabla de resultados ── */}
        <section className="animate-fade-up stagger-4">
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <h3
              style={{
                fontSize: 'var(--text-base)',
                fontWeight: 600,
                color: 'var(--color-ink-1)',
                margin: 0,
              }}
            >
              Resultados de emisiones
            </h3>
            <p
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--color-ink-3)',
                margin: 'var(--space-1) 0 0',
              }}
            >
              {results.length === 0
                ? 'Sin resultados calculados para este periodo.'
                : `${results.length} entrada${results.length !== 1 ? 's' : ''} calculada${results.length !== 1 ? 's' : ''}.`}
            </p>
          </div>

          {results.length > 0 && (
            <div
              style={{
                background: 'var(--color-surface-1)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                overflowX: 'auto',
              }}
            >
              <style>
                {'.result-row:hover { background: var(--color-surface-2) !important; }'}
              </style>
              <table
                style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}
              >
                <thead>
                  <tr>
                    {[
                      'Fuente',
                      'Cantidad',
                      'Normalizado',
                      'Alcance',
                      'CO₂e',
                      'Factor',
                      'Hash',
                      'Calculado',
                    ].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: 'left',
                          padding: 'var(--space-3) var(--space-4)',
                          color: 'var(--color-ink-3)',
                          fontWeight: 600,
                          fontSize: 'var(--text-xs)',
                          fontFamily: 'var(--font-mono)',
                          borderBottom: '1px solid var(--color-border)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => {
                    const entrada = entryMap.get(r.activity_entry_id);
                    return (
                      <tr
                        key={r.id}
                        className="result-row"
                        style={{ borderBottom: '1px solid var(--color-border)' }}
                      >
                        <td style={estiloCelda}>
                          {FUENTE_LABELS[entrada?.source_type ?? ''] ?? entrada?.source_type ?? '—'}
                        </td>
                        <td
                          style={{
                            ...estiloCelda,
                            fontFamily: 'var(--font-mono)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {entrada
                            ? `${entrada.raw_quantity.toLocaleString('es')} ${entrada.raw_unit}`
                            : '—'}
                        </td>
                        <td
                          style={{
                            ...estiloCelda,
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--color-ink-3)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {r.normalized_quantity.toLocaleString('es', { maximumFractionDigits: 4 })}{' '}
                          {r.normalized_unit}
                        </td>
                        <td
                          style={{
                            ...estiloCelda,
                            fontFamily: 'var(--font-mono)',
                            textAlign: 'center' as const,
                          }}
                        >
                          <span
                            style={{
                              color: r.scope === 1 ? 'var(--color-accent)' : 'var(--color-scope2)',
                              fontWeight: 700,
                            }}
                          >
                            {r.scope}
                          </span>
                        </td>
                        <td
                          style={{
                            ...estiloCelda,
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            color: r.scope === 1 ? 'var(--color-accent)' : 'var(--color-scope2)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {formatearKg(r.co2e_kg)}
                        </td>
                        <td
                          style={{
                            ...estiloCelda,
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--color-ink-3)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {r.factor_used.toFixed(6)} {r.factor_unit}
                        </td>
                        <td
                          title={r.calc_hash}
                          style={{
                            ...estiloCelda,
                            fontFamily: 'var(--font-mono)',
                            fontSize: 'var(--text-xs)',
                            color: 'var(--color-ink-3)',
                            whiteSpace: 'nowrap',
                            maxWidth: '100px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {r.calc_hash.slice(0, 8)}…
                        </td>
                        <td
                          style={{
                            ...estiloCelda,
                            fontFamily: 'var(--font-mono)',
                            fontSize: 'var(--text-xs)',
                            color: 'var(--color-ink-3)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {new Date(r.calculated_at).toLocaleString('es-PE', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--color-surface-2)' }}>
                    <td
                      colSpan={4}
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-ink-3)',
                        fontWeight: 600,
                        borderTop: '1px solid var(--color-border)',
                      }}
                    >
                      TOTAL
                    </td>
                    <td
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 700,
                        color: 'var(--color-ink-1)',
                        whiteSpace: 'nowrap',
                        borderTop: '1px solid var(--color-border)',
                      }}
                    >
                      {formatearKg(totalCo2e)}
                    </td>
                    <td colSpan={3} style={{ borderTop: '1px solid var(--color-border)' }} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        {/* ── Evidencias adjuntas por entrada ── */}
        {entryIds.length > 0 && (
          <section className="animate-fade-up stagger-5" data-no-print>
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <h3
                style={{
                  fontSize: 'var(--text-base)',
                  fontWeight: 600,
                  color: 'var(--color-ink-1)',
                  margin: 0,
                }}
              >
                Evidencias adjuntas
              </h3>
              <p
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-ink-3)',
                  margin: 'var(--space-1) 0 0',
                }}
              >
                Archivos de respaldo opcionales por cada entrada de actividad.
              </p>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
              }}
            >
              {entryIds.map((eid) => {
                const entrada = entryMap.get(eid);
                return (
                  <div
                    key={eid}
                    style={{
                      background: 'var(--color-surface-1)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--space-3) var(--space-4)',
                      display: 'flex',
                      gap: 'var(--space-4)',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 'var(--text-xs)',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--color-ink-3)',
                        flexShrink: 0,
                        minWidth: '160px',
                      }}
                    >
                      {FUENTE_LABELS[entrada?.source_type ?? ''] ?? entrada?.source_type ?? eid.slice(0, 8)}
                      {entrada && (
                        <span style={{ display: 'block', color: 'var(--color-ink-3)' }}>
                          {entrada.raw_quantity.toLocaleString('es')} {entrada.raw_unit}
                        </span>
                      )}
                    </span>
                    <div style={{ flex: 1 }}>
                      <Suspense
                        fallback={
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-3)' }}>
                            Cargando…
                          </span>
                        }
                      >
                        <EvidenceSection entryId={eid} readOnly />
                      </Suspense>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Audit log timeline ── */}
        <section className="animate-fade-up stagger-6" data-no-print>
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <h3
              style={{
                fontSize: 'var(--text-base)',
                fontWeight: 600,
                color: 'var(--color-ink-1)',
                margin: 0,
              }}
            >
              Registro de auditoría
            </h3>
            <p
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--color-ink-3)',
                margin: 'var(--space-1) 0 0',
              }}
            >
              Historial inmutable de cambios de estado en este periodo.
            </p>
          </div>

          {auditLog.length === 0 ? (
            <p
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--color-ink-3)',
                fontFamily: 'var(--font-mono)',
                padding: 'var(--space-6) 0',
                margin: 0,
              }}
            >
              Sin entradas de auditoría registradas para este periodo.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative' }}>
              <style>{`
                .timeline-item::before {
                  content: '';
                  position: absolute;
                  left: 7px;
                  top: 0;
                  bottom: 0;
                  width: 1px;
                  background: var(--color-border);
                }
                .timeline-item:first-child::before { top: 16px; }
                .timeline-item:last-child::before { bottom: calc(100% - 16px); }
              `}</style>
              {auditLog.map((entry) => {
                const ACCION_LABEL: Record<string, string> = {
                  insert: 'Creación',
                  update: 'Actualización',
                  status_change: 'Cambio de estado',
                  delete: 'Eliminación',
                  lock: 'Bloqueo',
                  unlock: 'Desbloqueo',
                  calculate: 'Cálculo',
                  void: 'Anulación',
                };
                const accion = ACCION_LABEL[entry.action.toLowerCase()] ?? entry.action.replace(/_/g, ' ').toLowerCase();
                const newVals = entry.new_values as Record<string, unknown> | null;
                const nuevoEstado = newVals?.status as string | undefined;
                return (
                  <div
                    key={entry.id}
                    className="timeline-item"
                    style={{
                      position: 'relative',
                      paddingLeft: 'var(--space-8)',
                      paddingBottom: 'var(--space-5)',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: '3px',
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        background:
                          nuevoEstado === 'locked'
                            ? 'var(--color-accent)'
                            : 'var(--color-surface-2)',
                        border: `2px solid ${nuevoEstado === 'locked' ? 'var(--color-accent)' : 'var(--color-border)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1,
                      }}
                    >
                      {nuevoEstado === 'locked' && <Lock size={6} style={{ color: 'white' }} />}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: 'var(--space-3)',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 'var(--text-sm)',
                          fontWeight: 600,
                          color: 'var(--color-ink-1)',
                        }}
                      >
                        {accion}
                      </span>
                      {nuevoEstado && (
                        <Badge variant={variantEstadoPeriodo(nuevoEstado as PeriodStatus)}>
                          {etiquetaEstadoPeriodo(nuevoEstado as PeriodStatus)}
                        </Badge>
                      )}
                      <span
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--color-ink-3)',
                          fontFamily: 'var(--font-mono)',
                          marginLeft: 'auto',
                        }}
                      >
                        {new Date(entry.performed_at).toLocaleString('es-PE', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {entry.performed_by && (
                      <p
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--color-ink-3)',
                          fontFamily: 'var(--font-mono)',
                          margin: 'var(--space-1) 0 0',
                        }}
                      >
                        por {entry.performed_by}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}

const estiloCelda: React.CSSProperties = {
  padding: 'var(--space-3) var(--space-4)',
  color: 'var(--color-ink-1)',
  fontSize: 'var(--text-xs)',
};
