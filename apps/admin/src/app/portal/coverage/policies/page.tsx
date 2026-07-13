'use client';

import { useCallback, useEffect, useState } from 'react';
import { PortalShell } from '@/components/layout/portal-shell';
import { FilterPanel, type FilterDefinition } from '@/components/ui/filter-panel';
import { AdminDataTable, type ColumnDef } from '@/components/ui/admin-data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingButton } from '@/components/ui/loading-button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import {
  getCoveragePolicies,
  createCoveragePolicy,
  updateCoveragePolicy,
  deleteCoveragePolicy,
  publishCoveragePolicy,
  suspendCoveragePolicy,
  archiveCoveragePolicy,
  rollbackCoveragePolicy,
  type CoveragePolicy,
} from '@/lib/api/coverage-api';

/* ─── Filter Definitions ────────────────────────────────────────── */

const policyFilters: FilterDefinition[] = [
  {
    id: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'draft', label: 'Draft' },
      { value: 'published', label: 'Published' },
      { value: 'suspended', label: 'Suspended' },
      { value: 'archived', label: 'Archived' },
    ],
  },
];

/* ─── Column Definitions ────────────────────────────────────────── */

function statusBadge(status: string) {
  const colorMap: Record<string, string> = {
    draft: '#f59e0b',
    published: '#22c55e',
    suspended: '#ef4444',
    archived: '#6b7280',
  };
  const color = colorMap[status?.toLowerCase()] || '#6b7280';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 12,
        fontSize: '0.78rem',
        fontWeight: 700,
        background: `${color}18`,
        color,
        textTransform: 'capitalize',
      }}
    >
      {status}
    </span>
  );
}

const policyColumns: ColumnDef<CoveragePolicy>[] = [
  { id: 'name', header: 'Policy Name', accessor: (row) => row.name, sortable: true },
  { id: 'version', header: 'Version', accessor: (row) => `v${row.version}`, sortable: true },
  { id: 'status', header: 'Status', accessor: (row) => statusBadge(row.status), sortable: true },
  {
    id: 'effectiveDate',
    header: 'Effective Date',
    accessor: (row) => row.effectiveDate ? new Date(row.effectiveDate).toLocaleDateString() : '—',
    sortable: true,
  },
  {
    id: 'updatedAt',
    header: 'Last Updated',
    accessor: (row) => row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : '—',
    sortable: true,
  },
];

/* ─── Version History Modal ─────────────────────────────────────── */

