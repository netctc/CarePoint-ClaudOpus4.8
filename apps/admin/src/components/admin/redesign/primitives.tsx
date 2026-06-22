import type { ReactNode } from 'react';
import Link from 'next/link';
import { AdminIcon } from '@/components/ui/admin-icon';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="admin-workspace-header">
      <div>
        {eyebrow ? <span className="admin-workspace-eyebrow">{eyebrow}</span> : null}
        <h1 className="admin-workspace-title">{title}</h1>
        <p className="admin-workspace-description">{description}</p>
      </div>
      {actions ? <div className="admin-workspace-actions">{actions}</div> : null}
    </div>
  );
}

export function ActionButton({ label, variant = 'secondary', icon, href }: { label: string; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; icon?: string; href?: string }) {
  const className = `admin-button admin-button--${variant}`;
  const content = (
    <>
      {icon ? <AdminIcon name={icon} /> : null}
      <span>{label}</span>
    </>
  );

  if (href) return <Link href={href} className={className}>{content}</Link>;
  return <button type="button" className={className}>{content}</button>;
}

export function KpiCard({ label, value, meta, tone = 'default', accent, footer }: { label: string; value: string; meta?: string; tone?: 'default' | 'danger' | 'primary'; accent?: string; footer?: ReactNode }) {
  return (
    <article className={`admin-kpi-card admin-kpi-card--${tone}`}>
      <div className="admin-kpi-topline">
        <span className="admin-kpi-label">{label}</span>
        {accent ? <span className={`admin-chip ${tone === 'danger' ? 'admin-chip--danger' : 'admin-chip--soft'}`}>{accent}</span> : null}
      </div>
      <div className="admin-kpi-value">{value}</div>
      {meta ? <p className="admin-kpi-meta">{meta}</p> : null}
      {footer ? <div className="admin-kpi-footer">{footer}</div> : null}
    </article>
  );
}

export function SectionCard({ title, actions, children, className = '' }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`admin-section-card ${className}`.trim()}>
      {title || actions ? (
        <div className="admin-section-header">
          {title ? <h2 className="admin-section-title">{title}</h2> : <span />}
          {actions ? <div className="admin-section-actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'blue' | 'green' | 'red' | 'amber' | 'soft' }) {
  return <span className={`admin-status-pill admin-status-pill--${tone}`}>{label}</span>;
}

export function MiniBars({ values, highlightIndex }: { values: number[]; highlightIndex?: number }) {
  const max = Math.max(...values, 1);
  return (
    <div className="admin-mini-bars" aria-hidden="true">
      {values.map((value, index) => (
        <span
          key={`${value}-${index}`}
          className={`admin-mini-bar ${highlightIndex === index ? 'is-highlight' : ''}`}
          style={{ height: `${Math.max(22, Math.round((value / max) * 110))}px` }}
        />
      ))}
    </div>
  );
}

export function Donut({ value, label }: { value: number; label: string }) {
  return (
    <div className="admin-donut-wrap">
      <div className="admin-donut" style={{ ['--value' as string]: `${value}` }}>
        <div>
          <strong>{value}%</strong>
          <span>{label}</span>
        </div>
      </div>
    </div>
  );
}

export function AvatarStack({ names }: { names: string[] }) {
  return (
    <div className="admin-avatar-stack">
      {names.map((name, index) => (
        <span key={name + index} className="admin-avatar-stack__item">{name}</span>
      ))}
    </div>
  );
}

export function MetricLegend({ color = 'blue', label, value }: { color?: 'blue' | 'gray' | 'red' | 'green'; label: string; value: string }) {
  return (
    <div className="admin-legend-row">
      <span className={`admin-legend-dot admin-legend-dot--${color}`} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function SmallInfoCard({ title, description, badge }: { title: string; description: string; badge?: ReactNode }) {
  return (
    <article className="admin-small-info-card">
      <div className="admin-small-info-head">
        <h3>{title}</h3>
        {badge}
      </div>
      <p>{description}</p>
    </article>
  );
}
