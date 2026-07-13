'use client';

import { useCallback, useEffect, useState } from 'react';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatsGrid, type StatItem } from '@/components/ui/stats-grid';
import { ChartCard } from '@/components/ui/chart-card';
import { FilterPanel, type FilterDefinition } from '@/components/ui/filter-panel';
import { AdminDataTable, type ColumnDef } from '@/components/ui/admin-data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { adminApi } from '@/lib/api-client';

/* ─── Types ─────────────────────────────────────────────────────── */

interface TelehealthMetrics {
  onlineConsultationsToday: number;
  ongoingSessions: number;
  completedSessions: number;
  failedSessions: number;
  avgDuration: number;
  waitingPatients: number;
  technicalIncidents: number;
  connectionQuality: number;
  dailyUsage: { date: string; count: number }[];
  weeklyTrends: { week: string; sessions: number; completed: number; failed: number }[];
}

interface SessionItem {
  id: string;
  appointmentId: string;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  duration: number | null;
  providerId: string | null;
  providerName: string | null;
  patientId: string | null;
  patientName: string | null;
  service: string | null;
  createdAt: string;
}

/* ─── Filter Definitions ────────────────────────────────────────── */

const filterDefs: FilterDefinition[] = [
  { id: 'dateRange', label: 'Date Range', type: 'date-range' },
  { id: 'provider', label: 'Provider', type: 'text', placeholder: 'Provider ID...' },
  { id: 'patient', label: 'Patient', type: 'text', placeholder: 'Patient ID...' },
  {
    id: 'sessionStatus',
    label: 'Session Status',
    type: 'select',
    options: [
      { value: 'WAITING', label: 'Waiting' },
      { value: 'IN_PROGRESS', label: 'In Progress' },
      { value: 'COMPLETED', label: 'Completed' },
      { value: 'FAILED', label: 'Failed' },
      { value: 'DISCONNECTED', label: 'Disconnected' },
    ],
  },
  {
    id: 'connectionQuality',
    label: 'Connection Quality',
    type: 'select',
    options: [
      { value: 'good', label: 'Good' },
      { value: 'poor', label: 'Poor' },
    ],
  },
  {
    id: 'incidentType',
    label: 'Incident Type',
    type: 'select',
    options: [
      { value: 'FAILED', label: 'Failed' },
      { value: 'DISCONNECTED', label: 'Disconnected' },
    ],
  },
];

/* ─── Columns ───────────────────────────────────────────────────── */

const sessionColumns: ColumnDef<SessionItem>[] = [
  {
    id: 'providerName',
    header: 'Provider',
    sortable: true,
    accessor: (row) => row.providerName ?? '—',
  },
  {
    id: 'patientName',
    header: 'Patient',
    sortable: true,
    accessor: (row) => row.patientName ?? '—',
  },
  {
    id: 'service',
    header: 'Service',
    accessor: (row) => row.service ?? '—',
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
    id: 'duration',
    header: 'Duration',
    accessor: (row) => (row.duration != null ? `${row.duration} min` : '—'),
  },
  {
    id: 'startedAt',
    header: 'Started',
    sortable: true,
    accessor: (row) => (row.startedAt ? new Date(row.startedAt).toLocaleString() : '—'),
  },
  {
    id: 'createdAt',
    header: 'Created',
    sortable: true,
    accessor: (row) => new Date(row.createdAt).toLocaleString(),
    hidden: true,
  },
];

/* ─── Simple SVG Charts ─────────────────────────────────────────── */

function DailyUsageChart({ data }: { data: { date: string; count: number }[] }) {
  if (data.length === 0) return <div style={{ color: 'var(--muted)', padding: 20 }}>No data</div>;

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const chartHeight = 180;
  const chartWidth = 600;
  const padding = 30;
  const usableWidth = chartWidth - padding * 2;
  const usableHeight = chartHeight - padding * 2;

  const points = data.map((d, i) => {
    const x = padding + (i / Math.max(data.length - 1, 1)) * usableWidth;
    const y = padding + usableHeight - (d.count / maxCount) * usableHeight;
    return { x, y, ...d };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: '100%', maxHeight: 200 }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const y = padding + usableHeight * (1 - frac);
        return (
          <line key={frac} x1={padding} y1={y} x2={chartWidth - padding} y2={y} stroke="var(--border)" strokeDasharray="3,3" />
        );
      })}
      {/* Line */}
      <path d={pathD} fill="none" stroke="var(--primary, #3b82f6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Points */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="var(--primary, #3b82f6)" />
          <title>{`${p.date}: ${p.count} sessions`}</title>
        </g>
      ))}
      {/* X-axis labels */}
      {points.map((p, i) => (
        <text key={i} x={p.x} y={chartHeight - 5} textAnchor="middle" fontSize="10" fill="var(--muted)">
          {p.date.slice(5)}
        </text>
      ))}
    </svg>
  );
}