function VersionHistoryModal({ policy, onClose }: { policy: CoveragePolicy; onClose: () => void }) {
  const auditTrail = policy.auditTrail || [];

  return (
    <div className="confirm-dialog-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="history-title">
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, width: '90vw' }}>
        <h3 id="history-title" className="confirm-dialog-title">
          Version History: {policy.name}
        </h3>
        <p style={{ fontSize: '0.84rem', color: 'var(--muted)', margin: '8px 0 16px' }}>
          Current version: v{policy.version}
        </p>

        {auditTrail.length === 0 ? (
          <p style={{ fontSize: '0.86rem', color: 'var(--muted)' }}>No version history available.</p>
        ) : (
          <div style={{ maxHeight: 320, overflow: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.84rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 700 }}>Action</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 700 }}>Actor</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 700 }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 700 }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditTrail.map((entry, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px', textTransform: 'capitalize' }}>{entry.action}</td>
                    <td style={{ padding: '8px 10px' }}>{entry.actor}</td>
                    <td style={{ padding: '8px 10px' }}>
                      {entry.timestamp ? new Date(entry.timestamp).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '8px 10px', color: 'var(--muted)' }}>{entry.details || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="confirm-dialog-actions" style={{ marginTop: 20 }}>
          <button className="button secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Create/Edit Dialog ────────────────────────────────────────── */

interface PolicyFormData {
  name: string;
  status: string;
  effectiveDate: string;
  rules: string;
}

function PolicyFormDialog({
  initial,
  onSubmit,
  onCancel,
  loading,
}: {
  initial?: CoveragePolicy | null;
  onSubmit: (data: PolicyFormData) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<PolicyFormData>({
    name: initial?.name ?? '',
    status: initial?.status ?? 'draft',
    effectiveDate: initial?.effectiveDate ? initial.effectiveDate.split('T')[0] : '',
    rules: initial?.rules ? JSON.stringify(initial.rules, null, 2) : '{}',
  });

  const update = (field: keyof PolicyFormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="confirm-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="policy-form-title">
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, width: '90vw' }}>
        <h3 id="policy-form-title" className="confirm-dialog-title">
          {initial ? 'Edit Policy' : 'Create Policy'}
        </h3>

        <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
          <label style={{ display: 'grid', gap: 4, fontSize: '0.84rem', fontWeight: 700 }}>
            Policy Name
            <input className="input" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Policy name" />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'grid', gap: 4, fontSize: '0.84rem', fontWeight: 700 }}>
              Status
              <select className="select" value={form.status} onChange={(e) => update('status', e.target.value)}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="suspended">Suspended</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: '0.84rem', fontWeight: 700 }}>
              Effective Date
              <input className="input" type="date" value={form.effectiveDate} onChange={(e) => update('effectiveDate', e.target.value)} />
            </label>
          </div>
          <label style={{ display: 'grid', gap: 4, fontSize: '0.84rem', fontWeight: 700 }}>
            Rules (JSON)
            <textarea
              className="input"
              value={form.rules}
              onChange={(e) => update('rules', e.target.value)}
              rows={6}
              style={{ fontFamily: 'monospace', fontSize: '0.82rem', resize: 'vertical' }}
              placeholder='{"conditions": [], "actions": []}'
            />
          </label>
        </div>

        <div className="confirm-dialog-actions" style={{ marginTop: 20 }}>
          <button className="button secondary" onClick={onCancel} disabled={loading}>Cancel</button>
          <LoadingButton
            variant="primary"
            isLoading={loading}
            onClick={() => onSubmit(form)}
            disabled={!form.name.trim() || !form.effectiveDate}
          >
            {initial ? 'Update' : 'Create'}
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page Component ───────────────────────────────────────── */

export default function CoveragePoliciesPage() {
  const { toast } = useToast();

  // Table state
  const [policies, setPolicies] = useState<CoveragePolicy[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [tableLoading, setTableLoading] = useState(true);

  // Filter state
  const [filterValues, setFilterValues] = useState<Record<string, any>>({ status: '' });

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CoveragePolicy | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CoveragePolicy | null>(null);
  const [historyTarget, setHistoryTarget] = useState<CoveragePolicy | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  /* ── Fetch policies ───────────────── */
  const fetchPolicies = useCallback(async () => {
    setTableLoading(true);
    try {
      const data = await getCoveragePolicies({
        page,
        limit: pageSize,
        search: searchTerm || undefined,
        status: filterValues.status || undefined,
        sortBy: sortField || undefined,
        sortDir: sortField ? sortDir : undefined,
      });
      setPolicies(data.items || []);
      setTotalCount(data.total || 0);
    } catch {
      setPolicies([]);
      setTotalCount(0);
    } finally {
      setTableLoading(false);
    }
  }, [page, pageSize, searchTerm, sortField, sortDir, filterValues]);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  /* ── Create/Update handler ────────── */
  const handleFormSubmit = useCallback(
    async (data: PolicyFormData) => {
      setFormLoading(true);
      try {
        let rules: Record<string, unknown> = {};
        try { rules = JSON.parse(data.rules); } catch { /* keep empty */ }

        const payload = {
          name: data.name,
          status: data.status,
          effectiveDate: data.effectiveDate,
          rules,
        };

        if (editTarget) {
          await updateCoveragePolicy(editTarget.id, payload);
          toast({ variant: 'success', title: 'Policy updated', description: `"${data.name}" has been updated.` });
        } else {
          await createCoveragePolicy(payload);
          toast({ variant: 'success', title: 'Policy created', description: `"${data.name}" has been created.` });
        }
        setFormOpen(false);
        setEditTarget(null);
        fetchPolicies();
      } catch {
        toast({ variant: 'error', title: editTarget ? 'Update failed' : 'Create failed', description: 'Please try again.' });
      } finally {
        setFormLoading(false);
      }
    },
    [editTarget, toast, fetchPolicies]
  );

  /* ── Delete handler ───────────────── */
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteCoveragePolicy(deleteTarget.id);
      toast({ variant: 'success', title: 'Policy deleted', description: `"${deleteTarget.name}" has been deleted.` });
      setDeleteTarget(null);
      fetchPolicies();
    } catch {
      toast({ variant: 'error', title: 'Delete failed', description: 'Unable to delete policy. Please try again.' });
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteTarget, toast, fetchPolicies]);

  /* ── Status action handlers ───────── */
  const handlePublish = useCallback(async (policy: CoveragePolicy) => {
    setActionLoading(policy.id);
    try {
      await publishCoveragePolicy(policy.id);
      toast({ variant: 'success', title: 'Policy published', description: `"${policy.name}" is now published.` });
      fetchPolicies();
    } catch {
      toast({ variant: 'error', title: 'Publish failed', description: 'Please try again.' });
    } finally {
      setActionLoading(null);
    }
  }, [toast, fetchPolicies]);

  const handleSuspend = useCallback(async (policy: CoveragePolicy) => {
    setActionLoading(policy.id);
    try {
      await suspendCoveragePolicy(policy.id);
      toast({ variant: 'success', title: 'Policy suspended', description: `"${policy.name}" has been suspended.` });
      fetchPolicies();
    } catch {
      toast({ variant: 'error', title: 'Suspend failed', description: 'Please try again.' });
    } finally {
      setActionLoading(null);
    }
  }, [toast, fetchPolicies]);

  const handleArchive = useCallback(async (policy: CoveragePolicy) => {
    setActionLoading(policy.id);
    try {
      await archiveCoveragePolicy(policy.id);
      toast({ variant: 'success', title: 'Policy archived', description: `"${policy.name}" has been archived.` });
      fetchPolicies();
    } catch {
      toast({ variant: 'error', title: 'Archive failed', description: 'Please try again.' });
    } finally {
      setActionLoading(null);
    }
  }, [toast, fetchPolicies]);

  const handleRollback = useCallback(async (policy: CoveragePolicy) => {
    if (policy.version <= 1) {
      toast({ variant: 'error', title: 'Cannot rollback', description: 'No previous version available.' });
      return;
    }
    setActionLoading(policy.id);
    try {
      await rollbackCoveragePolicy(policy.id, policy.version - 1);
      toast({ variant: 'success', title: 'Policy rolled back', description: `"${policy.name}" rolled back to v${policy.version - 1}.` });
      fetchPolicies();
    } catch {
      toast({ variant: 'error', title: 'Rollback failed', description: 'Please try again.' });
    } finally {
      setActionLoading(null);
    }
  }, [toast, fetchPolicies]);

  /* ── Columns with actions ─────────── */
  const columnsWithActions: ColumnDef<CoveragePolicy>[] = [
    ...policyColumns,
    {
      id: 'actions',
      header: 'Actions',
      width: '280px',
      accessor: (row) => {
        const isLoading = actionLoading === row.id;
        return (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
            {row.status === 'draft' && (
              <button className="button secondary" style={{ padding: '3px 8px', fontSize: '0.72rem', minHeight: 28 }} disabled={isLoading} onClick={() => handlePublish(row)}>
                Publish
              </button>
            )}
            {row.status === 'published' && (
              <button className="button secondary" style={{ padding: '3px 8px', fontSize: '0.72rem', minHeight: 28 }} disabled={isLoading} onClick={() => handleSuspend(row)}>
                Suspend
              </button>
            )}
            {(row.status === 'published' || row.status === 'suspended') && (
              <button className="button secondary" style={{ padding: '3px 8px', fontSize: '0.72rem', minHeight: 28 }} disabled={isLoading} onClick={() => handleArchive(row)}>
                Archive
              </button>
            )}
            {row.version > 1 && (
              <button className="button secondary" style={{ padding: '3px 8px', fontSize: '0.72rem', minHeight: 28 }} disabled={isLoading} onClick={() => handleRollback(row)}>
                Rollback
              </button>
            )}
            <button className="button secondary" style={{ padding: '3px 8px', fontSize: '0.72rem', minHeight: 28 }} onClick={() => setHistoryTarget(row)}>
              History
            </button>
            <button className="button secondary" style={{ padding: '3px 8px', fontSize: '0.72rem', minHeight: 28 }} onClick={() => { setEditTarget(row); setFormOpen(true); }}>
              Edit
            </button>
            <button className="button secondary" style={{ padding: '3px 8px', fontSize: '0.72rem', minHeight: 28, color: 'var(--danger, #ef4444)' }} onClick={() => setDeleteTarget(row)}>
              Delete
            </button>
          </div>
        );
      },
    },
  ];

  /* ── Handlers ─────────────────────── */
  const handleSort = useCallback((columnId: string, direction: 'asc' | 'desc') => {
    setSortField(columnId);
    setSortDir(direction);
  }, []);

  const handleSearch = useCallback((term: string) => { setSearchTerm(term); setPage(1); }, []);
  const handleFilterChange = useCallback((values: Record<string, any>) => { setFilterValues(values); }, []);
  const handleFilterApply = useCallback(() => { setPage(1); }, []);
  const handleFilterClear = useCallback(() => { setFilterValues({ status: '' }); setPage(1); }, []);

  /* ── Render ────────────────────────── */
  return (
    <PortalShell currentPath="/portal/coverage">
      <div style={{ display: 'grid', gap: 24 }}>
        {/* Page Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Coverage Policies
          </h1>
          <button
            className="button primary"
            onClick={() => { setEditTarget(null); setFormOpen(true); }}
            style={{ minHeight: 40 }}
          >
            Create Policy
          </button>
        </div>

        {/* Main Content */}
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          <FilterPanel
            filters={policyFilters}
            values={filterValues}
            onChange={handleFilterChange}
            onApply={handleFilterApply}
            onClear={handleFilterClear}
          />

          <div style={{ flex: 1, minWidth: 0 }}>
            {policies.length === 0 && !tableLoading ? (
              <EmptyState
                title="No coverage policies found"
                description="No policies match the current filters. Try adjusting your criteria or create a new policy."
                actionLabel="Clear Filters"
                onAction={handleFilterClear}
              />
            ) : (
              <AdminDataTable
                columns={columnsWithActions}
                data={policies}
                totalCount={totalCount}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
                onSort={handleSort}
                onSearch={handleSearch}
                searchable
                loading={tableLoading}
                exportFileName="coverage-policies-export"
                tableId="coverage-policies"
                emptyMessage="No coverage policies found."
              />
            )}
          </div>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      {formOpen && (
        <PolicyFormDialog
          initial={editTarget}
          onSubmit={handleFormSubmit}
          onCancel={() => { setFormOpen(false); setEditTarget(null); }}
          loading={formLoading}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Policy"
          description={`Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`}
          confirmLabel={deleteLoading ? 'Deleting...' : 'Delete'}
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Version History Modal */}
      {historyTarget && (
        <VersionHistoryModal policy={historyTarget} onClose={() => setHistoryTarget(null)} />
      )}
    </PortalShell>
  );
}
