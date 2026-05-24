-- =============================================================================
-- Migración 016: Utilidades de seed demo
-- fn_demo_reset() — trunca todos los datos de proveedores para re-seed del demo.
-- TRUNCATE bypasea los triggers a nivel de fila (guardias solo-append).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_demo_reset()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- TRUNCATE bypasea los triggers BEFORE a nivel de fila (guardias de no-delete en
  -- emission_results, audit_log, report_exports). CASCADE maneja el orden de FK.
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

-- Permitir que service_role llame esta función
GRANT EXECUTE ON FUNCTION public.fn_demo_reset() TO service_role;
