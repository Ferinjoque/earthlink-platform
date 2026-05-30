import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  memberships = [{ organization_id: ORG_ID, role: 'admin' }],
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
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    then: vi.fn().mockResolvedValue({ data: returnData }),
    // Hacer la cadena thenable para que await funcione
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
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: dataMap[table] ?? [] }),
      };
      // Hacer que select().eq().then() funcione
      chain.select.mockReturnValue({
        ...chain,
        is: vi.fn().mockReturnThis(),
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

  it('returns error when more than 50 period_ids are provided', async () => {
    mockClient();
    const uuid = '00000000-0000-4000-8000-000000000001';
    const manyIds = Array(51).fill(uuid).join(',');
    const fd = makeFormData({ period_ids: manyIds });
    const result = await exportCsv(null, fd);
    expect(result.error).toMatch(/máximo 50/i);
  });

  it('returns error when user has no org memberships', async () => {
    mockClient({ memberships: [] });
    const fd = makeFormData({ period_ids: PERIOD_ID });
    const result = await exportCsv(null, fd);
    expect(result.error).toMatch(/permisos/i);
  });

  it('returns error when user has supplier role (no export permission)', async () => {
    mockClient({ memberships: [{ organization_id: ORG_ID, role: 'supplier' }] });
    const fd = makeFormData({ period_ids: PERIOD_ID });
    const result = await exportCsv(null, fd);
    expect(result.error).toMatch(/permisos/i);
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
      memberships: [{ organization_id: ORG_ID, role: 'admin' }],
      reporting_periods: [{ id: PERIOD_ID, label: 'Q1-2026', supplier_id: SUPPLIER_ID }],
      suppliers: [{ id: SUPPLIER_ID, name: 'Test Corp', organization_id: ORG_ID }],
      emission_results: resultsData,
      activity_entries: entriesData,
      report_exports: [],
    };

    // Construir cadena thenable para que await from(...).select(...).in(...) resuelva correctamente
    function chain(table: string) {
      const resolved = Promise.resolve({ data: dataMap[table] ?? [] });
      const c: Record<string, unknown> = {
        select: () => c,
        eq: () => c,
        in: () => c,
        is: () => c,
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
    // Los periodos existen pero supplier_id no pertenece a los proveedores de la org
    const dataMap: Record<string, unknown[]> = {
      memberships: [{ organization_id: ORG_ID, role: 'admin' }],
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
        is: () => c,
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
      memberships: [{ organization_id: ORG_ID, role: 'admin' }],
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
        is: () => c,
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
      memberships: [{ organization_id: ORG_ID, role: 'admin' }],
      reporting_periods: [{ id: PERIOD_ID, label: 'Q1-2026', supplier_id: SUPPLIER_ID }],
      // Nombre de proveedor con coma → activa el escape CSV
      suppliers: [{ id: SUPPLIER_ID, name: 'Test, Corp "Inc"', organization_id: ORG_ID }],
      emission_results: resultsData,
      activity_entries: [{ id: ENTRY_ID, source_type: 'stationary_combustion', raw_quantity: 100, raw_unit: 'kWh' }],
      report_exports: [],
    };

    function chain(table: string) {
      const resolved = Promise.resolve({ data: dataMap[table] ?? [] });
      const c: Record<string, unknown> = {
        select: () => c, eq: () => c, in: () => c, is: () => c,
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
      memberships: [{ organization_id: ORG_ID, role: 'admin' }],
      reporting_periods: [{ id: PERIOD_ID, label: 'Q1-2026', supplier_id: SUPPLIER_ID }],
      suppliers: [{ id: SUPPLIER_ID, name: 'Test Corp', organization_id: ORG_ID }],
      emission_results: resultsData,
      activity_entries: [{ id: ENTRY_ID, source_type: 'purchased_electricity', raw_quantity: 10, raw_unit: 'kWh\nwith newline' }],
      report_exports: [],
    };

    function chain(table: string) {
      const resolved = Promise.resolve({ data: dataMap[table] ?? [] });
      const c: Record<string, unknown> = {
        select: () => c, eq: () => c, in: () => c, is: () => c,
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
      memberships: [{ organization_id: ORG_ID, role: 'admin' }],
      reporting_periods: [{ id: PERIOD_ID, label: 'Q1-2026', supplier_id: SUPPLIER_ID }],
      suppliers: [{ id: SUPPLIER_ID, name: 'Test Corp', organization_id: ORG_ID }],
      emission_results: resultsData,
      activity_entries: [], // entrada no encontrada
      report_exports: [],
    };

    function chain(table: string) {
      const resolved = Promise.resolve({ data: dataMap[table] ?? [] });
      const c: Record<string, unknown> = {
        select: () => c, eq: () => c, in: () => c, is: () => c,
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
    // El CSV solo tiene encabezado, sin filas de datos
    const lines = result.csvContent?.split('\n') ?? [];
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('periodo');
  });

  it('excluye de CSV los emission_results de entradas anuladas (voided_at filter)', async () => {
    const ACTIVE_ENTRY_ID = 'a0000000-0000-4000-8000-000000000001';
    const resultsData = [
      {
        id: RESULT_ID, activity_entry_id: ENTRY_ID, reporting_period_id: PERIOD_ID,
        scope: 1, co2e_kg: 99.9, factor_used: 1, factor_unit: 'kg CO2/unit',
        calc_hash: 'stale', calc_version: '1.0.0', calculated_at: '2026-01-15T10:00:00Z',
      },
      {
        id: 'r2', activity_entry_id: ACTIVE_ENTRY_ID, reporting_period_id: PERIOD_ID,
        scope: 1, co2e_kg: 10, factor_used: 1, factor_unit: 'kg CO2/unit',
        calc_hash: 'fresh', calc_version: '1.0.0', calculated_at: '2026-01-15T10:00:00Z',
      },
    ];
    const dataMap: Record<string, unknown[]> = {
      memberships: [{ organization_id: ORG_ID, role: 'admin' }],
      reporting_periods: [{ id: PERIOD_ID, label: 'Q1-2026', supplier_id: SUPPLIER_ID }],
      suppliers: [{ id: SUPPLIER_ID, name: 'Test Corp', organization_id: ORG_ID }],
      emission_results: resultsData,
      // Solo la entrada activa — la anulada (ENTRY_ID) fue filtrada por .is('voided_at', null)
      activity_entries: [{ id: ACTIVE_ENTRY_ID, source_type: 'purchased_electricity', raw_quantity: 10, raw_unit: 'kWh' }],
      report_exports: [],
    };

    function chain(table: string) {
      const resolved = Promise.resolve({ data: dataMap[table] ?? [] });
      const c: Record<string, unknown> = {
        select: () => c, eq: () => c, in: () => c, is: () => c,
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
    // Solo 1 fila de datos (la activa), la anulada fue excluida
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('purchased_electricity');
    expect(lines[1]).not.toContain('99.9'); // el co2e de la entrada anulada no aparece
  });

  it('handles null reporting_periods response from Supabase (defensive ?? [])', async () => {
    const baseData: Record<string, unknown> = {
      memberships: [{ organization_id: ORG_ID, role: 'admin' }],
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
        select: () => c, eq: () => c, in: () => c, is: () => c,
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
      memberships: [{ organization_id: ORG_ID, role: 'admin' }],
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
        select: () => c, eq: () => c, in: () => c, is: () => c,
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
      memberships: [{ organization_id: ORG_ID, role: 'admin' }],
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
        select: () => c, eq: () => c, in: () => c, is: () => c,
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
      memberships: [{ organization_id: ORG_ID, role: 'admin' }],
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
        select: () => c, eq: () => c, in: () => c, is: () => c,
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
      memberships: [{ organization_id: ORG_ID, role: 'admin' }],
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
        select: () => c, eq: () => c, in: () => c, is: () => c,
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
      memberships: [{ organization_id: ORG_ID, role: 'admin' }],
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
        select: () => c, eq: () => c, in: () => c, is: () => c,
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

  it('realiza un único insert batch en report_exports al exportar múltiples orgs', async () => {
    const ORG2 = 'eeee0000-0000-0000-0000-000000000099';
    const SUPPLIER2 = 'ffff0000-0000-0000-0000-000000000099';
    const PERIOD2 = '1111aaaa-0000-4000-8000-000000000099';
    const RESULT2 = '2222bbbb-0000-4000-8000-000000000099';
    const ENTRY2 = '3333cccc-0000-4000-8000-000000000099';

    const resultsData = [
      {
        id: RESULT_ID, activity_entry_id: ENTRY_ID, reporting_period_id: PERIOD_ID,
        scope: 1, co2e_kg: 10, factor_used: 1, factor_unit: 'kg CO2/unit',
        calc_hash: 'abc', calc_version: '1.0', calculated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: RESULT2, activity_entry_id: ENTRY2, reporting_period_id: PERIOD2,
        scope: 1, co2e_kg: 20, factor_used: 2, factor_unit: 'kg CO2/unit',
        calc_hash: 'def', calc_version: '1.0', calculated_at: '2026-01-01T00:00:00Z',
      },
    ];

    const dataMap: Record<string, unknown[]> = {
      memberships: [{ organization_id: ORG_ID, role: 'admin' }, { organization_id: ORG2, role: 'admin' }],
      reporting_periods: [
        { id: PERIOD_ID, label: 'Q1-2026', supplier_id: SUPPLIER_ID },
        { id: PERIOD2, label: 'Q1-2026', supplier_id: SUPPLIER2 },
      ],
      suppliers: [
        { id: SUPPLIER_ID, name: 'Corp A', organization_id: ORG_ID },
        { id: SUPPLIER2, name: 'Corp B', organization_id: ORG2 },
      ],
      emission_results: resultsData,
      activity_entries: [
        { id: ENTRY_ID, source_type: 'stationary_combustion', raw_quantity: 10, raw_unit: 'kWh' },
        { id: ENTRY2, source_type: 'stationary_combustion', raw_quantity: 20, raw_unit: 'kWh' },
      ],
      report_exports: [],
    };

    const insertSpy = vi.fn().mockResolvedValue({ error: null });

    function chain(table: string) {
      const resolved = Promise.resolve({ data: dataMap[table] ?? [] });
      const c: Record<string, unknown> = {
        select: () => c, eq: () => c, in: () => c, is: () => c,
        insert: table === 'report_exports' ? insertSpy : vi.fn().mockResolvedValue({ error: null }),
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

    const fd = makeFormData({ period_ids: `${PERIOD_ID},${PERIOD2}` });
    const result = await exportCsv(null, fd);

    expect(result.success).toBe(true);
    // El insert debe haberse llamado exactamente UNA vez (batch, no N veces)
    expect(insertSpy).toHaveBeenCalledTimes(1);
    // Y debe haberse llamado con un array de 2 registros (una por org)
    const insertArg = insertSpy.mock.calls[0]?.[0];
    expect(Array.isArray(insertArg)).toBe(true);
    expect((insertArg as unknown[]).length).toBe(2);
  });
});
