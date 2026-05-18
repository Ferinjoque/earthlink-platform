'use client';

import { useState, useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { exportCsv, type ExportCsvState } from '@/actions/reports';
import { Badge } from '@/components/ui/Badge';
import type { PeriodStatus } from '@/domain/ReportingPeriod';

export interface PeriodoExportable {
  id: string;
  label: string;
  supplier_name: string;
  status: PeriodStatus;
  totalCo2eKg: number;
  nResultados: number;
}

export interface ExportHistorial {
  id: string;
  format: string;
  generated_at: string;
  file_sha256: string;
  reporting_period_ids: string[];
}

interface ReportsPanelProps {
  periodos: PeriodoExportable[];
  historial: ExportHistorial[];
}

function formatearKg(kg: number): string {
  if (kg === 0) return '—';
  if (kg >= 1_000) return `${(kg / 1_000).toFixed(3)} tCO₂e`;
  return `${kg.toFixed(2)} kg`;
}

function variantEstado(
  status: PeriodStatus,
): 'open' | 'calculating' | 'under_review' | 'locked' | 'neutral' {
  if (status === 'under_review') return 'under_review';
  if (status === 'locked') return 'locked';
  return 'neutral';
}

function etiquetaEstado(status: PeriodStatus): string {
  if (status === 'under_review') return 'En revisión';
  if (status === 'locked') return 'Bloqueado';
  return status;
}

export function ReportsPanel({ periodos, historial }: ReportsPanelProps) {
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [state, formAction, isPending] = useActionState<ExportCsvState | null, FormData>(
    exportCsv,
    null,
  );
  const downloadRef = useRef<HTMLAnchorElement>(null);
  const router = useRouter();

  // Trigger download when CSV content is returned + refresh history
  useEffect(() => {
    if (state?.success && state.csvContent && state.filename) {
      const blob = new Blob([state.csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = downloadRef.current;
      if (a) {
        a.href = url;
        a.download = state.filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      }
      router.refresh();
    }
  }, [state, router]);

  function toggleSeleccion(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function seleccionarTodos() {
    setSeleccionados(new Set(periodos.map((p) => p.id)));
  }

  function limpiarSeleccion() {
    setSeleccionados(new Set());
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      {/* Hidden download anchor */}
      <a ref={downloadRef} style={{ display: 'none' }} aria-hidden="true" />

      {/* ── Periodos exportables ── */}
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
            Periodos disponibles para exportación
          </h2>
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-ink-3)',
              margin: 'var(--space-1) 0 0',
            }}
          >
            Periodos en revisión o bloqueados. Selecciona los que deseas incluir en el CSV.
          </p>
        </div>

        {periodos.length === 0 ? (
          <p
            style={{
              color: 'var(--color-ink-3)',
              fontSize: 'var(--text-sm)',
              fontFamily: 'var(--font-mono)',
              padding: 'var(--space-8) 0',
              textAlign: 'center',
            }}
          >
            No hay periodos exportables. Calcula y bloquea al menos un periodo desde auditoría.
          </p>
        ) : (
          <>
            {/* Acciones de selección */}
            <div
              style={{
                display: 'flex',
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-3)',
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <button type="button" onClick={seleccionarTodos} style={estiloBotonSecundario}>
                Seleccionar todos
              </button>
              {seleccionados.size > 0 && (
                <button type="button" onClick={limpiarSeleccion} style={estiloBotonSecundario}>
                  Limpiar selección
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
                {seleccionados.size} de {periodos.length} seleccionados
              </span>
            </div>

            {/* Tabla de periodos */}
            <div
              style={{
                background: 'var(--color-surface-1)',
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
                    {['', 'Proveedor', 'Periodo', 'Estado', 'CO₂e total', 'Registros'].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: 'left',
                          padding: 'var(--space-3) var(--space-4)',
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
                  {periodos.map((p) => (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        background: seleccionados.has(p.id)
                          ? 'oklch(58% 0.16 155 / 4%)'
                          : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 100ms',
                      }}
                      onClick={() => toggleSeleccion(p.id)}
                    >
                      <td style={{ padding: 'var(--space-3) var(--space-4)', width: '40px' }}>
                        <input
                          type="checkbox"
                          checked={seleccionados.has(p.id)}
                          onChange={() => toggleSeleccion(p.id)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ cursor: 'pointer', accentColor: 'var(--color-accent)' }}
                          aria-label={`Seleccionar ${p.label}`}
                        />
                      </td>
                      <td
                        style={{
                          padding: 'var(--space-3) var(--space-4)',
                          color: 'var(--color-ink-1)',
                          fontWeight: 500,
                        }}
                      >
                        {p.supplier_name}
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
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <Badge variant={variantEstado(p.status)}>{etiquetaEstado(p.status)}</Badge>
                      </td>
                      <td
                        style={{
                          padding: 'var(--space-3) var(--space-4)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'var(--text-xs)',
                          color: 'var(--color-ink-1)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatearKg(p.totalCo2eKg)}
                      </td>
                      <td
                        style={{
                          padding: 'var(--space-3) var(--space-4)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'var(--text-xs)',
                          color: 'var(--color-ink-3)',
                        }}
                      >
                        {p.nResultados}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Botón exportar */}
            <form action={formAction} style={{ marginTop: 'var(--space-4)' }}>
              <input type="hidden" name="period_ids" value={[...seleccionados].join(',')} />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-4)',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="submit"
                  disabled={isPending || seleccionados.size === 0}
                  style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: 600,
                    color: seleccionados.size === 0 ? 'var(--color-ink-3)' : 'white',
                    background:
                      seleccionados.size === 0
                        ? 'var(--color-surface-2)'
                        : isPending
                          ? 'var(--color-ink-3)'
                          : 'var(--color-accent)',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-3) var(--space-6)',
                    cursor: seleccionados.size === 0 || isPending ? 'default' : 'pointer',
                    transition: 'background 150ms',
                  }}
                >
                  {isPending
                    ? 'Generando…'
                    : `Exportar CSV${seleccionados.size > 0 ? ` (${seleccionados.size})` : ''}`}
                </button>

                {state?.success && state.sha256 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-signal-ok)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      Descarga iniciada — {state.filename}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        color: 'var(--color-ink-3)',
                        fontFamily: 'var(--font-mono)',
                        wordBreak: 'break-all',
                      }}
                    >
                      sha256: {state.sha256}
                    </span>
                  </div>
                )}

                {state?.error && (
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-signal-hi)',
                      fontFamily: 'var(--font-mono)',
                    }}
                    role="alert"
                  >
                    {state.error}
                  </span>
                )}
              </div>
            </form>
          </>
        )}
      </section>

      {/* ── Historial de exportaciones ── */}
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
            Historial de exportaciones
          </h2>
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-ink-3)',
              margin: 'var(--space-1) 0 0',
            }}
          >
            Registro de todos los archivos generados con verificación sha256.
          </p>
        </div>

        {historial.length === 0 ? (
          <p
            style={{
              color: 'var(--color-ink-3)',
              fontSize: 'var(--text-sm)',
              fontFamily: 'var(--font-mono)',
              padding: 'var(--space-6) 0',
              textAlign: 'center',
            }}
          >
            Aún no se han generado exportaciones.
          </p>
        ) : (
          <div
            style={{
              background: 'var(--color-surface-1)',
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
                  {['Generado', 'Formato', 'Periodos', 'sha256'].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        padding: 'var(--space-3) var(--space-4)',
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
                {historial.map((h) => (
                  <tr key={h.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-ink-2)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {new Date(h.generated_at).toLocaleString('es', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-ink-3)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {h.format}
                    </td>
                    <td
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-ink-3)',
                      }}
                    >
                      {h.reporting_period_ids.length}{' '}
                      {h.reporting_period_ids.length === 1 ? 'periodo' : 'periodos'}
                    </td>
                    <td
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        color: 'var(--color-ink-3)',
                        maxWidth: '260px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={h.file_sha256}
                    >
                      {h.file_sha256}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const estiloBotonSecundario: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  fontFamily: 'var(--font-mono)',
  color: 'var(--color-ink-2)',
  background: 'transparent',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  padding: '4px var(--space-3)',
  cursor: 'pointer',
};
