'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ProviderGrid,
  ProviderKpiCard,
  ProviderPageHeader,
  ProviderSectionCard,
  ProviderStatusPill,
  ProviderTable,
} from '@/components/design/provider-design';
import { providerApi } from '@/services/api-client';
import { getRpmProgramData } from '@/services/mock-api';
import { useProviderLocale } from '@/components/i18n/provider-locale-provider';

type PatientRow = {
  patientId: string;
  patientName: string;
  latestContext: string;
  signal: string;
  status: string;
  variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  nextAction: string;
};

function normalizeVariant(value: unknown): PatientRow['variant'] {
  const input = String(value ?? '').toLowerCase();
  if (input.includes('danger') || input.includes('critical') || input.includes('failed')) return 'danger';
  if (input.includes('warning') || input.includes('caution') || input.includes('pending')) return 'warning';
  if (input.includes('success') || input.includes('normal') || input.includes('within')) return 'success';
  if (input.includes('info')) return 'info';
  return 'neutral';
}

function buildRows(appointments: any[], rpmPatients: any[], fallbackPatients: any[]): PatientRow[] {
  const rows = new Map<string, PatientRow>();

  appointments.forEach((appointment) => {
    const patientId = String(appointment.patientId ?? appointment.subjectProfileId ?? appointment.id ?? 'patient-unknown');
    const patientName = String(appointment.subjectLabel ?? appointment.patientName ?? 'Patient');
    rows.set(patientId, {
      patientId,
      patientName,
      latestContext: String(appointment.service ?? appointment.reason ?? appointment.modality ?? 'Scheduled care'),
      signal: appointment.startsAt ? new Date(appointment.startsAt).toLocaleString() : String(appointment.time ?? 'Upcoming'),
      status: String(appointment.status ?? appointment.statusLabel ?? 'Scheduled').replaceAll('_', ' '),
      variant: normalizeVariant(appointment.status ?? appointment.statusVariant),
      nextAction: 'Open chart',
    });
  });

  [...rpmPatients, ...fallbackPatients].forEach((patient) => {
    const patientId = String(patient.patientId ?? 'patient-unknown');
    const existing = rows.get(patientId);
    rows.set(patientId, {
      patientId,
      patientName: String(patient.patientName ?? existing?.patientName ?? 'Patient'),
      latestContext: existing?.latestContext ?? String(patient.device ?? 'Remote monitoring'),
      signal: String(patient.latestReading ?? existing?.signal ?? 'No recent signal'),
      status: String(patient.thresholdStatus ?? existing?.status ?? 'Monitoring'),
      variant: normalizeVariant(patient.variant ?? patient.thresholdStatus ?? existing?.variant),
      nextAction: existing ? 'Open chart' : 'Open RPM',
    });
  });

  return Array.from(rows.values());
}

