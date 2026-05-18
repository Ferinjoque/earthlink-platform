import { z } from 'zod';

const SOURCE_TYPES = [
  'stationary_combustion',
  'mobile_combustion',
  'purchased_electricity',
  'purchased_steam',
  'fugitive',
] as const;

const csvRowSchema = z.object({
  reporting_period_id: z.string().uuid('Must be a valid UUID'),
  source_type: z.enum(SOURCE_TYPES, { message: 'Invalid source type' }),
  secondary: z.string(),
  raw_quantity: z.coerce.number().positive('Must be positive'),
  raw_unit: z.string().min(1, 'Unit is required'),
  notes: z.string().optional(),
});

export type CsvRowInput = z.infer<typeof csvRowSchema>;

export interface ParsedCsvRow {
  rowIndex: number;
  data: CsvRowInput | null;
  errors: string[];
}

function splitCsvLine(line: string): string[] {
  const cols: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      cols.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cols.push(current.trim());
  return cols;
}

const HEADER_MARKER = 'reporting_period_id';

export function parseCsvText(text: string): ParsedCsvRow[] {
  const lines = text
    .split('\n')
    .map((l) => l.replace(/\r$/, '').trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const dataLines =
    lines[0] && lines[0].toLowerCase().includes(HEADER_MARKER) ? lines.slice(1) : lines;

  return dataLines.map((line, i) => {
    const [reporting_period_id, source_type, secondary, raw_quantity, raw_unit, notes] =
      splitCsvLine(line);

    const result = csvRowSchema.safeParse({
      reporting_period_id,
      source_type,
      secondary: secondary ?? '',
      raw_quantity,
      raw_unit,
      notes: notes ?? '',
    });

    if (!result.success) {
      return {
        rowIndex: i + 1,
        data: null,
        errors: result.error.issues.map((e) => `${e.path.join('.') || 'row'}: ${e.message}`),
      };
    }

    return { rowIndex: i + 1, data: result.data, errors: [] };
  });
}
