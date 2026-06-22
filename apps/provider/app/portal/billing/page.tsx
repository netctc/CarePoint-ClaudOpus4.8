'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { EvidencePanel } from '@/components/shared/evidence-panel';
import { WorkspaceStateStrip } from '@/components/shared/workspace-state-strip';
import { StatCard } from '@/components/shared/stat-card';
import { providerApi } from '@/services/api-client';
import { getBillingPayoutsData } from '@/services/mock-api';
import { useProviderLocale } from '@/components/i18n/provider-locale-provider';
import { getProviderPortalCopy } from '@/lib/i18n/provider-portal-copy';

function money(currency?: string | null, amountMinor?: number | null) {
  if (typeof amountMinor !== 'number') return '—';
  return `${currency ?? ''} ${(amountMinor / 100).toFixed(2)}`.trim();
}

export default function BillingPayoutsPage() {
  const { locale, dir } = useProviderLocale();
  const copy = getProviderPortalCopy(locale).billing;
  const [items, setItems] = useState<any[]>([]);
  const [source, setSource] = useState<'live' | 'fallback'>('live');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result: any = await providerApi.payments();
      setItems(result.items ?? []);
      setSource('live');
    } catch (err) {
      const fallback = getBillingPayoutsData();
      setItems(
        fallback.payoutBatches.map((item) => ({
          id: item.id,
          service: copy.payoutBatch,
          patientName: item.period,
          providerName: copy.providerOrgStatement,
          amountMinor: Number(String(item.amount).replace(/[^\d.]/g, '')) * 100,
          currency: 'SAR',
          status: item.status.toUpperCase().replaceAll(' ', '_'),
        })),
      );
      setSource('fallback');
      setError(err instanceof Error ? err.message : copy.unableLoad);
    } finally {
      setLoading(false);
    }
  }, [copy.payoutBatch, copy.providerOrgStatement, copy.unableLoad]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(() => {
    const totalMinor = items.reduce((sum, item) => sum + Number(item.amountMinor || 0), 0);
    return {
      totalMinor,
      captured: items.filter((item) => item.status === 'CAPTURED').length,
      authorized: items.filter((item) => item.status === 'AUTHORIZED').length,
      refunded: items.filter((item) => item.status === 'REFUNDED').length,
    };
  }, [items]);

  return (
    <div className="page-stack" dir={dir}>
      <section className="page-header split-header">
        <div>
          <span className="eyebrow">PR-21</span>
          <h1>{copy.title}</h1>
          <p className="muted">{copy.subtitle}</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={load}>{copy.refresh}</button>
        </div>
      </section>

      <div className="banner banner-info">
        <div>
          <strong>{copy.readTitle}</strong>
          <p className="muted small">{copy.readText}</p>
        </div>
        <span className="status-chip status-info">{copy.readFocus}</span>
      </div>

      {source === 'fallback' ? (
        <div className="banner banner-warning">
          <div>
            <strong>{copy.fallbackTitle}</strong>
            <p className="muted small">{copy.fallbackText} {error ?? 'Unknown error'}.</p>
          </div>
          <span className="status-chip status-warning">Fallback</span>
        </div>
      ) : null}

      {error && source === 'live' ? <div className="status-chip status-danger">{error}</div> : null}

      <WorkspaceStateStrip
        items={[
          { label: copy.ledgerItems, value: String(items.length), tone: 'info' },
          { label: copy.authorized, value: String(summary.authorized), tone: 'warning' },
          { label: copy.captured, value: String(summary.captured), tone: 'success' },
          { label: copy.refunded, value: String(summary.refunded), tone: summary.refunded ? 'danger' : 'info' },
        ]}
      />

      <section className="stats-grid">
        <StatCard label={copy.ledgerItems} value={String(items.length)} detail={copy.visibleOnly} />
        <StatCard label={copy.grossValue} value={(summary.totalMinor / 100).toFixed(2)} detail={copy.grossDetail} />
        <StatCard label={copy.authorized} value={String(summary.authorized)} detail={copy.authorizedDetail} />
        <StatCard label={`${copy.captured} / ${copy.refunded}`} value={`${summary.captured} / ${summary.refunded}`} detail={copy.finalizedDetail} />
      </section>

      <section className="workspace-grid top-align-grid">
        <article className="panel-card">
          <div className="panel-header"><h2>{copy.ledgerDetail}</h2><span className="status-chip status-info">{copy.financialVisibility}</span></div>
          <div className="table-card" style={{ padding: 0, border: 0, boxShadow: 'none' }}>
            {loading && !items.length ? <div className="status-chip status-info" style={{ margin: 20 }}>{copy.loading}</div> : null}
            <table className="data-table">
              <thead>
                <tr>
                  <th>{copy.service}</th>
                  <th>{copy.reference}</th>
                  <th>{copy.provider}</th>
                  <th>{copy.amount}</th>
                  <th>{copy.status}</th>
                  <th>{copy.availability}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.service ?? copy.appointmentPayment}</td>
                    <td>{item.patientName ?? item.id}</td>
                    <td>{item.providerName ?? copy.assignedProvider}</td>
                    <td>{money(item.currency, Number(item.amountMinor || 0))}</td>
                    <td>{item.status}</td>
                    <td>{item.status === 'AUTHORIZED' ? copy.awaitingFinanceAction : copy.visibleOnly}</td>
                  </tr>
                ))}
                {!items.length ? (
                  <tr>
                    <td colSpan={6} className="muted">{copy.noItems}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <div className="workspace-side-stack">
          <EvidencePanel
            title={copy.financeHandoff}
            badge={copy.governance}
            items={[
              { title: copy.authorizedItems, detail: copy.authorizedItemsText },
              { title: copy.refundedItems, detail: copy.refundedItemsText },
              { title: copy.providerResponsibility, detail: copy.providerResponsibilityText },
            ]}
          />
        </div>
      </section>
    </div>
  );
}
