import { Router } from 'express';
import { z } from 'zod';
import { iamMiddlewareChain } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { writeAuditLog } from '../../lib/audit';

export const telehealthAdminRouter = Router();

const adminRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN'];

// ---------------------------------------------------------------------------
// GET /api/admin/telehealth/metrics
// Telehealth dashboard metrics for operations monitoring.
// ---------------------------------------------------------------------------

telehealthAdminRouter.get(
  '/telehealth/metrics',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;

    const now = new Date();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const orgFilter = organizationId
      ? { appointment: { organizationId } }
      : {};

    // Online consultations today
    const onlineConsultationsToday = await prisma.telehealthSession.count({
      where: {
        ...orgFilter,
        createdAt: { gte: todayStart, lte: todayEnd },
      },
    });

    // Session statuses
    // TelehealthStatus enum: SCHEDULED, READY, LIVE, ENDED
    const [ongoingSessions, completedSessions, failedSessions] = await Promise.all([
      prisma.telehealthSession.count({
        where: { ...orgFilter, status: 'LIVE' },
      }),
      prisma.telehealthSession.count({
        where: { ...orgFilter, status: 'ENDED' },
      }),
      // No explicit FAILED status in enum — count sessions that ended without startedAt as proxy
      prisma.telehealthSession.count({
        where: { ...orgFilter, status: 'SCHEDULED', scheduledAt: { lt: new Date(Date.now() - 60 * 60 * 1000) } },
      }),
    ]);

    // Average duration (from ended sessions)
    const completedSessionsData = await prisma.telehealthSession.findMany({
      where: { ...orgFilter, status: 'ENDED' },
      select: { startedAt: true, endedAt: true },
      take: 500,
      orderBy: { createdAt: 'desc' },
    });

    let avgDuration = 0;
    if (completedSessionsData.length > 0) {
      const totalMinutes = completedSessionsData.reduce((sum: number, s: any) => {
        if (s.startedAt && s.endedAt) {
          const diff = (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / (1000 * 60);
          return sum + Math.max(0, diff);
        }
        return sum;
      }, 0);
      avgDuration = Math.round(totalMinutes / completedSessionsData.length);
    }

    // Waiting patients (sessions in READY status)
    const waitingPatients = await prisma.telehealthSession.count({
      where: { ...orgFilter, status: 'READY' },
    });

    // Technical incidents (stale scheduled sessions in last 7 days — past their scheduled time)
    const technicalIncidents = await prisma.telehealthSession.count({
      where: {
        ...orgFilter,
        status: 'SCHEDULED',
        scheduledAt: { gte: sevenDaysAgo, lt: now },
      },
    });

    // Connection quality (derive from completion rate)
    const totalRecentSessions = await prisma.telehealthSession.count({
      where: { ...orgFilter, createdAt: { gte: sevenDaysAgo } },
    });
    const completedRecent = await prisma.telehealthSession.count({
      where: { ...orgFilter, status: 'ENDED', createdAt: { gte: sevenDaysAgo } },
    });
    const connectionQuality = totalRecentSessions > 0
      ? Math.round((completedRecent / totalRecentSessions) * 100)
      : 100;

    // Daily usage (last 7 days)
    const dailyUsage: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const count = await prisma.telehealthSession.count({
        where: {
          ...orgFilter,
          createdAt: { gte: dayStart, lte: dayEnd },
        },
      });

      dailyUsage.push({
        date: dayStart.toISOString().split('T')[0],
        count,
      });
    }

    // Weekly trends (last 4 weeks)
    const weeklyTrends: { week: string; sessions: number; completed: number; failed: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      weekEnd.setHours(23, 59, 59, 999);

      const [sessions, weekCompleted, weekFailed] = await Promise.all([
        prisma.telehealthSession.count({
          where: { ...orgFilter, createdAt: { gte: weekStart, lte: weekEnd } },
        }),
        prisma.telehealthSession.count({
          where: { ...orgFilter, status: 'ENDED', createdAt: { gte: weekStart, lte: weekEnd } },
        }),
        prisma.telehealthSession.count({
          where: { ...orgFilter, status: 'SCHEDULED', createdAt: { gte: weekStart, lte: weekEnd } },
        }),
      ]);

      weeklyTrends.push({
        week: `W${4 - i}`,
        sessions,
        completed: weekCompleted,
        failed: weekFailed,
      });
    }

    res.json({
      onlineConsultationsToday,
      ongoingSessions,
      completedSessions,
      failedSessions,
      avgDuration,
      waitingPatients,
      technicalIncidents,
      connectionQuality,
      dailyUsage,
      weeklyTrends,
    });
  },
);

// ---------------------------------------------------------------------------
// POST /api/admin/telehealth/incidents/:id/escalate
// Escalate a telehealth incident (failed/disconnected session).
// ---------------------------------------------------------------------------

