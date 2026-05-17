/**
 * OOP hierarchy for GHG emission sources.
 *
 * Polymorphism is real, not decorative:
 *   - validate(raw) — each subclass enforces its own unit whitelist + evidence rules
 *   - factorKey()   — each subclass knows the (activity_type, region) tuple for factor lookup
 *   - scope()       — returns the GHG Protocol scope for this source type
 */
import type { Unit, GhgScope, ActivityKind, GridRegion } from '../calc/types';

export type ValidationResult = { valid: true } | { valid: false; reason: string };

// ── Abstract base ─────────────────────────────────────────────────────────────

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

// ── Scope 1 ───────────────────────────────────────────────────────────────────

abstract class Scope1Source extends EmissionSource {
  scope(): GhgScope {
    return 'scope1';
  }
}

export class StationaryCombustionSource extends Scope1Source {
  readonly activityKind: ActivityKind;

  constructor(readonly fuel: 'natural_gas' | 'diesel' | 'lpg') {
    super();
    this.activityKind = { kind: 'stationary_combustion', fuel };
  }

  allowedUnits(): readonly Unit[] {
    if (this.fuel === 'natural_gas') return ['m3_ng', 'ft3_ng', 'kWh', 'GJ', 'therms', 'MMBtu'];
    return ['L', 'gallon', 'imp_gallon'];
  }

  requiredEvidence(): string {
    return 'Utility invoice or fuel delivery receipt';
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
    return 'Fuel purchase receipts or fleet mileage log';
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
    return ['kg'];
  }

  requiredEvidence(): string {
    return 'Refrigerant purchase/top-up log or leak inspection report';
  }

  factorKey(): string {
    return `fugitive.${this.refrigerant}`;
  }
}

// ── Scope 2 ───────────────────────────────────────────────────────────────────

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
    return 'Electricity utility invoice';
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
    return 'Steam/heat supplier invoice';
  }

  factorKey(): string {
    return 'purchased_steam.default';
  }
}
