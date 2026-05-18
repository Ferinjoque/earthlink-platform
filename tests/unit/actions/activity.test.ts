import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ActivityFormState, CsvImportState } from '../../../src/actions/activity';

// ── Hoisted mock refs ─────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  save: vi.fn().mockResolvedValue(undefined),
  findByPeriodId: vi.fn().mockResolvedValue([]),
  anomalySave: vi.fn().mockResolvedValue(undefined),
  detect: vi.fn().mockReturnValue([]),
}));

// ── Mock server-only modules ──────────────────────────────────────────────────

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
import { createActivityEntry, importActivityCsv } from '../../../src/actions/activity';

type MockClient = Awaited<ReturnType<typeof createServerClient>>;

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_UUID = '00000000-0000-4000-8000-000000000001';

function makeOwnershipChain(singleData: unknown, arrayData: unknown[]) {
  const singleResult = Promise.resolve({ data: singleData });
  const arrayResult = Promise.resolve({ data: arrayData });
  const c: Record<string, unknown> = {};
  c['select'] = () => c;
  c['eq'] = () => c;
  c['in'] = () => arrayResult;
  c['maybeSingle'] = () => singleResult;
  return c;
}

function mockAuthenticatedClient(userId = 'user-abc') {
  const mockSupabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }) },
    from: vi.fn()
      .mockReturnValueOnce(makeOwnershipChain(
        { supplier_id: 'supplier-001' },
        [{ id: VALID_UUID, supplier_id: 'supplier-001' }],
      ))
      .mockReturnValueOnce(makeOwnershipChain(
        { organization_id: 'org-001' },
        [{ id: 'supplier-001', organization_id: 'org-001' }],
      ))
      .mockReturnValueOnce(makeOwnershipChain(
        { role: 'admin' },
        [{ organization_id: 'org-001' }],
      )),
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

function makeArrayChain(data: unknown[]) {
  const p = Promise.resolve({ data });
  const c: Record<string, unknown> = {};
  c['select'] = () => c;
  c['eq'] = () => c;
  c['in'] = () => p;
  return c;
}

function makeNullDataChain() {
  const p = Promise.resolve({ data: null });
  const c: Record<string, unknown> = {};
  c['select'] = () => c;
  c['eq'] = () => c;
  c['in'] = () => p;
  return c;
}

function mockImportUnauthorizedClient() {
  const mockSupabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc' } } }) },
    from: vi.fn()
      .mockReturnValueOnce(makeArrayChain([{ id: VALID_UUID, supplier_id: 'supplier-001' }]))
      .mockReturnValueOnce(makeArrayChain([{ id: 'supplier-001', organization_id: 'other-org' }]))
      .mockReturnValueOnce(makeArrayChain([])),
  };
  vi.mocked(createServerClient).mockResolvedValue(mockSupabase as unknown as MockClient);
}

function mockImportPeriodsNotFoundClient() {
  const mockSupabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc' } } }) },
    from: vi.fn()
      .mockReturnValueOnce(makeArrayChain([])),
  };
  vi.mocked(createServerClient).mockResolvedValue(mockSupabase as unknown as MockClient);
}

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

function makeSingleChain(data: unknown) {
  const c: Record<string, unknown> = {};
  c['select'] = () => c;
  c['eq'] = () => c;
  c['maybeSingle'] = () => Promise.resolve({ data });
  return c;
}

// ── createActivityEntry ───────────────────────────────────────────────────────

describe('createActivityEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when not authenticated', async () => {
    mockUnauthenticatedClient();
    const fd = makeFormData({
      reporting_period_id: VALID_UUID,
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

  it('returns fieldErrors when quantity is negative', async () => {
    mockAuthenticatedClient();
    const fd = makeFormData({
      reporting_period_id: VALID_UUID,
      source_type: 'stationary_combustion',
      secondary: 'diesel',
      raw_quantity: '-5',
      raw_unit: 'L',
    });
    const result = await createActivityEntry(null, fd);
    expect(result.fieldErrors?.raw_quantity).toBeDefined();
  });

  it('returns error for invalid secondary with combustion source', async () => {
    mockAuthenticatedClient();
    const fd = makeFormData({
      reporting_period_id: VALID_UUID,
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
      reporting_period_id: VALID_UUID,
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
      reporting_period_id: VALID_UUID,
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
      reporting_period_id: VALID_UUID,
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
      reporting_period_id: VALID_UUID,
      source_type: 'fugitive',
      secondary: 'R410A',
      raw_quantity: '5',
      raw_unit: 'kg',
    });
    const result = await createActivityEntry(null, fd);
    expect(result.success).toBe(true);
  });

  it('returns error when reporting period not found in DB', async () => {
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc' } } }) },
      from: vi.fn().mockReturnValueOnce(makeSingleChain(null)),
    };
    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as unknown as MockClient);
    const fd = makeFormData({
      reporting_period_id: VALID_UUID,
      source_type: 'stationary_combustion',
      secondary: 'diesel',
      raw_quantity: '100',
      raw_unit: 'L',
    });
    const result = await createActivityEntry(null, fd);
    expect(result.error).toMatch(/periodo.*no encontrado/i);
  });

  it('returns error when supplier for period not found in DB', async () => {
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc' } } }) },
      from: vi.fn()
        .mockReturnValueOnce(makeSingleChain({ supplier_id: 'supplier-001' }))
        .mockReturnValueOnce(makeSingleChain(null)),
    };
    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as unknown as MockClient);
    const fd = makeFormData({
      reporting_period_id: VALID_UUID,
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
        .mockReturnValueOnce(makeSingleChain({ supplier_id: 'supplier-001' }))
        .mockReturnValueOnce(makeSingleChain({ organization_id: 'org-001' }))
        .mockReturnValueOnce(makeSingleChain(null)),
    };
    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as unknown as MockClient);
    const fd = makeFormData({
      reporting_period_id: VALID_UUID,
      source_type: 'stationary_combustion',
      secondary: 'diesel',
      raw_quantity: '100',
      raw_unit: 'L',
    });
    const result = await createActivityEntry(null, fd);
    expect(result.error).toMatch(/permisos/i);
  });
});

