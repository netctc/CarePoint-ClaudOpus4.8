"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { providerApi } from '@/services/api-client';
import { getDashboardData } from '@/services/mock-api';
import { useProviderLocale } from '@/components/i18n/provider-locale-provider';
import { ProviderActionButton, ProviderGrid, ProviderKpiCard, ProviderPageHeader, ProviderSectionCard, ProviderStatusPill, ProviderTable } from '@/components/design/provider-design';

function formatDateTime(value: string, locale: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale, { hour: '2-digit', minute: '2-digit' });
}

function statusVariant(status: string) {
  const normalized = status.toUpperCase();
  if (['CONFIRMED', 'COMPLETED', 'LIVE', 'READY'].includes(normalized)) return 'success';
  if (['REQUESTED', 'WAITING', 'PENDING', 'ARRIVED'].includes(normalized)) return 'warning';
  if (['CANCELLED', 'FAILED'].includes(normalized)) return 'danger';
  return 'primary';
}

export default function DashboardPage() {
  const { t, locale, dir } = useProviderLocale();
  const [data, setData] = useState<any>(null);
  const [source, setSource] = useState<'live' | 'fallback'>('live');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [result, governedSummary] = await Promise.all([
        providerApi.dashboard(),
        providerApi.providerAuditPacketSummary(30),
      ]) as [Record<string, unknown>, unknown];
      setData({
        ...result,
        governedRefillSummary: governedSummary,
        alerts: getDashboardData().alerts,
      });
      setSource('live');
    } catch (err) {
      setData(getDashboardData());
      setSource('fallback');
      setError(err instanceof Error ? err.message : 'Unable to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const governedSummary = data?.governedRefillSummary?.summary ?? null;
  const governedNotes = data?.governedRefillSummary?.governanceNotes ?? [];
  const queueItems = data?.queue ?? [];
  const alerts = data?.alerts ?? [];
  const miniChartValues = useMemo(() => {
    const base = [data?.kpis?.todaysAppointments ?? 0, data?.kpis?.waitingPatients ?? 0, data?.kpis?.unreadMessages ?? 0, governedSummary?.exportReadyCount ?? 0, governedSummary?.failedDeliveryCount ?? 0];
    return base.map((value) => Math.max(8, Number(value) || 0));
  }, [data, governedSummary]);

  if (loading && !data) return <div className="status-chip status-info">{t.dashboard.loading}</div>;
  if (!data) return <div className="status-chip status-danger">{t.dashboard.unavailable}</div>;

  return (
    <div className="provider-v13-dashboard" dir={dir}>
      {source === 'fallback' ? (
        <div className="provider-v13-fallback-banner">
          <div>
            <strong>{t.dashboard.fallbackTitle}</strong>
            <p>{t.dashboard.fallbackText} {error ?? 'Unknown error'}.</p>
          </div>
          <ProviderStatusPill tone="warning">{t.common.fallback}</ProviderStatusPill>
        </div>
      ) : null}

      <ProviderPageHeader
        eyebrow="Provider workspace"
        title={t.dashboard.todaysSchedule}
        description={t.dashboard.workflowOverview}
        actions={(
          <>
            <ProviderActionButton onClick={load}>{loading ? t.common.checking : t.common.refresh}</ProviderActionButton>
            <Link className="cp-provider-v12-button cp-provider-v12-button--primary" href="/portal/queue">{t.common.queue}</Link>
          </>
        )}
      />

      <ProviderGrid columns={3} className="provider-v13-kpi-grid">
        <ProviderKpiCard label={t.dashboard.activeCensus} value={String(data.kpis.todaysAppointments)} detail={t.dashboard.totalPatientsMonth} badge={source === 'live' ? t.common.live : t.common.snapshot} tone="primary">
          <div className="provider-v13-kpi-line">{t.dashboard.versusLastMonth}</div>
        </ProviderKpiCard>
        <ProviderKpiCard label={t.dashboard.sessionAccuracy} value="98.4%" detail={t.dashboard.auditPoints}>
          <div className="provider-v13-progress"><span style={{ width: '98%' }} /></div>
        </ProviderKpiCard>
        <ProviderKpiCard label={t.dashboard.revenueSnapshot} value="$12.8k" detail={t.dashboard.todaysSettlementEstimate}>
          <div className="provider-v13-mini-bars" aria-hidden="true">
            {miniChartValues.map((value: number, index: number) => (
              <span key={`${value}-${index}`} style={{ height: `${Math.max(22, Math.min(98, value * 8))}px` }} />
            ))}
          </div>
        </ProviderKpiCard>
      </ProviderGrid>

      <div className="provider-v13-dashboard-grid">
        <ProviderSectionCard
          title={t.dashboard.todaysSchedule}
          description={t.dashboard.workflowOverview}
          actions={<div className="provider-v13-segmented"><span>{t.common.day}</span><span>{t.common.week}</span></div>}
          className="provider-v13-schedule-card"
        >
          <ProviderTable>
            <thead>
              <tr>
                <th>Time</th>
                <th>Patient</th>
                <th>Context</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {queueItems.slice(0, 5).map((item: any) => (
                <tr key={item.id}>
                  <td><strong>{formatDateTime(item.time ?? item.startsAt ?? new Date().toISOString(), locale)}</strong></td>
                  <td>
                    <strong>{item.patientName}</strong>
                    <p className="provider-v13-table-subtext">{item.reason ?? item.service ?? t.common.clinicalFollowUp}</p>
                  </td>
                  <td>{item.isFamilySubject ? `${t.dashboard.subjectPrefix}: ${item.subjectLabel ?? t.dashboard.familySubject}` : t.common.visit}</td>
                  <td><ProviderStatusPill tone={statusVariant(item.status ?? 'READY')}>{item.location ?? item.status ?? t.common.inPerson}</ProviderStatusPill></td>
                  <td><Link href={`/portal/appointments/${item.id}`} className="provider-v13-table-link">{t.common.startVisit}</Link></td>
                </tr>
              ))}
            </tbody>
          </ProviderTable>
          {!queueItems.length ? <p className="muted">{t.common.noQueueItems}</p> : null}
        </ProviderSectionCard>

        <div className="provider-v13-rail">
          <ProviderSectionCard title={t.dashboard.patientQueue} actions={<Link className="provider-v13-table-link" href="/portal/queue">{t.common.viewAll}</Link>}>
            <div className="provider-v13-list-stack">
              {queueItems.slice(0, 3).map((item: any) => (
                <Link key={`${item.id}-mini`} href={`/portal/appointments/${item.id}`} className="provider-v13-mini-row">
                  <div>
                    <strong>{item.patientName}</strong>
                    <p>{item.reason ?? item.service ?? t.common.visit} · {item.location ?? t.common.clinic}</p>
                  </div>
                  <span>{t.common.open}</span>
                </Link>
              ))}
              {!queueItems.length ? <p className="muted">{t.common.noQueueItems}</p> : null}
            </div>
          </ProviderSectionCard>

          <ProviderSectionCard title={t.dashboard.recentMessages} actions={<Link className="provider-v13-table-link" href="/portal/messages">{t.common.openInbox}</Link>}>
            <div className="provider-v13-list-stack">
              {(alerts.slice(0, 2) as any[]).map((item) => (
                <article key={item.id} className="provider-v13-alert-snippet">
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
          </ProviderSectionCard>
        </div>
      </div>

      <div className="provider-v13-bottom-grid">
        <ProviderSectionCard title={t.dashboard.urgentActions} actions={<ProviderStatusPill tone={alerts.length ? 'warning' : 'success'}>{alerts.length}</ProviderStatusPill>}>
          <div className="provider-v13-alert-grid">
            {(alerts.slice(0, 3) as any[]).map((item) => (
              <article key={item.id} className={`provider-v13-action-card provider-v13-action-card--${item.severityVariant ?? 'primary'}`}>
                <span>{item.severity}</span>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
                <Link href="/portal/alerts" className="provider-v13-table-link">{t.dashboard.review}</Link>
              </article>
            ))}
          </div>
        </ProviderSectionCard>

        <ProviderSectionCard title={t.dashboard.governedRefillSummary} actions={<ProviderStatusPill tone="primary">{t.common.governed}</ProviderStatusPill>}>
          <div className="provider-v13-detail-grid">
            <div><span>{t.dashboard.waitingPatients}</span><strong>{String(data.kpis.waitingPatients)}</strong></div>
            <div><span>{t.dashboard.openThreads}</span><strong>{String(data.kpis.unreadMessages)}</strong></div>
            <div><span>{t.dashboard.exportReady}</span><strong>{String(governedSummary?.exportReadyCount ?? 0)}</strong></div>
            <div><span>{t.dashboard.failedDeliveries}</span><strong>{String(governedSummary?.failedDeliveryCount ?? 0)}</strong></div>
          </div>
          <div className="provider-v13-inline-actions">
            <Link href="/portal/queue" className="cp-provider-v12-button">{t.common.queue}</Link>
            <Link href="/portal/messages" className="cp-provider-v12-button">{t.common.inbox}</Link>
            <Link href="/portal/telehealth" className="cp-provider-v12-button cp-provider-v12-button--primary">{t.common.telehealth}</Link>
          </div>
        </ProviderSectionCard>

        <ProviderSectionCard title={t.dashboard.governanceNotes} actions={<ProviderStatusPill tone={(governedSummary?.failedDeliveryCount ?? 0) > 0 ? 'warning' : 'success'}>{source === 'live' ? t.common.live : t.common.snapshot}</ProviderStatusPill>}>
          <div className="provider-v13-list-stack">
            {(governedNotes.length ? governedNotes.slice(0, 4) : [t.common.noGovernedNotes]).map((note: string) => (
              <div key={note} className="provider-v13-note-row"><p>{note}</p></div>
            ))}
          </div>
        </ProviderSectionCard>

        <ProviderSectionCard title={t.dashboard.subjectContextSummary} actions={<ProviderStatusPill tone="primary">{String(data.subjectSummary?.familyCount ?? 0)} {t.dashboard.familySubjects}</ProviderStatusPill>}>
          <div className="provider-v13-detail-grid">
            <div><span>{t.dashboard.subjectTotal}</span><strong>{String(data.subjectSummary?.total ?? 0)}</strong></div>
            <div><span>{t.dashboard.selfProfiles}</span><strong>{String(data.subjectSummary?.selfCount ?? 0)}</strong></div>
            <div><span>{t.dashboard.familySubjects}</span><strong>{String(data.subjectSummary?.familyCount ?? 0)}</strong></div>
            <div><span>{t.dashboard.topRelationship}</span><strong>{String(data.subjectSummary?.topRelationship ?? '—')}</strong></div>
          </div>
          <p className="provider-v13-card-note">{t.dashboard.subjectContextSubtitle}</p>
        </ProviderSectionCard>
      </div>
    </div>
  );
}
