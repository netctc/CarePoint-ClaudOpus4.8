import { StatusBadge } from '@/components/ui/status-badge';
import type { BookingControlItemContract } from '@/lib/api/contracts/admin';
import { formatUtcDateTime } from '@/lib/formatters';

function statusTone(status: BookingControlItemContract['status']) {
  if (status === 'Scheduled') return 'info';
  if (status === 'Delayed') return 'warning';
  if (status === 'Escalated') return 'danger';
  return 'neutral';
}

function slaTone(state: BookingControlItemContract['slaState']) {
  if (state === 'On track') return 'success';
  if (state === 'At risk') return 'warning';
  return 'danger';
}

export function BookingControlTable({ items }: { items: BookingControlItemContract[] }) {
  return (
    <div className="card table-wrap">
      <div className="toolbar">
        <div className="toolbar-group">
          <label className="label" style={{ minWidth: 220 }}>
            Search bookings
            <input className="input" defaultValue="" placeholder="Booking ref, patient, provider" />
          </label>
          <label className="label">
            Status
            <select className="select" defaultValue="All">
              <option>All</option>
              <option>Scheduled</option>
              <option>Delayed</option>
              <option>Escalated</option>
              <option>Cancelled</option>
            </select>
          </label>
          <label className="label">
            SLA state
            <select className="select" defaultValue="All">
              <option>All</option>
              <option>On track</option>
              <option>At risk</option>
              <option>Breached</option>
            </select>
          </label>
        </div>
        <div className="inline-actions">
          <button className="button secondary">Bulk notify</button>
          <button className="button secondary">Export exceptions</button>
          <button className="button primary">Open rebooking queue</button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Booking</th>
            <th>Schedule</th>
            <th>Status</th>
            <th>SLA</th>
            <th>Owner</th>
            <th>Impact</th>
            <th>Admin action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <div style={{ fontWeight: 700 }}>{item.bookingRef}</div>
                <div className="muted">
                  {item.patientName} · {item.providerName}
                </div>
                <div className="muted">
                  {item.channel} · {item.city}
                </div>
              </td>
              <td>
                <div>{formatUtcDateTime(item.scheduledAt)}</div>
                <div className="muted">{item.incidentTag ?? 'No active incident tag'}</div>
              </td>
              <td>
                <StatusBadge tone={statusTone(item.status)}>{item.status}</StatusBadge>
              </td>
              <td>
                <div style={{ marginBottom: 8 }}>
                  <StatusBadge tone={slaTone(item.slaState)}>{item.slaState}</StatusBadge>
                </div>
                <div className="muted">{item.nextAction}</div>
              </td>
              <td>{item.adminOwner}</td>
              <td style={{ minWidth: 240 }}>{item.downstreamImpact}</td>
              <td>
                <div className="inline-actions">
                  <button className="button secondary">Override</button>
                  <button className="button secondary">Reassign</button>
                  <button className="button primary">Open detail</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
