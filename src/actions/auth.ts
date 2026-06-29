'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/services/supabase/server';

export async function signIn(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error: string }> {
  const email = formData.get('email');
  const password = formData.get('password');

  if (typeof email !== 'string' || typeof password !== 'string') {
    return { error: 'Datos de formulario inválidos.' };
  }

  if (!email.trim() || !password) {
    return { error: 'El correo y la contraseña son obligatorios.' };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

  if (error) {
    return { error: 'Correo o contraseña incorrectos.' };
  }

  const next = formData.get('next');
  let destination = '/dashboard';
  if (typeof next === 'string' && next.length > 0) {
    try {
      // Normalizar con URL para neutralizar codificaciones /%09, /\\ y similares
      const url = new URL(next, 'http://localhost');
      if (url.host === 'localhost' && url.pathname.startsWith('/')) {
        destination = url.pathname + url.search;
      }
    } catch {
      // ruta inválida: usar destino por defecto
    }
  }
  redirect(destination);
}

export async function signOut(): Promise<void> {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
