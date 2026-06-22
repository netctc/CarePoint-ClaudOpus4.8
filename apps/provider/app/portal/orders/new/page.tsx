'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { WorkspaceStateStrip } from '@/components/shared/workspace-state-strip';
import { useProviderLocale } from '@/components/i18n/provider-locale-provider';
import { getProviderDetailCopy } from '@/lib/i18n/provider-detail-copy';
import { getProviderPhase5Copy } from '@/lib/i18n/provider-phase5-copy';
import { providerApi } from '@/services/api-client';
import { appendProviderSubjectParams } from '@/lib/subject-links';
import { getOrderComposerData } from '@/services/mock-api';

export default function OrdersReferralsPage() {
  const { locale, dir } = useProviderLocale();
  const base = getProviderDetailCopy(locale).orderComposer;
  const copy = getProviderPhase5Copy(locale).orderComposer;
  const searchParams = useSearchParams();
  const patientId = searchParams.get('patientId');
  const appointmentId = searchParams.get('appointmentId');
  const subjectProfileId = searchParams.get('subjectProfileId');
  const subjectLabel = searchParams.get('subjectLabel');
  const subjectRelationship = searchParams.get('subjectRelationship');
  const fallback = useMemo(() => getOrderComposerData(), []);

  const [contextItem, setContextItem] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [orderText, setOrderText] = useState(fallback.commonSelections[0] ?? '');
  const [reason, setReason] = useState(fallback.reason);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState<'live' | 'fallback'>('fallback');
  const resolvedPatientId = contextItem?.patientId ?? patientId ?? '';

  const load = useCallback(async () => {
    setError(null);
    try {
      const [contextResult, ordersResult]: any = await Promise.all([
        providerApi.providerOrderComposerContext({ patientId, appointmentId, encounterId: appointmentId, subjectProfileId }),
        providerApi.providerOrders(patientId ?? undefined, subjectProfileId ?? undefined),
      ]);
      setContextItem(contextResult?.item ?? null);
      setOrders(ordersResult?.items ?? []);
      setReason(String(contextResult?.item?.reason ?? fallback.reason));
      setSource('live');
    } catch (err) {
      setContextItem(null);
      setOrders([]);
      setSource('fallback');
      setError(err instanceof Error ? err.message : base.unableLoad);
    }
  }, [appointmentId, base.unableLoad, fallback.reason, patientId, subjectProfileId]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (!resolvedPatientId) throw new Error(base.missingPatient);
      const created: any = await providerApi.createProviderOrder({
        patientId: resolvedPatientId,
        patientName: contextItem?.subjectLabel ?? contextItem?.patientName ?? subjectLabel ?? fallback.patientName,
        encounterId: contextItem?.encounterId ?? appointmentId ?? fallback.encounterId,
        appointmentId: appointmentId ?? undefined,
        reason,
        requestedBy: contextItem?.requestedBy ?? fallback.requestedBy,
        orderGroups: fallback.orderGroups,
        commonSelections: fallback.commonSelections,
        note: orderText,
        subjectProfileId: subjectProfileId ?? undefined,
        subjectLabel: contextItem?.subjectLabel ?? subjectLabel ?? undefined,
        subjectRelationship: contextItem?.subjectRelationship ?? subjectRelationship ?? undefined,
      });
      await providerApi.submitProviderOrder(String(created?.item?.id), 'Submitted from provider order composer');
      setMessage(base.submitted);
      setOrderText('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : base.unableSubmit);
    } finally {
      setSaving(false);
    }
  }

  const backToNoteHref = contextItem?.encounterId ? appendProviderSubjectParams(`/portal/encounters/${contextItem.encounterId}/note?patientId=${contextItem.patientId}`, contextItem ?? { subjectProfileId, subjectLabel, subjectRelationship }) : '/portal/queue';

  return (
    <div className="page-stack" dir={dir}>
      <section className="page-header split-header">
        <div>
          <span className="eyebrow">PR-12</span>
          <h1>{copy.title}</h1>
          <p className="muted">{copy.subtitle}</p>
        </div>
        <div className="header-actions">
          <Link href={backToNoteHref} className="btn btn-secondary">{copy.backToNote}</Link>
        </div>
      </section>

      <div className={`banner ${source === 'live' ? 'banner-success' : 'banner-warning'}`}>
        <div>
          <strong>{source === 'live' ? copy.liveTitle : copy.fallbackTitle}</strong>
          <p className="muted small">{source === 'live' ? copy.liveText : `${copy.fallbackErrorPrefix} ${error ?? 'Unknown error'}.`}</p>
        </div>
        <span className={`status-chip status-${source === 'live' ? 'success' : 'warning'}`}>{source === 'live' ? base.live : base.fallback}</span>
      </div>

      {message ? <div className="status-chip status-success">{message}</div> : null}
      {error && source === 'live' ? <div className="status-chip status-danger">{error}</div> : null}

      <WorkspaceStateStrip
        items={[
          { label: copy.composerSource, value: source === 'live' ? copy.providerApi : base.fallback, tone: source === 'live' ? 'success' : 'warning' },
          { label: copy.encounter, value: String(contextItem?.encounterId ?? appointmentId ?? fallback.encounterId), tone: 'info' },
          { label: copy.patientOrders, value: String(orders.length), tone: 'info' },
          { label: copy.commonKits, value: String(fallback.orderGroups.length), tone: 'success' },
        ]}
      />

      <section className="content-grid two-col top-align-grid">
        <article className="panel-card">
          <div className="panel-header"><h2>{copy.encounterLinkage}</h2></div>
          <div className="detail-list">
            <div><span className="detail-label">{copy.encounterId}</span><strong>{contextItem?.encounterId ?? appointmentId ?? fallback.encounterId}</strong></div>
            <div><span className="detail-label">{base.patient}</span><strong>{contextItem?.patientName ?? fallback.patientName}</strong></div>
            <div><span className="detail-label">{copy.reasonForService}</span><strong>{contextItem?.reason ?? reason}</strong></div>
            <div><span className="detail-label">{copy.requestedBy2}</span><strong>{contextItem?.requestedBy ?? fallback.requestedBy}</strong></div>
          </div>
          <div className="list-stack top-space">
            {(contextItem?.recentRecords ?? []).map((record: any) => (
              <div key={record.id} className="list-row top-align-row">
                <div>
                  <strong>{record.summary?.title ?? copy.recentRecord}</strong>
                  <p className="muted small">{record.createdAt ? new Date(record.createdAt).toLocaleString(locale) : copy.recent}</p>
                </div>
              </div>
            ))}
            {!(contextItem?.recentRecords?.length) ? <p className="muted">{copy.noRecentRecords}</p> : null}
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-header"><h2>{copy.createOrderRequest}</h2></div>
          <form className="form-stack" onSubmit={onSubmit}>
            <label className="field">
              <span>{copy.requestedOrder}</span>
              <input value={orderText} onChange={(event) => setOrderText(event.target.value)} placeholder={copy.requestedOrderPlaceholder} />
            </label>
            <label className="field">
              <span>{copy.clinicalReason}</span>
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} />
            </label>
            <button className="btn btn-primary" type="submit" disabled={saving || !resolvedPatientId}>{saving ? base.submitting : copy.submitOrder}</button>
          </form>
          <div className="top-space tag-list">
            {fallback.commonSelections.map((item) => (
              <button key={item} type="button" className="info-tag" onClick={() => setOrderText(item)}>{item}</button>
            ))}
          </div>
        </article>
      </section>

      <section className="content-grid two-col top-align-grid">
        <article className="panel-card">
          <div className="panel-header"><h2>{copy.availableOrderGroups}</h2></div>
          <div className="list-stack">
            {fallback.orderGroups.map((group) => (
              <div key={group.title} className="list-row compact-row top-align-row">
                <div>
                  <strong>{group.title}</strong>
                  <p className="muted small">{group.description}</p>
                </div>
                <span className={`status-chip status-${group.variant}`}>{group.status}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-header"><h2>{copy.submittedItems}</h2><span className="status-chip status-info">{orders.length}</span></div>
          <div className="list-stack">
            {orders.slice(0, 6).map((item) => (
              <div key={item.id} className="list-row top-align-row">
                <div>
                  <strong>{item.patientName}</strong>
                  <p className="muted small">{item.reason}</p>
                  <p className="muted small">{item.note ?? copy.noNote}</p>
                </div>
                <div className="workspace-side-stack" style={{ gap: 10 }}>
                  <span className="status-chip status-info">{String(item.status ?? 'DRAFT').replaceAll('_', ' ')}</span>
                  <Link href={`/portal/orders/${item.id}`} className="text-link">{copy.openDetail}</Link>
                </div>
              </div>
            ))}
            {!orders.length ? <p className="muted">{copy.noSubmitted}</p> : null}
          </div>
        </article>
      </section>
    </div>
  );
}
