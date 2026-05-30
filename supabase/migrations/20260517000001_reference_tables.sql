-- =============================================================================
-- Migración 001: Tablas de referencia / lookup (5 tablas)
-- Datos maestros GHG Protocol Alcance 1 y 2
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. fuel_types
-- ---------------------------------------------------------------------------
CREATE TABLE public.fuel_types (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  code         text        NOT NULL UNIQUE,
  label        text        NOT NULL,
  scope        smallint    NOT NULL CHECK (scope = 1),
  activity_kind text       NOT NULL CHECK (activity_kind IN ('stationary_combustion', 'mobile_combustion')),
  created_at   timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE  public.fuel_types IS 'Catálogo maestro de combustibles para fuentes de Alcance 1.';
COMMENT ON COLUMN public.fuel_types.code IS 'Clave de máquina que corresponde al discriminador ActivityKind.fuel.';

-- ---------------------------------------------------------------------------
-- 2. refrigerants
-- ---------------------------------------------------------------------------
CREATE TABLE public.refrigerants (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  code       text        NOT NULL UNIQUE,
  label      text        NOT NULL,
  gwp_ar6    numeric(10, 2) NOT NULL CHECK (gwp_ar6 > 0),
  created_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE  public.refrigerants IS 'Datos maestros de refrigerantes con valores GWP-100 del IPCC AR6.';
COMMENT ON COLUMN public.refrigerants.gwp_ar6 IS 'Potencial de calentamiento global (100 años) según el Sexto Informe de Evaluación del IPCC.';

-- ---------------------------------------------------------------------------
-- 3. grid_regions
-- ---------------------------------------------------------------------------
CREATE TABLE public.grid_regions (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  code       text        NOT NULL UNIQUE,
  label      text        NOT NULL,
  country    text        NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE  public.grid_regions IS 'Regiones de red eléctrica para cálculos basados en localización de Alcance 2.';
COMMENT ON COLUMN public.grid_regions.code IS 'Clave de máquina que corresponde al discriminador ActivityKind.gridRegion.';

-- ---------------------------------------------------------------------------
-- 4. emission_factors
-- ---------------------------------------------------------------------------
CREATE TABLE public.emission_factors (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  source_type    text        NOT NULL CHECK (source_type IN (
                               'stationary_combustion',
                               'mobile_combustion',
                               'purchased_electricity',
                               'purchased_steam',
                               'fugitive'
                             )),
  fuel_type_id   uuid        REFERENCES public.fuel_types(id)    ON DELETE RESTRICT,
  refrigerant_id uuid        REFERENCES public.refrigerants(id)  ON DELETE RESTRICT,
  grid_region_id uuid        REFERENCES public.grid_regions(id)  ON DELETE RESTRICT,
  co2e_per_unit  numeric(18, 8) NOT NULL CHECK (co2e_per_unit > 0),
  unit           text        NOT NULL,
  scope          smallint    NOT NULL CHECK (scope IN (1, 2)),
  source_db      text        NOT NULL,
  valid_from     date        NOT NULL,
  valid_to       date,
  created_at     timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT ck_ef_combustion_has_fuel CHECK (
    source_type NOT IN ('stationary_combustion', 'mobile_combustion')
    OR fuel_type_id IS NOT NULL
  ),
  CONSTRAINT ck_ef_fugitive_has_refrigerant CHECK (
    source_type <> 'fugitive' OR refrigerant_id IS NOT NULL
  ),
  CONSTRAINT ck_ef_electricity_has_region CHECK (
    source_type <> 'purchased_electricity' OR grid_region_id IS NOT NULL
  ),
  CONSTRAINT ck_ef_valid_range CHECK (
    valid_to IS NULL OR valid_to > valid_from
  )
);

COMMENT ON TABLE  public.emission_factors IS 'Factores de emisión de IPCC AR6, DEFRA 2024, MINEM 2023. Estáticos — sin llamadas a APIs externas.';
COMMENT ON COLUMN public.emission_factors.co2e_per_unit IS 'kg CO2e por unidad normalizada (kWh para gas/electricidad, L para combustibles líquidos, kg para refrigerantes).';
COMMENT ON COLUMN public.emission_factors.source_db IS 'Fuente autoritativa: IPCC_AR6 | DEFRA_2024 | MINEM_2023';

CREATE INDEX idx_ef_source_type ON public.emission_factors (source_type);
CREATE INDEX idx_ef_fuel_type   ON public.emission_factors (fuel_type_id) WHERE fuel_type_id IS NOT NULL;
CREATE INDEX idx_ef_grid_region ON public.emission_factors (grid_region_id) WHERE grid_region_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. unit_conversions
-- ---------------------------------------------------------------------------
CREATE TABLE public.unit_conversions (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  from_unit  text        NOT NULL,
  to_unit    text        NOT NULL,
  factor     numeric(18, 8) NOT NULL CHECK (factor > 0),
  notes      text,
  created_at timestamptz DEFAULT now() NOT NULL,

  UNIQUE (from_unit, to_unit)
);

COMMENT ON TABLE  public.unit_conversions IS 'Factores de conversión multiplicativos: resultado = entrada × factor.';
COMMENT ON COLUMN public.unit_conversions.factor IS 'Multiplicar la cantidad en from_unit por este valor para obtener la cantidad en to_unit.';
