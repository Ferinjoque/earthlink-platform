-- =============================================================================
-- Migración 010: Política INSERT para emission_results
-- La acción calculatePeriod corre como admin/consultant autenticado via cliente anon-key.
-- RLS estaba habilitado en emission_results sin política INSERT, bloqueando inserts del cliente.
-- Esta política otorga INSERT a miembros admin/consultant de la org del proveedor.
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
