import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { DataSourceBanner } from '@/components/admin/data-source-banner';
import { DetailStateStrip, EvidenceCardGrid, MetadataGrid } from '@/components/admin/detail-primitives';
import { RefundAdminActions } from '@/components/admin/refund-admin-actions';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatusBadge } from '@/components/ui/status-badge';
import { loadIntegratedRefundWorkspace } from '@/lib/api/admin-server';
import { normalizeAdminLocale } from '@/lib/i18n/admin-dictionary';
import { getAdminPhase5Copy } from '@/lib/i18n/admin-phase5-copy';

function tone(status: string) {
  if (status === 'Complete') return 'success';
  if (status === 'Needs review') return 'warning';
  return 'danger';
}

export default async function RefundDetailPage({ params }: { params: Promise<{ caseId: string }> }) {
  const cookieStore = await cookies();
  const locale = normalizeAdminLocale(cookieStore.get('cc_locale')?.value);
  const copy = getAdminPhase5Copy(locale).refund;
  const { caseId } = await params;
  const result = await loadIntegratedRefundWorkspace();
  const item = result.data.items.find((entry) => entry.id === caseId);

  if (!item) notFound();

  const selected = result.data.workspace.selectedCase.caseRef === item.caseRef
    ? result.data.workspace.selectedCase
    : {
        caseRef: item.caseRef,
        bookingRef: item.bookingRef,
        counterparty: item.party,
        owner: copy.financeQueue,
        amount: item.amount,
        reasonCode: item.reasonCode,
        evidenceStatus: item.evidenceStatus,
        policy: item.policy,
        queueState: item.evidenceStatus === 'Complete' ? 'Evidence complete' : item.evidenceStatus === 'Needs review' ? 'Pending evidence decision' : 'Awaiting documentation',
        evidence: [
          `Primary policy path: ${item.policy}`,
          `Counterparty: ${item.party}`,
          'Finance reviewer should confirm evidence sufficiency before refund execution.',
        ],
        timeline: [
          'Case imported into admin refund workspace.',
          'Evidence packet reviewed at queue intake.',
          'Awaiting final finance decision and audit note.',
        ],
        recommendedActions: ['Record refund', 'Request gateway evidence', 'Link booking timeline'],
        policyChecks: result.data.workspace.selectedCase.policyChecks,
      };
  const apiItem = result.data.apiItems?.find((entry) => entry.id === item.id);

  const evidenceCards = [
    {
      title: 'Payment ledger snapshot',
      meta: selected.bookingRef,
      description: 'Use this view to confirm charge sequence, gateway posture, and the booking or payout objects tied to the refund request.',
      bullets: [
        `Amount: ${selected.amount}`,
        `Counterparty: ${selected.counterparty}`,
        `Reason code: ${selected.reasonCode}`,
      ],
      badges: [{ label: item.evidenceStatus, tone: tone(item.evidenceStatus) }],
    },
    {
      title: 'Evidence completeness',
      meta: selected.queueState,
      description: 'Review uploaded material, gateway markers, and booking context before releasing any refund action or finance override.',
      bullets: selected.evidence,
      badges: [{ label: selected.policy, tone: 'info' }],
    },
    {
      title: 'Operational timeline',
      meta: 'Refund lifecycle checkpoints',
      description: 'A compact progression of the refund case so finance, support, and audit can align on the same execution history.',
      bullets: selected.timeline,
      badges: [{ label: 'Timeline', tone: 'neutral' }],
    },
    {
      title: 'Recommended handling path',
      meta: 'Action-safe decision support',
      description: 'These next actions keep the workspace aligned to manual review, evidence capture, and payment control expectations.',
      bullets: selected.recommendedActions,
      badges: [{ label: 'Manual review', tone: 'warning' }],
    },
  ];

  return (
    <PortalShell currentPath="/portal/payments/refunds">
      <DataSourceBanner source={result.source} error={result.error} />

      <div className="admin-v19-finance-workspace admin-v19-finance-detail admin-v19-refund-detail">
      <div className="hero-panel admin-v19-hero-panel admin-v19-refund-hero">
        <div className="hero-panel-grid">
          <div className="hero-copy">
            <div className="page-breadcrumbs"><span>{copy.breadcrumbs.payments}</span><span>•</span><span>{copy.breadcrumbs.refunds}</span><span>•</span><span>{item.caseRef}</span></div>
            <div className="page-eyebrow">{copy.eyebrow}</div>
            <h2 className="hero-title">{copy.title}</h2>
            <p className="hero-subtitle">{copy.subtitle}</p>
            <div className="hero-actions">
              <Link className="button secondary" href="/portal/payments/refunds">{copy.backToRefundQueue}</Link>
              <button className="button primary">{copy.exportEvidence}</button>
            </div>
            <div className="hero-metrics">
              <div className="hero-metric"><div className="hero-metric-label">{copy.caseLabel}</div><div className="hero-metric-value">{item.caseRef}</div><div className="hero-metric-detail">Primary refund or dispute identifier in the admin workspace.</div></div>
              <div className="hero-metric"><div className="hero-metric-label">{copy.amount}</div><div className="hero-metric-value">{item.amount}</div><div className="hero-metric-detail">Case amount to review before any refund is posted.</div></div>
              <div className="hero-metric"><div className="hero-metric-label">{copy.policyPath}</div><div className="hero-metric-value">{item.policy}</div><div className="hero-metric-detail">Current policy workflow associated with this refund item.</div></div>
            </div>
          </div>

          <div className="info-stack">
            <div className="soft-card">
              <div className="panel-header">
                <div>
                  <h3 className="section-title" style={{ marginBottom: 6 }}>{copy.evidencePosture}</h3>
                  <div style={{ fontWeight: 800, fontSize: 22 }}>{selected.queueState}</div>
                </div>
                <StatusBadge tone={tone(item.evidenceStatus)}>{item.evidenceStatus}</StatusBadge>
              </div>
              <div className="detail-list">
                <div><span className="detail-label">{copy.booking}</span><strong>{selected.bookingRef}</strong></div>
                <div><span className="detail-label">{copy.counterparty}</span><strong>{selected.counterparty}</strong></div>
                <div><span className="detail-label">{copy.owner}</span><strong>{selected.owner}</strong></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DetailStateStrip
        items={[
          { label: copy.evidenceStatus, value: item.evidenceStatus, detail: 'Captures whether documentation is complete, still under review, or missing from the refund packet.', tone: tone(item.evidenceStatus) },
          { label: copy.executionPosture, value: item.status, detail: 'Visible queue state for whether the case is pending, complete, or still blocked by finance review.', tone: item.status === 'Complete' ? 'success' : 'warning' },
          { label: copy.apiControl, value: apiItem ? copy.live : copy.mock, detail: 'Shows whether refund actions are wired to the API or operating from the fallback dataset.', tone: apiItem ? 'success' : 'neutral' },
        ]}
      />

      <div className="split-shell">
        <div className="info-stack">
          <div className="card">
            <h3 className="section-title">{copy.evidenceStates}</h3>
            <EvidenceCardGrid items={evidenceCards} />
          </div>

          <div className="card">
            <h3 className="section-title">{copy.caseMetadata}</h3>
            <MetadataGrid items={[
              { label: 'Reason code', value: selected.reasonCode, detail: 'Should be preserved on approve, deny, or partial-refund outcomes.' },
              { label: 'Queue owner', value: selected.owner, detail: 'Responsible operator or team currently holding the manual review work item.' },
              { label: 'Policy route', value: selected.policy, detail: 'Indicates the policy regime or exception path guiding the current decision.' },
              { label: 'Recommended outcome', value: selected.recommendedActions[0], detail: 'The first suggested action provides the likely next finance-safe handling path.' },
            ]} />
          </div>
        </div>

        <div className="info-stack">
          {apiItem ? <RefundAdminActions paymentId={apiItem.id} disabled={result.source !== 'api'} /> : null}
          <div className="card">
            <h3 className="section-title">{copy.policyChecks}</h3>
            <ul className="data-points muted">{selected.policyChecks.map((rule) => <li key={rule}>{rule}</li>)}</ul>
          </div>
          <div className="card">
            <h3 className="section-title">{copy.decisionNotes}</h3>
            <ul className="data-points muted">
              <li>Confirm whether the refund is full, partial, denied, or still awaiting evidence.</li>
              <li>Reference the booking, charge, or gateway event that triggered the review.</li>
              <li>Record any exception owner when the case diverges from the standard finance policy route.</li>
              <li>Preserve counterparty context for support and audit follow-up.</li>
            </ul>
          </div>
        </div>
      </div>
      </div>
    </PortalShell>
  );
}
