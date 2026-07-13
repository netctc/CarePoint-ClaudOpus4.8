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
  getNetworkProviders,
  createNetworkProvider,
  updateNetworkProvider,
  deleteNetworkProvider,
  getCoveragePlans,
  type NetworkProvider,
  type CoveragePlan,
} from '@/lib/api/coverage-api';

/* ─── Filter Definitions ────────────────────────────────────────── */

const networkFilters: FilterDefinition[] = [
  {
    id: 'inNetwork',
    label: 'Network Status',
    type: 'select',
    options: [
      { value: 'true', label: 'In-Network' },
      { value: 'false', label: 'Out-of-Network' },
    ],
  },
  {
    id: 'tier',
    label: 'Tier',
    type: 'select',
    options: [
      { value: 'Tier 1', label: 'Tier 1' },
      { value: 'Tier 2', label: 'Tier 2' },
      { value: 'Tier 3', label: 'Tier 3' },
      { value: 'Preferred', label: 'Preferred' },
      { value: 'Standard', label: 'Standard' },
    ],
  },
];

/* ─── Column Definitions ────────────────────────────────────────── */

function networkBadge(inNetwork: boolean) {
  const color = inNetwork ? '#22c55e' : '#f59e0b';
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
      }}
    >
      {inNetwork ? 'In-Network' : 'Out-of-Network'}
    </span>
  );
}

const networkColumns: ColumnDef<NetworkProvider>[] = [
  { id: 'providerName', header: 'Provider', accessor: (row) => row.providerName || row.providerId, sortable: true },
  { id: 'planName', header: 'Plan', accessor: (row) => row.planName || '—', sortable: true },
  { id: 'inNetwork', header: 'Network Status', accessor: (row) => networkBadge(row.inNetwork), sortable: true },
  { id: 'tier', header: 'Tier', accessor: (row) => row.tier || '—', sortable: true },
  {
    id: 'effectiveDate',
    header: 'Effective Date',
    accessor: (row) => row.effectiveDate ? new Date(row.effectiveDate).toLocaleDateString() : '—',
    sortable: true,
  },
  {
    id: 'terminationDate',
    header: 'Termination Date',
    accessor: (row) => row.terminationDate ? new Date(row.terminationDate).toLocaleDateString() : '—',
    sortable: true,
  },
];

/* ─── Create/Edit Dialog ────────────────────────────────────────── */

interface NetworkFormData {
  planId: string;
  providerId: string;
  inNetwork: string;
  tier: string;
  effectiveDate: string;
  terminationDate: string;
}

function NetworkFormDialog({
  initial,
  plans,
  onSubmit,
  onCancel,
  loading,
}: {
  initial?: NetworkProvider | null;
  plans: CoveragePlan[];
  onSubmit: (data: NetworkFormData) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<NetworkFormData>({
    planId: initial?.planId ?? '',
    providerId: initial?.providerId ?? '',
    inNetwork: initial?.inNetwork != null ? String(initial.inNetwork) : 'true',
    tier: initial?.tier ?? 'Tier 1',
    effectiveDate: initial?.effectiveDate ? initial.effectiveDate.split('T')[0] : '',
    terminationDate: initial?.terminationDate ? initial.terminationDate.split('T')[0] : '',
  });

  const update = (field: keyof NetworkFormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="confirm-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="network-form-title">
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, width: '90vw' }}>
        <h3 id="network-form-title" className="confirm-dialog-title">
          {initial ? 'Edit Network Provider' : 'Add Network Provider'}
        </h3>

        <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
          <label style={{ display: 'grid', gap: 4, fontSize: '0.84rem', fontWeight: 700 }}>
            Coverage Plan
            <select className="select" value={form.planId} onChange={(e) => update('planId', e.target.value)}>
              <option value="">Select plan...</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: '0.84rem', fontWeight: 700 }}>
            Provider ID
            <input className="input" value={form.providerId} onChange={(e) => update('providerId', e.target.value)} placeholder="Provider identifier" />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'grid', gap: 4, fontSize: '0.84rem', fontWeight: 700 }}>
              Network Status
              <select className="select" value={form.inNetwork} onChange={(e) => update('inNetwork', e.target.value)}>
                <option value="true">In-Network</option>
                <option value="false">Out-of-Network</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: '0.84rem', fontWeight: 700 }}>
              Tier
              <select className="select" value={form.tier} onChange={(e) => update('tier', e.target.value)}>
                <option value="Tier 1">Tier 1</option>
                <option value="Tier 2">Tier 2</option>
                <option value="Tier 3">Tier 3</option>
                <option value="Preferred">Preferred</option>
                <option value="Standard">Standard</option>
              </select>
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'grid', gap: 4, fontSize: '0.84rem', fontWeight: 700 }}>
              Effective Date
              <input className="input" type="date" value={form.effectiveDate} onChange={(e) => update('effectiveDate', e.target.value)} />
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: '0.84rem', fontWeight: 700 }}>
              Termination Date
              <input className="input" type="date" value={form.terminationDate} onChange={(e) => update('terminationDate', e.target.value)} />
            </label>
          </div>
        </div>

        <div className="confirm-dialog-actions" style={{ marginTop: 20 }}>
          <button className="button secondary" onClick={onCancel} disabled={loading}>Cancel</button>
          <LoadingButton
            variant="primary"
            isLoading={loading}
            onClick={() => onSubmit(form)}
            disabled={!form.planId || !form.providerId.trim() || !form.effectiveDate}
          >
            {initial ? 'Update' : 'Add'}
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page Component ───────────────────────────────────────── */

