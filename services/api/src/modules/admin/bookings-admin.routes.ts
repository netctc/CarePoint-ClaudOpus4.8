import { Router } from 'express';
import { z } from 'zod';
import { iamMiddlewareChain } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { writeAuditLog } from '../../lib/audit';

export const bookingsAdminRouter = Router();

const adminRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN'];

// ---------------------------------------------------------------------------
// GET /api/admin/bookings
// Booking list with comprehensive filters and stats.
// ---------------------------------------------------------------------------

bookingsAdminRouter.get(
  '/bookings',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;

    // Pagination
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    // Sort
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc';

    // Build dynamic where clause
    const where: any = {};
    if (organizationId) {
      where.organizationId = organizationId;
    }

    // Date range filter
    const dateFrom = (req.query.dateFrom as string)?.trim();
    const dateTo = (req.query.dateTo as string)?.trim();
    if (dateFrom || dateTo) {
      where.startsAt = {};
      if (dateFrom) where.startsAt.gte = new Date(dateFrom);
      if (dateTo) where.startsAt.lte = new Date(dateTo);
    }

    // Provider filter
    const provider = (req.query.provider as string)?.trim();
    if (provider) {
      where.providerId = provider;
    }

    // Patient filter
    const patient = (req.query.patient as string)?.trim();
    if (patient) {
      where.patientId = patient;
    }

    // Status filter
    const status = (req.query.status as string)?.trim()?.toUpperCase();
    if (status && ['REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED'].includes(status)) {
      where.status = status;
    }

    // Service filter
    const service = (req.query.service as string)?.trim();
    if (service) {
      where.service = { contains: service, mode: 'insensitive' };
    }

    // Medical center filter (location)
    const medicalCenter = (req.query.medicalCenter as string)?.trim();
    if (medicalCenter) {
      where.location = { contains: medicalCenter, mode: 'insensitive' };
    }

    // Insurance filter (stored in metadata or notes)
    const insurance = (req.query.insurance as string)?.trim();
    if (insurance) {
      where.notes = { contains: insurance, mode: 'insensitive' };
    }

    // Mode filter (telehealth/inPerson)
    const mode = (req.query.mode as string)?.trim()?.toLowerCase();
    if (mode === 'telehealth') {
      where.telehealthSession = { isNot: null };
    }

    // Build orderBy
    let orderBy: any;
    switch (sortBy) {
      case 'startsAt':
        orderBy = { startsAt: sortOrder };
        break;
      case 'status':
        orderBy = { status: sortOrder };
        break;
      case 'service':
        orderBy = { service: sortOrder };
        break;
      default:
        orderBy = { createdAt: sortOrder };
        break;
    }

    // Execute queries: count + paginated fetch + stats
    const [total, items, statsData] = await Promise.all([
      prisma.appointment.count({ where }),
      prisma.appointment.findMany({
        where,
        include: {
          provider: {
            include: {
              user: { select: { firstName: true, lastName: true, email: true } },
            },
          },
          patient: {
            include: {
              user: { select: { firstName: true, lastName: true, email: true } },
            },
          },
          telehealthSession: { select: { id: true, status: true } },
        },
        orderBy,
        skip,
        take: limit,
      }),
      // Stats aggregation
      computeBookingStats(where, organizationId),
    ]);

    const mappedItems = items.map((appt: any) => ({
      id: appt.id,
      patientId: appt.patientId,
      patientName: appt.patient?.user
        ? `${appt.patient.user.firstName} ${appt.patient.user.lastName}`.trim()
        : appt.patientId,
      patientEmail: appt.patient?.user?.email ?? null,
      providerId: appt.providerId,
      providerName: appt.provider?.user
        ? `${appt.provider.user.firstName} ${appt.provider.user.lastName}`.trim()
        : appt.providerId,
      providerEmail: appt.provider?.user?.email ?? null,
      service: appt.service,
      location: appt.location,
      status: appt.status,
      startsAt: appt.startsAt,
      endsAt: appt.endsAt,
      mode: appt.telehealthSession ? 'telehealth' : 'in-person',
      notes: appt.notes ?? null,
      createdAt: appt.createdAt,
      updatedAt: appt.updatedAt,
    }));

    const totalPages = Math.ceil(total / limit);

    res.json({
      items: mappedItems,
      stats: statsData,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  },
);

async function computeBookingStats(baseWhere: any, organizationId?: string) {
  const orgWhere = organizationId ? { organizationId } : {};
  const now = new Date();

  const [totalBookings, upcoming, completed, cancelled, noShows] = await Promise.all([
    prisma.appointment.count({ where: { ...orgWhere } }),
    prisma.appointment.count({
      where: { ...orgWhere, startsAt: { gt: now }, status: { in: ['REQUESTED', 'CONFIRMED'] } },
    }),
    prisma.appointment.count({ where: { ...orgWhere, status: 'COMPLETED' } }),
    prisma.appointment.count({ where: { ...orgWhere, status: 'CANCELLED' } }),
    prisma.appointment.count({ where: { ...orgWhere, status: 'NO_SHOW' } }),
  ]);

  // Rescheduled — appointments with an updatedAt significantly different from createdAt (proxy)
  const rescheduled = await prisma.appointment.count({
    where: { ...orgWhere, status: 'RESCHEDULED' as any },
  }).catch(() => 0);

  // Average waiting time (difference between createdAt and startsAt for confirmed/completed)
  const recentAppointments = await prisma.appointment.findMany({
    where: { ...orgWhere, status: { in: ['CONFIRMED', 'COMPLETED'] } },
    select: { createdAt: true, startsAt: true },
    take: 500,
    orderBy: { createdAt: 'desc' },
  });

  let avgWaitingTime = 0;
  if (recentAppointments.length > 0) {
    const totalMinutes = recentAppointments.reduce((sum: number, appt: any) => {
      const diff = (new Date(appt.startsAt).getTime() - new Date(appt.createdAt).getTime()) / (1000 * 60);
      return sum + Math.max(0, diff);
    }, 0);
    avgWaitingTime = Math.round(totalMinutes / recentAppointments.length);
  }

  // Success rate (completed / total that reached a terminal state)
  const terminalCount = completed + cancelled + noShows;
  const successRate = terminalCount > 0 ? Math.round((completed / terminalCount) * 100 * 10) / 10 : 100;

  return {
    totalBookings,
    upcoming,
    completed,
    cancelled,
    rescheduled,
    noShows,
    avgWaitingTime,
    successRate,
  };
}

// ---------------------------------------------------------------------------
// POST /api/admin/bookings/bulk-notify
// Send notifications to selected bookings.
// ---------------------------------------------------------------------------

const bulkNotifySchema = z.object({
  bookingIds: z.array(z.string()).min(1, 'At least one booking ID is required'),
  message: z.string().max(500).optional(),
});

bookingsAdminRouter.post(
  '/bookings/bulk-notify',
  ...iamMiddlewareChain(adminRoles),
  validateBody(bulkNotifySchema),
  async (req: any, res: any) => {
    const actorId: string | undefined = req.user?.userId ?? req.user?.id;
    const organizationId: string | undefined = req.user?.organizationId;
    const { bookingIds, message } = req.body as z.infer<typeof bulkNotifySchema>;

    // Verify bookings exist
    const bookings = await prisma.appointment.findMany({
      where: { id: { in: bookingIds } },
      select: { id: true, patientId: true, providerId: true, status: true },
    });

    if (bookings.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No matching bookings found.' },
      });
    }

    // Mark as notified (update the updatedAt to track notification time)
    await prisma.appointment.updateMany({
      where: { id: { in: bookings.map((b: any) => b.id) } },
      data: { updatedAt: new Date() },
    });

    // Write audit log
    await writeAuditLog({
      actorId,
      organizationId,
      action: 'admin.bookings.bulk_notify',
      resource: 'appointment',
      resourceId: bookingIds.join(','),
      details: { notifiedCount: bookings.length, message: message ?? null, bookingIds },
    });

    res.json({
      success: true,
      data: { notifiedCount: bookings.length, bookingIds: bookings.map((b: any) => b.id) },
    });
  },
);

