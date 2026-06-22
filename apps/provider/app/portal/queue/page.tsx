'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { WorkspaceStateStrip } from '@/components/shared/workspace-state-strip';
import { ProviderActionButton, ProviderGrid, ProviderKpiCard, ProviderPageHeader } from '@/components/design/provider-design';
import { providerApi } from '@/services/api-client';
import { appendProviderSubjectParams } from '@/lib/subject-links';
import { getQueueData } from '@/services/mock-api';
import { useProviderLocale } from '@/components/i18n/provider-locale-provider';
import { getProviderPortalCopy } from '@/lib/i18n/provider-portal-copy';

function formatDateTime(value: string, locale?: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale);
}

function statusVariant(status: string) {
  const normalized = status.toUpperCase();
  if (['CONFIRMED', 'COMPLETED', 'FULFILLED', 'APPROVED'].includes(normalized)) return 'success';
  if (['REQUESTED', 'WAITING', 'AUTHORIZED', 'ROUTED_TO_PHARMACY', 'ROUTED_TO_PROVIDER', 'MANUAL_REVIEW'].includes(normalized)) return 'warning';
  if (['CANCELLED', 'NO_SHOW', 'REJECTED'].includes(normalized)) return 'danger';
  return 'info';
}

function normalizeFallbackQueueItem(item: any) {
  return {
    id: item.id,
    startsAt: item.time,
    patientName: item.patientName,
    service: item.reason,
    location: item.visitType,
    status: item.status.toUpperCase().replaceAll(' ', '_'),
    payment: { status: item.paymentState?.toUpperCase() ?? 'UNPAID' },
  };
}

