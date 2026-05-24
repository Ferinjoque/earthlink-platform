'use client';

import { useState, useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { exportCsv, type ExportCsvState } from '@/actions/reports';
import { Badge } from '@/components/ui/Badge';
import { PrintButton } from '@/components/ui/PrintButton';
import { variantEstadoPeriodo, etiquetaEstadoPeriodo } from '@/lib/reporting-period';
import { formatearKg } from '@/lib/format';
import type { PeriodStatus } from '@/domain/ReportingPeriod';

export interface PeriodoExportable {
  id: string;
  label: string;
  supplier_name: string;
  status: PeriodStatus;
  totalCo2eKg: number;
  scope1Kg: number;
  scope2Kg: number;
  nResultados: number;
  year: number;
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
  orgName: string;
}


function groupByYear(periodos: PeriodoExportable[]): Map<number, PeriodoExportable[]> {
  const map = new Map<number, PeriodoExportable[]>();
  for (const p of periodos) {
    const arr = map.get(p.year) ?? [];
    arr.push(p);
    map.set(p.year, arr);
  }
  // Ordenar años de más reciente a más antiguo
  return new Map([...map.entries()].sort((a, b) => b[0] - a[0]));
}

function sumarPeriodos(periodos: PeriodoExportable[]): {
  totalCo2eKg: number;
  scope1Kg: number;
  scope2Kg: number;
  nProveedores: number;
} {
  const proveedores = new Set<string>();
  let totalCo2eKg = 0;
  let scope1Kg = 0;
  let scope2Kg = 0;
  for (const p of periodos) {
    totalCo2eKg += p.totalCo2eKg;
    scope1Kg += p.scope1Kg;
    scope2Kg += p.scope2Kg;
    proveedores.add(p.supplier_name);
  }
  return { totalCo2eKg, scope1Kg, scope2Kg, nProveedores: proveedores.size };
}


export function ReportsPanel({ periodos, historial, orgName }: ReportsPanelProps) {
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [colapsados, setColapsados] = useState<Set<number>>(new Set());
  const [summaryMounted, setSummaryMounted] = useState(false);
  const [summaryIn, setSummaryIn] = useState(false);
  const [state, formAction, isPending] = useActionState<ExportCsvState | null, FormData>(
    exportCsv,
    null,
  );
  const downloadRef = useRef<HTMLAnchorElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (seleccionados.size > 0) {
      setSummaryMounted(true);
      const t = setTimeout(() => setSummaryIn(true), 16);
      return () => clearTimeout(t);
    } else {
      setSummaryIn(false);
      const t = setTimeout(() => setSummaryMounted(false), 320);
      return () => clearTimeout(t);
    }
  }, [seleccionados.size]);

  const fechaHoy = new Date().toLocaleDateString('es', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Disparar descarga cuando el CSV vuelve del servidor y refrescar historial
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

  function toggleAnio(year: number, ids: string[]) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      const todosSeleccionados = ids.every((id) => next.has(id));
      if (todosSeleccionados) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function toggleColapso(year: number) {
    setColapsados((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  }

  function limpiarSeleccion() {
    setSeleccionados(new Set());
  }

  const gruposPorAnio = groupByYear(periodos);

  // Estadísticas anuales de los periodos seleccionados
  const seleccionadosList = periodos.filter((p) => seleccionados.has(p.id));
  const statsSeleccion = sumarPeriodos(seleccionadosList);

  // Detectar si todos los periodos son del mismo año (para el nombre del archivo)
  const aniosSeleccionados = [...new Set(seleccionadosList.map((p) => p.year))];
  const anioUnico: number | null =
    aniosSeleccionados.length === 1 && aniosSeleccionados[0] !== undefined
      ? aniosSeleccionados[0]
      : null;

  // sha256 del último export para pie de página en impresión
  const ultimoSha = state?.success && state.sha256 ? state.sha256 : (historial[0]?.file_sha256 ?? null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      {/* Print styles */}
      <style>{`
        @media print {
          @page { margin: 18mm 20mm; }
          .reports-print-header { display: block !important; }
          .reports-print-footer { display: block !important; }
          [data-no-print] { display: none !important; }
          .reports-historial { display: none !important; }
          .reports-table-wrap {
            border: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
          }
          .reports-table {
            table-layout: auto !important;
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 8pt !important;
          }
          .reports-table thead { display: table-header-group !important; }
          .reports-table th,
          .reports-table td {
            border: 1px solid #ccc !important;
            color: #000 !important;
            background: transparent !important;
            padding: 4pt 6pt !important;
            font-size: 8pt !important;
          }
          .reports-table thead th {
            background: #f0f0f0 !important;
            font-weight: 700 !important;
          }
          .reports-table tr { page-break-inside: avoid; }
          .reports-summary-cards { display: none !important; }
          .reports-year-group { page-break-inside: avoid; margin-top: 16pt; }
          .reports-year-group + .reports-year-group { margin-top: 24pt; }
          .reports-year-heading {
            font-size: 11pt !important;
            font-weight: 700 !important;
            color: #000 !important;
            border-bottom: 1.5px solid #000 !important;
            padding-bottom: 4pt !important;
            margin-bottom: 8pt !important;
          }
          .reports-checkbox-col { display: none !important; }
          .reports-actions-row { display: none !important; }
          .rp-year-content { grid-template-rows: 1fr !important; }
        }

        .reports-print-header { display: none; }
        .reports-print-footer { display: none; }

        .reports-row-hover:hover { background: var(--color-surface-2) !important; }
        .reports-row-selected { background: oklch(58% 0.16 155 / 4%) !important; }

        .reports-year-toggle:hover { color: var(--color-ink-1) !important; }
        .reports-collapse-btn:hover { opacity: 0.7; }

        /* Animación colapso/expansión vía filas de grid CSS */
        .rp-year-content {
          display: grid;
          grid-template-rows: 1fr;
          transition: grid-template-rows 240ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        .rp-year-content--collapsed {
          grid-template-rows: 0fr;
        }
        .rp-year-inner {
          overflow: hidden;
        }

        /* (summary card uses inline transition — no CSS animation needed) */
      `}</style>

      {/* Hidden download anchor */}
      <a ref={downloadRef} style={{ display: 'none' }} aria-hidden="true" />

      {/* ── Print-only cover page ── */}
      <div className="reports-print-header" aria-hidden="true">
        <div style={{ pageBreakAfter: 'always', display: 'flex', flexDirection: 'column', minHeight: '240mm', justifyContent: 'space-between', padding: '0 0 16pt' }}>
          {/* Wordmark */}
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9pt', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#333', margin: '0 0 6pt', fontWeight: 700 }}>
              EarthLink
            </p>
            <div style={{ width: '32pt', height: '1.5pt', background: '#000', margin: '0 0 0' }} />
          </div>

          {/* Main title block */}
          <div style={{ padding: '0' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '7pt', color: '#999', margin: '0 0 14pt', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Protocolo GHG · Alcances 1 y 2
            </p>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '34pt', fontWeight: 400, fontStyle: 'italic', margin: '0 0 20pt', letterSpacing: '-0.025em', lineHeight: 1.08, color: '#000' }}>
              Inventario de Gases<br />de Efecto Invernadero
            </h1>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13pt', color: '#111', margin: '0 0 3pt', fontWeight: 600, letterSpacing: '-0.01em' }}>
              {orgName}
            </p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9pt', color: '#666', margin: 0 }}>
              {(() => {
                const anios = [...new Set(periodos.map((p) => p.year))].sort();
                const rango = anios.length === 1 ? `Año ${anios[0]}` : anios.length > 1 ? `${anios[0]}–${anios[anios.length - 1]}` : '';
                return rango ? `${rango} · Generado el ${fechaHoy}` : `Generado el ${fechaHoy}`;
              })()}
            </p>
          </div>

          {/* Stats strip */}
          {(() => {
            const statsPortada = seleccionados.size > 0 ? statsSeleccion : sumarPeriodos(periodos);
            const nPeriodos = seleccionados.size > 0 ? seleccionados.size : periodos.length;
            if (statsPortada.totalCo2eKg === 0 && nPeriodos === 0) return null;
            return (
              <div style={{ borderTop: '1.5pt solid #000', borderBottom: '0.5pt solid #ccc', padding: '12pt 0 10pt', display: 'flex', gap: '0', flexWrap: 'wrap' }}>
                {[
                  { label: 'Total CO₂e', value: formatearKg(statsPortada.totalCo2eKg) },
                  { label: 'Alcance 1', value: formatearKg(statsPortada.scope1Kg) },
                  { label: 'Alcance 2', value: formatearKg(statsPortada.scope2Kg) },
                  { label: 'Periodos', value: String(nPeriodos) },
                  { label: 'Proveedores', value: String(statsPortada.nProveedores) },
                ].map((kpi) => (
                  <div key={kpi.label} style={{ marginRight: '28pt', marginBottom: '4pt' }}>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '6.5pt', color: '#999', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2pt' }}>
                      {kpi.label}
                    </p>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13pt', fontWeight: 700, color: '#000', margin: 0 }}>
                      {kpi.value}
                    </p>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Footer: integrity */}
          <div style={{ borderTop: '0.5pt solid #e8e8e8', paddingTop: '6pt' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '6pt', color: '#bbb', margin: 0 }}>
              Generado por EarthLink · {fechaHoy}
              {ultimoSha ? ` · sha256: ${ultimoSha}` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* ── Periodos exportables ── */}
      <section>
        <div data-no-print style={{ marginBottom: 'var(--space-4)' }}>
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
            Periodos en revisión o bloqueados, agrupados por año. Selecciona los que deseas incluir.
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
            {/* ── Resumen de selección — animated mount/unmount ── */}
            {summaryMounted && (
              <div
                style={{
                  overflow: 'hidden',
                  maxHeight: summaryIn ? '72px' : '0px',
                  opacity: summaryIn ? 1 : 0,
                  transform: summaryIn ? 'translateY(0)' : 'translateY(-8px)',
                  marginBottom: summaryIn ? 'var(--space-4)' : '0px',
                  transition: 'max-height 320ms cubic-bezier(0.22,1,0.36,1), opacity 280ms ease, transform 280ms ease, margin-bottom 320ms ease',
                }}
              >
                <div
                  className="reports-summary-cards"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-4)',
                    padding: 'var(--space-3) var(--space-4)',
                    background: 'var(--color-surface-2)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{
                    fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', fontWeight: 700,
                    background: 'var(--color-accent-soft)', color: 'var(--color-accent)',
                    padding: '2px var(--space-2)', borderRadius: 'var(--radius-sm)',
                    whiteSpace: 'nowrap',
                  }}>
                    {seleccionados.size} {seleccionados.size === 1 ? 'periodo' : 'periodos'}
                  </span>
                  <div style={{ width: '1px', height: '24px', background: 'var(--color-border)', flexShrink: 0 }} />
                  <SummaryKpi label="Total CO₂e" value={formatearKg(statsSeleccion.totalCo2eKg)} />
                  <SummaryKpi label="Alcance 1" value={formatearKg(statsSeleccion.scope1Kg)} color="var(--color-accent)" />
                  <SummaryKpi label="Alcance 2" value={formatearKg(statsSeleccion.scope2Kg)} color="var(--color-scope2)" />
                  <div style={{ width: '1px', height: '24px', background: 'var(--color-border)', flexShrink: 0 }} />
                  <SummaryKpi label="Proveedores" value={String(statsSeleccion.nProveedores)} />
                  <button
                    type="button"
                    onClick={limpiarSeleccion}
                    style={{
                      marginLeft: 'auto', fontSize: '10px', fontFamily: 'var(--font-mono)',
                      color: 'var(--color-ink-3)', background: 'transparent', border: 'none',
                      cursor: 'pointer', padding: '2px var(--space-2)', flexShrink: 0,
                    }}
                  >
                    Limpiar ×
                  </button>
                </div>
              </div>
            )}

            {/* Contador de selección */}
            <div
              className="reports-actions-row"
              data-no-print
              style={{ marginBottom: 'var(--space-3)' }}
            >
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-3)', fontFamily: 'var(--font-mono)' }}>
                {seleccionados.size} de {periodos.length} periodos seleccionados
              </span>
            </div>

            {/* ── Grupos por año ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              {[...gruposPorAnio.entries()].map(([year, periodosAnio]) => {
                const idsAnio = periodosAnio.map((p) => p.id);
                const todosSeleccionados = idsAnio.every((id) => seleccionados.has(id));
                const algunoSeleccionado = idsAnio.some((id) => seleccionados.has(id));
                const colapsado = colapsados.has(year);
                const resumenAnio = sumarPeriodos(periodosAnio);

                return (
                  <div key={year} className="reports-year-group">
                    {/* Cabecera del año */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                        marginBottom: 'var(--space-3)',
                        paddingBottom: 'var(--space-2)',
                        borderBottom: '1px solid var(--color-border)',
                      }}
                    >
                      <h3
                        className="reports-year-heading"
                        style={{
                          fontFamily: 'var(--font-serif)',
                          fontStyle: 'italic',
                          fontSize: 'var(--text-lg)',
                          fontWeight: 400,
                          color: 'var(--color-ink-1)',
                          margin: 0,
                          letterSpacing: '-0.02em',
                        }}
                      >
                        {year}
                      </h3>
                      <span
                        style={{
                          fontSize: 'var(--text-xs)',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--color-ink-3)',
                        }}
                      >
                        {formatearKg(resumenAnio.totalCo2eKg)} ·{' '}
                        {periodosAnio.length}{' '}
                        {periodosAnio.length === 1 ? 'periodo' : 'periodos'} ·{' '}
                        {resumenAnio.nProveedores}{' '}
                        {resumenAnio.nProveedores === 1 ? 'proveedor' : 'proveedores'}
                      </span>

                      {/* Seleccionar año (screen only) */}
                      <button
                        type="button"
                        data-no-print
                        onClick={() => toggleAnio(year, idsAnio)}
                        className="reports-year-toggle"
                        style={{
                          marginLeft: 'auto',
                          fontSize: 'var(--text-xs)',
                          fontFamily: 'var(--font-mono)',
                          color: algunoSeleccionado
                            ? 'var(--color-accent)'
                            : 'var(--color-ink-3)',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '2px var(--space-2)',
                          transition: 'color 120ms',
                        }}
                      >
                        {todosSeleccionados ? 'Deseleccionar año' : 'Seleccionar año'}
                      </button>

                      {/* Colapsar (screen only) */}
                      <button
                        type="button"
                        data-no-print
                        onClick={() => toggleColapso(year)}
                        className="reports-collapse-btn"
                        style={{
                          fontSize: 'var(--text-xs)',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--color-ink-3)',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '2px var(--space-2)',
                          transition: 'opacity 120ms',
                        }}
                        aria-label={colapsado ? `Expandir ${year}` : `Colapsar ${year}`}
                      >
                        {colapsado ? '+ mostrar' : '- ocultar'}
                      </button>
                    </div>

                    {/* Tabla de periodos del año — siempre montada, colapsada via CSS */}
                    <div className={`rp-year-content${colapsado ? ' rp-year-content--collapsed' : ''}`}>
                      <div className="rp-year-inner">
                        <div
                          className="reports-table-wrap"
                          style={{
                            background: 'var(--color-surface-1)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-lg)',
                            overflowX: 'auto',
                          }}
                        >
                          <table
                            className="reports-table"
                            style={{
                              width: '100%',
                              borderCollapse: 'collapse',
                              fontSize: 'var(--text-sm)',
                            }}
                          >
                            <thead>
                              <tr>
                                <th
                                  className="reports-checkbox-col"
                                  data-no-print
                                  style={estiloTh}
                                />
                                {['Proveedor', 'Periodo', 'Estado', 'Alcance 1', 'Alcance 2', 'CO₂e total', 'Registros'].map((h) => (
                                  <th key={h} style={estiloTh}>
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {periodosAnio.map((p) => (
                                <tr
                                  key={p.id}
                                  className={`reports-row-hover${seleccionados.has(p.id) ? ' reports-row-selected' : ''}`}
                                  style={{
                                    borderBottom: '1px solid var(--color-border)',
                                    cursor: 'pointer',
                                    transition: 'background 100ms',
                                  }}
                                  onClick={() => toggleSeleccion(p.id)}
                                >
                                  <td
                                    className="reports-checkbox-col"
                                    data-no-print
                                    style={{ padding: 'var(--space-3) var(--space-4)', width: '40px' }}
                                  >
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
                                    <Badge variant={variantEstadoPeriodo(p.status)}>
                                      {etiquetaEstadoPeriodo(p.status)}
                                    </Badge>
                                  </td>
                                  <td
                                    style={{
                                      padding: 'var(--space-3) var(--space-4)',
                                      fontFamily: 'var(--font-mono)',
                                      fontSize: 'var(--text-xs)',
                                      color: 'var(--color-accent)',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {p.scope1Kg > 0 ? formatearKg(p.scope1Kg) : '—'}
                                  </td>
                                  <td
                                    style={{
                                      padding: 'var(--space-3) var(--space-4)',
                                      fontFamily: 'var(--font-mono)',
                                      fontSize: 'var(--text-xs)',
                                      color: 'var(--color-scope2)',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {p.scope2Kg > 0 ? formatearKg(p.scope2Kg) : '—'}
                                  </td>
                                  <td
                                    style={{
                                      padding: 'var(--space-3) var(--space-4)',
                                      fontFamily: 'var(--font-mono)',
                                      fontSize: 'var(--text-xs)',
                                      color: 'var(--color-ink-1)',
                                      fontWeight: 600,
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
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Acciones de exportación ── */}
            <form action={formAction} data-no-print style={{ marginTop: 'var(--space-5)' }}>
              <input type="hidden" name="period_ids" value={[...seleccionados].join(',')} />
              {anioUnico !== null && (
                <input type="hidden" name="year" value={anioUnico.toString()} />
              )}
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
                <PrintButton
                  style={{
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-ink-2)',
                    background: 'transparent',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-3) var(--space-5)',
                    cursor: 'pointer',
                  }}
                >
                  Imprimir / PDF
                </PrintButton>

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
      <section className="reports-historial">
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
                    <th key={h} style={estiloTh}>
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

      {/* ── Print-only footer ── */}
      <div
        className="reports-print-footer"
        aria-hidden="true"
        style={{
          borderTop: '1px solid #ccc',
          paddingTop: '8pt',
          marginTop: '16pt',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '7pt',
            color: '#888',
            margin: 0,
          }}
        >
          Generado por EarthLink · {fechaHoy}
          {ultimoSha ? ` · sha256: ${ultimoSha}` : ''}
        </p>
      </div>
    </div>
  );
}


function SummaryKpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flexShrink: 0 }}>
      <span style={{ fontSize: '9px', color: 'var(--color-ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
        {label}
      </span>
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, fontFamily: 'var(--font-mono)', color: color ?? 'var(--color-ink-1)' }}>
        {value}
      </span>
    </div>
  );
}


const estiloTh: React.CSSProperties = {
  textAlign: 'left',
  padding: 'var(--space-3) var(--space-4)',
  color: 'var(--color-ink-3)',
  fontWeight: 600,
  fontSize: 'var(--text-xs)',
  fontFamily: 'var(--font-mono)',
  borderBottom: '1px solid var(--color-border)',
  whiteSpace: 'nowrap',
};

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