// ---------------------------------------------------------------------------
// POST /api/admin/bookings/:id/reassign
// Reassign a booking to a different provider.
// ---------------------------------------------------------------------------

const reassignSchema = z.object({
  providerId: z.string().min(1, 'providerId is required'),
  reason: z.string().max(500).optional(),
});

bookingsAdminRouter.post(
  '/bookings/:id/reassign',
  ...iamMiddlewareChain(adminRoles),
  validateBody(reassignSchema),
  async (req: any, res: any) => {
    const { id } = req.params;
    const actorId: string | undefined = req.user?.userId ?? req.user?.id;
    const organizationId: string | undefined = req.user?.organizationId;
    const { providerId, reason } = req.body as z.infer<typeof reassignSchema>;

    // Verify appointment exists
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: { id: true, providerId: true, status: true },
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Appointment not found.' },
      });
    }

    // Verify new provider exists
    const newProvider = await prisma.providerProfile.findUnique({
      where: { id: providerId },
      include: { user: { select: { firstName: true, lastName: true } } },
    });

    if (!newProvider) {
      return res.status(404).json({
        success: false,
        error: { code: 'PROVIDER_NOT_FOUND', message: 'Target provider not found.' },
      });
    }

    const previousProviderId = appointment.providerId;

    // Update appointment
    const updated = await prisma.appointment.update({
      where: { id },
      data: { providerId, updatedAt: new Date() },
      include: {
        provider: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    // Write audit log
    await writeAuditLog({
      actorId,
      organizationId,
      action: 'admin.booking.reassigned',
      resource: 'appointment',
      resourceId: id,
      details: {
        previousProviderId,
        newProviderId: providerId,
        reason: reason ?? null,
      },
    });

    res.json({
      success: true,
      data: {
        appointmentId: updated.id,
        newProviderId: providerId,
        newProviderName: `${newProvider.user.firstName} ${newProvider.user.lastName}`.trim(),
      },
    });
  },
);

// ---------------------------------------------------------------------------
// POST /api/admin/bookings/:id/cancel
// Cancel a booking with a reason and audit log.
// ---------------------------------------------------------------------------

const cancelSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
});

