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

export default function ProviderPrescriptionDetailPage() {
  const { locale, dir } = useProviderLocale();
  const base = getProviderDetailCopy(locale).prescriptionDetail;
  const copy = getProviderPhase5Copy(locale).prescriptionDetail;
  const params = useParams<{ prescriptionId: string }>();
  const prescriptionId = String(params.prescriptionId);
  const [item, setItem] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [preview, setPreview] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result: any = await providerApi.providerPrescription(prescriptionId);
      const prescription = result.item ?? result ?? null;
      setItem(prescription);
      if (prescription?.drug) {
        setPreview(await providerApi.providerPrescriptionCompliancePreview(String(prescription.drug), prescription.pharmacyName ?? undefined));
      }
      const refill = await providerApi.providerPrescriptionRefillRequests(prescription?.patientId ?? undefined);
      setRequests((refill as any)?.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : base.unableLoad);
    }
  }, [base.unableLoad, prescriptionId]);

  useEffect(() => { load(); }, [load]);

  const prescription = item;
  const requestMatches = useMemo(() => requests.filter((entry) => entry.prescriptionId === prescription?.id), [requests, prescription]);

  if (error && !prescription) return <div className="status-chip status-danger">{error}</div>;
  if (!prescription) return <div className="status-chip status-info">{base.loading}</div>;

  const chartHref = appendProviderSubjectParams(`/portal/chart/${prescription.patientId ?? ''}`, prescription);

  return (
    <div className="page-stack" dir={dir}>
      <section className="page-header split-header">
        <div>
          <span className="eyebrow">PR-13A</span>
          <h1>{base.title}</h1>
          <p className="muted">{base.subtitle}</p>
        </div>
        <div className="header-actions">
          <Link href={chartHref} className="btn btn-secondary">{base.openChart}</Link>
          <Link href={`/portal/prescriptions/new?patientId=${prescription.patientId ?? ''}${prescription.appointmentId ? `&appointmentId=${prescription.appointmentId}` : ''}`} className="btn btn-primary">{base.openComposer}</Link>
        </div>
      </section>

      {error ? <div className="status-chip status-danger">{error}</div> : null}

      <WorkspaceStateStrip
        items={[
          { label: base.medication, value: prescription.drug ?? base.medication, tone: 'info' },
          { label: base.status, value: String(prescription.status ?? 'DRAFT').replaceAll('_', ' '), tone: String(prescription.status ?? '').includes('SIGNED') ? 'success' : 'warning' },
          { label: base.routing, value: prescription.pharmacyRoutingState ?? base.providerReview, tone: 'info' },
          { label: base.refillItems, value: String(requestMatches.length), tone: requestMatches.length ? 'warning' : 'success' },
        ]}
      />

      {preview ? (
        <div className={`banner ${preview.requiresPolicyCheck ? 'banner-warning' : 'banner-info'}`}>
          <div>
            <strong>{preview.requiresPolicyCheck ? base.policyReviewNeeded : base.policyReviewClear}</strong>
            <p className="muted small">{(preview.guidance ?? []).join(' ')}</p>
          </div>
          <span className={`status-chip status-${preview.requiresPolicyCheck ? 'warning' : 'info'}`}>{preview.pharmacyRoutingState ?? base.preview}</span>
        </div>
      ) : null}

      <section className="workspace-grid">
        <article className="panel-card">
          <div className="panel-header">
            <h2>{prescription.patientName ?? base.title}</h2>
            <span className="status-chip status-info">{String(prescription.status ?? 'DRAFT').replaceAll('_', ' ')}</span>
          </div>
          <div className="detail-list">
            <div><span className="detail-label">{base.dosage}</span><strong>{prescription.dosage ?? '—'}</strong></div>
            <div><span className="detail-label">{base.frequency}</span><strong>{prescription.frequency ?? '—'}</strong></div>
            <div><span className="detail-label">Duration</span><strong>{prescription.duration ?? '—'}</strong></div>
            <div><span className="detail-label">{copy.createdAt}</span><strong>{formatDateTime(prescription.createdAt, locale)}</strong></div>
            <div><span className="detail-label">{base.pharmacy}</span><strong>{prescription.pharmacyName ?? copy.routingNotSpecified}</strong></div>
          </div>
          <div className="top-space header-link-row">
            <Link href="/portal/messages" className="btn btn-secondary">{copy.secureMessage}</Link>
            <Link href="/portal/queue" className="btn btn-secondary">{copy.returnToQueue}</Link>
          </div>
        </article>

        <div className="workspace-side-stack">
          <EvidencePanel
            title={copy.governanceSummary}
            badge={copy.refill}
            items={[
              { title: copy.refillPolicy, detail: preview?.refillPolicy ? `Eligible ${String(preview.refillPolicy.refillEligible)} • Max ${preview.refillPolicy.refillMaxCount} • Window ${preview.refillPolicy.refillWindowDays} days` : copy.noPolicyPreview },
              { title: copy.patientRelease, detail: prescription.patientReleaseStatus ?? prescription.fulfillmentStatus ?? copy.awaitingProviderAction },
              { title: copy.clinicalNote2, detail: prescription.note ?? copy.noPrescribingNote },
            ]}
          />
          <article className="panel-card pale-card">
            <div className="panel-header"><h2>{copy.recentRefillActivity}</h2><span className="status-chip status-info">{requestMatches.length}</span></div>
            <div className="list-stack compact-list">
              {requestMatches.slice(0, 4).map((entry) => (
                <div key={entry.id} className="timeline-card">
                  <strong>{String(entry.status ?? 'PENDING').replaceAll('_', ' ')}</strong>
                  <p className="muted small">{entry.note ?? copy.noRefillNote} • {copy.assigned} {entry.assignedRole ?? 'QUEUE'}</p>
                </div>
              ))}
              {!requestMatches.length ? <p className="muted">{copy.noRefillEvents}</p> : null}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
