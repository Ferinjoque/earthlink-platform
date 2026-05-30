'use client';

import Link from 'next/link';
import { useState, useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { resolveAnomaly, type ResolveAnomalyState } from '@/actions/audit';
import { traducirMensajeAnomalia } from '@/lib/anomaly';
import { useToast } from '@/components/ui/Toast';
import type { AnomalySeverity } from '@/types/database';

export interface AnomaliaDetalle {
  id: string;
  activity_entry_id: string;
  source_type: string;
  severity: AnomalySeverity;
  z_score: number | null;
  message: string;
  flagged_at: string;
  raw_quantity: number | null;
  raw_unit: string | null;
}

const FUENTE_CORTA: Record<string, string> = {
  stationary_combustion: 'Estacionaria',
  mobile_combustion: 'Móvil',
  purchased_electricity: 'Electricidad',
  purchased_steam: 'Vapor',
  fugitive: 'Fugitiva',
};

export const COLOR_SEVERIDAD: Record<AnomalySeverity, string> = {
  low: 'var(--color-signal-ok)',
  medium: 'var(--color-signal-md)',
  high: 'var(--color-signal-hi)',
};

export const ETIQUETAS_SEVERIDAD: Record<AnomalySeverity, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
};

export function AnomaliaItem({ anomalia }: { anomalia: AnomaliaDetalle }) {
  const { toast } = useToast();
  const router = useRouter();
  const [resolviendo, setResolviendo] = useState(false);
  const [state, formAction, isPending] = useActionState<ResolveAnomalyState | null, FormData>(
    resolveAnomaly,
    null,
  );

  useEffect(() => {
    if (state?.success) {
      toast('Anomalía marcada como revisada', 'success');
      router.refresh();
    }
  }, [state?.success, toast, router]);

  if (state?.success) return null;

  const sevColor = COLOR_SEVERIDAD[anomalia.severity];

  return (
    <div
      style={{
        padding: 'var(--space-3) 0',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          flexWrap: 'wrap',
          marginBottom: resolviendo ? 'var(--space-3)' : 0,
        }}
      >
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            color: sevColor,
            background: `color-mix(in oklch, ${sevColor} 15%, transparent)`,
            borderRadius: 'var(--radius-md)',
            padding: '2px 6px',
            fontFamily: 'var(--font-mono)',
            flexShrink: 0,
          }}
        >
          {ETIQUETAS_SEVERIDAD[anomalia.severity]}
        </span>

        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-ink-2)',
            fontFamily: 'var(--font-mono)',
            flexShrink: 0,
          }}
        >
          {FUENTE_CORTA[anomalia.source_type] ?? anomalia.source_type}
        </span>

        {anomalia.raw_quantity != null && anomalia.raw_unit && (
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-ink-1)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {anomalia.raw_quantity.toLocaleString('es-PE')} {anomalia.raw_unit}
          </span>
        )}

        {anomalia.z_score !== null && (
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-ink-3)',
              fontFamily: 'var(--font-mono)',
              flexShrink: 0,
            }}
          >
            z={anomalia.z_score.toFixed(2)}
          </span>
        )}

        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-ink-2)',
            flex: 1,
            minWidth: '140px',
          }}
        >
          {traducirMensajeAnomalia(anomalia.message)}
        </span>

        {!resolviendo && (
          <>
            <Link
              href="/activity"
              style={{
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-mono)',
                color: 'var(--color-ink-3)',
                textDecoration: 'none',
                flexShrink: 0,
              }}
            >
              Actividad ↗
            </Link>
            <button
              type="button"
              onClick={() => setResolviendo(true)}
              style={{
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-mono)',
                color: 'var(--color-ink-2)',
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '3px var(--space-3)',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Resolver
            </button>
          </>
        )}
      </div>

      {resolviendo && (
        <form
          action={formAction}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
        >
          <input type="hidden" name="flag_id" value={anomalia.id} />
          <textarea
            name="resolution_note"
            placeholder="Motivo de resolución (opcional)"
            rows={2}
            style={{
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-ink-2)',
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-2) var(--space-3)',
              resize: 'vertical',
              minHeight: '52px',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
            }}
          />
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-2)',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="submit"
              disabled={isPending}
              style={{
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                color: 'var(--color-surface-0)',
                background: isPending ? 'var(--color-ink-3)' : 'var(--color-ink-1)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: '4px var(--space-4)',
                cursor: isPending ? 'default' : 'pointer',
              }}
            >
              {isPending ? 'Guardando…' : 'Confirmar resolución'}
            </button>
            <button
              type="button"
              onClick={() => setResolviendo(false)}
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
            {state?.error && (
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-signal-hi)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {state.error}
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
