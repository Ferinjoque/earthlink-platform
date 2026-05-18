'use client';

import { useActionState, useState } from 'react';
import { createActivityEntry } from '@/actions/activity';
import type { ActivityFormState } from '@/actions/activity';
import type { EmissionSourceType } from '@/types/database';
import type { Unit } from '@/calc/types';

const ETIQUETAS_FUENTE: Record<EmissionSourceType, string> = {
  stationary_combustion: 'Combustión estacionaria (Alcance 1)',
  mobile_combustion: 'Combustión móvil (Alcance 1)',
  purchased_electricity: 'Electricidad comprada (Alcance 2)',
  purchased_steam: 'Vapor comprado (Alcance 2)',
  fugitive: 'Emisiones fugitivas (Alcance 1)',
};

const OPCIONES_SECUNDARIAS: Partial<
  Record<EmissionSourceType, { value: string; label: string }[]>
> = {
  stationary_combustion: [
    { value: 'natural_gas', label: 'Gas natural' },
    { value: 'diesel', label: 'Diésel' },
    { value: 'lpg', label: 'GLP' },
  ],
  mobile_combustion: [
    { value: 'diesel', label: 'Diésel' },
    { value: 'gasoline', label: 'Gasolina' },
    { value: 'lpg', label: 'GLP' },
  ],
  purchased_electricity: [
    { value: 'SEIN_PERU', label: 'SEIN — Perú' },
    { value: 'LATAM_AVG', label: 'Promedio LATAM' },
    { value: 'US_AVERAGE', label: 'Promedio EE.UU.' },
    { value: 'EU_AVERAGE', label: 'Promedio UE' },
  ],
  fugitive: [
    { value: 'R410A', label: 'R-410A' },
    { value: 'R134A', label: 'R-134A' },
    { value: 'R32', label: 'R-32' },
  ],
};

const UNIDADES_POR_FUENTE: Record<EmissionSourceType, Unit[]> = {
  stationary_combustion: ['m3_ng', 'ft3_ng', 'L', 'gallon', 'GJ', 'kWh', 'therms', 'MJ'],
  mobile_combustion: ['L', 'gallon', 'imp_gallon'],
  purchased_electricity: ['kWh', 'MWh'],
  purchased_steam: ['kWh', 'GJ', 'MJ'],
  fugitive: ['kg', 'lb', 'tonne'],
};

interface Periodo {
  id: string;
  label: string;
  supplier_name: string;
}

interface ActivityFormProps {
  periods: Periodo[];
}

