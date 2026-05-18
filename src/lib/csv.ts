import { z } from 'zod';

const SOURCE_TYPES = [
  'stationary_combustion',
  'mobile_combustion',
  'purchased_electricity',
  'purchased_steam',
  'fugitive',
] as const;

const csvRowSchema = z.object({
  reporting_period_id: z.string().uuid('Debe ser un UUID válido'),
  source_type: z.enum(SOURCE_TYPES, { message: 'Tipo de fuente inválido' }),
  secondary: z.string().default(''),
  raw_quantity: z.coerce.number().positive('Debe ser un número positivo'),
  raw_unit: z.string().min(1, 'Unidad obligatoria'),
  notes: z.string().optional(),
});

export type CsvRowInput = z.infer<typeof csvRowSchema>;

export interface ParsedCsvRow {
  rowIndex: number;
  data: CsvRowInput | null;
  errors: string[];
}

// Canonical field → accepted header aliases (lowercased, spaces normalised)
const COL_ALIASES: Record<string, string[]> = {
  reporting_period_id: [
    'reporting_period_id', 'period_id', 'periodo_id', 'id_periodo', 'periodo',
    'id periodo', 'id_del_periodo', 'reporting period id',
  ],
  source_type: [
    'source_type', 'tipo_fuente', 'fuente', 'tipo', 'source', 'tipo de fuente',
    'tipo_de_fuente', 'source type',
  ],
  secondary: [
    'secondary', 'secundario', 'combustible', 'refrigerante', 'region',
    'fuel', 'refrigerant', 'grid_region', 'grid region', 'tipo combustible',
  ],
  raw_quantity: [
    'raw_quantity', 'cantidad', 'quantity', 'qty', 'valor', 'amount',
    'consumo', 'raw quantity',
  ],
  raw_unit: ['raw_unit', 'unidad', 'unit', 'units', 'uom', 'raw unit'],
  notes: [
    'notes', 'notas', 'nota', 'comentarios', 'descripcion', 'description',
    'observaciones', 'comentario',
  ],
};

function detectDelimiter(line: string): string {
  const commas = (line.match(/,/g) ?? []).length;
  const semis = (line.match(/;/g) ?? []).length;
  const tabs = (line.match(/\t/g) ?? []).length;
  if (tabs >= Math.max(commas, semis) && tabs > 0) return '\t';
  if (semis > commas) return ';';
  return ',';
}

function splitLine(line: string, sep: string): string[] {
  const cols: string[] = [];
  let cur = '';
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') {
      inQ = !inQ;
    } else if (ch === sep && !inQ) {
      cols.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  cols.push(cur.trim());
  return cols;
}

function normaliseKey(h: string): string {
  return h
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 _]/g, '')
    .replace(/ /g, '_');
}

function resolveColumn(raw: string): string | null {
  const key = normaliseKey(raw);
  for (const [canonical, aliases] of Object.entries(COL_ALIASES)) {
    if (aliases.some((a) => a.replace(/ /g, '_') === key || a === key)) {
      return canonical;
    }
  }
  return null;
}

function buildColMap(headerLine: string, sep: string): Map<string, number> | null {
  const cols = splitLine(headerLine, sep);
  const map = new Map<string, number>();
  cols.forEach((col, i) => {
    const canonical = resolveColumn(col);
    if (canonical && !map.has(canonical)) map.set(canonical, i);
  });
  const required = ['reporting_period_id', 'source_type', 'raw_quantity', 'raw_unit'];
  return required.every((r) => map.has(r)) ? map : null;
}

function looksLikeHeader(line: string): boolean {
  const lower = line.toLowerCase();
  return (
    lower.includes('period') ||
    lower.includes('fuente') ||
    lower.includes('source') ||
    lower.includes('cantidad') ||
    lower.includes('quantity') ||
    lower.includes('unidad') ||
    lower.includes('unit')
  );
}

function parseRow(
  line: string,
  sep: string,
  colMap: Map<string, number> | null,
  rowIndex: number,
): ParsedCsvRow {
  const cols = splitLine(line, sep);

  let raw: Record<string, string>;
  if (colMap) {
    const get = (field: string) => {
      const idx = colMap.get(field);
      return idx !== undefined ? (cols[idx] ?? '') : '';
    };
    raw = {
      reporting_period_id: get('reporting_period_id'),
      source_type: get('source_type'),
      secondary: get('secondary') || '',
      raw_quantity: get('raw_quantity'),
      raw_unit: get('raw_unit'),
      notes: get('notes') || '',
    };
  } else {
    const [reporting_period_id, source_type, secondary, raw_quantity, raw_unit, notes] = cols;
    raw = {
      reporting_period_id: reporting_period_id ?? '',
      source_type: source_type ?? '',
      secondary: secondary ?? '',
      raw_quantity: raw_quantity ?? '',
      raw_unit: raw_unit ?? '',
      notes: notes ?? '',
    };
  }

  const result = csvRowSchema.safeParse(raw);
  if (!result.success) {
    return {
      rowIndex,
      data: null,
      errors: result.error.issues.map((e) => `${e.path.join('.') || 'fila'}: ${e.message}`),
    };
  }
  return { rowIndex, data: result.data, errors: [] };
}

export function parseCsvText(text: string): ParsedCsvRow[] {
  const lines = text
    .split('\n')
    .map((l) => l.replace(/\r$/, '').trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const firstLine = lines[0]!;
  const sep = detectDelimiter(firstLine);

  const hasHeader = looksLikeHeader(firstLine);
  let colMap: Map<string, number> | null = null;
  let dataLines = lines;

  if (hasHeader) {
    colMap = buildColMap(firstLine, sep);
    dataLines = lines.slice(1);
  }

  return dataLines.map((line, i) => parseRow(line, sep, colMap, i + 1));
}

export function getCsvTemplate(): string {
  return [
    'reporting_period_id,source_type,secondary,raw_quantity,raw_unit,notes',
    '<UUID-del-periodo>,stationary_combustion,natural_gas,1000,m3_ng,Caldera A',
    '<UUID-del-periodo>,purchased_electricity,SEIN_PERU,5000,kWh,Piso 2 oficinas',
    '<UUID-del-periodo>,mobile_combustion,diesel,200,L,Flota de vehiculos',
    '<UUID-del-periodo>,fugitive,R410A,5,kg,Mantenimiento HVAC',
    '<UUID-del-periodo>,purchased_steam,,100,GJ,',
  ].join('\n');
}
