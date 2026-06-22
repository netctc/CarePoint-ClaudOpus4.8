import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { prisma } from './prisma';
import { writeAuditLog } from './audit';
import { listProviderWorkspaceItems } from './provider-workspace-store';
import { listConfigItems } from './admin-config-store';

export type PublishedSlot = {
  id: string;
  organizationId: string;
  providerId: string;
  sourceTemplateId?: string | null;
  service: string;
  location: string;
  modality: 'TELEHEALTH' | 'IN_PERSON';
  startsAt: string;
  endsAt: string;
  capacity: number;
  status: 'PUBLISHED';
  createdAt: string;
  updatedAt: string;
};

export type SlotHold = {
  id: string;
  slotId: string;
  organizationId: string;
  providerId: string;
  patientId: string;
  service: string;
  location: string;
  modality: 'TELEHEALTH' | 'IN_PERSON';
  startsAt: string;
  endsAt: string;
  expiresAt: string;
  status: 'HELD' | 'RELEASED' | 'BOOKED' | 'EXPIRED';
  createdAt: string;
  updatedAt: string;
  metadata?: {
    subjectProfileId?: string | null;
    subjectLabel?: string | null;
    subjectRelationship?: string | null;
    isFamilySubject?: boolean;
  };
};

type SchedulingState = {
  slots: PublishedSlot[];
  holds: SlotHold[];
};

type TemplateLike = {
  id?: string;
  templateName?: string;
  service?: string;
  location?: string;
  serviceModes?: string[];
  pattern?: Array<{ day?: string; hours?: string }>;
  durationMinutes?: number;
  bufferMinutes?: number;
  capacity?: number;
};

type AvailabilityQuery = {
  organizationId: string;
  providerId: string;
  service?: string | null;
  location?: string | null;
  startsAt?: Date;
  endsAt?: Date;
};


export type BookingPolicy = {
  serviceCode: string;
  matchedCoverageRuleId?: string | null;
  bookingLeadHours: number;
  telehealthAllowed: boolean;
  authorizationRequired: boolean;
  requiresInsuranceDocument: boolean;
  requiresIdentityDocument: boolean;
  allowedPaymentMethods: Array<'CARD' | 'WALLET' | 'CASH'>;
  requiresPolicyAcceptance: boolean;
  cancellationWindowHours: number;
  refundWindowHours: number;
  overrideRequired: boolean;
  reasons: string[];
  guidance: string[];
  blockedFacilities: string[];
  blockedChannels: Array<'TELEHEALTH' | 'IN_PERSON'>;
  weekendSlotsAllowed: boolean;
  weekendCalendar: string;
  cityExceptions: string[];
};

const storagePath = path.resolve(__dirname, '../../data/scheduling-store.json');
const weekdayMap: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function asIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function overlap(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && startB < endA;
}

function isBookableWindow(startsAt: Date, endsAt: Date) {
  const startMinutes = startsAt.getUTCHours() * 60 + startsAt.getUTCMinutes();
  const endMinutes = endsAt.getUTCHours() * 60 + endsAt.getUTCMinutes();
  return startMinutes >= 6 * 60 && endMinutes <= 23 * 60 && endsAt > startsAt;
}


