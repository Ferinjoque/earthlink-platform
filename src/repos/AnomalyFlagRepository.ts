import { SupabaseRepository } from './SupabaseRepository';
import { AnomalyFlag } from '../domain/AnomalyFlag';
import type { AnomalyDetector, AnomalySeverity } from '../types/database';

export class AnomalyFlagRepository extends SupabaseRepository<AnomalyFlag> {
  protected readonly tableName = 'anomaly_flags';
  protected override readonly selectColumns =
    'id, activity_entry_id, detector, severity, z_score, threshold_used, message, is_resolved, resolved_by, resolved_at, flagged_at';

  /** Prohibido en repos tenant-scoped. Usar findByActivityEntryId() o findUnresolvedByOrg(). */
  override findAll(): never {
    throw new Error('AnomalyFlagRepository.findAll() no permitido. Usar findUnresolvedByOrg()');
  }

  async findByActivityEntryId(entryId: string): Promise<readonly AnomalyFlag[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select(
        'id, activity_entry_id, detector, severity, z_score, threshold_used, message, is_resolved, resolved_by, resolved_at, flagged_at',
      )
      .eq('activity_entry_id', entryId);
    if (error ?? !data) return [];
    return (data as Record<string, unknown>[]).map((row) => this.toEntity(row));
  }

  async findUnresolvedByOrg(orgId: string): Promise<readonly AnomalyFlag[]> {
    // Filtra por org via cadena: anomaly_flags, activity_entries, reporting_periods, suppliers, organization_id
    const { data, error } = await this.client
      .from(this.tableName)
      .select(
        'id, activity_entry_id, detector, severity, z_score, threshold_used, message, is_resolved, resolved_by, resolved_at, flagged_at, activity_entries!inner(reporting_periods!inner(suppliers!inner(organization_id)))',
      )
      .eq('is_resolved', false)
      .eq('activity_entries.reporting_periods.suppliers.organization_id', orgId)
      .order('flagged_at', { ascending: false });
    if (error ?? !data) return [];
    return (data as Record<string, unknown>[]).map((row) => this.toEntity(row));
  }

  async resolve(id: string, resolvedBy: string): Promise<AnomalyFlag> {
    const { data, error } = await this.client
      .from(this.tableName)
      .update({ is_resolved: true, resolved_by: resolvedBy, resolved_at: new Date().toISOString() })
      .eq('id', id)
      .select(
        'id, activity_entry_id, detector, severity, z_score, threshold_used, message, is_resolved, resolved_by, resolved_at, flagged_at',
      )
      .single();
    if (error ?? !data)
      throw new Error(`Error al resolver anomalía: ${error?.message ?? 'sin datos'}`);
    return this.toEntity(data as Record<string, unknown>);
  }

  protected toEntity(row: Record<string, unknown>): AnomalyFlag {
    return new AnomalyFlag({
      id: row['id'] as string,
      activityEntryId: row['activity_entry_id'] as string,
      detector: row['detector'] as AnomalyDetector,
      severity: row['severity'] as AnomalySeverity,
      zScore: (row['z_score'] as number | null) ?? null,
      thresholdUsed: (row['threshold_used'] as number | null) ?? null,
      message: row['message'] as string,
      isResolved: row['is_resolved'] as boolean,
      resolvedBy: (row['resolved_by'] as string | null) ?? null,
      resolvedAt: row['resolved_at'] ? new Date(row['resolved_at'] as string) : null,
      flaggedAt: new Date(row['flagged_at'] as string),
      createdAt: new Date(row['flagged_at'] as string),
    });
  }

  protected toRow(entity: AnomalyFlag): Record<string, unknown> {
    return {
      id: entity.id,
      activity_entry_id: entity.activityEntryId,
      detector: entity.detector,
      severity: entity.severity,
      z_score: entity.zScore,
      threshold_used: entity.thresholdUsed,
      message: entity.message,
      is_resolved: entity.isResolved,
      resolved_by: entity.resolvedBy,
      resolved_at: entity.resolvedAt?.toISOString() ?? null,
      flagged_at: entity.flaggedAt.toISOString(),
    };
  }
}
