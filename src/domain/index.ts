/**
 * OOP domain model — entities, value objects, EmissionSource hierarchy.
 * Implemented fully in feat/phase-3-domain-repos.
 */

export { Entity } from './Entity';
export { Organization } from './Organization';
export { Supplier } from './Supplier';
export { ReportingPeriod } from './ReportingPeriod';
export {
  EmissionSource,
  StationaryCombustionSource,
  MobileCombustionSource,
  PurchasedElectricitySource,
  PurchasedSteamSource,
  FugitiveEmissionSource,
} from './EmissionSource';
