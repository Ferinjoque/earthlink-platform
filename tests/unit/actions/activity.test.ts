import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ActivityFormState, CsvImportState } from '../../../src/actions/activity';

// ── Refs de mocks hoisted ─────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  save: vi.fn().mockResolvedValue(undefined),
  findByPeriodId: vi.fn().mockResolvedValue([]),
  findByPeriodIds: vi.fn().mockResolvedValue([]),
  anomalySave: vi.fn().mockResolvedValue(undefined),
  detect: vi.fn().mockReturnValue([]),
}));

// ── Mocks de módulos server-only ──────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/headers', () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      getAll: vi.fn(() => []),
      set: vi.fn(),
    }),
  ),
}));
vi.mock('../../../src/services/supabase/server', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('../../../src/repos/ActivityEntryRepository', () => ({
  ActivityEntryRepository: class {
    save = mocks.save;
    findByPeriodId = mocks.findByPeriodId;
    findByPeriodIds = mocks.findByPeriodIds;
  },
}));
vi.mock('../../../src/repos/AnomalyFlagRepository', () => ({
  AnomalyFlagRepository: class {
    save = mocks.anomalySave;
  },
}));
vi.mock('../../../src/services/AnomalyService', () => ({
  AnomalyService: class {
    static Z_THRESHOLD_LOW = 2.0;
    detect = mocks.detect;
  },
}));

import { createServerClient } from '../../../src/services/supabase/server';
import {
  createActivityEntry,
  importActivityCsv,
  importActivityBulk,
  voidActivityEntry,
  deleteActivityEntry,
} from '../../../src/actions/activity';

type MockClient = Awaited<ReturnType<typeof createServerClient>>;

// ── Funciones auxiliares ──────────────────────────────────────────────────────

const VALID_UUID = '00000000-0000-4000-8000-000000000001';
const VALID_YM = '2026-01';
const PERIOD_ID = '00000000-0000-4000-8000-000000000002';

/** Chain for: .select(...).eq(...).maybeSingle() */
function makeMaybeSingleChain(data: unknown) {
  const p = Promise.resolve({ data });
  const c: Record<string, unknown> = {};
  c['select'] = () => c;
  c['eq'] = () => c;
  c['maybeSingle'] = () => p;
  return c;
}

/** Chain for: .insert({}).select('id').single() */
function makeInsertChain(data: unknown, error: unknown = null) {
  const p = Promise.resolve({ data, error });
  const c: Record<string, unknown> = {};
  c['insert'] = () => c;
  c['select'] = () => c;
  c['single'] = () => p;
  return c;
}

/** Chain for: .select(...).eq(...).gte(...).lte(...) — awaited directly (no terminal method) */
function makeArrayChain(data: unknown) {
  const p = Promise.resolve({ data, error: null });
  const c: Record<string, unknown> = {};
  c['select'] = () => c;
  c['eq'] = () => c;
  c['gte'] = () => c;
  c['lte'] = () => c;
  c['then'] = p.then.bind(p);
  c['catch'] = p.catch.bind(p);
  return c;
}

/** Chain for: .insert([...]) — awaited directly (batch insert) */
function makeBatchInsertChain(error: unknown = null) {
  const c: Record<string, unknown> = {};
  c['insert'] = () => Promise.resolve({ error });
  return c;
}

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

/**
 * Happy-path mock for createActivityEntry:
 *   from(1) suppliers → org found
 *   from(2) memberships → access ok
 *   from(3) reporting_periods maybeSingle → null (no existing period)
 *   from(4) reporting_periods insert → new period created
 *   from(5) reporting_periods select → prior-year period IDs for anomaly baseline
 */
function mockAuthenticatedClient(userId = 'user-abc') {
  const mockSupabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }) },
    from: vi.fn()
      .mockReturnValueOnce(makeMaybeSingleChain({ organization_id: 'org-001' }))
      .mockReturnValueOnce(makeMaybeSingleChain({ role: 'admin' }))
      .mockReturnValueOnce(makeMaybeSingleChain(null))
      .mockReturnValueOnce(makeInsertChain({ id: PERIOD_ID }))
      .mockReturnValueOnce(makeArrayChain([{ id: PERIOD_ID }])),
  };
  vi.mocked(createServerClient).mockResolvedValue(mockSupabase as unknown as MockClient);
  return mockSupabase;
}

function mockUnauthenticatedClient() {
  const mockSupabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from: vi.fn(),
  };
  vi.mocked(createServerClient).mockResolvedValue(mockSupabase as unknown as MockClient);
}

// ── createActivityEntry ───────────────────────────────────────────────────────

