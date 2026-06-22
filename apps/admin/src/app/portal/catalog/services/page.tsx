import Link from 'next/link';
import { CatalogAdminActions } from '@/components/admin/catalog-admin-actions';
import { DataSourceBanner } from '@/components/admin/data-source-banner';
import { ServiceCatalogTable } from '@/components/admin/service-catalog-table';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatusBadge } from '@/components/ui/status-badge';
import { loadIntegratedCatalogWorkspace } from '@/lib/api/admin-server';

function tone(status: string) {
  if (status === 'Active') return 'success';
  if (status === 'Draft') return 'warning';
  return 'neutral';
}

export default async function ServiceCatalogPage() {
  const result = await loadIntegratedCatalogWorkspace();
  const selected = result.data.workspace.selectedTemplate;
  const selectedItem = result.data.items.find((item) => item.serviceName === selected.name) || result.data.items[0];
  const selectedApi = selectedItem ? result.data.apiItems?.find((item) => item.id === selectedItem.id) : undefined;

  return (
    <PortalShell currentPath="/portal/catalog/services">
      <DataSourceBanner source={result.source} error={result.error} />

      <div className="admin-v18-governance-workspace admin-v18-catalog-workspace">
        <div className="hero-panel admin-v18-hero-panel">
        <div className="hero-panel-grid">
          <div className="hero-copy">
            <div className="page-eyebrow">A-05 · Service catalog</div>
            <h2 className="hero-title">Service catalog redesigned as a governed workspace for controlled edits and rollout awareness</h2>
            <p className="hero-subtitle">
              This wave upgrades service catalog management from a generic table into a change-managed operations page with version posture, dependency visibility, and a dedicated detail route for each service definition.
            </p>
            <div className="hero-actions">
              <Link className="button primary" href={selectedItem ? `/portal/catalog/services/${selectedItem.id}` : '/portal/catalog/services'}>Open selected service</Link>
              <button className="button secondary">Inspect dependencies</button>
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
            <div className="soft-card">
              <div className="panel-header">
                <div>
                  <h3 className="section-title" style={{ marginBottom: 6 }}>Selected template</h3>
                  <div style={{ fontWeight: 800, fontSize: 22 }}>{selected.name}</div>
                </div>
                {selectedItem ? <StatusBadge tone={tone(selectedItem.status)}>{selectedItem.status}</StatusBadge> : null}
              </div>
              <div className="detail-list">
                <div><span className="detail-label">Version</span><strong>{selected.version}</strong></div>
                <div><span className="detail-label">Owner</span><strong>{selected.owner}</strong></div>
                <div><span className="detail-label">Rollout</span><strong>{selected.rolloutState}</strong></div>
              </div>
            </div>

            <div className="mini-card">
              <h3 className="section-title">Design additions</h3>
              <ul className="data-points muted">
                <li>Dedicated service drilldown route for version, dependency, and publish/archive actions.</li>
                <li>Hero-level governance framing for rollout impact instead of plain summary cards.</li>
                <li>Clear separation between active, draft, and archive operating modes.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

        <div className="admin-v18-intelligence-strip" aria-label="Catalog governance intelligence">
          <article className="admin-v18-lane-card admin-v18-lane-card--blue">
            <span>Live catalog control</span>
            <strong>{result.data.items.filter((item) => item.status === 'Active').length}</strong>
            <p>Active services retain publish/archive controls and governed service detail links.</p>
          </article>
          <article className="admin-v18-lane-card admin-v18-lane-card--amber">
            <span>Draft queue</span>
            <strong>{result.data.items.filter((item) => item.status === 'Draft').length}</strong>
            <p>Draft records remain visible for controlled revision without losing original actions.</p>
          </article>
          <article className="admin-v18-lane-card admin-v18-lane-card--green">
            <span>Guardrails</span>
            <strong>{result.data.workspace.guardrails.length}</strong>
            <p>Operational rules stay attached to the same functional catalog loader.</p>
          </article>
        </div>

        <ServiceCatalogTable items={result.data.items} />

        <div className="split-shell admin-v18-secondary-grid">
        <div className="card admin-v18-surface-card">
          <h3 className="section-title">Category tree</h3>
          <div className="list-stack">
            {result.data.workspace.categoryTree.map((category) => (
              <div key={category.name} className="list-row">
                <div>
                  <div className="list-row-title">{category.name}</div>
                  <div className="muted">Service definitions in this domain.</div>
                </div>
                <strong>{category.count}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="info-stack">
          {selectedApi ? <CatalogAdminActions serviceId={selectedApi.id} status={selectedApi.status} disabled={result.source !== 'api'} /> : null}
          <div className="card admin-v18-surface-card">
            <h3 className="section-title">Catalog guardrails</h3>
            <ul className="data-points muted">
              {result.data.workspace.guardrails.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>
        </div>
        </div>
      </div>
    </PortalShell>
  );
}
