import type { Metadata } from 'next';
import { createServerClient } from '@/services/supabase/server';
import { TopBar } from '@/components/shell/TopBar';
import { StatCard } from '@/components/ui/Card';
import { TrendingDown, Activity, AlertTriangle, FileCheck } from 'lucide-react';
import type { MembershipRow, ReportingPeriodRow } from '@/types/database';

export const metadata: Metadata = { title: 'Dashboard' };

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

function formatCo2e(kg: number): { value: string; unit: string } {
  if (kg === 0) return { value: '0', unit: 'kg' };
  if (kg >= 1_000_000) return { value: (kg / 1_000_000).toFixed(2), unit: 'MtCO₂e' };
  if (kg >= 1_000) return { value: (kg / 1_000).toFixed(3), unit: 'tCO₂e' };
  return { value: kg.toFixed(1), unit: 'kg CO₂e' };
}

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Memberships → suppliers → all period IDs
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

  // Periods — count open, get all IDs for emission lookup
  type PeriodStatusRow = Pick<ReportingPeriodRow, 'id' | 'status'>;
  const periodsData: PeriodStatusRow[] = [];
  if (allSupplierIds.length) {
    const { data } = await supabase
      .from('reporting_periods')
      .select('id, status')
      .in('supplier_id', allSupplierIds);
    if (data) periodsData.push(...(data as PeriodStatusRow[]));
  }

  const openPeriodCount = periodsData.filter((p) => p.status === 'open').length;
  const periodIds = periodsData.map((p) => p.id);

  // Emission totals — sum across all periods
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

  const hasData = totalCo2eKg > 0;
  const total = formatCo2e(totalCo2eKg);
  const s1 = formatCo2e(scope1Co2eKg);
  const s2 = formatCo2e(scope2Co2eKg);

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
            GHG Protocol Scope 1 &amp; 2
            {hasData
              ? ' · Aggregated across all calculated reporting periods.'
              : ' · Data populates once a reporting period is calculated.'}
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
          <StatCard
            label="Total CO₂e"
            value={hasData ? total.value : '—'}
            unit={hasData ? total.unit : ''}
            accent
          />
          <StatCard
            label="Scope 1"
            value={hasData ? s1.value : '—'}
            unit={hasData ? s1.unit : ''}
          />
          <StatCard
            label="Scope 2"
            value={hasData ? s2.value : '—'}
            unit={hasData ? s2.unit : ''}
          />
          <StatCard
            label="Open Periods"
            value={openPeriodCount > 0 ? openPeriodCount : '—'}
            unit=""
          />
        </section>

        {/* Scope bar */}
        {hasData && (
          <section
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-6)',
            }}
          >
            <h3
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--fw-semibold)',
                color: 'var(--color-ink-3)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--tracking-widest)',
                margin: '0 0 var(--space-4)',
              }}
            >
              Scope Breakdown
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {[
                {
                  label: 'Scope 1 — Direct',
                  value: scope1Co2eKg,
                  color: 'var(--color-accent)',
                },
                {
                  label: 'Scope 2 — Indirect',
                  value: scope2Co2eKg,
                  color: '#8b5cf6',
                },
              ].map(({ label, value, color }) => {
                const pct = totalCo2eKg > 0 ? (value / totalCo2eKg) * 100 : 0;
                const fmt = formatCo2e(value);
                return (
                  <div key={label}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        marginBottom: 'var(--space-1)',
                      }}
                    >
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-2)' }}>
                        {label}
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'var(--text-xs)',
                          color: 'var(--color-ink-1)',
                        }}
                      >
                        {fmt.value} {fmt.unit} ({pct.toFixed(1)}%)
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

        {/* Architecture stack */}
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
              ['Testing', '147 unit tests · Vitest'],
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
