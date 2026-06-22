'use client';

import { useState } from 'react';
import { adminApi } from '@/lib/api-client';

type ActionState = 'idle' | 'saving' | 'success' | 'error';

export function RefundAdminActions({ paymentId, disabled = false }: { paymentId: string; disabled?: boolean }) {
  const [reasonCode, setReasonCode] = useState('ADMIN_REVIEW');
  const [note, setNote] = useState('');
  const [state, setState] = useState<ActionState>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function runAction() {
    setState('saving');
    setMessage(null);
    try {
      await adminApi.refundPayment(paymentId, { reasonCode, note });
      setState('success');
      setMessage('Refund action recorded successfully. Refresh the page to pull the latest refund queue state from the API.');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Unable to complete the refund action.');
    }
  }

  return (
    <div className="card admin-v19-action-card">
      <h3 className="section-title">API refund controls</h3>
      <p className="muted">These controls call the live refund endpoint for the selected payment record.</p>

      <label className="label" style={{ marginTop: 12 }}>
        Reason code
        <input
          className="input"
          value={reasonCode}
          onChange={(event) => setReasonCode(event.target.value)}
          placeholder="ADMIN_REVIEW"
          disabled={disabled || state === 'saving'}
        />
      </label>

      <label className="label" style={{ marginTop: 12 }}>
        Refund note
        <textarea
          className="textarea"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Enter the audit-ready rationale for the refund decision."
          disabled={disabled || state === 'saving'}
        />
      </label>

      <div className="inline-actions" style={{ marginTop: 16, flexWrap: 'wrap' }}>
        <button className="button primary" onClick={runAction} disabled={disabled || state === 'saving'}>
          Record refund
        </button>
      </div>

      {message ? <div className={`banner ${state === 'error' ? 'warning' : 'info'}`} style={{ marginTop: 16 }}>{message}</div> : null}
    </div>
  );
}
