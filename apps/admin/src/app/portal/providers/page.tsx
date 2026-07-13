'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatsGrid, type StatItem } from '@/components/ui/stats-grid';
import { FilterPanel, type FilterDefinition } from '@/components/ui/filter-panel';
import { AdminDataTable, type ColumnDef } from '@/components/ui/admin-data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { adminApi } from '@/lib/api-client';

/* ─── Types ─────────────────────────────────────────────────────── */

interface ProviderStatistics {
  totalProviders: number;
  activeCount: number;
  onlineCount: number;
  availableTodayCount: number;
  avgRating: number;
  avgAppointmentDuration: number;
  cancellationRate: number;
  patientSatisfaction: number;
}

interface ProviderItem {
  id: string;
  name: string;
  email: string;
  specialty: string;
  status: 'active' | 'inactive';
  role: string;
  type: string;
  verified: boolean;
  acceptingNewPatients: boolean;
  currentlyOnline: boolean;
  availableToday: boolean;
  fullyBooked: boolean;
  createdAt: string;
}

interface ProvidersResponse {
  items: ProviderItem[];
  total: number;
  page: number;
  limit: number;
}

/* ─── Filter Definitions ────────────────────────────────────────── */

const providerFilters: FilterDefinition[] = [
  {
    id: 'name',
    label: 'Provider Name',
    type: 'text',
    placeholder: 'Search by name...',
  },
  {
    id: 'type',
    label: 'Provider Type',
    type: 'select',
    options: [
      { value: 'Physician', label: 'Physician' },
      { value: 'Nurse', label: 'Nurse' },
      { value: 'Therapist', label: 'Therapist' },
      { value: 'Laboratory', label: 'Laboratory' },
      { value: 'Radiology', label: 'Radiology' },
      { value: 'Pharmacy', label: 'Pharmacy' },
      { value: 'HomeCare', label: 'Home Care' },
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
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
    ],
  },
  {
    id: 'verified',
    label: 'Verified',
    type: 'select',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
  },
  {
    id: 'acceptingNewPatients',
    label: 'Accepting New Patients',
    type: 'select',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
  },
  {
    id: 'calendarAvailability',
    label: 'Calendar Availability',
    type: 'select',
    options: [
      { value: 'available', label: 'Available' },
      { value: 'fullyBooked', label: 'Fully Booked' },
    ],
  },
];

/* ─── Status Badge Component ────────────────────────────────────── */

function ProviderStatusBadges({ provider }: { provider: ProviderItem }) {
  const badges: { label: string; color: string; pulse?: boolean; outline?: boolean }[] = [];

  if (provider.status === 'active') {
    badges.push({ label: 'Active', color: '#22c55e' });
  } else {
    badges.push({ label: 'Inactive', color: '#6b7280' });
  }

  if (provider.currentlyOnline) {
    badges.push({ label: 'Online', color: '#3b82f6', pulse: true });
  }

  if (provider.availableToday && !provider.fullyBooked) {
    badges.push({ label: 'Available Today', color: '#22c55e', outline: true });
  }

  if (provider.fullyBooked) {
    badges.push({ label: 'Fully Booked', color: '#f97316' });
  }

  if (provider.acceptingNewPatients) {
    badges.push({ label: 'New Patients', color: '#14b8a6' });
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {badges.map((badge) => (
        <span
          key={badge.label}
          className={badge.pulse ? 'badge-pulse' : undefined}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 12,
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '0.01em',
            whiteSpace: 'nowrap',
            background: badge.outline ? 'transparent' : `${badge.color}18`,
            color: badge.color,
            border: badge.outline ? `1.5px solid ${badge.color}` : `1px solid ${badge.color}30`,
          }}
        >
          {badge.pulse && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: badge.color,
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          )}
          {badge.label}
        </span>
      ))}
    </div>
  );
}

/* ─── Column Definitions ────────────────────────────────────────── */

