'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getBrowserSession } from '@/lib/auth/browser-session';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DayPattern = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

type ScheduleTemplate = {
  id: string;
  name: string;
  providerId: string;
  organizationId: string;
  dayPatterns: DayPattern[];
  serviceType: string;
  location: string;
  serviceModes: string[];
  duration: number;
  buffer: number;
  capacity: number;
  status: 'DRAFT' | 'PUBLISHED';
  createdAt: string;
  updatedAt: string;
};

type PublishedSlot = {
  id: string;
  startsAt: string;
  endsAt: string;
  service: string;
  location: string;
  capacity: number;
  bookedCount: number;
  status: 'AVAILABLE' | 'HELD' | 'BOOKED';
};

type ProviderOption = {
  id: string;
  name: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAYS_OF_WEEK = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const SERVICE_MODES = ['IN_PERSON', 'TELEHEALTH', 'HOME_VISIT'];

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  DRAFT: { bg: '#e0e5ec', color: '#42536c', label: 'Borrador' },
  PUBLISHED: { bg: '#dcfce7', color: '#166534', label: 'Publicado' },
};

const SLOT_STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  AVAILABLE: { bg: '#dcfce7', color: '#166534' },
  HELD: { bg: '#fef9c3', color: '#854d0e' },
  BOOKED: { bg: '#dbeafe', color: '#1e40af' },
};

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

