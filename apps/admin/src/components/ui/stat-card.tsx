import { AdminIcon } from './admin-icon';

type StatCardProps = {
  label: string;
  value: string;
  trend: string;
  tone?: 'info' | 'success' | 'warning' | 'neutral';
};

function inferIcon(label: string) {
  const text = label.toLowerCase();
  if (text.includes('uptime') || text.includes('live session')) return 'spark';
  if (text.includes('booking') || text.includes('queue')) return 'bookings';
  if (text.includes('provider')) return 'providers';
  if (text.includes('refill') || text.includes('export') || text.includes('audit')) return 'queue';
  if (text.includes('payment') || text.includes('settlement') || text.includes('rejected') || text.includes('value')) return 'money';
  return 'overview';
}

function inferTone(value: string, trend: string): NonNullable<StatCardProps['tone']> {
  const combined = `${value} ${trend}`.toLowerCase();
  if (combined.includes('optimal') || combined.includes('stable') || combined.includes('ready') || combined.includes('clear')) return 'success';
  if (combined.includes('risk') || combined.includes('pending') || combined.includes('restricted')) return 'warning';
  return 'info';
}

export function StatCard({ label, value, trend, tone }: StatCardProps) {
  const resolvedTone = tone ?? inferTone(value, trend);

  return (
    <article className="card stat-card stat-card--modern cp-dashboard-card" aria-label={`${label}: ${value}`}>
      <div className="stat-card-header">
        <div className={`stat-icon ${resolvedTone}`} aria-hidden="true">
          <AdminIcon name={inferIcon(label)} />
        </div>
        <span className={`status-badge ${resolvedTone === 'warning' ? 'warning' : resolvedTone === 'success' ? 'success' : 'info'}`}>
          {resolvedTone === 'warning' ? 'Watch' : resolvedTone === 'success' ? 'Stable' : 'Live'}
        </span>
      </div>
      <h3 className="cp-kpi-label">{label}</h3>
      <div className="kpi-value cp-kpi-value">{value}</div>
      <p className="muted">{trend}</p>
    </article>
  );
}
