import { describe, it, expect } from 'vitest';
import { traducirMensajeAnomalia } from '../../../src/lib/anomaly';

describe('traducirMensajeAnomalia', () => {
  it('returns empty string unchanged', () => {
    expect(traducirMensajeAnomalia('')).toBe('');
  });

  it('returns already-Spanish messages unchanged (nueva formato AnomalyService)', () => {
    const msg =
      'Combustión estacionaria: 1200 L es 3.45σ sobre la media histórica (800 L). Verificar datos.';
    expect(traducirMensajeAnomalia(msg)).toBe(msg);
  });

  it('returns already-Spanish messages unchanged (Verificar datos variant)', () => {
    const msg = 'Electricidad: 5000 kWh es 5.00σ sobre la media histórica (1000 kWh). Verificar datos.';
    expect(traducirMensajeAnomalia(msg)).toBe(msg);
  });

  it('translates seed-format English message', () => {
    const msg =
      'Diesel consumption of 1,500 L in Q1-2026 is 4.5σ above the Q4-2025 baseline of 800 L. Verify invoices.';
    const result = traducirMensajeAnomalia(msg);
    expect(result).toContain('Diesel');
    expect(result).toContain('Q1-2026');
    expect(result).toContain('4.5σ');
    expect(result).toContain('Q4-2025');
    expect(result).toContain('Verificar facturas');
    expect(result).not.toContain('consumption of');
  });

  it('translates old AnomalyService English format - stationary_combustion', () => {
    const msg =
      'stationary_combustion quantity 1200 L is 3.50σ above historical mean of 500 L. Verify.';
    const result = traducirMensajeAnomalia(msg);
    expect(result).toContain('Combustión estacionaria');
    expect(result).toContain('1200');
    expect(result).toContain('3.50σ');
    expect(result).toContain('500');
    expect(result).toContain('Verificar datos');
    expect(result).not.toContain('stationary_combustion quantity');
  });

  it('translates old AnomalyService English format - purchased_electricity', () => {
    const msg =
      'purchased_electricity quantity 8000 kWh is 6.20σ above historical mean of 2000 kWh. Verify.';
    const result = traducirMensajeAnomalia(msg);
    expect(result).toContain('Electricidad');
    expect(result).toContain('8000');
    expect(result).toContain('6.20σ');
  });

  it('translates old AnomalyService English format - fugitive', () => {
    const msg = 'fugitive quantity 45 kg is 45.88σ above historical mean of 1 kg. Verify.';
    const result = traducirMensajeAnomalia(msg);
    expect(result).toContain('Emisiones fugitivas');
    expect(result).toContain('45');
    expect(result).toContain('45.88σ');
  });

  it('passes through unrecognized English format unchanged', () => {
    const msg = 'Some completely unrelated message format.';
    expect(traducirMensajeAnomalia(msg)).toBe(msg);
  });

  it('falls back to source type key for unknown source types', () => {
    const msg = 'unknown_source quantity 100 kWh is 3.00σ above historical mean of 50 kWh. Verify.';
    const result = traducirMensajeAnomalia(msg);
    expect(result).toContain('unknown_source');
  });

  it('translates water_use to Spanish label', () => {
    const msg = 'water_use quantity 500 kgal_us is 4.10σ above historical mean of 120 kgal_us. Verify.';
    const result = traducirMensajeAnomalia(msg);
    expect(result).toContain('Consumo de agua');
    expect(result).not.toContain('water_use quantity');
  });

  it('translates waste to Spanish label', () => {
    const msg = 'waste quantity 8.5 ton_us is 5.20σ above historical mean of 2 ton_us. Verify.';
    const result = traducirMensajeAnomalia(msg);
    expect(result).toContain('Generación de residuos');
    expect(result).not.toContain('waste quantity');
  });
});
