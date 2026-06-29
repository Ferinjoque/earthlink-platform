'use client';

import Link from 'next/link';
import { Fragment, useState, useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { PeriodActions } from '@/components/audit/PeriodActions';
import {
  calculateYear,
  closeYear,
  recalculatePeriod,
  unlockPeriod,
  type BatchYearState,
  type RecalculateState,
  type UnlockPeriodState,
} from '@/actions/audit';
import { voidActivityEntry, type VoidEntryState } from '@/actions/activity';
import { formatearKg } from '@/lib/format';
import { variantEstadoPeriodo, etiquetaEstadoPeriodo } from '@/lib/reporting-period';
import { useToast } from '@/components/ui/Toast';
import type { PeriodStatus } from '@/domain/ReportingPeriod';
import type { AnomalySeverity } from '@/types/database';
import {
  AnomaliaItem,
  COLOR_SEVERIDAD,
  type AnomaliaDetalle,
} from '@/components/audit/AnomaliaItem';

export type { AnomaliaDetalle };

export interface ResultadoDetalle {
  id: string;
  activity_entry_id: string;
  source_type: string;
  raw_quantity: number;
  raw_unit: string;
  scope: number;
  co2e_kg: number;
  factor_used: number;
  factor_unit: string;
  calculated_at: string;
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
  sourceTypes: string[];
}

interface AuditTableProps {
  periodos: PeriodoFila[];
  isAdmin: boolean;
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
] as const;

const FUENTE_CORTA: Record<string, string> = {
  stationary_combustion: 'Estacionaria',
  mobile_combustion: 'Móvil',
  purchased_electricity: 'Electricidad',
  purchased_steam: 'Vapor',
  fugitive: 'Fugitiva',
};

const FUENTE_CHIP: Record<string, string> = {
  stationary_combustion: 'Estac.',
  mobile_combustion: 'Móvil',
  purchased_electricity: 'Elec.',
  purchased_steam: 'Vapor',
  fugitive: 'Fug.',
  water_use: 'Agua',
  waste: 'Residuos',
};

function maxSeverity(anomalias: AnomaliaDetalle[]): AnomalySeverity {
  if (anomalias.some((a) => a.severity === 'high')) return 'high';
  if (anomalias.some((a) => a.severity === 'medium')) return 'medium';
  return 'low';
}

interface GrupoAnual {
  supplier_id: string;
  supplier_name: string;
  year: number;
  periodos: PeriodoFila[];
}

function agruparPorAnio(periodos: PeriodoFila[]): GrupoAnual[] {
  const mapa = new Map<string, GrupoAnual>();
  for (const p of periodos) {
    const year = new Date(p.start_date).getUTCFullYear();
    const key = `${p.supplier_id}__${year}`;
    const existing = mapa.get(key);
    if (existing) {
      existing.periodos.push(p);
    } else {
      mapa.set(key, {
        supplier_id: p.supplier_id,
        supplier_name: p.supplier_name,
        year,
        periodos: [p],
      });
    }
  }
  return [...mapa.values()].sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    return a.supplier_name.localeCompare(b.supplier_name, 'es');
  });
}

function mesesFaltantes(periodos: PeriodoFila[], year: number): number[] {
  // Usar getUTCMonth para evitar variaciones de timezone cuando start_date es "YYYY-MM-01"
  const presentes = new Set(periodos.map((p) => new Date(p.start_date).getUTCMonth() + 1));
  const faltantes: number[] = [];
  for (let m = 1; m <= 12; m++) {
    if (!presentes.has(m)) faltantes.push(m);
  }
  const ahora = new Date();
  const mesActual = ahora.getUTCMonth() + 1;
  const anioActual = ahora.getUTCFullYear();
  if (year === anioActual) {
    return faltantes.filter((m) => m < mesActual);
  }
  return faltantes;
}

function resumenEstados(periodos: PeriodoFila[]): Record<PeriodStatus, number> {
  const counts: Record<PeriodStatus, number> = {
    open: 0,
    calculating: 0,
    under_review: 0,
    locked: 0,
  };
  for (const p of periodos) counts[p.status] = (counts[p.status] ?? 0) + 1;
  return counts;
}

function totalCo2eAnio(periodos: PeriodoFila[]): number {
  return periodos.reduce((sum, p) => sum + (p.resumen?.totalCo2eKg ?? 0), 0);
}

