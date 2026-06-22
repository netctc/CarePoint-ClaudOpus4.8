import React from "react";

type Item = {
  label: string;
  value: string;
  tone?: 'info' | 'success' | 'warning' | 'danger';
};

export function WorkspaceStateStrip({ items }: { items: Item[] }) {
  return (
    <div className="workspace-state-strip">
      {items.map((item) => (
        <div key={`${item.label}:${item.value}`} className={`workspace-state-card workspace-tone-${item.tone ?? 'info'}`}>
          <span className="detail-label">{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}