function normalizeServiceCode(service?: string | null) {
  return String(service ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}


function containsTokenized(haystack: string, needle: string) {
  const h = normalizeServiceCode(haystack);
  const n = normalizeServiceCode(needle);
  return Boolean(h && n && (h === n || h.includes(n) || n.includes(h)));
}

function serviceMatchesSlot(slotService: string, requested?: string | null) {
  const requestedCode = normalizeServiceCode(requested);
  if (!requestedCode) return true;
  const slotCode = normalizeServiceCode(slotService);
  if (slotCode === requestedCode || slotCode.includes(requestedCode) || requestedCode.includes(slotCode)) return true;
  if (requestedCode.includes('CONSULTATION') && slotCode.includes('CONSULTATION')) return true;
  if (requestedCode.includes('FOLLOW_UP') && slotCode.includes('FOLLOW_UP')) return true;
  if (requestedCode.includes('CHECKUP') && slotCode.includes('CHECKUP')) return true;
  return false;
}

function locationMatchesSlot(slot: Pick<PublishedSlot, 'location' | 'modality'>, requested?: string | null) {
  const value = String(requested ?? '').trim();
  if (!value) return true;
  const requestedCode = normalizeServiceCode(value);
  const slotCode = normalizeServiceCode(slot.location);
  if (!requestedCode) return true;
  if (slotCode === requestedCode || slotCode.includes(requestedCode) || requestedCode.includes(slotCode)) return true;
  const wantsVirtual = ['VIRTUAL', 'ONLINE', 'TELEHEALTH', 'REMOTE'].some((token) => requestedCode.includes(token));
  if (wantsVirtual) return slot.modality === 'TELEHEALTH' || ['VIRTUAL', 'ONLINE', 'TELEHEALTH', 'REMOTE'].some((token) => slotCode.includes(token));
  const wantsGenericClinic = requestedCode.includes('CLINIC') || requestedCode.includes('MAIN_CLINIC') || requestedCode.includes('CAREPOINT');
  if (wantsGenericClinic) return slot.modality === 'IN_PERSON';
  return false;
}

async function getActiveCoverageRule(organizationId: string, service: string) {
  const items = await listConfigItems('coverage', organizationId);
  const active = items.filter((item) => String(item.status ?? '').toUpperCase() === 'ACTIVE');
  const serviceCode = normalizeServiceCode(service);
  return active.find((item) => Array.isArray(item.serviceCodes) && item.serviceCodes.map((entry: any) => String(entry).toUpperCase()).includes(serviceCode)) ?? null;
}

export async function evaluateBookingPolicy(params: {
  organizationId: string;
  providerId: string;
  service: string;
  location: string;
  startsAt: Date;
  endsAt: Date;
}) : Promise<BookingPolicy> {
  const rule = await getActiveCoverageRule(params.organizationId, params.service);
  const selectedChannel = normalizeModality(params.location);
  const isTelehealth = selectedChannel === 'TELEHEALTH';
  const bookingLeadHours = Math.max(Number(rule?.bookingLeadHours ?? 2), 0);
  const telehealthAllowed = rule ? Boolean(rule.telehealthAllowed) : true;
  const authorizationRequired = Boolean(rule?.authorizationRequired);
  const blockedFacilities = Array.isArray(rule?.blockedFacilities) ? rule!.blockedFacilities.map((item: any) => String(item)) : [];
  const blockedChannels = Array.isArray(rule?.blockedChannels)
    ? rule!.blockedChannels.map((item: any) => String(item).toUpperCase()).filter((item: string): item is 'TELEHEALTH' | 'IN_PERSON' => item === 'TELEHEALTH' || item === 'IN_PERSON')
    : [];
  const weekendSlotsAllowed = rule?.weekendSlotsAllowed !== false;
  const weekendCalendar = String(rule?.weekendCalendar ?? 'Fri-Sat standard schedule');
  const cityExceptions = Array.isArray(rule?.cityExceptions) ? rule!.cityExceptions.map((item: any) => String(item)) : [];
  const hoursUntilStart = (params.startsAt.getTime() - Date.now()) / (60 * 60 * 1000);
  const reasons: string[] = [];
  const utcDay = params.startsAt.getUTCDay();
  const isWeekend = utcDay === 5 || utcDay === 6;
  if (isTelehealth && !telehealthAllowed) reasons.push('Selected coverage rule does not allow telehealth booking for this service.');
  if (hoursUntilStart < bookingLeadHours) reasons.push(`Selected slot violates the ${bookingLeadHours}-hour minimum booking lead time.`);
  if (blockedChannels.includes(selectedChannel)) reasons.push(`Selected booking channel is blocked by the active coverage rule (${selectedChannel.toLowerCase()}).`);
  if (!isTelehealth && blockedFacilities.some((item) => item.trim().toLowerCase() === params.location.trim().toLowerCase())) reasons.push('Selected facility requires a coverage exception before booking can proceed.');
  if (isWeekend && !weekendSlotsAllowed) reasons.push('Weekend booking is disabled for the active coverage rule and requires an override.');

  return {
    serviceCode: normalizeServiceCode(params.service),
    matchedCoverageRuleId: rule?.id ?? null,
    bookingLeadHours,
    telehealthAllowed,
    authorizationRequired,
    requiresInsuranceDocument: true,
    requiresIdentityDocument: true,
    allowedPaymentMethods: isTelehealth ? ['CARD', 'WALLET'] : ['CARD', 'WALLET', 'CASH'],
    requiresPolicyAcceptance: true,
    cancellationWindowHours: authorizationRequired ? 24 : 12,
    refundWindowHours: authorizationRequired ? 24 : 12,
    overrideRequired: reasons.length > 0,
    reasons,
    blockedFacilities,
    blockedChannels,
    weekendSlotsAllowed,
    weekendCalendar,
    cityExceptions,
    guidance: [
      `${bookingLeadHours}-hour minimum lead time applies for this booking configuration.`,
      isTelehealth ? (telehealthAllowed ? 'Telehealth is permitted for the selected service.' : 'Telehealth requires manual override or a coverage-rule update.') : 'In-person booking selected for the current location.',
      authorizationRequired ? 'Prior authorization must be confirmed before payment is finalized.' : 'No prior authorization is required by the matched coverage rule.',
      blockedFacilities.length ? `Blocked facilities: ${blockedFacilities.join(', ')}.` : 'No facility-level restrictions are active.',
      blockedChannels.length ? `Blocked channels: ${blockedChannels.join(', ')}.` : 'No channel restrictions are active.',
      weekendSlotsAllowed ? `Weekend calendar: ${weekendCalendar}.` : `Weekend calendar restriction: ${weekendCalendar}.`,
      cityExceptions.length ? `Regional exceptions: ${cityExceptions.join(' · ')}.` : 'No regional exception notes are attached to the matched coverage rule.',
      'Patient must review the cancellation/refund policy before confirmation.',
    ],
  };
}

function normalizeModality(value?: string | null): 'TELEHEALTH' | 'IN_PERSON' {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized.includes('tele') || normalized.includes('virtual') || normalized.includes('online')) {
    return 'TELEHEALTH';
  }
  return 'IN_PERSON';
}