function puedeCalcularAnio(periodos: PeriodoFila[], year: number): boolean {
  if (mesesFaltantes(periodos, year).length > 0) return false;
  return periodos.some((p) => p.status === 'open');
}

function puedeCerrarAnio(periodos: PeriodoFila[], year: number): boolean {
  if (periodos.length === 0) return false;
  if (mesesFaltantes(periodos, year).length > 0) return false;
  return (
    periodos.every((p) => p.status === 'under_review' || p.status === 'locked') &&
    periodos.some((p) => p.status === 'under_review')
  );
}

function VoidResultButton({ activityEntryId }: { activityEntryId: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<VoidEntryState | null, FormData>(
    voidActivityEntry,
    null,
  );

  useEffect(() => {
    if (state?.success) {
      toast('Entrada anulada', 'success');
      setOpen(false);
      router.refresh();
    }
    if (state?.error) {
      toast(state.error, 'error');
      setOpen(false);
    }
  }, [state, toast, router]);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          fontSize: '10px',
          fontFamily: 'var(--font-mono)',
          color: 'var(--color-signal-hi)',
          background: 'color-mix(in oklch, var(--color-signal-hi) 10%, transparent)',
          border: '1px solid color-mix(in oklch, var(--color-signal-hi) 22%, transparent)',
          borderRadius: 'var(--radius-md)',
          padding: '2px 7px',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Anular
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 4px)',
            zIndex: 30,
            background: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '8px',
            boxShadow: 'var(--shadow-md)',
            minWidth: '200px',
          }}
        >
          <form
            action={formAction}
            style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
          >
            <input type="hidden" name="entry_id" value={activityEntryId} />
            <input
              name="void_reason"
              required
              placeholder="Motivo de anulación"
              autoFocus
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--color-ink-1)',
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '4px var(--space-2)',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="submit"
                disabled={isPending}
                style={{
                  flex: 1,
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  color: isPending ? 'var(--color-ink-3)' : 'var(--color-signal-hi)',
                  background: 'color-mix(in oklch, var(--color-signal-hi) 10%, transparent)',
                  border: '1px solid color-mix(in oklch, var(--color-signal-hi) 25%, transparent)',
                  borderRadius: 'var(--radius-md)',
                  padding: '3px 6px',
                  cursor: isPending ? 'default' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {isPending ? 'Anulando…' : 'Confirmar anulación'}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--color-ink-3)',
                  background: 'transparent',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '3px 6px',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function UnlockButton({ periodId }: { periodId: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<UnlockPeriodState | null, FormData>(
    unlockPeriod,
    null,
  );

  useEffect(() => {
    if (state?.success) {
      toast('Periodo desbloqueado, ahora en revisión', 'success');
      router.refresh();
    }
    if (state?.error) {
      toast(state.error, 'error');
      setOpen(false);
    }
  }, [state, toast, router]);

  if (open) {
    return (
      <form
        action={formAction}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
      >
        <input type="hidden" name="period_id" value={periodId} />
        <textarea
          name="unlock_reason"
          required
          placeholder="Razón del desbloqueo (obligatorio)"
          rows={2}
          style={{
            fontSize: 'var(--text-xs)',
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-ink-2)',
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-2) var(--space-3)',
            resize: 'none',
            minWidth: '200px',
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <button
            type="submit"
            disabled={isPending}
            style={{
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              color: isPending ? 'var(--color-ink-3)' : 'var(--color-signal-md)',
              background: 'color-mix(in oklch, var(--color-signal-md) 10%, transparent)',
              border: '1px solid color-mix(in oklch, var(--color-signal-md) 30%, transparent)',
              borderRadius: 'var(--radius-md)',
              padding: '3px var(--space-3)',
              cursor: isPending ? 'default' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {isPending ? 'Desbloqueando…' : 'Confirmar desbloqueo'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-ink-3)',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '3px var(--space-2)',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      style={{
        fontSize: 'var(--text-xs)',
        fontFamily: 'var(--font-mono)',
        color: 'var(--color-signal-md)',
        background: 'color-mix(in oklch, var(--color-signal-md) 8%, transparent)',
        border: '1px solid color-mix(in oklch, var(--color-signal-md) 25%, transparent)',
        borderRadius: 'var(--radius-md)',
        padding: '2px var(--space-2)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      Desbloquear
    </button>
  );
}

function ScopeTable({
  rows,
  accentColor,
  periodStatus,
}: {
  rows: ResultadoDetalle[];
  accentColor: string;
  periodStatus: PeriodStatus;
}) {
  const showVoid = periodStatus !== 'locked';
  const total = rows.reduce((s, r) => s + r.co2e_kg, 0);
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
        <thead>
          <tr>
            {['Fuente', 'Cantidad', 'CO₂e', 'Factor', 'Calculado'].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: 'left',
                  padding: '4px var(--space-3)',
                  color: 'var(--color-ink-3)',
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                  borderBottom: `1px solid color-mix(in oklch, ${accentColor} 20%, var(--color-border))`,
                  whiteSpace: 'nowrap',
                }}
              >
                {h}
              </th>
            ))}
            {showVoid && (
              <th
                style={{
                  padding: '4px var(--space-2)',
                  borderBottom: `1px solid color-mix(in oklch, ${accentColor} 20%, var(--color-border))`,
                }}
              />
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={estiloCeldaMini}>{FUENTE_CORTA[r.source_type] ?? r.source_type}</td>
              <td
                style={{ ...estiloCeldaMini, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}
              >
                {r.raw_quantity.toLocaleString('es')} {r.raw_unit}
              </td>
              <td
                style={{
                  ...estiloCeldaMini,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  color: accentColor,
                  whiteSpace: 'nowrap',
                }}
              >
                {formatearKg(r.co2e_kg)}
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
              {showVoid && (
                <td style={{ ...estiloCeldaMini, padding: '4px var(--space-2)' }}>
                  <VoidResultButton activityEntryId={r.activity_entry_id} />
                </td>
              )}
            </tr>
          ))}
          <tr>
            <td
              colSpan={2}
              style={{
                ...estiloCeldaMini,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: 'var(--color-ink-2)',
                paddingTop: 'var(--space-2)',
              }}
            >
              Subtotal
            </td>
            <td
              colSpan={showVoid ? 4 : 3}
              style={{
                ...estiloCeldaMini,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: accentColor,
                paddingTop: 'var(--space-2)',
                whiteSpace: 'nowrap',
              }}
            >
              {formatearKg(total)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ResultadosPanel({
  results,
  periodStatus,
}: {
  results: ResultadoDetalle[];
  periodStatus: PeriodStatus;
}) {
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

  const scope1 = results.filter((r) => r.scope === 1);
  const scope2 = results.filter((r) => r.scope === 2);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {scope1.length > 0 && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 'var(--space-2)',
            }}
          >
            <span
              style={{
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: 'var(--color-accent)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--tracking-wide)',
              }}
            >
              Alcance 1
            </span>
          </div>
          <ScopeTable rows={scope1} accentColor="var(--color-accent)" periodStatus={periodStatus} />
        </div>
      )}
      {scope2.length > 0 && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 'var(--space-2)',
            }}
          >
            <span
              style={{
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: 'var(--color-scope2)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--tracking-wide)',
              }}
            >
              Alcance 2
            </span>
          </div>
          <ScopeTable rows={scope2} accentColor="var(--color-scope2)" periodStatus={periodStatus} />
        </div>
      )}
    </div>
  );
}

