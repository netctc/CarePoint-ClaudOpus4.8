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

export const supportRouter = Router();
const readRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'FINANCE'];
const writeRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT'];

const supportCreateSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(2),
  title: z.string().min(4),
  category: z.string().min(2),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  queue: z.string().min(2),
  channel: z.string().min(2),
  requesterName: z.string().min(2),
  summary: z.string().min(10),
  tags: z.array(z.string()).default([]),
  note: z.string().trim().max(500).optional(),
});

const supportUpdateSchema = supportCreateSchema.partial().extend({ id: z.string().optional() });
const assignSchema = z.object({ assigneeUserId: z.string().min(2), assigneeName: z.string().min(2), note: z.string().trim().max(500).optional() });
const escalateSchema = z.object({ queue: z.string().min(2), note: z.string().trim().max(500).optional() });
const resolveSchema = z.object({ resolutionCode: z.string().min(2), note: z.string().trim().max(500).optional() });

supportRouter.use(requireAuth);
supportRouter.use(allowRoles(readRoles));

async function getSupportAuditTrail(itemId: string, organizationId?: string) {
  return prisma.auditLog.findMany({
    where: { organizationId, resource: 'support_work_item', resourceId: itemId },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });
}

supportRouter.get('/summary', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const summary = await summarizeWorkflowItems('support', organizationId);
  res.json({ summary, storageMode: getWorkflowStorageMode('support') });
});

supportRouter.get('/work-items', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');

  const q = String(req.query.q ?? '').trim().toLowerCase();
  const status = String(req.query.status ?? '').trim().toUpperCase();
  const priority = String(req.query.priority ?? '').trim().toUpperCase();
  const queue = String(req.query.queue ?? '').trim().toLowerCase();

  const items = (await listWorkflowItems('support', organizationId)).filter((item) => {
    if (status && item.status !== status) return false;
    if (priority && String(item.priority ?? '').toUpperCase() !== priority) return false;
    if (queue && String(item.queue ?? '').trim().toLowerCase() !== queue) return false;
    if (!q) return true;
    return [item.code, item.title, item.requesterName ?? '', item.summary ?? '', ...(Array.isArray(item.tags) ? item.tags : [])]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  res.json({ items, count: items.length, storageMode: getWorkflowStorageMode('support') });
});

supportRouter.get('/work-items/:itemId', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await getWorkflowItem('support', req.params.itemId, organizationId);
  const auditTrail = await getSupportAuditTrail(item.id, organizationId);
  res.json({ item, auditTrail, storageMode: getWorkflowStorageMode('support') });
});

supportRouter.post('/work-items', allowRoles(writeRoles), validateBody(supportCreateSchema), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await upsertWorkflowItem('support', { ...req.body, status: 'OPEN' }, { organizationId, actorId });
  res.status(201).json({ item, storageMode: getWorkflowStorageMode('support') });
});

supportRouter.put('/work-items/:itemId', allowRoles(writeRoles), validateBody(supportUpdateSchema), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await upsertWorkflowItem('support', { ...req.body, id: req.params.itemId }, { organizationId, actorId });
  res.json({ item, storageMode: getWorkflowStorageMode('support') });
});

supportRouter.post('/work-items/:itemId/assign', allowRoles(writeRoles), validateBody(assignSchema), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await transitionWorkflowItem('support', req.params.itemId, 'IN_PROGRESS', { organizationId, actorId }, req.body.note ?? null, {
    assigneeUserId: req.body.assigneeUserId,
    assigneeName: req.body.assigneeName,
  });
  res.json({ item, storageMode: getWorkflowStorageMode('support') });
});

supportRouter.post('/work-items/:itemId/escalate', allowRoles(writeRoles), validateBody(escalateSchema), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await transitionWorkflowItem('support', req.params.itemId, 'ESCALATED', { organizationId, actorId }, req.body.note ?? null, {
    queue: req.body.queue,
  });
  res.json({ item, storageMode: getWorkflowStorageMode('support') });
});

supportRouter.post('/work-items/:itemId/resolve', allowRoles(writeRoles), validateBody(resolveSchema), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await transitionWorkflowItem('support', req.params.itemId, 'RESOLVED', { organizationId, actorId }, req.body.note ?? null, {
    resolutionCode: req.body.resolutionCode,
    resolvedAt: new Date(),
    resolvedBy: actorId ?? null,
  });
  res.json({ item, storageMode: getWorkflowStorageMode('support') });
});
