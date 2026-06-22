import { StatusBadge } from '@/components/ui/status-badge';
import type { TelehealthOpsSessionContract } from '@/lib/api/contracts/admin';
import { formatUtcDateTime } from '@/lib/formatters';

function tone(state: TelehealthOpsSessionContract['state']) {
  if (state === 'Healthy') return 'success';
  if (state === 'Degraded') return 'warning';
  return 'danger';
}

function roomTone(state: TelehealthOpsSessionContract['roomState']) {
  if (state === 'Live') return 'success';
  if (state === 'Waiting room') return 'info';
  if (state === 'Reconnect loop') return 'warning';
  return 'neutral';
}

export function TelehealthOpsTable({ items }: { items: TelehealthOpsSessionContract[] }) {
  return (
    <div className="card table-wrap">
      <div className="toolbar">
        <div className="toolbar-group">
          <label className="label" style={{ minWidth: 220 }}>
            Search sessions
            <input className="input" defaultValue="" placeholder="Session ref, provider, region" />
          </label>
          <label className="label">
            Health state
            <select className="select" defaultValue="All">
              <option>All</option>
              <option>Healthy</option>
              <option>Degraded</option>
              <option>Failed</option>
            </select>
          </label>
          <label className="label">
            Room state
            <select className="select" defaultValue="All">
              <option>All</option>
              <option>Waiting room</option>
              <option>Live</option>
              <option>Reconnect loop</option>
              <option>Closed</option>
            </select>
          </label>
        </div>
        <div className="inline-actions">
          <button className="button secondary">Export monitor</button>
          <button className="button secondary">Open support handoff</button>
          <button className="button primary">Escalate technical incident</button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Session</th>
            <th>Room</th>
            <th>Health</th>
            <th>Failure rate</th>
            <th>Owner</th>
            <th>Metadata scope</th>
            <th>Support</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <div style={{ fontWeight: 700 }}>{item.sessionRef}</div>
                <div className="muted">{item.providerName} · {item.patientInitials}</div>
                <div className="muted">{item.region}</div>
              </td>
              <td>
                <div style={{ marginBottom: 8 }}>
                  <StatusBadge tone={roomTone(item.roomState)}>{item.roomState}</StatusBadge>
                </div>
                <div className="muted">{item.roomType}</div>
                <div className="muted">{formatUtcDateTime(item.lastHeartbeatAt)}</div>
              </td>
              <td>
                <StatusBadge tone={tone(item.state)}>{item.state}</StatusBadge>
              </td>
              <td>{item.failureRate}</td>
              <td>{item.issueOwner}</td>
              <td>{item.metadataAccess}</td>
              <td style={{ minWidth: 220 }}>
                <div className="muted" style={{ marginBottom: 10 }}>{item.supportHook}</div>
                <div className="inline-actions">
                  <button className="button secondary">Resolve issue</button>
                  <button className="button primary">Inspect metadata</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
