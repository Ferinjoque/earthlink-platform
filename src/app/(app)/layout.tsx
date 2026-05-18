import { redirect } from 'next/navigation';
import { createServerClient } from '@/services/supabase/server';
import { Sidebar } from '@/components/shell/Sidebar';
import { ToastProvider } from '@/components/ui/Toast';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <ToastProvider>
      <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden' }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
          {children}
        </div>
      </div>
      <div id="toast-root" />
    </ToastProvider>
  );
}
