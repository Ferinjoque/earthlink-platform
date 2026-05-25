'use client';

import { Fragment, useState, useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Paperclip, FileText, Image } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { AnomalyBadge } from '@/components/activity/AnomalyBadge';
import { traducirMensajeAnomalia } from '@/lib/anomaly';
import { voidActivityEntry, type VoidEntryState } from '@/actions/activity';
import { useToast } from '@/components/ui/Toast';
import type { EvidenceFileView } from '@/actions/evidence';
import type { ActivityEntryStatus, AnomalySeverity, EmissionSourceType } from '@/types/database';

export interface ActivityEntryView {
  id: string;
  period_id: string;
  period_label: string;
  period_status?: string | undefined;
  source_type: string;
  raw_quantity: number;
  raw_unit: string;
  status: ActivityEntryStatus;
  submitted_at: string | null;
  notes: string | null;
  voided_at?: string | null;
  void_reason?: string | null;
  evidence_count?: number;
  evidence_files?: EvidenceFileView[];
  anomaly?:
    | {
        severity: AnomalySeverity;
        z_score: number | null;
        message: string;
      }
    | undefined;
}

interface PeriodoOption {
  id: string;
  label: string;
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
}

interface ActivityListProps {
  entries: ActivityEntryView[];
  periodos: PeriodoOption[];
  pagination?: PaginationInfo;
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

const CABECERAS = ['Periodo', 'Fuente', 'Cantidad', 'Estado', 'Anomalía / Motivo', 'Enviado', ''];

function iconoPorMime(mime: string) {
  if (mime.startsWith('image/')) return <Image size={11} aria-hidden="true" />;
  return <FileText size={11} aria-hidden="true" />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

const estiloSelect: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  fontFamily: 'var(--font-mono)',
  color: 'var(--color-ink-2)',
  background: 'var(--color-surface-0)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  padding: '4px var(--space-3)',
  cursor: 'pointer',
  outline: 'none',
  appearance: 'none',
  WebkitAppearance: 'none',
  paddingRight: 'var(--space-6)',
};

const estiloCelda: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-3)',
  color: 'var(--color-ink-1)',
};