// ── importActivityCsv ─────────────────────────────────────────────────────────

describe('importActivityCsv', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when not authenticated', async () => {
    mockUnauthenticatedClient();
    const fd = makeFormData({ csv_text: `${VALID_UUID},stationary_combustion,diesel,100,L,` });
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
    mockAuthenticatedClient();
    const csv = [
      `${VALID_UUID},stationary_combustion,diesel,100,L,`,
      `${VALID_UUID},purchased_electricity,SEIN_PERU,500,kWh,`,
    ].join('\n');
    const fd = makeFormData({ csv_text: csv });
    const result = await importActivityCsv(null, fd);
    expect(result.success).toBe(true);
    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);
  });

  it('counts invalid rows as skipped', async () => {
    mockAuthenticatedClient();
    const csv = [
      `${VALID_UUID},stationary_combustion,diesel,100,L,`,
      `bad-uuid,stationary_combustion,diesel,100,L,`,
    ].join('\n');
    const fd = makeFormData({ csv_text: csv });
    const result = await importActivityCsv(null, fd);
    expect(result.success).toBe(true);
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('returns error when all rows are invalid', async () => {
    mockAuthenticatedClient();
    const csv = `bad-uuid,bad_source,x,-1,`;
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
    mockAuthenticatedClient();
    // mobile_combustion row with invalid fuel → buildActivityKind returns null → skipped
    const csv = [
      `${VALID_UUID},stationary_combustion,diesel,100,L,`,
      `${VALID_UUID},mobile_combustion,hydrogen,200,L,`,
    ].join('\n');
    const fd = makeFormData({ csv_text: csv });
    const result = await importActivityCsv(null, fd);
    expect(result.success).toBe(true);
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
  });
});

describe('createActivityEntry — mobile_combustion', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns success for valid mobile_combustion entry', async () => {
    mockAuthenticatedClient();
    const fd = makeFormData({
      reporting_period_id: VALID_UUID,
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
      reporting_period_id: VALID_UUID,
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
      reporting_period_id: VALID_UUID,
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
      reporting_period_id: VALID_UUID,
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
      reporting_period_id: VALID_UUID,
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
      reporting_period_id: VALID_UUID,
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
      reporting_period_id: VALID_UUID,
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
      reporting_period_id: VALID_UUID,
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
      reporting_period_id: VALID_UUID,
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

  it('returns error when reporting periods not found in DB', async () => {
    mockImportPeriodsNotFoundClient();
    const csv = `${VALID_UUID},stationary_combustion,diesel,100,L,`;
    const fd = makeFormData({ csv_text: csv });
    const result = await importActivityCsv(null, fd);
    expect(result.error).toMatch(/periodo/i);
  });

  it('returns error when periods query returns null (defensive ?? [])', async () => {
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc' } } }) },
      from: vi.fn().mockReturnValueOnce(makeNullDataChain()),
    };
    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as unknown as MockClient);
    const csv = `${VALID_UUID},stationary_combustion,diesel,100,L,`;
    const fd = makeFormData({ csv_text: csv });
    const result = await importActivityCsv(null, fd);
    expect(result.error).toMatch(/periodo/i);
  });

  it('returns error when user lacks permission for period orgs', async () => {
    mockImportUnauthorizedClient();
    const csv = `${VALID_UUID},stationary_combustion,diesel,100,L,`;
    const fd = makeFormData({ csv_text: csv });
    const result = await importActivityCsv(null, fd);
    expect(result.error).toMatch(/permisos/i);
  });

  it('counts row as skipped when entryRepo.save throws', async () => {
    mocks.save.mockRejectedValueOnce(new Error('DB constraint'));
    mockAuthenticatedClient();
    const csv = `${VALID_UUID},stationary_combustion,diesel,100,L,`;
    const fd = makeFormData({ csv_text: csv });
    const result = await importActivityCsv(null, fd);
    expect(result.success).toBe(true);
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('handles null suppliers and memberships from Supabase (defensive ?? [])', async () => {
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc' } } }) },
      from: vi.fn()
        .mockReturnValueOnce(makeArrayChain([{ id: VALID_UUID, supplier_id: 'supplier-001' }]))
        .mockReturnValueOnce(makeNullDataChain())
        .mockReturnValueOnce(makeNullDataChain()),
    };
    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as unknown as MockClient);

    const csv = `${VALID_UUID},stationary_combustion,diesel,100,L,`;
    const fd = makeFormData({ csv_text: csv });
    const result = await importActivityCsv(null, fd);
    expect(result.success).toBe(true);
    expect(result.imported).toBe(1);
  });
});