describe('createActivityEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when not authenticated', async () => {
    mockUnauthenticatedClient();
    const fd = makeFormData({
      supplier_id: VALID_UUID,
      year_month: VALID_YM,
      source_type: 'stationary_combustion',
      secondary: 'diesel',
      raw_quantity: '100',
      raw_unit: 'L',
    });
    const result: ActivityFormState = await createActivityEntry(null, fd);
    expect(result.error).toMatch(/autenticado/i);
  });

  it('returns fieldErrors for missing required fields', async () => {
    mockAuthenticatedClient();
    const fd = makeFormData({ source_type: 'stationary_combustion' });
    const result = await createActivityEntry(null, fd);
    expect(result.fieldErrors).toBeDefined();
  });

  it('returns error when supplier is archived', async () => {
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc' } } }) },
      from: vi.fn().mockReturnValueOnce(
        makeMaybeSingleChain({ organization_id: 'org-001', archived_at: '2026-01-01T00:00:00Z' }),
      ),
    };
    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as unknown as MockClient);
    const fd = makeFormData({
      supplier_id: VALID_UUID,
      year_month: VALID_YM,
      source_type: 'stationary_combustion',
      secondary: 'natural_gas',
      raw_quantity: '100',
      raw_unit: 'm3_ng',
    });
    const result = await createActivityEntry(null, fd);
    expect(result.error).toMatch(/archivado/i);
  });

  it('returns fieldErrors when quantity is negative', async () => {
    mockAuthenticatedClient();
    const fd = makeFormData({
      supplier_id: VALID_UUID,
      year_month: VALID_YM,
      source_type: 'stationary_combustion',
      secondary: 'diesel',
      raw_quantity: '-5',
      raw_unit: 'L',
    });
    const result = await createActivityEntry(null, fd);
    expect(result.fieldErrors?.raw_quantity).toBeDefined();
  });

  it('accepts zero quantity (nonnegative — ESG period with no consumption)', async () => {
    mockAuthenticatedClient();
    const fd = makeFormData({
      supplier_id: VALID_UUID,
      year_month: VALID_YM,
      source_type: 'stationary_combustion',
      secondary: 'natural_gas',
      raw_quantity: '0',
      raw_unit: 'm3_ng',
    });
    const result = await createActivityEntry(null, fd);
    expect(result.fieldErrors?.raw_quantity).toBeUndefined();
  });

  it('returns error for invalid secondary with combustion source', async () => {
    mockAuthenticatedClient();
    const fd = makeFormData({
      supplier_id: VALID_UUID,
      year_month: VALID_YM,
      source_type: 'stationary_combustion',
      secondary: 'hydrogen',
      raw_quantity: '100',
      raw_unit: 'L',
    });
    const result = await createActivityEntry(null, fd);
    expect(result.error).toBeDefined();
  });

  it('returns success for valid stationary_combustion entry', async () => {
    mockAuthenticatedClient();
    const fd = makeFormData({
      supplier_id: VALID_UUID,
      year_month: VALID_YM,
      source_type: 'stationary_combustion',
      secondary: 'natural_gas',
      raw_quantity: '1000',
      raw_unit: 'm3_ng',
      notes: 'Boiler A',
    });
    const result = await createActivityEntry(null, fd);
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns success for purchased_electricity entry', async () => {
    mockAuthenticatedClient();
    const fd = makeFormData({
      supplier_id: VALID_UUID,
      year_month: VALID_YM,
      source_type: 'purchased_electricity',
      secondary: 'SEIN_PERU',
      raw_quantity: '5000',
      raw_unit: 'kWh',
    });
    const result = await createActivityEntry(null, fd);
    expect(result.success).toBe(true);
  });

  it('returns success for purchased_steam (no secondary)', async () => {
    mockAuthenticatedClient();
    const fd = makeFormData({
      supplier_id: VALID_UUID,
      year_month: VALID_YM,
      source_type: 'purchased_steam',
      secondary: '',
      raw_quantity: '200',
      raw_unit: 'kWh',
    });
    const result = await createActivityEntry(null, fd);
    expect(result.success).toBe(true);
  });

  it('returns success for fugitive entry', async () => {
    mockAuthenticatedClient();
    const fd = makeFormData({
      supplier_id: VALID_UUID,
      year_month: VALID_YM,
      source_type: 'fugitive',
      secondary: 'R410A',
      raw_quantity: '5',
      raw_unit: 'kg',
    });
    const result = await createActivityEntry(null, fd);
    expect(result.success).toBe(true);
  });

  it('returns success when period already exists (open)', async () => {
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc' } } }) },
      from: vi.fn()
        .mockReturnValueOnce(makeMaybySingleChain({ organization_id: 'org-001' }))
        .mockReturnValueOnce(makeMaybySingleChain({ role: 'admin' }))
        .mockReturnValueOnce(makeMaybySingleChain({ id: PERIOD_ID, status: 'open' })),
    };
    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as unknown as MockClient);
    const fd = makeFormData({
      supplier_id: VALID_UUID,
      year_month: VALID_YM,
      source_type: 'stationary_combustion',
      secondary: 'natural_gas',
      raw_quantity: '1000',
      raw_unit: 'm3_ng',
    });
    const result = await createActivityEntry(null, fd);
    expect(result.success).toBe(true);
  });

  it('returns error when period is locked', async () => {
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc' } } }) },
      from: vi.fn()
        .mockReturnValueOnce(makeMaybySingleChain({ organization_id: 'org-001' }))
        .mockReturnValueOnce(makeMaybySingleChain({ role: 'admin' }))
        .mockReturnValueOnce(makeMaybySingleChain({ id: PERIOD_ID, status: 'locked' })),
    };
    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as unknown as MockClient);
    const fd = makeFormData({
      supplier_id: VALID_UUID,
      year_month: VALID_YM,
      source_type: 'stationary_combustion',
      secondary: 'diesel',
      raw_quantity: '100',
      raw_unit: 'L',
    });
    const result = await createActivityEntry(null, fd);
    expect(result.error).toMatch(/bloqueado/i);
  });

  it('returns error when supplier not found in DB', async () => {
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc' } } }) },
      from: vi.fn().mockReturnValueOnce(makeMaybySingleChain(null)),
    };
    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as unknown as MockClient);
    const fd = makeFormData({
      supplier_id: VALID_UUID,
      year_month: VALID_YM,
      source_type: 'stationary_combustion',
      secondary: 'diesel',
      raw_quantity: '100',
      raw_unit: 'L',
    });
    const result = await createActivityEntry(null, fd);
    expect(result.error).toMatch(/proveedor.*no encontrado/i);
  });

  it('returns error when user has no membership for supplier org', async () => {
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc' } } }) },
      from: vi.fn()
        .mockReturnValueOnce(makeMaybySingleChain({ organization_id: 'org-001' }))
        .mockReturnValueOnce(makeMaybySingleChain(null)),
    };
    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as unknown as MockClient);
    const fd = makeFormData({
      supplier_id: VALID_UUID,
      year_month: VALID_YM,
      source_type: 'stationary_combustion',
      secondary: 'diesel',
      raw_quantity: '100',
      raw_unit: 'L',
    });
    const result = await createActivityEntry(null, fd);
    expect(result.error).toMatch(/permisos/i);
  });

  it('invalida la caché de /dashboard al crear entrada exitosa', async () => {
    const { revalidatePath } = await import('next/cache');
    mockAuthenticatedClient();
    const fd = makeFormData({
      supplier_id: VALID_UUID,
      year_month: VALID_YM,
      source_type: 'stationary_combustion',
      secondary: 'natural_gas',
      raw_quantity: '100',
      raw_unit: 'm3_ng',
    });
    const result = await createActivityEntry(null, fd);
    expect(result.success).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
  });
});

