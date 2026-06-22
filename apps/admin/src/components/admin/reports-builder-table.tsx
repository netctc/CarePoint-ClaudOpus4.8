import { StatusBadge } from '@/components/ui/status-badge';
import type { ReportDefinitionContract } from '@/lib/api/contracts/admin';

function toneForStatus(status: ReportDefinitionContract['status']): 'warning' | 'info' | 'success' {
  switch (status) {
    case 'Scheduled':
      return 'info';
    case 'Last run complete':
      return 'success';
    default:
      return 'warning';
  }
}

export function ReportsBuilderTable({ items }: { items: ReportDefinitionContract[] }) {
  return (
    <div className="card table-wrap">
      <div className="toolbar">
        <div className="toolbar-group">
          <label className="label" style={{ minWidth: 220 }}>
            Search reports
            <input className="input" defaultValue="" placeholder="Report name or domain" />
          </label>
          <label className="label">
            Domain
            <select className="select" defaultValue="All">
              <option>All</option>
              <option>Operations</option>
              <option>Provider operations</option>
              <option>Finance</option>
            </select>
          </label>
          <label className="label">
            Status
            <select className="select" defaultValue="All">
              <option>All</option>
              <option>Draft</option>
              <option>Scheduled</option>
              <option>Last run complete</option>
            </select>
          </label>
        </div>
        <div className="inline-actions">
          <button className="button secondary">Clone definition</button>
          <button className="button secondary">Export results</button>
          <button className="button primary">Run selected</button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Report</th>
            <th>Domain</th>
            <th>Scope</th>
            <th>Schedule</th>
            <th>Status</th>
            <th>Admin action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <div style={{ fontWeight: 700 }}>{item.reportName}</div>
                <div className="muted">Saved definition with governed delivery controls</div>
              </td>
              <td>{item.domain}</td>
              <td>{item.dataScope}</td>
              <td>{item.schedule}</td>
              <td><StatusBadge tone={toneForStatus(item.status)}>{item.status}</StatusBadge></td>
              <td>
                <div className="inline-actions">
                  <button className="button secondary">Inspect</button>
                  <button className="button secondary">Schedule</button>
                  <button className="button primary">Run</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
