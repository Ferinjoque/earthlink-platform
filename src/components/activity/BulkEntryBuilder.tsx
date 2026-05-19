'use client';

import { useActionState, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { importActivityBulk } from '@/actions/activity';
import type { CsvImportState } from '@/actions/activity';
import type { EmissionSourceType } from '@/types/database';
import type { Unit } from '@/calc/types';
import {
  ETIQUETAS_FUENTE,
  OPCIONES_SECUNDARIAS,
  UNIDADES_POR_FUENTE,
  etiquetaUnidad,
  labelSecundarioPara,
} from '@/lib/activity-options';
import { MonthYearSelect } from '@/components/ui/MonthYearSelect';
import { useToast } from '@/components/ui/Toast';

interface Supplier {
  id: string;
  name: string;
}

interface EntryRow {
  _id: string;
  supplier_id: string;
  year_month: string; // "YYYY-MM"
  source_type: EmissionSourceType;
  secondary: string;
  raw_quantity: string;
  raw_unit: string;
  notes: string;
}

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function advanceMonth(yearMonth: string): string {
  const parts = yearMonth.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return yearMonth;
  const next = new Date(year, month); // month is 1-based, Date constructor is 0-based → this goes to next month
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

function defaultRow(suppliers: Supplier[], yearMonth = currentYearMonth()): EntryRow {
  const st: EmissionSourceType = 'stationary_combustion';
  const secs = OPCIONES_SECUNDARIAS[st] ?? [];
  const units = UNIDADES_POR_FUENTE[st];
  return {
    _id: Math.random().toString(36).slice(2),
    supplier_id: suppliers[0]?.id ?? '',
    year_month: yearMonth,
    source_type: st,
    secondary: secs[0]?.value ?? '',
    raw_quantity: '',
    raw_unit: units[0]?.unit ?? '',
    notes: '',
  };
}

function updateSourceType(row: EntryRow, st: EmissionSourceType): EntryRow {
  const secs = OPCIONES_SECUNDARIAS[st] ?? [];
  const units = UNIDADES_POR_FUENTE[st];
  return {
    ...row,
    source_type: st,
    secondary: secs[0]?.value ?? '',
    raw_unit: units[0]?.unit ?? '',
  };
}

interface BulkEntryBuilderProps {
  suppliers: Supplier[];
  defaultSupplierId?: string | undefined;
}

const SOURCE_TYPES = Object.keys(ETIQUETAS_FUENTE) as EmissionSourceType[];

// ── Delete confirmation modal ─────────────────────────────────────────────────

function DeleteModal({
  row,
  supplierName,
  onConfirm,
  onCancel,
}: {
  row: EntryRow;
  supplierName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const monthLabel = (() => {
    const parts = row.year_month.split('-');
    const m = Number(parts[1]);
    const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return `${MESES[(m - 1) % 12] ?? ''} ${parts[0] ?? ''}`;
  })();

  return createPortal(
    <>
      <style>{`
        @keyframes dm-backdrop { from { opacity: 0; } to { opacity: 1; } }
        @keyframes dm-dialog { from { opacity: 0; transform: scale(0.94) translateY(-6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
      <div
        onClick={onCancel}
        style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          background: 'oklch(10% 0 0 / 40%)',
          backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'dm-backdrop 180ms ease forwards',
        }}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="dm-title"
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            padding: 'var(--space-6)',
            width: '340px',
            maxWidth: '90vw',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
            animation: 'dm-dialog 200ms var(--ease-out-expo) forwards',
          }}
        >
          <div>
            <p
              id="dm-title"
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: 'var(--color-ink-1)',
                margin: '0 0 var(--space-2)',
              }}
            >
              ¿Eliminar esta fila?
            </p>
            <p
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--color-ink-3)',
                fontFamily: 'var(--font-mono)',
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {supplierName} · {monthLabel} · {ETIQUETAS_FUENTE[row.source_type] ?? row.source_type}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--color-ink-2)',
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
              type="button"
              onClick={onConfirm}
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: '#fff',
                background: 'var(--color-signal-hi)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-2) var(--space-4)',
                cursor: 'pointer',
              }}
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

export function BulkEntryBuilder({ suppliers, defaultSupplierId }: BulkEntryBuilderProps) {
  const ym = currentYearMonth();
  const initialSupplierId = defaultSupplierId ?? suppliers[0]?.id ?? '';
  const [rows, setRows] = useState<EntryRow[]>(() => [
    { ...defaultRow(suppliers, ym), supplier_id: initialSupplierId },
  ]);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [state, formAction, isPending] = useActionState<CsvImportState | null, FormData>(
    importActivityBulk,
    null,
  );
  const { toast } = useToast();

  useEffect(() => {
    if (!state?.submittedAt) return;
    if (state.success) {
      const n = state.imported ?? 0;
      toast(
        `${n} registro${n !== 1 ? 's' : ''} importado${n !== 1 ? 's' : ''}${(state.skipped ?? 0) > 0 ? ` · ${state.skipped} omitidos` : ''}`,
        'success',
      );
      setRows([{ ...defaultRow(suppliers), supplier_id: initialSupplierId }]);
    } else if (state.error) {
      toast(state.error, 'error');
    }
  }, [state?.submittedAt]);

  function addRow() {
    setRows((prev) => {
      const last = prev[prev.length - 1];
      if (!last) return [...prev, defaultRow(suppliers)];
      return [
        ...prev,
        {
          ...last,
          _id: Math.random().toString(36).slice(2),
          year_month: advanceMonth(last.year_month),
          raw_quantity: '',
          notes: '',
        },
      ];
    });
  }

  function requestDelete(idx: number) {
    setPendingDelete(idx);
  }

  function confirmDelete(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
    setPendingDelete(null);
  }

  function cancelDelete() {
    setPendingDelete(null);
  }

  function updateRow(idx: number, patch: Partial<EntryRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function changeSourceType(idx: number, st: EmissionSourceType) {
    setRows((prev) => prev.map((r, i) => (i === idx ? updateSourceType(r, st) : r)));
  }

  const validCount = rows.filter(
    (r) => r.supplier_id && r.year_month && r.source_type && r.raw_quantity && r.raw_unit,
  ).length;

  const jsonEntries = JSON.stringify(
    rows
      .filter((r) => r.supplier_id && r.year_month && r.source_type && r.raw_quantity && r.raw_unit)
      .map(({ supplier_id, year_month, source_type, secondary, raw_quantity, raw_unit, notes }) => ({
        supplier_id,
        year_month,
        source_type,
        secondary,
        raw_quantity: Number(raw_quantity),
        raw_unit,
        notes,
      })),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <style>{`
        @keyframes ringSpin { to { transform: rotate(360deg); } }
        .builder-row:hover .builder-del { opacity: 1 !important; }
        .builder-input, .builder-select {
          padding: 5px 7px;
          background: var(--color-surface-0);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          font-size: var(--text-xs);
          color: var(--color-ink-1);
          font-family: var(--font-sans);
          width: 100%;
          box-sizing: border-box;
        }
        .builder-input:focus, .builder-select:focus {
          outline: 1px solid var(--color-accent);
          border-color: var(--color-accent);
        }
        .builder-select {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 7px center;
          padding-right: 22px;
        }
      `}</style>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
          <thead>
            <tr style={{ background: 'var(--color-surface-2)' }}>
              {['Proveedor', 'Mes', 'Fuente', labelSecundarioPara('stationary_combustion'), 'Cantidad', 'Unidad', 'Notas', ''].map((h, i) => (
                <th
                  key={i}
                  style={{
                    padding: '6px 8px',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    color: 'var(--color-ink-2)',
                    textAlign: 'left',
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
            {rows.map((row, idx) => {
              const secs = OPCIONES_SECUNDARIAS[row.source_type] ?? [];
              const units = UNIDADES_POR_FUENTE[row.source_type];
              const secLabel = labelSecundarioPara(row.source_type);
              return (
                <tr
                  key={row._id}
                  className="builder-row"
                  style={{ borderBottom: '1px solid var(--color-border)' }}
                >
                  {/* Proveedor */}
                  <td style={tdStyle}>
                    <select
                      className="builder-select"
                      value={row.supplier_id}
                      onChange={(e) => updateRow(idx, { supplier_id: e.target.value })}
                      aria-label="Proveedor"
                      style={{ minWidth: '140px' }}
                    >
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Mes */}
                  <td style={tdStyle}>
                    <MonthYearSelect
                      value={row.year_month}
                      onChange={(v) => updateRow(idx, { year_month: v })}
                      style={{ minWidth: '200px' }}
                    />
                  </td>

                  {/* Fuente */}
                  <td style={tdStyle}>
                    <select
                      className="builder-select"
                      value={row.source_type}
                      onChange={(e) => changeSourceType(idx, e.target.value as EmissionSourceType)}
                      aria-label="Fuente"
                      style={{ minWidth: '150px' }}
                    >
                      {SOURCE_TYPES.map((st) => (
                        <option key={st} value={st}>
                          {ETIQUETAS_FUENTE[st]}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Secundario */}
                  <td style={tdStyle}>
                    {secs.length > 0 ? (
                      <select
                        className="builder-select"
                        value={row.secondary}
                        onChange={(e) => updateRow(idx, { secondary: e.target.value })}
                        aria-label={secLabel}
                        style={{ minWidth: '130px' }}
                      >
                        {secs.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-3)', padding: '5px 7px', display: 'block' }}>
                        —
                      </span>
                    )}
                  </td>

                  {/* Cantidad */}
                  <td style={tdStyle}>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="builder-input"
                      value={row.raw_quantity}
                      onChange={(e) => updateRow(idx, { raw_quantity: e.target.value })}
                      placeholder="0.00"
                      aria-label="Cantidad"
                      style={{ minWidth: '80px', fontFamily: 'var(--font-mono)' }}
                    />
                  </td>

                  {/* Unidad */}
                  <td style={tdStyle}>
                    <select
                      className="builder-select"
                      value={row.raw_unit}
                      onChange={(e) => updateRow(idx, { raw_unit: e.target.value })}
                      aria-label="Unidad"
                      style={{ minWidth: '110px' }}
                    >
                      {units.map(({ unit }) => (
                        <option key={unit} value={unit}>
                          {etiquetaUnidad(unit as Unit)}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Notas */}
                  <td style={tdStyle}>
                    <input
                      type="text"
                      className="builder-input"
                      value={row.notes}
                      onChange={(e) => updateRow(idx, { notes: e.target.value })}
                      placeholder="Opcional"
                      aria-label="Notas"
                      style={{ minWidth: '120px' }}
                    />
                  </td>

                  {/* Eliminar */}
                  <td style={{ ...tdStyle, width: '28px' }}>
                    <button
                      type="button"
                      className="builder-del"
                      onClick={() => requestDelete(idx)}
                      aria-label="Eliminar fila"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--color-signal-hi)',
                        fontSize: '16px',
                        lineHeight: 1,
                        padding: '2px 4px',
                        opacity: rows.length === 1 ? 0.2 : 0,
                        pointerEvents: rows.length === 1 ? 'none' : 'auto',
                        transition: 'opacity 120ms',
                      }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add row + import */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={addRow}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            background: 'none',
            border: '1px dashed var(--color-border-strong)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-ink-2)',
            cursor: 'pointer',
            transition: 'border-color 120ms, color 120ms',
          }}
        >
          + Agregar fila
        </button>

        <form action={formAction} noValidate style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <input type="hidden" name="json_entries" value={jsonEntries} />
          <button
            type="submit"
            disabled={isPending || validCount === 0}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              background: isPending || validCount === 0 ? 'var(--color-ink-3)' : 'var(--color-accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              cursor: isPending || validCount === 0 ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              transition: 'opacity 150ms',
            }}
          >
            {isPending ? (
              <>
                <span style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'ringSpin 0.7s linear infinite' }} />
                Importando…
              </>
            ) : (
              `Importar ${validCount} fila${validCount !== 1 ? 's' : ''}`
            )}
          </button>
        </form>

        {rows.length > 1 && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-3)' }}>
            {rows.length} filas · {validCount} completas
          </span>
        )}
      </div>

      {pendingDelete !== null && rows[pendingDelete] !== undefined && (
        <DeleteModal
          row={rows[pendingDelete]!}
          supplierName={suppliers.find((s) => s.id === rows[pendingDelete!]?.supplier_id)?.name ?? ''}
          onConfirm={() => confirmDelete(pendingDelete)}
          onCancel={cancelDelete}
        />
      )}
    </div>
  );
}

const tdStyle: React.CSSProperties = {
  padding: '4px 6px',
  verticalAlign: 'middle',
};
