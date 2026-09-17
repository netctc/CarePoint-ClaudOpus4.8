import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { DataSourceBanner } from '@/components/admin/data-source-banner';
import { DetailStateStrip, EvidenceCardGrid, MetadataGrid, type EvidenceCardItem } from '@/components/admin/detail-primitives';
import { ModerationAdminActions } from '@/components/admin/moderation-admin-actions';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatusBadge } from '@/components/ui/status-badge';
import { loadIntegratedModerationWorkspace } from '@/lib/api/admin-server';
import { normalizeAdminLocale } from '@/lib/i18n/admin-dictionary';
import { getAdminPhase5Copy } from '@/lib/i18n/admin-phase5-copy';

function fraudTone(score: string) {
  if (score === 'Low') return 'success';
  if (score === 'Medium') return 'warning';
  return 'danger';
}

function stateTone(state: string) {
  if (state === 'Approved') return 'success';
  if (state === 'Queued') return 'info';
  if (state === 'Redacted') return 'warning';
  return 'danger';
}

export default async function ModerationDetailPage({ params }: { params: Promise<{ reviewId: string }> }) {
  const cookieStore = await cookies();
  const locale = normalizeAdminLocale(cookieStore.get('cc_locale')?.value);
  const copy = getAdminPhase5Copy(locale).moderation;
  const { reviewId } = await params;
  const result = await loadIntegratedModerationWorkspace();
  const item = result.data.items.find((entry) => entry.id === reviewId);

  if (!item) notFound();

  const selected = result.data.workspace.selectedReview.reviewRef === item.reviewRef
    ? result.data.workspace.selectedReview
    : {
        reviewRef: item.reviewRef,
        providerName: item.providerName,
        fraudScore: item.fraudScore,
        moderationState: item.moderationState,
        disputeOwner: item.disputeOpen ? 'Trust and safety' : 'No active owner',
        evidenceWindow: 'Current moderation evidence window',
        riskNote: item.fraudScore === 'High' ? 'High-risk language or account-linkage pattern requires same-day review.' : 'Review remains in standard moderation workflow.',
        evidence: [
          'Original review content retained in the protected evidence store.',
          item.disputeOpen ? 'Provider dispute remains open and should be resolved with a recorded rationale.' : 'No open provider dispute on this review.',
          `Current moderation state: ${item.moderationState}`,
        ],
        actions: ['Assign reviewer', 'Redact content', 'Resolve moderation outcome'],
        guardrails: result.data.workspace.selectedReview.guardrails,
      };

  const evidenceCards: EvidenceCardItem[] = [
    {
      title: 'Source review evidence',
      meta: selected.reviewRef,
      description: 'Preserve the original review, any edits, and the current moderation disposition in a single protected evidence view.',
      bullets: selected.evidence,
      badges: [{ label: selected.moderationState, tone: stateTone(selected.moderationState) }],
    },
    {
      title: 'Fraud and linkage signals',
      meta: selected.fraudScore,
      description: 'Used to determine whether the item stays in the standard moderation lane or moves into trust and safety escalation.',
      bullets: [
        selected.riskNote,
        item.disputeOpen ? 'Open dispute keeps the evidence window active.' : 'No active provider dispute is currently open.',
        'Coordinated or repeated patterns should be preserved for governance review.',
      ],
      badges: [{ label: selected.fraudScore, tone: fraudTone(selected.fraudScore) }],
    },
    {
      title: 'Dispute handling state',
      meta: selected.disputeOwner,
      description: 'This state helps moderators preserve ownership, response window, and escalations during provider dispute handling.',
      bullets: [
        `Evidence window: ${selected.evidenceWindow}`,
        item.disputeOpen ? 'Provider challenge remains open and should be resolved with an explicit rationale.' : 'This review can progress without dispute-specific approval routing.',
        'Reinstatement or removal changes should be captured as a reversible audit event.',
      ],
      badges: [{ label: item.disputeOpen ? 'Dispute open' : 'No dispute', tone: item.disputeOpen ? 'warning' : 'success' }],
    },
    {
      title: 'Recommended moderation actions',
      meta: 'Decision support',
      description: 'Keeps the next safe moderation actions visible before the reviewer commits to a final outcome.',
      bullets: selected.actions,
      badges: [{ label: 'Action set', tone: 'info' }],
    },
  ];

  return (
    <PortalShell currentPath="/portal/reviews/moderation">
      <DataSourceBanner source={result.source} error={result.error} />

      <div className="hero-panel">
        <div className="hero-panel-grid">
          <div className="hero-copy">
            <div className="page-breadcrumbs"><span>{copy.breadcrumbs.reviews}</span><span>•</span><span>{copy.breadcrumbs.moderation}</span><span>•</span><span>{item.reviewRef}</span></div>
            <div className="page-eyebrow">{copy.eyebrow}</div>
            <h2 className="hero-title">{copy.title}</h2>
            <p className="hero-subtitle">{copy.subtitle}</p>
            <div className="hero-actions">
              <Link className="button secondary" href="/portal/reviews/moderation">{copy.backToQueue}</Link>
              <button className="button primary">{copy.openSourceEvidence}</button>
            </div>
            <div className="hero-metrics">
              <div className="hero-metric"><div className="hero-metric-label">{copy.review}</div><div className="hero-metric-value">{item.reviewRef}</div><div className="hero-metric-detail">Primary moderation record in the review workspace.</div></div>
              <div className="hero-metric"><div className="hero-metric-label">{copy.fraudScore}</div><div className="hero-metric-value">{item.fraudScore}</div><div className="hero-metric-detail">Used to prioritize trust and safety handling.</div></div>
              <div className="hero-metric"><div className="hero-metric-label">{copy.dispute}</div><div className="hero-metric-value">{item.disputeOpen ? copy.open : copy.closed}</div><div className="hero-metric-detail">Provider dispute posture on the current review record.</div></div>
            </div>
          </div>

          <div className="info-stack">
            <div className="soft-card">
              <div className="panel-header">
                <div>
                  <h3 className="section-title" style={{ marginBottom: 6 }}>{copy.currentPosture}</h3>
                  <div style={{ fontWeight: 800, fontSize: 22 }}>{selected.providerName}</div>
                </div>
                <div className="chip-row">
                  <StatusBadge tone={fraudTone(selected.fraudScore)}>{selected.fraudScore}</StatusBadge>
                  <StatusBadge tone={stateTone(selected.moderationState)}>{selected.moderationState}</StatusBadge>
                </div>
              </div>
              <div className="detail-list">
                <div><span className="detail-label">{copy.disputeOwner}</span><strong>{selected.disputeOwner}</strong></div>
                <div><span className="detail-label">{copy.evidenceWindow}</span><strong>{selected.evidenceWindow}</strong></div>
              </div>
            </div>
            <div className="mini-card">
              <h3 className="section-title">{copy.riskNote}</h3>
              <div className="banner warning">{selected.riskNote}</div>
            </div>
          </div>
        </div>
      </div>

      <DetailStateStrip
        items={[
          { label: copy.fraudPosture, value: selected.fraudScore, detail: 'Used for prioritization, same-day review routing, and trust-and-safety escalation.', tone: fraudTone(selected.fraudScore) },
          { label: copy.moderationState, value: selected.moderationState, detail: 'Reflects whether the item is queued, redacted, removed, or approved for display.', tone: stateTone(selected.moderationState) },
          { label: copy.disputeState, value: item.disputeOpen ? copy.open : copy.closed, detail: 'Open disputes should keep the provider response window and evidence owner visible.', tone: item.disputeOpen ? 'warning' : 'success' },
        ]}
      />

      <div className="split-shell">
        <div className="info-stack">
          <div className="card"><h3 className="section-title">{copy.evidenceViews}</h3><EvidenceCardGrid items={evidenceCards} /></div>
          <div className="card"><h3 className="section-title">{copy.moderationMetadata}</h3><MetadataGrid items={[
            { label: 'Current owner', value: selected.disputeOwner, detail: 'Explicitly identifies which role or queue is responsible for the next moderation action.' },
            { label: 'Evidence window', value: selected.evidenceWindow, detail: 'Important for dispute-handling SLAs and safe closure timing.' },
            { label: 'Provider context', value: selected.providerName, detail: 'Useful when connecting moderation patterns to provider governance outcomes.' },
            { label: 'Likely next action', value: selected.actions[0], detail: 'The first recommended action surfaces the most probable safe next step.' },
          ]} /></div>
        </div>

        <div className="info-stack">
          <ModerationAdminActions reviewId={reviewId} disabled={result.source !== 'api'} />
          <div className="card"><h3 className="section-title">{copy.outcomeGuardrails}</h3><ul className="data-points muted">{selected.guardrails.map((rule) => <li key={rule}>{rule}</li>)}</ul></div>
          <div className="card"><h3 className="section-title">{copy.decisionNotes}</h3><ul className="data-points muted"><li>State whether the review was approved, redacted, removed, or escalated.</li><li>Record the dispute rationale when the provider contests the moderation outcome.</li><li>Preserve the fraud or linkage signal that justified a higher-risk handling path.</li><li>Keep the evidence owner and review timestamp visible for later audit export.</li></ul></div>
        </div>
      </div>
    </PortalShell>
  );
}
