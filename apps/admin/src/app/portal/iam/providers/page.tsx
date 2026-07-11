'use client';

import { useCallback, useEffect, useState } from 'react';
import { getBrowserSession } from '@/lib/auth/browser-session';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OnboardingStatus = 'DRAFT' | 'READY_FOR_REVIEW' | 'REQUEST_CHANGES' | 'APPROVED' | 'REJECTED';

type CredentialSummary = {
  total: number;
  verified: number;
  uploaded: number;
  rejected: number;
  expired: number;
  expiringSoon: number;
  missingRequiredTypes: string[];
};

type ProviderListItem = {
  id: string;
  userId: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  roleLabel: string;
  specialty: string | null;
  licenseNumber: string | null;
  organizationId: string;
  organizationName: string | null;
  status: string;
  onboardingStatus: OnboardingStatus;
  credentialSummary: CredentialSummary;
  createdAt: string;
};

type CredentialDocument = {
  id: string;
  providerId: string;
  type: string;
  title: string;
  status: string;
  storedStatus?: string;
  documentUrl: string | null;
  fileName: string | null;
  referenceNumber: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  expiryState: 'NO_EXPIRY' | 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';
  rejectionReason: string | null;
  verifiedAt: string | null;
  verifiedByName: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type ReviewTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueAt: string | null;
  assignedToName: string | null;
  documentId: string | null;
  documentType: string | null;
  documentTitle: string | null;
  completedAt: string | null;
  createdAt: string;
};

