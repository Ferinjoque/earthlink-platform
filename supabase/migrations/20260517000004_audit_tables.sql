-- =============================================================================
-- Migración 004: Tablas de auditoría (2 tablas)
-- Registros inmutables solo-append — guardias de mutación aplicados en migración 005.
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

COMMENT ON TABLE  public.audit_log IS 'Registro de eventos inmutable. Cada mutación a tablas críticas queda automáticamente registrada. No se permiten UPDATE ni DELETE.';
COMMENT ON COLUMN public.audit_log.action IS 'INSERT | UPDATE | DELETE | LOCK | EXPORT | LOGIN | ANOMALY_RESOLVED';
COMMENT ON COLUMN public.audit_log.record_id IS 'Clave primaria de la fila afectada en table_name.';

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

COMMENT ON TABLE  public.report_exports IS 'Registro solo-append de todos los reportes GHG generados. Cada exportación registra inmutablemente su hash SHA-256 para verificación.';
COMMENT ON COLUMN public.report_exports.file_sha256 IS 'SHA-256 hexadecimal del archivo exportado — los usuarios pueden verificar la integridad del reporte sin conexión.';
COMMENT ON COLUMN public.report_exports.scope_filter IS 'Alcances GHG incluidos en el reporte: [1], [2], o [1,2].';

CREATE INDEX idx_exports_org        ON public.report_exports (organization_id);
CREATE INDEX idx_exports_generated  ON public.report_exports (generated_at DESC);
