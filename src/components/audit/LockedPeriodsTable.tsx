'use client';

import { useState } from 'react';
import { formatearKg } from '@/lib/format';

interface LockedPeriodRow {
  id: string;
  supplier_name: string;
  label: string;
  start_date: string;
  totalCo2eKg: number;
  scope1Co2eKg: number;
  scope2Co2eKg: number;
  nResultados: number;
}

const PAGE_VISIBLE = 8;

const COL: React.CSSProperties = {
  textAlign: 'left',
  padding: 'var(--space-3) var(--space-4)',
  fontSize: 'var(--text-xs)',
  fontFamily: 'var(--font-mono)',
  color: 'var(--color-ink-3)',
  fontWeight: 600,
  borderBottom: '1px solid var(--color-border)',
  whiteSpace: 'nowrap',
};

export function LockedPeriodsTable({ rows }: { rows: LockedPeriodRow[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? rows : rows.slice(0, PAGE_VISIBLE);
  const totalCo2e = rows.reduce((s, r) => s + r.totalCo2eKg, 0);

  return (
    <div
      style={{
        background: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}
    >
      <style>{`
        .locked-row { background: var(--color-surface-1); transition: background 100ms; }
        .locked-row:hover { background: var(--color-surface-2) !important; }
      `}</style>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 'var(--space-4) var(--space-5)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div>
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
            Total auditado
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-base)',
              fontWeight: 700,
              color: 'var(--color-ink-1)',
              marginLeft: 'var(--space-3)',
            }}
          >
            {formatearKg(totalCo2e)}
          </span>
        </div>
        <span
          style={{
            fontSize: 'var(--text-xs)',
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-ink-3)',
          }}
        >
          {rows.length} {rows.length === 1 ? 'periodo bloqueado' : 'periodos bloqueados'}
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '500px' }}>
          <thead>
            <tr>
              <th style={COL}>Proveedor</th>
              <th style={COL}>Periodo</th>
              <th style={{ ...COL, textAlign: 'right' }}>CO₂e total</th>
              <th style={{ ...COL, textAlign: 'right' }}>Alcance 1</th>
              <th style={{ ...COL, textAlign: 'right' }}>Alcance 2</th>
              <th style={{ ...COL, textAlign: 'right' }}>Entradas</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr
                key={row.id}
                className="locked-row"
                style={{
                  borderBottom: i < visible.length - 1 ? '1px solid var(--color-border)' : 'none',
                }}
              >
                <td
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-ink-1)',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.supplier_name}
                </td>
                <td
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-ink-2)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.label}
                </td>
                <td
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 700,
                    color: 'var(--color-accent)',
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatearKg(row.totalCo2eKg)}
                </td>
                <td
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-ink-2)',
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatearKg(row.scope1Co2eKg)}
                </td>
                <td
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-scope2)',
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatearKg(row.scope2Co2eKg)}
                </td>
                <td
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-ink-3)',
                    textAlign: 'right',
                  }}
                >
                  {row.nResultados}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > PAGE_VISIBLE && (
        <div
          style={{
            padding: 'var(--space-3) var(--space-5)',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            style={{
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-ink-3)',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '3px var(--space-4)',
              cursor: 'pointer',
            }}
          >
            {showAll ? 'Mostrar menos' : `Ver todos (${rows.length - PAGE_VISIBLE} más)`}
          </button>
        </div>
      )}
    </div>
  );
}
