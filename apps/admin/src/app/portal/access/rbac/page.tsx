import Link from 'next/link';
import { cookies } from 'next/headers';
import { AccessReviewTable } from '@/components/admin/access-review-table';
import { DataSourceBanner } from '@/components/admin/data-source-banner';
import { RbacAdminActions } from '@/components/admin/rbac-admin-actions';
import { PortalShell } from '@/components/layout/portal-shell';
import { loadIntegratedRbacWorkspace } from '@/lib/api/admin-server';
import { getAdminPortalCopy } from '@/lib/i18n/admin-portal-copy';
import { normalizeAdminLocale } from '@/lib/i18n/admin-dictionary';

function slugRole(role: string) {
  return role.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default async function AccessRbacPage() {
  const cookieStore = await cookies();
  const locale = normalizeAdminLocale(cookieStore.get('cc_locale')?.value);
  const copy = getAdminPortalCopy(locale).rbac;
  const result = await loadIntegratedRbacWorkspace();
  const selected = result.data.workspace.selectedGrant;

  return (
    <PortalShell currentPath="/portal/access/rbac">
      <DataSourceBanner source={result.source} error={result.error} />

      <div className="admin-v18-governance-workspace admin-v18-rbac-workspace">
        <div className="hero-panel admin-v18-hero-panel admin-v18-rbac-hero">
        <div className="hero-panel-grid">
          <div className="hero-copy">
            <div className="page-eyebrow">{copy.eyebrow}</div>
            <h2 className="hero-title">{copy.title}</h2>
            <p className="hero-subtitle">
              {copy.subtitle}
            </p>
            <div className="hero-actions">
              <Link className="button primary" href={`/portal/access/rbac/roles/${slugRole(selected.role)}`}>{copy.openRoleDetail}</Link>
              <button className="button secondary">{copy.runReview}</button>
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
                  <h3 className="section-title" style={{ marginBottom: 6 }}>{copy.selectedGrant}</h3>
                  <div style={{ fontWeight: 800, fontSize: 22 }}>{selected.userName}</div>
                </div>
                <span className="tag">{selected.accessReview}</span>
              </div>
              <div className="detail-list">
                <div><span className="detail-label">{copy.role}</span><strong>{selected.role}</strong></div>
                <div><span className="detail-label">{copy.scope}</span><strong>{selected.grantScope}</strong></div>
                <div><span className="detail-label">{copy.mfa}</span><strong>{selected.mfaStatus}</strong></div>
              </div>
            </div>
            <div className="mini-card">
              <h3 className="section-title">{copy.reviewQueue}</h3>
              <ul className="data-points muted">
                {result.data.workspace.reviewQueue.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

        <div className="admin-v18-intelligence-strip" aria-label="Access governance intelligence">
          <article className="admin-v18-lane-card admin-v18-lane-card--blue">
            <span>Visible grants</span>
            <strong>{result.data.items.length}</strong>
            <p>Review rows continue to come from the integrated RBAC workspace loader.</p>
          </article>
          <article className="admin-v18-lane-card admin-v18-lane-card--red">
            <span>Risk links</span>
            <strong>{selected.linkedRisks.length}</strong>
            <p>Risk evidence remains attached to the selected functional grant state.</p>
          </article>
          <article className="admin-v18-lane-card admin-v18-lane-card--green">
            <span>Available roles</span>
            <strong>{result.data.availableRoles.length}</strong>
            <p>Live role assignment options stay bound to the RBAC action component.</p>
          </article>
        </div>

        <div className="split-shell admin-v18-secondary-grid">
        <div className="info-stack">
          <AccessReviewTable items={result.data.items} />

          <div className="card admin-v18-surface-card">
            <h3 className="section-title">{copy.privilegedControls}</h3>
            <div className="list-stack">
              {result.data.workspace.privilegedControls.map((item) => (
                <div key={item.label} className="list-row">
                  <div>
                    <div className="list-row-title">{item.label}</div>
                    <div className="muted">{item.detail}</div>
                  </div>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="info-stack">
          <div className="card admin-v18-surface-card">
            <h3 className="section-title">{copy.selectedFocus}</h3>
            <div className="detail-list">
              <div><span className="detail-label">{copy.owner}</span><strong>{selected.owner}</strong></div>
              <div><span className="detail-label">{copy.requestedBy}</span><strong>{selected.requestedBy}</strong></div>
              <div><span className="detail-label">{copy.lastCertified}</span><strong>{selected.lastCertifiedAt}</strong></div>
            </div>
            <ul className="data-points muted" style={{ marginTop: 16 }}>
              {selected.linkedRisks.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          {result.data.selectedUserId ? <RbacAdminActions userId={result.data.selectedUserId} currentRole={selected.role} availableRoles={result.data.availableRoles} disabled={result.source !== 'api'} /> : null}
          <div className="card admin-v18-surface-card">
            <h3 className="section-title">{copy.roleMatrix}</h3>
            <ul className="data-points muted">
              {result.data.workspace.roleMatrix.map((item) => (
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