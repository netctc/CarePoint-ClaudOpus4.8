'use client';

import { useState } from 'react';
import { adminApi } from '@/lib/api-client';

type ActionState = 'idle' | 'saving' | 'success' | 'error';

export function IntegrationAdminActions({ integrationId, disabled = false }: { integrationId: string; disabled?: boolean }) {
  const [note, setNote] = useState('');
  const [state, setState] = useState<ActionState>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function run(mode: 'rotate' | 'disable') {
    setState('saving');
    setMessage(null);
    try {
      if (mode === 'rotate') await adminApi.rotateIntegrationSecret(integrationId, { note });
      if (mode === 'disable') await adminApi.disableIntegration(integrationId, { note });
      setState('success');
      setMessage('Integration action recorded successfully. Refresh the page to pull the latest integration state from the API.');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Unable to complete the integration action.');
    }
  }

  return (
    <div className="card">
      <h3 className="section-title">API integration controls</h3>
      <p className="muted">These controls call the live integrations endpoints for the selected connector.</p>
      <label className="label" style={{ marginTop: 12 }}>
        Change note
        <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Capture risk, rollout impact, and owner communication before saving." disabled={disabled || state === 'saving'} />
      </label>
      <div className="inline-actions" style={{ marginTop: 16, flexWrap: 'wrap' }}>
        <button className="button secondary" onClick={() => run('disable')} disabled={disabled || state === 'saving'}>Disable integration</button>
        <button className="button primary" onClick={() => run('rotate')} disabled={disabled || state === 'saving'}>Rotate secret now</button>
      </div>
      {message ? <div className={`banner ${state === 'error' ? 'warning' : 'info'}`} style={{ marginTop: 16 }}>{message}</div> : null}
    </div>
  );
}
