-- =============================================================================
-- Seed Data
-- Reference data: DEFRA 2024 + IPCC AR6 + MINEM 2023
-- Demo data: 3 suppliers, 2 reporting periods each, 1 planted anomaly
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Fuel Types
-- ---------------------------------------------------------------------------
INSERT INTO public.fuel_types (id, code, label, scope, activity_kind) VALUES
  ('11111111-0001-0001-0001-000000000001', 'natural_gas', 'Natural Gas',  1, 'stationary_combustion'),
  ('11111111-0001-0001-0001-000000000002', 'diesel',      'Diesel',       1, 'stationary_combustion'),
  ('11111111-0001-0001-0001-000000000003', 'lpg',         'LPG / Propane',1, 'stationary_combustion'),
  ('11111111-0001-0001-0001-000000000004', 'diesel',      'Diesel (Mobile)', 1, 'mobile_combustion'),
  ('11111111-0001-0001-0001-000000000005', 'gasoline',    'Gasoline',     1, 'mobile_combustion'),
  ('11111111-0001-0001-0001-000000000006', 'lpg',         'LPG (Mobile)', 1, 'mobile_combustion')
ON CONFLICT (id) DO NOTHING;

-- NOTE: 'diesel' code used for both stationary and mobile. The FK from activity_entries
-- uses source_type to disambiguate which fuel_type row applies.
-- In production, unique constraint is on (code, activity_kind) — handled by FK logic.

-- ---------------------------------------------------------------------------
-- Refrigerants — IPCC AR6 GWP-100 values
-- ---------------------------------------------------------------------------
INSERT INTO public.refrigerants (id, code, label, gwp_ar6) VALUES
  ('22222222-0002-0002-0002-000000000001', 'R410A', 'R-410A (HFC blend)', 2088.00),
  ('22222222-0002-0002-0002-000000000002', 'R134A', 'R-134a (HFC)',       1430.00),
  ('22222222-0002-0002-0002-000000000003', 'R32',   'R-32 (HFC)',          675.00)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Grid Regions
-- ---------------------------------------------------------------------------
INSERT INTO public.grid_regions (id, code, label, country) VALUES
  ('33333333-0003-0003-0003-000000000001', 'SEIN_PERU',   'SEIN – Sistema Eléctrico Interconectado Nacional (Peru)', 'PE'),
  ('33333333-0003-0003-0003-000000000002', 'LATAM_AVG',   'Latin America Average Grid',                             'LATAM'),
  ('33333333-0003-0003-0003-000000000003', 'US_AVERAGE',  'US Average Grid (EPA eGRID 2023)',                       'US'),
  ('33333333-0003-0003-0003-000000000004', 'EU_AVERAGE',  'EU-27 Average Grid (IEA 2023)',                          'EU')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Emission Factors
-- Sources: DEFRA 2024 (UK BEIS), MINEM 2023 (Peru), IPCC AR6
-- Unit: kg CO2e per normalized unit
-- ---------------------------------------------------------------------------

-- Stationary combustion (Scope 1) — DEFRA 2024
INSERT INTO public.emission_factors
  (id, source_type, fuel_type_id, co2e_per_unit, unit, scope, source_db, valid_from, valid_to)
VALUES
  -- Natural gas: 0.18316 kg CO2e / kWh (gross CV, includes CH4 + N2O)
  ('44444444-0001-0001-0001-000000000001',
   'stationary_combustion', '11111111-0001-0001-0001-000000000001',
   0.18316000, 'kWh', 1, 'DEFRA_2024', '2024-01-01', NULL),
  -- Diesel (stationary): 2.51390000 kg CO2e / L
  ('44444444-0001-0001-0001-000000000002',
   'stationary_combustion', '11111111-0001-0001-0001-000000000002',
   2.51390000, 'L', 1, 'DEFRA_2024', '2024-01-01', NULL),
  -- LPG (stationary): 1.55540000 kg CO2e / L
  ('44444444-0001-0001-0001-000000000003',
   'stationary_combustion', '11111111-0001-0001-0001-000000000003',
   1.55540000, 'L', 1, 'DEFRA_2024', '2024-01-01', NULL)
