'use client';

import type { AdminRole } from '@/lib/rbac/roles';
import { AdminIcon } from '@/components/ui/admin-icon';
import { AdminLanguageSwitcher } from '@/components/i18n/admin-language-switcher';
import { useAdminLocale } from '@/components/i18n/admin-locale-provider';

export type TopbarSession = {
  name: string;
  role: AdminRole;
  orgName: string;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'CP';
}

export function Topbar({ session }: { session: TopbarSession }) {
  const { t } = useAdminLocale();

  return (
    <header className="topbar cp-topbar admin-v16-topbar" role="banner">
      <div className="topbar-search-wrap cp-search-surface admin-v16-search-surface" role="search" aria-label={t.common.searchAria}>
        <span className="topbar-search-icon" aria-hidden="true">
          <AdminIcon name="search" />
        </span>
        <input className="topbar-search" placeholder={t.common.searchPlaceholder} aria-label={t.common.searchAria} />
      </div>

      <div className="topbar-actions cp-topbar-actions admin-v16-topbar-actions">
        <button className="admin-v16-emergency-button" type="button">
          <AdminIcon name="alert" />
          <span>Emergency Triage</span>
        </button>

        <AdminLanguageSwitcher />

        <button className="icon-button admin-v16-icon-button" aria-label={t.common.notifications}>
          <AdminIcon name="bell" />
          <span className="notification-dot" aria-hidden="true" />
        </button>

        <button className="icon-button admin-v16-icon-button" aria-label="App launcher">
          <AdminIcon name="overview" />
        </button>

        <div className="topbar-profile cp-user-context admin-v16-profile">
          <div className="topbar-profile-copy">
            <div className="topbar-profile-title">{session.orgName || 'Admin Control'}</div>
            <div className="meta">{t.roles[session.role]}</div>
          </div>
          <div className="avatar-badge" aria-hidden="true">{initials(session.name)}</div>
        </div>
      </div>
    </header>
  );
}
