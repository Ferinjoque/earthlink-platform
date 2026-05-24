/**
 * Core types for the FP calculation engine.
 * All types are readonly — mutation is never allowed inside calc/.
 */


export type GridRegion = 'SEIN_PERU' | 'LATAM_AVG' | 'US_AVERAGE' | 'EU_AVERAGE';


export type WaterSubtype =
  | 'all_sources'    // Total de todas las fuentes
  | 'potable_mixed'  // Potable mixto (interior/exterior)
  | 'potable_indoor' // Potable solo interior
  | 'reclaimed_mixed'// Recuperada mixta
  | 'well_outdoor'   // Pozo — exterior
  | 'other_mixed';   // Otra fuente mixta


export type WasteSubtype =
  | 'disposed_trash' // Basura dispuesta (vertedero)
  | 'recycled'       // Materiales reciclados
  | 'composted';     // Materiales compostados


export type ActivityKind =
  | {
      readonly kind: 'stationary_combustion';
      readonly fuel: 'natural_gas' | 'diesel' | 'lpg' | 'fuel_oil_no2' | 'propane';
    }
  | { readonly kind: 'mobile_combustion'; readonly fuel: 'diesel' | 'gasoline' | 'lpg' }
  | { readonly kind: 'purchased_electricity'; readonly gridRegion: GridRegion }
  | { readonly kind: 'purchased_steam' }
  | { readonly kind: 'fugitive'; readonly refrigerant: 'R410A' | 'R134A' | 'R32' }
  | { readonly kind: 'water_use'; readonly subtype: WaterSubtype }
  | { readonly kind: 'waste'; readonly subtype: WasteSubtype };

// Scope 'none' = consumption tracked but no direct GHG (water, waste recycled/composted)
export type GhgScope = 'scope1' | 'scope2' | 'none';


export type Unit =
  // Energy — standard for gas & electricity
  | 'kWh'
  | 'MWh'
  | 'GJ'
  | 'MJ'
  | 'kJ'
  | 'therms'
  | 'MMBtu'
  | 'MBtu'
  | 'BTU'
  | 'kBtu'       // Mil BTU — gas natural / combustibles en EE.UU. (GRESB)
  // Natural gas volume
  | 'm3_ng'
  | 'ft3_ng'
  // Liquid fuels — standard for diesel, LPG, gasoline, fuel oil
  | 'L'
  | 'gallon'
  | 'imp_gallon'
  // Mass — standard for refrigerants
  | 'kg'
  | 'tonne'
  | 'lb'
  // Water
  | 'kgal_us'    // Mil galones US (estándar GRESB agua)
  | 'megaliter'  // Megalitros (estándar GRESB internacional)
  | 'm3'         // Metros cúbicos (agua)
  // Waste
  | 'ton_us';    // Tonelada corta US (estándar GRESB residuos)

export const STANDARD_UNITS: Record<ActivityKind['kind'], Unit> = {
  stationary_combustion: 'L',
  mobile_combustion: 'L',
  purchased_electricity: 'kWh',
  purchased_steam: 'kWh',
  fugitive: 'kg',
  water_use: 'kgal_us',
  waste: 'ton_us',
};


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

export type ConversionTable = ReadonlyMap<string, number>;

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


export type CalcError =
  | { readonly type: 'UNKNOWN_UNIT'; readonly unit: string }
  | { readonly type: 'MISSING_FACTOR'; readonly activityKey: string }
  | { readonly type: 'INVALID_VALUE'; readonly value: number; readonly reason: string }
  | { readonly type: 'UNIT_INCOMPATIBLE'; readonly from: Unit; readonly to: Unit };

export type CalcResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: CalcError };
