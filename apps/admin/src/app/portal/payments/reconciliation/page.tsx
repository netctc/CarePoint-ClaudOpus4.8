import Link from 'next/link';
import { PaymentAdminActions } from '@/components/admin/payment-admin-actions';
import { SettlementTable } from '@/components/admin/settlement-table';
import { DataSourceBanner } from '@/components/admin/data-source-banner';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatusBadge } from '@/components/ui/status-badge';
import { loadIntegratedPaymentsWorkspace } from '@/lib/api/admin-server';

function toneForStatus(status: string) {
  if (status === 'Cleared') return 'success';
  if (status === 'Pending') return 'warning';
  return 'danger';
}

export default async function PaymentsReconciliationPage() {
  const result = await loadIntegratedPaymentsWorkspace();
  const selected = result.data.workspace.selectedBatch;
  const selectedApi = result.data.apiItems?.[0] as any;
  const mismatchCount = result.data.items.filter((item) => item.status === 'Mismatch').length;
  const pendingCount = result.data.items.filter((item) => item.status === 'Pending').length;
  const clearedCount = result.data.items.filter((item) => item.status === 'Cleared').length;

  return (
    <PortalShell currentPath="/portal/payments/reconciliation">
      <DataSourceBanner source={result.source} error={result.error} />

      <div className="admin-v19-finance-workspace admin-v19-reconciliation-workspace">
        <div className="hero-panel admin-v19-hero-panel admin-v19-reconciliation-hero">
          <div className="hero-panel-grid">
            <div className="hero-copy">
              <div className="page-eyebrow">A-09 · Payment reconciliation</div>
              <h2 className="hero-title">Financial operations with live settlement controls and variance guardrails</h2>
              <p className="hero-subtitle">
                This workspace keeps the original payment reconciliation loader, settlement table, batch drilldown, and API payment controls while applying a cleaner finance command-center design.
              </p>
              <div className="hero-actions">
                <Link className="button primary" href={`/portal/payments/reconciliation/${selectedApi?.id || 'set-003'}`}>Open remittance detail</Link>
                <button className="button secondary">Export settlement file</button>
                <Link className="button secondary" href="/portal/payments/refunds">Open refund queue</Link>
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
              <div className="soft-card admin-v19-selected-card">
                <div className="panel-header">
                  <div>
                    <h3 className="section-title" style={{ marginBottom: 6 }}>Selected batch</h3>
                    <div style={{ fontWeight: 800, fontSize: 22 }}>{selected.batchRef}</div>
                  </div>
                  <StatusBadge tone={toneForStatus(selected.status)}>{selected.status}</StatusBadge>
                </div>
                <div className="detail-list">
                  <div><span className="detail-label">Gateway</span><strong>{selected.gateway}</strong></div>
                  <div><span className="detail-label">Amount</span><strong>{selected.amount}</strong></div>
                  <div><span className="detail-label">Aging</span><strong>{selected.aging}</strong></div>
                </div>
              </div>
              <div className="mini-card admin-v19-watch-card">
                <h3 className="section-title">Mismatch watch</h3>
                <div className="list-stack">
                  {result.data.workspace.mismatchWatch.map((item) => (
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
          </div>
        </div>

        <div className="admin-v19-intelligence-strip" aria-label="Finance reconciliation status">
          <article className="admin-v19-lane-card admin-v19-lane-card--green">
            <span>Cleared batches</span>
            <strong>{clearedCount}</strong>
            <p>Cleared rows remain sourced from the integrated reconciliation workspace.</p>
          </article>
          <article className="admin-v19-lane-card admin-v19-lane-card--amber">
            <span>Pending review</span>
            <strong>{pendingCount}</strong>
            <p>Pending rows keep the original finance review and export path available.</p>
          </article>
          <article className="admin-v19-lane-card admin-v19-lane-card--red">
            <span>Mismatch exposure</span>
            <strong>{mismatchCount}</strong>
            <p>Mismatch batches can still be inspected through the remittance detail route.</p>
          </article>
        </div>

        <SettlementTable items={result.data.items} />

        <div className="split-shell admin-v19-secondary-grid">
          <div className="card admin-v19-surface-card">
            <h3 className="section-title">Export and payout queue</h3>
            <ul className="data-points muted">
              {result.data.workspace.exportQueue.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="info-stack">
            {selectedApi ? <PaymentAdminActions paymentId={selectedApi.id} isHeld={Boolean(selectedApi.hold.active)} disabled={result.source !== 'api'} /> : null}
            <div className="card admin-v19-surface-card">
              <h3 className="section-title">Selected batch guardrails</h3>
              <div className="detail-list">
                <div><span className="detail-label">Owner</span><strong>{selected.owner}</strong></div>
                <div><span className="detail-label">Posting window</span><strong>{selected.postingWindow}</strong></div>
                <div><span className="detail-label">Variance</span><strong>{selected.variance}</strong></div>
              </div>
              <ul className="data-points muted" style={{ marginTop: 16 }}>
                {selected.affectedDomains.map((domain) => <li key={domain}>{domain}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
