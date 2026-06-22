'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { EvidencePanel } from '@/components/shared/evidence-panel';
import { WorkspaceStateStrip } from '@/components/shared/workspace-state-strip';
import { StatCard } from '@/components/shared/stat-card';
import { providerApi } from '@/services/api-client';
import { getPerformanceAnalyticsData } from '@/services/mock-api';
import { useProviderLocale } from '@/components/i18n/provider-locale-provider';
import { getProviderPortalCopy } from '@/lib/i18n/provider-portal-copy';

export default function PerformanceAnalyticsPage() {
  const { locale, dir } = useProviderLocale();
  const copy = getProviderPortalCopy(locale).analytics;
  const fallback = useMemo(() => getPerformanceAnalyticsData(), []);
  const [overview, setOverview] = useState<any>(null);
  const [source, setSource] = useState<'live' | 'fallback'>('fallback');
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<string>('');

  const load = useCallback(async () => {
    try {
      setError(null);
      const result: any = await providerApi.providerAnalyticsOverview(location || undefined);
      setOverview(result);
      setSource('live');
    } catch (err) {
      setOverview(null);
      setSource('fallback');
      setError(err instanceof Error ? err.message : copy.unableLoad);
    }
  }, [copy.unableLoad, location]);

  useEffect(() => {
    load();
  }, [load]);

  const metrics = source === 'live' && overview?.metrics?.length ? overview.metrics : fallback.metrics;
  const utilization = source === 'live' && overview?.utilization?.length
    ? overview.utilization.map((item: any) => ({ ...item, value: Number(item.value ?? 0) }))
    : fallback.utilization;
  const satisfaction = source === 'live' && overview?.satisfaction?.length
    ? overview.satisfaction.map((item: any) => ({ ...item, value: Number(item.value ?? 0) }))
    : fallback.satisfaction;

  const facilityOptions = useMemo(() => {
    const summary = overview?.hspAccess ?? {};
    const items = [summary.primaryFacility, ...(summary.consentedFacilities ?? []), ...(summary.assignedFacilities ?? [])]
      .filter(Boolean)
      .map((item: any) => ({ label: item.name as string, value: item.name as string }));
    const deduped = new Map<string, { label: string; value: string }>();
    items.forEach((item: any) => {
      if (item?.value) deduped.set(item.value, item);
    });
    return Array.from(deduped.values());
  }, [overview]);
  const facilityBreakdown = source === 'live' && overview?.facilityBreakdown?.length ? overview.facilityBreakdown : [];

  return (
    <div className="page-stack" dir={dir}>
      <section className="page-header split-header">
        <div>
          <span className="eyebrow">PR-22</span>
          <h1>{copy.title}</h1>
          <p className="muted">{copy.subtitle}</p>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <select className="select" value={location} onChange={(event) => setLocation(event.target.value)}>
            <option value="">All accessible facilities</option>
            {facilityOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <button className="btn btn-secondary" onClick={load}>{copy.refresh}</button>
        </div>
      </section>

      <div className={`banner ${source === 'live' ? 'banner-success' : 'banner-warning'}`}>
        {location ? <span className="status-chip status-info">Facility: {location}</span> : null}
        <div>
          <strong>{source === 'live' ? copy.liveTitle : copy.fallbackTitle}</strong>
          <p className="muted small">{source === 'live' ? copy.liveText : `${copy.fallbackText} ${error ?? 'Unknown error'}.`}</p>
        </div>
        <span className={`status-chip status-${source === 'live' ? 'success' : 'warning'}`}>{source === 'live' ? 'Live' : 'Fallback'}</span>
      </div>

      <WorkspaceStateStrip
        items={[
          { label: copy.source, value: source === 'live' ? copy.providerApi : 'Fallback', tone: source === 'live' ? 'success' : 'warning' },
          { label: copy.metrics, value: String(metrics.length), tone: 'info' },
          { label: copy.utilizationBands, value: String(utilization.length), tone: 'info' },
          { label: copy.qualityMeasures, value: String(satisfaction.length), tone: 'success' },
        ]}
      />

      <section className="stats-grid">
        {metrics.map((metric: any) => (
          <StatCard key={metric.label} label={metric.label} value={String(metric.value)} detail={metric.detail} />
        ))}
      </section>

      {facilityBreakdown.length ? (
        <section className="panel-card">
          <div className="panel-header"><h2>Facility breakdown</h2></div>
          <div className="list-stack">
            {facilityBreakdown.map((item: any) => (
              <div key={item.location} className="list-row">
                <div>
                  <div className="list-row-title">{item.location}</div>
                  <div className="muted small">{item.external ? 'Consented external facility' : 'Assigned facility'}</div>
                </div>
                <span className="tag">{item.count}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="workspace-grid top-align-grid">
        <article className="panel-card">
          <div className="panel-header"><h2>{copy.utilizationTrend}</h2><span className="status-chip status-info">{copy.capacityView}</span></div>
          <div className="list-stack">
            {utilization.map((item: any) => (
              <div key={item.label} className="detail-list">
                <div>
                  <span className="detail-label">{item.label}</span>
                  <strong>{item.value}%</strong>
                  <div style={{ height: 10, borderRadius: 999, background: 'var(--secondary)', marginTop: 8 }}>
                    <div style={{ width: `${Math.max(0, Math.min(100, Number(item.value ?? 0)))}%`, height: '100%', borderRadius: 999, background: 'var(--primary)' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>

        <div className="workspace-side-stack">
          <EvidencePanel
            title={copy.qualityAndSentiment}
            badge={copy.providerView}
            items={satisfaction.map((item: any) => ({ title: item.label, detail: `${item.value}% ${copy.qualityTargetDetail}` }))}
          />
          <article className="panel-card">
            <div className="panel-header"><h2>{copy.howToUse}</h2></div>
            <div className="timeline-stack">
              <div className="timeline-step"><span className="detail-label">1</span><div><strong>{copy.step1Title}</strong><p className="muted small">{copy.step1Text}</p></div></div>
              <div className="timeline-step"><span className="detail-label">2</span><div><strong>{copy.step2Title}</strong><p className="muted small">{copy.step2Text}</p></div></div>
              <div className="timeline-step"><span className="detail-label">3</span><div><strong>{copy.step3Title}</strong><p className="muted small">{copy.step3Text}</p></div></div>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
