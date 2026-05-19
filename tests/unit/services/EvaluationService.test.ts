import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvaluationService } from '../../../src/services/EvaluationService';
import { ActivityEntry } from '../../../src/domain/ActivityEntry';
import { ReportingPeriod } from '../../../src/domain/ReportingPeriod';
import type { EmissionFactor, FactorTable, ConversionTable } from '../../../src/calc/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NOW = new Date('2026-01-15T00:00:00Z');

function makeEntry(
  overrides: Partial<ConstructorParameters<typeof ActivityEntry>[0]> = {},
): ActivityEntry {
  return new ActivityEntry({
    id: 'entry-001',
    reportingPeriodId: 'period-001',
    sourceType: 'stationary_combustion',
    activityKind: { kind: 'stationary_combustion', fuel: 'diesel' },
    rawQuantity: 100,
    rawUnit: 'L',
    status: 'submitted',
    submittedAt: NOW,
    submittedBy: 'user-001',
    createdAt: NOW,
    ...overrides,
  });
}

function makePeriod(
  status: 'open' | 'calculating' | 'under_review' | 'locked' = 'open',
): ReportingPeriod {
  return new ReportingPeriod({
    id: 'period-001',
    supplierId: 'supplier-001',
    label: 'Q1-2026',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-03-31'),
    status,
    createdAt: NOW,
  });
}

const dieselFactor: EmissionFactor = {
  id: 'ef-diesel',
  setId: 'DEFRA_2024',
  setVersion: '2024',
  activityKey: 'stationary_combustion.diesel',
  region: 'GLOBAL',
  factorKgCo2ePerUnit: 2.5139,
  standardUnit: 'L',
};

function makeFactorTable(): FactorTable {
  return new Map([['stationary_combustion.diesel', dieselFactor]]);
}

function makeConversions(): ConversionTable {
  return new Map([['gallon->L', 3.78541]]);
}

// ── Mock factories ────────────────────────────────────────────────────────────

function makeRepos(
  overrides: {
    entries?: ActivityEntry[];
    period?: ReportingPeriod | null;
    factors?: FactorTable;
    conversions?: ConversionTable;
  } = {},
) {
  const period = overrides.period !== undefined ? overrides.period : makePeriod();
  const entries = overrides.entries ?? [makeEntry()];
  const factors = overrides.factors ?? makeFactorTable();
  const conversions = overrides.conversions ?? makeConversions();

  const activityEntryRepo = {
    findByPeriodId: vi.fn().mockResolvedValue(entries),
  };
  const emissionFactorRepo = {
    buildFactorTable: vi.fn().mockResolvedValue(factors),
  };
  const unitConversionRepo = {
    buildConversionTable: vi.fn().mockResolvedValue(conversions),
  };
  const emissionResultRepo = {
    insertMany: vi.fn().mockResolvedValue(undefined),
  };
  const reportingPeriodRepo = {
    findById: vi.fn().mockResolvedValue(period),
  };

  return {
    activityEntryRepo,
    emissionFactorRepo,
    unitConversionRepo,
    emissionResultRepo,
    reportingPeriodRepo,
  };
}

