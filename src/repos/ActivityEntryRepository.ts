import { SupabaseRepository } from './SupabaseRepository';
import { ActivityEntry } from '../domain/ActivityEntry';
import type { DataQuality } from '../domain/ActivityEntry';
import type { ActivityKind, Unit } from '../calc/types';
import type { ActivityEntryStatus, EmissionSourceType } from '../types/database';

const COLS =
  'id, reporting_period_id, source_type, activity_kind, raw_quantity, raw_unit, status, submitted_at, submitted_by, created_at, data_quality, notes';

export class ActivityEntryRepository extends SupabaseRepository<ActivityEntry> {
  protected readonly tableName = 'activity_entries';
  protected override readonly selectColumns = COLS;

  async findByPeriodId(periodId: string): Promise<readonly ActivityEntry[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select(COLS)
      .eq('reporting_period_id', periodId)
      .is('voided_at', null)
      .order('created_at', { ascending: true });
    if (error ?? !data) return [];
    return (data as Record<string, unknown>[]).map((row) => this.toEntity(row));
  }

  async findByPeriodIds(periodIds: readonly string[]): Promise<readonly ActivityEntry[]> {
    if (periodIds.length === 0) return [];
    const { data, error } = await this.client
      .from(this.tableName)
      .select(COLS)
      .in('reporting_period_id', periodIds)
      .is('voided_at', null)
      .order('created_at', { ascending: true });
    if (error ?? !data) return [];
    return (data as Record<string, unknown>[]).map((row) => this.toEntity(row));
  }

  async findByStatus(
    periodId: string,
    status: ActivityEntryStatus,
  ): Promise<readonly ActivityEntry[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select(COLS)
      .eq('reporting_period_id', periodId)
      .eq('status', status);
    if (error ?? !data) return [];
    return (data as Record<string, unknown>[]).map((row) => this.toEntity(row));
  }

  protected toEntity(row: Record<string, unknown>): ActivityEntry {
    return new ActivityEntry({
      id: row['id'] as string,
      reportingPeriodId: row['reporting_period_id'] as string,
      sourceType: row['source_type'] as EmissionSourceType,
      activityKind: row['activity_kind'] as ActivityKind,
      rawQuantity: row['raw_quantity'] as number,
      rawUnit: row['raw_unit'] as Unit,
      status: row['status'] as ActivityEntryStatus,
      submittedAt: row['submitted_at'] ? new Date(row['submitted_at'] as string) : null,
      submittedBy: (row['submitted_by'] as string | null) ?? null,
      createdAt: new Date(row['created_at'] as string),
      dataQuality: (row['data_quality'] as DataQuality | null) ?? 'measured',
      notes: (row['notes'] as string | null) ?? null,
    });
  }

  protected toRow(entity: ActivityEntry): Record<string, unknown> {
    return {
      id: entity.id,
      reporting_period_id: entity.reportingPeriodId,
      source_type: entity.sourceType,
      activity_kind: entity.activityKind,
      raw_quantity: entity.rawQuantity,
      raw_unit: entity.rawUnit,
      status: entity.status,
      submitted_at: entity.submittedAt?.toISOString() ?? null,
      submitted_by: entity.submittedBy,
      created_at: entity.createdAt.toISOString(),
      data_quality: entity.dataQuality,
      notes: entity.notes,
    };
  }
}
