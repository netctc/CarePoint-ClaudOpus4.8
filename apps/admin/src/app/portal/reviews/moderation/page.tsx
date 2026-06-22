import Link from 'next/link';
import { DataSourceBanner } from '@/components/admin/data-source-banner';
import { ModerationAdminActions } from '@/components/admin/moderation-admin-actions';
import { ReviewModerationTable } from '@/components/admin/review-moderation-table';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatusBadge } from '@/components/ui/status-badge';
import { loadIntegratedModerationWorkspace } from '@/lib/api/admin-server';

function tone(score: string) {
  if (score === 'Low') return 'success';
  if (score === 'Medium') return 'warning';
  return 'danger';
}

export default async function ReviewModerationPage() {
  const result = await loadIntegratedModerationWorkspace();
  const selected = result.data.workspace.selectedReview;
  const selectedItem = result.data.items.find((item) => item.reviewRef === selected.reviewRef) || result.data.items[0];

  return (
    <PortalShell currentPath="/portal/reviews/moderation">
      <DataSourceBanner source={result.source} error={result.error} />

      <div className="hero-panel">
        <div className="hero-panel-grid">
          <div className="hero-copy">
            <div className="page-eyebrow">A-11 · Review moderation</div>
            <h2 className="hero-title">Moderation queue redesigned around risk posture, dispute ownership, and defensible outcomes</h2>
            <p className="hero-subtitle">
              This wave transforms review moderation into a trust-and-safety workspace with better signal triage, provider dispute context, and a dedicated drilldown page for each review record.
            </p>
            <div className="hero-actions">
              <Link className="button primary" href={selectedItem ? `/portal/reviews/moderation/${selectedItem.id}` : '/portal/reviews/moderation'}>Open selected review</Link>
              <button className="button secondary">Export moderation queue</button>
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
                  <h3 className="section-title" style={{ marginBottom: 6 }}>Selected review</h3>
                  <div style={{ fontWeight: 800, fontSize: 22 }}>{selected.reviewRef}</div>
                </div>
                <StatusBadge tone={tone(selected.fraudScore)}>{selected.fraudScore}</StatusBadge>
              </div>
              <div className="detail-list">
                <div><span className="detail-label">Provider</span><strong>{selected.providerName}</strong></div>
                <div><span className="detail-label">State</span><strong>{selected.moderationState}</strong></div>
                <div><span className="detail-label">Owner</span><strong>{selected.disputeOwner}</strong></div>
              </div>
            </div>

            <div className="mini-card">
              <h3 className="section-title">Risk note</h3>
              <div className="banner warning">{selected.riskNote}</div>
            </div>
          </div>
        </div>
      </div>

      <ReviewModerationTable items={result.data.items} />

      <div className="split-shell">
        <div className="card">
          <h3 className="section-title">Fraud and dispute watch</h3>
          <div className="list-stack">
            {result.data.workspace.queueSignals.map((item) => (
              <div key={item.label} className="list-row">
                <div>
                  <div className="list-row-title">{item.label}</div>
                  <div className="muted">{item.note}</div>
                </div>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="info-stack">
          {result.data.selectedReviewId ? <ModerationAdminActions reviewId={result.data.selectedReviewId} disabled={result.source !== 'api'} /> : null}
          <div className="card">
            <h3 className="section-title">Recent moderation outcomes</h3>
            <ul className="data-points muted">
              {result.data.workspace.recentOutcomes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
