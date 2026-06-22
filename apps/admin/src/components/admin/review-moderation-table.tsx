import Link from 'next/link';
import { StatusBadge } from '@/components/ui/status-badge';
import type { ModerationReviewContract } from '@/lib/api/contracts/admin';

function fraudTone(score: ModerationReviewContract['fraudScore']): 'success' | 'warning' | 'danger' {
  if (score === 'Low') return 'success';
  if (score === 'Medium') return 'warning';
  return 'danger';
}

function stateTone(state: ModerationReviewContract['moderationState']): 'info' | 'warning' | 'danger' | 'success' {
  if (state === 'Approved') return 'success';
  if (state === 'Queued') return 'info';
  if (state === 'Redacted') return 'warning';
  return 'danger';
}

export function ReviewModerationTable({ items }: { items: ModerationReviewContract[] }) {
  return (
    <div className="card table-wrap">
      <div className="toolbar">
        <div className="toolbar-group">
          <label className="label" style={{ minWidth: 220 }}>
            Search reviews
            <input className="input" defaultValue="" placeholder="Review ref or provider" />
          </label>
          <label className="label">
            Fraud score
            <select className="select" defaultValue="All">
              <option>All</option>
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </label>
          <label className="label">
            State
            <select className="select" defaultValue="All">
              <option>All</option>
              <option>Queued</option>
              <option>Approved</option>
              <option>Redacted</option>
              <option>Removed</option>
            </select>
          </label>
        </div>
        <div className="inline-actions">
          <button className="button secondary">Export queue</button>
          <button className="button secondary">Redact selected</button>
          <button className="button primary">Approve selected</button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Review ref</th>
            <th>Provider</th>
            <th>Fraud score</th>
            <th>Dispute</th>
            <th>Moderation state</th>
            <th>Admin action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <div style={{ fontWeight: 800 }}>{item.reviewRef}</div>
                <div className="muted">Moderation-safe patient feedback view</div>
              </td>
              <td>{item.providerName}</td>
              <td><StatusBadge tone={fraudTone(item.fraudScore)}>{item.fraudScore}</StatusBadge></td>
              <td>{item.disputeOpen ? 'Provider dispute open' : 'No dispute'}</td>
              <td><StatusBadge tone={stateTone(item.moderationState)}>{item.moderationState}</StatusBadge></td>
              <td>
                <Link className="button secondary" href={`/portal/reviews/moderation/${item.id}`}>
                  Open review
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