// ── importActivityCsv ─────────────────────────────────────────────────────────

describe('importActivityCsv', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when not authenticated', async () => {
    mockUnauthenticatedClient();
    const fd = makeFormData({ csv_text: `${VALID_UUID},${VALID_YM},stationary_combustion,diesel,100,L,` });
    const result: CsvImportState = await importActivityCsv(null, fd);
    expect(result.error).toMatch(/autenticado/i);
  });

  it('returns error for empty CSV', async () => {
    mockAuthenticatedClient();
    const fd = makeFormData({ csv_text: '' });
    const result = await importActivityCsv(null, fd);
    expect(result.error).toBeDefined();
  });

  it('returns success with imported count for valid CSV', async () => {
    // Dos filas, mismo proveedor → verificación de acceso una vez, de periodo dos veces
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc' } } }) },
      from: vi.fn()
        .mockReturnValueOnce(makeMaybySingleChain({ organization_id: 'org-001' })) // verifyAccess: supplier
        .mockReturnValueOnce(makeMaybySingleChain({ role: 'admin' }))              // verifyAccess: membership
        .mockReturnValueOnce(makeMaybySingleChain(null))                            // findOrCreate row1: no existing
        .mockReturnValueOnce(makeInsertChain({ id: PERIOD_ID }))                   // findOrCreate row1: insert
        .mockReturnValueOnce(makeMaybySingleChain({ id: PERIOD_ID, status: 'open' })) // findOrCreate row2: found
      .mockReturnValueOnce(makeBatchInsertChain()),                                   // activity_entries batch insert
    };
    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as unknown as MockClient);
    const csv = [
      `${VALID_UUID},${VALID_YM},stationary_combustion,diesel,100,L,`,
      `${VALID_UUID},2026-02,purchased_electricity,SEIN_PERU,500,kWh,`,
    ].join('\n');
    const fd = makeFormData({ csv_text: csv });
    const result = await importActivityCsv(null, fd);
    expect(result.success).toBe(true);
    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);
  });

  it('counts invalid rows as skipped', async () => {
    // 1 valid, 1 invalid (bad UUID) → 1 unique period resolved, then batch insert
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc' } } }) },
      from: vi.fn()
        .mockReturnValueOnce(makeMaybySingleChain({ organization_id: 'org-001' })) // verifyAccess: supplier
        .mockReturnValueOnce(makeMaybySingleChain({ role: 'admin' }))              // verifyAccess: membership
        .mockReturnValueOnce(makeMaybySingleChain(null))                            // findOrCreate: no existing period
        .mockReturnValueOnce(makeInsertChain({ id: PERIOD_ID }))                   // findOrCreate: insert new period
        .mockReturnValueOnce(makeBatchInsertChain()),                               // activity_entries batch insert
    };
    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as unknown as MockClient);
    const csv = [
      `${VALID_UUID},${VALID_YM},stationary_combustion,diesel,100,L,`,
      `bad-uuid,${VALID_YM},stationary_combustion,diesel,100,L,`,
    ].join('\n');
    const fd = makeFormData({ csv_text: csv });
    const result = await importActivityCsv(null, fd);
    expect(result.success).toBe(true);
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('returns error when all rows are invalid', async () => {
    mockAuthenticatedClient();
    const csv = `bad-uuid,bad_month,bad_source,x,-1,`;
    const fd = makeFormData({ csv_text: csv });
    const result = await importActivityCsv(null, fd);
    expect(result.error).toBeDefined();
  });

  it('returns error when CSV exceeds 512 KB', async () => {
    mockAuthenticatedClient();
    const bigCsv = 'x'.repeat(513_000);
    const fd = makeFormData({ csv_text: bigCsv });
    const result = await importActivityCsv(null, fd);
    expect(result.error).toMatch(/512/);
  });

  it('skips rows with valid source_type but invalid secondary', async () => {
    // Fila 2: mobile_combustion con combustible inválido → buildActivityKind devuelve null → omitida
    // Fila 1 requiere cadena completa acceso+periodo; Fila 2 también (periodo omitido tras fallo de activityKind)
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc' } } }) },
      from: vi.fn()
        .mockReturnValueOnce(makeMaybySingleChain({ organization_id: 'org-001' })) // verifyAccess: supplier
        .mockReturnValueOnce(makeMaybySingleChain({ role: 'admin' }))              // verifyAccess: membership
        .mockReturnValueOnce(makeMaybySingleChain(null))                            // findOrCreate row1
        .mockReturnValueOnce(makeInsertChain({ id: PERIOD_ID }))                   // findOrCreate row1 insert
        .mockReturnValueOnce(makeMaybySingleChain(null))                            // findOrCreate row2
        .mockReturnValueOnce(makeInsertChain({ id: '00000000-0000-4000-8000-000000000003' })) // row2 insert
        .mockReturnValueOnce(makeBatchInsertChain()),                                          // activity_entries batch insert (1 entry — hydrogen row skipped)
    };
    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as unknown as MockClient);
    const csv = [
      `${VALID_UUID},${VALID_YM},stationary_combustion,diesel,100,L,`,
      `${VALID_UUID},2026-02,mobile_combustion,hydrogen,200,L,`,
    ].join('\n');
    const fd = makeFormData({ csv_text: csv });
    const result = await importActivityCsv(null, fd);
    expect(result.success).toBe(true);
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
  });
});

