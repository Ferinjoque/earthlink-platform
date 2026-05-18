'use client';

import { useState, useActionState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { PeriodActions } from '@/components/audit/PeriodActions';
import { resolveAnomaly, createPeriod, type ResolveAnomalyState, type CreatePeriodState } from '@/actions/audit';
import type { PeriodStatus } from '@/domain/ReportingPeriod';
import type { AnomalySeverity } from '@/types/database';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ResultadoDetalle {
  id: string;
  source_type: string;
  raw_quantity: number;
  raw_unit: string;
  scope: number;
  co2e_kg: number;
  factor_used: number;
  factor_unit: string;
  calculated_at: string;
}

export interface AnomaliaDetalle {
  id: string;
  activity_entry_id: string;
  source_type: string;
  severity: AnomalySeverity;
  z_score: number | null;
  message: string;
  flagged_at: string;
}

export interface ResumenEmisiones {
  totalCo2eKg: number;
  scope1Co2eKg: number;
  scope2Co2eKg: number;
  nResultados: number;
}

export interface PeriodoFila {
  id: string;
  label: string;
  supplier_id: string;
  supplier_name: string;
  status: PeriodStatus;
  start_date: string;
  end_date: string;
  resumen: ResumenEmisiones | undefined;
  results: ResultadoDetalle[];
  anomalias: AnomaliaDetalle[];
}

export interface SupplierOption {
  id: string;
  name: string;
}

interface AuditTableProps {
  periodos: PeriodoFila[];
  suppliers: SupplierOption[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function variantEstado(
  status: PeriodStatus,
): 'open' | 'calculating' | 'under_review' | 'locked' | 'neutral' {
  if (status === 'open') return 'open';
  if (status === 'calculating') return 'calculating';
  if (status === 'under_review') return 'under_review';
  if (status === 'locked') return 'locked';
  return 'neutral';
}

function etiquetaEstado(status: PeriodStatus): string {
  if (status === 'open') return 'Abierto';
  if (status === 'calculating') return 'Calculando…';
  if (status === 'under_review') return 'En revisión';
  if (status === 'locked') return 'Bloqueado';
  return status;
}

function formatearKg(kg: number): string {
  if (kg === 0) return '—';
  if (kg >= 1_000) return `${(kg / 1_000).toFixed(3)} tCO₂e`;
  return `${kg.toFixed(2)} kg`;
}

const FUENTE_CORTA: Record<string, string> = {
  stationary_combustion: 'Estacionaria',
  mobile_combustion: 'Móvil',
  purchased_electricity: 'Electricidad',
  purchased_steam: 'Vapor',
  fugitive: 'Fugitiva',
};

const COLOR_SEVERIDAD: Record<AnomalySeverity, string> = {
  low: 'var(--color-signal-ok)',
  medium: 'var(--color-signal-md)',
  high: 'var(--color-signal-hi)',
};

const ETIQUETAS_SEVERIDAD: Record<AnomalySeverity, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function ResultadosPanel({ results }: { results: ResultadoDetalle[] }) {
  if (results.length === 0) {
    return (
      <p
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--color-ink-3)',
          fontFamily: 'var(--font-mono)',
          margin: 0,
        }}
      >
        Sin resultados calculados para este periodo.
      </p>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}
      >
        <thead>
          <tr>
            {['Fuente', 'Cantidad', 'CO₂e', 'Alcance', 'Factor', 'Calculado'].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: 'left',
                  padding: '4px var(--space-3)',
                  color: 'var(--color-ink-3)',
                  fontWeight: 600,
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
          {results.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={estiloCeldaMini}>
                {FUENTE_CORTA[r.source_type] ?? r.source_type}
              </td>
              <td
                style={{
                  ...estiloCeldaMini,
                  fontFamily: 'var(--font-mono)',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.raw_quantity.toLocaleString('es')} {r.raw_unit}
              </td>
              <td
                style={{
                  ...estiloCeldaMini,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  color: r.scope === 1 ? 'var(--color-accent)' : 'var(--color-scope2)',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatearKg(r.co2e_kg)}
              </td>
              <td style={{ ...estiloCeldaMini, fontFamily: 'var(--font-mono)' }}>
                {r.scope}
              </td>
              <td
                style={{
                  ...estiloCeldaMini,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--color-ink-3)',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.factor_used.toFixed(4)} {r.factor_unit}
              </td>
              <td
                style={{
                  ...estiloCeldaMini,
                  color: 'var(--color-ink-3)',
                  fontFamily: 'var(--font-mono)',
                  whiteSpace: 'nowrap',
                }}
              >
                {new Date(r.calculated_at).toLocaleDateString('es')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnomaliaItem({ anomalia }: { anomalia: AnomaliaDetalle }) {
  const [state, formAction, isPending] = useActionState<ResolveAnomalyState | null, FormData>(
    resolveAnomaly,
    null,
  );

  if (state?.success) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-signal-ok)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        Marcado como revisado
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-4)',
        padding: 'var(--space-3) 0',
        borderBottom: '1px solid var(--color-border)',
        flexWrap: 'wrap',
      }}
    >
      <span
        style={{
          fontSize: 'var(--text-xs)',
          fontWeight: 700,
          color: COLOR_SEVERIDAD[anomalia.severity],
          fontFamily: 'var(--font-mono)',
          minWidth: '40px',
          flexShrink: 0,
        }}
      >
        {ETIQUETAS_SEVERIDAD[anomalia.severity]}
      </span>

      {anomalia.z_score !== null && (
        <span
          style={{
            fontSize: 'var(--text-xs)',
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-ink-2)',
            flexShrink: 0,
          }}
        >
          z={anomalia.z_score.toFixed(2)}
        </span>
      )}

      <span
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--color-ink-2)',
          fontFamily: 'var(--font-mono)',
          flexShrink: 0,
        }}
      >
        {FUENTE_CORTA[anomalia.source_type] ?? anomalia.source_type}
      </span>

      <span
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--color-ink-2)',
          flex: 1,
          minWidth: '160px',
        }}
      >
        {anomalia.message}
      </span>

      <form action={formAction} style={{ flexShrink: 0 }}>
        <input type="hidden" name="flag_id" value={anomalia.id} />
        <button
          type="submit"
          disabled={isPending}
          style={{
            fontSize: 'var(--text-xs)',
            fontFamily: 'var(--font-mono)',
            color: isPending ? 'var(--color-ink-3)' : 'var(--color-ink-2)',
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '3px var(--space-3)',
            cursor: isPending ? 'default' : 'pointer',
          }}
        >
          {isPending ? 'Guardando…' : 'Marcar revisado'}
        </button>
      </form>

      {state?.error && (
        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-signal-hi)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {state.error}
        </span>
      )}
    </div>
  );
}

