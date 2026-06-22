import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { badRequest, notFound } from '../../lib/http';
import { getProviderContext } from '../../lib/provider-context';
import { prisma } from '../../lib/prisma';
import { grantChartAccessException, listChartAccessExceptions, revokeChartAccessException } from '../../lib/chart-access-store';
import { buildHspAccessSummary } from '../../lib/hsp-access';
import { writeAuditLog } from '../../lib/audit';

export const providerTeamRouter = Router();
const allowedRoles = ['PROVIDER', 'NURSE'];

const chartAccessExceptionRequestSchema = z.object({
  patientId: z.string().trim().min(2),
  providerId: z.string().trim().min(2).optional(),
  reasonCode: z.enum(['CROSS_COVERAGE', 'ON_CALL', 'ESCALATED_REVIEW', 'LAB_RELEASE_BACKUP', 'MEDICATION_RECONCILIATION', 'TEMPORARY_TEAM_ASSIGNMENT']),
  note: z.string().trim().max(600).optional(),
  expiresAt: z.string().trim().optional(),
});

const revokeChartAccessSchema = z.object({
  note: z.string().trim().max(600).optional(),
});

providerTeamRouter.use(requireAuth);
providerTeamRouter.use(allowRoles(allowedRoles));

providerTeamRouter.get('/summary', async (req, res) => {
  const context = await getProviderContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const users = await prisma.user.findMany({ where: { organizationId: context.organizationId, role: { in: ['PROVIDER', 'NURSE', 'LAB_TECH', 'PHARMACIST'] } } });
  const exceptions = await listChartAccessExceptions({ organizationId: context.organizationId, status: 'ACTIVE' });
  res.json({
    summary: {
      total: users.length,
      providers: users.filter((user) => user.role === 'PROVIDER').length,
      nurses: users.filter((user) => user.role === 'NURSE').length,
      supportRoles: users.filter((user) => ['LAB_TECH', 'PHARMACIST'].includes(user.role)).length,
      chartAccessExceptions: exceptions.length,
    },
  });
});

providerTeamRouter.get('/members', async (req, res) => {
  const context = await getProviderContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const users = await prisma.user.findMany({
    where: { organizationId: context.organizationId, role: { in: ['PROVIDER', 'NURSE', 'LAB_TECH', 'PHARMACIST'] } },
    orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
  });
  res.json({
    items: users.map((user) => {
      const hspAccess = buildHspAccessSummary({ organizationId: context.organizationId, organizationName: context.organizationName, role: user.role });
      return {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`.trim() || user.email,
        role: user.role,
        facility: hspAccess.primaryFacility?.name ?? 'Main Clinic',
        accessScope: hspAccess.accessScopeLabel,
        mfaStatus: 'Managed by identity provider',
        status: user.id === req.user?.userId ? 'Signed in' : 'Active',
        variant: user.id === req.user?.userId ? 'success' : 'info',
      };
    }),
  });
});

providerTeamRouter.get('/chart-access-exceptions', async (req, res) => {
  const context = await getProviderContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const patientId = String(req.query.patientId ?? '').trim() || null;
  const status = String(req.query.status ?? 'ACTIVE').trim().toUpperCase() as 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'ALL';
  const items = await listChartAccessExceptions({ organizationId: context.organizationId, patientId, status });
  res.json({ items, count: items.length });
});

providerTeamRouter.post('/chart-access-exceptions', validateBody(chartAccessExceptionRequestSchema), async (req, res) => {
  const context = await getProviderContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const providerId = req.body.providerId ?? context.providerProfileId;
  if (!providerId) throw badRequest('Provider profile is required for chart access exceptions.');
  const item = await grantChartAccessException({
    organizationId: context.organizationId,
    patientId: req.body.patientId,
    providerId,
    createdByUserId: req.user?.userId,
    reasonCode: req.body.reasonCode,
    note: req.body.note ?? null,
    expiresAt: req.body.expiresAt ?? null,
  });
  await writeAuditLog({ actorId: req.user?.userId, organizationId: context.organizationId, action: 'provider.chart_access_exception_requested', resource: 'patient_chart_access', resourceId: item.id, details: item });
  res.status(201).json({ item });
});

providerTeamRouter.post('/chart-access-exceptions/:exceptionId/revoke', validateBody(revokeChartAccessSchema), async (req, res) => {
  const item = await revokeChartAccessException(req.params.exceptionId, req.user?.userId, req.body.note ?? null);
  if (!item) throw notFound('Chart access exception not found');
  await writeAuditLog({ actorId: req.user?.userId, organizationId: req.user?.organizationId, action: 'provider.chart_access_exception_revoked', resource: 'patient_chart_access', resourceId: item.id, details: item });
  res.json({ item });
});