// ── createActivityEntry — mobile_combustion ───────────────────────────────────

describe('createActivityEntry — mobile_combustion', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns success for valid mobile_combustion entry', async () => {
    mockAuthenticatedClient();
    const fd = makeFormData({
      supplier_id: VALID_UUID,
      year_month: VALID_YM,
      source_type: 'mobile_combustion',
      secondary: 'diesel',
      raw_quantity: '300',
      raw_unit: 'L',
    });
    const result = await createActivityEntry(null, fd);
    expect(result.success).toBe(true);
  });

  it('returns success for mobile_combustion with gasoline', async () => {
    mockAuthenticatedClient();
    const fd = makeFormData({
      supplier_id: VALID_UUID,
      year_month: VALID_YM,
      source_type: 'mobile_combustion',
      secondary: 'gasoline',
      raw_quantity: '150',
      raw_unit: 'L',
    });
    const result = await createActivityEntry(null, fd);
    expect(result.success).toBe(true);
  });

  it('returns error for invalid mobile_combustion secondary', async () => {
    mockAuthenticatedClient();
    const fd = makeFormData({
      supplier_id: VALID_UUID,
      year_month: VALID_YM,
      source_type: 'mobile_combustion',
      secondary: 'hydrogen',
      raw_quantity: '100',
      raw_unit: 'L',
    });
    const result = await createActivityEntry(null, fd);
    expect(result.error).toBeDefined();
  });

  it('returns error for invalid purchased_electricity grid region', async () => {
    mockAuthenticatedClient();
    const fd = makeFormData({
      supplier_id: VALID_UUID,
      year_month: VALID_YM,
      source_type: 'purchased_electricity',
      secondary: 'INVALID_GRID',
      raw_quantity: '500',
      raw_unit: 'kWh',
    });
    const result = await createActivityEntry(null, fd);
    expect(result.error).toBeDefined();
  });

  it('returns error for invalid fugitive refrigerant', async () => {
    mockAuthenticatedClient();
    const fd = makeFormData({
      supplier_id: VALID_UUID,
      year_month: VALID_YM,
      source_type: 'fugitive',
      secondary: 'R22',
      raw_quantity: '2',
      raw_unit: 'kg',
    });
    const result = await createActivityEntry(null, fd);
    expect(result.error).toBeDefined();
  });
});

// ── createActivityEntry — save error + history filter ────────────────────────

describe('createActivityEntry — save + history', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error when entryRepo.save throws', async () => {
    mocks.save.mockRejectedValueOnce(new Error('unique constraint'));
    mockAuthenticatedClient();
    const fd = makeFormData({
      supplier_id: VALID_UUID,
      year_month: VALID_YM,
      source_type: 'stationary_combustion',
      secondary: 'diesel',
      raw_quantity: '100',
      raw_unit: 'L',
    });
    const result = await createActivityEntry(null, fd);
    expect(result.error).toMatch(/guardar/i);
  });

  it('filters historical entries by id before anomaly detection', async () => {
    const otherId = '00000000-0000-4000-8000-000000000099';
    mocks.findByPeriodId.mockResolvedValueOnce([
      { id: otherId, rawQuantity: 100, rawUnit: 'L', sourceType: 'stationary_combustion', activityKind: { kind: 'stationary_combustion', fuel: 'diesel' } },
    ]);
    mockAuthenticatedClient();
    const fd = makeFormData({
      supplier_id: VALID_UUID,
      year_month: VALID_YM,
      source_type: 'stationary_combustion',
      secondary: 'diesel',
      raw_quantity: '100',
      raw_unit: 'L',
    });
    const result = await createActivityEntry(null, fd);
    expect(result.success).toBe(true);
  });
});

// ── createActivityEntry — anomaly detection ───────────────────────────────────

describe('createActivityEntry — anomaly detection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('saves anomaly flags when detector returns anomalies', async () => {
    mocks.detect.mockReturnValueOnce([{
      entryId: VALID_UUID,
      severity: 'high',
      zScore: 5.1,
      message: 'Consumo inusualmente alto detectado',
    }]);
    mockAuthenticatedClient();
    const fd = makeFormData({
      supplier_id: VALID_UUID,
      year_month: VALID_YM,
      source_type: 'stationary_combustion',
      secondary: 'natural_gas',
      raw_quantity: '9999',
      raw_unit: 'm3_ng',
    });
    const result = await createActivityEntry(null, fd);
    expect(result.success).toBe(true);
    expect(mocks.anomalySave).toHaveBeenCalledOnce();
  });

  it('still returns success when anomaly save throws (non-fatal)', async () => {
    mocks.detect.mockReturnValueOnce([{
      entryId: VALID_UUID,
      severity: 'medium',
      zScore: 3.0,
      message: 'Anomalía detectada',
    }]);
    mocks.anomalySave.mockRejectedValueOnce(new Error('DB error'));
    mockAuthenticatedClient();
    const fd = makeFormData({
      supplier_id: VALID_UUID,
      year_month: VALID_YM,
      source_type: 'stationary_combustion',
      secondary: 'diesel',
      raw_quantity: '500',
      raw_unit: 'L',
    });
    const result = await createActivityEntry(null, fd);
    expect(result.success).toBe(true);
  });
});

