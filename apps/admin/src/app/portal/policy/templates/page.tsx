import Link from 'next/link';
import { DataSourceBanner } from '@/components/admin/data-source-banner';
import { PolicyAdminActions } from '@/components/admin/policy-admin-actions';
import { PolicyTemplatesTable } from '@/components/admin/policy-templates-table';
import { PortalShell } from '@/components/layout/portal-shell';
import { loadIntegratedPolicyWorkspace } from '@/lib/api/admin-server';

export default async function PolicyTemplatesPage() {
  const result = await loadIntegratedPolicyWorkspace();
  const selectedApi = result.data.apiItems?.[0];

  return (
    <PortalShell currentPath="/portal/policy/templates">
      <DataSourceBanner source={result.source} error={result.error} />

      <div className="admin-v20-governance-workspace admin-v20-policy-workspace">
      <div className="hero-panel admin-v20-hero-panel admin-v20-policy-hero">
        <div className="hero-panel-grid">
          <div className="hero-copy">
            <div className="page-eyebrow">A-15 · Policy template library</div>
            <h2 className="hero-title">Governed policy templates with localized variants, version history, and editorial preview</h2>
            <p className="hero-subtitle">
              This page now aligns with the new library design and introduces a dedicated editor-preview route so policy authors can review jurisdiction, language, effective date, and usage impact before publication.
            </p>
            <div className="hero-actions">
              <Link className="button primary" href="/portal/policy/templates/editor">Open editor preview</Link>
              <button className="button secondary">Compare versions</button>
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
                  <h3 className="section-title" style={{ marginBottom: 6 }}>Recommended addition</h3>
                  <div style={{ fontWeight: 800, fontSize: 22 }}>Editor and preview workspace</div>
                </div>
                <span className="tag">New page</span>
              </div>
              <p className="muted" style={{ marginTop: 0 }}>The design-gap package adds a page for drafting, reviewing, and previewing template variants before they are published into governed journeys.</p>
              <Link className="button secondary" href="/portal/policy/templates/editor">Open editor preview</Link>
            </div>
            <div className="mini-card">
              <h3 className="section-title">Approval checklist</h3>
              <ul className="data-points muted">
                {result.data.workspace.approvalChecklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="split-shell">
        <div className="info-stack">
          <div className="admin-v20-functional-table"><PolicyTemplatesTable items={result.data.items} /></div>
          <div className="card">
            <h3 className="section-title">Version history snapshot</h3>
            <div className="timeline-list">
              {result.data.workspace.versionHistory.map((item) => (
                <div key={`${item.template}-${item.version}`} className="timeline-item">
                  <div style={{ fontWeight: 700 }}>{item.template} · {item.version}</div>
                  <div className="muted">{item.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="info-stack">
          <div className="card">
            <h3 className="section-title">Usage map</h3>
            <div className="detail-list">
              {result.data.workspace.usageMap.map((item) => (
                <div key={item.template}><span className="detail-label">{item.template}</span><strong>{item.usedBy}</strong></div>
              ))}
            </div>
          </div>
          {selectedApi ? <PolicyAdminActions templateId={selectedApi.id} status={selectedApi.status} disabled={result.source !== 'api'} /> : null}
        </div>
      </div>
      </div>
    </PortalShell>
  );
}
