import Link from 'next/link';
import { cookies } from 'next/headers';
import { DetailStateStrip, EvidenceCardGrid, MetadataGrid } from '@/components/admin/detail-primitives';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatusBadge } from '@/components/ui/status-badge';
import { loadIntegratedRbacWorkspace } from '@/lib/api/admin-server';
import { getAdminDetailCopy } from '@/lib/i18n/admin-detail-copy';
import { normalizeAdminLocale } from '@/lib/i18n/admin-dictionary';

function titleizeRole(roleId: string) {
  return roleId.split('-').filter(Boolean).map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ');
}

export default async function RbacRoleDetailPage({ params }: { params: Promise<{ roleId: string }> }) {
  const { roleId } = await params;
  const cookieStore = await cookies();
  const locale = normalizeAdminLocale(cookieStore.get('cc_locale')?.value);
  const copy = getAdminDetailCopy(locale).roleDetail;
  const result = await loadIntegratedRbacWorkspace();
  const selected = result.data.workspace.selectedGrant;
  const roleTitle = titleizeRole(roleId) || selected.role;

  const permissionAreas = [
    'Operational controls — bookings, telehealth, support, and queue interventions.',
    'Financial controls — refunds, settlement visibility, and payout interventions when applicable.',
    'Governance controls — audit visibility, exports, and policy-linked review surfaces.',
  ];

  return (
    <PortalShell currentPath="/portal/access/rbac">
      <div className="admin-v18-governance-workspace admin-v18-rbac-detail">
        <div className="page-breadcrumbs"><span>{copy.breadcrumbs.access}</span><span>•</span><span>{copy.breadcrumbs.rbac}</span><span>•</span><span>{roleTitle}</span></div>
        <div className="hero-panel admin-v18-hero-panel admin-v18-rbac-hero">
        <div className="hero-panel-grid">
          <div className="hero-copy">
            <div className="tag-group">
              <span className="page-eyebrow">{copy.eyebrow}</span>
              <StatusBadge tone={selected.accessReview === 'Expired' ? 'danger' : selected.accessReview === 'Due' ? 'warning' : 'success'}>{selected.accessReview}</StatusBadge>
            </div>
            <h2 className="hero-title">{roleTitle} {copy.titleSuffix}</h2>
            <p className="hero-subtitle">
              {copy.subtitle}
            </p>
            <div className="hero-actions">
              <Link className="button secondary" href="/portal/access/rbac">{copy.backToRbac}</Link>
              <Link className="button secondary" href="/portal/audit/logs">{copy.openAuditLogs}</Link>
            </div>
          </div>
          <div className="info-stack">
            <div className="soft-card">
              <h3 className="section-title">{copy.reviewFocus}</h3>
              <div className="detail-list">
                <div><span className="detail-label">{copy.selectedUser}</span><strong>{selected.userName}</strong></div>
                <div><span className="detail-label">{copy.currentScope}</span><strong>{selected.grantScope}</strong></div>
                <div><span className="detail-label">{copy.mfaPosture}</span><strong>{selected.mfaStatus}</strong></div>
              </div>
            </div>
          </div>
        </div>
      </div>

        <DetailStateStrip
        items={[
          {
            label: copy.certification,
            value: selected.accessReview,
            detail: `Last certified at ${selected.lastCertifiedAt}.`,
            tone: selected.accessReview === 'Expired' ? 'danger' : selected.accessReview === 'Due' ? 'warning' : 'success',
          },
          {
            label: copy.grantScope,
            value: selected.grantScope,
            detail: 'Use this view to validate whether the granted scope is broader than needed.',
            tone: 'info',
          },
          {
            label: copy.riskPosture,
            value: selected.linkedRisks.length > 1 ? 'Heightened review' : 'Routine review',
            detail: 'Derived from role sensitivity, certification freshness, and MFA posture.',
            tone: selected.linkedRisks.length > 1 ? 'warning' : 'success',
          },
        ]}
      />


        <div className="split-shell admin-v18-secondary-grid" style={{ marginTop: 24 }}>
        <div className="info-stack">
          <div className="card">
            <h3 className="section-title">Role metadata</h3>
            <MetadataGrid
              items={[
                { label: 'Role title', value: roleTitle, detail: 'Normalized label used for review and comparison.' },
                { label: 'Selected user', value: selected.userName, detail: 'Current grant holder under review.' },
                { label: 'Requested by', value: selected.requestedBy, detail: 'Business sponsor for the privilege request.' },
                { label: 'Owner', value: selected.owner, detail: 'Governance owner for certification and control hygiene.' },
                { label: 'MFA status', value: selected.mfaStatus, detail: 'Privileged roles should maintain strong authentication posture.' },
                { label: 'Grant scope', value: selected.grantScope, detail: 'Key input for least-privilege comparison.' },
              ]}
            />
          </div>

          <div className="card">
            <h3 className="section-title">Permission and control evidence</h3>
            <EvidenceCardGrid
              items={[
                {
                  title: 'Effective permission areas',
                  meta: roleTitle,
                  description: 'The redesigned role view exposes which classes of operational, financial, and governance actions the role can influence.',
                  bullets: permissionAreas,
                  badges: [
                    { label: 'Role scope', tone: 'info' },
                    { label: selected.accessReview === 'Expired' ? 'Needs recertification' : 'Review current', tone: selected.accessReview === 'Expired' ? 'danger' : 'success' },
                  ],
                },
                {
                  title: 'Least-privilege review notes',
                  meta: 'Guardrails',
                  description: 'These guardrails clarify the conditions under which high-value admin roles should be limited, recertified, or revoked.',
                  bullets: selected.guardrails,
                  badges: [{ label: 'Governed access', tone: 'warning' }],
                },
              ]}
            />
          </div>
        </div>

        <div className="info-stack">
          <div className="card admin-v18-surface-card">
            <h3 className="section-title">Linked risks</h3>
            <ul className="data-points muted">
              {selected.linkedRisks.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>

          <div className="card admin-v18-surface-card">
            <h3 className="section-title">Role matrix references</h3>
            <div className="list-stack">
              {result.data.workspace.roleMatrix.map((item) => (
                <div key={item} className="list-row">
                  <div>
                    <div className="list-row-title">Reference profile</div>
                    <div className="muted">{item}</div>
                  </div>
                  <strong>Mapped</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
        </div>
      </div>
    </PortalShell>
  );
}
