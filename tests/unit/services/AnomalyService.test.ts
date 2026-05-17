import { describe, it, expect } from 'vitest';
import { AnomalyService } from '../../../src/services/AnomalyService';
import { ActivityEntry } from '../../../src/domain/ActivityEntry';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NOW = new Date('2026-01-15T00:00:00Z');

let _seq = 0;
function makeEntry(
  rawQuantity: number,
  sourceType: ActivityEntry['sourceType'] = 'stationary_combustion',
): ActivityEntry {
  _seq++;
  return new ActivityEntry({
    id: `entry-${_seq}`,
    reportingPeriodId: 'period-001',
    sourceType,
    activityKind:
      sourceType === 'purchased_electricity'
        ? { kind: 'purchased_electricity', gridRegion: 'SEIN_PERU' }
        : { kind: 'stationary_combustion', fuel: 'diesel' },
    rawQuantity,
    rawUnit: sourceType === 'purchased_electricity' ? 'kWh' : 'L',
    status: 'submitted',
    submittedAt: NOW,
    submittedBy: null,
    createdAt: NOW,
  });
}

// Historical baseline: ~850 L diesel (small variance)
const historicalBaseline = [
  makeEntry(840),
  makeEntry(850),
  makeEntry(860),
  makeEntry(845),
  makeEntry(855),
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AnomalyService.detect()', () => {
  const svc = new AnomalyService();

  it('returns empty array when no current entries', () => {
    const result = svc.detect([], historicalBaseline);
    expect(result).toHaveLength(0);
  });

  it('returns empty array when historical baseline has fewer than 2 entries', () => {
    const result = svc.detect([makeEntry(5000)], [makeEntry(850)]);
    expect(result).toHaveLength(0);
  });

  it('returns no anomaly for normal value', () => {
    const result = svc.detect([makeEntry(850)], historicalBaseline);
    expect(result).toHaveLength(0);
  });

  it('detects anomaly when z-score exceeds low threshold', () => {
    // 4750 L vs baseline mean ~850 — z-score >> 3
    const result = svc.detect([makeEntry(4750)], historicalBaseline);
    expect(result).toHaveLength(1);
    expect(result[0]!.zScore).toBeGreaterThan(AnomalyService.Z_THRESHOLD_LOW);
  });

  it('classifies extreme outlier as high severity', () => {
    const result = svc.detect([makeEntry(4750)], historicalBaseline);
    expect(result[0]!.severity).toBe('high');
  });

  it('classifies moderate outlier as medium severity', () => {
    // baseline ~850, stddev ~7.9; 3.5σ above = 850 + 3.5*7.9 ≈ 878
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
  });

  it('only detects anomalies for matching sourceType', () => {
    const elecHistory = [
      makeEntry(1000, 'purchased_electricity'),
      makeEntry(1050, 'purchased_electricity'),
    ];
    const diesel = makeEntry(4750, 'stationary_combustion');
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

describe('AnomalyService._internals', () => {
  it('zScore returns null when population < 2', () => {
    expect(AnomalyService._internals.zScore(100, [100])).toBeNull();
  });

  it('zScore returns null when stddev is 0', () => {
    expect(AnomalyService._internals.zScore(5, [5, 5, 5])).toBeNull();
  });

  it('zScore computes correctly', () => {
    // mean=10, stddev=sqrt((1+1)/3)≈0.816, z=(12-10)/0.816≈2.45
    const z = AnomalyService._internals.zScore(12, [9, 10, 11]);
    expect(z).toBeCloseTo(2.449, 2);
  });

  it('mean computes correctly', () => {
    expect(AnomalyService._internals.mean([1, 2, 3, 4, 5])).toBe(3);
  });

  it('severityFor returns correct levels', () => {
    expect(AnomalyService._internals.severityFor(1.5)).toBe('low');
    expect(AnomalyService._internals.severityFor(3.5)).toBe('medium');
    expect(AnomalyService._internals.severityFor(5.0)).toBe('high');
  });
});
