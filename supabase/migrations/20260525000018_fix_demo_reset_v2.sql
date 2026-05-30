-- =============================================================================
-- Migración 018: Re-aplicar fn_demo_reset con WHERE TRUE en DELETE de suppliers
--
-- La migración 017 fue aplicada antes de tener el fix de WHERE TRUE.
-- La capa RPC de Supabase requiere cláusula WHERE en sentencias DELETE simples.
-- Esta migración re-aplica la definición corregida de la función.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_demo_reset()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. TRUNCATE tablas solo-append + transaccionales (bypasea triggers a nivel de fila)
  --    Orden explícito: hijos más profundos primero, no se necesita CASCADE
  TRUNCATE
    public.report_exports,
    public.audit_log,
    public.anomaly_flags,
    public.emission_results,
    public.evidence_files,
    public.activity_entries,
    public.reporting_periods
  RESTART IDENTITY;

  -- 2. Eliminar memberships de proveedor (role='supplier', supplier_id IS NOT NULL)
  --    Las memberships de admin/consultant (supplier_id = NULL) se preservan.
  DELETE FROM public.memberships WHERE supplier_id IS NOT NULL;

  -- 3. DELETE suppliers — el FK memberships.supplier_id es ON DELETE SET NULL,
  --    por lo que las filas restantes simplemente quedan con supplier_id = NULL.
  --    WHERE TRUE satisface el chequeo de seguridad de Supabase "requiere cláusula WHERE".
  DELETE FROM public.suppliers WHERE TRUE;

  -- 4. Re-insertar memberships de admin demo en caso de que se hayan perdido por un
  --    reset anterior fallido. Idempotente via restricción UNIQUE (user_id, organization_id).
  INSERT INTO public.memberships (user_id, organization_id, supplier_id, role)
  VALUES
    ('00000000-0000-0000-0000-000000000999', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001', NULL, 'admin'),
    ('00000000-0000-0000-0000-000000000999', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000002', NULL, 'admin')
  ON CONFLICT (user_id, organization_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_demo_reset() TO service_role;
