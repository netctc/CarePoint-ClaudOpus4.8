'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '@/lib/api-client';
import { StatusBadge } from '@/components/ui/status-badge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AccessReviewUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  lastCertifiedAt: string | null;
};

type AccessReviewResponse = {
  items: AccessReviewUser[];
  total: number;
};

// ---------------------------------------------------------------------------
// System roles and descriptions (per requirement 2.1)
// ---------------------------------------------------------------------------

const SYSTEM_ROLES = [
  { id: 'SUPER_ADMIN', name: 'Super Admin', description: 'Acceso total a la plataforma. Gestión multi-organización.' },
  { id: 'COMPANY_ADMIN', name: 'Company Admin', description: 'Administrador de una organización. Gestiona usuarios y operaciones dentro de su organización.' },
  { id: 'COMPANY_SUPPORT', name: 'Company Support', description: 'Soporte al cliente dentro de la organización. Acceso a tickets y comunicaciones.' },
  { id: 'PROVIDER', name: 'Provider', description: 'Proveedor de salud. Acceso a agenda, pacientes y perfil profesional.' },
  { id: 'NURSE', name: 'Nurse', description: 'Enfermero/a. Acceso a agenda, pacientes y asistencia clínica.' },
  { id: 'PHARMACIST', name: 'Pharmacist', description: 'Farmacéutico/a. Acceso a recetas, inventario y dispensación.' },
  { id: 'LAB_TECH', name: 'Lab Tech', description: 'Técnico de laboratorio. Acceso a órdenes de laboratorio y resultados.' },
  { id: 'FINANCE', name: 'Finance', description: 'Finanzas. Acceso a facturación, pagos y reportes financieros.' },
  { id: 'PATIENT', name: 'Patient', description: 'Paciente. Acceso a su propia información, citas y resultados.' },
] as const;

// ---------------------------------------------------------------------------
// Platform permissions matrix (per requirement 2.2)
// ---------------------------------------------------------------------------

const PLATFORM_PERMISSIONS = [
  'users:manage',
  'users:view',
  'roles:manage',
  'providers:manage',
  'providers:view',
  'schedules:manage',
  'schedules:view',
  'appointments:manage',
  'appointments:view',
  'invitations:manage',
  'audit:view',
  'billing:manage',
  'billing:view',
  'patients:manage',
  'patients:view',
  'lab:manage',
  'lab:view',
  'pharmacy:manage',
  'pharmacy:view',
] as const;

/**
 * Permission matrix: which roles have which permissions.
 * This is a static representation matching the backend RBAC configuration.
 */
