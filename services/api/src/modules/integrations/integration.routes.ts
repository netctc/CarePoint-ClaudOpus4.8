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

export const integrationRouter = Router();
const readRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT'];
const writeRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN'];

const integrationSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(2),
  title: z.string().min(4),
  provider: z.string().min(2),
  category: z.string().min(2),
  environment: z.string().min(2),
  ownerRole: z.string().min(2),
  summary: z.string().min(10),
  tags: z.array(z.string()).default([]),
  lastHealthStatus: z.string().min(2).default('UNKNOWN'),
  note: z.string().trim().max(500).optional(),
});

integrationRouter.use(requireAuth);
integrationRouter.use(allowRoles(readRoles));

integrationRouter.get('/summary', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const summary = await summarizeGrowthItems('integrations', organizationId);
  res.json({ summary, storageMode: getGrowthStorageMode('integrations') });
});

integrationRouter.get('/', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const q = String(req.query.q ?? '').trim().toLowerCase();
  const status = String(req.query.status ?? '').trim().toUpperCase();
  const category = String(req.query.category ?? '').trim().toLowerCase();
  const items = (await listGrowthItems('integrations', organizationId)).filter((item) => {
    if (status && item.status !== status) return false;
    if (category && String(item.category ?? '').trim().toLowerCase() !== category) return false;
    if (!q) return true;
    return [item.code, item.title, item.provider ?? '', item.summary ?? '', ...(Array.isArray(item.tags) ? item.tags : [])].join(' ').toLowerCase().includes(q);
  });
  res.json({ items, count: items.length, storageMode: getGrowthStorageMode('integrations') });
});

integrationRouter.get('/:integrationId', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await getGrowthItem('integrations', req.params.integrationId, organizationId);
  res.json({ item, storageMode: getGrowthStorageMode('integrations') });
});

integrationRouter.post('/', allowRoles(writeRoles), validateBody(integrationSchema), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await upsertGrowthItem('integrations', { ...req.body, status: 'ACTIVE', lastCheckedAt: new Date().toISOString() }, { organizationId, actorId });
  res.status(201).json({ item, storageMode: getGrowthStorageMode('integrations') });
});

integrationRouter.put('/:integrationId', allowRoles(writeRoles), validateBody(integrationSchema.partial().extend({ id: z.string().optional() })), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await upsertGrowthItem('integrations', { ...req.body, id: req.params.integrationId, lastCheckedAt: new Date().toISOString() }, { organizationId, actorId });
  res.json({ item, storageMode: getGrowthStorageMode('integrations') });
});

integrationRouter.post('/:integrationId/rotate-secret', allowRoles(writeRoles), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await transitionGrowthItem('integrations', req.params.integrationId, 'ACTIVE', { organizationId, actorId }, String(req.body?.note ?? '').trim() || null, {
    lastRotatedAt: new Date().toISOString(),
    lastHealthStatus: 'HEALTHY',
    lastCheckedAt: new Date().toISOString(),
  });
  res.json({ item, storageMode: getGrowthStorageMode('integrations') });
});

integrationRouter.post('/:integrationId/disable', allowRoles(writeRoles), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await transitionGrowthItem('integrations', req.params.integrationId, 'DISABLED', { organizationId, actorId }, String(req.body?.note ?? '').trim() || null, {
    lastHealthStatus: 'DISABLED',
    lastCheckedAt: new Date().toISOString(),
  });
  res.json({ item, storageMode: getGrowthStorageMode('integrations') });
});
