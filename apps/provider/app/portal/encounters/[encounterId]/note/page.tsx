'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { providerApi } from '@/services/api-client';
import { appendProviderSubjectParams } from '@/lib/subject-links';
import { getEncounterNoteDraft } from '@/services/mock-api';
import { ProviderIcon } from '@/components/shared/provider-icons';
import { useProviderLocale } from '@/components/i18n/provider-locale-provider';
import { getProviderPhase5Copy } from '@/lib/i18n/provider-phase5-copy';

function inferSoapFromRecord(record: any, copy: ReturnType<typeof getProviderPhase5Copy>['encounter']) {
  const notes = String(record?.content?.notes ?? '');
  return {
    subjective: notes || copy.subjectiveFallback,
    objective: copy.objectiveFallback,
    assessment: copy.assessmentFallback,
    plan: copy.planFallback,
  };
}

export default function EncounterNoteEditorPage() {
  const { locale, dir } = useProviderLocale();
  const copy = getProviderPhase5Copy(locale).encounter;
  const params = useParams<{ encounterId: string }>();
  const searchParams = useSearchParams();
  const encounterId = String(params.encounterId);
  const patientId = searchParams.get('patientId');
  const fallback = useMemo(() => getEncounterNoteDraft(encounterId), [encounterId]);

  const [appointment, setAppointment] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);
  const [source, setSource] = useState<'live' | 'hybrid'>('live');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<'draft' | 'signed' | null>(null);
  const [subjective, setSubjective] = useState(fallback?.soap.subjective ?? '');
  const [objective, setObjective] = useState(fallback?.soap.objective ?? '');
  const [assessment, setAssessment] = useState(fallback?.soap.assessment ?? '');
  const [plan, setPlan] = useState(fallback?.soap.plan ?? '');
  const [diagnosisCode, setDiagnosisCode] = useState('I10');
  const [signatureAttested, setSignatureAttested] = useState(false);
  const [validation, setValidation] = useState<any>(null);
  const [validating, setValidating] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [appointmentResult, recordResult, meResult] = await Promise.all([
        providerApi.appointment(encounterId) as Promise<any>,
        patientId ? (providerApi.records(patientId) as Promise<any>) : Promise.resolve({ items: [] }),
        providerApi.me() as Promise<any>,
      ]);
      setAppointment(appointmentResult);
      const items = recordResult.items ?? [];
      setRecords(items);
      setMe(meResult);
      setSource('live');
      if (!subjective && items[0]) {
        const soap = inferSoapFromRecord(items[0], copy);
        setSubjective(soap.subjective);
        setObjective(soap.objective);
        setAssessment(soap.assessment);
        setPlan(soap.plan);
      }
    } catch (err) {
      setSource('hybrid');
      setError(err instanceof Error ? err.message : copy.unableLoad);
    }
  }, [copy, encounterId, patientId, subjective]);

  useEffect(() => {
    load();
  }, [load]);

  async function runValidation() {
    if (!appointment?.patientId && !patientId) {
      setError(copy.patientContextRequired);
      return null;
    }
    setValidating(true);
    setError(null);
    try {
      const result: any = await providerApi.validateEncounterNote({
        patientId: appointment?.patientId ?? patientId,
        appointmentId: appointment?.id ?? encounterId,
        providerId: me?.providerProfile?.id ?? null,
        subjective,
        objective,
        assessment,
        plan,
        diagnosisCode,
        signatureAttested,
      });
      setValidation(result.validation ?? null);
      return result.validation ?? null;
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableValidate);
      return null;
    } finally {
      setValidating(false);
    }
  }

  async function persist(mode: 'draft' | 'signed', event?: FormEvent) {
    event?.preventDefault();
    if (!me?.providerProfile?.id) {
      setError(copy.liveSessionRequired);
      return;
    }

    if (mode === 'signed' && !signatureAttested) {
      setError(copy.signatureRequired);
      return;
    }

    setSaving(mode);
    setError(null);

    try {
      if (mode === 'signed') {
        const result: any = await providerApi.signEncounterNote({
          patientId: appointment?.patientId ?? patientId,
          appointmentId: appointment?.id ?? encounterId,
          subjective,
          objective,
          assessment,
          plan,
          diagnosisCode,
          signatureAttested,
        });
        setValidation(result.validation ?? null);
      } else {
        await providerApi.createRecord({
          patientId: appointment?.patientId ?? patientId,
          providerId: me.providerProfile.id,
          appointmentId: appointment?.id ?? encounterId,
          summary: {
            title: copy.draftTitle,
            type: 'encounter_note',
            signed: false,
            diagnosisCode,
          },
          content: {
            source: 'encounter-note-editor',
            subjective,
            objective,
            assessment,
            plan,
            diagnosisCode,
            signatureAttested: false,
          },
        });
        await runValidation();
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableSave);
    } finally {
      setSaving(null);
    }
  }

  const patientName = String(appointment?.subjectLabel ?? appointment?.patientName ?? fallback?.patientName ?? 'Patient');
  const quickTemplates = fallback?.templates ?? ['Normal physical exam', 'Medication counseling', 'Follow-up summary'];
  const chartHref = appendProviderSubjectParams(`/portal/chart/${appointment?.patientId ?? patientId ?? ''}`, appointment);
  const labsHref = appendProviderSubjectParams(`/portal/labs/inbox?patientId=${appointment?.patientId ?? patientId ?? ''}`, appointment);
  const ordersHref = appendProviderSubjectParams(`/portal/orders/new?patientId=${appointment?.patientId ?? patientId ?? ''}&appointmentId=${appointment?.id ?? encounterId}`, appointment);
  const prescriptionsHref = appendProviderSubjectParams(`/portal/prescriptions/new?patientId=${appointment?.patientId ?? patientId ?? ''}&appointmentId=${appointment?.id ?? encounterId}`, appointment);

  return (
    <div className="page-stack" dir={dir}>
      {source === 'hybrid' ? (
        <div className="banner banner-warning">
          <div>
            <strong>{copy.fallbackTitle}</strong>
            <p className="muted small">{copy.fallbackErrorPrefix} {error ?? 'Unknown error'}.</p>
          </div>
          <span className="status-chip status-warning">{copy.fallback}</span>
        </div>
      ) : null}
      {error && source === 'live' ? <div className="status-chip status-danger">{error}</div> : null}

      <section className="encounter-workspace">
        <aside className="encounter-patient-rail panel-card">
          <div className="profile-avatar-large">{patientName.split(' ').map((part: string) => part[0]).slice(0, 2).join('')}</div>
          <h2>{patientName}</h2>
          <p className="muted small">Encounter ID: {encounterId}</p>
          <nav className="encounter-rail-nav">
            <Link href="/portal/queue" className="encounter-rail-link">{copy.waitingRoom}</Link>
            <Link href={chartHref} className="encounter-rail-link">{copy.chartShell}</Link>
            <span className="encounter-rail-link encounter-rail-link-active">{copy.encounterNotes}</span>
            <Link href={labsHref} className="encounter-rail-link">{copy.labResults}</Link>
            <Link href={ordersHref} className="encounter-rail-link">{copy.orders}</Link>
          </nav>
          <Link href="/portal/telehealth" className="sidebar-cta encounter-cta">{copy.telehealthLink}</Link>
        </aside>

        <div className="encounter-main-column">
          <section className="page-header split-header">
            <div>
              <span className="eyebrow">PR-11</span>
              <h1>{copy.title}</h1>
              <p className="muted">{appointment?.service ?? fallback?.visitType ?? 'Routine follow-up'} • {validation?.ready ? copy.readyToSign : copy.inProgress}</p>
            </div>
            <div className="header-actions">
              <button className="btn btn-secondary" type="button" onClick={() => void runValidation()} disabled={validating}>{validating ? copy.validating : copy.runValidation}</button>
              <button className="btn btn-primary" type="button" disabled={saving !== null || source !== 'live'} onClick={() => void persist('signed')}>{saving === 'signed' ? copy.signing : copy.signFinalize}</button>
            </div>
          </section>

          <form className="form-stack" onSubmit={(event) => void persist('draft', event)}>
            <section className="soap-section-card soap-subjective">
              <div className="soap-card-header"><h3>{copy.subjective}</h3><span className="detail-label">{copy.quickText}</span></div>
              <textarea value={subjective} onChange={(event) => setSubjective(event.target.value)} />
            </section>

            <section className="soap-section-card soap-objective">
              <div className="soap-card-header"><h3>{copy.objective}</h3><div className="soap-inline-metrics"><span className="metric-pill">BP: 120/80</span><span className="metric-pill">Temp: 98.6°F</span><span className="metric-pill">HR: 72 bpm</span></div></div>
              <textarea value={objective} onChange={(event) => setObjective(event.target.value)} />
            </section>

            <section className="soap-section-card soap-assessment">
              <div className="soap-card-header"><h3>{copy.assessment}</h3></div>
              <input value={diagnosisCode} onChange={(event) => setDiagnosisCode(event.target.value)} placeholder={copy.diagnosisPlaceholder} />
              <textarea value={assessment} onChange={(event) => setAssessment(event.target.value)} />
            </section>

            <section className="soap-section-card soap-plan">
              <div className="soap-card-header"><h3>{copy.plan}</h3></div>
              <textarea value={plan} onChange={(event) => setPlan(event.target.value)} />
            </section>

            <label className="checkbox-panel">
              <input type="checkbox" checked={signatureAttested} onChange={(event) => setSignatureAttested(event.target.checked)} />
              <span>{copy.attest}</span>
            </label>

            <div className="action-row wrap-row">
              <button className="btn btn-secondary" type="submit" disabled={saving !== null}>{saving === 'draft' ? copy.savingDraft : copy.saveDraft}</button>
              <Link href={ordersHref} className="btn btn-secondary">{copy.orders}</Link>
              <Link href={prescriptionsHref} className="btn btn-secondary">{copy.prescription}</Link>
            </div>
          </form>
        </div>

        <aside className="encounter-right-rail">
          <article className="panel-card pale-card">
            <div className="panel-header"><h2>{copy.quickTemplates}</h2></div>
            <div className="list-stack compact-list">
              {quickTemplates.map((template: string) => (
                <div key={template} className="quick-template-card">
                  <strong>{template}</strong>
                  <p className="muted small">{copy.quickTemplateText}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="panel-card pale-card top-space">
            <div className="panel-header"><h2>{copy.patientAlerts}</h2></div>
            <div className="note-card alert-note danger-soft"><strong>{copy.allergyPenicillin}</strong><p className="muted small">{copy.allergyText}</p></div>
            <div className="note-card alert-note info-soft"><strong>{copy.medicationReconciliation}</strong><p className="muted small">{copy.medReconText}</p></div>
          </article>

          <article className="voice-assist-card top-space">
            <div className="voice-assist-icon"><ProviderIcon name="mic" width={24} height={24} /></div>
            <strong>{copy.voiceAssist}</strong>
            <p className="muted small">{copy.voiceAssistText}</p>
            <button className="dark-panel-button" type="button">{copy.startDictation}</button>
          </article>

          <article className="panel-card top-space">
            <div className="panel-header"><h2>{copy.validationSummary}</h2></div>
            <div className="list-stack compact-list">
              <div className="measurement-row"><span>{copy.sectionsCompleted}</span><strong>{validation ? `${validation.sectionsCompleted} of 4` : copy.pending}</strong></div>
              {(validation?.issues ?? []).map((issue: string) => <div key={issue} className="note-card"><strong>{copy.issue}</strong><p className="muted small">{issue}</p></div>)}
              {(validation?.warnings ?? []).map((warning: string) => <div key={warning} className="note-card"><strong>{copy.warning}</strong><p className="muted small">{warning}</p></div>)}
              {!validation ? <p className="muted small">{copy.runValidationHint}</p> : null}
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
}
