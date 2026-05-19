-- =============================================================================
-- Migration 013: GRESB source types expansion + new unit conversions
-- Adds fuel_oil_no2, propane fuels + kBtu/kgal_us/megaliter/m3/ton_us conversions
-- Also expands activity_entries.source_type CHECK to include water_use + waste
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Expand activity_entries.source_type CHECK constraint
-- ---------------------------------------------------------------------------
ALTER TABLE public.activity_entries
  DROP CONSTRAINT IF EXISTS activity_entries_source_type_check;

ALTER TABLE public.activity_entries
  ADD CONSTRAINT activity_entries_source_type_check
  CHECK (source_type IN (
    'stationary_combustion',
    'mobile_combustion',
    'purchased_electricity',
    'purchased_steam',
    'fugitive',
    'water_use',
    'waste'
  ));

-- ---------------------------------------------------------------------------
-- 2. New fuel types: fuel_oil_no2, propane (stationary combustion)
-- ---------------------------------------------------------------------------
INSERT INTO public.fuel_types (id, code, label, scope, activity_kind) VALUES
  ('11111111-0001-0001-0001-000000000007', 'fuel_oil_no2', 'Fuel Oil No. 2 (Diésel Pesado)', 1, 'stationary_combustion'),
  ('11111111-0001-0001-0001-000000000008', 'propane',      'Propano (Combustible Líquido)',   1, 'stationary_combustion')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Emission factors for new fuels (DEFRA 2024 / US EPA values)
-- fuel_oil_no2: 2.68344 kg CO2e / L  (DEFRA 2024: Gas oil / Diesel)
-- propane:      1.49304 kg CO2e / L  (DEFRA 2024: LPG / Propane ~ 1.495)
-- ---------------------------------------------------------------------------
INSERT INTO public.emission_factors
  (id, source_type, fuel_type_id, co2e_per_unit, unit, scope, source_db, valid_from, valid_to)
VALUES
  -- Fuel Oil No. 2: ~2.68 kg CO2e / L (similar to gas oil, DEFRA 2024)
  ('44444444-0001-0001-0001-000000000007',
   'stationary_combustion', '11111111-0001-0001-0001-000000000007',
   2.68344000, 'L', 1, 'DEFRA_2024', '2024-01-01', NULL),
  -- Propano: 1.49304 kg CO2e / L (DEFRA 2024)
  ('44444444-0001-0001-0001-000000000008',
   'stationary_combustion', '11111111-0001-0001-0001-000000000008',
   1.49304000, 'L', 1, 'DEFRA_2024', '2024-01-01', NULL)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. New unit conversions: kBtu, kgal_us, megaliter, m3, ton_us
-- ---------------------------------------------------------------------------
INSERT INTO public.unit_conversions (from_unit, to_unit, factor, notes) VALUES
  -- kBtu (mil BTU) ↔ kWh
  ('kBtu',      'kWh',   0.29307100, '1 kBtu = 0.293071 kWh'),
  ('kWh',       'kBtu',  3.41214100, '1 kWh = 3.41214 kBtu'),
  -- kBtu ↔ L (para combustibles líquidos via energía)
  -- Nota: kBtu → L no aplica directamente; usuarios deben usar kBtu → kWh → factor
  -- kBtu → GJ
  ('kBtu',      'GJ',    0.00105506, '1 kBtu = 0.00105506 GJ'),
  ('GJ',        'kBtu', 947.81700000,'1 GJ = 947.817 kBtu'),
  -- kBtu ↔ MMBtu
  ('kBtu',      'MMBtu', 0.00100000, '1 kBtu = 0.001 MMBtu'),
  ('MMBtu',     'kBtu', 1000.0000000,'1 MMBtu = 1000 kBtu'),
  -- kBtu ↔ MBtu (same as MMBtu by convention in GRESB)
  ('kBtu',      'MBtu',  0.00100000, '1 kBtu = 0.001 MBtu'),
  ('MBtu',      'kBtu', 1000.0000000,'1 MBtu = 1000 kBtu'),
  -- kgal_us (mil galones US) ↔ L
  ('kgal_us',   'L',   3785.41200000,'1 kgal_us = 3785.412 L'),
  ('L',         'kgal_us', 0.00026417,'1 L = 0.000264172 kgal_us'),
  -- kgal_us ↔ megaliter
  ('kgal_us',   'megaliter', 0.00378541,'1 kgal_us = 0.00378541 ML'),
  ('megaliter', 'kgal_us', 264.17200000,'1 ML = 264.172 kgal_us'),
  -- megaliter ↔ L
  ('megaliter', 'L', 1000000.0000000,'1 ML = 1,000,000 L'),
  ('L',         'megaliter', 0.00000100,'1 L = 0.000001 ML'),
  -- m3 (metros cúbicos) ↔ kgal_us
  ('m3',        'kgal_us', 0.26417200, '1 m3 = 0.264172 kgal_us'),
  ('kgal_us',   'm3',       3.78541200, '1 kgal_us = 3.785412 m3'),
  -- m3 ↔ L
  ('m3',        'L',    1000.0000000, '1 m3 = 1000 L'),
  ('L',         'm3',      0.00100000, '1 L = 0.001 m3'),
  -- m3 ↔ megaliter
  ('m3',        'megaliter', 0.00100000, '1 m3 = 0.001 ML'),
  ('megaliter', 'm3',    1000.0000000, '1 ML = 1000 m3'),
  -- ton_us (tonelada corta US, short ton) ↔ tonne (métrica)
  ('ton_us',    'tonne',    0.90718474, '1 US short ton = 0.907185 metric tonne'),
  ('tonne',     'ton_us',   1.10231131, '1 metric tonne = 1.10231 US short ton'),
  -- ton_us ↔ kg
  ('ton_us',    'kg',     907.18474000, '1 US short ton = 907.185 kg'),
  ('kg',        'ton_us',   0.00110231, '1 kg = 0.00110231 US short ton'),
  -- ton_us ↔ lb
  ('ton_us',    'lb',    2000.0000000, '1 US short ton = 2000 lb'),
  ('lb',        'ton_us',   0.00050000, '1 lb = 0.0005 US short ton'),
  -- gallon ↔ kgal_us
  ('gallon',    'kgal_us',  0.00100000, '1 gallon = 0.001 kgal_us'),
  ('kgal_us',   'gallon', 1000.0000000, '1 kgal_us = 1000 gallons US')
ON CONFLICT (from_unit, to_unit) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Update fn_compute_ef_key trigger to handle water_use / waste
-- (source_type check doesn't apply to these — key is set directly via activity_key)
-- ---------------------------------------------------------------------------
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

  NEW.set_id      := NEW.source_db;
  NEW.set_version := CASE NEW.source_db
    WHEN 'DEFRA_2024' THEN '2024'
    WHEN 'IPCC_AR6'   THEN '6'
    WHEN 'MINEM_2023' THEN '2023'
    ELSE '1'
  END;

  RETURN NEW;
END; $$;
