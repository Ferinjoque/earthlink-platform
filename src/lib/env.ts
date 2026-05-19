function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

export function getPublicEnv() {
  return {
    supabase: {
      url: getEnv('NEXT_PUBLIC_SUPABASE_URL'),
      anonKey: getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    },
  } as const;
}