function slotKey(slot: Pick<PublishedSlot, 'providerId' | 'startsAt' | 'endsAt' | 'location' | 'service'>) {
  return [slot.providerId, slot.startsAt, slot.endsAt, slot.location, slot.service].join('::');
}

async function ensureStorageFile() {
  await fs.mkdir(path.dirname(storagePath), { recursive: true });
  try {
    await fs.access(storagePath);
  } catch {
    await fs.writeFile(storagePath, JSON.stringify({ slots: [], holds: [] }, null, 2), 'utf8');
  }
}

async function loadState(): Promise<SchedulingState> {
  await ensureStorageFile();
  try {
    const raw = await fs.readFile(storagePath, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    return {
      slots: Array.isArray(parsed.slots) ? parsed.slots : [],
      holds: Array.isArray(parsed.holds) ? parsed.holds : [],
    };
  } catch {
    return { slots: [], holds: [] };
  }
}

async function saveState(state: SchedulingState) {
  await ensureStorageFile();
  await fs.writeFile(storagePath, JSON.stringify(state, null, 2), 'utf8');
}

async function pruneExpiredHolds(state?: SchedulingState) {
  const current = state ?? await loadState();
  const now = Date.now();
  let changed = false;
  current.holds = current.holds.map((hold) => {
    if (hold.status === 'HELD' && new Date(hold.expiresAt).getTime() <= now) {
      changed = true;
      return { ...hold, status: 'EXPIRED', updatedAt: new Date().toISOString() };
    }
    return hold;
  });
  if (changed) {
    await saveState(current);
  }
  return current;
}

function parseHoursWindow(input?: string | null) {
  const value = String(input ?? '').trim();
  const match = value.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return {
    startHour: Number(match[1]),
    startMinute: Number(match[2]),
    endHour: Number(match[3]),
    endMinute: Number(match[4]),
  };
}

function materializeTemplateSlots(template: TemplateLike, rangeDays = 21) {
  const durationMinutes = Math.max(Number(template.durationMinutes ?? 30), 15);
  const bufferMinutes = Math.max(Number(template.bufferMinutes ?? 0), 0);
  const capacity = Math.max(Number(template.capacity ?? 1), 1);
  const service = String(template.service ?? 'Consultation').trim();
  const location = String(template.location ?? 'Virtual Care').trim();
  const modality = normalizeModality(template.serviceModes?.[0] ?? location);
  const patterns = Array.isArray(template.pattern) ? template.pattern : [];
  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const items: Array<Omit<PublishedSlot, 'id' | 'organizationId' | 'providerId' | 'status' | 'createdAt' | 'updatedAt'>> = [];

  for (let index = 0; index < rangeDays; index += 1) {
    const day = new Date(startOfToday);
    day.setUTCDate(startOfToday.getUTCDate() + index);

    for (const pattern of patterns) {
      const weekday = weekdayMap[String(pattern.day ?? '').trim().toLowerCase()];
      const window = parseHoursWindow(pattern.hours);
      if (weekday === undefined || !window || day.getUTCDay() !== weekday) continue;

      let cursor = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), window.startHour, window.startMinute));
      const endBoundary = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), window.endHour, window.endMinute));

      while (cursor < endBoundary) {
        const slotStart = new Date(cursor);
        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);
        if (slotEnd > endBoundary) break;
        if (slotStart > now && isBookableWindow(slotStart, slotEnd)) {
          items.push({
            sourceTemplateId: template.id ?? null,
            service,
            location,
            modality,
            startsAt: slotStart.toISOString(),
            endsAt: slotEnd.toISOString(),
            capacity,
          });
        }
        cursor = new Date(slotEnd.getTime() + bufferMinutes * 60 * 1000);
      }
    }
  }

  return items;
}

