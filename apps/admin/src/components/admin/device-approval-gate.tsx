'use client';

import { ChangeEvent, FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminLocale } from '@/components/i18n/admin-locale-provider';
import { AdminIcon } from '@/components/ui/admin-icon';

/**
 * Device approval gate — mirrors the Provider app's provider-v13-login-check
 * checkbox pattern with identical layout, spacing, typography, icons, colors,
 * and responsive behavior.
 */
export function DeviceApprovalGate() {
  const router = useRouter();
  const { t } = useAdminLocale();
  const [managedDevice, setManagedDevice] = useState(false);
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!managedDevice) {
      setError(t.welcome.deviceApprovalRequired);
      return;
    }
    if (!riskAcknowledged) {
      setError(t.welcome.acknowledgementRequired);
      return;
    }
    setError(null);
    // Persist device approval so the gate doesn't re-appear in the same session
    try {
      sessionStorage.setItem('cp_admin_device_approved', '1');
    } catch {
      // sessionStorage may be unavailable in some contexts
    }
    router.push('/portal/dashboard');
  }

  return (
    <div className="admin-welcome-shell">
      <section className="admin-welcome-frame">
        <aside className="admin-welcome-hero">
          <div className="admin-welcome-brand">
            <div className="admin-welcome-brand-mark">
              <AdminIcon name="logo" />
            </div>
            <div>
              <strong>{t.common.appName}</strong>
              <span>{t.common.appTagline}</span>
            </div>
          </div>

          <div className="admin-welcome-copy">
            <span className="admin-welcome-eyebrow">Privileged administration</span>
            <h1>{t.welcome.title}</h1>
            <p>{t.welcome.subtitle}</p>
          </div>
        </aside>

        <section className="admin-welcome-panel">
          <div className="admin-welcome-panel-top">
            <h2>{t.welcome.title}</h2>
          </div>

          <div className="admin-welcome-warning">
            <AdminIcon name="alert" />
            <p>{t.welcome.subtitle}</p>
          </div>

          <form className="admin-welcome-form" onSubmit={handleSubmit}>
            <label className="admin-welcome-check">
              <input
                type="checkbox"
                checked={managedDevice}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setManagedDevice(e.target.checked)}
              />
              <span>{t.welcome.deviceApproval}</span>
            </label>
            <label className="admin-welcome-check">
              <input
                type="checkbox"
                checked={riskAcknowledged}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setRiskAcknowledged(e.target.checked)}
              />
              <span>{t.welcome.monitoringAcknowledgement}</span>
            </label>

            {error ? <div className="admin-welcome-error">{error}</div> : null}

            <button
              type="submit"
              className="admin-welcome-primary"
              disabled={!managedDevice || !riskAcknowledged}
            >
              <span>{t.welcome.continueToPortal}</span>
              <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false" width="18" height="18">
                <path d="M10.7 4.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4l-4.6 4.6a1 1 0 0 1-1.4-1.4l2.88-2.9H4a1 1 0 1 1 0-2h9.58l-2.88-2.88a1 1 0 0 1 0-1.42Z" fill="currentColor" />
              </svg>
            </button>
          </form>
        </section>
      </section>
    </div>
  );
}
