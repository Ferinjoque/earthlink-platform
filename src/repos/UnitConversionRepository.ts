import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConversionTable } from '../calc/types';

export class UnitConversionRepository {
  constructor(private readonly client: SupabaseClient) {}

  async buildConversionTable(): Promise<ConversionTable> {
    const { data, error } = await this.client.from('unit_conversions').select('from_unit, to_unit, factor');
    if (error ?? !data) return new Map();
    const map = new Map<string, number>();
    for (const row of data as Array<{ from_unit: string; to_unit: string; factor: number }>) {
      map.set(`${row.from_unit}->${row.to_unit}`, row.factor);
    }
    return map;
  }
}
