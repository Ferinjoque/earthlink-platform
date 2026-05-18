import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ActivityFormState, CsvImportState } from '../../../src/actions/activity';

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

// Mock repositories using class expressions so `new Repo()` works
vi.mock('../../../src/repos/ActivityEntryRepository', () => ({
  ActivityEntryRepository: class {
    save = vi.fn().mockResolvedValue(undefined);
    findByPeriodId = vi.fn().mockResolvedValue([]);
  },
}));
vi.mock('../../../src/repos/AnomalyFlagRepository', () => ({
  AnomalyFlagRepository: class {
    save = vi.fn().mockResolvedValue(undefined);
  },
}));

import { createServerClient } from '../../../src/services/supabase/server';
import { createActivityEntry, importActivityCsv } from '../../../src/actions/activity';

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_UUID = '00000000-0000-4000-8000-000000000001';

function mockAuthenticatedClient(userId = 'user-abc') {
  const mockSupabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }) },
  };
  (createServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockSupabase);
  return mockSupabase;
}

function mockUnauthenticatedClient() {
  const mockSupabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  };
  (createServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockSupabase);
}

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
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
});
