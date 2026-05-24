-- =============================================================================
-- Migration 021: Función RPC para borrado de emission_results (recalculación)
--
-- recalculatePeriod necesita borrar resultados previos de un periodo para
-- recalcular desde cero, pero el trigger trg_emission_results_no_delete bloquea
-- TODOS los DELETE en emission_results como guardia de solo-append.
--
-- Solución: función SECURITY DEFINER que usa set_config para señalizar al
-- trigger que el borrado es autorizado. Sólo service_role puede ejecutarla.
-- =============================================================================

-- 1. Modificar fn_prevent_mutation para respetar el flag de recalculación admin
CREATE OR REPLACE FUNCTION public.fn_prevent_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Permite borrado cuando la función admin autorizada lo indica
  -- (local=true garantiza que el flag se limpia al final de la transacción)
  IF current_setting('app.admin_recalc', true) = 'true' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION
    'Table "%" is append-only. Mutating record "%" is not permitted.',
    TG_TABLE_NAME, OLD.id
    USING ERRCODE = 'restrict_violation';
END;
$$;

-- 2. Función SECURITY DEFINER que autoriza el borrado para un periodo
--    Ejecuta como su propietario (postgres/supabase_admin) dentro de la misma
--    transacción. set_config con local=true se limpia al finalizar la TX.
CREATE OR REPLACE FUNCTION public.fn_admin_delete_period_results(p_period_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Señalizar al trigger que este borrado es autorizado
  PERFORM set_config('app.admin_recalc', 'true', true); -- local=true: solo esta TX

  DELETE FROM public.emission_results WHERE reporting_period_id = p_period_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
EXCEPTION WHEN OTHERS THEN
  -- El flag se limpia automáticamente al revertir la TX, pero limpiamos explícitamente
  PERFORM set_config('app.admin_recalc', 'false', true);
  RAISE;
END;
$$;

-- 3. Sólo service_role puede ejecutar la función de bypass
REVOKE ALL ON FUNCTION public.fn_admin_delete_period_results(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_admin_delete_period_results(uuid) TO service_role;
