'use client';

import { useState } from 'react';
import { adminApi } from '@/lib/api-client';

type ActionState = 'idle' | 'saving' | 'success' | 'error';

export function CoverageAdminActions({ ruleId, isActive, disabled = false }: { ruleId: string; isActive: boolean; disabled?: boolean }) {
  const [note, setNote] = useState('');
  const [state, setState] = useState<ActionState>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function runAction(mode: 'activate' | 'deactivate') {
    setState('saving');
    setMessage(null);
    try {
      if (mode === 'activate') {
        await adminApi.activateCoverageRule(ruleId, { note });
      } else {
        await adminApi.deactivateCoverageRule(ruleId, { note });
      }
      setState('success');
      setMessage('Coverage action recorded successfully. Refresh the page to pull the latest rule state from the API.');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Unable to complete the coverage action.');
    }
  }

  return (
    <div className="card">
      <h3 className="section-title">API coverage controls</h3>
      <p className="muted">These controls call the live coverage rule endpoints for the selected rule.</p>
      <div className="banner info" style={{ marginTop: 12 }}>Current state: {isActive ? 'Active' : 'Not active'}</div>
      <label className="label" style={{ marginTop: 12 }}>
        Change note
        <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Capture payer impact, provider capacity changes, and rollback expectations." disabled={disabled || state === 'saving'} />
      </label>
      <div className="inline-actions" style={{ marginTop: 16, flexWrap: 'wrap' }}>
        <button className="button primary" onClick={() => runAction('activate')} disabled={disabled || state === 'saving' || isActive}>Activate rule</button>
        <button className="button secondary" onClick={() => runAction('deactivate')} disabled={disabled || state === 'saving' || !isActive}>Deactivate rule</button>
      </div>
      {message ? <div className={`banner ${state === 'error' ? 'warning' : 'info'}`} style={{ marginTop: 16 }}>{message}</div> : null}
    </div>
  );
}
