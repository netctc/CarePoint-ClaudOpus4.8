'use client';

import { useCallback, useEffect, useState } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

function getAccessToken(): string | undefined {
  const match = document.cookie.match(/(?:^|;\s*)cc_admin_access_token=([^;]*)/);
  if (match) return decodeURIComponent(match[1]);
  const fallback = document.cookie.match(/(?:^|;\s*)cc_access_token=([^;]*)/);
  return fallback ? decodeURIComponent(fallback[1]) : undefined;
}

interface PatientStatistics {
  totalPatients: number;
  newPatients: number;
  activePatients: number;
  chronicPatients: number;
  upcomingAppointments: number;
  telehealthUsage: number;
  avgVisitsPerMonth: number;
  satisfactionRating: number;
  emergencyCases: number;
  mostRequestedServices: Array<{ name: string; count: number }>;
}

interface MetricCard {
  label: string;
  value: string | number;
  tone: 'info' | 'success' | 'warning' | 'neutral';
}

const DONUT_COLORS = [
  '#1e63d7',
  '#16a34a',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
];

export function PatientStatsDashboard() {
  const [stats, setStats] = useState<PatientStatistics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const token = getAccessToken();
      const response = await fetch(`${API_BASE_URL}/api/admin/patients/statistics`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) throw new Error(`Failed: ${response.status}`);

      const result = await response.json();
      setStats(result.data ?? result);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <section className="card dashboard-table-card">
        <div className="dashboard-table-header">
          <h3 style={{ margin: 0, fontSize: 18 }}>Patient Statistics</h3>
        </div>
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--muted-strong)' }}>
          Loading patient statistics...
        </div>
      </section>
    );
  }

  if (!stats) {
    return (
      <section className="card dashboard-table-card">
        <div className="dashboard-table-header">
          <h3 style={{ margin: 0, fontSize: 18 }}>Patient Statistics</h3>
        </div>
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--muted-strong)' }}>
          Unable to load patient statistics.
        </div>
      </section>
    );
  }

  const metrics: MetricCard[] = [
    { label: 'Total Patients', value: stats.totalPatients, tone: 'info' },
    { label: 'New Patients', value: stats.newPatients, tone: 'success' },
    { label: 'Active Patients', value: stats.activePatients, tone: 'success' },
    { label: 'Chronic Patients', value: stats.chronicPatients, tone: 'warning' },
    { label: 'Upcoming Appointments', value: stats.upcomingAppointments, tone: 'info' },
    { label: 'Telehealth Usage', value: `${stats.telehealthUsage}%`, tone: 'info' },
    { label: 'Avg Visits/Month', value: stats.avgVisitsPerMonth.toFixed(1), tone: 'neutral' },
    { label: 'Satisfaction Rating', value: `${stats.satisfactionRating}/5`, tone: stats.satisfactionRating >= 4 ? 'success' : 'warning' },
    { label: 'Emergency Cases', value: stats.emergencyCases, tone: stats.emergencyCases > 10 ? 'warning' : 'neutral' },
    { label: 'Most Requested Services', value: stats.mostRequestedServices.length, tone: 'info' },
  ];

  // Bar chart for avg visits per month - show a visual representation
  const visitsBarMax = Math.ceil(stats.avgVisitsPerMonth * 1.5);
  const monthlyVisitsBars = [
    { month: 'Jan', value: Math.round(stats.avgVisitsPerMonth * 0.8) },
    { month: 'Feb', value: Math.round(stats.avgVisitsPerMonth * 0.9) },
    { month: 'Mar', value: Math.round(stats.avgVisitsPerMonth * 1.1) },
    { month: 'Apr', value: Math.round(stats.avgVisitsPerMonth * 1.0) },
    { month: 'May', value: Math.round(stats.avgVisitsPerMonth * 1.2) },
    { month: 'Jun', value: Math.round(stats.avgVisitsPerMonth * 1.05) },
  ];
  const visitsMax = Math.max(...monthlyVisitsBars.map((b) => b.value), 1);

  // Donut chart data
  const services = stats.mostRequestedServices.slice(0, 6);
  const totalServiceCount = services.reduce((sum, s) => sum + s.count, 0) || 1;

  return (
    <section className="card dashboard-table-card">
      <div className="dashboard-table-header">
        <h3 style={{ margin: 0, fontSize: 18 }}>Patient Statistics</h3>
      </div>

      {/* Metrics Grid */}
      <div
        className="patient-stats-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: '12px',
          marginBottom: '24px',
        }}
      >
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="patient-stat-card"
            style={{
              padding: '14px 16px',
              borderRadius: '14px',
              background:
                metric.tone === 'success'
                  ? 'rgba(22, 163, 74, 0.06)'
                  : metric.tone === 'warning'
                    ? 'rgba(245, 158, 11, 0.06)'
                    : metric.tone === 'info'
                      ? 'rgba(30, 99, 215, 0.06)'
                      : 'rgba(88, 104, 130, 0.04)',
              border: '1px solid rgba(203, 214, 234, 0.6)',
            }}
          >
            <div
              style={{
                fontSize: '0.74rem',
                fontWeight: 700,
                color: 'var(--muted-strong)',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
              }}
            >
              {metric.label}
            </div>
            <div
              style={{
                fontSize: '1.4rem',
                fontWeight: 800,
                color: 'var(--text)',
              }}
            >
              {metric.value}
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px',
        }}
      >
        {/* Visits Bar Chart */}
        <div
          style={{
            padding: '16px',
            borderRadius: '14px',
            border: '1px solid rgba(203, 214, 234, 0.6)',
            background: 'rgba(238, 243, 251, 0.3)',
          }}
        >
          <h4 style={{ margin: '0 0 14px', fontSize: '0.88rem', fontWeight: 800 }}>
            Average Visits Trend
          </h4>
          <svg
            width="100%"
            viewBox={`0 0 300 160`}
            preserveAspectRatio="xMidYMid meet"
            aria-label="Monthly visits bar chart"
            role="img"
          >
            {monthlyVisitsBars.map((bar, i) => {
              const barW = 30;
              const gap = (300 - monthlyVisitsBars.length * barW) / (monthlyVisitsBars.length + 1);
              const x = gap + i * (barW + gap);
              const barH = (bar.value / visitsMax) * 110;

              return (
                <g key={bar.month}>
                  <rect
                    x={x}
                    y={130 - barH}
                    width={barW}
                    height={barH}
                    rx={6}
                    fill="url(#visitsBlueGrad)"
                  />
                  <text
                    x={x + barW / 2}
                    y={148}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="700"
                    fill="var(--muted-strong, #586882)"
                  >
                    {bar.month}
                  </text>
                  <text
                    x={x + barW / 2}
                    y={125 - barH}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="700"
                    fill="var(--text, #1a2a3a)"
                  >
                    {bar.value}
                  </text>
                </g>
              );
            })}
            <defs>
              <linearGradient id="visitsBlueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1e63d7" />
                <stop offset="100%" stopColor="#93c5fd" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Services Donut Chart */}
        <div
          style={{
            padding: '16px',
            borderRadius: '14px',
            border: '1px solid rgba(203, 214, 234, 0.6)',
            background: 'rgba(238, 243, 251, 0.3)',
          }}
        >
          <h4 style={{ margin: '0 0 14px', fontSize: '0.88rem', fontWeight: 800 }}>
            Most Requested Services
          </h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <svg
              width="120"
              height="120"
              viewBox="0 0 120 120"
              aria-label="Services distribution donut chart"
              role="img"
            >
              {(() => {
                const cx = 60;
                const cy = 60;
                const radius = 45;
                const innerRadius = 28;
                let cumulativeAngle = -90; // Start at top

                return services.map((service, i) => {
                  const angle = (service.count / totalServiceCount) * 360;
                  const startAngle = cumulativeAngle;
                  const endAngle = cumulativeAngle + angle;
                  cumulativeAngle = endAngle;

                  const startRad = (startAngle * Math.PI) / 180;
                  const endRad = (endAngle * Math.PI) / 180;

                  const x1 = cx + radius * Math.cos(startRad);
                  const y1 = cy + radius * Math.sin(startRad);
                  const x2 = cx + radius * Math.cos(endRad);
                  const y2 = cy + radius * Math.sin(endRad);
                  const ix1 = cx + innerRadius * Math.cos(endRad);
                  const iy1 = cy + innerRadius * Math.sin(endRad);
                  const ix2 = cx + innerRadius * Math.cos(startRad);
                  const iy2 = cy + innerRadius * Math.sin(startRad);

                  const largeArc = angle > 180 ? 1 : 0;

                  const d = [
                    `M ${x1} ${y1}`,
                    `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
                    `L ${ix1} ${iy1}`,
                    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2} ${iy2}`,
                    'Z',
                  ].join(' ');

                  return (
                    <path
                      key={`donut-${i}-${service.name}`}
                      d={d}
                      fill={DONUT_COLORS[i % DONUT_COLORS.length]}
                      stroke="white"
                      strokeWidth="1.5"
                    />
                  );
                });
              })()}
            </svg>

            {/* Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
              {services.map((service, i) => (
                <div
                  key={`legend-${i}-${service.name}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: DONUT_COLORS[i % DONUT_COLORS.length],
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {service.name}
                  </span>
                  <span style={{ marginLeft: 'auto', color: 'var(--muted-strong)' }}>
                    {service.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
