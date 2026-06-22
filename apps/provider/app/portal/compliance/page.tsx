'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { StatCard } from '@/components/shared/stat-card';
import { providerApi } from '@/services/api-client';
import { useProviderLocale } from '@/components/i18n/provider-locale-provider';
import { getProviderPortalCopy } from '@/lib/i18n/provider-portal-copy';

function formatDateTime(value?: string | null, locale?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale);
}

export default function ComplianceAuditPage() {
  const { locale, dir } = useProviderLocale();
  const copy = getProviderPortalCopy(locale).compliance;
  const [summary, setSummary] = useState<any>(null);
  const [logs, setLogs] = useState<Array<Record<string, any>>>([]);
  const [format, setFormat] = useState<'json' | 'csv'>('csv');
  const [purpose, setPurpose] = useState(locale === 'ar' ? 'مراجعة امتثال خاصة بمقدم الخدمة لمتابعة تشغيلية مصرح بها' : 'Provider-scoped compliance review for authorized operational follow-up');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [subjectScope, setSubjectScope] = useState<'all' | 'self' | 'family'>('all');
  const [location, setLocation] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryResult, logResult]: any = await Promise.all([
        providerApi.providerComplianceSummary(subjectScope, location || undefined),
        providerApi.providerComplianceLogs(50, subjectScope, location || undefined),
      ]);
      setSummary(summaryResult.summary ?? null);
      setLogs(logResult.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableLoad);
      setSummary(null);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [copy.unableLoad, location, subjectScope]);

  useEffect(() => {
    load();
  }, [load]);

  const acknowledgedCount = useMemo(() => logs.filter((item: Record<string, any>) => item.acknowledged).length, [logs]);

  async function acknowledgeLog(auditId: string) {
    try {
      await providerApi.acknowledgeProviderComplianceLog(auditId, 'Reviewed in provider compliance console');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableAck);
    }
  }

  async function exportCompliance() {
    if (!purpose.trim()) {
      setExportMessage(copy.purposeRequired);
      return;
    }
    try {
      const payload = await providerApi.exportProviderCompliance(format, purpose.trim(), subjectScope, location || undefined);
      const blob = new Blob([payload.content], { type: payload.contentType });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = payload.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setExportMessage(`${copy.downloadedPrefix} ${payload.filename}. ${copy.downloadedSuffix}`);
    } catch (err) {
      setExportMessage(err instanceof Error ? err.message : copy.unableExport);
    }
  }

  return (
    <div className="page-stack" dir={dir}>
      <section className="page-header split-header">
        <div>
          <span className="eyebrow">PR-25</span>
          <h1>{copy.title}</h1>
          <p className="muted">{copy.subtitle}</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={load}>{copy.refresh}</button>
        </div>
      </section>

      {error ? <div className="status-chip status-danger">{error}</div> : null}

      <section className="stats-grid">
        <StatCard label={locale === 'ar' ? 'مقدم الخدمة' : 'Provider'} value={String(summary?.providerName ?? 'Unknown')} detail={summary?.providerProfileId ?? copy.noSummary} />
        <StatCard label={copy.totalEvents} value={String(summary?.auditEvents ?? 0)} detail={copy.reviewQueue} />
        <StatCard label={copy.acknowledged} value={String(acknowledgedCount)} detail={copy.acknowledgedEvents} />
        <StatCard label={copy.pending} value={String(summary?.openPolicyItems ?? 0)} detail={copy.pendingState} />
      </section>

      <section className="content-grid two-col top-align-grid">
        <article className="panel-card">
          <div className="panel-header">
            <h2>{copy.exportCard}</h2>
            <span className="status-chip status-info">{copy.exportReady}</span>
          </div>
          <div className="form-stack">
            <label className="field">
              <span>{copy.purposeOfUse}</span>
              <textarea value={purpose} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setPurpose(event.target.value)} rows={4} placeholder={copy.purposePlaceholder} />
            </label>
            <label className="field">
              <span>{copy.exportFormat}</span>
              <select value={format} onChange={(event: ChangeEvent<HTMLSelectElement>) => setFormat(event.target.value as 'json' | 'csv')}>
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
              </select>
            </label>
            <label className="field">
              <span>{locale === 'ar' ? 'المنشأة / الموقع' : 'Facility / location'}</span>
              <input value={location} onChange={(event: ChangeEvent<HTMLInputElement>) => setLocation(event.target.value)} placeholder={locale === 'ar' ? 'مثال: Virtual Care أو Main Clinic' : 'Example: Virtual Care or Main Clinic'} />
            </label>
            <label className="field">
              <span>{locale === 'ar' ? 'نطاق المريض' : 'Subject scope'}</span>
              <select value={subjectScope} onChange={(event: ChangeEvent<HTMLSelectElement>) => setSubjectScope(event.target.value as 'all' | 'self' | 'family')}>
                <option value="all">{locale === 'ar' ? 'كل الملفات' : 'All profiles'}</option>
                <option value="self">{locale === 'ar' ? 'الملف الذاتي فقط' : 'Self profile only'}</option>
                <option value="family">{locale === 'ar' ? 'العائلة / التابعون فقط' : 'Family / dependents only'}</option>
              </select>
            </label>
            <button className="btn btn-primary" onClick={exportCompliance}>{copy.export}</button>
            {exportMessage ? <div className="status-chip status-info">{exportMessage}</div> : null}
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-header">
            <h2>{copy.reviewQueue}</h2>
            <span className={`status-chip status-${summary ? 'success' : 'warning'}`}>{summary ? copy.exportReady : copy.pending}</span>
          </div>
          {loading && !summary ? <div className="status-chip status-info">{copy.loading}</div> : null}
          <div className="detail-list">
            <div>
              <span className="detail-label">Organization</span>
              <strong>{summary?.organizationId ?? 'Unavailable'}</strong>
            </div>
            <div>
              <span className="detail-label">Message threads</span>
              <strong>{summary?.messageThreads ?? 0}</strong>
            </div>
            <div>
              <span className="detail-label">Payments in scope</span>
              <strong>{summary?.paymentsInScope ?? 0}</strong>
            </div>
            <div>
              <span className="detail-label">Outstanding alerts</span>
              <strong>{summary?.outstandingAlerts ?? 0}</strong>
            </div>
            <div>
              <span className="detail-label">Facility scope</span>
              <strong>{summary?.locationFilter || 'All accessible facilities'}</strong>
            </div>
          </div>
          {Array.isArray(summary?.facilityBreakdown) && summary.facilityBreakdown.length ? (
            <div className="detail-list" style={{ marginTop: 16 }}>
              {summary.facilityBreakdown.map((item: any) => (
                <div key={item.location}>
                  <span className="detail-label">{item.location}</span>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          ) : null}
        </article>
      </section>

      <section className="table-card">
        <div className="panel-header">
          <h2>{copy.totalEvents}</h2>
          <span className="status-chip status-info">Live</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>{copy.event}</th>
              <th>Resource</th>
              <th>{copy.at}</th>
              <th>{copy.actor}</th>
              <th>{copy.subject}</th>
              <th>{copy.state}</th>
              <th>{locale === 'ar' ? 'المنشأة' : 'Facility'}</th>
              <th>{copy.action}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{log.action}</td>
                <td>{log.resource}</td>
                <td>{formatDateTime(log.createdAt, locale)}</td>
                <td>{log.actor?.name || log.actor?.email || 'System'}</td>
                <td>{log.subjectContext?.isFamilySubject ? [log.subjectContext?.subjectLabel || copy.patient, log.subjectContext?.subjectRelationship].filter(Boolean).join(' • ') : copy.selfSubject}</td>
                <td>{log.acknowledged ? copy.acknowledgedState : copy.pendingState}</td>
                <td>{log.facilityContext?.location || 'Unassigned'}</td>
                <td>
                  <button className="btn btn-secondary" disabled={log.acknowledged} onClick={() => acknowledgeLog(log.id)}>
                    {log.acknowledged ? copy.acknowledgedState : copy.acknowledge}
                  </button>
                </td>
              </tr>
            ))}
            {!logs.length && !loading ? (
              <tr>
                <td colSpan={8}>{copy.noLogs}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
