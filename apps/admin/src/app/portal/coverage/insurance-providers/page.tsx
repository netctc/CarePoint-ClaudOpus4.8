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
  getInsuranceProviders,
  createInsuranceProvider,
  updateInsuranceProvider,
  deleteInsuranceProvider,
  type InsuranceProvider,
} from '@/lib/api/coverage-api';

/* ─── Filter Definitions ────────────────────────────────────────── */

const providerFilters: FilterDefinition[] = [
  {
    id: 'type',
    label: 'Provider Type',
    type: 'select',
    options: [
      { value: 'HMO', label: 'HMO' },
      { value: 'PPO', label: 'PPO' },
      { value: 'EPO', label: 'EPO' },
      { value: 'POS', label: 'POS' },
      { value: 'Medicare', label: 'Medicare' },
      { value: 'Medicaid', label: 'Medicaid' },
      { value: 'Other', label: 'Other' },
    ],
  },
  {
    id: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'pending', label: 'Pending' },
    ],
  },
];

/* ─── Column Definitions ────────────────────────────────────────── */

function statusBadge(status: string) {
  const colorMap: Record<string, string> = {
    active: '#22c55e',
    inactive: '#6b7280',
    pending: '#f59e0b',
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

const providerColumns: ColumnDef<InsuranceProvider>[] = [
  { id: 'name', header: 'Provider Name', accessor: (row) => row.name, sortable: true },
  { id: 'code', header: 'Code', accessor: (row) => row.code, sortable: true },
  { id: 'type', header: 'Type', accessor: (row) => row.type || '—', sortable: true },
  { id: 'status', header: 'Status', accessor: (row) => statusBadge(row.status), sortable: true },
  {
    id: 'contact',
    header: 'Contact',
    accessor: (row) => row.contactInfo?.email || row.contactInfo?.phone || '—',
  },
];

/* ─── Create/Edit Dialog ────────────────────────────────────────── */

interface ProviderFormData {
  name: string;
  code: string;
  type: string;
  status: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
}

function ProviderFormDialog({
  initial,
  onSubmit,
  onCancel,
  loading,
}: {
  initial?: InsuranceProvider | null;
  onSubmit: (data: ProviderFormData) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<ProviderFormData>({
    name: initial?.name ?? '',
    code: initial?.code ?? '',
    type: initial?.type ?? 'PPO',
    status: initial?.status ?? 'active',
    contactEmail: initial?.contactInfo?.email ?? '',
    contactPhone: initial?.contactInfo?.phone ?? '',
    contactAddress: initial?.contactInfo?.address ?? '',
  });

  const update = (field: keyof ProviderFormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="confirm-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="provider-form-title">
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, width: '90vw' }}>
        <h3 id="provider-form-title" className="confirm-dialog-title">
          {initial ? 'Edit Insurance Provider' : 'Create Insurance Provider'}
        </h3>

        <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
          <label style={{ display: 'grid', gap: 4, fontSize: '0.84rem', fontWeight: 700 }}>
            Name
            <input className="input" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Provider name" />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: '0.84rem', fontWeight: 700 }}>
            Code
            <input className="input" value={form.code} onChange={(e) => update('code', e.target.value)} placeholder="Provider code" />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'grid', gap: 4, fontSize: '0.84rem', fontWeight: 700 }}>
              Type
              <select className="select" value={form.type} onChange={(e) => update('type', e.target.value)}>
                <option value="HMO">HMO</option>
                <option value="PPO">PPO</option>
                <option value="EPO">EPO</option>
                <option value="POS">POS</option>
                <option value="Medicare">Medicare</option>
                <option value="Medicaid">Medicaid</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: '0.84rem', fontWeight: 700 }}>
              Status
              <select className="select" value={form.status} onChange={(e) => update('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
              </select>
            </label>
          </div>
          <label style={{ display: 'grid', gap: 4, fontSize: '0.84rem', fontWeight: 700 }}>
            Email
            <input className="input" type="email" value={form.contactEmail} onChange={(e) => update('contactEmail', e.target.value)} placeholder="contact@provider.com" />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: '0.84rem', fontWeight: 700 }}>
            Phone
            <input className="input" value={form.contactPhone} onChange={(e) => update('contactPhone', e.target.value)} placeholder="+1 (555) 000-0000" />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: '0.84rem', fontWeight: 700 }}>
            Address
            <input className="input" value={form.contactAddress} onChange={(e) => update('contactAddress', e.target.value)} placeholder="123 Main St, City, State" />
          </label>
        </div>

        <div className="confirm-dialog-actions" style={{ marginTop: 20 }}>
          <button className="button secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <LoadingButton
            variant="primary"
            isLoading={loading}
            onClick={() => onSubmit(form)}
            disabled={!form.name.trim() || !form.code.trim()}
          >
            {initial ? 'Update' : 'Create'}
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page Component ───────────────────────────────────────── */