ON CONFLICT (id) DO NOTHING;

-- Mobile combustion (Scope 1) — DEFRA 2024
INSERT INTO public.emission_factors
  (id, source_type, fuel_type_id, co2e_per_unit, unit, scope, source_db, valid_from, valid_to)
VALUES
  -- Diesel (mobile): 2.51390000 kg CO2e / L
  ('44444444-0001-0002-0001-000000000001',
   'mobile_combustion', '11111111-0001-0001-0001-000000000004',
   2.51390000, 'L', 1, 'DEFRA_2024', '2024-01-01', NULL),
  -- Gasoline: 2.16850000 kg CO2e / L
  ('44444444-0001-0002-0001-000000000002',
   'mobile_combustion', '11111111-0001-0001-0001-000000000005',
   2.16850000, 'L', 1, 'DEFRA_2024', '2024-01-01', NULL),
  -- LPG (mobile): 1.55540000 kg CO2e / L
  ('44444444-0001-0002-0001-000000000003',
   'mobile_combustion', '11111111-0001-0001-0001-000000000006',
   1.55540000, 'L', 1, 'DEFRA_2024', '2024-01-01', NULL)
ON CONFLICT (id) DO NOTHING;

-- Purchased electricity (Scope 2)
INSERT INTO public.emission_factors
  (id, source_type, grid_region_id, co2e_per_unit, unit, scope, source_db, valid_from, valid_to)
VALUES
  -- Peru SEIN: 0.4517 kg CO2e / kWh — MINEM 2023
  ('44444444-0002-0001-0001-000000000001',
   'purchased_electricity', '33333333-0003-0003-0003-000000000001',
   0.45170000, 'kWh', 2, 'MINEM_2023', '2023-01-01', NULL),
  -- LATAM average: 0.2830 kg CO2e / kWh
  ('44444444-0002-0001-0001-000000000002',
   'purchased_electricity', '33333333-0003-0003-0003-000000000002',
   0.28300000, 'kWh', 2, 'DEFRA_2024', '2024-01-01', NULL),
  -- US average: 0.3861 kg CO2e / kWh — EPA eGRID 2023
  ('44444444-0002-0001-0001-000000000003',
   'purchased_electricity', '33333333-0003-0003-0003-000000000003',
   0.38610000, 'kWh', 2, 'DEFRA_2024', '2024-01-01', NULL),
  -- EU-27 average: 0.2330 kg CO2e / kWh — IEA 2023
  ('44444444-0002-0001-0001-000000000004',
   'purchased_electricity', '33333333-0003-0003-0003-000000000004',
   0.23300000, 'kWh', 2, 'DEFRA_2024', '2024-01-01', NULL)
ON CONFLICT (id) DO NOTHING;

-- Fugitive emissions (Scope 1) — IPCC AR6 GWP-100
-- Factor = GWP-100 value; 1 kg refrigerant leaked = GWP kg CO2e
INSERT INTO public.emission_factors
  (id, source_type, refrigerant_id, co2e_per_unit, unit, scope, source_db, valid_from, valid_to)
VALUES
  ('44444444-0003-0001-0001-000000000001',
   'fugitive', '22222222-0002-0002-0002-000000000001',
   2088.00000000, 'kg', 1, 'IPCC_AR6', '2023-01-01', NULL),
  ('44444444-0003-0001-0001-000000000002',
   'fugitive', '22222222-0002-0002-0002-000000000002',
   1430.00000000, 'kg', 1, 'IPCC_AR6', '2023-01-01', NULL),
  ('44444444-0003-0001-0001-000000000003',
   'fugitive', '22222222-0002-0002-0002-000000000003',
    675.00000000, 'kg', 1, 'IPCC_AR6', '2023-01-01', NULL)
