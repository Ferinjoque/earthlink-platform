'use client';

import { Fragment, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { AnomalyBadge } from '@/components/activity/AnomalyBadge';
import type { ActivityEntryStatus, AnomalySeverity, EmissionSourceType } from '@/types/database';

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

const ETIQUETAS_SEVERIDAD: Record<AnomalySeverity, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
};

const COLOR_SEVERIDAD: Record<AnomalySeverity, string> = {
  low: 'var(--color-signal-ok)',
  medium: 'var(--color-signal-md)',
  high: 'var(--color-signal-hi)',
};

const CABECERAS = ['Periodo', 'Fuente', 'Cantidad', 'Estado', 'Anomalía', 'Enviado'];

const estiloSelect: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  fontFamily: 'var(--font-mono)',
  color: 'var(--color-ink-2)',
  background: 'var(--color-surface-2)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  padding: '4px var(--space-3)',
  cursor: 'pointer',
  outline: 'none',
  appearance: 'none',
  WebkitAppearance: 'none',
  paddingRight: 'var(--space-6)',
};

export function ActivityList({ entries }: ActivityListProps) {
  const [filtroEstado, setFiltroEstado] = useState<ActivityEntryStatus | 'todos'>('todos');
  const [filtroFuente, setFiltroFuente] = useState<EmissionSourceType | 'todos'>('todos');
  const [expandida, setExpandida] = useState<string | null>(null);

  const hayFiltro = filtroEstado !== 'todos' || filtroFuente !== 'todos';

  const filtradas = entries.filter((e) => {
    if (filtroEstado !== 'todos' && e.status !== filtroEstado) return false;
    if (filtroFuente !== 'todos' && e.source_type !== filtroFuente) return false;
    return true;
  });

  function toggleExpandida(id: string) {
    setExpandida((prev) => (prev === id ? null : id));
  }

  return (
    <div>
      {/* ── Barra de filtros ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          padding: '0 var(--space-4) var(--space-3)',
          borderBottom: '1px solid var(--color-border)',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-ink-3)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          Filtrar:
        </span>

        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as ActivityEntryStatus | 'todos')}
            style={estiloSelect}
            aria-label="Filtrar por estado"
          >
            <option value="todos">Todos los estados</option>
            <option value="draft">Borrador</option>
            <option value="submitted">Enviado</option>
            <option value="validated">Validado</option>
            <option value="rejected">Rechazado</option>
          </select>
          <span
            style={{
              position: 'absolute',
              right: 'var(--space-2)',
              pointerEvents: 'none',
              color: 'var(--color-ink-3)',
              fontSize: '10px',
            }}
          >
            ▾
          </span>
        </div>

        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <select
            value={filtroFuente}
            onChange={(e) => setFiltroFuente(e.target.value as EmissionSourceType | 'todos')}
            style={estiloSelect}
            aria-label="Filtrar por fuente"
          >
            <option value="todos">Todas las fuentes</option>
            <option value="stationary_combustion">Estacionaria</option>
            <option value="mobile_combustion">Móvil</option>
            <option value="purchased_electricity">Electricidad</option>
            <option value="purchased_steam">Vapor</option>
            <option value="fugitive">Fugitiva</option>
          </select>
          <span
            style={{
              position: 'absolute',
              right: 'var(--space-2)',
              pointerEvents: 'none',
              color: 'var(--color-ink-3)',
              fontSize: '10px',
            }}
          >
            ▾
          </span>
        </div>

        {hayFiltro && (
          <button
            type="button"
            onClick={() => {
              setFiltroEstado('todos');
              setFiltroFuente('todos');
            }}
            style={{
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-ink-3)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '2px var(--space-2)',
              textDecoration: 'underline',
            }}
          >
            Limpiar
          </button>
        )}

        <span
          style={{
            marginLeft: 'auto',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-ink-3)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {filtradas.length} de {entries.length}
        </span>
      </div>

      {filtradas.length === 0 ? (
        <p
          style={{
            color: 'var(--color-ink-3)',
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-mono)',
            padding: 'var(--space-6) 0',
            textAlign: 'center',
          }}
        >
          {entries.length === 0
            ? 'Sin registros aún. Envía uno usando el formulario de arriba.'
            : 'Ningún registro coincide con los filtros.'}
        </p>
      ) : (
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
              {filtradas.map((entry) => (
                <Fragment key={entry.id}>
                  <tr
                    style={{
                      borderBottom:
                        expandida === entry.id ? 'none' : '1px solid var(--color-border)',
                      transition: 'background 100ms',
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLTableRowElement).style.background =
                        expandida === entry.id
                          ? 'oklch(58% 0.16 155 / 4%)'
                          : 'var(--color-surface-2)')
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLTableRowElement).style.background =
                        expandida === entry.id ? 'oklch(58% 0.16 155 / 4%)' : 'transparent')
                    }
                  >
                    <td style={estiloCelda}>{entry.period_label}</td>
                    <td style={estiloCelda}>
                      {FUENTE_CORTA[entry.source_type] ?? entry.source_type}
                    </td>
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
                        <button
                          type="button"
                          onClick={() => toggleExpandida(entry.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            display: 'inline-flex',
                          }}
                          aria-expanded={expandida === entry.id}
                          aria-label={`Ver detalle anomalía ${ETIQUETAS_SEVERIDAD[entry.anomaly.severity]}`}
                        >
                          <AnomalyBadge
                            severity={entry.anomaly.severity}
                            zScore={entry.anomaly.z_score ?? undefined}
                          />
                        </button>
                      ) : (
                        <span style={{ color: 'var(--color-ink-3)', fontSize: 'var(--text-xs)' }}>
                          —
                        </span>
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

                  {/* ── Panel de anomalía expandible ── */}
                  {expandida === entry.id && entry.anomaly && (
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td
                        colSpan={6}
                        style={{
                          padding: 'var(--space-3) var(--space-4) var(--space-4)',
                          background: 'oklch(58% 0.16 155 / 4%)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 'var(--space-6)',
                            flexWrap: 'wrap',
                          }}
                        >
                          <div>
                            <p
                              style={{
                                fontSize: 'var(--text-xs)',
                                color: 'var(--color-ink-3)',
                                fontFamily: 'var(--font-mono)',
                                margin: '0 0 2px',
                              }}
                            >
                              Severidad
                            </p>
                            <span
                              style={{
                                fontSize: 'var(--text-sm)',
                                fontWeight: 600,
                                color: COLOR_SEVERIDAD[entry.anomaly.severity],
                              }}
                            >
                              {ETIQUETAS_SEVERIDAD[entry.anomaly.severity]}
                            </span>
                          </div>

                          {entry.anomaly.z_score !== null && (
                            <div>
                              <p
                                style={{
                                  fontSize: 'var(--text-xs)',
                                  color: 'var(--color-ink-3)',
                                  fontFamily: 'var(--font-mono)',
                                  margin: '0 0 2px',
                                }}
                              >
                                Z-score
                              </p>
                              <span
                                style={{
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: 'var(--text-sm)',
                                  fontWeight: 700,
                                  color: 'var(--color-ink-1)',
                                }}
                              >
                                {entry.anomaly.z_score.toFixed(2)}
                              </span>
                            </div>
                          )}

                          <div style={{ flex: 1, minWidth: '200px' }}>
                            <p
                              style={{
                                fontSize: 'var(--text-xs)',
                                color: 'var(--color-ink-3)',
                                fontFamily: 'var(--font-mono)',
                                margin: '0 0 2px',
                              }}
                            >
                              Detalle
                            </p>
                            <p
                              style={{
                                fontSize: 'var(--text-sm)',
                                color: 'var(--color-ink-2)',
                                margin: 0,
                              }}
                            >
                              {entry.anomaly.message}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => setExpandida(null)}
                            style={{
                              fontSize: 'var(--text-xs)',
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--color-ink-3)',
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              alignSelf: 'flex-start',
                              padding: '2px var(--space-2)',
                            }}
                            aria-label="Cerrar detalle de anomalía"
                          >
                            Cerrar ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const estiloCelda: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-3)',
  color: 'var(--color-ink-1)',
};
