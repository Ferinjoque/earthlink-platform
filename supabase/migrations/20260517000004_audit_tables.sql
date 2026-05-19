-- =============================================================================
-- Migration 004: Audit Tables (2 tables)
-- Append-only immutable records — mutation guards applied in migration 005.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 14. audit_log
-- ---------------------------------------------------------------------------
CREATE TABLE public.audit_log (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  action       text        NOT NULL,
  table_name   text,
  record_id    uuid,
  old_values   jsonb,
  new_values   jsonb,
  performed_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_at timestamptz DEFAULT now() NOT NULL,
  ip_address   inet,
  user_agent   text
);

COMMENT ON TABLE  public.audit_log IS 'Immutable event ledger. Every mutation to critical tables is automatically logged. No UPDATE or DELETE permitted.';
COMMENT ON COLUMN public.audit_log.action IS 'INSERT | UPDATE | DELETE | LOCK | EXPORT | LOGIN | ANOMALY_RESOLVED';
COMMENT ON COLUMN public.audit_log.record_id IS 'Primary key of the affected row in table_name.';

CREATE INDEX idx_audit_performed_at     ON public.audit_log (performed_at DESC);
CREATE INDEX idx_audit_table_record     ON public.audit_log (table_name, record_id);
CREATE INDEX idx_audit_performed_by     ON public.audit_log (performed_by);

-- ---------------------------------------------------------------------------
-- 15. report_exports
-- ---------------------------------------------------------------------------
CREATE TABLE public.report_exports (
  id                   uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id      uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  reporting_period_ids uuid[]      NOT NULL,
  format               text        NOT NULL CHECK (format IN ('pdf', 'csv', 'json')),
  scope_filter         smallint[]  NOT NULL DEFAULT ARRAY[1, 2]::smallint[],
  file_url             text        NOT NULL,
  file_sha256          text        NOT NULL,
  generated_by         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  generated_at         timestamptz DEFAULT now() NOT NULL,
  expires_at           timestamptz
);

COMMENT ON TABLE  public.report_exports IS 'Append-only registry of all generated GHG reports. Each export immutably records its SHA-256 digest for verification.';
COMMENT ON COLUMN public.report_exports.file_sha256 IS 'Hex SHA-256 of the exported file — users can verify report integrity offline.';
COMMENT ON COLUMN public.report_exports.scope_filter IS 'Which GHG scopes are included: [1], [2], or [1,2].';

CREATE INDEX idx_exports_org        ON public.report_exports (organization_id);
CREATE INDEX idx_exports_generated  ON public.report_exports (generated_at DESC);
