'use client';

import { useState, useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Check } from 'lucide-react';
import { createPeriod, type PeriodActionState } from '@/actions/periods';
import { useToast } from '@/components/ui/Toast';

interface Props {
  supplierId: string;
}

const MESES_CORTO = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

function finDeMes(year: number, month: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

const estiloInput: React.CSSProperties = {
  width: '100%',
  padding: 'var(--space-2) var(--space-3)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface-0)',
  fontSize: 'var(--text-sm)',
  color: 'var(--color-ink-1)',
  outline: 'none',
  boxSizing: 'border-box',
};

export function NuevoPeriodoForm({ supplierId }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [label, setLabel] = useState('');

  const [state, formAction, isPending] = useActionState<PeriodActionState | null, FormData>(
    createPeriod,
    null,
  );
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      setAbierto(false);
      setFechaInicio('');
      setFechaFin('');
      setLabel('');
      toast('Periodo creado correctamente', 'success');
      router.refresh();
    }
  }, [state?.success, toast, router]);

  function handleFechaInicio(val: string) {
    setFechaInicio(val);
    if (val) {
      const parts = val.split('-');
      const y = Number(parts[0]);
      const m = Number(parts[1]);
      if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return;
      setFechaFin(finDeMes(y, m));
      setLabel(`${MESES_CORTO[m - 1] ?? ''} ${y}`);
    }
  }

  function cerrar() {
    setAbierto(false);
    setFechaInicio('');
    setFechaFin('');
    setLabel('');
  }

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
        background: 'var(--color-surface-1)',
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
          Fecha inicio *
        </label>
        <input
          name="fecha_inicio"
          type="date"
          required
          value={fechaInicio}
          onChange={(e) => handleFechaInicio(e.target.value)}
          style={estiloInput}
        />
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
        <input
          name="fecha_fin"
          type="date"
          required
          value={fechaFin}
          onChange={(e) => setFechaFin(e.target.value)}
          style={estiloInput}
        />
      </div>

      <div style={{ minWidth: '120px' }}>
        <label
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-ink-2)',
            display: 'block',
            marginBottom: 'var(--space-1)',
          }}
        >
          Etiqueta *
        </label>
        <input
          name="label"
          required
          placeholder="Ene 2026"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          style={estiloInput}
        />
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
          onClick={cerrar}
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

      <p
        style={{
          width: '100%',
          margin: 0,
          fontSize: 'var(--text-xs)',
          color: 'var(--color-ink-3)',
        }}
      >
        Al elegir la fecha de inicio se auto-completan la fecha fin y etiqueta. Puedes ajustarlas
        manualmente.
      </p>
    </form>
  );
}
