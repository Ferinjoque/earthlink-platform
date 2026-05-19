-- =============================================================================
-- Migration 017: Fix fn_demo_reset — preserve memberships during supplier wipe
--
-- Root cause: TRUNCATE suppliers CASCADE also truncated memberships because
-- memberships.supplier_id FK → suppliers triggers TRUNCATE CASCADE regardless
-- of the ON DELETE SET NULL action (TRUNCATE CASCADE always cascades).
-- Fix: TRUNCATE child tables explicitly in dependency order, then DELETE
-- FROM suppliers (which correctly honors ON DELETE SET NULL on memberships).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_demo_reset()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. TRUNCATE append-only + transactional tables (bypasses row-level triggers)
  --    Explicit order: deepest children first, no CASCADE needed
  TRUNCATE
    public.report_exports,
    public.audit_log,
    public.anomaly_flags,
    public.emission_results,
    public.evidence_files,
    public.activity_entries,
    public.reporting_periods
  RESTART IDENTITY;

  -- 2. Remove supplier-scoped memberships (role='supplier', supplier_id IS NOT NULL)
  --    Admin/consultant memberships (supplier_id = NULL) are preserved.
  DELETE FROM public.memberships WHERE supplier_id IS NOT NULL;

  -- 3. DELETE suppliers — FK memberships.supplier_id is ON DELETE SET NULL,
  --    so any remaining supplier-scoped rows just get supplier_id = NULL.
  --    WHERE TRUE satisfies the "requires a WHERE clause" safety check.
  DELETE FROM public.suppliers WHERE TRUE;

  -- 4. Re-insert demo admin memberships in case they were lost by a previous
  --    bad reset run. Idempotent via the UNIQUE (user_id, organization_id) constraint.
  INSERT INTO public.memberships (user_id, organization_id, supplier_id, role)
  VALUES
    ('00000000-0000-0000-0000-000000000999', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001', NULL, 'admin'),
    ('00000000-0000-0000-0000-000000000999', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000002', NULL, 'admin')
  ON CONFLICT (user_id, organization_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_demo_reset() TO service_role;

-- Demo user + memberships are restored by the seed script (scripts/seed-demo.ts)
-- via the Supabase Auth Admin API, not via raw SQL.
-- Run: npx tsx scripts/seed-demo.ts
