import { Router } from 'express';
import { z } from 'zod';
import { messageCreateSchema, threadCreateSchema } from '@care-center/contracts';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { writeAuditLog } from '../../lib/audit';
import { badRequest, notFound } from '../../lib/http';
import { listWorkflowItems, transitionWorkflowItem, upsertWorkflowItem } from '../../lib/admin-workflow-store';

export const messagingRouter = Router();
messagingRouter.use(requireAuth);

const urgentKeywordMap: Record<string, string> = {
  'chest pain': 'Chest pain',
  'shortness of breath': 'Shortness of breath',
  'trouble breathing': 'Shortness of breath',
  'dizziness': 'Dizziness',
  'palpitations': 'Palpitations',
  'fainting': 'Fainting',
};

const urgentActionSchema = z.object({
  note: z.string().trim().max(500).optional(),
  queue: z.string().trim().min(2).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  ownerName: z.string().trim().min(2).optional(),
});

const urgentActionRoles = ['PROVIDER', 'NURSE', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'SUPER_ADMIN'];

function findUrgentSymptoms(text: string) {
  const lower = text.toLowerCase();
  return Object.entries(urgentKeywordMap)
    .filter(([keyword]) => lower.includes(keyword))
    .map(([, label]) => label);
}

function dedupeStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim())).map((value) => value.trim())));
}

