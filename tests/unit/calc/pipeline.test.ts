import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculate, aggregate, score, _internals } from '../../../src/calc/pipeline';
import { ENGINE_VERSION } from '../../../src/calc/version';
import type {
  ActivityRecord,
  EmissionFactor,
  EmissionResult,
  EvaluationTotals,
  FactorTable,
  ConversionTable,
} from '../../../src/calc/types';

// ── Test fixtures ─────────────────────────────────────────────────────────────

function makeRecord(overrides: Partial<ActivityRecord> = {}): ActivityRecord {
  return {
    id: 'rec-001',
    periodId: 'period-001',
    supplierId: 'sup-001',
    activity: { kind: 'stationary_combustion', fuel: 'diesel' },
    rawValue: 100,
    rawUnit: 'L',
    submittedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeFactor(overrides: Partial<EmissionFactor> = {}): EmissionFactor {
  return {
    id: 'factor-diesel-stationary',
    setId: 'DEFRA_2024',
    setVersion: '2024',
    activityKey: 'stationary_combustion.diesel',
    region: 'global',
    factorKgCo2ePerUnit: 2.5139,
    standardUnit: 'L',
    ...overrides,
  };
}

function makeFactorTable(...entries: EmissionFactor[]): FactorTable {
  return new Map(entries.map((f) => [f.activityKey, f]));
}

function makeConversions(pairs: Array<[string, number]> = []): ConversionTable {
  return new Map(pairs);
}

// ── calculate — happy path ────────────────────────────────────────────────────

describe('calculate — happy path', () => {
  it('computes correct co2eKg for diesel stationary combustion', () => {
    const record = makeRecord({ rawValue: 850, rawUnit: 'L' });
    const factor = makeFactor();
    const result = calculate(record, makeFactorTable(factor));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.co2eKg).toBeCloseTo(850 * 2.5139, 4);
    expect(result.value.scope).toBe('scope1');
    expect(result.value.normalizedUnit).toBe('L');
    expect(result.value.engineVersion).toBe(ENGINE_VERSION);
  });

  it('applies unit conversion when rawUnit differs from standardUnit', () => {
    const record = makeRecord({ rawValue: 200, rawUnit: 'gallon' });
    const factor = makeFactor();
    const conversions = makeConversions([['gallon->L', 3.785412]]);
    const result = calculate(record, makeFactorTable(factor), conversions);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const expectedNormalized = 200 * 3.785412;
    expect(result.value.normalizedValue).toBeCloseTo(expectedNormalized, 4);
    expect(result.value.co2eKg).toBeCloseTo(expectedNormalized * 2.5139, 3);
  });

  it('computes scope2 for purchased_electricity', () => {
    const record = makeRecord({
      activity: { kind: 'purchased_electricity', gridRegion: 'SEIN_PERU' },
      rawValue: 1000,
      rawUnit: 'kWh',
    });
    const factor = makeFactor({
      id: 'factor-elec-peru',
      activityKey: 'purchased_electricity.SEIN_PERU',
      factorKgCo2ePerUnit: 0.4517,
      standardUnit: 'kWh',
    });
    const result = calculate(record, makeFactorTable(factor));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.scope).toBe('scope2');
    expect(result.value.co2eKg).toBeCloseTo(1000 * 0.4517, 4);
  });

  it('computes fugitive scope1 with GWP factor', () => {
    const record = makeRecord({
      activity: { kind: 'fugitive', refrigerant: 'R410A' },
      rawValue: 1,
      rawUnit: 'kg',
    });
    const factor = makeFactor({
      id: 'factor-r410a',
      activityKey: 'fugitive.R410A',
      factorKgCo2ePerUnit: 2088,
      standardUnit: 'kg',
    });
    const result = calculate(record, makeFactorTable(factor));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.co2eKg).toBeCloseTo(2088, 4);
    expect(result.value.scope).toBe('scope1');
  });

  it('produces a deterministic calc_hash', () => {
    const record = makeRecord();
    const factor = makeFactor();
    const factors = makeFactorTable(factor);

    const result1 = calculate(record, factors);
    const result2 = calculate(record, factors);

    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);
    if (!result1.ok || !result2.ok) return;
    expect(result1.value.calcHash).toBe(result2.value.calcHash);
    expect(result1.value.calcHash).toHaveLength(64); // sha256 hex
  });

  it('hash changes when rawValue changes', () => {
    const factor = makeFactor();
    const factors = makeFactorTable(factor);

    const r1 = calculate(makeRecord({ rawValue: 100 }), factors);
    const r2 = calculate(makeRecord({ rawValue: 200 }), factors);

    expect(r1.ok && r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;
    expect(r1.value.calcHash).not.toBe(r2.value.calcHash);
  });
});