async function getProviderConflictingAppointments(organizationId: string, providerId: string, startsAt: Date, endsAt: Date, excludeAppointmentId?: string | null) {
  return prisma.appointment.findMany({
    where: {
      organizationId,
      providerId,
      ...(excludeAppointmentId ? { NOT: { id: excludeAppointmentId } } : {}),
      status: { not: 'CANCELLED' },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
    select: { id: true, startsAt: true, endsAt: true, location: true, service: true, status: true },
  });
}

export async function validateProviderBookingWindow(params: { organizationId: string; providerId: string; startsAt: Date; endsAt: Date; excludeAppointmentId?: string | null }) {
  if (!isBookableWindow(params.startsAt, params.endsAt)) {
    return { ok: false, reason: 'Selected time falls outside the allowed provider scheduling window.' } as const;
  }
  const conflicts = await getProviderConflictingAppointments(params.organizationId, params.providerId, params.startsAt, params.endsAt, params.excludeAppointmentId);
  if (conflicts.length) {
    return { ok: false, reason: 'Provider already has an overlapping appointment for the selected time.' } as const;
  }
  return { ok: true } as const;
}

export async function publishTemplateSlotsFromWorkspace(params: { organizationId: string; providerId: string; actorId?: string; template: TemplateLike }) {
  const state = await pruneExpiredHolds();
  const createdAt = new Date().toISOString();
  const templateId = params.template.id ?? null;
  const generated = materializeTemplateSlots(params.template, 21);
  const futureCutoff = Date.now();
  const retained = state.slots.filter((slot) => {
    if (slot.organizationId !== params.organizationId || slot.providerId !== params.providerId) return true;
    if (!templateId || slot.sourceTemplateId !== templateId) return true;
    return new Date(slot.startsAt).getTime() < futureCutoff;
  });

  const existingKeys = new Set(retained.map(slotKey));
  const nextSlots: PublishedSlot[] = [...retained];
  const conflicts: Array<{ startsAt: string; reason: string }> = [];
  let created = 0;

  for (const slot of generated) {
    const startsAt = new Date(slot.startsAt);
    const endsAt = new Date(slot.endsAt);
    const appointmentConflicts = await getProviderConflictingAppointments(params.organizationId, params.providerId, startsAt, endsAt);
    if (appointmentConflicts.length) {
      conflicts.push({ startsAt: slot.startsAt, reason: 'Existing appointment overlap' });
      continue;
    }
    const key = slotKey({ ...slot, providerId: params.providerId });
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);
    nextSlots.push({
      id: randomUUID(),
      organizationId: params.organizationId,
      providerId: params.providerId,
      sourceTemplateId: slot.sourceTemplateId,
      service: slot.service,
      location: slot.location,
      modality: slot.modality,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      capacity: slot.capacity,
      status: 'PUBLISHED',
      createdAt,
      updatedAt: createdAt,
    });
    created += 1;
  }

  state.slots = nextSlots.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  await saveState(state);
  if (params.actorId) {
    await writeAuditLog({
      actorId: params.actorId,
      organizationId: params.organizationId,
      action: 'provider.calendar.template_published_to_slots',
      resource: 'provider_schedule_template',
      resourceId: templateId ?? 'unknown-template',
      details: {
        createdSlots: created,
        conflictCount: conflicts.length,
        providerId: params.providerId,
      },
    });
  }
  return { createdSlots: created, conflicts };
}

