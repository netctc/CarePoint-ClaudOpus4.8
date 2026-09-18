'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { EvidencePanel } from '@/components/shared/evidence-panel';
import { StatCard } from '@/components/shared/stat-card';
import { WorkspaceStateStrip } from '@/components/shared/workspace-state-strip';
import { useProviderLocale } from '@/components/i18n/provider-locale-provider';
import { getProviderPhase5Copy } from '@/lib/i18n/provider-phase5-copy';
import { appendProviderSubjectParams } from '@/lib/subject-links';
import { providerApi } from '@/services/api-client';
import { getPatientChartSummary } from '@/services/mock-api';

type PatientReportResponse = { items?: any[] };

function formatDateTime(value: string | null | undefined, locale: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale);
}

export default function PatientChartSummaryPage() {
  const { locale, dir } = useProviderLocale();
  const copy = getProviderPhase5Copy(locale).chart;
  const params = useParams<{ patientId: string }>();
  const searchParams = useSearchParams();
  const patientId = String(params.patientId);
  const requestedSubjectProfileId = searchParams.get('subjectProfileId');
  const requestedSubjectLabel = searchParams.get('subjectLabel');
  const requestedSubjectRelationship = searchParams.get('subjectRelationship');
  const activeSubject = useMemo(() => ({
    subjectProfileId: requestedSubjectProfileId,
    subjectLabel: requestedSubjectLabel,
    subjectRelationship: requestedSubjectRelationship,
  }), [requestedSubjectLabel, requestedSubjectProfileId, requestedSubjectRelationship]);
  const fallback = useMemo(() => getPatientChartSummary(patientId), [patientId]);

  const [records, setRecords] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [patientReports, setPatientReports] = useState<any[]>([]);
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState<'live' | 'fallback'>('live');
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<any>(null);
  const [accessContext, setAccessContext] = useState<any>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [recordResult, appointmentResult, meResult, accessResult, reportResult] = await Promise.all([
        providerApi.records(patientId, requestedSubjectProfileId ?? undefined) as Promise<any>,
        providerApi.appointments() as Promise<any>,
        providerApi.me() as Promise<any>,
        providerApi.chartAccessContext(patientId, requestedSubjectProfileId ?? undefined) as Promise<any>,
        providerApi.providerPatientReports(patientId, requestedSubjectProfileId ?? undefined).catch(() => ({ items: [] })) as Promise<PatientReportResponse>,
      ]);
      setRecords(recordResult.items ?? []);
      setAppointments((appointmentResult.items ?? []).filter((item: any) => item.patientId === patientId && ((requestedSubjectProfileId ? item.subjectProfileId === requestedSubjectProfileId : !item.subjectProfileId) || !requestedSubjectProfileId)));
      setMe(meResult);
      setAccessContext(accessResult);
      setPatientReports(reportResult.items ?? []);
      setSource('live');
    } catch (err) {
      setRecords([]);
      setAppointments([]);
      setMe(null);
      setAccessContext(null);
      setPatientReports([]);
      setSource('fallback');
      setError(err instanceof Error ? err.message : copy.unableLoad);
    }
  }, [copy.unableLoad, patientId, requestedSubjectProfileId]);

  useEffect(() => {
    load();
  }, [load]);

  const subjectName = accessContext?.subject?.name ?? requestedSubjectLabel ?? null;
  const subjectRelationship = accessContext?.subject?.relationship ?? requestedSubjectRelationship ?? null;
  const patientName = useMemo(
    () => subjectName || records[0]?.patientName || appointments[0]?.subjectLabel || appointments[0]?.patientName || fallback?.patientName || copy.patient,
    [appointments, copy.patient, fallback?.patientName, records, subjectName],
  );

  const latestAppointment = appointments[0] ?? null;
  const latestRecordAt = records[0]?.createdAt ?? null;
  const recordCount = records.length;
  const recentProblems = fallback?.problems ?? [];
  const recentMeds = fallback?.medications ?? [];

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!me?.providerProfile?.id) {
      setError(copy.liveSessionRequired);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await providerApi.createRecord({
        patientId,
        providerId: me.providerProfile.id,
        appointmentId: latestAppointment?.id,
        summary: { title: summary || copy.defaultChartNote, type: 'chart_note' },
        content: {
          notes: content,
          source: 'provider-chart',
          enteredBy: me.fullName ?? me.email ?? 'Provider',
          subjectProfileId: requestedSubjectProfileId ?? null,
          subjectLabel: subjectName ?? null,
          subjectRelationship: subjectRelationship ?? null,
        },
      });
      setSummary('');
      setContent('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableSave);
    } finally {
      setSaving(false);
    }
  }

  const encounterHref = latestAppointment
    ? appendProviderSubjectParams(`/portal/encounters/${latestAppointment.id}/note?patientId=${patientId}`, activeSubject)
    : '/portal/queue';
  const orderHref = appendProviderSubjectParams(`/portal/orders/new?patientId=${patientId}${latestAppointment ? `&appointmentId=${latestAppointment.id}` : ''}`, activeSubject);
  const prescriptionHref = appendProviderSubjectParams(`/portal/prescriptions/new?patientId=${patientId}${latestAppointment ? `&appointmentId=${latestAppointment.id}` : ''}`, activeSubject);
  const labsHref = appendProviderSubjectParams(`/portal/labs/inbox?patientId=${patientId}`, activeSubject);

  return (
    <div className="page-stack cp-provider-v15-chart" dir={dir}>
      <section className="page-header split-header">
        <div>
          <span className="eyebrow">PR-08</span>
          <h1>{copy.title}</h1>
          <p className="muted">{copy.subtitle}</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={load}>{copy.refresh}</button>
          <Link href={encounterHref} className="btn btn-primary">
            {copy.openEncounterNote}
          </Link>
        </div>
      </section>

      {subjectName ? (
        <div className="banner banner-info">
          <div>
            <strong>Family subject context</strong>
            <p className="muted small">Viewing chart data for {subjectName}{subjectRelationship ? ` • ${subjectRelationship}` : ''}. Access is limited to appointments explicitly linked to this dependent profile.</p>
          </div>
          <span className="status-chip status-info">Dependent</span>
        </div>
      ) : null}

      {source === 'fallback' ? (
        <div className="banner banner-warning">
          <div>
            <strong>{copy.fallbackTitle}</strong>
            <p className="muted small">{copy.fallbackErrorPrefix} {error ?? copy.unknownError}.</p>
          </div>
          <span className="status-chip status-warning">{copy.fallback}</span>
        </div>
      ) : null}

      {error && source === 'live' ? <div className="status-chip status-danger">{error}</div> : null}

      {source === 'live' && accessContext?.accessPath === 'CARE_TEAM_EXCEPTION' ? (
        <div className="banner banner-warning">
          <div>
            <strong>{copy.exceptionTitle}</strong>
            <p className="muted small">{copy.reason}: {accessContext?.chartAccessException?.reasonCode ?? copy.temporaryAssignment}. {accessContext?.guidance ?? copy.exceptionGuidance}</p>
          </div>
          <span className="status-chip status-warning">{copy.exception}</span>
        </div>
      ) : null}

      <WorkspaceStateStrip
        items={[
          { label: copy.accessPath, value: source === 'live' ? String(accessContext?.accessPath ?? 'DIRECT_PROVIDER_ASSIGNMENT').replaceAll('_', ' ') : copy.fallbackSummary, tone: source === 'live' ? 'success' : 'warning' },
          { label: copy.patient, value: patientName, tone: 'info' },
          { label: copy.records, value: String(recordCount || (fallback ? 1 : 0)), tone: 'info' },
          { label: subjectName ? 'Shared reports' : copy.upcomingVisits, value: subjectName ? String(patientReports.length) : String(appointments.length), tone: subjectName ? 'info' : (appointments.length ? 'success' : 'warning') },
        ]}
      />

      <section className="stats-grid">
        <StatCard label={copy.patient} value={patientName} detail={fallback?.status ?? copy.clinicalSummary} />
        <StatCard label={copy.records} value={String(recordCount || (fallback ? 1 : 0))} detail={recordCount ? copy.liveRecords : copy.fallbackOnly} />
        <StatCard label={copy.lastRecord} value={formatDateTime(latestRecordAt, locale)} detail={copy.providerEntry} />
        <StatCard label={subjectName ? 'Shared reports' : copy.upcomingVisits} value={String(subjectName ? patientReports.length : appointments.length)} detail={subjectName ? 'Patient-uploaded reports shared for this dependent profile' : copy.linkedAppointments} />
      </section>

      <section className="workspace-grid">
        <article className="panel-card">
          <div className="panel-header"><h2>{patientName}</h2></div>
          <div className="detail-list">
            <div><span className="detail-label">{copy.dob}</span><strong>{fallback?.dob ?? '—'}</strong></div>
            <div><span className="detail-label">{copy.allergies}</span><strong>{fallback?.allergies ?? copy.reviewHistory}</strong></div>
            <div><span className="detail-label">{copy.primaryConcern}</span><strong>{fallback?.concerns ?? latestAppointment?.service ?? copy.noConcern}</strong></div>
            <div><span className="detail-label">{subjectName ? 'Linked subject visit' : copy.lastVisit}</span><strong>{latestAppointment ? formatDateTime(latestAppointment.startsAt, locale) : copy.noLinkedVisit}</strong></div>
          </div>
          {recentProblems.length ? (
            <div className="top-space">
              <span className="detail-label">{copy.problemList}</span>
              <div className="tag-list">
                {recentProblems.map((item) => <span key={item} className="info-tag">{item}</span>)}
              </div>
            </div>
          ) : null}
          {recentMeds.length ? (
            <div className="top-space">
              <span className="detail-label">{copy.activeMedications}</span>
              <div className="tag-list">
                {recentMeds.map((item) => <span key={item} className="info-tag">{item}</span>)}
              </div>
            </div>
          ) : null}
        </article>

        <div className="workspace-side-stack">
          <article className="panel-card">
            <div className="panel-header"><h2>{copy.clinicalActions}</h2></div>
            <div className="action-row wrap-row">
              <Link href={encounterHref} className="btn btn-secondary">{copy.encounterNote}</Link>
              <Link href={orderHref} className="btn btn-secondary">{copy.orders}</Link>
              <Link href={prescriptionHref} className="btn btn-secondary">{copy.prescription}</Link>
              <Link href={labsHref} className="btn btn-primary">{copy.labs}</Link>
            </div>
            <div className="top-space note-card">
              <strong>{copy.liveBehavior}</strong>
              <p className="muted small">{copy.liveBehaviorText}</p>
            </div>
          </article>
          <EvidencePanel
            title={subjectName ? 'Shared report evidence' : copy.chartEvidence}
            badge={source === 'live' ? 'Live' : copy.fallback}
            items={subjectName
              ? (patientReports.length
                  ? patientReports.slice(0, 3).map((item: any) => ({
                      title: item.fileName ?? 'Uploaded report',
                      detail: [item.category, item.reportDate, item.providerName].filter(Boolean).join(' • ') || 'Shared with scheduled doctors only',
                    }))
                  : [{ title: 'No shared reports', detail: 'This dependent profile has no reports shared with the current provider appointment scope.' }])
              : [
                  { title: copy.latestEncounter, detail: latestAppointment ? `${latestAppointment.service} • ${formatDateTime(latestAppointment.startsAt, locale)}` : copy.noLinkedVisitReturned },
                  { title: copy.allergies, detail: fallback?.allergies ?? copy.reviewActiveAllergies },
                  { title: copy.primaryConcern, detail: fallback?.concerns ?? latestAppointment?.service ?? copy.noActiveConcern },
                ]}
          />
        </div>
      </section>

      <section className="workspace-grid">
        <article className="panel-card">
          <div className="panel-header"><h2>{copy.chartEntries}</h2></div>
          <div className="list-stack">
            {records.map((record) => (
              <div key={record.id} className="list-row top-align-row">
                <div>
                  <strong>{record.summary?.title || copy.clinicalNote}</strong>
                  <p className="muted small">{formatDateTime(record.createdAt, locale)}</p>
                  <p className="muted small">{record.content?.notes || JSON.stringify(record.content)}</p>
                </div>
                <span className="status-chip status-info">Live</span>
              </div>
            ))}
            {!records.length && fallback ? (
              <div className="note-card">
                <strong>{copy.starterSummary}</strong>
                <p className="muted small">{fallback.concerns}</p>
              </div>
            ) : null}
            {!records.length && !fallback ? <p className="muted">{copy.noEntries}</p> : null}
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-header"><h2>{copy.addChartNote}</h2></div>
          <form className="form-stack" onSubmit={onSubmit}>
            <label className="field">
              <span>{copy.summaryTitle}</span>
              <input value={summary} onChange={(event) => setSummary(event.target.value)} placeholder={copy.summaryPlaceholder} />
            </label>
            <label className="field">
              <span>{copy.clinicalNoteLabel}</span>
              <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder={copy.notePlaceholder} />
            </label>
            <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? copy.saving : copy.saveNote}</button>
          </form>
        </article>
      </section>
    </div>
  );
}