const providerColumns: ColumnDef<ProviderItem>[] = [
  {
    id: 'name',
    header: 'Name',
    accessor: (row) => row.name,
    sortable: true,
  },
  {
    id: 'email',
    header: 'Email',
    accessor: (row) => row.email,
    sortable: true,
  },
  {
    id: 'specialty',
    header: 'Specialty',
    accessor: (row) => row.specialty || '—',
    sortable: true,
  },
  {
    id: 'status',
    header: 'Status',
    accessor: (row) => (
      <span
        style={{
          display: 'inline-block',
          padding: '2px 10px',
          borderRadius: 12,
          fontSize: '0.78rem',
          fontWeight: 700,
          background: row.status === 'active' ? '#22c55e18' : '#6b728018',
          color: row.status === 'active' ? '#22c55e' : '#6b7280',
        }}
      >
        {row.status === 'active' ? 'Active' : 'Inactive'}
      </span>
    ),
    sortable: true,
  },
  {
    id: 'role',
    header: 'Role',
    accessor: (row) => row.type || row.role || '—',
    sortable: true,
  },
  {
    id: 'indicators',
    header: 'Status Indicators',
    accessor: (row) => <ProviderStatusBadges provider={row} />,
    width: '220px',
  },
  {
    id: 'createdAt',
    header: 'Created At',
    accessor: (row) => {
      try {
        return new Date(row.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      } catch {
        return '—';
      }
    },
    sortable: true,
  },
];

/* ─── Main Page Component ───────────────────────────────────────── */

export default function ProvidersPage() {
  const router = useRouter();

  // Stats state
  const [stats, setStats] = useState<ProviderStatistics | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Table state
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [tableLoading, setTableLoading] = useState(true);

  // Filter state
  const [filterValues, setFilterValues] = useState<Record<string, any>>({
    name: '',
    type: '',
    specialty: '',
    status: '',
    verified: '',
    acceptingNewPatients: '',
    calendarAvailability: '',
  });

  /* ── Fetch statistics ─────────────── */
  useEffect(() => {
    setStatsLoading(true);
    adminApi
      .providers()
      .then(() => {
        // Attempt to fetch statistics from the dedicated endpoint
        return fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000'}/api/admin/providers/statistics`,
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${document.cookie.match(/cc_admin_access_token=([^;]+)/)?.[1] || document.cookie.match(/cc_access_token=([^;]+)/)?.[1] || ''}`,
            },
          }
        );
      })
      .then((res) => {
        if (res && res.ok) return res.json();
        // Fallback statistics
        return {
          totalProviders: 0,
          activeCount: 0,
          onlineCount: 0,
          availableTodayCount: 0,
          avgRating: 0,
          avgAppointmentDuration: 0,
          cancellationRate: 0,
          patientSatisfaction: 0,
        };
      })
      .then((data: ProviderStatistics) => {
        setStats(data);
      })
      .catch(() => {
        setStats({
          totalProviders: 0,
          activeCount: 0,
          onlineCount: 0,
          availableTodayCount: 0,
          avgRating: 0,
          avgAppointmentDuration: 0,
          cancellationRate: 0,
          patientSatisfaction: 0,
        });
      })
      .finally(() => setStatsLoading(false));
  }, []);

  /* ── Fetch providers ──────────────── */
  const fetchProviders = useCallback(async () => {
    setTableLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(pageSize));
      if (searchTerm) params.set('name', searchTerm);
      if (sortField) {
        params.set('sortBy', sortField);
        params.set('sortDir', sortDir);
      }

      // Apply filters
      Object.entries(filterValues).forEach(([key, value]) => {
        if (value && typeof value === 'string' && value.trim()) {
          params.set(key, value);
        }
      });

      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
      const token =
        document.cookie.match(/cc_admin_access_token=([^;]+)/)?.[1] ||
        document.cookie.match(/cc_access_token=([^;]+)/)?.[1] ||
        '';

      const res = await fetch(`${baseUrl}/api/admin/providers?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data: ProvidersResponse = await res.json();
        setProviders(data.items || []);
        setTotalCount(data.total || 0);
      } else {
        // Fallback: try the existing providers endpoint
        const fallbackRes = await adminApi.providers() as any;
        const items = Array.isArray(fallbackRes) ? fallbackRes : fallbackRes?.items || [];
        const mapped: ProviderItem[] = items.map((p: any) => ({
          id: p.id,
          name: p.name || p.providerName || '—',
          email: p.email || p.organizationName || '—',
          specialty: p.specialty || '—',
          status: (p.status || p.operatingStatus || '').toLowerCase().includes('active') ? 'active' as const : 'inactive' as const,
          role: p.role || 'Provider',
          type: p.type || p.providerType || 'Provider',
          verified: p.verified ?? true,
          acceptingNewPatients: p.acceptingNewPatients ?? false,
          currentlyOnline: p.currentlyOnline ?? false,
          availableToday: p.availableToday ?? false,
          fullyBooked: p.fullyBooked ?? false,
          createdAt: p.createdAt || p.lastReviewedAt || new Date().toISOString(),
        }));
        setProviders(mapped);
        setTotalCount(mapped.length);
      }
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

  /* ── Stats items ──────────────────── */
  const statsItems: StatItem[] = stats
    ? [
        { label: 'Total Providers', value: stats.totalProviders },
        { label: 'Active', value: stats.activeCount },
        { label: 'Online', value: stats.onlineCount },
        { label: 'Available Today', value: stats.availableTodayCount },
        { label: 'Avg Rating', value: stats.avgRating.toFixed(1) },
        { label: 'Avg Appointment Duration', value: `${stats.avgAppointmentDuration}m` },
        { label: 'Cancellation Rate', value: `${stats.cancellationRate}%` },
        { label: 'Patient Satisfaction', value: `${stats.patientSatisfaction}%` },
      ]
    : [];

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
    // fetchProviders will be triggered by the dependency change
  }, []);

  const handleFilterClear = useCallback(() => {
    setFilterValues({
      name: '',
      type: '',
      specialty: '',
      status: '',
      verified: '',
      acceptingNewPatients: '',
      calendarAvailability: '',
    });
    setPage(1);
  }, []);

  const handleRowClick = useCallback(
    (provider: ProviderItem) => {
      router.push(`/portal/providers/${provider.id}`);
    },
    [router]
  );

  /* ── Render ────────────────────────── */
  return (
    <PortalShell currentPath="/portal/providers">
      <div style={{ display: 'grid', gap: 24 }}>
        {/* Page Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Provider Management Center
          </h1>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="button primary"
              onClick={() => router.push('/portal/providers/onboarding')}
              style={{ minHeight: 40 }}
            >
              Add Provider
            </button>
            <button
              className="button secondary"
              onClick={() => {
                // Trigger export from the table's built-in export feature
                const exportBtn = document.querySelector('[aria-haspopup="true"][class*="secondary"]');
                if (exportBtn) (exportBtn as HTMLButtonElement).click();
              }}
              style={{ minHeight: 40 }}
            >
              Export
            </button>
          </div>
        </div>

        {/* Statistics Grid */}
        <StatsGrid items={statsItems} loading={statsLoading} />

        {/* Main Content: Filter Panel + Data Table */}
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          {/* Filter Panel */}
          <FilterPanel
            filters={providerFilters}
            values={filterValues}
            onChange={handleFilterChange}
            onApply={handleFilterApply}
            onClear={handleFilterClear}
          />

          {/* Data Table */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {providers.length === 0 && !tableLoading ? (
              <EmptyState
                title="No providers found"
                description="No providers match the current filters. Try adjusting your search criteria."
                actionLabel="Clear Filters"
                onAction={handleFilterClear}
              />
            ) : (
              <ProviderDataTable
                providers={providers}
                totalCount={totalCount}
                page={page}
                pageSize={pageSize}
                loading={tableLoading}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                onSort={handleSort}
                onSearch={handleSearch}
                onRowClick={handleRowClick}
              />
            )}
          </div>
        </div>
      </div>

      {/* Pulse animation for online badge */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </PortalShell>
  );
}

/* ─── Provider Data Table Wrapper (adds row click) ──────────────── */

interface ProviderDataTableProps {
  providers: ProviderItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  loading: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onSort: (columnId: string, direction: 'asc' | 'desc') => void;
  onSearch: (term: string) => void;
  onRowClick: (provider: ProviderItem) => void;
}

function ProviderDataTable({
  providers,
  totalCount,
  page,
  pageSize,
  loading,
  onPageChange,
  onPageSizeChange,
  onSort,
  onSearch,
  onRowClick,
}: ProviderDataTableProps) {
  // Wrap columns to add click handler via a clickable row approach
  const clickableColumns: ColumnDef<ProviderItem>[] = providerColumns.map((col) => ({
    ...col,
    accessor: (row: ProviderItem) => (
      <div
        onClick={() => onRowClick(row)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onRowClick(row);
          }
        }}
        role="button"
        tabIndex={0}
        style={{ cursor: 'pointer' }}
        aria-label={`View provider ${row.name}`}
      >
        {col.accessor(row)}
      </div>
    ),
  }));

  return (
    <AdminDataTable
      columns={clickableColumns}
      data={providers}
      totalCount={totalCount}
      page={page}
      pageSize={pageSize}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      onSort={onSort}
      onSearch={onSearch}
      searchable
      loading={loading}
      exportFileName="providers-export"
      tableId="provider-management"
      emptyMessage="No providers found matching your criteria."
    />
  );
}
