'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { EvidencePanel } from '@/components/shared/evidence-panel';
import { WorkspaceStateStrip } from '@/components/shared/workspace-state-strip';
import { providerApi } from '@/services/api-client';
import { appendProviderSubjectParams } from '@/lib/subject-links';
import { useProviderLocale } from '@/components/i18n/provider-locale-provider';
import { getProviderDetailCopy } from '@/lib/i18n/provider-detail-copy';

export default function AppointmentDetailPage() {
  const { locale, dir } = useProviderLocale();
  const copy = getProviderDetailCopy(locale).appointmentDetail;
  const params = useParams<{ id: string }>();
  const { id } = params;
  const [appointment, setAppointment] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authorizationReview, setAuthorizationReview] = useState<any>(null);

  async function load() {
    try {
      setError(null);
      const [result, review] = await Promise.all([providerApi.appointment(id) as Promise<any>, providerApi.authorizationReview(id) as Promise<any>]);
      setAppointment(result);
      setAuthorizationReview(review.review ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableLoad);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function confirm() {
    setSaving(true);
    try {
      await providerApi.confirmAppointment(id);
      await load();
    } finally {
      setSaving(false);
    }
  }

  const timelineItems = useMemo(() => {
    if (!appointment) return [];
    return [
      { title: copy.scheduled, detail: appointment.startsAt ? new Date(appointment.startsAt).toLocaleString(locale) : copy.notScheduled },
      { title: copy.coverage, detail: authorizationReview?.required ? `Authorization ${authorizationReview.status}` : copy.noPriorAuth },
      { title: copy.payment, detail: appointment.payment?.status ?? 'UNPAID' },
    ];
  }, [appointment, authorizationReview]);

  if (error) return <div className="status-chip status-danger">{error}</div>;
  if (!appointment) return <div className="status-chip status-info">{copy.loading}</div>;

  const chartHref = appendProviderSubjectParams(`/portal/chart/${appointment.patientId}`, appointment);
  const encounterHref = appendProviderSubjectParams(`/portal/encounters/${appointment.id}/note?patientId=${appointment.patientId}`, appointment);
  const orderHref = appendProviderSubjectParams(`/portal/orders/new?patientId=${appointment.patientId}&appointmentId=${appointment.id}`, appointment);
  const prescriptionHref = appendProviderSubjectParams(`/portal/prescriptions/new?patientId=${appointment.patientId}&appointmentId=${appointment.id}`, appointment);

  return (
    <div className="page-stack" dir={dir}>
      <section className="page-header split-header">
        <div>
          <span className="eyebrow">PR-07</span>
          <h1>{copy.title}</h1>
          <p className="muted">{copy.subtitle}</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={confirm} disabled={saving}>{saving ? copy.saving : copy.confirmAppointment}</button>
          <Link href={chartHref} className="btn btn-primary">{copy.openChart}</Link>
        </div>
      </section>

      <WorkspaceStateStrip
        items={[
          { label: copy.status, value: appointment.status, tone: appointment.status === 'CONFIRMED' ? 'success' : 'warning' },
          { label: copy.payment, value: appointment.payment?.status ?? 'UNPAID', tone: appointment.payment?.status === 'CAPTURED' ? 'success' : 'info' },
          { label: copy.authorization, value: authorizationReview?.required ? authorizationReview.status : copy.notRequired, tone: authorizationReview?.status === 'APPROVED' ? 'success' : authorizationReview?.required ? 'warning' : 'info' },
          { label: copy.visitMode, value: appointment.mode ?? appointment.visitType ?? copy.appointment, tone: 'info' },
        ]}
      />

      {authorizationReview?.required ? (
        <div className={`banner ${authorizationReview.status === 'APPROVED' ? 'banner-success' : 'banner-warning'}`}>
          <div>
            <strong>{authorizationReview.status === 'APPROVED' ? copy.authorizationApproved : copy.authorizationPending}</strong>
            <p className="muted small">{authorizationReview.note || copy.authorizationFallback}</p>
          </div>
          <span className={`status-chip status-${authorizationReview.status === 'APPROVED' ? 'success' : 'warning'}`}>{authorizationReview.status}</span>
        </div>
      ) : null}

      <section className="workspace-grid top-align-grid">
        <article className="panel-card">
          <div className="panel-header"><h2>{copy.visitSummary}</h2><span className="status-chip status-info">{appointment.patientName}</span></div>
          <div className="detail-list">
            <div><span className="detail-label">{copy.time}</span><strong>{appointment.startsAt ? new Date(appointment.startsAt).toLocaleString(locale) : '—'}</strong></div>
            <div><span className="detail-label">{copy.service}</span><strong>{appointment.service}</strong></div>
            <div><span className="detail-label">{copy.assignedProvider}</span><strong>{appointment.providerName}</strong></div>
            <div><span className="detail-label">{copy.notes}</span><strong>{appointment.notes || copy.noVisitNotes}</strong></div>
          </div>
          <div className="timeline-stack top-space">
            {timelineItems.map((item) => (
              <div key={item.title} className="timeline-step">
                <span className="detail-label">•</span>
                <div>
                  <strong>{item.title}</strong>
                  <p className="muted small">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <div className="workspace-side-stack">
          <EvidencePanel
            title={copy.downstreamWorkflow}
            badge={copy.nextActions}
            items={[
              { title: copy.chartReview, detail: copy.chartReviewText },
              { title: copy.telehealthContinuity, detail: copy.telehealthContinuityText },
              { title: copy.messageFollowUp, detail: copy.messageFollowUpText },
            ]}
          />
          <article className="panel-card">
            <div className="panel-header"><h2>{copy.operationalActions}</h2></div>
            <div className="list-stack">
              <Link href={encounterHref} className="btn btn-secondary btn-full">{copy.openEncounterNote}</Link>
              <Link href={orderHref} className="btn btn-secondary btn-full">{copy.createOrder}</Link>
              <Link href={prescriptionHref} className="btn btn-secondary btn-full">{copy.createPrescription}</Link>
              <Link href={`/portal/telehealth/waiting/${appointment.id}`} className="btn btn-secondary btn-full">{copy.telehealthRoom}</Link>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
