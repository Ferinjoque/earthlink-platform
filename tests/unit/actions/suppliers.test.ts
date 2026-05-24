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
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

import { createServerClient } from '../../../src/services/supabase/server';
import { createSupplier, updateSupplier, archiveSupplier } from '../../../src/actions/suppliers';

type MockClient = Awaited<ReturnType<typeof createServerClient>>;

const VALID_USER_ID = '00000000-0000-4000-8000-000000000001';
const VALID_ORG_ID = '00000000-0000-4000-8000-000000000002';
const VALID_SUPPLIER_ID = '00000000-0000-4000-8000-000000000003';

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

function mockClient({
  role = 'admin',
  supplierOrgId = VALID_ORG_ID,
  supplierFound = true,
  membershipFound = true,
  insertError = null as null | { message: string },
  updateError = null as null | { message: string },
  archivedAt = null as string | null,
}: {
  role?: string;
  supplierOrgId?: string;
  supplierFound?: boolean;
  membershipFound?: boolean;
  insertError?: null | { message: string };
  updateError?: null | { message: string };
  archivedAt?: string | null;
} = {}) {
  const singleMock = vi.fn().mockImplementation((table: string) => {
    if (table === 'suppliers') {
      const data = supplierFound ? { organization_id: supplierOrgId, archived_at: archivedAt } : null;
      return Promise.resolve({ data, error: null });
    }
    if (table === 'memberships') {
      const data = membershipFound ? { role } : null;
      return Promise.resolve({ data, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });

  const updateResult = { eq: vi.fn().mockResolvedValue({ error: updateError }) };

  const chainBuilder = (table: string) => {
    const currentTable = table;
    const chain: Record<string, unknown> = {};
    chain['select'] = () => chain;
    chain['eq'] = () => chain;
    chain['limit'] = () => chain;
    chain['is'] = () => chain;
    chain['in'] = () => chain;
    chain['order'] = () => chain;
    chain['insert'] = vi.fn().mockResolvedValue({ error: insertError });
    chain['update'] = vi.fn().mockReturnValue(updateResult);
    chain['single'] = () => singleMock(currentTable);
    chain['maybeSingle'] = () => singleMock(currentTable);
    return chain;
  };

  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: VALID_USER_ID, email: 'admin@earthlink.test' } },
      }),
    },
    from: vi.fn((table: string) => chainBuilder(table)),
  };

  vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);
  return client;
}

describe('createSupplier', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects empty nombre', async () => {
    mockClient();
    const fd = makeFormData({
      nombre: '',
      categoria: 'Manufactura',
      organization_id: VALID_ORG_ID,
    });
    const result = await createSupplier(null, fd);
    expect(result.error).toMatch(/menos 2 caract/i);
    expect(result.success).toBeUndefined();
  });

  it('rejects empty categoria', async () => {
    mockClient();
    const fd = makeFormData({
      nombre: 'Proveedor A',
      categoria: '',
      organization_id: VALID_ORG_ID,
    });
    const result = await createSupplier(null, fd);
    expect(result.error).toMatch(/categoría válida/i);
  });

  it('rejects invalid organization_id UUID', async () => {
    mockClient();
    const fd = makeFormData({
      nombre: 'Proveedor A',
      categoria: 'Manufactura',
      organization_id: 'not-a-uuid',
    });
    const result = await createSupplier(null, fd);
    expect(result.error).toMatch(/inválido/i);
  });

  it('returns error when not authenticated', async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      from: vi.fn(),
    };
    vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);

    const fd = makeFormData({
      nombre: 'Proveedor A',
      categoria: 'Manufactura',
      organization_id: VALID_ORG_ID,
    });
    const result = await createSupplier(null, fd);
    expect(result.error).toMatch(/autenticado/i);
  });

  it('returns error when user lacks org permission (supplier role)', async () => {
    mockClient({ role: 'supplier' });
    const fd = makeFormData({
      nombre: 'Proveedor A',
      categoria: 'Manufactura',
      organization_id: VALID_ORG_ID,
    });
    const result = await createSupplier(null, fd);
    expect(result.error).toMatch(/permisos/i);
  });

  it('returns error when membership is null', async () => {
    mockClient({ membershipFound: false });
    const fd = makeFormData({
      nombre: 'Proveedor A',
      categoria: 'Manufactura',
      organization_id: VALID_ORG_ID,
    });
    const result = await createSupplier(null, fd);
    expect(result.error).toMatch(/permisos/i);
  });

  it('returns error when DB insert fails', async () => {
    mockClient({ insertError: { message: 'duplicate key' } });
    const fd = makeFormData({
      nombre: 'Proveedor A',
      categoria: 'Manufactura',
      organization_id: VALID_ORG_ID,
    });
    const result = await createSupplier(null, fd);
    expect(result.error).toMatch(/Error al guardar/i);
  });

  it('returns success on valid create', async () => {
    mockClient();
    const fd = makeFormData({
      nombre: 'Proveedor A',
      categoria: 'Manufactura',
      organization_id: VALID_ORG_ID,
    });
    const result = await createSupplier(null, fd);
    expect(result.success).toBe(true);
  });
});

