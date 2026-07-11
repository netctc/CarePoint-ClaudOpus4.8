'use client';

import { useCallback, useState } from 'react';

/* ─── Types ─────────────────────────────────────────────────────── */

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDefinition {
  id: string;
  label: string;
  type: 'text' | 'select' | 'multi-select' | 'date-range';
  options?: FilterOption[]; // for select/multi-select
  placeholder?: string;
}

export interface FilterPanelProps {
  filters: FilterDefinition[];
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
  onApply?: () => void;
  onClear?: () => void;
}

/* ─── Component ─────────────────────────────────────────────────── */

export function FilterPanel({ filters, values, onChange, onApply, onClear }: FilterPanelProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleGroup = useCallback((id: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const updateValue = useCallback(
    (id: string, value: any) => {
      onChange({ ...values, [id]: value });
    },
    [values, onChange]
  );

  const handleClear = useCallback(() => {
    const cleared: Record<string, any> = {};
    filters.forEach((f) => {
      if (f.type === 'multi-select') {
        cleared[f.id] = [];
      } else if (f.type === 'date-range') {
        cleared[f.id] = { from: '', to: '' };
      } else {
        cleared[f.id] = '';
      }
    });
    onChange(cleared);
    onClear?.();
  }, [filters, onChange, onClear]);

  const handleApply = useCallback(() => {
    onApply?.();
  }, [onApply]);

  const toggleMultiSelect = useCallback(
    (filterId: string, optionValue: string) => {
      const current: string[] = values[filterId] || [];
      const updated = current.includes(optionValue)
        ? current.filter((v: string) => v !== optionValue)
        : [...current, optionValue];
      updateValue(filterId, updated);
    },
    [values, updateValue]
  );

  const renderFilter = (filter: FilterDefinition) => {
    const isCollapsed = collapsedGroups[filter.id] ?? false;

    return (
      <div key={filter.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
        {/* Collapsible Header */}
        <button
          type="button"
          onClick={() => toggleGroup(filter.id)}
          aria-expanded={!isCollapsed}
          aria-controls={`filter-group-${filter.id}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '10px 0',
            background: 'none',
            border: 0,
            cursor: 'pointer',
            color: 'var(--text)',
            fontWeight: 800,
            fontSize: '0.86rem',
            letterSpacing: '0.02em',
            minHeight: 'var(--ux-hit-target)',
          }}
        >
          {filter.label}
          <span
            aria-hidden="true"
            style={{
              fontSize: '0.7rem',
              color: 'var(--muted)',
              transition: 'transform 150ms ease',
              transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            }}
          >
            ▼
          </span>
        </button>

        {/* Filter Content */}
        {!isCollapsed && (
          <div
            id={`filter-group-${filter.id}`}
            style={{ paddingTop: 6, paddingBottom: 4 }}
          >
            {filter.type === 'text' && (
              <input
                className="input"
                type="text"
                placeholder={filter.placeholder || `Filter by ${filter.label.toLowerCase()}...`}
                value={values[filter.id] || ''}
                onChange={(e) => updateValue(filter.id, e.target.value)}
                aria-label={filter.label}
                style={{ padding: '10px 14px', fontSize: '0.88rem' }}
              />
            )}

            {filter.type === 'select' && (
              <select
                className="select"
                value={values[filter.id] || ''}
                onChange={(e) => updateValue(filter.id, e.target.value)}
                aria-label={filter.label}
                style={{ padding: '10px 14px', fontSize: '0.88rem' }}
              >
                <option value="">{filter.placeholder || `All ${filter.label}`}</option>
                {filter.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}

            {filter.type === 'multi-select' && (
              <div
                style={{ display: 'grid', gap: 6, maxHeight: 180, overflow: 'auto' }}
                role="group"
                aria-label={filter.label}
              >
                {filter.options?.map((opt) => {
                  const checked = (values[filter.id] || []).includes(opt.value);
                  return (
                    <label
                      key={opt.value}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '6px 4px',
                        cursor: 'pointer',
                        fontSize: '0.86rem',
                        fontWeight: 700,
                        color: checked ? 'var(--text)' : 'var(--muted-strong)',
                        borderRadius: 10,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMultiSelect(filter.id, opt.value)}
                        style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
                      />
                      {opt.label}
                    </label>
                  );
                })}
              </div>
            )}

            {filter.type === 'date-range' && (
              <div style={{ display: 'grid', gap: 8 }}>
                <label style={{ display: 'grid', gap: 4, fontSize: '0.8rem', fontWeight: 700, color: 'var(--muted)' }}>
                  From
                  <input
                    className="input"
                    type="date"
                    value={values[filter.id]?.from || ''}
                    onChange={(e) =>
                      updateValue(filter.id, { ...(values[filter.id] || {}), from: e.target.value })
                    }
                    aria-label={`${filter.label} from date`}
                    style={{ padding: '10px 14px', fontSize: '0.86rem' }}
                  />
                </label>
                <label style={{ display: 'grid', gap: 4, fontSize: '0.8rem', fontWeight: 700, color: 'var(--muted)' }}>
                  To
                  <input
                    className="input"
                    type="date"
                    value={values[filter.id]?.to || ''}
                    onChange={(e) =>
                      updateValue(filter.id, { ...(values[filter.id] || {}), to: e.target.value })
                    }
                    aria-label={`${filter.label} to date`}
                    style={{ padding: '10px 14px', fontSize: '0.86rem' }}
                  />
                </label>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const panelContent = (
    <div style={{ display: 'grid', gap: 10 }}>
      {filters.map(renderFilter)}

      {/* Action Buttons */}
      <div style={{ display: 'grid', gap: 10, paddingTop: 14 }}>
        <button
          className="button primary"
          onClick={handleApply}
          style={{ width: '100%', justifyContent: 'center', minHeight: 42 }}
        >
          Apply Filters
        </button>
        <button
          className="button secondary"
          onClick={handleClear}
          style={{ width: '100%', justifyContent: 'center', minHeight: 42 }}
        >
          Clear All
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Toggle Button */}
      <div className="filter-panel-mobile-toggle">
        <button
          className="button secondary"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          aria-controls="filter-panel-mobile"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {mobileOpen ? 'Hide Filters' : 'Show Filters'}
        </button>
      </div>

      {/* Desktop Sidebar */}
      <aside
        className="filter-panel-desktop"
        aria-label="Filters"
        style={{
          position: 'sticky',
          top: 90,
          alignSelf: 'start',
          background: 'rgba(255, 255, 255, 0.92)',
          border: '1px solid rgba(217, 227, 242, 0.88)',
          borderRadius: 24,
          boxShadow: 'var(--shadow-sm)',
          padding: 20,
          minWidth: 260,
          maxWidth: 300,
        }}
      >
        <div style={{ marginBottom: 14 }}>
          <h3
            style={{
              margin: 0,
              fontSize: '0.94rem',
              fontWeight: 800,
              letterSpacing: '-0.02em',
            }}
          >
            Filters
          </h3>
        </div>
        {panelContent}
      </aside>

      {/* Mobile Collapsible Panel */}
      {mobileOpen && (
        <div
          id="filter-panel-mobile"
          className="filter-panel-mobile-content"
          style={{
            background: 'rgba(255, 255, 255, 0.92)',
            border: '1px solid rgba(217, 227, 242, 0.88)',
            borderRadius: 24,
            boxShadow: 'var(--shadow-sm)',
            padding: 20,
          }}
        >
          <div style={{ marginBottom: 14 }}>
            <h3
              style={{
                margin: 0,
                fontSize: '0.94rem',
                fontWeight: 800,
                letterSpacing: '-0.02em',
              }}
            >
              Filters
            </h3>
          </div>
          {panelContent}
        </div>
      )}

      {/* Responsive Styles */}
      <style>{`
        .filter-panel-mobile-toggle {
          display: none;
        }
        .filter-panel-mobile-content {
          display: none;
        }
        @media (max-width: 1100px) {
          .filter-panel-desktop {
            display: none !important;
          }
          .filter-panel-mobile-toggle {
            display: block;
          }
          .filter-panel-mobile-content {
            display: block !important;
          }
        }
      `}</style>
    </>
  );
}
