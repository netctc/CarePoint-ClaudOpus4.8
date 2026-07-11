'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi } from '@/lib/api-client';
import { getBrowserSession } from '@/lib/auth/browser-session';
import { StatusBadge } from '@/components/ui/status-badge';

type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';

type InvitationItem = {
  id: string;
  email: string;
  role: string;
  status: InvitationStatus;
  organizationId?: string | null;
  organizationName?: string | null;
  createdAt: string;
  expiresAt: string;
};

type InvitationsResponse = {
  items: InvitationItem[];
  total: number;
  page: number;
  pageSize: number;
};

const PAGE_SIZE = 20;

const ROLES_ALL = [
  'SUPER_ADMIN',
  'COMPANY_ADMIN',
  'COMPANY_SUPPORT',
  'PROVIDER',
  'NURSE',
  'PHARMACIST',
  'LAB_TECH',
  'FINANCE',
];

const ROLES_COMPANY_ADMIN = ROLES_ALL.filter((r) => r !== 'SUPER_ADMIN');

function statusTone(status: InvitationStatus): 'info' | 'success' | 'neutral' | 'danger' {
  switch (status) {
    case 'PENDING':
      return 'info';
    case 'ACCEPTED':
      return 'success';
    case 'EXPIRED':
      return 'neutral';
    case 'REVOKED':
      return 'danger';
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

export default function IamInvitationsPage() {
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createRole, setCreateRole] = useState('');
  const [createExpiration, setCreateExpiration] = useState('72');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Revoke dialog state
  const [revokeTarget, setRevokeTarget] = useState<InvitationItem | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const session = useMemo(() => getBrowserSession(), []);
  const isSuperAdmin = session.role === 'SUPER_ADMIN';
  const availableRoles = isSuperAdmin ? ROLES_ALL : ROLES_COMPANY_ADMIN;

  const fetchInvitations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      const data = await adminApi.iamInvitations(params.toString()) as InvitationsResponse;
      setInvitations(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar invitaciones.');
      setInvitations([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void fetchInvitations();
  }, [fetchInvitations]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // --- Create invitation handler ---
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await adminApi.iamCreateInvitation({
        email: createEmail.trim(),
        role: createRole,
        expiresInHours: Number(createExpiration) || 72,
      });
      setShowCreateDialog(false);
      setCreateEmail('');
      setCreateRole('');
      setCreateExpiration('72');
      void fetchInvitations();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Error al crear la invitación.');
    } finally {
      setCreating(false);
    }
  };

  // --- Revoke handler ---
  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    setRevokeError(null);
    try {
      await adminApi.iamRevokeInvitation(revokeTarget.id);
      setRevokeTarget(null);
      void fetchInvitations();
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : 'Error al revocar la invitación.');
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="stack-lg">
      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-group">
          <span className="muted" style={{ alignSelf: 'center' }}>
            {total} invitación{total !== 1 ? 'es' : ''}
          </span>
        </div>
        <div className="toolbar-group">
          <button
            className="button primary"
            onClick={() => setShowCreateDialog(true)}
          >
            + Crear Invitación
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
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Enviado</th>
                <th>Expira</th>
                {isSuperAdmin && <th>Organización</th>}
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={isSuperAdmin ? 7 : 6} style={{ textAlign: 'center', padding: '40px 12px' }}>
                    <span className="muted">Cargando invitaciones…</span>
                  </td>
                </tr>
              )}
              {!loading && invitations.length === 0 && (
                <tr>
                  <td colSpan={isSuperAdmin ? 7 : 6} style={{ textAlign: 'center', padding: '40px 12px' }}>
                    <span className="muted">No hay invitaciones registradas.</span>
                  </td>
                </tr>
              )}
              {!loading && invitations.map((inv) => (
                <tr key={inv.id}>
                  <td style={{ fontWeight: 700 }}>{inv.email}</td>
                  <td>{formatRole(inv.role)}</td>
                  <td>
                    <StatusBadge tone={statusTone(inv.status)}>
                      {inv.status}
                    </StatusBadge>
                  </td>
                  <td className="muted">{formatDate(inv.createdAt)}</td>
                  <td className="muted">{formatDate(inv.expiresAt)}</td>
                  {isSuperAdmin && (
                    <td>{inv.organizationName ?? '—'}</td>
                  )}
                  <td>
                    {inv.status === 'PENDING' && (
                      <button
                        className="button danger"
                        style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                        onClick={() => setRevokeTarget(inv)}
                      >
                        Revocar
                      </button>
                    )}
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

      {/* Create Invitation Dialog */}
      {showCreateDialog && (
        <div
          className="iam-dialog-overlay"
          onClick={() => setShowCreateDialog(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Crear invitación"
        >
          <div
            className="iam-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Crear Invitación</h3>
            <form onSubmit={handleCreate}>
              <div className="iam-dialog-field">
                <label htmlFor="inv-email">Email</label>
                <input
                  id="inv-email"
                  className="input"
                  type="email"
                  required
                  placeholder="usuario@empresa.com"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                />
              </div>
              <div className="iam-dialog-field">
                <label htmlFor="inv-role">Rol</label>
                <select
                  id="inv-role"
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
              <div className="iam-dialog-field">
                <label htmlFor="inv-expiration">Expiración (horas)</label>
                <input
                  id="inv-expiration"
                  className="input"
                  type="number"
                  min="1"
                  max="720"
                  value={createExpiration}
                  onChange={(e) => setCreateExpiration(e.target.value)}
                />
                <span className="muted" style={{ fontSize: '0.8rem' }}>
                  Mínimo 1 hora, máximo 720 horas (30 días). Predeterminado: 72 horas.
                </span>
              </div>
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
                  disabled={creating || !createEmail.trim() || !createRole}
                >
                  {creating ? 'Creando…' : 'Enviar Invitación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revoke Confirmation Dialog */}
      {revokeTarget && (
        <div
          className="iam-dialog-overlay"
          onClick={() => setRevokeTarget(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar revocación"
        >
          <div
            className="iam-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Revocar Invitación</h3>
            <p>
              ¿Estás seguro de que deseas revocar la invitación enviada a{' '}
              <strong>{revokeTarget.email}</strong> con rol{' '}
              <strong>{formatRole(revokeTarget.role)}</strong>?
            </p>
            <p className="muted" style={{ fontSize: '0.85rem' }}>
              Esta acción no se puede deshacer. El destinatario ya no podrá aceptar la invitación.
            </p>
            {revokeError && (
              <div className="banner warning" style={{ marginTop: 8 }}>{revokeError}</div>
            )}
            <div className="iam-dialog-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setRevokeTarget(null)}
                disabled={revoking}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="button danger"
                onClick={handleRevoke}
                disabled={revoking}
              >
                {revoking ? 'Revocando…' : 'Confirmar Revocación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
