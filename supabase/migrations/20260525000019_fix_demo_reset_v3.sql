-- =============================================================================
-- Migration 019: Remove hardcoded membership re-insert from fn_demo_reset
--
-- Step 4 of the previous version attempted to insert memberships for a
-- hardcoded user UUID that may not exist in auth.users, causing FK violation.
-- The seed script handles user creation + membership restoration after reset,
-- so the function only needs to clear data.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_demo_reset()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. TRUNCATE append-only + transactional tables (bypasses row-level triggers)
  TRUNCATE
    public.report_exports,
    public.audit_log,
    public.anomaly_flags,
    public.emission_results,
    public.evidence_files,
    public.activity_entries,
    public.reporting_periods
  RESTART IDENTITY;

  -- 2. Remove supplier-scoped memberships only (admin memberships preserved)
  DELETE FROM public.memberships WHERE supplier_id IS NOT NULL;

  -- 3. DELETE suppliers — ON DELETE SET NULL on memberships.supplier_id handles any
  --    remaining rows. WHERE TRUE satisfies Supabase's "requires a WHERE clause" check.
  DELETE FROM public.suppliers WHERE TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_demo_reset() TO service_role;
