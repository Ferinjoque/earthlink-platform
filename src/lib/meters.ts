import type { EmissionSourceType } from '@/types/database';
import { ETIQUETAS_FUENTE, ETIQUETA_UNIDAD } from './activity-options';


export interface EntryWithPeriod {
  source_type: EmissionSourceType;
  secondary: string;
  raw_quantity: number;
  raw_unit: string;
  period_start: string; // ISO date string YYYY-MM-DD
  supplier_name: string;
  supplier_id: string;
}

export interface VirtualMeter {
  id: string; // `${source_type}::${secondary}::${raw_unit}`
  source_type: EmissionSourceType;
  secondary: string;
  unit: string;
  label: string;
  supplier_label: string;
  supplier_id: string;
}

export type MonthData = Record<number, number>; // month (1–12) → quantity sum

export interface MeterYearSummary {
  meter: VirtualMeter;
  monthly: MonthData;
  total: number;
  peak: { month: number; value: number } | null;
}


function meterId(e: EntryWithPeriod): string {
  return `${e.source_type}::${e.secondary}::${e.raw_unit}::${e.supplier_id}`;
}

function meterLabel(source_type: EmissionSourceType, secondary: string, unit: string): string {
  const fuente = ETIQUETAS_FUENTE[source_type] ?? source_type;
  const sec = secondary ? ` — ${secondary}` : '';
  const u = (ETIQUETA_UNIDAD as Record<string, string>)[unit] ?? unit;
  return `${fuente}${sec} (${u})`;
}

export function deriveMeters(entries: EntryWithPeriod[]): VirtualMeter[] {
  const seen = new Map<string, VirtualMeter>();
  for (const e of entries) {
    const id = meterId(e);
    if (!seen.has(id)) {
      seen.set(id, {
        id,
        source_type: e.source_type,
        secondary: e.secondary,
        unit: e.raw_unit,
        label: meterLabel(e.source_type, e.secondary, e.raw_unit),
        supplier_label: e.supplier_name,
        supplier_id: e.supplier_id,
      });
    }
  }
  return [...seen.values()];
}

function parsePeriodDate(isoDate: string): { year: number; month: number } | null {
  const parts = isoDate.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  if (!isFinite(y) || !isFinite(m) || m < 1 || m > 12) return null;
  return { year: y, month: m };
}

export function getAvailableYears(entries: EntryWithPeriod[]): number[] {
  const years = new Set<number>();
  for (const e of entries) {
    const parsed = parsePeriodDate(e.period_start);
    if (parsed) years.add(parsed.year);
  }
  return [...years].sort((a, b) => b - a);
}

export function aggregateByMonth(
  entries: EntryWithPeriod[],
  year: number,
): MeterYearSummary[] {
  const yearEntries = entries.filter((e) => parsePeriodDate(e.period_start)?.year === year);

  const meterMap = new Map<string, MeterYearSummary>();

  for (const e of yearEntries) {
    const id = meterId(e);
    const month = parsePeriodDate(e.period_start)!.month; // 1–12

    if (!meterMap.has(id)) {
      meterMap.set(id, {
        meter: {
          id,
          source_type: e.source_type,
          secondary: e.secondary,
          unit: e.raw_unit,
          label: meterLabel(e.source_type, e.secondary, e.raw_unit),
          supplier_label: e.supplier_name,
          supplier_id: e.supplier_id,
        },
        monthly: {},
        total: 0,
        peak: null,
      });
    }

    const summary = meterMap.get(id)!;
    summary.monthly[month] = (summary.monthly[month] ?? 0) + e.raw_quantity;
    summary.total += e.raw_quantity;
  }

  // Calcular el pico tras toda la agregación
  for (const summary of meterMap.values()) {
    let peak: { month: number; value: number } | null = null;
    for (const [m, v] of Object.entries(summary.monthly)) {
      if (peak === null || v > peak.value) peak = { month: Number(m), value: v };
    }
    summary.peak = peak;
  }

  return [...meterMap.values()].sort((a, b) => b.total - a.total);
}

export const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function formatQuantity(value: number, unit: string): string {
  if (value === 0) return '—';
  const formatted =
    value >= 1_000_000
      ? `${(value / 1_000_000).toFixed(2)} M`
      : value >= 1_000
        ? `${(value / 1_000).toFixed(1)} k`
        : value % 1 === 0
          ? value.toFixed(0)
          : value.toFixed(2);
  const u = (ETIQUETA_UNIDAD as Record<string, string>)[unit] ?? unit;
  return `${formatted} ${u}`;
}
