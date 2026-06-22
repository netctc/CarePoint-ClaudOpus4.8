'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StatCard } from '@/components/shared/stat-card';
import { providerApi } from '@/services/api-client';
import { getRpmProgramData } from '@/services/mock-api';
import { useProviderLocale } from '@/components/i18n/provider-locale-provider';
import { getProviderPortalCopy } from '@/lib/i18n/provider-portal-copy';

export default function RpmProgramPanelPage() {
  const { locale, dir } = useProviderLocale();
  const copy = getProviderPortalCopy(locale).rpm;
  const fallback = useMemo(() => getRpmProgramData(), []);
  const [summary, setSummary] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [source, setSource] = useState<'live' | 'fallback'>('fallback');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [summaryResult, patientsResult]: any = await Promise.all([
        providerApi.providerRpmSummary(),
        providerApi.providerRpmPatients(),
      ]);
      setSummary(summaryResult.summary ?? null);
      setPatients(patientsResult.items ?? []);
      setSource('live');
    } catch (err) {
      setSummary(null);
      setPatients([]);
      setSource('fallback');
      setError(err instanceof Error ? err.message : copy.unableLoad);
    }
  }, [copy.unableLoad]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = source === 'live' && patients.length ? patients : fallback.patients;

  return (
    <div className="page-stack" dir={dir}>
      <section className="page-header split-header">
        <div>
          <span className="eyebrow">PR-18</span>
          <h1>{copy.title}</h1>
          <p className="muted">{copy.subtitle}</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={load}>{copy.refresh}</button>
          <Link href="/portal/alerts" className="btn btn-primary">{copy.reviewAlerts}</Link>
        </div>
      </section>

      <div className={`banner ${source === 'live' ? 'banner-success' : 'banner-warning'}`}>
        <div>
          <strong>{source === 'live' ? copy.liveTitle : copy.fallbackTitle}</strong>
          <p className="muted small">{source === 'live' ? copy.liveText : `${copy.fallbackText} ${error ?? 'Unknown error'}.`}</p>
        </div>
        <span className={`status-chip status-${source === 'live' ? 'success' : 'warning'}`}>{source === 'live' ? 'Live' : 'Fallback'}</span>
      </div>

      <section className="stats-grid">
        <StatCard label={copy.enrolledPatients} value={String(summary?.total ?? rows.length ?? fallback.enrolledCount)} detail={copy.currentScope} />
        <StatCard label={copy.alertingPatients} value={String(summary?.alertingCount ?? fallback.alertingCount)} detail={copy.needTriage} />
        <StatCard label={copy.statusesTracked} value={String(summary?.statusCount ?? rows.length)} detail={copy.statusBuckets} />
        <StatCard label={copy.storage} value={source === 'live' ? 'Provider API' : copy.starter} detail={copy.sourceMode} />
      </section>

      <section className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>{copy.patient}</th>
              <th>{copy.device}</th>
              <th>{copy.latestReading}</th>
              <th>{copy.adherence}</th>
              <th>{copy.thresholdStatus}</th>
              <th>{copy.action}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((patient) => (
              <tr key={patient.patientId}>
                <td><strong>{patient.patientName}</strong></td>
                <td>{patient.device}</td>
                <td>{patient.latestReading}</td>
                <td>{patient.adherence}</td>
                <td><span className={`status-chip status-${patient.variant}`}>{patient.thresholdStatus}</span></td>
                <td><Link href={`/portal/rpm/${patient.patientId}`} className="text-link">{copy.openPatient}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