ON CONFLICT (id) DO NOTHING;

-- Purchased steam (Scope 2) — DEFRA 2024 district heating average
INSERT INTO public.emission_factors
  (id, source_type, co2e_per_unit, unit, scope, source_db, valid_from, valid_to)
VALUES
  ('44444444-0004-0001-0001-000000000001',
   'purchased_steam',
   0.18400000, 'kWh', 2, 'DEFRA_2024', '2024-01-01', NULL)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Unit Conversions
-- ---------------------------------------------------------------------------
INSERT INTO public.unit_conversions (from_unit, to_unit, factor, notes) VALUES
  -- Volume
  ('gallon',      'L',    3.78541200, 'US liquid gallon to litre'),
  ('gal',         'L',    3.78541200, 'US liquid gallon (abbrev) to litre'),
  ('imp_gallon',  'L',    4.54609000, 'Imperial gallon to litre'),
  -- Energy
  ('therms',      'kWh', 29.30710000, 'US natural gas therm to kWh (1 therm = 100,000 BTU)'),
  ('therm',       'kWh', 29.30710000, 'Singular form'),
  ('MMBtu',       'kWh', 293.07100000,'Million BTU to kWh'),
  ('MBtu',        'kWh',   0.29307100,'Thousand BTU to kWh'),
  ('BTU',         'kWh',   0.00029307,'BTU to kWh'),
  ('MWh',         'kWh', 1000.0000000,'Megawatt-hour to kilowatt-hour'),
  ('GJ',          'kWh',  277.7778000,'Gigajoule to kWh'),
  ('MJ',          'kWh',    0.2777780,'Megajoule to kWh'),
  ('kJ',          'kWh',    0.0002778,'Kilojoule to kWh'),
  -- Natural gas volume → energy
  ('m3_ng',       'kWh',  10.5500000, 'Cubic metre natural gas to kWh (gross CV, DEFRA 2024)'),
  ('ft3_ng',      'kWh',   0.2988000, 'Cubic foot natural gas to kWh'),
  -- Mass
  ('tonne',       'kg',  1000.0000000,'Metric tonne to kilogram'),
  ('lb',          'kg',     0.4535924,'Pound to kilogram'),
  ('oz',          'kg',     0.0283495,'Ounce to kilogram'),
  -- LPG mass ↔ volume (propane density ~0.509 kg/L at 15°C)
  ('kg_lpg',      'L',      1.9646000,'Kilogram of LPG (propane) to litre'),
  -- Identity (no-op conversions, useful for unit validation)
  ('kWh',         'kWh',    1.0000000,'Identity'),
  ('L',           'L',      1.0000000,'Identity'),
  ('kg',          'kg',     1.0000000,'Identity')
ON CONFLICT (from_unit, to_unit) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Demo Organizations
-- ---------------------------------------------------------------------------
INSERT INTO public.organizations (id, name, industry, ruc, country) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000001',
   'EcoGroup SAC',
   'Consumer Goods',
   '20612345678',
   'PE'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000002',
   'Andean Mining Corp',
   'Mining & Extraction',
   '20698765432',
   'PE')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Demo Suppliers (3 per org = 6 total; fits the academic 15-table showcase)
