'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { providerApi } from '@/services/api-client';
import { getSlotTemplateData } from '@/services/mock-api';

export default function SlotTemplateEditorPage() {
  const fallback = useMemo(() => getSlotTemplateData(), []);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [facilityOptions, setFacilityOptions] = useState<string[]>(fallback.locations);
  const [providerName, setProviderName] = useState('Signed-in provider');
  const [templateName, setTemplateName] = useState(fallback.templateName);
  const [facility, setFacility] = useState(fallback.location);
  const [service, setService] = useState(fallback.service);
  const [duration, setDuration] = useState(fallback.duration);
  const [buffer, setBuffer] = useState(fallback.buffer);
  const [capacity, setCapacity] = useState(String(fallback.capacity));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'live' | 'fallback'>('fallback');
  const [saving, setSaving] = useState(false);

  const serviceOptions = useMemo(() => {
    const set = new Set<string>(fallback.services);
    templates.forEach((item) => {
      if (item?.service) set.add(String(item.service));
    });
    return Array.from(set);
  }, [fallback.services, templates]);

  const applyTemplate = useCallback((item: any | null) => {
    if (!item) {
      setSelectedId(null);
      setTemplateName(fallback.templateName);
      setFacility(fallback.location);
      setService(fallback.service);
      setDuration(fallback.duration);
      setBuffer(fallback.buffer);
      setCapacity(String(fallback.capacity));
      return;
    }
    setSelectedId(String(item.id));
    setTemplateName(String(item.templateName ?? fallback.templateName));
    setFacility(String(item.location ?? fallback.location));
    setService(String(item.service ?? fallback.service));
    setDuration(`${item.durationMinutes ?? 30} minutes`);
    setBuffer(`${item.bufferMinutes ?? 5} minutes`);
    setCapacity(String(item.capacity ?? fallback.capacity));
  }, [fallback]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [meResult, overviewResult, templatesResult]: any = await Promise.all([
        providerApi.me(),
        providerApi.providerCalendarOverview(),
        providerApi.providerCalendarTemplates(),
      ]);
      const user = meResult?.user ?? meResult;
      const items = templatesResult?.items ?? [];
      setProviderName(user?.name ?? user?.fullName ?? user?.email ?? 'Signed-in provider');
      setTemplates(items);
      setFacilityOptions((overviewResult?.facilities?.length ? overviewResult.facilities : fallback.locations) as string[]);
      applyTemplate(items[0] ?? null);
      setSource('live');
    } catch (err) {
      setTemplates([]);
      setFacilityOptions(fallback.locations);
      applyTemplate(null);
      setSource('fallback');
      setError(err instanceof Error ? err.message : 'Unable to load provider scheduling templates');
    }
  }, [applyTemplate, fallback.locations]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveTemplate() {
    setSaving(true);
    setMessage(null);
    setError(null);
    const payload = {
      templateName,
      durationMinutes: Number.parseInt(duration, 10) || 30,
      bufferMinutes: Number.parseInt(buffer, 10) || 0,
      capacity: Number.parseInt(capacity, 10) || 1,
      service,
      location: facility,
      serviceModes: [facility.toLowerCase().includes('tele') ? 'Telehealth' : 'In-Person'],
      pattern: fallback.pattern,
      note: 'Saved from provider template editor',
    };

    try {
      const result: any = selectedId
        ? await providerApi.updateProviderCalendarTemplate(selectedId, payload)
        : await providerApi.createProviderCalendarTemplate(payload);
      applyTemplate(result?.item ?? null);
      setMessage('Template saved to the live provider scheduling API.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save template');
    } finally {
      setSaving(false);
    }
  }

  async function publishTemplate() {
    if (!selectedId) {
      setError('Save the template before publishing it.');
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const result: any = await providerApi.publishProviderCalendarTemplate(selectedId, 'Published from provider template editor');
      const createdSlots = Number(result?.publishResult?.createdSlots ?? 0);
      const conflicts = Number(result?.publishResult?.conflicts?.length ?? 0);
      setMessage(`Template published through the live provider scheduling API. ${createdSlots} future slot${createdSlots === 1 ? '' : 's'} created${conflicts ? `, ${conflicts} skipped for conflicts` : ''}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish template');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="page-header split-header">
        <div>
          <span className="eyebrow">PR-05</span>
          <h1>Slot Template Editor</h1>
          <p className="muted">Configure recurring slot rules and publish future capacity into the shared W2 scheduling inventory.</p>
        </div>
        <div className="header-actions">
          <Link href="/portal/calendar" className="btn btn-secondary">Back to calendar</Link>
          <button className="btn btn-secondary" onClick={saveTemplate} disabled={saving}>{saving ? 'Saving…' : 'Save Template'}</button>
          <button className="btn btn-primary" onClick={publishTemplate} disabled={saving || !selectedId}>{saving ? 'Working…' : 'Publish Template'}</button>
        </div>
      </section>

      <div className={`banner ${source === 'live' ? 'banner-success' : 'banner-warning'}`}>
        <div>
          <strong>{source === 'live' ? 'Scheduling templates are connected to the live provider API.' : 'Using fallback template context.'}</strong>
          <p className="muted small">
            {source === 'live'
              ? `Template decisions are being reviewed by ${providerName}, and saved templates come from the provider scheduling workspace.`
              : `Template editing fell back to starter content because the provider scheduling API could not be loaded: ${error ?? 'Unknown error'}.`}
          </p>
        </div>
        <span className={`status-chip status-${source === 'live' ? 'success' : 'warning'}`}>{source === 'live' ? 'Live templates' : 'Fallback'}</span>
      </div>

      {message ? <div className="status-chip status-success">{message}</div> : null}
      {error && source === 'live' ? <div className="status-chip status-danger">{error}</div> : null}

      <section className="content-grid two-col top-align-grid">
        <article className="panel-card">
          <div className="panel-header">
            <h2>Saved templates</h2>
            <span className="status-chip status-info">{templates.length || 1} visible</span>
          </div>
          <div className="list-stack">
            {(templates.length ? templates : [{ id: 'fallback-template', templateName: fallback.templateName, service: fallback.service, location: fallback.location, status: 'DRAFT' }]).map((item) => (
              <button key={item.id} type="button" className="list-row top-align-row" onClick={() => applyTemplate(item)} style={{ textAlign: 'left', background: 'transparent', border: 0, cursor: 'pointer' }}>
                <div>
                  <strong>{item.templateName}</strong>
                  <p className="muted small">{item.service} • {item.location}</p>
                </div>
                <span className="status-chip status-info">{String(item.status ?? 'DRAFT').replaceAll('_', ' ')}</span>
              </button>
            ))}
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-header">
            <h2>Template configuration</h2>
            <span className="status-chip status-info">{selectedId ? 'Existing' : 'New'}</span>
          </div>
          <form className="form-stack" onSubmit={(event) => event.preventDefault()}>
            <label className="field">
              <span>Template name</span>
              <input value={templateName} onChange={(event) => setTemplateName(event.target.value)} />
            </label>
            <div className="content-grid two-col compact-grid">
              <label className="field">
                <span>Slot duration</span>
                <select value={duration} onChange={(event) => setDuration(event.target.value)}>
                  <option>15 minutes</option>
                  <option>20 minutes</option>
                  <option>30 minutes</option>
                  <option>45 minutes</option>
                </select>
              </label>
              <label className="field">
                <span>Buffer time</span>
                <select value={buffer} onChange={(event) => setBuffer(event.target.value)}>
                  <option>0 minutes</option>
                  <option>5 minutes</option>
                  <option>10 minutes</option>
                  <option>15 minutes</option>
                </select>
              </label>
            </div>
            <div className="content-grid two-col compact-grid">
              <label className="field">
                <span>Daily capacity</span>
                <input type="number" value={capacity} onChange={(event) => setCapacity(event.target.value)} />
              </label>
              <label className="field">
                <span>Service</span>
                <select value={service} onChange={(event) => setService(event.target.value)}>
                  {serviceOptions.map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
            </div>
            <label className="field">
              <span>Facility</span>
              <select value={facility} onChange={(event) => setFacility(event.target.value)}>
                {facilityOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
          </form>
        </article>
      </section>

      <section className="content-grid two-col top-align-grid">
        <article className="panel-card">
          <div className="panel-header"><h2>Recurring pattern</h2><span className="status-chip status-warning">Future slots only</span></div>
          <div className="checklist-stack">
            {fallback.pattern.map((item) => (
              <label key={item.day} className="checkbox-row spread-row"><span>{item.day}</span><span className="muted small">{item.hours}</span></label>
            ))}
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-header"><h2>Current state</h2></div>
          <div className="detail-list">
            <div><span className="detail-label">Persistence</span><strong>{source === 'live' ? 'Provider scheduling API' : 'Starter fallback'}</strong></div>
            <div><span className="detail-label">Selected template</span><strong>{templateName}</strong></div>
            <div><span className="detail-label">Best next action</span><strong>{selectedId ? 'Publish when future capacity is ready' : 'Save a first template draft'}</strong></div>
          </div>
        </article>
      </section>
    </div>
  );
}
