import Link from 'next/link';
import { StatusBadge } from '@/components/ui/status-badge';
import type { SupportTicketContract } from '@/lib/api/contracts/admin';

function statusTone(status: SupportTicketContract['status']): 'info' | 'warning' | 'success' {
  if (status === 'Resolved') return 'success';
  if (status === 'Escalated') return 'warning';
  return 'info';
}

function priorityTone(priority: SupportTicketContract['priority']): 'danger' | 'warning' | 'info' {
  if (priority === 'P1') return 'danger';
  if (priority === 'P2') return 'warning';
  return 'info';
}

export function SupportConsoleTable({ items }: { items: SupportTicketContract[] }) {
  return (
    <div className="card table-wrap">
      <div className="toolbar">
        <div className="toolbar-group">
          <label className="label" style={{ minWidth: 220 }}>
            Search tickets
            <input className="input" defaultValue="" placeholder="Ticket, subject, owner" />
          </label>
          <label className="label">
            Queue state
            <select className="select" defaultValue="All">
              <option>All</option>
              <option>Open</option>
              <option>Escalated</option>
              <option>Waiting on reply</option>
              <option>Resolved</option>
            </select>
          </label>
          <label className="label">
            Linked domain
            <select className="select" defaultValue="All">
              <option>All</option>
              <option>Bookings</option>
              <option>Refunds</option>
              <option>Telehealth</option>
              <option>Provider Ops</option>
            </select>
          </label>
        </div>
        <div className="inline-actions">
          <button className="button secondary">Export timeline</button>
          <button className="button secondary">Bulk assign</button>
          <button className="button primary">Create support ticket</button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Ticket</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Owner</th>
            <th>Masked view</th>
            <th>Next milestone</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <div style={{ fontWeight: 800 }}>{item.ticketRef}</div>
                <div className="muted">{item.subject}</div>
                <div className="muted">{item.channel} · {item.linkedDomain}</div>
              </td>
              <td>
                <StatusBadge tone={priorityTone(item.priority)}>{item.priority}</StatusBadge>
              </td>
              <td>
                <StatusBadge tone={statusTone(item.status)}>{item.status}</StatusBadge>
                <div className="muted" style={{ marginTop: 8 }}>SLA {item.sla}</div>
              </td>
              <td>{item.owner}</td>
              <td>{item.piiMasking}</td>
              <td style={{ minWidth: 220 }}>{item.nextMilestone}</td>
              <td>
                <Link className="button secondary" href={`/portal/support/console/${item.id}`}>
                  Open ticket
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