describe('archiveSupplier', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error when not authenticated', async () => {
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    };
    vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);
    const fd = makeFormData({ id: VALID_SUPPLIER_ID });
    const result = await archiveSupplier(null, fd);
    expect(result.error).toMatch(/autenticado/i);
  });

  it('rejects when role is not admin', async () => {
    mockClient({ role: 'consultant' });
    const fd = makeFormData({ id: VALID_SUPPLIER_ID });
    const result = await archiveSupplier(null, fd);
    expect(result.error).toMatch(/administrador/i);
  });

  it('rejects missing or invalid id', async () => {
    mockClient();
    const fd = makeFormData({ id: '' });
    const result = await archiveSupplier(null, fd);
    expect(result.error).toMatch(/inválido/i);
  });

  it('rejects non-UUID id format', async () => {
    mockClient();
    const fd = makeFormData({ id: 'not-a-uuid' });
    const result = await archiveSupplier(null, fd);
    expect(result.error).toMatch(/inválido/i);
  });

  it('returns error when supplier not found', async () => {
    mockClient({ supplierFound: false });
    const fd = makeFormData({ id: VALID_SUPPLIER_ID });
    const result = await archiveSupplier(null, fd);
    expect(result.error).toMatch(/encontrado/i);
  });

  it('returns error when DB update fails', async () => {
    mockClient({ updateError: { message: 'row-level security' } });
    const fd = makeFormData({ id: VALID_SUPPLIER_ID });
    const result = await archiveSupplier(null, fd);
    expect(result.error).toMatch(/Error al guardar/i);
  });

  it('returns success when admin archives supplier', async () => {
    mockClient();
    const fd = makeFormData({ id: VALID_SUPPLIER_ID });
    const result = await archiveSupplier(null, fd);
    expect(result.success).toBe(true);
  });

  it('returns error when supplier is already archived', async () => {
    mockClient({ archivedAt: '2024-01-01T00:00:00Z' });
    const fd = makeFormData({ id: VALID_SUPPLIER_ID });
    const result = await archiveSupplier(null, fd);
    expect(result.error).toMatch(/ya está archivado/i);
  });
});

