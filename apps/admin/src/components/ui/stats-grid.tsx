'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

/* ─── Types ─────────────────────────────────────────────────────── */

export interface StatItem {
  label: string;
  value: string | number;
  trend?: { direction: 'up' | 'down'; percentage: number };
  href?: string;
  icon?: ReactNode;
}

export interface StatsGridProps {
  items: StatItem[];
  loading?: boolean;
}

/* ─── Helpers ───────────────────────────────────────────────────── */

function TrendIndicator({ direction, percentage }: { direction: 'up' | 'down'; percentage: number }) {
  const isUp = direction === 'up';
  return (
    <span
      className="stats-grid-trend"
      style={{ color: isUp ? 'var(--success, #22c55e)' : 'var(--danger, #ef4444)' }}
      aria-label={`${isUp ? 'Up' : 'Down'} ${percentage}%`}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
        style={{ transform: isUp ? undefined : 'rotate(180deg)' }}
      >
        <path d="M6 2L10 7H2L6 2Z" fill="currentColor" />
      </svg>
      {percentage}%
    </span>
  );
}

function SkeletonCard() {
  return (
    <div className="card stat-card stat-card--modern stats-grid-card stats-grid-card--skeleton" aria-hidden="true">
      <div className="stats-grid-card__label skeleton-pulse" style={{ width: '60%', height: 12, borderRadius: 6 }} />
      <div className="stats-grid-card__value skeleton-pulse" style={{ width: '40%', height: 28, borderRadius: 8, marginTop: 12 }} />
      <div className="stats-grid-card__trend skeleton-pulse" style={{ width: '30%', height: 10, borderRadius: 6, marginTop: 8 }} />
    </div>
  );
}

/* ─── Card Content ──────────────────────────────────────────────── */

function StatCardContent({ item }: { item: StatItem }) {
  return (
    <>
      <div className="stats-grid-card__header">
        {item.icon && <span className="stats-grid-card__icon" aria-hidden="true">{item.icon}</span>}
        <span className="stats-grid-card__label cp-kpi-label">{item.label}</span>
      </div>
      <div className="stats-grid-card__value kpi-value cp-kpi-value">{item.value}</div>
      {item.trend && (
        <div className="stats-grid-card__trend">
          <TrendIndicator direction={item.trend.direction} percentage={item.trend.percentage} />
        </div>
      )}
    </>
  );
}

/* ─── Main Component ────────────────────────────────────────────── */

export function StatsGrid({ items, loading }: StatsGridProps) {
  if (loading) {
    return (
      <section className="stats-grid" aria-busy="true" aria-label="Loading statistics">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </section>
    );
  }

  return (
    <section className="stats-grid" aria-label="Statistics overview">
      {items.map((item) => {
        const cardClasses = `card stat-card stat-card--modern stats-grid-card${item.href ? ' stats-grid-card--clickable' : ''}`;

        if (item.href) {
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cardClasses}
              aria-label={`${item.label}: ${item.value}`}
            >
              <StatCardContent item={item} />
            </Link>
          );
        }

        return (
          <article
            key={item.label}
            className={cardClasses}
            aria-label={`${item.label}: ${item.value}`}
          >
            <StatCardContent item={item} />
          </article>
        );
      })}
    </section>
  );
}
