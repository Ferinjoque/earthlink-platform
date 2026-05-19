import { describe, it, expect } from 'vitest';
import { AnomalyService } from '../../../src/services/AnomalyService';
import { ActivityEntry } from '../../../src/domain/ActivityEntry';
import type { ActivityKind, Unit } from '../../../src/calc/types';
import type { EmissionSourceType } from '../../../src/types/database';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NOW = new Date('2026-01-15T00:00:00Z');

let _seq = 0;
function makeEntry(
  rawQuantity: number,
  opts: {
    sourceType?: EmissionSourceType;
    activityKind?: ActivityKind;
    rawUnit?: Unit;
    periodId?: string;
  } = {},
): ActivityEntry {
  _seq++;
  const sourceType = opts.sourceType ?? 'stationary_combustion';
  const activityKind: ActivityKind = opts.activityKind ?? { kind: 'stationary_combustion', fuel: 'diesel' };
  const rawUnit: Unit = opts.rawUnit ?? 'L';
  return new ActivityEntry({
    id: `entry-${_seq}`,
    reportingPeriodId: opts.periodId ?? 'period-001',
    sourceType,
    activityKind,
    rawQuantity,
    rawUnit,
    status: 'submitted',
    submittedAt: NOW,
    submittedBy: null,
    createdAt: NOW,
  });
}

// Historical baseline: ~850 L diesel (small variance)
// Using MIN_BASELINE (3) or more entries
const historicalBaseline = [
  makeEntry(840),
  makeEntry(850),
  makeEntry(860),
  makeEntry(845),
  makeEntry(855),
];

// ── Core detect() tests ───────────────────────────────────────────────────────

describe('AnomalyService.detect()', () => {
  const svc = new AnomalyService();

  it('returns empty array when no current entries', () => {
    const result = svc.detect([], historicalBaseline);
    expect(result).toHaveLength(0);
  });

  it('returns empty array when historical baseline has fewer than MIN_BASELINE entries', () => {
    // With only 2 entries the z-score is statistically meaningless
    const twoEntries = [makeEntry(850), makeEntry(860)];
    const result = svc.detect([makeEntry(5000)], twoEntries);
    expect(result).toHaveLength(0);
  });

  it('returns no anomaly for normal value', () => {
    const result = svc.detect([makeEntry(850)], historicalBaseline);
    expect(result).toHaveLength(0);
  });

  it('detects anomaly when z-score exceeds low threshold', () => {
    // 4750 L vs baseline mean ~850 — z-score >> Z_THRESHOLD_LOW
    const result = svc.detect([makeEntry(4750)], historicalBaseline);
    expect(result).toHaveLength(1);
    expect(result[0]!.zScore).toBeGreaterThan(AnomalyService.Z_THRESHOLD_LOW);
  });

  it('classifies extreme outlier as high severity', () => {
    const result = svc.detect([makeEntry(4750)], historicalBaseline);
    expect(result[0]!.severity).toBe('high');
  });

  it('classifies moderate outlier as medium severity', () => {
    // baseline mean=850, sample stddev≈7.91; 3σ above ≈ 874; need ~3.5σ for medium
    // 880 → z ≈ (880-850)/7.91 ≈ 3.79 → medium
    const result = svc.detect([makeEntry(880)], historicalBaseline);
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe('medium');
  });

  it('includes correct metadata in anomaly', () => {
    const result = svc.detect([makeEntry(4750)], historicalBaseline);
    const anomaly = result[0]!;
    expect(anomaly.value).toBe(4750);
    expect(anomaly.historicalMean).toBeCloseTo(850, 0);
    expect(anomaly.message).toContain('4750');
    expect(anomaly.secondary).toBe('diesel');
  });

  it('only detects anomalies for matching sourceType', () => {
    const elecHistory = [
      makeEntry(1000, { sourceType: 'purchased_electricity', activityKind: { kind: 'purchased_electricity', gridRegion: 'SEIN_PERU' }, rawUnit: 'kWh' }),
      makeEntry(1050, { sourceType: 'purchased_electricity', activityKind: { kind: 'purchased_electricity', gridRegion: 'SEIN_PERU' }, rawUnit: 'kWh' }),
      makeEntry(980, { sourceType: 'purchased_electricity', activityKind: { kind: 'purchased_electricity', gridRegion: 'SEIN_PERU' }, rawUnit: 'kWh' }),
    ];
    const diesel = makeEntry(4750); // stationary_combustion diesel
    const result = svc.detect([diesel], elecHistory);
    expect(result).toHaveLength(0);
  });

  it('detects multiple anomalies in batch', () => {
    const outlier1 = makeEntry(5000);
    const outlier2 = makeEntry(4500);
    const normal = makeEntry(850);
    const result = svc.detect([outlier1, outlier2, normal], historicalBaseline);
    expect(result).toHaveLength(2);
  });
});