function RecalculateButton({ periodId }: { periodId: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [state, formAction, isPending] = useActionState<RecalculateState | null, FormData>(
    recalculatePeriod,
    null,
  );

  useEffect(() => {
    if (state?.success) {
      toast('Periodo recalculado correctamente', 'success');
      setConfirm(false);
      router.refresh();
    }
    if (state?.error) {
      toast(state.error, 'error');
      setConfirm(false);
    }
  }, [state, toast, router]);

  if (confirm) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <form action={formAction}>
          <input type="hidden" name="period_id" value={periodId} />
          <button
            type="submit"
            disabled={isPending}
            style={{
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-signal-md)',
              background: 'color-mix(in oklch, var(--color-signal-md) 10%, transparent)',
              border: '1px solid color-mix(in oklch, var(--color-signal-md) 30%, transparent)',
              borderRadius: 'var(--radius-md)',
              padding: '2px var(--space-2)',
              cursor: isPending ? 'default' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {isPending ? 'Recalculando…' : 'Confirmar'}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setConfirm(false)}
          style={{
            fontSize: 'var(--text-xs)',
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-ink-3)',
            background: 'transparent',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '2px var(--space-2)',
            cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirm(true)}
      style={{
        fontSize: 'var(--text-xs)',
        fontFamily: 'var(--font-mono)',
        color: 'var(--color-ink-3)',
        background: 'transparent',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '2px var(--space-2)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      Recalcular
    </button>
  );
}

function BatchYearControls({
  supplierId,
  supplierName,
  year,
  canCalculate,
  canClose,
  periodCount,
}: {
  supplierId: string;
  supplierName: string;
  year: number;
  canCalculate: boolean;
  canClose: boolean;
  periodCount: number;
}) {
  const { toast } = useToast();
  const [closeConfirm, setCloseConfirm] = useState(false);

  const [calcState, calcFormAction, calcPending] = useActionState<BatchYearState | null, FormData>(
    calculateYear,
    null,
  );
  const [closeState, closeFormAction, closePending] = useActionState<
    BatchYearState | null,
    FormData
  >(closeYear, null);

  useEffect(() => {
    if (calcState?.success) {
      const msg = `Año calculado: ${calcState.calculated ?? 0} periodos procesados${calcState.skipped ? `, ${calcState.skipped} omitidos` : ''}`;
      toast(msg, 'success');
    }
    if (calcState?.error) toast(calcState.error, 'error');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calcState?.success, calcState?.error, toast]);

  useEffect(() => {
    if (closeState?.success) {
      const n = closeState.calculated ?? 0;
      toast(
        `Año ${year} cerrado: ${n} periodo${n === 1 ? '' : 's'} bloqueado${n === 1 ? '' : 's'}`,
        'success',
      );
      setCloseConfirm(false);
    }
    if (closeState?.error) {
      toast(closeState.error, 'error');
      setCloseConfirm(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeState?.success, closeState?.error, year, toast]);

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        flexWrap: 'wrap',
      }}
    >
      {canCalculate && (
        <form action={calcFormAction}>
          <input type="hidden" name="supplier_id" value={supplierId} />
          <input type="hidden" name="year" value={year} />
          <button
            type="submit"
            disabled={calcPending}
            style={{
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              color: calcPending ? 'var(--color-surface)' : '#d97706',
              background: calcPending
                ? 'var(--color-ink-3)'
                : 'color-mix(in oklch, #f59e0b 20%, transparent)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: '5px 12px',
              cursor: calcPending ? 'default' : 'pointer',
              whiteSpace: 'nowrap',
              opacity: calcPending ? 0.7 : 1,
            }}
          >
            {calcPending ? 'Calculando…' : 'Calcular año'}
          </button>
        </form>
      )}

      {canClose && !closeConfirm && (
        <button
          type="button"
          onClick={() => setCloseConfirm(true)}
          style={{
            fontSize: 'var(--text-xs)',
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            color: 'var(--color-ink-1)',
            background: 'color-mix(in oklch, var(--color-ink-1) 10%, transparent)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            padding: '5px 12px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Cerrar año
        </button>
      )}

      {canClose && closeConfirm && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '4px var(--space-3)',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-ink-2)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            Cerrar año {year} de {supplierName}: {periodCount} periodo
            {periodCount === 1 ? '' : 's'}. Irreversible.
          </span>
          <form action={closeFormAction} style={{ display: 'inline-flex', gap: 'var(--space-2)' }}>
            <input type="hidden" name="supplier_id" value={supplierId} />
            <input type="hidden" name="year" value={year} />
            <button
              type="submit"
              disabled={closePending}
              style={{
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                color: 'var(--color-surface-0)',
                background: 'var(--color-ink-1)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: '4px var(--space-3)',
                cursor: closePending ? 'default' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {closePending ? 'Cerrando…' : 'Confirmar cierre'}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setCloseConfirm(false)}
            style={{
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-ink-3)',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '4px var(--space-3)',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

function YearGroupRow({
  grupo,
  collapsed,
  onToggle,
}: {
  grupo: GrupoAnual;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const counts = resumenEstados(grupo.periodos);
  const total = totalCo2eAnio(grupo.periodos);
  const faltantes = mesesFaltantes(grupo.periodos, grupo.year);
  const canCalc = puedeCalcularAnio(grupo.periodos, grupo.year);
  const canClose = puedeCerrarAnio(grupo.periodos, grupo.year);

  const statusParts: string[] = [];
  if (counts.open > 0) statusParts.push(`${counts.open} abierto${counts.open > 1 ? 's' : ''}`);
  if (counts.calculating > 0) statusParts.push(`${counts.calculating} calculando`);
  if (counts.under_review > 0) statusParts.push(`${counts.under_review} en revisión`);
  if (counts.locked > 0)
    statusParts.push(`${counts.locked} bloqueado${counts.locked > 1 ? 's' : ''}`);

  return (
    <tr
      className="audit-year-row"
      style={{
        background: 'color-mix(in oklch, var(--color-accent) 7%, var(--color-surface-1))',
        borderBottom: collapsed ? '1px solid var(--color-border)' : 'none',
        borderTop: '1px solid var(--color-border)',
      }}
    >
      <td
        colSpan={3}
        style={{
          padding: 'var(--space-3) var(--space-4)',
          verticalAlign: 'middle',
        }}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            textAlign: 'left',
          }}
        >
          <span
            style={{
              fontSize: '10px',
              color: 'var(--color-ink-3)',
              transition: 'transform 150ms',
              transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
              display: 'inline-block',
            }}
          >
            ▾
          </span>
          <span
            style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: 'var(--text-sm)',
              color: 'var(--color-ink-1)',
              fontWeight: 500,
            }}
          >
            {grupo.supplier_name}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-ink-3)',
            }}
          >
            {grupo.year}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-ink-3)',
              background: 'var(--color-surface-3)',
              borderRadius: 'var(--radius-md)',
              padding: '1px var(--space-2)',
            }}
          >
            {grupo.periodos.length} {grupo.periodos.length === 1 ? 'mes' : 'meses'}
          </span>
        </button>
      </td>

      <td
        style={{
          padding: 'var(--space-3) var(--space-4)',
          verticalAlign: 'middle',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-ink-3)',
          }}
        >
          {statusParts.join(' · ')}
        </span>
      </td>

      <td
        style={{
          padding: 'var(--space-3) var(--space-4)',
          verticalAlign: 'middle',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          fontWeight: 700,
          color: total > 0 ? 'var(--color-ink-1)' : 'var(--color-ink-3)',
          whiteSpace: 'nowrap',
        }}
      >
        {total > 0 ? formatearKg(total) : '-'}
      </td>

      <td
        colSpan={2}
        style={{
          padding: 'var(--space-3) var(--space-4)',
          verticalAlign: 'middle',
        }}
      >
        {faltantes.length > 0 && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--color-signal-md)',
                fontFamily: 'var(--font-mono)',
                flexShrink: 0,
              }}
            >
              Falta:
            </span>
            {faltantes.map((m) => (
              <span
                key={m}
                style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--color-signal-md)',
                  background: 'color-mix(in oklch, var(--color-signal-md) 12%, transparent)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1px 5px',
                  whiteSpace: 'nowrap',
                }}
              >
                {MESES_CORTO[(m - 1) as number]}
              </span>
            ))}
          </div>
        )}
      </td>

      <td
        style={{
          padding: 'var(--space-3) var(--space-4)',
          verticalAlign: 'middle',
          minWidth: '160px',
        }}
      >
        {(canCalc || canClose) && (
          <BatchYearControls
            supplierId={grupo.supplier_id}
            supplierName={grupo.supplier_name}
            year={grupo.year}
            canCalculate={canCalc}
            canClose={canClose}
            periodCount={grupo.periodos.length}
          />
        )}
      </td>
    </tr>
  );
}

