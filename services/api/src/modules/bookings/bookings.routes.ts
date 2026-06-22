import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { badRequest, notFound } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { writeAuditLog } from '../../lib/audit';
import { evaluateBookingPolicy, extendSlotHold, getSchedulingSummary, getSlotHold, listActiveSlotHolds, releaseSlotHold, validateProviderBookingWindow } from '../../lib/scheduling-store';
import { listBookingDocuments } from '../../lib/booking-document-store';

export const bookingsRouter = Router();
const readRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'FINANCE', 'PROVIDER', 'NURSE'];
const writeRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT'];

const overrideReasonCatalog = [
  'PATIENT_REQUEST',
  'LEAD_TIME_EXCEPTION',
  'WEEKEND_EXCEPTION',
  'FACILITY_EXCEPTION',
  'CHANNEL_EXCEPTION',
  'CLINICAL_PRIORITY',
  'PAYMENT_REVIEW',
] as const;

const escalationReasonCatalog = [
  'OPS_ESCALATION',
  'PATIENT_SAFETY',
  'FACILITY_CONSTRAINT',
  'PAYMENT_FAILURE',
  'PRIOR_AUTH',
  'TELEHEALTH_GATING',
] as const;

const ownerRoleCatalog = ['COMPANY_SUPPORT', 'COMPANY_ADMIN', 'FINANCE', 'PROVIDER_OPERATIONS'] as const;
const authorizationDecisionCatalog = ['APPROVED', 'REJECTED'] as const;

const rescheduleSchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  note: z.string().trim().max(500).optional(),
  reasonCode: z.enum(overrideReasonCatalog).optional(),
});

const reassignSchema = z.object({
  providerId: z.string().min(2),
  note: z.string().trim().max(500).optional(),
  reasonCode: z.enum(overrideReasonCatalog).optional(),
});

const escalationSchema = z.object({
  reasonCode: z.enum(escalationReasonCatalog),
  ownerRole: z.enum(ownerRoleCatalog).optional(),
  note: z.string().trim().max(500).optional(),
});

const holdControlSchema = z.object({
  extendMinutes: z.number().int().min(1).max(10).optional(),
  note: z.string().trim().max(500).optional(),
});

const authorizationReviewSchema = z.object({
  decision: z.enum(authorizationDecisionCatalog),
  note: z.string().trim().min(4).max(500),
});


bookingsRouter.use(requireAuth);
bookingsRouter.use(allowRoles(readRoles));


function parseReviewReasonCodes(payment: any) {
  const metadata = payment?.metadata && typeof payment.metadata === 'object' ? payment.metadata as Record<string, any> : {};
  const raw = metadata.reviewReasonCodes;
  if (Array.isArray(raw)) return raw.map((item) => String(item)).filter(Boolean);
  if (typeof raw === 'string' && raw.trim()) return raw.split('|').map((item) => item.trim()).filter(Boolean);
  return [] as string[];
}

function deriveAuthorizationReview(payment: any) {
  const metadata = payment?.metadata && typeof payment.metadata === 'object' ? payment.metadata as Record<string, any> : {};
  const reviewReasonCodes = parseReviewReasonCodes(payment);
  const required = reviewReasonCodes.includes('AUTHORIZATION_REQUIRED') || String(metadata.authorizationRequired ?? '').toLowerCase() === 'true';
  const decision = String(metadata.authorizationDecision ?? '').trim().toUpperCase();
  return {
    required,
    status: decision || (required ? 'PENDING' : 'NOT_REQUIRED'),
    reviewedAt: metadata.authorizationReviewedAt ?? null,
    reviewedBy: metadata.authorizationReviewedBy ?? null,
    note: metadata.authorizationReviewNote ?? null,
    reasonCodes: reviewReasonCodes,
  };
}

async function getLatestAppointmentPayment(appointmentId: string) {
  return prisma.payment.findFirst({ where: { appointmentId }, orderBy: { createdAt: 'desc' } });
}

async function getAuthorizationReviewForAppointment(appointmentId: string) {
  const payment = await getLatestAppointmentPayment(appointmentId);
  return deriveAuthorizationReview(payment);
}

