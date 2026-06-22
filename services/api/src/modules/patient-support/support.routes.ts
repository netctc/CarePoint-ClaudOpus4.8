import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { badRequest } from '../../lib/http';
import { getPatientContext } from '../../lib/patient-context';
import { getPatientWorkspaceStorageMode, getPatientWorkspaceItem, listPatientWorkspaceItems, summarizePatientWorkspaceItems, upsertPatientWorkspaceItem } from '../../lib/patient-workspace-store';
import { upsertWorkflowItem } from '../../lib/admin-workflow-store';

export const patientSupportRouter = Router();
const allowedRoles = ['PATIENT'];

const ticketSchema = z.object({
  id: z.string().trim().min(2).optional(),
  subject: z.string().trim().min(3).max(160),
  category: z.string().trim().min(2).max(80),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  isSafetyIncident: z.boolean().default(false),
  description: z.string().trim().min(5).max(4000),
});

const commentSchema = z.object({
  message: z.string().trim().min(2).max(2000),
});

patientSupportRouter.use(requireAuth);
patientSupportRouter.use(allowRoles(allowedRoles));

patientSupportRouter.get('/summary', async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const items = await listPatientWorkspaceItems('patient_support_ticket', context.organizationId, context.patientProfileId);
  const summary = await summarizePatientWorkspaceItems('patient_support_ticket', context.organizationId, context.patientProfileId);
  res.json({
    summary: {
      ...summary,
      openCount: items.filter((item) => ['OPEN', 'IN_PROGRESS'].includes(item.status)).length,
    },
    storageMode: getPatientWorkspaceStorageMode('patient_support_ticket'),
  });
});

patientSupportRouter.get('/tickets', async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const items = await listPatientWorkspaceItems('patient_support_ticket', context.organizationId, context.patientProfileId);
  res.json({ items, storageMode: getPatientWorkspaceStorageMode('patient_support_ticket') });
});

patientSupportRouter.get('/tickets/:ticketId', async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const item = await getPatientWorkspaceItem('patient_support_ticket', req.params.ticketId, context.organizationId, context.patientProfileId);
  res.json({ item, storageMode: getPatientWorkspaceStorageMode('patient_support_ticket') });
});

patientSupportRouter.post('/tickets', validateBody(ticketSchema), async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const supportReferenceId = `SUP-${(req.requestId ?? Date.now().toString()).slice(0, 12).toUpperCase()}`;
  const isUrgentSafety = req.body.isSafetyIncident || ['high', 'critical'].includes(req.body.severity) || ['safety', 'incident'].includes(String(req.body.category).trim().toLowerCase());
  const item = await upsertPatientWorkspaceItem('patient_support_ticket', {
    ...req.body,
    title: req.body.subject,
    owner: isUrgentSafety ? 'Urgent safety queue' : 'Patient support',
    supportReferenceId,
    timeline: [{ time: new Date().toISOString(), label: 'Ticket opened', detail: req.body.description }],
    status: isUrgentSafety ? 'ESCALATED' : 'OPEN',
  }, {
    organizationId: context.organizationId,
    patientId: context.patientProfileId,
    actorId: req.user?.userId,
  });

  let safetyCase = null;
  if (isUrgentSafety) {
    safetyCase = await upsertWorkflowItem('safety', {
      code: `SAFE-${supportReferenceId.replace('SUP-', '')}`,
      title: req.body.subject,
      category: String(req.body.category).trim().toUpperCase(),
      severity: String(req.body.severity ?? 'MEDIUM').trim().toUpperCase(),
      queue: 'Patient Safety',
      patientImpact: 'Needs review',
      ownerName: 'Safety operations',
      summary: req.body.description,
      tags: ['patient-support', 'complaint'],
      linkedSupportReferenceId: supportReferenceId,
      status: 'NEW',
    }, {
      organizationId: context.organizationId,
      actorId: req.user?.userId,
    });
  }

  res.status(req.body.id ? 200 : 201).json({
    item,
    safetyCase,
    supportReferenceId,
    storageMode: getPatientWorkspaceStorageMode('patient_support_ticket'),
  });
});

patientSupportRouter.post('/tickets/:ticketId/comment', validateBody(commentSchema), async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const item = await getPatientWorkspaceItem('patient_support_ticket', req.params.ticketId, context.organizationId, context.patientProfileId);
  const timeline = Array.isArray(item.timeline) ? item.timeline : [];
  const updated = await upsertPatientWorkspaceItem('patient_support_ticket', {
    ...item,
    timeline: [
      { time: new Date().toISOString(), label: 'Patient reply', detail: req.body.message },
      ...timeline,
    ].slice(0, 20),
    status: item.status === 'OPEN' ? 'IN_PROGRESS' : item.status,
  }, {
    organizationId: context.organizationId,
    patientId: context.patientProfileId,
    actorId: req.user?.userId,
  });
  res.json({ item: updated, storageMode: getPatientWorkspaceStorageMode('patient_support_ticket') });
});
