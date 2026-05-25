import type { SupabaseClient } from '@supabase/supabase-js';

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
    if (error) throw new Error(`Error al escribir en el log de auditoría: ${error.message}`);
  }

  update(): never {
    throw new Error('AuditLogRepository es solo escritura — update no permitido');
  }

  delete(): never {
    throw new Error('AuditLogRepository es solo escritura — delete no permitido');
  }
}