function buildPolicyExceptionContext(policy: Awaited<ReturnType<typeof evaluateBookingPolicy>>) {
  return {
    overrideRequired: policy.overrideRequired,
    reasons: policy.reasons,
    blockedFacilities: policy.blockedFacilities,
    blockedChannels: policy.blockedChannels,
    cityExceptions: policy.cityExceptions,
    weekendSlotsAllowed: policy.weekendSlotsAllowed,
    weekendCalendar: policy.weekendCalendar,
    allowedPaymentMethods: policy.allowedPaymentMethods,
    authorizationRequired: policy.authorizationRequired,
  };
}

function mapAppointment(item: any) {
  return {
    id: item.id,
    organizationId: item.organizationId,
    patientId: item.patientId,
    providerId: item.providerId,
    patientName: item.patient ? `${item.patient.user.firstName} ${item.patient.user.lastName}`.trim() : null,
    providerName: item.provider ? `${item.provider.user.firstName} ${item.provider.user.lastName}`.trim() : null,
    providerSpecialty: item.provider?.specialty ?? null,
    service: item.service,
    location: item.location,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    status: item.status,
    notes: item.notes,
    modality: item.telehealthSession ? 'TELEHEALTH' : 'IN_PERSON',
    telehealthSessionId: item.telehealthSession?.id ?? null,
    telehealthStatus: item.telehealthSession?.status ?? null,
    latestPaymentStatus: item.payments?.[0]?.status ?? null,
    authorizationReview: deriveAuthorizationReview(item.payments?.[0] ?? null),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

async function getScopedAppointment(appointmentId: string, organizationId?: string) {
  const item = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      patient: { include: { user: true } },
      provider: { include: { user: true } },
      telehealthSession: true,
      payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      records: { orderBy: { createdAt: 'desc' }, take: 3 },
    },
  });

  if (!item || (organizationId && item.organizationId !== organizationId)) {
    throw notFound('Appointment not found');
  }

  return item;
}


async function getScopedProviderProfileId(userId: string) {
  const profile = await prisma.providerProfile.findUnique({ where: { userId }, select: { id: true } });
  return profile?.id;
}

async function listScopedActiveHolds(params: { organizationId?: string; userId?: string; role?: string; limit?: number }) {
  const providerId = params.role && ['PROVIDER', 'NURSE'].includes(params.role) && params.userId
    ? await getScopedProviderProfileId(params.userId)
    : undefined;
  return listActiveSlotHolds({ organizationId: params.organizationId, providerId, limit: params.limit });
}

