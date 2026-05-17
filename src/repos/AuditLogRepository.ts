import type { SupabaseClient } from '@supabase/supabase-js';

export interface AuditLogEntry {
  id: string;
  action: string;
  tableName: string | null;
  recordId: string | null;
  oldValues: unknown | null;
  newValues: unknown | null;
  performedBy: string | null;
  performedAt: Date;
}

export class AuditLogRepository {
  constructor(private readonly client: SupabaseClient) {}

  async log(
    action: string,
    tableName: string,
    recordId: string,
    performedBy: string,
    meta?: { oldValues?: unknown; newValues?: unknown },
  ): Promise<void> {
    const { error } = await this.client.from('audit_log').insert({
      action,
      table_name: tableName,
      record_id: recordId,
      performed_by: performedBy,
      old_values: meta?.oldValues ?? null,
      new_values: meta?.newValues ?? null,
    });
    if (error) throw new Error(`Failed to write audit log: ${error.message}`);
  }

  async findByRecordId(recordId: string): Promise<readonly AuditLogEntry[]> {
    const { data, error } = await this.client
      .from('audit_log')
      .select('*')
      .eq('record_id', recordId)
      .order('performed_at', { ascending: true });
    if (error ?? !data) return [];
    return (data as Record<string, unknown>[]).map((row) => ({
      id: row['id'] as string,
      action: row['action'] as string,
      tableName: (row['table_name'] as string | null) ?? null,
      recordId: (row['record_id'] as string | null) ?? null,
      oldValues: row['old_values'] ?? null,
      newValues: row['new_values'] ?? null,
      performedBy: (row['performed_by'] as string | null) ?? null,
      performedAt: new Date(row['performed_at'] as string),
    }));
  }

  update(): never {
    throw new Error('AuditLogRepository is append-only — update is forbidden');
  }

  delete(): never {
    throw new Error('AuditLogRepository is append-only — delete is forbidden');
  }
}
