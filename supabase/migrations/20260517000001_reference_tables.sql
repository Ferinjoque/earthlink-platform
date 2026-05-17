-- =============================================================================
-- Migration 001: Reference / Lookup Tables (5 tables)
-- GHG Protocol Scope 1 & 2 master data
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

COMMENT ON TABLE  public.fuel_types IS 'Master list of combustion fuels for Scope 1 sources.';
COMMENT ON COLUMN public.fuel_types.code IS 'Machine key matching ActivityKind.fuel discriminant.';

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

COMMENT ON TABLE  public.refrigerants IS 'Refrigerant master data with IPCC AR6 GWP-100 values.';
COMMENT ON COLUMN public.refrigerants.gwp_ar6 IS 'Global Warming Potential (100-yr) from IPCC Sixth Assessment Report.';

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

COMMENT ON TABLE  public.grid_regions IS 'Electricity grid regions for Scope 2 location-based calculations.';
COMMENT ON COLUMN public.grid_regions.code IS 'Machine key matching ActivityKind.gridRegion discriminant.';

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

COMMENT ON TABLE  public.emission_factors IS 'Emission factors from IPCC AR6, DEFRA 2024, MINEM 2023. Static — no live API calls.';
COMMENT ON COLUMN public.emission_factors.co2e_per_unit IS 'kg CO2e per normalized unit (kWh for gas/electricity, L for liquid fuels, kg for refrigerants).';
COMMENT ON COLUMN public.emission_factors.source_db IS 'Authoritative source: IPCC_AR6 | DEFRA_2024 | MINEM_2023';

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

COMMENT ON TABLE  public.unit_conversions IS 'Multiplicative conversion factors: result = input * factor.';
COMMENT ON COLUMN public.unit_conversions.factor IS 'Multiply from_unit quantity by this to get to_unit quantity.';
