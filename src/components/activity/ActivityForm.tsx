'use client';

import { useActionState, useState } from 'react';
import { createActivityEntry } from '@/actions/activity';
import type { ActivityFormState } from '@/actions/activity';
import type { EmissionSourceType } from '@/types/database';
import type { Unit } from '@/calc/types';

// ── Static lookup tables (mirrors domain EmissionSource rules) ────────────────

const SOURCE_LABELS: Record<EmissionSourceType, string> = {
  stationary_combustion: 'Stationary Combustion (Scope 1)',
  mobile_combustion: 'Mobile Combustion (Scope 1)',
  purchased_electricity: 'Purchased Electricity (Scope 2)',
  purchased_steam: 'Purchased Steam (Scope 2)',
  fugitive: 'Fugitive Emissions (Scope 1)',
};

const SECONDARY_OPTIONS: Partial<Record<EmissionSourceType, { value: string; label: string }[]>> = {
  stationary_combustion: [
    { value: 'natural_gas', label: 'Natural Gas' },
    { value: 'diesel', label: 'Diesel' },
    { value: 'lpg', label: 'LPG' },
  ],
  mobile_combustion: [
    { value: 'diesel', label: 'Diesel' },
    { value: 'gasoline', label: 'Gasoline' },
    { value: 'lpg', label: 'LPG' },
  ],
  purchased_electricity: [
    { value: 'SEIN_PERU', label: 'SEIN — Peru' },
    { value: 'LATAM_AVG', label: 'LATAM Average' },
    { value: 'US_AVERAGE', label: 'US Average' },
    { value: 'EU_AVERAGE', label: 'EU Average' },
  ],
  fugitive: [
    { value: 'R410A', label: 'R-410A' },
    { value: 'R134A', label: 'R-134A' },
    { value: 'R32', label: 'R-32' },
  ],
};

const UNITS_BY_SOURCE: Record<EmissionSourceType, Unit[]> = {
  stationary_combustion: ['m3_ng', 'ft3_ng', 'L', 'gallon', 'GJ', 'kWh', 'therms', 'MJ'],
  mobile_combustion: ['L', 'gallon', 'imp_gallon'],
  purchased_electricity: ['kWh', 'MWh'],
  purchased_steam: ['kWh', 'GJ', 'MJ'],
  fugitive: ['kg', 'lb', 'tonne'],
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Period {
  id: string;
  label: string;
  supplier_name: string;
}

interface ActivityFormProps {
  periods: Period[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ActivityForm({ periods }: ActivityFormProps) {
  const [state, formAction, isPending] = useActionState<ActivityFormState | null, FormData>(
    createActivityEntry,
    null,
  );
  const [sourceType, setSourceType] = useState<EmissionSourceType>('stationary_combustion');

  const secondaryOptions = SECONDARY_OPTIONS[sourceType] ?? [];
  const unitOptions = UNITS_BY_SOURCE[sourceType];
  const secondaryLabel =
    sourceType === 'purchased_electricity'
      ? 'Grid Region'
      : sourceType === 'fugitive'
        ? 'Refrigerant'
        : 'Fuel Type';

  const fieldErr = (key: string) => state?.fieldErrors?.[key]?.[0];

  return (
    <form
      action={formAction}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
    >
      {state?.error && (
        <div
          style={{
            padding: 'var(--space-3)',
            background: 'var(--color-signal-hi-bg)',
            color: 'var(--color-signal-hi)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
          }}
        >
          {state.error}
        </div>
      )}

      {state?.success && (
        <div
          style={{
            padding: 'var(--space-3)',
            background: 'color-mix(in oklch, var(--color-accent) 12%, transparent)',
            color: 'var(--color-accent)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
          }}
        >
          Entry submitted successfully.
        </div>
      )}

      {/* Reporting Period */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <label
          htmlFor="af-period"
          style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)', fontWeight: 500 }}
        >
          Reporting Period
        </label>
        <select
          id="af-period"
          name="reporting_period_id"
          required
          style={selectStyle}
          disabled={periods.length === 0}
        >
          {periods.length === 0 ? (
            <option value="">No open periods available</option>
          ) : (
            periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.supplier_name} — {p.label}
              </option>
            ))
          )}
        </select>
        {fieldErr('reporting_period_id') && <FieldError msg={fieldErr('reporting_period_id')!} />}
      </div>

      {/* Source Type */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <label
          htmlFor="af-source"
          style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)', fontWeight: 500 }}
        >
          Emission Source
        </label>
        <select
          id="af-source"
          name="source_type"
          required
          style={selectStyle}
          value={sourceType}
          onChange={(e) => setSourceType(e.target.value as EmissionSourceType)}
        >
          {(Object.keys(SOURCE_LABELS) as EmissionSourceType[]).map((t) => (
            <option key={t} value={t}>
              {SOURCE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      {/* Secondary — fuel / grid region / refrigerant */}
      {secondaryOptions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <label
            htmlFor="af-secondary"
            style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)', fontWeight: 500 }}
          >
            {secondaryLabel}
          </label>
          <select id="af-secondary" name="secondary" required style={selectStyle}>
            {secondaryOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {fieldErr('secondary') && <FieldError msg={fieldErr('secondary')!} />}
        </div>
      )}

      {/* Hidden secondary for purchased_steam (no options needed) */}
      {sourceType === 'purchased_steam' && <input type="hidden" name="secondary" value="" />}

      {/* Quantity + Unit */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <label
            htmlFor="af-qty"
            style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)', fontWeight: 500 }}
          >
            Quantity
          </label>
          <input
            id="af-qty"
            name="raw_quantity"
            type="number"
            step="any"
            min="0"
            required
            placeholder="0.00"
            style={inputStyle}
          />
          {fieldErr('raw_quantity') && <FieldError msg={fieldErr('raw_quantity')!} />}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <label
            htmlFor="af-unit"
            style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)', fontWeight: 500 }}
          >
            Unit
          </label>
          <select id="af-unit" name="raw_unit" required style={selectStyle}>
            {unitOptions.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          {fieldErr('raw_unit') && <FieldError msg={fieldErr('raw_unit')!} />}
        </div>
      </div>

      {/* Notes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <label
          htmlFor="af-notes"
          style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)', fontWeight: 500 }}
        >
          Notes <span style={{ color: 'var(--color-ink-3)', fontWeight: 400 }}>(optional)</span>
        </label>
        <textarea
          id="af-notes"
          name="notes"
          rows={2}
          placeholder="Source description, meter ID, invoice reference…"
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
        />
      </div>

      <button
        type="submit"
        disabled={isPending || periods.length === 0}
        style={{
          padding: 'var(--space-2) var(--space-4)',
          background: isPending ? 'var(--color-ink-3)' : 'var(--color-accent)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
          cursor: isPending ? 'not-allowed' : 'pointer',
          alignSelf: 'flex-start',
          transition: 'opacity 150ms',
        }}
      >
        {isPending ? 'Submitting…' : 'Submit Entry'}
      </button>
    </form>
  );
}

// ── Shared inline styles ──────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-3)',
  background: 'var(--color-surface-2)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-sm)',
  color: 'var(--color-ink-1)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none',
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
  paddingRight: '28px',
};

function FieldError({ msg }: { msg: string }) {
  return <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-signal-hi)' }}>{msg}</span>;
}
