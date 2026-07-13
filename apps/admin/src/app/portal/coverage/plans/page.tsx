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
  getCoveragePlans,
  createCoveragePlan,
  updateCoveragePlan,
  deleteCoveragePlan,
  getInsuranceProviders,
  type CoveragePlan,
  type InsuranceProvider,
} from '@/lib/api/coverage-api';

/* ─── Filter Definitions ────────────────────────────────────────── */

const planFilters: FilterDefinition[] = [
  {
    id: 'type',
    label: 'Plan Type',
    type: 'select',
    options: [
      { value: 'Individual', label: 'Individual' },
      { value: 'Family', label: 'Family' },
      { value: 'Group', label: 'Group' },
      { value: 'Medicare', label: 'Medicare' },
      { value: 'Medicaid', label: 'Medicaid' },
    ],
  },
  {
    id: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'draft', label: 'Draft' },
    ],
  },
];

/* ─── Column Definitions ────────────────────────────────────────── */

function statusBadge(status: string) {
  const colorMap: Record<string, string> = {
    active: '#22c55e',
    inactive: '#6b7280',
    draft: '#f59e0b',
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

const planColumns: ColumnDef<CoveragePlan>[] = [
  { id: 'name', header: 'Plan Name', accessor: (row) => row.name, sortable: true },
  { id: 'insuranceProviderName', header: 'Insurance Provider', accessor: (row) => row.insuranceProviderName || '—', sortable: true },
  { id: 'type', header: 'Type', accessor: (row) => row.type || '—', sortable: true },
  { id: 'coverage', header: 'Coverage', accessor: (row) => row.coverage || '—' },
  { id: 'deductible', header: 'Deductible', accessor: (row) => row.deductible != null ? `$${row.deductible.toLocaleString()}` : '—', sortable: true },
  { id: 'copay', header: 'Copay', accessor: (row) => row.copay != null ? `$${row.copay}` : '—', sortable: true },
  { id: 'coinsurance', header: 'Coinsurance', accessor: (row) => row.coinsurance != null ? `${row.coinsurance}%` : '—' },
  { id: 'status', header: 'Status', accessor: (row) => statusBadge(row.status), sortable: true },
];

/* ─── Create/Edit Dialog ────────────────────────────────────────── */

interface PlanFormData {
  name: string;
  insuranceProviderId: string;
  type: string;
  coverage: string;
  deductible: string;
  copay: string;
  coinsurance: string;
  status: string;
}

function PlanFormDialog({
  initial,
  insuranceProviders,
  onSubmit,
  onCancel,
  loading,
}: {
  initial?: CoveragePlan | null;
  insuranceProviders: InsuranceProvider[];
  onSubmit: (data: PlanFormData) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<PlanFormData>({
    name: initial?.name ?? '',
    insuranceProviderId: initial?.insuranceProviderId ?? '',
    type: initial?.type ?? 'Individual',
    coverage: initial?.coverage ?? '',
    deductible: initial?.deductible != null ? String(initial.deductible) : '',
    copay: initial?.copay != null ? String(initial.copay) : '',
    coinsurance: initial?.coinsurance != null ? String(initial.coinsurance) : '',
    status: initial?.status ?? 'draft',
  });

  const update = (field: keyof PlanFormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="confirm-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="plan-form-title">
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, width: '90vw' }}>
        <h3 id="plan-form-title" className="confirm-dialog-title">
          {initial ? 'Edit Coverage Plan' : 'Create Coverage Plan'}
        </h3>

        <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
          <label style={{ display: 'grid', gap: 4, fontSize: '0.84rem', fontWeight: 700 }}>
            Plan Name
            <input className="input" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Plan name" />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: '0.84rem', fontWeight: 700 }}>
            Insurance Provider
            <select className="select" value={form.insuranceProviderId} onChange={(e) => update('insuranceProviderId', e.target.value)}>
              <option value="">Select provider...</option>
              {insuranceProviders.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'grid', gap: 4, fontSize: '0.84rem', fontWeight: 700 }}>
              Type
              <select className="select" value={form.type} onChange={(e) => update('type', e.target.value)}>
                <option value="Individual">Individual</option>
                <option value="Family">Family</option>
                <option value="Group">Group</option>
                <option value="Medicare">Medicare</option>
                <option value="Medicaid">Medicaid</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: '0.84rem', fontWeight: 700 }}>
              Status
              <select className="select" value={form.status} onChange={(e) => update('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="draft">Draft</option>
              </select>
            </label>
          </div>
          <label style={{ display: 'grid', gap: 4, fontSize: '0.84rem', fontWeight: 700 }}>
            Coverage Description
            <input className="input" value={form.coverage} onChange={(e) => update('coverage', e.target.value)} placeholder="Coverage details" />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <label style={{ display: 'grid', gap: 4, fontSize: '0.84rem', fontWeight: 700 }}>
              Deductible ($)
              <input className="input" type="number" value={form.deductible} onChange={(e) => update('deductible', e.target.value)} placeholder="0" />
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: '0.84rem', fontWeight: 700 }}>
              Copay ($)
              <input className="input" type="number" value={form.copay} onChange={(e) => update('copay', e.target.value)} placeholder="0" />
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: '0.84rem', fontWeight: 700 }}>
              Coinsurance (%)
              <input className="input" type="number" value={form.coinsurance} onChange={(e) => update('coinsurance', e.target.value)} placeholder="0" />
            </label>
          </div>
        </div>

        <div className="confirm-dialog-actions" style={{ marginTop: 20 }}>
          <button className="button secondary" onClick={onCancel} disabled={loading}>Cancel</button>
          <LoadingButton
            variant="primary"
            isLoading={loading}
            onClick={() => onSubmit(form)}
            disabled={!form.name.trim() || !form.insuranceProviderId}
          >
            {initial ? 'Update' : 'Create'}
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page Component ───────────────────────────────────────── */

