'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getVisibleRoutes, type PortalRoute } from '@/lib/rbac/route-access';
import type { AdminRole } from '@/lib/rbac/roles';
import { AdminIcon } from '@/components/ui/admin-icon';
import { useAdminLocale } from '@/components/i18n/admin-locale-provider';

const SIDEBAR_COLLAPSED_KEY = 'cp_admin_sidebar_collapsed';

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

function readCollapsedState(): boolean {
  try {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    // Default to collapsed if no stored preference
    return stored === null ? true : stored === '1';
  } catch {
    return true;
  }
}

function persistCollapsedState(collapsed: boolean) {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // localStorage may be unavailable
  }
}

export function SidebarNav({ role, currentPath }: { role: AdminRole; currentPath: string }) {
  const { t } = useAdminLocale();
  const [collapsed, setCollapsed] = useState(true); // default collapsed
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    setCollapsed(readCollapsedState());
  }, []);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      persistCollapsedState(next);
      // Notify shell about collapse state change
      window.dispatchEvent(new CustomEvent('sidebar-collapse-change', { detail: { collapsed: next } }));
      return next;
    });
  }, []);

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

  // Show expanded state when either explicitly expanded or hovered while collapsed
  const isExpanded = !collapsed || hovered;

  return (
    <aside
      className={`sidebar cp-sidebar cp-sidebar--admin admin-v16-sidebar ${collapsed ? 'sidebar--collapsed' : ''} ${hovered && collapsed ? 'sidebar--hover-expanded' : ''}`}
      aria-label="Admin portal navigation"
      onMouseEnter={() => { if (collapsed) setHovered(true); }}
      onMouseLeave={() => { if (collapsed) setHovered(false); }}
    >
      <div className="sidebar-brand cp-sidebar-brand admin-v16-sidebar-brand">
        <div className="sidebar-logo" aria-hidden="true">
          <AdminIcon name="logo" />
        </div>
        {isExpanded && (
          <div className="sidebar-brand-text">
            <h1>{t.common.appName}</h1>
            <p>{t.common.appTagline}</p>
          </div>
        )}
      </div>

      <button
        type="button"
        className="sidebar-collapse-toggle"
        onClick={toggleCollapse}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}>
          <path d="M7.3 4.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4l-4.6 4.6a1 1 0 0 1-1.4-1.4L10.18 10 7.3 7.12a1 1 0 0 1 0-1.42Z" fill="currentColor" />
        </svg>
      </button>

      {isExpanded && (
        <Link href="/portal/providers/onboarding" className="admin-v16-new-action">
          <span className="nav-icon" aria-hidden="true">
            <AdminIcon name="providers" />
          </span>
          <span className="nav-label">New provider review</span>
        </Link>
      )}

      {!isExpanded && (
        <Link href="/portal/providers/onboarding" className="admin-v16-new-action sidebar-icon-only-action" aria-label="New provider review">
          <span className="nav-icon" aria-hidden="true">
            <AdminIcon name="providers" />
          </span>
        </Link>
      )}

      <nav className="sidebar-scroll cp-sidebar-scroll admin-v16-sidebar-scroll" aria-label="Primary admin sections">
        {Object.entries(grouped).map(([group, items]) => (
          <div key={group} className="sidebar-section">
            {isExpanded && <div className="sidebar-section-title">{groupLabels[group] ?? group}</div>}
            <div className="nav-group">
              {items.map((route) => (
                <Link
                  key={route.href}
                  href={route.href}
                  aria-current={activeHref === route.href ? 'page' : undefined}
                  className={`nav-item cp-nav-item admin-v16-nav-item ${activeHref === route.href ? 'active' : ''}`}
                  title={!isExpanded ? (t.routes[route.href as keyof typeof t.routes] ?? route.label) : undefined}
                >
                  <span className="nav-icon" aria-hidden="true">
                    <AdminIcon name={routeIcon(route)} />
                  </span>
                  {isExpanded && <span className="nav-label">{t.routes[route.href as keyof typeof t.routes] ?? route.label}</span>}
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
          title={!isExpanded ? t.common.support : undefined}
        >
          <span className="nav-icon" aria-hidden="true">
            <AdminIcon name="support" />
          </span>
          {isExpanded && <span className="nav-label">{t.common.support}</span>}
        </Link>
        <Link
          href="/auth/sign-in"
          className="nav-item cp-nav-item admin-v16-nav-item admin-v16-logout-link"
          title={!isExpanded ? t.common.logout : undefined}
        >
          <span className="nav-icon" aria-hidden="true">
            <AdminIcon name="logout" />
          </span>
          {isExpanded && <span className="nav-label">{t.common.logout}</span>}
        </Link>
      </div>
    </aside>
  );
}
