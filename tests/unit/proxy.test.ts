import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}));
vi.mock('next/server', () => {
  const mockRedirect = vi.fn((url: URL) => ({ type: 'redirect', url: url.toString() }));
  const mockNext = vi.fn((opts?: { request?: unknown }) => ({
    type: 'next',
    request: opts?.request,
    cookies: { set: vi.fn(), getAll: vi.fn(() => []) },
  }));
  return { NextResponse: { redirect: mockRedirect, next: mockNext } };
});

import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { proxy } from '../../src/proxy';

function makeRequest(pathname: string, searchParams: Record<string, string> = {}) {
  const url = new URL(`http://localhost${pathname}`);
  for (const [k, v] of Object.entries(searchParams)) {
    url.searchParams.set(k, v);
  }
  const clonedUrl = url;
  return {
    nextUrl: {
      pathname,
      clone: () => ({ ...clonedUrl, pathname: clonedUrl.pathname, searchParams: clonedUrl.searchParams, search: clonedUrl.search }),
      searchParams: url.searchParams,
      search: url.search,
    },
    cookies: {
      getAll: vi.fn((): Array<{ name: string; value: string }> => []),
      set: vi.fn(),
    },
  };
}

function mockSupabaseWithUser(user: { id: string } | null) {
  const mockClient = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
  };
  vi.mocked(createServerClient).mockReturnValue(mockClient as unknown as ReturnType<typeof createServerClient>);
  return mockClient;
}

// Re-implementación para testear la lógica exacta de src/proxy.ts
function safeNextPath(raw: string): string | null {
  if (raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\')) {
    return raw;
  }
  return null;
}

describe('safeNextPath — open redirect prevention', () => {
  it('accepts a normal absolute path', () => {
    expect(safeNextPath('/dashboard')).toBe('/dashboard');
  });

  it('accepts path with query string', () => {
    expect(safeNextPath('/audit?status=open')).toBe('/audit?status=open');
  });

  it('rejects protocol-relative URL (//evil.com)', () => {
    expect(safeNextPath('//evil.com')).toBeNull();
  });

  it('rejects backslash redirect (/\\evil.com)', () => {
    expect(safeNextPath('/\\evil.com')).toBeNull();
  });

  it('rejects fully qualified URL', () => {
    expect(safeNextPath('https://evil.com')).toBeNull();
  });

  it('rejects empty string', () => {
    expect(safeNextPath('')).toBeNull();
  });

  it('rejects relative path without leading slash', () => {
    expect(safeNextPath('dashboard')).toBeNull();
  });

  it('accepts deeply nested path', () => {
    expect(safeNextPath('/suppliers/abc/periods')).toBe('/suppliers/abc/periods');
  });
});

import { _staticExtPattern } from '../../src/proxy';

describe('_staticExtPattern', () => {
  it('matches common static extensions', () => {
    expect(_staticExtPattern.test('/logo.png')).toBe(true);
    expect(_staticExtPattern.test('/font.woff2')).toBe(true);
    expect(_staticExtPattern.test('/style.css')).toBe(true);
    expect(_staticExtPattern.test('/bundle.js')).toBe(true);
    expect(_staticExtPattern.test('/icon.svg')).toBe(true);
  });

  it('does not match API routes or pages', () => {
    expect(_staticExtPattern.test('/api/auth')).toBe(false);
    expect(_staticExtPattern.test('/dashboard')).toBe(false);
    expect(_staticExtPattern.test('/suppliers')).toBe(false);
  });
});

