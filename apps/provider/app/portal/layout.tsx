import { redirect } from 'next/navigation';
import { PortalShell } from '@/components/layout/portal-shell';
import { getProviderSession, validateProviderSession } from '@/lib/auth/session';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getProviderSession();

  if (!session.token || !(await validateProviderSession(session.token))) {
    redirect('/sign-in?next=/portal/dashboard');
  }

  return <PortalShell initialRole={session.role}>{children}</PortalShell>;
}