export async function ensurePublishedTemplateSlotsForProvider(params: { organizationId: string; providerId: string }) {
  const state = await pruneExpiredHolds();
  const existingFuture = state.slots.some((slot) => slot.organizationId === params.organizationId && slot.providerId === params.providerId && new Date(slot.endsAt).getTime() > Date.now());
  if (existingFuture) return;
  const templates = await listProviderWorkspaceItems('schedule_template', params.organizationId, params.providerId);
  const publishedTemplates = templates.filter((item) => String(item.status).toUpperCase() === 'PUBLISHED');
  for (const template of publishedTemplates) {
    await publishTemplateSlotsFromWorkspace({ ...params, template });
  }
}

export async function getProviderPublishedSlots(query: AvailabilityQuery) {
  await ensurePublishedTemplateSlotsForProvider({ organizationId: query.organizationId, providerId: query.providerId });
  const state = await pruneExpiredHolds();
  const startsAt = query.startsAt ?? new Date();
  const endsAt = query.endsAt ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  let slots = state.slots.filter((slot) => {
    if (slot.organizationId !== query.organizationId || slot.providerId !== query.providerId) return false;
    if (!overlap(new Date(slot.startsAt), new Date(slot.endsAt), startsAt, endsAt)) return false;
    if (!serviceMatchesSlot(slot.service, query.service)) return false;
    if (!locationMatchesSlot(slot, query.location)) return false;
    return true;
  });

  if (slots.length === 0 && (query.service || query.location)) {
    slots = state.slots.filter((slot) => {
      if (slot.organizationId !== query.organizationId || slot.providerId !== query.providerId) return false;
      if (!overlap(new Date(slot.startsAt), new Date(slot.endsAt), startsAt, endsAt)) return false;
      if (query.service && !serviceMatchesSlot(slot.service, query.service)) return false;
      return true;
    });
  }

  const appointments = await prisma.appointment.findMany({
    where: {
      organizationId: query.organizationId,
      providerId: query.providerId,
      status: { not: 'CANCELLED' },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
    select: { id: true, startsAt: true, endsAt: true, patientId: true, status: true },
  });

  return slots.map((slot) => {
    const slotStartsAt = new Date(slot.startsAt);
    const slotEndsAt = new Date(slot.endsAt);
    const appointmentCount = appointments.filter((item) => overlap(slotStartsAt, slotEndsAt, item.startsAt, item.endsAt)).length;
    const activeHolds = state.holds.filter((hold) => hold.status === 'HELD' && hold.slotId === slot.id);
    const availableCount = Math.max(slot.capacity - appointmentCount - activeHolds.length, 0);
    return {
      ...slot,
      appointmentCount,
      activeHoldCount: activeHolds.length,
      availableCount,
      statusLabel: availableCount > 0 ? 'AVAILABLE' : appointmentCount > 0 ? 'BOOKED' : 'HELD',
      holds: activeHolds.map((hold) => ({ id: hold.id, expiresAt: hold.expiresAt })),
    };
  });
}

export async function createSlotHold(params: { organizationId: string; providerId: string; patientId: string; service: string; location: string; startsAt: Date; endsAt: Date; holdMinutes?: number; actorId?: string; metadata?: SlotHold['metadata'] }) {
  const holdMinutes = Math.min(Math.max(Number(params.holdMinutes ?? 10), 5), 20);
  const slots = await getProviderPublishedSlots({
    organizationId: params.organizationId,
    providerId: params.providerId,
    service: params.service,
    location: params.location,
    startsAt: new Date(params.startsAt.getTime() - 60 * 1000),
    endsAt: new Date(params.endsAt.getTime() + 60 * 1000),
  });
  const slot = slots.find((item) => item.startsAt === params.startsAt.toISOString() && item.endsAt === params.endsAt.toISOString());
  if (!slot) {
    throw new Error('Selected slot is no longer published. Refresh availability and choose another time.');
  }
  if (slot.availableCount <= 0) {
    throw new Error('Selected slot is no longer available. Refresh availability and choose another time.');
  }

  const state = await pruneExpiredHolds();
  state.holds = state.holds.filter((hold) => !(hold.slotId === slot.id && hold.patientId === params.patientId && hold.status === 'HELD'));
  const now = new Date();
  const hold: SlotHold = {
    id: randomUUID(),
    slotId: slot.id,
    organizationId: params.organizationId,
    providerId: params.providerId,
    patientId: params.patientId,
    service: params.service,
    location: params.location,
    modality: slot.modality,
    startsAt: params.startsAt.toISOString(),
    endsAt: params.endsAt.toISOString(),
    expiresAt: new Date(now.getTime() + holdMinutes * 60 * 1000).toISOString(),
    status: 'HELD',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    metadata: params.metadata,
  };
  state.holds.push(hold);
  await saveState(state);
  if (params.actorId) {
    await writeAuditLog({
      actorId: params.actorId,
      organizationId: params.organizationId,
      action: 'booking.slot_held',
      resource: 'slot_hold',
      resourceId: hold.id,
      details: { slotId: slot.id, providerId: params.providerId, startsAt: hold.startsAt, expiresAt: hold.expiresAt },
    });
  }
  return hold;
}


export async function listActiveSlotHolds(params: { organizationId?: string; providerId?: string; patientId?: string; limit?: number }) {
  const state = await pruneExpiredHolds();
  const now = Date.now();
  return state.holds
    .filter((hold) => (!params.organizationId || hold.organizationId === params.organizationId)
      && (!params.providerId || hold.providerId === params.providerId)
      && (!params.patientId || hold.patientId === params.patientId)
      && hold.status === 'HELD'
      && new Date(hold.expiresAt).getTime() > now)
    .sort((left, right) => new Date(left.expiresAt).getTime() - new Date(right.expiresAt).getTime())
    .slice(0, Math.max(1, Math.min(Number(params.limit ?? 50), 250)));
}

export async function extendSlotHold(params: { holdId: string; organizationId?: string; actorId?: string; extendMinutes?: number; note?: string }) {
  const state = await pruneExpiredHolds();
  const hold = state.holds.find((item) => item.id === params.holdId && (!params.organizationId || item.organizationId === params.organizationId));
  if (!hold) return null;
  if (hold.status !== 'HELD') return hold;
  const now = Date.now();
  if (new Date(hold.expiresAt).getTime() <= now) {
    hold.status = 'EXPIRED';
    hold.updatedAt = new Date().toISOString();
    await saveState(state);
    return hold;
  }
  const extendMinutes = Math.min(Math.max(Number(params.extendMinutes ?? 5), 1), 10);
  const nextExpiresAt = new Date(Math.max(new Date(hold.expiresAt).getTime(), now) + extendMinutes * 60 * 1000).toISOString();
  hold.expiresAt = nextExpiresAt;
  hold.updatedAt = new Date().toISOString();
  await saveState(state);
  if (params.actorId) {
    await writeAuditLog({
      actorId: params.actorId,
      organizationId: hold.organizationId,
      action: 'booking.slot_hold_extended',
      resource: 'slot_hold',
      resourceId: hold.id,
      details: { note: params.note ?? null, slotId: hold.slotId, extendMinutes, expiresAt: hold.expiresAt },
    });
  }
  return hold;
}

export async function getSlotHold(holdId: string, organizationId?: string) {
  const state = await pruneExpiredHolds();
  const hold = state.holds.find((item) => item.id === holdId && (!organizationId || item.organizationId === organizationId));
  return hold ?? null;
}

export async function releaseSlotHold(params: { holdId: string; organizationId?: string; actorId?: string; note?: string }) {
  const state = await pruneExpiredHolds();
  const hold = state.holds.find((item) => item.id === params.holdId && (!params.organizationId || item.organizationId === params.organizationId));
  if (!hold) return null;
  if (hold.status === 'HELD') {
    hold.status = 'RELEASED';
    hold.updatedAt = new Date().toISOString();
    await saveState(state);
    if (params.actorId) {
      await writeAuditLog({
        actorId: params.actorId,
        organizationId: hold.organizationId,
        action: 'booking.slot_hold_released',
        resource: 'slot_hold',
        resourceId: hold.id,
        details: { note: params.note ?? null, slotId: hold.slotId },
      });
    }
  }
  return hold;
}

export async function markSlotHoldBooked(params: { holdId: string; appointmentId: string; actorId?: string }) {
  const state = await pruneExpiredHolds();
  const hold = state.holds.find((item) => item.id === params.holdId);
  if (!hold) {
    throw new Error('Slot hold not found. Refresh availability and try again.');
  }
  if (hold.status !== 'HELD') {
    throw new Error('Slot hold is no longer active. Refresh availability and try again.');
  }
  if (new Date(hold.expiresAt).getTime() <= Date.now()) {
    hold.status = 'EXPIRED';
    hold.updatedAt = new Date().toISOString();
    await saveState(state);
    throw new Error('Slot hold has expired. Refresh availability and choose another slot.');
  }
  hold.status = 'BOOKED';
  hold.updatedAt = new Date().toISOString();
  await saveState(state);
  if (params.actorId) {
    await writeAuditLog({
      actorId: params.actorId,
      organizationId: hold.organizationId,
      action: 'booking.slot_hold_booked',
      resource: 'slot_hold',
      resourceId: hold.id,
      details: { appointmentId: params.appointmentId, slotId: hold.slotId },
    });
  }
  return hold;
}


export async function getPublishedSlotById(slotId: string, organizationId?: string) {
  const state = await pruneExpiredHolds();
  return state.slots.find((slot) => slot.id === slotId && (!organizationId || slot.organizationId === organizationId)) ?? null;
}

export async function createManualPublishedSlot(params: {
  organizationId: string;
  providerId: string;
  actorId?: string;
  service: string;
  location: string;
  startsAt: Date;
  endsAt: Date;
  capacity?: number;
  modality?: 'TELEHEALTH' | 'IN_PERSON';
}) {
  const policy = await evaluateBookingPolicy({
    organizationId: params.organizationId,
    providerId: params.providerId,
    service: params.service,
    location: params.location,
    startsAt: params.startsAt,
    endsAt: params.endsAt,
  });
  if (policy.overrideRequired) {
    throw new Error(policy.reasons[0] || 'Selected slot violates booking policy constraints.');
  }
  const providerWindow = await validateProviderBookingWindow({
    organizationId: params.organizationId,
    providerId: params.providerId,
    startsAt: params.startsAt,
    endsAt: params.endsAt,
  });
  if (!providerWindow.ok) throw new Error(providerWindow.reason);

  const state = await pruneExpiredHolds();
  const key = slotKey({
    providerId: params.providerId,
    startsAt: params.startsAt.toISOString(),
    endsAt: params.endsAt.toISOString(),
    location: params.location,
    service: params.service,
  });
  if (state.slots.some((slot) => slot.organizationId === params.organizationId && slotKey(slot) == key)) {
    throw new Error('A published slot already exists for the selected time, location, and service.');
  }
  const slot: PublishedSlot = {
    id: randomUUID(),
    organizationId: params.organizationId,
    providerId: params.providerId,
    sourceTemplateId: null,
    service: params.service,
    location: params.location,
    modality: params.modality ?? normalizeModality(params.location),
    startsAt: params.startsAt.toISOString(),
    endsAt: params.endsAt.toISOString(),
    capacity: Math.max(Number(params.capacity ?? 1), 1),
    status: 'PUBLISHED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  state.slots.push(slot);
  state.slots.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  await saveState(state);
  if (params.actorId) {
    await writeAuditLog({
      actorId: params.actorId,
      organizationId: params.organizationId,
      action: 'provider.calendar.manual_slot_created',
      resource: 'published_slot',
      resourceId: slot.id,
      details: { providerId: params.providerId, service: params.service, location: params.location, startsAt: slot.startsAt, endsAt: slot.endsAt, capacity: slot.capacity },
    });
  }
  return slot;
}

export async function updateManualPublishedSlot(params: {
  slotId: string;
  organizationId: string;
  providerId: string;
  actorId?: string;
  service?: string;
  location?: string;
  startsAt?: Date;
  endsAt?: Date;
  capacity?: number;
}) {
  const state = await pruneExpiredHolds();
  const slot = state.slots.find((item) => item.id === params.slotId && item.organizationId === params.organizationId && item.providerId === params.providerId);
  if (!slot) throw new Error('Published slot not found.');
  const nextStartsAt = params.startsAt ?? new Date(slot.startsAt);
  const nextEndsAt = params.endsAt ?? new Date(slot.endsAt);
  const nextService = params.service ?? slot.service;
  const nextLocation = params.location ?? slot.location;
  const policy = await evaluateBookingPolicy({
    organizationId: params.organizationId,
    providerId: params.providerId,
    service: nextService,
    location: nextLocation,
    startsAt: nextStartsAt,
    endsAt: nextEndsAt,
  });
  if (policy.overrideRequired) throw new Error(policy.reasons[0] || 'Updated slot violates booking policy constraints.');
  const providerWindow = await validateProviderBookingWindow({
    organizationId: params.organizationId,
    providerId: params.providerId,
    startsAt: nextStartsAt,
    endsAt: nextEndsAt,
  });
  if (!providerWindow.ok) throw new Error(providerWindow.reason);

  Object.assign(slot, {
    service: nextService,
    location: nextLocation,
    startsAt: nextStartsAt.toISOString(),
    endsAt: nextEndsAt.toISOString(),
    capacity: Math.max(Number(params.capacity ?? slot.capacity), 1),
    modality: normalizeModality(nextLocation),
    updatedAt: new Date().toISOString(),
  });
  state.slots.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  await saveState(state);
  if (params.actorId) {
    await writeAuditLog({
      actorId: params.actorId,
      organizationId: params.organizationId,
      action: 'provider.calendar.manual_slot_updated',
      resource: 'published_slot',
      resourceId: slot.id,
      details: { providerId: params.providerId, service: slot.service, location: slot.location, startsAt: slot.startsAt, endsAt: slot.endsAt, capacity: slot.capacity },
    });
  }
  return slot;
}

export async function cancelPublishedSlot(params: { slotId: string; organizationId: string; providerId: string; actorId?: string; note?: string }) {
  const state = await pruneExpiredHolds();
  const index = state.slots.findIndex((item) => item.id === params.slotId && item.organizationId === params.organizationId && item.providerId === params.providerId);
  if (index < 0) throw new Error('Published slot not found.');
  const slot = state.slots[index];
  const activeHolds = state.holds.filter((hold) => hold.slotId === slot.id && hold.status === 'HELD');
  if (activeHolds.length) throw new Error('Release active slot holds before cancelling this published slot.');
  const overlappingAppointments = await prisma.appointment.count({
    where: {
      organizationId: params.organizationId,
      providerId: params.providerId,
      status: { not: 'CANCELLED' },
      startsAt: { lt: new Date(slot.endsAt) },
      endsAt: { gt: new Date(slot.startsAt) },
    },
  });
  if (overlappingAppointments > 0) throw new Error('This published slot already has a booked appointment and cannot be cancelled.');
  state.slots.splice(index, 1);
  await saveState(state);
  if (params.actorId) {
    await writeAuditLog({
      actorId: params.actorId,
      organizationId: params.organizationId,
      action: 'provider.calendar.manual_slot_cancelled',
      resource: 'published_slot',
      resourceId: slot.id,
      details: { note: params.note ?? null, providerId: params.providerId, startsAt: slot.startsAt, endsAt: slot.endsAt },
    });
  }
  return slot;
}

export async function getSchedulingSummary(organizationId?: string) {
  const state = await pruneExpiredHolds();
  const now = Date.now();
  return {
    publishedSlots: state.slots.filter((slot) => (!organizationId || slot.organizationId === organizationId) && new Date(slot.endsAt).getTime() > now).length,
    activeHolds: state.holds.filter((hold) => (!organizationId || hold.organizationId === organizationId) && hold.status === 'HELD' && new Date(hold.expiresAt).getTime() > now).length,
  };
}
