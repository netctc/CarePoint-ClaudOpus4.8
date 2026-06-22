import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { badRequest } from '../../lib/http';
import {
  getGrowthItem,
  getGrowthStorageMode,
  listGrowthItems,
  summarizeGrowthItems,
  transitionGrowthItem,
  upsertGrowthItem,
} from '../../lib/admin-growth-store';

export const campaignRouter = Router();
const readRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT'];
const writeRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT'];

const campaignSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(2),
  title: z.string().min(4),
  audience: z.string().min(2),
  channel: z.string().min(2),
  ownerRole: z.string().min(2),
  summary: z.string().min(10),
  tags: z.array(z.string()).default([]),
  suppressionCount: z.number().int().min(0).default(0),
  scheduledFor: z.string().datetime().optional().nullable(),
  note: z.string().trim().max(500).optional(),
});

const scheduleSchema = z.object({ scheduledFor: z.string().datetime(), note: z.string().trim().max(500).optional() });

campaignRouter.use(requireAuth);
campaignRouter.use(allowRoles(readRoles));

campaignRouter.get('/summary', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const summary = await summarizeGrowthItems('campaigns', organizationId);
  res.json({ summary, storageMode: getGrowthStorageMode('campaigns') });
});

campaignRouter.get('/', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const q = String(req.query.q ?? '').trim().toLowerCase();
  const status = String(req.query.status ?? '').trim().toUpperCase();
  const channel = String(req.query.channel ?? '').trim().toLowerCase();

  const items = (await listGrowthItems('campaigns', organizationId)).filter((item) => {
    if (status && item.status !== status) return false;
    if (channel && String(item.channel ?? '').trim().toLowerCase() !== channel) return false;
    if (!q) return true;
    return [item.code, item.title, item.summary ?? '', item.audience ?? '', ...(Array.isArray(item.tags) ? item.tags : [])].join(' ').toLowerCase().includes(q);
  });

  res.json({ items, count: items.length, storageMode: getGrowthStorageMode('campaigns') });
});

campaignRouter.get('/:campaignId', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await getGrowthItem('campaigns', req.params.campaignId, organizationId);
  res.json({ item, storageMode: getGrowthStorageMode('campaigns') });
});

campaignRouter.post('/', allowRoles(writeRoles), validateBody(campaignSchema), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await upsertGrowthItem('campaigns', { ...req.body, status: 'DRAFT' }, { organizationId, actorId });
  res.status(201).json({ item, storageMode: getGrowthStorageMode('campaigns') });
});

campaignRouter.put('/:campaignId', allowRoles(writeRoles), validateBody(campaignSchema.partial().extend({ id: z.string().optional() })), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await upsertGrowthItem('campaigns', { ...req.body, id: req.params.campaignId }, { organizationId, actorId });
  res.json({ item, storageMode: getGrowthStorageMode('campaigns') });
});

campaignRouter.post('/:campaignId/approve', allowRoles(writeRoles), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await transitionGrowthItem('campaigns', req.params.campaignId, 'APPROVED', { organizationId, actorId }, String(req.body?.note ?? '').trim() || null);
  res.json({ item, storageMode: getGrowthStorageMode('campaigns') });
});

campaignRouter.post('/:campaignId/schedule', allowRoles(writeRoles), validateBody(scheduleSchema), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await transitionGrowthItem('campaigns', req.params.campaignId, 'SCHEDULED', { organizationId, actorId }, req.body.note ?? null, {
    scheduledFor: req.body.scheduledFor,
  });
  res.json({ item, storageMode: getGrowthStorageMode('campaigns') });
});

campaignRouter.post('/:campaignId/pause', allowRoles(writeRoles), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await transitionGrowthItem('campaigns', req.params.campaignId, 'PAUSED', { organizationId, actorId }, String(req.body?.note ?? '').trim() || null);
  res.json({ item, storageMode: getGrowthStorageMode('campaigns') });
});
