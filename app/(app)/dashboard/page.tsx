import type { Metadata } from 'next';
import { createServerClient } from '@/services/supabase/server';
import { TopBar } from '@/components/shell/TopBar';
import { StatCard } from '@/components/ui/Card';
import { TrendingDown, Activity, AlertTriangle, FileCheck } from 'lucide-react';

export const metadata: Metadata = { title: 'Dashboard' };

const PLACEHOLDER_STATS = [
  { label: 'Total CO₂e', value: '—', unit: 'kg', accent: true },
  { label: 'Scope 1', value: '—', unit: 'kg', accent: false },
  { label: 'Scope 2', value: '—', unit: 'kg', accent: false },
  { label: 'Active Periods', value: '—', unit: '', accent: false },
];

const FEATURE_TILES = [
  {
    icon: <Activity size={20} />,
    title: 'Activity Entries',
    description: 'Submit and review Scope 1 & 2 consumption data from suppliers.',
    phase: 'Phase 5',
    color: 'var(--color-signal-ok)',
  },
  {
    icon: <AlertTriangle size={20} />,
    title: 'Anomaly Detection',
    description: 'Z-score based detection flags unusual consumption patterns.',
    phase: 'Phase 5',
    color: 'var(--color-signal-md)',
  },
  {
    icon: <TrendingDown size={20} />,
    title: 'Audit Console',
    description: 'Lock reporting periods and view the immutable audit trail.',
    phase: 'Phase 6',
    color: 'var(--color-accent)',
  },
  {
    icon: <FileCheck size={20} />,
    title: 'Reports',
    description: 'Generate PDF and CSV exports with sha256 verification.',
    phase: 'Phase 7',
    color: 'var(--color-ink-2)',
  },
];

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <TopBar title="Dashboard" email={user?.email} />

      <main
        style={{
          padding: 'var(--space-8)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-8)',
        }}
      >
        {/* Welcome */}
        <section>
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'var(--text-3xl)',
              fontWeight: 'var(--fw-semibold)',
              color: 'var(--color-ink-1)',
              margin: '0 0 var(--space-2)',
              letterSpacing: 'var(--tracking-tight)',
            }}
          >
            Carbon Footprint Overview
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)', margin: 0 }}>
            GHG Protocol Scope 1 &amp; 2 · Data populates once suppliers submit activity entries.
          </p>
        </section>

        {/* KPI stats */}
        <section
          aria-label="Key performance indicators"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--space-4)',
          }}
        >
          {PLACEHOLDER_STATS.map((stat) => (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              unit={stat.unit}
              accent={stat.accent}
            />
          ))}
        </section>

        {/* Feature tiles */}
        <section>
          <h3
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--fw-semibold)',
              color: 'var(--color-ink-3)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-widest)',
              margin: '0 0 var(--space-4)',
            }}
          >
            Platform Modules
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 'var(--space-4)',
            }}
          >
            {FEATURE_TILES.map(({ icon, title, description, phase, color }) => (
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
                    {phase}
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

        {/* Stack note */}
        <section
          style={{
            background: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)',
          }}
        >
          <h3
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--fw-semibold)',
              color: 'var(--color-ink-3)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-widest)',
              margin: '0 0 var(--space-4)',
            }}
          >
            Architecture
          </h3>
          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 'var(--space-3)',
              margin: 0,
            }}
          >
            {[
              ['Paradigm', 'OOP + FP hybrid'],
              ['Language', 'TypeScript'],
              ['Database', 'Supabase / PostgreSQL'],
              ['Auth', 'Supabase Auth + RLS'],
              ['Calc Engine', 'Pure FP · big.js · sha256'],
              ['Testing', '122 unit tests · Vitest'],
            ].map(([key, val]) => (
              <div key={key}>
                <dt
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-ink-3)',
                    textTransform: 'uppercase',
                    letterSpacing: 'var(--tracking-wide)',
                    marginBottom: 'var(--space-1)',
                  }}
                >
                  {key}
                </dt>
                <dd
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-ink-1)',
                    margin: 0,
                  }}
                >
                  {val}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
    </>
  );
}
