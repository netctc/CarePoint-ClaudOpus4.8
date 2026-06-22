import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { DataSourceBanner } from '@/components/admin/data-source-banner';
import { DetailStateStrip, EvidenceCardGrid, MetadataGrid } from '@/components/admin/detail-primitives';
import { PortalShell } from '@/components/layout/portal-shell';
import { loadIntegratedPaymentsWorkspace } from '@/lib/api/admin-server';
import { StatusBadge } from '@/components/ui/status-badge';
import { normalizeAdminLocale } from '@/lib/i18n/admin-dictionary';
import { getAdminPhase5Copy } from '@/lib/i18n/admin-phase5-copy';

function toneForStatus(status: string) {
  if (status === 'Cleared') return 'success';
  if (status === 'Pending') return 'warning';
  return 'danger';
}

export default async function PayoutDetailPage({ params }: { params: Promise<{ batchId: string }> }) {
  const cookieStore = await cookies();
  const locale = normalizeAdminLocale(cookieStore.get('cc_locale')?.value);
  const copy = getAdminPhase5Copy(locale).reconciliation;
  const { batchId } = await params;
  const result = await loadIntegratedPaymentsWorkspace();
  const batch = result.data.items.find((item) => item.id === batchId) || result.data.items[0];
  const selected = result.data.workspace.selectedBatch;

  if (!batch) {
    notFound();
  }

  return (
    <PortalShell currentPath="/portal/payments/reconciliation">
      <DataSourceBanner source={result.source} error={result.error} />
      <div className="admin-v19-finance-workspace admin-v19-finance-detail admin-v19-reconciliation-detail">
      <div className="page-breadcrumbs"><span>{copy.breadcrumbs.payments}</span><span>•</span><span>{copy.breadcrumbs.reconciliation}</span><span>•</span><span>{batch.batchRef}</span></div>
      <div className="hero-panel">
        <div className="hero-panel-grid">
          <div className="hero-copy">
            <div className="tag-group">
              <span className="page-eyebrow">{copy.eyebrow}</span>
              <StatusBadge tone={toneForStatus(batch.status)}>{batch.status}</StatusBadge>
            </div>
            <h2 className="hero-title">{batch.batchRef} {copy.titleSuffix}</h2>
            <p className="hero-subtitle">{copy.subtitle}</p>
            <div className="hero-actions">
              <Link className="button secondary" href="/portal/payments/reconciliation">{copy.backToReconciliation}</Link>
              <Link className="button secondary" href="/portal/payments/refunds">{copy.openRefunds}</Link>
              <Link className="button secondary" href="/portal/audit/logs">{copy.openAuditLogs}</Link>
            </div>
          </div>
          <div className="info-stack">
            <div className="soft-card">
              <h3 className="section-title">{copy.batchSummary}</h3>
              <div className="detail-list">
                <div><span className="detail-label">{copy.gateway}</span><strong>{batch.gateway}</strong></div>
                <div><span className="detail-label">{copy.status}</span><strong>{batch.status}</strong></div>
                <div><span className="detail-label">{copy.amount}</span><strong>{batch.amount}</strong></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DetailStateStrip
        items={[
          { label: copy.remittancePosture, value: batch.status, detail: selected.variance, tone: toneForStatus(batch.status) },
          { label: copy.agingWindow, value: batch.aging, detail: 'Operational aging since the batch first entered settlement review.', tone: batch.status === 'Cleared' ? 'success' : 'warning' },
          { label: copy.impactedDomains, value: `${selected.affectedDomains.length}`, detail: 'Admin areas that should be checked before closure or release.', tone: selected.affectedDomains.length > 2 ? 'warning' : 'info' },
        ]}
      />

      <div className="split-shell" style={{ marginTop: 24 }}>
        <div className="info-stack">
          <div className="card">
            <h3 className="section-title">{copy.remittanceMetadata}</h3>
            <MetadataGrid
              items={[
                { label: 'Batch reference', value: batch.batchRef, detail: 'Primary identifier for finance, support, and audit coordination.' },
                { label: copy.gateway, value: batch.gateway, detail: 'External settlement partner or channel.' },
                { label: copy.amount, value: batch.amount, detail: 'Current gross batch amount under review.' },
                { label: 'Aging', value: batch.aging, detail: 'Used for escalation thresholds and end-of-close pressure.' },
                { label: 'Variance', value: selected.variance, detail: 'Narrative summary of the mismatch or dependency under investigation.' },
                { label: 'Queue focus', value: batch.status === 'Mismatch' ? 'Investigate before release' : batch.status === 'Pending' ? 'Monitor and reconcile' : 'Archive after evidence capture', detail: 'Recommended handling based on current posture.' },
              ]}
            />
          </div>

          <div className="card">
            <h3 className="section-title">{copy.settlementEvidence}</h3>
            <EvidenceCardGrid
              items={[
                {
                  title: 'Variance and affected domains',
                  meta: batch.status,
                  description: 'The redesigned detail page keeps remittance variance, queue pressure, and downstream product impact in one finance-safe workspace.',
                  bullets: [selected.variance, ...selected.affectedDomains],
                  badges: [
                    { label: batch.status, tone: toneForStatus(batch.status) },
                    { label: batch.gateway, tone: 'info' },
                  ],
                },
                {
                  title: 'Closure guardrails',
                  meta: 'Before close or release',
                  description: 'Finance operators should preserve clear reasoning before releasing a batch, deferring a payout, or opening adjacent refund and audit work.',
                  bullets: selected.guardrails,
                  badges: [
                    { label: 'Audit ready', tone: 'info' },
                    { label: batch.status === 'Mismatch' ? 'Needs intervention' : 'Review managed', tone: batch.status === 'Mismatch' ? 'danger' : 'warning' },
                  ],
                },
              ]}
            />
          </div>
        </div>

        <div className="info-stack">
          <div className="card">
            <h3 className="section-title">{copy.decisionLadder}</h3>
            <ul className="data-points muted">
              <li>Confirm gateway posting and internal ledger alignment before any manual release.</li>
              <li>Open refund review if customer-facing reversals or booking disputes are linked to the same batch window.</li>
              <li>Escalate unresolved mismatches into audit review when operator overrides or export activity are involved.</li>
              <li>Record final resolution with enough evidence to support payout, refund, and compliance follow-up.</li>
            </ul>
          </div>

          <div className="card">
            <h3 className="section-title">{copy.crossWorkflow}</h3>
            <div className="list-stack">
              <Link className="list-row" href="/portal/payments/refunds">
                <div>
                  <div className="list-row-title">{copy.refundQueue}</div>
                  <div className="muted">Inspect cases that may be financially or operationally linked to this batch.</div>
                </div>
                <strong>{copy.open}</strong>
              </Link>
              <Link className="list-row" href="/portal/audit/logs">
                <div>
                  <div className="list-row-title">{copy.auditLogs}</div>
                  <div className="muted">Check exports, overrides, and manual adjustments before close.</div>
                </div>
                <strong>{copy.open}</strong>
              </Link>
            </div>
          </div>
        </div>
      </div>
      </div>
    </PortalShell>
  );
}