// ── Secondary + unit grouping (critical correctness) ─────────────────────────

describe('AnomalyService.detect() — secondary grouping', () => {
  const svc = new AnomalyService();

  it('does NOT flag diesel outlier when baseline is gasoline (different secondary)', () => {
    const gasolineHistory = [
      makeEntry(500, { activityKind: { kind: 'mobile_combustion', fuel: 'gasoline' }, rawUnit: 'L', sourceType: 'mobile_combustion' }),
      makeEntry(510, { activityKind: { kind: 'mobile_combustion', fuel: 'gasoline' }, rawUnit: 'L', sourceType: 'mobile_combustion' }),
      makeEntry(495, { activityKind: { kind: 'mobile_combustion', fuel: 'gasoline' }, rawUnit: 'L', sourceType: 'mobile_combustion' }),
    ];
    const dieselEntry = makeEntry(4500, {
      activityKind: { kind: 'mobile_combustion', fuel: 'diesel' },
      rawUnit: 'L',
      sourceType: 'mobile_combustion',
    });
    const result = svc.detect([dieselEntry], gasolineHistory);
    // Baseline is gasoline, current is diesel — different group key → no anomaly
    expect(result).toHaveLength(0);
  });

  it('flags outlier when secondary AND unit match', () => {
    const dieselHistory = [
      makeEntry(500, { activityKind: { kind: 'mobile_combustion', fuel: 'diesel' }, rawUnit: 'L', sourceType: 'mobile_combustion' }),
      makeEntry(510, { activityKind: { kind: 'mobile_combustion', fuel: 'diesel' }, rawUnit: 'L', sourceType: 'mobile_combustion' }),
      makeEntry(495, { activityKind: { kind: 'mobile_combustion', fuel: 'diesel' }, rawUnit: 'L', sourceType: 'mobile_combustion' }),
    ];
    const outlier = makeEntry(4500, {
      activityKind: { kind: 'mobile_combustion', fuel: 'diesel' },
      rawUnit: 'L',
      sourceType: 'mobile_combustion',
    });
    const result = svc.detect([outlier], dieselHistory);
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe('high');
  });

  it('does NOT compare R410A refrigerant against R134A historical data', () => {
    const r134aHistory = [
      makeEntry(1.0, { activityKind: { kind: 'fugitive', refrigerant: 'R134A' }, rawUnit: 'kg', sourceType: 'fugitive' }),
      makeEntry(0.9, { activityKind: { kind: 'fugitive', refrigerant: 'R134A' }, rawUnit: 'kg', sourceType: 'fugitive' }),
      makeEntry(1.1, { activityKind: { kind: 'fugitive', refrigerant: 'R134A' }, rawUnit: 'kg', sourceType: 'fugitive' }),
    ];
    const r410aEntry = makeEntry(50, {
      activityKind: { kind: 'fugitive', refrigerant: 'R410A' },
      rawUnit: 'kg',
      sourceType: 'fugitive',
    });
    const result = svc.detect([r410aEntry], r134aHistory);
    // Different refrigerant → no baseline match → no anomaly
    expect(result).toHaveLength(0);
  });

  it('compares R410A against R410A historical baseline', () => {
    const r410aHistory = [
      makeEntry(1.0, { activityKind: { kind: 'fugitive', refrigerant: 'R410A' }, rawUnit: 'kg', sourceType: 'fugitive' }),
      makeEntry(0.9, { activityKind: { kind: 'fugitive', refrigerant: 'R410A' }, rawUnit: 'kg', sourceType: 'fugitive' }),
      makeEntry(1.1, { activityKind: { kind: 'fugitive', refrigerant: 'R410A' }, rawUnit: 'kg', sourceType: 'fugitive' }),
    ];
    const outlier = makeEntry(50, {
      activityKind: { kind: 'fugitive', refrigerant: 'R410A' },
      rawUnit: 'kg',
      sourceType: 'fugitive',
    });
    const result = svc.detect([outlier], r410aHistory);
    expect(result).toHaveLength(1);
  });

  it('does NOT compare SEIN_PERU electricity against US_AVERAGE electricity', () => {
    const usHistory = [
      makeEntry(1000, { activityKind: { kind: 'purchased_electricity', gridRegion: 'US_AVERAGE' }, rawUnit: 'kWh', sourceType: 'purchased_electricity' }),
      makeEntry(1050, { activityKind: { kind: 'purchased_electricity', gridRegion: 'US_AVERAGE' }, rawUnit: 'kWh', sourceType: 'purchased_electricity' }),
      makeEntry(980, { activityKind: { kind: 'purchased_electricity', gridRegion: 'US_AVERAGE' }, rawUnit: 'kWh', sourceType: 'purchased_electricity' }),
    ];
    const peruEntry = makeEntry(15000, {
      activityKind: { kind: 'purchased_electricity', gridRegion: 'SEIN_PERU' },
      rawUnit: 'kWh',
      sourceType: 'purchased_electricity',
    });
    const result = svc.detect([peruEntry], usHistory);
    // Different grid region → no baseline match → no anomaly
    expect(result).toHaveLength(0);
  });
});

