import type { ReactNode } from 'react';

export function StatusBadge({
  tone = 'neutral',
  children
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
  children: ReactNode;
}) {
  return <span className={`status-badge ${tone}`}>{children}</span>;
}
