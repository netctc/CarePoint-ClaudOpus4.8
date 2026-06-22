'use client';

import Link from 'next/link';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAdminLocale } from '@/components/i18n/admin-locale-provider';
import { getAdminPortalCopy } from '@/lib/i18n/admin-portal-copy';
import type { ProviderDirectoryItemContract } from '@/lib/api/contracts/admin';

function toneForStatus(status: string) {
  if (status === 'Active') return 'success';
  if (status === 'Restricted') return 'warning';
  if (status === 'Suspended') return 'danger';
  return 'neutral';
}

export function ProviderDirectoryTable({ items }: { items: ProviderDirectoryItemContract[] }) {
  const { locale } = useAdminLocale();
  const copy = getAdminPortalCopy(locale).providerDirectoryTable;

  return (
    <div className="card table-wrap admin-v17-functional-table">
      <div className="toolbar admin-v17-table-toolbar">
        <div className="toolbar-group">
          <label className="label" style={{ minWidth: 240 }}>
            {copy.search}
            <input className="input" defaultValue="" placeholder={copy.searchPlaceholder} />
          </label>
          <label className="label">
            {copy.status}
            <select className="select" defaultValue={copy.all}>
              <option>{copy.all}</option>
              <option>{copy.active}</option>
              <option>{copy.pending}</option>
              <option>{copy.restricted}</option>
              <option>{copy.suspended}</option>
            </select>
          </label>
        </div>
        <div className="inline-actions">
          <button className="button secondary">{copy.export}</button>
          <button className="button primary">{copy.syncDirectory}</button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>{copy.provider}</th>
            <th>{copy.org}</th>
            <th>{copy.specialty}</th>
            <th>{copy.city}</th>
            <th>{copy.bookings}</th>
            <th>{copy.statusColumn}</th>
            <th>{copy.payout}</th>
            <th>{copy.action}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td style={{ fontWeight: 800 }}>{item.providerName}</td>
              <td>{item.organizationName}</td>
              <td>{item.specialty}</td>
              <td>{item.city}</td>
              <td>{item.monthlyBookings}</td>
              <td><StatusBadge tone={toneForStatus(item.operatingStatus)}>{item.operatingStatus}</StatusBadge></td>
              <td>{item.payoutReadiness}</td>
              <td>
                <Link className="button secondary" href={`/portal/providers/${item.id}`}>
                  {copy.openProfile}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
