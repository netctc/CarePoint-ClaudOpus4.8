'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* ─── Types ─────────────────────────────────────────────────────── */

export interface ColumnDef<T> {
  id: string;
  header: string;
  accessor: (row: T) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
  hidden?: boolean;
}

export interface AdminDataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  onSort?: (columnId: string, direction: 'asc' | 'desc') => void;
  onSearch?: (term: string) => void;
  searchable?: boolean;
  exportFileName?: string;
  loading?: boolean;
  emptyMessage?: string;
  tableId?: string;
}

interface FilterPreset {
  name: string;
  search: string;
  visibleColumns: string[];
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc';
}

/* ─── Helpers ───────────────────────────────────────────────────── */

function getPresetsKey(tableId: string) {
  return `adt-presets-${tableId}`;
}

function getVisibilityKey(tableId: string) {
  return `adt-visibility-${tableId}`;
}

function loadPresets(tableId: string): FilterPreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getPresetsKey(tableId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePresets(tableId: string, presets: FilterPreset[]) {
  try {
    localStorage.setItem(getPresetsKey(tableId), JSON.stringify(presets));
  } catch {
    /* localStorage full or unavailable */
  }
}

function loadVisibility(tableId: string): string[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(getVisibilityKey(tableId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveVisibility(tableId: string, visible: string[]) {
  try {
    localStorage.setItem(getVisibilityKey(tableId), JSON.stringify(visible));
  } catch {
    /* localStorage full or unavailable */
  }
}

function escapeCsvCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/* ─── Component ─────────────────────────────────────────────────── */

export function AdminDataTable<T>({
  columns,
  data,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onSort,
  onSearch,
  searchable = false,
  exportFileName = 'export',
  loading = false,
  emptyMessage = 'No results found.',
  tableId,
}: AdminDataTableProps<T>) {
  /* ── Column visibility ────────────── */
  const resolvedTableId = tableId ?? 'default';
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(() => {
    const saved = loadVisibility(resolvedTableId);
    if (saved) return saved;
    return columns.filter((c) => !c.hidden).map((c) => c.id);
  });
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);

  /* ── Sort state ───────────────────── */
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  /* ── Search state ─────────────────── */
  const [searchTerm, setSearchTerm] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();

  /* ── Filter presets ───────────────── */
  const [presets, setPresets] = useState<FilterPreset[]>(() => loadPresets(resolvedTableId));
  const [presetMenuOpen, setPresetMenuOpen] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState('');
  const presetMenuRef = useRef<HTMLDivElement>(null);

  /* ── Export menu ──────────────────── */
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const visibleColumns = useMemo(
    () => columns.filter((c) => visibleColumnIds.includes(c.id)),
    [columns, visibleColumnIds]
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  /* ── Close dropdowns on outside click ── */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (columnMenuRef.current && !columnMenuRef.current.contains(e.target as Node)) {
        setColumnMenuOpen(false);
      }
      if (presetMenuRef.current && !presetMenuRef.current.contains(e.target as Node)) {
        setPresetMenuOpen(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /* ── Persist visibility ────────────── */
  useEffect(() => {
    saveVisibility(resolvedTableId, visibleColumnIds);
  }, [resolvedTableId, visibleColumnIds]);

  /* ── Handlers ─────────────────────── */

  const handleSearch = useCallback(
    (value: string) => {
      setSearchTerm(value);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(() => {
        onSearch?.(value);
      }, 300);
    },
    [onSearch]
  );

  const handleSort = useCallback(
    (columnId: string) => {
      let direction: 'asc' | 'desc' = 'asc';
      if (sortColumn === columnId) {
        direction = sortDirection === 'asc' ? 'desc' : 'asc';
      }
      setSortColumn(columnId);
      setSortDirection(direction);
      onSort?.(columnId, direction);
    },
    [sortColumn, sortDirection, onSort]
  );

  const toggleColumnVisibility = useCallback(
    (columnId: string) => {
      setVisibleColumnIds((prev) => {
        if (prev.includes(columnId)) {
          if (prev.length <= 1) return prev; // keep at least one column
          return prev.filter((id) => id !== columnId);
        }
        return [...prev, columnId];
      });
    },
    []
  );

  const saveCurrentPreset = useCallback(() => {
    const name = presetNameInput.trim();
    if (!name) return;
    const preset: FilterPreset = {
      name,
      search: searchTerm,
      visibleColumns: visibleColumnIds,
      sortColumn,
      sortDirection,
    };
    const updated = [...presets.filter((p) => p.name !== name), preset];
    setPresets(updated);
    savePresets(resolvedTableId, updated);
    setPresetNameInput('');
  }, [presetNameInput, searchTerm, visibleColumnIds, sortColumn, sortDirection, presets, resolvedTableId]);

  const applyPreset = useCallback(
    (preset: FilterPreset) => {
      setSearchTerm(preset.search);
      setVisibleColumnIds(preset.visibleColumns);
      if (preset.sortColumn) {
        setSortColumn(preset.sortColumn);
        setSortDirection(preset.sortDirection);
        onSort?.(preset.sortColumn, preset.sortDirection);
      }
      onSearch?.(preset.search);
      setPresetMenuOpen(false);
    },
    [onSort, onSearch]
  );

  const deletePreset = useCallback(
    (name: string) => {
      const updated = presets.filter((p) => p.name !== name);
      setPresets(updated);
      savePresets(resolvedTableId, updated);
    },
    [presets, resolvedTableId]
  );

  /* ── Export functions ──────────────── */

  const generateCsvContent = useCallback((): string => {
    const headers = visibleColumns.map((c) => escapeCsvCell(c.header));
    const rows = data.map((row) =>
      visibleColumns.map((col) => {
        const cellValue = col.accessor(row);
        const text = typeof cellValue === 'string' ? cellValue : String(cellValue ?? '');
        return escapeCsvCell(text);
      })
    );
    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }, [visibleColumns, data]);

  const downloadFile = useCallback((content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, []);

  const exportCsv = useCallback(() => {
    const csv = generateCsvContent();
    downloadFile(csv, `${exportFileName}.csv`, 'text/csv;charset=utf-8;');
    setExportMenuOpen(false);
  }, [generateCsvContent, downloadFile, exportFileName]);

  const exportExcel = useCallback(() => {
    // Excel-compatible CSV with .xlsx extension (basic approach without external library)
    const csv = generateCsvContent();
    downloadFile(csv, `${exportFileName}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    setExportMenuOpen(false);
  }, [generateCsvContent, downloadFile, exportFileName]);

  const exportPdf = useCallback(() => {
    // Basic table-to-print PDF generation
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const tableHtml = `
      <html>
        <head>
          <title>${exportFileName}</title>
          <style>
            body { font-family: Inter, sans-serif; padding: 24px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 10px 12px; border: 1px solid #d9e3f2; text-align: left; }
            th { background: #f4f7fc; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <h2>${exportFileName}</h2>
          <table>
            <thead>
              <tr>${visibleColumns.map((c) => `<th>${c.header}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${data
                .map(
                  (row) =>
                    `<tr>${visibleColumns
                      .map((col) => {
                        const cellValue = col.accessor(row);
                        const text = typeof cellValue === 'string' ? cellValue : String(cellValue ?? '');
                        return `<td>${text}</td>`;
                      })
                      .join('')}</tr>`
                )
                .join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    printWindow.document.write(tableHtml);
    printWindow.document.close();
    printWindow.print();
    setExportMenuOpen(false);
  }, [visibleColumns, data, exportFileName]);

  /* ── Pagination helpers ────────────── */

  const pageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('ellipsis');
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  }, [page, totalPages]);

  /* ── Render ────────────────────────── */

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Toolbar */}
      <div className="toolbar" style={{ padding: '18px 22px 12px', marginBottom: 0 }}>
        <div className="toolbar-group" style={{ alignItems: 'center' }}>
          {/* Search */}
          {searchable && (
            <div style={{ position: 'relative', minWidth: 240 }}>
              <input
                className="input"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                aria-label="Search table"
                style={{ paddingLeft: 14 }}
              />
            </div>
          )}

          {/* Filter Presets */}
          {tableId && (
            <div ref={presetMenuRef} style={{ position: 'relative' }}>
              <button
                className="button secondary"
                onClick={() => setPresetMenuOpen(!presetMenuOpen)}
                aria-expanded={presetMenuOpen}
                aria-haspopup="true"
              >
                Presets
              </button>
              {presetMenuOpen && (
                <div className="card" style={dropdownStyle}>
                  <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        className="input"
                        placeholder="Preset name..."
                        value={presetNameInput}
                        onChange={(e) => setPresetNameInput(e.target.value)}
                        style={{ flex: 1, padding: '8px 10px' }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveCurrentPreset();
                        }}
                      />
                      <button
                        className="button primary"
                        onClick={saveCurrentPreset}
                        style={{ minHeight: 34, padding: '6px 12px', fontSize: '0.82rem' }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                  {presets.length === 0 ? (
                    <div style={{ padding: '14px', color: 'var(--muted)', fontSize: '0.86rem' }}>
                      No saved presets yet.
                    </div>
                  ) : (
                    <div style={{ maxHeight: 200, overflow: 'auto' }}>
                      {presets.map((preset) => (
                        <div
                          key={preset.name}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            padding: '10px 14px',
                            borderBottom: '1px solid var(--border)',
                            cursor: 'pointer',
                          }}
                        >
                          <span
                            style={{ fontWeight: 700, fontSize: '0.88rem', flex: 1 }}
                            onClick={() => applyPreset(preset)}
                          >
                            {preset.name}
                          </span>
                          <button
                            onClick={() => deletePreset(preset.name)}
                            style={{
                              border: 0,
                              background: 'none',
                              color: 'var(--danger)',
                              cursor: 'pointer',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="toolbar-group" style={{ alignItems: 'center' }}>
          {/* Column Visibility Toggle */}
          <div ref={columnMenuRef} style={{ position: 'relative' }}>
            <button
              className="button secondary"
              onClick={() => setColumnMenuOpen(!columnMenuOpen)}
              aria-expanded={columnMenuOpen}
              aria-haspopup="true"
            >
              Columns
            </button>
            {columnMenuOpen && (
              <div className="card" style={{ ...dropdownStyle, right: 0, left: 'auto' }}>
                <div style={{ padding: '10px 14px', maxHeight: 280, overflow: 'auto' }}>
                  {columns.map((col) => (
                    <label
                      key={col.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 0',
                        cursor: 'pointer',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumnIds.includes(col.id)}
                        onChange={() => toggleColumnVisibility(col.id)}
                        style={{ width: 16, height: 16 }}
                      />
                      {col.header}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Export Menu */}
          <div ref={exportMenuRef} style={{ position: 'relative' }}>
            <button
              className="button secondary"
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              aria-expanded={exportMenuOpen}
              aria-haspopup="true"
            >
              Export
            </button>
            {exportMenuOpen && (
              <div className="card" style={{ ...dropdownStyle, right: 0, left: 'auto' }}>
                <div style={{ padding: '6px 0' }}>
                  <button onClick={exportCsv} style={exportItemStyle}>
                    Export CSV
                  </button>
                  <button onClick={exportExcel} style={exportItemStyle}>
                    Export Excel
                  </button>
                  <button onClick={exportPdf} style={exportItemStyle}>
                    Export PDF
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap" style={{ position: 'relative' }}>
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              background: 'rgba(255,255,255,0.7)',
              zIndex: 5,
            }}
          >
            <div style={{ color: 'var(--muted)', fontWeight: 700, fontSize: '0.9rem' }}>Loading...</div>
          </div>
        )}

        <table>
          <thead>
            <tr>
              {visibleColumns.map((col) => (
                <th
                  key={col.id}
                  style={{ width: col.width, cursor: col.sortable ? 'pointer' : 'default', userSelect: 'none' }}
                  onClick={() => col.sortable && handleSort(col.id)}
                  aria-sort={
                    sortColumn === col.id
                      ? sortDirection === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {col.header}
                    {col.sortable && sortColumn === col.id && (
                      <span aria-hidden="true" style={{ fontSize: '0.7rem' }}>
                        {sortDirection === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                    {col.sortable && sortColumn !== col.id && (
                      <span aria-hidden="true" style={{ fontSize: '0.7rem', opacity: 0.35 }}>
                        ⇅
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && !loading ? (
              <tr>
                <td colSpan={visibleColumns.length} style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <div style={{ color: 'var(--muted)', fontSize: '0.94rem', fontWeight: 700 }}>
                    {emptyMessage}
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, index) => (
                <tr key={index}>
                  {visibleColumns.map((col) => (
                    <td key={col.id} style={{ width: col.width }}>
                      {col.accessor(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '14px 22px',
          borderTop: '1px solid var(--border)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.86rem', color: 'var(--muted)' }}>
          <span>
            Showing {data.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} of{' '}
            {totalCount}
          </span>
          {onPageSizeChange && (
            <select
              className="select"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              style={{ width: 'auto', minWidth: 70, padding: '6px 10px', borderRadius: 10 }}
              aria-label="Page size"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            className="button secondary"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            style={{ minHeight: 34, padding: '6px 12px', fontSize: '0.82rem' }}
            aria-label="Previous page"
          >
            ← Prev
          </button>

          {pageNumbers.map((p, idx) =>
            p === 'ellipsis' ? (
              <span key={`e-${idx}`} style={{ padding: '0 6px', color: 'var(--muted)' }}>
                …
              </span>
            ) : (
              <button
                key={p}
                className={`button ${p === page ? 'primary' : 'secondary'}`}
                onClick={() => onPageChange(p)}
                style={{ minHeight: 34, minWidth: 34, padding: '6px 10px', fontSize: '0.82rem' }}
                aria-label={`Page ${p}`}
                aria-current={p === page ? 'page' : undefined}
              >
                {p}
              </button>
            )
          )}

          <button
            className="button secondary"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            style={{ minHeight: 34, padding: '6px 12px', fontSize: '0.82rem' }}
            aria-label="Next page"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Shared inline styles ──────────────────────────────────────── */

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  marginTop: 6,
  left: 0,
  minWidth: 220,
  zIndex: 50,
  borderRadius: 16,
  boxShadow: '0 18px 44px rgba(17, 39, 73, 0.12)',
  border: '1px solid var(--border)',
  background: 'white',
  padding: 0,
};

const exportItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '10px 16px',
  border: 0,
  background: 'none',
  textAlign: 'left',
  cursor: 'pointer',
  fontSize: '0.88rem',
  fontWeight: 700,
  color: 'var(--text)',
  borderRadius: 0,
};
