'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { providerApi } from '@/services/api-client';
import { getOnboardingData } from '@/services/mock-api';

export default function OnboardingPage() {
  const fallback = useMemo(() => getOnboardingData(), []);
  const [providerLabel, setProviderLabel] = useState('Provider review');
  const [orgName, setOrgName] = useState(fallback.orgName);
  const [hspModel, setHspModel] = useState<'INDIVIDUAL' | 'INSTITUTIONAL' | 'ORGANIZATION_BASED'>('INSTITUTIONAL');
  const [primaryFacility, setPrimaryFacility] = useState(fallback.primaryFacility);
  const [licenseNumber, setLicenseNumber] = useState(fallback.licenseNumber);
  const [crossFacilityAccess, setCrossFacilityAccess] = useState<'NONE' | 'LIMITED' | 'FULL'>('NONE');
  const [facilityAccessNote, setFacilityAccessNote] = useState('');
  const [payoutAccount, setPayoutAccount] = useState('');
  const [checklist, setChecklist] = useState(fallback.checklist);
  const [attestations, setAttestations] = useState({
    telehealthAgreement: true,
    privacyAgreement: true,
    payoutOwnership: false,
  });
  const [statusLabel, setStatusLabel] = useState('Draft');
  const [source, setSource] = useState<'live' | 'fallback'>('fallback');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [meResult, onboardingResult]: any = await Promise.all([providerApi.me(), providerApi.providerOnboarding()]);
      const user = meResult?.user ?? meResult;
      const item = onboardingResult?.item ?? {};
      setProviderLabel(user?.name ?? user?.fullName ?? user?.email ?? 'Signed-in provider');
      setOrgName(String(item.orgName ?? fallback.orgName));
      setHspModel(String(item.hspModel ?? 'INSTITUTIONAL') as 'INDIVIDUAL' | 'INSTITUTIONAL' | 'ORGANIZATION_BASED');
      setPrimaryFacility(String(item.primaryFacility ?? fallback.primaryFacility));
      setCrossFacilityAccess(String(item.crossFacilityAccess ?? 'NONE') as 'NONE' | 'LIMITED' | 'FULL');
      setFacilityAccessNote(String(item.facilityAccessNote ?? ''));
      setLicenseNumber(String(item.licenseNumber ?? fallback.licenseNumber));
      setPayoutAccount(String(item.payoutAccount ?? ''));
      setChecklist(Array.isArray(item.checklist) && item.checklist.length ? item.checklist : fallback.checklist);
      setAttestations({
        telehealthAgreement: Boolean(item.attestations?.telehealthAgreement),
        privacyAgreement: Boolean(item.attestations?.privacyAgreement),
        payoutOwnership: Boolean(item.attestations?.payoutOwnership),
      });
      setStatusLabel(String(item.status ?? 'DRAFT').replaceAll('_', ' '));
      setSource('live');
    } catch (err) {
      setSource('fallback');
      setError(err instanceof Error ? err.message : 'Unable to load onboarding context');
    }
  }, [fallback]);

  useEffect(() => {
    load();
  }, [load]);

  function body() {
    return {
      orgName,
      hspModel,
      primaryFacility,
      crossFacilityAccess,
      facilityAccessNote,
      licenseNumber,
      payoutAccount,
      checklist,
      attestations,
    };
  }

  async function saveDraft() {
    setSaving(true);
    setMessage(null);
    try {
      const result: any = await providerApi.saveProviderOnboarding(body());
      setStatusLabel(String(result?.item?.status ?? 'DRAFT').replaceAll('_', ' '));
      setSource('live');
      setMessage('Onboarding draft saved to the live API.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save onboarding draft');
    } finally {
      setSaving(false);
    }
  }

  async function submitOnboarding() {
    setSaving(true);
    setMessage(null);
    try {
      const result: any = await providerApi.submitProviderOnboarding(body());
      setStatusLabel(String(result?.item?.status ?? 'READY_FOR_REVIEW').replaceAll('_', ' '));
      setSource('live');
      setMessage('Onboarding package submitted for admin review.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit onboarding package');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card wide-card">
        <div>
          <span className="eyebrow">PR-02</span>
          <h1>Onboarding &amp; Verification</h1>
          <p className="muted">Complete organization verification, license and payout review, and agreement confirmations before final approval.</p>
        </div>

        <div className={`banner ${source === 'live' ? 'banner-success' : 'banner-warning'}`}>
          <div>
            <strong>{source === 'live' ? 'Onboarding is connected to the live provider API.' : 'Using fallback onboarding checklist.'}</strong>
            <p className="muted small">
              {source === 'live'
                ? `Current onboarding review is being completed by ${providerLabel}. The current live status is ${statusLabel}.`
                : `The provider onboarding API could not be loaded: ${error ?? 'Unknown error'}.`}
            </p>
          </div>
          <span className={`status-chip status-${source === 'live' ? 'success' : 'warning'}`}>{source === 'live' ? statusLabel : 'Fallback'}</span>
        </div>

        {message ? <div className="status-chip status-success">{message}</div> : null}
        {error && source === 'live' ? <div className="status-chip status-danger">{error}</div> : null}

        <div className="content-grid two-col">
          <article className="panel-card compact-panel">
            <div className="panel-header">
              <h2>Verification checklist</h2>
              <span className="status-chip status-info">{statusLabel}</span>
            </div>
            <div className="list-stack">
              {checklist.map((item) => (
                <div key={item.label} className="list-row">
                  <div>
                    <strong>{item.label}</strong>
                    <p className="muted small">{item.detail}</p>
                  </div>
                  <span className={`status-chip status-${item.variant}`}>{item.status}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel-card compact-panel">
            <div className="panel-header">
              <h2>Organization setup</h2>
              <span className="status-chip status-info">Live form</span>
            </div>
            <form className="form-stack" onSubmit={(event) => event.preventDefault()}>
              <label className="field">
                <span>HSP account model</span>
                <select value={hspModel} onChange={(event) => setHspModel(event.target.value as 'INDIVIDUAL' | 'INSTITUTIONAL' | 'ORGANIZATION_BASED')}>
                  <option value="INDIVIDUAL">Individual HSP</option>
                  <option value="INSTITUTIONAL">Institutional HSP</option>
                  <option value="ORGANIZATION_BASED">Organization-based HSP</option>
                </select>
              </label>
              <label className="field">
                <span>Organization name</span>
                <input type="text" value={orgName} onChange={(event) => setOrgName(event.target.value)} />
              </label>
              <label className="field">
                <span>Primary facility</span>
                <input type="text" value={primaryFacility} onChange={(event) => setPrimaryFacility(event.target.value)} />
              </label>
              <label className="field">
                <span>Cross-facility access</span>
                <select value={crossFacilityAccess} onChange={(event) => setCrossFacilityAccess(event.target.value as 'NONE' | 'LIMITED' | 'FULL')}>
                  <option value="NONE">No external facility access</option>
                  <option value="LIMITED">Limited access by explicit consent</option>
                  <option value="FULL">Full access by explicit consent</option>
                </select>
              </label>
              <label className="field">
                <span>Facility access note</span>
                <input type="text" value={facilityAccessNote} onChange={(event) => setFacilityAccessNote(event.target.value)} placeholder="Describe consent limits between centers" />
              </label>
              <label className="field">
                <span>License number</span>
                <input type="text" value={licenseNumber} onChange={(event) => setLicenseNumber(event.target.value)} />
              </label>
              <label className="field">
                <span>Bank payout account</span>
                <input type="text" value={payoutAccount} onChange={(event) => setPayoutAccount(event.target.value)} placeholder="Enter payout account reference" />
              </label>
            </form>
          </article>
        </div>

        <section className="panel-card compact-panel">
          <div className="panel-header">
            <h2>Agreement confirmations</h2>
            <span className="status-chip status-info">Provider attestations</span>
          </div>
          <div className="checklist-stack">
            <label className="checkbox-row"><input type="checkbox" checked={attestations.telehealthAgreement} onChange={(event) => setAttestations((current) => ({ ...current, telehealthAgreement: event.target.checked }))} /> <span>Telehealth provider agreement acknowledged</span></label>
            <label className="checkbox-row"><input type="checkbox" checked={attestations.privacyAgreement} onChange={(event) => setAttestations((current) => ({ ...current, privacyAgreement: event.target.checked }))} /> <span>Data processing and privacy obligations accepted</span></label>
            <label className="checkbox-row"><input type="checkbox" checked={attestations.payoutOwnership} onChange={(event) => setAttestations((current) => ({ ...current, payoutOwnership: event.target.checked }))} /> <span>Bank payout ownership confirmation provided</span></label>
          </div>
          <div className="action-row wrap-row top-space">
            <button type="button" className="btn btn-secondary" onClick={saveDraft} disabled={saving}>{saving ? 'Saving…' : 'Save Draft'}</button>
            <button type="button" className="btn btn-primary" onClick={submitOnboarding} disabled={saving}>{saving ? 'Submitting…' : 'Submit Onboarding'}</button>
            <Link href="/portal/dashboard" className="text-link">Open provider portal</Link>
          </div>
        </section>
      </section>
    </main>
  );
}
