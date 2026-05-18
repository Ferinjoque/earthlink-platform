'use client';

import { useActionState, useState } from 'react';
import { importActivityCsv } from '@/actions/activity';
import type { CsvImportState } from '@/actions/activity';
import { parseCsvText } from '@/lib/csv';
import type { ParsedCsvRow } from '@/lib/csv';

const CSV_TEMPLATE = `reporting_period_id,source_type,secondary,raw_quantity,raw_unit,notes
<period-uuid>,stationary_combustion,natural_gas,1000,m3_ng,Boiler A
<period-uuid>,purchased_electricity,SEIN_PERU,5000,kWh,Office floor 2
<period-uuid>,mobile_combustion,diesel,200,L,Fleet vehicles
<period-uuid>,fugitive,R410A,5,kg,HVAC maintenance
<period-uuid>,purchased_steam,,100,GJ,`;

export function CsvImportPanel() {
  const [state, formAction, isPending] = useActionState<CsvImportState | null, FormData>(
    importActivityCsv,
    null,
  );
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState<ParsedCsvRow[]>([]);

  function handleTextChange(val: string) {
    setCsvText(val);
    setPreview(val.trim() ? parseCsvText(val) : []);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
      setPreview(text.trim() ? parseCsvText(text) : []);
    };
    reader.readAsText(file);
  }

  const validCount = preview.filter((r) => r.errors.length === 0).length;
  const errorCount = preview.filter((r) => r.errors.length > 0).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* File upload */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <label style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)', fontWeight: 500 }}>
          Upload CSV file
        </label>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-1)' }}
        />
      </div>

      {/* Or paste text */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <label
          htmlFor="csv-text-area"
          style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)', fontWeight: 500 }}
        >
          Or paste CSV
        </label>
        <textarea
          id="csv-text-area"
          rows={6}
          value={csvText}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder={CSV_TEMPLATE}
          style={{
            padding: 'var(--space-2) var(--space-3)',
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-xs)',
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-ink-1)',
            resize: 'vertical',
          }}
        />
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)' }}>
            Preview: <strong style={{ color: 'var(--color-accent)' }}>{validCount} valid</strong>
            {errorCount > 0 && (
              <>
                {', '}
                <strong style={{ color: 'var(--color-signal-hi)' }}>
                  {errorCount} with errors
                </strong>
              </>
            )}
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <thead>
                <tr>
                  {['Row', 'Period ID', 'Source', 'Secondary', 'Qty', 'Unit', 'Status'].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        padding: '4px 8px',
                        color: 'var(--color-ink-3)',
                        fontWeight: 600,
                        borderBottom: '1px solid var(--color-border)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => (
                  <tr key={row.rowIndex}>
                    <td style={previewCell}>{row.rowIndex}</td>
                    <td style={previewCell}>{row.data?.reporting_period_id.slice(0, 8) ?? '—'}…</td>
                    <td style={previewCell}>{row.data?.source_type ?? '?'}</td>
                    <td style={previewCell}>{row.data?.secondary || '—'}</td>
                    <td style={previewCell}>{row.data?.raw_quantity ?? '?'}</td>
                    <td style={previewCell}>{row.data?.raw_unit ?? '?'}</td>
                    <td style={previewCell}>
                      {row.errors.length === 0 ? (
                        <span style={{ color: 'var(--color-accent)' }}>✓</span>
                      ) : (
                        <span
                          style={{ color: 'var(--color-signal-hi)' }}
                          title={row.errors.join('; ')}
                        >
                          ✗ {row.errors[0]}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Result feedback */}
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
          Imported {state.imported} entries
          {(state.skipped ?? 0) > 0 && `, ${state.skipped} skipped`}.
        </div>
      )}
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

      {/* Submit */}
      <form action={formAction}>
        <input type="hidden" name="csv_text" value={csvText} />
        <button
          type="submit"
          disabled={isPending || validCount === 0}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            background:
              isPending || validCount === 0 ? 'var(--color-ink-3)' : 'var(--color-accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            cursor: isPending || validCount === 0 ? 'not-allowed' : 'pointer',
            transition: 'opacity 150ms',
          }}
        >
          {isPending ? 'Importing…' : `Import ${validCount} rows`}
        </button>
      </form>
    </div>
  );
}

const previewCell: React.CSSProperties = {
  padding: '4px 8px',
  color: 'var(--color-ink-1)',
  borderBottom: '1px solid var(--color-border)',
  maxWidth: '200px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