type OnboardingHistory = {
  id?: string;
  status: OnboardingStatus;
  checklist: Array<{ label?: string; detail?: string; status?: string }>;
  submittedAt: string | null;
  reviewedAt: string | null;
  decisionNote: string | null;
  lastAction: string | null;
  lastActorId: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type ProviderDetail = {
  id: string;
  userId: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  roleLabel: string;
  systemRole: string;
  specialty: string | null;
  licenseNumber: string | null;
  services: string[];
  organizationId: string;
  organizationName: string | null;
  status: string;
  onboardingStatus: OnboardingStatus;
  onboarding: OnboardingHistory;
  credentialDocuments: CredentialDocument[];
  credentialSummary: CredentialSummary;
  reviewTasks: ReviewTask[];
  createdAt: string;
  updatedAt: string;
};

type Pagination = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

type ProviderListResponse = {
  items: ProviderListItem[];
  pagination: Pagination;
};

type ProviderDetailResponse = {
  item: ProviderDetail;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

const ONBOARDING_BADGE_STYLES: Record<OnboardingStatus, { bg: string; color: string; label: string }> = {
  DRAFT: { bg: '#e0e5ec', color: '#42536c', label: 'Borrador' },
  READY_FOR_REVIEW: { bg: '#dbeafe', color: '#1e40af', label: 'Listo para revisión' },
  APPROVED: { bg: '#dcfce7', color: '#166534', label: 'Aprobado' },
  REJECTED: { bg: '#fee2e2', color: '#991b1b', label: 'Rechazado' },
  REQUEST_CHANGES: { bg: '#fef9c3', color: '#854d0e', label: 'Cambios solicitados' },
};

const ALLOWED_TRANSITIONS: Record<OnboardingStatus, OnboardingStatus[]> = {
  DRAFT: ['READY_FOR_REVIEW'],
  READY_FOR_REVIEW: ['APPROVED', 'REJECTED', 'REQUEST_CHANGES'],
  REQUEST_CHANGES: ['READY_FOR_REVIEW'],
  APPROVED: [],
  REJECTED: [],
};

const CREDENTIAL_BADGE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  VALID: { bg: '#dcfce7', color: '#166534', label: 'Válida' },
  EXPIRING_SOON: { bg: '#fef9c3', color: '#854d0e', label: 'Por vencer' },
  EXPIRED: { bg: '#fee2e2', color: '#991b1b', label: 'Vencida' },
  NO_EXPIRY: { bg: '#e0e5ec', color: '#42536c', label: 'Sin vencimiento' },
};

const PRIORITY_STYLES: Record<string, { color: string }> = {
  URGENT: { color: '#991b1b' },
  HIGH: { color: '#c4481c' },
  NORMAL: { color: '#42536c' },
  LOW: { color: '#667892' },
};

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

async function fetchWithAuth<T>(path: string, init?: RequestInit): Promise<T> {
  const session = getBrowserSession();
  const token = session.accessToken;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `API request failed: ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function OnboardingBadge({ status }: { status: OnboardingStatus }) {
  const style = ONBOARDING_BADGE_STYLES[status] ?? ONBOARDING_BADGE_STYLES.DRAFT;
  return (
    <span
      className="iam-badge"
      style={{ background: style.bg, color: style.color }}
    >
      {style.label}
    </span>
  );
}

function CredentialBadge({ state }: { state: string }) {
  const style = CREDENTIAL_BADGE_STYLES[state] ?? CREDENTIAL_BADGE_STYLES.NO_EXPIRY;
  return (
    <span
      className="iam-badge"
      style={{ background: style.bg, color: style.color }}
    >
      {style.label}
    </span>
  );
}

function CredentialSummaryDisplay({ summary }: { summary: CredentialSummary }) {
  const parts: string[] = [];
  if (summary.verified > 0) parts.push(`${summary.verified} verificada${summary.verified > 1 ? 's' : ''}`);
  if (summary.expiringSoon > 0) parts.push(`${summary.expiringSoon} por vencer`);
  if (summary.expired > 0) parts.push(`${summary.expired} vencida${summary.expired > 1 ? 's' : ''}`);
  if (summary.rejected > 0) parts.push(`${summary.rejected} rechazada${summary.rejected > 1 ? 's' : ''}`);
  if (parts.length === 0) {
    return <span className="muted">{summary.total === 0 ? 'Sin credenciales' : `${summary.total} pendiente${summary.total > 1 ? 's' : ''}`}</span>;
  }
  return <span>{parts.join(', ')}</span>;
}

// ---------------------------------------------------------------------------
// Provider Detail Drawer
// ---------------------------------------------------------------------------

function ProviderDetailDrawer({
  provider,
  onClose,
  onTransition,
  isTransitioning,
}: {
  provider: ProviderDetail;
  onClose: () => void;
  onTransition: (status: OnboardingStatus, note: string) => void;
  isTransitioning: boolean;
}) {
  const [transitionNote, setTransitionNote] = useState('');
  const allowedNextStatuses = ALLOWED_TRANSITIONS[provider.onboardingStatus] ?? [];

  return (
    <div className="iam-drawer-overlay" onClick={onClose} role="presentation">
      <aside
        className="iam-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle de ${provider.name}`}
      >
        <div className="iam-drawer-header">
          <div>
            <h3 style={{ margin: 0 }}>{provider.name}</h3>
            <p className="muted" style={{ margin: '4px 0 0' }}>{provider.email} · {provider.roleLabel}</p>
          </div>
          <button className="button secondary" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className="iam-drawer-body">
          {/* Summary info */}
          <div className="iam-drawer-section">
            <div className="detail-list">
              <div><span className="detail-label">Especialidad:</span> {provider.specialty ?? '—'}</div>
              <div><span className="detail-label">Licencia:</span> {provider.licenseNumber ?? '—'}</div>
              <div><span className="detail-label">Organización:</span> {provider.organizationName ?? '—'}</div>
              <div><span className="detail-label">Estado de cuenta:</span> {provider.status}</div>
              <div>
                <span className="detail-label">Onboarding:</span>{' '}
                <OnboardingBadge status={provider.onboardingStatus} />
              </div>
            </div>
          </div>

          {/* Credential Documents */}
          <div className="iam-drawer-section">
            <h4>Credenciales ({provider.credentialDocuments.length})</h4>
            {provider.credentialDocuments.length === 0 ? (
              <p className="muted">Sin documentos de credenciales.</p>
            ) : (
              <div className="iam-credential-list">
                {provider.credentialDocuments.map((doc) => (
                  <div key={doc.id} className="iam-credential-item">
                    <div className="iam-credential-main">
                      <strong>{doc.title || doc.type}</strong>
                      <CredentialBadge state={doc.expiryState} />
                    </div>
                    <div className="muted" style={{ fontSize: '0.82rem' }}>
                      {doc.referenceNumber && <span>Ref: {doc.referenceNumber} · </span>}
                      {doc.expiresAt && <span>Vence: {new Date(doc.expiresAt).toLocaleDateString('es')} · </span>}
                      {doc.verifiedByName && <span>Verificado por: {doc.verifiedByName}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Review Tasks */}
          <div className="iam-drawer-section">
            <h4>Tareas de revisión ({provider.reviewTasks.length})</h4>
            {provider.reviewTasks.length === 0 ? (
              <p className="muted">Sin tareas de revisión activas.</p>
            ) : (
              <div className="iam-task-list">
                {provider.reviewTasks.map((task) => (
                  <div key={task.id} className="iam-task-item">
                    <div className="iam-task-main">
                      <span>{task.title}</span>
                      <span
                        className="iam-badge"
                        style={{ background: '#e0e5ec', color: PRIORITY_STYLES[task.priority]?.color ?? '#42536c' }}
                      >
                        {task.priority}
                      </span>
                    </div>
                    <div className="muted" style={{ fontSize: '0.82rem' }}>
                      Estado: {task.status}
                      {task.assignedToName && <> · Asignado a: {task.assignedToName}</>}
                      {task.dueAt && <> · Vence: {new Date(task.dueAt).toLocaleDateString('es')}</>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Onboarding History */}
          <div className="iam-drawer-section">
            <h4>Historial de Onboarding</h4>
            <div className="detail-list">
              <div>
                <span className="detail-label">Estado actual:</span>{' '}
                <OnboardingBadge status={provider.onboarding.status} />
              </div>
              {provider.onboarding.submittedAt && (
                <div><span className="detail-label">Enviado:</span> {new Date(provider.onboarding.submittedAt).toLocaleString('es')}</div>
              )}
              {provider.onboarding.reviewedAt && (
                <div><span className="detail-label">Revisado:</span> {new Date(provider.onboarding.reviewedAt).toLocaleString('es')}</div>
              )}
              {provider.onboarding.decisionNote && (
                <div><span className="detail-label">Nota:</span> {provider.onboarding.decisionNote}</div>
              )}
              {provider.onboarding.lastAction && (
                <div><span className="detail-label">Última acción:</span> {provider.onboarding.lastAction}</div>
              )}
            </div>
          </div>

          {/* Onboarding Transition Controls */}
          {allowedNextStatuses.length > 0 && (
            <div className="iam-drawer-section">
              <h4>Transiciones de Onboarding</h4>
              <div style={{ marginBottom: 10 }}>
                <textarea
                  className="iam-input"
                  placeholder="Nota de decisión (opcional)"
                  value={transitionNote}
                  onChange={(e) => setTransitionNote(e.target.value)}
                  rows={2}
                  aria-label="Nota de decisión"
                />
              </div>
              <div className="iam-transition-buttons">
                {allowedNextStatuses.map((nextStatus) => {
                  const badge = ONBOARDING_BADGE_STYLES[nextStatus];
                  return (
                    <button
                      key={nextStatus}
                      className="button secondary"
                      style={{ borderColor: badge.color, color: badge.color }}
                      disabled={isTransitioning}
                      onClick={() => onTransition(nextStatus, transitionNote)}
                    >
                      → {badge.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Provider Dialog
// ---------------------------------------------------------------------------

function CreateProviderDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('PROVIDER');
  const [specialty, setSpecialty] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const session = getBrowserSession();
  const isSuperAdmin = session.role === 'SUPER_ADMIN';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await fetchWithAuth('/api/admin/users/providers/iam', {
        method: 'POST',
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          role,
          specialty: specialty.trim() || undefined,
          licenseNumber: licenseNumber.trim() || undefined,
          organizationId: isSuperAdmin ? organizationId.trim() || undefined : undefined,
        }),
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear proveedor');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="iam-drawer-overlay" onClick={onClose} role="presentation">
      <div
        className="iam-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Crear proveedor"
      >
        <div className="iam-drawer-header">
          <h3 style={{ margin: 0 }}>Crear Proveedor</h3>
          <button className="button secondary" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="iam-dialog-form">
          {error && <div className="iam-error">{error}</div>}
          <div className="iam-form-row">
            <label htmlFor="cp-firstName">Nombre *</label>
            <input
              id="cp-firstName"
              className="iam-input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>
          <div className="iam-form-row">
            <label htmlFor="cp-lastName">Apellido *</label>
            <input
              id="cp-lastName"
              className="iam-input"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
          <div className="iam-form-row">
            <label htmlFor="cp-email">Email *</label>
            <input
              id="cp-email"
              className="iam-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="iam-form-row">
            <label htmlFor="cp-role">Rol</label>
            <select
              id="cp-role"
              className="iam-input"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="PROVIDER">Proveedor</option>
              <option value="NURSE">Enfermera</option>
              <option value="PHARMACIST">Farmacéutico</option>
              <option value="LAB_TECH">Técnico de laboratorio</option>
            </select>
          </div>
          <div className="iam-form-row">
            <label htmlFor="cp-specialty">Especialidad</label>
            <input
              id="cp-specialty"
              className="iam-input"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
            />
          </div>
          <div className="iam-form-row">
            <label htmlFor="cp-license">Número de licencia</label>
            <input
              id="cp-license"
              className="iam-input"
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
            />
          </div>
          {isSuperAdmin && (
            <div className="iam-form-row">
              <label htmlFor="cp-org">ID de Organización *</label>
              <input
                id="cp-org"
                className="iam-input"
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                required
              />
            </div>
          )}
          <div className="iam-dialog-actions">
            <button type="button" className="button secondary" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <button type="submit" className="button primary" disabled={isSubmitting}>
              {isSubmitting ? 'Creando...' : 'Crear Proveedor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function ProvidersIamPage() {
  const [providers, setProviders] = useState<ProviderListItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Detail drawer state
  const [selectedProvider, setSelectedProvider] = useState<ProviderDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Create dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Fetch provider list
  const loadProviders = useCallback(async (page: number, q?: string) => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (q) params.set('q', q);
      const data = await fetchWithAuth<ProviderListResponse>(`/api/admin/users/providers/iam?${params.toString()}`);
      setProviders(data.items);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar proveedores');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProviders(currentPage, searchQuery);
  }, [currentPage, loadProviders]);

  // Search with debounce on enter
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadProviders(1, searchQuery);
  };

  // Open detail
  const openDetail = async (providerId: string) => {
    setIsLoadingDetail(true);
    try {
      const data = await fetchWithAuth<ProviderDetailResponse>(`/api/admin/users/providers/iam/${providerId}`);
      setSelectedProvider(data.item);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar detalle del proveedor');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Onboarding transition
  const handleTransition = async (newStatus: OnboardingStatus, note: string) => {
    if (!selectedProvider) return;
    setIsTransitioning(true);
    try {
      await fetchWithAuth(`/api/admin/users/providers/iam/${selectedProvider.id}/onboarding`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus, decisionNote: note || undefined }),
      });
      // Reload detail and list
      const data = await fetchWithAuth<ProviderDetailResponse>(`/api/admin/users/providers/iam/${selectedProvider.id}`);
      setSelectedProvider(data.item);
      loadProviders(currentPage, searchQuery);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar estado de onboarding');
    } finally {
      setIsTransitioning(false);
    }
  };

  return (
    <div className="iam-providers-page">
      {/* Header */}
      <div className="iam-page-header">
        <div>
          <h3 style={{ margin: 0 }}>Proveedores</h3>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Gestiona perfiles, credenciales y onboarding de proveedores.
          </p>
        </div>
        <button className="button primary" onClick={() => setShowCreateDialog(true)}>
          + Crear Proveedor
        </button>
      </div>

      {/* Search bar */}
      <form className="iam-search-bar" onSubmit={handleSearch}>
        <input
          className="iam-input iam-search-input"
          placeholder="Buscar por nombre, email, especialidad o licencia..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Buscar proveedores"
        />
        <button type="submit" className="button secondary">Buscar</button>
      </form>

      {/* Error state */}
      {error && <div className="iam-error">{error}</div>}

      {/* Loading state */}
      {isLoading && <div className="iam-loading">Cargando proveedores...</div>}

      {/* Provider table */}
      {!isLoading && providers.length === 0 && !error && (
        <div className="iam-empty-state">
          <p>No se encontraron proveedores con los filtros actuales.</p>
        </div>
      )}

      {!isLoading && providers.length > 0 && (
        <>
          <div className="iam-table-container">
            <table className="iam-table" aria-label="Lista de proveedores">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Especialidad</th>
                  <th>Licencia</th>
                  <th>Onboarding</th>
                  <th>Credenciales</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((provider) => (
                  <tr
                    key={provider.id}
                    className="iam-table-row-clickable"
                    onClick={() => openDetail(provider.id)}
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') openDetail(provider.id); }}
                    role="button"
                    aria-label={`Ver detalle de ${provider.name}`}
                  >
                    <td>
                      <div className="iam-provider-name">
                        <strong>{provider.name}</strong>
                        <span className="muted" style={{ fontSize: '0.82rem' }}>{provider.email}</span>
                      </div>
                    </td>
                    <td>{provider.specialty ?? '—'}</td>
                    <td>{provider.licenseNumber ?? '—'}</td>
                    <td><OnboardingBadge status={provider.onboardingStatus} /></td>
                    <td><CredentialSummaryDisplay summary={provider.credentialSummary} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="iam-pagination">
              <button
                className="button secondary"
                disabled={!pagination.hasPreviousPage}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                ← Anterior
              </button>
              <span className="muted">
                Página {pagination.page} de {pagination.totalPages} ({pagination.totalCount} total)
              </span>
              <button
                className="button secondary"
                disabled={!pagination.hasNextPage}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}

      {/* Loading detail indicator */}
      {isLoadingDetail && (
        <div className="iam-loading-overlay">
          <div className="iam-loading">Cargando detalle...</div>
        </div>
      )}

      {/* Detail drawer */}
      {selectedProvider && (
        <ProviderDetailDrawer
          provider={selectedProvider}
          onClose={() => setSelectedProvider(null)}
          onTransition={handleTransition}
          isTransitioning={isTransitioning}
        />
      )}

      {/* Create provider dialog */}
      {showCreateDialog && (
        <CreateProviderDialog
          onClose={() => setShowCreateDialog(false)}
          onCreated={() => loadProviders(currentPage, searchQuery)}
        />
      )}
    </div>
  );
}
