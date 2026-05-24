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

type MockClient = Awaited<ReturnType<typeof createServerClient>>;

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
  vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);
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

  it('returns error when period_ids is only commas (all empty after split)', async () => {
    mockClient();
    const fd = makeFormData({ period_ids: ',' });
    const result = await exportCsv(null, fd);
    expect(result.error).toMatch(/periodo/i);
  });

  it('returns error when period_ids field is missing', async () => {
    mockClient();
    const fd = new FormData();
    const result = await exportCsv(null, fd);
    expect(result.error).toBeTruthy();
  });

  it('returns error when period_ids contains non-UUID value', async () => {
    mockClient();
    const fd = makeFormData({ period_ids: 'not-a-valid-uuid' });
    const result = await exportCsv(null, fd);
    expect(result.error).toMatch(/inválido/i);
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
    vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);

    const fd = makeFormData({ period_ids: PERIOD_ID });
    const result = await exportCsv(null, fd);

    expect(result.success).toBe(true);
    expect(result.csvContent).toContain('periodo,proveedor,fuente');
    expect(result.sha256).toHaveLength(64);
    expect(result.filename).toMatch(/earthlink-export-.+\.csv/);
  });

  it('returns error when periods do not belong to authorized suppliers', async () => {
    // Periods exist but their supplier_id is not in the org's suppliers
    const dataMap: Record<string, unknown[]> = {
      memberships: [{ organization_id: ORG_ID }],
      reporting_periods: [{ id: PERIOD_ID, label: 'Q1-2026', supplier_id: 'other-supplier-id' }],
      suppliers: [{ id: SUPPLIER_ID, name: 'Test Corp', organization_id: ORG_ID }],
      emission_results: [],
      activity_entries: [],
      report_exports: [],
    };

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
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => chain(table)),
    };
    vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);

    const fd = makeFormData({ period_ids: PERIOD_ID });
    const result = await exportCsv(null, fd);
    expect(result.error).toMatch(/acceso/i);
  });

  it('returns error when periods have no calculated results', async () => {
    const dataMap: Record<string, unknown[]> = {
      memberships: [{ organization_id: ORG_ID }],
      reporting_periods: [{ id: PERIOD_ID, label: 'Q1-2026', supplier_id: SUPPLIER_ID }],
      suppliers: [{ id: SUPPLIER_ID, name: 'Test Corp', organization_id: ORG_ID }],
      emission_results: [],
      activity_entries: [],
      report_exports: [],
    };

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
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => chain(table)),
    };
    vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);

    const fd = makeFormData({ period_ids: PERIOD_ID });
    const result = await exportCsv(null, fd);
    expect(result.error).toMatch(/resultados calculados/i);
  });

  it('escapes commas and quotes in CSV fields', async () => {
    const resultsData = [
      {
        id: RESULT_ID,
        activity_entry_id: ENTRY_ID,
        reporting_period_id: PERIOD_ID,
        scope: 1,
        co2e_kg: 10,
        factor_used: 1,
        factor_unit: 'kg CO2/unit',
        calc_hash: 'abc',
        calc_version: '1.0.0',
        calculated_at: '2026-01-15T10:00:00Z',
      },
    ];
    const dataMap: Record<string, unknown[]> = {
      memberships: [{ organization_id: ORG_ID }],
      reporting_periods: [{ id: PERIOD_ID, label: 'Q1-2026', supplier_id: SUPPLIER_ID }],
      // Supplier name with comma → triggers csvEscape quoting
      suppliers: [{ id: SUPPLIER_ID, name: 'Test, Corp "Inc"', organization_id: ORG_ID }],
      emission_results: resultsData,
      activity_entries: [{ id: ENTRY_ID, source_type: 'stationary_combustion', raw_quantity: 100, raw_unit: 'kWh' }],
      report_exports: [],
    };

    function chain(table: string) {
      const resolved = Promise.resolve({ data: dataMap[table] ?? [] });
      const c: Record<string, unknown> = {
        select: () => c, eq: () => c, in: () => c,
        insert: vi.fn().mockResolvedValue({ error: null }),
        order: () => resolved,
        then: resolved.then.bind(resolved),
        catch: resolved.catch.bind(resolved),
      };
      return c;
    }

    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => chain(table)),
    };
    vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);

    const fd = makeFormData({ period_ids: PERIOD_ID });
    const result = await exportCsv(null, fd);
    expect(result.success).toBe(true);
    expect(result.csvContent).toContain('"Test, Corp ""Inc"""');
  });

  it('escapes newline characters in CSV fields', async () => {
    const resultsData = [
      {
        id: RESULT_ID,
        activity_entry_id: ENTRY_ID,
        reporting_period_id: PERIOD_ID,
        scope: 2,
        co2e_kg: 5,
        factor_used: 0.5,
        factor_unit: 'kg CO2/kWh',
        calc_hash: 'def',
        calc_version: '1.0.0',
        calculated_at: '2026-02-01T08:00:00Z',
      },
    ];
    const dataMap: Record<string, unknown[]> = {
      memberships: [{ organization_id: ORG_ID }],
      reporting_periods: [{ id: PERIOD_ID, label: 'Q1-2026', supplier_id: SUPPLIER_ID }],
      suppliers: [{ id: SUPPLIER_ID, name: 'Test Corp', organization_id: ORG_ID }],
      emission_results: resultsData,
      activity_entries: [{ id: ENTRY_ID, source_type: 'purchased_electricity', raw_quantity: 10, raw_unit: 'kWh\nwith newline' }],
      report_exports: [],
    };

    function chain(table: string) {
      const resolved = Promise.resolve({ data: dataMap[table] ?? [] });
      const c: Record<string, unknown> = {
        select: () => c, eq: () => c, in: () => c,
        insert: vi.fn().mockResolvedValue({ error: null }),
        order: () => resolved,
        then: resolved.then.bind(resolved),
        catch: resolved.catch.bind(resolved),
      };
      return c;
    }

    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => chain(table)),
    };
    vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);

    const fd = makeFormData({ period_ids: PERIOD_ID });
    const result = await exportCsv(null, fd);
    expect(result.success).toBe(true);
    expect(result.csvContent).toContain('"kWh');
  });

  it('skips CSV rows where activity entry is not found in fetch results', async () => {
    const MISSING_ENTRY_ID = 'aaaa0000-0000-0000-0000-000000000099';
    const resultsData = [
      {
        id: RESULT_ID,
        activity_entry_id: MISSING_ENTRY_ID,
        reporting_period_id: PERIOD_ID,
        scope: 1,
        co2e_kg: 20,
        factor_used: 2,
        factor_unit: 'kg CO2/L',
        calc_hash: 'ghi',
        calc_version: '1.0.0',
        calculated_at: '2026-03-01T00:00:00Z',
      },
    ];
    const dataMap: Record<string, unknown[]> = {
      memberships: [{ organization_id: ORG_ID }],
      reporting_periods: [{ id: PERIOD_ID, label: 'Q1-2026', supplier_id: SUPPLIER_ID }],
      suppliers: [{ id: SUPPLIER_ID, name: 'Test Corp', organization_id: ORG_ID }],
      emission_results: resultsData,
      activity_entries: [], // entry not found
      report_exports: [],
    };

    function chain(table: string) {
      const resolved = Promise.resolve({ data: dataMap[table] ?? [] });
      const c: Record<string, unknown> = {
        select: () => c, eq: () => c, in: () => c,
        insert: vi.fn().mockResolvedValue({ error: null }),
        order: () => resolved,
        then: resolved.then.bind(resolved),
        catch: resolved.catch.bind(resolved),
      };
      return c;
    }

    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => chain(table)),
    };
    vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);

    const fd = makeFormData({ period_ids: PERIOD_ID });
    const result = await exportCsv(null, fd);
    expect(result.success).toBe(true);
    // CSV has only header, no data rows
    const lines = result.csvContent?.split('\n') ?? [];
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('periodo');
  });

  it('handles null reporting_periods response from Supabase (defensive ?? [])', async () => {
    const baseData: Record<string, unknown> = {
      memberships: [{ organization_id: ORG_ID }],
      reporting_periods: null,
      suppliers: [{ id: SUPPLIER_ID, name: 'Test Corp', organization_id: ORG_ID }],
      emission_results: [],
      activity_entries: [],
      report_exports: [],
    };

    function chain(table: string) {
      const data = table in baseData ? baseData[table] : [];
      const resolved = Promise.resolve({ data });
      const c: Record<string, unknown> = {
        select: () => c, eq: () => c, in: () => c,
        insert: vi.fn().mockResolvedValue({ error: null }),
        order: () => resolved,
        then: resolved.then.bind(resolved),
        catch: resolved.catch.bind(resolved),
      };
      return c;
    }

    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => chain(table)),
    };
    vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);

    const fd = makeFormData({ period_ids: PERIOD_ID });
    const result = await exportCsv(null, fd);
    // Con reporting_periods null/vacío, el servidor rechaza por falta de periodos exportables
    expect(result.error).toBeTruthy();
  });

  it('handles null suppliers response from Supabase (defensive ?? [])', async () => {
    const baseData: Record<string, unknown> = {
      memberships: [{ organization_id: ORG_ID }],
      reporting_periods: [{ id: PERIOD_ID, label: 'Q1-2026', supplier_id: SUPPLIER_ID }],
      suppliers: null,
      emission_results: [],
      activity_entries: [],
      report_exports: [],
    };

    function chain(table: string) {
      const data = table in baseData ? baseData[table] : [];
      const resolved = Promise.resolve({ data });
      const c: Record<string, unknown> = {
        select: () => c, eq: () => c, in: () => c,
        insert: vi.fn().mockResolvedValue({ error: null }),
        order: () => resolved,
        then: resolved.then.bind(resolved),
        catch: resolved.catch.bind(resolved),
      };
      return c;
    }

    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => chain(table)),
    };
    vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);

    const fd = makeFormData({ period_ids: PERIOD_ID });
    const result = await exportCsv(null, fd);
    expect(result.error).toMatch(/acceso/i);
  });

  it('handles null emission_results response from Supabase (defensive ?? [])', async () => {
    const baseData: Record<string, unknown> = {
      memberships: [{ organization_id: ORG_ID }],
      reporting_periods: [{ id: PERIOD_ID, label: 'Q1-2026', supplier_id: SUPPLIER_ID }],
      suppliers: [{ id: SUPPLIER_ID, name: 'Test Corp', organization_id: ORG_ID }],
      emission_results: null,
      activity_entries: [],
      report_exports: [],
    };

    function chain(table: string) {
      const data = table in baseData ? baseData[table] : [];
      const resolved = Promise.resolve({ data });
      const c: Record<string, unknown> = {
        select: () => c, eq: () => c, in: () => c,
        insert: vi.fn().mockResolvedValue({ error: null }),
        order: () => resolved,
        then: resolved.then.bind(resolved),
        catch: resolved.catch.bind(resolved),
      };
      return c;
    }

    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => chain(table)),
    };
    vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);

    const fd = makeFormData({ period_ids: PERIOD_ID });
    const result = await exportCsv(null, fd);
    expect(result.error).toMatch(/resultados calculados/i);
  });

  it('handles null activity_entries response from Supabase (defensive ?? [])', async () => {
    const resultsData = [{
      id: RESULT_ID, activity_entry_id: ENTRY_ID, reporting_period_id: PERIOD_ID,
      scope: 1, co2e_kg: 42.5, factor_used: 2.1, factor_unit: 'kg CO2/unit',
      calc_hash: 'abc123', calc_version: '1.0.0', calculated_at: '2026-01-15T10:00:00Z',
    }];
    const baseData: Record<string, unknown> = {
      memberships: [{ organization_id: ORG_ID }],
      reporting_periods: [{ id: PERIOD_ID, label: 'Q1-2026', supplier_id: SUPPLIER_ID }],
      suppliers: [{ id: SUPPLIER_ID, name: 'Test Corp', organization_id: ORG_ID }],
      emission_results: resultsData,
      activity_entries: null,
      report_exports: [],
    };

    function chain(table: string) {
      const data = table in baseData ? baseData[table] : [];
      const resolved = Promise.resolve({ data });
      const c: Record<string, unknown> = {
        select: () => c, eq: () => c, in: () => c,
        insert: vi.fn().mockResolvedValue({ error: null }),
        order: () => resolved,
        then: resolved.then.bind(resolved),
        catch: resolved.catch.bind(resolved),
      };
      return c;
    }

    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => chain(table)),
    };
    vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);

    const fd = makeFormData({ period_ids: PERIOD_ID });
    const result = await exportCsv(null, fd);
    expect(result.success).toBe(true);
    const lines = result.csvContent?.split('\n') ?? [];
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('periodo');
  });

  it('rechaza periodos en estado open (solo under_review y locked exportables)', async () => {
    // El mock devuelve lista vacía para reporting_periods porque el filtro de status lo excluye
    const baseData: Record<string, unknown> = {
      memberships: [{ organization_id: ORG_ID }],
      reporting_periods: [], // open periods filtrados por status
      suppliers: [{ id: SUPPLIER_ID, name: 'Test Corp', organization_id: ORG_ID }],
      emission_results: [],
      activity_entries: [],
      report_exports: [],
    };

    function chain(table: string) {
      const data = table in baseData ? baseData[table] : [];
      const resolved = Promise.resolve({ data });
      const c: Record<string, unknown> = {
        select: () => c, eq: () => c, in: () => c,
        insert: vi.fn().mockResolvedValue({ error: null }),
        order: () => resolved,
        then: resolved.then.bind(resolved),
        catch: resolved.catch.bind(resolved),
      };
      return c;
    }

    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => chain(table)),
    };
    vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);

    const fd = makeFormData({ period_ids: PERIOD_ID });
    const result = await exportCsv(null, fd);
    expect(result.error).toMatch(/disponibles para exportación|revisión|bloqueados/i);
  });

  it('previene inyección de fórmulas CSV en nombre de proveedor', async () => {
    const resultsData = [
      {
        id: RESULT_ID,
        activity_entry_id: ENTRY_ID,
        reporting_period_id: PERIOD_ID,
        scope: 1,
        co2e_kg: 10,
        factor_used: 1,
        factor_unit: 'kg CO2/unit',
        calc_hash: 'abc',
        calc_version: '1.0.0',
        calculated_at: '2026-01-15T10:00:00Z',
      },
    ];
    const dataMap: Record<string, unknown[]> = {
      memberships: [{ organization_id: ORG_ID }],
      reporting_periods: [{ id: PERIOD_ID, label: 'Q1-2026', supplier_id: SUPPLIER_ID }],
      // Nombre de proveedor con prefijo de fórmula potencialmente malicioso
      suppliers: [{ id: SUPPLIER_ID, name: '=SUM(A1:A100)', organization_id: ORG_ID }],
      emission_results: resultsData,
      activity_entries: [{ id: ENTRY_ID, source_type: 'stationary_combustion', raw_quantity: 100, raw_unit: 'kWh' }],
      report_exports: [],
    };

    function chain(table: string) {
      const resolved = Promise.resolve({ data: dataMap[table] ?? [] });
      const c: Record<string, unknown> = {
        select: () => c, eq: () => c, in: () => c,
        insert: vi.fn().mockResolvedValue({ error: null }),
        order: () => resolved,
        then: resolved.then.bind(resolved),
        catch: resolved.catch.bind(resolved),
      };
      return c;
    }

    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => chain(table)),
    };
    vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);

    const fd = makeFormData({ period_ids: PERIOD_ID });
    const result = await exportCsv(null, fd);
    expect(result.success).toBe(true);
    // El CSV debe tener el valor escapado con comilla simple prefijada
    expect(result.csvContent).toContain("'=SUM(A1:A100)");
    // No debe aparecer como fórmula directa (sin prefijo de escape)
    const lines = result.csvContent?.split('\n') ?? [];
    const dataRow = lines[1] ?? '';
    expect(dataRow).not.toMatch(/,=SUM/); // sin coma seguida de = sin escape
  });
});
