'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getBrowserSession } from '@/lib/auth/browser-session';
import { adminApi } from '@/lib/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AppointmentStatus = 'REQUESTED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';

type AppointmentItem = {
  id: string;
  providerId: string;
  patientName: string;
  service: string;
  location: string;
  status: AppointmentStatus;
  startsAt: string;
  endsAt: string;
};

type ProviderOption = {
  id: string;
  name: string;
};

type ViewMode = 'day' | 'week' | 'month';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<AppointmentStatus, { bg: string; color: string; label: string }> = {
  REQUESTED: { bg: '#dbeafe', color: '#1e40af', label: 'Solicitada' },
  CONFIRMED: { bg: '#dcfce7', color: '#166534', label: 'Confirmada' },
  CANCELLED: { bg: '#e0e5ec', color: '#42536c', label: 'Cancelada' },
  COMPLETED: { bg: '#ede9fe', color: '#5b21b6', label: 'Completada' },
  NO_SHOW: { bg: '#fee2e2', color: '#991b1b', label: 'No asistió' },
};

const VIEW_LABELS: Record<ViewMode, string> = {
  day: 'Día',
  week: 'Semana',
  month: 'Mes',
};

const HOUR_START = 6; // 06:00
const HOUR_END = 23; // 23:00
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthWeeks(date: Date): Date[][] {
  const start = getMonthStart(date);
  const startDay = start.getDay();
  const firstWeekStart = new Date(start);
  firstWeekStart.setDate(firstWeekStart.getDate() - startDay);

  const weeks: Date[][] = [];
  let current = new Date(firstWeekStart);
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
    if (current.getMonth() !== date.getMonth() && w >= 3) break;
  }
  return weeks;
}

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function formatDateFull(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

function getRangeForView(date: Date, view: ViewMode): { from: string; to: string } {
  if (view === 'day') {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  if (view === 'week') {
    const weekStart = getWeekStart(date);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    return { from: weekStart.toISOString(), to: weekEnd.toISOString() };
  }
  const monthStart = getMonthStart(date);
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from: monthStart.toISOString(), to: monthEnd.toISOString() };
}

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------

async function fetchWithAuth<T>(path: string): Promise<T> {
  const session = getBrowserSession();
  const token = session.accessToken;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `API request failed: ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AppointmentBadge({ status }: { status: AppointmentStatus }) {
  const style = STATUS_COLORS[status] ?? STATUS_COLORS.REQUESTED;
  return (
    <span
      className="iam-badge"
      style={{ background: style.bg, color: style.color, fontSize: '0.72rem' }}
    >
      {style.label}
    </span>
  );
}

function AppointmentBlock({
  appointment,
  onClick,
}: {
  appointment: AppointmentItem;
  onClick?: (appt: AppointmentItem) => void;
}) {
  const style = STATUS_COLORS[appointment.status] ?? STATUS_COLORS.REQUESTED;
  return (
    <div
      className="schedule-appointment-block"
      style={{ borderLeft: `3px solid ${style.color}`, background: style.bg, cursor: onClick ? 'pointer' : undefined }}
      title={`${appointment.patientName} - ${appointment.service} (${formatTime(appointment.startsAt)} - ${formatTime(appointment.endsAt)})`}
      onClick={() => onClick?.(appointment)}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => { if (onClick && (e.key === 'Enter' || e.key === ' ')) onClick(appointment); }}
    >
      <div className="schedule-appt-time">
        {formatTime(appointment.startsAt)} – {formatTime(appointment.endsAt)}
      </div>
      <div className="schedule-appt-patient">{appointment.patientName}</div>
      <div className="schedule-appt-service muted">{appointment.service}</div>
      <div className="schedule-appt-meta">
        <span className="muted">{appointment.location}</span>
        <AppointmentBadge status={appointment.status} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Appointment Dialog
// ---------------------------------------------------------------------------

function CreateAppointmentDialog({
  providerId,
  onClose,
  onSuccess,
}: {
  providerId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [patientId, setPatientId] = useState('');
  const [service, setService] = useState('');
  const [location, setLocation] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await adminApi.iamCreateAppointment(providerId, {
        patientId: patientId.trim(),
        service: service.trim(),
        location: location.trim(),
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      });
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al crear la cita.';
      setError(parseApiError(msg));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="iam-dialog-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Crear cita">
      <div className="iam-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Crear Cita</h3>
        <form onSubmit={handleSubmit}>
          <div className="iam-dialog-field">
            <label htmlFor="appt-patient-id">ID del Paciente</label>
            <input
              id="appt-patient-id"
              className="input"
              type="text"
              required
              placeholder="ID del paciente"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
            />
          </div>
          <div className="iam-dialog-field">
            <label htmlFor="appt-service">Servicio</label>
            <input
              id="appt-service"
              className="input"
              type="text"
              required
              placeholder="Tipo de servicio"
              value={service}
              onChange={(e) => setService(e.target.value)}
            />
          </div>
          <div className="iam-dialog-field">
            <label htmlFor="appt-location">Ubicación</label>
            <input
              id="appt-location"
              className="input"
              type="text"
              required
              placeholder="Ubicación"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className="iam-dialog-field">
            <label htmlFor="appt-starts-at">Inicio</label>
            <input
              id="appt-starts-at"
              className="input"
              type="datetime-local"
              required
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>
          <div className="iam-dialog-field">
            <label htmlFor="appt-ends-at">Fin</label>
            <input
              id="appt-ends-at"
              className="input"
              type="datetime-local"
              required
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </div>
          {error && (
            <div className="banner warning" style={{ marginTop: 8 }}>{error}</div>
          )}
          <div className="iam-dialog-actions">
            <button type="button" className="button secondary" onClick={onClose} disabled={submitting}>
              Cancelar
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={submitting || !patientId.trim() || !service.trim() || !location.trim() || !startsAt || !endsAt}
            >
              {submitting ? 'Creando…' : 'Crear Cita'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reschedule Appointment Dialog
// ---------------------------------------------------------------------------

function RescheduleDialog({
  appointment,
  onClose,
  onSuccess,
}: {
  appointment: AppointmentItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [newStartsAt, setNewStartsAt] = useState('');
  const [newEndsAt, setNewEndsAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await adminApi.iamRescheduleAppointment(appointment.id, {
        startsAt: new Date(newStartsAt).toISOString(),
        endsAt: new Date(newEndsAt).toISOString(),
      });
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al reprogramar la cita.';
      setError(parseApiError(msg));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="iam-dialog-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Reprogramar cita">
      <div className="iam-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Reprogramar Cita</h3>
        <div style={{ marginBottom: 16, padding: '12px', background: '#f8fafc', borderRadius: 6 }}>
          <p style={{ margin: '0 0 4px', fontWeight: 600 }}>Horario actual:</p>
          <p className="muted" style={{ margin: 0 }}>
            {formatTime(appointment.startsAt)} – {formatTime(appointment.endsAt)}
            {' '}({new Date(appointment.startsAt).toLocaleDateString()})
          </p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="iam-dialog-field">
            <label htmlFor="reschedule-starts-at">Nuevo inicio</label>
            <input
              id="reschedule-starts-at"
              className="input"
              type="datetime-local"
              required
              value={newStartsAt}
              onChange={(e) => setNewStartsAt(e.target.value)}
            />
          </div>
          <div className="iam-dialog-field">
            <label htmlFor="reschedule-ends-at">Nuevo fin</label>
            <input
              id="reschedule-ends-at"
              className="input"
              type="datetime-local"
              required
              value={newEndsAt}
              onChange={(e) => setNewEndsAt(e.target.value)}
            />
          </div>
          {error && (
            <div className="banner warning" style={{ marginTop: 8 }}>{error}</div>
          )}
          <div className="iam-dialog-actions">
            <button type="button" className="button secondary" onClick={onClose} disabled={submitting}>
              Cancelar
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={submitting || !newStartsAt || !newEndsAt}
            >
              {submitting ? 'Reprogramando…' : 'Confirmar Reprogramación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cancel Appointment Dialog
// ---------------------------------------------------------------------------

function CancelDialog({
  appointment,
  onClose,
  onSuccess,
}: {
  appointment: AppointmentItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reasonLength = reason.length;
  const reasonValid = reasonLength >= 1 && reasonLength <= 500;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasonValid) return;
    setSubmitting(true);
    setError(null);
    try {
      await adminApi.iamCancelAppointment(appointment.id, { reason: reason.trim() });
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al cancelar la cita.';
      setError(parseApiError(msg));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="iam-dialog-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Cancelar cita">
      <div className="iam-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Cancelar Cita</h3>
        <div style={{ marginBottom: 16, padding: '12px', background: '#fef2f2', borderRadius: 6 }}>
          <p style={{ margin: '0 0 4px', fontWeight: 600 }}>Cita a cancelar:</p>
          <p className="muted" style={{ margin: 0 }}>
            {appointment.patientName} — {appointment.service}
          </p>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            {formatTime(appointment.startsAt)} – {formatTime(appointment.endsAt)}
            {' '}({new Date(appointment.startsAt).toLocaleDateString()})
          </p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="iam-dialog-field">
            <label htmlFor="cancel-reason">Motivo de cancelación</label>
            <textarea
              id="cancel-reason"
              className="input"
              required
              rows={3}
              maxLength={500}
              placeholder="Ingrese el motivo de cancelación (1-500 caracteres)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{ resize: 'vertical', minHeight: 72 }}
            />
            <span className="muted" style={{ fontSize: '0.8rem' }}>
              {reasonLength}/500 caracteres
              {reasonLength > 0 && !reasonValid && ' — Mínimo 1, máximo 500 caracteres'}
            </span>
          </div>
          {error && (
            <div className="banner warning" style={{ marginTop: 8 }}>{error}</div>
          )}
          <div className="iam-dialog-actions">
            <button type="button" className="button secondary" onClick={onClose} disabled={submitting}>
              Volver
            </button>
            <button
              type="submit"
              className="button danger"
              disabled={submitting || !reasonValid}
            >
              {submitting ? 'Cancelando…' : 'Confirmar Cancelación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Appointment Detail Panel
// ---------------------------------------------------------------------------

function AppointmentDetailPanel({
  appointment,
  onClose,
  onReschedule,
  onCancel,
}: {
  appointment: AppointmentItem;
  onClose: () => void;
  onReschedule: () => void;
  onCancel: () => void;
}) {
  const canModify = appointment.status !== 'CANCELLED' && appointment.status !== 'COMPLETED';

  return (
    <div className="iam-dialog-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Detalle de cita">
      <div className="iam-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Detalle de Cita</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <span className="muted" style={{ fontSize: '0.8rem' }}>Paciente</span>
            <p style={{ margin: '2px 0 0', fontWeight: 600 }}>{appointment.patientName}</p>
          </div>
          <div>
            <span className="muted" style={{ fontSize: '0.8rem' }}>Servicio</span>
            <p style={{ margin: '2px 0 0' }}>{appointment.service}</p>
          </div>
          <div>
            <span className="muted" style={{ fontSize: '0.8rem' }}>Ubicación</span>
            <p style={{ margin: '2px 0 0' }}>{appointment.location}</p>
          </div>
          <div>
            <span className="muted" style={{ fontSize: '0.8rem' }}>Horario</span>
            <p style={{ margin: '2px 0 0' }}>
              {formatTime(appointment.startsAt)} – {formatTime(appointment.endsAt)}
              {' '}({new Date(appointment.startsAt).toLocaleDateString()})
            </p>
          </div>
          <div>
            <span className="muted" style={{ fontSize: '0.8rem' }}>Estado</span>
            <p style={{ margin: '2px 0 0' }}>
              <AppointmentBadge status={appointment.status} />
            </p>
          </div>
        </div>
        <div className="iam-dialog-actions" style={{ marginTop: 20 }}>
          <button type="button" className="button secondary" onClick={onClose}>
            Cerrar
          </button>
          {canModify && (
            <>
              <button type="button" className="button primary" onClick={onReschedule}>
                Reprogramar
              </button>
              <button type="button" className="button danger" onClick={onCancel}>
                Cancelar Cita
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error parsing helper
// ---------------------------------------------------------------------------

function parseApiError(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    if (parsed.error) return parsed.error;
    if (parsed.message) return parsed.message;
    return raw;
  } catch {
    // Check for common known error patterns
    if (raw.includes('conflicts with existing appointments') || raw.includes('conflict')) {
      return raw;
    }
    if (raw.includes('outside') && raw.includes('06:00') && raw.includes('23:00')) {
      return raw;
    }
    return raw;
  }
}

// ---------------------------------------------------------------------------
// Week View
// ---------------------------------------------------------------------------

function WeekView({
  appointments,
  currentDate,
  onAppointmentClick,
}: {
  appointments: AppointmentItem[];
  currentDate: Date;
  onAppointmentClick: (appt: AppointmentItem) => void;
}) {
  const weekStart = getWeekStart(currentDate);
  const days = getWeekDays(weekStart);

  const appointmentsByDay = useMemo(() => {
    const map: Record<string, AppointmentItem[]> = {};
    for (const day of days) {
      const key = day.toISOString().slice(0, 10);
      map[key] = [];
    }
    for (const appt of appointments) {
      const key = new Date(appt.startsAt).toISOString().slice(0, 10);
      if (map[key]) {
        map[key].push(appt);
      }
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    }
    return map;
  }, [appointments, days]);

  return (
    <div className="schedule-week-grid">
      <div className="schedule-week-header">
        <div className="schedule-time-gutter-header" />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={`schedule-day-header ${isToday(day) ? 'schedule-today' : ''}`}
          >
            <span className="schedule-day-name">{DAY_NAMES[day.getDay()]}</span>
            <span className="schedule-day-num">{day.getDate()}</span>
          </div>
        ))}
      </div>
      <div className="schedule-week-body">
        <div className="schedule-time-gutter">
          {HOURS.map((hour) => (
            <div key={hour} className="schedule-time-slot">
              <span className="muted">{formatHour(hour)}</span>
            </div>
          ))}
        </div>
        {days.map((day) => {
          const key = day.toISOString().slice(0, 10);
          const dayAppts = appointmentsByDay[key] ?? [];
          return (
            <div
              key={key}
              className={`schedule-day-column ${isToday(day) ? 'schedule-today-col' : ''}`}
            >
              {HOURS.map((hour) => (
                <div key={hour} className="schedule-hour-cell" />
              ))}
              <div className="schedule-day-appointments">
                {dayAppts.map((appt) => {
                  const start = new Date(appt.startsAt);
                  const end = new Date(appt.endsAt);
                  const topMinutes = (start.getHours() - HOUR_START) * 60 + start.getMinutes();
                  const durationMinutes = (end.getTime() - start.getTime()) / 60000;
                  const topPercent = (topMinutes / ((HOUR_END - HOUR_START) * 60)) * 100;
                  const heightPercent = (durationMinutes / ((HOUR_END - HOUR_START) * 60)) * 100;
                  const statusStyle = STATUS_COLORS[appt.status] ?? STATUS_COLORS.REQUESTED;

                  return (
                    <div
                      key={appt.id}
                      className="schedule-appt-overlay"
                      style={{
                        top: `${topPercent}%`,
                        height: `${Math.max(heightPercent, 2)}%`,
                        borderLeft: `3px solid ${statusStyle.color}`,
                        background: statusStyle.bg,
                        cursor: 'pointer',
                      }}
                      title={`${appt.patientName} - ${appt.service}\n${formatTime(appt.startsAt)} – ${formatTime(appt.endsAt)}\n${appt.location}\n${STATUS_COLORS[appt.status]?.label}`}
                      onClick={() => onAppointmentClick(appt)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onAppointmentClick(appt); }}
                    >
                      <span className="schedule-overlay-time">{formatTime(appt.startsAt)}</span>
                      <span className="schedule-overlay-patient">{appt.patientName}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day View
// ---------------------------------------------------------------------------

function DayView({
  appointments,
  currentDate,
  onAppointmentClick,
}: {
  appointments: AppointmentItem[];
  currentDate: Date;
  onAppointmentClick: (appt: AppointmentItem) => void;
}) {
  const dayAppts = useMemo(() => {
    const dateKey = currentDate.toISOString().slice(0, 10);
    return appointments
      .filter((a) => new Date(a.startsAt).toISOString().slice(0, 10) === dateKey)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [appointments, currentDate]);

  return (
    <div className="schedule-day-view">
      <h4 style={{ margin: '0 0 12px' }}>{formatDateFull(currentDate)}</h4>
      {dayAppts.length === 0 ? (
        <div className="iam-empty-state">
          <p>No hay citas programadas para este día.</p>
        </div>
      ) : (
        <div className="schedule-day-list">
          {dayAppts.map((appt) => (
            <AppointmentBlock key={appt.id} appointment={appt} onClick={onAppointmentClick} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Month View
// ---------------------------------------------------------------------------

function MonthView({
  appointments,
  currentDate,
  onAppointmentClick,
}: {
  appointments: AppointmentItem[];
  currentDate: Date;
  onAppointmentClick: (appt: AppointmentItem) => void;
}) {
  const weeks = getMonthWeeks(currentDate);

  const appointmentsByDay = useMemo(() => {
    const map: Record<string, AppointmentItem[]> = {};
    for (const appt of appointments) {
      const key = new Date(appt.startsAt).toISOString().slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(appt);
    }
    return map;
  }, [appointments]);

  return (
    <div className="schedule-month-grid">
      <div className="schedule-month-header">
        {DAY_NAMES.map((name) => (
          <div key={name} className="schedule-month-day-name">{name}</div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="schedule-month-week">
          {week.map((day) => {
            const key = day.toISOString().slice(0, 10);
            const dayAppts = appointmentsByDay[key] ?? [];
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
            return (
              <div
                key={key}
                className={`schedule-month-cell ${!isCurrentMonth ? 'schedule-other-month' : ''} ${isToday(day) ? 'schedule-today-cell' : ''}`}
              >
                <span className="schedule-month-date">{day.getDate()}</span>
                {dayAppts.slice(0, 3).map((appt) => {
                  const statusStyle = STATUS_COLORS[appt.status] ?? STATUS_COLORS.REQUESTED;
                  return (
                    <div
                      key={appt.id}
                      className="schedule-month-appt"
                      style={{ borderLeft: `3px solid ${statusStyle.color}`, background: statusStyle.bg, cursor: 'pointer' }}
                      title={`${appt.patientName} - ${appt.service} (${formatTime(appt.startsAt)})`}
                      onClick={() => onAppointmentClick(appt)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onAppointmentClick(appt); }}
                    >
                      <span>{formatTime(appt.startsAt)} {appt.patientName}</span>
                    </div>
                  );
                })}
                {dayAppts.length > 3 && (
                  <span className="schedule-month-more muted">+{dayAppts.length - 3} más</span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function IamSchedulePage() {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentItem | null>(null);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // Load providers for selector
  useEffect(() => {
    async function loadProviders() {
      setLoadingProviders(true);
      try {
        const data = await fetchWithAuth<{ items: ProviderOption[] }>(
          '/api/admin/users/providers/iam?pageSize=100'
        );
        const opts = (data.items ?? []).map((p) => ({ id: p.id, name: p.name }));
        setProviders(opts);
        if (opts.length > 0 && !selectedProviderId) {
          setSelectedProviderId(opts[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar proveedores');
      } finally {
        setLoadingProviders(false);
      }
    }
    loadProviders();
  }, []);

  // Load appointments for selected provider and date range
  const fetchAppointments = useCallback(async () => {
    if (!selectedProviderId) return;
    setLoading(true);
    setError(null);
    try {
      const { from, to } = getRangeForView(currentDate, viewMode);
      const params = new URLSearchParams({ from, to });
      const data = await fetchWithAuth<{ items: AppointmentItem[] }>(
        `/api/iam/schedules/${selectedProviderId}/appointments?${params.toString()}`
      );
      setAppointments(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar citas');
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [selectedProviderId, currentDate, viewMode]);

  useEffect(() => {
    void fetchAppointments();
  }, [fetchAppointments]);

  // Navigation
  const goToday = () => setCurrentDate(new Date());

  const goPrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'day') d.setDate(d.getDate() - 1);
    else if (viewMode === 'week') d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };

  const goNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'day') d.setDate(d.getDate() + 1);
    else if (viewMode === 'week') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  // Heading text
  const headingText = useMemo(() => {
    if (viewMode === 'day') return formatDateFull(currentDate);
    if (viewMode === 'week') {
      const weekStart = getWeekStart(currentDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return `${formatDateShort(weekStart)} – ${formatDateShort(weekEnd)}, ${weekEnd.getFullYear()}`;
    }
    return currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, [currentDate, viewMode]);

  // Appointment click handler
  const handleAppointmentClick = (appt: AppointmentItem) => {
    setSelectedAppointment(appt);
  };

  // Dialog success handlers (refresh list on success)
  const handleCreateSuccess = () => {
    setShowCreateDialog(false);
    void fetchAppointments();
  };

  const handleRescheduleSuccess = () => {
    setShowRescheduleDialog(false);
    setSelectedAppointment(null);
    void fetchAppointments();
  };

  const handleCancelSuccess = () => {
    setShowCancelDialog(false);
    setSelectedAppointment(null);
    void fetchAppointments();
  };

  // Transition from detail panel to reschedule/cancel
  const openReschedule = () => {
    setShowRescheduleDialog(true);
  };

  const openCancel = () => {
    setShowCancelDialog(true);
  };

  return (
    <div className="iam-schedule-page">
      {/* Page header */}
      <div className="iam-page-header">
        <div>
          <h3 style={{ margin: 0 }}>Agenda</h3>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Visualiza y gestiona las citas de los proveedores.
          </p>
        </div>
        <div>
          <button
            className="button primary"
            onClick={() => setShowCreateDialog(true)}
            disabled={!selectedProviderId}
          >
            + Crear Cita
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="schedule-toolbar">
        {/* Provider selector */}
        <div className="schedule-toolbar-group">
          <label htmlFor="schedule-provider-select" className="schedule-label">
            Proveedor:
          </label>
          <select
            id="schedule-provider-select"
            className="iam-input"
            value={selectedProviderId}
            onChange={(e) => setSelectedProviderId(e.target.value)}
            disabled={loadingProviders}
            aria-label="Seleccionar proveedor"
          >
            {loadingProviders && <option value="">Cargando...</option>}
            {!loadingProviders && providers.length === 0 && (
              <option value="">Sin proveedores</option>
            )}
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* View mode toggle */}
        <div className="schedule-toolbar-group schedule-view-toggle" role="group" aria-label="Modo de vista">
          {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              className={`button ${viewMode === mode ? 'primary' : 'secondary'}`}
              onClick={() => setViewMode(mode)}
              aria-pressed={viewMode === mode}
            >
              {VIEW_LABELS[mode]}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="schedule-toolbar-group schedule-nav">
          <button className="button secondary" onClick={goPrev} aria-label="Anterior">
            ←
          </button>
          <button className="button secondary" onClick={goToday}>
            Hoy
          </button>
          <button className="button secondary" onClick={goNext} aria-label="Siguiente">
            →
          </button>
        </div>
      </div>

      {/* Date heading */}
      <div className="schedule-date-heading">
        <span>{headingText}</span>
      </div>

      {/* Status legend */}
      <div className="schedule-legend">
        {(Object.entries(STATUS_COLORS) as [AppointmentStatus, typeof STATUS_COLORS[AppointmentStatus]][]).map(
          ([status, style]) => (
            <div key={status} className="schedule-legend-item">
              <span
                className="schedule-legend-dot"
                style={{ background: style.color }}
              />
              <span className="muted">{style.label}</span>
            </div>
          )
        )}
      </div>

      {/* Error */}
      {error && <div className="iam-error">{error}</div>}

      {/* Loading */}
      {loading && (
        <div className="iam-loading">Cargando citas...</div>
      )}

      {/* Calendar views */}
      {!loading && (
        <>
          {viewMode === 'week' && (
            <WeekView appointments={appointments} currentDate={currentDate} onAppointmentClick={handleAppointmentClick} />
          )}
          {viewMode === 'day' && (
            <DayView appointments={appointments} currentDate={currentDate} onAppointmentClick={handleAppointmentClick} />
          )}
          {viewMode === 'month' && (
            <MonthView appointments={appointments} currentDate={currentDate} onAppointmentClick={handleAppointmentClick} />
          )}
        </>
      )}

      {/* Empty state */}
      {!loading && !error && appointments.length === 0 && selectedProviderId && (
        <div className="iam-empty-state">
          <p>No hay citas para el periodo seleccionado.</p>
        </div>
      )}

      {/* Create Appointment Dialog */}
      {showCreateDialog && selectedProviderId && (
        <CreateAppointmentDialog
          providerId={selectedProviderId}
          onClose={() => setShowCreateDialog(false)}
          onSuccess={handleCreateSuccess}
        />
      )}

      {/* Appointment Detail Panel */}
      {selectedAppointment && !showRescheduleDialog && !showCancelDialog && (
        <AppointmentDetailPanel
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onReschedule={openReschedule}
          onCancel={openCancel}
        />
      )}

      {/* Reschedule Dialog */}
      {selectedAppointment && showRescheduleDialog && (
        <RescheduleDialog
          appointment={selectedAppointment}
          onClose={() => setShowRescheduleDialog(false)}
          onSuccess={handleRescheduleSuccess}
        />
      )}

      {/* Cancel Dialog */}
      {selectedAppointment && showCancelDialog && (
        <CancelDialog
          appointment={selectedAppointment}
          onClose={() => setShowCancelDialog(false)}
          onSuccess={handleCancelSuccess}
        />
      )}
    </div>
  );
}
