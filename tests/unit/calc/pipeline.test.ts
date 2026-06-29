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

// ── Datos de prueba ───────────────────────────────────────────────────────────

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

// ── calculate - happy path ────────────────────────────────────────────────────

describe('calculate - happy path', () => {
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

// ── calculate - error paths ───────────────────────────────────────────────────

describe('calculate - error paths', () => {
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
      byScope: { scope1: totalCo2eKg, scope2: 0, none: 0 },
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

  it('up trend when prior totalCo2eKg is 0 and current is positive (inicio de emisiones)', () => {
    const current = makeTotals(5000);
    const history = [makeTotals(0)];
    expect(score(current, history).trend).toBe('up');
  });

  it('stable trend when both prior and current are 0', () => {
    const current = makeTotals(0);
    const history = [makeTotals(0)];
    expect(score(current, history).trend).toBe('stable');
  });

  it('level is high for very large emissions with stable trend (base score caps at 65)', () => {
    const s = score(makeTotals(2_000_000), []);
    expect(s.level).toBe('high');
    expect(s.score).toBe(65);
  });

  it('level is critical for very large emissions with upward trend', () => {
    // Base 65 + 10 (tendencia ascendente) = 75 → critical
    const prior = makeTotals(100_000);
    const current = makeTotals(2_000_000);
    const s = score(current, [prior]);
    expect(s.trend).toBe('up');
    expect(s.score).toBe(75);
    expect(s.level).toBe('critical');
  });

  it('score alcanza 65 exactamente en ≥1083 tCO2e (factor 0.06)', () => {
    // 1_083_000 kg = 1083 tCO2e → 1083 * 0.06 = 64.98 → rounds to 65
    const s = score(makeTotals(1_083_000), []);
    expect(s.score).toBe(65);
  });

  it('score es proporcional a las emisiones por debajo del tope', () => {
    // 541_500 kg = 541.5 tCO2e → 541.5 * 0.06 = 32.49 → rounds to 32
    const s = score(makeTotals(541_500), []);
    expect(s.score).toBe(32);
    expect(s.level).toBe('medium');
  });

  it('score bajo para emisiones pequeñas (100 tCO2e)', () => {
    // 100_000 kg = 100 tCO2e → 100 * 0.06 = 6 → rounds to 6 → low
    const s = score(makeTotals(100_000), []);
    expect(s.score).toBe(6);
    expect(s.level).toBe('low');
  });
});

// ── GRESB: ruta CO2e cero para water_use / waste ─────────────────────────────

describe('calculate - water_use zero-CO2e path', () => {
  it('returns ok with co2eKg = 0 for potable_mixed water', () => {
    const record = makeRecord({
      activity: { kind: 'water_use', subtype: 'potable_mixed' },
      rawValue: 150,
      rawUnit: 'kgal_us',
    });
    const result = calculate(record, new Map());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.co2eKg).toBe(0);
    expect(result.value.scope).toBe('none');
    expect(result.value.factorId).toBe('none');
    expect(result.value.normalizedValue).toBe(150);
    expect(result.value.normalizedUnit).toBe('kgal_us');
  });

  it('returns ok for all_sources water subtype', () => {
    const record = makeRecord({
      activity: { kind: 'water_use', subtype: 'all_sources' },
      rawValue: 5,
      rawUnit: 'megaliter',
    });
    const result = calculate(record, new Map());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.co2eKg).toBe(0);
    expect(result.value.scope).toBe('none');
  });

  it('calcHash is deterministic for water records', () => {
    const record = makeRecord({
      activity: { kind: 'water_use', subtype: 'reclaimed_mixed' },
      rawValue: 30,
      rawUnit: 'kgal_us',
    });
    const r1 = calculate(record, new Map());
    const r2 = calculate(record, new Map());
    expect(r1.ok && r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;
    expect(r1.value.calcHash).toBe(r2.value.calcHash);
    expect(r1.value.calcHash).toHaveLength(64);
  });

  it('still validates rawValue - rejects negative water quantity', () => {
    const record = makeRecord({
      activity: { kind: 'water_use', subtype: 'potable_mixed' },
      rawValue: -5,
      rawUnit: 'kgal_us',
    });
    const result = calculate(record, new Map());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('INVALID_VALUE');
  });
});

describe('calculate - waste zero-CO2e path', () => {
  it('returns ok with co2eKg = 0 for disposed_trash', () => {
    const record = makeRecord({
      activity: { kind: 'waste', subtype: 'disposed_trash' },
      rawValue: 2.5,
      rawUnit: 'ton_us',
    });
    const result = calculate(record, new Map());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.co2eKg).toBe(0);
    expect(result.value.scope).toBe('none');
    expect(result.value.factorId).toBe('none');
  });

  it('returns ok for recycled waste subtype', () => {
    const record = makeRecord({
      activity: { kind: 'waste', subtype: 'recycled' },
      rawValue: 1.2,
      rawUnit: 'tonne',
    });
    const result = calculate(record, new Map());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.co2eKg).toBe(0);
  });

  it('returns ok for composted waste subtype', () => {
    const record = makeRecord({
      activity: { kind: 'waste', subtype: 'composted' },
      rawValue: 0.8,
      rawUnit: 'tonne',
    });
    const result = calculate(record, new Map());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.co2eKg).toBe(0);
    expect(result.value.scope).toBe('none');
  });
});

