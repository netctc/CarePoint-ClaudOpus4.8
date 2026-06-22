'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { providerApi } from '@/services/api-client';
import { getRpmPatientById } from '@/services/mock-api';
import { useProviderLocale } from '@/components/i18n/provider-locale-provider';
import { getProviderDetailCopy } from '@/lib/i18n/provider-detail-copy';

export default function RpmPatientDetailPage() {
  const { locale, dir } = useProviderLocale();
  const copy = getProviderDetailCopy(locale).rpmDetail;
  const params = useParams<{ patientId: string }>();
  const patientId = params.patientId;
  const fallback = useMemo(() => getRpmPatientById(patientId), [patientId]);
  const [item, setItem] = useState<any>(null);
  const [source, setSource] = useState<'live' | 'fallback'>(fallback ? 'fallback' : 'live');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [escalating, setEscalating] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const result: any = await providerApi.providerRpmPatient(patientId);
      setItem(result.item ?? null);
      setSource('live');
    } catch (err) {
      setItem(null);
      setSource('fallback');
      setError(err instanceof Error ? err.message : copy.unableLoad);
    }
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  const patient = item ?? fallback;

  if (!patient) {
    return (
      <div className="page-stack" dir={dir}>
        <section className="page-header">
          <h1>{copy.notFound}</h1>
          <p className="muted">{copy.notFoundText}</p>
          <Link href="/portal/rpm" className="text-link">{copy.backToPanel}</Link>
        </section>
      </div>
    );
  }

  async function submitOutreach(event: FormEvent) {
    event.preventDefault();
    try {
      await providerApi.logProviderRpmOutreach(patientId, note || 'Outreach completed');
      setNote('');
      setMessage(copy.outreachLogged);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableOutreach);
    }
  }

  async function escalate(routeTo: 'PROVIDER_ALERT' | 'SAFETY_CASE') {
    setEscalating(true);
    setError(null);
    try {
      const result: any = await providerApi.escalateProviderRpmPatient(patientId, {
        routeTo,
        note: note || (routeTo === 'SAFETY_CASE' ? 'Escalated to safety due to severe RPM threshold breach.' : 'Escalated to provider alerts for follow-up.'),
        severity: routeTo === 'SAFETY_CASE' ? 'HIGH' : 'MEDIUM',
      });
      setMessage(routeTo === 'SAFETY_CASE'
        ? `${copy.safetyEscalated} ${result.safetyCase?.id ?? copy.pending}.`
        : `${copy.alertEscalated} ${result.providerAlert?.id ?? copy.pending}.`);
      setNote('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableEscalate);
    } finally {
      setEscalating(false);
    }
  }

  const recommendation = patient.alertRecommendation;

  return (
    <div className="page-stack" dir={dir}>
      <section className="page-header split-header">
        <div>
          <span className="eyebrow">PR-19</span>
          <h1>RPM Patient Detail</h1>
          <p className="muted">Review readings, thresholds, outreach history, and W3 escalation routing for enrolled RPM patients.</p>
        </div>
        <div className="header-actions">
          <span className={`status-chip status-${source === 'live' ? 'success' : (patient.variant ?? 'warning')}`}>{source === 'live' ? 'Live RPM' : patient.programStatus}</span>
          <Link href={`/portal/chart/${patientId}`} className="btn btn-primary">{copy.openChart}</Link>
        </div>
      </section>

      <div className={`banner ${source === 'live' ? 'banner-success' : 'banner-warning'}`}>
        <div>
          <strong>{source === 'live' ? 'RPM patient detail is connected to the live provider API.' : 'Showing fallback RPM patient detail.'}</strong>
          <p className="muted small">{source === 'live' ? 'Thresholds, readings, outreach history, and escalation routing now come from the provider RPM workspace.' : `The provider RPM patient endpoint could not be loaded: ${error ?? 'Unknown error'}.`}</p>
        </div>
        <span className={`status-chip status-${source === 'live' ? 'success' : 'warning'}`}>{source === 'live' ? 'Live' : 'Fallback'}</span>
      </div>

      {recommendation?.shouldEscalate ? (
        <div className={`banner ${recommendation.highestVariant === 'danger' ? 'banner-warning' : 'banner-info'}`}>
          <div>
            <strong>Threshold escalation suggested.</strong>
            <p className="muted small">Signals: {(recommendation.reasons ?? []).join(' • ')}.</p>
            <p className="muted small">Suggested route: {recommendation.suggestedRoute}</p>
          </div>
          <span className={`status-chip status-${recommendation.highestVariant === 'danger' ? 'danger' : 'warning'}`}>{recommendation.highestVariant}</span>
        </div>
      ) : null}

      {message ? <div className="status-chip status-success">{message}</div> : null}
      {error && source === 'live' ? <div className="status-chip status-danger">{error}</div> : null}

      <section className="content-grid two-col top-align-grid">
        <article className="panel-card">
          <div className="panel-header"><h2>{patient.patientName}</h2><span className="status-chip status-info">{patient.device}</span></div>
          <div className="list-stack">
            {(patient.thresholds ?? []).map((threshold: any) => (
              <div key={threshold.label} className="list-row compact-row top-align-row">
                <div>
                  <strong>{threshold.label}</strong>
                  <p className="muted small">{threshold.value}</p>
                </div>
                <span className={`status-chip status-${threshold.variant}`}>{threshold.status}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-header"><h2>Outreach and escalation</h2></div>
          <form className="form-stack" onSubmit={submitOutreach}>
            <label className="field"><span>Outreach note</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Called patient to review elevated reading and next steps." /></label>
            <div className="action-row wrap-row">
              <button className="btn btn-primary" type="submit" disabled={source !== 'live'}>Log outreach</button>
              <button className="btn btn-secondary" type="button" disabled={source !== 'live' || escalating} onClick={() => void escalate('PROVIDER_ALERT')}>Escalate to provider alert</button>
              <button className="btn btn-secondary" type="button" disabled={source !== 'live' || escalating} onClick={() => void escalate('SAFETY_CASE')}>Escalate to safety case</button>
            </div>
          </form>
        </article>
      </section>

      <section className="content-grid two-col top-align-grid">
        <article className="panel-card">
          <div className="panel-header"><h2>Latest readings</h2></div>
          <div className="list-stack">
            {(patient.readings ?? []).map((reading: any, index: number) => (
              <div key={`${reading.time}-${index}`} className="list-row top-align-row">
                <div>
                  <strong>{reading.metric}</strong>
                  <p className="muted small">{reading.time ? new Date(reading.time).toLocaleString() : 'Recent'}</p>
                </div>
                <span className={`status-chip status-${reading.variant}`}>{reading.value}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-header"><h2>Outreach history</h2></div>
          <div className="list-stack">
            {(patient.outreachLog ?? []).map((entry: any, index: number) => (
              <div key={`${entry.time}-${index}`} className="list-row top-align-row">
                <div>
                  <strong>{entry.by}</strong>
                  <p className="muted small">{entry.time ? new Date(entry.time).toLocaleString() : 'Recent'}</p>
                  <p className="muted small">{entry.note}</p>
                </div>
              </div>
            ))}
            {!(patient.outreachLog ?? []).length ? <p className="muted">No outreach has been logged yet.</p> : null}
          </div>
        </article>
      </section>
    </div>
  );
}
