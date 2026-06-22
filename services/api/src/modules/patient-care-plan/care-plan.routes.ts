import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { badRequest } from '../../lib/http';
import { getPatientContext, getRequestedSubjectProfileId } from '../../lib/patient-context';
import { getPatientWorkspaceStorageMode, getPatientWorkspaceItem, listPatientWorkspaceItems, summarizePatientWorkspaceItems, transitionPatientWorkspaceItem } from '../../lib/patient-workspace-store';

export const patientCarePlanRouter = Router();
const allowedRoles = ['PATIENT'];

patientCarePlanRouter.use(requireAuth);
patientCarePlanRouter.use(allowRoles(allowedRoles));

patientCarePlanRouter.get('/summary', async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId, getRequestedSubjectProfileId(req));
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const items = await listPatientWorkspaceItems('patient_care_plan', context.organizationId, context.subjectProfileId);
  const summary = await summarizePatientWorkspaceItems('patient_care_plan', context.organizationId, context.subjectProfileId);
  res.json({
    summary: {
      ...summary,
      completedCount: items.filter((item) => item.completed || item.status === 'COMPLETED').length,
      openCount: items.filter((item) => item.status !== 'COMPLETED').length,
    },
    storageMode: getPatientWorkspaceStorageMode('patient_care_plan'),
  });
});

patientCarePlanRouter.get('/tasks', async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId, getRequestedSubjectProfileId(req));
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const items = await listPatientWorkspaceItems('patient_care_plan', context.organizationId, context.subjectProfileId);
  res.json({ items, storageMode: getPatientWorkspaceStorageMode('patient_care_plan') });
});

patientCarePlanRouter.get('/tasks/:taskId', async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId, getRequestedSubjectProfileId(req));
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const item = await getPatientWorkspaceItem('patient_care_plan', req.params.taskId, context.organizationId, context.subjectProfileId);
  res.json({ item, storageMode: getPatientWorkspaceStorageMode('patient_care_plan') });
});

patientCarePlanRouter.post('/tasks/:taskId/complete', async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId, getRequestedSubjectProfileId(req));
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const item = await transitionPatientWorkspaceItem('patient_care_plan', req.params.taskId, 'COMPLETED', {
    organizationId: context.organizationId,
    patientId: context.subjectProfileId,
    actorId: req.user?.userId,
  }, {
    completed: true,
    completedAt: new Date().toISOString(),
    progressLabel: 'Completed',
  });
  res.json({ item, storageMode: getPatientWorkspaceStorageMode('patient_care_plan') });
});

patientCarePlanRouter.post('/tasks/:taskId/snooze', async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId, getRequestedSubjectProfileId(req));
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const item = await transitionPatientWorkspaceItem('patient_care_plan', req.params.taskId, 'OPEN', {
    organizationId: context.organizationId,
    patientId: context.subjectProfileId,
    actorId: req.user?.userId,
  }, {
    completed: false,
    snoozedAt: new Date().toISOString(),
    progressLabel: 'Snoozed',
  });
  res.json({ item, storageMode: getPatientWorkspaceStorageMode('patient_care_plan') });
});
