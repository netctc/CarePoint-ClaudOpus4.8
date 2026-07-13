'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatsGrid, type StatItem } from '@/components/ui/stats-grid';
import { FilterPanel, type FilterDefinition } from '@/components/ui/filter-panel';
import { AdminDataTable, type ColumnDef } from '@/components/ui/admin-data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { adminApi } from '@/lib/api-client';

/* ─── Types ─────────────────────────────────────────────────────── */

interface BookingItem {
  id: string;
  patientId: string;
  patientName: string;
  patientEmail: string | null;
  providerId: string;
  providerName: string;
  providerEmail: string | null;
  service: string;
  location: string | null;
  status: string;
  startsAt: string;
  endsAt: string;
  mode: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BookingStats {
  totalBookings: number;
  upcoming: number;
  completed: number;
  cancelled: number;
  rescheduled: number;
  noShows: number;
  avgWaitingTime: number;
  successRate: number;
}

/* ─── Filter Definitions ────────────────────────────────────────── */

const filterDefs: FilterDefinition[] = [
  { id: 'dateRange', label: 'Date Range', type: 'date-range' },
  { id: 'provider', label: 'Provider', type: 'text', placeholder: 'Provider ID...' },
  { id: 'patient', label: 'Patient', type: 'text', placeholder: 'Patient ID...' },
  {
    id: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'REQUESTED', label: 'Requested' },
      { value: 'CONFIRMED', label: 'Confirmed' },
      { value: 'COMPLETED', label: 'Completed' },
      { value: 'CANCELLED', label: 'Cancelled' },
      { value: 'NO_SHOW', label: 'No Show' },
    ],
  },
  { id: 'service', label: 'Service', type: 'text', placeholder: 'Service name...' },
  { id: 'medicalCenter', label: 'Medical Center', type: 'text', placeholder: 'Location...' },
  { id: 'insurance', label: 'Insurance', type: 'text', placeholder: 'Insurance...' },
  {
    id: 'mode',
    label: 'Mode',
    type: 'select',
    options: [
      { value: 'telehealth', label: 'Telehealth' },
      { value: 'inPerson', label: 'In-Person' },
    ],
  },
];

/* ─── Columns ───────────────────────────────────────────────────── */

function buildColumns(onSelect: (id: string) => void, selectedIds: Set<string>): ColumnDef<BookingItem>[] {
  return [
    {
      id: 'select',
      header: '✓',
      accessor: (row) => (
        <input
          type="checkbox"
          checked={selectedIds.has(row.id)}
          onChange={() => onSelect(row.id)}
          aria-label={`Select booking ${row.id}`}
          style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
        />
      ),
      width: '40px',
    },
    {
      id: 'patient',
      header: 'Patient',
      sortable: true,
      accessor: (row) => (
        <Link href={`/portal/patients/${row.patientId}`} style={{ fontWeight: 700, color: 'var(--primary)' }}>
          {row.patientName}
        </Link>
      ),
    },
    {
      id: 'provider',
      header: 'Provider',
      sortable: true,
      accessor: (row) => (
        <Link href={`/portal/providers/${row.providerId}`} style={{ fontWeight: 700, color: 'var(--primary)' }}>
          {row.providerName}
        </Link>
      ),
    },
    {
      id: 'service',
      header: 'Service',
      sortable: true,
      accessor: (row) => row.service,
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      accessor: (row) => (
        <span className={`status-badge status-badge--${row.status.toLowerCase()}`}>
          {row.status}
        </span>
      ),
    },
    {
      id: 'startsAt',
      header: 'Scheduled',
      sortable: true,
      accessor: (row) => new Date(row.startsAt).toLocaleString(),
    },
    {
      id: 'mode',
      header: 'Mode',
      accessor: (row) => (
        <span style={{ textTransform: 'capitalize' }}>{row.mode}</span>
      ),
    },
    {
      id: 'location',
      header: 'Location',
      accessor: (row) => row.location ?? '—',
      hidden: true,
    },
  ];
}