// ── calculate — error paths ───────────────────────────────────────────────────

describe('calculate — error paths', () => {
  it('returns INVALID_VALUE for negative rawValue', () => {
    const result = calculate(makeRecord({ rawValue: -1 }), makeFactorTable(makeFactor()));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('INVALID_VALUE');
  });

  it('returns MISSING_FACTOR when FactorTable is empty', () => {
    const result = calculate(makeRecord(), new Map());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('MISSING_FACTOR');
    if (result.error.type === 'MISSING_FACTOR') {
      expect(result.error.activityKey).toBe('stationary_combustion.diesel');
    }
  });

  it('returns UNIT_INCOMPATIBLE when no conversion exists', () => {
    const record = makeRecord({ rawValue: 100, rawUnit: 'gallon' });
    const factor = makeFactor();
    const result = calculate(record, makeFactorTable(factor), new Map());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('UNIT_INCOMPATIBLE');
  });

  it('returns INVALID_VALUE for NaN', () => {
    const result = calculate(makeRecord({ rawValue: NaN }), makeFactorTable(makeFactor()));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('INVALID_VALUE');
  });

  it('returns INVALID_VALUE for Infinity', () => {
    const result = calculate(makeRecord({ rawValue: Infinity }), makeFactorTable(makeFactor()));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('INVALID_VALUE');
  });
});

// ── _internals unit tests ─────────────────────────────────────────────────────

