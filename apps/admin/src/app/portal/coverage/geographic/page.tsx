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
  getGeographicCoverage,
  createGeographicCoverage,
  updateGeographicCoverage,
  deleteGeographicCoverage,
  getCoveragePlans,
  type GeographicCoverage,
  type CoveragePlan,
} from '@/lib/api/coverage-api';

/* ─── Filter Definitions ────────────────────────────────────────── */

const geoFilters: FilterDefinition[] = [
  {
    id: 'country',
    label: 'Country',
    type: 'text',
    placeholder: 'Filter by country...',
  },
  {
    id: 'state',
    label: 'State',
    type: 'text',
    placeholder: 'Filter by state...',
  },
];

/* ─── Column Definitions ────────────────────────────────────────── */

const geoColumns: ColumnDef<GeographicCoverage>[] = [
  { id: 'planName', header: 'Plan', accessor: (row) => row.planName || '—', sortable: true },
  { id: 'country', header: 'Country', accessor: (row) => row.country, sortable: true },
  { id: 'state', header: 'State', accessor: (row) => row.state || '—', sortable: true },
  { id: 'city', header: 'City', accessor: (row) => row.city || '—', sortable: true },
  {
    id: 'zipCodes',
    header: 'Zip Codes',
    accessor: (row) => {
      const codes = row.zipCodes || [];
      if (codes.length === 0) return '—';
      if (codes.length <= 3) return codes.join(', ');
      return `${codes.slice(0, 3).join(', ')} +${codes.length - 3} more`;
    },
  },
  { id: 'radius', header: 'Radius (mi)', accessor: (row) => row.radius != null ? `${row.radius}` : '—', sortable: true },
];

/* ─── Create/Edit Dialog ────────────────────────────────────────── */

interface GeoFormData {
  planId: string;
  country: string;
  state: string;
  city: string;
  zipCodes: string;
  radius: string;
}

function GeoFormDialog({
  initial,
  plans,
  onSubmit,
  onCancel,
  loading,
}: {
  initial?: GeographicCoverage | null;
  plans: CoveragePlan[];
  onSubmit: (data: GeoFormData) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<GeoFormData>({
    planId: initial?.planId ?? '',
    country: initial?.country ?? '',
    state: initial?.state ?? '',
    city: initial?.city ?? '',
    zipCodes: initial?.zipCodes?.join(', ') ?? '',
    radius: initial?.radius != null ? String(initial.radius) : '',
  });

  const update = (field: keyof GeoFormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="confirm-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="geo-form-title">
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, width: '90vw' }}>
        <h3 id="geo-form-title" className="confirm-dialog-title">
          {initial ? 'Edit Geographic Coverage' : 'Create Geographic Coverage'}
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'grid', gap: 4, fontSize: '0.84rem', fontWeight: 700 }}>
              Country
              <input className="input" value={form.country} onChange={(e) => update('country', e.target.value)} placeholder="United States" />
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: '0.84rem', fontWeight: 700 }}>
              State
              <input className="input" value={form.state} onChange={(e) => update('state', e.target.value)} placeholder="California" />
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'grid', gap: 4, fontSize: '0.84rem', fontWeight: 700 }}>
              City
              <input className="input" value={form.city} onChange={(e) => update('city', e.target.value)} placeholder="Los Angeles" />
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: '0.84rem', fontWeight: 700 }}>
              Radius (miles)
              <input className="input" type="number" value={form.radius} onChange={(e) => update('radius', e.target.value)} placeholder="50" />
            </label>
          </div>
          <label style={{ display: 'grid', gap: 4, fontSize: '0.84rem', fontWeight: 700 }}>
            Zip Codes (comma-separated)
            <input className="input" value={form.zipCodes} onChange={(e) => update('zipCodes', e.target.value)} placeholder="90001, 90002, 90003" />
          </label>
        </div>

        <div className="confirm-dialog-actions" style={{ marginTop: 20 }}>
          <button className="button secondary" onClick={onCancel} disabled={loading}>Cancel</button>
          <LoadingButton
            variant="primary"
            isLoading={loading}
            onClick={() => onSubmit(form)}
            disabled={!form.planId || !form.country.trim()}
          >
            {initial ? 'Update' : 'Create'}
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page Component ───────────────────────────────────────── */

