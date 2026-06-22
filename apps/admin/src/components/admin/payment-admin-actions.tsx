'use client';

import { useMemo, useState } from 'react';
import { adminApi } from '@/lib/api-client';

type ActionState = 'idle' | 'saving' | 'success' | 'error';

type PaymentActionMode = 'hold' | 'release-hold' | 'settle';

export function PaymentAdminActions({
  paymentId,
  isHeld,
  disabled = false,
}: {
  paymentId: string;
  isHeld: boolean;
  disabled?: boolean;
}) {
  const [note, setNote] = useState('');
  const [reasonCode, setReasonCode] = useState('FINANCE_REVIEW');
  const [state, setState] = useState<ActionState>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const actionLabel = useMemo(() => {
    if (isHeld) return 'release the current hold';
    return 'apply an admin hold';
  }, [isHeld]);

  async function runAction(mode: PaymentActionMode) {
    setState('saving');
    setMessage(null);
    try {
      if (mode === 'hold') {
        await adminApi.holdPayment(paymentId, { reasonCode, note });
      } else if (mode === 'release-hold') {
        await adminApi.releasePaymentHold(paymentId, { note });
      } else {
        await adminApi.settlePayment(paymentId, { note });
      }
      setState('success');
      setMessage(`Action recorded successfully. Refresh the page to pull the latest payment state from the API.`);
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Unable to complete the payment action.');
    }
  }

  return (
    <div className="card admin-v19-action-card">
      <h3 className="section-title">API payment controls</h3>
      <p className="muted">These controls call the live reconciliation endpoints for the selected payment record.</p>

      <label className="label" style={{ marginTop: 12 }}>
        Reason code
        <input
          className="input"
          value={reasonCode}
          onChange={(event) => setReasonCode(event.target.value)}
          placeholder="FINANCE_REVIEW"
          disabled={disabled || state === 'saving' || isHeld}
        />
      </label>

      <label className="label" style={{ marginTop: 12 }}>
        Finance note
        <textarea
          className="textarea"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={`Enter the audit-ready rationale to ${actionLabel}.`}
          disabled={disabled || state === 'saving'}
        />
      </label>

      <div className="inline-actions" style={{ marginTop: 16, flexWrap: 'wrap' }}>
        {isHeld ? (
          <button className="button secondary" onClick={() => runAction('release-hold')} disabled={disabled || state === 'saving'}>
            Release hold
          </button>
        ) : (
          <button className="button secondary" onClick={() => runAction('hold')} disabled={disabled || state === 'saving'}>
            Apply hold
          </button>
        )}
        <button className="button primary" onClick={() => runAction('settle')} disabled={disabled || state === 'saving' || isHeld}>
          Mark as settled
        </button>
      </div>

      {message ? <div className={`banner ${state === 'error' ? 'warning' : 'info'}`} style={{ marginTop: 16 }}>{message}</div> : null}
    </div>
  );
}
