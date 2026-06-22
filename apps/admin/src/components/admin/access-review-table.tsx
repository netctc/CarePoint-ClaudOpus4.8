import { StatusBadge } from '@/components/ui/status-badge';
import type { AccessGrantContract } from '@/lib/api/contracts/admin';

function toneForReview(status: AccessGrantContract['accessReview']): 'warning' | 'success' | 'danger' {
  switch (status) {
    case 'Certified':
      return 'success';
    case 'Expired':
      return 'danger';
    default:
      return 'warning';
  }
}

function toneForMfa(status: AccessGrantContract['mfaStatus']): 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'Enabled':
      return 'success';
    case 'Pending':
      return 'warning';
    default:
      return 'danger';
  }
}

export function AccessReviewTable({ items }: { items: AccessGrantContract[] }) {
  return (
    <div className="card table-wrap admin-v17-functional-table admin-v18-functional-table">
      <div className="toolbar admin-v18-table-toolbar">
        <div className="toolbar-group">
          <label className="label" style={{ minWidth: 220 }}>
            Search admins
            <input className="input" defaultValue="" placeholder="User, role, or scope" />
          </label>
          <label className="label">
            Review state
            <select className="select" defaultValue="All">
              <option>All</option>
              <option>Due</option>
              <option>Certified</option>
              <option>Expired</option>
            </select>
          </label>
          <label className="label">
            MFA
            <select className="select" defaultValue="All">
              <option>All</option>
              <option>Enabled</option>
              <option>Pending</option>
              <option>Bypassed</option>
            </select>
          </label>
        </div>
        <div className="inline-actions">
          <button className="button secondary">Export grants</button>
          <button className="button secondary">Queue certification</button>
          <button className="button primary">Grant role</button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Grant scope</th>
            <th>MFA</th>
            <th>Access review</th>
            <th>Admin action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td style={{ fontWeight: 700 }}>{item.userName}</td>
              <td>{item.role}</td>
              <td>{item.grantScope}</td>
              <td><StatusBadge tone={toneForMfa(item.mfaStatus)}>{item.mfaStatus}</StatusBadge></td>
              <td><StatusBadge tone={toneForReview(item.accessReview)}>{item.accessReview}</StatusBadge></td>
              <td>
                <div className="inline-actions">
                  <button className="button secondary">Certify</button>
                  <button className="button secondary">Restrict</button>
                  <button className="button primary">Open grant</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
