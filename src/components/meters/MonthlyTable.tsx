import type { MeterYearSummary } from '@/lib/meters';
import { MONTH_LABELS, formatQuantity } from '@/lib/meters';

interface MonthlyTableProps {
  summary: MeterYearSummary;
}

export function MonthlyTable({ summary }: MonthlyTableProps) {
  const maxVal = Math.max(...[...Object.values(summary.monthly), 1]);

  return (
    <>
      <style>{`.mt-row:hover { background: var(--color-surface-2) !important; }`}</style>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--color-surface-2)' }}>
            {(['Mes', 'Cantidad', ''] as const).map((h, i) => (
              <th
                key={i}
                style={{
                  padding: '7px 16px',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  color: 'var(--color-ink-2)',
                  textAlign: i === 1 ? 'right' : 'left',
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
          {Array.from({ length: 12 }, (_, i) => {
            const m = i + 1;
            const val = summary.monthly[m] ?? 0;
            const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
            const isPeak = summary.peak?.month === m;

            return (
              <tr
                key={m}
                className="mt-row"
                style={{
                  borderBottom: '1px solid var(--color-border)',
                  background: isPeak ? 'var(--color-accent-soft)' : 'transparent',
                }}
              >
                <td
                  style={{
                    padding: '7px 16px',
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-mono)',
                    color: isPeak ? 'var(--color-accent)' : 'var(--color-ink-1)',
                    fontWeight: isPeak ? 600 : 400,
                    width: '80px',
                  }}
                >
                  {MONTH_LABELS[i]}
                </td>
                <td
                  style={{
                    padding: '7px 16px',
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-mono)',
                    color: val > 0 ? 'var(--color-ink-1)' : 'var(--color-ink-3)',
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                    width: '160px',
                  }}
                >
                  {val > 0 ? formatQuantity(val, summary.meter.unit) : '—'}
                </td>
                <td style={{ padding: '7px 16px' }}>
                  {val > 0 && (
                    <div
                      style={{
                        background: 'var(--color-surface-2)',
                        borderRadius: 'var(--radius-pill)',
                        height: '4px',
                        width: '100%',
                        minWidth: '80px',
                      }}
                    >
                      <div
                        style={{
                          background: isPeak
                            ? 'var(--color-accent)'
                            : 'oklch(58% 0.16 155 / 55%)',
                          borderRadius: 'var(--radius-pill)',
                          height: '100%',
                          width: `${pct}%`,
                          transition: 'width 400ms var(--ease-out-expo)',
                        }}
                      />
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
