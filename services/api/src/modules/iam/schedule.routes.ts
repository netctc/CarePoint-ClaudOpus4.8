import { Router } from 'express';
import { iamMiddlewareChain } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { createAppointmentSchema, cancelAppointmentSchema } from './schemas';
import { prisma } from '../../lib/prisma';
import { forbidden } from '../../lib/http';
import {
  createAppointment,
  rescheduleAppointment,
  cancelAppointment,
} from './schedule.service';

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const scheduleRouter = Router();

// Roles allowed to manage schedules
const scheduleRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'PROVIDER'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Provider role enforcement: if the authenticated user is a PROVIDER,
 * they can only access their own schedule. Resolves the provider profile
 * from the user's userId and compares against the :providerId param.
 *
 * Requirements: 4.6, 4.11
 */
async function enforceProviderAccess(
  userId: string,
  role: string,
  providerId: string,
): Promise<void> {
  if (role !== 'PROVIDER') return;

  const providerProfile = await prisma.providerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!providerProfile || providerProfile.id !== providerId) {
    throw forbidden('Providers can only access their own schedule');
  }
}

// ---------------------------------------------------------------------------
// GET /api/iam/schedules/:providerId/appointments
// List provider appointments (org-scoped, optional date range filter)
// Requirements: 4.1, 4.2, 4.3, 4.6
// ---------------------------------------------------------------------------
scheduleRouter.get(
  '/:providerId/appointments',
  ...iamMiddlewareChain(scheduleRoles),
  async (req, res, next) => {
    try {
      const { providerId } = req.params;

      // Provider role enforcement
      await enforceProviderAccess(req.user!.userId, req.user!.role, providerId);

      // Build query filter
      const where: Record<string, unknown> = { providerId };

      // Org-scope filter (non-SUPER_ADMIN)
      if (req.orgFilter) {
        where.organizationId = req.orgFilter.organizationId;
      }

      // Optional date range filters
      const { from, to } = req.query;
      if (from || to) {
        const startsAtFilter: Record<string, Date> = {};
        if (from) startsAtFilter.gte = new Date(String(from));
        if (to) startsAtFilter.lte = new Date(String(to));
        where.startsAt = startsAtFilter;
      }

      const appointments = await prisma.appointment.findMany({
        where,
        orderBy: { startsAt: 'asc' },
      });

      res.json({ data: appointments });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/iam/schedules/:providerId/appointments
// Create a new appointment
// Requirements: 4.7, 4.8
// ---------------------------------------------------------------------------
scheduleRouter.post(
  '/:providerId/appointments',
  ...iamMiddlewareChain(scheduleRoles),
  validateBody(createAppointmentSchema),
  async (req, res, next) => {
    try {
      const { providerId } = req.params;

      // Provider role enforcement
      await enforceProviderAccess(req.user!.userId, req.user!.role, providerId);

      // Determine organizationId from org-scope or provider's profile
      const organizationId =
        req.orgFilter?.organizationId ?? req.user!.organizationId;

      // Parse date strings into Date objects
      const startsAt = new Date(req.body.startsAt);
      const endsAt = new Date(req.body.endsAt);

      const appointment = await createAppointment({
        providerId,
        patientId: req.body.patientId,
        service: req.body.service,
        location: req.body.location,
        startsAt,
        endsAt,
        organizationId: organizationId!,
        actorId: req.user!.userId,
      });

      res.status(201).json(appointment);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /api/iam/schedules/appointments/:id
// Reschedule an appointment (update startsAt/endsAt)
// Requirements: 4.8, 4.9
// ---------------------------------------------------------------------------
scheduleRouter.patch(
  '/appointments/:id',
  ...iamMiddlewareChain(scheduleRoles),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { startsAt, endsAt } = req.body;

      // Parse new dates
      const newStartsAt = new Date(startsAt);
      const newEndsAt = new Date(endsAt);

      const updated = await rescheduleAppointment({
        appointmentId: id,
        newStartsAt,
        newEndsAt,
        actorId: req.user!.userId,
        organizationId: req.orgFilter?.organizationId,
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /api/iam/schedules/appointments/:id/cancel
// Cancel an appointment
// Requirements: 4.10
// ---------------------------------------------------------------------------
scheduleRouter.patch(
  '/appointments/:id/cancel',
  ...iamMiddlewareChain(scheduleRoles),
  validateBody(cancelAppointmentSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const updated = await cancelAppointment({
        appointmentId: id,
        reason: req.body.reason,
        actorId: req.user!.userId,
        organizationId: req.orgFilter?.organizationId,
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);
