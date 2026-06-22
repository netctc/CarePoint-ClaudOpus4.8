'use client';

import { useEffect, useMemo, useState } from 'react';
import { PortalShell } from '@/components/layout/portal-shell';
import { adminApi } from '@/lib/api-client';

type Grant = {
  id: string;
  sourceFacilityName: string;
  targetFacilityName: string;
  scope: 'LIMITED' | 'FULL';
  domains: string[];
  status: 'ACTIVE' | 'REVOKED';
  note?: string | null;
  updatedAt: string;
};

type Facility = { id: string; name: string; city?: string; kind?: string };

type Workspace = {
  facilities: Facility[];
  grants: Grant[];
  canManage: boolean;
  summary?: {
    accountModelLabel?: string;
    accessScopeLabel?: string;
    consentGrantsCount?: number;
    summaryText?: string;
  };
};

const defaultDomains = ['PATIENT_DEMOGRAPHICS', 'APPOINTMENTS', 'CLINICAL_NOTES', 'LAB_RESULTS'];

export default function HspConsentAccessPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [status, setStatus] = useState<'ALL' | 'ACTIVE' | 'REVOKED'>('ALL');
  const [sourceFacilityId, setSourceFacilityId] = useState('');
  const [targetFacilityId, setTargetFacilityId] = useState('');
  const [scope, setScope] = useState<'LIMITED' | 'FULL'>('LIMITED');
  const [domainsText, setDomainsText] = useState(defaultDomains.join(', '));
  const [note, setNote] = useState('Inter-center consent for shared care coordination.');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load(currentStatus: 'ALL' | 'ACTIVE' | 'REVOKED' = status) {
    setLoading(true);
    setMessage(null);
    try {
      const response = await adminApi.hspConsentGrants(currentStatus) as { item: Workspace };
      setWorkspace(response.item);
      if (!sourceFacilityId && response.item.facilities.length > 0) {
        setSourceFacilityId(response.item.facilities[0].id);
      }
      if (!targetFacilityId && response.item.facilities.length > 1) {
        setTargetFacilityId(response.item.facilities[1].id);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load HSP consent grants.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(status); }, [status]);

  const sourceOptions = workspace?.facilities ?? [];
  const targetOptions = useMemo(() => sourceOptions.filter((item) => item.id !== sourceFacilityId), [sourceOptions, sourceFacilityId]);

  async function createGrant() {
    setSaving(true);
    setMessage(null);
    try {
      await adminApi.createHspConsentGrant({
        sourceFacilityId,
        targetFacilityId,
        scope,
        domains: domainsText.split(',').map((item) => item.trim()).filter(Boolean),
        note,
      });
      setMessage('HSP consent grant saved. Refreshing live data.');
      await load(status);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save the HSP consent grant.');
    } finally {
      setSaving(false);
    }
  }

  async function revokeGrant(grantId: string) {
    setSaving(true);
    setMessage(null);
    try {
      await adminApi.revokeHspConsentGrant(grantId, { note: 'Revoked from admin governance console.' });
      setMessage('Consent grant revoked. Refreshing live data.');
      await load(status);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to revoke the HSP consent grant.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PortalShell currentPath="/portal/access/hsp-consents">
      <div className="hero-panel">
        <div className="hero-panel-grid">
          <div className="hero-copy">
            <div className="page-eyebrow">A-17 · HSP consent governance</div>
            <h2 className="hero-title">Organization-level inter-center consent control</h2>
            <p className="hero-subtitle">Capture explicit cross-facility consent grants so organization-based HSP access matches the policy definition instead of relying on inferred defaults.</p>
            <div className="hero-metrics">
              <div className="hero-metric">
                <div className="hero-metric-label">Facilities</div>
                <div className="hero-metric-value">{workspace?.facilities.length ?? 0}</div>
                <div className="hero-metric-detail">Linked facilities in the active organization</div>
              </div>
              <div className="hero-metric">
                <div className="hero-metric-label">Grants</div>
                <div className="hero-metric-value">{workspace?.grants.length ?? 0}</div>
                <div className="hero-metric-detail">Consent grants returned by the live API</div>
              </div>
              <div className="hero-metric">
                <div className="hero-metric-label">Access model</div>
                <div className="hero-metric-value">{workspace?.summary?.accountModelLabel ?? '—'}</div>
                <div className="hero-metric-detail">Current HSP account model summary</div>
              </div>
            </div>
          </div>
          <div className="soft-card">
            <h3 className="section-title" style={{ marginBottom: 8 }}>Policy summary</h3>
            <div className="detail-list">
              <div><span className="detail-label">Access scope</span><strong>{workspace?.summary?.accessScopeLabel ?? '—'}</strong></div>
              <div><span className="detail-label">Active grants</span><strong>{workspace?.summary?.consentGrantsCount ?? 0}</strong></div>
            </div>
            <p className="muted" style={{ marginTop: 12 }}>{workspace?.summary?.summaryText ?? 'Loading HSP access summary…'}</p>
          </div>
        </div>
      </div>

      <div className="split-shell">
        <div className="info-stack">
          <div className="card">
            <div className="panel-header">
              <h3 className="section-title">Consent grants</h3>
              <select className="select" value={status} onChange={(event) => setStatus(event.target.value as 'ALL' | 'ACTIVE' | 'REVOKED')}>
                <option value="ALL">All</option>
                <option value="ACTIVE">Active only</option>
                <option value="REVOKED">Revoked only</option>
              </select>
            </div>
            {loading ? <p className="muted">Loading consent grants…</p> : null}
            {!loading && (workspace?.grants.length ?? 0) === 0 ? <p className="muted">No grants recorded yet.</p> : null}
            <div className="list-stack">
              {(workspace?.grants ?? []).map((grant) => (
                <div key={grant.id} className="list-row">
                  <div>
                    <div className="list-row-title">{grant.sourceFacilityName} → {grant.targetFacilityName}</div>
                    <div className="muted">{grant.scope} · {grant.domains.join(', ') || 'All approved domains'} · {new Date(grant.updatedAt).toLocaleString()}</div>
                    {grant.note ? <div className="muted small">{grant.note}</div> : null}
                  </div>
                  <div className="inline-actions" style={{ alignItems: 'center' }}>
                    <span className={`tag ${grant.status === 'ACTIVE' ? 'success' : ''}`}>{grant.status}</span>
                    {workspace?.canManage && grant.status === 'ACTIVE' ? (
                      <button className="button secondary" onClick={() => revokeGrant(grant.id)} disabled={saving}>Revoke</button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="info-stack">
          <div className="card">
            <h3 className="section-title">Create or update grant</h3>
            <p className="muted">Record the explicit consent path between two facilities in the same organization.</p>
            <label className="label" style={{ marginTop: 12 }}>
              Source facility
              <select className="select" value={sourceFacilityId} onChange={(event) => setSourceFacilityId(event.target.value)} disabled={saving}>
                {sourceOptions.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}
              </select>
            </label>
            <label className="label" style={{ marginTop: 12 }}>
              Target facility
              <select className="select" value={targetFacilityId} onChange={(event) => setTargetFacilityId(event.target.value)} disabled={saving}>
                {targetOptions.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}
              </select>
            </label>
            <label className="label" style={{ marginTop: 12 }}>
              Consent scope
              <select className="select" value={scope} onChange={(event) => setScope(event.target.value as 'LIMITED' | 'FULL')} disabled={saving}>
                <option value="LIMITED">LIMITED</option>
                <option value="FULL">FULL</option>
              </select>
            </label>
            <label className="label" style={{ marginTop: 12 }}>
              Approved domains
              <input className="input" value={domainsText} onChange={(event) => setDomainsText(event.target.value)} disabled={saving} />
            </label>
            <label className="label" style={{ marginTop: 12 }}>
              Governance note
              <textarea className="textarea" value={note} onChange={(event) => setNote(event.target.value)} disabled={saving} />
            </label>
            <div className="inline-actions" style={{ marginTop: 16 }}>
              <button className="button primary" onClick={createGrant} disabled={saving || !sourceFacilityId || !targetFacilityId}>Save grant</button>
            </div>
            {message ? <div className="banner info" style={{ marginTop: 16 }}>{message}</div> : null}
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