export default function ProviderPatientsPage() {
  const { dir, t } = useProviderLocale();
  const fallback = useMemo(() => getRpmProgramData(), []);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [rpmPatients, setRpmPatients] = useState<any[]>([]);
  const [source, setSource] = useState<'live' | 'fallback'>('fallback');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [appointmentResponse, rpmResponse]: any[] = await Promise.all([
        providerApi.appointments(),
        providerApi.providerRpmPatients().catch(() => ({ items: [] })),
      ]);
      setAppointments(Array.isArray(appointmentResponse?.items) ? appointmentResponse.items : []);
      setRpmPatients(Array.isArray(rpmResponse?.items) ? rpmResponse.items : []);
      setSource('live');
    } catch (err) {
      setAppointments([]);
      setRpmPatients([]);
      setSource('fallback');
      setError(err instanceof Error ? err.message : 'Unable to load provider patient workspace');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => buildRows(appointments, rpmPatients, fallback.patients), [appointments, fallback.patients, rpmPatients]);
  const alertingCount = rows.filter((row) => row.variant === 'warning' || row.variant === 'danger').length;
  const scheduledCount = appointments.length;
  const monitoredCount = rpmPatients.length || fallback.patients.length;

  return (
    <div className="page-stack cp-provider-v15-patients" dir={dir}>
      <ProviderPageHeader
        eyebrow="PR-15 · Patient workspace"
        title={t.nav.patients}
        description="Unified provider view for scheduled patients, linked chart actions, and remote-monitoring signals."
        actions={(
          <>
            <button className="cp-provider-v12-button cp-provider-v12-button--default" type="button" onClick={load}>{t.common.refresh}</button>
            <Link href="/portal/queue" className="cp-provider-v12-button cp-provider-v12-button--primary">{t.common.queue}</Link>
          </>
        )}
      />

      <div className={`banner ${source === 'live' ? 'banner-success' : 'banner-warning'}`}>
        <div>
          <strong>{source === 'live' ? 'Live patient workspace' : 'Fallback patient workspace'}</strong>
          <p className="muted small">{source === 'live' ? 'Appointments and remote monitoring are loaded from the provider API.' : `Showing starter patient data because the live API was unavailable. ${error ?? ''}`}</p>
        </div>
        <ProviderStatusPill tone={source === 'live' ? 'success' : 'warning'}>{source === 'live' ? 'Live' : 'Fallback'}</ProviderStatusPill>
      </div>

      <ProviderGrid columns={3}>
        <ProviderKpiCard label="Patients in scope" value={String(rows.length)} detail="Unique scheduled or monitored patients" tone="primary" />
        <ProviderKpiCard label="Scheduled visits" value={String(scheduledCount)} detail="Appointments returned in the current provider scope" />
        <ProviderKpiCard label="Clinical signals" value={String(alertingCount)} detail={`${monitoredCount} remote-monitoring profiles available`} tone={alertingCount ? 'warning' : 'success'} />
      </ProviderGrid>

      <ProviderSectionCard title="Patient list" description="Open charts, RPM panels, prescriptions, labs, and encounter notes without leaving the provider workspace.">
        <ProviderTable>
          <thead>
            <tr>
              <th>Patient</th>
              <th>Latest context</th>
              <th>Signal</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.patientId}>
                <td><strong>{row.patientName}</strong><p className="muted small">{row.patientId}</p></td>
                <td>{row.latestContext}</td>
                <td>{row.signal}</td>
                <td><ProviderStatusPill tone={row.variant}>{row.status}</ProviderStatusPill></td>
                <td>
                  <div className="action-row wrap-row">
                    <Link href={`/portal/chart/${row.patientId}`} className="text-link">Chart</Link>
                    <Link href={`/portal/rpm/${row.patientId}`} className="text-link">RPM</Link>
                    <Link href={`/portal/orders/new?patientId=${encodeURIComponent(row.patientId)}`} className="text-link">Orders</Link>
                    <Link href={`/portal/prescriptions/new?patientId=${encodeURIComponent(row.patientId)}`} className="text-link">Rx</Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </ProviderTable>
        {loading ? <p className="muted small top-space">Loading patients…</p> : null}
        {!rows.length && !loading ? <p className="muted small top-space">No patients are currently available in this provider scope.</p> : null}
      </ProviderSectionCard>

      <div className="content-grid two-col top-align-grid">
        <ProviderSectionCard title="Fast actions" description="Common next steps remain routed to the original functional pages.">
          <div className="quick-link-grid">
            <Link href="/portal/queue" className="quick-link-card"><strong>Queue handoff</strong><p className="muted small">Open the functional appointment and refill queue.</p></Link>
            <Link href="/portal/labs/inbox" className="quick-link-card"><strong>Lab inbox</strong><p className="muted small">Review pending lab results and release readiness.</p></Link>
            <Link href="/portal/messages" className="quick-link-card"><strong>Messages</strong><p className="muted small">Follow up with patients and care-team threads.</p></Link>
          </div>
        </ProviderSectionCard>

        <ProviderSectionCard title="Safety note" description="Patient access is still governed by chart access and subject-profile permissions from the API.">
          <div className="detail-list">
            <div><span className="detail-label">Chart source</span><strong>/api/records</strong></div>
            <div><span className="detail-label">Access context</span><strong>/api/records/access-context</strong></div>
            <div><span className="detail-label">RPM source</span><strong>/api/provider/rpm/patients</strong></div>
          </div>
        </ProviderSectionCard>
      </div>
    </div>
  );
}
