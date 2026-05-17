/**
 * Pure FP calculation engine — Scope 1 & 2 GHG emissions.
 *
 * This module is I/O-free by architectural contract (enforced by ESLint boundaries).
 * All external data is injected as parameters; no imports from repos/, services/, or supabase.
 *
 * Implemented in Phase 2 (feat/phase-2-calc-engine).
 */

export { calculate, aggregate, score } from './pipeline';
export type {
  ActivityKind,
  ActivityRecord,
  EmissionFactor,
  FactorTable,
  EmissionResult,
  EvaluationTotals,
  RiskScore,
  CalcError,
} from './types';