export default function NetworkProvidersPage() {
  const { toast } = useToast();

  // Table state
  const [items, setItems] = useState<NetworkProvider[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [tableLoading, setTableLoading] = useState(true);

  // Filter state
  const [filterValues, setFilterValues] = useState<Record<string, any>>({ inNetwork: '', tier: '' });

  // Plans for dropdown
  const [plans, setPlans] = useState<CoveragePlan[]>([]);

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<NetworkProvider | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NetworkProvider | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  /* ── Fetch plans for form ────────── */
  useEffect(() => {
    getCoveragePlans({ limit: 100 })
      .then((data) => setPlans(data.items || []))
      .catch(() => setPlans([]));
  }, []);

  /* ── Fetch network providers ──────── */
  const fetchItems = useCallback(async () => {
    setTableLoading(true);
    try {
      const params: Record<string, any> = {
        page,
        limit: pageSize,
        search: searchTerm || undefined,
        tier: filterValues.tier || undefined,
        sortBy: sortField || undefined,
        sortDir: sortField ? sortDir : undefined,
      };
      if (filterValues.inNetwork === 'true') params.inNetwork = true;
      else if (filterValues.inNetwork === 'false') params.inNetwork = false;

      const data = await getNetworkProviders(params);
      setItems(data.items || []);
      setTotalCount(data.total || 0);
    } catch {
      setItems([]);
      setTotalCount(0);
    } finally {
      setTableLoading(false);
    }
  }, [page, pageSize, searchTerm, sortField, sortDir, filterValues]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  /* ── Create/Update handler ────────── */
  const handleFormSubmit = useCallback(
    async (data: NetworkFormData) => {
      setFormLoading(true);
      try {
        const payload = {
          planId: data.planId,
          providerId: data.providerId,
          inNetwork: data.inNetwork === 'true',
          tier: data.tier,
          effectiveDate: data.effectiveDate,
          terminationDate: data.terminationDate || undefined,
        };

        if (editTarget) {
          await updateNetworkProvider(editTarget.id, payload);
          toast({ variant: 'success', title: 'Network provider updated', description: 'The record has been updated.' });
        } else {
          await createNetworkProvider(payload);
          toast({ variant: 'success', title: 'Network provider added', description: 'The provider has been added to the network.' });
        }
        setFormOpen(false);
        setEditTarget(null);
        fetchItems();
      } catch {
        toast({ variant: 'error', title: editTarget ? 'Update failed' : 'Create failed', description: 'Please try again.' });
      } finally {
        setFormLoading(false);
      }
    },
    [editTarget, toast, fetchItems]
  );

  /* ── Delete handler ───────────────── */
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteNetworkProvider(deleteTarget.id);
      toast({ variant: 'success', title: 'Network provider removed', description: 'The record has been deleted.' });
      setDeleteTarget(null);
      fetchItems();
    } catch {
      toast({ variant: 'error', title: 'Delete failed', description: 'Unable to delete. Please try again.' });
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteTarget, toast, fetchItems]);

  /* ── Columns with actions ─────────── */
  const columnsWithActions: ColumnDef<NetworkProvider>[] = [
    ...networkColumns,
    {
      id: 'actions',
      header: 'Actions',
      width: '160px',
      accessor: (row) => (
        <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
          <button
            className="button secondary"
            style={{ padding: '4px 10px', fontSize: '0.76rem', minHeight: 30 }}
            onClick={() => { setEditTarget(row); setFormOpen(true); }}
          >
            Edit
          </button>
          <button
            className="button secondary"
            style={{ padding: '4px 10px', fontSize: '0.76rem', minHeight: 30, color: 'var(--danger, #ef4444)' }}
            onClick={() => setDeleteTarget(row)}
          >
            Remove
          </button>
        </div>
      ),
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
  const handleFilterClear = useCallback(() => { setFilterValues({ inNetwork: '', tier: '' }); setPage(1); }, []);

  /* ── Render ────────────────────────── */
  return (
    <PortalShell currentPath="/portal/coverage">
      <div style={{ display: 'grid', gap: 24 }}>
        {/* Page Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Network Providers
          </h1>
          <button
            className="button primary"
            onClick={() => { setEditTarget(null); setFormOpen(true); }}
            style={{ minHeight: 40 }}
          >
            Add to Network
          </button>
        </div>

        {/* Main Content */}
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          <FilterPanel
            filters={networkFilters}
            values={filterValues}
            onChange={handleFilterChange}
            onApply={handleFilterApply}
            onClear={handleFilterClear}
          />

          <div style={{ flex: 1, minWidth: 0 }}>
            {items.length === 0 && !tableLoading ? (
              <EmptyState
                title="No network providers found"
                description="No network providers match the current filters. Try adjusting your criteria or add a new provider."
                actionLabel="Clear Filters"
                onAction={handleFilterClear}
              />
            ) : (
              <AdminDataTable
                columns={columnsWithActions}
                data={items}
                totalCount={totalCount}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
                onSort={handleSort}
                onSearch={handleSearch}
                searchable
                loading={tableLoading}
                exportFileName="network-providers-export"
                tableId="network-providers"
                emptyMessage="No network providers found."
              />
            )}
          </div>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      {formOpen && (
        <NetworkFormDialog
          initial={editTarget}
          plans={plans}
          onSubmit={handleFormSubmit}
          onCancel={() => { setFormOpen(false); setEditTarget(null); }}
          loading={formLoading}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          title="Remove Network Provider"
          description={`Are you sure you want to remove this provider from the network? This action cannot be undone.`}
          confirmLabel={deleteLoading ? 'Removing...' : 'Remove'}
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </PortalShell>
  );
}
