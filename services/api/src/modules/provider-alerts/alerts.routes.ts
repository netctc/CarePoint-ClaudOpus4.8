import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { badRequest } from '../../lib/http';
import { getProviderContext } from '../../lib/provider-context';
import { filterItemsByHspFacility, requireLocationWithinHspAccess } from '../../lib/hsp-access';
import { getProviderWorkspaceStorageMode, listProviderWorkspaceItems, transitionProviderWorkspaceItem } from '../../lib/provider-workspace-store';

export const providerAlertsRouter = Router();
const allowedRoles = ['PROVIDER', 'NURSE'];

providerAlertsRouter.use(requireAuth);
providerAlertsRouter.use(allowRoles(allowedRoles));

providerAlertsRouter.get('/', async (req, res) => {
  const context = await getProviderContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const status = String(req.query.status ?? '').trim().toUpperCase();
  const location = String(req.query.location ?? '').trim() || null;
  if (location) requireLocationWithinHspAccess(context.hspAccess, location, 'Requested alert facility');
  const items = filterItemsByHspFacility(
    context.hspAccess,
    (await listProviderWorkspaceItems('provider_alert', context.organizationId, context.providerProfileId)).filter((item) => !status || item.status === status),
    (item: any) => item.location ?? item.facility ?? null,
  ).filter((item: any) => !location || String(item.location ?? item.facility ?? '').toLowerCase().includes(location.toLowerCase()));
  res.json({ items, count: items.length, locationFilter: location, storageMode: getProviderWorkspaceStorageMode('provider_alert'), hspAccess: context.hspAccess });
});

providerAlertsRouter.post('/:alertId/acknowledge', async (req, res) => {
  const context = await getProviderContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const item = await transitionProviderWorkspaceItem('provider_alert', req.params.alertId, 'ACKNOWLEDGED', {
    organizationId: context.organizationId,
    providerId: context.providerProfileId,
    actorId: req.user?.userId,
  }, String(req.body?.note ?? '').trim() || null);
  res.json({ item, storageMode: getProviderWorkspaceStorageMode('provider_alert') });
});

providerAlertsRouter.post('/:alertId/resolve', async (req, res) => {
  const context = await getProviderContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const item = await transitionProviderWorkspaceItem('provider_alert', req.params.alertId, 'RESOLVED', {
    organizationId: context.organizationId,
    providerId: context.providerProfileId,
    actorId: req.user?.userId,
  }, String(req.body?.note ?? '').trim() || null);
  res.json({ item, storageMode: getProviderWorkspaceStorageMode('provider_alert') });
});
