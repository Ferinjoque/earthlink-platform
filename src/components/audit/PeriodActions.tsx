'use client';

import { useActionState } from 'react';
import { calculatePeriod, lockPeriod } from '@/actions/audit';
import type { AuditActionState } from '@/actions/audit';
import type { PeriodStatus } from '@/domain/ReportingPeriod';

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

function ErrorMsg({ msg }: { msg: string }) {
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

function SuccessMsg({ msg }: { msg: string }) {
  return (
    <span
      style={{
        display: 'block',
        marginTop: 'var(--space-2)',
        fontSize: 'var(--text-xs)',
        color: 'var(--color-signal-ok)',
        fontFamily: 'var(--font-mono)',
      }}
    >
      {msg}
    </span>
  );
}

export function PeriodActions({ periodId, status }: PeriodActionsProps) {
  const [calcState, calcAction, calcPending] = useActionState<AuditActionState | null, FormData>(
    calculatePeriod,
    null,
  );
  const [lockState, lockAction, lockPending] = useActionState<AuditActionState | null, FormData>(
    lockPeriod,
    null,
  );

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
            {calcPending ? 'Calculating…' : 'Calculate CO₂e'}
          </button>
        </form>
        {calcState?.error && <ErrorMsg msg={calcState.error} />}
        {calcState?.success && calcState.totals && (
          <SuccessMsg
            msg={`Done — ${(calcState.totals.totalCo2eKg / 1000).toFixed(3)} tCO₂e across ${calcState.totals.entryCount} entries`}
          />
        )}
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
            {lockPending ? 'Locking…' : '🔒 Lock Period'}
          </button>
        </form>
        {lockState?.error && <ErrorMsg msg={lockState.error} />}
        {lockState?.success && <SuccessMsg msg="Period locked — data is now immutable." />}
      </div>
    );
  }

  return null;
}
