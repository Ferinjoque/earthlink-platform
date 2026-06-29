import { describe, it, expect } from 'vitest';
import {
  deriveMeters,
  getAvailableYears,
  aggregateByMonth,
  formatQuantity,
} from '@/lib/meters';
import type { EntryWithPeriod } from '@/lib/meters';

const BASE: EntryWithPeriod = {
  source_type: 'stationary_combustion',
  secondary: 'natural_gas',
  raw_quantity: 100,
  raw_unit: 'm3_ng',
  period_start: '2025-01-01',
  supplier_name: 'Acme Corp',
  supplier_id: 'sup-1',
};

// ── deriveMeters ─────────────────────────────────────────────────────────────

describe('deriveMeters', () => {
  it('returns empty for no entries', () => {
    expect(deriveMeters([])).toEqual([]);
  });

  it('derives a single meter from one entry', () => {
    const [m] = deriveMeters([BASE]);
    expect(m?.source_type).toBe('stationary_combustion');
    expect(m?.secondary).toBe('natural_gas');
    expect(m?.unit).toBe('m3_ng');
    expect(m?.supplier_id).toBe('sup-1');
  });

  it('deduplicates entries with the same meter signature', () => {
    const entries: EntryWithPeriod[] = [BASE, { ...BASE, period_start: '2025-02-01' }];
    expect(deriveMeters(entries)).toHaveLength(1);
  });

  it('separates meters for different source types', () => {
    const elec: EntryWithPeriod = {
      ...BASE,
      source_type: 'purchased_electricity',
      secondary: 'SEIN_PERU',
      raw_unit: 'kWh',
    };
    expect(deriveMeters([BASE, elec])).toHaveLength(2);
  });

  it('separates meters for different suppliers', () => {
    const entry2: EntryWithPeriod = { ...BASE, supplier_id: 'sup-2', supplier_name: 'Beta Ltd' };
    expect(deriveMeters([BASE, entry2])).toHaveLength(2);
  });

  it('separates meters for different secondary values', () => {
    const diesel: EntryWithPeriod = { ...BASE, secondary: 'diesel', raw_unit: 'L' };
    expect(deriveMeters([BASE, diesel])).toHaveLength(2);
  });

  it('separates meters for different units', () => {
    const m3: EntryWithPeriod = { ...BASE, raw_unit: 'm3_ng' };
    const kBtu: EntryWithPeriod = { ...BASE, raw_unit: 'kBtu' };
    expect(deriveMeters([m3, kBtu])).toHaveLength(2);
  });

  it('sets correct meter id format', () => {
    const [m] = deriveMeters([BASE]);
    expect(m?.id).toBe('stationary_combustion::natural_gas::m3_ng::sup-1');
  });
});

// ── getAvailableYears ─────────────────────────────────────────────────────────

describe('getAvailableYears', () => {
  it('returns empty for no entries', () => {
    expect(getAvailableYears([])).toEqual([]);
  });

  it('returns years sorted descending', () => {
    const entries: EntryWithPeriod[] = [
      { ...BASE, period_start: '2024-03-01' },
      { ...BASE, period_start: '2026-01-01' },
      { ...BASE, period_start: '2025-06-01' },
    ];
    expect(getAvailableYears(entries)).toEqual([2026, 2025, 2024]);
  });

  it('deduplicates years from multiple entries in same year', () => {
    const entries: EntryWithPeriod[] = [
      { ...BASE, period_start: '2025-01-01' },
      { ...BASE, period_start: '2025-07-01' },
    ];
    expect(getAvailableYears(entries)).toEqual([2025]);
  });

  it('ignores entries with invalid dates', () => {
    const entries: EntryWithPeriod[] = [
      { ...BASE, period_start: 'not-a-date' },
      { ...BASE, period_start: '2025-01-01' },
    ];
    expect(getAvailableYears(entries)).toEqual([2025]);
  });
});

// ── aggregateByMonth ──────────────────────────────────────────────────────────

