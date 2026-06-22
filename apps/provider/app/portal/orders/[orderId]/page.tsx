'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { EvidencePanel } from '@/components/shared/evidence-panel';
import { WorkspaceStateStrip } from '@/components/shared/workspace-state-strip';
import { useProviderLocale } from '@/components/i18n/provider-locale-provider';
import { getProviderDetailCopy } from '@/lib/i18n/provider-detail-copy';
import { getProviderPhase5Copy } from '@/lib/i18n/provider-phase5-copy';
import { providerApi } from '@/services/api-client';
import { appendProviderSubjectParams } from '@/lib/subject-links';

function formatDateTime(value: string | null | undefined, locale: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale);
}

export default function ProviderOrderDetailPage() {
  const { locale, dir } = useProviderLocale();
  const base = getProviderDetailCopy(locale).orderDetail;
  const copy = getProviderPhase5Copy(locale).orderDetail;
  const params = useParams<{ orderId: string }>();
  const orderId = String(params.orderId);
  const [item, setItem] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [result, summaryResult]: any = await Promise.all([
        providerApi.providerOrder(orderId),
        providerApi.providerOrderSummary().catch(() => null),
      ]);
      setItem(result.item ?? result ?? null);
      setSummary(summaryResult ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : base.unableLoad);
    }
  }, [base.unableLoad, orderId]);

  useEffect(() => { load(); }, [load]);

  const order = item;
  const guidance = useMemo(() => {
    if (!order) return [];
    return [
      { title: base.encounterLinkage, detail: `Encounter ${order.encounterId ?? 'not linked'} • Appointment ${order.appointmentId ?? 'not linked'}` },
      { title: base.clinicalRationale, detail: order.reason ?? order.note ?? base.noClinicalRationale },
      { title: base.requestedBy, detail: order.requestedBy ?? order.providerName ?? 'Provider workspace' },
    ];
  }, [base, order]);

  if (error && !order) return <div className="status-chip status-danger">{error}</div>;
  if (!order) return <div className="status-chip status-info">{base.loading}</div>;

  const chartHref = appendProviderSubjectParams(`/portal/chart/${order.patientId ?? ''}`, order);

  return (
    <div className="page-stack" dir={dir}>
      <section className="page-header split-header">
        <div>
          <span className="eyebrow">PR-12A</span>
          <h1>{base.title}</h1>
          <p className="muted">{base.subtitle}</p>
        </div>
        <div className="header-actions">
          <Link href={chartHref} className="btn btn-secondary">{base.openChart}</Link>
          <Link href={`/portal/orders/new?patientId=${order.patientId ?? ''}${order.appointmentId ? `&appointmentId=${order.appointmentId}` : ''}`} className="btn btn-primary">{base.openComposer}</Link>
        </div>
      </section>

      {error ? <div className="status-chip status-danger">{error}</div> : null}

      <WorkspaceStateStrip
        items={[
          { label: base.status, value: String(order.status ?? 'DRAFT').replaceAll('_', ' '), tone: String(order.status ?? '').includes('SUBMIT') ? 'success' : 'info' },
          { label: base.priority, value: order.priority ?? 'Routine', tone: (order.priority ?? '').toUpperCase() === 'URGENT' ? 'warning' : 'info' },
          { label: base.patient, value: order.patientName ?? base.currentPatient, tone: 'info' },
          { label: base.linkedRecords, value: String(order.recordsLinkedCount ?? summary?.totals?.linkedRecords ?? 0), tone: 'success' },
        ]}
      />

      <section className="workspace-grid">
        <article className="panel-card">
          <div className="panel-header">
            <h2>{order.patientName ?? base.patientOrder}</h2>
            <span className="status-chip status-info">{String(order.status ?? 'DRAFT').replaceAll('_', ' ')}</span>
          </div>
          <div className="detail-list">
            <div><span className="detail-label">{copy.orderId}</span><strong>{order.id}</strong></div>
            <div><span className="detail-label">{copy.requestedOn}</span><strong>{formatDateTime(order.createdAt, locale)}</strong></div>
            <div><span className="detail-label">{copy.reasonLabel}</span><strong>{order.reason ?? copy.noReason}</strong></div>
            <div><span className="detail-label">{base.note}</span><strong>{order.note ?? copy.noAdditionalNote}</strong></div>
          </div>
          <div className="top-space header-link-row">
            <Link href="/portal/queue" className="btn btn-secondary">{copy.returnToQueue}</Link>
            <Link href="/portal/labs/inbox" className="btn btn-secondary">{copy.openLabs}</Link>
            <Link href="/portal/messages" className="btn btn-secondary">{copy.messagePatient}</Link>
          </div>
        </article>

        <div className="workspace-side-stack">
          <EvidencePanel title={copy.evidencePacket} badge={copy.linked} items={guidance} />
          <article className="panel-card pale-card">
            <div className="panel-header"><h2>{copy.operationalGuidance}</h2></div>
            <div className="timeline-stack">
              <div className="timeline-card">
                <strong>{copy.clinicalIntent}</strong>
                <p className="muted small">{copy.clinicalIntentText}</p>
              </div>
              <div className="timeline-card">
                <strong>{copy.downstreamRouting2}</strong>
                <p className="muted small">{copy.downstreamRoutingText}</p>
              </div>
              <div className="timeline-card">
                <strong>{copy.patientReadiness}</strong>
                <p className="muted small">{copy.patientReadinessText}</p>
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
