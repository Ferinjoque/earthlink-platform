/**
 * Pipeline de cálculo FP puro — sin I/O, sin efectos secundarios, sin mutación.
 * Todas las entradas son inyectadas; las salidas son deterministas para las mismas entradas.
 *
 * Pasos: validateActivity → normalizeUnit → resolveFactor → applyFactor → stampProvenance
 *
 * Caso especial: water_use y waste → scope 'none', CO2e = 0 (se registra consumo
 * pero el Protocolo GHG no exige factor de emisión para estas categorías).
 */
import { createHash } from 'node:crypto';
import Big from 'big.js';
import { ENGINE_VERSION } from './version';
import type {
  ActivityKind,
  ActivityRecord,
  CalcError,
  CalcResult,
  ConversionTable,
  EmissionFactor,
  EmissionResult,
  EvaluationTotals,
  FactorTable,
  GhgScope,
  RiskScore,
  Unit,
} from './types';


function ok<T>(value: T): CalcResult<T> {
  return { ok: true, value };
}

function err<T>(error: CalcError): CalcResult<T> {
  return { ok: false, error };
}

// Categorías sin emisiones GHG directas — CO2e = 0, scope = 'none'
const NO_GHG_KINDS: ReadonlySet<ActivityKind['kind']> = new Set(['water_use', 'waste']);


function validateActivity(record: ActivityRecord): CalcResult<ActivityRecord> {
  if (!isFinite(record.rawValue) || record.rawValue < 0) {
    return err({
      type: 'INVALID_VALUE',
      value: record.rawValue,
      reason: 'rawValue must be a finite non-negative number',
    });
  }
  return ok(record);
}


function normalizeUnit(
  rawValue: number,
  rawUnit: Unit,
  targetUnit: Unit,
  conversions: ConversionTable,
): CalcResult<number> {
  if (rawUnit === targetUnit) {
    return ok(rawValue);
  }

  const convKey = `${rawUnit}->${targetUnit}`;
  const factor = conversions.get(convKey);

  if (factor === undefined) {
    return err({ type: 'UNIT_INCOMPATIBLE', from: rawUnit, to: targetUnit });
  }

  return ok(Big(rawValue).times(Big(factor)).toNumber());
}


function resolveFactorKey(activity: ActivityKind): string {
  switch (activity.kind) {
    case 'stationary_combustion':
      return `stationary_combustion.${activity.fuel}`;
    case 'mobile_combustion':
      return `mobile_combustion.${activity.fuel}`;
    case 'purchased_electricity':
      return `purchased_electricity.${activity.gridRegion}`;
    case 'purchased_steam':
      return 'purchased_steam.default';
    case 'fugitive':
      return `fugitive.${activity.refrigerant}`;
    case 'water_use':
      return `water_use.${activity.subtype}`;
    case 'waste':
      return `waste.${activity.subtype}`;
  }
}

function resolveScope(activity: ActivityKind): GhgScope {
  switch (activity.kind) {
    case 'stationary_combustion':
    case 'mobile_combustion':
    case 'fugitive':
      return 'scope1';
    case 'purchased_electricity':
    case 'purchased_steam':
      return 'scope2';
    case 'water_use':
    case 'waste':
      return 'none';
  }
}

function resolveFactor(activity: ActivityKind, factors: FactorTable): CalcResult<EmissionFactor> {
  const key = resolveFactorKey(activity);
  const factor = factors.get(key);

  if (factor === undefined) {
    return err({ type: 'MISSING_FACTOR', activityKey: key });
  }

  return ok(factor);
}


function applyFactor(normalizedValue: number, factorKgCo2ePerUnit: number): number {
  return Big(normalizedValue).times(Big(factorKgCo2ePerUnit)).toNumber();
}


