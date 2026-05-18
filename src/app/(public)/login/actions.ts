'use server';

import { redirect } from 'next/navigation';
import { createServerClient } from '@/services/supabase/server';

export async function signIn(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error: string }> {
  const email = formData.get('email');
  const password = formData.get('password');

  if (typeof email !== 'string' || typeof password !== 'string') {
    return { error: 'Invalid form data.' };
  }

  if (!email.trim() || !password) {
    return { error: 'Email and password are required.' };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

  if (error) {
    return { error: error.message };
  }

  redirect('/dashboard');
}

export async function signOut(): Promise<void> {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}
