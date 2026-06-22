import { CampaignAdminActions } from '@/components/admin/campaign-admin-actions';
import { CampaignsTable } from '@/components/admin/campaigns-table';
import { DataSourceBanner } from '@/components/admin/data-source-banner';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatusBadge } from '@/components/ui/status-badge';
import { loadIntegratedCampaignWorkspace } from '@/lib/api/admin-server';

export default async function CampaignsPage() {
  const result = await loadIntegratedCampaignWorkspace();
  const selected = result.data.workspace.selectedCampaign;

  return (
    <PortalShell currentPath="/portal/notifications/campaigns">
      <DataSourceBanner source={result.source} error={result.error} />

      <div className="page-header">
        <div>
          <h2>Notifications / campaigns</h2>
          <p>Manage operational campaigns, segment targeting, legal-approved templates, and channel-aware send scheduling.</p>
        </div>
        <div className="inline-actions">
          <button className="button secondary">Preview campaign</button>
          <button className="button secondary">Pause campaign</button>
          <button className="button primary">Schedule campaign</button>
        </div>
      </div>

      <div className="grid-3">
        {result.data.workspace.summary.map((item) => (
          <div key={item.label} className="card">
            <h3 className="section-title">{item.label}</h3>
            <div className="kpi-value">{item.value}</div>
            <p className="muted">{item.detail}</p>
          </div>
        ))}
      </div>

      <div className="grid-2-balanced">
        <div className="stack-lg">
          <CampaignsTable items={result.data.items} />

          <div className="card">
            <h3 className="section-title">Approval and delivery watch</h3>
            <div className="metric-list">
              {result.data.workspace.deliveryWatch.map((item) => (
                <div key={item.label} className="metric-item">
                  <div>
                    <div style={{ fontWeight: 700 }}>{item.label}</div>
                    <div className="muted">{item.note}</div>
                  </div>
                  <div>{item.count}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="stack-lg">
          <div className="card">
            <div className="page-header" style={{ marginBottom: 16 }}>
              <div>
                <h3 className="section-title" style={{ marginBottom: 6 }}>Selected campaign</h3>
                <div style={{ fontWeight: 700, fontSize: 22 }}>{selected.campaignName}</div>
              </div>
              <StatusBadge tone="warning">{selected.approvalState}</StatusBadge>
            </div>
            <div className="metric-list">
              <div className="metric-item"><div>Segment</div><div>{selected.segment}</div></div>
              <div className="metric-item"><div>Channel</div><div>{selected.channel}</div></div>
              <div className="metric-item"><div>Owner</div><div>{selected.owner}</div></div>
              <div className="metric-item"><div>Send window</div><div>{selected.sendWindow}</div></div>
            </div>
            <div className="banner warning" style={{ marginTop: 16 }}>{selected.blocker}</div>
          </div>

          <div className="card">
            <h3 className="section-title">Copy and targeting checks</h3>
            <ul className="simple-list">
              {selected.checks.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="inline-actions" style={{ marginTop: 16 }}>
              {selected.actions.map((action) => (
                <button key={action} className={action === 'Schedule campaign' ? 'button primary' : 'button secondary'}>{action}</button>
              ))}
            </div>
          </div>

          {result.data.selectedCampaignId ? <CampaignAdminActions campaignId={result.data.selectedCampaignId} disabled={result.source !== 'api'} /> : null}

          <div className="card">
            <h3 className="section-title">Campaign guardrails</h3>
            <ul className="simple-list muted">
              {selected.guardrails.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="card">
            <h3 className="section-title">Recent send outcomes</h3>
            <ul className="simple-list muted">
              {result.data.workspace.recentOutcomes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
