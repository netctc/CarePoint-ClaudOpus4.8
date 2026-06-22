import type { ReactNode } from 'react';
import { StatusBadge } from '@/components/ui/status-badge';

type Tone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

export type DetailStateItem = {
  label: string;
  value: string;
  detail: string;
  tone?: Tone;
};

export function DetailStateStrip({ items }: { items: DetailStateItem[] }) {
  return (
    <div className="detail-state-strip">
      {items.map((item) => (
        <div key={`${item.label}-${item.value}`} className={`detail-state-card ${item.tone || 'neutral'}`}>
          <div className="detail-state-label">{item.label}</div>
          <div className="detail-state-value">{item.value}</div>
          <div className="detail-state-detail">{item.detail}</div>
        </div>
      ))}
    </div>
  );
}

export type MetadataItem = {
  label: string;
  value: ReactNode;
  detail?: string;
};

export function MetadataGrid({ items }: { items: MetadataItem[] }) {
  return (
    <div className="detail-meta-grid">
      {items.map((item) => (
        <div key={item.label} className="detail-meta-card">
          <div className="detail-meta-label">{item.label}</div>
          <div className="detail-meta-value">{item.value}</div>
          {item.detail ? <div className="detail-meta-detail">{item.detail}</div> : null}
        </div>
      ))}
    </div>
  );
}

export type EvidenceBadge = {
  label: string;
  tone?: Tone;
};

export type EvidenceCardItem = {
  title: string;
  meta?: string;
  description: string;
  bullets?: string[];
  badges?: EvidenceBadge[];
};

export function EvidenceCardGrid({
  items,
  columns = 2,
}: {
  items: EvidenceCardItem[];
  columns?: 1 | 2;
}) {
  return (
    <div className={`evidence-grid ${columns === 1 ? 'single' : 'double'}`}>
      {items.map((item) => (
        <div key={`${item.title}-${item.meta || ''}`} className="evidence-card">
          <div className="evidence-card-head">
            <div>
              <div className="evidence-card-title">{item.title}</div>
              {item.meta ? <div className="evidence-card-meta">{item.meta}</div> : null}
            </div>
            {item.badges?.length ? (
              <div className="chip-row">
                {item.badges.map((badge) => (
                  <StatusBadge key={`${item.title}-${badge.label}`} tone={badge.tone || 'neutral'}>
                    {badge.label}
                  </StatusBadge>
                ))}
              </div>
            ) : null}
          </div>
          <p className="evidence-card-copy">{item.description}</p>
          {item.bullets?.length ? (
            <ul className="evidence-card-list">
              {item.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );
}
