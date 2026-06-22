'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { EvidencePanel } from '@/components/shared/evidence-panel';
import { WorkspaceStateStrip } from '@/components/shared/workspace-state-strip';
import { providerApi } from '@/services/api-client';
import { appendProviderSubjectParams } from '@/lib/subject-links';
import { getTelehealthWaitingRoom } from '@/services/mock-api';
import { useProviderLocale } from '@/components/i18n/provider-locale-provider';
import { getProviderDetailCopy } from '@/lib/i18n/provider-detail-copy';

function statusVariant(status?: string | null) {
  const normalized = String(status ?? '').toUpperCase();
  if (['LIVE', 'READY', 'STARTED'].includes(normalized)) return 'success';
  if (['PREPARING', 'SCHEDULED', 'WAITING'].includes(normalized)) return 'warning';
  if (['FAILED', 'CANCELLED'].includes(normalized)) return 'danger';
  return 'info';
}

function formatDateTime(value?: string | null, locale?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale);
}

export default function TelehealthWaitingRoomPage() {
  const { locale, dir } = useProviderLocale();
  const copy = getProviderDetailCopy(locale).telehealthWaiting;
  const params = useParams<{ appointmentId: string }>();
  const router = useRouter();
  const appointmentId = params.appointmentId;
  const fallback = getTelehealthWaitingRoom(appointmentId);

  const [appointment, setAppointment] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [source, setSource] = useState<'live' | 'fallback'>('fallback');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'prepare' | 'admit' | null>(null);
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

  async function admitPatient() {
    setBusy('admit');
    try {
      let activeSession = session;
      if (!activeSession) {
        activeSession = await providerApi.prepareTelehealthSession(appointmentId, appointment?.startsAt);
      }
      if (activeSession?.status !== 'LIVE') {
        await providerApi.startTelehealthSession(activeSession.id);
      }
      router.push(`/portal/telehealth/live/${appointmentId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableAdmit);
    } finally {
      setBusy(null);
    }
  }

  const checklist = useMemo(() => fallback?.checklist ?? [
    'Confirm patient identity and date of birth',
    'Verify telehealth consent',
    'Review vitals and recent notes',
    'Prepare note, order, and prescription shortcuts',
  ], [fallback]);

  if (loading && source === 'fallback' && !fallback) {
    return <div className="status-chip status-info">Loading waiting room…</div>;
  }

  if (source === 'fallback' && !fallback) {
    return (
      <div className="page-stack" dir={dir}>
        <section className="page-header">
          <h1>Waiting room not found</h1>
          <p className="muted">The requested telehealth session is not available.</p>
        </section>
      </div>
    );
  }

  const titlePatient = appointment?.subjectLabel ?? appointment?.patientName ?? fallback?.patientName ?? 'Unknown patient';
  const titleReason = appointment?.service ?? fallback?.reason ?? 'Telehealth visit';
  const providerName = appointment?.providerName ?? fallback?.provider ?? 'Assigned provider';
  const roomStatus = String(session?.status ?? (fallback?.consentReady ? 'READY' : 'WAITING')).replaceAll('_', ' ');
  const chartHref = appointment?.patientId ? appendProviderSubjectParams(`/portal/chart/${appointment.patientId}`, appointment) : '/portal/queue';

  return (
    <div className="page-stack" dir={dir}>
      <section className="page-header split-header">
        <div>
          <span className="eyebrow">PR-09</span>
          <h1>Telehealth Waiting Room</h1>
          <p className="muted">Confirm readiness, review the patient queue, and admit the patient into the live consultation room.</p>
        </div>
        <div className="header-actions">
          <span className={`status-chip status-${statusVariant(session?.status ?? (fallback?.consentReady ? 'READY' : 'WAITING'))}`}>{roomStatus}</span>
          <button className="btn btn-secondary" onClick={prepareRoom} disabled={busy !== null || source === 'fallback'}>
            {busy === 'prepare' ? copy.preparing : copy.prepareRoom}
          </button>
          <button className="btn btn-primary" onClick={admitPatient} disabled={busy !== null || source === 'fallback'}>
            {busy === 'admit' ? copy.admitting : copy.admitPatient}
          </button>
        </div>
      </section>

      <div className={`banner ${source === 'live' ? 'banner-success' : 'banner-warning'}`}>
        <div>
          <strong>{source === 'live' ? 'Live telehealth room status connected.' : 'Using fallback waiting-room review data.'}</strong>
          <p className="muted small">
            {source === 'live'
              ? 'The room status and actions are using the telehealth API for this appointment.'
              : `The telehealth API could not be loaded for this appointment: ${error ?? 'Unknown error'}.`}
          </p>
        </div>
        <span className={`status-chip status-${source === 'live' ? 'success' : 'warning'}`}>{source === 'live' ? 'Live API' : 'Fallback'}</span>
      </div>

      {error && source === 'live' ? <div className="status-chip status-danger">{error}</div> : null}

      <WorkspaceStateStrip
        items={[
          { label: 'Source', value: source === 'live' ? 'Provider API' : 'Fallback', tone: source === 'live' ? 'success' : 'warning' },
          { label: 'Patient', value: titlePatient, tone: 'info' },
          { label: 'Appointment', value: titleReason, tone: 'info' },
          { label: 'Scheduled', value: formatDateTime(appointment?.startsAt ?? fallback?.eta), tone: 'info' },
        ]}
      />

      <section className="workspace-grid">
        <article className="panel-card">
          <div className="panel-header">
            <h2>Patient queue</h2>
            <span className="status-chip status-info">{source === 'live' ? formatDateTime(appointment?.startsAt) : fallback?.eta}</span>
          </div>
          <div className="detail-list">
            <div><span className="detail-label">Patient</span><strong>{titlePatient}</strong></div>
            <div><span className="detail-label">Appointment</span><strong>{titleReason}</strong></div>
            <div><span className="detail-label">Assigned provider</span><strong>{providerName}</strong></div>
            <div><span className="detail-label">Join room</span><strong>{session?.joinUrl ? 'Room prepared' : 'Room not prepared yet'}</strong></div>
          </div>
          <div className="action-row wrap-row top-space">
            <Link href={`/portal/appointments/${appointmentId}`} className="btn btn-secondary">Open appointment</Link>
            <Link href={chartHref} className="btn btn-secondary">{copy.openChart}</Link>
            <Link href="/portal/telehealth" className="btn btn-secondary">{copy.backToTelehealth}</Link>
          </div>
        </article>

        <div className="workspace-side-stack">
          <article className="panel-card pale-card">
            <div className="panel-header"><h2>Device and consent status</h2></div>
            <div className="list-stack">
              {(fallback?.deviceChecks ?? []).map((check) => (
                <div key={check.label} className="list-row">
                  <div>
                    <strong>{check.label}</strong>
                    <p className="muted small">{check.detail}</p>
                  </div>
                  <span className={`status-chip status-${check.variant}`}>{check.status}</span>
                </div>
              ))}
              {!fallback?.deviceChecks?.length ? <p className="muted">Device checks will appear when waiting-room diagnostics are available.</p> : null}
            </div>
          </article>
          <EvidencePanel
            title="Escalation cues"
            badge="Pre-call"
            items={[
              { title: 'Identity check', detail: 'Confirm patient identity, consent, and location before admitting to the live room.' },
              { title: 'Connectivity', detail: 'Use microphone, camera, and fallback-call checks before the clinician joins.' },
              { title: 'Safety routing', detail: 'If urgent symptoms are surfaced during waiting-room review, escalate before starting routine consultation.' },
            ]}
          />
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-header"><h2>Pre-call checklist</h2></div>
        <div className="checklist-stack">
          {checklist.map((item) => (
            <label key={item} className="checkbox-row"><input type="checkbox" defaultChecked /> <span>{item}</span></label>
          ))}
        </div>
      </section>
    </div>
  );
}
