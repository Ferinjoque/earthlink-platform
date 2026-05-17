/**
 * OOP repository layer — abstract Repository<T> + Supabase concretes.
 * Implemented fully in feat/phase-3-domain-repos.
 */

export { Repository } from './Repository';
export { SupabaseRepository } from './SupabaseRepository';
export { InMemoryRepository } from './InMemoryRepository';
export { SupplierRepository } from './SupplierRepository';
export { OrganizationRepository } from './OrganizationRepository';
export { EmissionFactorRepository } from './EmissionFactorRepository';
export { ActivityRecordRepository } from './ActivityRecordRepository';
export { EmissionResultRepository } from './EmissionResultRepository';
export { EvaluationRepository } from './EvaluationRepository';
export { AuditLogRepository } from './AuditLogRepository';
