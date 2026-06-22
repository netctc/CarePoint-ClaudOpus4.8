import { Router } from 'express';
import { coverageRuleSchema, coverageRuleUpdateSchema } from '@care-center/contracts';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { badRequest } from '../../lib/http';
import {
  getConfigStorageMode,
  getConfigItem,
  listConfigItems,
  summarizeConfigItems,
  transitionConfigItem,
  upsertConfigItem,
} from '../../lib/admin-config-store';

export const coverageRouter = Router();
const readRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'OPS_MANAGER', 'FINANCE'];
const writeRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'OPS_MANAGER'];


coverageRouter.use(requireAuth);
coverageRouter.use(allowRoles(readRoles));

coverageRouter.get('/summary', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const summary = await summarizeConfigItems('coverage', organizationId);
  res.json({ summary });
});

coverageRouter.get('/rules', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');

  const q = String(req.query.q ?? '').trim().toLowerCase();
  const status = String(req.query.status ?? '').trim().toUpperCase();
  const region = String(req.query.region ?? '').trim().toLowerCase();

  const items = (await listConfigItems('coverage', organizationId)).filter((item: any) => {
    if (status && item.status !== status) return false;
    if (region && !(item.regions || []).some((entry: string) => String(entry).toLowerCase().includes(region))) return false;
    if (!q) return true;
    return [item.code, item.name, item.payer, item.planType, ...(item.regions || []), ...(item.serviceCodes || [])]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  res.json({ items, count: items.length, storageMode: getConfigStorageMode('coverage') });
});

coverageRouter.get('/rules/:ruleId', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await getConfigItem('coverage', req.params.ruleId, organizationId);
  res.json({ item, storageMode: getConfigStorageMode('coverage') });
});

coverageRouter.post('/rules', allowRoles(writeRoles), validateBody(coverageRuleSchema), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await upsertConfigItem('coverage', req.body, { organizationId, actorId });
  res.status(201).json({ item, storageMode: getConfigStorageMode('coverage') });
});

coverageRouter.put('/rules/:ruleId', allowRoles(writeRoles), validateBody(coverageRuleUpdateSchema), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await upsertConfigItem('coverage', { ...req.body, id: req.params.ruleId }, { organizationId, actorId });
  res.json({ item, storageMode: getConfigStorageMode('coverage') });
});

coverageRouter.post('/rules/:ruleId/activate', allowRoles(writeRoles), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await transitionConfigItem('coverage', req.params.ruleId, 'PUBLISHED', { organizationId, actorId }, String(req.body?.note ?? '').trim() || null);
  res.json({ item, storageMode: getConfigStorageMode('coverage') });
});

coverageRouter.post('/rules/:ruleId/deactivate', allowRoles(writeRoles), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await transitionConfigItem('coverage', req.params.ruleId, 'ARCHIVED', { organizationId, actorId }, String(req.body?.note ?? '').trim() || null);
  res.json({ item, storageMode: getConfigStorageMode('coverage') });
});
