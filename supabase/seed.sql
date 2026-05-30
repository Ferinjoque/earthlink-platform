-- =============================================================================
-- Datos de seed
-- Datos de referencia: DEFRA 2024 + IPCC AR6 + MINEM 2023
-- Datos demo: 3 proveedores, 2 periodos de reporte cada uno, 1 anomalía plantada
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tipos de combustible
-- ---------------------------------------------------------------------------
INSERT INTO public.fuel_types (id, code, label, scope, activity_kind) VALUES
  ('11111111-0001-0001-0001-000000000001', 'natural_gas', 'Natural Gas',  1, 'stationary_combustion'),
  ('11111111-0001-0001-0001-000000000002', 'diesel',      'Diesel',       1, 'stationary_combustion'),
  ('11111111-0001-0001-0001-000000000003', 'lpg',         'LPG / Propane',1, 'stationary_combustion'),
  ('11111111-0001-0001-0001-000000000004', 'diesel',      'Diesel (Mobile)', 1, 'mobile_combustion'),
  ('11111111-0001-0001-0001-000000000005', 'gasoline',    'Gasoline',     1, 'mobile_combustion'),
  ('11111111-0001-0001-0001-000000000006', 'lpg',         'LPG (Mobile)', 1, 'mobile_combustion')
ON CONFLICT (id) DO NOTHING;

-- NOTA: código 'diesel' usado tanto para estacionario como móvil. La FK desde activity_entries
-- usa source_type para distinguir cuál fila de fuel_type aplica.
-- En producción, la restricción única es sobre (code, activity_kind) — gestionado por lógica FK.

-- ---------------------------------------------------------------------------
-- Refrigerantes — valores GWP-100 IPCC AR6
-- ---------------------------------------------------------------------------
INSERT INTO public.refrigerants (id, code, label, gwp_ar6) VALUES
  ('22222222-0002-0002-0002-000000000001', 'R410A', 'R-410A (HFC blend)', 2088.00),
  ('22222222-0002-0002-0002-000000000002', 'R134A', 'R-134a (HFC)',       1430.00),
  ('22222222-0002-0002-0002-000000000003', 'R32',   'R-32 (HFC)',          675.00)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Regiones de red eléctrica
-- ---------------------------------------------------------------------------
INSERT INTO public.grid_regions (id, code, label, country) VALUES
  ('33333333-0003-0003-0003-000000000001', 'SEIN_PERU',   'SEIN – Sistema Eléctrico Interconectado Nacional (Peru)', 'PE'),
  ('33333333-0003-0003-0003-000000000002', 'LATAM_AVG',   'Latin America Average Grid',                             'LATAM'),
  ('33333333-0003-0003-0003-000000000003', 'US_AVERAGE',  'US Average Grid (EPA eGRID 2023)',                       'US'),
  ('33333333-0003-0003-0003-000000000004', 'EU_AVERAGE',  'EU-27 Average Grid (IEA 2023)',                          'EU')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Factores de emisión
-- Fuentes: DEFRA 2024 (UK BEIS), MINEM 2023 (Perú), IPCC AR6
-- Unidad: kg CO2e por unidad normalizada
-- ---------------------------------------------------------------------------

-- Combustión estacionaria (Alcance 1) — DEFRA 2024
INSERT INTO public.emission_factors
  (id, source_type, fuel_type_id, co2e_per_unit, unit, scope, source_db, valid_from, valid_to)
VALUES
  -- Gas natural: 0.18316 kg CO2e / kWh (poder calorífico bruto, incluye CH4 + N2O)
  ('44444444-0001-0001-0001-000000000001',
   'stationary_combustion', '11111111-0001-0001-0001-000000000001',
   0.18316000, 'kWh', 1, 'DEFRA_2024', '2024-01-01', NULL),
  -- Diésel (estacionario): 2.51390000 kg CO2e / L
  ('44444444-0001-0001-0001-000000000002',
   'stationary_combustion', '11111111-0001-0001-0001-000000000002',
   2.51390000, 'L', 1, 'DEFRA_2024', '2024-01-01', NULL),
  -- GLP (estacionario): 1.55540000 kg CO2e / L
  ('44444444-0001-0001-0001-000000000003',
   'stationary_combustion', '11111111-0001-0001-0001-000000000003',
   1.55540000, 'L', 1, 'DEFRA_2024', '2024-01-01', NULL)
