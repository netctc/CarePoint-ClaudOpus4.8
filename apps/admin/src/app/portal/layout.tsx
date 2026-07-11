import { redirect } from 'next/navigation';
import { getAdminSession, validateAdminSession } from '@/lib/auth/session';
import { ToastProvider } from '@/components/ui/toast';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();

  if (!session.token || !(await validateAdminSession(session.token))) {
    redirect('/auth/sign-in?next=/portal/dashboard');
  }

  return <ToastProvider>{children}</ToastProvider>;
}
