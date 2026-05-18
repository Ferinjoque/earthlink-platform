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
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

import { createServerClient } from '../../../src/services/supabase/server';
import { redirect } from 'next/navigation';
import { signIn, signOut } from '../../../src/actions/auth';

const mockRedirect = vi.mocked(redirect);

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

function mockClient({
  signInError = null as { message: string } | null,
} = {}) {
  const client = {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ error: signInError }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  };
  vi.mocked(createServerClient).mockResolvedValue(client as never);
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── signIn ─────────────────────────────────────────────────────────────────────

describe('signIn', () => {
  it('returns error when email field absent from FormData', async () => {
    const fd = makeFormData({ password: 'secret' });
    const result = await signIn(undefined, fd);
    expect(result.error).toMatch(/inválidos/i);
  });

  it('returns error when email is blank', async () => {
    const fd = makeFormData({ email: '   ', password: 'secret' });
    const result = await signIn(undefined, fd);
    expect(result.error).toMatch(/obligatorio/i);
  });

  it('returns error when password missing', async () => {
    const fd = makeFormData({ email: 'user@example.com', password: '' });
    const result = await signIn(undefined, fd);
    expect(result.error).toMatch(/obligatorio/i);
  });

  it('returns error when form data type invalid', async () => {
    const fd = new FormData();
    const result = await signIn(undefined, fd);
    expect(result.error).toBeTruthy();
  });

  it('returns supabase error message on failed login', async () => {
    mockClient({ signInError: { message: 'Invalid login credentials' } });
    const fd = makeFormData({ email: 'bad@example.com', password: 'wrong' });
    const result = await signIn(undefined, fd);
    expect(result.error).toBe('Invalid login credentials');
  });

  it('redirects to /dashboard on success', async () => {
    mockClient();
    const fd = makeFormData({ email: 'admin@earthlink.test', password: 'correct' });
    await signIn(undefined, fd).catch(() => {});
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
  });

  it('redirects to ?next path when present and valid', async () => {
    mockClient();
    const fd = makeFormData({
      email: 'admin@earthlink.test',
      password: 'correct',
      next: '/audit',
    });
    await signIn(undefined, fd).catch(() => {});
    expect(mockRedirect).toHaveBeenCalledWith('/audit');
  });

  it('falls back to /dashboard when ?next is external URL', async () => {
    mockClient();
    const fd = makeFormData({
      email: 'admin@earthlink.test',
      password: 'correct',
      next: 'https://evil.com',
    });
    await signIn(undefined, fd).catch(() => {});
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
  });

  it('falls back to /dashboard when ?next is protocol-relative', async () => {
    mockClient();
    const fd = makeFormData({
      email: 'admin@earthlink.test',
      password: 'correct',
      next: '//evil.com',
    });
    await signIn(undefined, fd).catch(() => {});
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
  });

  it('trims whitespace from email before auth', async () => {
    const client = mockClient();
    const fd = makeFormData({ email: '  admin@earthlink.test  ', password: 'correct' });
    await signIn(undefined, fd).catch(() => {});
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'admin@earthlink.test' }),
    );
  });
});

// ── signOut ────────────────────────────────────────────────────────────────────

describe('signOut', () => {
  it('calls supabase signOut and redirects to /login', async () => {
    const client = mockClient();
    await signOut().catch(() => {});
    expect(client.auth.signOut).toHaveBeenCalledOnce();
    expect(mockRedirect).toHaveBeenCalledWith('/login');
  });
});
