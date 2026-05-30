import 'server-only';
import { createServerClient as createSSRServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

/**
 * Cliente con service_role para operaciones privilegiadas del servidor
 * (subida a Storage, bypass de RLS en migraciones). NUNCA exponer al cliente.
 */
export function createAdminClient() {
  return createClient<Database>(
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
  );
}

export async function createServerClient() {
  const cookieStore = await cookies();
  return createSSRServerClient<Database>(
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Llamado desde un Server Component — las cookies son de solo lectura aquí.
            // El middleware maneja las escrituras de refresco de sesión.
          }
        },
      },
    },
  );
}
