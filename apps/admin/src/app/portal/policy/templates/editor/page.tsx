import Link from 'next/link';
import { DetailStateStrip, EvidenceCardGrid, MetadataGrid } from '@/components/admin/detail-primitives';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatusBadge } from '@/components/ui/status-badge';
import { loadIntegratedPolicyWorkspace } from '@/lib/api/admin-server';

function toneForStatus(status: string) {
  if (status === 'Published') return 'success';
  if (status === 'Draft') return 'warning';
  return 'neutral';
}

export default async function PolicyTemplateEditorPreviewPage() {
  const result = await loadIntegratedPolicyWorkspace();
  const template = result.data.items[0];

  return (
    <PortalShell currentPath="/portal/policy/templates">
      <div className="admin-v20-governance-workspace admin-v20-policy-editor-workspace">
      <div className="page-breadcrumbs"><span>Policy</span><span>•</span><span>Templates</span><span>•</span><span>Editor preview</span></div>
      <div className="hero-panel admin-v20-hero-panel admin-v20-editor-hero">
        <div className="hero-panel-grid">
          <div className="hero-copy">
            <div className="tag-group">
              <span className="page-eyebrow">A-15B · Policy editor preview</span>
              <StatusBadge tone={toneForStatus(template.status)}>{template.status}</StatusBadge>
            </div>
            <h2 className="hero-title">Editorial workspace for governed policy content</h2>
            <p className="hero-subtitle">
              The policy editor now behaves like a real governed authoring surface with metadata, publication readiness, and usage impact shown beside the draft itself.
            </p>
            <div className="hero-actions">
              <Link className="button secondary" href="/portal/policy/templates">Back to template list</Link>
              <Link className="button secondary" href="/portal/audit/logs">Open audit logs</Link>
            </div>
            <div className="tag-group">
              <span className="tag">{template.templateName}</span>
              <span className="tag">{template.version}</span>
              <span className="tag">{template.policyArea}</span>
            </div>
          </div>
          <div className="info-stack">
            <div className="soft-card">
              <h3 className="section-title">Template metadata</h3>
              <div className="detail-list">
                <div><span className="detail-label">Policy area</span><strong>{template.policyArea}</strong></div>
                <div><span className="detail-label">Country</span><strong>{template.country}</strong></div>
                <div><span className="detail-label">Version</span><strong>{template.version}</strong></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DetailStateStrip
        items={[
          {
            label: 'Publication posture',
            value: template.status,
            detail: 'Published versions are immutable; draft and replacement versions must pass approval controls first.',
            tone: toneForStatus(template.status),
          },
          {
            label: 'Usage impact',
            value: `${result.data.workspace.usageMap.length} mapped flows`,
            detail: 'Shows where this policy family is consumed across the platform.',
            tone: 'info',
          },
          {
            label: 'Approval readiness',
            value: `${result.data.workspace.approvalChecklist.length} checks`,
            detail: 'Release and archival requirements shown inline for the editor.',
            tone: 'warning',
          },
        ]}
      />

      <div className="split-shell" style={{ marginTop: 24 }}>
        <div className="info-stack">
          <div className="card">
            <h3 className="section-title">Editor</h3>
            <div className="label">Template title<input className="input" defaultValue={template.templateName} /></div>
            <div className="label" style={{ marginTop: 14 }}>Summary<textarea className="textarea" defaultValue="Telehealth consent content with updated jurisdictional language and effective-date controls." /></div>
            <div className="label" style={{ marginTop: 14 }}>Approval note<textarea className="textarea" placeholder="Capture legal, compliance, and safety sign-off context." /></div>
          </div>

          <div className="card">
            <h3 className="section-title">Template governance packet</h3>
            <EvidenceCardGrid
              items={[
                {
                  title: 'Approval checklist',
                  meta: 'Before publish or archive',
                  description: 'The redesigned editor makes publication readiness explicit so policy teams can keep legal, compliance, and product releases aligned.',
                  bullets: result.data.workspace.approvalChecklist,
                  badges: [
                    { label: template.status, tone: toneForStatus(template.status) },
                    { label: 'Versioned content', tone: 'info' },
                  ],
                },
                {
                  title: 'Usage mapping',
                  meta: 'Where this content is consumed',
                  description: 'Usage context is surfaced directly in the workspace to reduce accidental breakage when publishing, replacing, or archiving policy variants.',
                  bullets: result.data.workspace.usageMap.map((item) => `${item.template}: ${item.usedBy}`),
                  badges: [{ label: `${result.data.workspace.usageMap.length} linked flows`, tone: 'warning' }],
                },
              ]}
            />
          </div>
        </div>

        <div className="info-stack">
          <div className="card">
            <h3 className="section-title">Template metadata grid</h3>
            <MetadataGrid
              items={[
                { label: 'Template', value: template.templateName, detail: 'Primary governed artifact name.' },
                { label: 'Jurisdiction', value: template.country, detail: 'Country-specific policy context.' },
                { label: 'Current version', value: template.version, detail: 'Shown to editors and approvers before publish.' },
                { label: 'Status', value: template.status, detail: 'Determines what editing and release actions are allowed.' },
              ]}
            />
          </div>

          <div className="card">
            <h3 className="section-title">Version history</h3>
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
      </div>
      </div>
    </PortalShell>
  );
}