function makeService(overrides = {}) {
  const repos = makeRepos(overrides);
  const service = new EvaluationService(
    repos.activityEntryRepo,
    repos.emissionFactorRepo,
    repos.unitConversionRepo,
    repos.emissionResultRepo,
    repos.reportingPeriodRepo,
  );
  return { service, ...repos };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('EvaluationService.evaluate()', () => {
  it('throws when period not found', async () => {
    const { service } = makeService({ period: null });
    await expect(service.evaluate('period-001')).rejects.toThrow('not found');
  });

  it('returns zero totals for empty period', async () => {
    const { service } = makeService({ entries: [] });
    const { totals } = await service.evaluate('period-001');
    expect(totals.totalCo2eKg).toBe(0);
    expect(totals.recordCount).toBe(0);
  });

  it('calculates correct CO2e for diesel entry', async () => {
    const { service } = makeService();
    const { totals } = await service.evaluate('period-001');
    // 100L × 2.5139 kg/L = 251.39 kg
    expect(totals.totalCo2eKg).toBeCloseTo(251.39, 2);
    expect(totals.recordCount).toBe(1);
  });

  it('assigns scope1 to stationary combustion', async () => {
    const { service } = makeService();
    const { totals } = await service.evaluate('period-001');
    expect(totals.byScope['scope1']).toBeCloseTo(251.39, 2);
    expect(totals.byScope['scope2']).toBe(0);
  });

  it('records error when factor is missing, but continues', async () => {
    const { service } = makeService({ factors: new Map() });
    const { totals, errors } = await service.evaluate('period-001');
    expect(totals.totalCo2eKg).toBe(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.entryId).toBe('entry-001');
  });

  it('calls insertMany with correct result count', async () => {
    const { service, emissionResultRepo } = makeService();
    await service.evaluate('period-001');
    expect(emissionResultRepo.insertMany).toHaveBeenCalledOnce();
    const [rows] = emissionResultRepo.insertMany.mock.calls[0]!;
    expect(rows).toHaveLength(1);
  });

  it('does not call insertMany when no successful results', async () => {
    const { service, emissionResultRepo } = makeService({ factors: new Map() });
    await service.evaluate('period-001');
    expect(emissionResultRepo.insertMany).not.toHaveBeenCalled();
  });

  it('handles unit conversion (gallon → L)', async () => {
    const gallonEntry = makeEntry({ rawQuantity: 26.4172, rawUnit: 'gallon' });
    const { service } = makeService({ entries: [gallonEntry] });
    const { totals } = await service.evaluate('period-001');
    // 26.4172 gallon × 3.78541 L/gallon = ~100 L × 2.5139 ≈ 251.39
    expect(totals.totalCo2eKg).toBeCloseTo(251.39, 0);
  });

  it('returns error for negative quantity entry', async () => {
    const badEntry = makeEntry({ rawQuantity: -10 });
    const { service } = makeService({ entries: [badEntry] });
    const { errors } = await service.evaluate('period-001');
    expect(errors).toHaveLength(1);
  });

  it('evaluates multiple entries and sums correctly', async () => {
    const e1 = makeEntry({ id: 'e1', rawQuantity: 100 });
    const e2 = makeEntry({ id: 'e2', rawQuantity: 50 });
    const { service } = makeService({ entries: [e1, e2] });
    const { totals } = await service.evaluate('period-001');
    // (100 + 50) × 2.5139
    expect(totals.totalCo2eKg).toBeCloseTo(377.085, 1);
    expect(totals.recordCount).toBe(2);
  });

  it('water_use entry: zero CO2e, included in totals, NOT persisted to emission_results', async () => {
    const waterEntry = makeEntry({
      id: 'water-001',
      sourceType: 'water_use',
      activityKind: { kind: 'water_use', subtype: 'potable_mixed' },
      rawQuantity: 150,
      rawUnit: 'kgal_us',
    });
    const { service, emissionResultRepo } = makeService({ entries: [waterEntry], factors: new Map() });
    const { totals, errors } = await service.evaluate('period-001');

    expect(errors).toHaveLength(0);
    expect(totals.totalCo2eKg).toBe(0);
    expect(totals.recordCount).toBe(1);
    expect(emissionResultRepo.insertMany).not.toHaveBeenCalled();
  });

  it('waste entry: zero CO2e, included in totals, NOT persisted to emission_results', async () => {
    const wasteEntry = makeEntry({
      id: 'waste-001',
      sourceType: 'waste',
      activityKind: { kind: 'waste', subtype: 'recycled' },
      rawQuantity: 1.2,
      rawUnit: 'tonne',
    });
    const { service, emissionResultRepo } = makeService({ entries: [wasteEntry], factors: new Map() });
    const { totals, errors } = await service.evaluate('period-001');

    expect(errors).toHaveLength(0);
    expect(totals.totalCo2eKg).toBe(0);
    expect(totals.recordCount).toBe(1);
    expect(emissionResultRepo.insertMany).not.toHaveBeenCalled();
  });

  it('mixed GHG + water: GHG persisted, water NOT persisted, totals include both', async () => {
    const dieselEntry = makeEntry({ id: 'diesel-001', rawQuantity: 100 });
    const waterEntry = makeEntry({
      id: 'water-001',
      sourceType: 'water_use',
      activityKind: { kind: 'water_use', subtype: 'potable_mixed' },
      rawQuantity: 150,
      rawUnit: 'kgal_us',
    });
    const { service, emissionResultRepo } = makeService({ entries: [dieselEntry, waterEntry] });
    const { totals, errors } = await service.evaluate('period-001');

    expect(errors).toHaveLength(0);
    // GHG: 100 × 2.5139 = 251.39; water: 0
    expect(totals.totalCo2eKg).toBeCloseTo(251.39, 2);
    expect(totals.recordCount).toBe(2);
    // Only GHG entry should be persisted
    expect(emissionResultRepo.insertMany).toHaveBeenCalledOnce();
    const [rows] = emissionResultRepo.insertMany.mock.calls[0]!;
    expect(rows).toHaveLength(1);
    expect(rows[0].result.scope).toBe('scope1');
  });

  it('multiple water subtypes accumulate recordCount but zero CO2e', async () => {
    const entries = [
      makeEntry({
        id: 'w1',
        sourceType: 'water_use',
        activityKind: { kind: 'water_use', subtype: 'potable_mixed' },
        rawQuantity: 100,
        rawUnit: 'kgal_us',
      }),
      makeEntry({
        id: 'w2',
        sourceType: 'water_use',
        activityKind: { kind: 'water_use', subtype: 'reclaimed_mixed' },
        rawQuantity: 30,
        rawUnit: 'kgal_us',
      }),
      makeEntry({
        id: 'w3',
        sourceType: 'waste',
        activityKind: { kind: 'waste', subtype: 'disposed_trash' },
        rawQuantity: 2.5,
        rawUnit: 'ton_us',
      }),
    ];
    const { service, emissionResultRepo } = makeService({ entries, factors: new Map() });
    const { totals } = await service.evaluate('period-001');

    expect(totals.totalCo2eKg).toBe(0);
    expect(totals.recordCount).toBe(3);
    expect(emissionResultRepo.insertMany).not.toHaveBeenCalled();
  });

  it('scope2 electricity evaluated correctly', async () => {
    const elecEntry = makeEntry({
      id: 'elec-001',
      sourceType: 'purchased_electricity',
      activityKind: { kind: 'purchased_electricity', gridRegion: 'SEIN_PERU' },
      rawQuantity: 1000,
      rawUnit: 'kWh',
    });
    const elecFactor: EmissionFactor = {
      id: 'ef-elec',
      setId: 'MINEM_2023',
      setVersion: '2023',
      activityKey: 'purchased_electricity.SEIN_PERU',
      region: 'SEIN_PERU',
      factorKgCo2ePerUnit: 0.4517,
      standardUnit: 'kWh',
    };
    const { service } = makeService({
      entries: [elecEntry],
      factors: new Map([['purchased_electricity.SEIN_PERU', elecFactor]]),
    });
    const { totals } = await service.evaluate('period-001');
    expect(totals.totalCo2eKg).toBeCloseTo(451.7, 1);
    expect(totals.byScope['scope2']).toBeCloseTo(451.7, 1);
    expect(totals.byScope['scope1']).toBe(0);
  });

  it('mixed scope1 + scope2 entries produce correct split totals', async () => {
    const dieselEntry = makeEntry({
      id: 'diesel-001',
      sourceType: 'stationary_combustion',
      activityKind: { kind: 'stationary_combustion', fuel: 'diesel' },
      rawQuantity: 100,
      rawUnit: 'L',
    });
    const elecEntry = makeEntry({
      id: 'elec-001',
      sourceType: 'purchased_electricity',
      activityKind: { kind: 'purchased_electricity', gridRegion: 'SEIN_PERU' },
      rawQuantity: 1000,
      rawUnit: 'kWh',
    });
    const elecFactor: EmissionFactor = {
      id: 'ef-elec',
      setId: 'MINEM_2023',
      setVersion: '2023',
      activityKey: 'purchased_electricity.SEIN_PERU',
      region: 'SEIN_PERU',
      factorKgCo2ePerUnit: 0.4517,
      standardUnit: 'kWh',
    };
    const { service, emissionResultRepo } = makeService({
      entries: [dieselEntry, elecEntry],
      factors: new Map([
        ['stationary_combustion.diesel', dieselFactor],
        ['purchased_electricity.SEIN_PERU', elecFactor],
      ]),
    });
    const { totals, errors } = await service.evaluate('period-001');

    expect(errors).toHaveLength(0);
    // scope1: 100L × 2.5139 = 251.39; scope2: 1000kWh × 0.4517 = 451.7
    expect(totals.byScope['scope1']).toBeCloseTo(251.39, 1);
    expect(totals.byScope['scope2']).toBeCloseTo(451.7, 1);
    expect(totals.totalCo2eKg).toBeCloseTo(703.09, 0);
    expect(totals.recordCount).toBe(2);
    // both results persisted
    const [rows] = emissionResultRepo.insertMany.mock.calls[0]!;
    expect(rows).toHaveLength(2);
    const scopes = rows.map((r: { result: { scope: string } }) => r.result.scope).sort();
    expect(scopes).toEqual(['scope1', 'scope2']);
  });

  it('purchased_steam entry assigned to scope2', async () => {
    const steamEntry = makeEntry({
      id: 'steam-001',
      sourceType: 'purchased_steam',
      activityKind: { kind: 'purchased_steam' },
      rawQuantity: 500,
      rawUnit: 'kWh',
    });
    const steamFactor: EmissionFactor = {
      id: 'ef-steam',
      setId: 'DEFRA_2024',
      setVersion: '2024',
      activityKey: 'purchased_steam.default',
      region: 'GLOBAL',
      factorKgCo2ePerUnit: 0.18,
      standardUnit: 'kWh',
    };
    const { service } = makeService({
      entries: [steamEntry],
      factors: new Map([['purchased_steam.default', steamFactor]]),
    });
    const { totals } = await service.evaluate('period-001');
    // 500 × 0.18 = 90
    expect(totals.totalCo2eKg).toBeCloseTo(90, 1);
    expect(totals.byScope['scope2']).toBeCloseTo(90, 1);
    expect(totals.byScope['scope1']).toBe(0);
  });

  it('byScope totals match sum of individual result scopes', async () => {
    const e1 = makeEntry({ id: 'e1', rawQuantity: 100 }); // scope1: 251.39
    const e2 = makeEntry({ id: 'e2', rawQuantity: 200 }); // scope1: 502.78
    const { service } = makeService({ entries: [e1, e2] });
    const { totals } = await service.evaluate('period-001');
    // both diesel → scope1 only; scope2 must be exactly 0
    expect(totals.byScope['scope1']).toBeCloseTo(totals.totalCo2eKg, 4);
    expect(totals.byScope['scope2']).toBe(0);
    expect(totals.byScope['scope1'] + totals.byScope['scope2']).toBeCloseTo(totals.totalCo2eKg, 4);
  });
});
