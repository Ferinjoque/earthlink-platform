import { describe, it, expect, vi, beforeEach } from 'vitest';

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

import { createServerClient } from '../../../src/services/supabase/server';
import { exportCsv } from '../../../src/actions/reports';

const USER_ID = 'aaaa0000-0000-0000-0000-000000000001';
const ORG_ID = 'bbbb0000-0000-0000-0000-000000000002';
const SUPPLIER_ID = 'cccc0000-0000-0000-0000-000000000003';
const PERIOD_ID = 'dddd0000-0000-0000-0000-000000000004';
const ENTRY_ID = 'eeee0000-0000-0000-0000-000000000005';
const RESULT_ID = 'ffff0000-0000-0000-0000-000000000006';

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

function mockClient({
  user = { id: USER_ID } as { id: string } | null,
  memberships = [{ organization_id: ORG_ID }],
  periods = [{ id: PERIOD_ID, label: 'Q1-2026', supplier_id: SUPPLIER_ID }],
  suppliers = [{ id: SUPPLIER_ID, name: 'Test Corp', organization_id: ORG_ID }],
  results = [] as Array<{
    id: string;
    activity_entry_id: string;
    reporting_period_id: string;
    scope: number;
    co2e_kg: number;
    factor_used: number;
    factor_unit: string;
    calc_hash: string;
    calc_version: string;
    calculated_at: string;
  }>,
  entries = [] as Array<{ id: string; source_type: string; raw_quantity: number; raw_unit: string }>,
} = {}) {
  const queryChain = (returnData: unknown) => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ error: null }),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    then: vi.fn().mockResolvedValue({ data: returnData }),
    // Make the chain thenable so await works
    [Symbol.for('nodejs.util.inspect.custom')]: undefined,
  });

  const dataMap: Record<string, unknown> = {
    memberships,
    reporting_periods: periods,
    suppliers,
    emission_results: results,
    activity_entries: entries,
    report_exports: [],
  };

  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ error: null }),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: dataMap[table] ?? [] }),
      };
      // Make select().eq().then() work
      chain.select.mockReturnValue({
        ...chain,
        order: vi.fn().mockResolvedValue({ data: dataMap[table] ?? [] }),
      });
      return chain;
    }),
  };
  vi.mocked(createServerClient).mockResolvedValue(client as never);
  return client;
}

beforeEach(() => vi.clearAllMocks());

describe('exportCsv', () => {
  it('returns error when not authenticated', async () => {
    mockClient({ user: null });
    const fd = makeFormData({ period_ids: PERIOD_ID });
    const result = await exportCsv(null, fd);
    expect(result.error).toMatch(/autenticado/i);
  });

  it('returns error when period_ids is empty', async () => {
    mockClient();
    const fd = makeFormData({ period_ids: '' });
    const result = await exportCsv(null, fd);
    expect(result.error).toBeTruthy();
  });

  it('returns error when period_ids field is missing', async () => {
    mockClient();
    const fd = new FormData();
    const result = await exportCsv(null, fd);
    expect(result.error).toBeTruthy();
  });

  it('returns error when user has no org memberships', async () => {
    mockClient({ memberships: [] });
    const fd = makeFormData({ period_ids: PERIOD_ID });
    const result = await exportCsv(null, fd);
    expect(result.error).toMatch(/organizaci/i);
  });

  it('returns success with sha256 and CSV content for valid export', async () => {
    const resultsData = [
      {
        id: RESULT_ID,
        activity_entry_id: ENTRY_ID,
        reporting_period_id: PERIOD_ID,
        scope: 1,
        co2e_kg: 42.5,
        factor_used: 2.1,
        factor_unit: 'kg CO2/unit',
        calc_hash: 'abc123',
        calc_version: '1.0.0',
        calculated_at: '2026-01-15T10:00:00Z',
      },
    ];
    const entriesData = [
      { id: ENTRY_ID, source_type: 'stationary_combustion', raw_quantity: 100, raw_unit: 'kWh' },
    ];

    const dataMap: Record<string, unknown[]> = {
      memberships: [{ organization_id: ORG_ID }],
      reporting_periods: [{ id: PERIOD_ID, label: 'Q1-2026', supplier_id: SUPPLIER_ID }],
      suppliers: [{ id: SUPPLIER_ID, name: 'Test Corp', organization_id: ORG_ID }],
      emission_results: resultsData,
      activity_entries: entriesData,
      report_exports: [],
    };

    // Build a thenable chain so `await from(...).select(...).in(...)` resolves correctly
    function chain(table: string) {
      const resolved = Promise.resolve({ data: dataMap[table] ?? [] });
      const c: Record<string, unknown> = {
        select: () => c,
        eq: () => c,
        in: () => c,
        insert: vi.fn().mockResolvedValue({ error: null }),
        order: () => resolved,
        then: resolved.then.bind(resolved),
        catch: resolved.catch.bind(resolved),
      };
      return c;
    }

    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }),
      },
      from: vi.fn().mockImplementation((table: string) => chain(table)),
    };
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const fd = makeFormData({ period_ids: PERIOD_ID });
    const result = await exportCsv(null, fd);

    expect(result.success).toBe(true);
    expect(result.csvContent).toContain('periodo,proveedor,fuente');
    expect(result.sha256).toHaveLength(64);
    expect(result.filename).toMatch(/earthlink-export-.+\.csv/);
  });
});
