import { z } from 'zod';

const SOURCE_TYPES = [
  'stationary_combustion',
  'mobile_combustion',
  'purchased_electricity',
  'purchased_steam',
  'fugitive',
  'water_use',
  'waste',
] as const;

const DATA_QUALITY_VALUES = ['measured', 'estimated', 'calculated'] as const;

const csvRowSchema = z.object({
  supplier_id: z.string().uuid('Debe ser un UUID de proveedor válido'),
  year_month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Formato mes inválido (YYYY-MM, ej: 2026-01)'),
  source_type: z.enum(SOURCE_TYPES, { message: 'Tipo de fuente inválido' }),
  secondary: z.string().default(''),
  raw_quantity: z.coerce.number().positive('Debe ser un número positivo'),
  raw_unit: z.string().min(1, 'Unidad obligatoria'),
  data_quality: z.enum(DATA_QUALITY_VALUES).default('measured'),
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
  supplier_id: [
    'supplier_id',
    'id_proveedor',
    'proveedor_id',
    'id proveedor',
    'proveedor',
  ],
  year_month: [
    'year_month',
    'mes',
    'month',
    'año_mes',
    'ano_mes',
    'year month',
    'mes_año',
    'mes_ano',
    'periodo',
    'fecha',
  ],
  source_type: [
    'source_type',
    'tipo_fuente',
    'fuente',
    'tipo',
    'source',
    'tipo de fuente',
    'tipo_de_fuente',
    'source type',
  ],
  secondary: [
    'secondary',
    'secundario',
    'combustible',
    'refrigerante',
    'region',
    'fuel',
    'refrigerant',
    'grid_region',
    'grid region',
    'tipo combustible',
    'subtipo',
    'subtype',
  ],
  raw_quantity: [
    'raw_quantity',
    'cantidad',
    'quantity',
    'qty',
    'valor',
    'amount',
    'consumo',
    'raw quantity',
  ],
  raw_unit: ['raw_unit', 'unidad', 'unit', 'units', 'uom', 'raw unit'],
  data_quality: [
    'data_quality',
    'calidad',
    'calidad_dato',
    'calidad del dato',
    'quality',
    'data quality',
  ],
  notes: [
    'notes',
    'notas',
    'nota',
    'comentarios',
    'descripcion',
    'description',
    'observaciones',
    'comentario',
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
  const required = ['supplier_id', 'year_month', 'source_type', 'raw_quantity', 'raw_unit'];
  return required.every((r) => map.has(r)) ? map : null;
}

function looksLikeHeader(line: string): boolean {
  const firstCol = line.split(/[,;\t]/)[0]?.trim() ?? '';
  // UUID in first column → data row (supplier_id), not a header
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(firstCol)) {
    return false;
  }
  const lower = line.toLowerCase();
  return (
    lower.includes('supplier') ||
    lower.includes('proveedor') ||
    lower.includes('year_month') ||
    lower.includes('mes') ||
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
      supplier_id: get('supplier_id'),
      year_month: get('year_month'),
      source_type: get('source_type'),
      secondary: get('secondary') || '',
      raw_quantity: get('raw_quantity'),
      raw_unit: get('raw_unit'),
      notes: get('notes') || '',
    };
  } else {
    const [supplier_id, year_month, source_type, secondary, raw_quantity, raw_unit, notes] = cols;
    raw = {
      supplier_id: supplier_id ?? '',
      year_month: year_month ?? '',
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
    'supplier_id,year_month,source_type,secondary,raw_quantity,raw_unit,data_quality,notes',
    '<UUID-del-proveedor>,2026-01,stationary_combustion,natural_gas,1000,m3_ng,measured,Caldera A',
    '<UUID-del-proveedor>,2026-01,stationary_combustion,fuel_oil_no2,500,kBtu,measured,Generador de emergencia',
    '<UUID-del-proveedor>,2026-01,stationary_combustion,propane,200,L,estimated,Calefaccion exterior',
    '<UUID-del-proveedor>,2026-01,purchased_electricity,SEIN_PERU,5000,kWh,measured,Piso 2 oficinas',
    '<UUID-del-proveedor>,2026-01,mobile_combustion,diesel,200,L,measured,Flota de vehiculos',
    '<UUID-del-proveedor>,2026-01,fugitive,R410A,5,kg,measured,Mantenimiento HVAC',
    '<UUID-del-proveedor>,2026-01,purchased_steam,,100,GJ,calculated,',
    '<UUID-del-proveedor>,2026-01,water_use,potable_mixed,150,kgal_us,measured,Medidor principal',
    '<UUID-del-proveedor>,2026-01,water_use,reclaimed_mixed,30,kgal_us,estimated,Riego exterior',
    '<UUID-del-proveedor>,2026-01,waste,disposed_trash,2.5,ton_us,measured,Contenedor general',
    '<UUID-del-proveedor>,2026-01,waste,recycled,1.2,ton_us,measured,Reciclaje papel/carton',
    '<UUID-del-proveedor>,2026-01,waste,composted,0.8,tonne,measured,Compost residuos organicos',
  ].join('\n');
}
