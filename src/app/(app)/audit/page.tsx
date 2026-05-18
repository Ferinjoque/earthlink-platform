import type { Metadata } from 'next';
import { createServerClient } from '@/services/supabase/server';
import { TopBar } from '@/components/shell/TopBar';
import { Badge } from '@/components/ui/Badge';
import { PeriodActions } from '@/components/audit/PeriodActions';
import type { MembershipRow, SupplierRow, ReportingPeriodRow } from '@/types/database';
import type { PeriodStatus } from '@/domain/ReportingPeriod';

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

function formatearKg(kg: number): string {
  if (kg === 0) return '—';
  if (kg >= 1_000) return `${(kg / 1_000).toFixed(3)} tCO₂e`;
  return `${kg.toFixed(2)} kg`;
}

type FilaResumen = { co2e_kg: number; scope: number };

type ResumenEmisiones = {
  totalCo2eKg: number;
  scope1Co2eKg: number;
  scope2Co2eKg: number;
  nResultados: number;
};

export default async function AuditoriaPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rawMemberships } = await supabase
    .from('memberships')
    .select('*')
    .eq('user_id', user?.id ?? '');
  const memberships = (rawMemberships ?? []) as MembershipRow[];

  const orgIds = [...new Set(memberships.map((m) => m.organization_id).filter(Boolean))];
  const memberSupplierIds = [...new Set(memberships.map((m) => m.supplier_id).filter(Boolean))];

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

  const periodosCalculados = periodsData.filter((p) => p.status !== 'open').map((p) => p.id);
  const mapaResumen = new Map<string, ResumenEmisiones>();
  if (periodosCalculados.length) {
    const { data } = await supabase
      .from('emission_results')
      .select('reporting_period_id, co2e_kg, scope')
      .in('reporting_period_id', periodosCalculados);
    if (data) {
      for (const r of data as Array<{ reporting_period_id: string } & FilaResumen>) {
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
      }
    }
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

  const ESTILO_COL: React.CSSProperties = {
    textAlign: 'left',
    padding: 'var(--space-3) var(--space-4)',
    color: 'var(--color-ink-3)',
    fontWeight: 600,
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    borderBottom: '1px solid var(--color-border)',
    whiteSpace: 'nowrap',
  };

  const bloqueadosConResumen = periodsData.filter(
    (p) => p.status === 'locked' && mapaResumen.has(p.id),
  );

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
          ).map(([s, etiqueta]) => (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Badge variant={variantEstado(s)}>{etiqueta}</Badge>
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

        {/* Tabla de periodos */}
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
              Periodos de reporte
            </h2>
            <p
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--color-ink-3)',
                margin: 'var(--space-1) 0 0',
              }}
            >
              Calcula el CO₂e de los periodos abiertos y bloquéalos para crear un registro de
              auditoría inmutable.
            </p>
          </div>

          <style>{`.audit-row:hover { background: var(--color-surface-2) !important; }`}</style>

          {periodsData.length === 0 ? (
            <p
              style={{
                color: 'var(--color-ink-3)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-mono)',
                padding: 'var(--space-8) 0',
                textAlign: 'center',
              }}
            >
              No se encontraron periodos de reporte para tu cuenta.
            </p>
          ) : (
            <div
              style={{
                background: 'var(--color-surface-1)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                overflowX: 'auto',
              }}
            >
              <table
                style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}
              >
                <thead>
                  <tr>
                    {['Proveedor', 'Periodo', 'Fechas', 'Estado', 'CO₂e Total', 'Acciones'].map(
                      (h) => (
                        <th key={h} style={ESTILO_COL}>
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {periodsData.map((p) => {
                    const resumen = mapaResumen.get(p.id);
                    const inicioFmt = new Date(p.start_date).toLocaleDateString('es', {
                      month: 'short',
                      year: 'numeric',
                    });
                    const finFmt = new Date(p.end_date).toLocaleDateString('es', {
                      month: 'short',
                      year: 'numeric',
                    });

                    return (
                      <tr
                        key={p.id}
                        className="audit-row"
                        style={{ borderBottom: '1px solid var(--color-border)' }}
                      >
                        <td
                          style={{
                            padding: 'var(--space-3) var(--space-4)',
                            color: 'var(--color-ink-1)',
                            fontWeight: 500,
                          }}
                        >
                          {supplierMap.get(p.supplier_id) ?? '—'}
                        </td>
                        <td
                          style={{
                            padding: 'var(--space-3) var(--space-4)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 'var(--text-xs)',
                            color: 'var(--color-ink-1)',
                          }}
                        >
                          {p.label}
                        </td>
                        <td
                          style={{
                            padding: 'var(--space-3) var(--space-4)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 'var(--text-xs)',
                            color: 'var(--color-ink-3)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {inicioFmt} – {finFmt}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                          <Badge variant={variantEstado(p.status as PeriodStatus)}>
                            {etiquetaEstado(p.status as PeriodStatus)}
                          </Badge>
                        </td>
                        <td
                          style={{
                            padding: 'var(--space-3) var(--space-4)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 'var(--text-xs)',
                            color: resumen ? 'var(--color-ink-1)' : 'var(--color-ink-3)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {resumen ? (
                            <span
                              title={`Alcance 1: ${formatearKg(resumen.scope1Co2eKg)} · Alcance 2: ${formatearKg(resumen.scope2Co2eKg)}`}
                            >
                              {formatearKg(resumen.totalCo2eKg)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', minWidth: '160px' }}>
                          <PeriodActions periodId={p.id} status={p.status as PeriodStatus} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
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
                const r = mapaResumen.get(p.id)!;
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
                        {supplierMap.get(p.supplier_id) ?? '—'} · {p.label}
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
