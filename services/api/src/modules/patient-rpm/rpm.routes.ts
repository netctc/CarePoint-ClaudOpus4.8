import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { badRequest } from '../../lib/http';
import { getPatientContext, getRequestedSubjectProfileId } from '../../lib/patient-context';
import { getPatientWorkspaceStorageMode, getPatientWorkspaceItem, listPatientWorkspaceItems, summarizePatientWorkspaceItems, upsertPatientWorkspaceItem } from '../../lib/patient-workspace-store';

export const patientRpmRouter = Router();
const allowedRoles = ['PATIENT'];

const readingSchema = z.object({
  metric: z.string().trim().min(2).max(120),
  value: z.string().trim().min(1).max(120),
  status: z.string().trim().min(2).max(80).optional(),
  variant: z.enum(['success', 'info', 'warning', 'danger']).optional(),
});

patientRpmRouter.use(requireAuth);
patientRpmRouter.use(allowRoles(allowedRoles));

patientRpmRouter.get('/summary', async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId, getRequestedSubjectProfileId(req));
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const items = await listPatientWorkspaceItems('patient_rpm_program', context.organizationId, context.subjectProfileId);
  const summary = await summarizePatientWorkspaceItems('patient_rpm_program', context.organizationId, context.subjectProfileId);
  const readings = items.flatMap((item) => (Array.isArray(item.readings) ? item.readings : []));
  res.json({
    summary: {
      ...summary,
      activeProgramCount: items.filter((item) => item.programStatus === 'ACTIVE' || item.status === 'ACTIVE').length,
      recentReadingCount: readings.length,
      alertingCount: readings.filter((reading: any) => ['warning', 'danger'].includes(String(reading.variant))).length,
    },
    storageMode: getPatientWorkspaceStorageMode('patient_rpm_program'),
  });
});

patientRpmRouter.get('/program', async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId, getRequestedSubjectProfileId(req));
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const [item] = await listPatientWorkspaceItems('patient_rpm_program', context.organizationId, context.subjectProfileId);
  res.json({ item: item ?? null, storageMode: getPatientWorkspaceStorageMode('patient_rpm_program') });
});

patientRpmRouter.get('/readings', async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId, getRequestedSubjectProfileId(req));
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const [item] = await listPatientWorkspaceItems('patient_rpm_program', context.organizationId, context.subjectProfileId);
  res.json({ items: item?.readings ?? [], storageMode: getPatientWorkspaceStorageMode('patient_rpm_program') });
});

patientRpmRouter.post('/readings', validateBody(readingSchema), async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId, getRequestedSubjectProfileId(req));
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const [existing] = await listPatientWorkspaceItems('patient_rpm_program', context.organizationId, context.subjectProfileId);
  const baseline = existing ?? {
    id: `rpm-${context.subjectProfileId}`,
    title: 'Home vital monitoring',
    device: 'Manual entry',
    programStatus: 'ACTIVE',
    thresholds: [],
    readings: [],
    careTeamNote: 'Monitor your readings and share changes with your care team.',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  };
  const updated = await upsertPatientWorkspaceItem('patient_rpm_program', {
    ...baseline,
    readings: [
      {
        time: new Date().toISOString(),
        metric: req.body.metric,
        value: req.body.value,
        status: req.body.status ?? 'Logged',
        variant: req.body.variant ?? 'info',
      },
      ...(Array.isArray(baseline.readings) ? baseline.readings : []),
    ].slice(0, 30),
    lastSubmittedAt: new Date().toISOString(),
    status: 'ACTIVE',
    programStatus: 'ACTIVE',
  }, {
    organizationId: context.organizationId,
    patientId: context.subjectProfileId,
    actorId: req.user?.userId,
  });
  res.status(201).json({ item: updated, storageMode: getPatientWorkspaceStorageMode('patient_rpm_program') });
});
