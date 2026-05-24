-- ─────────────────────────────────────────────────────────────────────────────
-- Correcciones de seguridad (identificadas via auditoría)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── C-1: Política UPDATE en anomaly_flags (faltaba) ──────────────────────────
-- Sin esto, cualquier usuario autenticado podía resolver anomalías en cualquier org.

DROP POLICY IF EXISTS "anomaly_update_staff" ON public.anomaly_flags;
CREATE POLICY "anomaly_update_staff" ON public.anomaly_flags
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM   public.activity_entries ae
      JOIN   public.reporting_periods rp ON rp.id = ae.reporting_period_id
      JOIN   public.suppliers          s  ON s.id  = rp.supplier_id
      WHERE  ae.id = anomaly_flags.activity_entry_id
        AND  public.fn_user_role_in_org(s.organization_id) IN ('admin', 'consultant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   public.activity_entries ae
      JOIN   public.reporting_periods rp ON rp.id = ae.reporting_period_id
      JOIN   public.suppliers          s  ON s.id  = rp.supplier_id
      WHERE  ae.id = anomaly_flags.activity_entry_id
        AND  public.fn_user_role_in_org(s.organization_id) IN ('admin', 'consultant')
    )
  );

-- ── H-3a: Lectura en audit_log — restringir a admin/consultant (era USING (true)) ──
-- Los suppliers no deben poder leer todas las entradas del audit log.

DROP POLICY IF EXISTS "audit_log_read" ON public.audit_log;
CREATE POLICY "audit_log_read" ON public.audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE  user_id = auth.uid()
        AND  role IN ('admin', 'consultant')
    )
  );

-- ── H-3b: Lectura en report_exports — acotar a miembros de la org (era USING (true)) ──
-- Los usuarios solo deben ver exportaciones de sus propias organizaciones.

DROP POLICY IF EXISTS "report_exports_read" ON public.report_exports;
CREATE POLICY "report_exports_read" ON public.report_exports
  FOR SELECT
  USING (public.fn_is_org_member(organization_id));
