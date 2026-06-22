import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { badRequest } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import {
  getWorkflowItem,
  getWorkflowStorageMode,
  listWorkflowItems,
  summarizeWorkflowItems,
  transitionWorkflowItem,
  upsertWorkflowItem,
} from '../../lib/admin-workflow-store';

export const safetyRouter = Router();
const readRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'PROVIDER', 'NURSE'];
const writeRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT'];

const safetyCreateSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(2),
  title: z.string().min(4),
  category: z.string().min(2),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  queue: z.string().min(2),
  patientImpact: z.string().min(2),
  ownerName: z.string().optional().nullable(),
  summary: z.string().min(10),
  tags: z.array(z.string()).default([]),
  note: z.string().trim().max(500).optional(),
});

const safetyUpdateSchema = safetyCreateSchema.partial().extend({ id: z.string().optional() });
const triageSchema = z.object({ severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']), ownerName: z.string().min(2).optional(), note: z.string().trim().max(500).optional() });
const actionRequiredSchema = z.object({ actionPlan: z.string().min(4), note: z.string().trim().max(500).optional() });
const closeSchema = z.object({ closureCode: z.string().min(2), note: z.string().trim().max(500).optional() });

safetyRouter.use(requireAuth);
safetyRouter.use(allowRoles(readRoles));

async function getSafetyAuditTrail(itemId: string, organizationId?: string) {
  return prisma.auditLog.findMany({
    where: { organizationId, resource: 'safety_case', resourceId: itemId },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });
}

safetyRouter.get('/summary', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const summary = await summarizeWorkflowItems('safety', organizationId);
  res.json({ summary, storageMode: getWorkflowStorageMode('safety') });
});

safetyRouter.get('/cases', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');

  const q = String(req.query.q ?? '').trim().toLowerCase();
  const status = String(req.query.status ?? '').trim().toUpperCase();
  const severity = String(req.query.severity ?? '').trim().toUpperCase();
  const queue = String(req.query.queue ?? '').trim().toLowerCase();

  const items = (await listWorkflowItems('safety', organizationId)).filter((item) => {
    if (status && item.status !== status) return false;
    if (severity && String(item.severity ?? '').toUpperCase() !== severity) return false;
    if (queue && String(item.queue ?? '').trim().toLowerCase() !== queue) return false;
    if (!q) return true;
    return [item.code, item.title, item.summary ?? '', item.ownerName ?? '', ...(Array.isArray(item.tags) ? item.tags : [])]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  res.json({ items, count: items.length, storageMode: getWorkflowStorageMode('safety') });
});

safetyRouter.get('/cases/:caseId', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await getWorkflowItem('safety', req.params.caseId, organizationId);
  const auditTrail = await getSafetyAuditTrail(item.id, organizationId);
  res.json({ item, auditTrail, storageMode: getWorkflowStorageMode('safety') });
});

safetyRouter.post('/cases', allowRoles(writeRoles), validateBody(safetyCreateSchema), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await upsertWorkflowItem('safety', { ...req.body, status: 'NEW' }, { organizationId, actorId });
  res.status(201).json({ item, storageMode: getWorkflowStorageMode('safety') });
});

safetyRouter.put('/cases/:caseId', allowRoles(writeRoles), validateBody(safetyUpdateSchema), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await upsertWorkflowItem('safety', { ...req.body, id: req.params.caseId }, { organizationId, actorId });
  res.json({ item, storageMode: getWorkflowStorageMode('safety') });
});

safetyRouter.post('/cases/:caseId/triage', allowRoles(writeRoles), validateBody(triageSchema), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await transitionWorkflowItem('safety', req.params.caseId, 'TRIAGED', { organizationId, actorId }, req.body.note ?? null, {
    severity: req.body.severity,
    ownerName: req.body.ownerName ?? undefined,
  });
  res.json({ item, storageMode: getWorkflowStorageMode('safety') });
});

safetyRouter.post('/cases/:caseId/action-required', allowRoles(writeRoles), validateBody(actionRequiredSchema), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await transitionWorkflowItem('safety', req.params.caseId, 'ACTION_REQUIRED', { organizationId, actorId }, req.body.note ?? null, {
    actionPlan: req.body.actionPlan,
  });
  res.json({ item, storageMode: getWorkflowStorageMode('safety') });
});

safetyRouter.post('/cases/:caseId/close', allowRoles(writeRoles), validateBody(closeSchema), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await transitionWorkflowItem('safety', req.params.caseId, 'CLOSED', { organizationId, actorId }, req.body.note ?? null, {
    closureCode: req.body.closureCode,
    closedAt: new Date(),
    closedBy: actorId ?? null,
  });
  res.json({ item, storageMode: getWorkflowStorageMode('safety') });
});
