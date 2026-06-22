import { cookies } from 'next/headers';
import { DataSourceBanner } from '@/components/admin/data-source-banner';
import { RefillAuditExportActions } from '@/components/admin/refill-audit-export-actions';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatusBadge } from '@/components/ui/status-badge';
import { loadRefillGovernanceWorkspace } from '@/lib/api/admin-server';
import { getAdminPortalCopy } from '@/lib/i18n/admin-portal-copy';
import { normalizeAdminLocale } from '@/lib/i18n/admin-dictionary';

export default async function RefillGovernanceWorkspacePage() {
  const cookieStore = await cookies();
  const locale = normalizeAdminLocale(cookieStore.get('cc_locale')?.value);
  const copy = getAdminPortalCopy(locale).refillGovernance;
  const result = await loadRefillGovernanceWorkspace();
  const { scopes, deliveryFailures, failureSummary, selectedScope, selectedScopeDetail } = result.data;

  return (
    <PortalShell currentPath="/portal/audit/refill-governance">
      <DataSourceBanner source={result.source} error={result.error} />

      <div className="admin-v20-governance-workspace admin-v20-refill-workspace">
      <div className="hero-panel admin-v20-hero-panel admin-v20-refill-hero">
        <div className="hero-panel-grid">
          <div className="hero-copy">
            <div className="page-eyebrow">{copy.eyebrow}</div>
            <h2 className="hero-title">{copy.title}</h2>
            <p className="hero-subtitle">
              {copy.subtitle}
            </p>
            <div className="hero-metrics">
              <div className="hero-metric">
                <div className="hero-metric-label">{copy.savedScopes}</div>
                <div className="hero-metric-value">{scopes.length}</div>
                <div className="hero-metric-detail">{copy.savedScopesDetail}</div>
              </div>
              <div className="hero-metric">
                <div className="hero-metric-label">{copy.failedDeliveries}</div>
                <div className="hero-metric-value">{failureSummary?.failedCount ?? deliveryFailures.length}</div>
                <div className="hero-metric-detail">{copy.failedDeliveriesDetail}</div>
              </div>
              <div className="hero-metric">
                <div className="hero-metric-label">{copy.destinationsAffected}</div>
                <div className="hero-metric-value">{failureSummary?.destinationCount ?? 0}</div>
                <div className="hero-metric-detail">{copy.destinationsAffectedDetail}</div>
              </div>
            </div>
          </div>

          <div className="info-stack">
            <div className="soft-card">
              <div className="panel-header">
                <div>
                  <h3 className="section-title" style={{ marginBottom: 6 }}>{copy.selectedSpotlight}</h3>
                  <div style={{ fontWeight: 800, fontSize: 22 }}>{selectedScope?.title || '{copy.noScope}'}</div>
                </div>
                <StatusBadge tone={selectedScope ? 'info' : 'warning'}>{selectedScope ? 'Scoped' : 'Unavailable'}</StatusBadge>
              </div>
              {selectedScope ? (
                <div className="detail-list">
                  <div><span className="detail-label">{copy.exportReady}</span><strong>{selectedScope.summary.exportReadyCount}</strong></div>
                  <div><span className="detail-label">{copy.escalations}</span><strong>{selectedScope.summary.escalationCount}</strong></div>
                  <div><span className="detail-label">{copy.failedDeliveries}</span><strong>{selectedScope.summary.failedDeliveryCount}</strong></div>
                </div>
              ) : <p className="muted">{copy.noScopeText}</p>}
            </div>
            <RefillAuditExportActions />
          </div>
        </div>
      </div>

      <div className="split-shell">
        <div className="info-stack">
          <div className="card">
            <div className="panel-header">
              <div>
                <h3 className="section-title">{copy.scopeLibrary}</h3>
                <p className="muted" style={{ margin: 0 }}>{copy.scopeLibraryText}</p>
              </div>
              <StatusBadge tone={scopes.length ? 'info' : 'warning'}>{scopes.length ? 'Live scopes' : 'No scopes'}</StatusBadge>
            </div>
            {!scopes.length ? <p className="muted">{copy.noScopesText}</p> : null}
            <div className="list-stack">
              {scopes.map((item) => (
                <div key={item.id} className="list-row">
                  <div>
                    <div className="list-row-title">{item.title}</div>
                    <div className="muted">{item.filters.join(' • ') || 'No extra filter applied'}</div>
                    <div className="muted">{copy.exportReady}: {item.summary.exportReadyCount} • {copy.escalations}: {item.summary.escalationCount} • {copy.failedDeliveries}: {item.summary.failedDeliveryCount}</div>
                  </div>
                  <div className="muted">Updated {item.updatedAt}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="panel-header">
              <div>
                <h3 className="section-title">Delivery-failure drill-down</h3>
                <p className="muted" style={{ margin: 0 }}>Latest failed governed KPI executions across saved scopes and schedules.</p>
              </div>
              <StatusBadge tone={deliveryFailures.length ? 'warning' : 'success'}>{deliveryFailures.length ? 'Action needed' : 'Healthy'}</StatusBadge>
            </div>
            {!deliveryFailures.length ? <p className="muted">No failed delivery executions were returned from the live API.</p> : null}
            <ul className="data-points muted">
              {deliveryFailures.map((item) => (
                <li key={item.id}><strong>{item.title}</strong> — {item.summary}. {item.destination} ({item.executedAt})</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="info-stack">
          <div className="card">
            <h3 className="section-title">Governance notes</h3>
            {selectedScopeDetail?.governanceNotes?.length ? (
              <ul className="data-points muted">
                {selectedScopeDetail.governanceNotes.map((note) => <li key={note}>{note}</li>)}
              </ul>
            ) : <p className="muted">No governance notes were returned for the selected scope.</p>}
          </div>
          <div className="card">
            <h3 className="section-title">Latest failures for this scope</h3>
            {selectedScopeDetail?.latestFailures?.length ? (
              <ul className="data-points muted">
                {selectedScopeDetail.latestFailures.map((item) => <li key={item.id}><strong>{item.title}</strong> — {item.summary} ({item.executedAt})</li>)}
              </ul>
            ) : <p className="muted">No recent failures are attached to the selected scope.</p>}
          </div>
        </div>
      </div>
      </div>
    </PortalShell>
  );
}