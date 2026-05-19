import { describe, it, expect } from 'vitest';
import {
  StationaryCombustionSource,
  MobileCombustionSource,
  PurchasedElectricitySource,
  PurchasedSteamSource,
  FugitiveEmissionSource,
  WaterUseSource,
  WasteSource,
} from '../../../src/domain/EmissionSource';

describe('StationaryCombustionSource', () => {
  it('returns scope1', () => {
    const src = new StationaryCombustionSource('diesel');
    expect(src.scope()).toBe('scope1');
  });

  it('allows valid units for diesel', () => {
    const src = new StationaryCombustionSource('diesel');
    expect(src.validate('L')).toEqual({ valid: true });
    expect(src.validate('gallon')).toEqual({ valid: true });
  });

  it('rejects invalid unit for diesel', () => {
    const src = new StationaryCombustionSource('diesel');
    const result = src.validate('kWh');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain('kWh');
    }
  });

  it('allows m3_ng for natural_gas', () => {
    const src = new StationaryCombustionSource('natural_gas');
    expect(src.validate('m3_ng')).toEqual({ valid: true });
  });

  it('allows therms and MMBtu for natural_gas', () => {
    const src = new StationaryCombustionSource('natural_gas');
    expect(src.validate('therms')).toEqual({ valid: true });
    expect(src.validate('MMBtu')).toEqual({ valid: true });
  });

  it('returns correct factorKey', () => {
    const src = new StationaryCombustionSource('lpg');
    expect(src.factorKey()).toBe('stationary_combustion.lpg');
  });

  it('carries correct activityKind discriminant', () => {
    const src = new StationaryCombustionSource('natural_gas');
    expect(src.activityKind.kind).toBe('stationary_combustion');
  });
});

describe('MobileCombustionSource', () => {
  it('returns scope1', () => {
    expect(new MobileCombustionSource('gasoline').scope()).toBe('scope1');
  });

  it('allows L (liters)', () => {
    const src = new MobileCombustionSource('diesel');
    expect(src.validate('L')).toEqual({ valid: true });
  });

  it('returns correct factorKey', () => {
    const src = new MobileCombustionSource('gasoline');
    expect(src.factorKey()).toBe('mobile_combustion.gasoline');
  });
});

describe('PurchasedElectricitySource', () => {
  it('returns scope2', () => {
    expect(new PurchasedElectricitySource('SEIN_PERU').scope()).toBe('scope2');
  });

  it('allows kWh and MWh', () => {
    const src = new PurchasedElectricitySource('SEIN_PERU');
    expect(src.validate('kWh')).toEqual({ valid: true });
    expect(src.validate('MWh')).toEqual({ valid: true });
  });

  it('includes gridRegion in factorKey', () => {
    const src = new PurchasedElectricitySource('EU_AVERAGE');
    expect(src.factorKey()).toBe('purchased_electricity.EU_AVERAGE');
  });

  it('rejects L as unit', () => {
    const src = new PurchasedElectricitySource('SEIN_PERU');
    const result = src.validate('L');
    expect(result.valid).toBe(false);
  });
});

describe('PurchasedSteamSource', () => {
  it('returns scope2', () => {
    expect(new PurchasedSteamSource().scope()).toBe('scope2');
  });

  it('has stable factorKey', () => {
    expect(new PurchasedSteamSource().factorKey()).toBe('purchased_steam.default');
  });
});

describe('FugitiveEmissionSource', () => {
  it('returns scope1', () => {
    expect(new FugitiveEmissionSource('R410A').scope()).toBe('scope1');
  });

  it('only allows kg', () => {
    const src = new FugitiveEmissionSource('R134A');
    expect(src.validate('kg')).toEqual({ valid: true });
    expect(src.validate('L').valid).toBe(false);
  });

  it('returns correct factorKey', () => {
    const src = new FugitiveEmissionSource('R32');
    expect(src.factorKey()).toBe('fugitive.R32');
  });
});