function titleize(value: string) {
  return value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatHistoryLabel(entry: any, fallbackLabel: string) {
  const parts = [entry.label ?? fallbackLabel];
  if (entry.queue) parts.push(String(entry.queue).replaceAll('_', ' '));
  if (entry.actorRole) parts.push(String(entry.actorRole));
  return parts.join(' • ');
}

export default function QueuePage() {
  const { locale, dir } = useProviderLocale();
  const copy = getProviderPortalCopy(locale).queue;
  const roleLabel = (role: string) => role === 'PHARMACIST' ? copy.pharmacist : role === 'PROVIDER' ? copy.provider : role === 'NURSE' ? copy.nurse : role;
  const severityLabel = (severity: string) => severity === 'LOW' ? copy.low : severity === 'MEDIUM' ? copy.medium : severity === 'HIGH' ? copy.high : severity === 'CRITICAL' ? copy.critical : severity;
  const [items, setItems] = useState<any[]>([]);
  const [source, setSource] = useState<'live' | 'fallback'>('live');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('ALL');
  const [query, setQuery] = useState('');
  const [subjectScope, setSubjectScope] = useState<'ALL' | 'SELF' | 'FAMILY'>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refillQueue, setRefillQueue] = useState<any[]>([]);
  const [refillSummary, setRefillSummary] = useState<any>(null);
  const [auditPacketSummary, setAuditPacketSummary] = useState<any>(null);
  const [refillRole, setRefillRole] = useState('PHARMACIST');
  const [refillAgingBand, setRefillAgingBand] = useState('ALL');
  const [refillControlledOnly, setRefillControlledOnly] = useState(false);
  const [assignRole, setAssignRole] = useState<'PROVIDER' | 'PHARMACIST' | 'NURSE'>('PHARMACIST');
  const [escalationSeverity, setEscalationSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [result, pharmacyResult, auditResult]: any = await Promise.all([
        providerApi.appointments(),
        providerApi.providerPharmacyQueue({
          assignedRole: refillRole,
          agingBand: refillAgingBand,
          controlledOnly: refillControlledOnly ? true : undefined,
        }),
        providerApi.providerAuditPacketSummary(50),
      ]);
      setItems(result.items ?? []);
      setRefillQueue(pharmacyResult.items ?? []);
      setRefillSummary(pharmacyResult.summary ?? null);
      setAuditPacketSummary(auditResult ?? null);
      setSource('live');
    } catch (err) {
      setItems(getQueueData().map(normalizeFallbackQueueItem));
      setRefillQueue([]);
      setRefillSummary(null);
      setAuditPacketSummary(null);
      setSource('fallback');
      setError(err instanceof Error ? err.message : copy.unableLoad);
    } finally {
      setLoading(false);
    }
  }, [refillRole, refillAgingBand, refillControlledOnly]);

  useEffect(() => {
    load();
  }, [load]);

  async function confirm(appointmentId: string) {
    setBusyId(appointmentId);
    try {
      await providerApi.confirmAppointment(appointmentId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableConfirm);
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(appointmentId: string) {
    setBusyId(appointmentId);
    try {
      await providerApi.cancelAppointment(appointmentId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableCancel);
    } finally {
      setBusyId(null);
    }
  }

  async function handleRefillAction(requestId: string, action: 'APPROVE' | 'REJECT' | 'ROUTE_TO_PHARMACY' | 'MARK_FULFILLED') {
    setBusyId(requestId);
    const suggested = action === 'APPROVE'
      ? copy.approvedNote
      : action === 'REJECT'
      ? copy.rejectedNote
      : action === 'ROUTE_TO_PHARMACY'
      ? copy.routedNote
      : copy.fulfilledNote;
    try {
      await providerApi.reviewProviderRefillRequest(requestId, {
        action,
        note: suggested,
        queue: action === 'ROUTE_TO_PHARMACY' ? 'PHARMACY_NETWORK' : undefined,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableUpdateRefill);
    } finally {
      setBusyId(null);
    }
  }

  async function handleRefillAssign(requestId: string) {
    setBusyId(requestId);
    try {
      await providerApi.assignProviderRefillRequest(requestId, {
        assignedRole: assignRole,
        ownerName: assignRole === 'PHARMACIST' ? copy.rolePharmacyOwner : assignRole === 'PROVIDER' ? copy.rolePrescribingProvider : copy.roleClinicalNurse,
        note: `${copy.ownershipTransferredPrefix} ${roleLabel(assignRole)} ${copy.ownershipTransferredSuffix}`,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableTransferRefill);
    } finally {
      setBusyId(null);
    }
  }

  async function handleRefillEscalate(requestId: string) {
    setBusyId(requestId);
    try {
      await providerApi.escalateProviderRefillRequest(requestId, {
        severity: escalationSeverity,
        reason: escalationSeverity === 'CRITICAL' ? copy.criticalEscalationReason : copy.standardEscalationReason,
        ownerRole: assignRole,
        note: `Escalated from the provider refill queue with ${escalationSeverity.toLowerCase()} severity.`,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableEscalateRefill);
    } finally {
      setBusyId(null);
    }
  }

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (status !== 'ALL' && String(item.status).toUpperCase() !== status) return false;
      if (subjectScope === 'SELF' && item.isFamilySubject) return false;
      if (subjectScope === 'FAMILY' && !item.isFamilySubject) return false;
      if (!query.trim()) return true;
      return [
        item.patientName ?? '',
        item.providerName ?? '',
        item.service ?? '',
        item.location ?? '',
        item.status ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(query.trim().toLowerCase());
    });
  }, [items, query, status, subjectScope]);

  const totals = useMemo(() => ({
    total: items.length,
    requested: items.filter((item) => String(item.status).toUpperCase() === 'REQUESTED').length,
    confirmed: items.filter((item) => String(item.status).toUpperCase() === 'CONFIRMED').length,
    telehealth: items.filter((item) => String(item.location ?? '').toLowerCase().includes('tele')).length,
  }), [items]);

  const refillByQueue = refillSummary?.byQueue ?? {};
  const refillByAgingBand = refillSummary?.byAgingBand ?? {};

  const auditSummary = auditPacketSummary?.summary ?? {};
  const auditNotes = Array.isArray(auditPacketSummary?.governanceNotes) ? auditPacketSummary.governanceNotes : [];

  return (
    <div className="page-stack cp-clinical-flow cp-provider-queue-flow provider-v14-queue" dir={dir}>
      <ProviderPageHeader
        eyebrow="PR-06 · Provider work queue"
        title={copy.title}
        description={copy.subtitle}
        actions={(
          <>
            <ProviderActionButton tone="default" onClick={load}>{copy.refresh}</ProviderActionButton>
            <Link href="/portal/telehealth" className="cp-provider-v12-button cp-provider-v12-button--primary">{copy.openTelehealth}</Link>
          </>
        )}
      />

      {source === 'fallback' ? (
        <div className="banner banner-warning">
          <div>
            <strong>{copy.fallbackTitle}</strong>
            <p className="muted small">{copy.fallbackText} {error ?? 'Unknown error'}.</p>
          </div>
          <span className="status-chip status-warning">Fallback</span>
        </div>
      ) : null}

      {error && source === 'live' ? <div className="status-chip status-danger">{error}</div> : null}

      <WorkspaceStateStrip
        items={[
          { label: locale === 'ar' ? 'مصدر القائمة' : 'Queue source', value: source === 'live' ? 'Provider API' : 'Fallback', tone: source === 'live' ? 'success' : 'warning' },
          { label: copy.total, value: String(totals.total), tone: 'info' },
          { label: copy.requested, value: String(totals.requested), tone: totals.requested ? 'warning' : 'success' },
          { label: copy.telehealth, value: String(totals.telehealth), tone: totals.telehealth ? 'info' : 'success' },
        ]}
      />

      <ProviderGrid columns={4} className="provider-v14-kpi-grid">
        <ProviderKpiCard label={copy.appointments} value={String(totals.total)} detail={copy.visibleToProvider} tone="primary" />
        <ProviderKpiCard label={copy.requested} value={String(totals.requested)} detail={copy.awaitingConfirmation} tone={totals.requested ? 'warning' : 'success'} />
        <ProviderKpiCard label={copy.confirmed} value={String(totals.confirmed)} detail={copy.readyForEncounter} tone="success" />
        <ProviderKpiCard label={copy.telehealth} value={String(totals.telehealth)} detail={copy.virtualVisitDetail} />
        <ProviderKpiCard label={copy.pharmacyQueue} value={String(refillSummary?.pending ?? refillQueue.length)} detail={copy.pharmacyQueueDetail} tone="warning" />
        <ProviderKpiCard label={copy.queueAging24} value={String(refillSummary?.agedOver24h ?? 0)} detail={copy.queueAging24Detail} tone={(refillSummary?.agedOver24h ?? 0) ? 'danger' : 'success'} />
        <ProviderKpiCard label={copy.under24} value={String(refillByAgingBand.LT_24H ?? 0)} detail={copy.under24Detail} />
        <ProviderKpiCard label={copy.from24To48} value={String(refillByAgingBand.H24_TO_48H ?? 0)} detail={copy.from24To48Detail} />
        <ProviderKpiCard label={copy.over48} value={String(refillByAgingBand.GT_48H ?? 0)} detail={copy.over48Detail} tone={(refillByAgingBand.GT_48H ?? 0) ? 'danger' : 'default'} />
        <ProviderKpiCard label={copy.escalatedRefills} value={String(refillSummary?.escalated ?? 0)} detail={copy.escalatedRefillsDetail} tone={(refillSummary?.escalated ?? 0) ? 'danger' : 'default'} />
      </ProviderGrid>

      <section className="toolbar-card cp-workflow-filter-bar provider-v14-filter-bar">
        <div className="toolbar-group">
          <label className="field compact-field">
            <span>{copy.statusLabel}</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="ALL">{copy.statusAll}</option>
              <option value="REQUESTED">{copy.requested}</option>
              <option value="CONFIRMED">{copy.confirmed}</option>
              <option value="CANCELLED">{copy.cancelled}</option>
              <option value="COMPLETED">{copy.completed}</option>
            </select>
          </label>
          <label className="field compact-field">
            <span>{locale === 'ar' ? 'نطاق المريض' : 'Subject scope'}</span>
            <select value={subjectScope} onChange={(event) => setSubjectScope(event.target.value as 'ALL' | 'SELF' | 'FAMILY')}>
              <option value="ALL">{locale === 'ar' ? 'كل الملفات' : 'All profiles'}</option>
              <option value="SELF">{locale === 'ar' ? 'الملف الذاتي فقط' : 'Self profile only'}</option>
              <option value="FAMILY">{locale === 'ar' ? 'العائلة / التابعون فقط' : 'Family / dependents only'}</option>
            </select>
          </label>
        </div>
        <label className="field compact-field">
          <span>{copy.search}</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchShortPlaceholder} />
        </label>
      </section>

      <section className="panel-card pale-card provider-v14-workboard">
        <div className="panel-header"><h2>{copy.workboard}</h2><span className="status-chip status-info">{copy.crossModule}</span></div>
        <div className="quick-link-grid">
          <Link href="/portal/calendar" className="quick-link-card"><strong>{copy.availability}</strong><p className="muted small">{copy.availabilityText}</p></Link>
          <Link href="/portal/telehealth" className="quick-link-card"><strong>{copy.virtualVisits}</strong><p className="muted small">{copy.virtualVisitsText}</p></Link>
          <Link href="/portal/messages" className="quick-link-card"><strong>{copy.secureMessages}</strong><p className="muted small">{copy.secureMessagesText}</p></Link>
        </div>
      </section>

      <section className="table-card cp-clinical-worklist cp-refill-worklist provider-v14-refill-board">
        <div className="page-header" style={{ marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18 }}>{copy.refillQueueTitle}</h3>
            <p className="muted">{copy.refillQueueSubtitle}</p>
          </div>
          <Link href="/portal/prescriptions/new" className="btn btn-secondary">{copy.openPrescriptionOps}</Link>
        </div>
        <div className="toolbar-card" style={{ marginBottom: 16 }}>
          <label className="field compact-field">
            <span>{copy.assignedRole}</span>
            <select value={refillRole} onChange={(event) => setRefillRole(event.target.value)}>
              <option value="PHARMACIST">{copy.pharmacist}</option>
              <option value="PROVIDER">{copy.provider}</option>
              <option value="NURSE">{copy.nurse}</option>
              <option value="ALL">{copy.allRoles}</option>
            </select>
          </label>
          <label className="field compact-field">
            <span>{copy.agingBand}</span>
            <select value={refillAgingBand} onChange={(event) => setRefillAgingBand(event.target.value)}>
              <option value="ALL">{copy.statusAll}</option>
              <option value="LT_24H">{copy.under24}</option>
              <option value="H24_TO_48H">{copy.from24To48}</option>
              <option value="GT_48H">{copy.over48}</option>
            </select>
          </label>
          <label className="field compact-field" style={{ justifyContent: 'flex-end' }}>
            <span>{copy.controlledOnly}</span>
            <input type="checkbox" checked={refillControlledOnly} onChange={(event) => setRefillControlledOnly(event.target.checked)} />
          </label>
          <label className="field compact-field">
            <span>{copy.transferRole}</span>
            <select value={assignRole} onChange={(event) => setAssignRole(event.target.value as 'PROVIDER' | 'PHARMACIST' | 'NURSE')}>
              <option value="PHARMACIST">{copy.pharmacist}</option>
              <option value="PROVIDER">{copy.provider}</option>
              <option value="NURSE">{copy.nurse}</option>
            </select>
          </label>
          <label className="field compact-field">
            <span>{copy.escalation}</span>
            <select value={escalationSeverity} onChange={(event) => setEscalationSeverity(event.target.value as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')}>
              <option value="LOW">{copy.low}</option>
              <option value="MEDIUM">{copy.medium}</option>
              <option value="HIGH">{copy.high}</option>
              <option value="CRITICAL">{copy.critical}</option>
            </select>
          </label>
        </div>
        <div className="grid-3" style={{ marginBottom: 16 }}>
          {Object.entries(refillByQueue).slice(0, 3).map(([queue, count]) => (
            <div key={queue} className="card">
              <h4 className="section-title" style={{ marginBottom: 6 }}>{queue === 'PHARMACIST' ? copy.pharmacist : queue === 'PROVIDER' ? copy.provider : queue === 'NURSE' ? copy.nurse : titleize(queue)}</h4>
              <div className="kpi-value">{String(count)}</div>
              <p className="muted">{copy.currentItemsInQueue}</p>
            </div>
          ))}
        </div>
        <div className="grid-3" style={{ marginBottom: 16 }}>
          <div className="card">
            <h4 className="section-title" style={{ marginBottom: 6 }}>{copy.governedExportReady}</h4>
            <div className="kpi-value">{String(auditSummary.exportReadyCount ?? 0)}</div>
            <p className="muted">{copy.governedExportReadyDetail}</p>
          </div>
          <div className="card">
            <h4 className="section-title" style={{ marginBottom: 6 }}>{copy.auditEscalations}</h4>
            <div className="kpi-value">{String(auditSummary.escalationCount ?? 0)}</div>
            <p className="muted">{copy.auditEscalationsDetail}</p>
          </div>
          <div className="card">
            <h4 className="section-title" style={{ marginBottom: 6 }}>{copy.failedKpiDeliveries}</h4>
            <div className="kpi-value">{String(auditSummary.failedDeliveryCount ?? 0)}</div>
            <p className="muted">{copy.failedKpiDeliveriesDetail}</p>
          </div>
        </div>
        {auditNotes.length ? (
          <div className="note-card" style={{ marginBottom: 16 }}>
            <strong>{copy.governanceNotes}</strong>
            <ul className="simple-list muted" style={{ marginTop: 8 }}>
              {auditNotes.slice(0, 3).map((note: string) => <li key={note}>{note}</li>)}
            </ul>
          </div>
        ) : null}
        <div className="list-stack">
          {loading ? <p className="muted">{copy.loadingRefillQueue}</p> : null}
          {refillQueue.slice(0, 10).map((item) => (
            <div key={item.id} className="note-card cp-workflow-card cp-clinical-task-card provider-v14-refill-card">
              <div className="list-row top-align-row">
                <div>
                  <strong>{String(item.status ?? 'ROUTED_TO_PHARMACY').replaceAll('_', ' ')}</strong>
                  <p className="muted small">{copy.prescriptionPrefix} {item.prescriptionId} • {copy.queueLabel} {item.queue ?? 'PHARMACY_NETWORK'} • {copy.fulfillmentLabel} {item.fulfillmentStatus ?? 'IN_PHARMACY_QUEUE'}</p>
                  <p className="muted small">{copy.assignedLabel}: {roleLabel(item.assignedRole ?? 'PHARMACIST')}{item.assignedOwnerName ? ` • ${item.assignedOwnerName}` : ''}{item.controlledMedication ? ` • ${copy.controlledMedication}` : ''} • {copy.agingBandLabel} {titleize(item.agingBand ?? 'LT_24H')}</p>
                  {item.escalated ? <p className="muted small">{copy.escalatedLabel} {severityLabel(item.escalationSeverity ?? 'HIGH')} • {item.escalationReason ?? copy.requiresFollowUp}</p> : null}
                  <p className="muted small">{copy.updatedLabel} {formatDateTime(item.updatedAt ?? item.createdAt, locale)}</p>
                  <p className="muted small">{item.decisionNote ?? item.note ?? copy.awaitingPharmacistAction}</p>
                  {Array.isArray(item.timeline) && item.timeline.length ? (
                    <>
                      <p className="muted small">{copy.historySummary}: {item.timeline.filter((entry: any) => String(entry.label ?? '').toLowerCase().includes('assign')).length} {copy.ownerChanges} • {item.timeline.filter((entry: any) => String(entry.label ?? '').toLowerCase().includes('escalat')).length} {copy.escalations}</p>
                      {(item.escalated || item.controlledMedication) ? (
                        <p className="muted small">Audit packet ready: include this refill in the governed admin refill-audit export when escalation or controlled-medication review needs evidence capture.</p>
                      ) : null}
                      <div className="top-space-sm">
                        <strong className="muted small">Ownership history</strong>
                        <ul className="simple-list muted" style={{ marginTop: 6 }}>
                          {item.timeline.slice(-3).reverse().map((entry: any) => (
                            <li key={entry.id}>
                              {formatHistoryLabel(entry, copy.queueUpdate)} — {entry.note ?? copy.operationalRefillUpdate} ({formatDateTime(entry.at, locale)})
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  ) : null}
                </div>
                <span className={`status-chip status-${statusVariant(String(item.status ?? 'ROUTED_TO_PHARMACY'))}`}>{String(item.status ?? 'ROUTED_TO_PHARMACY').replaceAll('_', ' ')}</span>
              </div>
              <div className="inline-actions top-space-sm">
                <button className="btn btn-secondary" type="button" onClick={() => handleRefillAction(item.id, 'APPROVE')} disabled={busyId === item.id}>
                  {busyId === item.id ? copy.saving : copy.approve}
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => handleRefillAction(item.id, 'ROUTE_TO_PHARMACY')} disabled={busyId === item.id}>
                  {busyId === item.id ? copy.saving : copy.reroute}
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => handleRefillAction(item.id, 'MARK_FULFILLED')} disabled={busyId === item.id}>
                  {busyId === item.id ? copy.saving : copy.markFulfilled}
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => handleRefillAssign(item.id)} disabled={busyId === item.id}>
                  {busyId === item.id ? copy.saving : copy.transferOwner}
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => handleRefillEscalate(item.id)} disabled={busyId === item.id}>
                  {busyId === item.id ? copy.saving : copy.escalate}
                </button>
                <button className="btn btn-danger" type="button" onClick={() => handleRefillAction(item.id, 'REJECT')} disabled={busyId === item.id}>
                  {busyId === item.id ? copy.saving : copy.reject}
                </button>
              </div>
            </div>
          ))}
          {!loading && !refillQueue.length ? <p className="cp-empty-state muted">No refill requests match the current queue filters.</p> : null}
        </div>
      </section>

      <section className="panel-card pale-card provider-v14-workboard">
        <div className="panel-header"><h2>{copy.workboard}</h2><span className="status-chip status-info">{copy.crossModule}</span></div>
        <div className="quick-link-grid">
          <Link href="/portal/calendar" className="quick-link-card"><strong>{copy.availability}</strong><p className="muted small">{copy.availabilityText}</p></Link>
          <Link href="/portal/telehealth" className="quick-link-card"><strong>{copy.virtualVisits}</strong><p className="muted small">{copy.virtualVisitsText}</p></Link>
          <Link href="/portal/messages" className="quick-link-card"><strong>{copy.secureMessages}</strong><p className="muted small">{copy.secureMessagesText}</p></Link>
        </div>
      </section>

      <section className="table-card cp-clinical-worklist cp-appointment-worklist">
        <table className="data-table cp-clinical-table">
          <thead>
            <tr>
              <th>{copy.time}</th>
              <th>{copy.patient}</th>
              <th>{copy.service}</th>
              <th>{copy.location}</th>
              <th>{copy.statusLabel}</th>
              <th>{copy.payment}</th>
              <th>{copy.actions}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => {
              const normalizedStatus = String(item.status).toUpperCase();
              return (
                <tr key={item.id}>
                  <td>{formatDateTime(item.startsAt, locale)}</td>
                  <td>
                    <strong>{item.patientName}</strong>
                    <p className="muted small">{item.providerName ?? (locale === 'ar' ? 'مقدم خدمة معيّن' : 'Assigned provider')}</p>
                  </td>
                  <td>{item.service}</td>
                  <td>{item.location ?? copy.noLocation}</td>
                  <td><span className={`status-chip status-${statusVariant(normalizedStatus)}`}>{normalizedStatus}</span></td>
                  <td>{item.payment?.status ?? copy.unpaid}</td>
                  <td>
                    <div className="action-row wrap-row">
                      <Link href={`/portal/appointments/${item.id}`} className="text-link">{locale === 'ar' ? 'فتح' : 'Open'}</Link>
                      <Link href={appendProviderSubjectParams(`/portal/chart/${item.patientId ?? ''}`, item)} className="text-link">{locale === 'ar' ? 'السجل' : 'Chart'}</Link>
                      {String(item.location ?? '').toLowerCase().includes('tele') ? <Link href={appendProviderSubjectParams(`/portal/telehealth/waiting/${item.id}`, item)} className="text-link">{locale === 'ar' ? 'غرفة الانتظار' : 'Waiting room'}</Link> : null}
                      {source === 'live' && normalizedStatus === 'REQUESTED' ? (
                        <button className="btn btn-secondary" onClick={() => confirm(item.id)} disabled={busyId === item.id}>
                          {busyId === item.id ? copy.saving : copy.confirm}
                        </button>
                      ) : null}
                      {source === 'live' && ['REQUESTED', 'CONFIRMED'].includes(normalizedStatus) ? (
                        <button className="btn btn-secondary" onClick={() => cancel(item.id)} disabled={busyId === item.id}>
                          {busyId === item.id ? copy.saving : copy.cancel}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!filtered.length ? (
              <tr>
                <td colSpan={7} className="cp-empty-state muted">{locale === 'ar' ? 'لا توجد مواعيد تطابق عامل التصفية الحالي.' : 'No appointments match the current filter.'}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
