/**
 * Jerarquía POO para fuentes de emisión GHG.
 *
 * El polimorfismo es funcional, no decorativo:
 *   - validate(raw) — cada subclase aplica su propia lista blanca de unidades + reglas de evidencia
 *   - factorKey()   — cada subclase conoce la tupla (activity_type, region) para lookup de factores
 *   - scope()       — devuelve el alcance GHG Protocol de esta fuente
 */
import type { Unit, GhgScope, ActivityKind, GridRegion, WaterSubtype, WasteSubtype } from '../calc/types';

export type ValidationResult = { valid: true } | { valid: false; reason: string };


export abstract class EmissionSource {
  abstract readonly activityKind: ActivityKind;

  abstract scope(): GhgScope;
  abstract allowedUnits(): readonly Unit[];
  abstract requiredEvidence(): string;
  abstract factorKey(): string;

  validate(rawUnit: Unit): ValidationResult {
    if (!this.allowedUnits().includes(rawUnit)) {
      return {
        valid: false,
        reason: `Unit "${rawUnit}" not allowed for ${this.constructor.name}. Allowed: ${this.allowedUnits().join(', ')}`,
      };
    }
    return { valid: true };
  }
}


abstract class Scope1Source extends EmissionSource {
  scope(): GhgScope {
    return 'scope1';
  }
}

export class StationaryCombustionSource extends Scope1Source {
  readonly activityKind: ActivityKind;

  constructor(
    readonly fuel: 'natural_gas' | 'diesel' | 'lpg' | 'fuel_oil_no2' | 'propane',
  ) {
    super();
    this.activityKind = { kind: 'stationary_combustion', fuel };
  }

  allowedUnits(): readonly Unit[] {
    if (this.fuel === 'natural_gas') return ['m3_ng', 'ft3_ng', 'kWh', 'GJ', 'therms', 'MMBtu', 'kBtu'];
    if (this.fuel === 'fuel_oil_no2') return ['L', 'gallon', 'imp_gallon', 'kBtu'];
    if (this.fuel === 'propane') return ['L', 'gallon', 'imp_gallon', 'kBtu'];
    return ['L', 'gallon', 'imp_gallon', 'kBtu'];
  }

  requiredEvidence(): string {
    return 'Factura de suministro o comprobante de entrega de combustible';
  }

  factorKey(): string {
    return `stationary_combustion.${this.fuel}`;
  }
}

export class MobileCombustionSource extends Scope1Source {
  readonly activityKind: ActivityKind;

  constructor(readonly fuel: 'diesel' | 'gasoline' | 'lpg') {
    super();
    this.activityKind = { kind: 'mobile_combustion', fuel };
  }

  allowedUnits(): readonly Unit[] {
    return ['L', 'gallon', 'imp_gallon'];
  }

  requiredEvidence(): string {
    return 'Recibos de combustible o registro de kilometraje de flota';
  }

  factorKey(): string {
    return `mobile_combustion.${this.fuel}`;
  }
}

export class FugitiveEmissionSource extends Scope1Source {
  readonly activityKind: ActivityKind;

  constructor(readonly refrigerant: 'R410A' | 'R134A' | 'R32') {
    super();
    this.activityKind = { kind: 'fugitive', refrigerant };
  }

  allowedUnits(): readonly Unit[] {
    return ['kg', 'lb'];
  }

  requiredEvidence(): string {
    return 'Registro de recarga de refrigerante o informe de inspección de fugas';
  }

  factorKey(): string {
    return `fugitive.${this.refrigerant}`;
  }
}


abstract class Scope2Source extends EmissionSource {
  scope(): GhgScope {
    return 'scope2';
  }
}

export class PurchasedElectricitySource extends Scope2Source {
  readonly activityKind: ActivityKind;

  constructor(readonly gridRegion: GridRegion) {
    super();
    this.activityKind = { kind: 'purchased_electricity', gridRegion };
  }

  allowedUnits(): readonly Unit[] {
    return ['kWh', 'MWh', 'GJ'];
  }

  requiredEvidence(): string {
    return 'Factura de suministro eléctrico';
  }

  factorKey(): string {
    return `purchased_electricity.${this.gridRegion}`;
  }
}

export class PurchasedSteamSource extends Scope2Source {
  readonly activityKind: ActivityKind = { kind: 'purchased_steam' };

  allowedUnits(): readonly Unit[] {
    return ['GJ', 'kWh', 'MWh'];
  }

  requiredEvidence(): string {
    return 'Factura del proveedor de vapor / calor';
  }

  factorKey(): string {
    return 'purchased_steam.default';
  }
}

// Consumo rastreado para GRESB pero sin GHG directo en Alcances 1 y 2.

abstract class NoScopeSource extends EmissionSource {
  scope(): GhgScope {
    return 'none';
  }
}

export class WaterUseSource extends NoScopeSource {
  readonly activityKind: ActivityKind;

  constructor(readonly subtype: WaterSubtype) {
    super();
    this.activityKind = { kind: 'water_use', subtype };
  }

  allowedUnits(): readonly Unit[] {
    return ['kgal_us', 'megaliter', 'm3', 'L', 'gallon'];
  }

  requiredEvidence(): string {
    return 'Factura de servicio de agua o lectura de medidor';
  }

  factorKey(): string {
    return `water_use.${this.subtype}`;
  }
}

export class WasteSource extends NoScopeSource {
  readonly activityKind: ActivityKind;

  constructor(readonly subtype: WasteSubtype) {
    super();
    this.activityKind = { kind: 'waste', subtype };
  }

  allowedUnits(): readonly Unit[] {
    return ['ton_us', 'tonne', 'kg', 'lb'];
  }

  requiredEvidence(): string {
    return 'Manifiesto de residuos o certificado del gestor';
  }

  factorKey(): string {
    return `waste.${this.subtype}`;
  }
}