// ── importActivityCsv — ownership check ──────────────────────────────────────

describe('importActivityCsv — ownership check', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error when all rows are invalid (no valid rows to process)', async () => {
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc' } } }) },
      from: vi.fn(),
    };
    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as unknown as MockClient);
    const csv = `not-a-uuid,bad-month,bad_source,x,-1,`;
    const fd = makeFormData({ csv_text: csv });
    const result = await importActivityCsv(null, fd);
    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/válidas/i);
  });

  it('returns error when supplier is not found for a valid CSV row', async () => {
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc' } } }) },
      from: vi.fn()
        .mockReturnValueOnce(makeMaybySingleChain(null)), // proveedor no encontrado
    };
    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as unknown as MockClient);
    const csv = `${VALID_UUID},${VALID_YM},stationary_combustion,diesel,100,L,`;
    const fd = makeFormData({ csv_text: csv });
    const result = await importActivityCsv(null, fd);
    expect(result.error).toMatch(/proveedor/i);
  });

  it('returns error when user lacks permission for supplier org', async () => {
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc' } } }) },
      from: vi.fn()
        .mockReturnValueOnce(makeMaybySingleChain({ organization_id: 'org-001' })) // supplier found
        .mockReturnValueOnce(makeMaybySingleChain(null)), // no membership
    };
    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as unknown as MockClient);
    const csv = `${VALID_UUID},${VALID_YM},stationary_combustion,diesel,100,L,`;
    const fd = makeFormData({ csv_text: csv });
    const result = await importActivityCsv(null, fd);
    expect(result.error).toMatch(/permisos/i);
  });

  it('returns error when batch insert fails', async () => {
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc' } } }) },
      from: vi.fn()
        .mockReturnValueOnce(makeMaybySingleChain({ organization_id: 'org-001' })) // verifyAccess: supplier
        .mockReturnValueOnce(makeMaybySingleChain({ role: 'admin' }))              // verifyAccess: membership
        .mockReturnValueOnce(makeMaybySingleChain(null))                            // findOrCreate: no existing period
        .mockReturnValueOnce(makeInsertChain({ id: PERIOD_ID }))                   // findOrCreate: insert new period
        .mockReturnValueOnce(makeBatchInsertChain({ message: 'DB constraint' })), // batch insert fails
    };
    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as unknown as MockClient);
    const csv = `${VALID_UUID},${VALID_YM},stationary_combustion,diesel,100,L,`;
    const fd = makeFormData({ csv_text: csv });
    const result = await importActivityCsv(null, fd);
    expect(result.error).toMatch(/guardar/i);
  });

  it('handles period creation failure gracefully (row skipped)', async () => {
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc' } } }) },
      from: vi.fn()
        .mockReturnValueOnce(makeMaybySingleChain({ organization_id: 'org-001' })) // verifyAccess: supplier
        .mockReturnValueOnce(makeMaybySingleChain({ role: 'admin' }))              // verifyAccess: membership
        .mockReturnValueOnce(makeMaybySingleChain(null))                            // findOrCreate: no existing
        .mockReturnValueOnce(makeInsertChain(null, { message: 'constraint error' })), // insert fails
    };
    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as unknown as MockClient);
    const csv = `${VALID_UUID},${VALID_YM},stationary_combustion,diesel,100,L,`;
    const fd = makeFormData({ csv_text: csv });
    const result = await importActivityCsv(null, fd);
    expect(result.success).toBe(true);
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(1);
  });
});

/** Mock para importActivityBulk con un proveedor y periodo existente */
function mockBulkImportClient() {
  const mockSupabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc' } } }) },
    from: vi.fn()
      .mockReturnValueOnce(makeMaybeSingleChain({ organization_id: 'org-001' }))        // verifySupplierAccess → suppliers
      .mockReturnValueOnce(makeMaybeSingleChain({ role: 'admin', supplier_id: null }))  // verifySupplierAccess → memberships
      .mockReturnValueOnce(makeMaybeSingleChain({ id: PERIOD_ID, status: 'open' }))     // findOrCreatePeriod → existing period
      .mockReturnValueOnce(makeBatchInsertChain()),                                      // activity_entries batch insert
  };
  vi.mocked(createServerClient).mockResolvedValue(mockSupabase as unknown as MockClient);
  return mockSupabase;
}

// ── importActivityBulk — validación de tamaño ────────────────────────────────

