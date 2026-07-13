'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChartCard } from '@/components/ui/chart-card';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

function getAccessToken(): string | undefined {
  const match = document.cookie.match(/(?:^|;\s*)cc_admin_access_token=([^;]*)/);
  if (match) return decodeURIComponent(match[1]);
  const fallback = document.cookie.match(/(?:^|;\s*)cc_access_token=([^;]*)/);
  return fallback ? decodeURIComponent(fallback[1]) : undefined;
}

interface GrowthDataPoint {
  label: string;
  registrations: number;
  active: number;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  label: string;
  registrations: number;
  active: number;
}

const INTERVALS = ['Daily', 'Weekly', 'Monthly', 'Yearly'];

export function ProviderGrowthChart() {
  const [interval, setInterval] = useState('Monthly');
  const [data, setData] = useState<GrowthDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    label: '',
    registrations: 0,
    active: 0,
  });

  const fetchData = useCallback(async (selectedInterval: string) => {
    setLoading(true);
    try {
      const token = getAccessToken();
      const response = await fetch(
        `${API_BASE_URL}/api/admin/providers/growth?interval=${selectedInterval.toLowerCase()}`,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const result = await response.json();
      const items: GrowthDataPoint[] = result.data ?? result ?? [];
      setData(items);
    } catch {
      // On error, keep existing data or show empty
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(interval);
  }, [interval, fetchData]);

  const handleIntervalChange = (newInterval: string) => {
    setInterval(newInterval);
  };

  const maxValue = Math.max(
    ...data.map((d) => Math.max(d.registrations, d.active)),
    1
  );

  const chartHeight = 220;
  const chartPadding = 40;
  const barGroupWidth = data.length > 0 ? Math.min(80, 600 / data.length) : 80;
  const barWidth = barGroupWidth * 0.35;
  const chartWidth = Math.max(data.length * barGroupWidth + chartPadding * 2, 300);

  const handleBarHover = (
    e: React.MouseEvent<SVGRectElement>,
    point: GrowthDataPoint
  ) => {
    const rect = (e.target as SVGRectElement).getBoundingClientRect();
    const container = (e.target as SVGRectElement).closest('svg')?.getBoundingClientRect();
    if (!container) return;

    setTooltip({
      visible: true,
      x: rect.left - container.left + rect.width / 2,
      y: rect.top - container.top - 10,
      label: point.label,
      registrations: point.registrations,
      active: point.active,
    });
  };

  const handleBarLeave = () => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  };

  return (
    <ChartCard
      title="Provider Growth & Activity"
      intervals={INTERVALS}
      selectedInterval={interval}
      onIntervalChange={handleIntervalChange}
    >
      {loading ? (
        <div className="chart-loading" aria-label="Loading chart data">
          <div className="bar-chart" style={{ opacity: 0.4 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bar-column">
                <div className="bar-track">
                  <div
                    className="bar-value"
                    style={{ height: Math.random() * 100 + 40, opacity: 0.3 }}
                  />
                </div>
                <div className="bar-label">...</div>
              </div>
            ))}
          </div>
        </div>
      ) : data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted-strong)' }}>
          No growth data available for this interval.
        </div>
      ) : (
        <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
          <svg
            width="100%"
            viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`}
            preserveAspectRatio="xMidYMid meet"
            aria-label="Provider growth bar chart"
            role="img"
          >
            {/* Grid lines */}
            {[0.25, 0.5, 0.75, 1].map((ratio) => (
              <line
                key={ratio}
                x1={chartPadding}
                x2={chartWidth - chartPadding}
                y1={chartHeight - ratio * chartHeight + 10}
                y2={chartHeight - ratio * chartHeight + 10}
                stroke="rgba(203, 214, 234, 0.5)"
                strokeDasharray="4 4"
              />
            ))}

            {/* Bar groups */}
            {data.map((point, index) => {
              const groupX = chartPadding + index * barGroupWidth + barGroupWidth / 2;
              const regHeight = (point.registrations / maxValue) * chartHeight;
              const activeHeight = (point.active / maxValue) * chartHeight;

              return (
                <g key={point.label}>
                  {/* Registrations bar (blue) */}
                  <rect
                    x={groupX - barWidth - 1}
                    y={chartHeight - regHeight + 10}
                    width={barWidth}
                    height={regHeight}
                    rx={barWidth / 4}
                    fill="url(#blueGradient)"
                    style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                    onMouseEnter={(e) => handleBarHover(e, point)}
                    onMouseLeave={handleBarLeave}
                  />

                  {/* Active bar (green) */}
                  <rect
                    x={groupX + 1}
                    y={chartHeight - activeHeight + 10}
                    width={barWidth}
                    height={activeHeight}
                    rx={barWidth / 4}
                    fill="url(#greenGradient)"
                    style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                    onMouseEnter={(e) => handleBarHover(e, point)}
                    onMouseLeave={handleBarLeave}
                  />

                  {/* X-axis label */}
                  <text
                    x={groupX}
                    y={chartHeight + 30}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="700"
                    fill="var(--muted-strong, #586882)"
                  >
                    {point.label}
                  </text>
                </g>
              );
            })}

            {/* Gradients */}
            <defs>
              <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1e63d7" />
                <stop offset="100%" stopColor="#7ca8e7" />
              </linearGradient>
              <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#16a34a" />
                <stop offset="100%" stopColor="#6ee7b7" />
              </linearGradient>
            </defs>
          </svg>

          {/* Tooltip */}
          {tooltip.visible && (
            <div
              className="chart-tooltip"
              style={{
                position: 'absolute',
                left: tooltip.x,
                top: tooltip.y,
                transform: 'translate(-50%, -100%)',
                background: 'rgba(15, 23, 42, 0.92)',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 600,
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 10,
              }}
            >
              <div style={{ marginBottom: 4, fontWeight: 800 }}>{tooltip.label}</div>
              <div style={{ color: '#93c5fd' }}>Registrations: {tooltip.registrations}</div>
              <div style={{ color: '#6ee7b7' }}>Active: {tooltip.active}</div>
            </div>
          )}
        </div>
      )}

      <div className="legend-row">
        <span className="legend-item">
          <span className="legend-dot" style={{ background: '#1e63d7' }} /> Registrations
        </span>
        <span className="legend-item">
          <span className="legend-dot" style={{ background: '#16a34a' }} /> Active Providers
        </span>
      </div>
    </ChartCard>
  );
}
