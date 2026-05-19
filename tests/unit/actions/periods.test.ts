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
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { createServerClient } from '../../../src/services/supabase/server';
import { createPeriod } from '../../../src/actions/periods';

type MockClient = Awaited<ReturnType<typeof createServerClient>>;

const VALID_UUID = '11111111-1111-1111-1111-111111111111';
const SUPPLIER_UUID = '22222222-2222-2222-2222-222222222222';
const ORG_UUID = '33333333-3333-3333-3333-333333333333';

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

type MockBehavior = {
  user?: { id: string } | null;
  supplierOrg?: string | null;
  memberRole?: string | null;
  insertError?: string | null;
};

function mockClient({
  user = { id: VALID_UUID },
  supplierOrg = ORG_UUID,
  memberRole = 'admin',
  insertError = null,
}: MockBehavior = {}) {
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    from: vi.fn().mockImplementation((table: string) => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: insertError ? { message: insertError } : null }),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data:
          table === 'suppliers'
            ? supplierOrg !== null
              ? { organization_id: supplierOrg }
              : null
            : memberRole !== null
              ? { role: memberRole }
              : null,
      }),
    })),
  };
  vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);
  return client;
}

const validFields = {
  supplier_id: SUPPLIER_UUID,
  label: 'Q1-2026',
  fecha_inicio: '2026-01-01',
  fecha_fin: '2026-03-31',
};

beforeEach(() => vi.clearAllMocks());

describe('createPeriod', () => {
  it('returns error when not authenticated', async () => {
    mockClient({ user: null });
    const result = await createPeriod(null, makeFormData(validFields));
    expect(result.error).toMatch(/autenticado/i);
  });

  it('returns error when supplier_id is not a valid UUID', async () => {
    mockClient();
    const result = await createPeriod(
      null,
      makeFormData({ ...validFields, supplier_id: 'not-a-uuid' }),
    );
    expect(result.error).toBeTruthy();
  });

  it('returns error when label is empty', async () => {
    mockClient();
    const result = await createPeriod(null, makeFormData({ ...validFields, label: '' }));
    expect(result.error).toBeTruthy();
  });

  it('returns error when fecha_fin is before fecha_inicio', async () => {
    mockClient();
    const result = await createPeriod(
      null,
      makeFormData({ ...validFields, fecha_inicio: '2026-03-31', fecha_fin: '2026-01-01' }),
    );
    expect(result.error).toMatch(/posterior/i);
  });

  it('returns error when supplier not found', async () => {
    mockClient({ supplierOrg: null });
    const result = await createPeriod(null, makeFormData(validFields));
    expect(result.error).toMatch(/encontrado/i);
  });

  it('returns error when user lacks membership', async () => {
    mockClient({ memberRole: null });
    const result = await createPeriod(null, makeFormData(validFields));
    expect(result.error).toMatch(/permisos/i);
  });

  it('returns error when role is supplier (no permission)', async () => {
    mockClient({ memberRole: 'supplier' });
    const result = await createPeriod(null, makeFormData(validFields));
    expect(result.error).toMatch(/permisos/i);
  });

  it('returns error when DB insert fails', async () => {
    mockClient({ insertError: 'duplicate key' });
    const result = await createPeriod(null, makeFormData(validFields));
    expect(result.error).toBeTruthy();
  });

  it('returns success on valid input with admin role', async () => {
    mockClient();
    const result = await createPeriod(null, makeFormData(validFields));
    expect(result.success).toBe(true);
  });

  it('returns success with consultant role', async () => {
    mockClient({ memberRole: 'consultant' });
    const result = await createPeriod(null, makeFormData(validFields));
    expect(result.success).toBe(true);
  });
});
