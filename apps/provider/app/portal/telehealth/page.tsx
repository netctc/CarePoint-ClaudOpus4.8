'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { WorkspaceStateStrip } from '@/components/shared/workspace-state-strip';
import {
  ProviderActionButton,
  ProviderGrid,
  ProviderKpiCard,
  ProviderPageHeader,
  ProviderSectionCard,
  ProviderTable,
} from '@/components/design/provider-design';
import { providerApi } from '@/services/api-client';
import { getTelehealthWaitingRoom } from '@/services/mock-api';
import { useProviderLocale } from '@/components/i18n/provider-locale-provider';
import { getProviderPortalCopy } from '@/lib/i18n/provider-portal-copy';

function formatDateTime(value?: string | null, locale?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale);
}

function statusVariant(status: string) {
  const normalized = status.toUpperCase();
  if (['LIVE', 'ENDED'].includes(normalized)) return 'success';
  if (['READY', 'PREPARING', 'SCHEDULED'].includes(normalized)) return 'warning';
  if (['FAILED', 'CANCELLED'].includes(normalized)) return 'danger';
  return 'info';
}

export default function TelehealthPage() {
  const { locale, dir } = useProviderLocale();
  const copy = getProviderPortalCopy(locale).telehealth;
  const [sessions, setSessions] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sessionResult, appointmentResult]: any = await Promise.all([
        providerApi.telehealthSessions(),
        providerApi.appointments(),
      ]);
      setSessions(sessionResult.items ?? []);
      setAppointments(appointmentResult.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableLoad);
      setSessions([]);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [copy.unableLoad]);

  useEffect(() => {
    load();
  }, [load]);

  async function prepare(appointmentId: string) {
    setBusyKey(`prepare:${appointmentId}`);
    try {
      await providerApi.prepareTelehealthSession(appointmentId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unablePrepare);
    } finally {
      setBusyKey(null);
    }
  }

  async function start(sessionId: string) {
    setBusyKey(`start:${sessionId}`);
    try {
      await providerApi.startTelehealthSession(sessionId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableStart);
    } finally {
      setBusyKey(null);
    }
  }

  async function end(sessionId: string) {
    setBusyKey(`end:${sessionId}`);
    try {
      await providerApi.endTelehealthSession(sessionId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableEnd);
    } finally {
      setBusyKey(null);
    }
  }

  const readyCandidates = useMemo(() => {
    return appointments.filter((item) => {
      const location = String(item.location ?? '').toLowerCase();
      return !item.telehealthSession && (location.includes('tele') || location.includes('virtual'));
    });
  }, [appointments]);

  const waitingChecklist = useMemo(() => {
    const first = readyCandidates[0];
    return first ? getTelehealthWaitingRoom(first.id) : null;
  }, [readyCandidates]);

  const liveCount = useMemo(() => sessions.filter((item) => item.status === 'LIVE').length, [sessions]);
  const readyCount = useMemo(() => sessions.filter((item) => item.status === 'READY').length, [sessions]);

  return (
    <div className="page-stack provider-v14-telehealth" dir={dir}>
      <ProviderPageHeader
        eyebrow="PR-14 · Telehealth operations"
        title={copy.title}
        description={copy.subtitle}
        actions={<ProviderActionButton tone="default" onClick={load}>{copy.refresh}</ProviderActionButton>}
      />

      {error ? <div className="provider-v14-error-banner status-chip status-danger">{error}</div> : null}

      <WorkspaceStateStrip
        items={[
          { label: copy.sessions, value: String(sessions.length), tone: 'info' },
          { label: copy.ready, value: String(readyCount), tone: readyCount ? 'warning' : 'success' },
          { label: copy.live, value: String(liveCount), tone: liveCount ? 'success' : 'info' },
          { label: copy.needsRoom, value: String(readyCandidates.length), tone: readyCandidates.length ? 'warning' : 'success' },
        ]}
      />

      <ProviderGrid columns={4} className="provider-v14-kpi-grid">
        <ProviderKpiCard label={copy.sessions} value={String(sessions.length)} detail={copy.sessionsDetail} tone="primary" />
        <ProviderKpiCard label={copy.ready} value={String(readyCount)} detail={copy.readyDetail} tone={readyCount ? 'warning' : 'success'} />
        <ProviderKpiCard label={copy.live} value={String(liveCount)} detail={copy.liveDetail} tone={liveCount ? 'success' : 'default'} />
        <ProviderKpiCard label={copy.needsRoom} value={String(readyCandidates.length)} detail={copy.needsRoomDetail} tone={readyCandidates.length ? 'warning' : 'success'} />
      </ProviderGrid>

      <section className="provider-v14-tele-grid">
        <ProviderSectionCard
          title={copy.preparedSessions}
          description={copy.liveApi}
          className="provider-v14-tele-card provider-v14-sessions-board"
          actions={loading && !sessions.length ? <span className="status-chip status-info">{copy.loading}</span> : null}
        >
          <ProviderTable>
            <thead>
              <tr>
                <th>{copy.patient}</th>
                <th>{copy.service}</th>
                <th>{copy.status}</th>
                <th>{copy.scheduled}</th>
                <th>{copy.join}</th>
                <th>{copy.prepareAction}</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.patientName}</strong>
                    <p className="provider-v13-table-subtext">{item.providerName}</p>
                  </td>
                  <td>{item.service ?? copy.telehealthVisit}</td>
                  <td><span className={`status-chip status-${statusVariant(item.status)}`}>{item.status}</span></td>
                  <td>{formatDateTime(item.scheduledAt, locale)}</td>
                  <td>
                    <div className="provider-v14-link-stack">
                      {item.joinUrl ? <a href={item.joinUrl} className="provider-v13-table-link" target="_blank" rel="noreferrer">{copy.openRoom}</a> : '—'}
                      <Link href={`/portal/telehealth/live/${item.appointmentId ?? item.id}`} className="provider-v13-table-link">{copy.workspace}</Link>
                    </div>
                  </td>
                  <td>
                    <div className="provider-v13-inline-actions">
                      {item.status !== 'LIVE' ? (
                        <ProviderActionButton tone="default" onClick={() => start(item.id)} disabled={busyKey === `start:${item.id}`}>
                          {busyKey === `start:${item.id}` ? copy.starting : copy.start}
                        </ProviderActionButton>
                      ) : null}
                      {item.status === 'LIVE' ? (
                        <ProviderActionButton tone="danger" onClick={() => end(item.id)} disabled={busyKey === `end:${item.id}`}>
                          {busyKey === `end:${item.id}` ? copy.ending : copy.end}
                        </ProviderActionButton>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!sessions.length ? (
                <tr>
                  <td colSpan={6} className="cp-empty-state muted">{copy.noSessions}</td>
                </tr>
              ) : null}
            </tbody>
          </ProviderTable>
        </ProviderSectionCard>

        <div className="provider-v14-tele-rail">
          <ProviderSectionCard
            title={copy.appointmentsNeedingRoom}
            description={copy.needsRoomDetail}
            actions={<span className="status-chip status-warning">{copy.prepareAction}</span>}
            className="provider-v14-tele-card"
          >
            <div className="provider-v14-ready-list">
              {readyCandidates.length ? readyCandidates.slice(0, 6).map((item) => (
                <article key={item.id} className="provider-v14-ready-card">
                  <div>
                    <strong>{item.patientName}</strong>
                    <p>{formatDateTime(item.startsAt, locale)} • {item.service}</p>
                  </div>
                  <div className="provider-v13-inline-actions">
                    <ProviderActionButton tone="primary" onClick={() => prepare(item.id)} disabled={busyKey === `prepare:${item.id}`}>
                      {busyKey === `prepare:${item.id}` ? copy.preparing : copy.prepare}
                    </ProviderActionButton>
                    <Link href={`/portal/telehealth/waiting/${item.id}`} className="provider-v13-table-link">{copy.openWaitingRoom}</Link>
                  </div>
                </article>
              )) : <p className="muted">{copy.noAppointments}</p>}
            </div>
          </ProviderSectionCard>

          <ProviderSectionCard
            title={copy.checklist}
            description={copy.providerPrep}
            className="provider-v14-tele-card"
          >
            {waitingChecklist ? (
              <div className="provider-v14-checklist">
                {waitingChecklist.checklist.map((item) => (
                  <div key={item} className="provider-v14-checklist-item">{item}</div>
                ))}
              </div>
            ) : (
              <p className="muted">{copy.checklistEmpty}</p>
            )}
          </ProviderSectionCard>
        </div>
      </section>
    </div>
  );
}
