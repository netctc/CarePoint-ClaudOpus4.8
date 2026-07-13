'use client';

import { useState } from 'react';
import Link from 'next/link';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatUtcDateTime } from '@/lib/formatters';
import type { ProviderOnboardingItemContract } from '@/lib/api/contracts/admin';
import { useAdminLocale } from '@/components/i18n/admin-locale-provider';
import { getAdminPortalCopy } from '@/lib/i18n/admin-portal-copy';
import { adminApi } from '@/lib/api-client';

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

type FilterState = {
  search: string;
  docStatus: string;
  riskFlag: string;
  slaFilter: string;
  assignee: string;
};

export function ProviderOnboardingTable({ items }: { items: ProviderOnboardingItemContract[] }) {
  const { locale } = useAdminLocale();
  const copy = getAdminPortalCopy(locale).providerOnboardingTable;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    docStatus: 'All',
    riskFlag: 'All',
    slaFilter: 'All',
    assignee: '',
  });
  const [actionState, setActionState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignTargetId, setReassignTargetId] = useState('');

  // Filtering logic
  const filteredItems = items.filter((item) => {
    if (filters.search && !item.providerName.toLowerCase().includes(filters.search.toLowerCase()) && !item.organizationName.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    if (filters.docStatus !== 'All' && item.docStatus !== filters.docStatus) return false;
    if (filters.riskFlag !== 'All' && item.riskFlag !== filters.riskFlag) return false;
    if (filters.slaFilter === 'At Risk' && item.slaHoursRemaining > 6) return false;
    return true;
  });

  const allSelected = filteredItems.length > 0 && filteredItems.every((item) => selectedIds.has(item.id));

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((item) => item.id)));
    }
  }

  function toggleItem(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  }

  async function handleClaim() {
    if (selectedIds.size === 0) return;
    setActionState('loading');
    setActionMessage(null);
    try {
      const result = await adminApi.claimQueueItems(Array.from(selectedIds));
      setActionState('success');
      setActionMessage(`Claimed ${result.data.claimedCount} item(s) successfully.`);
      setSelectedIds(new Set());
    } catch (error) {
      setActionState('error');
      setActionMessage(error instanceof Error ? error.message : 'Failed to claim items.');
    }
  }

  async function handleReassign() {
    if (selectedIds.size === 0 || !reassignTargetId.trim()) return;
    setActionState('loading');
    setActionMessage(null);
    try {
      const result = await adminApi.reassignQueueItems(Array.from(selectedIds), reassignTargetId.trim());
      setActionState('success');
      setActionMessage(`Reassigned ${result.data.reassignedCount} item(s) to ${result.data.assignedTo.name}.`);
      setSelectedIds(new Set());
      setShowReassignModal(false);
      setReassignTargetId('');
    } catch (error) {
      setActionState('error');
      setActionMessage(error instanceof Error ? error.message : 'Failed to reassign items.');
    }
  }

  function handleOpenSlaLane() {
    setFilters((prev) => ({ ...prev, slaFilter: prev.slaFilter === 'At Risk' ? 'All' : 'At Risk' }));
  }

  return (
    <div className="card table-wrap admin-v17-functional-table">
      {/* Action bar */}
      <div className="toolbar admin-v17-table-toolbar">
        <div className="toolbar-group">
          <label className="label" style={{ minWidth: 220 }}>
            {copy.search}
            <input
              className="input"
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              placeholder={copy.searchPlaceholder}
            />
          </label>
          <label className="label">
            {copy.documentStatus}
            <select
              className="select"
              value={filters.docStatus}
              onChange={(e) => setFilters((prev) => ({ ...prev, docStatus: e.target.value }))}
            >
              <option>{copy.all}</option>
              <option>{copy.complete}</option>
              <option>{copy.missingItems}</option>
              <option>{copy.needsRecheck}</option>
            </select>
          </label>
          <label className="label">
            {copy.riskFlag}
            <select
              className="select"
              value={filters.riskFlag}
              onChange={(e) => setFilters((prev) => ({ ...prev, riskFlag: e.target.value }))}
            >
              <option>{copy.all}</option>
              <option>{copy.low}</option>
              <option>{copy.medium}</option>
              <option>{copy.high}</option>
            </select>
          </label>
        </div>
        <div className="inline-actions">
          <button
            className="button secondary"
            disabled={selectedIds.size === 0 || actionState === 'loading'}
            onClick={handleClaim}
          >
            {actionState === 'loading' ? 'Claiming...' : copy.claimSelected}
          </button>
          <button
            className="button secondary"
            disabled={selectedIds.size === 0 || actionState === 'loading'}
            onClick={() => setShowReassignModal(true)}
          >
            {copy.reassign}
          </button>
          <button
            className={`button ${filters.slaFilter === 'At Risk' ? 'primary' : 'secondary'}`}
            onClick={handleOpenSlaLane}
          >
            {copy.openSlaLane}
          </button>
        </div>
      </div>

      {/* Feedback banner */}
      {actionMessage && (
        <div className={`banner ${actionState === 'error' ? 'warning' : 'info'}`} style={{ margin: '0 16px 12px' }}>
          {actionMessage}
          <button className="button-link" onClick={() => setActionMessage(null)} style={{ marginLeft: 12 }}>Dismiss</button>
        </div>
      )}

      {/* Reassign modal */}
      {showReassignModal && (
        <div className="modal-overlay" onClick={() => setShowReassignModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: 24, maxWidth: 400 }}>
            <h3 className="section-title">Reassign Queue Items</h3>
            <p className="muted" style={{ marginBottom: 12 }}>
              Reassigning {selectedIds.size} item(s) to another admin user.
            </p>
            <label className="label">
              Target Admin User ID
              <input
                className="input"
                value={reassignTargetId}
                onChange={(e) => setReassignTargetId(e.target.value)}
                placeholder="Enter user ID"
              />
            </label>
            <div className="inline-actions" style={{ marginTop: 16 }}>
              <button className="button secondary" onClick={() => setShowReassignModal(false)}>Cancel</button>
              <button
                className="button primary"
                disabled={!reassignTargetId.trim() || actionState === 'loading'}
                onClick={handleReassign}
              >
                {actionState === 'loading' ? 'Reassigning...' : 'Reassign'}
              </button>
            </div>
          </div>
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th style={{ width: 36 }}>
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            </th>
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
          {filteredItems.map((item) => {
            const score = readinessScore(item);
            const tone = item.riskFlag === 'High' ? 'danger' : item.docStatus === 'Complete' ? 'success' : 'warning';
            return (
              <tr key={item.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={() => toggleItem(item.id)}
                  />
                </td>
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
                </td>
                <td>
                  <Link className="button secondary" href={`/portal/providers/onboarding/${item.id}`}>
                    {copy.openReview}
                  </Link>
                </td>
              </tr>
            );
          })}
          {filteredItems.length === 0 && (
            <tr>
              <td colSpan={8} style={{ textAlign: 'center', padding: 24 }}>
                <div className="muted">No items match the current filters.</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
