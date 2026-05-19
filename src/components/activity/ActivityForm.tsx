'use client';

import { useActionState, useState, useEffect } from 'react';
import { createActivityEntry } from '@/actions/activity';
import type { ActivityFormState } from '@/actions/activity';
import type { EmissionSourceType } from '@/types/database';
import type { Unit } from '@/calc/types';
import { HelpTooltip } from '@/components/ui/HelpTooltip';
import { MonthYearSelect } from '@/components/ui/MonthYearSelect';
import { useToast } from '@/components/ui/Toast';
import {
  ETIQUETAS_FUENTE,
  AYUDA_FUENTE,
  OPCIONES_SECUNDARIAS,
  UNIDADES_POR_FUENTE,
  etiquetaUnidad,
  labelSecundarioPara,
} from '@/lib/activity-options';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Supplier {
  id: string;
  name: string;
}

interface ActivityFormProps {
  suppliers: Supplier[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function ActivityForm({ suppliers }: ActivityFormProps) {
  const [state, formAction, isPending] = useActionState<ActivityFormState | null, FormData>(
    createActivityEntry,
    null,
  );
  const [sourceType, setSourceType] = useState<EmissionSourceType>('stationary_combustion');
  const [yearMonth, setYearMonth] = useState(currentYearMonth());
  const { toast } = useToast();

  useEffect(() => {
    if (!state?.submittedAt) return;
    if (state.success) toast('Registro enviado correctamente', 'success');
    else if (state.error) toast(state.error, 'error');
  }, [state?.submittedAt]);

  const opcionesSecundarias = OPCIONES_SECUNDARIAS[sourceType] ?? [];
  const opcionesUnidad = UNIDADES_POR_FUENTE[sourceType];
  const labelSecundario = labelSecundarioPara(sourceType);

  const errCampo = (key: string) => state?.fieldErrors?.[key]?.[0];
  const selectedSecundaria = opcionesSecundarias[0] ?? null;
  const noSuppliers = suppliers.length === 0;

  return (
    <form
      action={formAction}
      noValidate
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
    >
      <style>{`@keyframes ringSpin { to { transform: rotate(360deg); } }`}</style>

      {/* Proveedor + Mes (inline grid) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
        {/* Proveedor */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <label
            htmlFor="af-supplier"
            style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)', fontWeight: 500 }}
          >
            Proveedor
          </label>
          <select
            id="af-supplier"
            name="supplier_id"
            required
            style={estiloSelect(!!errCampo('supplier_id'))}
            disabled={noSuppliers}
          >
            {noSuppliers ? (
              <option value="">Sin proveedores disponibles</option>
            ) : (
              suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))
            )}
          </select>
          {errCampo('supplier_id') && <ErrorCampo msg={errCampo('supplier_id')!} />}
        </div>

        {/* Mes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <label
            style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)', fontWeight: 500 }}
          >
            Mes de reporte
          </label>
          <MonthYearSelect
            value={yearMonth}
            onChange={setYearMonth}
            name="year_month"
            hasError={!!errCampo('year_month')}
            style={{ gap: 'var(--space-2)' }}
          />
          {errCampo('year_month') && <ErrorCampo msg={errCampo('year_month')!} />}
        </div>
      </div>

      {/* Tipo de fuente */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <LabelConAyuda
          htmlFor="af-source"
          label="Fuente de emisión"
          ayuda={AYUDA_FUENTE[sourceType]}
          tituloAyuda="¿Qué es esta fuente?"
        />
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
        {(sourceType === 'water_use' || sourceType === 'waste') && (
          <p
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-ink-3)',
              margin: 0,
            }}
          >
            {sourceType === 'water_use'
              ? 'Consumo de agua: se registra para GRESB. No afecta el total de CO₂e.'
              : 'Residuos: se registra para GRESB. No afecta el total de CO₂e.'}
          </p>
        )}
      </div>

      {/* Secundario */}
      {opcionesSecundarias.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <LabelConAyuda
            htmlFor="af-secondary"
            label={labelSecundario}
            {...(selectedSecundaria?.ayuda ? { ayuda: selectedSecundaria.ayuda } : {})}
          />
          <select
            id="af-secondary"
            name="secondary"
            required
            style={estiloSelect(!!errCampo('secondary'))}
          >
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
          <LabelConAyuda
            htmlFor="af-unit"
            label="Unidad"
            tituloAyuda="Unidades disponibles"
            {...(opcionesUnidad[0]?.ayuda ? { ayuda: opcionesUnidad[0].ayuda } : {})}
          />
          <select
            id="af-unit"
            name="raw_unit"
            required
            style={estiloSelect(!!errCampo('raw_unit'))}
          >
            {opcionesUnidad.map(({ unit, ayuda }) => (
              <option key={unit} value={unit} title={ayuda}>
                {etiquetaUnidad(unit)}
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
        disabled={isPending || noSuppliers}
        style={{
          padding: 'var(--space-2) var(--space-4)',
          background:
            isPending || noSuppliers ? 'var(--color-ink-3)' : 'var(--color-accent)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
          cursor: isPending || noSuppliers ? 'not-allowed' : 'pointer',
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
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function LabelConAyuda({
  htmlFor,
  label,
  ayuda,
  tituloAyuda,
}: {
  htmlFor: string;
  label: string;
  ayuda?: string;
  tituloAyuda?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
      <label
        htmlFor={htmlFor}
        style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)', fontWeight: 500 }}
      >
        {label}
      </label>
      {ayuda && (
        <HelpTooltip
          content={ayuda}
          {...(tituloAyuda ? { title: tituloAyuda } : {})}
        />
      )}
    </div>
  );
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

function ErrorCampo({ msg }: { msg: string }) {
  return <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-signal-hi)' }}>{msg}</span>;
}
