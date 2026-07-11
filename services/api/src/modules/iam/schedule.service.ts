import { prisma } from '../../lib/prisma';
import { writeAuditLog } from '../../lib/audit';
import { badRequest, notFound } from '../../lib/http';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateAppointmentInput {
  providerId: string;
  patientId: string;
  service: string;
  location: string;
  startsAt: Date;
  endsAt: Date;
  organizationId: string;
  actorId: string;
}

interface RescheduleAppointmentInput {
  appointmentId: string;
  newStartsAt: Date;
  newEndsAt: Date;
  actorId: string;
  organizationId?: string;
}

interface CancelAppointmentInput {
  appointmentId: string;
  reason: string;
  actorId: string;
  organizationId?: string;
}

interface ConflictCheckResult {
  hasConflict: boolean;
  conflictingAppointments: Array<{ id: string; startsAt: Date; endsAt: Date }>;
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
      console.warn('[schedule.service] Audit logging failed:', error);
    }
  }
}

// ---------------------------------------------------------------------------
// Service Methods
// ---------------------------------------------------------------------------

/**
 * Check for conflicting appointments for a given provider in a time range.
 *
 * Two time ranges [A_start, A_end] and [B_start, B_end] overlap when:
 *   A_start < B_end AND A_end > B_start
 *
 * Only non-CANCELLED appointments are considered as conflicts.
 *
 * @param providerId - The provider to check conflicts for
 * @param startsAt - Start of the proposed time range
 * @param endsAt - End of the proposed time range
 * @param excludeAppointmentId - Optional appointment ID to exclude (for reschedule)
 *
 * Requirements: 4.7, 4.8
 */
export async function checkConflicts(
  providerId: string,
  startsAt: Date,
  endsAt: Date,
  excludeAppointmentId?: string,
): Promise<ConflictCheckResult> {
  const where: Record<string, unknown> = {
    providerId,
    status: { not: 'CANCELLED' },
    // Overlap condition: existing.startsAt < proposed.endsAt AND existing.endsAt > proposed.startsAt
    startsAt: { lt: endsAt },
    endsAt: { gt: startsAt },
  };

  if (excludeAppointmentId) {
    where.id = { not: excludeAppointmentId };
  }

  const conflicting = await prisma.appointment.findMany({
    where,
    select: { id: true, startsAt: true, endsAt: true },
  });

  return {
    hasConflict: conflicting.length > 0,
    conflictingAppointments: conflicting,
  };
}

/**
 * Validate that both startsAt and endsAt fall within the bookable window (06:00–23:00 UTC).
 *
 * Returns true if valid, false otherwise.
 *
 * Requirements: 4.7
 */
export function validateBookableWindow(startsAt: Date, endsAt: Date): boolean {
  const startHour = startsAt.getUTCHours();
  const startMinutes = startsAt.getUTCMinutes();
  const startSeconds = startsAt.getUTCSeconds();
  const startMs = startsAt.getUTCMilliseconds();

  const endHour = endsAt.getUTCHours();
  const endMinutes = endsAt.getUTCMinutes();
  const endSeconds = endsAt.getUTCSeconds();
  const endMs = endsAt.getUTCMilliseconds();

  // Start must be at or after 06:00 UTC
  const startTimeInMinutes = startHour * 60 + startMinutes + startSeconds / 60 + startMs / 60000;
  if (startTimeInMinutes < 6 * 60) {
    return false;
  }

  // End must be at or before 23:00 UTC
  const endTimeInMinutes = endHour * 60 + endMinutes + endSeconds / 60 + endMs / 60000;
  if (endTimeInMinutes > 23 * 60) {
    return false;
  }

  return true;
}

/**
 * Create a new appointment.
 *
 * - Validates bookable window (06:00–23:00 UTC)
 * - Checks for conflicts with existing non-cancelled appointments
 * - Creates the appointment record
 * - Writes audit entry
 *
 * Requirements: 4.7, 4.8, 4.9
 */
