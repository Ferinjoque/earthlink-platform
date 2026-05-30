-- =============================================================================
-- Migración 019: Eliminar re-inserción hardcodeada de memberships de fn_demo_reset
--
-- El paso 4 de la versión anterior intentaba insertar memberships para un UUID
-- hardcodeado que puede no existir en auth.users, causando violación de FK.
-- El script de seed maneja la creación de usuario + restauración de memberships tras el reset,
-- por lo que la función solo necesita limpiar datos.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_demo_reset()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. TRUNCATE tablas solo-append + transaccionales (bypasea triggers a nivel de fila)
  TRUNCATE
    public.report_exports,
    public.audit_log,
    public.anomaly_flags,
    public.emission_results,
    public.evidence_files,
    public.activity_entries,
    public.reporting_periods
  RESTART IDENTITY;

  -- 2. Eliminar solo memberships de proveedor (memberships de admin se preservan)
  DELETE FROM public.memberships WHERE supplier_id IS NOT NULL;

  -- 3. DELETE suppliers — ON DELETE SET NULL en memberships.supplier_id maneja las
  --    filas restantes. WHERE TRUE satisface el chequeo "requiere cláusula WHERE" de Supabase.
  DELETE FROM public.suppliers WHERE TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_demo_reset() TO service_role;
