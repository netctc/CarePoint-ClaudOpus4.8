'use client';

import Link from 'next/link';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatUtcDateTime } from '@/lib/formatters';
import type { ProviderOnboardingItemContract } from '@/lib/api/contracts/admin';
import { useAdminLocale } from '@/components/i18n/admin-locale-provider';
import { getAdminPortalCopy } from '@/lib/i18n/admin-portal-copy';

function toneForDocStatus(status: string) {
  if (status === 'Complete') return 'success';
  if (status === 'Needs recheck') return 'warning';
  return 'neutral';
}

function toneForRisk(risk: string) {
  if (risk === 'High') return 'danger';
  if (risk === 'Medium') return 'warning';
  return 'success';
}

function readinessScore(item: ProviderOnboardingItemContract) {
  const base = item.docStatus === 'Complete' ? 70 : item.docStatus === 'Needs recheck' ? 45 : 30;
  const riskAdjustment = item.riskFlag === 'High' ? -20 : item.riskFlag === 'Medium' ? -10 : 5;
  return Math.max(10, Math.min(100, base + riskAdjustment + Math.round(item.slaHoursRemaining / 8)));
}

function readinessNote(item: ProviderOnboardingItemContract, copy: ReturnType<typeof getAdminPortalCopy>['providerOnboardingTable']) {
  if (item.docStatus === 'Complete' && item.riskFlag !== 'High') return copy.approvalReady;
  if (item.riskFlag === 'High') return copy.escalationRequired;
  return copy.needsFollowUp;
}

export function ProviderOnboardingTable({ items }: { items: ProviderOnboardingItemContract[] }) {
  const { locale } = useAdminLocale();
  const copy = getAdminPortalCopy(locale).providerOnboardingTable;

  return (
    <div className="card table-wrap admin-v17-functional-table">
      <div className="toolbar admin-v17-table-toolbar">
        <div className="toolbar-group">
          <label className="label" style={{ minWidth: 220 }}>
            {copy.search}
            <input className="input" defaultValue="" placeholder={copy.searchPlaceholder} />
          </label>
          <label className="label">
            {copy.documentStatus}
            <select className="select" defaultValue={copy.all}>
              <option>{copy.all}</option>
              <option>{copy.complete}</option>
              <option>{copy.missingItems}</option>
              <option>{copy.needsRecheck}</option>
            </select>
          </label>
          <label className="label">
            {copy.riskFlag}
            <select className="select" defaultValue={copy.all}>
              <option>{copy.all}</option>
              <option>{copy.low}</option>
              <option>{copy.medium}</option>
              <option>{copy.high}</option>
            </select>
          </label>
        </div>
        <div className="inline-actions">
          <button className="button secondary">{copy.claimSelected}</button>
          <button className="button secondary">{copy.reassign}</button>
          <button className="button primary">{copy.openSlaLane}</button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>{copy.provider}</th>
            <th>{copy.submitted}</th>
            <th>{copy.documents}</th>
            <th>{copy.risk}</th>
            <th>{copy.sla}</th>
            <th>{copy.readiness}</th>
            <th>{copy.action}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const score = readinessScore(item);
            const tone = item.riskFlag === 'High' ? 'danger' : item.docStatus === 'Complete' ? 'success' : 'warning';
            return (
              <tr key={item.id}>
                <td>
                  <div style={{ fontWeight: 800 }}>{item.providerName}</div>
                  <div className="muted">
                    {item.organizationName} · {item.specialty} · {item.city}
                  </div>
                </td>
                <td>{formatUtcDateTime(item.submittedAt)}</td>
                <td>
                  <StatusBadge tone={toneForDocStatus(item.docStatus)}>{item.docStatus}</StatusBadge>
                </td>
                <td>
                  <StatusBadge tone={toneForRisk(item.riskFlag)}>{item.riskFlag}</StatusBadge>
                </td>
                <td>{item.slaHoursRemaining}{copy.hoursRemaining}</td>
                <td style={{ minWidth: 220 }}>
                  <div className="progress-inline">
                    <div className="progress-track">
                      <div className={`progress-value ${tone}`} style={{ width: `${score}%` }} />
                    </div>
                    <strong>{score}%</strong>
                  </div>
                  <div className="muted" style={{ marginTop: 6 }}>{readinessNote(item, copy)}</div>
                </td>
                <td>
                  <Link className="button secondary" href={`/portal/providers/onboarding/${item.id}`}>
                    {copy.openReview}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
