import type { Metadata } from 'next';
import { createServerClient } from '@/services/supabase/server';
import { TopBar } from '@/components/shell/TopBar';
import { StatCard } from '@/components/ui/Card';
import { TrendingDown, Activity, AlertTriangle, FileCheck } from 'lucide-react';
import type { MembershipRow, ReportingPeriodRow } from '@/types/database';

export const metadata: Metadata = { title: 'Panel' };

const MODULOS = [
  {
    icon: <Activity size={20} />,
    titulo: 'Registros de actividad',
    descripcion: 'Envía y revisa datos de consumo de Alcance 1 y 2 de tus proveedores.',
    fase: 'Fase 5',
    color: 'var(--color-signal-ok)',
  },
  {
    icon: <AlertTriangle size={20} />,
    titulo: 'Detección de anomalías',
    descripcion: 'Detección por Z-score que señala patrones de consumo inusuales.',
    fase: 'Fase 5',
    color: 'var(--color-signal-md)',
  },
  {
    icon: <TrendingDown size={20} />,
    titulo: 'Consola de auditoría',
    descripcion: 'Bloquea periodos de reporte y consulta el registro de auditoría inmutable.',
    fase: 'Fase 6',
    color: 'var(--color-accent)',
  },
  {
    icon: <FileCheck size={20} />,
    titulo: 'Reportes',
    descripcion: 'Genera exportaciones PDF y CSV con verificación sha256.',
    fase: 'Fase 7',
    color: 'var(--color-ink-2)',
  },
];

function formatearCo2e(kg: number): { valor: string; unidad: string } {
  if (kg === 0) return { valor: '0', unidad: 'kg' };
  if (kg >= 1_000_000) return { valor: (kg / 1_000_000).toFixed(2), unidad: 'MtCO₂e' };
  if (kg >= 1_000) return { valor: (kg / 1_000).toFixed(3), unidad: 'tCO₂e' };
  return { valor: kg.toFixed(1), unidad: 'kg CO₂e' };
}

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
        }}
      >
        {/* Hero editorial */}
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
              letterSpacing: 'var(--tracking-tightest)',
              lineHeight: 'var(--leading-tight)',
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
              : 'Los datos se poblarán cuando los proveedores envíen sus registros de actividad.'}
          </p>
        </section>

        {/* KPIs */}
        <section
          aria-label="Indicadores clave"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--space-4)',
          }}
        >
          <StatCard
            label="Total CO₂e"
            value={tieneDatos ? total.valor : '—'}
            unit={tieneDatos ? total.unidad : ''}
            accent
          />
          <StatCard
            label="Alcance 1"
            value={tieneDatos ? s1.valor : '—'}
            unit={tieneDatos ? s1.unidad : ''}
          />
          <StatCard
            label="Alcance 2"
            value={tieneDatos ? s2.valor : '—'}
            unit={tieneDatos ? s2.unidad : ''}
          />
          <StatCard
            label="Periodos abiertos"
            value={periodosAbiertos > 0 ? periodosAbiertos : '—'}
            unit=""
          />
        </section>

        {/* Barra de alcances */}
        {tieneDatos && (
          <section
            style={{
              background: 'var(--color-surface-1)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-6)',
            }}
          >
            <p className="eyebrow" style={{ marginBottom: 'var(--space-4)' }}>
              Distribución por alcance
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {[
                {
                  etiqueta: 'Alcance 1 — Directas',
                  valor: scope1Co2eKg,
                  color: 'var(--color-accent)',
                },
                { etiqueta: 'Alcance 2 — Indirectas', valor: scope2Co2eKg, color: '#8b5cf6' },
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
                        marginBottom: 'var(--space-1)',
                      }}
                    >
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-2)' }}>
                        {etiqueta}
                      </span>
                      <span
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
                        height: '6px',
                        background: 'var(--color-border)',
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
                          transition: 'width 600ms cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Módulos */}
        <section>
          <p className="eyebrow" style={{ marginBottom: 'var(--space-5)' }}>
            Módulos de la plataforma
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 'var(--space-4)',
            }}
          >
            {MODULOS.map(({ icon, titulo, descripcion, fase, color }) => (
              <div
                key={titulo}
                style={{
                  background: 'var(--color-surface-1)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-6)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-3)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ color }}>{icon}</span>
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      fontWeight: 'var(--fw-medium)',
                      color: 'var(--color-ink-3)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {fase}
                  </span>
                </div>
                <div>
                  <p
                    style={{
                      fontWeight: 'var(--fw-semibold)',
                      fontSize: 'var(--text-base)',
                      color: 'var(--color-ink-1)',
                      margin: '0 0 var(--space-1)',
                    }}
                  >
                    {titulo}
                  </p>
                  <p
                    style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--color-ink-2)',
                      lineHeight: 'var(--leading-relaxed)',
                      margin: 0,
                    }}
                  >
                    {descripcion}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Arquitectura */}
        <section
          style={{
            background: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)',
          }}
        >
          <p className="eyebrow" style={{ marginBottom: 'var(--space-5)' }}>
            Arquitectura
          </p>
          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 'var(--space-4)',
              margin: 0,
            }}
          >
            {[
              ['Paradigma', 'OOP + FP híbrido'],
              ['Lenguaje', 'TypeScript'],
              ['Base de datos', 'Supabase / PostgreSQL'],
              ['Autenticación', 'Supabase Auth + RLS'],
              ['Motor de cálculo', 'FP puro · big.js · sha256'],
              ['Pruebas', '160 pruebas unitarias · Vitest'],
            ].map(([clave, valor]) => (
              <div key={clave}>
                <dt
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-ink-3)',
                    textTransform: 'uppercase',
                    letterSpacing: 'var(--tracking-wide)',
                    marginBottom: 'var(--space-1)',
                  }}
                >
                  {clave}
                </dt>
                <dd
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-ink-1)',
                    margin: 0,
                  }}
                >
                  {valor}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
    </>
  );
}
