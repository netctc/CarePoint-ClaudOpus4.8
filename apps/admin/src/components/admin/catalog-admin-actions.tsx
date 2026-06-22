'use client';

import { useState } from 'react';
import { adminApi } from '@/lib/api-client';

type ActionState = 'idle' | 'saving' | 'success' | 'error';

export function CatalogAdminActions({ serviceId, status, disabled = false }: { serviceId: string; status: string; disabled?: boolean }) {
  const [note, setNote] = useState('');
  const [state, setState] = useState<ActionState>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function runAction(mode: 'publish' | 'archive') {
    setState('saving');
    setMessage(null);
    try {
      if (mode === 'publish') {
        await adminApi.publishCatalogService(serviceId, { note });
      } else {
        await adminApi.archiveCatalogService(serviceId, { note });
      }
      setState('success');
      setMessage('Catalog action recorded successfully. Refresh the page to pull the latest service state from the API.');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Unable to complete the catalog action.');
    }
  }

  return (
    <div className="card">
      <h3 className="section-title">API catalog controls</h3>
      <p className="muted">These controls call the live service catalog endpoints for the selected service.</p>
      <div className="banner info" style={{ marginTop: 12 }}>Current status: {status}</div>
      <label className="label" style={{ marginTop: 12 }}>
        Change note
        <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Capture downstream impact, dependencies, and rollback expectations." disabled={disabled || state === 'saving'} />
      </label>
      <div className="inline-actions" style={{ marginTop: 16, flexWrap: 'wrap' }}>
        <button className="button primary" onClick={() => runAction('publish')} disabled={disabled || state === 'saving'}>Publish service</button>
        <button className="button secondary" onClick={() => runAction('archive')} disabled={disabled || state === 'saving'}>Archive service</button>
      </div>
      {message ? <div className={`banner ${state === 'error' ? 'warning' : 'info'}`} style={{ marginTop: 16 }}>{message}</div> : null}
    </div>
  );
}