async function getBookingOpsLogs(appointmentId: string, organizationId?: string) {
  return prisma.auditLog.findMany({
    where: {
      organizationId,
      OR: [
        { resource: 'appointment', resourceId: appointmentId },
        { resource: 'booking_control', resourceId: appointmentId },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });
}

bookingsRouter.get('/summary', async (req, res) => {
  const organizationId = req.user?.organizationId;
  const items = await prisma.appointment.findMany({
    where: organizationId ? { organizationId } : undefined,
    include: { telehealthSession: true },
  });
  const scheduling = await getSchedulingSummary(organizationId);
  const escalations = await prisma.auditLog.count({
    where: {
      organizationId,
      action: 'booking.escalated',
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
  });

  const summary = items.reduce(
    (acc, item) => {
      acc.total += 1;
      acc.byStatus[item.status] = (acc.byStatus[item.status] ?? 0) + 1;
      if (item.telehealthSession) acc.telehealth += 1;
      if (item.startsAt > new Date() && item.startsAt < new Date(Date.now() + 24 * 60 * 60 * 1000)) acc.upcoming24h += 1;
      return acc;
    },
    { total: 0, telehealth: 0, upcoming24h: 0, escalationsLast7d: escalations, activeSlotHolds: scheduling.activeHolds, publishedSlots: scheduling.publishedSlots, byStatus: {} as Record<string, number> },
  );

  res.json({ summary });
});

bookingsRouter.get('/control-tower', async (req, res) => {
  const organizationId = req.user?.organizationId;
  const q = String(req.query.q ?? '').trim().toLowerCase();
  const status = String(req.query.status ?? '').trim().toUpperCase();
  const modality = String(req.query.modality ?? '').trim().toUpperCase();
  const limit = Math.min(Math.max(Number(req.query.limit ?? 100), 1), 250);

  const items = (await prisma.appointment.findMany({
    where: organizationId ? { organizationId } : undefined,
    include: {
      patient: { include: { user: true } },
      provider: { include: { user: true } },
      telehealthSession: true,
      payments: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { startsAt: 'asc' },
    take: limit,
  }))
    .map(mapAppointment)
    .filter((item) => {
      if (status && item.status !== status) return false;
      if (modality && item.modality !== modality) return false;
      if (!q) return true;
      return [item.id, item.patientName ?? '', item.providerName ?? '', item.service ?? '', item.location ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q);
    });

  res.json({ items, count: items.length });
});


bookingsRouter.get('/control-tower/holds', async (req, res) => {
  const items = await listScopedActiveHolds({
    organizationId: req.user?.organizationId,
    userId: req.user?.userId,
    role: req.user?.role,
    limit: Math.min(Math.max(Number(req.query.limit ?? 25), 1), 100),
  });
  const patientIds = Array.from(new Set(items.map((item) => item.patientId)));
  const providerIds = Array.from(new Set(items.map((item) => item.providerId)));
  const [patients, providers] = await Promise.all([
    patientIds.length ? prisma.patientProfile.findMany({ where: { id: { in: patientIds } }, include: { user: true } }) : Promise.resolve([]),
    providerIds.length ? prisma.providerProfile.findMany({ where: { id: { in: providerIds } }, include: { user: true } }) : Promise.resolve([]),
  ]);
  const patientMap = new Map(patients.map((item) => [item.id, `${item.user.firstName} ${item.user.lastName}`.trim()]));
  const providerMap = new Map(providers.map((item) => [item.id, `${item.user.firstName} ${item.user.lastName}`.trim()]));
  res.json({
    items: items.map((item) => ({
      ...item,
      patientName: patientMap.get(item.patientId) ?? null,
      providerName: providerMap.get(item.providerId) ?? null,
    })),
    count: items.length,
  });
});

bookingsRouter.post('/control-tower/holds/:holdId/extend', allowRoles(writeRoles), validateBody(holdControlSchema), async (req, res) => {
  const existing = await getSlotHold(req.params.holdId, req.user?.organizationId);
  if (!existing) throw notFound('Slot hold not found');
  const hold = await extendSlotHold({
    holdId: existing.id,
    organizationId: req.user?.organizationId,
    actorId: req.user?.userId,
    extendMinutes: req.body.extendMinutes,
    note: req.body.note ?? undefined,
  });
  if (!hold) throw notFound('Slot hold not found');
  res.json({ hold });
});

bookingsRouter.post('/control-tower/holds/:holdId/release', allowRoles(writeRoles), validateBody(holdControlSchema), async (req, res) => {
  const existing = await getSlotHold(req.params.holdId, req.user?.organizationId);
  if (!existing) throw notFound('Slot hold not found');
  const hold = await releaseSlotHold({
    holdId: existing.id,
    organizationId: req.user?.organizationId,
    actorId: req.user?.userId,
    note: req.body.note ?? undefined,
  });
  if (!hold) throw notFound('Slot hold not found');
  res.json({ hold });
});

bookingsRouter.get('/control-tower/options', async (_req, res) => {
  res.json({
    overrideReasonCatalog,
    escalationReasonCatalog,
    ownerRoleCatalog,
    authorizationDecisionCatalog,
  });
});


bookingsRouter.get('/control-tower/:appointmentId/authorization-review', async (req, res) => {
  const existing = await getScopedAppointment(req.params.appointmentId, req.user?.organizationId);
  const review = await getAuthorizationReviewForAppointment(existing.id);
  res.json({ review });
});

bookingsRouter.post('/control-tower/:appointmentId/authorization-review', allowRoles(writeRoles), validateBody(authorizationReviewSchema), async (req, res) => {
  const existing = await getScopedAppointment(req.params.appointmentId, req.user?.organizationId);
  const payment = await getLatestAppointmentPayment(existing.id);
  if (!payment) throw badRequest('No payment intent is linked to this booking yet.');
  const current = deriveAuthorizationReview(payment);
  if (!current.required) throw badRequest('This booking does not currently require prior authorization review.');
  const metadata = payment.metadata && typeof payment.metadata === 'object' ? payment.metadata as Record<string, any> : {};
  const reviewReasonCodes = parseReviewReasonCodes(payment).filter((code) => code !== 'AUTHORIZATION_REQUIRED');
  const nextStatus = req.body.decision === 'APPROVED' && !reviewReasonCodes.length ? 'AUTHORIZED' : payment.status;
  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: nextStatus,
      metadata: {
        ...metadata,
        reviewReasonCodes: reviewReasonCodes.join('|'),
        authorizationDecision: req.body.decision,
        authorizationReviewedAt: new Date().toISOString(),
        authorizationReviewedBy: req.user?.userId ?? null,
        authorizationReviewNote: req.body.note,
      },
    },
  });
  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId: req.user?.organizationId,
    action: 'booking.authorization_reviewed',
    resource: 'booking_control',
    resourceId: existing.id,
    details: { decision: req.body.decision, note: req.body.note, paymentId: updated.id },
  });
  res.json({ review: deriveAuthorizationReview(updated), payment: updated });
});

