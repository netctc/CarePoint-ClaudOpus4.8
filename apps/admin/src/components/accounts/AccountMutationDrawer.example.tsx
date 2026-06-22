'use client';

import React, { useMemo, useState } from 'react';
import {
  accountMutationErrorMessage,
  createAccount,
  deactivateAccount,
  reactivateAccount,
  updateAccount,
} from '../../lib/account-mutations';
import { AccountStatusBadgeExample } from './AccountStatusBadge.example';

export interface AccountMutationDrawerItem {
  id?: string;
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  role?: string | null;
  status?: string | null;
  organizationId?: string | null;
}

export interface AccountMutationDrawerProps {
  open: boolean;
  item?: AccountMutationDrawerItem | null;
  roles: string[];
  statuses?: string[];
  token?: string;
  apiBaseUrl?: string;
  onClose: () => void;
  onSaved: () => void;
}

export function AccountMutationDrawerExample({
  open,
  item,
  roles,
  statuses = ['ACTIVE', 'DISABLED'],
  token,
  apiBaseUrl,
  onClose,
  onSaved,
}: AccountMutationDrawerProps) {
  const isEdit = Boolean(item?.id);
  const [email, setEmail] = useState(item?.email ?? '');
  const [firstName, setFirstName] = useState(item?.firstName ?? '');
  const [lastName, setLastName] = useState(item?.lastName ?? '');
  const [role, setRole] = useState(item?.role ?? roles[0] ?? 'SUPPORT');
  const [status, setStatus] = useState(item?.status ?? statuses[0] ?? 'ACTIVE');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => (isEdit ? 'Edit account' : 'Create account'), [isEdit]);

  if (!open) return null;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        email,
        firstName,
        lastName,
        role,
        status,
      };
      if (isEdit && item?.id) {
        await updateAccount(item.id, payload, { token, apiBaseUrl });
      } else {
        await createAccount({ ...payload, email, role }, { token, apiBaseUrl });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(accountMutationErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function changeActiveState(nextStatus: 'ACTIVE' | 'DISABLED') {
    if (!item?.id) return;
    const confirmed = window.confirm(nextStatus === 'ACTIVE' ? 'Reactivate this account?' : 'Deactivate this account?');
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try {
      if (nextStatus === 'ACTIVE') await reactivateAccount(item.id, 'Admin account drawer action', { token, apiBaseUrl });
      else await deactivateAccount(item.id, 'Admin account drawer action', { token, apiBaseUrl });
      onSaved();
      onClose();
    } catch (err) {
      setError(accountMutationErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30">
      <div className="h-full w-full max-w-xl overflow-auto bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">Manage account identity, role, and status with audited mutations.</p>
          </div>
          <button className="rounded-lg border border-slate-200 px-3 py-2 text-sm" onClick={onClose} disabled={busy}>
            Close
          </button>
        </div>

        {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

        {isEdit ? (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-sm text-slate-600">Current status</div>
            <AccountStatusBadgeExample status={item?.status} />
          </div>
        ) : null}

        <div className="grid gap-4">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Email
            <input className="rounded-xl border border-slate-200 px-3 py-2" value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy || isEdit} />
          </label>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              First name
              <input className="rounded-xl border border-slate-200 px-3 py-2" value={firstName ?? ''} onChange={(event) => setFirstName(event.target.value)} disabled={busy} />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Last name
              <input className="rounded-xl border border-slate-200 px-3 py-2" value={lastName ?? ''} onChange={(event) => setLastName(event.target.value)} disabled={busy} />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Role
              <select className="rounded-xl border border-slate-200 px-3 py-2" value={role ?? ''} onChange={(event) => setRole(event.target.value)} disabled={busy}>
                {roles.map((candidate) => (
                  <option key={candidate} value={candidate}>
                    {candidate}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Status
              <select className="rounded-xl border border-slate-200 px-3 py-2" value={status ?? ''} onChange={(event) => setStatus(event.target.value)} disabled={busy}>
                {statuses.map((candidate) => (
                  <option key={candidate} value={candidate}>
                    {candidate}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          {isEdit && item?.status !== 'DISABLED' ? (
            <button className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-700" onClick={() => changeActiveState('DISABLED')} disabled={busy}>
              Deactivate
            </button>
          ) : null}
          {isEdit && item?.status === 'DISABLED' ? (
            <button className="rounded-xl border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-700" onClick={() => changeActiveState('ACTIVE')} disabled={busy}>
              Reactivate
            </button>
          ) : null}
          <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" onClick={save} disabled={busy || !email || !role}>
            {busy ? 'Saving...' : 'Save account'}
          </button>
        </div>
      </div>
    </div>
  );
}