describe('importActivityBulk — límite de tamaño', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error when not authenticated', async () => {
    mockUnauthenticatedClient();
    const fd = makeFormData({ json_entries: JSON.stringify([]) });
    const result = await importActivityBulk(null, fd);
    expect(result.error).toMatch(/autenticado/i);
  });

  it('returns error when json_entries is missing', async () => {
    mockAuthenticatedClient();
    const fd = makeFormData({});
    const result = await importActivityBulk(null, fd);
    expect(result.error).toMatch(/datos/i);
  });

  it('returns error when JSON payload exceeds 500 KB', async () => {
    mockAuthenticatedClient();
    const bigJson = 'x'.repeat(501_000);
    const fd = makeFormData({ json_entries: bigJson });
    const result = await importActivityBulk(null, fd);
    expect(result.error).toMatch(/límite/i);
  });

  it('returns error for malformed JSON', async () => {
    mockAuthenticatedClient();
    const fd = makeFormData({ json_entries: '{not valid json' });
    const result = await importActivityBulk(null, fd);
    expect(result.error).toMatch(/inválido/i);
  });

  it('returns error when array is empty after Zod validation', async () => {
    mockAuthenticatedClient();
    const fd = makeFormData({ json_entries: JSON.stringify([]) });
    const result = await importActivityBulk(null, fd);
    expect(result.error).toBeDefined();
  });

  it('returns error when array exceeds 500 rows', async () => {
    mockAuthenticatedClient();
    const row = {
      supplier_id: VALID_UUID,
      year_month: VALID_YM,
      source_type: 'purchased_electricity',
      secondary: 'SEIN_PERU',
      raw_quantity: 1000,
      raw_unit: 'kWh',
    };
    const bigArray = Array.from({ length: 501 }, () => row);
    const fd = makeFormData({ json_entries: JSON.stringify(bigArray) });
    const result = await importActivityBulk(null, fd);
    expect(result.error).toMatch(/500/);
  });

  it('returns success with imported count for valid single row', async () => {
    mockBulkImportClient();
    const rows = [
      {
        supplier_id: VALID_UUID,
        year_month: VALID_YM,
        source_type: 'purchased_electricity',
        secondary: 'SEIN_PERU',
        raw_quantity: 1000,
        raw_unit: 'kWh',
      },
    ];
    const fd = makeFormData({ json_entries: JSON.stringify(rows) });
    const result = await importActivityBulk(null, fd);
    expect(result.success).toBe(true);
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.entryIds).toHaveLength(1);
  });
});

// ── voidActivityEntry — validación UUID ───────────────────────────────────────

describe('voidActivityEntry — validación de ID', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error when not authenticated', async () => {
    mockUnauthenticatedClient();
    const fd = makeFormData({ entry_id: VALID_UUID, void_reason: 'error de captura' });
    const result = await voidActivityEntry(null, fd);
    expect(result.error).toMatch(/autenticado/i);
  });

  it('returns error for invalid entry_id format', async () => {
    mockAuthenticatedClient();
    const fd = makeFormData({ entry_id: 'not-a-uuid', void_reason: 'error de captura' });
    const result = await voidActivityEntry(null, fd);
    expect(result.error).toMatch(/inválido/i);
  });

  it('returns error when void_reason is empty', async () => {
    mockAuthenticatedClient();
    const fd = makeFormData({ entry_id: VALID_UUID, void_reason: '' });
    const result = await voidActivityEntry(null, fd);
    expect(result.error).toMatch(/razón/i);
  });

  it('returns error when period is in calculating status', async () => {
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc' } } }) },
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            voided_at: null,
            reporting_period_id: PERIOD_ID,
            reporting_periods: {
              status: 'calculating',
              suppliers: { organization_id: 'org-001' },
            },
          },
        }),
      })),
    };
    vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);

    const fd = makeFormData({ entry_id: VALID_UUID, void_reason: 'corrección' });
    const result = await voidActivityEntry(null, fd);
    expect(result.error).toMatch(/calculad/i);
  });
});

// ── deleteActivityEntry — validación UUID ─────────────────────────────────────

describe('deleteActivityEntry — validación de ID', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error when not authenticated', async () => {
    mockUnauthenticatedClient();
    const fd = makeFormData({ entry_id: VALID_UUID });
    const result = await deleteActivityEntry(null, fd);
    expect(result.error).toMatch(/autenticado/i);
  });

  it('returns error for invalid entry_id format', async () => {
    mockAuthenticatedClient();
    const fd = makeFormData({ entry_id: '../../../etc/passwd' });
    const result = await deleteActivityEntry(null, fd);
    expect(result.error).toMatch(/inválido/i);
  });

  it('returns error for empty entry_id', async () => {
    mockAuthenticatedClient();
    const fd = makeFormData({ entry_id: '' });
    const result = await deleteActivityEntry(null, fd);
    expect(result.error).toMatch(/inválido/i);
  });
});

// ── deleteActivityEntry — control de roles ────────────────────────────────────

const ENTRY_ID = '00000000-0000-4000-8000-000000000099';

function makeChainWithIn(data: unknown) {
  const c: Record<string, unknown> = {};
  c['select'] = () => c;
  c['eq'] = () => c;
  c['in'] = () => c;
  c['maybeSingle'] = () => Promise.resolve({ data });
  return c;
}

function makeDeleteChain(error: { message: string } | null = null) {
  const c: Record<string, unknown> = {};
  c['delete'] = () => c;
  c['eq'] = () => Promise.resolve({ error });
  return c;
}

function mockDeleteClient({
  memberRole = 'admin' as string | null,
  deleteError = null as { message: string } | null,
  periodStatus = 'open' as string,
  voidedAt = null as string | null,
} = {}) {
  const entryData = {
    reporting_period_id: PERIOD_ID,
    voided_at: voidedAt,
    reporting_periods: { status: periodStatus, suppliers: { organization_id: 'org-001' } },
  };
  // Simula el filtro .in('role', ['admin', 'consultant']) de la DB:
  // solo devuelve fila si el rol es uno de los permitidos
  const allowedRoles = ['admin', 'consultant'];
  const membershipData =
    memberRole && allowedRoles.includes(memberRole) ? { role: memberRole } : null;
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc' } } }) },
    from: vi.fn()
      .mockReturnValueOnce(makeChainWithIn(entryData))
      .mockReturnValueOnce(makeChainWithIn(membershipData))
      .mockReturnValueOnce(makeDeleteChain(deleteError)),
  };
  vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);
  return client;
}