bookingsRouter.get('/control-tower/:appointmentId/override-preview', async (req, res) => {
  const existing = await getScopedAppointment(req.params.appointmentId, req.user?.organizationId);
  const providerId = String(req.query.providerId ?? existing.providerId).trim();
  const startsAtValue = String(req.query.startsAt ?? existing.startsAt.toISOString()).trim();
  const endsAtValue = String(req.query.endsAt ?? existing.endsAt.toISOString()).trim();
  const startsAt = new Date(startsAtValue);
  const endsAt = new Date(endsAtValue);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    throw badRequest('A valid override preview window is required.');
  }
  const policy = await evaluateBookingPolicy({
    organizationId: existing.organizationId,
    providerId,
    service: existing.service,
    location: existing.location,
    startsAt,
    endsAt,
  });
  const providerWindow = await validateProviderBookingWindow({
    organizationId: existing.organizationId,
    providerId,
    startsAt,
    endsAt,
    excludeAppointmentId: providerId === existing.providerId ? existing.id : undefined,
  });
  res.json({
    preview: {
      providerId,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      providerWindow,
      policy: buildPolicyExceptionContext(policy),
    },
  });
});

bookingsRouter.get('/control-tower/:appointmentId', async (req, res) => {
  const item = await getScopedAppointment(req.params.appointmentId, req.user?.organizationId);
  const auditTrail = await getBookingOpsLogs(item.id, req.user?.organizationId);
  const policy = await evaluateBookingPolicy({
    organizationId: item.organizationId,
    providerId: item.providerId,
    service: item.service,
    location: item.location,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
  });
  const documents = await listBookingDocuments({
    organizationId: item.organizationId,
    patientId: item.patientId,
    appointmentId: item.id,
  });
  const authorizationReview = await getAuthorizationReviewForAppointment(item.id);
  res.json({
    item: mapAppointment(item),
    records: item.records,
    documents,
    auditTrail,
    policy,
    overrideContext: buildPolicyExceptionContext(policy),
    authorizationReview,
  });
});

