'use client';

import { useState, useRef, useActionState, useEffect } from 'react';
import { Upload, FileText, X, Table2, Download, Plus } from 'lucide-react';
import { ActivityForm } from './ActivityForm';
import { importActivityCsv, importActivityXlsx } from '@/actions/activity';
import type { CsvImportState } from '@/actions/activity';
import { parseCsvText, getCsvTemplate } from '@/lib/csv';
import type { ParsedCsvRow } from '@/lib/csv';
import { BulkEntryBuilder } from './BulkEntryBuilder';
import { useToast } from '@/components/ui/Toast';

interface Supplier {
  id: string;
  name: string;
}

interface BulkImportPanelProps {
  suppliers: Supplier[];
  defaultSupplierId?: string | undefined;
}

type Tab = 'individual' | 'constructor' | 'archivo';

// ── Template downloads ────────────────────────────────────────────────────────

function downloadCsvTemplate() {
  const blob = new Blob([getCsvTemplate()], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'EarthLink_Actividad_Plantilla.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ── CSV preview table ─────────────────────────────────────────────────────────

const CABECERAS_PREVIEW = ['Fila', 'Proveedor', 'Mes', 'Fuente', 'Cant.', 'Unidad', 'Estado'];

function CsvPreview({ rows, supplierMap }: { rows: ParsedCsvRow[]; supplierMap: Map<string, string> }) {
  const validas = rows.filter((r) => r.errors.length === 0).length;
  const conError = rows.filter((r) => r.errors.length > 0).length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)', margin: 0 }}>
        Vista previa:{' '}
        <strong style={{ color: 'var(--color-accent)' }}>{validas} válidas</strong>
        {conError > 0 && (
          <>
            {', '}
            <strong style={{ color: 'var(--color-signal-hi)' }}>{conError} con errores</strong>
          </>
        )}
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)' }}>
          <thead>
            <tr>
              {CABECERAS_PREVIEW.map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--color-ink-3)', fontWeight: 600, borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.rowIndex}>
                <td style={tdPrev}>{row.rowIndex}</td>
                <td style={tdPrev}>
                  {row.data ? (supplierMap.get(row.data.supplier_id) ?? row.data.supplier_id.slice(0, 8) + '…') : '—'}
                </td>
                <td style={tdPrev}>{row.data?.year_month ?? '—'}</td>
                <td style={tdPrev}>{row.data?.source_type ?? '?'}</td>
                <td style={tdPrev}>{row.data?.raw_quantity ?? '?'}</td>
                <td style={tdPrev}>{row.data?.raw_unit ?? '?'}</td>
                <td style={tdPrev}>
                  {row.errors.length === 0 ? (
                    <span style={{ color: 'var(--color-accent)' }}>✓</span>
                  ) : (
                    <span style={{ color: 'var(--color-signal-hi)' }} title={row.errors.join('; ')}>
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
  );
}

const tdPrev: React.CSSProperties = {
  padding: '4px 8px',
  color: 'var(--color-ink-1)',
  borderBottom: '1px solid var(--color-border)',
  maxWidth: '200px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

// ── File upload tab ───────────────────────────────────────────────────────────

function ArchivoTab({ suppliers }: { suppliers: Supplier[] }) {
  const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));
  const [csvState, csvAction, csvPending] = useActionState<CsvImportState | null, FormData>(
    importActivityCsv, null,
  );
  const [xlsxState, xlsxAction, xlsxPending] = useActionState<CsvImportState | null, FormData>(
    importActivityXlsx, null,
  );
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState<ParsedCsvRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'csv' | 'xlsx' | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [xlsxDownloading, setXlsxDownloading] = useState(false);
  const { toast } = useToast();

  // Two separate file inputs: one for CSV, one for XLSX (inside the XLSX form)
  const csvPickerRef = useRef<HTMLInputElement>(null);
  const xlsxInputRef = useRef<HTMLInputElement>(null);
  const xlsxFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!csvState?.submittedAt) return;
    if (csvState.success) {
      const n = csvState.imported ?? 0;
      toast(`${n} registro${n !== 1 ? 's' : ''} importado${n !== 1 ? 's' : ''}${(csvState.skipped ?? 0) > 0 ? ` · ${csvState.skipped} omitidos` : ''}`, 'success');
    } else if (csvState.error) {
      toast(csvState.error, 'error');
    }
  }, [csvState?.submittedAt]);

  useEffect(() => {
    if (!xlsxState?.submittedAt) return;
    if (xlsxState.success) {
      const n = xlsxState.imported ?? 0;
      toast(`${n} registro${n !== 1 ? 's' : ''} importado${n !== 1 ? 's' : ''}${(xlsxState.skipped ?? 0) > 0 ? ` · ${xlsxState.skipped} omitidos` : ''}`, 'success');
      setFileName(null);
      setFileType(null);
      if (xlsxInputRef.current) xlsxInputRef.current.value = '';
    } else if (xlsxState.error) {
      toast(xlsxState.error, 'error');
    }
  }, [xlsxState?.submittedAt]);

  function handleFile(file: File) {
    if (file.name.endsWith('.xlsx') || file.type.includes('spreadsheetml')) {
      setFileName(file.name);
      setFileType('xlsx');
      setCsvText('');
      setPreview([]);
      // Transfer file to XLSX form input using DataTransfer
      const dt = new DataTransfer();
      dt.items.add(file);
      if (xlsxInputRef.current) xlsxInputRef.current.files = dt.files;
    } else {
      setFileName(file.name);
      setFileType('csv');
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        setCsvText(text);
        setPreview(text.trim() ? parseCsvText(text) : []);
      };
      reader.readAsText(file);
    }
  }

  function handlePickerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function clearFile() {
    setFileName(null);
    setFileType(null);
    setCsvText('');
    setPreview([]);
    if (csvPickerRef.current) csvPickerRef.current.value = '';
    if (xlsxInputRef.current) xlsxInputRef.current.value = '';
  }

  function handleTextChange(val: string) {
    setCsvText(val);
    setPreview(val.trim() ? parseCsvText(val) : []);
    if (val.trim()) {
      setFileName(null);
      setFileType(null);
    }
  }

  async function handleXlsxDownload() {
    setXlsxDownloading(true);
    try {
      const { generateXlsxTemplate } = await import('@/lib/xlsx');
      const uint8 = await generateXlsxTemplate(suppliers);
      const blob = new Blob([uint8 as unknown as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'EarthLink_Actividad_Plantilla.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast('Error al generar la plantilla Excel', 'error');
    } finally {
      setXlsxDownloading(false);
    }
  }

  const csvValidCount = preview.filter((r) => r.errors.length === 0).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <style>{`
        @keyframes ringSpin { to { transform: rotate(360deg); } }
        .drop-zone:hover { border-color: var(--color-accent) !important; background: var(--color-accent-soft) !important; }
        .drop-zone.drag-over { border-color: var(--color-accent) !important; background: var(--color-accent-soft) !important; }
        .tmpl-btn:hover { border-color: var(--color-accent) !important; color: var(--color-accent) !important; }
      `}</style>

      {/* Template downloads */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-3)', fontWeight: 500 }}>Plantillas:</span>
        <button type="button" className="tmpl-btn" onClick={downloadCsvTemplate} style={btnTmpl}>
          <Download size={11} /> CSV
        </button>
        <button
          type="button"
          className="tmpl-btn"
          onClick={handleXlsxDownload}
          disabled={xlsxDownloading}
          style={{ ...btnTmpl, ...(xlsxDownloading ? { opacity: 0.6 } : {}) }}
        >
          {xlsxDownloading ? (
            <span style={{ width: '10px', height: '10px', border: '1.5px solid var(--color-ink-3)', borderTopColor: 'var(--color-accent)', borderRadius: '50%', display: 'inline-block', animation: 'ringSpin 0.7s linear infinite' }} />
          ) : (
            <Download size={11} />
          )}
          Excel
        </button>
      </div>

      {/* Invisible pickers */}
      <input ref={csvPickerRef} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handlePickerChange} style={{ display: 'none' }} />

      {/* Drop zone */}
      {fileName ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', background: 'var(--color-accent-soft)', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-md)' }}>
          <FileText size={16} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--color-accent)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {fileName}
            <span style={{ marginLeft: '8px', fontSize: 'var(--text-xs)', opacity: 0.7 }}>({fileType === 'xlsx' ? 'Excel' : 'CSV'})</span>
          </span>
          <button type="button" onClick={clearFile} aria-label="Quitar archivo" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--color-ink-3)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <X size={14} />
          </button>
        </div>
      ) : (
        <div
          className={`drop-zone${dragOver ? ' drag-over' : ''}`}
          onClick={() => csvPickerRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{ border: '1.5px dashed var(--color-border-strong)', borderRadius: 'var(--radius-md)', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', transition: 'border-color 150ms, background 150ms', background: 'var(--color-surface-0)' }}
        >
          <Upload size={20} style={{ color: 'var(--color-ink-3)' }} />
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)', textAlign: 'center' }}>
            Arrastra o <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>selecciona un archivo</span>
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-3)', fontFamily: 'var(--font-mono)' }}>.csv · .xlsx — hasta 5 MB</span>
        </div>
      )}

      {/* CSV preview */}
      {preview.length > 0 && <CsvPreview rows={preview} supplierMap={supplierMap} />}

      {/* Paste CSV */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <label htmlFor="bulk-csv-area" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)', fontWeight: 500 }}>
          O pega el CSV
        </label>
        <textarea
          id="bulk-csv-area"
          rows={5}
          value={csvText}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder={getCsvTemplate()}
          style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--color-surface-0)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-ink-1)', resize: 'vertical' }}
        />
      </div>

      {/* CSV submit */}
      {(csvText.trim() || fileType === 'csv') && csvValidCount > 0 && (
        <form action={csvAction} noValidate>
          <input type="hidden" name="csv_text" value={csvText} />
          <SubmitBtn disabled={csvPending || csvValidCount === 0} pending={csvPending} label={`Importar ${csvValidCount} fila${csvValidCount !== 1 ? 's' : ''} desde CSV`} />
        </form>
      )}

      {/* XLSX form — file input lives here, populated via DataTransfer on file selection */}
      <form ref={xlsxFormRef} action={xlsxAction} noValidate style={{ display: fileType === 'xlsx' ? 'block' : 'none' }}>
        <input ref={xlsxInputRef} type="file" name="xlsx_file" accept=".xlsx" style={{ display: 'none' }} />
        <SubmitBtn disabled={xlsxPending} pending={xlsxPending} label="Importar desde Excel" />
      </form>
    </div>
  );
}