export default function CoveragePlansPage() {
  const { toast } = useToast();

  // Table state
  const [plans, setPlans] = useState<CoveragePlan[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [tableLoading, setTableLoading] = useState(true);

  // Filter state
  const [filterValues, setFilterValues] = useState<Record<string, any>>({ type: '', status: '' });

  // Insurance providers for dropdown
  const [insuranceProviders, setInsuranceProviders] = useState<InsuranceProvider[]>([]);

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CoveragePlan | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CoveragePlan | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  /* ── Fetch insurance providers for form ── */
  useEffect(() => {
    getInsuranceProviders({ limit: 100 })
      .then((data) => setInsuranceProviders(data.items || []))
      .catch(() => setInsuranceProviders([]));
  }, []);

  /* ── Fetch plans ──────────────────── */
  const fetchPlans = useCallback(async () => {
    setTableLoading(true);
    try {
      const data = await getCoveragePlans({
        page,
        limit: pageSize,
        search: searchTerm || undefined,
        status: filterValues.status || undefined,
        type: filterValues.type || undefined,
        sortBy: sortField || undefined,
        sortDir: sortField ? sortDir : undefined,
      });
      setPlans(data.items || []);
      setTotalCount(data.total || 0);
    } catch {
      setPlans([]);
      setTotalCount(0);
    } finally {
      setTableLoading(false);
    }
  }, [page, pageSize, searchTerm, sortField, sortDir, filterValues]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  /* ── Create/Update handler ────────── */
  const handleFormSubmit = useCallback(
    async (data: PlanFormData) => {
      setFormLoading(true);
      try {
        const payload = {
          name: data.name,
          insuranceProviderId: data.insuranceProviderId,
          type: data.type,
          coverage: data.coverage,
          deductible: Number(data.deductible) || 0,
          copay: Number(data.copay) || 0,
          coinsurance: Number(data.coinsurance) || 0,
          status: data.status,
        };

        if (editTarget) {
          await updateCoveragePlan(editTarget.id, payload);
          toast({ variant: 'success', title: 'Plan updated', description: `"${data.name}" has been updated.` });
        } else {
          await createCoveragePlan(payload);
          toast({ variant: 'success', title: 'Plan created', description: `"${data.name}" has been created.` });
        }
        setFormOpen(false);
        setEditTarget(null);
        fetchPlans();
      } catch {
        toast({ variant: 'error', title: editTarget ? 'Update failed' : 'Create failed', description: 'Please try again.' });
      } finally {
        setFormLoading(false);
      }
    },
    [editTarget, toast, fetchPlans]
  );

  /* ── Delete handler ───────────────── */
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteCoveragePlan(deleteTarget.id);
      toast({ variant: 'success', title: 'Plan deleted', description: `"${deleteTarget.name}" has been deleted.` });
      setDeleteTarget(null);
      fetchPlans();
    } catch {
      toast({ variant: 'error', title: 'Delete failed', description: 'Unable to delete plan. Please try again.' });
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteTarget, toast, fetchPlans]);

  /* ── Column with actions ──────────── */
  const columnsWithActions: ColumnDef<CoveragePlan>[] = [
    ...planColumns,
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

  const handleSearch = useCallback((term: string) => { setSearchTerm(term); setPage(1); }, []);
  const handleFilterChange = useCallback((values: Record<string, any>) => { setFilterValues(values); }, []);
  const handleFilterApply = useCallback(() => { setPage(1); }, []);
  const handleFilterClear = useCallback(() => { setFilterValues({ type: '', status: '' }); setPage(1); }, []);

  /* ── Render ────────────────────────── */
  return (
    <PortalShell currentPath="/portal/coverage">
      <div style={{ display: 'grid', gap: 24 }}>
        {/* Page Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Coverage Plans
          </h1>
          <button
            className="button primary"
            onClick={() => { setEditTarget(null); setFormOpen(true); }}
            style={{ minHeight: 40 }}
          >
            Create Plan
          </button>
        </div>

        {/* Main Content */}
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          <FilterPanel
            filters={planFilters}
            values={filterValues}
            onChange={handleFilterChange}
            onApply={handleFilterApply}
            onClear={handleFilterClear}
          />

          <div style={{ flex: 1, minWidth: 0 }}>
            {plans.length === 0 && !tableLoading ? (
              <EmptyState
                title="No coverage plans found"
                description="No plans match the current filters. Try adjusting your criteria or create a new plan."
                actionLabel="Clear Filters"
                onAction={handleFilterClear}
              />
            ) : (
              <AdminDataTable
                columns={columnsWithActions}
                data={plans}
                totalCount={totalCount}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
                onSort={handleSort}
                onSearch={handleSearch}
                searchable
                loading={tableLoading}
                exportFileName="coverage-plans-export"
                tableId="coverage-plans"
                emptyMessage="No coverage plans found."
              />
            )}
          </div>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      {formOpen && (
        <PlanFormDialog
          initial={editTarget}
          insuranceProviders={insuranceProviders}
          onSubmit={handleFormSubmit}
          onCancel={() => { setFormOpen(false); setEditTarget(null); }}
          loading={formLoading}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Coverage Plan"
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
