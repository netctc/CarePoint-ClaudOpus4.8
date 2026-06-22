'use client';

import { useState } from 'react';
import { adminApi } from '@/lib/api-client';

type ActionState = 'idle' | 'saving' | 'success' | 'error';

export function TelehealthOpsActions({ sessionId, disabled = false }: { sessionId: string; disabled?: boolean }) {
  const [severity, setSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [reasonCode, setReasonCode] = useState('ROOM_RECOVERY');
  const [note, setNote] = useState('');
  const [state, setState] = useState<ActionState>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function run(mode: 'mark-live' | 'end' | 'restart-room' | 'escalate') {
    setState('saving');
    setMessage(null);
    try {
      if (mode === 'mark-live') await adminApi.markTelehealthSessionLive(sessionId);
      if (mode === 'end') await adminApi.endTelehealthOpsSession(sessionId);
      if (mode === 'restart-room') await adminApi.restartTelehealthRoom(sessionId);
      if (mode === 'escalate') await adminApi.escalateTelehealthSession(sessionId, { severity, reasonCode, note });
      setState('success');
      setMessage('Telehealth action recorded successfully. Refresh the page to pull the latest session state from the API.');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Unable to complete the telehealth action.');
    }
  }

  return <div className="card">
    <h3 className="section-title">API telehealth controls</h3>
    <p className="muted">These controls call the live telehealth operations endpoints for the selected session.</p>
    <div className="grid-2" style={{ marginTop: 12 }}>
      <label className="label">Severity<select className="select" value={severity} onChange={(e) => setSeverity(e.target.value as any)} disabled={disabled || state === 'saving'}><option value="LOW">LOW</option><option value="MEDIUM">MEDIUM</option><option value="HIGH">HIGH</option><option value="CRITICAL">CRITICAL</option></select></label>
      <label className="label">Reason code<input className="input" value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} disabled={disabled || state === 'saving'} /></label>
    </div>
    <label className="label" style={{ marginTop: 12 }}>Operations note<textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Capture room state, affected users, and technical remediation context." disabled={disabled || state === 'saving'} /></label>
    <div className="inline-actions" style={{ marginTop: 16, flexWrap: 'wrap' }}>
      <button className="button secondary" onClick={() => run('mark-live')} disabled={disabled || state === 'saving'}>Mark live</button>
      <button className="button secondary" onClick={() => run('restart-room')} disabled={disabled || state === 'saving'}>Restart room</button>
      <button className="button secondary" onClick={() => run('end')} disabled={disabled || state === 'saving'}>End session</button>
      <button className="button primary" onClick={() => run('escalate')} disabled={disabled || state === 'saving'}>Escalate issue</button>
    </div>
    {message ? <div className={`banner ${state === 'error' ? 'warning' : 'info'}`} style={{ marginTop: 16 }}>{message}</div> : null}
  </div>;
}
