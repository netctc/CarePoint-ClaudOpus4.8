"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ProviderIcon } from '@/components/shared/provider-icons';
import { useProviderLocale } from '@/components/i18n/provider-locale-provider';

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav() {
  const pathname = usePathname();
  const { t } = useProviderLocale();

  const primaryItems = [
    { href: '/portal/dashboard', label: t.nav.dashboard, icon: 'dashboard' as const },
    { href: '/portal/patients', label: t.nav.patients, icon: 'patients' as const },
    { href: '/portal/calendar', label: t.nav.schedule, icon: 'schedule' as const },
    { href: '/portal/queue', label: t.nav.queue, icon: 'queue' as const },
    { href: '/portal/messages', label: t.nav.messaging, icon: 'messages' as const },
    { href: '/portal/telehealth', label: t.nav.telehealth, icon: 'telehealth' as const },
    { href: '/portal/analytics', label: t.nav.analytics, icon: 'analytics' as const },
  ];

  const secondaryItems = [
    { href: '/portal/orders/new', label: t.nav.orders, icon: 'orders' as const },
    { href: '/portal/settings', label: t.nav.settings, icon: 'settings' as const },
    { href: '/portal/team', label: t.nav.support, icon: 'support' as const },
  ];

  return (
    <aside className="sidebar provider-v13-sidebar cp-sidebar cp-sidebar--provider" aria-label="Provider portal navigation">
      <div className="provider-v13-sidebar-brand">
        <div className="provider-v13-sidebar-logo" aria-hidden="true">CP</div>
        <div>
          <strong>{t.common.appName}</strong>
          <p>{t.common.appTagline}</p>
        </div>
      </div>

      <Link href="/portal/queue" className="provider-v13-sidebar-cta">
        <ProviderIcon name="queue" width={18} height={18} />
        <span>{t.nav.newAppointment}</span>
      </Link>

      <nav className="provider-v13-sidebar-scroll" aria-label="Primary provider sections">
        <div className="provider-v13-sidebar-section">
          <p>{t.nav.workspace}</p>
          {primaryItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={`provider-v13-nav-item${active ? ' active' : ''}`}>
                <ProviderIcon name={item.icon} width={19} height={19} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="provider-v13-sidebar-section">
          <p>{t.nav.clinical}</p>
          {secondaryItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={`provider-v13-nav-item${active ? ' active' : ''}`}>
                <ProviderIcon name={item.icon} width={19} height={19} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
