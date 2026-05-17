import { describe, it, expect } from 'vitest';
import {
  StationaryCombustionSource,
  MobileCombustionSource,
  PurchasedElectricitySource,
  PurchasedSteamSource,
  FugitiveEmissionSource,
} from '../../../src/domain/EmissionSource';

describe('StationaryCombustionSource', () => {
  it('returns scope1', () => {
    const src = new StationaryCombustionSource('diesel');
    expect(src.scope()).toBe('scope1');
  });

  it('allows valid units for diesel', () => {
    const src = new StationaryCombustionSource('diesel');
    expect(src.validate('liters')).toEqual({ valid: true });
    expect(src.validate('gallons_us')).toEqual({ valid: true });
  });

  it('rejects invalid unit for diesel', () => {
    const src = new StationaryCombustionSource('diesel');
    const result = src.validate('kWh');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain('kWh');
    }
  });

  it('allows m3 for natural_gas', () => {
    const src = new StationaryCombustionSource('natural_gas');
    expect(src.validate('m3')).toEqual({ valid: true });
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

  it('allows liters', () => {
    const src = new MobileCombustionSource('diesel');
    expect(src.validate('liters')).toEqual({ valid: true });
  });

  it('returns correct factorKey', () => {
    const src = new MobileCombustionSource('gasoline');
    expect(src.factorKey()).toBe('mobile_combustion.gasoline');
  });
});

describe('PurchasedElectricitySource', () => {
  it('returns scope2', () => {
    expect(new PurchasedElectricitySource('PERU').scope()).toBe('scope2');
  });

  it('allows kWh and MWh', () => {
    const src = new PurchasedElectricitySource('PERU');
    expect(src.validate('kWh')).toEqual({ valid: true });
    expect(src.validate('MWh')).toEqual({ valid: true });
  });

  it('includes gridRegion in factorKey', () => {
    const src = new PurchasedElectricitySource('EU_AVG');
    expect(src.factorKey()).toBe('purchased_electricity.EU_AVG');
  });

  it('rejects liters as unit', () => {
    const src = new PurchasedElectricitySource('PERU');
    const result = src.validate('liters');
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
    expect(src.validate('liters').valid).toBe(false);
  });

  it('returns correct factorKey', () => {
    const src = new FugitiveEmissionSource('R32');
    expect(src.factorKey()).toBe('fugitive.R32');
  });
});

describe('EmissionSource polymorphism', () => {
  it('validate can be called uniformly across all source types', () => {
    const sources = [
      new StationaryCombustionSource('diesel'),
      new MobileCombustionSource('gasoline'),
      new PurchasedElectricitySource('PERU'),
      new PurchasedSteamSource(),
      new FugitiveEmissionSource('R410A'),
    ];

    for (const source of sources) {
      const result = source.validate('liters');
      expect(typeof result.valid).toBe('boolean');
    }
  });

  it('scope and factorKey accessible without type switching', () => {
    const sources = [
      new StationaryCombustionSource('diesel'),
      new PurchasedElectricitySource('PERU'),
    ];

    for (const source of sources) {
      expect(['scope1', 'scope2']).toContain(source.scope());
      expect(typeof source.factorKey()).toBe('string');
    }
  });
});
