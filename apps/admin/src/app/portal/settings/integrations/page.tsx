import { cookies } from 'next/headers';
import { DataSourceBanner } from '@/components/admin/data-source-banner';
import { IntegrationAdminActions } from '@/components/admin/integration-admin-actions';
import { IntegrationsTable } from '@/components/admin/integrations-table';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatusBadge } from '@/components/ui/status-badge';
import { loadIntegratedIntegrationsWorkspace } from '@/lib/api/admin-server';
import { getAdminPortalCopy } from '@/lib/i18n/admin-portal-copy';
import { normalizeAdminLocale } from '@/lib/i18n/admin-dictionary';

export default async function IntegrationsPage() {
  const cookieStore = await cookies();
  const locale = normalizeAdminLocale(cookieStore.get('cc_locale')?.value);
  const copy = getAdminPortalCopy(locale).integrations;
  const result = await loadIntegratedIntegrationsWorkspace();
  const selected = result.data.workspace.selectedIntegration;

  return (
    <PortalShell currentPath="/portal/settings/integrations">
      <DataSourceBanner source={result.source} error={result.error} />

      <div className="admin-v20-governance-workspace admin-v20-integrations-workspace">
        <div className="hero-panel admin-v20-hero-panel admin-v20-integrations-hero">
          <div className="hero-panel-grid">
            <div className="hero-copy">
              <div className="page-eyebrow">A-20 · Integration controls</div>
              <h2 className="hero-title">{copy.title}</h2>
              <p className="hero-subtitle">{copy.subtitle}</p>
              <div className="hero-actions">
                <button className="button secondary">{copy.exportConfig}</button>
                <button className="button secondary">{copy.rotateKeys}</button>
                <button className="button primary">{copy.enableIntegration}</button>
              </div>
              <div className="hero-metrics">
                {result.data.workspace.summary.map((item) => (
                  <div key={item.label} className="hero-metric">
                    <div className="hero-metric-label">{item.label}</div>
                    <div className="hero-metric-value">{item.value}</div>
                    <div className="hero-metric-detail">{item.detail}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="info-stack">
              <div className="soft-card admin-v20-selected-card">
                <div className="panel-header">
                  <div>
                    <h3 className="section-title" style={{ marginBottom: 6 }}>{copy.selectedIntegration}</h3>
                    <div style={{ fontWeight: 800, fontSize: 24 }}>{selected.integrationName}</div>
                  </div>
                  <StatusBadge tone="warning">{selected.status}</StatusBadge>
                </div>
                <div className="detail-list">
                  <div><span className="detail-label">Category</span><strong>{selected.category}</strong></div>
                  <div><span className="detail-label">Owner</span><strong>{selected.owner}</strong></div>
                  <div><span className="detail-label">Environment</span><strong>{selected.environment}</strong></div>
                  <div><span className="detail-label">Last rotated</span><strong>{selected.lastRotatedAt}</strong></div>
                </div>
                <div className="banner warning" style={{ marginTop: 16 }}>{selected.riskNote}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="admin-v20-signal-strip">
          {result.data.workspace.changeQueue.map((item) => (
            <div key={item.label} className="admin-v20-signal-card">
              <span>{item.label}</span>
              <strong>{item.count}</strong>
              <p>{item.note}</p>
            </div>
          ))}
        </div>

        <div className="grid-2-balanced admin-v20-secondary-grid">
          <div className="stack-lg">
            <div className="admin-v20-functional-table">
              <IntegrationsTable items={result.data.items} />
            </div>
          </div>

          <div className="stack-lg">
            <div className="card admin-v20-surface-card">
              <h3 className="section-title">Dependency and rotation checks</h3>
              <ul className="simple-list">
                {selected.checks.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <div className="inline-actions" style={{ marginTop: 16 }}>
                {selected.actions.map((action) => (
                  <button key={action} className={action === 'Rotate secret now' ? 'button primary' : 'button secondary'}>{action}</button>
                ))}
              </div>
            </div>

            {result.data.selectedIntegrationId ? <IntegrationAdminActions integrationId={result.data.selectedIntegrationId} disabled={result.source !== 'api'} /> : null}

            <div className="card admin-v20-surface-card">
              <h3 className="section-title">Change controls</h3>
              <ul className="simple-list muted">
                {selected.guardrails.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="card admin-v20-surface-card">
              <h3 className="section-title">{copy.connectedDomains}</h3>
              <ul className="simple-list muted">
                {result.data.workspace.platformDependencies.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
