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
      setMessage('Action recorded. Refresh to see updated state.');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Unable to complete the action.');
    }
  }

  return (
    <div className="card">
      <h3 className="section-title">Review Decision</h3>

      <label className="label" style={{ marginTop: 12 }}>
        Reviewer Note
        <textarea
          className="textarea"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Enter rationale for this decision"
          disabled={disabled || state === 'saving'}
        />
      </label>

      <label className="label" style={{ marginTop: 12 }}>
        Requested Fields (comma-separated)
        <input
          className="input"
          value={requestedFields}
          onChange={(event) => setRequestedFields(event.target.value)}
          placeholder="bank details, license scan, specialty proof"
          disabled={disabled || state === 'saving'}
        />
      </label>

      {/* Primary decision buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20 }}>
        <button
          className="button primary"
          onClick={() => runAction('approve')}
          disabled={disabled || state === 'saving'}
          style={{ width: '100%', padding: '12px 16px', fontSize: 15, fontWeight: 700 }}
        >
          ✓ Approve Provider
        </button>
        <button
          className="button danger"
          onClick={() => runAction('reject')}
          disabled={disabled || state === 'saving'}
          style={{ width: '100%', padding: '12px 16px', fontSize: 15, fontWeight: 700 }}
        >
          ✗ Reject Application
        </button>
      </div>

      {/* Secondary actions */}
      <div className="inline-actions" style={{ marginTop: 12 }}>
        <button
          className="button secondary"
          onClick={() => runAction('submit')}
          disabled={disabled || state === 'saving'}
        >
          Submit for Review
        </button>
        <button
          className="button secondary"
          onClick={() => runAction('request-changes')}
          disabled={disabled || state === 'saving'}
        >
          Request Changes
        </button>
      </div>

      {message && (
        <div className={`banner ${state === 'error' ? 'warning' : 'info'}`} style={{ marginTop: 16 }}>
          {message}
        </div>
      )}
    </div>
  );
}