describe('requiredEvidence', () => {
  it('StationaryCombustionSource returns non-empty string', () => {
    expect(new StationaryCombustionSource('diesel').requiredEvidence().length).toBeGreaterThan(0);
  });

  it('MobileCombustionSource returns non-empty string', () => {
    expect(new MobileCombustionSource('gasoline').requiredEvidence().length).toBeGreaterThan(0);
  });

  it('FugitiveEmissionSource returns non-empty string', () => {
    expect(new FugitiveEmissionSource('R410A').requiredEvidence().length).toBeGreaterThan(0);
  });

  it('PurchasedElectricitySource returns non-empty string', () => {
    expect(new PurchasedElectricitySource('SEIN_PERU').requiredEvidence().length).toBeGreaterThan(0);
  });

  it('PurchasedSteamSource returns non-empty string', () => {
    expect(new PurchasedSteamSource().requiredEvidence().length).toBeGreaterThan(0);
  });
});

describe('EmissionSource polymorphism', () => {
  it('validate can be called uniformly across all source types', () => {
    const sources = [
      new StationaryCombustionSource('diesel'),
      new MobileCombustionSource('gasoline'),
      new PurchasedElectricitySource('SEIN_PERU'),
      new PurchasedSteamSource(),
      new FugitiveEmissionSource('R410A'),
    ];

    for (const source of sources) {
      const result = source.validate('L');
      expect(typeof result.valid).toBe('boolean');
    }
  });

  it('scope and factorKey accessible without type switching', () => {
    const sources = [
      new StationaryCombustionSource('diesel'),
      new PurchasedElectricitySource('SEIN_PERU'),
    ];

    for (const source of sources) {
      expect(['scope1', 'scope2']).toContain(source.scope());
      expect(typeof source.factorKey()).toBe('string');
    }
  });
});

// ── StationaryCombustionSource — new GRESB fuels ──────────────────────────────

describe('StationaryCombustionSource — fuel_oil_no2', () => {
  it('returns scope1', () => {
    expect(new StationaryCombustionSource('fuel_oil_no2').scope()).toBe('scope1');
  });

  it('allows L and gallon', () => {
    const src = new StationaryCombustionSource('fuel_oil_no2');
    expect(src.validate('L')).toEqual({ valid: true });
    expect(src.validate('gallon')).toEqual({ valid: true });
  });

  it('allows kBtu', () => {
    const src = new StationaryCombustionSource('fuel_oil_no2');
    expect(src.validate('kBtu')).toEqual({ valid: true });
  });

  it('rejects kWh (not in allowed list for fuel_oil_no2)', () => {
    const src = new StationaryCombustionSource('fuel_oil_no2');
    expect(src.validate('kWh').valid).toBe(false);
  });

  it('returns correct factorKey', () => {
    expect(new StationaryCombustionSource('fuel_oil_no2').factorKey()).toBe(
      'stationary_combustion.fuel_oil_no2',
    );
  });

  it('activityKind.fuel matches constructor arg', () => {
    const src = new StationaryCombustionSource('fuel_oil_no2');
    expect(src.activityKind.kind).toBe('stationary_combustion');
    if (src.activityKind.kind === 'stationary_combustion') {
      expect(src.activityKind.fuel).toBe('fuel_oil_no2');
    }
  });
});

describe('StationaryCombustionSource — propane', () => {
  it('returns scope1', () => {
    expect(new StationaryCombustionSource('propane').scope()).toBe('scope1');
  });

  it('allows L, gallon, kBtu', () => {
    const src = new StationaryCombustionSource('propane');
    expect(src.validate('L')).toEqual({ valid: true });
    expect(src.validate('gallon')).toEqual({ valid: true });
    expect(src.validate('kBtu')).toEqual({ valid: true });
  });

  it('returns correct factorKey', () => {
    expect(new StationaryCombustionSource('propane').factorKey()).toBe(
      'stationary_combustion.propane',
    );
  });

  it('requiredEvidence is non-empty', () => {
    expect(new StationaryCombustionSource('propane').requiredEvidence().length).toBeGreaterThan(0);
  });
});

// ── WaterUseSource ────────────────────────────────────────────────────────────