export function ActivityForm({ periods }: ActivityFormProps) {
  const [state, formAction, isPending] = useActionState<ActivityFormState | null, FormData>(
    createActivityEntry,
    null,
  );
  const [sourceType, setSourceType] = useState<EmissionSourceType>('stationary_combustion');

  const opcionesSecundarias = OPCIONES_SECUNDARIAS[sourceType] ?? [];
  const opcionesUnidad = UNIDADES_POR_FUENTE[sourceType];
  const labelSecundario =
    sourceType === 'purchased_electricity'
      ? 'Región de red eléctrica'
      : sourceType === 'fugitive'
        ? 'Refrigerante'
        : 'Tipo de combustible';

  const errCampo = (key: string) => state?.fieldErrors?.[key]?.[0];

  return (
    <form
      action={formAction}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
    >
      <style>{`@keyframes ringSpin { to { transform: rotate(360deg); } }`}</style>

      {state?.error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-3)',
            padding: 'var(--space-4)',
            background: 'var(--color-signal-hi-bg)',
            border: '1px solid var(--color-signal-hi)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
          }}
        >
          <span style={{ fontSize: '15px', lineHeight: 1, flexShrink: 0, color: 'var(--color-signal-hi)' }}>✗</span>
          <span style={{ color: 'var(--color-ink-1)' }}>{state.error}</span>
        </div>
      )}

      {state?.success && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-3)',
            padding: 'var(--space-4)',
            background: 'var(--color-signal-ok-bg)',
            border: '1px solid var(--color-signal-ok)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
          }}
        >
          <span style={{ fontSize: '15px', lineHeight: 1, flexShrink: 0, color: 'var(--color-signal-ok)' }}>✓</span>
          <div>
            <strong style={{ color: 'var(--color-signal-ok)', display: 'block', marginBottom: '2px' }}>
              Registro enviado
            </strong>
            <span style={{ color: 'var(--color-ink-2)' }}>El dato fue registrado correctamente.</span>
          </div>
        </div>
      )}

      {/* Periodo de reporte */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <label
          htmlFor="af-period"
          style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)', fontWeight: 500 }}
        >
          Periodo de reporte
        </label>
        <select
          id="af-period"
          name="reporting_period_id"
          required
          style={estiloSelect(!!errCampo('reporting_period_id'))}
          disabled={periods.length === 0}
        >
          {periods.length === 0 ? (
            <option value="">Sin periodos abiertos disponibles</option>
          ) : (
            periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.supplier_name} — {p.label}
              </option>
            ))
          )}
        </select>
        {errCampo('reporting_period_id') && <ErrorCampo msg={errCampo('reporting_period_id')!} />}
      </div>

      {/* Tipo de fuente */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <label
          htmlFor="af-source"
          style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)', fontWeight: 500 }}
        >
          Fuente de emisión
        </label>
        <select
          id="af-source"
          name="source_type"
          required
          style={estiloSelect()}
          value={sourceType}
          onChange={(e) => setSourceType(e.target.value as EmissionSourceType)}
        >
          {(Object.keys(ETIQUETAS_FUENTE) as EmissionSourceType[]).map((t) => (
            <option key={t} value={t}>
              {ETIQUETAS_FUENTE[t]}
            </option>
          ))}
        </select>
      </div>

      {/* Secundario — combustible / región / refrigerante */}
      {opcionesSecundarias.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <label
            htmlFor="af-secondary"
            style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)', fontWeight: 500 }}
          >
            {labelSecundario}
          </label>
          <select id="af-secondary" name="secondary" required style={estiloSelect(!!errCampo('secondary'))}>
            {opcionesSecundarias.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {errCampo('secondary') && <ErrorCampo msg={errCampo('secondary')!} />}
        </div>
      )}

      {sourceType === 'purchased_steam' && <input type="hidden" name="secondary" value="" />}

      {/* Cantidad + Unidad */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <label
            htmlFor="af-qty"
            style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)', fontWeight: 500 }}
          >
            Cantidad
          </label>
          <input
            id="af-qty"
            name="raw_quantity"
            type="number"
            step="any"
            min="0"
            required
            placeholder="0.00"
            style={estiloInput(!!errCampo('raw_quantity'))}
          />
          {errCampo('raw_quantity') && <ErrorCampo msg={errCampo('raw_quantity')!} />}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <label
            htmlFor="af-unit"
            style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)', fontWeight: 500 }}
          >
            Unidad
          </label>
          <select id="af-unit" name="raw_unit" required style={estiloSelect(!!errCampo('raw_unit'))}>
            {opcionesUnidad.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          {errCampo('raw_unit') && <ErrorCampo msg={errCampo('raw_unit')!} />}
        </div>
      </div>

      {/* Notas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <label
          htmlFor="af-notes"
          style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)', fontWeight: 500 }}
        >
          Notas <span style={{ color: 'var(--color-ink-3)', fontWeight: 400 }}>(opcional)</span>
        </label>
        <textarea
          id="af-notes"
          name="notes"
          rows={2}
          placeholder="Descripción de la fuente, ID de medidor, referencia de factura…"
          style={{ ...estiloInput(), resize: 'vertical', fontFamily: 'inherit' }}
        />
      </div>

      <button
        type="submit"
        disabled={isPending || periods.length === 0}
        style={{
          padding: 'var(--space-2) var(--space-4)',
          background: isPending || periods.length === 0 ? 'var(--color-ink-3)' : 'var(--color-accent)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
          cursor: isPending || periods.length === 0 ? 'not-allowed' : 'pointer',
          alignSelf: 'flex-start',
          transition: 'opacity 150ms',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}
      >
        {isPending ? (
          <>
            <span
              style={{
                width: '12px', height: '12px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: 'white',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'ringSpin 0.7s linear infinite',
              }}
            />
            Enviando…
          </>
        ) : 'Enviar registro'}
      </button>
    </form>
  );
}

function estiloInput(hasError = false): React.CSSProperties {
  return {
    padding: 'var(--space-2) var(--space-3)',
    background: 'var(--color-surface-2)',
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

function ErrorCampo({ msg }: { msg: string }) {
  return <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-signal-hi)' }}>{msg}</span>;
}
