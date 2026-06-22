'use client';

import { useState } from 'react';
import { adminApi } from '@/lib/api-client';

type ActionState = 'idle' | 'saving' | 'success' | 'error';

export function ReportAdminActions({ reportId, disabled = false }: { reportId: string; disabled?: boolean }) {
  const [note, setNote] = useState('');
  const [range, setRange] = useState('last_30_days');
  const [state, setState] = useState<ActionState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [preset, setPreset] = useState('');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [presetTitle, setPresetTitle] = useState('');
  const [schedule, setSchedule] = useState('WEEKLY');
  const [destination, setDestination] = useState('ops@carecenter.local');
  const [subjectScope, setSubjectScope] = useState<'all' | 'self' | 'family'>('all');

  async function run(mode: 'publish' | 'archive' | 'run' | 'export' | 'save-preset' | 'schedule') {
    setState('saving');
    setMessage(null);
    try {
      if (mode === 'publish') await adminApi.publishReportDefinition(reportId, { note });
      if (mode === 'archive') await adminApi.archiveReportDefinition(reportId, { note });
      if (mode === 'run') {
        const response = await adminApi.runReportDefinition(reportId, { range, subjectScope, note });
        const metrics = Array.isArray((response as any)?.reportRun?.metrics) ? (response as any).reportRun.metrics.length : 0;
        setMessage(`Report run completed successfully with ${metrics} metric output${metrics === 1 ? '' : 's'}. Refresh the page to reload the latest API-backed definition state.`);
        setState('success');
        return;
      }
      if (mode === 'export') {
        const file = await adminApi.exportReportDefinition(reportId, { format, range, preset: preset || undefined, subjectScope, note });
        const blob = new Blob([file.content], { type: file.contentType });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = file.filename;
        anchor.click();
        window.URL.revokeObjectURL(url);
        setState('success');
        setMessage(`Export created successfully as ${file.filename}.`);
        return;
      }
      if (mode === 'save-preset') {
        await adminApi.saveReportPreset({
          title: presetTitle || 'Refill KPI pack',
          description: 'Saved from the admin refill KPI export controls.',
          reportId,
          sourcePresetId: preset || undefined,
          format,
          range,
          subjectScope,
          note,
        });
        setState('success');
        setMessage('Saved refill KPI preset successfully. Refresh the page to reload the latest preset list.');
        return;
      }
      if (mode === 'schedule') {
        await adminApi.createReportDeliverySchedule({
          title: presetTitle || 'Refill KPI delivery',
          reportId,
          presetId: undefined,
          destination,
          schedule,
          format,
          range,
          subjectScope,
          note,
        });
        setState('success');
        setMessage('Scheduled refill KPI delivery successfully. Refresh the page to reload the latest delivery schedule list.');
        return;
      }
      setState('success');
      setMessage('Report action recorded successfully. Refresh the page to reload the latest API-backed definition state.');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Unable to complete the report action.');
    }
  }

  return (
    <div className="card">
      <h3 className="section-title">API report controls</h3>
      <p className="muted">These controls call the live reports endpoints for the selected definition.</p>
      <label className="label" style={{ marginTop: 12 }}>
        Report range
        <select className="select" value={range} onChange={(e) => setRange(e.target.value)} disabled={disabled || state === 'saving'}>
          <option value="last_7_days">Last 7 days</option>
          <option value="last_30_days">Last 30 days</option>
          <option value="last_90_days">Last 90 days</option>
        </select>
      </label>
      <label className="label" style={{ marginTop: 12 }}>
        Export preset
        <select className="select" value={preset} onChange={(e) => setPreset(e.target.value)} disabled={disabled || state === 'saving'}>
          <option value="">Use selected definition metrics</option>
          <option value="refill-aging-watch">Refill aging watch</option>
          <option value="controlled-rejection-trend">Controlled rejection trend</option>
        </select>
      </label>
      <label className="label" style={{ marginTop: 12 }}>
        Export format
        <select className="select" value={format} onChange={(e) => setFormat(e.target.value as 'csv' | 'json')} disabled={disabled || state === 'saving'}>
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
        </select>
      </label>

      <label className="label" style={{ marginTop: 12 }}>
        Subject scope
        <select className="select" value={subjectScope} onChange={(e) => setSubjectScope(e.target.value as 'all' | 'self' | 'family')} disabled={disabled || state === 'saving'}>
          <option value="all">All profiles</option>
          <option value="self">Self profile only</option>
          <option value="family">Family / dependents only</option>
        </select>
      </label>
      <label className="label" style={{ marginTop: 12 }}>
        Saved preset / delivery title
        <input className="input" value={presetTitle} onChange={(e) => setPresetTitle(e.target.value)} placeholder="Refill KPI aging watch" disabled={disabled || state === 'saving'} />
      </label>
      <label className="label" style={{ marginTop: 12 }}>
        Delivery destination
        <input className="input" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="ops@carecenter.local" disabled={disabled || state === 'saving'} />
      </label>
      <label className="label" style={{ marginTop: 12 }}>
        Delivery schedule
        <select className="select" value={schedule} onChange={(e) => setSchedule(e.target.value)} disabled={disabled || state === 'saving'}>
          <option value="DAILY">Daily</option>
          <option value="WEEKLY">Weekly</option>
          <option value="MONTHLY">Monthly</option>
        </select>
      </label>
      <label className="label" style={{ marginTop: 12 }}>
        Change note
        <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Capture ownership, delivery scope, or governance context." disabled={disabled || state === 'saving'} />
      </label>
      <div className="inline-actions" style={{ marginTop: 16, flexWrap: 'wrap' }}>
        <button className="button secondary" onClick={() => run('publish')} disabled={disabled || state === 'saving'}>Publish definition</button>
        <button className="button secondary" onClick={() => run('archive')} disabled={disabled || state === 'saving'}>Archive definition</button>
        <button className="button primary" onClick={() => run('run')} disabled={disabled || state === 'saving'}>Run report now</button>
        <button className="button secondary" onClick={() => run('export')} disabled={disabled || state === 'saving'}>Export KPI pack</button>
        <button className="button secondary" onClick={() => run('save-preset')} disabled={disabled || state === 'saving'}>Save preset</button>
        <button className="button secondary" onClick={() => run('schedule')} disabled={disabled || state === 'saving'}>Schedule delivery</button>
      </div>
      {message ? <div className={`banner ${state === 'error' ? 'warning' : 'info'}`} style={{ marginTop: 16 }}>{message}</div> : null}
    </div>
  );
}
