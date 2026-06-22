'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { providerApi } from '@/services/api-client';
import { getAlertData } from '@/services/mock-api';
import { useProviderLocale } from '@/components/i18n/provider-locale-provider';
import { getProviderPortalCopy } from '@/lib/i18n/provider-portal-copy';

export default function AlertsEscalationsPage() {
  const { locale, dir } = useProviderLocale();
  const copy = getProviderPortalCopy(locale).alerts;
  const fallback = useMemo(() => getAlertData(), []);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [source, setSource] = useState<'live' | 'fallback'>('fallback');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const result: any = await providerApi.providerAlerts();
      setAlerts(result.items ?? []);
      setSource('live');
    } catch (err) {
      setAlerts([]);
      setSource('fallback');
      setError(err instanceof Error ? err.message : copy.unableLoad);
    }
  }, [copy.unableLoad]);

  useEffect(() => {
    load();
  }, [load]);

  async function acknowledge(alertId: string) {
    try {
      await providerApi.acknowledgeProviderAlert(alertId, 'Acknowledged from provider alert queue');
      setMessage(copy.acknowledged);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableAck);
    }
  }

  async function resolve(alertId: string) {
    try {
      await providerApi.resolveProviderAlert(alertId, 'Resolved from provider alert queue');
      setMessage(copy.resolved);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableResolve);
    }
  }

  const rows = source === 'live' && alerts.length ? alerts : fallback;

  return (
    <div className="page-stack" dir={dir}>
      <section className="page-header split-header">
        <div>
          <span className="eyebrow">PR-20</span>
          <h1>{copy.title}</h1>
          <p className="muted">{copy.subtitle}</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={load}>{copy.refresh}</button>
        </div>
      </section>

      <div className={`banner ${source === 'live' ? 'banner-success' : 'banner-warning'}`}>
        <div>
          <strong>{source === 'live' ? copy.liveTitle : copy.fallbackTitle}</strong>
          <p className="muted small">{source === 'live' ? copy.liveText : `${copy.fallbackText} ${error ?? 'Unknown error'}.`}</p>
        </div>
        <span className={`status-chip status-${source === 'live' ? 'success' : 'warning'}`}>{source === 'live' ? 'Live' : 'Fallback'}</span>
      </div>

      {message ? <div className="status-chip status-success">{message}</div> : null}
      {error && source === 'live' ? <div className="status-chip status-danger">{error}</div> : null}

      <section className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>{copy.alert}</th>
              <th>{copy.source}</th>
              <th>{copy.severity}</th>
              <th>{copy.owner}</th>
              <th>{copy.sla}</th>
              <th>{copy.action}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((alert) => (
              <tr key={alert.id}>
                <td>
                  <strong>{alert.title}</strong>
                  <div className="muted small">{alert.detail}</div>
                </td>
                <td>{alert.source}</td>
                <td><span className={`status-chip status-${alert.variant}`}>{alert.severity}</span></td>
                <td>{alert.owner}</td>
                <td>{alert.sla}</td>
                <td>
                  <div className="inline-actions">
                    <button className="btn btn-secondary" onClick={() => acknowledge(alert.id)} disabled={source !== 'live'}>{copy.acknowledge}</button>
                    <button className="btn btn-secondary" onClick={() => resolve(alert.id)} disabled={source !== 'live'}>{copy.resolve}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
