'use client';

import { useState } from 'react';
import { adminApi } from '@/lib/api-client';

type ActionState = 'idle' | 'saving' | 'success' | 'error';

export function CampaignAdminActions({ campaignId, disabled = false }: { campaignId: string; disabled?: boolean }) {
  const [note, setNote] = useState('');
  const [scheduledFor, setScheduledFor] = useState('2026-04-03T10:00');
  const [state, setState] = useState<ActionState>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function run(mode: 'approve' | 'schedule' | 'pause') {
    setState('saving');
    setMessage(null);
    try {
      if (mode === 'approve') await adminApi.approveCampaign(campaignId, { note });
      if (mode === 'schedule') await adminApi.scheduleCampaign(campaignId, { scheduledFor: new Date(scheduledFor).toISOString(), note });
      if (mode === 'pause') await adminApi.pauseCampaign(campaignId, { note });
      setState('success');
      setMessage('Campaign action recorded successfully. Refresh the page to pull the latest campaign state from the API.');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Unable to complete the campaign action.');
    }
  }

  return (
    <div className="card">
      <h3 className="section-title">API campaign controls</h3>
      <p className="muted">These controls call the live campaigns endpoints for the selected campaign.</p>
      <label className="label" style={{ marginTop: 12 }}>
        Scheduled send time
        <input className="input" type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} disabled={disabled || state === 'saving'} />
      </label>
      <label className="label" style={{ marginTop: 12 }}>
        Campaign note
        <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Capture approval context, send blockers, or suppression review notes." disabled={disabled || state === 'saving'} />
      </label>
      <div className="inline-actions" style={{ marginTop: 16, flexWrap: 'wrap' }}>
        <button className="button secondary" onClick={() => run('approve')} disabled={disabled || state === 'saving'}>Approve campaign</button>
        <button className="button secondary" onClick={() => run('pause')} disabled={disabled || state === 'saving'}>Pause campaign</button>
        <button className="button primary" onClick={() => run('schedule')} disabled={disabled || state === 'saving'}>Schedule campaign</button>
      </div>
      {message ? <div className={`banner ${state === 'error' ? 'warning' : 'info'}`} style={{ marginTop: 16 }}>{message}</div> : null}
    </div>
  );
}
