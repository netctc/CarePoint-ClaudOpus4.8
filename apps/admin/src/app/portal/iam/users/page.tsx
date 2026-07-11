'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi } from '@/lib/api-client';
import { getBrowserSession } from '@/lib/auth/browser-session';
import { StatusBadge } from '@/components/ui/status-badge';

type UserItem = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  organizationId?: string | null;
  organizationName?: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  createdAt: string;
};

type IamUsersResponse = {
  items: UserItem[];
  total: number;
  page: number;
  pageSize: number;
};

type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

const PAGE_SIZE = 20;

const USER_ROLES = [
  'SUPER_ADMIN',
  'COMPANY_ADMIN',
  'COMPANY_SUPPORT',
  'PROVIDER',
  'NURSE',
  'PHARMACIST',
  'LAB_TECH',
  'FINANCE',
  'PATIENT',
];

const ROLES_COMPANY_ADMIN = USER_ROLES.filter((r) => r !== 'SUPER_ADMIN');

const USER_STATUSES: UserStatus[] = ['ACTIVE', 'SUSPENDED', 'ARCHIVED'];

function statusTone(status: string): 'success' | 'warning' | 'neutral' {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'SUSPENDED':
      return 'warning';
    case 'ARCHIVED':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function formatDate(iso: string): string {
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

function formatRole(role: string): string {
  return role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function IamUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create user dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createFirstName, setCreateFirstName] = useState('');
  const [createLastName, setCreateLastName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createRole, setCreateRole] = useState('');
  const [createOrganizationId, setCreateOrganizationId] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Status management dialog state
  const [statusTarget, setStatusTarget] = useState<UserItem | null>(null);
  const [newStatus, setNewStatus] = useState<UserStatus | ''>('');
  const [statusReason, setStatusReason] = useState('');
  const [changingStatus, setChangingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const session = useMemo(() => getBrowserSession(), []);
  const isSuperAdmin = session.role === 'SUPER_ADMIN';
  const availableRoles = isSuperAdmin ? USER_ROLES : ROLES_COMPANY_ADMIN;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (debouncedSearch.trim()) {
        params.set('search', debouncedSearch.trim());
      }
      const data = await adminApi.iamUsers(params.toString()) as IamUsersResponse;
      setUsers(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar usuarios.');
      setUsers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // --- Create user handler ---
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const payload: Record<string, string> = {
        firstName: createFirstName.trim(),
        lastName: createLastName.trim(),
        email: createEmail.trim(),
        role: createRole,
      };
      if (isSuperAdmin && createOrganizationId.trim()) {
        payload.organizationId = createOrganizationId.trim();
      }
      await adminApi.iamCreateUser(payload);
      setShowCreateDialog(false);
      setCreateFirstName('');
      setCreateLastName('');
      setCreateEmail('');
      setCreateRole('');
      setCreateOrganizationId('');
      void fetchUsers();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Error al crear el usuario.');
    } finally {
      setCreating(false);
    }
  };

  // --- Status change handler ---
  const handleStatusChange = async () => {
    if (!statusTarget || !newStatus) return;
    setChangingStatus(true);
    setStatusError(null);
    try {
      const payload: Record<string, string> = { status: newStatus };
      if (newStatus === 'SUSPENDED' && statusReason.trim()) {
        payload.reason = statusReason.trim();
      }
      await adminApi.iamUpdateUserStatus(statusTarget.id, payload);
      setStatusTarget(null);
      setNewStatus('');
      setStatusReason('');
      void fetchUsers();
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Error al cambiar el estado.');
    } finally {
      setChangingStatus(false);
    }
  };

  // Open status management dialog
  const openStatusDialog = (user: UserItem, targetStatus: UserStatus) => {
    setStatusTarget(user);
    setNewStatus(targetStatus);
    setStatusReason('');
    setStatusError(null);
  };

  return (
    <div className="stack-lg">
      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-group">
          <input
            className="input"
            type="text"
            placeholder="Buscar por nombre, email o rol…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar usuarios"
            style={{ maxWidth: 360 }}
          />
        </div>
        <div className="toolbar-group" style={{ gap: 12, display: 'flex', alignItems: 'center' }}>
          <span className="muted" style={{ alignSelf: 'center' }}>
            {total} usuario{total !== 1 ? 's' : ''}
          </span>
          <button
            className="button primary"
            onClick={() => setShowCreateDialog(true)}
          >
            + Crear Usuario
          </button>
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
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                {isSuperAdmin && <th>Organización</th>}
                <th>Estado</th>
                <th>Creado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={isSuperAdmin ? 7 : 6} style={{ textAlign: 'center', padding: '40px 12px' }}>
                    <span className="muted">Cargando usuarios…</span>
                  </td>
                </tr>
              )}
              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan={isSuperAdmin ? 7 : 6} style={{ textAlign: 'center', padding: '40px 12px' }}>
                    <span className="muted">
                      {debouncedSearch
                        ? 'No se encontraron usuarios que coincidan con la búsqueda.'
                        : 'No hay usuarios registrados.'}
                    </span>
                  </td>
                </tr>
              )}
              {!loading && users.map((user) => (
                <tr key={user.id}>
                  <td style={{ fontWeight: 700 }}>
                    {user.firstName} {user.lastName}
                  </td>
                  <td>{user.email}</td>
                  <td>{formatRole(user.role)}</td>
                  {isSuperAdmin && (
                    <td>{user.organizationName ?? '—'}</td>
                  )}
                  <td>
                    <StatusBadge tone={statusTone(user.status)}>
                      {user.status}
                    </StatusBadge>
                  </td>
                  <td className="muted">{formatDate(user.createdAt)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {USER_STATUSES.filter((s) => s !== user.status).map((targetStatus) => (
                        <button
                          key={targetStatus}
                          className={`button ${targetStatus === 'SUSPENDED' ? 'danger' : 'secondary'}`}
                          style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                          onClick={() => openStatusDialog(user, targetStatus)}
                          title={`Cambiar a ${targetStatus}`}
                        >
                          {targetStatus === 'ACTIVE' && 'Activar'}
                          {targetStatus === 'SUSPENDED' && 'Suspender'}
                          {targetStatus === 'ARCHIVED' && 'Archivar'}
                        </button>
                      ))}
                    </div>
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

      {/* Create User Dialog */}
      {showCreateDialog && (
        <div
          className="iam-dialog-overlay"
          onClick={() => setShowCreateDialog(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Crear usuario"
        >
          <div
            className="iam-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Crear Usuario</h3>
            <form onSubmit={handleCreate}>
              <div className="iam-dialog-field">
                <label htmlFor="user-firstName">Nombre</label>
                <input
                  id="user-firstName"
                  className="input"
                  type="text"
                  required
                  placeholder="Nombre"
                  value={createFirstName}
                  onChange={(e) => setCreateFirstName(e.target.value)}
                />
              </div>
              <div className="iam-dialog-field">
                <label htmlFor="user-lastName">Apellido</label>
                <input
                  id="user-lastName"
                  className="input"
                  type="text"
                  required
                  placeholder="Apellido"
                  value={createLastName}
                  onChange={(e) => setCreateLastName(e.target.value)}
                />
              </div>
              <div className="iam-dialog-field">
                <label htmlFor="user-email">Email</label>
                <input
                  id="user-email"
                  className="input"
                  type="email"
                  required
                  placeholder="usuario@empresa.com"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                />
              </div>
              <div className="iam-dialog-field">
                <label htmlFor="user-role">Rol</label>
                <select
                  id="user-role"
                  className="select"
                  required
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value)}
                >
                  <option value="">Seleccionar rol…</option>
                  {availableRoles.map((role) => (
                    <option key={role} value={role}>{formatRole(role)}</option>
                  ))}
                </select>
              </div>
              {isSuperAdmin && (
                <div className="iam-dialog-field">
                  <label htmlFor="user-organizationId">Organización (ID)</label>
                  <input
                    id="user-organizationId"
                    className="input"
                    type="text"
                    placeholder="ID de la organización"
                    value={createOrganizationId}
                    onChange={(e) => setCreateOrganizationId(e.target.value)}
                  />
                  <span className="muted" style={{ fontSize: '0.8rem' }}>
                    Solo visible para Super Admin. Dejar vacío para asignar a la organización por defecto.
                  </span>
                </div>
              )}
              {createError && (
                <div className="banner warning" style={{ marginTop: 8 }}>{createError}</div>
              )}
              <div className="iam-dialog-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setShowCreateDialog(false)}
                  disabled={creating}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="button primary"
                  disabled={creating || !createFirstName.trim() || !createLastName.trim() || !createEmail.trim() || !createRole}
                >
                  {creating ? 'Creando…' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Change Dialog */}
      {statusTarget && newStatus && (
        <div
          className="iam-dialog-overlay"
          onClick={() => setStatusTarget(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Cambiar estado de usuario"
        >
          <div
            className="iam-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Cambiar Estado de Usuario</h3>
            <p>
              ¿Cambiar el estado de <strong>{statusTarget.firstName} {statusTarget.lastName}</strong>{' '}
              de <StatusBadge tone={statusTone(statusTarget.status)}>{statusTarget.status}</StatusBadge>{' '}
              a <StatusBadge tone={statusTone(newStatus)}>{newStatus}</StatusBadge>?
            </p>
            {newStatus === 'SUSPENDED' && (
              <div className="iam-dialog-field">
                <label htmlFor="status-reason">Razón de la suspensión</label>
                <textarea
                  id="status-reason"
                  className="input"
                  placeholder="Ingrese la razón de la suspensión…"
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
                <span className="muted" style={{ fontSize: '0.8rem' }}>
                  Se recomienda incluir una razón para la suspensión.
                </span>
              </div>
            )}
            {newStatus === 'SUSPENDED' && (
              <p className="muted" style={{ fontSize: '0.85rem' }}>
                Esta acción revocará todas las sesiones activas del usuario. El usuario no podrá acceder al sistema hasta que sea reactivado.
              </p>
            )}
            {newStatus === 'ARCHIVED' && (
              <p className="muted" style={{ fontSize: '0.85rem' }}>
                El usuario será archivado y no podrá acceder al sistema.
              </p>
            )}
            {statusError && (
              <div className="banner warning" style={{ marginTop: 8 }}>{statusError}</div>
            )}
            <div className="iam-dialog-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setStatusTarget(null)}
                disabled={changingStatus}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`button ${newStatus === 'SUSPENDED' ? 'danger' : 'primary'}`}
                onClick={handleStatusChange}
                disabled={changingStatus}
              >
                {changingStatus ? 'Cambiando…' : 'Confirmar Cambio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
