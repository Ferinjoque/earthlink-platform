/** Stub — implemented in feat/phase-3-domain-repos */
import { SupabaseRepository } from './SupabaseRepository';
import { Organization } from '../domain/Organization';

export class OrganizationRepository extends SupabaseRepository<Organization> {
  protected readonly tableName = 'organizations';

  protected toEntity(row: Record<string, unknown>): Organization {
    return new Organization({
      id: row['id'] as string,
      name: row['name'] as string,
      industry: row['industry'] as string,
      ruc: row['ruc'] as string,
      createdAt: new Date(row['created_at'] as string),
    });
  }

  protected toRow(entity: Organization): Record<string, unknown> {
    return {
      id: entity.id,
      name: entity.name,
      industry: entity.industry,
      ruc: entity.ruc,
      created_at: entity.createdAt.toISOString(),
    };
  }
}
