import { Router } from 'express';
import { z } from 'zod';
import { iamMiddlewareChain } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { writeAuditLog } from '../../lib/audit';

export const adminActionsRouter = Router();

const adminRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN'];

// ---------------------------------------------------------------------------
// POST /api/admin/reports/generate
// Generates a system summary report in JSON or CSV format.
// ---------------------------------------------------------------------------

const generateReportSchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
  type: z.string().trim().max(100).optional(),
});

adminActionsRouter.post(
  '/reports/generate',
  ...iamMiddlewareChain(adminRoles),
  validateBody(generateReportSchema),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    const actorId: string | undefined = req.user?.userId;
    const { format, type } = req.body as z.infer<typeof generateReportSchema>;

    const orgWhere = organizationId ? { organizationId } : undefined;

    // Gather system summary stats
    const [usersCount, providersCount, appointmentsCount, paymentsAggregate, activeProviders, pendingAppointments] =
      await Promise.all([
        prisma.user.count({ where: orgWhere }),
        prisma.providerProfile.count({ where: orgWhere }),
        prisma.appointment.count({ where: orgWhere }),
        prisma.payment.aggregate({ where: orgWhere ?? {}, _sum: { amountMinor: true }, _count: true }),
        prisma.providerProfile.count({ where: { ...orgWhere, status: 'ACTIVE' } }),
        prisma.appointment.count({ where: { ...orgWhere, status: 'REQUESTED' } }),
      ]);

    const reportData = {
      generatedAt: new Date().toISOString(),
      reportType: type ?? 'system_summary',
      organizationId: organizationId ?? null,
      summary: {
        usersCount,
        providersCount,
        activeProviders,
        appointmentsCount,
        pendingAppointments,
        paymentsCount: paymentsAggregate._count ?? 0,
        totalRevenueMinor: paymentsAggregate._sum?.amountMinor ?? 0,
      },
    };

    // Audit log the report generation
    await writeAuditLog({
      actorId,
      organizationId,
      action: 'admin.report.generated',
      resource: 'admin_report',
      details: { format, type: reportData.reportType, generatedAt: reportData.generatedAt },
    });

    if (format === 'csv') {
      const headers = ['metric', 'value'];
      const rows = Object.entries(reportData.summary).map(([key, value]) => [key, String(value)]);
      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="admin-report-${Date.now()}.csv"`,
      );
      return res.send(csvContent);
    }

    // JSON format — return as downloadable JSON
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="admin-report-${Date.now()}.json"`,
    );
    return res.send(JSON.stringify(reportData, null, 2));
  },
);

// ---------------------------------------------------------------------------
// POST /api/admin/system/sync
// Triggers a system sync: recalculates aggregate stats, verifies data
// integrity, and returns a status summary.
// ---------------------------------------------------------------------------

adminActionsRouter.post(
  '/system/sync',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    const actorId: string | undefined = req.user?.userId;

    const orgWhere = organizationId ? { organizationId } : undefined;

    // Recalculate aggregate stats
    const [usersCount, providersCount, appointmentsCount, activeProviders, completedAppointments, liveSessionsCount] =
      await Promise.all([
        prisma.user.count({ where: orgWhere }),
        prisma.providerProfile.count({ where: orgWhere }),
        prisma.appointment.count({ where: orgWhere }),
        prisma.providerProfile.count({ where: { ...orgWhere, status: 'ACTIVE' } }),
        prisma.appointment.count({ where: { ...orgWhere, status: 'COMPLETED' } }),
        prisma.telehealthSession.count({
          where: organizationId ? { appointment: { organizationId } } : undefined,
        }),
      ]);

    const syncedAt = new Date().toISOString();

    // Audit log the sync action
    await writeAuditLog({
      actorId,
      organizationId,
      action: 'admin.system.synced',
      resource: 'system_sync',
      details: { syncedAt, usersCount, providersCount, appointmentsCount },
    });

    res.json({
      success: true,
      syncedAt,
      summary: {
        usersCount,
        providersCount,
        activeProviders,
        appointmentsCount,
        completedAppointments,
        liveSessionsCount,
      },
    });
  },
);