ON CONFLICT (id) DO NOTHING;

-- Combustión móvil (Alcance 1) — DEFRA 2024
INSERT INTO public.emission_factors
  (id, source_type, fuel_type_id, co2e_per_unit, unit, scope, source_db, valid_from, valid_to)
VALUES
  -- Diésel (móvil): 2.51390000 kg CO2e / L
  ('44444444-0001-0002-0001-000000000001',
   'mobile_combustion', '11111111-0001-0001-0001-000000000004',
   2.51390000, 'L', 1, 'DEFRA_2024', '2024-01-01', NULL),
  -- Gasolina: 2.16850000 kg CO2e / L
  ('44444444-0001-0002-0001-000000000002',
   'mobile_combustion', '11111111-0001-0001-0001-000000000005',
   2.16850000, 'L', 1, 'DEFRA_2024', '2024-01-01', NULL),
  -- GLP (móvil): 1.55540000 kg CO2e / L
  ('44444444-0001-0002-0001-000000000003',
   'mobile_combustion', '11111111-0001-0001-0001-000000000006',
   1.55540000, 'L', 1, 'DEFRA_2024', '2024-01-01', NULL)
ON CONFLICT (id) DO NOTHING;

-- Electricidad comprada (Alcance 2)
INSERT INTO public.emission_factors
  (id, source_type, grid_region_id, co2e_per_unit, unit, scope, source_db, valid_from, valid_to)
VALUES
  -- Perú SEIN: 0.4517 kg CO2e / kWh — MINEM 2023
  ('44444444-0002-0001-0001-000000000001',
   'purchased_electricity', '33333333-0003-0003-0003-000000000001',
   0.45170000, 'kWh', 2, 'MINEM_2023', '2023-01-01', NULL),
  -- Promedio LATAM: 0.2830 kg CO2e / kWh
  ('44444444-0002-0001-0001-000000000002',
   'purchased_electricity', '33333333-0003-0003-0003-000000000002',
   0.28300000, 'kWh', 2, 'DEFRA_2024', '2024-01-01', NULL),
  -- Promedio EE.UU.: 0.3861 kg CO2e / kWh — EPA eGRID 2023
  ('44444444-0002-0001-0001-000000000003',
   'purchased_electricity', '33333333-0003-0003-0003-000000000003',
   0.38610000, 'kWh', 2, 'DEFRA_2024', '2024-01-01', NULL),
  -- Promedio UE-27: 0.2330 kg CO2e / kWh — IEA 2023
  ('44444444-0002-0001-0001-000000000004',
   'purchased_electricity', '33333333-0003-0003-0003-000000000004',
   0.23300000, 'kWh', 2, 'DEFRA_2024', '2024-01-01', NULL)
ON CONFLICT (id) DO NOTHING;

-- Emisiones fugitivas (Alcance 1) — IPCC AR6 GWP-100
-- Factor = valor GWP-100; 1 kg de refrigerante fugado = GWP kg CO2e
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

-- Vapor comprado (Alcance 2) — promedio calefacción distrital DEFRA 2024
INSERT INTO public.emission_factors
  (id, source_type, co2e_per_unit, unit, scope, source_db, valid_from, valid_to)
VALUES
  ('44444444-0004-0001-0001-000000000001',
   'purchased_steam',
   0.18400000, 'kWh', 2, 'DEFRA_2024', '2024-01-01', NULL)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Conversiones de unidades