function NuevoPeriodoForm({
  suppliers,
  onClose,
}: {
  suppliers: SupplierOption[];
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState<CreatePeriodState | null, FormData>(
    createPeriod,
    null,
  );

  if (state?.success) {
    return (
      <div
        style={{
          padding: 'var(--space-4)',
          background: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          fontSize: 'var(--text-sm)',
          color: 'var(--color-signal-ok)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        Periodo creado correctamente.{' '}
        <button
          type="button"
          onClick={onClose}
          style={{
            fontSize: 'var(--text-xs)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-ink-3)',
            textDecoration: 'underline',
          }}
        >
          Cerrar
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-5)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 'var(--space-4)',
        }}
      >
        <h3
          style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            color: 'var(--color-ink-1)',
            margin: 0,
          }}
        >
          Nuevo periodo de reporte
        </h3>
        <button
          type="button"
          onClick={onClose}
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-ink-3)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
          aria-label="Cerrar formulario"
        >
          ✕
        </button>
      </div>

      <form action={formAction}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--space-4)',
          }}
        >
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-mono)',
                color: 'var(--color-ink-3)',
                marginBottom: 'var(--space-1)',
              }}
            >
              Proveedor
            </label>
            <select
              name="supplier_id"
              required
              style={{
                width: '100%',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-ink-1)',
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-2) var(--space-3)',
              }}
            >
              <option value="">Selecciona proveedor…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-mono)',
                color: 'var(--color-ink-3)',
                marginBottom: 'var(--space-1)',
              }}
            >
              Etiqueta
            </label>
            <input
              type="text"
              name="label"
              required
              placeholder="ej. Q1-2026"
              style={{
                width: '100%',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-ink-1)',
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-2) var(--space-3)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-mono)',
                color: 'var(--color-ink-3)',
                marginBottom: 'var(--space-1)',
              }}
            >
              Fecha inicio
            </label>
            <input
              type="date"
              name="fecha_inicio"
              required
              style={{
                width: '100%',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-ink-1)',
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-2) var(--space-3)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-mono)',
                color: 'var(--color-ink-3)',
                marginBottom: 'var(--space-1)',
              }}
            >
              Fecha fin
            </label>
            <input
              type="date"
              name="fecha_fin"
              required
              style={{
                width: '100%',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-ink-1)',
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-2) var(--space-3)',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {state?.error && (
          <p
            style={{
              marginTop: 'var(--space-3)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-signal-hi)',
              fontFamily: 'var(--font-mono)',
            }}
            role="alert"
          >
            {state.error}
          </p>
        )}

        <div
          style={{
            marginTop: 'var(--space-4)',
            display: 'flex',
            gap: 'var(--space-3)',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-ink-3)',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-2) var(--space-4)',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              color: 'white',
              background: isPending ? 'var(--color-ink-3)' : 'var(--color-accent)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-2) var(--space-5)',
              cursor: isPending ? 'default' : 'pointer',
            }}
          >
            {isPending ? 'Creando…' : 'Crear periodo'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const ESTADOS_FILTRO: { valor: PeriodStatus | 'todos'; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'open', etiqueta: 'Abierto' },
  { valor: 'calculating', etiqueta: 'Calculando' },
  { valor: 'under_review', etiqueta: 'En revisión' },
  { valor: 'locked', etiqueta: 'Bloqueado' },
];

