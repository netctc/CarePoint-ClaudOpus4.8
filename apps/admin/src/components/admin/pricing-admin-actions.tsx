'use client';

import { useState } from 'react';
import { adminApi } from '@/lib/api-client';

type ActionState = 'idle' | 'saving' | 'success' | 'error';

export function PricingAdminActions({ ruleId, serviceCode, amountMinor, disabled = false }: { ruleId: string; serviceCode: string; amountMinor: number; disabled?: boolean }) {
  const [note, setNote] = useState('');
  const [state, setState] = useState<ActionState>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function runAction(mode: 'publish' | 'simulate') {
    setState('saving');
    setMessage(null);
    try {
      if (mode === 'publish') {
        await adminApi.publishPricingRule(ruleId, { note });
        setMessage('Pricing rule published successfully. Refresh the page to pull the latest rule state from the API.');
      } else {
        const response = await adminApi.simulatePricingRule({ serviceCode, amountMinor });
        const simulation = (response as { simulation?: { providerShareMinor?: number; organizationShareMinor?: number; currency?: string } }).simulation;
        setMessage(simulation ? `Simulation complete. Provider share: ${simulation.providerShareMinor}; platform share: ${simulation.organizationShareMinor} ${simulation.currency || ''}` : 'Simulation completed.');
      }
      setState('success');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Unable to complete the pricing action.');
    }
  }

  return (
    <div className="card">
      <h3 className="section-title">API pricing controls</h3>
      <p className="muted">These controls call the live pricing endpoints for the selected rule.</p>
      <label className="label" style={{ marginTop: 12 }}>
        Publish note
        <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Capture rule overlap checks, finance sign-off, and rollout notes." disabled={disabled || state === 'saving'} />
      </label>
      <div className="inline-actions" style={{ marginTop: 16, flexWrap: 'wrap' }}>
        <button className="button secondary" onClick={() => runAction('simulate')} disabled={disabled || state === 'saving'}>Run live simulation</button>
        <button className="button primary" onClick={() => runAction('publish')} disabled={disabled || state === 'saving'}>Publish rule</button>
      </div>
      {message ? <div className={`banner ${state === 'error' ? 'warning' : 'info'}`} style={{ marginTop: 16 }}>{message}</div> : null}
    </div>
  );
}