-- ---------------------------------------------------------------------------
INSERT INTO public.unit_conversions (from_unit, to_unit, factor, notes) VALUES
  -- Volumen
  ('gallon',      'L',    3.78541200, 'Galón líquido EE.UU. a litro'),
  ('gal',         'L',    3.78541200, 'Galón líquido EE.UU. (abrev.) a litro'),
  ('imp_gallon',  'L',    4.54609000, 'Galón imperial a litro'),
  -- Energía
  ('therms',      'kWh', 29.30710000, 'Therm de gas natural EE.UU. a kWh (1 therm = 100,000 BTU)'),
  ('therm',       'kWh', 29.30710000, 'Forma singular'),
  ('MMBtu',       'kWh', 293.07100000,'Millón de BTU a kWh'),
  ('MBtu',        'kWh',   0.29307100,'Mil BTU a kWh'),
  ('BTU',         'kWh',   0.00029307,'BTU a kWh'),
  ('MWh',         'kWh', 1000.0000000,'Megavatio-hora a kilovatio-hora'),
  ('GJ',          'kWh',  277.7778000,'Gigajulio a kWh'),
  ('MJ',          'kWh',    0.2777780,'Megajulio a kWh'),
  ('kJ',          'kWh',    0.0002778,'Kilojulio a kWh'),
  -- Volumen gas natural → energía
  ('m3_ng',       'kWh',  10.5500000, 'Metro cúbico de gas natural a kWh (poder calorífico bruto, DEFRA 2024)'),
  ('ft3_ng',      'kWh',   0.2988000, 'Pie cúbico de gas natural a kWh'),
  -- Masa
  ('tonne',       'kg',  1000.0000000,'Tonelada métrica a kilogramo'),
  ('lb',          'kg',     0.4535924,'Libra a kilogramo'),
  ('oz',          'kg',     0.0283495,'Onza a kilogramo'),
  -- Masa ↔ volumen GLP (densidad propano ~0.509 kg/L a 15°C)
  ('kg_lpg',      'L',      1.9646000,'Kilogramo de GLP (propano) a litro'),
  -- Identidad (conversiones nulas, útiles para validación de unidades)
  ('kWh',         'kWh',    1.0000000,'Identidad'),
  ('L',           'L',      1.0000000,'Identidad'),
  ('kg',          'kg',     1.0000000,'Identidad')
ON CONFLICT (from_unit, to_unit) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Organizaciones demo
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
-- Proveedores demo (3 por org = 6 total)
-- ---------------------------------------------------------------------------
INSERT INTO public.suppliers (id, organization_id, name, category, contact_email) VALUES
  -- Proveedores EcoGroup SAC
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
  -- Proveedores Andean Mining Corp
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
-- Periodos de reporte (2 por proveedor = 12 total)
-- Q4-2025 (línea base) y Q1-2026 (actual)
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
-- Entradas de actividad — Q4-2025 línea base (periodos bloqueados)
-- ---------------------------------------------------------------------------
INSERT INTO public.activity_entries
  (id, reporting_period_id, source_type, activity_kind, raw_quantity, raw_unit,
   fuel_type_id, grid_region_id, status, submitted_at)
VALUES
  -- Lima Printing Q4-2025: caldera diésel (estacionario) + electricidad
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

  -- TransAndes Q4-2025: camiones diésel (móvil)
  ('dddddddd-dddd-dddd-dddd-000000000003',
   'cccccccc-cccc-cccc-cccc-000000000003',
   'mobile_combustion',
   '{"kind":"mobile_combustion","fuel":"diesel"}'::jsonb,
   12400.0, 'L',
   '11111111-0001-0001-0001-000000000004', NULL,
   'validated', '2026-01-14 10:00:00+00'),

  -- TransAndes Q4-2025: flota gasolina
  ('dddddddd-dddd-dddd-dddd-000000000004',
   'cccccccc-cccc-cccc-cccc-000000000003',
   'mobile_combustion',
   '{"kind":"mobile_combustion","fuel":"gasoline"}'::jsonb,
   3200.0, 'L',
   '11111111-0001-0001-0001-000000000005', NULL,
   'validated', '2026-01-14 10:00:00+00'),

  -- Aromas Q4-2025: hornos GLP + electricidad
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
-- Entradas de actividad — Q1-2026 (periodos actuales — algunos enviados, uno anómalo)
-- ---------------------------------------------------------------------------
INSERT INTO public.activity_entries
  (id, reporting_period_id, source_type, activity_kind, raw_quantity, raw_unit,
   fuel_type_id, grid_region_id, status, submitted_at, notes)
