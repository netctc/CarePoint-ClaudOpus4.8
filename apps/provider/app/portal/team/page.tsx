'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { EvidencePanel } from '@/components/shared/evidence-panel';
import { WorkspaceStateStrip } from '@/components/shared/workspace-state-strip';
import { providerApi } from '@/services/api-client';
import { getTeamRolesData } from '@/services/mock-api';
import { useProviderLocale } from '@/components/i18n/provider-locale-provider';
import { getProviderPortalCopy } from '@/lib/i18n/provider-portal-copy';

const REASON_CODES = ['CROSS_COVERAGE', 'ON_CALL', 'ESCALATED_REVIEW', 'LAB_RELEASE_BACKUP', 'MEDICATION_RECONCILIATION', 'TEMPORARY_TEAM_ASSIGNMENT'];

export default function TeamRolesPage() {
  const { locale, dir } = useProviderLocale();
  const copy = getProviderPortalCopy(locale).team;
  const fallback = useMemo(() => getTeamRolesData(), []);
  const [summary, setSummary] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [source, setSource] = useState<'live' | 'fallback'>('fallback');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [patientId, setPatientId] = useState('');
  const [reasonCode, setReasonCode] = useState(REASON_CODES[0]);
  const [note, setNote] = useState(copy.coverageNoteDefault);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [summaryResult, membersResult, exceptionResult]: any = await Promise.all([
        providerApi.providerTeamSummary(),
        providerApi.providerTeamMembers(),
        providerApi.providerTeamChartAccessExceptions(),
      ]);
      setSummary(summaryResult.summary ?? null);
      setMembers(membersResult.items ?? []);
      setExceptions(exceptionResult.items ?? []);
      setSource('live');
    } catch (err) {
      setSummary(null);
      setMembers([]);
      setExceptions([]);
      setSource('fallback');
      setError(err instanceof Error ? err.message : copy.unableLoad);
    }
  }, [copy.unableLoad]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = source === 'live' && members.length ? members : fallback.members;

  async function requestException(event: FormEvent) {
    event.preventDefault();
    try {
      setMessage(null);
      await providerApi.requestProviderTeamChartAccessException({ patientId, reasonCode, note });
      setMessage(copy.requested);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableRequest);
    }
  }

  async function revokeException(exceptionId: string) {
    try {
      setMessage(null);
      await providerApi.revokeProviderTeamChartAccessException(exceptionId, copy.coverageNoLongerRequired);
      setMessage(copy.revoked);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableRevoke);
    }
  }

  return (
    <div className="page-stack" dir={dir}>
      <section className="page-header split-header">
        <div>
          <span className="eyebrow">PR-23</span>
          <h1>{copy.title}</h1>
          <p className="muted">{copy.subtitle}</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={load}>{copy.refresh}</button>
        </div>
      </section>

      <div className={`banner ${source === 'live' ? 'banner-success' : 'banner-warning'}`}>
        <div>
          <strong>{source === 'live' ? copy.liveTitle : copy.fallbackTitle}</strong>
          <p className="muted small">{source === 'live' ? copy.liveText : `${copy.fallbackText} ${error ?? 'Unknown error'}.`}</p>
        </div>
        <span className={`status-chip status-${source === 'live' ? 'success' : 'warning'}`}>{source === 'live' ? 'Live' : 'Fallback'}</span>
      </div>

      {message ? <div className="status-chip status-success">{message}</div> : null}
      {error && source === 'live' ? <div className="status-chip status-danger">{error}</div> : null}

      <WorkspaceStateStrip
        items={[
          { label: copy.teamTotal, value: String(summary?.total ?? rows.length), tone: 'info' },
          { label: copy.providers, value: String(summary?.providers ?? rows.filter((item) => String(item.role).includes('Provider')).length), tone: 'success' },
          { label: copy.nurses, value: String(summary?.nurses ?? rows.filter((item) => String(item.role).includes('Nurse')).length), tone: 'info' },
          { label: copy.activeAccess, value: String(summary?.chartAccessExceptions ?? exceptions.length), tone: exceptions.length ? 'warning' : 'success' },
        ]}
      />

      <section className="workspace-grid top-align-grid">
        <article className="panel-card">
          <div className="panel-header"><h2>{copy.temporaryAccess}</h2></div>
          <form className="form-stack" onSubmit={requestException}>
            <label className="field"><span>{copy.patientId}</span><input value={patientId} onChange={(event) => setPatientId(event.target.value)} placeholder={copy.patientIdPlaceholder} /></label>
            <label className="field"><span>{copy.reasonCode}</span><select value={reasonCode} onChange={(event) => setReasonCode(event.target.value)}>{REASON_CODES.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select></label>
            <label className="field"><span>{copy.operationalNote}</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} /></label>
            <button className="btn btn-primary" type="submit" disabled={source !== 'live' || !patientId.trim()}>{copy.requestException}</button>
          </form>
        </article>

        <div className="workspace-side-stack">
          <EvidencePanel
            title={copy.coverageGuidance}
            badge={copy.teamGovernance}
            items={[
              { title: copy.leastPrivilege, detail: copy.leastPrivilegeText },
              { title: copy.ownership, detail: copy.ownershipText },
              { title: copy.crossCoverage, detail: copy.crossCoverageText },
            ]}
          />
          <article className="panel-card">
            <div className="panel-header"><h2>{copy.activeExceptions}</h2><span className="status-chip status-info">{exceptions.length}</span></div>
            <div className="list-stack">
              {exceptions.slice(0, 6).map((item) => (
                <div key={item.id} className="list-row top-align-row">
                  <div>
                    <strong>{String(item.reasonCode ?? '').replaceAll('_', ' ')}</strong>
                    <p className="muted small">{copy.patientPrefix} {item.patientId} • {copy.providerPrefix} {item.providerId}</p>
                    <p className="muted small">{item.note ?? copy.noNote}</p>
                  </div>
                  <button className="btn btn-secondary" onClick={() => revokeException(String(item.id))}>{copy.revoke}</button>
                </div>
              ))}
              {!exceptions.length ? <p className="muted">{copy.noExceptions}</p> : null}
            </div>
          </article>
        </div>
      </section>

      <section className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>{copy.user}</th>
              <th>{copy.role}</th>
              <th>{copy.facility}</th>
              <th>{copy.mfa}</th>
              <th>{copy.status}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((member) => (
              <tr key={member.id}>
                <td><strong>{member.name}</strong></td>
                <td>{member.role}</td>
                <td>{member.facility}</td>
                <td>{member.mfaStatus}</td>
                <td><span className={`status-chip status-${member.variant}`}>{member.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
