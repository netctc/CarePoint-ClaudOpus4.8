import { StatusBadge } from '@/components/ui/status-badge';
import type { IntegrationSettingContract } from '@/lib/api/contracts/admin';

function toneForStatus(status: IntegrationSettingContract['status']): 'success' | 'warning' | 'neutral' {
  switch (status) {
    case 'Enabled':
      return 'success';
    case 'Pending rotation':
      return 'warning';
    default:
      return 'neutral';
  }
}

function toneForSecret(status: IntegrationSettingContract['secretState']): 'neutral' | 'success' | 'warning' {
  switch (status) {
    case 'Rotated recently':
      return 'success';
    case 'Review required':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function IntegrationsTable({ items }: { items: IntegrationSettingContract[] }) {
  return (
    <div className="card table-wrap">
      <div className="toolbar">
        <div className="toolbar-group">
          <label className="label" style={{ minWidth: 220 }}>
            Search integrations
            <input className="input" defaultValue="" placeholder="Integration or category" />
          </label>
          <label className="label">
            Status
            <select className="select" defaultValue="All">
              <option>All</option>
              <option>Enabled</option>
              <option>Disabled</option>
              <option>Pending rotation</option>
            </select>
          </label>
          <label className="label">
            Secret state
            <select className="select" defaultValue="All">
              <option>All</option>
              <option>Masked</option>
              <option>Rotated recently</option>
              <option>Review required</option>
            </select>
          </label>
        </div>
        <div className="inline-actions">
          <button className="button secondary">Export settings</button>
          <button className="button secondary">Rotate credentials</button>
          <button className="button primary">Enable selected</button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Integration</th>
            <th>Category</th>
            <th>Status</th>
            <th>Secret state</th>
            <th>Last changed</th>
            <th>Admin action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <div style={{ fontWeight: 700 }}>{item.integrationName}</div>
                <div className="muted">Masked secret and environment-safe controls</div>
              </td>
              <td>{item.category}</td>
              <td><StatusBadge tone={toneForStatus(item.status)}>{item.status}</StatusBadge></td>
              <td><StatusBadge tone={toneForSecret(item.secretState)}>{item.secretState}</StatusBadge></td>
              <td>{item.lastChangedAt}</td>
              <td>
                <div className="inline-actions">
                  <button className="button secondary">Inspect</button>
                  <button className="button secondary">Rotate</button>
                  <button className="button primary">Save</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
