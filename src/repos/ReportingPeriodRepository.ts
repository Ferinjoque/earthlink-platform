import { SupabaseRepository } from './SupabaseRepository';
import { ReportingPeriod, type PeriodStatus } from '../domain/ReportingPeriod';

export class ReportingPeriodRepository extends SupabaseRepository<ReportingPeriod> {
  protected readonly tableName = 'reporting_periods';
  protected override readonly selectColumns = 'id, supplier_id, label, start_date, end_date, status, created_at';

  async findBySupplierId(supplierId: string): Promise<readonly ReportingPeriod[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('id, supplier_id, label, start_date, end_date, status, created_at')
      .eq('supplier_id', supplierId)
      .order('start_date', { ascending: false });
    if (error ?? !data) return [];
    return (data as Record<string, unknown>[]).map((row) => this.toEntity(row));
  }

  async updateStatus(id: string, status: PeriodStatus): Promise<ReportingPeriod> {
    const { data, error } = await this.client
      .from(this.tableName)
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (error ?? !data)
      throw new Error(`Failed to update period status: ${error?.message ?? 'no data'}`);
    return this.toEntity(data as Record<string, unknown>);
  }

  protected toEntity(row: Record<string, unknown>): ReportingPeriod {
    return new ReportingPeriod({
      id: row['id'] as string,
      supplierId: row['supplier_id'] as string,
      label: row['label'] as string,
      startDate: new Date(row['start_date'] as string),
      endDate: new Date(row['end_date'] as string),
      status: row['status'] as PeriodStatus,
      createdAt: new Date(row['created_at'] as string),
    });
  }

  protected toRow(entity: ReportingPeriod): Record<string, unknown> {
    return {
      id: entity.id,
      supplier_id: entity.supplierId,
      label: entity.label,
      start_date: entity.startDate.toISOString(),
      end_date: entity.endDate.toISOString(),
      status: entity.status,
      created_at: entity.createdAt.toISOString(),
    };
  }
}