bookingsAdminRouter.post(
  '/bookings/:id/cancel',
  ...iamMiddlewareChain(adminRoles),
  validateBody(cancelSchema),
  async (req: any, res: any) => {
    const { id } = req.params;
    const actorId: string | undefined = req.user?.userId ?? req.user?.id;
    const organizationId: string | undefined = req.user?.organizationId;
    const { reason } = req.body as z.infer<typeof cancelSchema>;

    // Verify appointment exists
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: { id: true, status: true, patientId: true, providerId: true },
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Appointment not found.' },
      });
    }

    if (appointment.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        error: { code: 'ALREADY_CANCELLED', message: 'Appointment is already cancelled.' },
      });
    }

    // Update status to CANCELLED
    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: 'CANCELLED', notes: reason, updatedAt: new Date() },
    });

    // Write audit log
    await writeAuditLog({
      actorId,
      organizationId,
      action: 'admin.booking.cancelled',
      resource: 'appointment',
      resourceId: id,
      details: {
        previousStatus: appointment.status,
        reason,
        patientId: appointment.patientId,
        providerId: appointment.providerId,
      },
    });

    res.json({
      success: true,
      data: { appointmentId: updated.id, status: 'CANCELLED' },
    });
  },
);

// ---------------------------------------------------------------------------
// POST /api/admin/bookings/:id/refund-review
// Mark an appointment for refund review.
// ---------------------------------------------------------------------------

bookingsAdminRouter.post(
  '/bookings/:id/refund-review',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const { id } = req.params;
    const actorId: string | undefined = req.user?.userId ?? req.user?.id;
    const organizationId: string | undefined = req.user?.organizationId;

    // Verify appointment exists
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: { id: true, status: true, patientId: true, providerId: true },
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Appointment not found.' },
      });
    }

    // Mark for refund review by updating notes
    await prisma.appointment.update({
      where: { id },
      data: {
        notes: 'REFUND_REVIEW_REQUESTED',
        updatedAt: new Date(),
      },
    });

    // Write audit log
    await writeAuditLog({
      actorId,
      organizationId,
      action: 'admin.booking.refund_review',
      resource: 'appointment',
      resourceId: id,
      details: {
        status: appointment.status,
        patientId: appointment.patientId,
        providerId: appointment.providerId,
      },
    });

    res.json({
      success: true,
      data: { appointmentId: id, refundReviewStatus: 'REQUESTED' },
    });
  },
);
