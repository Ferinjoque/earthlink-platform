-- ─────────────────────────────────────────────────────────────────────────────
-- Security fixes (identified via audit)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── C-1: anomaly_flags UPDATE policy (was missing) ───────────────────────────
-- Without this, any authenticated user could resolve anomalies in any org.

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

-- ── H-3a: audit_log read — restrict to admin/consultant (was USING (true)) ───
-- Suppliers must not be able to read all audit log entries.

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

-- ── H-3b: report_exports read — scope to org members (was USING (true)) ─────
-- Users must only see exports belonging to their own organizations.

DROP POLICY IF EXISTS "report_exports_read" ON public.report_exports;
CREATE POLICY "report_exports_read" ON public.report_exports
  FOR SELECT
  USING (public.fn_is_org_member(organization_id));
