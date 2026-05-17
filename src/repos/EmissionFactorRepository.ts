/** Stub — implemented in feat/phase-3-domain-repos */
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseRepository } from './SupabaseRepository';
import { Entity } from '../domain/Entity';
import type { EmissionFactor } from '../calc/types';

class EmissionFactorEntity extends Entity {
  constructor(
    readonly factor: EmissionFactor,
    createdAt: Date,
  ) {
    super(factor.id, createdAt);
  }
}

export class EmissionFactorRepository extends SupabaseRepository<EmissionFactorEntity> {
  protected readonly tableName = 'emission_factors';

  constructor(client: SupabaseClient) {
    super(client);
  }

  protected toEntity(row: Record<string, unknown>): EmissionFactorEntity {
    const factor: EmissionFactor = {
      id: row['id'] as string,
      setId: row['set_id'] as string,
      setVersion: row['set_version'] as string,
      activityKey: row['activity_key'] as string,
      region: row['region'] as string,
      factorKgCo2ePerUnit: Number(row['factor_kg_co2e_per_unit']),
      standardUnit: row['standard_unit'] as EmissionFactor['standardUnit'],
    };
    return new EmissionFactorEntity(factor, new Date(row['created_at'] as string));
  }

  protected toRow(entity: EmissionFactorEntity): Record<string, unknown> {
    return {
      id: entity.factor.id,
      set_id: entity.factor.setId,
      set_version: entity.factor.setVersion,
      activity_key: entity.factor.activityKey,
      region: entity.factor.region,
      factor_kg_co2e_per_unit: entity.factor.factorKgCo2ePerUnit,
      standard_unit: entity.factor.standardUnit,
      created_at: entity.createdAt.toISOString(),
    };
  }

  async findBySetId(setId: string): Promise<readonly EmissionFactor[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('set_id', setId);
    if (error ?? !data) return [];
    return (data as Record<string, unknown>[]).map((row) => this.toEntity(row).factor);
  }
}
