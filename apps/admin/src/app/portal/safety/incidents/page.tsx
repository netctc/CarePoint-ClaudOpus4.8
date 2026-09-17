import Link from 'next/link';
import { DataSourceBanner } from '@/components/admin/data-source-banner';
import { SafetyAdminActions } from '@/components/admin/safety-admin-actions';
import { SafetyCaseTable } from '@/components/admin/safety-case-table';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatusBadge } from '@/components/ui/status-badge';
import { loadClinicalAccessExceptions, loadIntegratedSafetyWorkspace, loadRefillOperationalEvents, loadRefillRequests } from '@/lib/api/admin-server';

function tone(severity: string) {
  if (severity === 'Minor') return 'info';
  if (severity === 'Major') return 'warning';
  return 'danger';
}

export default async function SafetyIncidentsPage() {
  const [result, accessResult, refillResult, refillEventResult] = await Promise.all([loadIntegratedSafetyWorkspace(), loadClinicalAccessExceptions(), loadRefillRequests(), loadRefillOperationalEvents()]);
  const selected = result.data.items.find((item) => item.id === result.data.selectedCaseId) ?? result.data.items[0];

  return (
    <PortalShell currentPath="/portal/safety/incidents">
      <DataSourceBanner source={result.source} error={result.error} />

      <div className="hero-panel">
        <div className="hero-panel-grid">
          <div className="hero-copy">
            <div className="page-eyebrow">A-13 · Safety cases</div>
            <h2 className="hero-title">Safety case workspace redesigned for triage, evidence collection, and controlled closure</h2>
            <p className="hero-subtitle">
              This wave reframes safety operations as a dedicated governance surface: severity, approval posture, linked operational evidence, and case detail are visible before any closure decision is taken.
            </p>
            <div className="hero-actions">
              <Link className="button primary" href={selected ? `/portal/safety/incidents/${selected.id}` : '/portal/safety/incidents'}>Open selected case</Link>
              <button className="button secondary">Request dual approval</button>
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
                  <h3 className="section-title" style={{ marginBottom: 6 }}>Selected safety case</h3>
                  <div style={{ fontWeight: 800, fontSize: 22 }}>{selected?.caseRef || 'No case selected'}</div>
                </div>
                {selected ? <StatusBadge tone={tone(selected.severity)}>{selected.severity}</StatusBadge> : null}
              </div>
              <div className="detail-list">
                <div><span className="detail-label">Status</span><strong>{selected?.status || '—'}</strong></div>
                <div><span className="detail-label">Investigator</span><strong>{selected?.investigator || '—'}</strong></div>
                <div><span className="detail-label">Source</span><strong>{selected?.linkedSource || '—'}</strong></div>
              </div>
            </div>

            <div className="mini-card">
              <h3 className="section-title">Closure posture</h3>
              <div className="banner warning">{selected?.dualApprovalRequired ? 'Dual approval required before closure.' : 'Single-review closure path is permitted.'}</div>
            </div>
          </div>
        </div>
      </div>

      <SafetyCaseTable items={result.data.items} />

      <div className="split-shell">
        <div className="info-stack">
          <div className="card">
            <h3 className="section-title">Active work queues</h3>
            <ul className="data-points muted">
              {result.data.workspace.workQueues.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="card">
            <h3 className="section-title">Active chart access exceptions</h3>
            {!accessResult.data.length ? <p className="muted">No temporary care-team access exceptions are active.</p> : null}
            <ul className="data-points muted">
              {accessResult.data.slice(0, 5).map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong> — {item.detail}. {item.note} ({item.expiresAt})
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="info-stack">
          {result.data.selectedCaseId ? <SafetyAdminActions caseId={result.data.selectedCaseId} disabled={result.source !== 'api'} /> : null}

          <div className="card">
            <h3 className="section-title">Operational evidence feeds</h3>
            <ul className="data-points muted">
              {refillResult.data.slice(0, 3).map((item) => (
                <li key={item.id}><strong>{item.title}</strong> — {item.detail}. Routing: {item.routing}. Owner: {item.assignedRole}.</li>
              ))}
              {refillEventResult.data.slice(0, 3).map((item) => (
                <li key={item.id}><strong>{item.title}</strong> — {item.detail}. Queue: {item.queue}. Actor: {item.actorRole}.</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