VALUES
  -- Lima Printing Q1-2026: diésel (línea base NORMAL ~850 L/trimestre)
  ('dddddddd-dddd-dddd-dddd-000000000007',
   'cccccccc-cccc-cccc-cccc-000000000002',
   'stationary_combustion',
   '{"kind":"stationary_combustion","fuel":"diesel"}'::jsonb,
   4750.0, 'L',           -- *** ANOMALÍA: 5.6x la línea base Q4-2025 de 850 L ***
   '11111111-0001-0001-0001-000000000002', NULL,
   'submitted', '2026-04-05 14:30:00+00',
   'Reportado por nuevo equipo de compras. Sin verificar.'),

  -- Lima Printing Q1-2026: electricidad (normal)
  ('dddddddd-dddd-dddd-dddd-000000000008',
   'cccccccc-cccc-cccc-cccc-000000000002',
   'purchased_electricity',
   '{"kind":"purchased_electricity","gridRegion":"SEIN_PERU"}'::jsonb,
   44100.0, 'kWh',
   NULL, '33333333-0003-0003-0003-000000000001',
   'submitted', '2026-04-05 14:30:00+00', NULL),

  -- TransAndes Q1-2026: camiones diésel (normal)
  ('dddddddd-dddd-dddd-dddd-000000000009',
   'cccccccc-cccc-cccc-cccc-000000000004',
   'mobile_combustion',
   '{"kind":"mobile_combustion","fuel":"diesel"}'::jsonb,
   11800.0, 'L',
   '11111111-0001-0001-0001-000000000004', NULL,
   'submitted', '2026-04-03 08:00:00+00', NULL),

  -- Aromas Q1-2026: GLP (normal)
  ('dddddddd-dddd-dddd-dddd-000000000010',
   'cccccccc-cccc-cccc-cccc-000000000006',
   'stationary_combustion',
   '{"kind":"stationary_combustion","fuel":"lpg"}'::jsonb,
   880.0, 'L',
   '11111111-0001-0001-0001-000000000003', NULL,
   'draft', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Resultados de emisión — Q4-2025 línea base (pre-calculados para periodos bloqueados)
-- co2e_kg = raw_quantity × emission_factor.co2e_per_unit (tras normalización de unidad)
-- calc_hash = stubs sha256 de referencia (el motor FP genera hashes reales en producción)
-- ---------------------------------------------------------------------------
INSERT INTO public.emission_results
  (id, activity_entry_id, reporting_period_id, scope, co2e_kg,
   factor_used, factor_unit, normalized_quantity, normalized_unit,
   calc_hash, calc_version, emission_factor_id, calculated_at)
VALUES
  -- Lima Printing Q4-2025 diésel: 850 L × 2.5139 = 2136.82 kg CO2e
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

  -- Lima Printing Q4-2025 electricidad: 42500 kWh × 0.4517 = 19197.25 kg CO2e
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

  -- TransAndes Q4-2025 diésel: 12400 L × 2.5139 = 31172.36 kg CO2e
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

  -- TransAndes Q4-2025 gasolina: 3200 L × 2.1685 = 6939.20 kg CO2e
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

  -- Aromas Q4-2025 GLP: 920 L × 1.5554 = 1430.97 kg CO2e
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

  -- Aromas Q4-2025 electricidad: 28700 kWh × 0.4517 = 12963.79 kg CO2e
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
-- Anomalía plantada
-- Lima Printing Q1-2026: diésel 4750 L vs línea base Q4-2025 de 850 L
-- z-score = (4750 - 850) / (850 * 0.1) = 3900 / 85 ≈ 45.9 (valor extremo atípico)
-- Simplificado: el z-score contra la media entre proveedores señala pico evidente
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
   'Consumo de diésel de 4,750 L en Q1-2026 es 45.9σ sobre la línea base Q4-2025 de 850 L. '
   'Verificar facturas — posible error de ingreso (galones introducidos como litros) o cambio de equipo no declarado.',
   false,
   '2026-04-05 14:31:00+00')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Registro de auditoría — eventos seed para periodos bloqueados
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
