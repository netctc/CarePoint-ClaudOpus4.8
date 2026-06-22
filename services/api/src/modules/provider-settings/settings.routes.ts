import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { badRequest } from '../../lib/http';
import { getProviderContext } from '../../lib/provider-context';
import { getProviderWorkspaceStorageMode, getProviderWorkspaceItem, listProviderWorkspaceItems, summarizeProviderWorkspaceItems, upsertProviderWorkspaceItem } from '../../lib/provider-workspace-store';

export const providerSettingsRouter = Router();
const allowedRoles = ['PROVIDER', 'NURSE'];

const facilitySchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2),
  address: z.string().trim().min(2),
  serviceModes: z.array(z.string()).default([]),
  publishStatus: z.string().trim().min(2),
  serviceMatrix: z.array(z.object({ service: z.string(), channel: z.string(), price: z.string(), effectiveDate: z.string() })).default([]),
});

providerSettingsRouter.use(requireAuth);
providerSettingsRouter.use(allowRoles(allowedRoles));

providerSettingsRouter.get('/summary', async (req, res) => {
  const context = await getProviderContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const summary = await summarizeProviderWorkspaceItems('facility_setting', context.organizationId);
  res.json({ summary, storageMode: getProviderWorkspaceStorageMode('facility_setting') });
});

providerSettingsRouter.get('/facilities', async (req, res) => {
  const context = await getProviderContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const items = await listProviderWorkspaceItems('facility_setting', context.organizationId);
  res.json({ items, count: items.length, storageMode: getProviderWorkspaceStorageMode('facility_setting') });
});

providerSettingsRouter.get('/facilities/:facilityId', async (req, res) => {
  const context = await getProviderContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const item = await getProviderWorkspaceItem('facility_setting', req.params.facilityId, context.organizationId);
  res.json({ item, storageMode: getProviderWorkspaceStorageMode('facility_setting') });
});

providerSettingsRouter.put('/facilities/:facilityId', validateBody(facilitySchema), async (req, res) => {
  const context = await getProviderContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const item = await upsertProviderWorkspaceItem('facility_setting', { ...req.body, id: req.params.facilityId }, {
    organizationId: context.organizationId,
    actorId: req.user?.userId,
    providerId: null,
  });
  res.json({ item, storageMode: getProviderWorkspaceStorageMode('facility_setting') });
});