describe('updateSupplier', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error when not authenticated', async () => {
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    };
    vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);
    const fd = makeFormData({ id: VALID_SUPPLIER_ID, nombre: 'Updated', categoria: 'Manufactura' });
    const result = await updateSupplier(null, fd);
    expect(result.error).toMatch(/autenticado/i);
  });

  it('returns error when id is not a valid UUID', async () => {
    mockClient();
    const fd = makeFormData({ id: 'not-a-uuid', nombre: 'Updated', categoria: 'Manufactura' });
    const result = await updateSupplier(null, fd);
    expect(result.error).toBeTruthy();
  });

  it('returns error when nombre is too short', async () => {
    mockClient();
    const fd = makeFormData({ id: VALID_SUPPLIER_ID, nombre: 'X', categoria: 'Manufactura' });
    const result = await updateSupplier(null, fd);
    expect(result.error).toMatch(/menos 2 caract/i);
  });

  it('returns error when categoria is invalid', async () => {
    mockClient();
    const fd = makeFormData({ id: VALID_SUPPLIER_ID, nombre: 'Updated', categoria: 'InvalidCat' });
    const result = await updateSupplier(null, fd);
    expect(result.error).toMatch(/categoría válida/i);
  });

  it('returns error when supplier not found', async () => {
    mockClient({ supplierFound: false });
    const fd = makeFormData({ id: VALID_SUPPLIER_ID, nombre: 'Updated', categoria: 'Manufactura' });
    const result = await updateSupplier(null, fd);
    expect(result.error).toMatch(/encontrado/i);
  });

  it('returns error when user lacks permission', async () => {
    mockClient({ membershipFound: false });
    const fd = makeFormData({ id: VALID_SUPPLIER_ID, nombre: 'Updated', categoria: 'Manufactura' });
    const result = await updateSupplier(null, fd);
    expect(result.error).toMatch(/permisos/i);
  });

  it('returns error when DB update fails', async () => {
    mockClient({ updateError: { message: 'unique constraint' } });
    const fd = makeFormData({ id: VALID_SUPPLIER_ID, nombre: 'Updated', categoria: 'Manufactura' });
    const result = await updateSupplier(null, fd);
    expect(result.error).toMatch(/Error al guardar/i);
  });

  it('returns success with valid input as admin', async () => {
    mockClient();
    const fd = makeFormData({ id: VALID_SUPPLIER_ID, nombre: 'Updated Name', categoria: 'Manufactura' });
    const result = await updateSupplier(null, fd);
    expect(result.success).toBe(true);
  });

  it('returns success with consultant role', async () => {
    mockClient({ role: 'consultant' });
    const fd = makeFormData({ id: VALID_SUPPLIER_ID, nombre: 'Updated Name', categoria: 'Manufactura' });
    const result = await updateSupplier(null, fd);
    expect(result.success).toBe(true);
  });
});

describe('createPeriod Zod validation', () => {
  it('rejects when fecha_fin is before fecha_inicio', async () => {
    const { z } = await import('zod');

    const schema = z
      .object({
        supplier_id: z.string().uuid(),
        label: z.string().min(1),
        fecha_inicio: z.string().min(1),
        fecha_fin: z.string().min(1),
      })
      .refine(
        (d) => new Date(d.fecha_fin) > new Date(d.fecha_inicio),
        { message: 'La fecha de fin debe ser posterior a la fecha de inicio', path: ['fecha_fin'] },
      );

    const result = schema.safeParse({
      supplier_id: VALID_SUPPLIER_ID,
      label: 'Q2-2026',
      fecha_inicio: '2026-06-30',
      fecha_fin: '2026-01-01',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/posterior/i);
    }
  });

  it('accepts valid period', async () => {
    const { z } = await import('zod');

    const schema = z
      .object({
        supplier_id: z.string().uuid(),
        label: z.string().min(1),
        fecha_inicio: z.string().min(1),
        fecha_fin: z.string().min(1),
      })
      .refine(
        (d) => new Date(d.fecha_fin) > new Date(d.fecha_inicio),
        { message: 'La fecha de fin debe ser posterior a la fecha de inicio', path: ['fecha_fin'] },
      );

    const result = schema.safeParse({
      supplier_id: VALID_SUPPLIER_ID,
      label: 'Q2-2026',
      fecha_inicio: '2026-04-01',
      fecha_fin: '2026-06-30',
    });
    expect(result.success).toBe(true);
  });
});