// ── Unit grouping ─────────────────────────────────────────────────────────────

describe('AnomalyService.detect() — unit grouping', () => {
  const svc = new AnomalyService();

  it('does NOT compare kWh entries against MWh baseline', () => {
    // Historical: 850 MWh/quarter; current: 850 kWh — looks like anomaly if mixed
    const mwhHistory = [
      makeEntry(850, { sourceType: 'purchased_electricity', activityKind: { kind: 'purchased_electricity', gridRegion: 'SEIN_PERU' }, rawUnit: 'MWh' }),
      makeEntry(840, { sourceType: 'purchased_electricity', activityKind: { kind: 'purchased_electricity', gridRegion: 'SEIN_PERU' }, rawUnit: 'MWh' }),
      makeEntry(860, { sourceType: 'purchased_electricity', activityKind: { kind: 'purchased_electricity', gridRegion: 'SEIN_PERU' }, rawUnit: 'MWh' }),
    ];
    const kwhEntry = makeEntry(850, {
      sourceType: 'purchased_electricity',
      activityKind: { kind: 'purchased_electricity', gridRegion: 'SEIN_PERU' },
      rawUnit: 'kWh',
    });
    const result = svc.detect([kwhEntry], mwhHistory);
    // Different units → different group key → no baseline → no anomaly (not a false positive)
    expect(result).toHaveLength(0);
  });
});

// ── Message quality ───────────────────────────────────────────────────────────

