import Link from 'next/link';
import { PortalShell } from '@/components/layout/portal-shell';
import { ProviderDirectoryTable } from '@/components/admin/provider-directory-table';
import { loadIntegratedProviderDirectory } from '@/lib/api/admin-server';

export default async function ProvidersPage() {
  const result = await loadIntegratedProviderDirectory();
  const items = result.data;
  const activeCount = items.filter((item) => item.operatingStatus === 'Active').length;
  const reverifyCount = items.filter((item) => item.operatingStatus === 'Pending re-verification').length;
  const blockedCount = items.filter((item) => item.bookingEligibility === 'Blocked').length;
  const readyPayouts = items.filter((item) => item.payoutReadiness === 'Ready').length;
  const spotlight = items[0];

  return (
    <PortalShell currentPath="/portal/providers">
      <div className="admin-v17-provider-workspace admin-v17-provider-directory">
        <div className="hero-panel">
          <div className="hero-panel-grid">
            <div className="hero-copy">
              <h2 className="hero-title">Provider Directory</h2>
              <div className="hero-actions">
                <Link className="button primary" href={spotlight ? `/portal/providers/${spotlight.id}` : '/portal/providers'}>Open Profile</Link>
                <Link className="button secondary" href="/portal/providers/onboarding">Review Queue</Link>
              </div>
              <div className="hero-metrics">
                <div className="hero-metric">
                  <div className="hero-metric-label">Active Providers</div>
                  <div className="hero-metric-value">{activeCount}</div>
                </div>
                <div className="hero-metric">
                  <div className="hero-metric-label">Pending Re-verification</div>
                  <div className="hero-metric-value">{reverifyCount}</div>
                </div>
                <div className="hero-metric">
                  <div className="hero-metric-label">Blocked</div>
                  <div className="hero-metric-value">{blockedCount}</div>
                </div>
                <div className="hero-metric">
                  <div className="hero-metric-label">Payout Ready</div>
                  <div className="hero-metric-value">{readyPayouts}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <ProviderDirectoryTable items={items} />
      </div>
    </PortalShell>
  );
}