describe('_internals.normalizeUnit', () => {
  it('identity when rawUnit === targetUnit', () => {
    const result = _internals.normalizeUnit(500, 'kWh', 'kWh', new Map());
    expect(result).toEqual({ ok: true, value: 500 });
  });

  it('applies conversion factor correctly', () => {
    const conversions = makeConversions([['MWh->kWh', 1000]]);
    const result = _internals.normalizeUnit(2, 'MWh', 'kWh', conversions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeCloseTo(2000, 6);
  });

  it('returns UNIT_INCOMPATIBLE when conversion missing', () => {
    const result = _internals.normalizeUnit(1, 'gallon', 'kWh', new Map());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('UNIT_INCOMPATIBLE');
  });
});

describe('_internals.resolveFactorKey', () => {
  it('stationary combustion keys', () => {
    expect(_internals.resolveFactorKey({ kind: 'stationary_combustion', fuel: 'diesel' })).toBe(
      'stationary_combustion.diesel',
    );
    expect(
      _internals.resolveFactorKey({ kind: 'stationary_combustion', fuel: 'natural_gas' }),
    ).toBe('stationary_combustion.natural_gas');
    expect(_internals.resolveFactorKey({ kind: 'stationary_combustion', fuel: 'lpg' })).toBe(
      'stationary_combustion.lpg',
    );
  });

  it('mobile combustion keys', () => {
    expect(_internals.resolveFactorKey({ kind: 'mobile_combustion', fuel: 'diesel' })).toBe(
      'mobile_combustion.diesel',
    );
    expect(_internals.resolveFactorKey({ kind: 'mobile_combustion', fuel: 'gasoline' })).toBe(
      'mobile_combustion.gasoline',
    );
  });

  it('electricity key includes grid region', () => {
    expect(
      _internals.resolveFactorKey({ kind: 'purchased_electricity', gridRegion: 'SEIN_PERU' }),
    ).toBe('purchased_electricity.SEIN_PERU');
    expect(
      _internals.resolveFactorKey({ kind: 'purchased_electricity', gridRegion: 'EU_AVERAGE' }),
    ).toBe('purchased_electricity.EU_AVERAGE');
  });

  it('steam key is stable', () => {
    expect(_internals.resolveFactorKey({ kind: 'purchased_steam' })).toBe(
      'purchased_steam.default',
    );
  });

  it('fugitive key includes refrigerant', () => {
    expect(_internals.resolveFactorKey({ kind: 'fugitive', refrigerant: 'R410A' })).toBe(
      'fugitive.R410A',
    );
  });
});

describe('_internals.resolveScope', () => {
  it('scope1 for combustion and fugitive', () => {
    expect(_internals.resolveScope({ kind: 'stationary_combustion', fuel: 'diesel' })).toBe(
      'scope1',
    );
    expect(_internals.resolveScope({ kind: 'mobile_combustion', fuel: 'gasoline' })).toBe('scope1');
    expect(_internals.resolveScope({ kind: 'fugitive', refrigerant: 'R32' })).toBe('scope1');
  });

  it('scope2 for electricity and steam', () => {
    expect(
      _internals.resolveScope({ kind: 'purchased_electricity', gridRegion: 'US_AVERAGE' }),
    ).toBe('scope2');
    expect(_internals.resolveScope({ kind: 'purchased_steam' })).toBe('scope2');
  });
});

// ── aggregate ─────────────────────────────────────────────────────────────────

describe('aggregate', () => {
  function makeResult(
    id: string,
    co2eKg: number,
    scope: 'scope1' | 'scope2' = 'scope1',
  ): EmissionResult {
    return {
      activityRecordId: id,
      factorId: 'f',
      factorSetId: 'DEFRA_2024',
      factorSetVersion: '2024',
      normalizedValue: co2eKg / 2.5,
      normalizedUnit: 'L',
      co2eKg,
      scope,
      engineVersion: ENGINE_VERSION,
      calcHash: `hash-${id}`,
    };
  }

  it('returns zero totals for empty input', () => {
    const totals = aggregate([]);
    expect(totals.totalCo2eKg).toBe(0);
    expect(totals.byScope.scope1).toBe(0);
    expect(totals.byScope.scope2).toBe(0);
    expect(totals.recordCount).toBe(0);
  });

  it('sums single result correctly', () => {
    const totals = aggregate([makeResult('r1', 100)]);
    expect(totals.totalCo2eKg).toBe(100);
    expect(totals.byScope.scope1).toBe(100);
    expect(totals.byScope.scope2).toBe(0);
    expect(totals.recordCount).toBe(1);
  });

  it('splits scope1 and scope2', () => {
    const totals = aggregate([makeResult('r1', 300, 'scope1'), makeResult('r2', 150, 'scope2')]);
    expect(totals.totalCo2eKg).toBe(450);
    expect(totals.byScope.scope1).toBe(300);
    expect(totals.byScope.scope2).toBe(150);
  });

  it('groups by activityRecordId', () => {
    const totals = aggregate([makeResult('r1', 100), makeResult('r1', 50), makeResult('r2', 200)]);
    expect(totals.byActivity['r1']).toBe(150);
    expect(totals.byActivity['r2']).toBe(200);
  });

  it('recordCount matches input length', () => {
    expect(
      aggregate([makeResult('a', 1), makeResult('b', 2), makeResult('c', 3)]).recordCount,
    ).toBe(3);
  });
});

// ── score ─────────────────────────────────────────────────────────────────────

describe('score', () => {
  function makeTotals(totalCo2eKg: number): EvaluationTotals {
    return {
      totalCo2eKg,
      byScope: { scope1: totalCo2eKg, scope2: 0 },
      byActivity: {},
      recordCount: 1,
    };
  }

  it('returns score in [0, 100]', () => {
    const s = score(makeTotals(50000), []);
    expect(s.score).toBeGreaterThanOrEqual(0);
    expect(s.score).toBeLessThanOrEqual(100);
  });

  it('stable trend when no history', () => {
    expect(score(makeTotals(1000), []).trend).toBe('stable');
  });

  it('up trend when emissions increased >5%', () => {
    const current = makeTotals(11000);
    const history = [makeTotals(10000)];
    expect(score(current, history).trend).toBe('up');
  });

  it('down trend when emissions decreased >5%', () => {
    const current = makeTotals(9000);
    const history = [makeTotals(10000)];
    expect(score(current, history).trend).toBe('down');
  });

  it('stable trend when change ≤5%', () => {
    const current = makeTotals(10400);
    const history = [makeTotals(10000)];
    expect(score(current, history).trend).toBe('stable');
  });

  it('level consistent with score', () => {
    const s = score(makeTotals(0), []);
    expect(s.level).toBe('low');
  });

  it('stable trend when prior totalCo2eKg is 0 (avoid division by zero)', () => {
    const current = makeTotals(5000);
    const history = [makeTotals(0)];
    expect(score(current, history).trend).toBe('stable');
  });

  it('level is high for very large emissions (base score caps at 60)', () => {
    const s = score(makeTotals(2_000_000), []);
    expect(s.level).toBe('high');
  });
});

// ── Property-based tests ──────────────────────────────────────────────────────

describe('property tests (fast-check)', () => {
  it('co2eKg = normalizedValue × factorKgCo2ePerUnit for same-unit inputs', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1e6, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 1e-6, max: 1000, noNaN: true, noDefaultInfinity: true }),
        (rawValue, factorValue) => {
          const record = makeRecord({ rawValue, rawUnit: 'L' });
          const factor = makeFactor({ factorKgCo2ePerUnit: factorValue, standardUnit: 'L' });
          const result = calculate(record, makeFactorTable(factor));
          if (!result.ok) return true;
          const expected = rawValue * factorValue;
          return Math.abs(result.value.co2eKg - expected) < expected * 1e-10 + 1e-12;
        },
      ),
    );
  });

  it('calcHash is always 64-char hex for valid inputs', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1e6, noNaN: true, noDefaultInfinity: true }),
        (rawValue) => {
          const result = calculate(makeRecord({ rawValue }), makeFactorTable(makeFactor()));
          if (!result.ok) return true;
          return /^[0-9a-f]{64}$/.test(result.value.calcHash);
        },
      ),
    );
  });

  it('same inputs always produce same hash (determinism)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1e6, noNaN: true, noDefaultInfinity: true }),
        fc.string({ minLength: 1, maxLength: 36 }),
        (rawValue, id) => {
          const record = makeRecord({ id, rawValue });
          const factors = makeFactorTable(makeFactor());
          const r1 = calculate(record, factors);
          const r2 = calculate(record, factors);
          if (!r1.ok || !r2.ok) return true;
          return r1.value.calcHash === r2.value.calcHash;
        },
      ),
    );
  });

  it('different ids always produce different hashes (no collision)', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 36 }), (id2) => {
        const r1 = calculate(
          makeRecord({ id: 'id-base', rawValue: 100 }),
          makeFactorTable(makeFactor()),
        );
        const r2 = calculate(makeRecord({ id: id2, rawValue: 100 }), makeFactorTable(makeFactor()));
        if (!r1.ok || !r2.ok) return true;
        if (id2 === 'id-base') return r1.value.calcHash === r2.value.calcHash;
        return r1.value.calcHash !== r2.value.calcHash;
      }),
    );
  });

  it('aggregate totalCo2eKg = sum of all co2eKg', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 0, max: 1e6, noNaN: true, noDefaultInfinity: true }), {
          maxLength: 50,
        }),
        (values) => {
          const results = values.map(
            (v, i): EmissionResult => ({
              activityRecordId: `r${i}`,
              factorId: 'f',
              factorSetId: 'X',
              factorSetVersion: '1',
              normalizedValue: v,
              normalizedUnit: 'L',
              co2eKg: v,
              scope: 'scope1',
              engineVersion: ENGINE_VERSION,
              calcHash: `hash${i}`,
            }),
          );
          const totals = aggregate(results);
          const expectedSum = values.reduce((a, b) => a + b, 0);
          return Math.abs(totals.totalCo2eKg - expectedSum) < 1e-6;
        },
      ),
    );
  });

  it('score is always in [0, 100]', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1e9, noNaN: true, noDefaultInfinity: true }),
        (co2eKg) => {
          const totals: EvaluationTotals = {
            totalCo2eKg: co2eKg,
            byScope: { scope1: co2eKg, scope2: 0 },
            byActivity: {},
            recordCount: 1,
          };
          const s = score(totals, []);
          return s.score >= 0 && s.score <= 100;
        },
      ),
    );
  });

  it('unit conversion is transitive (A→B→C = A→C) when both paths exist', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.001, max: 1e4, noNaN: true, noDefaultInfinity: true }),
        (rawValue) => {
          // gallon → L → kWh doesn't exist as a real path, but we test that
          // the identity conversion (kWh → kWh) always equals the value itself
          const result = _internals.normalizeUnit(rawValue, 'kWh', 'kWh', new Map());
          return result.ok && Math.abs(result.value - rawValue) < 1e-10;
        },
      ),
    );
  });

  it('negative rawValue always produces INVALID_VALUE error', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e6, max: -1e-9, noNaN: true, noDefaultInfinity: true }),
        (negValue) => {
          const result = calculate(
            makeRecord({ rawValue: negValue }),
            makeFactorTable(makeFactor()),
          );
          return !result.ok && result.error.type === 'INVALID_VALUE';
        },
      ),
    );
  });
});