describe('WaterUseSource', () => {
  it('returns none scope', () => {
    expect(new WaterUseSource('potable_mixed').scope()).toBe('none');
    expect(new WaterUseSource('all_sources').scope()).toBe('none');
    expect(new WaterUseSource('reclaimed_mixed').scope()).toBe('none');
  });

  it('allows kgal_us', () => {
    expect(new WaterUseSource('potable_mixed').validate('kgal_us')).toEqual({ valid: true });
  });

  it('allows megaliter', () => {
    expect(new WaterUseSource('potable_mixed').validate('megaliter')).toEqual({ valid: true });
  });

  it('allows m3', () => {
    expect(new WaterUseSource('potable_indoor').validate('m3')).toEqual({ valid: true });
  });

  it('allows L and gallon', () => {
    const src = new WaterUseSource('other_mixed');
    expect(src.validate('L')).toEqual({ valid: true });
    expect(src.validate('gallon')).toEqual({ valid: true });
  });

  it('rejects kg (mass unit not valid for water)', () => {
    expect(new WaterUseSource('potable_mixed').validate('kg').valid).toBe(false);
  });

  it('rejects kWh', () => {
    expect(new WaterUseSource('potable_mixed').validate('kWh').valid).toBe(false);
  });

  it('factorKey includes subtype', () => {
    expect(new WaterUseSource('potable_mixed').factorKey()).toBe('water_use.potable_mixed');
    expect(new WaterUseSource('reclaimed_mixed').factorKey()).toBe('water_use.reclaimed_mixed');
    expect(new WaterUseSource('well_outdoor').factorKey()).toBe('water_use.well_outdoor');
  });

  it('activityKind discriminant is water_use', () => {
    const src = new WaterUseSource('potable_mixed');
    expect(src.activityKind.kind).toBe('water_use');
    if (src.activityKind.kind === 'water_use') {
      expect(src.activityKind.subtype).toBe('potable_mixed');
    }
  });

  it('requiredEvidence is non-empty', () => {
    expect(new WaterUseSource('all_sources').requiredEvidence().length).toBeGreaterThan(0);
  });
});

// ── WasteSource ───────────────────────────────────────────────────────────────

describe('WasteSource', () => {
  it('returns none scope', () => {
    expect(new WasteSource('disposed_trash').scope()).toBe('none');
    expect(new WasteSource('recycled').scope()).toBe('none');
    expect(new WasteSource('composted').scope()).toBe('none');
  });

  it('allows ton_us', () => {
    expect(new WasteSource('disposed_trash').validate('ton_us')).toEqual({ valid: true });
  });

  it('allows tonne, kg, lb', () => {
    const src = new WasteSource('recycled');
    expect(src.validate('tonne')).toEqual({ valid: true });
    expect(src.validate('kg')).toEqual({ valid: true });
    expect(src.validate('lb')).toEqual({ valid: true });
  });

  it('rejects L (liquid volume not valid for waste)', () => {
    expect(new WasteSource('disposed_trash').validate('L').valid).toBe(false);
  });

  it('rejects kWh', () => {
    expect(new WasteSource('composted').validate('kWh').valid).toBe(false);
  });

  it('factorKey includes subtype', () => {
    expect(new WasteSource('disposed_trash').factorKey()).toBe('waste.disposed_trash');
    expect(new WasteSource('recycled').factorKey()).toBe('waste.recycled');
    expect(new WasteSource('composted').factorKey()).toBe('waste.composted');
  });

  it('activityKind discriminant is waste', () => {
    const src = new WasteSource('recycled');
    expect(src.activityKind.kind).toBe('waste');
    if (src.activityKind.kind === 'waste') {
      expect(src.activityKind.subtype).toBe('recycled');
    }
  });

  it('requiredEvidence is non-empty', () => {
    expect(new WasteSource('composted').requiredEvidence().length).toBeGreaterThan(0);
  });
});

// ── Extended polymorphism — all source types ──────────────────────────────────

describe('EmissionSource polymorphism — extended with GRESB sources', () => {
  it('validate can be called on all GRESB source types', () => {
    const sources = [
      new WaterUseSource('potable_mixed'),
      new WaterUseSource('reclaimed_mixed'),
      new WasteSource('disposed_trash'),
      new WasteSource('recycled'),
    ];
    for (const source of sources) {
      const result = source.validate('L');
      expect(typeof result.valid).toBe('boolean');
    }
  });

  it('all no-scope sources return none', () => {
    const sources = [
      new WaterUseSource('all_sources'),
      new WasteSource('composted'),
    ];
    for (const source of sources) {
      expect(source.scope()).toBe('none');
    }
  });
});
