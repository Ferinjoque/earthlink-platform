import type { SupabaseClient } from '@supabase/supabase-js';
import type { EmissionFactor, EmissionResult } from '../calc/types';

export class EmissionResultRepository {
  constructor(private readonly client: SupabaseClient) {}

  async insert(result: EmissionResult, periodId: string, factor: EmissionFactor): Promise<void> {
    const row = {
      activity_entry_id: result.activityRecordId,
      reporting_period_id: periodId,
      scope: result.scope === 'scope1' ? 1 : result.scope === 'scope2' ? 2 : null,
      co2e_kg: result.co2eKg,
      factor_used: factor.factorKgCo2ePerUnit,
      factor_unit: factor.standardUnit,
      normalized_quantity: result.normalizedValue,
      normalized_unit: result.normalizedUnit,
      calc_hash: result.calcHash,
      calc_version: result.engineVersion,
      emission_factor_id: result.factorId ?? null,
    };
    const { error } = await this.client.from('emission_results').insert(row);
    if (error) throw new Error(`Error al insertar emission_result: ${error.message}`);
  }

  async insertMany(
    results: readonly { result: EmissionResult; periodId: string; factor: EmissionFactor }[],
  ): Promise<void> {
    if (results.length === 0) return;
    const rows = results.map(({ result, periodId, factor }) => ({
      activity_entry_id: result.activityRecordId,
      reporting_period_id: periodId,
      scope: result.scope === 'scope1' ? 1 : result.scope === 'scope2' ? 2 : null,
      co2e_kg: result.co2eKg,
      factor_used: factor.factorKgCo2ePerUnit,
      factor_unit: factor.standardUnit,
      normalized_quantity: result.normalizedValue,
      normalized_unit: result.normalizedUnit,
      calc_hash: result.calcHash,
      calc_version: result.engineVersion,
      emission_factor_id: result.factorId ?? null,
    }));
    const { error } = await this.client
      .from('emission_results')
      .upsert(rows, { onConflict: 'calc_hash', ignoreDuplicates: true });
    if (error) throw new Error(`Error al insertar emission_results en lote: ${error.message}`);
  }

  async findByPeriodId(periodId: string): Promise<readonly EmissionResult[]> {
    const { data, error } = await this.client
      .from('emission_results')
      .select(
        'activity_entry_id, emission_factor_id, normalized_quantity, normalized_unit, co2e_kg, scope, calc_version, calc_hash',
      )
      .eq('reporting_period_id', periodId);
    if (error ?? !data) return [];
    return (data as Record<string, unknown>[]).map((row) => ({
      activityRecordId: row['activity_entry_id'] as string,
      factorId: (row['emission_factor_id'] as string | null) ?? '',
      factorSetId: '',
      factorSetVersion: '',
      normalizedValue: row['normalized_quantity'] as number,
      normalizedUnit: row['normalized_unit'] as EmissionResult['normalizedUnit'],
      co2eKg: row['co2e_kg'] as number,
      scope: row['scope'] === 1 ? ('scope1' as const) : row['scope'] === 2 ? ('scope2' as const) : ('none' as const),
      engineVersion: row['calc_version'] as string,
      calcHash: row['calc_hash'] as string,
    }));
  }

  update(): never {
    throw new Error('EmissionResultRepository es solo escritura — update no permitido');
  }

  delete(): never {
    throw new Error('EmissionResultRepository es solo escritura — delete no permitido');
  }
}