/* ─── Page ──────────────────────────────────────────────────────── */

export default function BookingControlTowerPage() {
  const { toast } = useToast();

  // Data state
  const [items, setItems] = useState<BookingItem[]>([]);
  const [stats, setStats] = useState<BookingStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    variant: 'danger' | 'warning' | 'default';
    onConfirm: () => void;
  } | null>(null);

  // Fetch bookings
  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(pageSize),
      };

      // Apply filters
      if (filterValues.dateRange?.from) params.dateFrom = filterValues.dateRange.from;
      if (filterValues.dateRange?.to) params.dateTo = filterValues.dateRange.to;
      if (filterValues.provider) params.provider = filterValues.provider;
      if (filterValues.patient) params.patient = filterValues.patient;
      if (filterValues.status) params.status = filterValues.status;
      if (filterValues.service) params.service = filterValues.service;
      if (filterValues.medicalCenter) params.medicalCenter = filterValues.medicalCenter;
      if (filterValues.insurance) params.insurance = filterValues.insurance;
      if (filterValues.mode) params.mode = filterValues.mode;

      const result = await adminApi.adminBookings(params) as any;
      setItems(result.items ?? []);
      setStats(result.stats ?? null);
      setTotal(result.pagination?.total ?? 0);
    } catch (err: any) {
      toast({ variant: 'error', title: 'Failed to load bookings', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filterValues, toast]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Selection toggle
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Stats items
  const statsItems: StatItem[] = stats
    ? [
        { label: 'Total Bookings', value: stats.totalBookings },
        { label: 'Upcoming', value: stats.upcoming },
        { label: 'Completed', value: stats.completed },
        { label: 'Cancelled', value: stats.cancelled },
        { label: 'Rescheduled', value: stats.rescheduled },
        { label: 'No Shows', value: stats.noShows },
        { label: 'Avg Wait (min)', value: stats.avgWaitingTime },
        { label: 'Success Rate', value: `${stats.successRate}%` },
      ]
    : [];

  // ── Action handlers ──────────────────────────────────────────────

  const handleBulkNotify = useCallback(() => {
    if (selectedIds.size === 0) {
      toast({ variant: 'info', title: 'No bookings selected', description: 'Select bookings to notify.' });
      return;
    }
    setConfirmDialog({
      title: 'Bulk Notify',
      description: `Send notification to ${selectedIds.size} selected booking(s)?`,
      confirmLabel: 'Notify',
      variant: 'default',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await adminApi.adminBookingBulkNotify(Array.from(selectedIds));
          toast({ variant: 'success', title: 'Notifications sent', description: `${selectedIds.size} booking(s) notified.` });
          setSelectedIds(new Set());
          fetchBookings();
        } catch (err: any) {
          toast({ variant: 'error', title: 'Bulk notify failed', description: err.message, onRetry: handleBulkNotify });
        }
      },
    });
  }, [selectedIds, toast, fetchBookings]);

  const handleExportExceptions = useCallback(() => {
    // Filter to exceptions (cancelled + no-shows) and trigger export via table
    setFilterValues((prev) => ({ ...prev, status: 'CANCELLED' }));
    toast({ variant: 'info', title: 'Filtered to exceptions', description: 'Use Export button in table to download.' });
  }, [toast]);

  const handleCancelWithReason = useCallback(() => {
    if (selectedIds.size !== 1) {
      toast({ variant: 'info', title: 'Select one booking', description: 'Cancel requires exactly one booking selected.' });
      return;
    }
    const bookingId = Array.from(selectedIds)[0];
    setConfirmDialog({
      title: 'Cancel Booking',
      description: 'Are you sure you want to cancel this booking? This action cannot be undone.',
      confirmLabel: 'Cancel Booking',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await adminApi.adminBookingCancel(bookingId, { reason: 'Cancelled by admin' });
          toast({ variant: 'success', title: 'Booking cancelled' });
          setSelectedIds(new Set());
          fetchBookings();
        } catch (err: any) {
          toast({ variant: 'error', title: 'Cancel failed', description: err.message });
        }
      },
    });
  }, [selectedIds, toast, fetchBookings]);

  const handleReassignProvider = useCallback(() => {
    if (selectedIds.size !== 1) {
      toast({ variant: 'info', title: 'Select one booking', description: 'Reassign requires exactly one booking selected.' });
      return;
    }
    const bookingId = Array.from(selectedIds)[0];
    setConfirmDialog({
      title: 'Reassign Provider',
      description: 'Reassign this booking to a different provider? The system will pick the next available provider.',
      confirmLabel: 'Reassign',
      variant: 'warning',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          // Use a placeholder provider ID — in production this would come from a picker modal
          await adminApi.adminBookingReassign(bookingId, { providerId: '', reason: 'Reassigned by admin' });
          toast({ variant: 'success', title: 'Provider reassigned' });
          setSelectedIds(new Set());
          fetchBookings();
        } catch (err: any) {
          toast({ variant: 'error', title: 'Reassign failed', description: err.message });
        }
      },
    });
  }, [selectedIds, toast, fetchBookings]);

  const handleRefundReview = useCallback(() => {
    if (selectedIds.size !== 1) {
      toast({ variant: 'info', title: 'Select one booking', description: 'Refund review requires exactly one booking selected.' });
      return;
    }
    const bookingId = Array.from(selectedIds)[0];
    setConfirmDialog({
      title: 'Open Refund Review',
      description: 'Mark this booking for refund review? The finance team will be notified.',
      confirmLabel: 'Open Review',
      variant: 'warning',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await adminApi.adminBookingRefundReview(bookingId);
          toast({ variant: 'success', title: 'Refund review opened' });
          setSelectedIds(new Set());
          fetchBookings();
        } catch (err: any) {
          toast({ variant: 'error', title: 'Refund review failed', description: err.message });
        }
      },
    });
  }, [selectedIds, toast, fetchBookings]);

  const columns = buildColumns(toggleSelect, selectedIds);

  return (
    <PortalShell currentPath="/portal/bookings/control-tower">
      {/* Stats Grid */}
      <StatsGrid items={statsItems} loading={loading && !stats} />

      {/* Actions bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, margin: '20px 0' }}>
        <button className="button primary" onClick={handleBulkNotify}>
          Bulk Notify ({selectedIds.size})
        </button>
        <button className="button secondary" onClick={handleExportExceptions}>
          Export Exceptions
        </button>
        <button className="button secondary" onClick={handleReassignProvider}>
          Reassign Provider
        </button>
        <button className="button secondary" onClick={handleCancelWithReason}>
          Cancel with Reason
        </button>
        <button className="button secondary" onClick={handleRefundReview}>
          Refund Review
        </button>
      </div>

      {/* Main content: Filter + Table */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 24, alignItems: 'start' }}>
        <FilterPanel
          filters={filterDefs}
          values={filterValues}
          onChange={setFilterValues}
          onApply={fetchBookings}
          onClear={() => {
            setFilterValues({});
            setPage(1);
          }}
        />

        <AdminDataTable<BookingItem>
          columns={columns}
          data={items}
          totalCount={total}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          onSort={(col, dir) => {
            // Re-fetch with sort params — simplified for now
            fetchBookings();
          }}
          searchable
          onSearch={(term) => {
            setFilterValues((prev) => ({ ...prev, service: term }));
          }}
          loading={loading}
          exportFileName="booking-control"
          tableId="booking-control-tower"
          emptyMessage="No bookings match your filters."
        />
      </div>

      {/* Confirm Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          description={confirmDialog.description}
          confirmLabel={confirmDialog.confirmLabel}
          variant={confirmDialog.variant}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </PortalShell>
  );
}
