'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { StatCard } from '@/components/shared/stat-card';
import { WorkspaceStateStrip } from '@/components/shared/workspace-state-strip';
import { providerApi } from '@/services/api-client';
import { getLabOrderInboxData } from '@/services/mock-api';
import { useProviderLocale } from '@/components/i18n/provider-locale-provider';
import { getProviderDetailCopy } from '@/lib/i18n/provider-detail-copy';

export default function LabOrdersInboxPage() {
  const { locale, dir } = useProviderLocale();
  const copy = getProviderDetailCopy(locale).labInbox;
  const searchParams = useSearchParams();
  const patientId = searchParams.get('patientId');
  const fallback = useMemo(() => getLabOrderInboxData(), []);

  const [items, setItems] = useState<any[]>([]);
  const [pendingCount, setPendingCount] = useState(fallback.pendingCount);
  const [source, setSource] = useState<'live' | 'fallback'>('fallback');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result: any = await providerApi.providerLabsInbox(patientId ?? undefined);
      setItems(result.items ?? []);
      setPendingCount(Number(result.pendingCount ?? 0));
      setSource('live');
    } catch (err) {
      setItems([]);
      setPendingCount(fallback.pendingCount);
      setSource('fallback');
      setError(err instanceof Error ? err.message : copy.unableLoad);
    }
  }, [fallback.pendingCount, patientId]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = source === 'live' && items.length ? items : fallback.items;

  return (
    <div className="page-stack" dir={dir}>
      <section className="page-header split-header">
        <div>
          <span className="eyebrow">PR-14</span>
          <h1>{copy.title}</h1>
          <p className="muted">{copy.subtitle}</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={load}>{copy.refresh}</button>
          <span className="status-chip status-warning">{pendingCount} {copy.pending}</span>
        </div>
      </section>

      <div className={`banner ${source === 'live' ? 'banner-success' : 'banner-warning'}`}>
        <div>
          <strong>{source === 'live' ? copy.liveTitle : copy.fallbackTitle}</strong>
          <p className="muted small">{source === 'live' ? copy.liveText : `${copy.fallbackTextPrefix} ${error ?? 'Unknown error'}.`}</p>
        </div>
        <span className={`status-chip status-${source === 'live' ? 'success' : 'warning'}`}>{source === 'live' ? copy.live : copy.fallback}</span>
      </div>

      <WorkspaceStateStrip
        items={[
          { label: copy.queueSource, value: source === 'live' ? copy.providerApi : copy.fallback, tone: source === 'live' ? 'success' : 'warning' },
          { label: copy.pendingItems, value: String(pendingCount), tone: pendingCount ? 'warning' : 'success' },
          { label: copy.visibleRows, value: String(rows.length), tone: 'info' },
          { label: copy.patientScope, value: patientId ?? copy.allPatients, tone: 'info' },
        ]}
      />

      <section className="stats-grid">
        <StatCard label={copy.pendingItems} value={String(pendingCount)} detail={copy.needAction} />
        <StatCard label={copy.visibleRows} value={String(rows.length)} detail={copy.currentScope} />
        <StatCard label={copy.patientScope} value={patientId ?? copy.allPatients} detail={patientId ? copy.filteredByChart : copy.noPatientFilter} />
        <StatCard label={copy.storage} value={source === 'live' ? copy.providerApi : copy.starter} detail={copy.queueSourceDetail} />
      </section>

      <section className="panel-card pale-card">
        <div className="panel-header"><h2>{copy.reviewGuidance}</h2><span className="status-chip status-info">{copy.labRelease}</span></div>
        <div className="metric-board">
          <div className="note-card"><strong>{copy.criticalValues}</strong><p className="muted small">{copy.criticalValuesText}</p></div>
          <div className="note-card"><strong>{copy.secondReview}</strong><p className="muted small">{copy.secondReviewText}</p></div>
          <div className="note-card"><strong>{copy.chartLinkage}</strong><p className="muted small">{copy.chartLinkageText}</p></div>
        </div>
      </section>

      <section className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>{copy.patient}</th>
              <th>{copy.test}</th>
              <th>{copy.requested}</th>
              <th>{copy.location}</th>
              <th>{copy.status}</th>
              <th>{copy.nextStep}</th>
              <th>{copy.action}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.patientName}</strong></td>
                <td>{item.testName}</td>
                <td>{item.requestedAt}</td>
                <td>{item.location}</td>
                <td><span className={`status-chip status-${item.variant ?? 'info'}`}>{item.status ?? item.resultStatus ?? copy.pendingState}</span></td>
                <td>{item.nextStep ?? copy.reviewWhenReady}</td>
                <td><Link href={`/portal/labs/results/${item.id}${item.patientId ? `?patientId=${item.patientId}` : patientId ? `?patientId=${patientId}` : ''}`} className="text-link">{copy.openReview}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
