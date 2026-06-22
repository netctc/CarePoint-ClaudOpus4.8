import Link from 'next/link';
import { cookies } from 'next/headers';
import { DataSourceBanner } from '@/components/admin/data-source-banner';
import { TelehealthOpsActions } from '@/components/admin/telehealth-ops-actions';
import { TelehealthOpsTable } from '@/components/admin/telehealth-ops-table';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatusBadge } from '@/components/ui/status-badge';
import { loadIntegratedTelehealthWorkspace } from '@/lib/api/admin-server';
import { getAdminPortalCopy } from '@/lib/i18n/admin-portal-copy';
import { normalizeAdminLocale } from '@/lib/i18n/admin-dictionary';

function toneForState(state: string) {
  if (state === 'Healthy') return 'success';
  if (state === 'Degraded') return 'warning';
  return 'danger';
}

export default async function TelehealthOperationsPage() {
  const cookieStore = await cookies();
  const locale = normalizeAdminLocale(cookieStore.get('cc_locale')?.value);
  const copy = getAdminPortalCopy(locale).telehealthOps;
  const result = await loadIntegratedTelehealthWorkspace();
  const selected = result.data.workspace.selectedSession;
  const selectedItem = result.data.items.find((item) => item.sessionRef === selected.sessionRef) || result.data.items[0];

  return (
    <PortalShell currentPath="/portal/telehealth/operations">
      <DataSourceBanner source={result.source} error={result.error} />

      <div className="hero-panel">
        <div className="hero-panel-grid">
          <div className="hero-copy">
            <div className="page-eyebrow">{copy.eyebrow}</div>
            <h2 className="hero-title">{copy.title}</h2>
            <p className="hero-subtitle">
              {copy.subtitle}
            </p>
            <div className="hero-actions">
              <Link className="button primary" href={selectedItem ? `/portal/telehealth/operations/${selectedItem.id}` : '/portal/telehealth/operations'}>{copy.openIncident}</Link>
              <button className="button secondary">{copy.exportMonitor}</button>
            </div>
            <div className="hero-metrics">
              {result.data.workspace.summary.map((item) => (
                <div key={item.label} className="hero-metric">
                  <div className="hero-metric-label">{item.label}</div>
                  <div className="hero-metric-value">{item.value}</div>
                  <div className="hero-metric-detail">{item.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="info-stack">
            <div className="soft-card">
              <div className="panel-header">
                <div>
                  <h3 className="section-title" style={{ marginBottom: 6 }}>{copy.selectedSession}</h3>
                  <div style={{ fontWeight: 800, fontSize: 22 }}>{selected.sessionRef}</div>
                </div>
                <StatusBadge tone={toneForState(selected.state)}>{selected.state}</StatusBadge>
              </div>
              <div className="detail-list">
                <div><span className="detail-label">{copy.roomState}</span><strong>{selected.roomState}</strong></div>
                <div><span className="detail-label">{copy.issueOwner}</span><strong>{selected.issueOwner}</strong></div>
                <div><span className="detail-label">{copy.region}</span><strong>{selected.region}</strong></div>
              </div>
            </div>
            <div className="mini-card">
              <h3 className="section-title">{copy.failureTrend}</h3>
              <div className="list-stack">
                {result.data.workspace.failureTrends.map((item) => (
                  <div key={item.label} className="list-row">
                    <div>
                      <div className="list-row-title">{item.label}</div>
                      <div className="muted">{item.detail}</div>
                    </div>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <TelehealthOpsTable items={result.data.items} />

      <div className="split-shell">
        <div className="info-stack">
          <div className="card">
            <h3 className="section-title">{copy.exceptionQueue}</h3>
            <ul className="data-points muted">
              {result.data.workspace.exceptionQueue.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="info-stack">
          {result.data.selectedSessionId ? <TelehealthOpsActions sessionId={result.data.selectedSessionId} disabled={result.source !== 'api'} /> : null}
          <div className="card">
            <h3 className="section-title">{copy.monitoringGuardrails}</h3>
            <ul className="data-points muted">
              {selected.guardrails.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}