export async function createAppointment(input: CreateAppointmentInput) {
  const { providerId, patientId, service, location, startsAt, endsAt, organizationId, actorId } =
    input;

  // Validate bookable window (Requirement 4.7)
  if (!validateBookableWindow(startsAt, endsAt)) {
    throw badRequest(
      'Appointment time falls outside the bookable window (06:00–23:00 UTC)',
    );
  }

  // Check for conflicts (Requirement 4.8)
  const conflicts = await checkConflicts(providerId, startsAt, endsAt);
  if (conflicts.hasConflict) {
    throw badRequest('Appointment conflicts with existing appointments for this provider', {
      conflicts: conflicts.conflictingAppointments,
    });
  }

  // Create appointment
  const appointment = await prisma.appointment.create({
    data: {
      organizationId,
      providerId,
      patientId,
      service,
      location,
      startsAt,
      endsAt,
      status: 'REQUESTED',
    },
  });

  // Write audit entry (Requirement 4.9)
  await safeWriteAuditLog({
    actorId,
    organizationId,
    action: 'appointment.created',
    resource: 'appointment',
    resourceId: appointment.id,
    details: {
      providerId,
      patientId,
      service,
      location,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    },
  });

  return appointment;
}

/**
 * Reschedule an existing appointment to a new time.
 *
 * - Validates the new time is within the bookable window
 * - Checks for conflicts at the new time (excluding self)
 * - Updates the appointment's startsAt and endsAt
 * - Writes audit entry with previous and new times
 *
 * Requirements: 4.8, 4.9
 */
export async function rescheduleAppointment(input: RescheduleAppointmentInput) {
  const { appointmentId, newStartsAt, newEndsAt, actorId, organizationId } = input;

  // Fetch the existing appointment
  const existing = await prisma.appointment.findUnique({
    where: { id: appointmentId },
  });

  if (!existing) {
    throw notFound('Appointment not found');
  }

  // Org-boundary check
  if (organizationId && existing.organizationId !== organizationId) {
    throw notFound('Appointment not found');
  }

  // Validate bookable window for the new time (Requirement 4.7)
  if (!validateBookableWindow(newStartsAt, newEndsAt)) {
    throw badRequest(
      'New appointment time falls outside the bookable window (06:00–23:00 UTC)',
    );
  }

  // Check for conflicts at the new time, excluding self (Requirement 4.8)
  const conflicts = await checkConflicts(existing.providerId, newStartsAt, newEndsAt, appointmentId);
  if (conflicts.hasConflict) {
    throw badRequest('New appointment time conflicts with existing appointments for this provider', {
      conflicts: conflicts.conflictingAppointments,
    });
  }

  // Store previous times for audit
  const previousStartsAt = existing.startsAt;
  const previousEndsAt = existing.endsAt;

  // Update the appointment
  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      startsAt: newStartsAt,
      endsAt: newEndsAt,
    },
  });

  // Write audit entry with old/new times (Requirement 4.9)
  await safeWriteAuditLog({
    actorId,
    organizationId: existing.organizationId,
    action: 'appointment.rescheduled',
    resource: 'appointment',
    resourceId: appointmentId,
    details: {
      previousStartsAt: previousStartsAt.toISOString(),
      previousEndsAt: previousEndsAt.toISOString(),
      newStartsAt: newStartsAt.toISOString(),
      newEndsAt: newEndsAt.toISOString(),
    },
  });

  return updated;
}

/**
 * Cancel an appointment.
 *
 * - Validates cancellation reason (1-500 chars)
 * - Sets appointment status to CANCELLED
 * - Writes audit entry including the cancellation reason
 *
 * Requirements: 4.10
 */
export async function cancelAppointment(input: CancelAppointmentInput) {
  const { appointmentId, reason, actorId, organizationId } = input;

  // Validate reason length (1-500 chars) — Requirement 4.10
  if (!reason || reason.length < 1 || reason.length > 500) {
    throw badRequest('Cancellation reason must be between 1 and 500 characters');
  }

  // Fetch the existing appointment
  const existing = await prisma.appointment.findUnique({
    where: { id: appointmentId },
  });

  if (!existing) {
    throw notFound('Appointment not found');
  }

  // Org-boundary check
  if (organizationId && existing.organizationId !== organizationId) {
    throw notFound('Appointment not found');
  }

  // Update status to CANCELLED
  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: 'CANCELLED',
    },
  });

  // Write audit entry with reason (Requirement 4.10)
  await safeWriteAuditLog({
    actorId,
    organizationId: existing.organizationId,
    action: 'appointment.cancelled',
    resource: 'appointment',
    resourceId: appointmentId,
    details: {
      reason,
      previousStatus: existing.status,
    },
  });

  return updated;
}
