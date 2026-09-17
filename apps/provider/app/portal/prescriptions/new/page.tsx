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
import { getPrescriptionComposerData } from '@/services/mock-api';

type SignedPrescriptionResponse = {
  item?: {
    drug?: string;
    pharmacyName?: string | null;
  };
};

export default function PrescriptionComposerPage() {
  const { locale, dir } = useProviderLocale();
  const base = getProviderDetailCopy(locale).prescriptionComposer;
  const copy = getProviderPhase5Copy(locale).prescriptionComposer;
  const searchParams = useSearchParams();
  const patientId = searchParams.get('patientId');
  const appointmentId = searchParams.get('appointmentId');
  const subjectProfileId = searchParams.get('subjectProfileId');
  const subjectLabel = searchParams.get('subjectLabel');
  const subjectRelationship = searchParams.get('subjectRelationship');
  const fallback = useMemo(() => getPrescriptionComposerData(), []);

  const [appointment, setAppointment] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [refillRequests, setRefillRequests] = useState<any[]>([]);
  const [pharmacyQueue, setPharmacyQueue] = useState<any[]>([]);
  const [pharmacySummary, setPharmacySummary] = useState<any>(null);
  const [compliancePreview, setCompliancePreview] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState<'live' | 'fallback'>('fallback');
  const [drug, setDrug] = useState<string>(fallback.drug ?? '');
  const [dosage, setDosage] = useState<string>(fallback.dosage ?? '');
  const [frequency, setFrequency] = useState<string>(fallback.frequency ?? '');
  const [duration, setDuration] = useState<string>(fallback.duration ?? '');
  const [pharmacyName, setPharmacyName] = useState<string>('');
  const resolvedPatientId = appointment?.patientId ?? patientId ?? '';

  const load = useCallback(async () => {
    setError(null);
    try {
      const [appointmentResult, prescriptionsResult, refillResult, pharmacyQueueResult]: any = await Promise.all([
        appointmentId ? providerApi.appointment(appointmentId) : Promise.resolve(null),
        providerApi.providerPrescriptions(patientId ?? undefined, subjectProfileId ?? undefined),
        providerApi.providerPrescriptionRefillRequests(patientId ?? undefined),
        providerApi.providerPharmacyQueue(),
      ]);
      setAppointment(appointmentResult ?? null);
      setItems(prescriptionsResult?.items ?? []);
      setRefillRequests(refillResult?.items ?? []);
      setPharmacyQueue(pharmacyQueueResult?.items ?? []);
      setPharmacySummary(pharmacyQueueResult?.summary ?? null);
      setCompliancePreview(await providerApi.providerPrescriptionCompliancePreview(drug, pharmacyName || undefined));
      setSource('live');
    } catch (err) {
      setAppointment(null);
      setItems([]);
      setRefillRequests([]);
      setPharmacyQueue([]);
      setPharmacySummary(null);
      setCompliancePreview(null);
      setSource('fallback');
      setError(err instanceof Error ? err.message : base.unableLoad);
    }
  }, [appointmentId, base.unableLoad, drug, patientId, pharmacyName, subjectProfileId]);

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
      const created: any = await providerApi.createProviderPrescription({
        patientId: resolvedPatientId,
        patientName: appointment?.subjectLabel ?? appointment?.patientName ?? subjectLabel ?? fallback.patientName,
        appointmentId: appointment?.id ?? appointmentId ?? undefined,
        encounterId: appointment?.id ?? appointmentId ?? undefined,
        drug,
        dosage,
        frequency,
        duration,
        pharmacyName,
        subjectProfileId: subjectProfileId ?? undefined,
        subjectLabel: appointment?.subjectLabel ?? subjectLabel ?? undefined,
        subjectRelationship: appointment?.subjectRelationship ?? subjectRelationship ?? undefined,
      });
      const signed = await providerApi.signProviderPrescription(String(created?.item?.id), 'Signed from prescription composer') as SignedPrescriptionResponse;
      setMessage(base.submitted);
      if (signed.item?.drug) {
        setCompliancePreview(await providerApi.providerPrescriptionCompliancePreview(String(signed.item.drug), signed.item.pharmacyName ?? undefined));
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : base.unableSubmit);
    } finally {
      setSaving(false);
    }
  }

  async function handleReviewRequest(requestId: string, action: 'APPROVE' | 'REJECT' | 'ROUTE_TO_PHARMACY' | 'MARK_FULFILLED') {
    setError(null);
    setMessage(null);
    try {
      const note = (action === 'APPROVE' ? 'Approved refill' : action === 'REJECT' ? 'Rejected refill' : action === 'ROUTE_TO_PHARMACY' ? 'Routed to pharmacy network queue.' : 'Fulfillment confirmed by pharmacy.') ?? '';
      await providerApi.reviewProviderRefillRequest(requestId, { action, note: note.trim() || undefined, queue: action === 'ROUTE_TO_PHARMACY' ? 'PHARMACY_NETWORK' : undefined });
      setMessage(`Refill request ${action.replaceAll('_', ' ').toLowerCase()} saved through the live provider API.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update refill request');
    }
  }

  const backToChartHref = appointment?.patientId ? appendProviderSubjectParams(`/portal/chart/${appointment.patientId}`, appointment ?? { subjectProfileId, subjectLabel, subjectRelationship }) : '/portal/queue';

  return (
    <div className="page-stack cp-clinical-flow cp-prescription-flow" dir={dir}>
      <section className="page-header split-header">
        <div>
          <span className="eyebrow">PR-13</span>
          <h1>{base.title}</h1>
          <p className="muted">{base.subtitle}</p>
        </div>
        <div className="header-actions">
          <Link href={backToChartHref} className="btn btn-secondary">{copy.backToChart}</Link>
        </div>
      </section>

      <div className={`banner ${source === 'live' ? 'banner-success' : 'banner-warning'}`}>
        <div>
          <strong>{source === 'live' ? copy.liveTitle : copy.fallbackTitle}</strong>
          <p className="muted small">{source === 'live' ? copy.liveText : `${copy.fallbackErrorPrefix} ${error ?? 'Unknown error'}.`}</p>
        </div>
        <span className={`status-chip status-${source === 'live' ? 'success' : 'warning'}`}>{source === 'live' ? 'Live' : 'Fallback'}</span>
      </div>

      {message ? <div className="status-chip status-success">{message}</div> : null}
      {error && source === 'live' ? <div className="status-chip status-danger">{error}</div> : null}
      {compliancePreview ? <div className={`banner ${compliancePreview.requiresPolicyCheck ? 'banner-warning' : 'banner-info'}`}><div><strong>{compliancePreview.requiresPolicyCheck ? copy.policyCheckRequired : copy.previewAvailable}</strong><p className="muted small">{(compliancePreview.guidance ?? []).join(' ')}</p></div><span className={`status-chip status-${compliancePreview.requiresPolicyCheck ? 'warning' : 'info'}`}>{compliancePreview.pharmacyRoutingState ?? copy.preview}</span></div> : null}

      <WorkspaceStateStrip
        items={[
          { label: 'Composer source', value: source === 'live' ? 'Provider API' : 'Fallback', tone: source === 'live' ? 'success' : 'warning' },
          { label: copy.activeScripts, value: String(items.length), tone: 'info' },
          { label: copy.refillQueue, value: String(refillRequests.length), tone: refillRequests.length ? 'warning' : 'success' },
          { label: copy.pharmacyVisibility, value: String(pharmacyQueue.length), tone: 'info' },
        ]}
      />

      <section className="content-grid two-col top-align-grid cp-clinical-worklist">
        <article className="panel-card cp-workflow-card">
          <div className="panel-header"><h2>{copy.prescriptionDetails}</h2></div>
          <form className="form-stack" onSubmit={onSubmit}>
            <label className="field"><span>{base.medication}</span><input value={drug ?? ''} onChange={(event) => setDrug(event.target.value)} /></label>
            <label className="field"><span>{base.dosage}</span><input value={dosage ?? ''} onChange={(event) => setDosage(event.target.value)} /></label>
            <div className="content-grid two-col compact-grid">
              <label className="field"><span>{base.frequency}</span><input value={frequency ?? ''} onChange={(event) => setFrequency(event.target.value)} /></label>
              <label className="field"><span>Duration</span><input value={duration ?? ''} onChange={(event) => setDuration(event.target.value)} /></label>
            </div>
            <label className="field"><span>{copy.pharmacyRouting}</span><input value={pharmacyName ?? ''} onChange={(event) => setPharmacyName(event.target.value)} /></label>
            <button className="btn btn-primary" type="submit" disabled={saving || !resolvedPatientId}>{saving ? 'Signing…' : copy.createAndSign}</button>
          </form>
          <div className="top-space tag-list">
            {fallback.shortcuts.map((item) => (
              <button key={item} type="button" className="info-tag" onClick={() => {
                if (item.toLowerCase().includes('supply')) setDuration(item);
                else if (item.toLowerCase().includes('daily')) setFrequency(item);
              }}>{item}</button>
            ))}
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-header"><h2>{copy.complianceChecks}</h2></div>
          <div className="list-stack">
            {fallback.complianceChecks.map((item) => (
              <div key={item.label} className="list-row top-align-row">
                <div>
                  <strong>{item.label}</strong>
                  <p className="muted small">{item.detail}</p>
                </div>
                <span className={`status-chip status-${item.variant}`}>{item.status}</span>
              </div>
            ))}
            {compliancePreview?.refillPolicy ? <div className="note-card"><strong>{copy.refillPolicy2}</strong><p className="muted small">Eligible: {String(compliancePreview.refillPolicy.refillEligible)} • Max count: {compliancePreview.refillPolicy.refillMaxCount} • Window: {compliancePreview.refillPolicy.refillWindowDays} days</p></div> : null}
            {pharmacySummary ? <div className="note-card"><strong>{copy.pharmacyQueue}</strong><p className="muted small">{copy.pending2}: {pharmacySummary.pending} • {copy.fulfilled}: {pharmacySummary.fulfilled} • {copy.rejected}: {pharmacySummary.rejected}</p></div> : null}
          </div>
        </article>
      </section>

      <section className="content-grid two-col top-align-grid">
        <article className="panel-card">
          <div className="panel-header"><h2>{copy.recentPrescriptions}</h2><span className="status-chip status-info">{items.length}</span></div>
          <div className="list-stack">
            {items.slice(0, 6).map((item) => (
              <div key={item.id} className="list-row top-align-row">
                <div>
                  <strong>{item.patientName}</strong>
                  <p className="muted small">{item.drug} • {item.dosage} • {item.frequency}</p>
                </div>
                <div className="workspace-side-stack" style={{ gap: 10 }}>
                  <span className="status-chip status-info">{String(item.status ?? 'DRAFT').replaceAll('_', ' ')}</span>
                  <Link href={`/portal/prescriptions/${item.id}`} className="text-link">{copy.openDetail}</Link>
                </div>
              </div>
            ))}
            {!items.length ? <p className="muted">{copy.noPrescriptions}</p> : null}
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-header"><h2>{copy.recentRefillRequests}</h2><span className="status-chip status-info">{refillRequests.length}</span></div>
          <div className="list-stack">
            {refillRequests.slice(0, 6).map((item) => (
              <div key={item.id} className="note-card">
                <div className="list-row top-align-row">
                  <div>
                    <strong>{String(item.status ?? 'PENDING').replaceAll('_', ' ')}</strong>
                    <p className="muted small">Prescription {item.prescriptionId} • Routing {item.pharmacyRoutingState}</p>
                    <p className="muted small">Assigned: {item.assignedRole ?? copy.queue} • {copy.fulfillment}: {item.fulfillmentStatus ?? copy.awaitingReview}</p>
                    <p className="muted small">{item.note ?? copy.noNoteCaptured}</p>
                  </div>
                </div>
                <div className="inline-actions top-space-sm">
                  <button className="btn btn-secondary" type="button" onClick={() => handleReviewRequest(item.id, 'APPROVE')}>{copy.approve}</button>
                  <button className="btn btn-secondary" type="button" onClick={() => handleReviewRequest(item.id, 'ROUTE_TO_PHARMACY')}>{copy.routeToPharmacy}</button>
                  <button className="btn btn-secondary" type="button" onClick={() => handleReviewRequest(item.id, 'MARK_FULFILLED')}>{copy.markFulfilled}</button>
                  <button className="btn btn-danger" type="button" onClick={() => handleReviewRequest(item.id, 'REJECT')}>{copy.reject}</button>
                </div>
              </div>
            ))}
            {!refillRequests.length ? <p className="muted">{copy.noRefillWaiting}</p> : null}
          </div>
        </article>
      </section>

      <section className="panel-card">
        <div className="panel-header"><h2>{copy.pharmacyQueueVisibility}</h2><span className="status-chip status-info">{pharmacyQueue.length}</span></div>
        <div className="list-stack">
          {pharmacyQueue.slice(0, 8).map((item) => (
            <div key={item.id} className="list-row top-align-row">
              <div>
                <strong>{String(item.status ?? 'ROUTED_TO_PHARMACY').replaceAll('_', ' ')}</strong>
                <p className="muted small">Prescription {item.prescriptionId} • {copy.queue} {item.queue ?? 'PHARMACY_NETWORK'} • {copy.fulfillment} {item.fulfillmentStatus ?? 'IN_PHARMACY_QUEUE'}</p>
                <p className="muted small">{item.decisionNote ?? item.note ?? copy.awaitingPharmacistAction}</p>
              </div>
              <span className="status-chip status-info">{item.assignedRole ?? 'PHARMACIST'}</span>
            </div>
          ))}
          {!pharmacyQueue.length ? <p className="muted">{copy.noPharmacyQueue}</p> : null}
        </div>
      </section>
    </div>
  );
}
