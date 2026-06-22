import { StatusBadge } from '@/components/ui/status-badge';
import type { PricingRuleContract } from '@/lib/api/contracts/admin';

function toneForStatus(status: PricingRuleContract['status']): 'info' | 'success' | 'warning' | 'neutral' {
  switch (status) {
    case 'Published':
      return 'success';
    case 'Scheduled':
      return 'info';
    default:
      return 'warning';
  }
}

function schedulingHint(status: PricingRuleContract['status']) {
  if (status === 'Published') return 'Live in booking flow';
  if (status === 'Scheduled') return 'Awaiting effective date';
  return 'Simulation only';
}

export function PricingRulesTable({ items }: { items: PricingRuleContract[] }) {
  return (
    <div className="card table-wrap">
      <div className="toolbar">
        <div className="toolbar-group">
          <label className="label" style={{ minWidth: 220 }}>
            Search rules
            <input className="input" defaultValue="" placeholder="Rule, market, service" />
          </label>
          <label className="label">
            Status
            <select className="select" defaultValue="All">
              <option>All</option>
              <option>Published</option>
              <option>Scheduled</option>
              <option>Draft</option>
            </select>
          </label>
          <label className="label">
            Market scope
            <select className="select" defaultValue="All">
              <option>All</option>
              <option>KSA</option>
              <option>National</option>
              <option>City group</option>
            </select>
          </label>
        </div>
        <div className="inline-actions">
          <button className="button secondary">Compare versions</button>
          <button className="button secondary">Run simulation</button>
          <button className="button primary">Create draft rule</button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Rule</th>
            <th>Market</th>
            <th>Commission model</th>
            <th>Effective from</th>
            <th>Status</th>
            <th>Scheduling state</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td style={{ fontWeight: 700 }}>{item.ruleName}</td>
              <td>{item.market}</td>
              <td>{item.commissionModel}</td>
              <td>{item.effectiveFrom}</td>
              <td><StatusBadge tone={toneForStatus(item.status)}>{item.status}</StatusBadge></td>
              <td>{schedulingHint(item.status)}</td>
              <td>
                <div className="inline-actions">
                  <button className="button secondary">Inspect impact</button>
                  <button className="button primary">Open rule</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