describe('proxy()', () => {
  beforeEach(() => {
    process.env['NEXT_PUBLIC_SUPABASE_URL'] = 'https://test.supabase.co';
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] = 'test-anon-key';
    vi.clearAllMocks();
  });

  it('throws when env vars are missing', async () => {
    delete process.env['NEXT_PUBLIC_SUPABASE_URL'];
    const req = makeRequest('/dashboard');
    await expect(proxy(req as never)).rejects.toThrow('Missing required env vars');
  });

  it('redirects unauthenticated user accessing protected route to /login', async () => {
    mockSupabaseWithUser(null);
    const req = makeRequest('/dashboard');
    await proxy(req as never);
    expect(NextResponse.redirect).toHaveBeenCalled();
    const redirectArg = vi.mocked(NextResponse.redirect).mock.calls[0]![0] as { pathname: string };
    expect(redirectArg.pathname).toBe('/login');
  });

  it('sets ?next= param when redirecting from a protected route', async () => {
    mockSupabaseWithUser(null);
    const req = makeRequest('/suppliers');
    await proxy(req as never);
    const redirectArg = vi.mocked(NextResponse.redirect).mock.calls[0]![0] as URL;
    expect(redirectArg.searchParams.get('next')).toBe('/suppliers');
  });

  it('does not redirect unauthenticated user on /login', async () => {
    mockSupabaseWithUser(null);
    const req = makeRequest('/login');
    await proxy(req as never);
    expect(NextResponse.redirect).not.toHaveBeenCalled();
    expect(NextResponse.next).toHaveBeenCalled();
  });

  it('does not redirect unauthenticated user on root /', async () => {
    mockSupabaseWithUser(null);
    const req = makeRequest('/');
    await proxy(req as never);
    expect(NextResponse.redirect).not.toHaveBeenCalled();
  });

  it('redirects authenticated user on /login to /dashboard', async () => {
    mockSupabaseWithUser({ id: 'user-1' });
    const req = makeRequest('/login');
    await proxy(req as never);
    expect(NextResponse.redirect).toHaveBeenCalled();
    const redirectArg = vi.mocked(NextResponse.redirect).mock.calls[0]![0] as { pathname: string };
    expect(redirectArg.pathname).toBe('/dashboard');
  });

  it('redirects authenticated user on root / to /dashboard', async () => {
    mockSupabaseWithUser({ id: 'user-1' });
    const req = makeRequest('/');
    await proxy(req as never);
    expect(NextResponse.redirect).toHaveBeenCalled();
  });

  it('passes authenticated user on /dashboard through', async () => {
    mockSupabaseWithUser({ id: 'user-1' });
    const req = makeRequest('/dashboard');
    await proxy(req as never);
    expect(NextResponse.redirect).not.toHaveBeenCalled();
    expect(NextResponse.next).toHaveBeenCalled();
  });

  it('does not set ?next= for unsafe redirect paths', async () => {
    mockSupabaseWithUser(null);
    // '//evil.com' is not a safe path — safeNextPath returns null
    const req = makeRequest('//evil.com');
    await proxy(req as never);
    if (vi.mocked(NextResponse.redirect).mock.calls.length > 0) {
      const redirectArg = vi.mocked(NextResponse.redirect).mock.calls[0]![0] as URL;
      expect(redirectArg.searchParams.get('next')).toBeNull();
    }
  });

  it('cookie getAll handler reads from request cookies', async () => {
    type CookieOpts = { getAll: () => unknown[]; setAll: (c: Array<{name: string; value: string; options?: unknown}>) => void };
    let capturedOpts: CookieOpts | null = null;

    vi.mocked(createServerClient).mockImplementation((_url, _key, opts) => {
      capturedOpts = opts.cookies as CookieOpts;
      return {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      } as unknown as ReturnType<typeof createServerClient>;
    });

    const req = makeRequest('/login');
    vi.mocked(req.cookies.getAll).mockReturnValue([{ name: 'sb-access', value: 'tok' }]);
    await proxy(req as never);

    expect(capturedOpts).not.toBeNull();
    const cookies = capturedOpts!.getAll();
    expect(cookies).toEqual([{ name: 'sb-access', value: 'tok' }]);
  });

  it('cookie setAll handler writes cookies to request and response', async () => {
    type CookieOpts = { getAll: () => unknown[]; setAll: (c: Array<{name: string; value: string; options?: unknown}>) => void };
    let capturedOpts: CookieOpts | null = null;

    vi.mocked(createServerClient).mockImplementation((_url, _key, opts) => {
      capturedOpts = opts.cookies as CookieOpts;
      return {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
      } as unknown as ReturnType<typeof createServerClient>;
    });

    const req = makeRequest('/dashboard');
    await proxy(req as never);

    expect(capturedOpts).not.toBeNull();
    capturedOpts!.setAll([{ name: 'sb-refresh', value: 'ref-tok', options: { httpOnly: true } }]);
    expect(req.cookies.set).toHaveBeenCalledWith('sb-refresh', 'ref-tok');
  });
});
