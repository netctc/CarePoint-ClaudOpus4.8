import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { DataSourceBanner } from '@/components/admin/data-source-banner';
import { DetailStateStrip, EvidenceCardGrid, MetadataGrid } from '@/components/admin/detail-primitives';
import { SafetyAdminActions } from '@/components/admin/safety-admin-actions';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatusBadge } from '@/components/ui/status-badge';
import { loadIntegratedSafetyWorkspace } from '@/lib/api/admin-server';
import { formatUtcDateTime } from '@/lib/formatters';
import { normalizeAdminLocale } from '@/lib/i18n/admin-dictionary';
import { getAdminPhase5Copy } from '@/lib/i18n/admin-phase5-copy';

function severityTone(severity: string) {
  if (severity === 'Minor') return 'info';
  if (severity === 'Major') return 'warning';
  return 'danger';
}

function statusTone(status: string) {
  if (status === 'Closed') return 'success';
  if (status === 'Escalated' || status === 'Pending approval') return 'warning';
  return 'info';
}

export default async function SafetyCaseDetailPage({ params }: { params: Promise<{ caseId: string }> }) {
  const cookieStore = await cookies();
  const locale = normalizeAdminLocale(cookieStore.get('cc_locale')?.value);
  const copy = getAdminPhase5Copy(locale).safety;
  const { caseId } = await params;
  const result = await loadIntegratedSafetyWorkspace();
  const item = result.data.items.find((entry) => entry.id === caseId);

  if (!item) notFound();

  const evidenceCards = [
    {
      title: 'Incident source and summary',
      meta: item.caseRef,
      description: 'A compact clinical or operational incident packet that keeps the origin, summary, and linked source visible for every reviewer.',
      bullets: [item.summary, `Linked source: ${item.linkedSource}`, `Investigator: ${item.investigator}`],
      badges: [{ label: item.severity, tone: severityTone(item.severity) }],
    },
    {
      title: 'Action and remediation plan',
      meta: item.status,
      description: 'The route now keeps current intervention steps and remediation planning visible before the case is advanced or closed.',
      bullets: item.actions,
      badges: [{ label: item.status, tone: statusTone(item.status) }],
    },
    {
      title: 'Approval workflow',
      meta: item.dualApprovalRequired ? 'Dual approval required' : 'Single approval path',
      description: 'Safety reviewers should be able to see whether approval is pending, completed, or still waiting on a senior medical decision.',
      bullets: item.approvals.map((approval) => `${approval.reviewer}: ${approval.decision}${approval.at ? ` at ${formatUtcDateTime(approval.at)}` : ''}`),
      badges: [{ label: item.dualApprovalRequired ? copy.dualApproval : 'Standard approval', tone: item.dualApprovalRequired ? 'warning' : 'info' }],
    },
    {
      title: 'Case timeline',
      meta: 'Evidence chronology',
      description: 'A chronological view helps teams validate incident progression, severity changes, and any delayed intervention moments.',
      bullets: item.timeline.map((entry) => `${formatUtcDateTime(entry.at)} - ${entry.event}`),
      badges: [{ label: 'Timeline', tone: 'neutral' }],
    },
  ];

  return (
    <PortalShell currentPath="/portal/safety/incidents">
      <DataSourceBanner source={result.source} error={result.error} />

      <div className="hero-panel">
        <div className="hero-panel-grid">
          <div className="hero-copy">
            <div className="page-breadcrumbs"><span>{copy.breadcrumbs.safety}</span><span>•</span><span>{copy.breadcrumbs.incidents}</span><span>•</span><span>{item.caseRef}</span></div>
            <div className="page-eyebrow">{copy.eyebrow}</div>
            <h2 className="hero-title">{copy.title}</h2>
            <p className="hero-subtitle">{copy.subtitle}</p>
            <div className="hero-actions"><Link className="button secondary" href="/portal/safety/incidents">{copy.backToQueue}</Link><button className="button primary">{copy.exportPacket}</button></div>
            <div className="hero-metrics">
              <div className="hero-metric"><div className="hero-metric-label">{copy.severity}</div><div className="hero-metric-value">{item.severity}</div><div className="hero-metric-detail">Determines approval and intervention urgency in the safety workspace.</div></div>
              <div className="hero-metric"><div className="hero-metric-label">{copy.status}</div><div className="hero-metric-value">{item.status}</div><div className="hero-metric-detail">Current operational state for investigation and closure.</div></div>
              <div className="hero-metric"><div className="hero-metric-label">{copy.nextReview}</div><div className="hero-metric-value">{formatUtcDateTime(item.nextReviewAt)}</div><div className="hero-metric-detail">Latest expected case review checkpoint.</div></div>
            </div>
          </div>

          <div className="info-stack">
            <div className="soft-card">
              <div className="panel-header">
                <div><h3 className="section-title" style={{ marginBottom: 6 }}>{copy.casePosture}</h3><div style={{ fontWeight: 800, fontSize: 22 }}>{item.caseRef}</div></div>
                <div className="chip-row"><StatusBadge tone={severityTone(item.severity)}>{item.severity}</StatusBadge><StatusBadge tone={statusTone(item.status)}>{item.status}</StatusBadge></div>
              </div>
              <div className="detail-list">
                <div><span className="detail-label">{copy.category}</span><strong>{item.category}</strong></div>
                <div><span className="detail-label">{copy.investigator}</span><strong>{item.investigator}</strong></div>
                <div><span className="detail-label">{copy.linkedSource}</span><strong>{item.linkedSource}</strong></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DetailStateStrip items={[
        { label: copy.severityPosture, value: item.severity, detail: 'Controls urgency, staffing, and the level of approval scrutiny applied to the case.', tone: severityTone(item.severity) },
        { label: copy.approvalModel, value: item.dualApprovalRequired ? copy.dualApproval : copy.standard, detail: 'Major and critical cases may require more than one reviewer before closure is allowed.', tone: item.dualApprovalRequired ? 'warning' : 'info' },
        { label: copy.closureReadiness, value: item.status === 'Closed' ? copy.complete : copy.open, detail: 'Summarizes whether the case can close or still needs remediation or approval work.', tone: item.status === 'Closed' ? 'success' : 'warning' },
      ]} />

      <div className="split-shell">
        <div className="info-stack">
          <div className="card"><h3 className="section-title">{copy.evidenceStates}</h3><EvidenceCardGrid items={evidenceCards} /></div>
          <div className="card"><h3 className="section-title">{copy.caseMetadata}</h3><MetadataGrid items={[
            { label: copy.category, value: item.category, detail: 'Used to align the case with clinical, medication, or operational response playbooks.' },
            { label: copy.investigator, value: item.investigator, detail: 'The investigator remains visible so escalation and response ownership stay clear.' },
            { label: 'Next checkpoint', value: formatUtcDateTime(item.nextReviewAt), detail: 'Keep the next formal review time visible until the case is closed.' },
            { label: copy.linkedSource, value: item.linkedSource, detail: 'Useful when cross-checking safety review against support, telehealth, or provider governance records.' },
          ]} /></div>
        </div>

        <div className="info-stack">
          <SafetyAdminActions caseId={caseId} disabled={result.source !== 'api'} />
          <div className="card"><h3 className="section-title">{copy.closureGuardrails}</h3><ul className="data-points muted">{item.closureGuardrails.map((rule) => <li key={rule}>{rule}</li>)}</ul></div>
          <div className="card"><h3 className="section-title">{copy.decisionNotes}</h3><ul className="data-points muted"><li>State the incident severity, core finding, and whether the category changed during review.</li><li>Reference the linked source and the remediation or containment steps already executed.</li><li>Preserve every approval or rejection with reviewer identity and timestamp.</li><li>Do not mark the case closed until the remediation plan and linked-domain actions are visible.</li></ul></div>
        </div>
      </div>
    </PortalShell>
  );
}
