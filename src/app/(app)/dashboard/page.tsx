import type { Metadata } from 'next';
import { createServerClient } from '@/services/supabase/server';
import { TopBar } from '@/components/shell/TopBar';
import { StatCard } from '@/components/ui/Card';
import { TrendingDown, Activity, AlertTriangle, FileCheck } from 'lucide-react';

export const metadata: Metadata = { title: 'Panel' };

const ESTADISTICAS = [
  {
    label: 'Total CO₂e',
    value: '—',
    unit: 'kg',
    accent: true,
  },
  {
    label: 'Alcance 1',
    value: '—',
    unit: 'kg',
    accent: false,
  },
  {
    label: 'Alcance 2',
    value: '—',
    unit: 'kg',
    accent: false,
  },
  {
    label: 'Periodos activos',
    value: '—',
    unit: '',
    accent: false,
  },
];

const MODULOS = [
  {
    icon: <Activity size={20} />,
    title: 'Registros de actividad',
    description: 'Envía y revisa datos de consumo de Alcance 1 y 2 de tus proveedores.',
    fase: 'Fase 5',
    color: 'var(--color-signal-ok)',
  },
  {
    icon: <AlertTriangle size={20} />,
    title: 'Detección de anomalías',
    description: 'Detección por Z-score que señala patrones de consumo inusuales.',
    fase: 'Fase 5',
    color: 'var(--color-signal-md)',
  },
  {
    icon: <TrendingDown size={20} />,
    title: 'Consola de auditoría',
    description: 'Bloquea periodos de reporte y consulta el registro de auditoría inmutable.',
    fase: 'Fase 6',
    color: 'var(--color-accent)',
  },
  {
    icon: <FileCheck size={20} />,
    title: 'Reportes',
    description: 'Genera exportaciones PDF y CSV con verificación sha256.',
    fase: 'Fase 7',
    color: 'var(--color-ink-2)',
  },
];

const ARQUITECTURA = [
  ['Paradigma', 'OOP + FP híbrido'],
  ['Lenguaje', 'TypeScript'],
  ['Base de datos', 'Supabase / PostgreSQL'],
  ['Autenticación', 'Supabase Auth + RLS'],
  ['Motor de cálculo', 'FP puro · big.js · sha256'],
  ['Pruebas', '122 pruebas unitarias · Vitest'],
];

const FLUJO = [
  { paso: '01', titulo: 'Capturar', desc: 'Proveedores envían registros de consumo.' },
  { paso: '02', titulo: 'Estandarizar', desc: 'Motor FP convierte unidades al estándar.' },
  { paso: '03', titulo: 'Calcular', desc: 'Pipeline CO₂e según GHG Protocol.' },
  { paso: '04', titulo: 'Auditar', desc: 'Revisión y bloqueo inmutable del periodo.' },
  { paso: '05', titulo: 'Reportar', desc: 'Exportación PDF/CSV verificado sha256.' },
];

export default async function PanelPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <TopBar title="Panel" email={user?.email} />

      <main
        style={{
          padding: 'var(--space-8)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-10)',
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
            Los datos se poblarán cuando los proveedores envíen sus registros de actividad.
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
          {ESTADISTICAS.map((stat) => (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              unit={stat.unit}
              accent={stat.accent}
            />
          ))}
        </section>

        {/* Flujo */}
        <section>
          <p className="eyebrow" style={{ marginBottom: 'var(--space-5)' }}>
            Cómo funciona
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 'var(--space-4)',
            }}
          >
            {FLUJO.map(({ paso, titulo, desc }) => (
              <div
                key={paso}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-2)',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-accent)',
                    fontWeight: 'var(--fw-semibold)',
                    letterSpacing: 'var(--tracking-wide)',
                  }}
                >
                  {paso}
                </span>
                <p
                  style={{
                    fontWeight: 'var(--fw-semibold)',
                    fontSize: 'var(--text-base)',
                    color: 'var(--color-ink-1)',
                    margin: 0,
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
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </section>

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
            {MODULOS.map(({ icon, title, description, fase, color }) => (
              <div
                key={title}
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
                    {title}
                  </p>
                  <p
                    style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--color-ink-2)',
                      lineHeight: 'var(--leading-relaxed)',
                      margin: 0,
                    }}
                  >
                    {description}
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
            {ARQUITECTURA.map(([clave, valor]) => (
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