// ── Main BulkImportPanel ──────────────────────────────────────────────────────

const TABS: { val: Tab; Icon: React.ElementType; label: string; desc: string }[] = [
  { val: 'individual', Icon: Plus, label: 'Un registro', desc: 'Consumo único' },
  { val: 'constructor', Icon: Table2, label: 'Constructor', desc: 'Tabla editable' },
  { val: 'archivo', Icon: Upload, label: 'Subir archivo', desc: 'CSV · Excel' },
];

export function BulkImportPanel({ suppliers, defaultSupplierId }: BulkImportPanelProps) {
  const [tab, setTab] = useState<Tab>('individual');

  return (
    <div style={{ display: 'flex', minHeight: '420px' }}>
      <style>{`
        @keyframes ringSpin { to { transform: rotate(360deg); } }
        .act-tab { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; width: 100%; text-align: left; background: transparent; border: none; border-radius: var(--radius-md); cursor: pointer; font-family: var(--font-sans); transition: background 120ms; }
        .act-tab:hover { background: var(--color-surface-2); }
        .act-tab.active { background: var(--color-accent-soft); }
        .act-tab .at-icon { color: var(--color-ink-3); flex-shrink: 0; margin-top: 2px; transition: color 120ms; }
        .act-tab.active .at-icon { color: var(--color-accent); }
        .at-label { display: block; font-size: var(--text-sm); color: var(--color-ink-2); line-height: 1.3; transition: color 120ms; }
        .act-tab.active .at-label { color: var(--color-accent); font-weight: 600; }
        .at-desc { display: block; font-size: 10px; color: var(--color-ink-3); font-family: var(--font-mono); margin-top: 1px; }
        .tmpl-btn:hover { border-color: var(--color-accent) !important; color: var(--color-accent) !important; }
        .drop-zone:hover { border-color: var(--color-accent) !important; background: var(--color-accent-soft) !important; }
        .drop-zone.drag-over { border-color: var(--color-accent) !important; background: var(--color-accent-soft) !important; }
      `}</style>

      {/* Vertical tab sidebar */}
      <div
        style={{
          width: '160px',
          flexShrink: 0,
          borderRight: '1px solid var(--color-border)',
          padding: 'var(--space-3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-1)',
        }}
      >
        {TABS.map(({ val, Icon, label, desc }) => (
          <button
            key={val}
            type="button"
            className={`act-tab${tab === val ? ' active' : ''}`}
            onClick={() => setTab(val)}
          >
            <span className="at-icon">
              <Icon size={15} />
            </span>
            <span>
              <span className="at-label">{label}</span>
              <span className="at-desc">{desc}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, padding: 'var(--space-6)', overflowX: 'auto' }}>
        {tab === 'individual' && <ActivityForm suppliers={suppliers} />}
        {tab === 'constructor' && (
          <BulkEntryBuilder suppliers={suppliers} defaultSupplierId={defaultSupplierId} />
        )}
        {tab === 'archivo' && <ArchivoTab suppliers={suppliers} />}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const btnTmpl: React.CSSProperties = {
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
  transition: 'border-color 120ms, color 120ms',
};

function SubmitBtn({ disabled, pending, label }: { disabled: boolean; pending: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      style={{ padding: 'var(--space-3) var(--space-5)', background: disabled ? 'var(--color-ink-3)' : 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
    >
      {pending ? (
        <>
          <span style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'ringSpin 0.7s linear infinite' }} />
          Importando…
        </>
      ) : label}
    </button>
  );
}
