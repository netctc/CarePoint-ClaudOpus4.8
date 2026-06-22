import React from "react";

export function EvidencePanel({
  title,
  badge,
  items,
}: {
  title: string;
  badge?: string;
  items: Array<{ title: string; detail: string }>;
}) {
  return (
    <article className="panel-card evidence-panel">
      <div className="panel-header">
        <h2>{title}</h2>
        {badge ? <span className="status-chip status-info">{badge}</span> : null}
      </div>
      <div className="list-stack compact-list">
        {items.map((item) => (
          <div key={`${item.title}:${item.detail}`} className="evidence-row">
            <strong>{item.title}</strong>
            <p className="muted small">{item.detail}</p>
          </div>
        ))}
      </div>
    </article>
  );
}
