'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { getBrowserSession } from '@/lib/auth/browser-session';
import type { AdminRole } from '@/lib/rbac/roles';
import type { AdminPermission } from '@/lib/rbac/roles';
import { hasPermission } from '@/lib/rbac/permissions';

/**
 * Maps the backend role string (from cookie) to the frontend AdminRole type.
 * Mirrors the mapping in portal-shell.tsx.
 */
function mapBackendRole(role: string | null | undefined): AdminRole | null {
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
    case 'READONLY_AUDITOR':
      return 'readonly_auditor';
    default:
      return null;
  }
}

type IamTab = {
  href: string;
  label: string;
  /** Permission required to see this tab. If undefined, visible to all authenticated users. */
  permission?: AdminPermission;
};

const IAM_TABS: IamTab[] = [
  { href: '/portal/iam/users', label: 'Usuarios', permission: 'rbac:manage' },
  { href: '/portal/iam/roles', label: 'Roles y Permisos', permission: 'rbac:manage' },
  { href: '/portal/iam/providers', label: 'Proveedores', permission: 'providers:view' },
  { href: '/portal/iam/schedule', label: 'Agenda', permission: 'bookings:control' },
  { href: '/portal/iam/availability', label: 'Disponibilidad', permission: 'bookings:control' },
  { href: '/portal/iam/invitations', label: 'Invitaciones', permission: 'rbac:manage' },
  { href: '/portal/iam/audit', label: 'Auditoría', permission: 'audit:view' },
];

function getVisibleTabs(role: AdminRole | null): IamTab[] {
  // If no role is available client-side, show all tabs
  if (!role) return IAM_TABS;
  return IAM_TABS.filter((tab) => !tab.permission || hasPermission(role, tab.permission));
}

function isTabActive(tabHref: string, currentPath: string): boolean {
  return currentPath === tabHref || currentPath.startsWith(`${tabHref}/`);
}

export default function IamLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const visibleTabs = useMemo(() => {
    const session = getBrowserSession();
    const role = mapBackendRole(session.role);
    return getVisibleTabs(role);
  }, []);

  return (
    <div className="iam-layout">
      <div className="page-header">
        <div>
          <h2>Gestión de Identidad y Acceso</h2>
          <p className="muted">Administra usuarios, roles, proveedores, agenda y auditoría desde un solo lugar.</p>
        </div>
      </div>

      <nav className="iam-tabs" aria-label="IAM module navigation">
        {visibleTabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`iam-tab ${isTabActive(tab.href, pathname) ? 'active' : ''}`}
            aria-current={isTabActive(tab.href, pathname) ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="iam-content">
        {children}
      </div>
    </div>
  );
}
