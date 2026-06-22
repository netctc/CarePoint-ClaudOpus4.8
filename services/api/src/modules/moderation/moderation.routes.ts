import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { badRequest } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import {
  getGrowthItem,
  getGrowthStorageMode,
  listGrowthItems,
  summarizeGrowthItems,
  transitionGrowthItem,
  upsertGrowthItem,
} from '../../lib/admin-growth-store';

export const moderationRouter = Router();
const readRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT'];
const writeRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT'];

const moderationCreateSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(2),
  title: z.string().min(4),
  queue: z.string().min(2),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  source: z.string().min(2),
  summary: z.string().min(10),
  tags: z.array(z.string()).default([]),
  riskSignals: z.array(z.string()).default([]),
  note: z.string().trim().max(500).optional(),
});

const moderationUpdateSchema = moderationCreateSchema.partial().extend({ id: z.string().optional() });
const assignSchema = z.object({ reviewerUserId: z.string().min(2), ownerName: z.string().min(2), note: z.string().trim().max(500).optional() });
const resolveSchema = z.object({ disposition: z.string().min(2), note: z.string().trim().max(500).optional() });
const escalateSchema = z.object({ queue: z.string().min(2), note: z.string().trim().max(500).optional() });

moderationRouter.use(requireAuth);
moderationRouter.use(allowRoles(readRoles));

async function getModerationAuditTrail(itemId: string, organizationId?: string) {
  return prisma.auditLog.findMany({
    where: { organizationId, resource: 'moderation_case', resourceId: itemId },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });
}

moderationRouter.get('/summary', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const summary = await summarizeGrowthItems('moderation', organizationId);
  res.json({ summary, storageMode: getGrowthStorageMode('moderation') });
});

moderationRouter.get('/reviews', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const q = String(req.query.q ?? '').trim().toLowerCase();
  const status = String(req.query.status ?? '').trim().toUpperCase();
  const priority = String(req.query.priority ?? '').trim().toUpperCase();

  const items = (await listGrowthItems('moderation', organizationId)).filter((item) => {
    if (status && item.status !== status) return false;
    if (priority && String(item.priority ?? '').trim().toUpperCase() !== priority) return false;
    if (!q) return true;
    return [item.code, item.title, item.summary ?? '', item.queue ?? '', ...(Array.isArray(item.tags) ? item.tags : [])].join(' ').toLowerCase().includes(q);
  });

  res.json({ items, count: items.length, storageMode: getGrowthStorageMode('moderation') });
});

moderationRouter.get('/reviews/:reviewId', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await getGrowthItem('moderation', req.params.reviewId, organizationId);
  const auditTrail = await getModerationAuditTrail(item.id, organizationId);
  res.json({ item, auditTrail, storageMode: getGrowthStorageMode('moderation') });
});

moderationRouter.post('/reviews', allowRoles(writeRoles), validateBody(moderationCreateSchema), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await upsertGrowthItem('moderation', { ...req.body, status: 'OPEN' }, { organizationId, actorId });
  res.status(201).json({ item, storageMode: getGrowthStorageMode('moderation') });
});

moderationRouter.put('/reviews/:reviewId', allowRoles(writeRoles), validateBody(moderationUpdateSchema), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await upsertGrowthItem('moderation', { ...req.body, id: req.params.reviewId }, { organizationId, actorId });
  res.json({ item, storageMode: getGrowthStorageMode('moderation') });
});

moderationRouter.post('/reviews/:reviewId/assign', allowRoles(writeRoles), validateBody(assignSchema), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await transitionGrowthItem('moderation', req.params.reviewId, 'IN_REVIEW', { organizationId, actorId }, req.body.note ?? null, {
    reviewerUserId: req.body.reviewerUserId,
    ownerName: req.body.ownerName,
  });
  res.json({ item, storageMode: getGrowthStorageMode('moderation') });
});

moderationRouter.post('/reviews/:reviewId/escalate', allowRoles(writeRoles), validateBody(escalateSchema), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await transitionGrowthItem('moderation', req.params.reviewId, 'ESCALATED', { organizationId, actorId }, req.body.note ?? null, {
    queue: req.body.queue,
  });
  res.json({ item, storageMode: getGrowthStorageMode('moderation') });
});

moderationRouter.post('/reviews/:reviewId/resolve', allowRoles(writeRoles), validateBody(resolveSchema), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await transitionGrowthItem('moderation', req.params.reviewId, 'RESOLVED', { organizationId, actorId }, req.body.note ?? null, {
    disposition: req.body.disposition,
    resolvedAt: new Date().toISOString(),
    resolvedBy: actorId ?? null,
  });
  res.json({ item, storageMode: getGrowthStorageMode('moderation') });
});
