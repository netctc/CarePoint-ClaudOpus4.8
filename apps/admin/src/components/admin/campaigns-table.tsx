import { StatusBadge } from '@/components/ui/status-badge';
import type { CampaignContract } from '@/lib/api/contracts/admin';

function toneForApproval(status: CampaignContract['approvalState']): 'success' | 'warning' | 'neutral' {
  switch (status) {
    case 'Approved':
      return 'success';
    case 'Needs legal review':
      return 'warning';
    default:
      return 'neutral';
  }
}

function toneForRun(status: CampaignContract['runState']): 'info' | 'warning' | 'success' {
  switch (status) {
    case 'Scheduled':
      return 'info';
    case 'Paused':
      return 'warning';
    default:
      return 'success';
  }
}

export function CampaignsTable({ items }: { items: CampaignContract[] }) {
  return (
    <div className="card table-wrap">
      <div className="toolbar">
        <div className="toolbar-group">
          <label className="label" style={{ minWidth: 220 }}>
            Search campaigns
            <input className="input" defaultValue="" placeholder="Campaign or segment" />
          </label>
          <label className="label">
            Channel
            <select className="select" defaultValue="All">
              <option>All</option>
              <option>In-App</option>
              <option>SMS</option>
              <option>Push</option>
              <option>Email</option>
            </select>
          </label>
          <label className="label">
            Approval
            <select className="select" defaultValue="All">
              <option>All</option>
              <option>Approved</option>
              <option>Needs legal review</option>
              <option>Draft</option>
            </select>
          </label>
        </div>
        <div className="inline-actions">
          <button className="button secondary">Preview copy</button>
          <button className="button secondary">Pause selected</button>
          <button className="button primary">Schedule blast</button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Campaign</th>
            <th>Segment</th>
            <th>Channel</th>
            <th>Approval</th>
            <th>Run state</th>
            <th>Admin action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <div style={{ fontWeight: 700 }}>{item.campaignName}</div>
                <div className="muted">Approved templates and scheduling workflow</div>
              </td>
              <td>{item.segment}</td>
              <td>{item.channel}</td>
              <td><StatusBadge tone={toneForApproval(item.approvalState)}>{item.approvalState}</StatusBadge></td>
              <td><StatusBadge tone={toneForRun(item.runState)}>{item.runState}</StatusBadge></td>
              <td>
                <div className="inline-actions">
                  <button className="button secondary">Inspect</button>
                  <button className="button secondary">Approve</button>
                  <button className="button primary">Schedule</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
