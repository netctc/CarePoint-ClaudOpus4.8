'use client';

import { ChangeEvent, useState } from 'react';
import { adminApi } from '@/lib/api-client';

type ExportState = 'idle' | 'saving' | 'success' | 'error';

export function AuditExportActions({ disabled = false }: { disabled?: boolean }) {
  const [format, setFormat] = useState<'json' | 'csv'>('csv');
  const [purpose, setPurpose] = useState('Compliance review for authorized KSA operations follow-up');
  const [state, setState] = useState<ExportState>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function exportAudit() {
    if (!purpose.trim()) {
      setState('error');
      setMessage('Purpose of use is required before exporting audit data.');
      return;
    }

    setState('saving');
    setMessage(null);
    try {
      const payload = await adminApi.exportAudit(format, purpose.trim());
      const blob = new Blob([payload.content], { type: payload.contentType });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = payload.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setState('success');
      setMessage(`Audit export downloaded as ${payload.filename}. Purpose of use was recorded in the exported watermark.`);
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Unable to export audit data.');
    }
  }

  return (
    <div className="card">
      <h3 className="section-title">API audit export</h3>
      <p className="muted">This control now requires purpose-of-use capture before calling the live audit export endpoint.</p>

      <label className="label" style={{ marginTop: 12 }}>
        Purpose of use
        <textarea
          className="input"
          rows={3}
          value={purpose}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setPurpose(event.target.value)}
          disabled={disabled || state === 'saving'}
          placeholder="Explain why this export is necessary and who is authorized to review it."
        />
      </label>

      <label className="label" style={{ marginTop: 12 }}>
        Export format
        <select className="select" value={format} onChange={(event: ChangeEvent<HTMLSelectElement>) => setFormat(event.target.value as 'json' | 'csv')} disabled={disabled || state === 'saving'}>
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
        </select>
      </label>

      <div className="inline-actions" style={{ marginTop: 16 }}>
        <button className="button primary" onClick={exportAudit} disabled={disabled || state === 'saving'}>
          Download audit export
        </button>
      </div>

      {message ? <div className={`banner ${state === 'error' ? 'warning' : 'info'}`} style={{ marginTop: 16 }}>{message}</div> : null}
    </div>
  );
}
