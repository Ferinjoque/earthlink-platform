'use client';

import { useActionState, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { importActivityBulk } from '@/actions/activity';
import type { CsvImportState } from '@/actions/activity';
import type { EmissionSourceType } from '@/types/database';
import type { Unit } from '@/calc/types';
import {
  ETIQUETAS_FUENTE,
  AYUDA_FUENTE,
  OPCIONES_SECUNDARIAS,
  UNIDADES_POR_FUENTE,
  etiquetaUnidad,
  labelSecundarioPara,
} from '@/lib/activity-options';
import { MonthYearSelect } from '@/components/ui/MonthYearSelect';
import { HelpTooltip } from '@/components/ui/HelpTooltip';
import { useToast } from '@/components/ui/Toast';

interface Supplier {
  id: string;
  name: string;
}

interface EntryRow {
  _id: string;
  supplier_id: string;
  year_month: string;
  source_type: EmissionSourceType;
  secondary: string;
  raw_quantity: string;
  raw_unit: string;
  data_quality: string;
  notes: string;
}

function currentYearMonth(): string {
  return `${new Date().getFullYear()}-01`;
}

function advanceMonth(yearMonth: string): string {
  const parts = yearMonth.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return yearMonth;
  const next = new Date(year, month);
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
    data_quality: 'measured',
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


function estiloInput(hasError = false): React.CSSProperties {
  return {
    padding: 'var(--space-2) var(--space-3)',
    background: 'var(--color-surface-0)',
    border: `1px solid ${hasError ? 'var(--color-signal-hi)' : 'var(--color-border)'}`,
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-sm)',
    color: 'var(--color-ink-1)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };
}

function estiloSelect(hasError = false): React.CSSProperties {
  return {
    ...estiloInput(hasError),
    appearance: 'none',
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 10px center',
    paddingRight: '28px',
  };
}

const labelStyle: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  color: 'var(--color-ink-2)',
  fontWeight: 500,
};

function FieldLabel({
  htmlFor,
  label,
  ayuda,
  optional,
}: {
  htmlFor: string;
  label: string;
  ayuda?: string;
  optional?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
      <label htmlFor={htmlFor} style={labelStyle}>
        {label}
        {optional && (
          <span style={{ color: 'var(--color-ink-3)', fontWeight: 400 }}> (opcional)</span>
        )}
      </label>
      {ayuda && <HelpTooltip content={ayuda} />}
    </div>
  );
}


function GresbHint({ sourceType }: { sourceType: EmissionSourceType }) {
  if (sourceType !== 'water_use' && sourceType !== 'waste') return null;
  return (
    <p
      style={{
        fontSize: 'var(--text-xs)',
        color: 'var(--color-ink-3)',
        margin: '0',
        padding: 'var(--space-2) var(--space-3)',
        background: 'var(--color-surface-2)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      {sourceType === 'water_use'
        ? 'Consumo de agua: se registra para GRESB. No afecta el total de CO₂e.'
        : 'Residuos: se registra para GRESB. No afecta el total de CO₂e.'}
    </p>
  );
}


function CardMode({
  row,
  suppliers,
  jsonEntries,
  isPending,
  validCount,
  onAddRow,
  onUpdateRow,
  onChangeSourceType,
}: {
  row: EntryRow;
  suppliers: Supplier[];
  jsonEntries: string;
  isPending: boolean;
  validCount: number;
  onAddRow: () => void;
  onUpdateRow: (patch: Partial<EntryRow>) => void;
  onChangeSourceType: (st: EmissionSourceType) => void;
}) {
  const secs = OPCIONES_SECUNDARIAS[row.source_type] ?? [];
  const units = UNIDADES_POR_FUENTE[row.source_type];
  const secLabel = labelSecundarioPara(row.source_type);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <style>{`@keyframes ringSpin { to { transform: rotate(360deg); } }`}</style>

      {/* Proveedor + Mes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <label htmlFor="card-supplier" style={labelStyle}>Proveedor</label>
          <select
            id="card-supplier"
            value={row.supplier_id}
            onChange={(e) => onUpdateRow({ supplier_id: e.target.value })}
            style={estiloSelect()}
            disabled={suppliers.length === 0}
          >
            {suppliers.length === 0 ? (
              <option value="">Sin proveedores disponibles</option>
            ) : (
              suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))
            )}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <label style={labelStyle}>Mes de reporte</label>
          <MonthYearSelect
            value={row.year_month}
            onChange={(v) => onUpdateRow({ year_month: v })}
            name="year_month_card"
            style={{ gap: 'var(--space-2)' }}
          />
        </div>
      </div>

      {/* Fuente de emisión */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <FieldLabel
          htmlFor="card-source"
          label="Fuente de emisión"
          ayuda={AYUDA_FUENTE[row.source_type]}
        />
        <select
          id="card-source"
          value={row.source_type}
          onChange={(e) => onChangeSourceType(e.target.value as EmissionSourceType)}
          style={estiloSelect()}
        >
          {(Object.keys(ETIQUETAS_FUENTE) as EmissionSourceType[]).map((t) => (
            <option key={t} value={t}>{ETIQUETAS_FUENTE[t]}</option>
          ))}
        </select>
        <GresbHint sourceType={row.source_type} />
      </div>

      {/* Secundario */}
      {secs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <FieldLabel
            htmlFor="card-secondary"
            label={secLabel}
            {...(secs.find((s) => s.value === row.secondary)?.ayuda
              ? { ayuda: secs.find((s) => s.value === row.secondary)!.ayuda }
              : {})}
          />
          <select
            id="card-secondary"
            value={row.secondary}
            onChange={(e) => onUpdateRow({ secondary: e.target.value })}
            style={estiloSelect()}
          >
            {secs.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {row.source_type === 'purchased_steam' && null}

      {/* Cantidad + Unidad */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <label htmlFor="card-qty" style={labelStyle}>Cantidad</label>
          <input
            id="card-qty"
            type="number"
            step="any"
            min="0"
            placeholder="0.00"
            value={row.raw_quantity}
            onChange={(e) => onUpdateRow({ raw_quantity: e.target.value })}
            style={{ ...estiloInput(), fontFamily: 'var(--font-mono)' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <FieldLabel
            htmlFor="card-unit"
            label="Unidad"
            {...(units.find((u) => u.unit === row.raw_unit)?.ayuda
              ? { ayuda: units.find((u) => u.unit === row.raw_unit)!.ayuda }
              : {})}
          />
          <select
            id="card-unit"
            value={row.raw_unit}
            onChange={(e) => onUpdateRow({ raw_unit: e.target.value })}
            style={estiloSelect()}
          >
            {units.map(({ unit, ayuda }) => (
              <option key={unit} value={unit} title={ayuda}>
                {etiquetaUnidad(unit as Unit)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Calidad del dato */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <FieldLabel
          htmlFor="card-dq"
          label="Calidad del dato"
          ayuda="Indica cómo se obtuvo el valor: Medido (medidor/factura directa), Estimado (proxy o interpolación), Calculado (derivado de otros datos)."
        />
        <select
          id="card-dq"
          value={row.data_quality}
          onChange={(e) => onUpdateRow({ data_quality: e.target.value })}
          style={estiloSelect()}
        >
          <option value="measured">Medido</option>
          <option value="estimated">Estimado</option>
          <option value="calculated">Calculado</option>
        </select>
      </div>

      {/* Notas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <label htmlFor="card-notes" style={labelStyle}>
          Notas <span style={{ color: 'var(--color-ink-3)', fontWeight: 400 }}>(opcional)</span>
        </label>
        <textarea
          id="card-notes"
          rows={2}
          placeholder="Descripción de la fuente, ID de medidor, referencia de factura…"
          value={row.notes}
          onChange={(e) => onUpdateRow({ notes: e.target.value })}
          style={{ ...estiloInput(), resize: 'vertical', fontFamily: 'inherit' }}
        />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <form
          action={undefined}
          onSubmit={(e) => {
            e.preventDefault();
            // Enviar vía el form externo para evitar doble anidamiento de formularios
          }}
          style={{ display: 'contents' }}
        >
          <input type="hidden" name="json_entries" value={jsonEntries} form="bulk-form-card" />
          <button
            type="submit"
            form="bulk-form-card"
            disabled={isPending || validCount === 0 || suppliers.length === 0}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              background:
                isPending || validCount === 0 || suppliers.length === 0
                  ? 'var(--color-ink-3)'
                  : 'var(--color-accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              cursor:
                isPending || validCount === 0 || suppliers.length === 0
                  ? 'not-allowed'
                  : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              transition: 'opacity 150ms',
            }}
          >
            {isPending ? (
              <>
                <span
                  style={{
                    width: '12px',
                    height: '12px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white',
                    borderRadius: '50%',
                    display: 'inline-block',
                    animation: 'ringSpin 0.7s linear infinite',
                  }}
                />
                Enviando…
              </>
            ) : (
              'Enviar registro'
            )}
          </button>
        </form>

        <button
          type="button"
          onClick={onAddRow}
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
          + Agregar otra fila
        </button>
      </div>
    </div>
  );
}


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
    const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
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


const SOURCE_TYPES = Object.keys(ETIQUETAS_FUENTE) as EmissionSourceType[];

const tdStyle: React.CSSProperties = {
  padding: '4px 6px',
  verticalAlign: 'middle',
  overflow: 'hidden',
};

function TableMode({
  rows,
  suppliers,
  jsonEntries,
  isPending,
  validCount,
  pendingDelete,
  onAddRow,
  onUpdateRow,
  onChangeSourceType,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  rows: EntryRow[];
  suppliers: Supplier[];
  jsonEntries: string;
  isPending: boolean;
  validCount: number;
  pendingDelete: number | null;
  onAddRow: () => void;
  onUpdateRow: (idx: number, patch: Partial<EntryRow>) => void;
  onChangeSourceType: (idx: number, st: EmissionSourceType) => void;
  onRequestDelete: (idx: number) => void;
  onConfirmDelete: (idx: number) => void;
  onCancelDelete: () => void;
}) {
  const hasGresbRows = rows.some(
    (r) => r.source_type === 'water_use' || r.source_type === 'waste',
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

      {hasGresbRows && (
        <p
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-ink-3)',
            margin: 0,
            padding: 'var(--space-2) var(--space-3)',
            background: 'var(--color-surface-2)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          Filas con agua / residuos se registran para GRESB pero no afectan el total de CO₂e.
        </p>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '14%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '3%' }} />
          </colgroup>
          <thead>
            <tr style={{ background: 'var(--color-surface-2)' }}>
              {['Proveedor', 'Mes', null, 'Secundario', 'Cantidad', 'Unidad', 'Calidad', 'Notas', ''].map(
                (h, i) => (
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
                    {h ?? 'Fuente'}
                  </th>
                ),
              )}
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
                  <td style={tdStyle}>
                    <select
                      className="builder-select"
                      value={row.supplier_id}
                      onChange={(e) => onUpdateRow(idx, { supplier_id: e.target.value })}
                      aria-label="Proveedor"
                    >
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </td>

                  <td style={tdStyle}>
                    <MonthYearSelect
                      value={row.year_month}
                      onChange={(v) => onUpdateRow(idx, { year_month: v })}
                      abbreviated
                    />
                  </td>

                  <td style={tdStyle}>
                    <select
                      className="builder-select"
                      value={row.source_type}
                      onChange={(e) => onChangeSourceType(idx, e.target.value as EmissionSourceType)}
                      aria-label="Fuente"
                    >
                      {SOURCE_TYPES.map((st) => (
                        <option key={st} value={st}>{ETIQUETAS_FUENTE[st]}</option>
                      ))}
                    </select>
                  </td>

                  <td style={tdStyle}>
                    {secs.length > 0 ? (
                      <select
                        className="builder-select"
                        value={row.secondary}
                        onChange={(e) => onUpdateRow(idx, { secondary: e.target.value })}
                        aria-label={secLabel}
                      >
                        {secs.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : (
                      <span
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--color-ink-3)',
                          padding: '5px 7px',
                          display: 'block',
                        }}
                      >
                        —
                      </span>
                    )}
                  </td>

                  <td style={tdStyle}>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="builder-input"
                      value={row.raw_quantity}
                      onChange={(e) => onUpdateRow(idx, { raw_quantity: e.target.value })}
                      placeholder="0.00"
                      aria-label="Cantidad"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    />
                  </td>

                  <td style={tdStyle}>
                    <select
                      className="builder-select"
                      value={row.raw_unit}
                      onChange={(e) => onUpdateRow(idx, { raw_unit: e.target.value })}
                      aria-label="Unidad"
                    >
                      {units.map(({ unit }) => (
                        <option key={unit} value={unit}>
                          {etiquetaUnidad(unit as Unit)}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td style={tdStyle}>
                    <select
                      className="builder-select"
                      value={row.data_quality}
                      onChange={(e) => onUpdateRow(idx, { data_quality: e.target.value })}
                      aria-label="Calidad del dato"
                    >
                      <option value="measured">Med.</option>
                      <option value="estimated">Est.</option>
                      <option value="calculated">Cal.</option>
                    </select>
                  </td>

                  <td style={tdStyle}>
                    <input
                      type="text"
                      className="builder-input"
                      value={row.notes}
                      onChange={(e) => onUpdateRow(idx, { notes: e.target.value })}
                      placeholder="Opcional"
                      aria-label="Notas"
                    />
                  </td>

                  <td style={{ ...tdStyle, width: '28px' }}>
                    <button
                      type="button"
                      className="builder-del"
                      onClick={() => onRequestDelete(idx)}
                      aria-label="Eliminar fila"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--color-signal-hi)',
                        fontSize: '16px',
                        lineHeight: 1,
                        padding: '2px 4px',
                        opacity: 0,
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onAddRow}
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

        <form id="bulk-form-table" action={undefined} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <input type="hidden" name="json_entries" value={jsonEntries} form="bulk-form-table" />
          <button
            type="submit"
            form="bulk-form-table"
            disabled={isPending || validCount === 0}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              background:
                isPending || validCount === 0 ? 'var(--color-ink-3)' : 'var(--color-accent)',
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
                <span
                  style={{
                    width: '12px',
                    height: '12px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white',
                    borderRadius: '50%',
                    display: 'inline-block',
                    animation: 'ringSpin 0.7s linear infinite',
                  }}
                />
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
          supplierName={
            suppliers.find((s) => s.id === rows[pendingDelete!]?.supplier_id)?.name ?? ''
          }
          onConfirm={() => onConfirmDelete(pendingDelete)}
          onCancel={onCancelDelete}
        />
      )}
    </div>
  );
}


interface BulkEntryBuilderProps {
  suppliers: Supplier[];
  defaultSupplierId?: string | undefined;
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

  const isCardMode = rows.length === 1;

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

  function updateRow(idx: number, patch: Partial<EntryRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function updateSingleRow(patch: Partial<EntryRow>) {
    setRows((prev) => prev.map((r, i) => (i === 0 ? { ...r, ...patch } : r)));
  }

  function changeSourceType(idx: number, st: EmissionSourceType) {
    setRows((prev) => prev.map((r, i) => (i === idx ? updateSourceType(r, st) : r)));
  }

  function changeSingleSourceType(st: EmissionSourceType) {
    setRows((prev) => prev.map((r, i) => (i === 0 ? updateSourceType(r, st) : r)));
  }

  function requestDelete(idx: number) {
    if (rows.length === 1) return; // card mode doesn't delete last row
    setPendingDelete(idx);
  }

  function confirmDelete(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
    setPendingDelete(null);
  }

  const validCount = rows.filter(
    (r) => r.supplier_id && r.year_month && r.source_type && r.raw_quantity && r.raw_unit,
  ).length;

  const jsonEntries = JSON.stringify(
    rows
      .filter((r) => r.supplier_id && r.year_month && r.source_type && r.raw_quantity && r.raw_unit)
      .map(({ supplier_id, year_month, source_type, secondary, raw_quantity, raw_unit, data_quality, notes }) => ({
        supplier_id,
        year_month,
        source_type,
        secondary,
        raw_quantity: Number(raw_quantity),
        raw_unit,
        data_quality,
        notes,
      })),
  );

  // Elemento form compartido para el modo de una sola tarjeta
  if (isCardMode) {
    const row = rows[0]!;
    return (
      <>
        {/* Hidden form that the card submit button targets */}
        <form id="bulk-form-card" action={formAction} noValidate style={{ display: 'none' }}>
          <input type="hidden" name="json_entries" value={jsonEntries} />
        </form>
        <CardMode
          row={row}
          suppliers={suppliers}
          jsonEntries={jsonEntries}
          isPending={isPending}
          validCount={validCount}
          onAddRow={addRow}
          onUpdateRow={updateSingleRow}
          onChangeSourceType={changeSingleSourceType}
        />
      </>
    );
  }

  return (
    <>
      <form id="bulk-form-table" action={formAction} noValidate style={{ display: 'none' }}>
        <input type="hidden" name="json_entries" value={jsonEntries} />
      </form>
      <TableMode
        rows={rows}
        suppliers={suppliers}
        jsonEntries={jsonEntries}
        isPending={isPending}
        validCount={validCount}
        pendingDelete={pendingDelete}
        onAddRow={addRow}
        onUpdateRow={updateRow}
        onChangeSourceType={changeSourceType}
        onRequestDelete={requestDelete}
        onConfirmDelete={confirmDelete}
        onCancelDelete={() => setPendingDelete(null)}
      />
    </>
  );
}
