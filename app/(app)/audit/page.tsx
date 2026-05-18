import type { Metadata } from 'next';
import { createServerClient } from '@/services/supabase/server';
import { TopBar } from '@/components/shell/TopBar';
import { Badge } from '@/components/ui/Badge';
import { PeriodActions } from '@/components/audit/PeriodActions';
import type { MembershipRow, SupplierRow, ReportingPeriodRow } from '@/types/database';
import type { PeriodStatus } from '@/domain/ReportingPeriod';

export const metadata: Metadata = { title: 'Audit Console' };

function statusVariant(
  status: PeriodStatus,
): 'open' | 'calculating' | 'under_review' | 'locked' | 'neutral' {
  if (status === 'open') return 'open';
  if (status === 'calculating') return 'calculating';
  if (status === 'under_review') return 'under_review';
  if (status === 'locked') return 'locked';
  return 'neutral';
}

function statusLabel(status: PeriodStatus): string {
  if (status === 'open') return 'open';
  if (status === 'calculating') return 'calculating…';
  if (status === 'under_review') return 'under review';
  if (status === 'locked') return 'locked';
  return status;
}

function formatKg(kg: number): string {
  if (kg === 0) return '—';
  if (kg >= 1_000) return `${(kg / 1_000).toFixed(3)} tCO₂e`;
  return `${kg.toFixed(2)} kg`;
}

type PeriodSummaryRow = { co2e_kg: number; scope: number };

type EmissionSummary = {
  totalCo2eKg: number;
  scope1Co2eKg: number;
  scope2Co2eKg: number;
  resultCount: number;
};

export default async function AuditPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Memberships → org + supplier IDs
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

  // All periods (all statuses)
  type PeriodPickRow = Pick<
    ReportingPeriodRow,
    'id' | 'label' | 'supplier_id' | 'status' | 'start_date' | 'end_date'
  >;
  const periodsData: PeriodPickRow[] = [];
  if (allSupplierIds.length) {
    const { data } = await supabase
      .from('reporting_periods')
      .select('id, label, supplier_id, status, start_date, end_date')
      .in('supplier_id', allSupplierIds)
      .order('start_date', { ascending: false });
    if (data) periodsData.push(...(data as PeriodPickRow[]));
  }

  // Emission summaries for calculated periods
  const calculatedPeriodIds = periodsData.filter((p) => p.status !== 'open').map((p) => p.id);
  const summaryMap = new Map<string, EmissionSummary>();
  if (calculatedPeriodIds.length) {
    const { data } = await supabase
      .from('emission_results')
      .select('reporting_period_id, co2e_kg, scope')
      .in('reporting_period_id', calculatedPeriodIds);
    if (data) {
      for (const r of data as Array<{ reporting_period_id: string } & PeriodSummaryRow>) {
        const prev = summaryMap.get(r.reporting_period_id) ?? {
          totalCo2eKg: 0,
          scope1Co2eKg: 0,
          scope2Co2eKg: 0,
          resultCount: 0,
        };
        summaryMap.set(r.reporting_period_id, {
          totalCo2eKg: prev.totalCo2eKg + r.co2e_kg,
          scope1Co2eKg: prev.scope1Co2eKg + (r.scope === 1 ? r.co2e_kg : 0),
          scope2Co2eKg: prev.scope2Co2eKg + (r.scope === 2 ? r.co2e_kg : 0),
          resultCount: prev.resultCount + 1,
        });
      }
    }
  }

  // Status counts
  const statusCounts: Record<PeriodStatus, number> = {
    open: 0,
    calculating: 0,
    under_review: 0,
    locked: 0,
  };
  for (const p of periodsData) {
    const s = p.status as PeriodStatus;
    statusCounts[s] = (statusCounts[s] ?? 0) + 1;
  }

  const COL_STYLE: React.CSSProperties = {
    textAlign: 'left',
    padding: 'var(--space-3) var(--space-4)',
    color: 'var(--color-ink-3)',
    fontWeight: 600,
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    borderBottom: '1px solid var(--color-border)',
    whiteSpace: 'nowrap',
  };

  const lockedWithSummary = periodsData.filter(
    (p) => p.status === 'locked' && summaryMap.has(p.id),
  );

  return (
    <>
      <TopBar title="Audit Console" email={user?.email} />
      <main
        style={{
          padding: 'var(--space-8)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-8)',
        }}
      >
        {/* Status chips */}
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
            Periods:
          </span>
          {(
            [
              ['open', 'open'],
              ['calculating', 'calculating'],
              ['under_review', 'under review'],
              ['locked', 'locked'],
            ] as [PeriodStatus, string][]
          ).map(([s, label]) => (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Badge variant={statusVariant(s)}>{label}</Badge>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-ink-2)',
                }}
              >
                {statusCounts[s]}
              </span>
            </span>
          ))}
        </section>

        {/* Periods table */}
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
              Reporting Periods
            </h2>
            <p
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--color-ink-3)',
                margin: 'var(--space-1) 0 0',
              }}
            >
              Calculate CO₂e for open periods, then lock them to create an immutable audit trail.
            </p>
          </div>

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
              No reporting periods found for your account.
            </p>
          ) : (
            <div
              style={{
                background: 'var(--color-surface)',
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
                    {['Supplier', 'Period', 'Dates', 'Status', 'CO₂e Total', 'Actions'].map((h) => (
                      <th key={h} style={COL_STYLE}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periodsData.map((p) => {
                    const summary = summaryMap.get(p.id);
                    const startFmt = new Date(p.start_date).toLocaleDateString('en-US', {
                      month: 'short',
                      year: 'numeric',
                    });
                    const endFmt = new Date(p.end_date).toLocaleDateString('en-US', {
                      month: 'short',
                      year: 'numeric',
                    });

                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
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
                          {startFmt} – {endFmt}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                          <Badge variant={statusVariant(p.status as PeriodStatus)}>
                            {statusLabel(p.status as PeriodStatus)}
                          </Badge>
                        </td>
                        <td
                          style={{
                            padding: 'var(--space-3) var(--space-4)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 'var(--text-xs)',
                            color: summary ? 'var(--color-ink-1)' : 'var(--color-ink-3)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {summary ? (
                            <span
                              title={`Scope 1: ${formatKg(summary.scope1Co2eKg)} · Scope 2: ${formatKg(summary.scope2Co2eKg)}`}
                            >
                              {formatKg(summary.totalCo2eKg)}
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

        {/* Locked period summary cards */}
        {lockedWithSummary.length > 0 && (
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
                Locked Period Summary
              </h2>
              <p
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-ink-3)',
                  margin: 'var(--space-1) 0 0',
                }}
              >
                Immutable CO₂e records — these figures cannot be changed.
              </p>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 'var(--space-4)',
              }}
            >
              {lockedWithSummary.map((p) => {
                const s = summaryMap.get(p.id)!;
                return (
                  <div
                    key={p.id}
                    style={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderLeft: '3px solid var(--color-ink-3)',
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
                      <Badge variant="locked">locked</Badge>
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
                      {formatKg(s.totalCo2eKg)}
                    </div>
                    <div
                      style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--text-xs)' }}
                    >
                      <span style={{ color: 'var(--color-ink-3)' }}>
                        Scope 1:{' '}
                        <span
                          style={{
                            color: 'var(--color-ink-1)',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {formatKg(s.scope1Co2eKg)}
                        </span>
                      </span>
                      <span style={{ color: 'var(--color-ink-3)' }}>
                        Scope 2:{' '}
                        <span
                          style={{
                            color: 'var(--color-ink-1)',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {formatKg(s.scope2Co2eKg)}
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
