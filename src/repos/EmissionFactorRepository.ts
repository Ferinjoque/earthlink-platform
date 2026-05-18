import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseRepository } from './SupabaseRepository';
import { Entity } from '../domain/Entity';
import type { EmissionFactor, FactorTable, Unit } from '../calc/types';

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
  protected override readonly selectColumns = 'id, set_id, set_version, activity_key, grid_region_id, source_db, co2e_per_unit, unit, created_at';

  constructor(client: SupabaseClient) {
    super(client);
  }

  protected toEntity(row: Record<string, unknown>): EmissionFactorEntity {
    const factor: EmissionFactor = {
      id: row['id'] as string,
      setId: (row['set_id'] as string | null) ?? (row['source_db'] as string),
      setVersion: (row['set_version'] as string | null) ?? '1',
      activityKey: (row['activity_key'] as string | null) ?? '',
      region: (row['grid_region_id'] as string | null) ?? 'GLOBAL',
      factorKgCo2ePerUnit: Number(row['co2e_per_unit']),
      standardUnit: row['unit'] as Unit,
    };
    return new EmissionFactorEntity(factor, new Date(row['created_at'] as string));
  }

  protected toRow(entity: EmissionFactorEntity): Record<string, unknown> {
    return {
      id: entity.factor.id,
      co2e_per_unit: entity.factor.factorKgCo2ePerUnit,
      unit: entity.factor.standardUnit,
      created_at: entity.createdAt.toISOString(),
    };
  }

  async buildFactorTable(): Promise<FactorTable> {
    const entities = await this.findAll();
    const map = new Map<string, EmissionFactor>();
    for (const entity of entities as EmissionFactorEntity[]) {
      if (entity.factor.activityKey) {
        map.set(entity.factor.activityKey, entity.factor);
      }
    }
    return map;
  }

  async findByActivityKey(activityKey: string): Promise<EmissionFactor | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('id, set_id, set_version, activity_key, grid_region_id, source_db, co2e_per_unit, unit, created_at')
      .eq('activity_key', activityKey)
      .maybeSingle();
    if (error ?? !data) return null;
    return this.toEntity(data as Record<string, unknown>).factor;
  }
}
