import { StatusBadge } from '@/components/ui/status-badge';
import type { PolicyTemplateContract } from '@/lib/api/contracts/admin';

function tone(status: PolicyTemplateContract['status']): 'success' | 'warning' | 'neutral' {
  if (status === 'Published') return 'success';
  if (status === 'Draft') return 'warning';
  return 'neutral';
}

function editability(status: PolicyTemplateContract['status']) {
  if (status === 'Published') return 'Immutable';
  if (status === 'Draft') return 'Editable';
  return 'Reference only';
}

export function PolicyTemplatesTable({ items }: { items: PolicyTemplateContract[] }) {
  return (
    <div className="card table-wrap">
      <div className="toolbar">
        <div className="toolbar-group">
          <label className="label" style={{ minWidth: 220 }}>
            Search templates
            <input className="input" defaultValue="" placeholder="Template, policy area, locale" />
          </label>
          <label className="label">
            Status
            <select className="select" defaultValue="All">
              <option>All</option>
              <option>Published</option>
              <option>Draft</option>
              <option>Archived</option>
            </select>
          </label>
          <label className="label">
            Policy area
            <select className="select" defaultValue="All">
              <option>All</option>
              <option>Consent</option>
              <option>Privacy</option>
              <option>Communications</option>
            </select>
          </label>
        </div>
        <div className="inline-actions">
          <button className="button secondary">Compare versions</button>
          <button className="button secondary">Create new version</button>
          <button className="button primary">Publish ready draft</button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Template</th>
            <th>Policy area</th>
            <th>Country</th>
            <th>Version</th>
            <th>Status</th>
            <th>Edit mode</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td style={{ fontWeight: 700 }}>{item.templateName}</td>
              <td>{item.policyArea}</td>
              <td>{item.country}</td>
              <td>{item.version}</td>
              <td><StatusBadge tone={tone(item.status)}>{item.status}</StatusBadge></td>
              <td>{editability(item.status)}</td>
              <td>
                <div className="inline-actions">
                  <button className="button secondary">Where used</button>
                  <button className="button primary">Open draft</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
