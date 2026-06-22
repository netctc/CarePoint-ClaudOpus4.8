import Link from 'next/link';
import { StatusBadge } from '@/components/ui/status-badge';
import type { RefundCaseContract } from '@/lib/api/contracts/admin';

function tone(status: RefundCaseContract['evidenceStatus']) {
  if (status === 'Complete') return 'success';
  if (status === 'Needs review') return 'warning';
  return 'danger';
}

export function RefundCasesTable({ items }: { items: RefundCaseContract[] }) {
  return (
    <div className="card table-wrap admin-v19-functional-table">
      <div className="toolbar admin-v19-table-toolbar">
        <div className="toolbar-group">
          <label className="label" style={{ minWidth: 220 }}>
            Search cases
            <input className="input" defaultValue="" placeholder="Case ref or booking ref" />
          </label>
          <label className="label">
            Evidence
            <select className="select" defaultValue="All">
              <option>All</option>
              <option>Complete</option>
              <option>Needs review</option>
              <option>Missing</option>
            </select>
          </label>
          <label className="label">
            Counterparty
            <select className="select" defaultValue="All">
              <option>All</option>
              <option>Patient</option>
              <option>Provider</option>
            </select>
          </label>
        </div>
        <div className="inline-actions">
          <button className="button secondary">Export queue</button>
          <button className="button secondary">Bulk policy check</button>
          <button className="button primary">Open finance review</button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Case</th>
            <th>Booking</th>
            <th>Party</th>
            <th>Reason</th>
            <th>Evidence</th>
            <th>Policy</th>
            <th>Amount</th>
            <th>Admin action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td style={{ fontWeight: 800 }}>{item.caseRef}</td>
              <td>{item.bookingRef}</td>
              <td>{item.party}</td>
              <td>{item.reasonCode}</td>
              <td><StatusBadge tone={tone(item.evidenceStatus)}>{item.evidenceStatus}</StatusBadge></td>
              <td>{item.policy}</td>
              <td>{item.amount}</td>
              <td>
                <Link className="button secondary" href={`/portal/payments/refunds/${item.id}`}>
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
