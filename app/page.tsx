import { redirect } from 'next/navigation';
import { createServerClient } from '@/services/supabase/server';

export default async function RootPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? '/dashboard' : '/login');
}