-- ---------------------------------------------------------------------------
INSERT INTO public.suppliers (id, organization_id, name, category, contact_email) VALUES
  -- EcoGroup SAC suppliers
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000001',
   'aaaaaaaa-aaaa-aaaa-aaaa-000000000001',
   'Lima Printing & Packaging SAC',
   'Manufacturing',
   'sustainability@limaprinting.pe'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000002',
   'aaaaaaaa-aaaa-aaaa-aaaa-000000000001',
   'Logística TransAndes',
   'Transportation & Logistics',
   'ops@transandes.pe'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000003',
   'aaaaaaaa-aaaa-aaaa-aaaa-000000000001',
   'Aromas del Pacífico SAC',
   'Food & Beverage',
   'esg@aromas.pe'),
  -- Andean Mining Corp suppliers
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000004',
   'aaaaaaaa-aaaa-aaaa-aaaa-000000000002',
   'Equipos Mineros del Sur',
   'Heavy Equipment',
   'contact@equipossur.pe'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000005',
   'aaaaaaaa-aaaa-aaaa-aaaa-000000000002',
   'Servicios Eléctricos Andinos',
   'Energy Services',
   'operations@sea.pe'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000006',
   'aaaaaaaa-aaaa-aaaa-aaaa-000000000002',
   'Químicos Industriales SA',
   'Chemicals',
   'compliance@quimicos.pe')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Reporting Periods (2 per supplier = 12 total)
