'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { EvidencePanel } from '@/components/shared/evidence-panel';
import { WorkspaceStateStrip } from '@/components/shared/workspace-state-strip';
import { providerApi } from '@/services/api-client';
import { appendProviderSubjectParams } from '@/lib/subject-links';
import { getTelehealthWaitingRoom } from '@/services/mock-api';
import { useProviderLocale } from '@/components/i18n/provider-locale-provider';
import { getProviderDetailCopy } from '@/lib/i18n/provider-detail-copy';

function statusVariant(status?: string | null) {
  const normalized = String(status ?? '').toUpperCase();
  if (['LIVE', 'ENDED'].includes(normalized)) return 'success';
  if (['READY', 'PREPARING', 'SCHEDULED'].includes(normalized)) return 'warning';
  if (['FAILED', 'CANCELLED'].includes(normalized)) return 'danger';
  return 'info';
}

function formatDateTime(value?: string | null, locale?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale);
}

export default function LiveConsultationConsolePage() {
  const { locale, dir } = useProviderLocale();
  const copy = getProviderDetailCopy(locale).telehealthLive;
  const params = useParams<{ appointmentId: string }>();
  const appointmentId = params.appointmentId;
  const fallback = getTelehealthWaitingRoom(appointmentId);

  const [appointment, setAppointment] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [source, setSource] = useState<'live' | 'fallback'>('fallback');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'prepare' | 'start' | 'end' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [appointmentResult, sessionResult]: any = await Promise.all([
        providerApi.appointment(appointmentId),
        providerApi.telehealthSessions(),
      ]);
      const matched = (sessionResult.items ?? []).find((item: any) => item.appointmentId === appointmentId) ?? null;
      setAppointment(appointmentResult);
      setSession(matched);
      setSource('live');
    } catch (err) {
      setAppointment(null);
      setSession(null);
      setSource('fallback');
      setError(err instanceof Error ? err.message : copy.unableLoad);
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    load();
  }, [load]);

  async function prepareRoom() {
    setBusy('prepare');
    try {
      await providerApi.prepareTelehealthSession(appointmentId, appointment?.startsAt);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unablePrepare);
    } finally {
      setBusy(null);
    }
  }

  async function startRoom() {
    if (!session) return;
    setBusy('start');
    try {
      await providerApi.startTelehealthSession(session.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableStart);
    } finally {
      setBusy(null);
    }
  }

  async function endRoom() {
    if (!session) return;
    setBusy('end');
    try {
      await providerApi.endTelehealthSession(session.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableEnd);
    } finally {
      setBusy(null);
    }
  }

  const checklist = useMemo(() => fallback?.checklist ?? [], [fallback]);

  if (loading && source === 'fallback' && !fallback) {
    return <div className="status-chip status-info">{copy.loading}</div>;
  }

  if (source === 'fallback' && !fallback) {
    return (
      <div className="page-stack">
        <section className="page-header">
          <h1>{copy.notFound}</h1>
          <p className="muted">{copy.notFoundText}</p>
        </section>
      </div>
    );
  }

  const patientName = appointment?.subjectLabel ?? appointment?.patientName ?? fallback?.patientName ?? 'Unknown patient';
  const service = appointment?.service ?? fallback?.reason ?? 'Telehealth visit';
  const providerName = appointment?.providerName ?? fallback?.provider ?? 'Assigned provider';
  const chartHref = appointment?.patientId ? appendProviderSubjectParams(`/portal/chart/${appointment.patientId}`, appointment) : null;
  const soapHref = appendProviderSubjectParams(`/portal/encounters/${appointmentId}/note?patientId=${appointment?.patientId ?? ''}`, appointment);
  const orderHref = appendProviderSubjectParams(`/portal/orders/new?patientId=${appointment?.patientId ?? ''}&appointmentId=${appointmentId}`, appointment);
  const prescriptionHref = appendProviderSubjectParams(`/portal/prescriptions/new?patientId=${appointment?.patientId ?? ''}&appointmentId=${appointmentId}`, appointment);

  return (
    <div className="page-stack" dir={dir}>
      <section className="page-header split-header">
        <div>
          <span className="eyebrow">PR-10</span>
          <h1>{copy.title}</h1>
          <p className="muted">{copy.subtitle}</p>
        </div>
        <div className="header-actions">
          <span className={`status-chip status-${statusVariant(session?.status ?? 'READY')}`}>{String(session?.status ?? 'READY').replaceAll('_', ' ')}</span>
          {!session ? (
            <button className="btn btn-secondary" onClick={prepareRoom} disabled={source === 'fallback' || busy !== null}>
              {busy === 'prepare' ? copy.preparing : copy.prepareRoom}
            </button>
          ) : null}
          {session && session.status !== 'LIVE' ? (
            <button className="btn btn-primary" onClick={startRoom} disabled={source === 'fallback' || busy !== null}>
              {busy === 'start' ? copy.starting : copy.startVisit}
            </button>
          ) : null}
          {session?.status === 'LIVE' ? (
            <button className="btn btn-primary" onClick={endRoom} disabled={source === 'fallback' || busy !== null}>
              {busy === 'end' ? copy.ending : copy.endVisit}
            </button>
          ) : null}
        </div>
      </section>

      <div className={`banner ${source === 'live' ? 'banner-success' : 'banner-warning'}`}>
        <div>
          <strong>{source === 'live' ? copy.liveConnected : copy.fallbackTitle}</strong>
          <p className="muted small">
            {source === 'live'
              ? copy.liveText
              : `${copy.fallbackTextPrefix} ${error ?? 'Unknown error'}.`}
          </p>
        </div>
        <span className={`status-chip status-${source === 'live' ? 'success' : 'warning'}`}>{source === 'live' ? copy.liveApi : copy.fallback}</span>
      </div>

      {error && source === 'live' ? <div className="status-chip status-danger">{error}</div> : null}

      <WorkspaceStateStrip
        items={[
          { label: copy.source, value: source === 'live' ? copy.providerApi : copy.fallback, tone: source === 'live' ? 'success' : 'warning' },
          { label: copy.patient, value: patientName, tone: 'info' },
          { label: copy.sessionState, value: String(session?.status ?? 'READY').replaceAll('_', ' '), tone: session?.status === 'LIVE' ? 'success' : 'warning' },
          { label: copy.scheduled, value: formatDateTime(session?.scheduledAt ?? appointment?.startsAt ?? fallback?.eta, locale), tone: 'info' },
        ]}
      />

      <section className="workspace-grid">
        <article className="tele-stage panel-card">
          <div className="tele-video primary-video">
            <div>
              <strong>{patientName}</strong>
              <p className="muted small">{service}</p>
              <p className="muted small">{providerName} • {formatDateTime(appointment?.startsAt, locale)}</p>
            </div>
          </div>
          <div className="tele-toolbar">
            <button className="btn btn-secondary">{copy.mute}</button>
            <button className="btn btn-secondary">{copy.camera}</button>
            <button className="btn btn-secondary">{copy.shareFile}</button>
            <button className="btn btn-secondary">{copy.message}</button>
            {session?.joinUrl ? <a href={session.joinUrl} className="btn btn-secondary" target="_blank" rel="noreferrer">{copy.openRoom}</a> : null}
          </div>
        </article>

        <div className="workspace-side-stack">
          <article className="panel-card">
            <div className="panel-header"><h2>{copy.encounterShortcuts}</h2></div>
            <div className="list-stack">
              {chartHref ? <Link href={chartHref} className="btn btn-secondary btn-full">Open chart</Link> : <span className="status-chip status-warning full-width-chip">{copy.noChartLink}</span>}
              <Link href={soapHref} className="btn btn-secondary btn-full">{copy.openSoap}</Link>
              <Link href={orderHref} className="btn btn-secondary btn-full">{copy.placeOrder}</Link>
              <Link href={prescriptionHref} className="btn btn-secondary btn-full">{copy.sendPrescription}</Link>
            </div>
          </article>

          <EvidencePanel
            title={copy.liveVisitEvidence}
            badge={copy.telehealth}
            items={[
              { title: copy.connectionHealth, detail: session?.joinUrl ? copy.connectionHealthReady : copy.connectionHealthMissing },
              { title: copy.clinicalContext, detail: service },
              { title: copy.postVisitHandoff, detail: copy.postVisitHandoffText },
            ]}
          />
        </div>
      </section>

      <section className="content-grid two-col top-align-grid">
        <article className="panel-card">
          <div className="panel-header"><h2>{copy.sessionSafeguards}</h2></div>
          <div className="checklist-stack">
            {(checklist.length ? checklist : [
              copy.defaultChecklist1,
              copy.defaultChecklist2,
              copy.defaultChecklist3,
            ]).map((item) => (
              <label key={item} className="checkbox-row"><input type="checkbox" defaultChecked /> <span>{item}</span></label>
            ))}
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-header"><h2>{copy.sessionDetails}</h2></div>
          <div className="detail-list">
            <div><span className="detail-label">{copy.roomStatus}</span><strong>{session?.status ?? copy.notPrepared}</strong></div>
            <div><span className="detail-label">{copy.scheduled}</span><strong>{formatDateTime(session?.scheduledAt ?? appointment?.startsAt, locale)}</strong></div>
            <div><span className="detail-label">{copy.joinUrl}</span><strong>{session?.joinUrl ? copy.available : copy.unavailable}</strong></div>
          </div>
          <div className="action-row wrap-row top-space">
            <Link href={`/portal/telehealth/waiting/${appointmentId}`} className="btn btn-secondary">{copy.backToWaitingRoom}</Link>
            <Link href="/portal/telehealth" className="btn btn-secondary">{copy.telehealthOps}</Link>
          </div>
        </article>
      </section>
    </div>
  );
}
