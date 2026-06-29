import { describe, it, expect } from 'vitest';

// Replica de la función en dashboard/page.tsx, audit/[periodId]/page.tsx y suppliers/[id]/page.tsx
// Los tests documentan el contrato correcto de unidades:
//   1 000 000 kg = 1 000 tCO₂e = 1 ktCO₂e (NO MtCO₂e)
function formatearCo2e(kg: number): { valor: string; unidad: string } {
  if (kg === 0) return { valor: '0', unidad: 'kg' };
  if (kg >= 1_000_000) return { valor: (kg / 1_000_000).toFixed(2), unidad: 'ktCO₂e' };
  if (kg >= 1_000) return { valor: (kg / 1_000).toFixed(3), unidad: 'tCO₂e' };
  return { valor: kg.toFixed(1), unidad: 'kg CO₂e' };
}

describe('formatearCo2e - unidades correctas', () => {
  it('0 kg → "0 kg"', () => {
    expect(formatearCo2e(0)).toEqual({ valor: '0', unidad: 'kg' });
  });

  it('500 kg → kg CO₂e', () => {
    expect(formatearCo2e(500).unidad).toBe('kg CO₂e');
  });

  it('5 000 kg (5 tCO₂e) → tCO₂e', () => {
    const r = formatearCo2e(5_000);
    expect(r.valor).toBe('5.000');
    expect(r.unidad).toBe('tCO₂e');
  });

  it('1 000 000 kg (1 000 tCO₂e = 1 ktCO₂e) → ktCO₂e, no MtCO₂e', () => {
    const r = formatearCo2e(1_000_000);
    expect(r.valor).toBe('1.00');
    expect(r.unidad).toBe('ktCO₂e');
    expect(r.unidad).not.toBe('MtCO₂e');
  });

  it('2 000 000 kg → 2.00 ktCO₂e', () => {
    const r = formatearCo2e(2_000_000);
    expect(r.valor).toBe('2.00');
    expect(r.unidad).toBe('ktCO₂e');
  });
});
