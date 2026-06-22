import { StatusBadge } from '@/components/ui/status-badge';
import type { CoverageRegionContract } from '@/lib/api/contracts/admin';

function tone(status: CoverageRegionContract['status']) {
  if (status === 'Enabled') return 'success';
  if (status === 'Limited') return 'warning';
  return 'danger';
}

function modeLabel(item: CoverageRegionContract) {
  if (item.telehealthEnabled && item.inPersonEnabled) return 'Telehealth + In-person';
  if (item.telehealthEnabled) return 'Telehealth only';
  if (item.inPersonEnabled) return 'In-person only';
  return 'No live modalities';
}

export function CoverageRegionTable({ items }: { items: CoverageRegionContract[] }) {
  return (
    <div className="card table-wrap">
      <div className="toolbar">
        <div className="toolbar-group">
          <label className="label" style={{ minWidth: 220 }}>
            Search regions or cities
            <input className="input" defaultValue="" placeholder="Region, city, modality" />
          </label>
          <label className="label">
            Coverage status
            <select className="select" defaultValue="All">
              <option>All</option>
              <option>Enabled</option>
              <option>Limited</option>
              <option>Disabled</option>
            </select>
          </label>
          <label className="label">
            Modality
            <select className="select" defaultValue="All">
              <option>All</option>
              <option>Telehealth + In-person</option>
              <option>Telehealth only</option>
              <option>In-person only</option>
            </select>
          </label>
        </div>
        <div className="inline-actions">
          <button className="button secondary">View territory map</button>
          <button className="button primary">Enable region</button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Region</th>
            <th>Cities</th>
            <th>Weekend calendar</th>
            <th>Modes</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td style={{ fontWeight: 700 }}>{item.region}</td>
              <td>{item.cities.join(', ')}</td>
              <td>{item.weekendCalendar}</td>
              <td>
                <div>{modeLabel(item)}</div>
                {item.blockedChannels?.length ? <div className="muted small">Blocked: {item.blockedChannels.join(', ')}</div> : null}
              </td>
              <td>
                <StatusBadge tone={tone(item.status)}>{item.status}</StatusBadge>
              </td>
              <td>
                <div className="muted small">{item.blockedFacilities?.length ? `Facilities: ${item.blockedFacilities.join(', ')}` : 'No facility exceptions'}</div>
                {item.cityExceptions?.length ? <div className="muted small">Regional notes: {item.cityExceptions.join(' · ')}</div> : null}
                <div className="inline-actions" style={{ marginTop: 8 }}>
                  <button className="button secondary">Inspect impact</button>
                  <button className="button primary">Adjust coverage</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