function WeeklyTrendsChart({ data }: { data: { week: string; sessions: number; completed: number; failed: number }[] }) {
  if (data.length === 0) return <div style={{ color: 'var(--muted)', padding: 20 }}>No data</div>;

  const maxVal = Math.max(...data.map((d) => d.sessions), 1);
  const chartHeight = 180;
  const chartWidth = 500;
  const padding = 30;
  const usableWidth = chartWidth - padding * 2;
  const usableHeight = chartHeight - padding * 2;
  const barGroupWidth = usableWidth / data.length;
  const barWidth = barGroupWidth * 0.25;

  return (
    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: '100%', maxHeight: 200 }}>
      {data.map((d, i) => {
        const groupX = padding + i * barGroupWidth + barGroupWidth * 0.1;
        const sessionsH = (d.sessions / maxVal) * usableHeight;
        const completedH = (d.completed / maxVal) * usableHeight;
        const failedH = (d.failed / maxVal) * usableHeight;

        return (
          <g key={i}>
            <rect x={groupX} y={padding + usableHeight - sessionsH} width={barWidth} height={sessionsH} fill="var(--primary, #3b82f6)" rx="3">
              <title>{`${d.week} Total: ${d.sessions}`}</title>
            </rect>
            <rect x={groupX + barWidth + 2} y={padding + usableHeight - completedH} width={barWidth} height={completedH} fill="var(--success, #22c55e)" rx="3">
              <title>{`${d.week} Completed: ${d.completed}`}</title>
            </rect>
            <rect x={groupX + (barWidth + 2) * 2} y={padding + usableHeight - failedH} width={barWidth} height={failedH} fill="var(--danger, #ef4444)" rx="3">
              <title>{`${d.week} Failed: ${d.failed}`}</title>
            </rect>
            <text x={groupX + barGroupWidth * 0.35} y={chartHeight - 5} textAnchor="middle" fontSize="11" fill="var(--muted)">
              {d.week}
            </text>
          </g>
        );
      })}
      {/* Legend */}
      <circle cx={chartWidth - 130} cy={12} r="4" fill="var(--primary, #3b82f6)" />
      <text x={chartWidth - 122} y={16} fontSize="10" fill="var(--muted)">Total</text>
      <circle cx={chartWidth - 85} cy={12} r="4" fill="var(--success, #22c55e)" />
      <text x={chartWidth - 77} y={16} fontSize="10" fill="var(--muted)">Done</text>
      <circle cx={chartWidth - 42} cy={12} r="4" fill="var(--danger, #ef4444)" />
      <text x={chartWidth - 34} y={16} fontSize="10" fill="var(--muted)">Failed</text>
    </svg>
  );
}

/* ─── Page ──────────────────────────────────────────────────────── */

