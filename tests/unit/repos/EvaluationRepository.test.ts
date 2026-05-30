import { describe, it, expect, vi } from 'vitest';
import { EvaluationRepository } from '../../../src/repos/EvaluationRepository';
import type { SupabaseClient } from '@supabase/supabase-js';

function makeClient(rows: Array<{ co2e_kg: number; scope: number }> | null, error: { message: string } | null = null) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: rows, error }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe('EvaluationRepository.totalsForPeriod', () => {
  it('incluye clave none en byScope cuando no hay resultados', async () => {
    const repo = new EvaluationRepository(makeClient([]));
    const result = await repo.totalsForPeriod('00000000-0000-4000-8000-000000000001');
    expect(result.byScope).toHaveProperty('none', 0);
    expect(result.byScope).toHaveProperty('scope1', 0);
    expect(result.byScope).toHaveProperty('scope2', 0);
  });

  it('incluye clave none en byScope cuando hay resultados', async () => {
    const rows = [
      { co2e_kg: 100, scope: 1 },
      { co2e_kg: 200, scope: 2 },
    ];
    const repo = new EvaluationRepository(makeClient(rows));
    const result = await repo.totalsForPeriod('00000000-0000-4000-8000-000000000001');
    expect(result.byScope).toHaveProperty('none', 0);
    expect(result.byScope.scope1).toBe(100);
    expect(result.byScope.scope2).toBe(200);
  });

  it('totalCo2eKg suma correctamente', async () => {
    const rows = [
      { co2e_kg: 50, scope: 1 },
      { co2e_kg: 75, scope: 2 },
    ];
    const repo = new EvaluationRepository(makeClient(rows));
    const result = await repo.totalsForPeriod('00000000-0000-4000-8000-000000000001');
    expect(result.totalCo2eKg).toBe(125);
    expect(result.recordCount).toBe(2);
  });

  it('devuelve ceros cuando la DB retorna error', async () => {
    const repo = new EvaluationRepository(makeClient(null, { message: 'db error' }));
    const result = await repo.totalsForPeriod('00000000-0000-4000-8000-000000000001');
    expect(result.totalCo2eKg).toBe(0);
    expect(result.byScope).toEqual({ scope1: 0, scope2: 0, none: 0 });
  });
});
