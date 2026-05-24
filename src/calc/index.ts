/**
 * Motor de cálculo FP puro — emisiones GHG Alcance 1 y 2.
 *
 * Este módulo está libre de I/O por contrato arquitectónico.
 * Todos los datos externos se inyectan como parámetros; sin imports de repos/, services/ o supabase.
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
