import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerClient } from '@/services/supabase/server';
import { TopBar } from '@/components/shell/TopBar';
import { Badge } from '@/components/ui/Badge';
import { AnomalyBadge } from '@/components/activity/AnomalyBadge';
import { variantEstadoPeriodo, etiquetaEstadoPeriodo } from '@/lib/reporting-period';
import type {
  SupplierRow,
  ReportingPeriodRow,
  ActivityEntryRow,
} from '@/types/database';
import type { PeriodStatus } from '@/domain/ReportingPeriod';
import { ArrowLeft, ClipboardList } from 'lucide-react';

export const metadata: Metadata = { title: 'Detalle de proveedor' };

const FUENTE_LABELS: Record<string, string> = {
  stationary_combustion: 'Combustión estacionaria',
  mobile_combustion: 'Combustión móvil',
  purchased_electricity: 'Electricidad',
  purchased_steam: 'Vapor',
  fugitive: 'Fugitivas',
  water_use: 'Agua',
  waste: 'Residuos',
};

const ESTADO_LABELS: Record<string, string> = {
  draft: 'Borrador',
  submitted: 'Enviado',
  validated: 'Validado',
  rejected: 'Rechazado',
};

function formatearCo2e(kg: number): string {
  if (kg >= 1_000_000) return `${(kg / 1_000_000).toFixed(2)} ktCO₂e`;
  if (kg >= 1_000) return `${(kg / 1_000).toFixed(3)} tCO₂e`;
  return `${kg.toFixed(1)} kg CO₂e`;
}

