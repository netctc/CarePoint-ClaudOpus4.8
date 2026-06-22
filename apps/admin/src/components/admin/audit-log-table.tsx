import { StatusBadge } from '@/components/ui/status-badge';
import type { AuditLogContract } from '@/lib/api/contracts/admin';
import { formatUtcDateTime } from '@/lib/formatters';

function toneForOutcome(outcome: AuditLogContract['outcome']): 'success' | 'danger' | 'warning' {
  switch (outcome) {
    case 'Success':
      return 'success';
    case 'Denied':
      return 'danger';
    default:
      return 'warning';
  }
}

export function AuditLogTable({ items }: { items: AuditLogContract[] }) {
  return (
    <div className="card table-wrap">
      <div className="toolbar">
        <div className="toolbar-group">
          <label className="label" style={{ minWidth: 220 }}>
            Search events
            <input className="input" defaultValue="" placeholder="Actor, action, target, or purpose" />
          </label>
          <label className="label">
            Outcome
            <select className="select" defaultValue="All">
              <option>All</option>
              <option>Success</option>
              <option>Denied</option>
              <option>Escalated</option>
            </select>
          </label>
          <label className="label">
            Domain
            <select className="select" defaultValue="All">
              <option>All</option>
              <option>RBAC</option>
              <option>Finance</option>
              <option>Operations</option>
            </select>
          </label>
        </div>
        <div className="inline-actions">
          <button className="button secondary">Save view</button>
          <button className="button secondary">Export packet</button>
          <button className="button primary">Open evidence</button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Target</th>
            <th>Purpose</th>
            <th>Outcome</th>
            <th>Admin action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{formatUtcDateTime(item.timestamp)}</td>
              <td>{item.actor}</td>
              <td style={{ fontWeight: 700 }}>{item.action}</td>
              <td>{item.target}</td>
              <td>{item.purpose}</td>
              <td><StatusBadge tone={toneForOutcome(item.outcome)}>{item.outcome}</StatusBadge></td>
              <td>
                <div className="inline-actions">
                  <button className="button secondary">Annotate</button>
                  <button className="button secondary">Correlate</button>
                  <button className="button primary">Open event</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
