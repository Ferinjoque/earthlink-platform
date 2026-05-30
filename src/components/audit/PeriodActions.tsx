'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { calculatePeriod, lockPeriod } from '@/actions/audit';
import type { AuditActionState } from '@/actions/audit';
import type { PeriodStatus } from '@/domain/ReportingPeriod';
import { useToast } from '@/components/ui/Toast';

interface PeriodActionsProps {
  periodId: string;
  status: PeriodStatus;
}

const BTN_BASE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 14px',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-xs)',
  fontFamily: 'var(--font-mono)',
  fontWeight: 600,
  border: 'none',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'opacity 150ms',
};

function MensajeError({ msg }: { msg: string }) {
  return (
    <span
      style={{
        display: 'block',
        marginTop: 'var(--space-2)',
        fontSize: 'var(--text-xs)',
        color: 'var(--color-signal-hi)',
        fontFamily: 'var(--font-mono)',
      }}
    >
      {msg}
    </span>
  );
}

export function PeriodActions({ periodId, status }: PeriodActionsProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [calcState, calcAction, calcPending] = useActionState<AuditActionState | null, FormData>(
    calculatePeriod,
    null,
  );
  const [lockState, lockAction, lockPending] = useActionState<AuditActionState | null, FormData>(
    lockPeriod,
    null,
  );

  useEffect(() => {
    if (calcState?.success) {
      const tco2e = calcState.totals ? (calcState.totals.totalCo2eKg / 1000).toFixed(3) : '—';
      toast(`Listo — ${tco2e} tCO₂e calculados. Pendiente de revisión.`, 'success');
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calcState?.success, toast, router]);

  useEffect(() => {
    if (lockState?.success) {
      toast('Periodo bloqueado — los datos son ahora inmutables.', 'success');
      router.refresh();
    }
  }, [lockState?.success, toast, router]);

  if (status === 'open') {
    return (
      <div>
        <form action={calcAction}>
          <input type="hidden" name="period_id" value={periodId} />
          <button
            type="submit"
            disabled={calcPending}
            style={{
              ...BTN_BASE,
              background: calcPending
                ? 'var(--color-ink-3)'
                : 'color-mix(in oklch, #f59e0b 20%, transparent)',
              color: calcPending ? 'var(--color-surface)' : '#d97706',
              opacity: calcPending ? 0.7 : 1,
            }}
          >
            {calcPending ? 'Calculando…' : 'Calcular CO₂e'}
          </button>
        </form>
        {calcState?.error && <MensajeError msg={calcState.error} />}
      </div>
    );
  }

  if (status === 'under_review') {
    return (
      <div>
        <form action={lockAction}>
          <input type="hidden" name="period_id" value={periodId} />
          <button
            type="submit"
            disabled={lockPending}
            style={{
              ...BTN_BASE,
              background: lockPending
                ? 'var(--color-ink-3)'
                : 'color-mix(in oklch, var(--color-ink-1) 10%, transparent)',
              color: lockPending ? 'var(--color-surface)' : 'var(--color-ink-1)',
              opacity: lockPending ? 0.7 : 1,
            }}
          >
            {lockPending ? 'Bloqueando…' : 'Bloquear periodo'}
          </button>
        </form>
        {lockState?.error && <MensajeError msg={lockState.error} />}
      </div>
    );
  }

  return null;
}
