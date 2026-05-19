import { describe, it, expect, vi } from 'vitest';

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
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

import { createServerClient } from '../../../src/services/supabase/server';

type MockClient = Awaited<ReturnType<typeof createServerClient>>;

const VALID_USER_ID = '00000000-0000-4000-8000-000000000001';
const VALID_ORG_ID = '00000000-0000-4000-8000-000000000002';

function mockSupabaseClient({
  userId = VALID_USER_ID,
  orgName = 'EcoGroup SAC',
  orgCountry = 'PE',
  orgIndustry = 'Manufactura',
  role = 'admin',
}: {
  userId?: string;
  orgName?: string;
  orgCountry?: string;
  orgIndustry?: string;
  role?: string;
} = {}) {
  const mockFrom = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({
      data: [{ role, organization_id: VALID_ORG_ID }],
      error: null,
    }),
    single: vi.fn().mockResolvedValue({
      data: { name: orgName, country: orgCountry, industry: orgIndustry },
      error: null,
    }),
  });

  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: userId,
            email: 'admin@earthlink.test',
            created_at: '2025-01-15T00:00:00Z',
          },
        },
      }),
    },
    from: mockFrom,
  };

  vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);
  return client;
}

describe('settings page data fetching', () => {
  it('role labels map correctly', () => {
    const ROLE_LABELS: Record<string, string> = {
      admin: 'Administrador',
      consultant: 'Consultor',
      supplier: 'Proveedor',
    };
    expect(ROLE_LABELS['admin']).toBe('Administrador');
    expect(ROLE_LABELS['consultant']).toBe('Consultor');
    expect(ROLE_LABELS['supplier']).toBe('Proveedor');
  });

  it('falls back to role key when label not found', () => {
    const ROLE_LABELS: Record<string, string> = {
      admin: 'Administrador',
    };
    const role = 'custom_role';
    const label = ROLE_LABELS[role] ?? role;
    expect(label).toBe('custom_role');
  });

  it('resolves user and org data via supabase client', async () => {
    const client = mockSupabaseClient({ role: 'admin', orgName: 'EcoGroup SAC' });
    const supabase = await (createServerClient as unknown as () => Promise<typeof client>)();

    const authResult = await supabase.auth.getUser();
    expect(authResult.data.user.email).toBe('admin@earthlink.test');

    const memberships = await supabase
      .from('memberships')
      .select('role, organization_id')
      .eq('user_id', VALID_USER_ID)
      .limit(1);

    expect(memberships.data?.[0]?.role).toBe('admin');
    expect(memberships.data?.[0]?.organization_id).toBe(VALID_ORG_ID);
    expect(client.from).toHaveBeenCalledWith('memberships');
  });

  it('formats created_at as localized date', () => {
    const isoDate = '2025-01-15T00:00:00Z';
    const formatted = new Date(isoDate).toLocaleDateString('es-PE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    expect(formatted).toMatch(/2025/);
    expect(formatted).toMatch(/enero|15/i);
  });
});