export default function GeographicCoveragePage() {
  const { toast } = useToast();

  // Table state
  const [items, setItems] = useState<GeographicCoverage[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [tableLoading, setTableLoading] = useState(true);

  // Filter state
  const [filterValues, setFilterValues] = useState<Record<string, any>>({ country: '', state: '' });

  // Plans for dropdown
  const [plans, setPlans] = useState<CoveragePlan[]>([]);

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<GeographicCoverage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GeographicCoverage | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  /* ── Fetch plans for form ────────── */
  useEffect(() => {
    getCoveragePlans({ limit: 100 })
      .then((data) => setPlans(data.items || []))
      .catch(() => setPlans([]));
  }, []);

  /* ── Fetch geographic coverage ────── */
  const fetchItems = useCallback(async () => {
    setTableLoading(true);
    try {
      const data = await getGeographicCoverage({
        page,
        limit: pageSize,
        search: searchTerm || undefined,
        country: filterValues.country || undefined,
        state: filterValues.state || undefined,
        sortBy: sortField || undefined,
        sortDir: sortField ? sortDir : undefined,
      });
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
    async (data: GeoFormData) => {
      setFormLoading(true);
      try {
        const zipCodes = data.zipCodes
          .split(',')
          .map((z) => z.trim())
          .filter(Boolean);

        const payload = {
          planId: data.planId,
          country: data.country,
          state: data.state,
          city: data.city,
          zipCodes,
          radius: data.radius ? Number(data.radius) : undefined,
        };

        if (editTarget) {
          await updateGeographicCoverage(editTarget.id, payload);
          toast({ variant: 'success', title: 'Coverage updated', description: 'Geographic coverage has been updated.' });
        } else {
          await createGeographicCoverage(payload);
          toast({ variant: 'success', title: 'Coverage created', description: 'Geographic coverage has been created.' });
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
      await deleteGeographicCoverage(deleteTarget.id);
      toast({ variant: 'success', title: 'Coverage deleted', description: 'Geographic coverage has been deleted.' });
      setDeleteTarget(null);
      fetchItems();
    } catch {
      toast({ variant: 'error', title: 'Delete failed', description: 'Unable to delete. Please try again.' });
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteTarget, toast, fetchItems]);

  /* ── Columns with actions ─────────── */
  const columnsWithActions: ColumnDef<GeographicCoverage>[] = [
    ...geoColumns,
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
  const handleFilterClear = useCallback(() => { setFilterValues({ country: '', state: '' }); setPage(1); }, []);

  /* ── Render ────────────────────────── */
  return (
    <PortalShell currentPath="/portal/coverage">
      <div style={{ display: 'grid', gap: 24 }}>
        {/* Page Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Geographic Coverage
          </h1>
          <button
            className="button primary"
            onClick={() => { setEditTarget(null); setFormOpen(true); }}
            style={{ minHeight: 40 }}
          >
            Add Coverage Area
          </button>
        </div>

        {/* Main Content */}
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          <FilterPanel
            filters={geoFilters}
            values={filterValues}
            onChange={handleFilterChange}
            onApply={handleFilterApply}
            onClear={handleFilterClear}
          />

          <div style={{ flex: 1, minWidth: 0 }}>
            {items.length === 0 && !tableLoading ? (
              <EmptyState
                title="No geographic coverage found"
                description="No coverage areas match the current filters. Try adjusting your criteria or add a new area."
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
                exportFileName="geographic-coverage-export"
                tableId="geographic-coverage"
                emptyMessage="No geographic coverage records found."
              />
            )}
          </div>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      {formOpen && (
        <GeoFormDialog
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
          title="Delete Geographic Coverage"
          description={`Are you sure you want to delete this coverage area (${deleteTarget.country}, ${deleteTarget.state})? This action cannot be undone.`}
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
