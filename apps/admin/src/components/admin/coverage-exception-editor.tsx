'use client';

import { useMemo, useState } from 'react';
import { adminApi } from '@/lib/api-client';

type CoverageApiItem = {
  id: string;
  code: string;
  name: string;
  payer: string;
  planType: string;
  serviceCodes?: string[];
  regions?: string[];
  authorizationRequired?: boolean;
  bookingLeadHours?: number;
  telehealthAllowed?: boolean;
  weekendSlotsAllowed?: boolean;
  weekendCalendar?: string;
  blockedFacilities?: string[];
  blockedChannels?: string[];
  cityExceptions?: string[];
  status: string;
};

export function CoverageExceptionEditor({ item, disabled = false }: { item: CoverageApiItem; disabled?: boolean }) {
  const [weekendSlotsAllowed, setWeekendSlotsAllowed] = useState(item.weekendSlotsAllowed !== false);
  const [weekendCalendar, setWeekendCalendar] = useState(item.weekendCalendar ?? 'Fri-Sat standard schedule');
  const [blockedFacilities, setBlockedFacilities] = useState((item.blockedFacilities ?? []).join(', '));
  const [blockedChannels, setBlockedChannels] = useState<string[]>(item.blockedChannels ?? []);
  const [cityExceptions, setCityExceptions] = useState((item.cityExceptions ?? []).join('\n'));
  const [message, setMessage] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const payload = useMemo(
    () => ({
      id: item.id,
      code: item.code,
      name: item.name,
      payer: item.payer,
      planType: item.planType,
      serviceCodes: item.serviceCodes ?? [],
      regions: item.regions ?? [],
      authorizationRequired: item.authorizationRequired ?? false,
      bookingLeadHours: item.bookingLeadHours ?? 2,
      telehealthAllowed: item.telehealthAllowed ?? true,
      weekendSlotsAllowed,
      weekendCalendar,
      blockedFacilities: blockedFacilities
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
      blockedChannels,
      cityExceptions: cityExceptions
        .split('\n')
        .map((entry) => entry.trim())
        .filter(Boolean),
      note: 'Coverage exception editor update',
    }),
    [blockedChannels, blockedFacilities, cityExceptions, item, weekendCalendar, weekendSlotsAllowed],
  );

  async function save() {
    setState('saving');
    setMessage(null);
    try {
      await adminApi.updateCoverageRule(item.id, payload);
      setState('success');
      setMessage('Coverage exception settings saved. Refresh the page to load the updated live rule state.');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Unable to save the coverage exception settings.');
    }
  }

  function toggleChannel(value: 'TELEHEALTH' | 'IN_PERSON') {
    setBlockedChannels((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  }

  return (
    <div className="card">
      <h3 className="section-title">Coverage exceptions & constraints</h3>
      <p className="muted">Publish facility, channel, weekend, and regional exception notes directly into the live coverage rule.</p>
      <label className="label" style={{ marginTop: 14 }}>
        Weekend calendar note
        <input className="input" value={weekendCalendar} onChange={(event) => setWeekendCalendar(event.target.value)} disabled={disabled || state === 'saving'} />
      </label>
      <label className="label" style={{ marginTop: 14 }}>
        <span>Weekend bookings allowed</span>
        <select className="select" value={weekendSlotsAllowed ? 'yes' : 'no'} onChange={(event) => setWeekendSlotsAllowed(event.target.value === 'yes')} disabled={disabled || state === 'saving'}>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </label>
      <label className="label" style={{ marginTop: 14 }}>
        Blocked facilities
        <input className="input" value={blockedFacilities} onChange={(event) => setBlockedFacilities(event.target.value)} placeholder="Main Clinic, Riyadh Annex" disabled={disabled || state === 'saving'} />
      </label>
      <div className="label" style={{ marginTop: 14 }}>
        Blocked booking channels
        <div className="inline-actions" style={{ marginTop: 10, flexWrap: 'wrap' }}>
          <button type="button" className={`button ${blockedChannels.includes('TELEHEALTH') ? 'primary' : 'secondary'}`} onClick={() => toggleChannel('TELEHEALTH')} disabled={disabled || state === 'saving'}>
            Telehealth
          </button>
          <button type="button" className={`button ${blockedChannels.includes('IN_PERSON') ? 'primary' : 'secondary'}`} onClick={() => toggleChannel('IN_PERSON')} disabled={disabled || state === 'saving'}>
            In-person
          </button>
        </div>
      </div>
      <label className="label" style={{ marginTop: 14 }}>
        Regional exception notes
        <textarea className="textarea" value={cityExceptions} onChange={(event) => setCityExceptions(event.target.value)} placeholder="One exception note per line" disabled={disabled || state === 'saving'} />
      </label>
      <div className="inline-actions" style={{ marginTop: 16 }}>
        <button className="button primary" type="button" onClick={save} disabled={disabled || state === 'saving'}>
          {state === 'saving' ? 'Saving…' : 'Save exceptions'}
        </button>
      </div>
      {message ? <div className={`banner ${state === 'error' ? 'warning' : 'info'}`} style={{ marginTop: 16 }}>{message}</div> : null}
    </div>
  );
}
