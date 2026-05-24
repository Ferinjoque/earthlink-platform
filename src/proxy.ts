import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/signup', '/robots.txt', '/sitemap.xml'];
const STATIC_EXT = /\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|css|js)$/;

function safeNextPath(raw: string): string | null {
  if (raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\')) {
    return raw;
  }
  return null;
}

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const supabaseAnonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY',
    );
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // Refrescar sesión — se debe llamar getUser() y no getSession() según docs de @supabase/ssr
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.includes(pathname) || pathname === '/';

  if (!user && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    const safePath = safeNextPath(pathname);
    if (safePath) loginUrl.searchParams.set('next', safePath);
    return NextResponse.redirect(loginUrl);
  }

  if (user && (pathname === '/login' || pathname === '/signup' || pathname === '/')) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    dashboardUrl.search = '';
    return NextResponse.redirect(dashboardUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|css|js)$).*)',
  ],
};

export { STATIC_EXT as _staticExtPattern };
