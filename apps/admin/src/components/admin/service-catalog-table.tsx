import Link from 'next/link';
import { StatusBadge } from '@/components/ui/status-badge';
import type { ServiceCatalogItemContract } from '@/lib/api/contracts/admin';

function tone(status: ServiceCatalogItemContract['status']) {
  if (status === 'Active') return 'success';
  if (status === 'Draft') return 'warning';
  return 'neutral';
}

function versioningHint(status: ServiceCatalogItemContract['status']) {
  if (status === 'Active') return 'Controlled edit only';
  if (status === 'Draft') return 'Safe to revise';
  return 'Read-only history';
}

export function ServiceCatalogTable({ items }: { items: ServiceCatalogItemContract[] }) {
  return (
    <div className="card table-wrap admin-v17-functional-table admin-v18-functional-table">
      <div className="toolbar admin-v18-table-toolbar">
        <div className="toolbar-group">
          <label className="label" style={{ minWidth: 220 }}>
            Search services
            <input className="input" defaultValue="" placeholder="Service, category, template" />
          </label>
          <label className="label">
            Lifecycle state
            <select className="select" defaultValue="All">
              <option>All</option>
              <option>Active</option>
              <option>Draft</option>
              <option>Archived</option>
            </select>
          </label>
          <label className="label">
            Downstream impact
            <select className="select" defaultValue="All">
              <option>All</option>
              <option>High dependency</option>
              <option>Pending rollout</option>
              <option>Inactive</option>
            </select>
          </label>
        </div>
        <div className="inline-actions">
          <button className="button secondary">Clone service</button>
          <button className="button secondary">Archive selected</button>
          <button className="button primary">Create service</button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Service</th>
            <th>Template</th>
            <th>Status</th>
            <th>Downstream impact</th>
            <th>Change mode</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <div style={{ fontWeight: 800 }}>{item.serviceName}</div>
                <div className="muted">{item.category}</div>
              </td>
              <td>{item.template}</td>
              <td>
                <StatusBadge tone={tone(item.status)}>{item.status}</StatusBadge>
              </td>
              <td>{item.downstreamImpact}</td>
              <td>{versioningHint(item.status)}</td>
              <td>
                <div className="inline-actions">
                  <Link className="button secondary" href={`/portal/catalog/services/${item.id}`}>
                    Open workspace
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
