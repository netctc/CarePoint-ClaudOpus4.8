import { prisma } from '../../lib/prisma';
import { writeAuditLog } from '../../lib/audit';
import { badRequest } from '../../lib/http';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DayPattern {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

interface CreateTemplateInput {
  name: string;
  providerId: string;
  organizationId: string;
  dayPatterns: DayPattern[];
  serviceType: string;
  location: string;
  serviceModes: string[];
  duration: number; // minutes (1-480)
  buffer: number; // minutes (0-120)
  capacity: number; // 1-20
}

interface CreateTimeOffInput {
  providerId: string;
  organizationId: string;
  startsAt: Date;
  endsAt: Date;
  reason?: string;
  actorId: string;
}

interface UpdatePublishedTemplateInput {
  name?: string;
  dayPatterns?: DayPattern[];
  serviceType?: string;
  location?: string;
  serviceModes?: string[];
  duration?: number;
  buffer?: number;
  capacity?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Non-blocking audit write that won't fail the primary operation.
 */
async function safeWriteAuditLog(input: Parameters<typeof writeAuditLog>[0]) {
  try {
    await writeAuditLog(input);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[availability.service] Audit logging failed:', error);
    }
  }
}

/** Planning horizon in days for slot generation. */
const PLANNING_HORIZON_DAYS = 21;

/**
 * Validate template input fields.
 *
 * Requirements: 5.2, 5.9
 */
function validateTemplateFields(input: {
  name: string;
  duration: number;
  buffer: number;
  capacity: number;
}) {
  if (!input.name || input.name.length < 2) {
    throw badRequest('Template name must be at least 2 characters');
  }
  if (input.duration < 1 || input.duration > 480) {
    throw badRequest('Duration must be between 1 and 480 minutes');
  }
  if (input.buffer < 0 || input.buffer > 120) {
    throw badRequest('Buffer must be between 0 and 120 minutes');
  }
  if (input.capacity < 1 || input.capacity > 20) {
    throw badRequest('Capacity must be between 1 and 20');
  }
}

/**
 * Generate time slots for a specific date given a day pattern, duration, buffer, and capacity.
 * Returns an array of { startsAt, endsAt } for each slot.
 */
function generateSlotsForDate(
  date: Date,
  pattern: DayPattern,
  duration: number,
  buffer: number,
): Array<{ startsAt: Date; endsAt: Date }> {
  const slots: Array<{ startsAt: Date; endsAt: Date }> = [];

  const [startHour, startMin] = pattern.startTime.split(':').map(Number);
  const [endHour, endMin] = pattern.endTime.split(':').map(Number);

  const dayStart = new Date(date);
  dayStart.setUTCHours(startHour, startMin, 0, 0);

  const dayEnd = new Date(date);
  dayEnd.setUTCHours(endHour, endMin, 0, 0);

  let current = new Date(dayStart);

  while (true) {
    const slotEnd = new Date(current.getTime() + duration * 60 * 1000);
    if (slotEnd > dayEnd) break;

    slots.push({
      startsAt: new Date(current),
      endsAt: new Date(slotEnd),
    });

    // Move to next slot: duration + buffer
    current = new Date(current.getTime() + (duration + buffer) * 60 * 1000);
  }

  return slots;
}

/**
 * Check whether a proposed slot time range conflicts with any booked appointment
 * for the given provider.
 *
 * A conflict exists when: existing.startsAt < proposed.endsAt AND existing.endsAt > proposed.startsAt
 */
async function slotConflictsWithBookedAppointment(
  providerId: string,
  startsAt: Date,
  endsAt: Date,
): Promise<boolean> {
  const count = await prisma.appointment.count({
    where: {
      providerId,
      status: { not: 'CANCELLED' },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  });
  return count > 0;
}

// ---------------------------------------------------------------------------
// Service Methods
// ---------------------------------------------------------------------------

/**
 * Create a new schedule template in DRAFT status.
 *
 * Validates: name (min 2), duration (1-480), buffer (0-120), capacity (1-20).
 * Stores day patterns, service type, location, and modes in the template's JSON data field.
 *
 * Requirements: 5.2, 5.9
 */
export async function createTemplate(input: CreateTemplateInput) {
  validateTemplateFields({
    name: input.name,
    duration: input.duration,
    buffer: input.buffer,
    capacity: input.capacity,
  });

  const template = await prisma.providerScheduleTemplate.create({
    data: {
      organizationId: input.organizationId,
      providerId: input.providerId,
      name: input.name,
      status: 'DRAFT',
      data: {
        dayPatterns: input.dayPatterns,
        serviceType: input.serviceType,
        location: input.location,
        serviceModes: input.serviceModes,
        duration: input.duration,
        buffer: input.buffer,
        capacity: input.capacity,
      },
    },
  });

  return template;
}

/**
 * Publish a schedule template.
 *
 * - Changes template status to PUBLISHED
 * - Generates PublishedSlot records for a 21-day horizon from today
 * - For each dayPattern, iterates over matching days-of-week in the horizon
 * - Creates time slots based on duration + buffer
 * - Skips any slot whose time range conflicts with an existing booked appointment
 * - Writes an audit entry with the slot count
 *
 * Requirements: 5.3, 5.10
 */
export async function publishTemplate(templateId: string, actorId: string) {
  const template = await prisma.providerScheduleTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    throw badRequest('Template not found');
  }

  // Update status to PUBLISHED
  await prisma.providerScheduleTemplate.update({
    where: { id: templateId },
    data: { status: 'PUBLISHED' },
  });

  const data = template.data as {
    dayPatterns: DayPattern[];
    serviceType: string;
    location: string;
    serviceModes: string[];
    duration: number;
    buffer: number;
    capacity: number;
  };

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let slotsCreated = 0;

  // Iterate over the 21-day horizon
  for (let dayOffset = 0; dayOffset < PLANNING_HORIZON_DAYS; dayOffset++) {
    const currentDate = new Date(today.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const dayOfWeek = currentDate.getUTCDay(); // 0 = Sunday

    // Find matching day patterns for this day of the week
    const matchingPatterns = data.dayPatterns.filter((p) => p.dayOfWeek === dayOfWeek);

    for (const pattern of matchingPatterns) {
      const slots = generateSlotsForDate(currentDate, pattern, data.duration, data.buffer);

      for (const slot of slots) {
        // Skip slots that conflict with existing booked appointments
        const hasConflict = await slotConflictsWithBookedAppointment(
          template.providerId!,
          slot.startsAt,
          slot.endsAt,
        );

        if (hasConflict) continue;

        await prisma.publishedSlot.create({
          data: {
            organizationId: template.organizationId,
            providerId: template.providerId!,
            templateId: template.id,
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            service: data.serviceType,
            location: data.location,
            capacity: data.capacity,
            bookedCount: 0,
            status: 'AVAILABLE',
          },
        });

        slotsCreated++;
      }
    }
  }

  // Write audit entry (Requirement 5.10)
  await safeWriteAuditLog({
    actorId,
    organizationId: template.organizationId,
    action: 'availability.template_published',
    resource: 'provider_schedule_template',
    resourceId: templateId,
    details: {
      providerId: template.providerId,
      templateName: template.name,
      slotsCreated,
      horizonDays: PLANNING_HORIZON_DAYS,
    },
  });

  return { templateId, slotsCreated };
}

/**
 * Create a time-off block.
 *
 * - Creates a TimeOffBlock record
 * - Finds all PublishedSlots overlapping the time-off range
 * - If any of those slots have status HELD or BOOKED (or bookedCount > 0), rejects with an error
 * - Otherwise, removes (deletes) all AVAILABLE slots in the range
 * - Writes audit entry with removal count
 *
 * Requirements: 5.4, 5.10
 */
export async function createTimeOff(input: CreateTimeOffInput) {
  const { providerId, organizationId, startsAt, endsAt, reason, actorId } = input;

  // Find all published slots overlapping the time-off range for this provider
  const overlappingSlots = await prisma.publishedSlot.findMany({
    where: {
      providerId,
      organizationId,
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  });

  // Check if any overlapping slots have active holds or bookings
  const blockedSlots = overlappingSlots.filter(
    (slot: { status: string; bookedCount: number }) =>
      slot.status === 'HELD' || slot.status === 'BOOKED' || slot.bookedCount > 0,
  );

  if (blockedSlots.length > 0) {
    throw badRequest(
      'Cannot create time-off: some slots in the range have active holds or booked appointments',
      { blockedSlotCount: blockedSlots.length },
    );
  }

  // Create the TimeOffBlock record
  const timeOffBlock = await prisma.timeOffBlock.create({
    data: {
      organizationId,
      providerId,
      startsAt,
      endsAt,
      reason: reason ?? null,
      createdById: actorId,
    },
  });

  // Delete all AVAILABLE slots in the time-off range
  const deleteResult = await prisma.publishedSlot.deleteMany({
    where: {
      providerId,
      organizationId,
      status: 'AVAILABLE',
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  });

  const slotsRemoved = deleteResult.count;

  // Write audit entry (Requirement 5.10)
  await safeWriteAuditLog({
    actorId,
    organizationId,
    action: 'availability.time_off_created',
    resource: 'time_off_block',
    resourceId: timeOffBlock.id,
    details: {
      providerId,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      reason: reason ?? null,
      slotsRemoved,
    },
  });

  return { timeOffBlock, slotsRemoved };
}

/**
 * Update a published template.
 *
 * - Updates the template fields (name, dayPatterns, serviceType, etc.)
 * - Finds all future PublishedSlots generated from this template that have status AVAILABLE
 * - Deletes those slots
 * - Regenerates slots from the updated pattern for the remaining 21-day horizon
 * - Preserves any slots that have booked appointments (HELD/BOOKED or bookedCount > 0)
 * - Writes audit entry
 *
 * Requirements: 5.8, 5.10
 */
export async function updatePublishedTemplate(
  templateId: string,
  updates: UpdatePublishedTemplateInput,
  actorId: string,
) {
  const template = await prisma.providerScheduleTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    throw badRequest('Template not found');
  }

  const existingData = template.data as {
    dayPatterns: DayPattern[];
    serviceType: string;
    location: string;
    serviceModes: string[];
    duration: number;
    buffer: number;
    capacity: number;
  };

  // Merge updates into existing data
  const updatedData = {
    dayPatterns: updates.dayPatterns ?? existingData.dayPatterns,
    serviceType: updates.serviceType ?? existingData.serviceType,
    location: updates.location ?? existingData.location,
    serviceModes: updates.serviceModes ?? existingData.serviceModes,
    duration: updates.duration ?? existingData.duration,
    buffer: updates.buffer ?? existingData.buffer,
    capacity: updates.capacity ?? existingData.capacity,
  };

  const updatedName = updates.name ?? template.name;

  // Validate the updated fields
  validateTemplateFields({
    name: updatedName,
    duration: updatedData.duration,
    buffer: updatedData.buffer,
    capacity: updatedData.capacity,
  });

  // Update the template record
  await prisma.providerScheduleTemplate.update({
    where: { id: templateId },
    data: {
      name: updatedName,
      data: updatedData,
    },
  });

  const now = new Date();

  // Delete all future AVAILABLE slots generated from this template
  const deleteResult = await prisma.publishedSlot.deleteMany({
    where: {
      templateId,
      status: 'AVAILABLE',
      startsAt: { gte: now },
    },
  });

  const slotsRemoved = deleteResult.count;

  // Regenerate slots from the updated pattern for the remaining 21-day horizon
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let slotsCreated = 0;

  for (let dayOffset = 0; dayOffset < PLANNING_HORIZON_DAYS; dayOffset++) {
    const currentDate = new Date(today.getTime() + dayOffset * 24 * 60 * 60 * 1000);

    // Skip dates that are in the past
    if (currentDate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) continue;

    const dayOfWeek = currentDate.getUTCDay();
    const matchingPatterns = updatedData.dayPatterns.filter((p) => p.dayOfWeek === dayOfWeek);

    for (const pattern of matchingPatterns) {
      const slots = generateSlotsForDate(currentDate, pattern, updatedData.duration, updatedData.buffer);

      for (const slot of slots) {
        // Skip slots that are in the past
        if (slot.startsAt < now) continue;

        // Skip slots that conflict with existing booked appointments
        const hasConflict = await slotConflictsWithBookedAppointment(
          template.providerId!,
          slot.startsAt,
          slot.endsAt,
        );

        if (hasConflict) continue;

        // Check if a booked/held slot already exists at this time (preserved slot)
        const existingBookedSlot = await prisma.publishedSlot.findFirst({
          where: {
            templateId,
            providerId: template.providerId!,
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            status: { in: ['HELD', 'BOOKED'] },
          },
        });

        // Don't create a duplicate if a booked/held slot is already preserved
        if (existingBookedSlot) continue;

        await prisma.publishedSlot.create({
          data: {
            organizationId: template.organizationId,
            providerId: template.providerId!,
            templateId: template.id,
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            service: updatedData.serviceType,
            location: updatedData.location,
            capacity: updatedData.capacity,
            bookedCount: 0,
            status: 'AVAILABLE',
          },
        });

        slotsCreated++;
      }
    }
  }

  // Write audit entry (Requirement 5.10)
  await safeWriteAuditLog({
    actorId,
    organizationId: template.organizationId,
    action: 'availability.template_updated',
    resource: 'provider_schedule_template',
    resourceId: templateId,
    details: {
      providerId: template.providerId,
      templateName: updatedName,
      slotsRemoved,
      slotsCreated,
      horizonDays: PLANNING_HORIZON_DAYS,
    },
  });

  return { templateId, slotsRemoved, slotsCreated };
}
