'use client';

import { useState } from 'react';
import { adminApi } from '@/lib/api-client';

type ActionState = 'idle' | 'saving' | 'success' | 'error';

export function SafetyAdminActions({ caseId, disabled = false }: { caseId: string; disabled?: boolean }) {
  const [severity, setSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');
  const [ownerName, setOwnerName] = useState('Safety queue');
  const [actionPlan, setActionPlan] = useState('Open corrective action plan and notify quality owners.');
  const [closureCode, setClosureCode] = useState('READY_TO_CLOSE');
  const [note, setNote] = useState('');
  const [state, setState] = useState<ActionState>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function run(mode: 'triage' | 'action-required' | 'close') {
    setState('saving');
    setMessage(null);
    try {
      if (mode === 'triage') await adminApi.triageSafetyCase(caseId, { severity, ownerName, note });
      if (mode === 'action-required') await adminApi.requireSafetyAction(caseId, { actionPlan, note });
      if (mode === 'close') await adminApi.closeSafetyCase(caseId, { closureCode, note });
      setState('success');
      setMessage('Safety action recorded successfully. Refresh the page to pull the latest case state from the API.');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Unable to complete the safety action.');
    }
  }

  return <div className="card">
    <h3 className="section-title">API safety controls</h3>
    <p className="muted">These controls call the live safety case endpoints for the selected case.</p>
    <div className="grid-2" style={{ marginTop: 12 }}>
      <label className="label">Severity<select className="select" value={severity} onChange={(e) => setSeverity(e.target.value as any)} disabled={disabled || state === 'saving'}><option value="LOW">LOW</option><option value="MEDIUM">MEDIUM</option><option value="HIGH">HIGH</option><option value="CRITICAL">CRITICAL</option></select></label>
      <label className="label">Owner name<input className="input" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} disabled={disabled || state === 'saving'} /></label>
    </div>
    <label className="label" style={{ marginTop: 12 }}>Action plan<textarea className="textarea" value={actionPlan} onChange={(e) => setActionPlan(e.target.value)} disabled={disabled || state === 'saving'} /></label>
    <label className="label" style={{ marginTop: 12 }}>Closure code<input className="input" value={closureCode} onChange={(e) => setClosureCode(e.target.value)} disabled={disabled || state === 'saving'} /></label>
    <label className="label" style={{ marginTop: 12 }}>Safety note<textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Capture investigation updates, mitigations, and closure evidence." disabled={disabled || state === 'saving'} /></label>
    <div className="inline-actions" style={{ marginTop: 16, flexWrap: 'wrap' }}>
      <button className="button secondary" onClick={() => run('triage')} disabled={disabled || state === 'saving'}>Triage case</button>
      <button className="button secondary" onClick={() => run('action-required')} disabled={disabled || state === 'saving'}>Record action plan</button>
      <button className="button primary" onClick={() => run('close')} disabled={disabled || state === 'saving'}>Close case</button>
    </div>
    {message ? <div className={`banner ${state === 'error' ? 'warning' : 'info'}`} style={{ marginTop: 16 }}>{message}</div> : null}
  </div>;
}
