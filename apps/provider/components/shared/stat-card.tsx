export function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="stat-card provider-stat-card cp-dashboard-card" aria-label={`${label}: ${value}`}>
      <span className="detail-label cp-kpi-label">{label}</span>
      <strong className="stat-value cp-kpi-value">{value}</strong>
      <p className="muted small">{detail}</p>
    </article>
  );
}