describe('AnomalyService.detect() — message content', () => {
  const svc = new AnomalyService();

  it('includes secondary in message when present', () => {
    const result = svc.detect([makeEntry(4750)], historicalBaseline);
    expect(result[0]!.message).toContain('diesel');
  });

  it('uses Spanish source label in message', () => {
    const result = svc.detect([makeEntry(4750)], historicalBaseline);
    expect(result[0]!.message).toContain('Combustión estacionaria');
    expect(result[0]!.message).not.toContain('undefined');
  });

  it('uses raw sourceType when no Spanish label available', () => {
    const unknownType = 'biogenic_combustion' as EmissionSourceType;
    function makeUnknownEntry(qty: number): ActivityEntry {
      return new ActivityEntry({
        id: `unk-${qty}`,
        reportingPeriodId: 'period-x',
        sourceType: unknownType,
        activityKind: { kind: 'stationary_combustion', fuel: 'diesel' },
        rawQuantity: qty,
        rawUnit: 'kg',
        status: 'submitted',
        submittedAt: NOW,
        submittedBy: null,
        createdAt: NOW,
      });
    }
    const historical = [makeUnknownEntry(100), makeUnknownEntry(102), makeUnknownEntry(98)];
    const current = [makeUnknownEntry(500)];
    const result = svc.detect(current, historical);
    expect(result).toHaveLength(1);
    expect(result[0]!.message).toContain('biogenic_combustion');
    expect(result[0]!.message).not.toContain('undefined');
  });
});

// ── _internals unit tests ─────────────────────────────────────────────────────

describe('AnomalyService._internals', () => {
  it('zScore returns null when population < MIN_BASELINE', () => {
    expect(AnomalyService._internals.zScore(100, [100, 200])).toBeNull();
  });

  it('zScore returns null when stddev is 0', () => {
    expect(AnomalyService._internals.zScore(5, [5, 5, 5])).toBeNull();
  });

  it('zScore uses sample stddev (ddof=1)', () => {
    // population = [9, 10, 11], mean = 10
    // sample variance = (1 + 0 + 1) / (3-1) = 1, sample stddev = 1
    // z = (12 - 10) / 1 = 2.0
    const z = AnomalyService._internals.zScore(12, [9, 10, 11]);
    expect(z).toBeCloseTo(2.0, 5);
  });

  it('zScore value is absolute (below mean still returns positive z)', () => {
    // 8 is 2σ below mean 10 — absolute z should be 2.0
    const z = AnomalyService._internals.zScore(8, [9, 10, 11]);
    expect(z).toBeCloseTo(2.0, 5);
  });

  it('mean computes correctly', () => {
    expect(AnomalyService._internals.mean([1, 2, 3, 4, 5])).toBe(3);
  });

  it('stddev uses sample formula (n-1)', () => {
    // [9, 10, 11] → sample variance = (1+0+1)/2 = 1 → stddev = 1
    const s = AnomalyService._internals.stddev([9, 10, 11], 10);
    expect(s).toBeCloseTo(1.0, 10);
  });

  it('stddev returns 0 for single-element array', () => {
    expect(AnomalyService._internals.stddev([42], 42)).toBe(0);
  });

  it('severityFor returns correct levels', () => {
    expect(AnomalyService._internals.severityFor(1.5)).toBe('low');
    expect(AnomalyService._internals.severityFor(3.5)).toBe('medium');
    expect(AnomalyService._internals.severityFor(5.0)).toBe('high');
  });

  it('severityFor thresholds are exact boundaries', () => {
    // At exactly Z_THRESHOLD_LOW → low
    expect(AnomalyService._internals.severityFor(AnomalyService.Z_THRESHOLD_LOW)).toBe('low');
    // At exactly Z_THRESHOLD_MEDIUM → medium
    expect(AnomalyService._internals.severityFor(AnomalyService.Z_THRESHOLD_MEDIUM)).toBe('medium');
    // At exactly Z_THRESHOLD_HIGH → high
    expect(AnomalyService._internals.severityFor(AnomalyService.Z_THRESHOLD_HIGH)).toBe('high');
  });
});

// ── extractSecondary ──────────────────────────────────────────────────────────

