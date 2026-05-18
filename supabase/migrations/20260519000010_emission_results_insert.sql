-- =============================================================================
-- Migration 010: INSERT policy for emission_results
-- The calculation action (calculatePeriod) runs as an authenticated admin or
-- consultant via the anon-key client. RLS was enabled on emission_results with
-- no INSERT policy, blocking inserts by the user-scoped client.
-- This policy grants INSERT to admin/consultant members of the supplier's org.
-- =============================================================================

DROP POLICY IF EXISTS "emission_result_insert" ON public.emission_results;

CREATE POLICY "emission_result_insert" ON public.emission_results FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.reporting_periods rp
      JOIN public.suppliers s ON s.id = rp.supplier_id
      WHERE rp.id = emission_results.reporting_period_id
        AND public.fn_user_role_in_org(s.organization_id) IN ('admin', 'consultant')
    )
  );
