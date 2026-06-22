import Link from 'next/link';
import { cookies } from 'next/headers';
import { DataSourceBanner } from '@/components/admin/data-source-banner';
import { RefundAdminActions } from '@/components/admin/refund-admin-actions';
import { RefundCasesTable } from '@/components/admin/refund-cases-table';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatusBadge } from '@/components/ui/status-badge';
import { loadIntegratedRefundWorkspace } from '@/lib/api/admin-server';
import { getAdminPortalCopy } from '@/lib/i18n/admin-portal-copy';
import { normalizeAdminLocale } from '@/lib/i18n/admin-dictionary';

function tone(status: string) {
  if (status === 'Complete') return 'success';
  if (status === 'Needs review') return 'warning';
  return 'danger';
}

export default async function RefundsPage() {
  const cookieStore = await cookies();
  const locale = normalizeAdminLocale(cookieStore.get('cc_locale')?.value);
  const copy = getAdminPortalCopy(locale).refunds;
  const result = await loadIntegratedRefundWorkspace();
  const selected = result.data.workspace.selectedCase;
  const selectedItem = result.data.items.find((item) => item.caseRef === selected.caseRef) || result.data.items[0];
  const selectedApi = selectedItem ? result.data.apiItems?.find((item) => item.id === selectedItem.id) : undefined;
  const completeCount = result.data.items.filter((item) => item.evidenceStatus === 'Complete').length;
  const reviewCount = result.data.items.filter((item) => item.evidenceStatus === 'Needs review').length;
  const missingCount = result.data.items.filter((item) => item.evidenceStatus === 'Missing').length;

  return (
    <PortalShell currentPath="/portal/payments/refunds">
      <DataSourceBanner source={result.source} error={result.error} />

      <div className="admin-v19-finance-workspace admin-v19-refund-workspace">
        <div className="hero-panel admin-v19-hero-panel admin-v19-refund-hero">
          <div className="hero-panel-grid">
            <div className="hero-copy">
              <div className="page-eyebrow">{copy.eyebrow}</div>
              <h2 className="hero-title">{copy.title}</h2>
              <p className="hero-subtitle">{copy.subtitle}</p>
              <div className="hero-actions">
                <Link className="button primary" href={selectedItem ? `/portal/payments/refunds/${selectedItem.id}` : '/portal/payments/refunds'}>{copy.openCase}</Link>
                <button className="button secondary">{copy.requestGatewayPack}</button>
                <Link className="button secondary" href="/portal/payments/reconciliation">Open reconciliation</Link>
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
                    <h3 className="section-title" style={{ marginBottom: 6 }}>Selected refund case</h3>
                    <div style={{ fontWeight: 800, fontSize: 22 }}>{selected.caseRef}</div>
                  </div>
                  <StatusBadge tone={tone(selected.evidenceStatus)}>{selected.evidenceStatus}</StatusBadge>
                </div>
                <div className="detail-list">
                  <div><span className="detail-label">Booking</span><strong>{selected.bookingRef}</strong></div>
                  <div><span className="detail-label">Counterparty</span><strong>{selected.counterparty}</strong></div>
                  <div><span className="detail-label">{copy.amount}</span><strong>{selected.amount}</strong></div>
                </div>
              </div>

              <div className="mini-card admin-v19-watch-card">
                <h3 className="section-title">Queue state</h3>
                <div className="banner warning">{selected.queueState}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="admin-v19-intelligence-strip" aria-label="Refund evidence status">
          <article className="admin-v19-lane-card admin-v19-lane-card--green">
            <span>Evidence complete</span>
            <strong>{completeCount}</strong>
            <p>Complete cases remain visible with their original case drilldown links.</p>
          </article>
          <article className="admin-v19-lane-card admin-v19-lane-card--amber">
            <span>Needs review</span>
            <strong>{reviewCount}</strong>
            <p>Review cases keep the original finance control path and API action component.</p>
          </article>
          <article className="admin-v19-lane-card admin-v19-lane-card--red">
            <span>Missing evidence</span>
            <strong>{missingCount}</strong>
            <p>Missing evidence rows remain available for gateway packet and support follow-up.</p>
          </article>
        </div>

        <RefundCasesTable items={result.data.items} />

        <div className="split-shell admin-v19-secondary-grid">
          <div className="card admin-v19-surface-card">
            <h3 className="section-title">Reason-code monitor</h3>
            <div className="list-stack">
              {result.data.workspace.reasonBreakdown.map((item) => (
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

          <div className="info-stack">
            {selectedApi ? <RefundAdminActions paymentId={selectedApi.id} disabled={result.source !== 'api'} /> : null}
            <div className="card admin-v19-surface-card">
              <h3 className="section-title">Recommended actions</h3>
              <ul className="data-points muted">
                {selected.recommendedActions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
