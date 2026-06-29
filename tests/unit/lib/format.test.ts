import { describe, it, expect } from 'vitest';
import { formatearKg } from '@/lib/format';

describe('formatearKg', () => {
  it('returns hyphen for zero', () => {
    expect(formatearKg(0)).toBe('-');
  });

  it('returns kg with 2 decimals for values under 1 000', () => {
    expect(formatearKg(500)).toBe('500.00 kg');
    expect(formatearKg(0.5)).toBe('0.50 kg');
    expect(formatearKg(999.99)).toBe('999.99 kg');
  });

  it('returns tCO₂e with 2 decimals for values >= 1 000', () => {
    expect(formatearKg(1_000)).toBe('1.00 tCO₂e');
    expect(formatearKg(1_500)).toBe('1.50 tCO₂e');
    expect(formatearKg(12_345)).toBe('12.35 tCO₂e');
  });

  it('boundary: 999.999 stays in kg', () => {
    expect(formatearKg(999.999)).toMatch(/kg$/);
  });

  it('boundary: 1 000.000 switches to tCO₂e', () => {
    expect(formatearKg(1_000)).toMatch(/tCO₂e$/);
  });

  it('returns hyphen for NaN', () => {
    expect(formatearKg(NaN)).toBe('-');
  });

  it('returns hyphen for Infinity', () => {
    expect(formatearKg(Infinity)).toBe('-');
    expect(formatearKg(-Infinity)).toBe('-');
  });

  it('returns hyphen for negative values', () => {
    expect(formatearKg(-1)).toBe('-');
    expect(formatearKg(-0.001)).toBe('-');
  });
});
