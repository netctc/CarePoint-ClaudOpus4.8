'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatsGrid, type StatItem } from '@/components/ui/stats-grid';
import { ChartCard } from '@/components/ui/chart-card';
import { LoadingButton } from '@/components/ui/loading-button';
import { useToast } from '@/components/ui/toast';

/* ─── Types ─────────────────────────────────────────────────────── */

interface ServiceMetrics {
  providerCount: number;
  appointmentCount: number;
  monthlyUtilization: number;
  yearlyUtilization: number;
  demandTrends: { month: string; demand: number }[];
  satisfactionScore: number;
  revenue: number;
}

interface ServiceDetail {
  id: string;
  name: string;
  category: string;
  status: string;
  template: string;
  durationMinutes: number;
  price: string;
  tags: string[];
}

/* ─── Bar Chart Component ───────────────────────────────────────── */

function UtilizationBarChart({ data, label }: { data: { month: string; demand: number }[]; label: string }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.88rem' }}>
        No data available for {label.toLowerCase()}.
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.demand), 1);
  const barWidth = Math.max(20, Math.min(50, Math.floor(400 / data.length)));

  return (
    <div style={{ padding: '20px 0' }}>
      <svg
        width="100%"
        height="220"
        viewBox={`0 0 ${data.length * (barWidth + 12) + 40} 220`}
        aria-label={`${label} chart`}
        role="img"
      >
        {/* Y-axis line */}
        <line x1="30" y1="10" x2="30" y2="190" stroke="var(--border, #e2e8f0)" strokeWidth="1" />
        {/* X-axis line */}
        <line x1="30" y1="190" x2={data.length * (barWidth + 12) + 30} y2="190" stroke="var(--border, #e2e8f0)" strokeWidth="1" />

        {data.map((item, index) => {
          const barHeight = (item.demand / maxValue) * 160;
          const x = 40 + index * (barWidth + 12);
          const y = 190 - barHeight;
          return (
            <g key={item.month}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill="var(--primary, #3b82f6)"
                rx={4}
                opacity={0.85}
              >
                <title>{`${item.month}: ${item.demand}`}</title>
              </rect>
              <text
                x={x + barWidth / 2}
                y="207"
                textAnchor="middle"
                fontSize="10"
                fill="var(--muted, #64748b)"
                fontWeight="600"
              >
                {item.month}
              </text>
              <text
                x={x + barWidth / 2}
                y={y - 6}
                textAnchor="middle"
                fontSize="10"
                fill="var(--text, #1e293b)"
                fontWeight="700"
              >
                {item.demand}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ─── Main Page Component ───────────────────────────────────────── */

export default function ServiceWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const serviceId = params.serviceId as string;

  // State
  const [service, setService] = useState<ServiceDetail | null>(null);
  const [metrics, setMetrics] = useState<ServiceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [chartInterval, setChartInterval] = useState('Monthly');

  /* ── Helper: get auth token ─────── */
  const getToken = () =>
    document.cookie.match(/cc_admin_access_token=([^;]+)/)?.[1] ||
    document.cookie.match(/cc_access_token=([^;]+)/)?.[1] ||
    '';

  const getBaseUrl = () => process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

  /* ── Fetch service detail ─────────── */
  useEffect(() => {
    async function loadService() {
      setLoading(true);
      try {
        const res = await fetch(`${getBaseUrl()}/api/catalog/services`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          const items = data.items || data || [];
          const found = items.find((s: any) => s.id === serviceId);
          if (found) {
            setService({
              id: found.id,
              name: found.name || found.serviceName || '—',
              category: found.category || '—',
              status: found.status || 'Draft',
              template: found.template || '—',
              durationMinutes: found.durationMinutes || 0,
              price: found.price || found.priceFormatted || '—',
              tags: found.tags || [],
            });
          } else {
            setService({
              id: serviceId,
              name: 'Service',
              category: '—',
              status: '—',
              template: '—',
              durationMinutes: 0,
              price: '—',
              tags: [],
            });
          }
        } else {
          setService({
            id: serviceId,
            name: 'Service',
            category: '—',
            status: '—',
            template: '—',
            durationMinutes: 0,
            price: '—',
            tags: [],
          });
        }
      } catch {
        setService({
          id: serviceId,
          name: 'Service',
          category: '—',
          status: '—',
          template: '—',
          durationMinutes: 0,
          price: '—',
          tags: [],
        });
      } finally {
        setLoading(false);
      }
    }
    loadService();
  }, [serviceId]);

  /* ── Fetch service metrics ────────── */
  useEffect(() => {
    async function loadMetrics() {
      setMetricsLoading(true);
      try {
        const res = await fetch(`${getBaseUrl()}/api/admin/catalog/services/${serviceId}/metrics`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          setMetrics(data);
        } else {
          // Fallback mock metrics
          setMetrics({
            providerCount: 0,
            appointmentCount: 0,
            monthlyUtilization: 0,
            yearlyUtilization: 0,
            demandTrends: [],
            satisfactionScore: 0,
            revenue: 0,
          });
        }
      } catch {
        setMetrics({
          providerCount: 0,
          appointmentCount: 0,
          monthlyUtilization: 0,
          yearlyUtilization: 0,
          demandTrends: [],
          satisfactionScore: 0,
          revenue: 0,
        });
      } finally {
        setMetricsLoading(false);
      }
    }
    loadMetrics();
  }, [serviceId]);

  /* ── Stats items ──────────────────── */
  const statsItems: StatItem[] = metrics
    ? [
        { label: 'Providers Offering', value: metrics.providerCount },
        { label: 'Total Appointments', value: metrics.appointmentCount },
        { label: 'Monthly Utilization', value: `${metrics.monthlyUtilization}%` },
        { label: 'Yearly Utilization', value: `${metrics.yearlyUtilization}%` },
        { label: 'Satisfaction Score', value: `${metrics.satisfactionScore}/5` },
        { label: 'Revenue', value: `$${metrics.revenue.toLocaleString()}` },
      ]
    : [];

  /* ── Status color helper ──────────── */
  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      Active: '#22c55e',
      PUBLISHED: '#22c55e',
      Draft: '#f59e0b',
      DRAFT: '#f59e0b',
      Archived: '#6b7280',
      ARCHIVED: '#6b7280',
    };
    return map[status] || '#6b7280';
  };

  /* ── Loading state ─────────────────── */
  if (loading) {
    return (
      <PortalShell currentPath="/portal/catalog/services">
        <div style={{ display: 'grid', placeItems: 'center', minHeight: 300 }}>
          <div style={{ color: 'var(--muted)', fontWeight: 700, fontSize: '0.9rem' }}>Loading service...</div>
        </div>
      </PortalShell>
    );
  }

  /* ── Render ────────────────────────── */
  return (
    <PortalShell currentPath="/portal/catalog/services">
      <div style={{ display: 'grid', gap: 24 }}>
        {/* Page Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              className="button secondary"
              onClick={() => router.push('/portal/catalog/services')}
              style={{ minHeight: 36, padding: '6px 14px' }}
            >
              ← Back
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                {service?.name}
              </h1>
              <div style={{ display: 'flex', gap: 10, marginTop: 4, alignItems: 'center' }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 10px',
                    borderRadius: 12,
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    background: `${statusColor(service?.status || '')}18`,
                    color: statusColor(service?.status || ''),
                  }}
                >
                  {service?.status}
                </span>
                <span style={{ fontSize: '0.84rem', color: 'var(--muted)' }}>
                  {service?.category} • {service?.template}
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <LoadingButton variant="secondary">
              Edit Service
            </LoadingButton>
            <LoadingButton variant="primary">
              Publish
            </LoadingButton>
          </div>
        </div>

        {/* Statistics Section */}
        <StatsGrid items={statsItems} loading={metricsLoading} />

        {/* Charts Section */}
        <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))' }}>
          {/* Utilization Chart */}
          <ChartCard
            title="Utilization Trend"
            intervals={['Weekly', 'Monthly', 'Yearly']}
            selectedInterval={chartInterval}
            onIntervalChange={setChartInterval}
          >
            <UtilizationBarChart
              data={metrics?.demandTrends || []}
              label="utilization"
            />
          </ChartCard>

          {/* Demand Chart */}
          <ChartCard
            title="Patient Demand"
            intervals={['Weekly', 'Monthly', 'Yearly']}
            selectedInterval={chartInterval}
            onIntervalChange={setChartInterval}
          >
            <UtilizationBarChart
              data={metrics?.demandTrends || []}
              label="demand"
            />
          </ChartCard>
        </div>

        {/* Service Details Card */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 800 }}>Service Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>Category</div>
              <div style={{ fontWeight: 700 }}>{service?.category}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>Template</div>
              <div style={{ fontWeight: 700 }}>{service?.template}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>Duration</div>
              <div style={{ fontWeight: 700 }}>{service?.durationMinutes ? `${service.durationMinutes} min` : '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>Price</div>
              <div style={{ fontWeight: 700 }}>{service?.price}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>Tags</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {service?.tags && service.tags.length > 0 ? service.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      padding: '2px 8px',
                      borderRadius: 8,
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      background: 'var(--surface, #f1f5f9)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {tag}
                  </span>
                )) : <span style={{ color: 'var(--muted)' }}>—</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
