'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { providerApi } from '@/services/api-client';

type Facility = { id: string; name: string; city?: string; kind?: string };

type HspSummary = {
  accountModelLabel?: string;
  accessScopeLabel?: string;
  consentScopeLabel?: string;
  summaryText?: string;
  primaryFacility?: Facility | null;
  consentedFacilities?: Facility[];
  restrictions?: string[];
  consentGrantsCount?: number;
  grantedDomains?: string[];
  enforcementStatusByDomain?: Record<string, string>;
};

type ConsentGrant = {
  id: string;
  sourceFacilityName: string;
  targetFacilityName: string;
  scope: string;
  domains: string[];
  status: string;
  updatedAt: string;
  note?: string | null;
};

export default function ProviderSettingsAccessPage() {
  const [summary, setSummary] = useState<HspSummary | null>(null);
  const [grants, setGrants] = useState<ConsentGrant[]>([]);
  const [status, setStatus] = useState<'ALL' | 'ACTIVE' | 'REVOKED'>('ALL');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setMessage(null);
      try {
        const [summaryResponse, grantsResponse] = await Promise.all([
          providerApi.providerHspAccess() as Promise<{ item: HspSummary }>,
          providerApi.providerHspConsentGrants(status) as Promise<{ item: { grants: ConsentGrant[] } }>,
        ]);
        if (!active) return;
        setSummary(summaryResponse.item);
        setGrants(grantsResponse.item.grants ?? []);
      } catch (error) {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : 'Unable to load HSP access.');
      }
    }
    void load();
    return () => { active = false; };
  }, [status]);

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <span className="eyebrow">PR-24A</span>
          <h1>HSP access model</h1>
          <p className="muted">This workspace shows whether the logged-in provider operates as an individual, institutional, or organization-based HSP and which cross-center consent grants are active.</p>
        </div>
        <div className="inline-actions">
          <Link href="/portal/settings" className="btn btn-secondary">Back to settings</Link>
        </div>
      </section>

      {message ? <div className="banner warning">{message}</div> : null}

      <section className="workspace-grid top-align-grid">
        <article className="panel-card">
          <div className="panel-header"><h2>Access summary</h2></div>
          <div className="detail-list">
            <div><span className="detail-label">Account model</span><strong>{summary?.accountModelLabel ?? '—'}</strong></div>
            <div><span className="detail-label">Access scope</span><strong>{summary?.accessScopeLabel ?? '—'}</strong></div>
            <div><span className="detail-label">Consent scope</span><strong>{summary?.consentScopeLabel ?? '—'}</strong></div>
            <div><span className="detail-label">Primary facility</span><strong>{summary?.primaryFacility?.name ?? '—'}</strong></div>
            <div><span className="detail-label">Active grants</span><strong>{summary?.consentGrantsCount ?? 0}</strong></div>
            <div><span className="detail-label">Granted domains</span><strong>{(summary?.grantedDomains ?? []).join(', ') || 'Primary-facility only'}</strong></div>
          </div>
          <p className="muted" style={{ marginTop: 16 }}>{summary?.summaryText ?? 'Loading summary…'}</p>
          <div className="banner info" style={{ marginTop: 16 }}>
            API enforcement is active for calendar, labs, analytics, prescriptions, orders, and RPM. Cross-center access only works when the requested facility is allowed and the required data domain is granted.
          </div>
          <div style={{ marginTop: 16 }}>
            <div className="detail-label">Domain enforcement</div>
            <div className="list-stack" style={{ marginTop: 8 }}>
              {Object.entries(summary?.enforcementStatusByDomain ?? {}).map(([domain, status]) => (
                <div key={domain} className="list-row">
                  <div className="list-row-title">{domain}</div>
                  <span className={`tag ${status === 'GRANTED' ? 'success' : status === 'CONSENT_REQUIRED' ? 'warning' : ''}`}>{status}</span>
                </div>
              ))}
              {Object.keys(summary?.enforcementStatusByDomain ?? {}).length === 0 ? <div className="muted">No domain enforcement metadata reported.</div> : null}
            </div>
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-header"><h2>Restrictions and consented facilities</h2></div>
          <ul className="data-points muted">
            {(summary?.restrictions ?? []).map((item) => <li key={item}>{item}</li>)}
            {(summary?.restrictions ?? []).length === 0 ? <li>No additional restrictions reported.</li> : null}
          </ul>
          <div style={{ marginTop: 16 }}>
            <div className="detail-label">Consented facilities</div>
            <div className="list-stack" style={{ marginTop: 8 }}>
              {(summary?.consentedFacilities ?? []).map((facility) => (
                <div key={facility.id} className="list-row">
                  <div>
                    <div className="list-row-title">{facility.name}</div>
                    <div className="muted">{facility.city ?? '—'} · {facility.kind ?? 'Facility'}</div>
                  </div>
                </div>
              ))}
              {(summary?.consentedFacilities ?? []).length === 0 ? <div className="muted">No explicit cross-facility access is currently listed.</div> : null}
            </div>
          </div>
        </article>
      </section>

      <section className="panel-card">
        <div className="panel-header">
          <h2>Recorded consent grants</h2>
          <select className="select" value={status} onChange={(event) => setStatus(event.target.value as 'ALL' | 'ACTIVE' | 'REVOKED')}>
            <option value="ALL">All</option>
            <option value="ACTIVE">Active</option>
            <option value="REVOKED">Revoked</option>
          </select>
        </div>
        <div className="list-stack">
          {grants.map((grant) => (
            <div key={grant.id} className="list-row">
              <div>
                <div className="list-row-title">{grant.sourceFacilityName} → {grant.targetFacilityName}</div>
                <div className="muted">{grant.scope} · {grant.domains.join(', ') || 'All approved domains'} · {new Date(grant.updatedAt).toLocaleString()}</div>
                {grant.note ? <div className="muted small">{grant.note}</div> : null}
              </div>
              <span className={`tag ${grant.status === 'ACTIVE' ? 'success' : ''}`}>{grant.status}</span>
            </div>
          ))}
          {grants.length === 0 ? <div className="muted">No consent grants recorded for this organization.</div> : null}
        </div>
      </section>
    </div>
  );
}