export default async function DetalleProveedorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: rawSupplier } = await supabase
    .from('suppliers')
    .select('id, name, category, contact_email, ruc, organization_id, created_at')
    .eq('id', id)
    .maybeSingle();

  if (!rawSupplier) notFound();
  const supplier = rawSupplier as Pick<
    SupplierRow,
    'id' | 'name' | 'category' | 'contact_email' | 'ruc' | 'organization_id' | 'created_at'
  >;

  // Defensa en profundidad: verificar que el usuario pertenece a la org del proveedor
  const { data: memCheck } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', supplier.organization_id)
    .maybeSingle();
  if (!memCheck) notFound();

  const { data: rawPeriods } = await supabase
    .from('reporting_periods')
    .select('id, label, start_date, end_date, status, created_at')
    .eq('supplier_id', id)
    .order('start_date', { ascending: false });

  const periods = (rawPeriods ?? []) as Pick<
    ReportingPeriodRow,
    'id' | 'label' | 'start_date' | 'end_date' | 'status' | 'created_at'
  >[];

  const periodIds = periods.map((p) => p.id);

  // Fetch paralelo: emission_results y entradas recientes (ambos dependen de periodIds)
  type FilaResultado = { reporting_period_id: string; co2e_kg: number };
  type FilaEntrada = Pick<
    ActivityEntryRow,
    'id' | 'source_type' | 'raw_quantity' | 'raw_unit' | 'status' | 'created_at'
  >;

  const [resultsRaw, rawEntriesRaw] = periodIds.length
    ? await Promise.all([
        supabase
          .from('emission_results')
          .select('reporting_period_id, co2e_kg')
          .in('reporting_period_id', periodIds),
        supabase
          .from('activity_entries')
          .select('id, source_type, raw_quantity, raw_unit, status, created_at')
          .in('reporting_period_id', periodIds)
          .order('created_at', { ascending: false })
          .limit(5),
      ])
    : [{ data: [] as FilaResultado[] }, { data: [] as FilaEntrada[] }];

  const co2eByPeriod = new Map<string, number>();
  for (const r of (resultsRaw.data ?? []) as FilaResultado[]) {
    co2eByPeriod.set(
      r.reporting_period_id,
      (co2eByPeriod.get(r.reporting_period_id) ?? 0) + r.co2e_kg,
    );
  }

  const rawEntries = (rawEntriesRaw.data ?? []) as FilaEntrada[];
  const entryIds = rawEntries.map((e) => e.id);

  const flagMap = new Map<string, { severity: string; z_score: number; message: string }>();
  if (entryIds.length) {
    const { data: flags } = await supabase
      .from('anomaly_flags')
      .select('activity_entry_id, severity, z_score, message')
      .in('activity_entry_id', entryIds)
      .eq('is_resolved', false);
    for (const f of (flags ?? []) as {
      activity_entry_id: string;
      severity: string;
      z_score: number;
      message: string;
    }[]) {
      flagMap.set(f.activity_entry_id, { severity: f.severity, z_score: f.z_score, message: f.message });
    }
  }

  const entradas = rawEntries.map((e) => ({ ...e, anomaly: flagMap.get(e.id) ?? null }));

  return (
    <>
      <TopBar title={supplier.name} email={user?.email} section="Proveedores" />

      <main
        style={{
          padding: 'var(--space-8)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-8)',
          maxWidth: 'var(--max-w-content)',
        }}
      >
        {/* Volver */}
        <div>
          <Link
            href="/suppliers"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              fontSize: 'var(--text-sm)',
              color: 'var(--color-ink-2)',
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={14} />
            Volver a Proveedores
          </Link>
        </div>

        {/* Header proveedor */}
        <section className="animate-fade-up stagger-1">
          <p className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>
            {supplier.category}
          </p>
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'var(--text-3xl)',
              fontWeight: 400,
              fontStyle: 'italic',
              color: 'var(--color-ink-1)',
              margin: '0 0 var(--space-4)',
              letterSpacing: '-0.032em',
              lineHeight: 1.1,
            }}
          >
            {supplier.name}
          </h2>
          <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
            {supplier.contact_email && (
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)' }}>
                {supplier.contact_email}
              </span>
            )}
            {supplier.ruc && (
              <span
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-ink-2)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                RUC {supplier.ruc}
              </span>
            )}
          </div>
        </section>

        {/* Periodos de reporte */}
        <section className="animate-fade-up stagger-2">
          <p className="eyebrow" style={{ marginBottom: 'var(--space-4)' }}>Periodos de reporte</p>

          {periods.length === 0 ? (
            <div
              style={{
                padding: 'var(--space-8)',
                background: 'var(--color-surface-1)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                textAlign: 'center',
              }}
            >
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-3)', margin: 0 }}>
                Sin periodos aún. Se crean automáticamente al registrar actividad.
              </p>
            </div>
          ) : (
            <div
              style={{
                background: 'var(--color-surface-1)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
              }}
            >
              <style>{`.period-row:hover td { background: var(--color-surface-2) !important; }`}</style>
              <table
                style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}
              >
                <thead>
                  <tr>
                    {['Periodo', 'Inicio', 'Fin', 'Estado', 'CO₂e total'].map((h) => (
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
                  {periods.map((p) => {
                    const co2e = co2eByPeriod.get(p.id);
                    return (
                      <tr
                        key={p.id}
                        className="period-row"
                        style={{ borderBottom: '1px solid var(--color-border)' }}
                      >
                        <td
                          style={{
                            padding: 'var(--space-3) var(--space-4)',
                            color: 'var(--color-ink-1)',
                            fontWeight: 500,
                          }}
                        >
                          {p.label}
                        </td>
                        <td
                          style={{
                            padding: 'var(--space-3) var(--space-4)',
                            color: 'var(--color-ink-2)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 'var(--text-xs)',
                          }}
                        >
                          {new Date(p.start_date).toLocaleDateString('es-PE', { timeZone: 'UTC' })}
                        </td>
                        <td
                          style={{
                            padding: 'var(--space-3) var(--space-4)',
                            color: 'var(--color-ink-2)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 'var(--text-xs)',
                          }}
                        >
                          {new Date(p.end_date).toLocaleDateString('es-PE', { timeZone: 'UTC' })}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                          <Badge variant={variantEstadoPeriodo(p.status as PeriodStatus)}>
                            {etiquetaEstadoPeriodo(p.status as PeriodStatus)}
                          </Badge>
                        </td>
                        <td
                          style={{
                            padding: 'var(--space-3) var(--space-4)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 'var(--text-xs)',
                            color: co2e ? 'var(--color-ink-1)' : 'var(--color-ink-3)',
                          }}
                        >
                          {co2e !== undefined ? formatearCo2e(co2e) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Últimas actividades */}
        <section className="animate-fade-up stagger-3">
          <p className="eyebrow" style={{ marginBottom: 'var(--space-4)' }}>
            Últimas entradas de actividad
          </p>

          {entradas.length === 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-5) var(--space-6)',
                background: 'var(--color-surface-1)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <ClipboardList size={16} style={{ color: 'var(--color-ink-3)', flexShrink: 0 }} />
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-3)', margin: 0 }}>
                Sin entradas de actividad registradas.
              </p>
            </div>
          ) : (
            <div
              style={{
                background: 'var(--color-surface-1)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
              }}
            >
              {entradas.map((e, i) => (
                <div
                  key={e.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-4)',
                    padding: 'var(--space-4) var(--space-5)',
                    borderBottom:
                      i < entradas.length - 1 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  <div style={{ flex: 1 }}>
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
                  {e.anomaly && (
                    <AnomalyBadge
                      severity={e.anomaly.severity as 'low' | 'medium' | 'high'}
                      zScore={e.anomaly.z_score}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
