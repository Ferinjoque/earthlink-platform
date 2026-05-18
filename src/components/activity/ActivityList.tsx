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

const ETIQUETAS_ESTADO: Record<ActivityEntryStatus, string> = {
  draft: 'Borrador',
  submitted: 'Enviado',
  validated: 'Validado',
  rejected: 'Rechazado',
};

const FUENTE_CORTA: Record<string, string> = {
  stationary_combustion: 'Estacionaria',
  mobile_combustion: 'Móvil',
  purchased_electricity: 'Electricidad',
  purchased_steam: 'Vapor',
  fugitive: 'Fugitiva',
};

const CABECERAS = ['Periodo', 'Fuente', 'Cantidad', 'Estado', 'Anomalía', 'Enviado'];

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
        Sin registros aún. Envía uno usando el formulario de arriba.
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
            {CABECERAS.map((h) => (
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
              <td style={estiloCelda}>{entry.period_label}</td>
              <td style={estiloCelda}>{FUENTE_CORTA[entry.source_type] ?? entry.source_type}</td>
              <td
                style={{
                  ...estiloCelda,
                  fontFamily: 'var(--font-mono)',
                  whiteSpace: 'nowrap',
                }}
              >
                {entry.raw_quantity.toLocaleString('es')} {entry.raw_unit}
              </td>
              <td style={estiloCelda}>
                <Badge variant={entry.status}>{ETIQUETAS_ESTADO[entry.status]}</Badge>
              </td>
              <td style={estiloCelda}>
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
                  ...estiloCelda,
                  color: 'var(--color-ink-3)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-xs)',
                  whiteSpace: 'nowrap',
                }}
              >
                {entry.submitted_at
                  ? new Date(entry.submitted_at).toLocaleDateString('es')
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const estiloCelda: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-3)',
  color: 'var(--color-ink-1)',
};
