import Link from 'next/link';
import { cookies } from 'next/headers';
import { PortalShell } from '@/components/layout/portal-shell';
import { ProviderDirectoryTable } from '@/components/admin/provider-directory-table';
import { DataSourceBanner } from '@/components/admin/data-source-banner';
import { loadIntegratedProviderDirectory } from '@/lib/api/admin-server';
import { getAdminPortalCopy } from '@/lib/i18n/admin-portal-copy';
import { normalizeAdminLocale } from '@/lib/i18n/admin-dictionary';

export default async function ProvidersPage() {
  const cookieStore = await cookies();
  const locale = normalizeAdminLocale(cookieStore.get('cc_locale')?.value);
  const copy = getAdminPortalCopy(locale).providers;
  const result = await loadIntegratedProviderDirectory();
  const items = result.data;
  const activeCount = items.filter((item) => item.operatingStatus === 'Active').length;
  const reverifyCount = items.filter((item) => item.operatingStatus === 'Pending re-verification').length;
  const blockedCount = items.filter((item) => item.bookingEligibility === 'Blocked').length;
  const readyPayouts = items.filter((item) => item.payoutReadiness === 'Ready').length;
  const spotlight = items[0];

  return (
    <PortalShell currentPath="/portal/providers">
      <DataSourceBanner source={result.source} error={result.error} />

        <div className="admin-v17-provider-workspace admin-v17-provider-directory">
      <div className="hero-panel">
        <div className="hero-panel-grid">
          <div className="hero-copy">
            <div className="page-eyebrow">{copy.eyebrow}</div>
            <h2 className="hero-title">{copy.title}</h2>
            <p className="hero-subtitle">{copy.subtitle}</p>
            <div className="hero-actions">
              <Link className="button primary" href={spotlight ? `/portal/providers/${spotlight.id}` : '/portal/providers'}>{copy.openSpotlight}</Link>
              <Link className="button secondary" href="/portal/providers/onboarding">{copy.reviewQueue}</Link>
            </div>
            <div className="hero-metrics">
              <div className="hero-metric">
                <div className="hero-metric-label">{copy.activeProviders}</div>
                <div className="hero-metric-value">{activeCount}</div>
                <div className="hero-metric-detail">{copy.activeProvidersDetail}</div>
              </div>
              <div className="hero-metric">
                <div className="hero-metric-label">{copy.reverify}</div>
                <div className="hero-metric-value">{reverifyCount}</div>
                <div className="hero-metric-detail">{copy.reverifyDetail}</div>
              </div>
              <div className="hero-metric">
                <div className="hero-metric-label">{copy.blocked}</div>
                <div className="hero-metric-value">{blockedCount}</div>
                <div className="hero-metric-detail">{copy.blockedDetail}</div>
              </div>
            </div>
          </div>

          <div className="info-stack">
            <div className="soft-card">
              <div className="panel-header">
                <div>
                  <h3 className="section-title" style={{ marginBottom: 6 }}>{copy.focusAreas}</h3>
                  <div style={{ fontWeight: 800, fontSize: 22 }}>{spotlight?.providerName || copy.noProvider}</div>
                </div>
                <span className="tag">{copy.designApplied}</span>
              </div>
              <div className="detail-list">
                <div><span className="detail-label">{copy.payoutReadyProviders}</span><strong>{readyPayouts}</strong></div>
                <div><span className="detail-label">{copy.topRiskPattern}</span><strong>{copy.credentialRenewal}</strong></div>
                <div><span className="detail-label">{copy.detailRoute}</span><strong>{spotlight ? `/portal/providers/${spotlight.id}` : copy.unavailable}</strong></div>
              </div>
            </div>

            <div className="mini-card">
              <h3 className="section-title">{copy.redesignAdds}</h3>
              <ul className="data-points muted">
                <li>{copy.redesignAdd1}</li>
                <li>{copy.redesignAdd2}</li>
                <li>{copy.redesignAdd3}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-v17-intelligence-strip" aria-label="Provider operational lanes">
          <div className="admin-v17-lane-card admin-v17-lane-card--blue">
            <span>Credential posture</span>
            <strong>{reverifyCount}</strong>
            <p>{copy.reverifyDetail}</p>
          </div>
          <div className="admin-v17-lane-card admin-v17-lane-card--red">
            <span>Booking blockers</span>
            <strong>{blockedCount}</strong>
            <p>{copy.blockedDetail}</p>
          </div>
          <div className="admin-v17-lane-card admin-v17-lane-card--green">
            <span>Payout ready</span>
            <strong>{readyPayouts}</strong>
            <p>{copy.payoutReadyProviders}</p>
          </div>
        </div>

        <ProviderDirectoryTable items={items} />

      <div className="split-shell">
        <div className="card">
          <div className="panel-header">
            <div>
              <h3 className="section-title">{copy.designCoverage}</h3>
              <p className="muted" style={{ margin: 0 }}>{copy.designCoverageText}</p>
            </div>
          </div>
          <div className="metric-grid-3">
            <div className="surface-tile">
              <div className="hero-metric-label">{copy.implemented}</div>
              <div className="hero-metric-value">{copy.directoryHero}</div>
              <div className="hero-metric-detail">{copy.directoryHeroText}</div>
            </div>
            <div className="surface-tile">
              <div className="hero-metric-label">{copy.implemented}</div>
              <div className="hero-metric-value">{copy.providerDetail}</div>
              <div className="hero-metric-detail">{copy.providerDetailText}</div>
            </div>
            <div className="surface-tile">
              <div className="hero-metric-label">{copy.next}</div>
              <div className="hero-metric-value">{copy.scorecards}</div>
              <div className="hero-metric-detail">{copy.scorecardsText}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="section-title">{copy.evidenceExpected}</h3>
          <div className="list-stack">
            <div className="list-row">
              <div>
                <div className="list-row-title">{copy.onboardingEvents}</div>
                <div className="muted">{copy.onboardingEventsText}</div>
              </div>
            </div>
            <div className="list-row">
              <div>
                <div className="list-row-title">{copy.credentialWatch}</div>
                <div className="muted">{copy.credentialWatchText}</div>
              </div>
            </div>
            <div className="list-row">
              <div>
                <div className="list-row-title">{copy.payoutReadiness}</div>
                <div className="muted">{copy.payoutReadinessText}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
        </div>
    </PortalShell>
  );
}