bookingsRouter.post('/control-tower/:appointmentId/reassign-provider', allowRoles(writeRoles), validateBody(reassignSchema), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  const existing = await getScopedAppointment(req.params.appointmentId, organizationId);

  const provider = await prisma.providerProfile.findUnique({ where: { id: req.body.providerId }, include: { user: true } });
  if (!provider || (organizationId && provider.organizationId !== organizationId)) {
    throw notFound('Provider not found');
  }

  const policy = await evaluateBookingPolicy({
    organizationId: existing.organizationId,
    providerId: provider.id,
    service: existing.service,
    location: existing.location,
    startsAt: existing.startsAt,
    endsAt: existing.endsAt,
  });
  const providerWindow = await validateProviderBookingWindow({
    organizationId: existing.organizationId,
    providerId: provider.id,
    startsAt: existing.startsAt,
    endsAt: existing.endsAt,
    excludeAppointmentId: existing.id,
  });
  if (!providerWindow.ok) throw badRequest(providerWindow.reason);
  if (policy.overrideRequired && (!String(req.body.note ?? '').trim() || !req.body.reasonCode)) {
    throw badRequest('This provider reassignment requires both an override note and a reason code because of the current booking policy constraints.');
  }

  const updated = await prisma.appointment.update({
    where: { id: existing.id },
    data: { providerId: provider.id },
    include: {
      patient: { include: { user: true } },
      provider: { include: { user: true } },
      telehealthSession: true,
      payments: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  await writeAuditLog({
    actorId,
    organizationId,
    action: 'booking.provider_reassigned',
    resource: 'booking_control',
    resourceId: existing.id,
    details: {
      previousProviderId: existing.providerId,
      nextProviderId: provider.id,
      note: req.body.note ?? null,
      reasonCode: req.body.reasonCode ?? null,
      overridePolicyReasons: policy.reasons,
      exceptionContext: buildPolicyExceptionContext(policy),
    },
  });

  res.json({ item: mapAppointment(updated), overrideContext: buildPolicyExceptionContext(policy) });
});

bookingsRouter.post('/control-tower/:appointmentId/reschedule', allowRoles(writeRoles), validateBody(rescheduleSchema), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  const existing = await getScopedAppointment(req.params.appointmentId, organizationId);
  const startsAt = new Date(req.body.startsAt);
  const endsAt = new Date(req.body.endsAt);
  if (endsAt <= startsAt) {
    throw badRequest('Appointment end must be after start');
  }

  const providerPolicy = await evaluateBookingPolicy({
    organizationId: existing.organizationId,
    providerId: existing.providerId,
    service: existing.service,
    location: existing.location,
    startsAt,
    endsAt,
  });
  const providerWindow = await validateProviderBookingWindow({
    organizationId: existing.organizationId,
    providerId: existing.providerId,
    startsAt,
    endsAt,
    excludeAppointmentId: existing.id,
  });
  if (!providerWindow.ok) {
    throw badRequest(providerWindow.reason);
  }
  if (providerPolicy.overrideRequired && (!String(req.body.note ?? '').trim() || !req.body.reasonCode)) {
    throw badRequest('Rescheduling into this slot requires both an override note and a reason code because of the active booking policy constraints.');
  }

  const updated = await prisma.appointment.update({
    where: { id: existing.id },
    data: { startsAt, endsAt },
    include: {
      patient: { include: { user: true } },
      provider: { include: { user: true } },
      telehealthSession: true,
      payments: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  await writeAuditLog({
    actorId,
    organizationId,
    action: 'booking.rescheduled',
    resource: 'booking_control',
    resourceId: existing.id,
    details: {
      previousStartsAt: existing.startsAt.toISOString(),
      previousEndsAt: existing.endsAt.toISOString(),
      nextStartsAt: startsAt.toISOString(),
      nextEndsAt: endsAt.toISOString(),
      note: req.body.note ?? null,
      reasonCode: req.body.reasonCode ?? null,
      overridePolicyReasons: providerPolicy.reasons,
      exceptionContext: buildPolicyExceptionContext(providerPolicy),
    },
  });

  res.json({ item: mapAppointment(updated), overrideContext: buildPolicyExceptionContext(providerPolicy) });
});

bookingsRouter.post('/control-tower/:appointmentId/mark-no-show', allowRoles(writeRoles), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  const existing = await getScopedAppointment(req.params.appointmentId, organizationId);

  const updated = await prisma.appointment.update({
    where: { id: existing.id },
    data: { status: 'NO_SHOW' },
    include: {
      patient: { include: { user: true } },
      provider: { include: { user: true } },
      telehealthSession: true,
      payments: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  await writeAuditLog({
    actorId,
    organizationId,
    action: 'booking.marked_no_show',
    resource: 'booking_control',
    resourceId: existing.id,
    details: {
      previousStatus: existing.status,
      note: String(req.body?.note ?? '').trim() || null,
    },
  });

  res.json({ item: mapAppointment(updated) });
});

bookingsRouter.post('/control-tower/:appointmentId/escalate', allowRoles(writeRoles), validateBody(escalationSchema), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  const existing = await getScopedAppointment(req.params.appointmentId, organizationId);

  await writeAuditLog({
    actorId,
    organizationId,
    action: 'booking.escalated',
    resource: 'booking_control',
    resourceId: existing.id,
    details: {
      reasonCode: req.body.reasonCode,
      ownerRole: req.body.ownerRole ?? null,
      note: req.body.note ?? null,
      appointmentStatus: existing.status,
    },
  });

  res.status(202).json({ ok: true, appointmentId: existing.id });
});
