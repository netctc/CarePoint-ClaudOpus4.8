import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { badRequest } from '../../lib/http';
import { getPatientContext } from '../../lib/patient-context';
import { enrichPatientNotificationItems } from '../../lib/refill-notification-enrichment';
import { getPatientWorkspaceStorageMode, getPatientWorkspaceItem, listPatientWorkspaceItems, summarizePatientWorkspaceItems, upsertPatientWorkspaceItem } from '../../lib/patient-workspace-store';

export const patientNotificationsRouter = Router();
const allowedRoles = ['PATIENT'];

const preferenceSchema = z.object({
  channel: z.enum(['push', 'sms', 'email']),
  enabled: z.boolean(),
});

patientNotificationsRouter.use(requireAuth);
patientNotificationsRouter.use(allowRoles(allowedRoles));

patientNotificationsRouter.get('/summary', async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const items = await listPatientWorkspaceItems('patient_notification', context.organizationId, context.patientProfileId);
  const summary = await summarizePatientWorkspaceItems('patient_notification', context.organizationId, context.patientProfileId);
  res.json({
    summary: {
      ...summary,
      unreadCount: items.filter((item) => !item.read).length,
      highPriorityCount: items.filter((item) => item.priority === 'high').length,
    },
    storageMode: getPatientWorkspaceStorageMode('patient_notification'),
  });
});

patientNotificationsRouter.get('/feed', async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const items = await listPatientWorkspaceItems('patient_notification', context.organizationId, context.patientProfileId);
  const enrichedItems = await enrichPatientNotificationItems(items as Record<string, any>[], {
    organizationId: context.organizationId,
    patientId: context.patientProfileId,
  });
  res.json({ items: enrichedItems, storageMode: getPatientWorkspaceStorageMode('patient_notification') });
});

patientNotificationsRouter.post('/feed/:notificationId/read', async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const item = await getPatientWorkspaceItem('patient_notification', req.params.notificationId, context.organizationId, context.patientProfileId);
  const updated = await upsertPatientWorkspaceItem('patient_notification', {
    ...item,
    read: true,
    status: 'READ',
    readAt: new Date().toISOString(),
  }, {
    organizationId: context.organizationId,
    patientId: context.patientProfileId,
    actorId: req.user?.userId,
  });
  res.json({ item: updated, storageMode: getPatientWorkspaceStorageMode('patient_notification') });
});

patientNotificationsRouter.post('/preferences', validateBody(preferenceSchema), async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const item = await upsertPatientWorkspaceItem('patient_notification', {
    id: `notification-pref-${req.body.channel}`,
    title: `${String(req.body.channel).toUpperCase()} preference`,
    category: 'Preference',
    message: `${String(req.body.channel).toUpperCase()} notifications ${req.body.enabled ? 'enabled' : 'disabled'}`,
    priority: 'low',
    read: true,
    status: req.body.enabled ? 'ENABLED' : 'DISABLED',
    preferenceChannel: req.body.channel,
    preferenceEnabled: req.body.enabled,
  }, {
    organizationId: context.organizationId,
    patientId: context.patientProfileId,
    actorId: req.user?.userId,
  });
  res.json({ item, storageMode: getPatientWorkspaceStorageMode('patient_notification') });
});
