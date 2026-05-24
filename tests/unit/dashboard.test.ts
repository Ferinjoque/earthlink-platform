import { describe, it, expect, vi } from 'vitest';

// Mockear módulos server-only antes de importar la página
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/headers', () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      getAll: vi.fn(() => []),
      set: vi.fn(),
    }),
  ),
}));
vi.mock('../../../src/services/supabase/server', () => ({
  createServerClient: vi.fn(),
}));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('next/font/google', () => ({
  Inter: () => ({ variable: '--font-inter', className: 'inter' }),
  Instrument_Serif: () => ({ variable: '--font-instrument', className: 'serif' }),
  JetBrains_Mono: () => ({ variable: '--font-mono', className: 'mono' }),
}));

import { formatearCo2e } from '../../src/app/(app)/dashboard/page';

describe('formatearCo2e', () => {
  it('returns 0 kg for zero input', () => {
    const result = formatearCo2e(0);
    expect(result.valor).toBe('0');
    expect(result.unidad).toBe('kg');
  });

  it('returns kg for values under 1000', () => {
    const result = formatearCo2e(999);
    expect(result.valor).toBe('999.0');
    expect(result.unidad).toBe('kg CO₂e');
  });

  it('converts to tCO₂e for values >= 1000', () => {
    const result = formatearCo2e(1000);
    expect(result.valor).toBe('1.000');
    expect(result.unidad).toBe('tCO₂e');
  });

  it('converts to ktCO₂e for values >= 1_000_000 (1 000 000 kg = 1 000 t = 1 kt)', () => {
    const result = formatearCo2e(1_000_000);
    expect(result.valor).toBe('1.00');
    expect(result.unidad).toBe('ktCO₂e');
  });

  it('handles mid-range tCO₂e correctly', () => {
    const result = formatearCo2e(5432.1);
    expect(result.valor).toBe('5.432');
    expect(result.unidad).toBe('tCO₂e');
  });

  it('handles large ktCO₂e correctly', () => {
    const result = formatearCo2e(2_500_000);
    expect(result.valor).toBe('2.50');
    expect(result.unidad).toBe('ktCO₂e');
  });
});
