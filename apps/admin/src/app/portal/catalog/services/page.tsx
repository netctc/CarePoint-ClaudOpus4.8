'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PortalShell } from '@/components/layout/portal-shell';
import { FilterPanel, type FilterDefinition } from '@/components/ui/filter-panel';
import { AdminDataTable, type ColumnDef } from '@/components/ui/admin-data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingButton } from '@/components/ui/loading-button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { adminApi } from '@/lib/api-client';

/* ─── Types ─────────────────────────────────────────────────────── */

interface ServiceItem {
  id: string;
  name: string;
  category: string;
  providerType: string;
  status: string;
  price: string;
  specialty: string;
  template: string;
  durationMinutes: number;
  tags: string[];
}

interface DependencyNode {
  id: string;
  name: string;
  category: string;
  status: string;
}

interface DependencyGraph {
  service: { id: string; name: string };
  dependsOn: DependencyNode[];
  dependedBy: DependencyNode[];
}

/* ─── Filter Definitions ────────────────────────────────────────── */

const serviceFilters: FilterDefinition[] = [
  {
    id: 'category',
    label: 'Service Category',
    type: 'select',
    options: [
      { value: 'Primary Care', label: 'Primary Care' },
      { value: 'Specialty', label: 'Specialty' },
      { value: 'Diagnostic', label: 'Diagnostic' },
      { value: 'Therapeutic', label: 'Therapeutic' },
      { value: 'Preventive', label: 'Preventive' },
      { value: 'Emergency', label: 'Emergency' },
      { value: 'Mental Health', label: 'Mental Health' },
      { value: 'Telehealth', label: 'Telehealth' },
    ],
  },
  {
    id: 'providerType',
    label: 'Provider Type',
    type: 'select',
    options: [
      { value: 'Physician', label: 'Physician' },
      { value: 'Nurse', label: 'Nurse' },
      { value: 'Therapist', label: 'Therapist' },
      { value: 'Laboratory', label: 'Laboratory' },
      { value: 'Radiology', label: 'Radiology' },
      { value: 'Pharmacy', label: 'Pharmacy' },
    ],
  },
  {
    id: 'specialty',
    label: 'Specialty',
    type: 'text',
    placeholder: 'Search by specialty...',
  },
  {
    id: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'Active', label: 'Active' },
      { value: 'Draft', label: 'Draft' },
      { value: 'Archived', label: 'Archived' },
    ],
  },
];

/* ─── Column Definitions ────────────────────────────────────────── */

function statusBadge(status: string) {
  const colorMap: Record<string, string> = {
    Active: '#22c55e',
    PUBLISHED: '#22c55e',
    Draft: '#f59e0b',
    DRAFT: '#f59e0b',
    Archived: '#6b7280',
    ARCHIVED: '#6b7280',
  };
  const color = colorMap[status] || '#6b7280';
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
      {status}
    </span>
  );
}

const serviceColumns: ColumnDef<ServiceItem>[] = [
  { id: 'name', header: 'Service Name', accessor: (row) => row.name, sortable: true },
  { id: 'category', header: 'Category', accessor: (row) => row.category || '—', sortable: true },
  { id: 'providerType', header: 'Provider Type', accessor: (row) => row.providerType || '—', sortable: true },
  { id: 'status', header: 'Status', accessor: (row) => statusBadge(row.status), sortable: true },
  { id: 'price', header: 'Price', accessor: (row) => row.price || '—', sortable: true },
  { id: 'duration', header: 'Duration', accessor: (row) => row.durationMinutes ? `${row.durationMinutes} min` : '—', sortable: true },
  { id: 'specialty', header: 'Specialty', accessor: (row) => row.specialty || '—', sortable: true, hidden: true },
  { id: 'template', header: 'Template', accessor: (row) => row.template || '—', hidden: true },
];

/* ─── Dependencies Modal ────────────────────────────────────────── */

