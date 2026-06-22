import Link from 'next/link';
import { StatusBadge } from '@/components/ui/status-badge';
import type { SettlementBatchContract } from '@/lib/api/contracts/admin';

function tone(status: SettlementBatchContract['status']) {
  if (status === 'Cleared') return 'success';
  if (status === 'Pending') return 'warning';
  return 'danger';
}

export function SettlementTable({ items }: { items: SettlementBatchContract[] }) {
  return (
    <div className="card table-wrap admin-v19-functional-table">
      <div className="toolbar admin-v19-table-toolbar">
        <div className="toolbar-group">
          <label className="label" style={{ minWidth: 220 }}>
            Search batches
            <input className="input" defaultValue="" placeholder="Batch ref or gateway" />
          </label>
          <label className="label">
            Status
            <select className="select" defaultValue="All">
              <option>All</option>
              <option>Cleared</option>
              <option>Pending</option>
              <option>Mismatch</option>
            </select>
          </label>
          <label className="label">
            Aging
            <select className="select" defaultValue="All">
              <option>All</option>
              <option>0-1 days</option>
              <option>2-3 days</option>
              <option>4+ days</option>
            </select>
          </label>
        </div>
        <div className="inline-actions">
          <button className="button secondary">Export settlement file</button>
          <button className="button secondary">Open mismatch queue</button>
          <button className="button primary">Reconcile batches</button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Batch</th>
            <th>Gateway</th>
            <th>Status</th>
            <th>Amount</th>
            <th>Aging</th>
            <th>Admin action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <div style={{ fontWeight: 800 }}>{item.batchRef}</div>
                <div className="muted">Finance-safe settlement view</div>
              </td>
              <td>{item.gateway}</td>
              <td><StatusBadge tone={tone(item.status)}>{item.status}</StatusBadge></td>
              <td>{item.amount}</td>
              <td>{item.aging}</td>
              <td>
                <div className="inline-actions">
                  <Link className="button secondary" href={`/portal/payments/reconciliation/${item.id}`}>Inspect</Link>
                  <button className="button secondary">Export</button>
                  <button className="button primary">Reconcile</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
