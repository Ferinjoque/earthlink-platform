'use client';

import { useActionState, useState, useRef } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { importActivityCsv } from '@/actions/activity';
import type { CsvImportState } from '@/actions/activity';
import { parseCsvText, getCsvTemplate } from '@/lib/csv';
import type { ParsedCsvRow } from '@/lib/csv';

function downloadTemplate() {
  const blob = new Blob([getCsvTemplate()], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plantilla_actividad.csv';
  a.click();
  URL.revokeObjectURL(url);
}

const CABECERAS_PREVIEW = [
  'Fila',
  'ID Periodo',
  'Fuente',
  'Secundario',
  'Cant.',
  'Unidad',
  'Estado',
];

export function CsvImportPanel() {
  const [state, formAction, isPending] = useActionState<CsvImportState | null, FormData>(
    importActivityCsv,
    null,
  );
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState<ParsedCsvRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function loadFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
      setPreview(text.trim() ? parseCsvText(text) : []);
    };
    reader.readAsText(file);
  }

  function handleTextChange(val: string) {
    setCsvText(val);
    setPreview(val.trim() ? parseCsvText(val) : []);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) loadFile(file);
  }

  function clearFile() {
    setFileName(null);
    setCsvText('');
    setPreview([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const filaValidas = preview.filter((r) => r.errors.length === 0).length;
  const filasConError = preview.filter((r) => r.errors.length > 0).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <style>{`
        .csv-drop-zone:hover { border-color: var(--color-accent) !important; background: var(--color-accent-soft) !important; }
        .csv-drop-zone.drag-over { border-color: var(--color-accent) !important; background: var(--color-accent-soft) !important; }
      `}</style>

      {/* ── Zona de carga ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)', fontWeight: 500 }}>
            Cargar archivo CSV
          </span>
          <button
            type="button"
            onClick={downloadTemplate}
            style={{
              background: 'none',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '3px 10px',
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-ink-2)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <span>↓</span> Descargar plantilla
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        {fileName ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--color-accent-soft)',
              border: '1px solid var(--color-accent)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <FileText size={16} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
            <span
              style={{
                flex: 1,
                fontSize: 'var(--text-sm)',
                color: 'var(--color-accent)',
                fontFamily: 'var(--font-mono)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {fileName}
            </span>
            <button
              type="button"
              onClick={clearFile}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px',
                color: 'var(--color-ink-3)',
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
              }}
              aria-label="Quitar archivo"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div
            className={`csv-drop-zone${dragOver ? ' drag-over' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              border: '1.5px dashed var(--color-border-strong)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-6)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--space-2)',
              cursor: 'pointer',
              transition: 'border-color 150ms, background 150ms',
              background: 'var(--color-surface-2)',
            }}
          >
            <Upload size={20} style={{ color: 'var(--color-ink-3)' }} />
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)', textAlign: 'center' }}>
              Arrastra tu CSV aquí o{' '}
              <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>haz clic para seleccionar</span>
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-3)', fontFamily: 'var(--font-mono)' }}>
              .csv — hasta 5 MB
            </span>
          </div>
        )}
      </div>

      {/* O pegar CSV */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <label
          htmlFor="csv-text-area"
          style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)', fontWeight: 500 }}
        >
          O pega el CSV
        </label>
        <textarea
          id="csv-text-area"
          rows={6}
          value={csvText}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder={getCsvTemplate()}
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

      {/* Vista previa */}
      {preview.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)' }}>
            Vista previa:{' '}
            <strong style={{ color: 'var(--color-accent)' }}>{filaValidas} válidas</strong>
            {filasConError > 0 && (
              <>
                {', '}
                <strong style={{ color: 'var(--color-signal-hi)' }}>
                  {filasConError} con errores
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
                  {CABECERAS_PREVIEW.map((h) => (
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
                    <td style={estiloCeldaPreview}>{row.rowIndex}</td>
                    <td style={estiloCeldaPreview}>
                      {row.data?.reporting_period_id.slice(0, 8) ?? '—'}…
                    </td>
                    <td style={estiloCeldaPreview}>{row.data?.source_type ?? '?'}</td>
                    <td style={estiloCeldaPreview}>{row.data?.secondary || '—'}</td>
                    <td style={estiloCeldaPreview}>{row.data?.raw_quantity ?? '?'}</td>
                    <td style={estiloCeldaPreview}>{row.data?.raw_unit ?? '?'}</td>
                    <td style={estiloCeldaPreview}>
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

      {/* Resultado éxito */}
      {state?.success && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-3)',
            padding: 'var(--space-4)',
            background: 'var(--color-signal-ok-bg)',
            border: '1px solid var(--color-signal-ok)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
          }}
        >
          <span style={{ fontSize: '16px', lineHeight: 1, flexShrink: 0 }}>✓</span>
          <div>
            <strong style={{ color: 'var(--color-signal-ok)', display: 'block', marginBottom: '2px' }}>
              Importación completada
            </strong>
            <span style={{ color: 'var(--color-ink-2)' }}>
              {state.imported} registro{state.imported !== 1 ? 's' : ''} importado{state.imported !== 1 ? 's' : ''}
              {(state.skipped ?? 0) > 0 && ` · ${state.skipped} omitidos`}.
            </span>
          </div>
        </div>
      )}

      {/* Error */}
      {state?.error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-3)',
            padding: 'var(--space-4)',
            background: 'var(--color-signal-hi-bg)',
            border: '1px solid var(--color-signal-hi)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
          }}
        >
          <span style={{ fontSize: '16px', lineHeight: 1, flexShrink: 0 }}>✗</span>
          <div>
            <strong style={{ color: 'var(--color-signal-hi)', display: 'block', marginBottom: '2px' }}>
              Error al importar
            </strong>
            <span style={{ color: 'var(--color-ink-2)' }}>{state.error}</span>
          </div>
        </div>
      )}

      {/* Enviar */}
      <form action={formAction}>
        <input type="hidden" name="csv_text" value={csvText} />
        <button
          type="submit"
          disabled={isPending || filaValidas === 0}
          style={{
            padding: 'var(--space-3) var(--space-5)',
            background: isPending || filaValidas === 0 ? 'var(--color-ink-3)' : 'var(--color-accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            cursor: isPending || filaValidas === 0 ? 'not-allowed' : 'pointer',
            transition: 'opacity 150ms, transform 150ms',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          {isPending ? (
            <>
              <span
                style={{
                  width: '12px', height: '12px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'ringSpin 0.7s linear infinite',
                }}
              />
              Importando…
            </>
          ) : (
            `Importar ${filaValidas} fila${filaValidas !== 1 ? 's' : ''}`
          )}
        </button>
      </form>
    </div>
  );
}

const estiloCeldaPreview: React.CSSProperties = {
  padding: '4px 8px',
  color: 'var(--color-ink-1)',
  borderBottom: '1px solid var(--color-border)',
  maxWidth: '200px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
