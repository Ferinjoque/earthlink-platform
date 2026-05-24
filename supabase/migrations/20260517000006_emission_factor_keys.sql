-- Migración 006: columnas derivadas de lookup en emission_factors
-- activity_key, set_id, set_version se calculan automáticamente por el trigger
-- para que el motor de cálculo pueda construir un FactorTable sin joins en tiempo de ejecución.

ALTER TABLE public.emission_factors
  ADD COLUMN IF NOT EXISTS activity_key text,
  ADD COLUMN IF NOT EXISTS set_id       text,
  ADD COLUMN IF NOT EXISTS set_version  text;

-- ── Trigger de cómputo automático ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_compute_ef_key()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.activity_key := CASE NEW.source_type
    WHEN 'stationary_combustion' THEN
      'stationary_combustion.' ||
        (SELECT code FROM public.fuel_types WHERE id = NEW.fuel_type_id)
    WHEN 'mobile_combustion' THEN
      'mobile_combustion.' ||
        (SELECT code FROM public.fuel_types WHERE id = NEW.fuel_type_id)
    WHEN 'purchased_electricity' THEN
      'purchased_electricity.' ||
        (SELECT code FROM public.grid_regions WHERE id = NEW.grid_region_id)
    WHEN 'purchased_steam' THEN 'purchased_steam.default'
    WHEN 'fugitive' THEN
      'fugitive.' ||
        (SELECT code FROM public.refrigerants WHERE id = NEW.refrigerant_id)
    ELSE 'unknown.' || NEW.source_type
  END;

  NEW.set_id := NEW.source_db;

  NEW.set_version := CASE NEW.source_db
    WHEN 'DEFRA_2024' THEN '2024'
    WHEN 'IPCC_AR6'   THEN '6'
    WHEN 'MINEM_2023' THEN '2023'
    ELSE '1'
  END;

  RETURN NEW;
END; $$;

CREATE TRIGGER trg_ef_key
  BEFORE INSERT OR UPDATE ON public.emission_factors
  FOR EACH ROW EXECUTE FUNCTION public.fn_compute_ef_key();
