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
  notes: z.string().max(1000).optional(),
});

export type CsvRowInput = z.infer<typeof csvRowSchema>;

export interface ParsedCsvRow {
  rowIndex: number;
  data: CsvRowInput | null;
  errors: string[];
}

// Campo canónico → aliases aceptados de columna (en minúsculas, espacios normalizados)
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
  // UUID en primera columna → fila de datos (supplier_id), no es encabezado
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
      data_quality: get('data_quality') || 'measured',
      notes: get('notes') || '',
    };
  } else if (cols.length >= 8) {
    const [supplier_id, year_month, source_type, secondary, raw_quantity, raw_unit, data_quality, notes] = cols;
    raw = {
      supplier_id: supplier_id ?? '',
      year_month: year_month ?? '',
      source_type: source_type ?? '',
      secondary: secondary ?? '',
      raw_quantity: raw_quantity ?? '',
      raw_unit: raw_unit ?? '',
      data_quality: data_quality || 'measured',
      notes: notes ?? '',
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
      data_quality: 'measured',
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
    .filter((l) => l.length > 0 && !l.startsWith('#'));

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

interface SupplierRef {
  id: string;
  name: string;
}

/**
 * Genera la plantilla CSV. Si se pasan proveedores, incluye un bloque de referencia
 * al inicio con el UUID de cada uno para que el usuario pueda copiarlo fácilmente.
 */
export function getCsvTemplate(suppliers?: SupplierRef[]): string {
  const refLines: string[] =
    suppliers && suppliers.length > 0
      ? [
          '# ============================================================',
          '# REFERENCIA DE PROVEEDORES — copiar el UUID correspondiente',
          ...suppliers.map((s) => `# ${s.name}: ${s.id}`),
          '# ============================================================',
        ]
      : [];

  const ejemplo = suppliers?.[0]?.id ?? '<UUID-del-proveedor>';

  return [
    ...refLines,
    'supplier_id,year_month,source_type,secondary,raw_quantity,raw_unit,data_quality,notes',
    '# --- Combustion estacionaria (Alcance 1) | secondary: natural_gas | diesel | lpg | fuel_oil_no2 | propane',
    '# --- Unidades: m3_ng | ft3_ng | L | gallon | kBtu | therms | MMBtu | MBtu | MJ | GJ | kWh',
    `${ejemplo},2026-01,stationary_combustion,natural_gas,1000,m3_ng,measured,Caldera A`,
    `${ejemplo},2026-01,stationary_combustion,diesel,500,L,measured,Generador de emergencia`,
    `${ejemplo},2026-01,stationary_combustion,lpg,200,L,estimated,Cocina industrial`,
    `${ejemplo},2026-01,stationary_combustion,fuel_oil_no2,300,kBtu,measured,Caldera auxiliar`,
    `${ejemplo},2026-01,stationary_combustion,propane,100,L,estimated,Calefaccion exterior`,
    '# --- Combustion movil (Alcance 1) | secondary: diesel | gasoline | lpg',
    '# --- Unidades: L | gallon | imp_gallon',
    `${ejemplo},2026-01,mobile_combustion,diesel,200,L,measured,Flota de vehiculos`,
    `${ejemplo},2026-01,mobile_combustion,gasoline,150,L,measured,Vehiculos livianos`,
    `${ejemplo},2026-01,mobile_combustion,lpg,80,L,estimated,Montacargas`,
    '# --- Electricidad comprada (Alcance 2) | secondary: SEIN_PERU | LATAM_AVG | US_AVERAGE | EU_AVERAGE',
    '# --- Unidades: kWh | MWh | GJ',
    `${ejemplo},2026-01,purchased_electricity,SEIN_PERU,5000,kWh,measured,Piso 2 oficinas`,
    `${ejemplo},2026-01,purchased_electricity,LATAM_AVG,1200,kWh,measured,Sede regional`,
    '# --- Vapor comprado (Alcance 2) | secondary: (vacio)',
    '# --- Unidades: kWh | MWh | GJ',
    `${ejemplo},2026-01,purchased_steam,,100,GJ,calculated,`,
    '# --- Emisiones fugitivas (Alcance 1) | secondary: R410A | R134A | R32',
    '# --- Unidades: kg | lb | tonne',
    `${ejemplo},2026-01,fugitive,R410A,5,kg,measured,Mantenimiento HVAC`,
    `${ejemplo},2026-01,fugitive,R134A,2,kg,measured,Camara frigorifica`,
    `${ejemplo},2026-01,fugitive,R32,1.5,kg,measured,Minisplit oficina`,
    '# --- Agua (GRESB) | secondary: all_sources | potable_mixed | potable_indoor | reclaimed_mixed | well_outdoor | other_mixed',
    '# --- Unidades: kgal_us | megaliter | m3 | L | gallon',
    `${ejemplo},2026-01,water_use,potable_mixed,150,kgal_us,measured,Medidor principal`,
    `${ejemplo},2026-01,water_use,reclaimed_mixed,30,kgal_us,estimated,Riego exterior`,
    `${ejemplo},2026-01,water_use,well_outdoor,20,m3,estimated,Pozo norte`,
    '# --- Residuos (GRESB) | secondary: disposed_trash | recycled | composted',
    '# --- Unidades: ton_us | tonne | kg | lb',
    `${ejemplo},2026-01,waste,disposed_trash,2.5,ton_us,measured,Contenedor general`,
    `${ejemplo},2026-01,waste,recycled,1.2,ton_us,measured,Reciclaje papel/carton`,
    `${ejemplo},2026-01,waste,composted,0.8,tonne,measured,Compost residuos organicos`,
  ].join('\n');
}