-- Q4-2025 (baseline) and Q1-2026 (current)
-- ---------------------------------------------------------------------------
INSERT INTO public.reporting_periods (id, supplier_id, label, start_date, end_date, status) VALUES
  -- Lima Printing & Packaging
  ('cccccccc-cccc-cccc-cccc-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-000000000001', 'Q4-2025', '2025-10-01', '2025-12-31', 'locked'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-000000000001', 'Q1-2026', '2026-01-01', '2026-03-31', 'under_review'),
  -- Logística TransAndes
  ('cccccccc-cccc-cccc-cccc-000000000003', 'bbbbbbbb-bbbb-bbbb-bbbb-000000000002', 'Q4-2025', '2025-10-01', '2025-12-31', 'locked'),
  ('cccccccc-cccc-cccc-cccc-000000000004', 'bbbbbbbb-bbbb-bbbb-bbbb-000000000002', 'Q1-2026', '2026-01-01', '2026-03-31', 'open'),
  -- Aromas del Pacífico
  ('cccccccc-cccc-cccc-cccc-000000000005', 'bbbbbbbb-bbbb-bbbb-bbbb-000000000003', 'Q4-2025', '2025-10-01', '2025-12-31', 'locked'),
  ('cccccccc-cccc-cccc-cccc-000000000006', 'bbbbbbbb-bbbb-bbbb-bbbb-000000000003', 'Q1-2026', '2026-01-01', '2026-03-31', 'open'),
  -- Equipos Mineros del Sur
  ('cccccccc-cccc-cccc-cccc-000000000007', 'bbbbbbbb-bbbb-bbbb-bbbb-000000000004', 'Q4-2025', '2025-10-01', '2025-12-31', 'locked'),
  ('cccccccc-cccc-cccc-cccc-000000000008', 'bbbbbbbb-bbbb-bbbb-bbbb-000000000004', 'Q1-2026', '2026-01-01', '2026-03-31', 'open'),
  -- Servicios Eléctricos Andinos
  ('cccccccc-cccc-cccc-cccc-000000000009', 'bbbbbbbb-bbbb-bbbb-bbbb-000000000005', 'Q4-2025', '2025-10-01', '2025-12-31', 'locked'),
  ('cccccccc-cccc-cccc-cccc-000000000010', 'bbbbbbbb-bbbb-bbbb-bbbb-000000000005', 'Q1-2026', '2026-01-01', '2026-03-31', 'open'),
  -- Químicos Industriales SA
  ('cccccccc-cccc-cccc-cccc-000000000011', 'bbbbbbbb-bbbb-bbbb-bbbb-000000000006', 'Q4-2025', '2025-10-01', '2025-12-31', 'locked'),
  ('cccccccc-cccc-cccc-cccc-000000000012', 'bbbbbbbb-bbbb-bbbb-bbbb-000000000006', 'Q1-2026', '2026-01-01', '2026-03-31', 'open')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Activity Entries — Q4-2025 baseline (locked periods)
-- ---------------------------------------------------------------------------
INSERT INTO public.activity_entries
  (id, reporting_period_id, source_type, activity_kind, raw_quantity, raw_unit,
   fuel_type_id, grid_region_id, status, submitted_at)
VALUES
  -- Lima Printing Q4-2025: diesel boiler (stationary) + electricity
  ('dddddddd-dddd-dddd-dddd-000000000001',
   'cccccccc-cccc-cccc-cccc-000000000001',
   'stationary_combustion',
   '{"kind":"stationary_combustion","fuel":"diesel"}'::jsonb,
   850.0, 'L',
   '11111111-0001-0001-0001-000000000002', NULL,
   'validated', '2026-01-15 09:00:00+00'),

  ('dddddddd-dddd-dddd-dddd-000000000002',
   'cccccccc-cccc-cccc-cccc-000000000001',
   'purchased_electricity',
   '{"kind":"purchased_electricity","gridRegion":"SEIN_PERU"}'::jsonb,
   42500.0, 'kWh',
   NULL, '33333333-0003-0003-0003-000000000001',
   'validated', '2026-01-15 09:00:00+00'),

  -- TransAndes Q4-2025: diesel trucks (mobile)
  ('dddddddd-dddd-dddd-dddd-000000000003',
   'cccccccc-cccc-cccc-cccc-000000000003',
   'mobile_combustion',
   '{"kind":"mobile_combustion","fuel":"diesel"}'::jsonb,
   12400.0, 'L',
   '11111111-0001-0001-0001-000000000004', NULL,
   'validated', '2026-01-14 10:00:00+00'),

  -- TransAndes Q4-2025: gasoline fleet
  ('dddddddd-dddd-dddd-dddd-000000000004',
   'cccccccc-cccc-cccc-cccc-000000000003',
   'mobile_combustion',
   '{"kind":"mobile_combustion","fuel":"gasoline"}'::jsonb,
   3200.0, 'L',
   '11111111-0001-0001-0001-000000000005', NULL,
   'validated', '2026-01-14 10:00:00+00'),

  -- Aromas Q4-2025: LPG ovens + electricity
  ('dddddddd-dddd-dddd-dddd-000000000005',
   'cccccccc-cccc-cccc-cccc-000000000005',
   'stationary_combustion',
   '{"kind":"stationary_combustion","fuel":"lpg"}'::jsonb,
   920.0, 'L',
   '11111111-0001-0001-0001-000000000003', NULL,
   'validated', '2026-01-16 11:00:00+00'),

  ('dddddddd-dddd-dddd-dddd-000000000006',
   'cccccccc-cccc-cccc-cccc-000000000005',
   'purchased_electricity',
   '{"kind":"purchased_electricity","gridRegion":"SEIN_PERU"}'::jsonb,
   28700.0, 'kWh',
   NULL, '33333333-0003-0003-0003-000000000001',
   'validated', '2026-01-16 11:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Activity Entries — Q1-2026 (current periods — some submitted, one anomalous)
-- ---------------------------------------------------------------------------
INSERT INTO public.activity_entries
  (id, reporting_period_id, source_type, activity_kind, raw_quantity, raw_unit,
   fuel_type_id, grid_region_id, status, submitted_at, notes)
VALUES
  -- Lima Printing Q1-2026: diesel (NORMAL baseline ~850 L/quarter)
  ('dddddddd-dddd-dddd-dddd-000000000007',
   'cccccccc-cccc-cccc-cccc-000000000002',
   'stationary_combustion',
   '{"kind":"stationary_combustion","fuel":"diesel"}'::jsonb,
   4750.0, 'L',           -- *** ANOMALY: 5.6x the Q4-2025 baseline of 850 L ***
   '11111111-0001-0001-0001-000000000002', NULL,
   'submitted', '2026-04-05 14:30:00+00',
   'Reported by new procurement team. Unverified.'),

  -- Lima Printing Q1-2026: electricity (normal)
  ('dddddddd-dddd-dddd-dddd-000000000008',
   'cccccccc-cccc-cccc-cccc-000000000002',
   'purchased_electricity',
   '{"kind":"purchased_electricity","gridRegion":"SEIN_PERU"}'::jsonb,
   44100.0, 'kWh',
   NULL, '33333333-0003-0003-0003-000000000001',
   'submitted', '2026-04-05 14:30:00+00', NULL),

  -- TransAndes Q1-2026: diesel trucks (normal)
  ('dddddddd-dddd-dddd-dddd-000000000009',
   'cccccccc-cccc-cccc-cccc-000000000004',
   'mobile_combustion',
   '{"kind":"mobile_combustion","fuel":"diesel"}'::jsonb,
   11800.0, 'L',
   '11111111-0001-0001-0001-000000000004', NULL,
   'submitted', '2026-04-03 08:00:00+00', NULL),

  -- Aromas Q1-2026: LPG (normal)
  ('dddddddd-dddd-dddd-dddd-000000000010',
   'cccccccc-cccc-cccc-cccc-000000000006',
   'stationary_combustion',
   '{"kind":"stationary_combustion","fuel":"lpg"}'::jsonb,
   880.0, 'L',
   '11111111-0001-0001-0001-000000000003', NULL,
   'draft', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Emission Results — Q4-2025 baseline (pre-computed for locked periods)
-- co2e_kg = raw_quantity × emission_factor.co2e_per_unit (after unit normalization)
-- calc_hash = placeholder sha256 stubs (FP engine generates real hashes in Phase 2)
-- ---------------------------------------------------------------------------
INSERT INTO public.emission_results
  (id, activity_entry_id, reporting_period_id, scope, co2e_kg,
   factor_used, factor_unit, normalized_quantity, normalized_unit,
   calc_hash, calc_version, emission_factor_id, calculated_at)
VALUES
  -- Lima Printing Q4-2025 diesel: 850 L × 2.5139 = 2136.82 kg CO2e
  ('eeeeeeee-eeee-eeee-eeee-000000000001',
   'dddddddd-dddd-dddd-dddd-000000000001',
   'cccccccc-cccc-cccc-cccc-000000000001',
   1, 2136.815000,
   2.51390000, 'kg_co2e_per_L',
   850.0, 'L',
   'seed_hash_lp_q4_diesel_001',
   '0.0.0-seed',
   '44444444-0001-0001-0001-000000000002',
   '2026-01-20 00:00:00+00'),

  -- Lima Printing Q4-2025 electricity: 42500 kWh × 0.4517 = 19197.25 kg CO2e
  ('eeeeeeee-eeee-eeee-eeee-000000000002',
   'dddddddd-dddd-dddd-dddd-000000000002',
   'cccccccc-cccc-cccc-cccc-000000000001',
   2, 19197.250000,
   0.45170000, 'kg_co2e_per_kWh',
   42500.0, 'kWh',
   'seed_hash_lp_q4_elec_002',
   '0.0.0-seed',
   '44444444-0002-0001-0001-000000000001',
   '2026-01-20 00:00:00+00'),

  -- TransAndes Q4-2025 diesel: 12400 L × 2.5139 = 31172.36 kg CO2e
  ('eeeeeeee-eeee-eeee-eeee-000000000003',
   'dddddddd-dddd-dddd-dddd-000000000003',
   'cccccccc-cccc-cccc-cccc-000000000003',
   1, 31172.360000,
   2.51390000, 'kg_co2e_per_L',
   12400.0, 'L',
   'seed_hash_ta_q4_diesel_003',
   '0.0.0-seed',
   '44444444-0001-0002-0001-000000000001',
   '2026-01-20 00:00:00+00'),

  -- TransAndes Q4-2025 gasoline: 3200 L × 2.1685 = 6939.20 kg CO2e
  ('eeeeeeee-eeee-eeee-eeee-000000000004',
   'dddddddd-dddd-dddd-dddd-000000000004',
   'cccccccc-cccc-cccc-cccc-000000000003',
   1, 6939.200000,
   2.16850000, 'kg_co2e_per_L',
   3200.0, 'L',
   'seed_hash_ta_q4_gasoline_004',
   '0.0.0-seed',
   '44444444-0001-0002-0001-000000000002',
   '2026-01-20 00:00:00+00'),

  -- Aromas Q4-2025 LPG: 920 L × 1.5554 = 1430.97 kg CO2e
  ('eeeeeeee-eeee-eeee-eeee-000000000005',
   'dddddddd-dddd-dddd-dddd-000000000005',
   'cccccccc-cccc-cccc-cccc-000000000005',
   1, 1430.968000,
   1.55540000, 'kg_co2e_per_L',
   920.0, 'L',
   'seed_hash_ar_q4_lpg_005',
   '0.0.0-seed',
   '44444444-0001-0001-0001-000000000003',
   '2026-01-20 00:00:00+00'),

  -- Aromas Q4-2025 electricity: 28700 kWh × 0.4517 = 12963.79 kg CO2e
  ('eeeeeeee-eeee-eeee-eeee-000000000006',
   'dddddddd-dddd-dddd-dddd-000000000006',
   'cccccccc-cccc-cccc-cccc-000000000005',
   2, 12963.790000,
   0.45170000, 'kg_co2e_per_kWh',
   28700.0, 'kWh',
   'seed_hash_ar_q4_elec_006',
   '0.0.0-seed',
   '44444444-0002-0001-0001-000000000001',
   '2026-01-20 00:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Planted Anomaly Flag
-- Lima Printing Q1-2026: diesel 4750 L vs Q4-2025 baseline 850 L
-- z-score = (4750 - 850) / (850 * 0.1) = 3900 / 85 ≈ 45.9 (extreme outlier)
-- Simplified: z-score against cross-supplier mean signals obvious spike
-- ---------------------------------------------------------------------------
INSERT INTO public.anomaly_flags
  (id, activity_entry_id, detector, severity, z_score, threshold_used,
   message, is_resolved, flagged_at)
VALUES
  ('ffffffff-ffff-ffff-ffff-000000000001',
   'dddddddd-dddd-dddd-dddd-000000000007',
   'zscore_monthly',
   'high',
   45.88,
   3.00,
   'Diesel consumption of 4,750 L in Q1-2026 is 45.9σ above the Q4-2025 baseline of 850 L. '
   'Verify invoices — possible data entry error (gallons entered as litres) or undisclosed equipment change.',
   false,
   '2026-04-05 14:31:00+00')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Audit Log — seed events for locked periods
-- ---------------------------------------------------------------------------
INSERT INTO public.audit_log (id, action, table_name, record_id, new_values, performed_at)
VALUES
  ('99999999-aaaa-aaaa-aaaa-000000000001',
   'LOCK', 'reporting_periods',
   'cccccccc-cccc-cccc-cccc-000000000001',
   '{"status":"locked","label":"Q4-2025","supplier":"Lima Printing & Packaging SAC"}'::jsonb,
   '2026-02-10 16:00:00+00'),
  ('99999999-aaaa-aaaa-aaaa-000000000002',
   'LOCK', 'reporting_periods',
   'cccccccc-cccc-cccc-cccc-000000000003',
   '{"status":"locked","label":"Q4-2025","supplier":"Logística TransAndes"}'::jsonb,
   '2026-02-10 16:05:00+00'),
  ('99999999-aaaa-aaaa-aaaa-000000000003',
   'LOCK', 'reporting_periods',
   'cccccccc-cccc-cccc-cccc-000000000005',
   '{"status":"locked","label":"Q4-2025","supplier":"Aromas del Pacífico SAC"}'::jsonb,
   '2026-02-10 16:10:00+00')
ON CONFLICT (id) DO NOTHING;
