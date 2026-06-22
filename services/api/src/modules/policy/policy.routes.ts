import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { badRequest } from '../../lib/http';
import { getConfigStorageMode, getConfigItem, listConfigItems, summarizeConfigItems, transitionConfigItem, upsertConfigItem } from '../../lib/admin-config-store';

export const policyRouter = Router();
const readRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'FINANCE'];
const writeRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN'];

const policySchema = z.object({
  id: z.string().optional(),
  code: z.string().min(2),
  title: z.string().min(2),
  name: z.string().min(2).optional(),
  category: z.string().min(2),
  description: z.string().min(5),
  appliesTo: z.array(z.string()).default([]),
  approvalRoles: z.array(z.string()).default([]),
  content: z.record(z.any()).default({}),
  note: z.string().trim().max(500).optional(),
});

policyRouter.use(requireAuth);
policyRouter.use(allowRoles(readRoles));

policyRouter.get('/summary', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const summary = await summarizeConfigItems('policy', organizationId);
  res.json({ summary });
});

policyRouter.get('/templates', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const q = String(req.query.q ?? '').trim().toLowerCase();
  const status = String(req.query.status ?? '').trim().toUpperCase();
  const category = String(req.query.category ?? '').trim().toLowerCase();
  const items = (await listConfigItems('policy', organizationId)).filter((item) => {
    if (status && item.status !== status) return false;
    if (category && String(item.category ?? '').trim().toLowerCase() !== category) return false;
    if (!q) return true;
    return [item.code, item.title ?? item.name, item.category, item.description, ...(Array.isArray(item.appliesTo) ? item.appliesTo : [])]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  res.json({ items, count: items.length, storageMode: getConfigStorageMode('policy') });
});

policyRouter.get('/templates/:templateId', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await getConfigItem('policy', req.params.templateId, organizationId);
  res.json({ item, storageMode: getConfigStorageMode('policy') });
});

policyRouter.post('/templates', allowRoles(writeRoles), validateBody(policySchema), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await upsertConfigItem('policy', { ...req.body, name: req.body.name ?? req.body.title }, { organizationId, actorId });
  res.status(201).json({ item, storageMode: getConfigStorageMode('policy') });
});

policyRouter.put('/templates/:templateId', allowRoles(writeRoles), validateBody(policySchema.partial().extend({ id: z.string().optional() })), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await upsertConfigItem('policy', { ...req.body, id: req.params.templateId, name: req.body.name ?? req.body.title }, { organizationId, actorId });
  res.json({ item, storageMode: getConfigStorageMode('policy') });
});

policyRouter.post('/templates/:templateId/publish', allowRoles(writeRoles), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await transitionConfigItem('policy', req.params.templateId, 'PUBLISHED', { organizationId, actorId }, String(req.body?.note ?? '').trim() || null);
  res.json({ item, storageMode: getConfigStorageMode('policy') });
});

policyRouter.post('/templates/:templateId/archive', allowRoles(writeRoles), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await transitionConfigItem('policy', req.params.templateId, 'ARCHIVED', { organizationId, actorId }, String(req.body?.note ?? '').trim() || null);
  res.json({ item, storageMode: getConfigStorageMode('policy') });
});