describe('deleteActivityEntry — control de roles', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error when user has supplier role (not admin/consultant)', async () => {
    mockDeleteClient({ memberRole: 'supplier' });
    const result = await deleteActivityEntry(null, makeFormData({ entry_id: ENTRY_ID }));
    expect(result.error).toMatch(/permiso/i);
  });

  it('returns error when user has no membership', async () => {
    mockDeleteClient({ memberRole: null });
    const result = await deleteActivityEntry(null, makeFormData({ entry_id: ENTRY_ID }));
    expect(result.error).toMatch(/permiso/i);
  });

  it('returns success for admin role', async () => {
    mockDeleteClient({ memberRole: 'admin' });
    const result = await deleteActivityEntry(null, makeFormData({ entry_id: ENTRY_ID }));
    expect(result.success).toBe(true);
  });

  it('returns success for consultant role', async () => {
    mockDeleteClient({ memberRole: 'consultant' });
    const result = await deleteActivityEntry(null, makeFormData({ entry_id: ENTRY_ID }));
    expect(result.success).toBe(true);
  });

  it('returns error when DB delete fails', async () => {
    mockDeleteClient({ deleteError: { message: 'foreign key violation' } });
    const result = await deleteActivityEntry(null, makeFormData({ entry_id: ENTRY_ID }));
    expect(result.error).toMatch(/eliminar/i);
  });

  it('returns error when period is locked', async () => {
    mockDeleteClient({ periodStatus: 'locked' });
    const result = await deleteActivityEntry(null, makeFormData({ entry_id: ENTRY_ID }));
    expect(result.error).toMatch(/bloqueado/i);
  });

  it('returns error when period is calculating', async () => {
    mockDeleteClient({ periodStatus: 'calculating' });
    const result = await deleteActivityEntry(null, makeFormData({ entry_id: ENTRY_ID }));
    expect(result.error).toMatch(/calculad/i);
  });

  it('returns error when entry is voided (voided_at not null)', async () => {
    mockDeleteClient({ voidedAt: '2026-05-01T00:00:00.000Z' });
    const result = await deleteActivityEntry(null, makeFormData({ entry_id: ENTRY_ID }));
    expect(result.error).toMatch(/anulado/i);
    expect(result.success).toBeUndefined();
  });

  it('allows deletion when entry is not voided (voided_at null)', async () => {
    mockDeleteClient({ voidedAt: null, memberRole: 'admin' });
    const result = await deleteActivityEntry(null, makeFormData({ entry_id: ENTRY_ID }));
    expect(result.success).toBe(true);
  });
});

// ── voidActivityEntry — success path ─────────────────────────────────────────

describe('voidActivityEntry — success', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns success for open period with valid reason', async () => {
    const entryData = {
      voided_at: null,
      reporting_period_id: PERIOD_ID,
      reporting_periods: { status: 'open', suppliers: { organization_id: 'org-001' } },
    };
    const updateChain = {
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    };
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc' } } }) },
      from: vi.fn()
        .mockReturnValueOnce(makeMaybeSingleChain(entryData))
        .mockReturnValueOnce(makeChainWithIn({ role: 'consultant' }))
        .mockReturnValueOnce(updateChain),
    };
    vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);

    const result = await voidActivityEntry(null, makeFormData({ entry_id: ENTRY_ID, void_reason: 'Dato incorrecto' }));
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });
});

// ── voidActivityEntry — control de roles ──────────────────────────────────────

function mockVoidClient({
  memberRole = 'admin' as string | null,
  voidUpdateError = null as { message: string } | null,
  periodStatus = 'open' as string,
} = {}) {
  const entryData = {
    voided_at: null,
    reporting_period_id: PERIOD_ID,
    reporting_periods: { status: periodStatus, suppliers: { organization_id: 'org-001' } },
  };
  const allowedRoles = ['admin', 'consultant'];
  const membershipData =
    memberRole && allowedRoles.includes(memberRole) ? { role: memberRole } : null;
  const updateChain = {
    update: () => ({ eq: () => Promise.resolve({ error: voidUpdateError }) }),
  };
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc' } } }) },
    from: vi.fn()
      .mockReturnValueOnce(makeMaybeSingleChain(entryData))
      .mockReturnValueOnce(makeChainWithIn(membershipData))
      .mockReturnValueOnce(updateChain),
  };
  vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);
  return client;
}

describe('voidActivityEntry — control de roles', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error when user has supplier role (not admin/consultant)', async () => {
    mockVoidClient({ memberRole: 'supplier' });
    const result = await voidActivityEntry(
      null,
      makeFormData({ entry_id: ENTRY_ID, void_reason: 'corrección' }),
    );
    expect(result.error).toMatch(/permiso/i);
  });

  it('returns error when user has no membership', async () => {
    mockVoidClient({ memberRole: null });
    const result = await voidActivityEntry(
      null,
      makeFormData({ entry_id: ENTRY_ID, void_reason: 'corrección' }),
    );
    expect(result.error).toMatch(/permiso/i);
  });

  it('returns success for admin role', async () => {
    mockVoidClient({ memberRole: 'admin' });
    const result = await voidActivityEntry(
      null,
      makeFormData({ entry_id: ENTRY_ID, void_reason: 'corrección' }),
    );
    expect(result.success).toBe(true);
  });

  it('returns success for consultant role', async () => {
    mockVoidClient({ memberRole: 'consultant' });
    const result = await voidActivityEntry(
      null,
      makeFormData({ entry_id: ENTRY_ID, void_reason: 'corrección' }),
    );
    expect(result.success).toBe(true);
  });
});

// ── findOrCreatePeriod — TOCTOU 23505 retry ───────────────────────────────────

