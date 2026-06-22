import { DataSourceBanner } from '@/components/admin/data-source-banner';
import { ReportAdminActions } from '@/components/admin/report-admin-actions';
import { ReportsBuilderTable } from '@/components/admin/reports-builder-table';
import { RefillAuditExportActions } from '@/components/admin/refill-audit-export-actions';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatusBadge } from '@/components/ui/status-badge';
import { loadIntegratedReportsWorkspace, loadRefillAuditScopeUsage } from '@/lib/api/admin-server';

export default async function ReportsBuilderPage() {
  const [result, scopeUsageResult] = await Promise.all([loadIntegratedReportsWorkspace(), loadRefillAuditScopeUsage()]);
  const selected = result.data.workspace.selectedReport;

  return (
    <PortalShell currentPath="/portal/reports/builder">
      <DataSourceBanner source={result.source} error={result.error} />

      <div className="cp-admin-density-flow cp-report-builder-flow">
      <div className="page-header">
        <div>
          <h2>Reports & KPI builder</h2>
          <p>Create operational reports, save governed views, schedule recurring runs, and export aggregate KPI packs.</p>
        </div>
        <div className="inline-actions">
          <button className="button secondary">Save definition</button>
          <button className="button secondary">Schedule delivery</button>
          <button className="button primary">Run report</button>
        </div>
      </div>

      <div className="grid-3 cp-density-kpi-strip">
        {result.data.workspace.summary.map((item) => (
          <div key={item.label} className="card">
            <h3 className="section-title">{item.label}</h3>
            <div className="kpi-value">{item.value}</div>
            <p className="muted">{item.detail}</p>
          </div>
        ))}
      </div>

      {result.data.workspace.refillMetrics?.length ? (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="page-header" style={{ marginBottom: 16 }}>
            <div>
              <h3 className="section-title">Refill KPI spotlight</h3>
              <p className="muted">Live refill queue metrics from the current preview run.</p>
            </div>
            <StatusBadge tone="warning">Preview run</StatusBadge>
          </div>
          <div className="grid-3">
            {result.data.workspace.refillMetrics.map((metric) => (
              <div key={metric.label} className="card">
                <h4 className="section-title" style={{ marginBottom: 6 }}>{metric.label}</h4>
                <div className="kpi-value">{metric.value}</div>
                <p className="muted">{metric.detail}</p>
              </div>
            ))}
          </div>
          {result.data.workspace.refillInsights?.length ? (
            <ul className="simple-list muted" style={{ marginTop: 16 }}>
              {result.data.workspace.refillInsights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}


      {result.data.workspace.savedRefillPresets?.length ? (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="page-header" style={{ marginBottom: 16 }}>
            <div>
              <h3 className="section-title">Saved refill export presets</h3>
              <p className="muted">Reusable admin-defined KPI packs captured from the live report controls.</p>
            </div>
            <StatusBadge tone="success">Saved definitions</StatusBadge>
          </div>
          <div className="grid-3">
            {result.data.workspace.savedRefillPresets.map((preset) => (
              <div key={preset.id} className="card">
                <h4 className="section-title" style={{ marginBottom: 6 }}>{preset.title}</h4>
                <div className="muted" style={{ marginBottom: 8 }}>{preset.metricCount} • {preset.format} • {preset.subjectScope ?? 'All'}</div>
                <p className="muted">{preset.description}</p>
                <p className="muted" style={{ marginTop: 8 }}>Updated {preset.updatedAt}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {result.data.workspace.deliverySchedules?.length ? (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="page-header" style={{ marginBottom: 16 }}>
            <div>
              <h3 className="section-title">Scheduled refill KPI deliveries</h3>
              <p className="muted">Governed delivery targets saved from the live export workflow.</p>
            </div>
            <StatusBadge tone="info">Delivery schedules</StatusBadge>
          </div>
          <div className="metric-list">
            {result.data.workspace.deliverySchedules.map((item) => (
              <div key={item.id} className="metric-item">
                <div>
                  <div style={{ fontWeight: 700 }}>{item.title}</div>
                  <div className="muted">{item.destination} • {item.schedule} • {item.format} • {item.subjectScope ?? 'All'}</div>
                  <div className="muted">Last run: {item.lastRunAt} • {item.lastRunStatus}</div>
                  <div className="muted">{item.lastRunSummary}</div>
                </div>
                <div className="muted">Updated {item.updatedAt}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}


      {result.data.workspace.deliveryExecutions?.length ? (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="page-header" style={{ marginBottom: 16 }}>
            <div>
              <h3 className="section-title">Recent delivery executions</h3>
              <p className="muted">Last-run status and output summaries for scheduled refill KPI packs.</p>
            </div>
            <StatusBadge tone="info">Execution history</StatusBadge>
          </div>
          <div className="metric-list">
            {result.data.workspace.deliveryExecutions.map((item) => (
              <div key={item.id} className="metric-item">
                <div>
                  <div style={{ fontWeight: 700 }}>{item.title}</div>
                  <div className="muted">{item.destination} • {item.trigger} • {item.status} • {item.subjectScope ?? 'All'}</div>
                  <div className="muted">{item.summary}</div>
                </div>
                <div className="muted">{item.executedAt}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {result.data.workspace.refillPresets?.length ? (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="page-header" style={{ marginBottom: 16 }}>
            <div>
              <h3 className="section-title">Refill KPI export presets</h3>
              <p className="muted">Reusable preset packs for refill aging and controlled-medication reporting.</p>
            </div>
            <StatusBadge tone="info">Live presets</StatusBadge>
          </div>
          <div className="grid-3">
            {result.data.workspace.refillPresets.map((preset) => (
              <div key={preset.id} className="card">
                <h4 className="section-title" style={{ marginBottom: 6 }}>{preset.title}</h4>
                <div className="muted" style={{ marginBottom: 8 }}>{preset.metricCount}</div>
                <p className="muted">{preset.description}</p>
              </div>
            ))}
          </div>
          {result.data.workspace.exportRecommendations?.length ? (
            <ul className="simple-list muted" style={{ marginTop: 16 }}>
              {result.data.workspace.exportRecommendations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {scopeUsageResult.data.length ? (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="page-header" style={{ marginBottom: 16 }}>
            <div>
              <h3 className="section-title">Governed refill scope library</h3>
              <p className="muted">Saved governed export scopes now surface in the report builder so KPI packs can align to an approved audit slice.</p>
            </div>
            <StatusBadge tone="info">Scope usage</StatusBadge>
          </div>
          <div className="grid-3">
            {scopeUsageResult.data.slice(0, 6).map((item) => (
              <div key={item.id} className="card">
                <h4 className="section-title" style={{ marginBottom: 6 }}>{item.title}</h4>
                <div className="muted" style={{ marginBottom: 8 }}>{item.filters.join(' • ') || 'All governed refill activity'}</div>
                <p className="muted">Export ready: {item.summary.exportReadyCount} • Escalations: {item.summary.escalationCount} • Controlled events: {item.summary.controlledMedicationEvents}</p>
                <p className="muted">Failed deliveries: {item.summary.failedDeliveryCount} • Delivery executions: {item.summary.deliveryExecutionCount}</p>
                <p className="muted">{item.latestExecution ? `${item.latestExecution.status} at ${item.latestExecution.executedAt}` : 'No execution recorded yet.'}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="grid-2-balanced cp-report-density-shell">
        <div className="stack-lg">
          <ReportsBuilderTable items={result.data.items} />

          <div className="card">
            <h3 className="section-title">Saved delivery packs</h3>
            <div className="metric-list">
              {result.data.workspace.deliveryPacks.map((item) => (
                <div key={item.label} className="metric-item">
                  <div>
                    <div style={{ fontWeight: 700 }}>{item.label}</div>
                    <div className="muted">{item.detail}</div>
                  </div>
                  <div>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="stack-lg">
          <div className="card">
            <div className="page-header" style={{ marginBottom: 16 }}>
              <div>
                <h3 className="section-title" style={{ marginBottom: 6 }}>Selected report</h3>
                <div style={{ fontWeight: 700, fontSize: 22 }}>{selected.reportName}</div>
              </div>
              <StatusBadge tone="info">{selected.status}</StatusBadge>
            </div>
            <div className="metric-list">
              <div className="metric-item"><div>Domain</div><div>{selected.domain}</div></div>
              <div className="metric-item"><div>Owner</div><div>{selected.owner}</div></div>
              <div className="metric-item"><div>Schedule</div><div>{selected.schedule}</div></div>
              <div className="metric-item"><div>Audience</div><div>{selected.audience}</div></div>
            </div>
            <div className="banner info" style={{ marginTop: 16 }}>{selected.scopeNote}</div>
          </div>

          <div className="card">
            <h3 className="section-title">Metrics and breakdowns</h3>
            <ul className="simple-list">
              {selected.metrics.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="inline-actions" style={{ marginTop: 16 }}>
              {selected.actions.map((action) => (
                <button key={action} className={action === 'Run report now' ? 'button primary' : 'button secondary'}>{action}</button>
              ))}
            </div>
          </div>

          {result.data.selectedReportId ? <ReportAdminActions reportId={result.data.selectedReportId} disabled={result.source !== 'api'} /> : null}

          <RefillAuditExportActions />

          <div className="card">
            <h3 className="section-title">Builder guardrails</h3>
            <ul className="simple-list muted">
              {selected.guardrails.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="card">
            <h3 className="section-title">Export and distribution queue</h3>
            <ul className="simple-list muted">
              {result.data.workspace.exportQueue.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      </div>
    </PortalShell>
  );
}