function stampProvenance(
  record: ActivityRecord,
  normalizedValue: number,
  normalizedUnit: Unit,
  factor: EmissionFactor,
): string {
  const canonical = JSON.stringify({
    id: record.id,
    activity: record.activity,
    rawValue: record.rawValue,
    rawUnit: record.rawUnit,
    normalizedValue,
    normalizedUnit,
    factorId: factor.id,
    factorKgCo2ePerUnit: factor.factorKgCo2ePerUnit,
    engineVersion: ENGINE_VERSION,
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

// Hash de proveniencia para registros con CO2e = 0 (agua, residuos) — sin factor de emisión
function stampProvenanceZero(record: ActivityRecord): string {
  const canonical = JSON.stringify({
    id: record.id,
    activity: record.activity,
    rawValue: record.rawValue,
    rawUnit: record.rawUnit,
    co2eKg: 0,
    scope: 'none',
    engineVersion: ENGINE_VERSION,
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}


export function calculate(
  record: ActivityRecord,
  factors: FactorTable,
  conversions: ConversionTable = new Map(),
): CalcResult<EmissionResult> {
  const validatedResult = validateActivity(record);
  if (!validatedResult.ok) return validatedResult;

  // Agua y residuos: se registra el consumo pero no se busca factor GHG
  if (NO_GHG_KINDS.has(record.activity.kind)) {
    return ok({
      activityRecordId: record.id,
      factorId: 'none',
      factorSetId: 'none',
      factorSetVersion: '0',
      normalizedValue: record.rawValue,
      normalizedUnit: record.rawUnit,
      co2eKg: 0,
      scope: 'none',
      engineVersion: ENGINE_VERSION,
      calcHash: stampProvenanceZero(record),
    });
  }

  const factorResult = resolveFactor(record.activity, factors);
  if (!factorResult.ok) return factorResult;
  const factor = factorResult.value;

  const normalizedResult = normalizeUnit(
    record.rawValue,
    record.rawUnit,
    factor.standardUnit,
    conversions,
  );
  if (!normalizedResult.ok) return normalizedResult;
  const normalizedValue = normalizedResult.value;

  const co2eKg = applyFactor(normalizedValue, factor.factorKgCo2ePerUnit);

  const calcHash = stampProvenance(record, normalizedValue, factor.standardUnit, factor);

  return ok({
    activityRecordId: record.id,
    factorId: factor.id,
    factorSetId: factor.setId,
    factorSetVersion: factor.setVersion,
    normalizedValue,
    normalizedUnit: factor.standardUnit,
    co2eKg,
    scope: resolveScope(record.activity),
    engineVersion: ENGINE_VERSION,
    calcHash,
  });
}


export function aggregate(results: readonly EmissionResult[]): EvaluationTotals {
  let totalBig = Big(0);
  const byScopeAcc: Record<GhgScope, Big> = { scope1: Big(0), scope2: Big(0), none: Big(0) };
  const byActivityAcc: Map<string, Big> = new Map();

  for (const r of results) {
    const co2e = Big(r.co2eKg);
    totalBig = totalBig.plus(co2e);
    byScopeAcc[r.scope] = byScopeAcc[r.scope].plus(co2e);
    const prev = byActivityAcc.get(r.activityRecordId) ?? Big(0);
    byActivityAcc.set(r.activityRecordId, prev.plus(co2e));
  }

  const byScope: Record<GhgScope, number> = {
    scope1: byScopeAcc.scope1.toNumber(),
    scope2: byScopeAcc.scope2.toNumber(),
    none: byScopeAcc.none.toNumber(),
  };

  const byActivity: Record<string, number> = {};
  for (const [k, v] of byActivityAcc) {
    byActivity[k] = v.toNumber();
  }

  return {
    totalCo2eKg: totalBig.toNumber(),
    byScope,
    byActivity,
    recordCount: results.length,
  };
}


export function score(totals: EvaluationTotals, history: readonly EvaluationTotals[]): RiskScore {
  let trend: 'up' | 'down' | 'stable' = 'stable';

  if (history.length > 0) {
    const prior = history[history.length - 1]!;
    if (prior.totalCo2eKg > 0) {
      const changePct = (totals.totalCo2eKg - prior.totalCo2eKg) / prior.totalCo2eKg;
      if (changePct > 0.05) trend = 'up';
      else if (changePct < -0.05) trend = 'down';
    }
  }

  // Score normalizado: 0 tCO2e → 0, ≥1083 tCO2e → 65 (tope antes del ajuste por tendencia)
  // Con tendencia 'up' +10 → máx 75 → nivel 'critical'. Se topa en 65 para que 'critical' sea alcanzable.
  const tCo2e = totals.totalCo2eKg / 1000;
  let rawScore = Math.round(Math.min(65, tCo2e * 0.06));

  if (trend === 'up') rawScore = Math.min(100, rawScore + 10);
  if (trend === 'down') rawScore = Math.max(0, rawScore - 5);

  const level: RiskScore['level'] =
    rawScore < 25 ? 'low' : rawScore < 50 ? 'medium' : rawScore < 75 ? 'high' : 'critical';

  return { score: rawScore, level, anomalyCount: 0, trend };
}


export const _internals = {
  validateActivity,
  normalizeUnit,
  resolveFactorKey,
  resolveScope,
  resolveFactor,
  applyFactor,
  stampProvenance,
};
