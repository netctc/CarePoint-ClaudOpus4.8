import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { badRequest } from '../../lib/http';
import { getPatientContext, getRequestedSubjectProfileId } from '../../lib/patient-context';
import { getPatientWorkspaceStorageMode, getPatientWorkspaceItem, listPatientWorkspaceItems, summarizePatientWorkspaceItems, upsertPatientWorkspaceItem } from '../../lib/patient-workspace-store';

export const patientRemindersRouter = Router();
const allowedRoles = ['PATIENT'];

const reminderSchema = z.object({
  id: z.string().trim().min(2).optional(),
  medication: z.string().trim().min(2).max(160),
  schedule: z.string().trim().min(2).max(120),
  enabled: z.boolean().default(true),
});

const reminderLogSchema = z.object({
  outcome: z.enum(['TAKEN', 'SKIPPED']),
  occurredAt: z.string().datetime().optional(),
});

type ReminderLog = {
  id: string;
  outcome: 'TAKEN' | 'SKIPPED';
  occurredAt: string;
};

patientRemindersRouter.use(requireAuth);
patientRemindersRouter.use(allowRoles(allowedRoles));

function normalizeReminder(item: Record<string, any>) {
  const logs = Array.isArray(item.logs) ? item.logs.filter((entry): entry is ReminderLog => !!entry && typeof entry === 'object') : [];
  const sortedLogs = [...logs].sort((a, b) => String(b.occurredAt ?? '').localeCompare(String(a.occurredAt ?? '')));
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const recentLogs = sortedLogs.filter((entry) => {
    const parsed = Date.parse(String(entry.occurredAt ?? ''));
    return !Number.isNaN(parsed) && parsed >= sevenDaysAgo;
  });
  const takenCount7d = recentLogs.filter((entry) => entry.outcome === 'TAKEN').length;
  const skippedCount7d = recentLogs.filter((entry) => entry.outcome === 'SKIPPED').length;
  const lastLog = sortedLogs[0] ?? null;
  return {
    ...item,
    logs: sortedLogs,
    adherenceSummary: {
      takenCount7d,
      skippedCount7d,
      totalLogged7d: recentLogs.length,
    },
    lastLog,
  };
}

patientRemindersRouter.get('/summary', async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId, getRequestedSubjectProfileId(req));
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const items = (await listPatientWorkspaceItems('patient_reminder', context.organizationId, context.subjectProfileId))
    .filter((item) => String(item.status ?? '').toUpperCase() !== 'ARCHIVED')
    .map((item) => normalizeReminder(item));
  const summary = await summarizePatientWorkspaceItems('patient_reminder', context.organizationId, context.subjectProfileId);
  const totalLogged7d = items.reduce((sum, item) => sum + Number(item.adherenceSummary?.totalLogged7d ?? 0), 0);
  const takenCount7d = items.reduce((sum, item) => sum + Number(item.adherenceSummary?.takenCount7d ?? 0), 0);
  res.json({
    summary: {
      ...summary,
      total: items.length,
      enabledCount: items.filter((item) => item.enabled).length,
      todayCount: items.filter((item) => item.enabled).length,
      adherenceRate7d: totalLogged7d === 0 ? null : Number(((takenCount7d / totalLogged7d) * 100).toFixed(0)),
      takenCount7d,
      totalLogged7d,
    },
    storageMode: getPatientWorkspaceStorageMode('patient_reminder'),
  });
});

patientRemindersRouter.get('/medications', async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId, getRequestedSubjectProfileId(req));
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const items = (await listPatientWorkspaceItems('patient_reminder', context.organizationId, context.subjectProfileId))
    .filter((item) => String(item.status ?? '').toUpperCase() !== 'ARCHIVED')
    .map((item) => normalizeReminder(item));
  res.json({ items, storageMode: getPatientWorkspaceStorageMode('patient_reminder') });
});

patientRemindersRouter.get('/medications/:reminderId', async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId, getRequestedSubjectProfileId(req));
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const item = await getPatientWorkspaceItem('patient_reminder', req.params.reminderId, context.organizationId, context.subjectProfileId);
  res.json({ item: normalizeReminder(item), storageMode: getPatientWorkspaceStorageMode('patient_reminder') });
});

patientRemindersRouter.post('/medications', validateBody(reminderSchema), async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId, getRequestedSubjectProfileId(req));
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const existing = req.body.id ? await getPatientWorkspaceItem('patient_reminder', req.body.id, context.organizationId, context.subjectProfileId).catch(() => null) : null;
  const item = await upsertPatientWorkspaceItem('patient_reminder', {
    ...existing,
    ...req.body,
    title: req.body.medication,
    status: req.body.enabled ? 'ACTIVE' : 'PAUSED',
    logs: Array.isArray(existing?.logs) ? existing.logs : [],
  }, {
    organizationId: context.organizationId,
    patientId: context.subjectProfileId,
    actorId: req.user?.userId,
  });
  res.status(req.body.id ? 200 : 201).json({ item: normalizeReminder(item), storageMode: getPatientWorkspaceStorageMode('patient_reminder') });
});

patientRemindersRouter.post('/medications/:reminderId/toggle', async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId, getRequestedSubjectProfileId(req));
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const item = await getPatientWorkspaceItem('patient_reminder', req.params.reminderId, context.organizationId, context.subjectProfileId);
  const enabled = !Boolean(item.enabled);
  const updated = await upsertPatientWorkspaceItem('patient_reminder', {
    ...item,
    enabled,
    status: enabled ? 'ACTIVE' : 'PAUSED',
  }, {
    organizationId: context.organizationId,
    patientId: context.subjectProfileId,
    actorId: req.user?.userId,
  });
  res.json({ item: normalizeReminder(updated), storageMode: getPatientWorkspaceStorageMode('patient_reminder') });
});

patientRemindersRouter.post('/medications/:reminderId/log', validateBody(reminderLogSchema), async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId, getRequestedSubjectProfileId(req));
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const item = await getPatientWorkspaceItem('patient_reminder', req.params.reminderId, context.organizationId, context.subjectProfileId);
  const occurredAt = req.body.occurredAt ?? new Date().toISOString();
  const updated = await upsertPatientWorkspaceItem('patient_reminder', {
    ...item,
    logs: [
      {
        id: `${req.params.reminderId}-${Date.now()}`,
        outcome: req.body.outcome,
        occurredAt,
      },
      ...(Array.isArray(item.logs) ? item.logs : []),
    ].slice(0, 20),
    lastTakenAt: req.body.outcome === 'TAKEN' ? occurredAt : item.lastTakenAt,
    lastOutcome: req.body.outcome,
    updatedAt: new Date().toISOString(),
  }, {
    organizationId: context.organizationId,
    patientId: context.subjectProfileId,
    actorId: req.user?.userId,
  });
  res.json({ item: normalizeReminder(updated), storageMode: getPatientWorkspaceStorageMode('patient_reminder') });
});

patientRemindersRouter.delete('/medications/:reminderId', async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId, getRequestedSubjectProfileId(req));
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const item = await getPatientWorkspaceItem('patient_reminder', req.params.reminderId, context.organizationId, context.subjectProfileId);
  const updated = await upsertPatientWorkspaceItem('patient_reminder', {
    ...item,
    enabled: false,
    archived: true,
    archivedAt: new Date().toISOString(),
    status: 'ARCHIVED',
  }, {
    organizationId: context.organizationId,
    patientId: context.subjectProfileId,
    actorId: req.user?.userId,
  });
  res.json({ item: normalizeReminder(updated), storageMode: getPatientWorkspaceStorageMode('patient_reminder') });
});
