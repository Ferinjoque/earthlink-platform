/**
 * Demo seed script — generates realistic multi-year GHG data for demos.
 *
 * Usage:
 *   npx tsx scripts/seed-demo.ts           # reset + seed
 *   npx tsx scripts/seed-demo.ts --reset   # clear only
 *   npx tsx scripts/seed-demo.ts --seed    # insert only (requires empty tables)
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL      (in .env.local)
 *   SUPABASE_SERVICE_ROLE_KEY     (from Supabase Dashboard → Settings → API)
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

// Load .env.local manually (dotenv not required)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (key && !process.env[key]) process.env[key] = val;
  }
}

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'];
const SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌  Missing env vars.');
  console.error('   NEXT_PUBLIC_SUPABASE_URL → in .env.local');
  console.error('   SUPABASE_SERVICE_ROLE_KEY → Supabase Dashboard → Settings → API → service_role');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function calcHash(entryId: string, suffix = 'v1'): string {
  return crypto.createHash('sha256').update(`${entryId}_${suffix}`).digest('hex').slice(0, 40);
}

// Seeded pseudo-random: deterministic variation per month
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function vary(base: number, seed: number, pct = 0.18): number {
  return Math.round(base * (1 + (seededRandom(seed) - 0.5) * 2 * pct));
}

function monthLabel(year: number, month: number): string {
  const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${MESES[month - 1] ?? 'Ene'}-${year}`;
}

function startDate(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function endDate(year: number, month: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
}

async function batchInsert<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
  chunkSize = 50,
): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { data, error } = await supabase.from(table).insert(chunk).select('id');
    if (error) throw new Error(`Insert into ${table} failed: ${error.message}`);
    ids.push(...(data ?? []).map((r: Record<string, unknown>) => r['id'] as string));
  }
  return ids;
}

// ── Source type configs ────────────────────────────────────────────────────────

interface SourceConfig {
  source_type: string;
  activity_kind: Record<string, unknown>;
  scope: 1 | 2;
  baseQty: number;
  unit: string;
  factorKg: number; // kg CO2e per unit
}

const SOURCES: Record<string, SourceConfig> = {
  electricity: {
    source_type: 'purchased_electricity',
    activity_kind: { kind: 'purchased_electricity', region: 'peru_main_grid' },
    scope: 2,
    baseQty: 50_000,
    unit: 'kWh',
    factorKg: 0.617,
  },
  diesel_stationary: {
    source_type: 'stationary_combustion',
    activity_kind: { kind: 'stationary_combustion', fuel: 'diesel' },
    scope: 1,
    baseQty: 5_000,
    unit: 'L',
    factorKg: 2.68,
  },
  diesel_mobile: {
    source_type: 'mobile_combustion',
    activity_kind: { kind: 'mobile_combustion', fuel: 'diesel' },
    scope: 1,
    baseQty: 10_000,
    unit: 'L',
    factorKg: 2.68,
  },
  refrigerant: {
    source_type: 'fugitive',
    activity_kind: { kind: 'fugitive', refrigerant: 'r22' },
    scope: 1,
    baseQty: 3,
    unit: 'kg',
    factorKg: 1760,
  },
  steam: {
    source_type: 'purchased_steam',
    activity_kind: { kind: 'purchased_steam' },
    scope: 2,
    baseQty: 8_000,
    unit: 'kWh',
    factorKg: 0.3,
  },
  water: {
    source_type: 'water_use',
    activity_kind: { kind: 'water_use', subtype: 'municipal' },
    scope: 2, // no CO2e
    baseQty: 5_000,
    unit: 'm3',
    factorKg: 0,
  },
  waste: {
    source_type: 'waste',
    activity_kind: { kind: 'waste', subtype: 'general' },
    scope: 1, // no CO2e
    baseQty: 12,
    unit: 'ton',
    factorKg: 0,
  },
};

// ── Supplier definitions ───────────────────────────────────────────────────────

type PeriodPattern = {
  year: number;
  months: number[];
  status: 'locked' | 'under_review' | 'open';
};

interface SupplierDef {
  name: string;
  category: string;
  contact_email: string;
  orgKey: 'eco' | 'mining';
  sources: (keyof typeof SOURCES)[];
  baseMultiplier: number; // scale factor for quantities
  periodPatterns: PeriodPattern[];
  anomalyMonths?: Array<{ year: number; month: number; sourceKey: string; multiplier: number; zScore: number; severity: 'low' | 'medium' | 'high' }>;
  voidedMonths?: Array<{ year: number; month: number; sourceKey: string }>;
}

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const JAN_SEP = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const JAN_JUN = [1, 2, 3, 4, 5, 6];
const OCT_DEC = [10, 11, 12];
const JUL_SEP = [7, 8, 9];

const SUPPLIER_DEFS: SupplierDef[] = [
  // ── EcoGroup SAC ────────────────────────────────────────────────────────
  {
    name: 'Lima Printing Co.',
    category: 'Manufactura',
    contact_email: 'ops@limaprinting.pe',
    orgKey: 'eco',
    sources: ['diesel_stationary', 'electricity', 'waste'],
    baseMultiplier: 1.0,
    periodPatterns: [
      { year: 2023, months: ALL_MONTHS, status: 'locked' },
      { year: 2024, months: [1,2,3,4,5,6,7,8,10,11,12], status: 'locked' }, // Sep 2024 missing
      { year: 2025, months: JAN_JUN, status: 'locked' },
      { year: 2025, months: JUL_SEP, status: 'under_review' },
      { year: 2025, months: OCT_DEC, status: 'open' },
      { year: 2026, months: [1], status: 'under_review' },
    ],
    anomalyMonths: [
      { year: 2024, month: 3, sourceKey: 'electricity', multiplier: 3.2, zScore: 3.8, severity: 'medium' },
    ],
    voidedMonths: [
      { year: 2025, month: 2, sourceKey: 'waste' }, // incorrect waste data, voided
    ],
  },
  {
    name: 'Andean Transport S.A.',
    category: 'Logística',
    contact_email: 'flota@andean-transport.pe',
    orgKey: 'eco',
    sources: ['diesel_mobile', 'electricity'],
    baseMultiplier: 8.0,
    periodPatterns: [
      { year: 2023, months: ALL_MONTHS, status: 'locked' },
      { year: 2024, months: ALL_MONTHS, status: 'locked' },
      { year: 2025, months: JAN_JUN, status: 'locked' },
      { year: 2025, months: JUL_SEP, status: 'under_review' },
      { year: 2025, months: OCT_DEC, status: 'open' },
      { year: 2026, months: [1, 2], status: 'open' },
    ],
    anomalyMonths: [
      { year: 2025, month: 7, sourceKey: 'diesel_mobile', multiplier: 2.7, zScore: 2.9, severity: 'medium' },
    ],
  },
  {
    name: 'Pacific Steel Corp',
    category: 'Industria pesada',
    contact_email: 'esg@pacific-steel.pe',
    orgKey: 'eco',
    sources: ['diesel_stationary', 'electricity', 'refrigerant'],
    baseMultiplier: 12.0,
    periodPatterns: [
      { year: 2023, months: ALL_MONTHS, status: 'locked' },
      { year: 2024, months: [1,2,4,5,6,7,8,9,10,11,12], status: 'locked' }, // Mar missing (maint. shutdown)
      { year: 2025, months: JAN_JUN, status: 'locked' },
      { year: 2025, months: JUL_SEP, status: 'under_review' },
      { year: 2025, months: [10, 11], status: 'open' }, // Dec 2025 missing
      { year: 2026, months: [1], status: 'open' },
    ],
    anomalyMonths: [
      { year: 2024, month: 5, sourceKey: 'refrigerant', multiplier: 5.5, zScore: 8.5, severity: 'high' },
      { year: 2025, month: 9, sourceKey: 'electricity', multiplier: 2.1, zScore: 2.3, severity: 'low' },
    ],
    voidedMonths: [
      { year: 2024, month: 5, sourceKey: 'refrigerant' }, // the anomaly entry was voided after review
    ],
  },
  // ── Andean Mining Corp ───────────────────────────────────────────────────
  {
    name: 'Northern Copper Mine',
    category: 'Minería',
    contact_email: 'environment@northcopper.pe',
    orgKey: 'mining',
    sources: ['diesel_stationary', 'diesel_mobile', 'electricity', 'refrigerant'],
    baseMultiplier: 25.0,
    periodPatterns: [
      { year: 2023, months: ALL_MONTHS, status: 'locked' },
      { year: 2024, months: ALL_MONTHS, status: 'locked' },
      { year: 2025, months: JAN_JUN, status: 'locked' },
      { year: 2025, months: JUL_SEP, status: 'under_review' },
      { year: 2025, months: OCT_DEC, status: 'open' },
      { year: 2026, months: [1, 2], status: 'open' },
    ],
    anomalyMonths: [
      { year: 2024, month: 8, sourceKey: 'diesel_mobile', multiplier: 4.1, zScore: 6.2, severity: 'high' },
      { year: 2023, month: 11, sourceKey: 'refrigerant', multiplier: 3.0, zScore: 3.4, severity: 'medium' },
    ],
  },
  {
    name: 'Coastal Energy S.A.',
    category: 'Energía',
    contact_email: 'sostenibilidad@coastal-energy.pe',
    orgKey: 'mining',
    sources: ['diesel_stationary', 'electricity', 'steam'],
    baseMultiplier: 20.0,
    periodPatterns: [
      { year: 2023, months: ALL_MONTHS, status: 'locked' },
      { year: 2024, months: ALL_MONTHS, status: 'locked' },
      { year: 2025, months: JAN_JUN, status: 'locked' },
      { year: 2025, months: JUL_SEP, status: 'under_review' },
      { year: 2025, months: OCT_DEC, status: 'open' },
      { year: 2026, months: [1], status: 'open' },
    ],
    anomalyMonths: [
      { year: 2023, month: 7, sourceKey: 'steam', multiplier: 2.8, zScore: 2.6, severity: 'medium' },
    ],
  },
  {
    name: 'Highland Agriculture Corp',
    category: 'Agricultura',
    contact_email: 'ambiental@highland-agro.pe',
    orgKey: 'mining',
    sources: ['diesel_mobile', 'diesel_stationary', 'water', 'waste'],
    baseMultiplier: 1.5,
    periodPatterns: [
      { year: 2023, months: ALL_MONTHS, status: 'locked' },
      { year: 2024, months: ALL_MONTHS, status: 'locked' },
      { year: 2025, months: JAN_JUN, status: 'locked' },
      { year: 2025, months: JUL_SEP, status: 'under_review' },
      { year: 2025, months: [10, 12], status: 'open' }, // Nov 2025 missing (seasonal shutdown)
      { year: 2026, months: [1], status: 'open' },
    ],
  },
  {
    name: 'Southern Logistics Ltd.',
    category: 'Logística',
    contact_email: 'esg@southern-logistics.pe',
    orgKey: 'mining',
    sources: ['diesel_mobile', 'electricity'],
    baseMultiplier: 6.0,
    periodPatterns: [
      { year: 2023, months: ALL_MONTHS, status: 'locked' },
      { year: 2024, months: ALL_MONTHS, status: 'locked' },
      { year: 2025, months: JAN_JUN, status: 'locked' },
      { year: 2025, months: JUL_SEP, status: 'under_review' },
      { year: 2025, months: OCT_DEC, status: 'open' },
      { year: 2026, months: [1, 2], status: 'open' },
    ],
    anomalyMonths: [
      { year: 2024, month: 12, sourceKey: 'diesel_mobile', multiplier: 2.2, zScore: 2.1, severity: 'low' },
    ],
  },
];

const DEMO_EMAIL = 'admin@earthlink.test';
const DEMO_PASSWORD = 'Earthlink2025!';
const ORG_ECO    = 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001';
const ORG_MINING = 'aaaaaaaa-aaaa-aaaa-aaaa-000000000002';

// ── Ensure demo user + memberships exist ───────────────────────────────────────

async function ensureDemoUser(): Promise<string> {
  // List users and find by email
  const { data: listData, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) throw new Error(`listUsers failed: ${listErr.message}`);

  const existing = listData.users.find((u) => u.email === DEMO_EMAIL);
  if (existing) {
    process.stdout.write(`✓  Demo user exists (${existing.id.slice(0, 8)}…)\n`);
    return existing.id;
  }

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });
  if (createErr ?? !created.user) throw new Error(`createUser failed: ${createErr?.message}`);
  process.stdout.write(`✓  Demo user created (${created.user.id.slice(0, 8)}…)\n`);
  return created.user.id;
}

async function ensureMemberships(userId: string): Promise<void> {
  const { error } = await supabase.from('memberships').upsert(
    [
      { user_id: userId, organization_id: ORG_ECO,    supplier_id: null, role: 'admin' },
      { user_id: userId, organization_id: ORG_MINING, supplier_id: null, role: 'admin' },
    ],
    { onConflict: 'user_id,organization_id' },
  );
  if (error) throw new Error(`upsert memberships failed: ${error.message}`);
  process.stdout.write('✓  Admin memberships confirmed\n');
}

// ── Reset ──────────────────────────────────────────────────────────────────────

async function reset(): Promise<void> {
  process.stdout.write('🗑  Resetting demo data… ');
  const { error } = await supabase.rpc('fn_demo_reset');
  if (error) throw new Error(`fn_demo_reset failed: ${error.message}`);
  console.log('done.');
}

// ── Seed ──────────────────────────────────────────────────────────────────────

async function seed(): Promise<void> {
  // 1. Fetch organization IDs
  const { data: orgs, error: orgErr } = await supabase
    .from('organizations')
    .select('id, name');
  if (orgErr ?? !orgs?.length) throw new Error('No organizations found. Run migrations first.');

  const orgMap: Record<string, string> = {};
  for (const org of orgs) {
    if ((org.name as string).toLowerCase().includes('ecogroup')) orgMap['eco'] = org.id as string;
    if ((org.name as string).toLowerCase().includes('andean mining')) orgMap['mining'] = org.id as string;
  }
  if (!orgMap['eco'] || !orgMap['mining']) {
    throw new Error('Could not find EcoGroup SAC or Andean Mining Corp organizations.');
  }
  console.log(`✓  Orgs: eco=${orgMap['eco']?.slice(0, 8)}… mining=${orgMap['mining']?.slice(0, 8)}…`);

  // 2. Create suppliers
  const supplierRows = SUPPLIER_DEFS.map((def) => ({
    organization_id: orgMap[def.orgKey],
    name: def.name,
    category: def.category,
    contact_email: def.contact_email,
  }));
  const supplierIds = await batchInsert('suppliers', supplierRows);
  console.log(`✓  Created ${supplierIds.length} suppliers`);

  // 3. Create periods + entries + results per supplier
  let totalPeriods = 0;
  let totalEntries = 0;
  let totalResults = 0;
  let totalAnomalies = 0;

  for (let si = 0; si < SUPPLIER_DEFS.length; si++) {
    const def = SUPPLIER_DEFS[si]!;
    const supplierId = supplierIds[si]!;

    // Expand period patterns into flat list
    const periodsList: Array<{ year: number; month: number; status: PeriodPattern['status'] }> = [];
    for (const pat of def.periodPatterns) {
      for (const month of pat.months) {
        periodsList.push({ year: pat.year, month, status: pat.status });
      }
    }

    // Insert periods
    const periodRows = periodsList.map(({ year, month, status }) => ({
      supplier_id: supplierId,
      label: monthLabel(year, month),
      start_date: startDate(year, month),
      end_date: endDate(year, month),
      status,
    }));
    const periodIds = await batchInsert('reporting_periods', periodRows);
    totalPeriods += periodIds.length;

    // Build lookup: "year_month" → periodId
    const periodIdMap = new Map<string, string>();
    periodsList.forEach(({ year, month }, idx) => {
      periodIdMap.set(`${year}_${month}`, periodIds[idx]!);
    });

    // Identify anomaly periods and voided entries
    const anomalySet = new Map<string, typeof def.anomalyMonths & {}>();
    for (const a of def.anomalyMonths ?? []) {
      const key = `${a.year}_${a.month}_${a.sourceKey}`;
      const existing = anomalySet.get(key) ?? [];
      anomalySet.set(key, [...existing, a]);
    }
    const voidedSet = new Set<string>();
    for (const v of def.voidedMonths ?? []) {
      voidedSet.add(`${v.year}_${v.month}_${v.sourceKey}`);
    }

    // Insert entries per period
    for (let pi = 0; pi < periodsList.length; pi++) {
      const { year, month, status } = periodsList[pi]!;
      const periodId = periodIds[pi]!;

      const entrySeed = si * 1000 + year * 100 + month;

      const entryRows: Array<Record<string, unknown>> = [];
      for (const sourceKey of def.sources) {
        const src = SOURCES[sourceKey]!;
        const isAnomaly = (def.anomalyMonths ?? []).some(
          (a) => a.year === year && a.month === month && a.sourceKey === sourceKey,
        );
        const anomalyDef = (def.anomalyMonths ?? []).find(
          (a) => a.year === year && a.month === month && a.sourceKey === sourceKey,
        );
        const isVoided = voidedSet.has(`${year}_${month}_${sourceKey}`);

        const baseQty = Math.round(src.baseQty * def.baseMultiplier);
        const rawQty = isAnomaly && anomalyDef
          ? Math.round(baseQty * anomalyDef.multiplier)
          : vary(baseQty, entrySeed + def.sources.indexOf(sourceKey), 0.2);

        const submittedAt = new Date(year, month - 1, 15).toISOString();

        entryRows.push({
          reporting_period_id: periodId,
          source_type: src.source_type,
          activity_kind: src.activity_kind,
          raw_quantity: rawQty,
          raw_unit: src.unit,
          status: 'submitted',
          submitted_at: submittedAt,
          voided_at: isVoided ? new Date(year, month, 5).toISOString() : null,
          void_reason: isVoided ? 'Dato incorrecto detectado en revisión' : null,
          notes: null,
        });
      }

      const entryIds = await batchInsert('activity_entries', entryRows);
      totalEntries += entryIds.length;

      // Insert emission results for non-open periods (excluding voided entries + water/waste)
      if (status !== 'open') {
        const resultRows: Array<Record<string, unknown>> = [];
        for (let ei = 0; ei < def.sources.length; ei++) {
          const sourceKey = def.sources[ei]!;
          const src = SOURCES[sourceKey]!;
          const entryId = entryIds[ei]!;
          const isVoided = voidedSet.has(`${year}_${month}_${sourceKey}`);

          // Water and waste have no CO2e — not inserted to emission_results
          if (src.factorKg === 0) continue;
          // Voided entries excluded
          if (isVoided) continue;

          const qty = (entryRows[ei]!['raw_quantity'] as number);
          const co2eKg = Math.round(qty * src.factorKg * 100) / 100;
          const calculatedAt = new Date(year, month - 1, 25).toISOString();

          resultRows.push({
            activity_entry_id: entryId,
            reporting_period_id: periodId,
            scope: src.scope,
            co2e_kg: co2eKg,
            factor_used: src.factorKg,
            factor_unit: `kgCO2e/${src.unit}`,
            normalized_quantity: qty,
            normalized_unit: src.unit,
            calc_hash: calcHash(entryId),
            calc_version: '1.0.0',
            calculated_at: calculatedAt,
          });
        }
        if (resultRows.length > 0) {
          await batchInsert('emission_results', resultRows);
          totalResults += resultRows.length;
        }
      }

      // Insert anomaly flags
      for (const anomDef of def.anomalyMonths ?? []) {
        if (anomDef.year !== year || anomDef.month !== month) continue;
        const srcIdx = def.sources.indexOf(anomDef.sourceKey);
        if (srcIdx === -1) continue;
        const entryId = entryIds[srcIdx]!;

        await supabase.from('anomaly_flags').insert({
          activity_entry_id: entryId,
          severity: anomDef.severity,
          z_score: anomDef.zScore,
          message: `Valor ${anomDef.multiplier.toFixed(1)}x por encima de la media histórica`,
          flagged_at: new Date(year, month - 1, 20).toISOString(),
          is_resolved: false,
        });
        totalAnomalies++;
      }
    }

    process.stdout.write(`  ✓  ${def.name}: ${periodIds.length} periodos\n`);
  }

  console.log(`\n✅  Seed complete:`);
  console.log(`   ${totalPeriods} periodos`);
  console.log(`   ${totalEntries} registros de actividad`);
  console.log(`   ${totalResults} resultados de emisiones`);
  console.log(`   ${totalAnomalies} anomalías`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const doReset = args.includes('--reset') || args.length === 0;
const doSeed = args.includes('--seed') || args.length === 0;

(async () => {
  try {
    if (doReset) await reset();
    // Always ensure the demo user + memberships exist (reset wipes supplier-role
    // memberships but preserves admin ones; this also handles a fresh environment)
    const userId = await ensureDemoUser();
    await ensureMemberships(userId);
    if (doSeed) await seed();
  } catch (err) {
    console.error('❌ ', err instanceof Error ? err.message : err);
    process.exit(1);
  }
})();