async function getUrgentThreadState(threadId: string, organizationId?: string) {
  const rows = await prisma.auditLog.findMany({
    where: { organizationId, resource: 'message_thread_urgent', resourceId: threadId },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  const item = rows[0];
  if (!item) return null;
  const details = item.details && typeof item.details === 'object' ? item.details as Record<string, any> : {};
  return {
    status: String(details.status ?? 'OPEN'),
    symptoms: Array.isArray(details.symptoms) ? details.symptoms.map((entry) => String(entry)) : [],
    detectedAt: details.detectedAt ?? item.createdAt,
    lastUpdatedAt: item.createdAt,
    guidance: 'Seek urgent medical care or emergency support for severe or worsening symptoms.',
    note: typeof details.note === 'string' ? details.note : null,
    safetyCaseId: typeof details.safetyCaseId === 'string' ? details.safetyCaseId : null,
    ownerName: typeof details.ownerName === 'string' ? details.ownerName : null,
    queue: typeof details.queue === 'string' ? details.queue : null,
    acknowledgedBy: typeof details.acknowledgedBy === 'string' ? details.acknowledgedBy : null,
    resolvedBy: typeof details.resolvedBy === 'string' ? details.resolvedBy : null,
  };
}

async function getPatientProfileId(userId: string) {
  const profile = await prisma.patientProfile.findUnique({ where: { userId }, select: { id: true } });
  return profile?.id;
}

async function getProviderProfileId(userId: string) {
  const profile = await prisma.providerProfile.findUnique({ where: { userId }, select: { id: true } });
  return profile?.id;
}

async function buildThreadWhere(req: any) {
  const role = req.user.role;
  if (role === 'PATIENT') {
    return { patientId: (await getPatientProfileId(req.user.userId)) ?? '__none__' };
  }
  if (['PROVIDER', 'NURSE', 'PHARMACIST', 'LAB_TECH'].includes(role)) {
    return { providerId: (await getProviderProfileId(req.user.userId)) ?? '__none__' };
  }
  return req.user.organizationId ? { organizationId: req.user.organizationId } : undefined;
}

async function loadAuthorizedThread(req: any, threadId: string) {
  const where = await buildThreadWhere(req);
  const thread = await prisma.messageThread.findFirst({
    where: {
      id: threadId,
      ...(where ?? {}),
    },
    include: {
      patient: { include: { user: true } },
      provider: { include: { user: true } },
      messages: {
        orderBy: { createdAt: 'asc' },
        include: { sender: { select: { id: true, firstName: true, lastName: true, role: true } } },
      },
    },
  });
  if (!thread) throw notFound('Thread not found');
  return thread;
}

function serializeThread(item: any, urgentEscalation?: any) {
  const latest = item.messages?.[item.messages.length - 1] ?? null;
  return {
    id: item.id,
    subject: item.subject,
    type: item.type,
    organizationId: item.organizationId,
    patientId: item.patientId,
    providerId: item.providerId,
    participantLabel: item.patient
      ? `${item.patient.user.firstName} ${item.patient.user.lastName}`.trim()
      : item.provider
        ? `${item.provider.user.firstName} ${item.provider.user.lastName}`.trim()
        : 'Care team',
    latestMessage: latest
      ? {
          id: latest.id,
          body: latest.body,
          createdAt: latest.createdAt,
          senderName: `${latest.sender.firstName} ${latest.sender.lastName}`.trim(),
        }
      : null,
    urgentEscalation: urgentEscalation ?? null,
    messages: item.messages.map((message: any) => ({
      id: message.id,
      body: message.body,
      attachments: message.attachments,
      createdAt: message.createdAt,
      senderName: `${message.sender.firstName} ${message.sender.lastName}`.trim(),
      senderRole: message.sender.role,
      isMine: false,
    })),
  };
}

async function ensureUrgentSafetyCase(params: {
  organizationId: string;
  actorId?: string;
  thread: any;
  symptoms: string[];
  queue?: string | null;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
  ownerName?: string | null;
}) {
  const existing = (await listWorkflowItems('safety', params.organizationId)).find((item) => item.sourceThreadId === params.thread.id && item.status !== 'CLOSED');
  if (existing) return existing;

  return upsertWorkflowItem('safety', {
    code: `SAFE-MSG-${Date.now().toString().slice(-6)}`,
    title: `Urgent message escalation: ${params.thread.subject || 'Secure conversation'}`,
    status: 'NEW',
    category: 'CLINICAL',
    severity: params.severity ?? 'HIGH',
    queue: params.queue ?? 'Clinical Safety',
    patientImpact: 'Potential urgent symptom report in secure messaging',
    ownerName: params.ownerName ?? null,
    summary: `Urgent symptom language detected in secure messaging for ${(params.thread.patient?.user?.firstName ?? '').trim()} ${(params.thread.patient?.user?.lastName ?? '').trim()}`.trim(),
    tags: ['messaging', 'urgent-symptom', ...params.symptoms.map((entry) => entry.toLowerCase().replace(/\s+/g, '-'))],
    sourceType: 'MESSAGE_THREAD',
    sourceThreadId: params.thread.id,
    sourcePatientName: params.thread.patient ? `${params.thread.patient.user.firstName} ${params.thread.patient.user.lastName}`.trim() : null,
  }, { organizationId: params.organizationId, actorId: params.actorId });
}

async function writeUrgentStatusLog(params: {
  organizationId?: string;
  actorId?: string;
  threadId: string;
  action: string;
  existing?: any;
  status: string;
  symptoms?: string[];
  note?: string | null;
  queue?: string | null;
  ownerName?: string | null;
  safetyCaseId?: string | null;
}) {
  const mergedSymptoms = dedupeStrings([...(params.existing?.symptoms ?? []), ...(params.symptoms ?? [])]);
  await writeAuditLog({
    actorId: params.actorId,
    organizationId: params.organizationId,
    action: params.action,
    resource: 'message_thread_urgent',
    resourceId: params.threadId,
    details: {
      status: params.status,
      symptoms: mergedSymptoms,
      note: params.note ?? params.existing?.note ?? null,
      queue: params.queue ?? params.existing?.queue ?? null,
      ownerName: params.ownerName ?? params.existing?.ownerName ?? null,
      safetyCaseId: params.safetyCaseId ?? params.existing?.safetyCaseId ?? null,
      detectedAt: params.existing?.detectedAt ?? new Date().toISOString(),
      acknowledgedBy: params.status === 'ACKNOWLEDGED' ? params.actorId ?? null : params.existing?.acknowledgedBy ?? null,
      resolvedBy: params.status === 'RESOLVED' ? params.actorId ?? null : params.existing?.resolvedBy ?? null,
    },
  });
}

messagingRouter.get('/threads', async (req, res) => {
  const items = await prisma.messageThread.findMany({
    where: await buildThreadWhere(req),
    include: {
      patient: { include: { user: true } },
      provider: { include: { user: true } },
      messages: {
        orderBy: { createdAt: 'asc' },
        include: {
          sender: {
            select: { id: true, firstName: true, lastName: true, role: true },
          },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const enriched = await Promise.all(items.map(async (item) => serializeThread(item, await getUrgentThreadState(item.id, req.user?.organizationId))));
  res.json({ items: enriched });
});

messagingRouter.get('/threads/:threadId', async (req, res) => {
  const item = await loadAuthorizedThread(req, req.params.threadId);
  const thread = serializeThread(item, await getUrgentThreadState(item.id, req.user?.organizationId));
  thread.messages = thread.messages.map((message: any) => ({
    ...message,
    isMine: item.messages.find((raw: any) => raw.id === message.id)?.sender.id === req.user!.userId,
  }));

  res.json(thread);
});

messagingRouter.post('/threads', validateBody(threadCreateSchema), async (req, res) => {
  const created = await prisma.messageThread.create({
    data: {
      ...req.body,
      organizationId: req.body.organizationId || req.user?.organizationId,
    },
  });

  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId: req.user?.organizationId,
    action: 'thread.created',
    resource: 'message_thread',
    resourceId: created.id,
    details: req.body,
  });

  res.status(201).json(created);
});

messagingRouter.post('/messages', validateBody(messageCreateSchema), async (req, res) => {
  const created = await prisma.message.create({
    data: {
      threadId: req.body.threadId,
      senderId: req.user!.userId,
      body: req.body.body,
      attachments: req.body.attachments,
    },
    include: {
      sender: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      },
    },
  });

  req.io?.to(`thread:${created.threadId}`).emit('message:created', created);

  const thread = await prisma.messageThread.update({
    where: { id: created.threadId },
    data: { updatedAt: new Date() },
    include: {
      patient: { include: { user: true } },
      provider: { include: { user: true } },
    },
  });

  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId: req.user?.organizationId,
    action: 'message.sent',
    resource: 'message',
    resourceId: created.id,
    details: { threadId: created.threadId },
  });

  const urgentSymptoms = req.user?.role === 'PATIENT' ? findUrgentSymptoms(created.body) : [];
  if (urgentSymptoms.length) {
    const existing = await getUrgentThreadState(created.threadId, req.user?.organizationId);
    const safetyCase = req.user?.organizationId
      ? await ensureUrgentSafetyCase({
          organizationId: req.user.organizationId,
          actorId: req.user?.userId,
          thread,
          symptoms: urgentSymptoms,
        })
      : null;
    await writeUrgentStatusLog({
      organizationId: req.user?.organizationId,
      actorId: req.user?.userId,
      threadId: created.threadId,
      action: 'message.urgent_symptom_detected',
      existing,
      status: 'OPEN',
      symptoms: urgentSymptoms,
      safetyCaseId: safetyCase?.id ?? existing?.safetyCaseId ?? null,
    });
  }

  res.status(201).json({
    id: created.id,
    body: created.body,
    attachments: created.attachments,
    createdAt: created.createdAt,
    senderName: `${created.sender.firstName} ${created.sender.lastName}`.trim(),
    senderRole: created.sender.role,
    isMine: true,
  });
});

messagingRouter.post('/threads/:threadId/urgent-acknowledge', allowRoles(urgentActionRoles), validateBody(urgentActionSchema), async (req, res) => {
  const thread = await loadAuthorizedThread(req, req.params.threadId);
  const existing = await getUrgentThreadState(thread.id, req.user?.organizationId);
  if (!existing) throw badRequest('No active urgent escalation exists for this thread.');
  const safetyCaseId = existing.safetyCaseId ?? (req.user?.organizationId ? (await ensureUrgentSafetyCase({ organizationId: req.user.organizationId, actorId: req.user?.userId, thread, symptoms: existing.symptoms, queue: req.body.queue ?? undefined, severity: req.body.severity ?? undefined, ownerName: req.body.ownerName ?? undefined })).id : null);
  await writeUrgentStatusLog({
    organizationId: req.user?.organizationId,
    actorId: req.user?.userId,
    threadId: thread.id,
    action: 'message.urgent_acknowledged',
    existing,
    status: 'ACKNOWLEDGED',
    note: req.body.note ?? null,
    queue: req.body.queue ?? null,
    ownerName: req.body.ownerName ?? null,
    safetyCaseId,
  });
  if (req.user?.organizationId && safetyCaseId) {
    await transitionWorkflowItem('safety', safetyCaseId, 'TRIAGED', { organizationId: req.user.organizationId, actorId: req.user?.userId }, req.body.note ?? null, {
      severity: req.body.severity ?? 'HIGH',
      ownerName: req.body.ownerName ?? 'Clinical Safety',
    });
  }
  res.json({ urgentEscalation: await getUrgentThreadState(thread.id, req.user?.organizationId) });
});

messagingRouter.post('/threads/:threadId/urgent-escalate', allowRoles(urgentActionRoles), validateBody(urgentActionSchema), async (req, res) => {
  const thread = await loadAuthorizedThread(req, req.params.threadId);
  const existing = await getUrgentThreadState(thread.id, req.user?.organizationId);
  if (!existing) throw badRequest('No active urgent escalation exists for this thread.');
  if (!req.user?.organizationId) throw badRequest('Organization scope is required for escalation.');
  const safetyCase = await ensureUrgentSafetyCase({ organizationId: req.user.organizationId, actorId: req.user?.userId, thread, symptoms: existing.symptoms, queue: req.body.queue ?? undefined, severity: req.body.severity ?? undefined, ownerName: req.body.ownerName ?? undefined });
  await writeUrgentStatusLog({
    organizationId: req.user.organizationId,
    actorId: req.user?.userId,
    threadId: thread.id,
    action: 'message.urgent_escalated',
    existing,
    status: 'ESCALATED',
    note: req.body.note ?? null,
    queue: req.body.queue ?? null,
    ownerName: req.body.ownerName ?? null,
    safetyCaseId: safetyCase.id,
  });
  await transitionWorkflowItem('safety', safetyCase.id, 'ACTION_REQUIRED', { organizationId: req.user.organizationId, actorId: req.user?.userId }, req.body.note ?? null, {
    severity: req.body.severity ?? 'HIGH',
    ownerName: req.body.ownerName ?? 'Clinical Safety',
    queue: req.body.queue ?? safetyCase.queue ?? 'Clinical Safety',
    actionPlan: 'Review urgent secure message escalation and contact the patient for immediate triage.',
  });
  res.json({ urgentEscalation: await getUrgentThreadState(thread.id, req.user.organizationId), safetyCaseId: safetyCase.id });
});

messagingRouter.post('/threads/:threadId/urgent-resolve', allowRoles(urgentActionRoles), validateBody(urgentActionSchema), async (req, res) => {
  const thread = await loadAuthorizedThread(req, req.params.threadId);
  const existing = await getUrgentThreadState(thread.id, req.user?.organizationId);
  if (!existing) throw badRequest('No active urgent escalation exists for this thread.');
  await writeUrgentStatusLog({
    organizationId: req.user?.organizationId,
    actorId: req.user?.userId,
    threadId: thread.id,
    action: 'message.urgent_resolved',
    existing,
    status: 'RESOLVED',
    note: req.body.note ?? null,
    queue: req.body.queue ?? null,
    ownerName: req.body.ownerName ?? null,
  });
  if (req.user?.organizationId && existing.safetyCaseId) {
    await transitionWorkflowItem('safety', existing.safetyCaseId, 'CLOSED', { organizationId: req.user.organizationId, actorId: req.user?.userId }, req.body.note ?? null, {
      closureCode: 'URGENT_THREAD_RESOLVED',
    }).catch(() => null);
  }
  res.json({ urgentEscalation: await getUrgentThreadState(thread.id, req.user?.organizationId) });
});
