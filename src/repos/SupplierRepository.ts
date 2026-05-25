import { SupabaseRepository } from './SupabaseRepository';
import { Supplier } from '../domain/Supplier';

export class SupplierRepository extends SupabaseRepository<Supplier> {
  protected readonly tableName = 'suppliers';
  protected override readonly selectColumns =
    'id, organization_id, name, category, contact_email, created_at';

  /** Prohibido en repos tenant-scoped — usar findByOrgId() con filtro explícito. */
  override findAll(): never {
    throw new Error('SupplierRepository.findAll() no permitido — usar findByOrgId()');
  }

  protected toEntity(row: Record<string, unknown>): Supplier {
    return new Supplier({
      id: row['id'] as string,
      organizationId: row['organization_id'] as string,
      name: row['name'] as string,
      category: row['category'] as string,
      contactEmail: row['contact_email'] as string,
      createdAt: new Date(row['created_at'] as string),
    });
  }

  protected toRow(entity: Supplier): Record<string, unknown> {
    return {
      id: entity.id,
      organization_id: entity.organizationId,
      name: entity.name,
      category: entity.category,
      contact_email: entity.contactEmail,
      created_at: entity.createdAt.toISOString(),
    };
  }
}
