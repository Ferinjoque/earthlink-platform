import type { SupabaseClient } from '@supabase/supabase-js';
import type { EvaluationTotals, GhgScope } from '../calc/types';

export interface PeriodSummary {
  periodId: string;
  totalCo2eKg: number;
  scope1Co2eKg: number;
  scope2Co2eKg: number;
  resultCount: number;
}

export class EvaluationRepository {
  constructor(private readonly client: SupabaseClient) {}

  async summaryByPeriod(periodId: string): Promise<PeriodSummary | null> {
    const { data, error } = await this.client
      .from('emission_results')
      .select('co2e_kg, scope')
      .eq('reporting_period_id', periodId);
    if (error ?? !data) return null;

    const rows = data as Array<{ co2e_kg: number; scope: number }>;
    if (rows.length === 0) return null;

    let total = 0;
    let s1 = 0;
    let s2 = 0;
    for (const r of rows) {
      total += r.co2e_kg;
      if (r.scope === 1) s1 += r.co2e_kg;
      else s2 += r.co2e_kg;
    }

    return {
      periodId,
      totalCo2eKg: total,
      scope1Co2eKg: s1,
      scope2Co2eKg: s2,
      resultCount: rows.length,
    };
  }

  async totalsForPeriod(periodId: string): Promise<EvaluationTotals> {
    const summary = await this.summaryByPeriod(periodId);
    if (!summary) {
      return {
        totalCo2eKg: 0,
        byScope: { scope1: 0, scope2: 0, none: 0 },
        byActivity: {},
        recordCount: 0,
      };
    }

    return {
      totalCo2eKg: summary.totalCo2eKg,
      byScope: {
        scope1: summary.scope1Co2eKg,
        scope2: summary.scope2Co2eKg,
        none: 0,
      },
      byActivity: {},
      recordCount: summary.resultCount,
    };
  }
}