describe('AnomalyService._internals.extractSecondary', () => {
  it('stationary_combustion returns fuel', () => {
    expect(AnomalyService._internals.extractSecondary({ kind: 'stationary_combustion', fuel: 'natural_gas' })).toBe('natural_gas');
    expect(AnomalyService._internals.extractSecondary({ kind: 'stationary_combustion', fuel: 'diesel' })).toBe('diesel');
    expect(AnomalyService._internals.extractSecondary({ kind: 'stationary_combustion', fuel: 'lpg' })).toBe('lpg');
  });

  it('mobile_combustion returns fuel', () => {
    expect(AnomalyService._internals.extractSecondary({ kind: 'mobile_combustion', fuel: 'gasoline' })).toBe('gasoline');
  });

  it('purchased_electricity returns gridRegion', () => {
    expect(AnomalyService._internals.extractSecondary({ kind: 'purchased_electricity', gridRegion: 'SEIN_PERU' })).toBe('SEIN_PERU');
    expect(AnomalyService._internals.extractSecondary({ kind: 'purchased_electricity', gridRegion: 'EU_AVERAGE' })).toBe('EU_AVERAGE');
  });

  it('purchased_steam returns "default"', () => {
    expect(AnomalyService._internals.extractSecondary({ kind: 'purchased_steam' })).toBe('default');
  });

  it('fugitive returns refrigerant', () => {
    expect(AnomalyService._internals.extractSecondary({ kind: 'fugitive', refrigerant: 'R410A' })).toBe('R410A');
    expect(AnomalyService._internals.extractSecondary({ kind: 'fugitive', refrigerant: 'R32' })).toBe('R32');
  });

  it('water_use returns subtype', () => {
    expect(AnomalyService._internals.extractSecondary({ kind: 'water_use', subtype: 'potable_mixed' })).toBe('potable_mixed');
  });

  it('waste returns subtype', () => {
    expect(AnomalyService._internals.extractSecondary({ kind: 'waste', subtype: 'disposed_trash' })).toBe('disposed_trash');
  });
});

// ── groupKey ──────────────────────────────────────────────────────────────────

describe('AnomalyService._internals.groupKey', () => {
  it('produces stable string key', () => {
    const key = AnomalyService._internals.groupKey('stationary_combustion', 'diesel', 'L');
    expect(key).toBe('stationary_combustion:diesel:L');
  });

  it('different units produce different keys', () => {
    const k1 = AnomalyService._internals.groupKey('purchased_electricity', 'SEIN_PERU', 'kWh');
    const k2 = AnomalyService._internals.groupKey('purchased_electricity', 'SEIN_PERU', 'MWh');
    expect(k1).not.toBe(k2);
  });

  it('different secondaries produce different keys', () => {
    const k1 = AnomalyService._internals.groupKey('stationary_combustion', 'diesel', 'L');
    const k2 = AnomalyService._internals.groupKey('stationary_combustion', 'natural_gas', 'L');
    expect(k1).not.toBe(k2);
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('AnomalyService.detect() — edge cases', () => {
  const svc = new AnomalyService();

  it('returns empty when current list is empty', () => {
    expect(svc.detect([], historicalBaseline)).toHaveLength(0);
  });

  it('returns empty when no historical data at all', () => {
    expect(svc.detect([makeEntry(4750)], [])).toHaveLength(0);
  });

  it('handles very large z-scores without overflow', () => {
    const tinyVarianceHistory = [
      makeEntry(1000), makeEntry(1000), makeEntry(1001),
    ];
    const massiveOutlier = makeEntry(1_000_000);
    const result = svc.detect([massiveOutlier], tinyVarianceHistory);
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe('high');
    expect(isFinite(result[0]!.zScore)).toBe(true);
  });

  it('handles zero-value entries in baseline (skips when all zeros)', () => {
    // If all historical values are 0, stddev = 0 → z = null → no anomaly
    const zeroHistory = [makeEntry(0), makeEntry(0), makeEntry(0)];
    const current = [makeEntry(500)];
    const result = svc.detect(current, zeroHistory);
    expect(result).toHaveLength(0);
  });
});
