'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AdminRole } from '@/lib/rbac/roles';
import { adminApi } from '@/lib/api-client';
import { getBrowserSession, type BrowserSession } from '@/lib/auth/browser-session';
import { MOCK_ADMIN_SESSION } from '@/lib/auth/mock-session';
import { SidebarNav } from './sidebar-nav';
import { Topbar } from './topbar';

type AdminProfile = {
  email?: string;
  fullName?: string;
  role?: string;
  organizationId?: string;
};

function mapBackendRole(role: string | null | undefined): AdminRole {
  switch (role) {
    case 'SUPER_ADMIN':
    case 'COMPANY_ADMIN':
      return 'super_admin';
    case 'OPS_ADMIN':
      return 'ops_admin';
    case 'PROVIDER_REVIEWER':
      return 'provider_reviewer';
    case 'COMPANY_SUPPORT':
      return 'support_admin';
    case 'FINANCE':
      return 'finance_admin';
    case 'SAFETY_ADMIN':
      return 'safety_admin';
    default:
      return MOCK_ADMIN_SESSION.role;
  }
}

export function PortalShell({ currentPath, children }: { currentPath: string; children: ReactNode }) {
  const [browserSession, setBrowserSession] = useState<BrowserSession>({ accessToken: null, role: null });
  const [me, setMe] = useState<AdminProfile | null>(null);

  useEffect(() => {
    const session = getBrowserSession();
    setBrowserSession(session);

    if (!session.accessToken || session.accessToken === 'demo-admin-token') {
      return;
    }

    adminApi.me().then((response) => setMe(response as AdminProfile)).catch(() => undefined);
  }, []);

  const session = useMemo(
    () => ({
      name: me?.fullName || me?.email || MOCK_ADMIN_SESSION.name,
      role: mapBackendRole(me?.role || browserSession.role),
      orgName: me?.organizationId || MOCK_ADMIN_SESSION.orgName,
    }),
    [browserSession.role, me],
  );

  return (
    <div className="page-shell admin-theme-shell cp-app-shell cp-app-shell--admin admin-v16-shell">
      <a className="skip-link" href="#admin-main-content">Skip to admin workspace</a>
      <SidebarNav role={session.role} currentPath={currentPath} />
      <div className="content-area cp-content-area admin-v16-content">
        <Topbar session={session} />
        <main id="admin-main-content" className="main-content cp-main-content admin-v16-main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