export default function TelehealthOperationsPage() {
  const { toast } = useToast();

  // Metrics state
  const [metrics, setMetrics] = useState<TelehealthMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);

  // Sessions state
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  // Filter state
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});

  // Chart interval state
  const [dailyInterval, setDailyInterval] = useState('daily');
  const [weeklyInterval, setWeeklyInterval] = useState('weekly');

  // Dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    variant: 'danger' | 'warning' | 'default';
    onConfirm: () => void;
  } | null>(null);

  // Selected session for actions
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Fetch metrics
  useEffect(() => {
    setMetricsLoading(true);
    adminApi.adminTelehealthMetrics()
      .then((data: any) => setMetrics(data))
      .catch((err: any) => toast({ variant: 'error', title: 'Failed to load metrics', description: err.message }))
      .finally(() => setMetricsLoading(false));
  }, [toast]);

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(pageSize),
      };

      if (filterValues.dateRange?.from) params.dateFrom = filterValues.dateRange.from;
      if (filterValues.dateRange?.to) params.dateTo = filterValues.dateRange.to;
      if (filterValues.provider) params.provider = filterValues.provider;
      if (filterValues.patient) params.patient = filterValues.patient;
      if (filterValues.sessionStatus) params.sessionStatus = filterValues.sessionStatus;
      if (filterValues.connectionQuality) params.connectionQuality = filterValues.connectionQuality;
      if (filterValues.incidentType) params.incidentType = filterValues.incidentType;

      const result = await adminApi.adminTelehealthSessions(params) as any;
      setSessions(result.items ?? []);
      setTotal(result.pagination?.total ?? 0);
    } catch (err: any) {
      toast({ variant: 'error', title: 'Failed to load sessions', description: err.message });
    } finally {
      setSessionsLoading(false);
    }
  }, [page, pageSize, filterValues, toast]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Stats items
  const statsItems: StatItem[] = metrics
    ? [
        { label: 'Online Today', value: metrics.onlineConsultationsToday },
        { label: 'Ongoing', value: metrics.ongoingSessions },
        { label: 'Completed', value: metrics.completedSessions },
        { label: 'Failed', value: metrics.failedSessions },
        { label: 'Avg Duration', value: `${metrics.avgDuration} min` },
        { label: 'Waiting', value: metrics.waitingPatients },
        { label: 'Incidents', value: metrics.technicalIncidents },
        { label: 'Connection Quality', value: `${metrics.connectionQuality}%` },
      ]
    : [];

  // ── Action handlers ──────────────────────────────────────────────

  const handleOpenIncidentDetail = useCallback(() => {
    if (!selectedSessionId) {
      toast({ variant: 'info', title: 'No session selected', description: 'Click a row to select a session.' });
      return;
    }
    // Navigate to incident detail — use window.location for now
    window.location.href = `/portal/telehealth/operations/${selectedSessionId}`;
  }, [selectedSessionId, toast]);

  const handleExportMonitor = useCallback(() => {
    toast({ variant: 'info', title: 'Export started', description: 'Use the Export button in the table toolbar.' });
  }, [toast]);

  const handleEscalate = useCallback(() => {
    if (!selectedSessionId) {
      toast({ variant: 'info', title: 'No session selected', description: 'Click a row to select a session for escalation.' });
      return;
    }
    setConfirmDialog({
      title: 'Escalate Incident',
      description: 'Are you sure you want to escalate this telehealth incident? The support team will be notified immediately.',
      confirmLabel: 'Escalate',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await adminApi.adminTelehealthEscalate(selectedSessionId, { severity: 'HIGH', reason: 'Escalated by admin' });
          toast({ variant: 'success', title: 'Incident escalated', description: 'Support team has been notified.' });
          setSelectedSessionId(null);
          fetchSessions();
        } catch (err: any) {
          toast({ variant: 'error', title: 'Escalation failed', description: err.message });
        }
      },
    });
  }, [selectedSessionId, toast, fetchSessions]);

  // Add row click to select session
  const columnsWithRowClick: ColumnDef<SessionItem>[] = [
    {
      id: 'select',
      header: '',
      width: '40px',
      accessor: (row) => (
        <input
          type="radio"
          name="session-select"
          checked={selectedSessionId === row.id}
          onChange={() => setSelectedSessionId(row.id)}
          aria-label={`Select session ${row.id}`}
          style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
        />
      ),
    },
    ...sessionColumns,
  ];

  return (
    <PortalShell currentPath="/portal/telehealth/operations">
      {/* Stats Grid */}
      <StatsGrid items={statsItems} loading={metricsLoading} />

      {/* Charts Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, margin: '24px 0' }}>
        <ChartCard
          title="Daily Usage"
          intervals={['daily', 'weekly']}
          selectedInterval={dailyInterval}
          onIntervalChange={setDailyInterval}
        >
          <DailyUsageChart data={metrics?.dailyUsage ?? []} />
        </ChartCard>

        <ChartCard
          title="Weekly Trends"
          intervals={['weekly', 'monthly']}
          selectedInterval={weeklyInterval}
          onIntervalChange={setWeeklyInterval}
        >
          <WeeklyTrendsChart data={metrics?.weeklyTrends ?? []} />
        </ChartCard>
      </div>

      {/* Actions Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, margin: '20px 0' }}>
        <button className="button primary" onClick={handleOpenIncidentDetail}>
          Open Incident Detail
        </button>
        <button className="button secondary" onClick={handleExportMonitor}>
          Export Monitor
        </button>
        <button className="button secondary" onClick={handleEscalate}>
          Escalate
        </button>
      </div>

      {/* Main content: Filter + Table */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 24, alignItems: 'start' }}>
        <FilterPanel
          filters={filterDefs}
          values={filterValues}
          onChange={setFilterValues}
          onApply={fetchSessions}
          onClear={() => {
            setFilterValues({});
            setPage(1);
          }}
        />

        <AdminDataTable<SessionItem>
          columns={columnsWithRowClick}
          data={sessions}
          totalCount={total}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          onSort={() => fetchSessions()}
          searchable
          onSearch={(term) => {
            setFilterValues((prev) => ({ ...prev, provider: term }));
          }}
          loading={sessionsLoading}
          exportFileName="telehealth-operations"
          tableId="telehealth-operations"
          emptyMessage="No telehealth sessions match your filters."
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
