import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { badRequest } from '../../lib/http';
import { getConfigStorageMode, getConfigItem, listConfigItems, summarizeConfigItems, transitionConfigItem, upsertConfigItem } from '../../lib/admin-config-store';

export const catalogRouter = Router();
const readRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'FINANCE'];
const writeRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN'];

const serviceSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(2),
  name: z.string().min(2),
  category: z.string().min(2),
  description: z.string().min(5),
  serviceModes: z.array(z.string()).default([]),
  durationMinutes: z.number().int().positive().max(480),
  requiresCoverageCheck: z.boolean().default(true),
  requiresLicenseValidation: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
  note: z.string().trim().max(500).optional(),
});

catalogRouter.use(requireAuth);
catalogRouter.use(allowRoles(readRoles));

catalogRouter.get('/summary', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const summary = await summarizeConfigItems('catalog', organizationId);
  res.json({ summary });
});

catalogRouter.get('/services', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');

  const q = String(req.query.q ?? '').trim().toLowerCase();
  const status = String(req.query.status ?? '').trim().toUpperCase();
  const category = String(req.query.category ?? '').trim().toLowerCase();
  const items = (await listConfigItems('catalog', organizationId)).filter((item) => {
    if (status && item.status !== status) return false;
    if (category && String(item.category ?? '').trim().toLowerCase() !== category) return false;
    if (!q) return true;
    return [item.code, item.name, item.category, item.description, ...(Array.isArray(item.tags) ? item.tags : [])]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  res.json({
    items,
    count: items.length,
    storageMode: getConfigStorageMode('catalog'),
  });
});

catalogRouter.get('/services/:serviceId', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await getConfigItem('catalog', req.params.serviceId, organizationId);
  res.json({ item, storageMode: getConfigStorageMode('catalog') });
});

catalogRouter.post('/services', allowRoles(writeRoles), validateBody(serviceSchema), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await upsertConfigItem('catalog', req.body, { organizationId, actorId });
  res.status(201).json({ item, storageMode: getConfigStorageMode('catalog') });
});

catalogRouter.put('/services/:serviceId', allowRoles(writeRoles), validateBody(serviceSchema.partial().extend({ id: z.string().optional() })), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await upsertConfigItem('catalog', { ...req.body, id: req.params.serviceId }, { organizationId, actorId });
  res.json({ item, storageMode: getConfigStorageMode('catalog') });
});

catalogRouter.post('/services/:serviceId/publish', allowRoles(writeRoles), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await transitionConfigItem('catalog', req.params.serviceId, 'PUBLISHED', { organizationId, actorId }, String(req.body?.note ?? '').trim() || null);
  res.json({ item, storageMode: getConfigStorageMode('catalog') });
});

catalogRouter.post('/services/:serviceId/archive', allowRoles(writeRoles), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await transitionConfigItem('catalog', req.params.serviceId, 'ARCHIVED', { organizationId, actorId }, String(req.body?.note ?? '').trim() || null);
  res.json({ item, storageMode: getConfigStorageMode('catalog') });
});