const ESTADOS_FILTRO: { valor: PeriodStatus | 'todos'; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'open', etiqueta: 'Abierto' },
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

export function AuditTable({ periodos, isAdmin }: AuditTableProps) {
  const [filtroEstado, setFiltroEstado] = useState<PeriodStatus | 'todos'>('todos');
  const [expandidoResultados, setExpandidoResultados] = useState<string | null>(null);
  const [expandidoAnomalias, setExpandidoAnomalias] = useState<string | null>(null);
  const [vistaAgrupada, setVistaAgrupada] = useState(true);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  function toggleGrupo(key: string) {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const filtrados = periodos.filter((p) => filtroEstado === 'todos' || p.status === filtroEstado);
  const grupos = agruparPorAnio(filtrados);

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
        <Link
          href="/suppliers"
          className="audit-suppliers-link"
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--color-ink-3)',
            textDecoration: 'none',
            flexShrink: 0,
            padding: 'var(--space-1) var(--space-3)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            transition: 'color 120ms, border-color 120ms',
          }}
        >
          Ir a proveedores
        </Link>
        <style>{`.audit-suppliers-link:hover { color: var(--color-accent) !important; border-color: var(--color-accent) !important; }`}</style>
      </div>

      {/* ── Controles ── */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}
      >
        <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
          {[
            { val: true, label: 'Por año' },
            { val: false, label: 'Lista' },
          ].map(({ val, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => setVistaAgrupada(val)}
              style={{
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-mono)',
                padding: '3px var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border:
                  vistaAgrupada === val
                    ? '1px solid var(--color-accent)'
                    : '1px solid var(--color-border)',
                background: vistaAgrupada === val ? 'var(--color-accent-soft)' : 'transparent',
                color: vistaAgrupada === val ? 'var(--color-accent)' : 'var(--color-ink-3)',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <span
          style={{
            color: 'var(--color-border)',
            fontSize: 'var(--text-xs)',
          }}
        >
          |
        </span>

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
              background: filtroEstado === valor ? 'var(--color-accent-soft)' : 'transparent',
              color: filtroEstado === valor ? 'var(--color-accent)' : 'var(--color-ink-3)',
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
          <style>{`
            .audit-row { background: var(--color-surface-0); }
            .audit-row:hover { background: var(--color-surface-2) !important; }
            .audit-year-row { cursor: default; }
          `}</style>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
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
              {vistaAgrupada
                ? grupos.map((grupo) => {
                    const groupKey = `${grupo.supplier_id}__${grupo.year}`;
                    const isExpanded = expandidos.has(groupKey);

                    return (
                      <Fragment key={groupKey}>
                        <YearGroupRow
                          grupo={grupo}
                          collapsed={!isExpanded}
                          onToggle={() => toggleGrupo(groupKey)}
                        />
                        {isExpanded &&
                          grupo.periodos.map((p) => (
                            <PeriodoRow
                              key={p.id}
                              p={p}
                              isAdmin={isAdmin}
                              expandidoResultados={expandidoResultados}
                              expandidoAnomalias={expandidoAnomalias}
                              setExpandidoResultados={setExpandidoResultados}
                              setExpandidoAnomalias={setExpandidoAnomalias}
                            />
                          ))}
                      </Fragment>
                    );
                  })
                : filtrados.map((p) => (
                    <PeriodoRow
                      key={p.id}
                      p={p}
                      isAdmin={isAdmin}
                      expandidoResultados={expandidoResultados}
                      expandidoAnomalias={expandidoAnomalias}
                      setExpandidoResultados={setExpandidoResultados}
                      setExpandidoAnomalias={setExpandidoAnomalias}
                    />
                  ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PeriodoRow({
  p,
  isAdmin,
  expandidoResultados,
  expandidoAnomalias,
  setExpandidoResultados,
  setExpandidoAnomalias,
}: {
  p: PeriodoFila;
  isAdmin: boolean;
  expandidoResultados: string | null;
  expandidoAnomalias: string | null;
  setExpandidoResultados: React.Dispatch<React.SetStateAction<string | null>>;
  setExpandidoAnomalias: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const inicioFmt = new Date(p.start_date).toLocaleDateString('es', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const finFmt = new Date(p.end_date).toLocaleDateString('es', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const hasResults = p.results.length > 0;
  const hasAnomalias = p.anomalias.length > 0;
  const resultadosAbiertos = expandidoResultados === p.id;
  const anomaliasAbiertas = expandidoAnomalias === p.id;

  return (
    <Fragment>
      <tr
        className="audit-row"
        style={{
          borderBottom:
            resultadosAbiertos || anomaliasAbiertas ? 'none' : '1px solid var(--color-border)',
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
          <Link
            href={`/audit/${p.id}`}
            style={{
              color: 'var(--color-ink-1)',
              textDecoration: 'none',
              fontFamily: 'var(--font-mono)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-accent)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-ink-1)';
            }}
          >
            {p.label}
          </Link>
          {p.sourceTypes.length > 0 && (
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
              {p.sourceTypes.map((st) => (
                <span
                  key={st}
                  style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-ink-3)',
                    background: 'var(--color-surface-3)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1px 5px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {FUENTE_CHIP[st] ?? st}
                </span>
              ))}
            </div>
          )}
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
          <Badge variant={variantEstadoPeriodo(p.status)}>{etiquetaEstadoPeriodo(p.status)}</Badge>
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
            '-'
          )}
        </td>
        <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
          {hasResults ? (
            <button
              type="button"
              onClick={() => setExpandidoResultados((prev) => (prev === p.id ? null : p.id))}
              style={{
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-mono)',
                color: resultadosAbiertos ? 'var(--color-accent)' : 'var(--color-ink-2)',
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
              -
            </span>
          )}
        </td>
        <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
          {hasAnomalias ? (
            (() => {
              const sev = maxSeverity(p.anomalias);
              const sevColor = COLOR_SEVERIDAD[sev];
              return (
                <button
                  type="button"
                  onClick={() => setExpandidoAnomalias((prev) => (prev === p.id ? null : p.id))}
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontFamily: 'var(--font-mono)',
                    color: sevColor,
                    background: anomaliasAbiertas
                      ? `color-mix(in oklch, ${sevColor} 18%, transparent)`
                      : `color-mix(in oklch, ${sevColor} 10%, transparent)`,
                    border: `1px solid color-mix(in oklch, ${sevColor} ${anomaliasAbiertas ? '40%' : '25%'}, transparent)`,
                    borderRadius: 'var(--radius-md)',
                    padding: '3px var(--space-3)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                  aria-expanded={anomaliasAbiertas}
                >
                  {p.anomalias.length} anomal{p.anomalias.length === 1 ? 'ía' : 'ías'}
                </button>
              );
            })()
          ) : (
            <span
              style={{
                color: 'var(--color-ink-3)',
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              -
            </span>
          )}
        </td>
        <td style={{ padding: 'var(--space-3) var(--space-4)', minWidth: '160px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              flexWrap: 'wrap',
            }}
          >
            <PeriodActions periodId={p.id} status={p.status} />
            {p.status === 'locked' && <RecalculateButton periodId={p.id} />}
            {p.status === 'locked' && isAdmin && <UnlockButton periodId={p.id} />}
          </div>
        </td>
      </tr>

      {/* ── Panel resultados expandible ── */}
      {resultadosAbiertos && (
        <tr
          style={{
            borderBottom: anomaliasAbiertas ? 'none' : '1px solid var(--color-border)',
          }}
        >
          <td
            colSpan={8}
            style={{
              padding: 'var(--space-3) var(--space-4) var(--space-4)',
              background: 'oklch(58% 0.16 155 / 4%)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 'var(--space-3)',
              }}
            >
              <p className="eyebrow" style={{ margin: 0, color: 'var(--color-accent)' }}>
                Resultados de emisiones - {p.label}
              </p>
              <button
                type="button"
                onClick={() => setExpandidoResultados(null)}
                aria-label="Cerrar resultados"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-ink-3)',
                  fontSize: '18px',
                  lineHeight: 1,
                  padding: '0 2px',
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>
            <ResultadosPanel results={p.results} periodStatus={p.status} />
          </td>
        </tr>
      )}

      {/* ── Panel anomalías expandible ── */}
      {anomaliasAbiertas && (
        <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
          <td
            colSpan={8}
            style={{
              padding: 'var(--space-3) var(--space-4) var(--space-4)',
              background: 'color-mix(in oklch, var(--color-signal-md) 5%, transparent)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 'var(--space-3)',
              }}
            >
              <p className="eyebrow" style={{ margin: 0, color: 'var(--color-signal-md)' }}>
                Anomalías pendientes - {p.label}
              </p>
              <button
                type="button"
                onClick={() => setExpandidoAnomalias(null)}
                aria-label="Cerrar anomalías"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-ink-3)',
                  fontSize: '18px',
                  lineHeight: 1,
                  padding: '0 2px',
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>
            <div>
              {p.anomalias.map((a) => (
                <AnomaliaItem key={a.id} anomalia={a} />
              ))}
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}
