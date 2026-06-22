'use client';

import { useState } from 'react';
import { adminApi } from '@/lib/api-client';

type ActionState = 'idle' | 'saving' | 'success' | 'error';

export function RbacAdminActions({
  userId,
  currentRole,
  availableRoles,
  disabled = false,
}: {
  userId: string;
  currentRole: string;
  availableRoles: string[];
  disabled?: boolean;
}) {
  const [role, setRole] = useState(currentRole);
  const [reason, setReason] = useState('Quarterly access review');
  const [state, setState] = useState<ActionState>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function assignRole() {
    setState('saving');
    setMessage(null);
    try {
      await adminApi.assignRole(userId, { role, reason });
      setState('success');
      setMessage('Role change recorded successfully. Refresh the page to pull the latest assignment state from the API.');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Unable to update the role assignment.');
    }
  }

  async function runReview() {
    setState('saving');
    setMessage(null);
    try {
      await adminApi.runAccessReview({ note: reason });
      setState('success');
      setMessage('Access review run recorded successfully. Refresh the page to see the newest audit events.');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Unable to run the access review.');
    }
  }

  return (
    <div className="card">
      <h3 className="section-title">API RBAC controls</h3>
      <p className="muted">These controls call the live RBAC endpoints for the selected admin assignment.</p>

      <label className="label" style={{ marginTop: 12 }}>
        Target role
        <select className="select" value={role} onChange={(event) => setRole(event.target.value)} disabled={disabled || state === 'saving'}>
          {availableRoles.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </label>

      <label className="label" style={{ marginTop: 12 }}>
        Change rationale
        <textarea
          className="textarea"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Document the business purpose for the role change or review run."
          disabled={disabled || state === 'saving'}
        />
      </label>

      <div className="inline-actions" style={{ marginTop: 16, flexWrap: 'wrap' }}>
        <button className="button primary" onClick={assignRole} disabled={disabled || state === 'saving'}>
          Update role
        </button>
        <button className="button secondary" onClick={runReview} disabled={disabled || state === 'saving'}>
          Run access review
        </button>
      </div>

      {message ? <div className={`banner ${state === 'error' ? 'warning' : 'info'}`} style={{ marginTop: 16 }}>{message}</div> : null}
    </div>
  );
}