const PERMISSION_MATRIX: Record<string, string[]> = {
  SUPER_ADMIN: [
    'users:manage', 'users:view', 'roles:manage', 'providers:manage', 'providers:view',
    'schedules:manage', 'schedules:view', 'appointments:manage', 'appointments:view',
    'invitations:manage', 'audit:view', 'billing:manage', 'billing:view',
    'patients:manage', 'patients:view', 'lab:manage', 'lab:view', 'pharmacy:manage', 'pharmacy:view',
  ],
  COMPANY_ADMIN: [
    'users:manage', 'users:view', 'roles:manage', 'providers:manage', 'providers:view',
    'schedules:manage', 'schedules:view', 'appointments:manage', 'appointments:view',
    'invitations:manage', 'audit:view', 'billing:manage', 'billing:view',
    'patients:manage', 'patients:view', 'lab:view', 'pharmacy:view',
  ],
  COMPANY_SUPPORT: [
    'users:view', 'providers:view', 'schedules:view', 'appointments:view',
    'patients:view', 'billing:view',
  ],
  PROVIDER: [
    'providers:view', 'schedules:manage', 'schedules:view',
    'appointments:manage', 'appointments:view', 'patients:manage', 'patients:view',
  ],
  NURSE: [
    'providers:view', 'schedules:view', 'appointments:view',
    'patients:manage', 'patients:view',
  ],
  PHARMACIST: [
    'pharmacy:manage', 'pharmacy:view', 'patients:view',
  ],
  LAB_TECH: [
    'lab:manage', 'lab:view', 'patients:view',
  ],
  FINANCE: [
    'billing:manage', 'billing:view', 'audit:view',
  ],
  PATIENT: [
    'appointments:view', 'patients:view',
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRole(role: string): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Nunca';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function IamRolesPage() {
  // Role assignment dialog state
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignRole, setAssignRole] = useState('');
  const [assignReason, setAssignReason] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Access review state
  const [reviewUsers, setReviewUsers] = useState<AccessReviewUser[]>([]);
  const [reviewLoading, setReviewLoading] = useState(true);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Active section tab
  const [activeSection, setActiveSection] = useState<'roles' | 'matrix' | 'review'>('roles');

  // Fetch access review data
  const fetchAccessReview = useCallback(async () => {
    setReviewLoading(true);
    setReviewError(null);
    try {
      const data = await adminApi.iamAccessReview() as AccessReviewResponse;
      setReviewUsers(data.items ?? []);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Error al cargar revisión de acceso.');
      setReviewUsers([]);
    } finally {
      setReviewLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAccessReview();
  }, [fetchAccessReview]);

  // Handle role assignment
  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (assignReason.length < 1 || assignReason.length > 500) {
      setAssignError('La razón debe tener entre 1 y 500 caracteres.');
      return;
    }
    setAssigning(true);
    setAssignError(null);
    try {
      await adminApi.assignRole(assignUserId, { role: assignRole, reason: assignReason });
      setShowAssignDialog(false);
      setAssignUserId('');
      setAssignRole('');
      setAssignReason('');
      void fetchAccessReview();
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Error al asignar rol.');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="stack-lg">
      {/* Section Tabs */}
      <div className="toolbar">
        <div className="toolbar-group">
          <div className="segmented-control">
            <span
              className={activeSection === 'roles' ? 'active' : ''}
              onClick={() => setActiveSection('roles')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setActiveSection('roles')}
            >
              Roles
            </span>
            <span
              className={activeSection === 'matrix' ? 'active' : ''}
              onClick={() => setActiveSection('matrix')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setActiveSection('matrix')}
            >
              Matriz
            </span>
            <span
              className={activeSection === 'review' ? 'active' : ''}
              onClick={() => setActiveSection('review')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setActiveSection('review')}
            >
              Revisión
            </span>
          </div>
        </div>
        <div className="toolbar-group">
          <button
            className="button primary"
            onClick={() => setShowAssignDialog(true)}
          >
            Asignar Rol
          </button>
        </div>
      </div>

      {/* Section: Roles List */}
      {activeSection === 'roles' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 22px 12px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Roles del Sistema</h3>
            <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.86rem' }}>
              Roles predefinidos de la plataforma con sus descripciones y permisos asignados.
            </p>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rol</th>
                  <th>Descripción</th>
                  <th>Permisos</th>
                </tr>
              </thead>
              <tbody>
                {SYSTEM_ROLES.map((role) => (
                  <tr key={role.id}>
                    <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {role.name}
                    </td>
                    <td className="muted" style={{ maxWidth: 400 }}>
                      {role.description}
                    </td>
                    <td>
                      <span className="muted" style={{ fontSize: '0.82rem' }}>
                        {(PERMISSION_MATRIX[role.id] ?? []).length} permisos
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section: Permission Matrix Grid */}
      {activeSection === 'matrix' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 22px 12px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Matriz de Permisos</h3>
            <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.86rem' }}>
              Vista de permisos asignados a cada rol. ✓ indica acceso concedido.
            </p>
          </div>
          <div className="table-wrap">
            <table style={{ fontSize: '0.8rem' }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', left: 0, background: 'white', zIndex: 1 }}>Permiso</th>
                  {SYSTEM_ROLES.map((role) => (
                    <th
                      key={role.id}
                      style={{ textAlign: 'center', minWidth: 80, fontSize: '0.68rem' }}
                    >
                      {role.name.replace(' ', '\n')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PLATFORM_PERMISSIONS.map((perm) => (
                  <tr key={perm}>
                    <td
                      style={{
                        position: 'sticky',
                        left: 0,
                        background: 'white',
                        zIndex: 1,
                        fontFamily: 'ui-monospace, monospace',
                        fontSize: '0.78rem',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {perm}
                    </td>
                    {SYSTEM_ROLES.map((role) => {
                      const hasAccess = (PERMISSION_MATRIX[role.id] ?? []).includes(perm);
                      return (
                        <td key={role.id} style={{ textAlign: 'center' }}>
                          {hasAccess ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 24,
                                height: 24,
                                borderRadius: '50%',
                                background: 'var(--success-soft)',
                                color: 'var(--success)',
                                fontSize: '0.82rem',
                                fontWeight: 800,
                              }}
                              aria-label={`${role.name} tiene permiso ${perm}`}
                            >
                              ✓
                            </span>
                          ) : (
                            <span className="muted" style={{ fontSize: '0.76rem' }}>—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section: Access Review */}
      {activeSection === 'review' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 22px 12px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Revisión de Acceso</h3>
            <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.86rem' }}>
              Usuarios con roles privilegiados (SUPER_ADMIN, COMPANY_ADMIN) cuya última certificación
              supera los 90 días y requieren re-certificación.
            </p>
          </div>

          {reviewError && (
            <div className="banner warning" style={{ margin: '0 22px 12px' }}>{reviewError}</div>
          )}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Última Certificación</th>
                  <th>Días sin Revisión</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {reviewLoading && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px 12px' }}>
                      <span className="muted">Cargando revisión de acceso…</span>
                    </td>
                  </tr>
                )}
                {!reviewLoading && reviewUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px 12px' }}>
                      <span className="muted">
                        No hay usuarios pendientes de re-certificación.
                      </span>
                    </td>
                  </tr>
                )}
                {!reviewLoading && reviewUsers.map((user) => {
                  const days = daysSince(user.lastCertifiedAt);
                  return (
                    <tr key={user.id}>
                      <td style={{ fontWeight: 700 }}>
                        {user.firstName} {user.lastName}
                      </td>
                      <td>{user.email}</td>
                      <td>{formatRole(user.role)}</td>
                      <td className="muted">{formatDate(user.lastCertifiedAt)}</td>
                      <td>
                        {days !== null ? (
                          <span style={{ fontWeight: 700, color: days > 90 ? 'var(--danger)' : 'var(--text)' }}>
                            {days} días
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <StatusBadge tone="warning">
                          Requiere Revisión
                        </StatusBadge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Role Assignment Dialog */}
      {showAssignDialog && (
        <div
          className="iam-dialog-overlay"
          onClick={() => setShowAssignDialog(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Asignar rol"
        >
          <div
            className="iam-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Asignar Rol</h3>
            <form onSubmit={handleAssignRole}>
              <div className="iam-dialog-field">
                <label htmlFor="assign-user-id">ID del Usuario</label>
                <input
                  id="assign-user-id"
                  className="input"
                  type="text"
                  required
                  placeholder="ID del usuario"
                  value={assignUserId}
                  onChange={(e) => setAssignUserId(e.target.value)}
                />
              </div>
              <div className="iam-dialog-field">
                <label htmlFor="assign-role">Nuevo Rol</label>
                <select
                  id="assign-role"
                  className="select"
                  required
                  value={assignRole}
                  onChange={(e) => setAssignRole(e.target.value)}
                >
                  <option value="">Seleccionar rol…</option>
                  {SYSTEM_ROLES.map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>
              <div className="iam-dialog-field">
                <label htmlFor="assign-reason">Razón del cambio</label>
                <textarea
                  id="assign-reason"
                  className="textarea"
                  required
                  placeholder="Describa la razón del cambio de rol (1-500 caracteres)"
                  value={assignReason}
                  onChange={(e) => setAssignReason(e.target.value)}
                  minLength={1}
                  maxLength={500}
                  style={{ minHeight: 80 }}
                />
                <span className="muted" style={{ fontSize: '0.8rem' }}>
                  {assignReason.length}/500 caracteres
                </span>
              </div>
              {assignError && (
                <div className="banner warning" style={{ marginTop: 8 }}>{assignError}</div>
              )}
              <div className="iam-dialog-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setShowAssignDialog(false)}
                  disabled={assigning}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="button primary"
                  disabled={assigning || !assignUserId.trim() || !assignRole || assignReason.length < 1}
                >
                  {assigning ? 'Asignando…' : 'Asignar Rol'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
