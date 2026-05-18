'use client';

import { useState, useActionState } from 'react';
import { Plus, X, Check } from 'lucide-react';
import { createPeriod, type PeriodActionState } from '@/actions/periods';

interface Props {
  supplierId: string;
}

const estiloInput: React.CSSProperties = {
  width: '100%',
  padding: 'var(--space-2) var(--space-3)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface-2)',
  fontSize: 'var(--text-sm)',
  color: 'var(--color-ink-1)',
  outline: 'none',
  boxSizing: 'border-box',
};

export function NuevoPeriodoForm({ supplierId }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [state, formAction, isPending] = useActionState<PeriodActionState | null, FormData>(
    createPeriod,
    null,
  );

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-2) var(--space-4)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--fw-medium)',
          color: 'white',
          background: 'var(--color-accent)',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <Plus size={14} />
        Nuevo periodo
      </button>
    );
  }

  return (
    <form
      action={formAction}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--space-3)',
        alignItems: 'flex-end',
        padding: 'var(--space-4)',
        background: 'var(--color-accent-soft)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
      }}
    >
      <input type="hidden" name="supplier_id" value={supplierId} />

      <div style={{ minWidth: '140px' }}>
        <label
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-ink-2)',
            display: 'block',
            marginBottom: 'var(--space-1)',
          }}
        >
          Label *
        </label>
        <input name="label" required placeholder="Ej. Q2-2026" style={estiloInput} />
      </div>

      <div style={{ minWidth: '140px' }}>
        <label
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-ink-2)',
            display: 'block',
            marginBottom: 'var(--space-1)',
          }}
        >
          Fecha inicio *
        </label>
        <input name="fecha_inicio" type="date" required style={estiloInput} />
      </div>

      <div style={{ minWidth: '140px' }}>
        <label
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-ink-2)',
            display: 'block',
            marginBottom: 'var(--space-1)',
          }}
        >
          Fecha fin *
        </label>
        <input name="fecha_fin" type="date" required style={estiloInput} />
      </div>

      {state?.error && (
        <div
          role="alert"
          style={{
            width: '100%',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-signal-hi)',
            background: 'var(--color-signal-hi-bg)',
            padding: 'var(--space-2) var(--space-3)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          {state.error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-2)', marginLeft: 'auto' }}>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            padding: 'var(--space-2) var(--space-3)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-ink-2)',
            background: 'transparent',
            border: '1px solid var(--color-border)',
            cursor: 'pointer',
          }}
        >
          <X size={13} />
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            padding: 'var(--space-2) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--fw-medium)',
            color: 'white',
            background: isPending ? 'var(--color-accent-dim)' : 'var(--color-accent)',
            border: 'none',
            cursor: isPending ? 'not-allowed' : 'pointer',
          }}
        >
          <Check size={13} />
          {isPending ? 'Creando…' : 'Crear periodo'}
        </button>
      </div>
    </form>
  );
}