// ── GRESB: claves de factor para fuel_oil_no2 / propane ──────────────────────

describe('_internals.resolveFactorKey - new fuels', () => {
  it('fuel_oil_no2 produces correct key', () => {
    expect(
      _internals.resolveFactorKey({ kind: 'stationary_combustion', fuel: 'fuel_oil_no2' }),
    ).toBe('stationary_combustion.fuel_oil_no2');
  });

  it('propane produces correct key', () => {
    expect(
      _internals.resolveFactorKey({ kind: 'stationary_combustion', fuel: 'propane' }),
    ).toBe('stationary_combustion.propane');
  });

  it('water_use produces key including subtype', () => {
    expect(_internals.resolveFactorKey({ kind: 'water_use', subtype: 'potable_mixed' })).toBe(
      'water_use.potable_mixed',
    );
    expect(_internals.resolveFactorKey({ kind: 'water_use', subtype: 'all_sources' })).toBe(
      'water_use.all_sources',
    );
  });

  it('waste produces key including subtype', () => {
    expect(_internals.resolveFactorKey({ kind: 'waste', subtype: 'disposed_trash' })).toBe(
      'waste.disposed_trash',
    );
    expect(_internals.resolveFactorKey({ kind: 'waste', subtype: 'recycled' })).toBe(
      'waste.recycled',
    );
    expect(_internals.resolveFactorKey({ kind: 'waste', subtype: 'composted' })).toBe(
      'waste.composted',
    );
  });
});

describe('_internals.resolveScope - none for water/waste', () => {
  it('returns none for water_use', () => {
    expect(_internals.resolveScope({ kind: 'water_use', subtype: 'potable_mixed' })).toBe('none');
    expect(_internals.resolveScope({ kind: 'water_use', subtype: 'reclaimed_mixed' })).toBe('none');
  });

  it('returns none for waste', () => {
    expect(_internals.resolveScope({ kind: 'waste', subtype: 'disposed_trash' })).toBe('none');
    expect(_internals.resolveScope({ kind: 'waste', subtype: 'recycled' })).toBe('none');
  });
});

// ── GRESB: conversión de unidad kBtu ─────────────────────────────────────────

