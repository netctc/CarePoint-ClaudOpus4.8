'use client';

import type { ReactNode } from 'react';

/* ─── Types ─────────────────────────────────────────────────────── */

export interface ChartCardProps {
  title: string;
  intervals: string[];
  selectedInterval: string;
  onIntervalChange: (interval: string) => void;
  children: ReactNode;
}

/* ─── Main Component ────────────────────────────────────────────── */

export function ChartCard({
  title,
  intervals,
  selectedInterval,
  onIntervalChange,
  children,
}: ChartCardProps) {
  return (
    <section className="card chart-card">
      <div className="chart-toolbar">
        <h3 style={{ margin: 0, fontSize: 18 }}>{title}</h3>
        <div className="segmented-control" role="group" aria-label={`${title} interval selector`}>
          {intervals.map((interval) => (
            <span
              key={interval}
              className={selectedInterval === interval ? 'active' : undefined}
              role="button"
              tabIndex={0}
              aria-pressed={selectedInterval === interval}
              onClick={() => onIntervalChange(interval)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onIntervalChange(interval);
                }
              }}
            >
              {interval}
            </span>
          ))}
        </div>
      </div>
      <div className="chart-card__content">{children}</div>
    </section>
  );
}
