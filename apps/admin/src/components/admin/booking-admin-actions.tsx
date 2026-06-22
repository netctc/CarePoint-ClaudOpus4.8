'use client';

import { useMemo, useState } from 'react';
import { adminApi } from '@/lib/api-client';

type ActionState = 'idle' | 'saving' | 'success' | 'error';

type BookingOptions = {
  overrideReasonCatalog?: string[];
  escalationReasonCatalog?: string[];
  ownerRoleCatalog?: string[];
};

export function BookingAdminActions({
  appointmentId,
  providerOptions = [],
  bookingOptions,
  activeHolds = [],
  disabled = false,
}: {
  appointmentId: string;
  providerOptions?: Array<{ id: string; label: string }>;
  bookingOptions?: BookingOptions;
  activeHolds?: Array<{ id: string; label: string; detail: string; expiresAt: string; status: string }>;
  disabled?: boolean;
}) {
  const overrideReasons = useMemo(
    () => bookingOptions?.overrideReasonCatalog?.length ? bookingOptions.overrideReasonCatalog : ['PATIENT_REQUEST', 'LEAD_TIME_EXCEPTION', 'FACILITY_EXCEPTION'],
    [bookingOptions],
  );
  const escalationReasons = useMemo(
    () => bookingOptions?.escalationReasonCatalog?.length ? bookingOptions.escalationReasonCatalog : ['OPS_ESCALATION', 'PATIENT_SAFETY', 'PAYMENT_FAILURE'],
    [bookingOptions],
  );
  const ownerRoles = useMemo(
    () => bookingOptions?.ownerRoleCatalog?.length ? bookingOptions.ownerRoleCatalog : ['COMPANY_SUPPORT', 'COMPANY_ADMIN'],
    [bookingOptions],
  );

  const [providerId, setProviderId] = useState(providerOptions[0]?.id || '');
  const [note, setNote] = useState('');
  const [overrideReasonCode, setOverrideReasonCode] = useState(overrideReasons[0] || 'PATIENT_REQUEST');
  const [escalationReasonCode, setEscalationReasonCode] = useState(escalationReasons[0] || 'OPS_ESCALATION');
  const [ownerRole, setOwnerRole] = useState(ownerRoles[0] || 'COMPANY_SUPPORT');
  const [startsAt, setStartsAt] = useState('2026-04-02T10:00');
  const [endsAt, setEndsAt] = useState('2026-04-02T10:30');
  const [selectedHoldId, setSelectedHoldId] = useState(activeHolds[0]?.id || '');
  const [authorizationDecision, setAuthorizationDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [state, setState] = useState<ActionState>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function run(mode: 'reassign' | 'reschedule' | 'no-show' | 'escalate' | 'extend-hold' | 'release-hold' | 'authorization-review') {
    setState('saving');
    setMessage(null);
    try {
      if (mode === 'reassign') {
        await adminApi.reassignBookingProvider(appointmentId, { providerId, note, reasonCode: overrideReasonCode });
      }
      if (mode === 'reschedule') {
        await adminApi.rescheduleBooking(appointmentId, {
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          note,
          reasonCode: overrideReasonCode,
        });
      }
      if (mode === 'no-show') await adminApi.markBookingNoShow(appointmentId, { note });
      if (mode === 'escalate') {
        await adminApi.escalateBooking(appointmentId, { reasonCode: escalationReasonCode, note, ownerRole });
      }
      if (mode === 'extend-hold') {
        if (!selectedHoldId) throw new Error('Select an active slot hold first.');
        await adminApi.extendBookingHold(selectedHoldId, { extendMinutes: 5, note });
      }
      if (mode === 'release-hold') {
        if (!selectedHoldId) throw new Error('Select an active slot hold first.');
        await adminApi.releaseBookingHold(selectedHoldId, { note });
      }
      if (mode === 'authorization-review') {
        await adminApi.reviewBookingAuthorization(appointmentId, { decision: authorizationDecision, note: note || 'Authorization review recorded from control tower.' });
      }
      setState('success');
      setMessage('Booking action recorded successfully. Refresh the page to pull the latest booking state from the API.');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Unable to complete the booking action.');
    }
  }

  return <div className="card">
    <h3 className="section-title">API booking controls</h3>
    <p className="muted">These controls call the live booking control tower endpoints for the selected booking.</p>
    <div className="grid-2" style={{ marginTop: 12 }}>
      <label className="label">Provider reassign target
        <select className="select" value={providerId} onChange={(e) => setProviderId(e.target.value)} disabled={disabled || state === 'saving' || providerOptions.length === 0}>
          {providerOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </label>
      <label className="label">Override reason code
        <select className="select" value={overrideReasonCode} onChange={(e) => setOverrideReasonCode(e.target.value)} disabled={disabled || state === 'saving'}>
          {overrideReasons.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    </div>
    <div className="grid-2" style={{ marginTop: 12 }}>
      <label className="label">Reschedule start<input className="input" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} disabled={disabled || state === 'saving'} /></label>
      <label className="label">Reschedule end<input className="input" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} disabled={disabled || state === 'saving'} /></label>
    </div>
    <div className="grid-2" style={{ marginTop: 12 }}>
      <label className="label">Escalation reason code
        <select className="select" value={escalationReasonCode} onChange={(e) => setEscalationReasonCode(e.target.value)} disabled={disabled || state === 'saving'}>
          {escalationReasons.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <label className="label">Escalation owner role
        <select className="select" value={ownerRole} onChange={(e) => setOwnerRole(e.target.value)} disabled={disabled || state === 'saving'}>
          {ownerRoles.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    </div>

    <div className="grid-2" style={{ marginTop: 12 }}>
      <label className="label">Authorization review
        <select className="select" value={authorizationDecision} onChange={(e) => setAuthorizationDecision(e.target.value as 'APPROVED' | 'REJECTED')} disabled={disabled || state === 'saving'}>
          <option value="APPROVED">APPROVED</option>
          <option value="REJECTED">REJECTED</option>
        </select>
      </label>
      <label className="label">Authorization note
        <input className="input" value={authorizationDecision === 'APPROVED' ? 'Authorization evidence verified' : 'Authorization evidence missing or rejected'} readOnly />
      </label>
    </div>

    {activeHolds.length ? <>      <div className="grid-2" style={{ marginTop: 12 }}>
        <label className="label">Active slot hold
          <select className="select" value={selectedHoldId} onChange={(e) => setSelectedHoldId(e.target.value)} disabled={disabled || state === 'saving'}>
            {activeHolds.map((hold) => <option key={hold.id} value={hold.id}>{hold.label}</option>)}
          </select>
        </label>
        <label className="label">Hold status
          <input className="input" value={activeHolds.find((hold) => hold.id === selectedHoldId)?.detail || ''} readOnly />
        </label>
      </div>
      <p className="muted" style={{ marginTop: 10 }}>Extend a hold when the patient is actively completing intake or payment. Release a hold when the booking cannot continue.</p>
    </> : null}
    <label className="label" style={{ marginTop: 12 }}>Operations note<textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Capture the rationale, downstream impact, and customer communication plan." disabled={disabled || state === 'saving'} /></label>
    <p className="muted" style={{ marginTop: 10 }}>Use an override reason plus a note whenever rescheduling or reassigning into a policy-exception scenario.</p>
    <div className="inline-actions" style={{ marginTop: 16, flexWrap: 'wrap' }}>
      <button className="button secondary" onClick={() => run('reassign')} disabled={disabled || state === 'saving' || !providerId}>Reassign provider</button>
      <button className="button secondary" onClick={() => run('reschedule')} disabled={disabled || state === 'saving'}>Reschedule booking</button>
      <button className="button secondary" onClick={() => run('no-show')} disabled={disabled || state === 'saving'}>Mark no-show</button>
      <button className="button secondary" onClick={() => run('extend-hold')} disabled={disabled || state === 'saving' || !selectedHoldId}>Extend hold</button>
      <button className="button secondary" onClick={() => run('release-hold')} disabled={disabled || state === 'saving' || !selectedHoldId}>Release hold</button>
      <button className="button secondary" onClick={() => run('authorization-review')} disabled={disabled || state === 'saving'}>Record auth review</button>
      <button className="button primary" onClick={() => run('escalate')} disabled={disabled || state === 'saving'}>Escalate booking</button>
    </div>
    {message ? <div className={`banner ${state === 'error' ? 'warning' : 'info'}`} style={{ marginTop: 16 }}>{message}</div> : null}
  </div>;
}