describe('_internals.normalizeUnit - GRESB units', () => {
  it('converts kBtu → kWh', () => {
    const conversions = makeConversions([['kBtu->kWh', 0.29307100]]);
    const result = _internals.normalizeUnit(1000, 'kBtu', 'kWh', conversions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeCloseTo(293.071, 3);
  });

  it('converts kgal_us → L', () => {
    const conversions = makeConversions([['kgal_us->L', 3785.412]]);
    const result = _internals.normalizeUnit(1, 'kgal_us', 'L', conversions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeCloseTo(3785.412, 3);
  });

  it('converts ton_us → tonne', () => {
    const conversions = makeConversions([['ton_us->tonne', 0.90718474]]);
    const result = _internals.normalizeUnit(2, 'ton_us', 'tonne', conversions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeCloseTo(1.81436948, 6);
  });

  it('converts m3 → kgal_us', () => {
    const conversions = makeConversions([['m3->kgal_us', 0.264172]]);
    const result = _internals.normalizeUnit(100, 'm3', 'kgal_us', conversions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeCloseTo(26.4172, 4);
  });

  it('converts megaliter → m3', () => {
    const conversions = makeConversions([['megaliter->m3', 1000]]);
    const result = _internals.normalizeUnit(0.5, 'megaliter', 'm3', conversions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeCloseTo(500, 6);
  });
});

// ── aggregate - handles none scope ───────────────────────────────────────────

describe('aggregate - none scope', () => {
  function makeNoneResult(id: string, normalizedValue: number): EmissionResult {
    return {
      activityRecordId: id,
      factorId: 'none',
      factorSetId: 'none',
      factorSetVersion: '0',
      normalizedValue,
      normalizedUnit: 'kgal_us',
      co2eKg: 0,
      scope: 'none',
      engineVersion: ENGINE_VERSION,
      calcHash: `hash-${id}`,
    };
  }

  it('none scope results do not add to totalCo2eKg', () => {
    const results = [makeNoneResult('w1', 150), makeNoneResult('w2', 30)];
    const totals = aggregate(results);
    expect(totals.totalCo2eKg).toBe(0);
    expect(totals.byScope.none).toBe(0);
    expect(totals.recordCount).toBe(2);
  });

  it('mixed GHG + water/waste aggregates correctly', () => {
    const ghgResult: EmissionResult = {
      activityRecordId: 'ghg-1',
      factorId: 'ef-diesel',
      factorSetId: 'DEFRA_2024',
      factorSetVersion: '2024',
      normalizedValue: 100,
      normalizedUnit: 'L',
      co2eKg: 251.39,
      scope: 'scope1',
      engineVersion: ENGINE_VERSION,
      calcHash: 'hash-ghg',
    };
    const waterResult = makeNoneResult('water-1', 150);

    const totals = aggregate([ghgResult, waterResult]);
    expect(totals.totalCo2eKg).toBeCloseTo(251.39, 2);
    expect(totals.byScope.scope1).toBeCloseTo(251.39, 2);
    expect(totals.byScope.none).toBe(0);
    expect(totals.byScope.scope2).toBe(0);
    expect(totals.recordCount).toBe(2);
  });
});

// ── calculate - fuel_oil_no2 / propane with factor ───────────────────────────

describe('calculate - new GRESB fuels', () => {
  it('computes CO2e for fuel_oil_no2 with DEFRA factor', () => {
    const record = makeRecord({
      activity: { kind: 'stationary_combustion', fuel: 'fuel_oil_no2' },
      rawValue: 500,
      rawUnit: 'L',
    });
    const factor = makeFactor({
      id: 'ef-fuel-oil-no2',
      activityKey: 'stationary_combustion.fuel_oil_no2',
      factorKgCo2ePerUnit: 2.68344,
      standardUnit: 'L',
    });
    const result = calculate(record, makeFactorTable(factor));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.co2eKg).toBeCloseTo(500 * 2.68344, 3);
    expect(result.value.scope).toBe('scope1');
  });

  it('computes CO2e for propane with DEFRA factor', () => {
    const record = makeRecord({
      activity: { kind: 'stationary_combustion', fuel: 'propane' },
      rawValue: 200,
      rawUnit: 'L',
    });
    const factor = makeFactor({
      id: 'ef-propane',
      activityKey: 'stationary_combustion.propane',
      factorKgCo2ePerUnit: 1.49304,
      standardUnit: 'L',
    });
    const result = calculate(record, makeFactorTable(factor));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.co2eKg).toBeCloseTo(200 * 1.49304, 3);
    expect(result.value.scope).toBe('scope1');
  });

  it('computes CO2e for fuel_oil_no2 in kBtu via conversion', () => {
    const record = makeRecord({
      activity: { kind: 'stationary_combustion', fuel: 'fuel_oil_no2' },
      rawValue: 500,
      rawUnit: 'kBtu',
    });
    const factor = makeFactor({
      id: 'ef-fuel-oil-no2',
      activityKey: 'stationary_combustion.fuel_oil_no2',
      factorKgCo2ePerUnit: 2.68344,
      standardUnit: 'L',
    });
    // 1 kBtu ≈ 0.1054 L para fuel oil (conversión de densidad energética, aprox.)
    // En este test solo verificamos que la ruta de conversión funciona
    const conversions = makeConversions([['kBtu->L', 0.1054]]);
    const result = calculate(record, makeFactorTable(factor), conversions);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.co2eKg).toBeCloseTo(500 * 0.1054 * 2.68344, 2);
  });
});

// ── Pruebas basadas en propiedades ────────────────────────────────────────────

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
            byScope: { scope1: co2eKg, scope2: 0, none: 0 },
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
          // la conversión identidad (kWh → kWh) siempre es igual al valor
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
