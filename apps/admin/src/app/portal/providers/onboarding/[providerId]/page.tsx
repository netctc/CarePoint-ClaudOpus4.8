import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { DataSourceBanner } from '@/components/admin/data-source-banner';
import { DetailStateStrip, EvidenceCardGrid, MetadataGrid } from '@/components/admin/detail-primitives';
import { ProviderReviewActions } from '@/components/admin/provider-review-actions';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatusBadge } from '@/components/ui/status-badge';
import { loadIntegratedProviderReview } from '@/lib/api/admin-server';
import { formatUtcDateTime } from '@/lib/formatters';
import { normalizeAdminLocale } from '@/lib/i18n/admin-dictionary';
import { getAdminPhase5Copy } from '@/lib/i18n/admin-phase5-copy';

function tone(result: 'Pass' | 'Review' | 'Fail') {
  if (result === 'Pass') return 'success';
  if (result === 'Review') return 'warning';
  return 'danger';
}

function docTone(status: 'Received' | 'Missing' | 'Rejected') {
  if (status === 'Received') return 'success';
  if (status === 'Missing') return 'warning';
  return 'danger';
}

export default async function ProviderOnboardingReviewPage({ params }: { params: Promise<{ providerId: string }> }) {
  const cookieStore = await cookies();
  const locale = normalizeAdminLocale(cookieStore.get('cc_locale')?.value);
  const copy = getAdminPhase5Copy(locale).onboarding;
  const { providerId } = await params;

  try {
    const result = await loadIntegratedProviderReview(providerId);
    const detail = result.data.detail;
    const apiDetail = result.data.apiDetail;
    const docsReceived = detail.mandatoryDocs.filter((doc) => doc.status === 'Received').length;
    const checksPassed = detail.checks.filter((check) => check.result === 'Pass').length;
    const hasBlockingItem = docsReceived !== detail.mandatoryDocs.length || checksPassed !== detail.checks.length;
    const requestedFields = apiDetail?.onboarding.persistedState?.requestedFields ?? [];
    const latestAction = apiDetail?.onboarding.latestReview?.action ? apiDetail.onboarding.latestReview.action.replace(/[_\.]+/g, ' ') : copy.noReviewAction;

    const evidenceCards = detail.mandatoryDocs.map((doc) => ({
      title: doc.name,
      meta: doc.status === 'Received' ? 'Evidence packet available for review' : 'Reviewer follow-up is still required',
      description: doc.status === 'Received'
        ? `Document has been uploaded for ${detail.providerName} and is ready for identity, validity, and consistency checks.`
        : doc.status === 'Rejected'
          ? 'Prior review marked this document as insufficient. Re-collection or escalation is required before approval.'
          : 'Submission is incomplete and approval should remain blocked until the missing document is supplied.',
      bullets: [
        `Applies to license ${detail.licenseNumber}`,
        `Organization context: ${detail.organizationName}`,
        hasBlockingItem ? 'Keep the queue item in review until the document state is resolved.' : 'Document can be referenced in the final approval rationale.',
      ],
      badges: [{ label: doc.status, tone: docTone(doc.status) }],
    }));

    const readinessItems = detail.checks.map((check) => ({
      title: check.label,
      meta: check.result === 'Pass' ? 'Control cleared' : 'Needs reviewer intervention',
      description: check.result === 'Pass'
        ? 'The current verification state indicates no blocking exception for this control.'
        : check.result === 'Review'
          ? 'The control returned an indeterminate result and should be reviewed with a note or escalation decision.'
          : 'This control failed and should remain visible in the decision summary until corrected or formally rejected.',
      bullets: [
        `Provider: ${detail.providerName}`,
        `Scope: ${detail.cityCoverage.join(', ')}`,
        'Any override should be documented in the audit trail before the final outcome is saved.',
      ],
      badges: [{ label: check.result, tone: tone(check.result) }],
    }));

    const reviewTimeline = apiDetail?.onboarding.history?.length ? apiDetail.onboarding.history : [];

    return (
      <PortalShell currentPath="/portal/providers/onboarding">
        <DataSourceBanner source={result.source} error={result.error} />

        <div className="admin-v17-provider-workspace admin-v17-provider-detail">
        <div className="hero-panel">
          <div className="hero-panel-grid">
            <div className="hero-copy">
              <div className="page-breadcrumbs"><span>{copy.breadcrumbs.providers}</span><span>•</span><span>{copy.breadcrumbs.queue}</span><span>•</span><span>{detail.providerName}</span></div>
              <div className="page-eyebrow">{copy.eyebrow}</div>
              <h2 className="hero-title">{copy.title}</h2>
              <p className="hero-subtitle">{copy.subtitle}</p>
              <div className="hero-actions"><Link className="button secondary" href="/portal/providers/onboarding">{copy.backToQueue}</Link><Link className="button primary" href={`/portal/providers/${providerId}`}>{copy.openProviderProfile}</Link></div>
              <div className="hero-metrics">
                <div className="hero-metric"><div className="hero-metric-label">{copy.coverageMarkets}</div><div className="hero-metric-value">{detail.cityCoverage.length}</div><div className="hero-metric-detail">Cities currently requested in the onboarding submission.</div></div>
                <div className="hero-metric"><div className="hero-metric-label">{copy.blockingItems}</div><div className="hero-metric-value">{hasBlockingItem ? copy.yes : copy.no}</div><div className="hero-metric-detail">Approval remains blocked until unresolved evidence is cleared or escalated.</div></div>
                <div className="hero-metric"><div className="hero-metric-label">{copy.storageMode}</div><div className="hero-metric-value">{apiDetail?.onboarding.storageMode || copy.fallback}</div><div className="hero-metric-detail">Current backend source used for this review detail route.</div></div>
              </div>
            </div>

            <div className="info-stack">
              <div className="soft-card">
                <div className="panel-header">
                  <div><h3 className="section-title" style={{ marginBottom: 6 }}>{copy.submissionOverview}</h3><div style={{ fontWeight: 800, fontSize: 22 }}>{detail.providerName}</div></div>
                  <StatusBadge tone={hasBlockingItem ? 'warning' : 'success'}>{hasBlockingItem ? copy.blocked : copy.ready}</StatusBadge>
                </div>
                <div className="detail-list">
                  <div><span className="detail-label">{copy.organization}</span><strong>{detail.organizationName}</strong></div>
                  <div><span className="detail-label">{copy.license}</span><strong>{detail.licenseNumber}</strong></div>
                  <div><span className="detail-label">{copy.latestPosture}</span><strong>{latestAction}</strong></div>
                </div>
              </div>

              <div className="mini-card">
                <h3 className="section-title">{copy.decisionPosture}</h3>
                <div className={hasBlockingItem ? 'banner warning' : 'banner success'}>{hasBlockingItem ? copy.blockedText : copy.readyText}</div>
              </div>
            </div>
          </div>
        </div>

        <DetailStateStrip items={[
          { label: copy.docsReceived, value: `${docsReceived}/${detail.mandatoryDocs.length}`, detail: 'Tracks whether the evidence packet is complete enough for a final decision.', tone: docsReceived === detail.mandatoryDocs.length ? 'success' : 'warning' },
          { label: copy.checksPassed, value: `${checksPassed}/${detail.checks.length}`, detail: 'Identity, sanctions, organization, and compliance controls visible in the review flow.', tone: checksPassed === detail.checks.length ? 'success' : 'warning' },
          { label: copy.requestedCorrections, value: requestedFields.length ? String(requestedFields.length) : '0', detail: requestedFields.length ? 'Requested fields remain open in the persisted review state.' : 'No correction fields are currently outstanding.', tone: requestedFields.length ? 'warning' : 'info' },
        ]} />

        <div className="split-shell">
          <div className="info-stack">
            <div className="card"><h3 className="section-title">{copy.evidencePacket}</h3><EvidenceCardGrid items={evidenceCards} /></div>
            <div className="card"><h3 className="section-title">{copy.verificationReadiness}</h3><EvidenceCardGrid items={readinessItems} /></div>
            <div className="card"><h3 className="section-title">{copy.reviewMetadata}</h3><MetadataGrid items={[
              { label: 'Coverage scope', value: detail.cityCoverage.join(', '), detail: 'Used to validate service area, licensing, and routing assumptions before activation.' },
              { label: 'Persisted state', value: apiDetail?.onboarding.persistedState?.status || 'No persisted state', detail: 'Shows the last stored decision posture returned by the onboarding API.' },
              { label: 'Requested fields', value: requestedFields.length ? requestedFields.join(', ') : 'None', detail: 'Fields that should be explicitly called out if changes are requested.' },
              { label: 'Risk profile', value: hasBlockingItem ? 'Escalate or hold' : 'Approval-ready', detail: detail.riskNotes[0] || 'No additional risk note provided for this provider.' },
            ]} /></div>
          </div>

          <div className="info-stack">
            <ProviderReviewActions providerId={providerId} disabled={!apiDetail} />
            <div className="card"><h3 className="section-title">{copy.decisionEvidence}</h3><ul className="data-points muted"><li>Reference any missing or rejected document by name in the reviewer note.</li><li>State whether remediation, rejection, or escalation is being applied and why.</li><li>Confirm the intended service-market activation scope for the final decision.</li><li>Preserve a clear actor trail whenever a manual override is used.</li></ul></div>
            <div className="card"><h3 className="section-title">{copy.riskNotes}</h3><ul className="data-points muted">{detail.riskNotes.map((note) => <li key={note}>{note}</li>)}<li>Escalate to compliance if any mandatory identity or sanctions signal cannot be cleared.</li><li>Escalate to finance when payout onboarding remains incomplete near approval time.</li></ul></div>
            <div className="card"><h3 className="section-title">{copy.recordedHistory}</h3><div className="timeline-list">{reviewTimeline.length ? reviewTimeline.map((entry) => (<div key={entry.id} className="timeline-item"><div style={{ fontWeight: 800 }}>{formatUtcDateTime(entry.createdAt)}</div><div>{entry.action}</div><div className="muted">{entry.actor?.name || entry.actor?.email || 'System'}</div><div className="muted">{typeof entry.details?.note === 'string' ? entry.details.note : copy.noNoteRecorded}</div></div>)) : <div className="banner info">{copy.noHistory}</div>}</div></div>
          </div>
        </div>
        </div>
      </PortalShell>
    );
  } catch {
    notFound();
  }
}
