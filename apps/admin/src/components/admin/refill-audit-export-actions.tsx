'use client';

import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '@/lib/api-client';

type Mode = 'idle' | 'saving' | 'success' | 'error';
type ScopeItem = {
  id: string;
  title: string;
  note?: string | null;
  limit: number;
  queue?: string | null;
  assignedRole?: string | null;
  controlledOnly?: boolean;
  escalatedOnly?: boolean;
  includeExecutions?: boolean;
  includeOperationalEvents?: boolean;
  updatedAt?: string;
};

type PacketSummary = {
  summary?: {
    operationalEventCount?: number;
    escalationCount?: number;
    controlledMedicationEvents?: number;
    deliveryExecutionCount?: number;
    failedDeliveryCount?: number;
    exportReadyCount?: number;
  };
  governanceNotes?: string[];
};

const emptyForm = {
  title: '',
  note: '',
  limit: 100,
  queue: '',
  assignedRole: '',
  controlledOnly: false,
  escalatedOnly: false,
  includeExecutions: true,
  includeOperationalEvents: true,
};

export function RefillAuditExportActions() {
  const [state, setState] = useState<Mode>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [scopes, setScopes] = useState<ScopeItem[]>([]);
  const [selectedScopeId, setSelectedScopeId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [summary, setSummary] = useState<PacketSummary | null>(null);

  const selectedScope = useMemo(() => scopes.find((item) => item.id === selectedScopeId) ?? null, [scopes, selectedScopeId]);

  async function loadScopes() {
    try {
      const [scopeResponse, summaryResponse] = await Promise.all([
        adminApi.refillAuditScopes(),
        adminApi.refillAuditPacketSummary(selectedScopeId || undefined),
      ]);
      const items = Array.isArray(scopeResponse.items) ? scopeResponse.items : [];
      setScopes(items);
      setSummary(summaryResponse);
      if (!selectedScopeId && items.length) {
        setSelectedScopeId(items[0].id);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load refill audit scopes.');
      setState('error');
    }
  }

  useEffect(() => {
    void loadScopes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await adminApi.refillAuditPacketSummary(selectedScopeId || undefined);
        if (active) setSummary(response);
      } catch {
        // keep current summary
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedScopeId]);

  async function download(kind: 'delivery-executions' | 'refill-audit-packet', format: 'csv' | 'json') {
    setState('saving');
    setMessage(null);
    try {
      const file = kind === 'delivery-executions'
        ? await adminApi.exportReportDeliveryExecutions({ format, limit: selectedScope?.limit ?? 100 })
        : await adminApi.exportRefillAuditPacket({ format, limit: selectedScope?.limit ?? 100, scopeId: selectedScopeId || undefined });
      const blob = new Blob([file.content], { type: file.contentType });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.filename;
      anchor.click();
      window.URL.revokeObjectURL(url);
      setState('success');
      setMessage(`Downloaded ${file.filename}.`);
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Unable to export the refill audit packet.');
    }
  }

  async function saveScope() {
    if (!form.title.trim()) {
      setState('error');
      setMessage('Provide a scope title before saving.');
      return;
    }
    setState('saving');
    setMessage(null);
    try {
      const response = await adminApi.createRefillAuditScope({
        title: form.title.trim(),
        note: form.note.trim() || undefined,
        limit: Number(form.limit) || 100,
        queue: form.queue.trim() || undefined,
        assignedRole: form.assignedRole ? (form.assignedRole as 'PROVIDER' | 'PHARMACIST' | 'NURSE') : undefined,
        controlledOnly: form.controlledOnly,
        escalatedOnly: form.escalatedOnly,
        includeExecutions: form.includeExecutions,
        includeOperationalEvents: form.includeOperationalEvents,
      });
      setState('success');
      setMessage(`Saved scope ${response.item?.title ?? form.title}.`);
      setForm(emptyForm);
      await loadScopes();
      if (response.item?.id) setSelectedScopeId(response.item.id);
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Unable to save the refill audit scope.');
    }
  }

  const summaryItems = [
    { label: 'Export ready', value: String(summary?.summary?.exportReadyCount ?? 0) },
    { label: 'Escalations', value: String(summary?.summary?.escalationCount ?? 0) },
    { label: 'Controlled', value: String(summary?.summary?.controlledMedicationEvents ?? 0) },
    { label: 'Failed deliveries', value: String(summary?.summary?.failedDeliveryCount ?? 0) },
  ];

  return (
    <div className="card">
      <h3 className="section-title">Refill audit packet exports</h3>
      <p className="muted">Download governed delivery-execution history and refill ownership/escalation packets for audit review.</p>

      <div className="grid-2" style={{ marginTop: 16, gap: 16 }}>
        <label className="field compact-field">
          <span>Saved scope</span>
          <select value={selectedScopeId} onChange={(event) => setSelectedScopeId(event.target.value)}>
            <option value="">All governed refill activity</option>
            {scopes.map((scope) => (
              <option key={scope.id} value={scope.id}>{scope.title}</option>
            ))}
          </select>
        </label>
        <div className="note-card">
          <strong>{selectedScope?.title ?? 'Default scope'}</strong>
          <p className="muted small">{selectedScope?.note ?? 'All governed refill activity with the current limit.'}</p>
        </div>
      </div>

      <div className="grid-4" style={{ marginTop: 16, gap: 12 }}>
        {summaryItems.map((item) => (
          <div key={item.label} className="note-card">
            <div className="muted small">{item.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{item.value}</div>
          </div>
        ))}
      </div>

      {summary?.governanceNotes?.length ? (
        <ul className="simple-list muted" style={{ marginTop: 16 }}>
          {summary.governanceNotes.map((note) => <li key={note}>{note}</li>)}
        </ul>
      ) : null}

      <div className="inline-actions" style={{ marginTop: 16, flexWrap: 'wrap' }}>
        <button className="button secondary" onClick={() => download('delivery-executions', 'csv')} disabled={state === 'saving'}>Export delivery executions (CSV)</button>
        <button className="button secondary" onClick={() => download('delivery-executions', 'json')} disabled={state === 'saving'}>Export delivery executions (JSON)</button>
        <button className="button secondary" onClick={() => download('refill-audit-packet', 'csv')} disabled={state === 'saving'}>Export refill audit packet (CSV)</button>
        <button className="button primary" onClick={() => download('refill-audit-packet', 'json')} disabled={state === 'saving'}>Export refill audit packet (JSON)</button>
      </div>

      <div className="card" style={{ marginTop: 16, background: '#f8fafc' }}>
        <h4 className="section-title" style={{ marginBottom: 12 }}>Save a governed filter scope</h4>
        <div className="grid-2" style={{ gap: 12 }}>
          <label className="field compact-field">
            <span>Title</span>
            <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Controlled refill escalations" />
          </label>
          <label className="field compact-field">
            <span>Limit</span>
            <input type="number" min={1} max={250} value={form.limit} onChange={(event) => setForm((current) => ({ ...current, limit: Number(event.target.value) || 100 }))} />
          </label>
          <label className="field compact-field">
            <span>Queue</span>
            <input value={form.queue} onChange={(event) => setForm((current) => ({ ...current, queue: event.target.value }))} placeholder="PHARMACY_NETWORK" />
          </label>
          <label className="field compact-field">
            <span>Assigned role</span>
            <select value={form.assignedRole} onChange={(event) => setForm((current) => ({ ...current, assignedRole: event.target.value }))}>
              <option value="">Any role</option>
              <option value="PROVIDER">Provider</option>
              <option value="PHARMACIST">Pharmacist</option>
              <option value="NURSE">Nurse</option>
            </select>
          </label>
        </div>
        <label className="field" style={{ marginTop: 12 }}>
          <span>Scope note</span>
          <textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="Why this governed scope matters" rows={3} />
        </label>
        <div className="inline-actions" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          <label className="checkbox-row"><input type="checkbox" checked={form.controlledOnly} onChange={(event) => setForm((current) => ({ ...current, controlledOnly: event.target.checked }))} /> <span>Controlled only</span></label>
          <label className="checkbox-row"><input type="checkbox" checked={form.escalatedOnly} onChange={(event) => setForm((current) => ({ ...current, escalatedOnly: event.target.checked }))} /> <span>Escalated only</span></label>
          <label className="checkbox-row"><input type="checkbox" checked={form.includeExecutions} onChange={(event) => setForm((current) => ({ ...current, includeExecutions: event.target.checked }))} /> <span>Include deliveries</span></label>
          <label className="checkbox-row"><input type="checkbox" checked={form.includeOperationalEvents} onChange={(event) => setForm((current) => ({ ...current, includeOperationalEvents: event.target.checked }))} /> <span>Include operational events</span></label>
        </div>
        <div className="inline-actions" style={{ marginTop: 12 }}>
          <button className="button primary" onClick={() => void saveScope()} disabled={state === 'saving'}>Save scope</button>
        </div>
      </div>

      {message ? <div className={`banner ${state === 'error' ? 'warning' : 'info'}`} style={{ marginTop: 16 }}>{message}</div> : null}
    </div>
  );
}
