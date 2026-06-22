'use client';

import Link from 'next/link';
import { getVisibleRoutes, type PortalRoute } from '@/lib/rbac/route-access';
import type { AdminRole } from '@/lib/rbac/roles';
import { AdminIcon } from '@/components/ui/admin-icon';
import { useAdminLocale } from '@/components/i18n/admin-locale-provider';

function getActiveHref(currentPath: string, hrefs: string[]) {
  return hrefs
    .filter((href) => currentPath === href || currentPath.startsWith(`${href}/`))
    .sort((left, right) => right.length - left.length)[0];
}

function routeIcon(route: PortalRoute) {
  if (route.href.startsWith('/portal/dashboard')) return 'overview';
  if (route.href.startsWith('/portal/providers')) return 'providers';
  if (route.href.startsWith('/portal/bookings')) return 'bookings';
  if (route.href.startsWith('/portal/payments') || route.href.startsWith('/portal/pricing')) return 'finance';
  if (route.href.startsWith('/portal/settings') || route.href.startsWith('/portal/policy') || route.href.startsWith('/portal/access') || route.href.startsWith('/portal/audit')) return 'settings';
  if (route.href.startsWith('/portal/support')) return 'support';
  return 'overview';
}

function routeBucket(route: PortalRoute) {
  if (route.href === '/portal/dashboard') return 'overview';
  if (route.href.startsWith('/portal/providers') || route.href.startsWith('/portal/bookings') || route.href.startsWith('/portal/catalog') || route.href.startsWith('/portal/coverage') || route.href.startsWith('/portal/telehealth')) return 'operations';
  if (route.href.startsWith('/portal/payments') || route.href.startsWith('/portal/pricing') || route.href.startsWith('/portal/reviews') || route.href.startsWith('/portal/support') || route.href.startsWith('/portal/safety') || route.href.startsWith('/portal/reports') || route.href.startsWith('/portal/notifications')) return 'control';
  return 'governance';
}

export function SidebarNav({ role, currentPath }: { role: AdminRole; currentPath: string }) {
  const { t } = useAdminLocale();
  const routes = getVisibleRoutes(role);
  const activeHref = getActiveHref(currentPath, routes.map((route) => route.href));
  const grouped = routes.reduce<Record<string, PortalRoute[]>>((acc, route) => {
    const key = routeBucket(route);
    acc[key] ??= [];
    acc[key].push(route);
    return acc;
  }, {});

  const groupLabels: Record<string, string> = {
    overview: t.buckets.overview,
    operations: t.buckets.operations,
    control: t.buckets.control,
    governance: t.buckets.governance,
  };

  return (
    <aside className="sidebar cp-sidebar cp-sidebar--admin admin-v16-sidebar" aria-label="Admin portal navigation">
      <div className="sidebar-brand cp-sidebar-brand admin-v16-sidebar-brand">
        <div className="sidebar-logo" aria-hidden="true">
          <AdminIcon name="logo" />
        </div>
        <div>
          <h1>{t.common.appName}</h1>
          <p>{t.common.appTagline}</p>
        </div>
      </div>

      <Link href="/portal/providers/onboarding" className="admin-v16-new-action">
        <span className="nav-icon" aria-hidden="true">
          <AdminIcon name="providers" />
        </span>
        <span>New provider review</span>
      </Link>

      <nav className="sidebar-scroll cp-sidebar-scroll admin-v16-sidebar-scroll" aria-label="Primary admin sections">
        {Object.entries(grouped).map(([group, items]) => (
          <div key={group} className="sidebar-section">
            <div className="sidebar-section-title">{groupLabels[group] ?? group}</div>
            <div className="nav-group">
              {items.map((route) => (
                <Link
                  key={route.href}
                  href={route.href}
                  aria-current={activeHref === route.href ? 'page' : undefined}
                  className={`nav-item cp-nav-item admin-v16-nav-item ${activeHref === route.href ? 'active' : ''}`}
                >
                  <span className="nav-icon" aria-hidden="true">
                    <AdminIcon name={routeIcon(route)} />
                  </span>
                  <span>{t.routes[route.href as keyof typeof t.routes] ?? route.label}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer cp-sidebar-footer admin-v16-sidebar-footer" aria-label="Admin secondary actions">
        <Link
          href="/portal/support/console"
          aria-current={currentPath.startsWith('/portal/support') ? 'page' : undefined}
          className={`nav-item cp-nav-item admin-v16-nav-item ${currentPath.startsWith('/portal/support') ? 'active' : ''}`}
        >
          <span className="nav-icon" aria-hidden="true">
            <AdminIcon name="support" />
          </span>
          <span>{t.common.support}</span>
        </Link>
        <Link href="/auth/sign-in" className="nav-item cp-nav-item admin-v16-nav-item admin-v16-logout-link">
          <span className="nav-icon" aria-hidden="true">
            <AdminIcon name="logout" />
          </span>
          <span>{t.common.logout}</span>
        </Link>
      </div>
    </aside>
  );
}