export default function InsuranceProvidersPage() {
  const { toast } = useToast();

  // Table state
  const [providers, setProviders] = useState<InsuranceProvider[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [tableLoading, setTableLoading] = useState(true);

  // Filter state
  const [filterValues, setFilterValues] = useState<Record<string, any>>({ type: '', status: '' });

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<InsuranceProvider | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InsuranceProvider | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  /* ── Fetch providers ──────────────── */
  const fetchProviders = useCallback(async () => {
    setTableLoading(true);
    try {
      const data = await getInsuranceProviders({
        page,
        limit: pageSize,
        search: searchTerm || undefined,
        status: filterValues.status || undefined,
        type: filterValues.type || undefined,
        sortBy: sortField || undefined,
        sortDir: sortField ? sortDir : undefined,
      });
      setProviders(data.items || []);
      setTotalCount(data.total || 0);
    } catch {
      setProviders([]);
      setTotalCount(0);
    } finally {
      setTableLoading(false);
    }
  }, [page, pageSize, searchTerm, sortField, sortDir, filterValues]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  /* ── Create/Update handler ────────── */
  const handleFormSubmit = useCallback(
    async (data: ProviderFormData) => {
      setFormLoading(true);
      try {
        const payload = {
          name: data.name,
          code: data.code,
          type: data.type,
          status: data.status,
          contactInfo: {
            email: data.contactEmail || undefined,
            phone: data.contactPhone || undefined,
            address: data.contactAddress || undefined,
          },
        };

        if (editTarget) {
          await updateInsuranceProvider(editTarget.id, payload);
          toast({ variant: 'success', title: 'Provider updated', description: `"${data.name}" has been updated.` });
        } else {
          await createInsuranceProvider(payload);
          toast({ variant: 'success', title: 'Provider created', description: `"${data.name}" has been created.` });
        }
        setFormOpen(false);
        setEditTarget(null);
        fetchProviders();
      } catch {
        toast({ variant: 'error', title: editTarget ? 'Update failed' : 'Create failed', description: 'Please try again.' });
      } finally {
        setFormLoading(false);
      }
    },
    [editTarget, toast, fetchProviders]
  );

  /* ── Delete handler ───────────────── */
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteInsuranceProvider(deleteTarget.id);
      toast({ variant: 'success', title: 'Provider deleted', description: `"${deleteTarget.name}" has been deleted.` });
      setDeleteTarget(null);
      fetchProviders();
    } catch {
      toast({ variant: 'error', title: 'Delete failed', description: 'Unable to delete provider. Please try again.' });
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteTarget, toast, fetchProviders]);

  /* ── Column with actions ──────────── */
  const columnsWithActions: ColumnDef<InsuranceProvider>[] = [
    ...providerColumns,
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
            Delete
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

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
    setPage(1);
  }, []);

  const handleFilterChange = useCallback((values: Record<string, any>) => {
    setFilterValues(values);
  }, []);

  const handleFilterApply = useCallback(() => { setPage(1); }, []);
  const handleFilterClear = useCallback(() => { setFilterValues({ type: '', status: '' }); setPage(1); }, []);

  /* ── Render ────────────────────────── */
  return (
    <PortalShell currentPath="/portal/coverage">
      <div style={{ display: 'grid', gap: 24 }}>
        {/* Page Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Insurance Providers
          </h1>
          <button
            className="button primary"
            onClick={() => { setEditTarget(null); setFormOpen(true); }}
            style={{ minHeight: 40 }}
          >
            Add Provider
          </button>
        </div>

        {/* Main Content */}
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          <FilterPanel
            filters={providerFilters}
            values={filterValues}
            onChange={handleFilterChange}
            onApply={handleFilterApply}
            onClear={handleFilterClear}
          />

          <div style={{ flex: 1, minWidth: 0 }}>
            {providers.length === 0 && !tableLoading ? (
              <EmptyState
                title="No insurance providers found"
                description="No providers match the current filters. Try adjusting your criteria or add a new provider."
                actionLabel="Clear Filters"
                onAction={handleFilterClear}
              />
            ) : (
              <AdminDataTable
                columns={columnsWithActions}
                data={providers}
                totalCount={totalCount}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
                onSort={handleSort}
                onSearch={handleSearch}
                searchable
                loading={tableLoading}
                exportFileName="insurance-providers-export"
                tableId="insurance-providers"
                emptyMessage="No insurance providers found."
              />
            )}
          </div>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      {formOpen && (
        <ProviderFormDialog
          initial={editTarget}
          onSubmit={handleFormSubmit}
          onCancel={() => { setFormOpen(false); setEditTarget(null); }}
          loading={formLoading}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Insurance Provider"
          description={`Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`}
          confirmLabel={deleteLoading ? 'Deleting...' : 'Delete'}
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </PortalShell>
  );
}
