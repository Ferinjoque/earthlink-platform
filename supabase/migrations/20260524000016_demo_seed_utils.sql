-- =============================================================================
-- Migration 016: Demo seed utilities
-- fn_demo_reset() — truncates all supplier-owned data for demo reseeding.
-- TRUNCATE bypasses row-level triggers (append-only guards).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_demo_reset()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- TRUNCATE bypasses row-level BEFORE triggers (no-delete guards on
  -- emission_results, audit_log, report_exports). CASCADE handles FK order.
  TRUNCATE
    public.report_exports,
    public.audit_log,
    public.anomaly_flags,
    public.emission_results,
    public.evidence_files,
    public.activity_entries,
    public.reporting_periods,
    public.suppliers
  RESTART IDENTITY CASCADE;
END;
$$;

-- Allow service_role to call this function
GRANT EXECUTE ON FUNCTION public.fn_demo_reset() TO service_role;
