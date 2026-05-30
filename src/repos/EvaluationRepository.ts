import Big from 'big.js';
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

    let total = new Big(0);
    let s1 = new Big(0);
    let s2 = new Big(0);
    for (const r of rows) {
      const val = new Big(r.co2e_kg);
      total = total.plus(val);
      if (r.scope === 1) s1 = s1.plus(val);
      else s2 = s2.plus(val);
    }

    return {
      periodId,
      totalCo2eKg: total.toNumber(),
      scope1Co2eKg: s1.toNumber(),
      scope2Co2eKg: s2.toNumber(),
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
