'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { EvidencePanel } from '@/components/shared/evidence-panel';
import { WorkspaceStateStrip } from '@/components/shared/workspace-state-strip';
import { providerApi } from '@/services/api-client';
import { appendProviderSubjectParams } from '@/lib/subject-links';
import { getLabResultById } from '@/services/mock-api';
import { useProviderLocale } from '@/components/i18n/provider-locale-provider';
import { getProviderDetailCopy } from '@/lib/i18n/provider-detail-copy';

export default function ResultsReviewPage() {
  const { locale, dir } = useProviderLocale();
  const copy = getProviderDetailCopy(locale).labResult;
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const patientId = searchParams.get('patientId');
  const id = String(params.id);
  const fallback = useMemo(() => getLabResultById(id), [id]);

  const [item, setItem] = useState<any>(null);
  const [source, setSource] = useState<'live' | 'fallback'>(fallback ? 'fallback' : 'live');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [releaseReadiness, setReleaseReadiness] = useState<any>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [result, readiness]: any = await Promise.all([
        providerApi.providerLabResult(id),
        providerApi.providerLabReleaseReadiness(id),
      ]);
      setItem(result.item ?? null);
      setReleaseReadiness(result.releaseReadiness ?? readiness.releaseReadiness ?? null);
      setSource('live');
    } catch (err) {
      setItem(null);
      setReleaseReadiness(null);
      setSource('fallback');
      setError(err instanceof Error ? err.message : copy.unableLoad);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const result = item ?? fallback;
  const chartHref = patientId ? appendProviderSubjectParams(`/portal/chart/${patientId}`, result) : '/portal/labs/inbox';

  if (!result) {
    return (
      <div className="page-stack" dir={dir}>
        <section className="page-header">
          <h1>{copy.notFound}</h1>
          <p className="muted">{copy.notFoundText}</p>
          <Link href="/portal/labs/inbox" className="text-link">{copy.backToInbox}</Link>
        </section>
      </div>
    );
  }

  async function secondReviewResult() {
    try {
      setReviewing(true);
      await providerApi.secondReviewProviderLabResult(id, 'Completed second reviewer sign-off from result review');
      setMessage(copy.secondReviewRecorded);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableSecondReview);
    } finally {
      setReviewing(false);
    }
  }

  async function releaseResult() {
    try {
      await providerApi.releaseProviderLabResult(id, 'Released from provider result review');
      setMessage(copy.released);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableRelease);
    }
  }

  return (
    <div className="page-stack" dir={dir}>
      <section className="page-header split-header">
        <div>
          <span className="eyebrow">PR-15</span>
          <h1>{copy.title}</h1>
          <p className="muted">{copy.subtitle}</p>
        </div>
        <div className="header-actions">
          <span className={`status-chip status-${source === 'live' ? 'success' : (result.variant ?? 'info')}`}>{source === 'live' ? String(result.status ?? result.resultStatus ?? 'Ready').replaceAll('_', ' ') : result.resultStatus}</span>
          <button className="btn btn-secondary" onClick={secondReviewResult} disabled={source !== 'live' || result.secondReviewStatus === 'COMPLETED' || !releaseReadiness?.requiresSecondReview}>{reviewing ? 'Reviewing…' : 'Complete second review'}</button>
          <button className="btn btn-secondary" onClick={releaseResult} disabled={source !== 'live' || releaseReadiness?.ready === false}>{copy.releaseResult}</button>
          <Link href={chartHref} className="btn btn-primary">Return to chart</Link>
        </div>
      </section>

      <div className={`banner ${source === 'live' ? 'banner-success' : 'banner-warning'}`}>
        <div>
          <strong>{source === 'live' ? 'This result is connected to the live provider labs API.' : 'Showing fallback result review.'}</strong>
          <p className="muted small">{source === 'live' ? 'Release writes an auditable lab review event and links the result into the chart.' : `The provider labs result endpoint could not be loaded: ${error ?? 'Unknown error'}.`}</p>
        </div>
        <span className={`status-chip status-${source === 'live' ? 'success' : 'warning'}`}>{source === 'live' ? 'Live' : 'Fallback'}</span>
      </div>

      {message ? <div className="status-chip status-success">{message}</div> : null}
      {error && source === 'live' ? <div className="status-chip status-danger">{error}</div> : null}

      <WorkspaceStateStrip
        items={[
          { label: 'Result status', value: String(result.status ?? result.resultStatus ?? 'READY').replaceAll('_', ' '), tone: source === 'live' ? 'success' : 'warning' },
          { label: 'Second review', value: result.secondReviewStatus ?? 'NOT_REQUIRED', tone: releaseReadiness?.requiresSecondReview ? 'warning' : 'success' },
          { label: 'Preferred reviewer', value: releaseReadiness?.recommendedReviewerRole ?? 'Not required', tone: 'info' },
          { label: 'Patient', value: result.patientName ?? 'Patient', tone: 'info' },
        ]}
      />

      {releaseReadiness ? (
        <div className={`banner ${releaseReadiness.ready ? 'banner-success' : 'banner-warning'}`}>
          <div>
            <strong>{releaseReadiness.ready ? 'Result meets current release policy checks.' : 'Additional clinical review is required before release.'}</strong>
            <p className="muted small">{(releaseReadiness.guidance ?? []).join(' ')}</p>
          </div>
          <span className={`status-chip status-${releaseReadiness.ready ? 'success' : 'warning'}`}>{releaseReadiness.recommendedReviewerRole ?? 'Review'}</span>
        </div>
      ) : null}

      <section className="workspace-grid">
        <article className="panel-card">
          <div className="panel-header"><h2>{result.testName}</h2><span className="status-chip status-info">{result.patientName}</span></div>
          <div className="detail-list">
            <div><span className="detail-label">Collected at</span><strong>{result.collectedAt ?? result.requestedAt}</strong></div>
            <div><span className="detail-label">Ordering provider</span><strong>{result.orderingProvider ?? 'Provider workspace'}</strong></div>
            <div><span className="detail-label">Next step</span><strong>{result.nextStep ?? 'Release when review is complete'}</strong></div>
            <div><span className="detail-label">Second review</span><strong>{result.secondReviewStatus ?? 'NOT_REQUIRED'}</strong></div>
            <div><span className="detail-label">Preferred reviewer role</span><strong>{releaseReadiness?.recommendedReviewerRole ?? 'Not required'}</strong></div>
          </div>
        </article>

        <div className="workspace-side-stack">
          <article className="panel-card">
            <div className="panel-header"><h2>Reviewer comments</h2></div>
          <div className="list-stack">
            {(result.comments ?? []).map((comment: string) => (
              <div key={comment} className="note-card"><p>{comment}</p></div>
            ))}
            {!result.comments?.length ? <p className="muted">No reviewer comments were added yet.</p> : null}
            {releaseReadiness?.blockers?.length ? <div className="note-card"><strong>Release blockers</strong><p className="muted small">{releaseReadiness.blockers.join(' ')}</p></div> : null}
          </div>
          </article>
          <EvidencePanel
            title="Release evidence"
            badge={source === 'live' ? 'Policy' : 'Fallback'}
            items={[
              { title: 'Collection context', detail: `Collected ${result.collectedAt ?? result.requestedAt ?? '—'} • Ordering provider ${result.orderingProvider ?? 'Provider workspace'}` },
              { title: 'Next step', detail: result.nextStep ?? 'Release when review is complete' },
              { title: 'Blockers', detail: releaseReadiness?.blockers?.length ? releaseReadiness.blockers.join(' ') : 'No current blockers were returned.' },
            ]}
          />
        </div>
      </section>

      <section className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Analyte</th>
              <th>Value</th>
              <th>Reference range</th>
              <th>Flag</th>
            </tr>
          </thead>
          <tbody>
            {(result.values ?? []).map((entry: any) => (
              <tr key={entry.label}>
                <td><strong>{entry.label}</strong></td>
                <td>{entry.value}</td>
                <td>{entry.referenceRange}</td>
                <td><span className={`status-chip status-${entry.variant}`}>{entry.flag ?? 'Reviewed'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {result.relatedRecords?.length ? (
        <section className="panel-card">
          <div className="panel-header"><h2>Related chart records</h2></div>
          <div className="list-stack">
            {result.relatedRecords.map((record: any) => (
              <div key={record.id} className="list-row top-align-row">
                <div>
                  <strong>{record.summary?.title ?? 'Chart note'}</strong>
                  <p className="muted small">{record.createdAt ? new Date(record.createdAt).toLocaleString() : 'Recent'}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
