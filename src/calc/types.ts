/**
 * Core types for the FP calculation engine.
 * All types are readonly — mutation is never allowed inside calc/.
 */

// ── Activity kinds (discriminated union, exhaustive) ─────────────────────────

export type GridRegion = 'PERU' | 'LATAM_AVG' | 'WORLD_AVG' | 'US_AVG' | 'EU_AVG';

export type ActivityKind =
  | { readonly kind: 'stationary_combustion'; readonly fuel: 'natural_gas' | 'diesel' | 'lpg' }
  | { readonly kind: 'mobile_combustion'; readonly fuel: 'diesel' | 'gasoline' | 'lpg' }
  | { readonly kind: 'purchased_electricity'; readonly gridRegion: GridRegion }
  | { readonly kind: 'purchased_steam' }
  | { readonly kind: 'fugitive'; readonly refrigerant: 'R410A' | 'R134A' | 'R32' };

export type GhgScope = 'scope1' | 'scope2';

// ── Units ─────────────────────────────────────────────────────────────────────

export type Unit =
  | 'kWh'
  | 'MWh'
  | 'GJ'
  | 'liters'
  | 'gallons_us'
  | 'gallons_uk'
  | 'm3'
  | 'kg'
  | 'tonnes'
  | 'therms';

export const STANDARD_UNITS: Record<ActivityKind['kind'], Unit> = {
  stationary_combustion: 'liters',
  mobile_combustion: 'liters',
  purchased_electricity: 'kWh',
  purchased_steam: 'GJ',
  fugitive: 'kg',
};

// ── Input / output types ──────────────────────────────────────────────────────

export type ActivityRecord = Readonly<{
  id: string;
  periodId: string;
  supplierId: string;
  activity: ActivityKind;
  rawValue: number;
  rawUnit: Unit;
  submittedAt: Date;
}>;

export type EmissionFactor = Readonly<{
  id: string;
  setId: string;
  setVersion: string;
  activityKey: string;
  region: string;
  factorKgCo2ePerUnit: number;
  standardUnit: Unit;
}>;

export type FactorTable = ReadonlyMap<string, EmissionFactor>;

export type EmissionResult = Readonly<{
  activityRecordId: string;
  factorId: string;
  factorSetId: string;
  factorSetVersion: string;
  normalizedValue: number;
  normalizedUnit: Unit;
  co2eKg: number;
  scope: GhgScope;
  engineVersion: string;
  calcHash: string;
}>;

export type EvaluationTotals = Readonly<{
  totalCo2eKg: number;
  byScope: Readonly<Record<GhgScope, number>>;
  byActivity: Readonly<Record<string, number>>;
  recordCount: number;
}>;

export type RiskScore = Readonly<{
  score: number; // 0–100
  level: 'low' | 'medium' | 'high' | 'critical';
  anomalyCount: number;
  trend: 'up' | 'down' | 'stable';
}>;

// ── Error types ───────────────────────────────────────────────────────────────

export type CalcError =
  | { readonly type: 'UNKNOWN_UNIT'; readonly unit: string }
  | { readonly type: 'MISSING_FACTOR'; readonly activityKey: string }
  | { readonly type: 'INVALID_VALUE'; readonly value: number; readonly reason: string }
  | { readonly type: 'UNIT_INCOMPATIBLE'; readonly from: Unit; readonly to: Unit };

export type CalcResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: CalcError };