function VoidEntryButton({ entryId }: { entryId: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<VoidEntryState | null, FormData>(
    voidActivityEntry,
    null,
  );

  useEffect(() => {
    if (state?.success) {
      toast('Registro anulado', 'success');
      router.refresh();
      setOpen(false);
    }
    if (state?.error) {
      toast(state.error, 'error');
    }
  }, [state?.success, state?.error, toast, router]);

  if (open) {
    return (
      <form
        action={formAction}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          minWidth: '180px',
        }}
      >
        <input type="hidden" name="entry_id" value={entryId} />
        <label
          htmlFor={`void-reason-${entryId}`}
          style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}
        >
          Motivo de anulacion
        </label>
        <input
          id={`void-reason-${entryId}`}
          name="void_reason"
          required
          placeholder="Motivo de anulación"
          autoFocus
          style={{
            fontSize: 'var(--text-xs)',
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-ink-2)',
            background: 'var(--color-surface-0)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '3px var(--space-2)',
            outline: 'none',
            width: '100%',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <button
            type="submit"
            disabled={isPending}
            style={{
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-signal-hi)',
              background: 'color-mix(in oklch, var(--color-signal-hi) 8%, transparent)',
              border: '1px solid color-mix(in oklch, var(--color-signal-hi) 25%, transparent)',
              borderRadius: 'var(--radius-md)',
              padding: '2px var(--space-3)',
              cursor: isPending ? 'default' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {isPending ? '…' : 'Anular'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-ink-3)',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '2px var(--space-2)',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="activity-void-btn"
      aria-label="Anular registro"
      style={{
        fontSize: 'var(--text-xs)',
        fontFamily: 'var(--font-mono)',
        color: 'var(--color-ink-3)',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '2px var(--space-2)',
        opacity: 0,
        transition: 'opacity 150ms',
        lineHeight: 1,
      }}
    >
      Anular
    </button>
  );
}


function EntradaFila({
  entry,
  expandida,
  toggleExpandida,
  setExpandida,
  expandidaEvidencia,
  setExpandidaEvidencia,
  isVoided,
}: {
  entry: ActivityEntryView;
  expandida: string | null;
  toggleExpandida: (id: string) => void;
  setExpandida: React.Dispatch<React.SetStateAction<string | null>>;
  expandidaEvidencia: string | null;
  setExpandidaEvidencia: React.Dispatch<React.SetStateAction<string | null>>;
  isVoided: boolean;
}) {
  const evidenceFiles = entry.evidence_files ?? [];
  const singleFile = evidenceFiles.length === 1 ? evidenceFiles[0] : null;
  return (
    <Fragment>
      <tr
        className="activity-row"
        style={{
          borderBottom:
            expandida === entry.id ? 'none' : '1px solid var(--color-border)',
          transition: 'background 100ms',
          opacity: isVoided ? 0.55 : 1,
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLTableRowElement).style.background =
            expandida === entry.id ? 'oklch(58% 0.16 155 / 4%)' : 'var(--color-surface-2)')
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLTableRowElement).style.background =
            expandida === entry.id ? 'oklch(58% 0.16 155 / 4%)' : 'transparent')
        }
      >
        <td style={estiloCelda}>{entry.period_label}</td>
        <td
          style={{
            ...estiloCelda,
            textDecoration: isVoided ? 'line-through' : 'none',
            color: isVoided ? 'var(--color-ink-3)' : 'var(--color-ink-1)',
          }}
        >
          {FUENTE_CORTA[entry.source_type] ?? entry.source_type}
        </td>
        <td
          style={{
            ...estiloCelda,
            fontFamily: 'var(--font-mono)',
            whiteSpace: 'nowrap',
            textDecoration: isVoided ? 'line-through' : 'none',
            color: isVoided ? 'var(--color-ink-3)' : 'var(--color-ink-1)',
          }}
        >
          {entry.raw_quantity.toLocaleString('es')} {entry.raw_unit}
        </td>
        <td style={estiloCelda}>
          {isVoided ? (
            <span
              style={{
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-mono)',
                color: 'var(--color-ink-3)',
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '2px var(--space-2)',
                whiteSpace: 'nowrap',
              }}
            >
              Anulado
            </span>
          ) : (
            <Badge variant={entry.status}>{ETIQUETAS_ESTADO[entry.status]}</Badge>
          )}
        </td>
        <td style={estiloCelda}>
          {entry.anomaly && !isVoided ? (
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
          ) : isVoided && entry.void_reason ? (
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--color-ink-3)',
                fontStyle: 'italic',
              }}
              title={entry.void_reason}
            >
              {entry.void_reason.length > 28
                ? `${entry.void_reason.slice(0, 28)}…`
                : entry.void_reason}
            </span>
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
        <td
          style={{
            ...estiloCelda,
            width: '80px',
            textAlign: 'right',
            paddingLeft: 'var(--space-2)',
            paddingRight: 'var(--space-3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
            {evidenceFiles.length > 0 && (
              singleFile ? (
                /* 1 archivo: enlace directo → abre en pestaña nueva */
                <a
                  href={singleFile.signedUrl ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${singleFile.original_name} · ${formatBytes(singleFile.file_size_bytes)}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-accent)',
                    textDecoration: 'none',
                  }}
                >
                  <Paperclip size={10} aria-hidden="true" />
                  1
                </a>
              ) : (
                /* N archivos: expande lista inline */
                <button
                  type="button"
                  onClick={() => {
                    setExpandida(null);
                    setExpandidaEvidencia((prev) => (prev === entry.id ? null : entry.id));
                  }}
                  aria-expanded={expandidaEvidencia === entry.id}
                  title={`${evidenceFiles.length} archivos adjuntos`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    color: expandidaEvidencia === entry.id ? 'var(--color-accent)' : 'var(--color-ink-3)',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                  }}
                >
                  <Paperclip size={10} aria-hidden="true" />
                  {evidenceFiles.length}
                </button>
              )
            )}
            {!isVoided && <VoidEntryButton entryId={entry.id} />}
          </div>
        </td>
      </tr>

      {/* ── Panel de evidencias expandible (N archivos) ── */}
      {expandidaEvidencia === entry.id && evidenceFiles.length > 1 && (
        <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
          <td
            colSpan={7}
            style={{
              padding: 'var(--space-3) var(--space-4) var(--space-4)',
              background: 'oklch(58% 0.16 155 / 3%)',
            }}
          >
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
              }}
            >
              {evidenceFiles.map((f) => (
                <li
                  key={f.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    fontSize: 'var(--text-xs)',
                  }}
                >
                  <span style={{ color: 'var(--color-accent)', flexShrink: 0 }}>
                    {iconoPorMime(f.mime_type)}
                  </span>
                  {f.signedUrl ? (
                    <a
                      href={f.signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: 'var(--color-ink-2)',
                        textDecoration: 'underline',
                        textDecorationColor: 'var(--color-border)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '240px',
                      }}
                    >
                      {f.original_name}
                    </a>
                  ) : (
                    <span style={{ color: 'var(--color-ink-3)' }}>{f.original_name}</span>
                  )}
                  <span style={{ color: 'var(--color-ink-3)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
                    {formatBytes(f.file_size_bytes)}
                  </span>
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}

      {/* ── Panel de anomalía expandible ── */}
      {expandida === entry.id && entry.anomaly && (
        <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
          <td
            colSpan={7}
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
                  {traducirMensajeAnomalia(entry.anomaly.message)}
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
  );
}


export function ActivityList({ entries, periodos, pagination }: ActivityListProps) {
  const [filtroEstado, setFiltroEstado] = useState<ActivityEntryStatus | 'todos'>('todos');
  const [filtroFuente, setFiltroFuente] = useState<EmissionSourceType | 'todos'>('todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState<string>('todos');
  const [expandida, setExpandida] = useState<string | null>(null);
  const [expandidaEvidencia, setExpandidaEvidencia] = useState<string | null>(null);
  const [mostrarAnulados, setMostrarAnulados] = useState(false);

  const activas = entries.filter((e) => !e.voided_at);
  const anuladas = entries.filter((e) => Boolean(e.voided_at));

  const hayFiltro =
    filtroEstado !== 'todos' || filtroFuente !== 'todos' || filtroPeriodo !== 'todos';

  const filtradas = activas.filter((e) => {
    if (filtroEstado !== 'todos' && e.status !== filtroEstado) return false;
    if (filtroFuente !== 'todos' && e.source_type !== filtroFuente) return false;
    if (filtroPeriodo !== 'todos' && e.period_id !== filtroPeriodo) return false;
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

        {periodos.length > 1 && (
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <select
              value={filtroPeriodo}
              onChange={(e) => setFiltroPeriodo(e.target.value)}
              style={estiloSelect}
              aria-label="Filtrar por periodo"
            >
              <option value="todos">Todos los periodos</option>
              {periodos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
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
        )}

        {hayFiltro && (
          <button
            type="button"
            onClick={() => {
              setFiltroEstado('todos');
              setFiltroFuente('todos');
              setFiltroPeriodo('todos');
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

        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-ink-3)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {filtradas.length} de {activas.length}
          </span>
          {anuladas.length > 0 && (
            <button
              type="button"
              aria-pressed={mostrarAnulados}
              onClick={() => setMostrarAnulados((v) => !v)}
              style={{
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-mono)',
                color: mostrarAnulados ? 'var(--color-ink-2)' : 'var(--color-ink-3)',
                background: mostrarAnulados ? 'var(--color-surface-2)' : 'transparent',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '2px var(--space-2)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {anuladas.length} anulado{anuladas.length > 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>

      {filtradas.length === 0 && (!mostrarAnulados || anuladas.length === 0) ? (
        <p
          style={{
            color: 'var(--color-ink-3)',
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-mono)',
            padding: 'var(--space-6) 0',
            textAlign: 'center',
          }}
        >
          {activas.length === 0
            ? 'Sin registros aún. Envía uno usando el formulario de arriba.'
            : 'Ningún registro coincide con los filtros.'}
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <style>{'.activity-row:hover .activity-void-btn { opacity: 1 !important; }'}</style>
          <table
            aria-label="Registros de actividad"
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
                <EntradaFila
                  key={entry.id}
                  entry={entry}
                  expandida={expandida}
                  toggleExpandida={toggleExpandida}
                  setExpandida={setExpandida}
                  expandidaEvidencia={expandidaEvidencia}
                  setExpandidaEvidencia={setExpandidaEvidencia}
                  isVoided={false}
                />
              ))}
              {mostrarAnulados &&
                anuladas.map((entry) => (
                  <EntradaFila
                    key={entry.id}
                    entry={entry}
                    expandida={expandida}
                    toggleExpandida={toggleExpandida}
                    setExpandida={setExpandida}
                    expandidaEvidencia={expandidaEvidencia}
                    setExpandidaEvidencia={setExpandidaEvidencia}
                    isVoided
                  />
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Paginación server-side ── */}
      {pagination && pagination.total > pagination.pageSize && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-3) var(--space-4)',
            borderTop: '1px solid var(--color-border)',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-ink-3)',
            }}
          >
            {((pagination.page - 1) * pagination.pageSize) + 1}
            {' – '}
            {Math.min(pagination.page * pagination.pageSize, pagination.total)}
            {' de '}
            {pagination.total}
          </span>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {pagination.page > 1 && (
              <Link
                href={`${pagination.basePath}?page=${pagination.page - 1}`}
                style={{
                  fontSize: 'var(--text-xs)',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--color-ink-2)',
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '3px var(--space-3)',
                  textDecoration: 'none',
                }}
              >
                Anterior
              </Link>
            )}
            {pagination.page * pagination.pageSize < pagination.total && (
              <Link
                href={`${pagination.basePath}?page=${pagination.page + 1}`}
                style={{
                  fontSize: 'var(--text-xs)',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--color-ink-2)',
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '3px var(--space-3)',
                  textDecoration: 'none',
                }}
              >
                Siguiente
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