function DependenciesModal({ graph, onClose }: { graph: DependencyGraph; onClose: () => void }) {
  return (
    <div
      className="confirm-dialog-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="deps-modal-title"
    >
      <div
        className="confirm-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 600, width: '90vw' }}
      >
        <h3 id="deps-modal-title" className="confirm-dialog-title">
          Dependencies: {graph.service.name}
        </h3>

        <div style={{ marginTop: 16 }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 10px' }}>
            Depends On ({graph.dependsOn.length})
          </h4>
          {graph.dependsOn.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: '0.86rem' }}>No upstream dependencies.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
              {graph.dependsOn.map((dep) => (
                <li
                  key={dep.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: 'var(--surface, #f8fafc)',
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{dep.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{dep.category}</div>
                  </div>
                  {statusBadge(dep.status)}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ marginTop: 20 }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 10px' }}>
            Depended By ({graph.dependedBy.length})
          </h4>
          {graph.dependedBy.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: '0.86rem' }}>No downstream dependents.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
              {graph.dependedBy.map((dep) => (
                <li
                  key={dep.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: 'var(--surface, #f8fafc)',
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{dep.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{dep.category}</div>
                  </div>
                  {statusBadge(dep.status)}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="confirm-dialog-actions" style={{ marginTop: 20 }}>
          <button className="button secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page Component ───────────────────────────────────────── */

export default function ServiceCatalogPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Table state
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [tableLoading, setTableLoading] = useState(true);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter state
  const [filterValues, setFilterValues] = useState<Record<string, any>>({
    category: '',
    providerType: '',
    specialty: '',
    status: '',
  });

  // Modal/dialog state
  const [dependencyGraph, setDependencyGraph] = useState<DependencyGraph | null>(null);
  const [cloneTarget, setCloneTarget] = useState<ServiceItem | null>(null);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [archiving, setArchiving] = useState(false);

  /* ── Helper: get auth token ─────── */
  const getToken = () =>
    document.cookie.match(/cc_admin_access_token=([^;]+)/)?.[1] ||
    document.cookie.match(/cc_access_token=([^;]+)/)?.[1] ||
    '';

  const getBaseUrl = () => process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

  /* ── Fetch services ───────────────── */
  const fetchServices = useCallback(async () => {
    setTableLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(pageSize));
      if (searchTerm) params.set('search', searchTerm);
      if (sortField) {
        params.set('sortBy', sortField);
        params.set('sortDir', sortDir);
      }
      Object.entries(filterValues).forEach(([key, value]) => {
        if (value && typeof value === 'string' && value.trim()) {
          params.set(key, value);
        }
      });

      const res = await fetch(`${getBaseUrl()}/api/admin/catalog/services?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        const items: ServiceItem[] = (data.items || []).map((item: any) => ({
          id: item.id,
          name: item.name || item.serviceName || '—',
          category: item.category || '—',
          providerType: item.providerType || '—',
          status: item.status || 'Draft',
          price: item.price || item.priceFormatted || '—',
          specialty: item.specialty || '—',
          template: item.template || '—',
          durationMinutes: item.durationMinutes || 0,
          tags: item.tags || [],
        }));
        setServices(items);
        setTotalCount(data.total || items.length);
      } else {
        // Fallback to existing catalog API
        const fallback = await adminApi.catalogServices() as any;
        const items = Array.isArray(fallback) ? fallback : fallback?.items || [];
        const mapped: ServiceItem[] = items.map((s: any) => ({
          id: s.id,
          name: s.name || s.serviceName || '—',
          category: s.category || '—',
          providerType: s.providerType || '—',
          status: s.status || 'Draft',
          price: s.price || s.priceFormatted || '—',
          specialty: s.specialty || '—',
          template: s.template || '—',
          durationMinutes: s.durationMinutes || 0,
          tags: s.tags || [],
        }));
        setServices(mapped);
        setTotalCount(mapped.length);
      }
    } catch {
      setServices([]);
      setTotalCount(0);
    } finally {
      setTableLoading(false);
    }
  }, [page, pageSize, searchTerm, sortField, sortDir, filterValues]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  /* ── Inspect Dependencies ─────────── */
  const handleInspectDependencies = useCallback(async (service: ServiceItem) => {
    try {
      const res = await fetch(`${getBaseUrl()}/api/admin/catalog/services/${service.id}/dependencies`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setDependencyGraph(data);
      } else {
        // Fallback: show empty dependency graph
        setDependencyGraph({
          service: { id: service.id, name: service.name },
          dependsOn: [],
          dependedBy: [],
        });
      }
    } catch {
      setDependencyGraph({
        service: { id: service.id, name: service.name },
        dependsOn: [],
        dependedBy: [],
      });
    }
  }, []);

  /* ── Clone Service ────────────────── */
  const handleCloneConfirm = useCallback(async () => {
    if (!cloneTarget) return;
    setCloning(true);
    try {
      const res = await fetch(`${getBaseUrl()}/api/admin/catalog/services/${cloneTarget.id}/clone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        toast({ variant: 'success', title: 'Service cloned', description: `"${cloneTarget.name}" has been cloned successfully.` });
        setCloneTarget(null);
        if (data.id) {
          router.push(`/portal/catalog/services/${data.id}`);
        } else {
          fetchServices();
        }
      } else {
        toast({ variant: 'error', title: 'Clone failed', description: 'Unable to clone service. Please try again.' });
      }
    } catch {
      toast({ variant: 'error', title: 'Clone failed', description: 'Network error. Please try again.' });
    } finally {
      setCloning(false);
    }
  }, [cloneTarget, toast, router, fetchServices]);

  /* ── Archive Selected ─────────────── */
  const handleArchiveConfirm = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setArchiving(true);
    try {
      const res = await fetch(`${getBaseUrl()}/api/admin/catalog/services/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ serviceIds: Array.from(selectedIds) }),
      });
      if (res.ok) {
        toast({ variant: 'success', title: 'Services archived', description: `${selectedIds.size} service(s) archived successfully.` });
        setSelectedIds(new Set());
        setArchiveConfirm(false);
        fetchServices();
      } else {
        toast({ variant: 'error', title: 'Archive failed', description: 'Unable to archive services. Please try again.' });
      }
    } catch {
      toast({ variant: 'error', title: 'Archive failed', description: 'Network error. Please try again.' });
    } finally {
      setArchiving(false);
    }
  }, [selectedIds, toast, fetchServices]);

  /* ── Selection toggle ─────────────── */
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  /* ── Column with selection checkbox ── */
  const columnsWithSelect: ColumnDef<ServiceItem>[] = [
    {
      id: 'select',
      header: '✓',
      width: '44px',
      accessor: (row) => (
        <input
          type="checkbox"
          checked={selectedIds.has(row.id)}
          onChange={() => toggleSelection(row.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${row.name}`}
          style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
        />
      ),
    },
    ...serviceColumns,
    {
      id: 'actions',
      header: 'Actions',
      width: '180px',
      accessor: (row) => (
        <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
          <button
            className="button secondary"
            style={{ padding: '4px 10px', fontSize: '0.76rem', minHeight: 30 }}
            onClick={() => handleInspectDependencies(row)}
          >
            Dependencies
          </button>
          <button
            className="button secondary"
            style={{ padding: '4px 10px', fontSize: '0.76rem', minHeight: 30 }}
            onClick={() => setCloneTarget(row)}
          >
            Clone
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

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  }, []);

  const handleFilterChange = useCallback((values: Record<string, any>) => {
    setFilterValues(values);
  }, []);

  const handleFilterApply = useCallback(() => {
    setPage(1);
  }, []);

  const handleFilterClear = useCallback(() => {
    setFilterValues({ category: '', providerType: '', specialty: '', status: '' });
    setPage(1);
  }, []);

  /* ── Render ────────────────────────── */
  return (
    <PortalShell currentPath="/portal/catalog/services">
      <div style={{ display: 'grid', gap: 24 }}>
        {/* Page Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Service Catalog
          </h1>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <LoadingButton
              variant="secondary"
              disabled={selectedIds.size === 0}
              onClick={() => setArchiveConfirm(true)}
              isLoading={archiving}
            >
              Archive Selected ({selectedIds.size})
            </LoadingButton>
            <button
              className="button primary"
              onClick={() => router.push('/portal/catalog/services/create')}
              style={{ minHeight: 40 }}
            >
              Create Service
            </button>
          </div>
        </div>

        {/* Main Content: Filter Panel + Data Table */}
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          {/* Filter Panel */}
          <FilterPanel
            filters={serviceFilters}
            values={filterValues}
            onChange={handleFilterChange}
            onApply={handleFilterApply}
            onClear={handleFilterClear}
          />

          {/* Data Table */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {services.length === 0 && !tableLoading ? (
              <EmptyState
                title="No services found"
                description="No services match the current filters. Try adjusting your search criteria."
                actionLabel="Clear Filters"
                onAction={handleFilterClear}
              />
            ) : (
              <AdminDataTable
                columns={columnsWithSelect}
                data={services}
                totalCount={totalCount}
                page={page}
                pageSize={pageSize}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                onSort={handleSort}
                onSearch={handleSearch}
                searchable
                loading={tableLoading}
                exportFileName="service-catalog-export"
                tableId="service-catalog"
                emptyMessage="No services found matching your criteria."
              />
            )}
          </div>
        </div>
      </div>

      {/* Inspect Dependencies Modal (Task 13.2) */}
      {dependencyGraph && (
        <DependenciesModal graph={dependencyGraph} onClose={() => setDependencyGraph(null)} />
      )}

      {/* Clone Service Confirmation (Task 13.3) */}
      {cloneTarget && (
        <ConfirmDialog
          title="Clone Service"
          description={`Are you sure you want to clone "${cloneTarget.name}"? A new draft service will be created with the same configuration.`}
          confirmLabel={cloning ? 'Cloning...' : 'Clone'}
          cancelLabel="Cancel"
          onConfirm={handleCloneConfirm}
          onCancel={() => setCloneTarget(null)}
        />
      )}

      {/* Archive Confirmation */}
      {archiveConfirm && (
        <ConfirmDialog
          title="Archive Services"
          description={`Are you sure you want to archive ${selectedIds.size} selected service(s)? Archived services can be restored later.`}
          confirmLabel={archiving ? 'Archiving...' : 'Archive'}
          cancelLabel="Cancel"
          variant="warning"
          onConfirm={handleArchiveConfirm}
          onCancel={() => setArchiveConfirm(false)}
        />
      )}
    </PortalShell>
  );
}
