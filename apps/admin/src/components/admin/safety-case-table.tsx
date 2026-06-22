import Link from 'next/link';
import { StatusBadge } from '@/components/ui/status-badge';
import type { SafetyCaseContract } from '@/lib/api/contracts/admin';
import { formatUtcDateTime } from '@/lib/formatters';

function severityTone(severity: SafetyCaseContract['severity']) {
  if (severity === 'Minor') return 'info';
  if (severity === 'Major') return 'warning';
  return 'danger';
}

function statusTone(status: SafetyCaseContract['status']) {
  if (status === 'Closed') return 'success';
  if (status === 'Escalated' || status === 'Pending approval') return 'warning';
  return 'info';
}

export function SafetyCaseTable({ items }: { items: SafetyCaseContract[] }) {
  return (
    <div className="card table-wrap">
      <div className="toolbar">
        <div className="toolbar-group">
          <label className="label" style={{ minWidth: 220 }}>
            Search cases
            <input className="input" defaultValue="" placeholder="Case ref, source, investigator" />
          </label>
          <label className="label">
            Severity
            <select className="select" defaultValue="All">
              <option>All</option>
              <option>Minor</option>
              <option>Major</option>
              <option>Critical</option>
            </select>
          </label>
          <label className="label">
            Status
            <select className="select" defaultValue="All">
              <option>All</option>
              <option>Open</option>
              <option>Escalated</option>
              <option>Pending approval</option>
              <option>Closed</option>
            </select>
          </label>
        </div>
        <div className="inline-actions">
          <button className="button secondary">Export packet</button>
          <button className="button secondary">Assign investigator</button>
          <button className="button primary">Create safety case</button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Case</th>
            <th>Severity</th>
            <th>Status</th>
            <th>Investigator</th>
            <th>Next review</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <div style={{ fontWeight: 800 }}>{item.caseRef}</div>
                <div className="muted">{item.summary}</div>
                <div className="muted">{item.linkedSource}</div>
              </td>
              <td><StatusBadge tone={severityTone(item.severity)}>{item.severity}</StatusBadge></td>
              <td><StatusBadge tone={statusTone(item.status)}>{item.status}</StatusBadge></td>
              <td>{item.investigator}</td>
              <td>{formatUtcDateTime(item.nextReviewAt)}</td>
              <td>
                <Link className="button secondary" href={`/portal/safety/incidents/${item.id}`}>
                  Open case
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