const escalateSchema = z.object({
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().default('HIGH'),
  reason: z.string().max(500).optional(),
});

telehealthAdminRouter.post(
  '/telehealth/incidents/:id/escalate',
  ...iamMiddlewareChain(adminRoles),
  validateBody(escalateSchema),
  async (req: any, res: any) => {
    const { id } = req.params;
    const actorId: string | undefined = req.user?.userId ?? req.user?.id;
    const organizationId: string | undefined = req.user?.organizationId;
    const { severity, reason } = req.body as z.infer<typeof escalateSchema>;

    // Verify session exists
    const session = await prisma.telehealthSession.findUnique({
      where: { id },
      select: { id: true, status: true, appointmentId: true },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Telehealth session not found.' },
      });
    }

    // Update session status to reflect escalation
    await prisma.telehealthSession.update({
      where: { id },
      data: { status: 'ENDED', updatedAt: new Date() },
    });

    // Write audit log
    await writeAuditLog({
      actorId,
      organizationId,
      action: 'admin.telehealth.incident_escalated',
      resource: 'telehealth_session',
      resourceId: id,
      details: {
        previousStatus: session.status,
        severity,
        reason: reason ?? null,
        appointmentId: session.appointmentId,
      },
    });

    res.json({
      success: true,
      data: {
        sessionId: id,
        escalatedStatus: 'ESCALATED',
        severity,
      },
    });
  },
);

// ---------------------------------------------------------------------------
// GET /api/admin/telehealth/sessions
// Telehealth session list with filters.
// ---------------------------------------------------------------------------

telehealthAdminRouter.get(
  '/telehealth/sessions',
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

    // Build where clause
    const where: any = {};
    if (organizationId) {
      where.appointment = { organizationId };
    }

    // Provider filter
    const provider = (req.query.provider as string)?.trim();
    if (provider) {
      where.appointment = { ...where.appointment, providerId: provider };
    }

    // Patient filter
    const patient = (req.query.patient as string)?.trim();
    if (patient) {
      where.appointment = { ...where.appointment, patientId: patient };
    }

    // Date filter
    const dateFrom = (req.query.dateFrom as string)?.trim();
    const dateTo = (req.query.dateTo as string)?.trim();
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    // Session status filter
    const sessionStatus = (req.query.sessionStatus as string)?.trim()?.toUpperCase();
    if (sessionStatus) {
      where.status = sessionStatus;
    }

    // Connection quality filter (map to status categories)
    const connectionQuality = (req.query.connectionQuality as string)?.trim()?.toLowerCase();
    if (connectionQuality === 'poor') {
      where.status = 'SCHEDULED';
    } else if (connectionQuality === 'good') {
      where.status = { in: ['ENDED', 'LIVE'] };
    }

    // Incident type filter
    const incidentType = (req.query.incidentType as string)?.trim()?.toUpperCase();
    if (incidentType === 'FAILED') {
      where.status = 'SCHEDULED';
    } else if (incidentType === 'DISCONNECTED') {
      where.status = 'SCHEDULED';
    }

    // Build orderBy
    let orderBy: any;
    switch (sortBy) {
      case 'startedAt':
        orderBy = { startedAt: sortOrder };
        break;
      case 'status':
        orderBy = { status: sortOrder };
        break;
      default:
        orderBy = { createdAt: sortOrder };
        break;
    }

    // Execute queries
    const [total, sessions] = await Promise.all([
      prisma.telehealthSession.count({ where }),
      prisma.telehealthSession.findMany({
        where,
        include: {
          appointment: {
            select: {
              id: true,
              service: true,
              location: true,
              startsAt: true,
              providerId: true,
              patientId: true,
              provider: {
                include: { user: { select: { firstName: true, lastName: true } } },
              },
              patient: {
                include: { user: { select: { firstName: true, lastName: true } } },
              },
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    const mappedSessions = sessions.map((session: any) => ({
      id: session.id,
      appointmentId: session.appointmentId,
      status: session.status,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      duration: session.startedAt && session.endedAt
        ? Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / (1000 * 60))
        : null,
      providerId: session.appointment?.providerId ?? null,
      providerName: session.appointment?.provider?.user
        ? `${session.appointment.provider.user.firstName} ${session.appointment.provider.user.lastName}`.trim()
        : null,
      patientId: session.appointment?.patientId ?? null,
      patientName: session.appointment?.patient?.user
        ? `${session.appointment.patient.user.firstName} ${session.appointment.patient.user.lastName}`.trim()
        : null,
      service: session.appointment?.service ?? null,
      createdAt: session.createdAt,
    }));

    const totalPages = Math.ceil(total / limit);

    res.json({
      items: mappedSessions,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  },
);
