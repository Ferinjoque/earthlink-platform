/**
 * Append-only audit log repository.
 * update() and delete() throw — encoding the immutability invariant at runtime.
 * Implemented fully in feat/phase-3-domain-repos.
 */
export class AuditLogRepository {
  update(): never {
    throw new Error('AuditLogRepository is append-only — update is forbidden');
  }

  delete(): never {
    throw new Error('AuditLogRepository is append-only — delete is forbidden');
  }
}
