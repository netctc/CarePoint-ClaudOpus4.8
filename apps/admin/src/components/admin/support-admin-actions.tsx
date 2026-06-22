'use client';

import { useState } from 'react';
import { adminApi } from '@/lib/api-client';

type ActionState = 'idle' | 'saving' | 'success' | 'error';

export function SupportAdminActions({ itemId, disabled = false }: { itemId: string; disabled?: boolean }) {
  const [assigneeName, setAssigneeName] = useState('Support queue');
  const [queue, setQueue] = useState('Finance Support');
  const [resolutionCode, setResolutionCode] = useState('RESOLVED');
  const [note, setNote] = useState('');
  const [state, setState] = useState<ActionState>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function run(mode: 'assign' | 'escalate' | 'resolve') {
    setState('saving');
    setMessage(null);
    try {
      if (mode === 'assign') await adminApi.assignSupportWorkItem(itemId, { assigneeName, note });
      if (mode === 'escalate') await adminApi.escalateSupportWorkItem(itemId, { queue, note });
      if (mode === 'resolve') await adminApi.resolveSupportWorkItem(itemId, { resolutionCode, note });
      setState('success');
      setMessage('Support action recorded successfully. Refresh the page to pull the latest ticket state from the API.');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Unable to complete the support action.');
    }
  }

  return <div className="card">
    <h3 className="section-title">API support controls</h3>
    <p className="muted">These controls call the live support work-item endpoints for the selected ticket.</p>
    <label className="label" style={{ marginTop: 12 }}>Assignee name<input className="input" value={assigneeName} onChange={(e) => setAssigneeName(e.target.value)} disabled={disabled || state === 'saving'} /></label>
    <label className="label" style={{ marginTop: 12 }}>Escalation queue<input className="input" value={queue} onChange={(e) => setQueue(e.target.value)} disabled={disabled || state === 'saving'} /></label>
    <label className="label" style={{ marginTop: 12 }}>Resolution code<input className="input" value={resolutionCode} onChange={(e) => setResolutionCode(e.target.value)} disabled={disabled || state === 'saving'} /></label>
    <label className="label" style={{ marginTop: 12 }}>Support note<textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Capture the ticket context, customer communication, and escalation rationale." disabled={disabled || state === 'saving'} /></label>
    <div className="inline-actions" style={{ marginTop: 16, flexWrap: 'wrap' }}>
      <button className="button secondary" onClick={() => run('assign')} disabled={disabled || state === 'saving'}>Assign ticket</button>
      <button className="button secondary" onClick={() => run('escalate')} disabled={disabled || state === 'saving'}>Escalate ticket</button>
      <button className="button primary" onClick={() => run('resolve')} disabled={disabled || state === 'saving'}>Resolve ticket</button>
    </div>
    {message ? <div className={`banner ${state === 'error' ? 'warning' : 'info'}`} style={{ marginTop: 16 }}>{message}</div> : null}
  </div>;
}
