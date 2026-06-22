'use client';

import { useState } from 'react';
import { adminApi } from '@/lib/api-client';

type ActionState = 'idle' | 'saving' | 'success' | 'error';

export function ModerationAdminActions({ reviewId, disabled = false }: { reviewId: string; disabled?: boolean }) {
  const [ownerName, setOwnerName] = useState('Trust and safety');
  const [reviewerUserId, setReviewerUserId] = useState('ops-support');
  const [queue, setQueue] = useState('Trust & Safety');
  const [disposition, setDisposition] = useState('approved_after_review');
  const [note, setNote] = useState('');
  const [state, setState] = useState<ActionState>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function run(mode: 'assign' | 'escalate' | 'resolve') {
    setState('saving');
    setMessage(null);
    try {
      if (mode === 'assign') await adminApi.assignModerationReview(reviewId, { reviewerUserId, ownerName, note });
      if (mode === 'escalate') await adminApi.escalateModerationReview(reviewId, { queue, note });
      if (mode === 'resolve') await adminApi.resolveModerationReview(reviewId, { disposition, note });
      setState('success');
      setMessage('Moderation action recorded successfully. Refresh the page to pull the latest moderation state from the API.');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Unable to complete the moderation action.');
    }
  }

  return (
    <div className="card">
      <h3 className="section-title">API moderation controls</h3>
      <p className="muted">These controls call the live moderation endpoints for the selected review case.</p>
      <div className="grid-2" style={{ marginTop: 12 }}>
        <label className="label">Owner name<input className="input" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} disabled={disabled || state === 'saving'} /></label>
        <label className="label">Reviewer user ID<input className="input" value={reviewerUserId} onChange={(e) => setReviewerUserId(e.target.value)} disabled={disabled || state === 'saving'} /></label>
      </div>
      <div className="grid-2" style={{ marginTop: 12 }}>
        <label className="label">Escalation queue<input className="input" value={queue} onChange={(e) => setQueue(e.target.value)} disabled={disabled || state === 'saving'} /></label>
        <label className="label">Resolution disposition<input className="input" value={disposition} onChange={(e) => setDisposition(e.target.value)} disabled={disabled || state === 'saving'} /></label>
      </div>
      <label className="label" style={{ marginTop: 12 }}>
        Moderation note
        <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Capture the rationale, evidence summary, and any downstream governance handoff." disabled={disabled || state === 'saving'} />
      </label>
      <div className="inline-actions" style={{ marginTop: 16, flexWrap: 'wrap' }}>
        <button className="button secondary" onClick={() => run('assign')} disabled={disabled || state === 'saving'}>Assign reviewer</button>
        <button className="button secondary" onClick={() => run('resolve')} disabled={disabled || state === 'saving'}>Resolve review</button>
        <button className="button primary" onClick={() => run('escalate')} disabled={disabled || state === 'saving'}>Escalate fraud review</button>
      </div>
      {message ? <div className={`banner ${state === 'error' ? 'warning' : 'info'}`} style={{ marginTop: 16 }}>{message}</div> : null}
    </div>
  );
}
