import { describe, it, expect, vi } from 'vitest';
import { EmissionResultRepository } from '../../../src/repos/EmissionResultRepository';
import type { EmissionFactor, EmissionResult } from '../../../src/calc/types';

function makeClient(selectData: unknown, insertError: { message: string } | null = null) {
  const selectChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: selectData, error: null }),
  };
  const insertChain = {
    insert: vi.fn().mockResolvedValue({ data: null, error: insertError }),
    upsert: vi.fn().mockResolvedValue({ data: null, error: insertError }),
  };
  return {
    from: vi.fn().mockImplementation(() => ({ ...selectChain, ...insertChain })),
  };
}

const FACTOR: EmissionFactor = {
  id: 'factor-1',
  setId: 'ghg-2023',
  setVersion: '2023',
  activityKey: 'stationary_combustion:natural_gas',
  region: 'PE',
  standardUnit: 'm3_ng',
  factorKgCo2ePerUnit: 2.1,
};

const BASE_RESULT: EmissionResult = {
  activityRecordId: 'entry-1',
  factorId: 'factor-1',
  factorSetId: '',
  factorSetVersion: '',
  normalizedValue: 100,
  normalizedUnit: 'm3',
  co2eKg: 210,
  scope: 'scope1',
  engineVersion: '1.0',
  calcHash: 'abc123',
};

// ── findByPeriodId ─────────────────────────────────────────────────────────────

describe('EmissionResultRepository.findByPeriodId - mapeo de scope', () => {
  it('mapea scope=1 a scope1', async () => {
    const row = { activity_entry_id: 'e1', emission_factor_id: null, normalized_quantity: 100, normalized_unit: 'm3', co2e_kg: 210, scope: 1, calc_version: '1.0', calc_hash: 'h1' };
    const client = makeClient([row]);
    const repo = new EmissionResultRepository(client as never);
    const results = await repo.findByPeriodId('period-1');
    expect(results[0]?.scope).toBe('scope1');
  });

  it('mapea scope=2 a scope2', async () => {
    const row = { activity_entry_id: 'e2', emission_factor_id: null, normalized_quantity: 50, normalized_unit: 'kWh', co2e_kg: 25, scope: 2, calc_version: '1.0', calc_hash: 'h2' };
    const client = makeClient([row]);
    const repo = new EmissionResultRepository(client as never);
    const results = await repo.findByPeriodId('period-1');
    expect(results[0]?.scope).toBe('scope2');
  });

  it('mapea scope=null a none (agua/residuos)', async () => {
    const row = { activity_entry_id: 'e3', emission_factor_id: null, normalized_quantity: 10, normalized_unit: 'm3', co2e_kg: 0, scope: null, calc_version: '1.0', calc_hash: 'h3' };
    const client = makeClient([row]);
    const repo = new EmissionResultRepository(client as never);
    const results = await repo.findByPeriodId('period-1');
    expect(results[0]?.scope).toBe('none');
  });

  it('retorna array vacío si la query falla', async () => {
    const failClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      }),
    };
    const repo = new EmissionResultRepository(failClient as never);
    const results = await repo.findByPeriodId('period-1');
    expect(results).toEqual([]);
  });
});

// ── insert / insertMany ────────────────────────────────────────────────────────

describe('EmissionResultRepository.insert', () => {
  it('lanza error en español cuando el insert falla', async () => {
    const client = makeClient(null, { message: 'unique constraint' });
    const repo = new EmissionResultRepository(client as never);
    await expect(repo.insert(BASE_RESULT, 'period-1', FACTOR)).rejects.toThrow(
      /Error al insertar emission_result/,
    );
  });
});

describe('EmissionResultRepository.insertMany', () => {
  it('no hace nada con array vacío', async () => {
    const client = makeClient(null);
    const repo = new EmissionResultRepository(client as never);
    await expect(repo.insertMany([])).resolves.toBeUndefined();
    expect(client.from).not.toHaveBeenCalled();
  });

  it('lanza error en español cuando el upsert falla', async () => {
    const client = makeClient(null, { message: 'constraint error' });
    const repo = new EmissionResultRepository(client as never);
    const payload = [{ result: BASE_RESULT, periodId: 'period-1', factor: FACTOR }];
    await expect(repo.insertMany(payload)).rejects.toThrow(
      /Error al insertar emission_results en lote/,
    );
  });
});

// ── append-only guards ─────────────────────────────────────────────────────────

describe('EmissionResultRepository - métodos prohibidos', () => {
  it('update lanza error en español', () => {
    const repo = new EmissionResultRepository({} as never);
    expect(() => repo.update()).toThrow(/solo escritura/);
  });

  it('delete lanza error en español', () => {
    const repo = new EmissionResultRepository({} as never);
    expect(() => repo.delete()).toThrow(/solo escritura/);
  });
});
