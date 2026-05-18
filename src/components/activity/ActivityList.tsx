'use client';

import { Badge } from '@/components/ui/Badge';
import { AnomalyBadge } from '@/components/activity/AnomalyBadge';
import type { ActivityEntryStatus, AnomalySeverity } from '@/types/database';

export interface ActivityEntryView {
  id: string;
  period_label: string;
  source_type: string;
  raw_quantity: number;
  raw_unit: string;
  status: ActivityEntryStatus;
  submitted_at: string | null;
  notes: string | null;
  anomaly?:
    | {
        severity: AnomalySeverity;
        z_score: number | null;
        message: string;
      }
    | undefined;
}

interface ActivityListProps {
  entries: ActivityEntryView[];
}

const STATUS_LABELS: Record<ActivityEntryStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  validated: 'Validated',
  rejected: 'Rejected',
};

const SOURCE_SHORT: Record<string, string> = {
  stationary_combustion: 'Stationary',
  mobile_combustion: 'Mobile',
  purchased_electricity: 'Electricity',
  purchased_steam: 'Steam',
  fugitive: 'Fugitive',
};

export function ActivityList({ entries }: ActivityListProps) {
  if (entries.length === 0) {
    return (
      <p
        style={{
          color: 'var(--color-ink-3)',
          fontSize: 'var(--text-sm)',
          fontFamily: 'var(--font-mono)',
          padding: 'var(--space-6) 0',
          textAlign: 'center',
        }}
      >
        No activity entries yet. Submit one using the form above.
      </p>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 'var(--text-sm)',
        }}
      >
        <thead>
          <tr>
            {['Period', 'Source', 'Quantity', 'Status', 'Anomaly', 'Submitted'].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: 'left',
                  padding: 'var(--space-2) var(--space-3)',
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
          {entries.map((entry) => (
            <tr
              key={entry.id}
              style={{
                borderBottom: '1px solid var(--color-border)',
                transition: 'background 100ms',
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLTableRowElement).style.background =
                  'var(--color-surface-2)')
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLTableRowElement).style.background = 'transparent')
              }
            >
              <td style={cellStyle}>{entry.period_label}</td>
              <td style={cellStyle}>{SOURCE_SHORT[entry.source_type] ?? entry.source_type}</td>
              <td
                style={{
                  ...cellStyle,
                  fontFamily: 'var(--font-mono)',
                  whiteSpace: 'nowrap',
                }}
              >
                {entry.raw_quantity.toLocaleString()} {entry.raw_unit}
              </td>
              <td style={cellStyle}>
                <Badge variant={entry.status}>{STATUS_LABELS[entry.status]}</Badge>
              </td>
              <td style={cellStyle}>
                {entry.anomaly ? (
                  <AnomalyBadge
                    severity={entry.anomaly.severity}
                    zScore={entry.anomaly.z_score ?? undefined}
                  />
                ) : (
                  <span style={{ color: 'var(--color-ink-3)', fontSize: 'var(--text-xs)' }}>—</span>
                )}
              </td>
              <td
                style={{
                  ...cellStyle,
                  color: 'var(--color-ink-3)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-xs)',
                  whiteSpace: 'nowrap',
                }}
              >
                {entry.submitted_at ? new Date(entry.submitted_at).toLocaleDateString() : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-3)',
  color: 'var(--color-ink-1)',
};
