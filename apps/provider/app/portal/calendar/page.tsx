'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { StatCard } from '@/components/shared/stat-card';
import { WorkspaceStateStrip } from '@/components/shared/workspace-state-strip';
import { providerApi } from '@/services/api-client';
import { getCalendarData } from '@/services/mock-api';
import { useProviderLocale } from '@/components/i18n/provider-locale-provider';
import { getProviderPortalCopy } from '@/lib/i18n/provider-portal-copy';

type ScheduleBlock = {
  id: string;
  time: string;
  type: string;
  patientName?: string | null;
  statusLabel: string;
  variant: 'success' | 'warning' | 'info';
};

type ScheduleDay = {
  label: string;
  date: string;
  blocks: ScheduleBlock[];
};

function formatDateLabel(value: Date, locale?: string) {
  return value.toLocaleDateString(locale, { weekday: 'short' });
}

function formatFullDate(value: Date, locale?: string) {
  return value.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(value: string, locale?: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

function normalizeVisitType(location?: string | null, modality?: string | null, copy?: ReturnType<typeof getProviderPortalCopy>['calendar']) {
  const normalized = `${location ?? ''} ${modality ?? ''}`.toLowerCase();
  if (normalized.includes('tele') || normalized.includes('virtual')) {
    return copy?.telehealth ?? 'Telehealth';
  }
  return copy?.clinic ?? 'Clinic';
}

function buildLiveSchedule(days: Record<string, any[]>, selectedFacility: string, locale?: string, copy?: ReturnType<typeof getProviderPortalCopy>['calendar']): ScheduleDay[] {
  return Object.entries(days)
    .sort(([left], [right]) => new Date(left).getTime() - new Date(right).getTime())
    .slice(0, 5)
    .map(([key, items]) => {
      const day = new Date(key);
      const blocks = (items ?? [])
        .filter((item) => selectedFacility === (copy?.allFacilities ?? 'All facilities') || String(item.location ?? 'Unassigned') === selectedFacility)
        .map((item) => {
          const visitType = normalizeVisitType(item.location, item.modality, copy);
          const statusLabel = String(item.status ?? item.statusLabel ?? 'AVAILABLE').replaceAll('_', ' ');
          const variant = item.kind === 'appointment'
            ? (visitType === (copy?.telehealth ?? 'Telehealth') ? 'info' : 'success')
            : statusLabel === 'AVAILABLE'
              ? 'success'
              : statusLabel === 'HELD'
                ? 'warning'
                : 'info';
          return {
            id: item.id,
            time: formatTime(String(item.startsAt), locale),
            type: `${item.service} • ${visitType}`,
            patientName: item.patientName,
            statusLabel,
            variant,
          } satisfies ScheduleBlock;
        });
      return {
        label: formatDateLabel(day, locale),
        date: formatFullDate(day, locale),
        blocks,
      } satisfies ScheduleDay;
    });
}

function buildFallbackSchedule(selectedFacility: string, copy?: ReturnType<typeof getProviderPortalCopy>['calendar']): ScheduleDay[] {
  const data = getCalendarData();
  return data.days.map((day) => ({
    ...day,
    blocks: day.blocks
      .filter((block) => selectedFacility === (copy?.allFacilities ?? 'All facilities') || data.selectedLocation === selectedFacility)
      .map((block, index) => ({
        id: `${day.label}-${index}`,
        time: block.time,
        type: block.type,
        statusLabel: copy?.planned ?? 'Planned',
        variant: block.type.toLowerCase().includes('tele') ? 'info' : 'warning',
      })),
  }));
}

export default function CalendarPage() {
  const { locale, dir } = useProviderLocale();
  const copy = getProviderPortalCopy(locale).calendar;
  const fallbackData = getCalendarData();
  const [overview, setOverview] = useState<any | null>(null);
  const [source, setSource] = useState<'live' | 'fallback'>('live');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFacility, setSelectedFacility] = useState(copy.allFacilities);
  const [slotService, setSlotService] = useState(copy.consultation);
  const [slotLocation, setSlotLocation] = useState(copy.virtualCare);
  const [slotStartsAt, setSlotStartsAt] = useState('2026-04-06T09:00');
  const [slotEndsAt, setSlotEndsAt] = useState('2026-04-06T09:30');
  const [slotCapacity, setSlotCapacity] = useState('1');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [policyPreview, setPolicyPreview] = useState<any | null>(null);
  const [activeHolds, setActiveHolds] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [result, holdResponse]: any = await Promise.all([
        providerApi.providerCalendarOverview(),
        providerApi.bookingControlHolds(20).catch(() => ({ items: [] })),
      ]);
      setOverview(result);
      setActiveHolds(Array.isArray(holdResponse?.items) ? holdResponse.items : []);
      setSource('live');
    } catch (err) {
      setOverview(null);
      setActiveHolds([]);
      setSource('fallback');
      setError(err instanceof Error ? err.message : copy.unableLoad);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let active = true;
    const startsAt = new Date(slotStartsAt);
    const endsAt = new Date(slotEndsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      setPolicyPreview(null);
      return;
    }
    providerApi.bookingPolicyPreview({
      providerId: String(overview?.providerId ?? overview?.summary?.providerId ?? ''),
      service: slotService,
      location: slotLocation,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    }).then((result: any) => {
      if (active) setPolicyPreview(result.policy ?? null);
    }).catch(() => {
      if (active) setPolicyPreview(null);
    });
    return () => {
      active = false;
    };
  }, [overview, slotEndsAt, slotLocation, slotService, slotStartsAt]);

  const facilities = useMemo(() => {
    const liveLocations = Array.isArray(overview?.facilities) ? overview.facilities : [];
    return Array.from(new Set([copy.allFacilities, ...fallbackData.locations, ...liveLocations]));
  }, [copy.allFacilities, fallbackData.locations, overview]);

  const liveServices = useMemo(() => {
    const slots = Array.isArray(overview?.publishedSlots) ? overview.publishedSlots : [];
    return Array.from(new Set([copy.consultation, ...slots.map((item: any) => String(item.service ?? copy.consultation))]));
  }, [copy.consultation, overview]);

  const scheduleDays = useMemo(() => {
    return source === 'live'
      ? buildLiveSchedule((overview?.days ?? {}) as Record<string, any[]>, selectedFacility, locale, copy)
      : buildFallbackSchedule(selectedFacility, copy);
  }, [copy, locale, overview, selectedFacility, source]);

  const summary = overview?.summary ?? {};
  const publishedCount = source === 'live'
    ? Number(summary.publishedSlotCount ?? 0)
    : scheduleDays.reduce((total, day) => total + day.blocks.length, 0);
  const availableCount = source === 'live'
    ? Number(summary.availableSlotCount ?? 0)
    : 0;
  const heldCount = source === 'live'
    ? Number(summary.heldSlotCount ?? 0)
    : 0;
  const telehealthCount = source === 'live'
    ? Number(summary.telehealthCount ?? 0)
    : scheduleDays.flatMap((day) => day.blocks).filter((item) => item.type.toLowerCase().includes('tele')).length;

  async function submitManualSlot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const payload = {
        service: slotService,
        location: slotLocation,
        startsAt: new Date(slotStartsAt).toISOString(),
        endsAt: new Date(slotEndsAt).toISOString(),
        capacity: Number.parseInt(slotCapacity, 10) || 1,
      };
      if (selectedSlotId) {
        await providerApi.updateProviderPublishedSlot(selectedSlotId, payload);
        setMessage(copy.saveUpdated);
      } else {
        await providerApi.createProviderPublishedSlot(payload);
        setMessage(copy.saveCreated);
      }
      setSelectedSlotId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableSave);
    } finally {
      setSaving(false);
    }
  }

  function loadSlotIntoEditor(slot: any) {
    setSelectedSlotId(String(slot.id));
    setSlotService(String(slot.service ?? copy.consultation));
    setSlotLocation(String(slot.location ?? copy.virtualCare));
    setSlotStartsAt(String(slot.startsAt ?? '').slice(0, 16));
    setSlotEndsAt(String(slot.endsAt ?? '').slice(0, 16));
    setSlotCapacity(String(slot.capacity ?? 1));
    setMessage(`${copy.slotLoadedPrefix} ${String(slot.id).slice(0, 8)} ${copy.slotLoadedSuffix}`);
  }

  async function cancelSlot(slotId: string) {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await providerApi.cancelProviderPublishedSlot(slotId, 'Cancelled from provider calendar page');
      setMessage(copy.slotCancelled);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableCancelSlot);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack cp-provider-v15-schedule cp-clinical-flow cp-calendar-flow" dir={dir}>
      <section className="page-header split-header">
        <div>
          <span className="eyebrow">PR-04</span>
          <h1>{copy.title}</h1>
          <p className="muted">{copy.subtitle}</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={load}>{copy.refresh}</button>
          <Link href="/portal/calendar/templates" className="btn btn-primary">{copy.templateControl}</Link>
        </div>
      </section>

      {source === 'fallback' ? (
        <div className="banner banner-warning">
          <div>
            <strong>{copy.fallbackTitle}</strong>
            <p className="muted small">{copy.fallbackText} {error ?? 'Unknown error'}.</p>
          </div>
          <span className="status-chip status-warning">{copy.fallbackSchedule}</span>
        </div>
      ) : (
        <div className="banner banner-success">
          <div>
            <strong>{copy.liveTitle}</strong>
            <p className="muted small">{copy.liveText}</p>
          </div>
          <span className="status-chip status-success">{copy.sharedSchedulingApi}</span>
        </div>
      )}

      {message ? <div className="status-chip status-success">{message}</div> : null}
      {error && source === 'live' ? <div className="status-chip status-danger">{error}</div> : null}

      <WorkspaceStateStrip
        items={[
          { label: copy.schedulingSource, value: source === 'live' ? copy.sharedSchedulingApi : copy.fallbackSchedule, tone: source === 'live' ? 'success' : 'warning' },
          { label: copy.facilityScope, value: selectedFacility, tone: 'info' },
          { label: copy.publishedSlots, value: String(publishedCount), tone: 'info' },
          { label: copy.heldInventory, value: String(heldCount), tone: heldCount ? 'warning' : 'success' },
        ]}
      />

      <section className="stats-grid cp-workflow-kpi-strip">
        <StatCard label={copy.publishedFutureSlots} value={String(publishedCount)} detail={copy.publishedFutureSlotsDetail} />
        <StatCard label={copy.currentlyAvailable} value={String(availableCount)} detail={copy.currentlyAvailableDetail} />
        <StatCard label={copy.heldInventory} value={String(heldCount)} detail={copy.heldInventoryDetail} />
        <StatCard label={copy.telehealthVisits} value={String(telehealthCount)} detail={copy.telehealthVisitsDetail} />
      </section>

      <section className="panel-card pale-card">
        <div className="panel-header"><h2>{copy.workboard}</h2><span className="status-chip status-info">{copy.wave2}</span></div>
        <div className="quick-link-grid">
          <Link href="/portal/queue" className="quick-link-card"><strong>{copy.queueHandoff}</strong><p className="muted small">{copy.queueHandoffText}</p></Link>
          <Link href="/portal/telehealth" className="quick-link-card"><strong>{copy.telehealthCapacity}</strong><p className="muted small">{copy.telehealthCapacityText}</p></Link>
          <Link href="/portal/calendar/templates" className="quick-link-card"><strong>{copy.templateControl}</strong><p className="muted small">{copy.templateControlText}</p></Link>
        </div>
      </section>

      <section className="toolbar-card cp-workflow-filter-bar">
        <div className="toolbar-group">
          <label className="field compact-field">
            <span>{copy.facility}</span>
            <select value={selectedFacility} onChange={(event) => setSelectedFacility(event.target.value)}>
              {facilities.map((facility) => (
                <option key={facility} value={facility}>{facility}</option>
              ))}
            </select>
          </label>
          <label className="field compact-field">
            <span>{copy.source}</span>
            <input value={source === 'live' ? copy.sharedSchedulingApi : copy.fallbackSchedule} readOnly />
          </label>
        </div>
        <div className="action-row wrap-row">
          <Link href="/portal/queue" className="btn btn-secondary">{copy.openQueue}</Link>
          <Link href="/portal/telehealth" className="btn btn-secondary">{copy.telehealthOps}</Link>
        </div>
      </section>

      <section className="content-grid two-col top-align-grid cp-clinical-worklist">
        <article className="panel-card">
          <div className="panel-header">
            <h2>{copy.manualAvailabilityControl}</h2>
            <span className="status-chip status-info">W2 live</span>
          </div>
          <form className="form-stack" onSubmit={submitManualSlot}>
            <div className="content-grid two-col compact-grid">
              <label className="field">
                <span>{copy.service}</span>
                <select value={slotService} onChange={(event) => setSlotService(event.target.value)}>
                  {liveServices.map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
              <label className="field">
                <span>{copy.facilityChannel}</span>
                <select value={slotLocation} onChange={(event) => setSlotLocation(event.target.value)}>
                  {facilities.filter((facility) => facility !== 'All facilities').map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
            </div>
            <div className="content-grid two-col compact-grid">
              <label className="field"><span>{copy.start}</span><input type="datetime-local" value={slotStartsAt} onChange={(event) => setSlotStartsAt(event.target.value)} /></label>
              <label className="field"><span>{copy.end}</span><input type="datetime-local" value={slotEndsAt} onChange={(event) => setSlotEndsAt(event.target.value)} /></label>
            </div>
            <label className="field">
              <span>{copy.capacity}</span>
              <input type="number" min="1" max="20" value={slotCapacity} onChange={(event) => setSlotCapacity(event.target.value)} />
            </label>
            {policyPreview ? (
              <div className={policyPreview.overrideRequired ? 'banner banner-warning' : 'banner banner-success'}>
                <div>
                  <strong>{policyPreview.overrideRequired ? copy.policyNeedsAttention : copy.policyClear}</strong>
                  <p className="muted small">{copy.leadTime}: {policyPreview.bookingLeadHours}h · {copy.weekend}: {policyPreview.weekendSlotsAllowed ? policyPreview.weekendCalendar : `Restricted – ${policyPreview.weekendCalendar}`}</p>
                  {policyPreview.blockedFacilities?.length ? <p className="muted small">{copy.blockedFacilities}: {policyPreview.blockedFacilities.join(', ')}</p> : null}
                  {policyPreview.blockedChannels?.length ? <p className="muted small">{copy.blockedChannels}: {policyPreview.blockedChannels.join(', ')}</p> : null}
                  {policyPreview.cityExceptions?.length ? <p className="muted small">{copy.regionalExceptions}: {policyPreview.cityExceptions.join(' · ')}</p> : null}
                  {policyPreview.reasons?.length ? <p className="muted small">{policyPreview.reasons.join(' ')}</p> : null}
                </div>
              </div>
            ) : null}
            <div className="action-row wrap-row">
              <button className="btn btn-primary" type="submit" disabled={saving || source !== 'live' || Boolean(policyPreview?.overrideRequired)}>{saving ? 'Saving…' : selectedSlotId ? copy.updateSlot : copy.publishManualSlot}</button>
              {selectedSlotId ? <button className="btn btn-secondary" type="button" onClick={() => { setSelectedSlotId(null); setMessage(copy.editorReset); }} disabled={saving}>{copy.clearEditor}</button> : null}
            </div>
          </form>
        </article>


        <article className="panel-card">
          <div className="panel-header">
            <h2>{copy.activePatientHolds}</h2>
            <span className="status-chip status-warning">{activeHolds.length}</span>
          </div>
          <div className="list-stack">
            {source === 'live' && activeHolds.length ? activeHolds.map((hold: any) => (
              <div key={hold.id} className="list-row top-align-row">
                <div>
                  <strong>{hold.patientName || copy.maskedPatient}</strong>
                  <p className="muted small">{hold.service} • {hold.location}</p>
                  <p className="muted small">{copy.providerLabel}: {hold.providerName || copy.assignedProvider} • {copy.expires} {formatTime(String(hold.expiresAt), locale)}</p>
                </div>
                <span className="status-chip status-warning">{copy.held}</span>
              </div>
            )) : <p className="muted">{source === 'live' ? copy.noActiveHolds : copy.connectLiveApiForHolds}</p>}
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-header">
            <h2>{copy.publishedSlotActions}</h2>
            <span className="status-chip status-info">{Array.isArray(overview?.publishedSlots) ? overview.publishedSlots.length : 0} {copy.slots}</span>
          </div>
          <div className="list-stack">
            {Array.isArray(overview?.publishedSlots) && overview.publishedSlots.length ? overview.publishedSlots.slice(0, 6).map((slot: any) => (
              <div key={slot.id} className="list-row top-align-row">
                <div>
                  <strong>{formatTime(String(slot.startsAt))} - {formatTime(String(slot.endsAt))}</strong>
                  <p className="muted small">{slot.service} • {slot.location}</p>
                  <p className="muted small">{copy.availableCapacity} {slot.availableCount} / {copy.capacityShort} {slot.capacity} • {copy.holds} {slot.activeHoldCount}</p>
                </div>
                <div className="action-row wrap-row">
                  <button className="btn btn-secondary" onClick={() => loadSlotIntoEditor(slot)} disabled={saving || source !== 'live'}>{copy.edit}</button>
                  <button className="btn btn-secondary" onClick={() => cancelSlot(String(slot.id))} disabled={saving || source !== 'live'}>{copy.cancelSlot}</button>
                </div>
              </div>
            )) : <p className="muted">{copy.noPublishedSlots}</p>}
          </div>
        </article>
      </section>

      <section className="calendar-grid cp-calendar-board">
        {scheduleDays.map((day) => (
          <article key={`${day.label}-${day.date}`} className="calendar-day-card">
            <div className="panel-header">
              <h2>{day.label}</h2>
              <span className="muted small">{day.date}</span>
            </div>
            <div className="list-stack">
              {day.blocks.length ? day.blocks.map((block) => (
                <div key={block.id} className="calendar-block">
                  <strong>{block.time}</strong>
                  <p className="muted small">{block.type}</p>
                  {block.patientName ? <p className="muted small">{block.patientName}</p> : null}
                  <span className={`status-chip status-${block.variant}`}>{block.patientName ? copy.booked : block.statusLabel}</span>
                </div>
              )) : <p className="muted">{copy.noScheduledCommitments}</p>}
            </div>
          </article>
        ))}
      </section>

      <section className="content-grid two-col top-align-grid">
        <article className="panel-card">
          <div className="panel-header">
            <h2>{copy.publishingGuidance}</h2>
            <span className="status-chip status-success">{copy.wave2Active}</span>
          </div>
          <div className="checklist-stack">
            <label className="checkbox-row"><input type="checkbox" defaultChecked /> <span>{copy.guidance1}</span></label>
            <label className="checkbox-row"><input type="checkbox" defaultChecked /> <span>{copy.guidance2}</span></label>
            <label className="checkbox-row"><input type="checkbox" defaultChecked /> <span>{copy.guidance3}</span></label>
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-header">
            <h2>{copy.whatIsLive}</h2>
          </div>
          <div className="detail-list">
            <div><span className="detail-label">{copy.liveSource}</span><strong>{copy.providerCalendarOverviewApi}</strong></div>
            <div><span className="detail-label">{copy.publishedInventory}</span><strong>{String(publishedCount)} {copy.futureSlots}</strong></div>
            <div><span className="detail-label">{copy.bestNextAction}</span><strong>{publishedCount ? copy.bestNextActionWithSlots : copy.bestNextActionWithoutSlots}</strong></div>
          </div>
        </article>
      </section>

      {loading && source === 'live' && !overview ? <div className="status-chip status-info">Loading schedule…</div> : null}
    </div>
  );
}
