/**
 * The pure FP pipeline — implemented fully in feat/phase-2-calc-engine.
 * Stubs here so the module graph resolves and CI passes on Phase 0.
 */
import type {
  ActivityRecord,
  EmissionResult,
  EvaluationTotals,
  FactorTable,
  RiskScore,
  CalcResult,
} from './types';

export function calculate(
  _record: ActivityRecord,
  _factors: FactorTable,
): CalcResult<EmissionResult> {
  throw new Error('Not implemented — Phase 2');
}

export function aggregate(_results: readonly EmissionResult[]): EvaluationTotals {
  throw new Error('Not implemented — Phase 2');
}

export function score(
  _totals: EvaluationTotals,
  _history: readonly EvaluationTotals[],
): RiskScore {
  throw new Error('Not implemented — Phase 2');
}