describe('aggregateByMonth', () => {
  it('returns empty for no entries', () => {
    expect(aggregateByMonth([], 2025)).toEqual([]);
  });

  it('returns empty for year with no matching entries', () => {
    expect(aggregateByMonth([BASE], 2024)).toEqual([]);
  });

  it('places entry in correct month (January = 1)', () => {
    const [s] = aggregateByMonth([BASE], 2025);
    expect(s?.monthly[1]).toBe(100);
  });

  it('sets total correctly', () => {
    const [s] = aggregateByMonth([BASE], 2025);
    expect(s?.total).toBe(100);
  });

  it('sums multiple entries in the same month', () => {
    const entries: EntryWithPeriod[] = [BASE, { ...BASE, raw_quantity: 50 }];
    const [s] = aggregateByMonth(entries, 2025);
    expect(s?.monthly[1]).toBe(150);
    expect(s?.total).toBe(150);
  });

  it('does not mix entries across different months', () => {
    const entries: EntryWithPeriod[] = [
      { ...BASE, period_start: '2025-01-01', raw_quantity: 100 },
      { ...BASE, period_start: '2025-06-01', raw_quantity: 200 },
    ];
    const [s] = aggregateByMonth(entries, 2025);
    expect(s?.monthly[1]).toBe(100);
    expect(s?.monthly[6]).toBe(200);
    expect(s?.total).toBe(300);
  });

  it('identifies peak month correctly', () => {
    const entries: EntryWithPeriod[] = [
      { ...BASE, period_start: '2025-01-01', raw_quantity: 100 },
      { ...BASE, period_start: '2025-06-01', raw_quantity: 300 },
      { ...BASE, period_start: '2025-12-01', raw_quantity: 200 },
    ];
    const [s] = aggregateByMonth(entries, 2025);
    expect(s?.peak).toEqual({ month: 6, value: 300 });
  });

  it('peak is null when no entries for the year', () => {
    expect(aggregateByMonth([BASE], 2024)).toHaveLength(0);
  });

  it('sorts summaries by total descending', () => {
    const elec: EntryWithPeriod = {
      ...BASE,
      source_type: 'purchased_electricity',
      secondary: 'SEIN_PERU',
      raw_unit: 'kWh',
      raw_quantity: 500,
    };
    const summaries = aggregateByMonth([BASE, elec], 2025);
    expect(summaries[0]?.total).toBe(500);
    expect(summaries[1]?.total).toBe(100);
  });

  it('filters out entries from other years', () => {
    const entries: EntryWithPeriod[] = [
      { ...BASE, period_start: '2024-06-01', raw_quantity: 999 },
      { ...BASE, period_start: '2025-03-01', raw_quantity: 50 },
    ];
    const summaries = aggregateByMonth(entries, 2025);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.total).toBe(50);
  });

  it('groups entries across multiple meters', () => {
    const water: EntryWithPeriod = {
      ...BASE,
      source_type: 'water_use',
      secondary: 'potable_mixed',
      raw_unit: 'kgal_us',
      raw_quantity: 10,
    };
    const summaries = aggregateByMonth([BASE, water], 2025);
    expect(summaries).toHaveLength(2);
  });
});

// ── formatQuantity ────────────────────────────────────────────────────────────

describe('formatQuantity', () => {
  it('returns hyphen for zero', () => {
    expect(formatQuantity(0, 'kWh')).toBe('-');
  });

  it('formats small integer values without suffix', () => {
    const r = formatQuantity(500, 'L');
    expect(r).toContain('500');
    expect(r).not.toContain('k');
    expect(r).not.toContain('M');
  });

  it('formats decimal values to 2dp', () => {
    const r = formatQuantity(3.14159, 'kWh');
    expect(r).toContain('3.14');
  });

  it('formats integers without decimal point', () => {
    const r = formatQuantity(42, 'kWh');
    expect(r).toContain('42');
    expect(r).not.toContain('.');
  });

  it('formats thousands with k suffix', () => {
    const r = formatQuantity(2500, 'kWh');
    expect(r).toContain('k');
    expect(r).toContain('2.5');
  });

  it('formats millions with M suffix', () => {
    const r = formatQuantity(1_500_000, 'kWh');
    expect(r).toContain('M');
  });

  it('includes unit label in output', () => {
    const r = formatQuantity(100, 'L');
    expect(r).toContain('L');
  });

  it('falls back to raw unit string if not in label map', () => {
    const r = formatQuantity(50, 'unknown_unit_xyz');
    expect(r).toContain('unknown_unit_xyz');
  });
});
