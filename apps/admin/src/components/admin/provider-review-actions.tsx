'use client';

import { useState } from 'react';
import { adminApi } from '@/lib/api-client';

type ActionState = 'idle' | 'saving' | 'success' | 'error';

export function ProviderReviewActions({ providerId, disabled = false }: { providerId: string; disabled?: boolean }) {
  const [note, setNote] = useState('');
  const [requestedFields, setRequestedFields] = useState('');
  const [state, setState] = useState<ActionState>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function runAction(action: 'approve' | 'request-changes' | 'reject' | 'submit') {
    setState('saving');
    setMessage(null);
    try {
      if (action === 'approve') {
        await adminApi.approveProviderReview(providerId, { note });
      } else if (action === 'request-changes') {
        await adminApi.requestProviderReviewChanges(providerId, {
          note,
          requestedFields: requestedFields
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
        });
      } else if (action === 'reject') {
        await adminApi.rejectProviderReview(providerId, { note, reasonCode: 'ADMIN_DECISION' });
      } else {
        await adminApi.submitProviderReview(providerId, { note });
      }
      setState('success');
      setMessage('Action recorded successfully. Refresh the page to pull the latest review state from the API.');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Unable to complete the action.');
    }
  }

  return (
    <div className="card">
      <h3 className="section-title">API review actions</h3>
      <p className="muted">These controls call the real provider queue endpoints in the current API slot.</p>

      <label className="label" style={{ marginTop: 12 }}>
        Reviewer note
        <textarea
          className="textarea"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Enter audit-ready rationale for this queue decision."
          disabled={disabled || state === 'saving'}
        />
      </label>

      <label className="label" style={{ marginTop: 12 }}>
        Requested fields (comma-separated)
        <input
          className="input"
          value={requestedFields}
          onChange={(event) => setRequestedFields(event.target.value)}
          placeholder="bank details, license scan, specialty proof"
          disabled={disabled || state === 'saving'}
        />
      </label>

      <div className="inline-actions" style={{ marginTop: 16, flexWrap: 'wrap' }}>
        <button className="button secondary" onClick={() => runAction('submit')} disabled={disabled || state === 'saving'}>
          Submit for review
        </button>
        <button className="button primary" onClick={() => runAction('approve')} disabled={disabled || state === 'saving'}>
          Approve provider
        </button>
        <button className="button secondary" onClick={() => runAction('request-changes')} disabled={disabled || state === 'saving'}>
          Request changes
        </button>
        <button className="button danger" onClick={() => runAction('reject')} disabled={disabled || state === 'saving'}>
          Reject application
        </button>
      </div>

      {message ? <div className={`banner ${state === 'error' ? 'warning' : 'info'}`} style={{ marginTop: 16 }}>{message}</div> : null}
    </div>
  );
}
