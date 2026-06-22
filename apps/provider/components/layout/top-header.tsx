"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { providerApi } from '@/services/api-client';
import { clearBrowserSession } from '@/lib/auth/browser-session';
import { ProviderIcon } from '@/components/shared/provider-icons';
import { ProviderLanguageSwitcher } from '@/components/i18n/provider-language-switcher';
import { useProviderLocale } from '@/components/i18n/provider-locale-provider';

type TopHeaderProps = {
  initialRole?: string | null;
};

type ConnectionState = 'loading' | 'live' | 'degraded';

function initials(name: string) {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'PR'
  );
}

export function TopHeader({ initialRole }: TopHeaderProps) {
  const [me, setMe] = useState<any>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('loading');
  const [profileOpen, setProfileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const { t } = useProviderLocale();

  useEffect(() => {
    let isMounted = true;

    providerApi
      .me()
      .then((result) => {
        if (!isMounted) return;
        setMe(result);
        setConnectionState('live');
      })
      .catch(() => {
        if (!isMounted) return;
        setConnectionState('degraded');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!profileOpen) return;

    function onPointerDown(event: PointerEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setProfileOpen(false);
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [profileOpen]);

  const name = useMemo(() => me?.fullName || me?.email || 'Dr. Provider', [me]);
  const role = useMemo(() => String(me?.role || initialRole || 'PROVIDER').replaceAll('_', ' '), [initialRole, me]);
  const connectionLabel = connectionState === 'live' ? t.common.liveApi : connectionState === 'degraded' ? t.common.sessionMode : t.common.checking;

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await providerApi.logout();
    } catch {
      // Local session cleanup below is the source of truth if the API is unavailable.
    } finally {
      clearBrowserSession();
      window.location.assign('/sign-in');
    }
  }

  return (
    <header className="top-header provider-v13-topbar cp-topbar" role="banner">
      <div className="provider-v13-search" role="search" aria-label={t.common.searchPlaceholder}>
        <ProviderIcon name="search" width={18} height={18} className="provider-v13-search-icon" />
        <input type="text" placeholder={t.common.searchPlaceholder} aria-label={t.common.searchPlaceholder} />
      </div>

      <div className="provider-v13-topbar-links" aria-label="Provider quick links">
        <a href="/portal/queue">{t.common.directives}</a>
        <a href="/portal/prescriptions/new">{t.common.pharmacy}</a>
      </div>

      <button className="provider-v13-triage-button" type="button">
        <span>✱</span>
        <strong>{t.common.emergencyTriage}</strong>
      </button>

      <div className="provider-v13-topbar-actions cp-topbar-actions">
        <ProviderLanguageSwitcher />
        <span className={`provider-v13-connection provider-v13-connection--${connectionState}`}>{connectionLabel}</span>
        <button className="provider-v13-icon-button" type="button" aria-label={t.common.notifications}>
          <ProviderIcon name="bell" width={18} height={18} />
        </button>
        <button className="provider-v13-icon-button" type="button" aria-label={t.common.syncStatus}>
          <ProviderIcon name="sync" width={18} height={18} />
        </button>
        <div className="provider-v15-profile-menu" ref={profileRef}>
          <button
            type="button"
            className="provider-v13-profile provider-v15-profile-trigger"
            title={name}
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            aria-label={t.common.accountMenu}
            onClick={() => setProfileOpen((current) => !current)}
          >
            <span className="provider-v13-avatar">{initials(name)}</span>
            <div>
              <strong>{name}</strong>
              <p>{role}</p>
            </div>
            <span className="provider-v15-profile-chevron" aria-hidden="true">⌄</span>
          </button>

          {profileOpen ? (
            <div className="provider-v15-profile-dropdown" role="menu">
              <div className="provider-v15-profile-dropdown__identity">
                <strong>{name}</strong>
                <span>{role}</span>
                {me?.email ? <span>{me.email}</span> : null}
              </div>
              <button type="button" role="menuitem" onClick={signOut} disabled={signingOut}>
                <ProviderIcon name="logout" width={17} height={17} />
                <span>{signingOut ? `${t.common.signOut}…` : t.common.signOut}</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
