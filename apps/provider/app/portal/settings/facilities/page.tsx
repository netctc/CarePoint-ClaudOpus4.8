'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { EvidencePanel } from '@/components/shared/evidence-panel';
import { WorkspaceStateStrip } from '@/components/shared/workspace-state-strip';
import { getFacilitySettingsData } from '@/services/mock-api';
import { providerApi } from '@/services/api-client';

export default function FacilityServicesSettingsPage() {
  const fallback = useMemo(() => getFacilitySettingsData(), []);
  const [summary, setSummary] = useState<any>(null);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [source, setSource] = useState<'live' | 'fallback'>('fallback');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const applyFacility = useCallback((item: any | null) => {
    setSelectedId(item?.id ?? null);
    setSelected(item ?? null);
  }, []);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [summaryResult, facilitiesResult]: any = await Promise.all([
        providerApi.providerSettingsSummary(),
        providerApi.providerSettingsFacilities(),
      ]);
      const items = facilitiesResult.items ?? [];
      setSummary(summaryResult.summary ?? null);
      setFacilities(items);
      applyFacility(items[0] ?? null);
      setSource('live');
    } catch (err) {
      setSummary(null);
      setFacilities([]);
      applyFacility(null);
      setSource('fallback');
      setError(err instanceof Error ? err.message : 'Unable to load provider settings');
    }
  }, [applyFacility]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveFacility() {
    if (!selectedId || !selected) return;
    try {
      await providerApi.updateProviderSettingsFacility(selectedId, selected);
      setMessage('Facility settings saved through the live provider API.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save facility settings');
    }
  }

  const visibleFacilities = source === 'live' && facilities.length ? facilities : fallback.facilities;
  const current = source === 'live' && selected ? selected : fallback.facilities[0];

  return (
    <div className="page-stack">
      <section className="page-header split-header">
        <div>
          <span className="eyebrow">PR-24</span>
          <h1>Facility &amp; Services Settings</h1>
          <p className="muted">Maintain locations, service modes, publishing readiness, and provider-facing pricing visibility.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={load}>Refresh</button>
          <button className="btn btn-primary" onClick={saveFacility} disabled={source !== 'live' || !selectedId}>Save changes</button>
        </div>
      </section>

      <div className={`banner ${source === 'live' ? 'banner-success' : 'banner-warning'}`}>
        <div>
          <strong>{source === 'live' ? 'Provider settings are connected to the live API.' : 'Showing starter facility settings.'}</strong>
          <p className="muted small">{source === 'live' ? 'Facility inventory and update actions use provider settings endpoints.' : `The provider settings API could not be loaded: ${error ?? 'Unknown error'}.`}</p>
        </div>
        <span className={`status-chip status-${source === 'live' ? 'success' : 'warning'}`}>{source === 'live' ? 'Live' : 'Fallback'}</span>
      </div>

      {message ? <div className="status-chip status-success">{message}</div> : null}
      {error && source === 'live' ? <div className="status-chip status-danger">{error}</div> : null}

      <WorkspaceStateStrip
        items={[
          { label: 'Facilities', value: String(summary?.total ?? visibleFacilities.length), tone: 'info' },
          { label: 'Published modes', value: String(current?.serviceModes?.length ?? 0), tone: 'success' },
          { label: 'Pricing rows', value: String((current?.serviceMatrix ?? fallback.serviceMatrix).length), tone: 'info' },
          { label: 'Source', value: source === 'live' ? 'Provider API' : 'Fallback', tone: source === 'live' ? 'success' : 'warning' },
        ]}
      />

      <section className="workspace-grid top-align-grid">
        <article className="panel-card">
          <div className="panel-header"><h2>Facilities</h2><span className="status-chip status-info">{visibleFacilities.length} locations</span></div>
          <div className="list-stack">
            {visibleFacilities.map((facility) => (
              <button key={facility.id} type="button" className="list-row top-align-row" onClick={() => applyFacility(facility)} style={{ textAlign: 'left', background: 'transparent', border: 0, cursor: 'pointer' }}>
                <div>
                  <strong>{facility.name}</strong>
                  <p className="muted small">{facility.address}</p>
                  <p className="muted small">Modes: {(facility.serviceModes ?? []).join(', ')}</p>
                </div>
                <span className={`status-chip status-${facility.variant ?? 'info'}`}>{facility.publishStatus}</span>
              </button>
            ))}
          </div>
        </article>

        <div className="workspace-side-stack">
          <article className="panel-card">
            <div className="panel-header"><h2>Selected facility</h2><span className="status-chip status-info">{current?.name ?? 'None selected'}</span></div>
            {current ? (
              <form className="form-stack" onSubmit={(event) => event.preventDefault()}>
                <label className="field"><span>Name</span><input value={current.name} onChange={(event) => setSelected((item: any) => ({ ...item, name: event.target.value }))} /></label>
                <label className="field"><span>Address</span><input value={current.address} onChange={(event) => setSelected((item: any) => ({ ...item, address: event.target.value }))} /></label>
                <label className="field"><span>Publish status</span><input value={current.publishStatus} onChange={(event) => setSelected((item: any) => ({ ...item, publishStatus: event.target.value }))} /></label>
              </form>
            ) : <p className="muted">Select a facility to edit its settings.</p>}
          </article>
          <EvidencePanel
            title="Publishing guidance"
            badge="Settings"
            items={[
              { title: 'Service visibility', detail: 'Only publish facilities whose modes, pricing, and staffing are ready for booking.' },
              { title: 'Pricing alignment', detail: 'Use the pricing matrix below to confirm provider-facing pricing visibility and effective dates.' },
              { title: 'Operational dependency', detail: 'Coordinate settings changes with team coverage and analytics when utilization shifts.' },
            ]}
          />
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-header"><h2>Pricing matrix</h2><span className="status-chip status-warning">Effective date required</span></div>
        <div className="list-stack">
          {(current?.serviceMatrix ?? fallback.serviceMatrix).map((service: any, index: number) => (
            <div key={`${service.service}-${service.channel}-${index}`} className="list-row">
              <div>
                <strong>{service.service}</strong>
                <p className="muted small">{service.channel} • Effective {service.effectiveDate}</p>
              </div>
              <span className="status-chip status-info">{service.price}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