const ESTILO_COL: React.CSSProperties = {
  textAlign: 'left',
  padding: 'var(--space-3) var(--space-4)',
  color: 'var(--color-ink-3)',
  fontWeight: 600,
  fontSize: 'var(--text-xs)',
  fontFamily: 'var(--font-mono)',
  borderBottom: '1px solid var(--color-border)',
  whiteSpace: 'nowrap',
};

const estiloCeldaMini: React.CSSProperties = {
  padding: '4px var(--space-3)',
  color: 'var(--color-ink-2)',
  fontSize: 'var(--text-xs)',
};

export function AuditTable({ periodos, suppliers }: AuditTableProps) {
  const [filtroEstado, setFiltroEstado] = useState<PeriodStatus | 'todos'>('todos');
  const [expandidoResultados, setExpandidoResultados] = useState<string | null>(null);
  const [expandidoAnomalias, setExpandidoAnomalias] = useState<string | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  const filtrados = periodos.filter(
    (p) => filtroEstado === 'todos' || p.status === filtroEstado,
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* ── Cabecera sección ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 'var(--space-4)',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 'var(--text-base)',
              fontWeight: 600,
              color: 'var(--color-ink-1)',
              margin: 0,
            }}
          >
            Periodos de reporte
          </h2>
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-ink-3)',
              margin: 'var(--space-1) 0 0',
            }}
          >
            Calcula el CO₂e y bloquea periodos para crear un registro de auditoría inmutable.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMostrarFormulario((v) => !v)}
          style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            color: mostrarFormulario ? 'var(--color-ink-3)' : 'var(--color-accent)',
            background: 'transparent',
            border: `1px solid ${mostrarFormulario ? 'var(--color-border)' : 'var(--color-accent)'}`,
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-2) var(--space-4)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {mostrarFormulario ? 'Cancelar' : '+ Nuevo periodo'}
        </button>
      </div>

      {/* ── Formulario nuevo periodo ── */}
      {mostrarFormulario && (
        <NuevoPeriodoForm suppliers={suppliers} onClose={() => setMostrarFormulario(false)} />
      )}

      {/* ── Filtro de estado ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-ink-3)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          Estado:
        </span>
        {ESTADOS_FILTRO.map(({ valor, etiqueta }) => (
          <button
            key={valor}
            type="button"
            onClick={() => setFiltroEstado(valor)}
            style={{
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
              padding: '3px var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border:
                filtroEstado === valor
                  ? '1px solid var(--color-accent)'
                  : '1px solid var(--color-border)',
              background:
                filtroEstado === valor ? 'var(--color-accent-soft)' : 'transparent',
              color:
                filtroEstado === valor ? 'var(--color-accent)' : 'var(--color-ink-3)',
              cursor: 'pointer',
            }}
          >
            {etiqueta}
          </button>
        ))}
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-ink-3)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {filtrados.length} de {periodos.length}
        </span>
      </div>

      {/* ── Tabla ── */}
      {filtrados.length === 0 ? (
        <p
          style={{
            color: 'var(--color-ink-3)',
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-mono)',
            padding: 'var(--space-8) 0',
            textAlign: 'center',
          }}
        >
          {periodos.length === 0
            ? 'No se encontraron periodos de reporte para tu cuenta.'
            : 'Sin periodos que coincidan con el filtro.'}
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
          <style>{'.audit-row:hover { background: var(--color-surface-2) !important; }'}</style>
          <table
            style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}
          >
            <thead>
              <tr>
                {[
                  'Proveedor',
                  'Periodo',
                  'Fechas',
                  'Estado',
                  'CO₂e Total',
                  'Resultados',
                  'Anomalías',
                  'Acciones',
                ].map((h) => (
                  <th key={h} style={ESTILO_COL}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => {
                const inicioFmt = new Date(p.start_date).toLocaleDateString('es', {
                  month: 'short',
                  year: 'numeric',
                });
                const finFmt = new Date(p.end_date).toLocaleDateString('es', {
                  month: 'short',
                  year: 'numeric',
                });
                const hasResults = p.results.length > 0;
                const hasAnomalias = p.anomalias.length > 0;
                const resultadosAbiertos = expandidoResultados === p.id;
                const anomaliasAbiertas = expandidoAnomalias === p.id;

                return (
                  <>
                    <tr
                      key={p.id}
                      className="audit-row"
                      style={{
                        borderBottom:
                          resultadosAbiertos || anomaliasAbiertas
                            ? 'none'
                            : '1px solid var(--color-border)',
                      }}
                    >
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
                      <td
                        style={{
                          padding: 'var(--space-3) var(--space-4)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'var(--text-xs)',
                          color: 'var(--color-ink-3)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {inicioFmt} – {finFmt}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <Badge variant={variantEstado(p.status)}>
                          {etiquetaEstado(p.status)}
                        </Badge>
                      </td>
                      <td
                        style={{
                          padding: 'var(--space-3) var(--space-4)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'var(--text-xs)',
                          color: p.resumen ? 'var(--color-ink-1)' : 'var(--color-ink-3)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {p.resumen ? (
                          <span
                            title={`Alcance 1: ${formatearKg(p.resumen.scope1Co2eKg)} · Alcance 2: ${formatearKg(p.resumen.scope2Co2eKg)}`}
                          >
                            {formatearKg(p.resumen.totalCo2eKg)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        {hasResults ? (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandidoResultados((prev) => (prev === p.id ? null : p.id))
                            }
                            style={{
                              fontSize: 'var(--text-xs)',
                              fontFamily: 'var(--font-mono)',
                              color: resultadosAbiertos
                                ? 'var(--color-accent)'
                                : 'var(--color-ink-2)',
                              background: resultadosAbiertos
                                ? 'var(--color-accent-soft)'
                                : 'var(--color-surface-2)',
                              border: `1px solid ${resultadosAbiertos ? 'oklch(42% 0.12 155 / 30%)' : 'var(--color-border)'}`,
                              borderRadius: 'var(--radius-md)',
                              padding: '3px var(--space-3)',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                            aria-expanded={resultadosAbiertos}
                          >
                            {p.results.length} {p.results.length === 1 ? 'entrada' : 'entradas'}
                          </button>
                        ) : (
                          <span
                            style={{
                              color: 'var(--color-ink-3)',
                              fontSize: 'var(--text-xs)',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            —
                          </span>
                        )}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        {hasAnomalias ? (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandidoAnomalias((prev) => (prev === p.id ? null : p.id))
                            }
                            style={{
                              fontSize: 'var(--text-xs)',
                              fontFamily: 'var(--font-mono)',
                              color: anomaliasAbiertas
                                ? 'var(--color-signal-md)'
                                : 'var(--color-ink-2)',
                              background: anomaliasAbiertas
                                ? 'color-mix(in oklch, var(--color-signal-md) 12%, transparent)'
                                : 'var(--color-surface-2)',
                              border: `1px solid ${anomaliasAbiertas ? 'oklch(70% 0.13 70 / 30%)' : 'var(--color-border)'}`,
                              borderRadius: 'var(--radius-md)',
                              padding: '3px var(--space-3)',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                            aria-expanded={anomaliasAbiertas}
                          >
                            {p.anomalias.length} anomal{p.anomalias.length === 1 ? 'ía' : 'ías'}
                          </button>
                        ) : (
                          <span
                            style={{
                              color: 'var(--color-ink-3)',
                              fontSize: 'var(--text-xs)',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            —
                          </span>
                        )}
                      </td>
                      <td
                        style={{ padding: 'var(--space-3) var(--space-4)', minWidth: '160px' }}
                      >
                        <PeriodActions periodId={p.id} status={p.status} />
                      </td>
                    </tr>

                    {/* ── Panel resultados expandible ── */}
                    {resultadosAbiertos && (
                      <tr
                        key={`${p.id}-results`}
                        style={{
                          borderBottom: anomaliasAbiertas
                            ? 'none'
                            : '1px solid var(--color-border)',
                        }}
                      >
                        <td
                          colSpan={8}
                          style={{
                            padding: 'var(--space-3) var(--space-4) var(--space-4)',
                            background: 'oklch(58% 0.16 155 / 4%)',
                          }}
                        >
                          <p
                            className="eyebrow"
                            style={{ marginBottom: 'var(--space-3)', color: 'var(--color-accent)' }}
                          >
                            Resultados de emisiones — {p.label}
                          </p>
                          <ResultadosPanel results={p.results} />
                        </td>
                      </tr>
                    )}

                    {/* ── Panel anomalías expandible ── */}
                    {anomaliasAbiertas && (
                      <tr
                        key={`${p.id}-anomalias`}
                        style={{ borderBottom: '1px solid var(--color-border)' }}
                      >
                        <td
                          colSpan={8}
                          style={{
                            padding: 'var(--space-3) var(--space-4) var(--space-4)',
                            background:
                              'color-mix(in oklch, var(--color-signal-md) 5%, transparent)',
                          }}
                        >
                          <p
                            className="eyebrow"
                            style={{
                              marginBottom: 'var(--space-3)',
                              color: 'var(--color-signal-md)',
                            }}
                          >
                            Anomalías pendientes — {p.label}
                          </p>
                          <div>
                            {p.anomalias.map((a) => (
                              <AnomaliaItem key={a.id} anomalia={a} />
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
