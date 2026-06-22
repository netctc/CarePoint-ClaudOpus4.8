import Link from 'next/link';
import { cookies } from 'next/headers';
import { PortalShell } from '@/components/layout/portal-shell';
import { ProviderOnboardingTable } from '@/components/admin/provider-onboarding-table';
import { DataSourceBanner } from '@/components/admin/data-source-banner';
import { loadIntegratedProviderQueue } from '@/lib/api/admin-server';
import { getAdminPortalCopy } from '@/lib/i18n/admin-portal-copy';
import { normalizeAdminLocale } from '@/lib/i18n/admin-dictionary';

export default async function ProviderOnboardingQueuePage() {
  const cookieStore = await cookies();
  const locale = normalizeAdminLocale(cookieStore.get('cc_locale')?.value);
  const copy = getAdminPortalCopy(locale).onboarding;
  const result = await loadIntegratedProviderQueue();
  const items = result.data.items;
  const pendingDocs = items.filter((item) => item.docStatus !== 'Complete').length;
  const highRisk = items.filter((item) => item.riskFlag === 'High').length;
  const slaRisk = items.filter((item) => item.slaHoursRemaining <= 6).length;
  const spotlight = items[0];

  return (
    <PortalShell currentPath="/portal/providers/onboarding">
      <DataSourceBanner source={result.source} error={result.error} />

        <div className="admin-v17-provider-workspace admin-v17-provider-onboarding">
      <div className="hero-panel">
        <div className="hero-panel-grid">
          <div className="hero-copy">
            <div className="page-eyebrow">{copy.eyebrow}</div>
            <h2 className="hero-title">{copy.title}</h2>
            <p className="hero-subtitle">{copy.subtitle}</p>
            <div className="hero-actions">
              <Link className="button primary" href={spotlight ? `/portal/providers/onboarding/${spotlight.id}` : '/portal/providers/onboarding'}>{copy.openNext}</Link>
              <Link className="button secondary" href="/portal/providers">{copy.returnDirectory}</Link>
            </div>
            <div className="hero-metrics">
              <div className="hero-metric">
                <div className="hero-metric-label">{copy.submissions}</div>
                <div className="hero-metric-value">{items.length}</div>
                <div className="hero-metric-detail">{copy.submissionsDetail}</div>
              </div>
              <div className="hero-metric">
                <div className="hero-metric-label">{copy.missingDocs}</div>
                <div className="hero-metric-value">{pendingDocs}</div>
                <div className="hero-metric-detail">{copy.missingDocsDetail}</div>
              </div>
              <div className="hero-metric">
                <div className="hero-metric-label">{copy.slaRisk}</div>
                <div className="hero-metric-value">{slaRisk}</div>
                <div className="hero-metric-detail">{copy.slaRiskDetail}</div>
              </div>
            </div>
          </div>

          <div className="info-stack">
            <div className="soft-card">
              <div className="panel-header">
                <div>
                  <h3 className="section-title" style={{ marginBottom: 6 }}>{copy.reviewSpotlight}</h3>
                  <div style={{ fontWeight: 800, fontSize: 22 }}>{spotlight?.providerName || copy.noSubmission}</div>
                </div>
                <span className="tag">{copy.queueReady}</span>
              </div>
              <div className="detail-list">
                <div><span className="detail-label">Organization</span><strong>{spotlight?.organizationName || '—'}</strong></div>
                <div><span className="detail-label">{copy.highRiskItems}</span><strong>{spotlight?.riskFlag || '—'}</strong></div>
                <div><span className="detail-label">{copy.auditRoute}</span><strong>{spotlight ? `/portal/providers/onboarding/${spotlight.id}` : 'Unavailable'}</strong></div>
              </div>
            </div>

            <div className="mini-card">
              <h3 className="section-title">{copy.workflowUpgrade}</h3>
              <ul className="data-points muted">
                <li>{copy.workflowUpgrade1}</li>
                <li>{copy.workflowUpgrade2}</li>
                <li>{copy.workflowUpgrade3}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-v17-intelligence-strip" aria-label="Onboarding review lanes">
          <div className="admin-v17-lane-card admin-v17-lane-card--blue">
            <span>Submissions loaded</span>
            <strong>{items.length}</strong>
            <p>{copy.submissionsDetail}</p>
          </div>
          <div className="admin-v17-lane-card admin-v17-lane-card--red">
            <span>High risk</span>
            <strong>{highRisk}</strong>
            <p>{copy.workflowUpgrade3}</p>
          </div>
          <div className="admin-v17-lane-card admin-v17-lane-card--amber">
            <span>SLA risk</span>
            <strong>{slaRisk}</strong>
            <p>{copy.slaRiskDetail}</p>
          </div>
        </div>

        <ProviderOnboardingTable items={items} />

      <div className="split-shell">
        <div className="card">
          <h3 className="section-title">{copy.reviewLane}</h3>
          <div className="list-stack">
            <div className="list-row">
              <div>
                <div className="list-row-title">{copy.highRiskItems}</div>
                <div className="muted">{copy.workflowUpgrade3}</div>
              </div>
              <strong>{highRisk}</strong>
            </div>
            <div className="list-row">
              <div>
                <div className="list-row-title">{copy.missingDocs}</div>
                <div className="muted">{copy.missingDocsDetail}</div>
              </div>
              <strong>{pendingDocs}</strong>
            </div>
            <div className="list-row">
              <div>
                <div className="list-row-title">Statuses loaded</div>
                <div className="muted">Source-integrated queue summary visible in the current admin slice.</div>
              </div>
              <strong>{Object.keys(result.data.summary).join(', ') || 'None'}</strong>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="section-title">{copy.workflowUpgrade}</h3>
          <ul className="data-points muted">
            <li>{copy.workflowUpgrade1}</li>
            <li>{copy.workflowUpgrade2}</li>
            <li>{copy.workflowUpgrade3}</li>
          </ul>
        </div>
      </div>
        </div>
    </PortalShell>
  );
}