describe('createActivityEntry — findOrCreatePeriod 23505 retry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('recovers from unique constraint violation by retrying select', async () => {
    const RETRY_PERIOD_ID = '00000000-0000-4000-8000-000000000099';

    const insertChain23505 = {
      insert: () => ({
        select: () => ({
          single: () =>
            Promise.resolve({ data: null, error: { code: '23505', message: 'duplicate' } }),
        }),
      }),
    };
    const retrySelectChain = (() => {
      const p = Promise.resolve({ data: { id: RETRY_PERIOD_ID, status: 'open' } });
      const c: Record<string, unknown> = {};
      c['select'] = () => c;
      c['eq'] = () => c;
      c['maybeSingle'] = () => p;
      return c;
    })();
    const anomalyChain = (() => {
      const p = Promise.resolve({ data: [], error: null });
      const c: Record<string, unknown> = {};
      c['select'] = () => c;
      c['eq'] = () => c;
      c['gte'] = () => c;
      c['lte'] = () => c;
      c['then'] = (p as Promise<unknown>).then.bind(p);
      c['catch'] = (p as Promise<unknown>).catch.bind(p);
      return c;
    })();

    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc' } } }) },
      from: vi.fn()
        .mockReturnValueOnce(makeMaybeSingleChain({ organization_id: 'org-001' })) // suppliers
        .mockReturnValueOnce(makeMaybeSingleChain({ role: 'admin' }))             // memberships
        .mockReturnValueOnce(makeMaybeSingleChain(null))                          // period find → null
        .mockReturnValueOnce(insertChain23505)                                    // period insert → 23505
        .mockReturnValueOnce(retrySelectChain)                                    // reintento de select de periodo
        .mockReturnValueOnce(anomalyChain),                                       // anomaly baseline
    };
    vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);

    const result = await createActivityEntry(
      null,
      makeFormData({
        supplier_id: VALID_UUID,
        year_month: VALID_YM,
        source_type: 'stationary_combustion',
        secondary: 'natural_gas',
        raw_quantity: '1000',
        raw_unit: 'm3_ng',
      }),
    );

    expect(result.success).toBe(true);
  });
});

// ── helper used in tests above that references an unqualified name ────────────

function makeMaybySingleChain(data: unknown) {
  return makeMaybeSingleChain(data);
}

// ── importActivityCsv — límite de filas ───────────────────────────────────────

describe('importActivityCsv — límite de filas', () => {
  beforeEach(() => vi.clearAllMocks());

  function mockAuthOnly() {
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc' } } }) },
      from: vi.fn(),
    };
    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as unknown as MockClient);
  }

  it('rechaza CSV con más de 500 filas válidas', async () => {
    mockAuthOnly();
    const header = 'supplier_id,year_month,source_type,secondary,raw_quantity,raw_unit,data_quality,notes';
    const row = `${VALID_UUID},2026-01,stationary_combustion,natural_gas,100,m3_ng,measured,nota`;
    const csvText = [header, ...Array(501).fill(row)].join('\n');
    const fd = makeFormData({ csv_text: csvText });
    const result: CsvImportState = await importActivityCsv(null, fd);
    expect(result.error).toMatch(/500/);
  });

  it('acepta CSV con exactamente 500 filas válidas (no rechaza por límite)', async () => {
    // Verifica que el check de 500 filas no se dispara para exactamente 500 filas.
    // El resultado puede fallar por otro motivo (acceso proveedor), pero NO por límite de filas.
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc' } } }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        in: vi.fn().mockReturnThis(),
        then: vi.fn().mockResolvedValue({ data: null }),
      }),
    };
    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as unknown as MockClient);
    const header = 'supplier_id,year_month,source_type,secondary,raw_quantity,raw_unit,data_quality,notes';
    const row = `${VALID_UUID},2026-01,stationary_combustion,natural_gas,100,m3_ng,measured,nota`;
    const csvText = [header, ...Array(500).fill(row)].join('\n');
    const fd = makeFormData({ csv_text: csvText });
    const result: CsvImportState = await importActivityCsv(null, fd);
    expect(result.error).not.toMatch(/500 filas/);
  });
});

// ── voidActivityEntry — estado under_review ───────────────────────────────────

describe('voidActivityEntry — estado under_review', () => {
  beforeEach(() => vi.clearAllMocks());

  it('bloquea a consultores cuando el periodo está bajo revisión', async () => {
    mockVoidClient({ memberRole: 'consultant', periodStatus: 'under_review' });
    const result = await voidActivityEntry(
      null,
      makeFormData({ entry_id: ENTRY_ID, void_reason: 'corrección' }),
    );
    expect(result.error).toMatch(/revisión/i);
  });

  it('permite a administradores anular en periodo bajo revisión', async () => {
    mockVoidClient({ memberRole: 'admin', periodStatus: 'under_review' });
    const result = await voidActivityEntry(
      null,
      makeFormData({ entry_id: ENTRY_ID, void_reason: 'corrección' }),
    );
    expect(result.success).toBe(true);
  });
});

// ── voidActivityEntry — revalidatePath ────────────────────────────────────────

describe('voidActivityEntry — revalidatePath', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invalida /dashboard y /suppliers al anular con éxito', async () => {
    const { revalidatePath } = await import('next/cache');
    mockVoidClient({ memberRole: 'admin', periodStatus: 'open' });
    const result = await voidActivityEntry(
      null,
      makeFormData({ entry_id: ENTRY_ID, void_reason: 'Dato incorrecto' }),
    );
    expect(result.success).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
    expect(revalidatePath).toHaveBeenCalledWith('/suppliers');
  });
});
