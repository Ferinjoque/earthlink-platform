import type { Metadata } from 'next';
import { createServerClient } from '@/services/supabase/server';
import { TopBar } from '@/components/shell/TopBar';
import { Activity, AlertTriangle, TrendingDown, FileCheck, ArrowRight } from 'lucide-react';
import type { MembershipRow, ReportingPeriodRow } from '@/types/database';

export const metadata: Metadata = { title: 'Panel' };

function formatearCo2e(kg: number): { valor: string; unidad: string } {
  if (kg === 0) return { valor: '0', unidad: 'kg' };
  if (kg >= 1_000_000) return { valor: (kg / 1_000_000).toFixed(2), unidad: 'MtCO₂e' };
  if (kg >= 1_000) return { valor: (kg / 1_000).toFixed(3), unidad: 'tCO₂e' };
  return { valor: kg.toFixed(1), unidad: 'kg CO₂e' };
}

const MODULOS = [
  {
    href: '/activity',
    icono: Activity,
    titulo: 'Registros de actividad',
    descripcion: 'Envía y revisa datos de consumo Alcance 1 y 2.',
    fase: 'Fase 5',
    colorIcono: 'var(--color-signal-ok)',
  },
  {
    href: '/activity',
    icono: AlertTriangle,
    titulo: 'Detección de anomalías',
    descripcion: 'Z-score señala patrones de consumo inusuales.',
    fase: 'Fase 5',
    colorIcono: 'var(--color-signal-md)',
  },
  {
    href: '/audit',
    icono: TrendingDown,
    titulo: 'Consola de auditoría',
    descripcion: 'Bloquea periodos y consulta el registro inmutable.',
    fase: 'Fase 6',
    colorIcono: 'var(--color-accent)',
  },
  {
    href: '/reports',
    icono: FileCheck,
    titulo: 'Reportes',
    descripcion: 'Exportaciones PDF y CSV con verificación sha256.',
    fase: 'Fase 7',
    colorIcono: 'var(--color-ink-3)',
  },
];

export default async function PanelPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rawMemberships } = await supabase
    .from('memberships')
    .select('*')
    .eq('user_id', user?.id ?? '');
  const memberships = (rawMemberships ?? []) as MembershipRow[];

  const orgIds = [
    ...new Set(memberships.map((m) => m.organization_id).filter((id): id is string => id !== null)),
  ];
  const memberSupplierIds = [
    ...new Set(memberships.map((m) => m.supplier_id).filter((id): id is string => id !== null)),
  ];

  const allSupplierIds: string[] = [...memberSupplierIds];
  if (orgIds.length) {
    const { data } = await supabase.from('suppliers').select('id').in('organization_id', orgIds);
    if (data) {
      for (const s of data as Array<{ id: string }>) {
        if (!allSupplierIds.includes(s.id)) allSupplierIds.push(s.id);
      }
    }
  }

  type FilaPeriodo = Pick<ReportingPeriodRow, 'id' | 'status'>;
  const periodsData: FilaPeriodo[] = [];
  if (allSupplierIds.length) {
    const { data } = await supabase
      .from('reporting_periods')
      .select('id, status')
      .in('supplier_id', allSupplierIds);
    if (data) periodsData.push(...(data as FilaPeriodo[]));
  }

  const periodosAbiertos = periodsData.filter((p) => p.status === 'open').length;
  const periodIds = periodsData.map((p) => p.id);

  let totalCo2eKg = 0;
  let scope1Co2eKg = 0;
  let scope2Co2eKg = 0;
  if (periodIds.length) {
    const { data } = await supabase
      .from('emission_results')
      .select('co2e_kg, scope')
      .in('reporting_period_id', periodIds);
    if (data) {
      for (const r of data as Array<{ co2e_kg: number; scope: number }>) {
        totalCo2eKg += r.co2e_kg;
        if (r.scope === 1) scope1Co2eKg += r.co2e_kg;
        else scope2Co2eKg += r.co2e_kg;
      }
    }
  }

  const tieneDatos = totalCo2eKg > 0;
  const total = formatearCo2e(totalCo2eKg);
  const s1 = formatearCo2e(scope1Co2eKg);
  const s2 = formatearCo2e(scope2Co2eKg);

  return (
    <>
      <TopBar title="Panel" email={user?.email} />

      <main
        style={{
          padding: 'var(--space-8)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-8)',
          maxWidth: 'var(--max-w-content)',
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

        {/* ── KPI strip editorial (no card-grid uniforme) ── */}
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
          {/* Total — protagonista */}
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

          {/* Alcance 1 */}
          {tieneDatos && (
            <div
              style={{
                borderLeft: '1px solid var(--color-border)',
                paddingLeft: 'var(--space-6)',
              }}
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

          {/* Alcance 2 */}
          {tieneDatos && (
            <div
              style={{
                borderLeft: '1px solid var(--color-border)',
                paddingLeft: 'var(--space-6)',
              }}
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
                    color: '#8b5cf6',
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
              periodo{periodosAbiertos !== 1 ? 's' : ''} abierto
              {periodosAbiertos !== 1 ? 's' : ''} pendientes de actividad
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
                  color: '#8b5cf6',
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

        {/* ── Módulos — lista editorial (no uniform card grid) ── */}
        <section>
          <p className="eyebrow" style={{ marginBottom: 'var(--space-4)' }}>
            Módulos de la plataforma
          </p>
          <div
            style={{
              background: 'var(--color-surface-1)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
            }}
          >
            {MODULOS.map(({ icono: Icono, titulo, descripcion, fase, colorIcono }, i) => (
              <div
                key={titulo}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  alignItems: 'center',
                  gap: 'var(--space-4)',
                  padding: 'var(--space-4) var(--space-6)',
                  borderBottom: i < MODULOS.length - 1 ? '1px solid var(--color-border)' : 'none',
                }}
              >
                <span
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-surface-2)',
                    display: 'grid',
                    placeItems: 'center',
                    color: colorIcono,
                    flexShrink: 0,
                  }}
                >
                  <Icono size={16} />
                </span>
                <div>
                  <p
                    style={{
                      fontWeight: 'var(--fw-medium)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--color-ink-1)',
                      margin: 0,
                    }}
                  >
                    {titulo}
                  </p>
                  <p
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-ink-3)',
                      margin: 'var(--space-1) 0 0',
                    }}
                  >
                    {descripcion}
                  </p>
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-ink-3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                  }}
                >
                  {fase}
                  <ArrowRight size={13} style={{ opacity: 0.4 }} />
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
