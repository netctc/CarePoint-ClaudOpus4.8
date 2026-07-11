'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi } from '@/lib/api-client';
import { getBrowserSession } from '@/lib/auth/browser-session';
import { StatusBadge } from '@/components/ui/status-badge';

type AuditEntry = {
  id: string;
  actor: string;
  actorId: string;
  action: string;
  resource: string;
  resourceId: string;
  resourceType: string;
  organizationId?: string | null;
  organizationName?: string | null;
  timestamp: string;
  summary: string;
  details?: Record<string, unknown> | null;
  resourceDeleted?: boolean;
};

type AuditListResponse = {
  items: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
};

type AuditDetailResponse = AuditEntry & {
  details: Record<string, unknown> | null;
  resourceDeleted: boolean;
  resourceUrl?: string | null;
};

const PAGE_SIZE = 50;
const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toISOString();
  } catch {
    return iso;
  }
}

function formatDisplayTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function getDefaultDateFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - DEFAULT_DAYS);
  return d.toISOString().split('T')[0];
}

function getDefaultDateTo(): string {
  return new Date().toISOString().split('T')[0];
}

function actionTone(action: string): 'info' | 'success' | 'warning' | 'danger' | 'neutral' {
  const lower = action.toLowerCase();
  if (lower.includes('create') || lower.includes('accept')) return 'success';
  if (lower.includes('delete') || lower.includes('revoke') || lower.includes('cancel')) return 'danger';
  if (lower.includes('update') || lower.includes('change') || lower.includes('assign')) return 'info';
  if (lower.includes('suspend') || lower.includes('reject')) return 'warning';
  return 'neutral';
}