async function fetchWithAuth<T>(path: string, init?: RequestInit): Promise<T> {
  const session = getBrowserSession();
  const token = session.accessToken;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
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
// Validation helpers
// ---------------------------------------------------------------------------

type ValidationErrors = Record<string, string>;

function validateTemplateForm(form: {
  name: string;
  dayPatterns: DayPattern[];
  serviceType: string;
  location: string;
  serviceModes: string[];
  duration: string;
  buffer: string;
  capacity: string;
}): ValidationErrors {
  const errors: ValidationErrors = {};

  if (form.name.trim().length < 2) {
    errors.name = 'El nombre debe tener al menos 2 caracteres.';
  }
  if (form.dayPatterns.length === 0) {
    errors.dayPatterns = 'Debe agregar al menos un patrón de día.';
  }
  for (let i = 0; i < form.dayPatterns.length; i++) {
    const dp = form.dayPatterns[i];
    if (dp.startTime >= dp.endTime) {
      errors[`dayPattern_${i}`] = `El rango de tiempo del ${DAYS_OF_WEEK[dp.dayOfWeek]} es inválido (inicio debe ser antes del fin).`;
    }
  }
  if (!form.serviceType.trim()) {
    errors.serviceType = 'El tipo de servicio es requerido.';
  }
  if (!form.location.trim()) {
    errors.location = 'La ubicación es requerida.';
  }
  if (form.serviceModes.length === 0) {
    errors.serviceModes = 'Debe seleccionar al menos un modo de servicio.';
  }
  const duration = Number(form.duration);
  if (isNaN(duration) || duration < 1 || duration > 480) {
    errors.duration = 'La duración debe estar entre 1 y 480 minutos.';
  }
  const buffer = Number(form.buffer);
  if (isNaN(buffer) || buffer < 0 || buffer > 120) {
    errors.buffer = 'El buffer debe estar entre 0 y 120 minutos.';
  }
  const capacity = Number(form.capacity);
  if (isNaN(capacity) || capacity < 1 || capacity > 20) {
    errors.capacity = 'La capacidad debe estar entre 1 y 20.';
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function TemplateBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.DRAFT;
  return (
    <span className="iam-badge" style={{ background: style.bg, color: style.color }}>
      {style.label}
    </span>
  );
}

function WeeklyGrid({ templates }: { templates: ScheduleTemplate[] }) {
  // Build grid: for each day (0-6), collect all time blocks from all templates
  const dayBlocks = useMemo(() => {
    const grid: Record<number, Array<{ template: ScheduleTemplate; pattern: DayPattern }>> = {};
    for (let d = 0; d < 7; d++) grid[d] = [];
    for (const tpl of templates) {
      for (const dp of tpl.dayPatterns) {
        grid[dp.dayOfWeek].push({ template: tpl, pattern: dp });
      }
    }
    // Sort each day by startTime
    for (let d = 0; d < 7; d++) {
      grid[d].sort((a, b) => a.pattern.startTime.localeCompare(b.pattern.startTime));
    }
    return grid;
  }, [templates]);

  return (
    <div className="iam-weekly-grid">
      {DAYS_OF_WEEK.map((dayName, idx) => (
        <div key={idx} className="iam-weekly-day">
          <div className="iam-weekly-day-header">{DAYS_SHORT[idx]}</div>
          <div className="iam-weekly-day-blocks">
            {dayBlocks[idx].length === 0 && (
              <div className="iam-weekly-empty">—</div>
            )}
            {dayBlocks[idx].map((block, i) => (
              <div
                key={i}
                className="iam-weekly-block"
                style={{
                  borderLeftColor: block.template.status === 'PUBLISHED' ? '#166534' : '#42536c',
                }}
              >
                <div className="iam-weekly-block-time">
                  {block.pattern.startTime} – {block.pattern.endTime}
                </div>
                <div className="iam-weekly-block-info">
                  <span>{block.template.serviceType}</span>
                  <span className="muted">{block.template.location}</span>
                </div>
                <div className="iam-weekly-block-meta muted">
                  {block.template.duration}min · {block.template.status === 'PUBLISHED' ? 'Publicado' : 'Borrador'}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SlotPreview({ slots }: { slots: PublishedSlot[] }) {
  if (slots.length === 0) {
    return <p className="muted">No hay slots publicados para este proveedor.</p>;
  }

  return (
    <div className="iam-slot-preview">
      <h4>Slots publicados ({slots.length})</h4>
      <div className="iam-slot-list">
        {slots.slice(0, 20).map((slot) => {
          const style = SLOT_STATUS_STYLES[slot.status] ?? SLOT_STATUS_STYLES.AVAILABLE;
          return (
            <div key={slot.id} className="iam-slot-item">
              <div className="iam-slot-time">
                {new Date(slot.startsAt).toLocaleDateString('es', { weekday: 'short', month: 'short', day: 'numeric' })}
                {' '}
                {new Date(slot.startsAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                {' – '}
                {new Date(slot.endsAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="iam-slot-details">
                <span>{slot.service}</span>
                <span className="muted">{slot.location}</span>
                <span className="iam-badge" style={{ background: style.bg, color: style.color }}>
                  {slot.status}
                </span>
                <span className="muted">{slot.bookedCount}/{slot.capacity}</span>
              </div>
            </div>
          );
        })}
        {slots.length > 20 && (
          <p className="muted">Mostrando 20 de {slots.length} slots.</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Template Dialog
// ---------------------------------------------------------------------------

function CreateTemplateDialog({
  providerId,
  onClose,
  onCreated,
}: {
  providerId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [dayPatterns, setDayPatterns] = useState<DayPattern[]>([]);
  const [serviceType, setServiceType] = useState('');
  const [location, setLocation] = useState('');
  const [serviceModes, setServiceModes] = useState<string[]>([]);
  const [duration, setDuration] = useState('30');
  const [buffer, setBuffer] = useState('0');
  const [capacity, setCapacity] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  // Day pattern editing
  const [newDayOfWeek, setNewDayOfWeek] = useState(1);
  const [newStartTime, setNewStartTime] = useState('08:00');
  const [newEndTime, setNewEndTime] = useState('17:00');

  const addDayPattern = () => {
    setDayPatterns((prev) => [...prev, { dayOfWeek: newDayOfWeek, startTime: newStartTime, endTime: newEndTime }]);
    setValidationErrors((prev) => { const n = { ...prev }; delete n.dayPatterns; return n; });
  };

  const removeDayPattern = (index: number) => {
    setDayPatterns((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleServiceMode = (mode: string) => {
    setServiceModes((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const errors = validateTemplateForm({
      name, dayPatterns, serviceType, location, serviceModes, duration, buffer, capacity,
    });
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      await fetchWithAuth(`/api/iam/availability/${providerId}/templates`, {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          dayPatterns,
          serviceType: serviceType.trim(),
          location: location.trim(),
          serviceModes,
          duration: Number(duration),
          buffer: Number(buffer),
          capacity: Number(capacity),
        }),
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear template.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="iam-drawer-overlay" onClick={onClose} role="presentation">
      <div className="iam-dialog iam-dialog-wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Crear template">
        <div className="iam-drawer-header">
          <h3 style={{ margin: 0 }}>Crear Template de Disponibilidad</h3>
          <button className="button secondary" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="iam-dialog-form">
          {error && <div className="iam-error">{error}</div>}

          <div className="iam-form-row">
            <label htmlFor="tpl-name">Nombre *</label>
            <input
              id="tpl-name"
              className="iam-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Consultas generales mañana"
              required
            />
            {validationErrors.name && <span className="iam-field-error">{validationErrors.name}</span>}
          </div>

          {/* Day Patterns */}
          <div className="iam-form-row">
            <label>Patrones de día *</label>
            <div className="iam-day-pattern-builder">
              <select
                className="iam-input"
                value={newDayOfWeek}
                onChange={(e) => setNewDayOfWeek(Number(e.target.value))}
                aria-label="Día de la semana"
              >
                {DAYS_OF_WEEK.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
              <input
                className="iam-input"
                type="time"
                value={newStartTime}
                onChange={(e) => setNewStartTime(e.target.value)}
                aria-label="Hora inicio"
              />
              <input
                className="iam-input"
                type="time"
                value={newEndTime}
                onChange={(e) => setNewEndTime(e.target.value)}
                aria-label="Hora fin"
              />
              <button type="button" className="button secondary" onClick={addDayPattern}>
                + Agregar
              </button>
            </div>
            {validationErrors.dayPatterns && <span className="iam-field-error">{validationErrors.dayPatterns}</span>}
          </div>

          {/* Day pattern list */}
          {dayPatterns.length > 0 && (
            <div className="iam-day-pattern-list">
              {dayPatterns.map((dp, i) => (
                <div key={i} className="iam-day-pattern-item">
                  <span>{DAYS_OF_WEEK[dp.dayOfWeek]}: {dp.startTime} – {dp.endTime}</span>
                  {validationErrors[`dayPattern_${i}`] && (
                    <span className="iam-field-error">{validationErrors[`dayPattern_${i}`]}</span>
                  )}
                  <button type="button" className="button danger" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => removeDayPattern(i)}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="iam-form-row">
            <label htmlFor="tpl-serviceType">Tipo de servicio *</label>
            <input
              id="tpl-serviceType"
              className="iam-input"
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              placeholder="Ej: Consulta general"
              required
            />
            {validationErrors.serviceType && <span className="iam-field-error">{validationErrors.serviceType}</span>}
          </div>

          <div className="iam-form-row">
            <label htmlFor="tpl-location">Ubicación *</label>
            <input
              id="tpl-location"
              className="iam-input"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ej: Consultorio A"
              required
            />
            {validationErrors.location && <span className="iam-field-error">{validationErrors.location}</span>}
          </div>

          <div className="iam-form-row">
            <label>Modos de servicio *</label>
            <div className="iam-mode-toggles">
              {SERVICE_MODES.map((mode) => (
                <label key={mode} className="iam-toggle-label">
                  <input
                    type="checkbox"
                    checked={serviceModes.includes(mode)}
                    onChange={() => toggleServiceMode(mode)}
                  />
                  {mode.replace(/_/g, ' ')}
                </label>
              ))}
            </div>
            {validationErrors.serviceModes && <span className="iam-field-error">{validationErrors.serviceModes}</span>}
          </div>

          <div className="iam-form-row-group">
            <div className="iam-form-row">
              <label htmlFor="tpl-duration">Duración (min) *</label>
              <input
                id="tpl-duration"
                className="iam-input"
                type="number"
                min="1"
                max="480"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
              {validationErrors.duration && <span className="iam-field-error">{validationErrors.duration}</span>}
            </div>
            <div className="iam-form-row">
              <label htmlFor="tpl-buffer">Buffer (min)</label>
              <input
                id="tpl-buffer"
                className="iam-input"
                type="number"
                min="0"
                max="120"
                value={buffer}
                onChange={(e) => setBuffer(e.target.value)}
              />
              {validationErrors.buffer && <span className="iam-field-error">{validationErrors.buffer}</span>}
            </div>
            <div className="iam-form-row">
              <label htmlFor="tpl-capacity">Capacidad</label>
              <input
                id="tpl-capacity"
                className="iam-input"
                type="number"
                min="1"
                max="20"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
              {validationErrors.capacity && <span className="iam-field-error">{validationErrors.capacity}</span>}
            </div>
          </div>

          <div className="iam-dialog-actions">
            <button type="button" className="button secondary" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <button type="submit" className="button primary" disabled={isSubmitting}>
              {isSubmitting ? 'Creando…' : 'Crear Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Time-Off Dialog
// ---------------------------------------------------------------------------

function TimeOffDialog({
  providerId,
  onClose,
  onCreated,
}: {
  providerId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!startsAt || !endsAt) {
      setError('Debe especificar las fechas de inicio y fin.');
      return;
    }
    if (new Date(startsAt) >= new Date(endsAt)) {
      setError('La fecha de inicio debe ser anterior a la fecha de fin.');
      return;
    }

    setIsSubmitting(true);
    try {
      await fetchWithAuth(`/api/iam/availability/${providerId}/time-off`, {
        method: 'POST',
        body: JSON.stringify({
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          reason: reason.trim() || undefined,
        }),
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear bloque de tiempo libre.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="iam-drawer-overlay" onClick={onClose} role="presentation">
      <div className="iam-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Crear tiempo libre">
        <div className="iam-drawer-header">
          <h3 style={{ margin: 0 }}>Crear Bloque de Tiempo Libre</h3>
          <button className="button secondary" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="iam-dialog-form">
          {error && <div className="iam-error">{error}</div>}

          <div className="iam-form-row">
            <label htmlFor="to-starts">Fecha y hora de inicio *</label>
            <input
              id="to-starts"
              className="iam-input"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              required
            />
          </div>

          <div className="iam-form-row">
            <label htmlFor="to-ends">Fecha y hora de fin *</label>
            <input
              id="to-ends"
              className="iam-input"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              required
            />
          </div>

          <div className="iam-form-row">
            <label htmlFor="to-reason">Razón (opcional)</label>
            <textarea
              id="to-reason"
              className="iam-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Ej: Vacaciones, cita médica..."
            />
          </div>

          <div className="iam-dialog-actions">
            <button type="button" className="button secondary" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <button type="submit" className="button primary" disabled={isSubmitting}>
              {isSubmitting ? 'Creando…' : 'Crear Tiempo Libre'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function IamAvailabilityPage() {
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [slots, setSlots] = useState<PublishedSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Dialog state
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [showTimeOff, setShowTimeOff] = useState(false);

  // Publishing state
  const [publishingId, setPublishingId] = useState<string | null>(null);

  // Load providers
  useEffect(() => {
    async function loadProviders() {
      try {
        const params = new URLSearchParams({ page: '1', pageSize: '100' });
        const data = await fetchWithAuth<{ items: Array<{ id: string; name: string; firstName: string; lastName: string }> }>(
          `/api/admin/users/providers/iam?${params.toString()}`
        );
        setProviders(
          (data.items ?? []).map((p) => ({ id: p.id, name: p.name || `${p.firstName} ${p.lastName}` }))
        );
      } catch {
        // Providers might not load if no permission, ignore
      }
    }
    void loadProviders();
  }, []);

  // Load templates and slots when provider changes
  const loadAvailability = useCallback(async (providerId: string) => {
    if (!providerId) {
      setTemplates([]);
      setSlots([]);
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const [tplData, slotData] = await Promise.all([
        fetchWithAuth<{ items: ScheduleTemplate[] }>(`/api/iam/availability/${providerId}/templates`),
        fetchWithAuth<{ items: PublishedSlot[] }>(`/api/iam/availability/${providerId}/slots`),
      ]);
      setTemplates(tplData.items ?? []);
      setSlots(slotData.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar disponibilidad.');
      setTemplates([]);
      setSlots([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProviderId) {
      void loadAvailability(selectedProviderId);
    }
  }, [selectedProviderId, loadAvailability]);

  // Publish/Unpublish handler
  const handlePublish = async (templateId: string) => {
    setPublishingId(templateId);
    try {
      await fetchWithAuth(`/api/iam/availability/templates/${templateId}/publish`, {
        method: 'POST',
      });
      void loadAvailability(selectedProviderId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al publicar template.');
    } finally {
      setPublishingId(null);
    }
  };

  const handleUnpublish = async (templateId: string) => {
    setPublishingId(templateId);
    try {
      await fetchWithAuth(`/api/iam/availability/templates/${templateId}/unpublish`, {
        method: 'POST',
      });
      void loadAvailability(selectedProviderId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al despublicar template.');
    } finally {
      setPublishingId(null);
    }
  };

  return (
    <div className="iam-providers-page">
      {/* Header */}
      <div className="iam-page-header">
        <div>
          <h3 style={{ margin: 0 }}>Disponibilidad</h3>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Gestiona templates de horarios, slots publicados y tiempos libres.
          </p>
        </div>
        <div className="iam-header-actions">
          <button
            className="button secondary"
            disabled={!selectedProviderId}
            onClick={() => setShowTimeOff(true)}
          >
            + Tiempo Libre
          </button>
          <button
            className="button primary"
            disabled={!selectedProviderId}
            onClick={() => setShowCreateTemplate(true)}
          >
            + Crear Template
          </button>
        </div>
      </div>

      {/* Provider selector */}
      <div className="iam-search-bar">
        <select
          className="iam-input iam-search-input"
          value={selectedProviderId}
          onChange={(e) => setSelectedProviderId(e.target.value)}
          aria-label="Seleccionar proveedor"
        >
          <option value="">Seleccionar proveedor…</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Error banner */}
      {error && <div className="iam-error">{error}</div>}

      {/* Loading */}
      {isLoading && <div className="iam-loading">Cargando disponibilidad…</div>}

      {/* Empty state */}
      {!isLoading && !selectedProviderId && (
        <div className="iam-empty-state">
          <p>Selecciona un proveedor para ver su disponibilidad.</p>
        </div>
      )}

      {/* Main content when provider selected */}
      {!isLoading && selectedProviderId && (
        <>
          {/* Weekly grid */}
          <div className="iam-section">
            <h4>Vista semanal</h4>
            <WeeklyGrid templates={templates} />
          </div>

          {/* Template cards */}
          <div className="iam-section">
            <h4>Templates ({templates.length})</h4>
            {templates.length === 0 && (
              <p className="muted">No hay templates de disponibilidad para este proveedor.</p>
            )}
            <div className="iam-template-grid">
              {templates.map((tpl) => (
                <div key={tpl.id} className="iam-template-card">
                  <div className="iam-template-card-header">
                    <strong>{tpl.name}</strong>
                    <TemplateBadge status={tpl.status} />
                  </div>
                  <div className="iam-template-card-body">
                    <div className="muted" style={{ fontSize: '0.82rem' }}>
                      {tpl.dayPatterns.map((dp) => `${DAYS_SHORT[dp.dayOfWeek]} ${dp.startTime}–${dp.endTime}`).join(', ')}
                    </div>
                    <div style={{ fontSize: '0.85rem', marginTop: 4 }}>
                      <span>{tpl.serviceType}</span> · <span>{tpl.location}</span>
                    </div>
                    <div className="muted" style={{ fontSize: '0.82rem', marginTop: 2 }}>
                      {tpl.duration}min · Buffer: {tpl.buffer}min · Cap: {tpl.capacity} · Modos: {tpl.serviceModes.join(', ')}
                    </div>
                  </div>
                  <div className="iam-template-card-actions">
                    {tpl.status === 'DRAFT' && (
                      <button
                        className="button primary"
                        style={{ padding: '4px 12px', fontSize: '0.82rem' }}
                        disabled={publishingId === tpl.id}
                        onClick={() => handlePublish(tpl.id)}
                      >
                        {publishingId === tpl.id ? 'Publicando…' : 'Publicar'}
                      </button>
                    )}
                    {tpl.status === 'PUBLISHED' && (
                      <button
                        className="button secondary"
                        style={{ padding: '4px 12px', fontSize: '0.82rem' }}
                        disabled={publishingId === tpl.id}
                        onClick={() => handleUnpublish(tpl.id)}
                      >
                        {publishingId === tpl.id ? 'Despublicando…' : 'Despublicar'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Slot preview */}
          <div className="iam-section">
            <SlotPreview slots={slots} />
          </div>
        </>
      )}

      {/* Create Template Dialog */}
      {showCreateTemplate && selectedProviderId && (
        <CreateTemplateDialog
          providerId={selectedProviderId}
          onClose={() => setShowCreateTemplate(false)}
          onCreated={() => loadAvailability(selectedProviderId)}
        />
      )}

      {/* Time-Off Dialog */}
      {showTimeOff && selectedProviderId && (
        <TimeOffDialog
          providerId={selectedProviderId}
          onClose={() => setShowTimeOff(false)}
          onCreated={() => loadAvailability(selectedProviderId)}
        />
      )}
    </div>
  );
}