export default function IamAuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [dateFrom, setDateFrom] = useState(getDefaultDateFrom);
  const [dateTo, setDateTo] = useState(getDefaultDateTo);
  const [orgFilter, setOrgFilter] = useState('');

  // Detail view state
  const [selectedEntry, setSelectedEntry] = useState<AuditDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Export dialog state
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [exportPurpose, setExportPurpose] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const session = useMemo(() => getBrowserSession(), []);
  const isSuperAdmin = session.role === 'SUPER_ADMIN';

  const fetchAuditEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (actionFilter.trim()) params.set('action', actionFilter.trim());
      if (resourceFilter.trim()) params.set('resource', resourceFilter.trim());
      if (actorFilter.trim()) params.set('actor', actorFilter.trim());
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (isSuperAdmin && orgFilter.trim()) params.set('organization', orgFilter.trim());

      const data = await adminApi.iamAuditLogs(params.toString()) as AuditListResponse;
      setEntries(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar registros de auditoría.');
      setEntries([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, resourceFilter, actorFilter, dateFrom, dateTo, orgFilter, isSuperAdmin]);

  useEffect(() => {
    void fetchAuditEntries();
  }, [fetchAuditEntries]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Validate date range does not exceed MAX_DAYS
  const dateRangeValid = useMemo(() => {
    if (!dateFrom || !dateTo) return true;
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    const diffMs = to.getTime() - from.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= MAX_DAYS;
  }, [dateFrom, dateTo]);

  // --- Detail view handler ---
  const handleViewDetail = async (entry: AuditEntry) => {
    setDetailLoading(true);
    setDetailError(null);
    setSelectedEntry(null);
    try {
      const data = await adminApi.iamAuditDetail(entry.id) as AuditDetailResponse;
      setSelectedEntry(data);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Error al cargar detalle.');
    } finally {
      setDetailLoading(false);
    }
  };

  // --- Export handler ---
  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setExporting(true);
    setExportError(null);
    try {
      const params = new URLSearchParams();
      params.set('format', exportFormat);
      params.set('purpose', exportPurpose.trim());
      if (actionFilter.trim()) params.set('action', actionFilter.trim());
      if (resourceFilter.trim()) params.set('resource', resourceFilter.trim());
      if (actorFilter.trim()) params.set('actor', actorFilter.trim());
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (isSuperAdmin && orgFilter.trim()) params.set('organization', orgFilter.trim());

      const data = await adminApi.iamAuditExport(params.toString()) as { content: string; filename: string };
      // Trigger download
      const blob = new Blob([data.content], {
        type: exportFormat === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename || `audit-export.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowExportDialog(false);
      setExportPurpose('');
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Error al exportar registros.');
    } finally {
      setExporting(false);
    }
  };

  // --- Apply filters (reset page) ---
  const applyFilters = () => {
    setPage(1);
  };

  return (
    <div className="stack-lg">
      {/* Filter toolbar */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="audit-action-filter" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
              Tipo de acción
            </label>
            <input
              id="audit-action-filter"
              className="input"
              type="text"
              placeholder="Ej: CREATE, UPDATE…"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              style={{ width: 160 }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="audit-resource-filter" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
              Tipo de recurso
            </label>
            <input
              id="audit-resource-filter"
              className="input"
              type="text"
              placeholder="Ej: User, Appointment…"
              value={resourceFilter}
              onChange={(e) => setResourceFilter(e.target.value)}
              style={{ width: 160 }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="audit-actor-filter" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
              Actor
            </label>
            <input
              id="audit-actor-filter"
              className="input"
              type="text"
              placeholder="Nombre o ID…"
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              style={{ width: 160 }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="audit-date-from" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
              Desde
            </label>
            <input
              id="audit-date-from"
              className="input"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ width: 150 }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="audit-date-to" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
              Hasta
            </label>
            <input
              id="audit-date-to"
              className="input"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{ width: 150 }}
            />
          </div>
          {isSuperAdmin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="audit-org-filter" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                Organización
              </label>
              <input
                id="audit-org-filter"
                className="input"
                type="text"
                placeholder="Nombre de org…"
                value={orgFilter}
                onChange={(e) => setOrgFilter(e.target.value)}
                style={{ width: 160 }}
              />
            </div>
          )}
          <button
            className="button primary"
            onClick={applyFilters}
            disabled={!dateRangeValid}
            style={{ alignSelf: 'flex-end' }}
          >
            Filtrar
          </button>
          <button
            className="button secondary"
            onClick={() => setShowExportDialog(true)}
            style={{ alignSelf: 'flex-end' }}
          >
            Exportar
          </button>
        </div>
        {!dateRangeValid && (
          <p style={{ color: 'var(--color-danger, #dc3545)', fontSize: '0.82rem', marginTop: 8, marginBottom: 0 }}>
            El rango de fechas no puede superar {MAX_DAYS} días.
          </p>
        )}
      </div>

      {/* Summary */}
      <div className="toolbar">
        <div className="toolbar-group">
          <span className="muted" style={{ alignSelf: 'center' }}>
            {total} registro{total !== 1 ? 's' : ''} de auditoría
          </span>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="banner warning">{error}</div>
      )}

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Actor</th>
                <th>Acción</th>
                <th>Recurso</th>
                <th>Fecha/Hora</th>
                <th>Resumen</th>
                {isSuperAdmin && <th>Organización</th>}
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={isSuperAdmin ? 7 : 6} style={{ textAlign: 'center', padding: '40px 12px' }}>
                    <span className="muted">Cargando registros de auditoría…</span>
                  </td>
                </tr>
              )}
              {!loading && entries.length === 0 && (
                <tr>
                  <td colSpan={isSuperAdmin ? 7 : 6} style={{ textAlign: 'center', padding: '40px 12px' }}>
                    <span className="muted">
                      No se encontraron entradas de auditoría que coincidan con los filtros aplicados.
                    </span>
                  </td>
                </tr>
              )}
              {!loading && entries.map((entry) => (
                <tr key={entry.id}>
                  <td style={{ fontWeight: 700 }}>{entry.actor}</td>
                  <td>
                    <StatusBadge tone={actionTone(entry.action)}>
                      {entry.action}
                    </StatusBadge>
                  </td>
                  <td>
                    <span className="muted" style={{ fontSize: '0.82rem' }}>{entry.resourceType}</span>
                    <br />
                    {entry.resource}
                  </td>
                  <td className="muted" style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                    {formatDisplayTimestamp(entry.timestamp)}
                  </td>
                  <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {entry.summary || '—'}
                  </td>
                  {isSuperAdmin && (
                    <td>{entry.organizationName ?? '—'}</td>
                  )}
                  <td>
                    <button
                      className="button secondary"
                      style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                      onClick={() => handleViewDetail(entry)}
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 22px',
              borderTop: '1px solid rgba(217, 227, 242, 0.9)',
            }}
          >
            <button
              className="button secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Anterior
            </button>
            <span className="muted" style={{ fontSize: '0.86rem' }}>
              Página {page} de {totalPages}
            </span>
            <button
              className="button secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>

      {/* Detail View Dialog */}
      {(selectedEntry || detailLoading) && (
        <div
          className="iam-dialog-overlay"
          onClick={() => { setSelectedEntry(null); setDetailError(null); }}
          role="dialog"
          aria-modal="true"
          aria-label="Detalle de auditoría"
        >
          <div
            className="iam-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 640, width: '90vw' }}
          >
            <h3 style={{ marginTop: 0 }}>Detalle de Auditoría</h3>
            {detailLoading && (
              <p className="muted">Cargando detalle…</p>
            )}
            {detailError && (
              <div className="banner warning">{detailError}</div>
            )}
            {selectedEntry && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-muted, #6b7685)' }}>Actor</span>
                    <p style={{ margin: '2px 0 0' }}>{selectedEntry.actor}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-muted, #6b7685)' }}>Acción</span>
                    <p style={{ margin: '2px 0 0' }}>
                      <StatusBadge tone={actionTone(selectedEntry.action)}>
                        {selectedEntry.action}
                      </StatusBadge>
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-muted, #6b7685)' }}>Recurso</span>
                    <p style={{ margin: '2px 0 0' }}>{selectedEntry.resourceType}: {selectedEntry.resource}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-muted, #6b7685)' }}>Fecha/Hora</span>
                    <p style={{ margin: '2px 0 0' }}>{formatTimestamp(selectedEntry.timestamp)}</p>
                  </div>
                  {selectedEntry.organizationName && (
                    <div>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-muted, #6b7685)' }}>Organización</span>
                      <p style={{ margin: '2px 0 0' }}>{selectedEntry.organizationName}</p>
                    </div>
                  )}
                </div>

                {/* Resource navigation link */}
                <div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-muted, #6b7685)' }}>
                    Enlace al recurso
                  </span>
                  {selectedEntry.resourceDeleted ? (
                    <p style={{ margin: '2px 0 0', color: 'var(--color-muted, #6b7685)', fontStyle: 'italic' }}>
                      El recurso ya no existe.
                    </p>
                  ) : selectedEntry.resourceUrl ? (
                    <p style={{ margin: '2px 0 0' }}>
                      <a href={selectedEntry.resourceUrl} style={{ color: 'var(--color-primary, #2563eb)', textDecoration: 'underline' }}>
                        Ver recurso →
                      </a>
                    </p>
                  ) : (
                    <p style={{ margin: '2px 0 0', color: 'var(--color-muted, #6b7685)' }}>
                      No disponible
                    </p>
                  )}
                </div>

                {/* Change summary */}
                {selectedEntry.summary && (
                  <div>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-muted, #6b7685)' }}>Resumen</span>
                    <p style={{ margin: '2px 0 0' }}>{selectedEntry.summary}</p>
                  </div>
                )}

                {/* Structured change details */}
                <div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-muted, #6b7685)' }}>
                    Datos de cambio
                  </span>
                  {selectedEntry.details ? (
                    <pre
                      style={{
                        background: 'var(--color-surface, #f4f6f9)',
                        borderRadius: 6,
                        padding: '12px 16px',
                        fontSize: '0.82rem',
                        overflow: 'auto',
                        maxHeight: 300,
                        marginTop: 4,
                      }}
                    >
                      {JSON.stringify(selectedEntry.details, null, 2)}
                    </pre>
                  ) : (
                    <p style={{ margin: '2px 0 0', color: 'var(--color-muted, #6b7685)' }}>
                      Sin datos de cambio.
                    </p>
                  )}
                </div>

                <div className="iam-dialog-actions" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => { setSelectedEntry(null); setDetailError(null); }}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Export Dialog */}
      {showExportDialog && (
        <div
          className="iam-dialog-overlay"
          onClick={() => setShowExportDialog(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Exportar auditoría"
        >
          <div
            className="iam-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Exportar Registros de Auditoría</h3>
            <form onSubmit={handleExport}>
              <div className="iam-dialog-field">
                <label htmlFor="export-format">Formato</label>
                <select
                  id="export-format"
                  className="select"
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as 'json' | 'csv')}
                >
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                </select>
              </div>
              <div className="iam-dialog-field">
                <label htmlFor="export-purpose">Propósito de la exportación</label>
                <input
                  id="export-purpose"
                  className="input"
                  type="text"
                  required
                  placeholder="Ej: Revisión de cumplimiento trimestral…"
                  value={exportPurpose}
                  onChange={(e) => setExportPurpose(e.target.value)}
                />
                <span className="muted" style={{ fontSize: '0.8rem' }}>
                  Requerido. Describe la razón de la exportación para cumplimiento.
                </span>
              </div>
              {exportError && (
                <div className="banner warning" style={{ marginTop: 8 }}>{exportError}</div>
              )}
              <div className="iam-dialog-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setShowExportDialog(false)}
                  disabled={exporting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="button primary"
                  disabled={exporting || !exportPurpose.trim()}
                >
                  {exporting ? 'Exportando…' : 'Exportar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
