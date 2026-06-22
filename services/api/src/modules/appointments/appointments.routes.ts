import { Router } from 'express';
import { z } from 'zod';
import { appointmentCreateSchema, appointmentPatchSchema, appointmentStatusSchema, appointmentTypeSchema } from '@care-center/contracts';
import { allowRoles } from '../../middleware/rbac';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { badRequest, notFound } from '../../lib/http';
import { writeAuditLog } from '../../lib/audit';
import { createSlotHold, evaluateBookingPolicy, extendSlotHold, getProviderPublishedSlots, getSlotHold, listActiveSlotHolds, markSlotHoldBooked, releaseSlotHold, validateProviderBookingWindow } from '../../lib/scheduling-store';
import { attachBookingDocumentsToAppointment, createBookingDocument, getBookingDocument, listBookingDocuments, updateBookingDocumentRedaction } from '../../lib/booking-document-store';
import { getPatientContext, getRequestedSubjectProfileId } from '../../lib/patient-context';
import { clearAppointmentSubjectMeta, getAppointmentSubjectMeta, upsertAppointmentSubjectMeta } from '../../lib/appointment-subject-store';
import { ensureAppointmentAccessRecord, grantAppointmentAccess, revokeAppointmentAccess } from '../../lib/appointment-access-store';

export const appointmentsRouter = Router();

const slotHoldSchema = z.object({
  providerId: z.string().min(2),
  service: z.string().trim().min(2),
  location: z.string().trim().min(2),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  appointmentType: appointmentTypeSchema.optional(),
  channel: z.enum(['CARD', 'WALLET', 'CASH']).optional(),
  holdMinutes: z.number().int().min(5).max(20).optional(),
  subjectProfileId: z.string().trim().min(2).optional(),
  subjectLabel: z.string().trim().min(2).max(120).optional(),
  subjectRelationship: z.string().trim().min(2).max(80).optional(),
});


const bookingDocumentSchema = z.object({
  holdId: z.string().min(2).optional().nullable(),
  kind: z.enum(['INSURANCE', 'IDENTITY', 'AUTHORIZATION']),
  fileName: z.string().trim().min(3).max(120),
  ocrPreview: z.string().trim().min(3).max(3000).optional().nullable(),
  redactedFields: z.array(z.string().trim().min(1).max(80)).default([]),
  subjectProfileId: z.string().trim().min(2).optional(),
  subjectLabel: z.string().trim().min(2).max(120).optional(),
});

const bookingDocumentRedactionSchema = z.object({
  redactedFields: z.array(z.string().trim().min(1).max(80)).default([]),
  ocrPreview: z.string().trim().min(3).max(3000).optional().nullable(),
  subjectProfileId: z.string().trim().min(2).optional(),
  subjectLabel: z.string().trim().min(2).max(120).optional(),
});


const holdMutationSchema = z.object({
  extendMinutes: z.number().int().min(1).max(10).optional(),
  note: z.string().trim().max(500).optional().nullable(),
});

const bookWithHoldSchema = z.object({
  holdId: z.string().min(2),
  patientId: z.string().min(2),
  providerId: z.string().min(2),
  organizationId: z.string().min(2),
  service: z.string().trim().min(2),
  location: z.string().trim().min(2),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  appointmentType: appointmentTypeSchema.default('ONLINE_MEETING'),
  notes: z.string().trim().max(2000).optional().nullable(),
  intakeCompleted: z.boolean().optional(),
  insuranceUploaded: z.boolean().optional(),
  idUploaded: z.boolean().optional(),
  authorizationConfirmed: z.boolean().optional(),
  policyAccepted: z.boolean().optional(),
  paymentMethod: z.enum(['CARD', 'WALLET', 'CASH']).optional(),
  subjectProfileId: z.string().trim().min(2).optional(),
  subjectLabel: z.string().trim().min(2).max(120).optional(),
  subjectRelationship: z.string().trim().min(2).max(80).optional(),
  insuranceDocumentId: z.string().min(2).optional().nullable(),
  idDocumentId: z.string().min(2).optional().nullable(),
  authorizationDocumentId: z.string().min(2).optional().nullable(),
});

appointmentsRouter.use(requireAuth);

appointmentsRouter.get('/booking-policy-preview', allowRoles(['PATIENT', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'PROVIDER', 'NURSE']), async (req, res) => {
  const requestedProviderId = String(req.query.providerId ?? '').trim();
  const service = String(req.query.service ?? '').trim();
  const location = String(req.query.location ?? '').trim();
  const startsAtValue = String(req.query.startsAt ?? '').trim();
  const endsAtValue = String(req.query.endsAt ?? '').trim();
  if (!service || !location || !startsAtValue || !endsAtValue) {
    throw badRequest('service, location, startsAt, and endsAt are required');
  }
  const providerId = requestedProviderId || (['PROVIDER', 'NURSE'].includes(String(req.user?.role ?? '')) ? ((await getProviderProfileId(req.user!.userId)) ?? 'policy-preview') : 'policy-preview');
  const policy = await evaluateBookingPolicy({
    organizationId: req.user?.organizationId ?? '',
    providerId,
    service,
    location,
    startsAt: new Date(startsAtValue),
    endsAt: new Date(endsAtValue),
  });
  res.json({ policy, providerId });
});


async function getPatientProfileId(userId: string) {
  const profile = await prisma.patientProfile.findUnique({ where: { userId }, select: { id: true } });
  return profile?.id;
}

async function getProviderProfileId(userId: string) {
  const profile = await prisma.providerProfile.findUnique({ where: { userId }, select: { id: true } });
  return profile?.id;
}


function parsePaymentReviewReasonCodes(payment: any) {
  const metadata = payment?.metadata && typeof payment.metadata === 'object' ? payment.metadata as Record<string, any> : {};
  const raw = metadata.reviewReasonCodes;
  if (Array.isArray(raw)) return raw.map((item) => String(item)).filter(Boolean);
  if (typeof raw === 'string' && raw.trim()) return raw.split('|').map((item) => item.trim()).filter(Boolean);
  return [] as string[];
}


function extractLegacyAppointmentSubjectMeta(notes?: string | null) {
  const value = String(notes ?? '');
  const match = value.match(/^\[\[subject:([^\]|]+)(?:\|label:([^\]]+))?\]\]\s*/);
  if (!match) return { subjectProfileId: null as string | null, subjectLabel: null as string | null, notes: value };
  return {
    subjectProfileId: match[1] ? match[1].trim() : null,
    subjectLabel: match[2] ? match[2].trim() : null,
    notes: value.slice(match[0].length),
  };
}

function stripLegacyAppointmentSubjectNotes(notes: string | null | undefined) {
  return extractLegacyAppointmentSubjectMeta(String(notes ?? '')).notes.trim() || null;
}

function getSubjectPayload(input: { subjectProfileId?: string | null; subjectLabel?: string | null; subjectRelationship?: string | null }) {
  const subjectProfileId = String(input.subjectProfileId ?? '').trim() || null;
  return {
    subjectProfileId,
    subjectLabel: subjectProfileId ? (String(input.subjectLabel ?? '').trim() || null) : null,
    subjectRelationship: subjectProfileId ? (String(input.subjectRelationship ?? '').trim() || null) : null,
    isFamilySubject: Boolean(subjectProfileId),
  };
}

async function getResolvedAppointmentSubjectMeta(item: any) {
  const stored = await getAppointmentSubjectMeta({
    appointmentId: item.id,
    organizationId: item.organizationId,
    patientId: item.patientId,
  });
  if (stored) return stored;
  const legacy = extractLegacyAppointmentSubjectMeta(item.notes);
  if (!legacy.subjectProfileId) return null;
  return {
    appointmentId: item.id,
    organizationId: item.organizationId,
    patientId: item.patientId,
    subjectProfileId: legacy.subjectProfileId,
    subjectLabel: legacy.subjectLabel,
    subjectRelationship: null,
    isFamilySubject: true,
    createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : new Date().toISOString(),
  };
}

async function persistAppointmentSubjectMeta(item: { id: string; organizationId: string; patientId: string }, input: { subjectProfileId?: string | null; subjectLabel?: string | null; subjectRelationship?: string | null }) {
  const subject = getSubjectPayload(input);
  if (!subject.subjectProfileId) {
    await clearAppointmentSubjectMeta({ appointmentId: item.id, organizationId: item.organizationId });
    return null;
  }
  return upsertAppointmentSubjectMeta({
    appointmentId: item.id,
    organizationId: item.organizationId,
    patientId: item.patientId,
    subjectProfileId: subject.subjectProfileId,
    subjectLabel: subject.subjectLabel,
    subjectRelationship: subject.subjectRelationship,
    isFamilySubject: true,
  });
}

function deriveAuthorizationReview(payment: any) {
  const metadata = payment?.metadata && typeof payment.metadata === 'object' ? payment.metadata as Record<string, any> : {};
  const reviewReasonCodes = parsePaymentReviewReasonCodes(payment);
  const required = reviewReasonCodes.includes('AUTHORIZATION_REQUIRED') || String(metadata.authorizationRequired ?? '').toLowerCase() === 'true';
  const decision = String(metadata.authorizationDecision ?? '').trim().toUpperCase();
  return {
    required,
    status: decision || (required ? 'PENDING' : 'NOT_REQUIRED'),
    reasonCodes: reviewReasonCodes,
    reviewedAt: metadata.authorizationReviewedAt ?? null,
    reviewedBy: metadata.authorizationReviewedBy ?? null,
    note: metadata.authorizationReviewNote ?? null,
  };
}

async function serializeAppointment(item: any) {
  const subject = await getResolvedAppointmentSubjectMeta(item);
  const access = await ensureAppointmentAccessRecord({
    organizationId: item.organizationId,
    appointmentId: item.id,
    patientId: item.patientId,
    providerId: item.providerId,
    subjectProfileId: subject?.subjectProfileId ?? null,
    location: item.location,
  });
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
    appointmentType: access.appointmentType,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    notes: stripLegacyAppointmentSubjectNotes(item.notes),
    subjectProfileId: subject?.subjectProfileId ?? null,
    subjectLabel: subject?.subjectLabel ?? null,
    subjectRelationship: subject?.subjectRelationship ?? null,
    isFamilySubject: Boolean(subject?.isFamilySubject),
    providerAccess: access,
    status: item.status,
    telehealthSession: item.telehealthSession,
    payment: item.payments?.[0] ?? null,
    paymentStatus: item.payments?.[0]?.status ?? null,
    authorizationReview: deriveAuthorizationReview(item.payments?.[0] ?? null),
  };
}

appointmentsRouter.get('/availability', allowRoles(['PATIENT', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'PROVIDER', 'NURSE']), async (req, res) => {
  const providerId = String(req.query.providerId ?? '').trim();
  if (!providerId) throw badRequest('providerId is required');
  const service = String(req.query.service ?? '').trim() || undefined;
  const location = String(req.query.location ?? '').trim() || undefined;
  const days = Math.min(Math.max(Number(req.query.days ?? 10), 1), 21);
  const items = await getProviderPublishedSlots({
    organizationId: req.user?.organizationId ?? '',
    providerId,
    service,
    location,
    startsAt: new Date(),
    endsAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
  });
  res.json({ items, count: items.length });
});

appointmentsRouter.post('/holds', allowRoles(['PATIENT', 'COMPANY_ADMIN', 'COMPANY_SUPPORT']), validateBody(slotHoldSchema), async (req, res) => {
  const patientContext = req.user?.role === 'PATIENT' ? await getPatientContext(req.user.userId, req.user?.organizationId, getRequestedSubjectProfileId(req)) : null;
  const patientId = patientContext ? patientContext.patientProfileId : req.body.patientId;
  if (!patientId) throw badRequest('Patient profile is required before a slot can be held');
  const policy = await evaluateBookingPolicy({
    organizationId: req.user?.organizationId ?? '',
    providerId: req.body.providerId,
    service: req.body.service,
    location: req.body.location,
    startsAt: new Date(req.body.startsAt),
    endsAt: new Date(req.body.endsAt),
  });
  if (policy.overrideRequired) throw badRequest(policy.reasons[0] || 'Selected slot violates booking policy constraints.');
  const hold = await createSlotHold({
    organizationId: req.user?.organizationId ?? '',
    providerId: req.body.providerId,
    patientId,
    service: req.body.service,
    location: req.body.location,
    startsAt: new Date(req.body.startsAt),
    endsAt: new Date(req.body.endsAt),
    holdMinutes: req.body.holdMinutes,
    actorId: req.user?.userId,
    metadata: getSubjectPayload({
      subjectProfileId: req.body.subjectProfileId,
      subjectLabel: req.body.subjectLabel,
      subjectRelationship: req.body.subjectRelationship,
    }),
  });
  res.status(201).json({ hold });
});


appointmentsRouter.get('/holds', allowRoles(['PATIENT', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'PROVIDER', 'NURSE']), async (req, res) => {
  const role = req.user?.role;
  const patientContext = role === 'PATIENT' ? await getPatientContext(req.user!.userId, req.user?.organizationId, getRequestedSubjectProfileId(req)) : null;
  const requestedSubjectProfileId = getRequestedSubjectProfileId(req);
  const patientId = role === 'PATIENT'
    ? patientContext?.patientProfileId
    : String(req.query.patientId ?? '').trim() || undefined;
  const providerId = role && ['PROVIDER', 'NURSE'].includes(role)
    ? await getProviderProfileId(req.user!.userId)
    : String(req.query.providerId ?? '').trim() || undefined;
  const limit = Math.min(Math.max(Number(req.query.limit ?? 25), 1), 100);
  const items = await listActiveSlotHolds({
    organizationId: req.user?.organizationId,
    patientId: patientId || undefined,
    providerId: providerId || undefined,
    limit,
  });
  const filteredItems = role === 'PATIENT'
    ? items.filter((item) => requestedSubjectProfileId ? item.metadata?.subjectProfileId === requestedSubjectProfileId : !item.metadata?.subjectProfileId)
    : items;
  res.json({ items: filteredItems, count: filteredItems.length });
});

appointmentsRouter.get('/holds/:holdId', allowRoles(['PATIENT', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'PROVIDER', 'NURSE']), async (req, res) => {
  const hold = await getSlotHold(req.params.holdId, req.user?.organizationId);
  if (!hold) throw notFound('Slot hold not found');
  res.json({ hold });
});

appointmentsRouter.get('/booking-documents', allowRoles(['PATIENT', 'COMPANY_ADMIN', 'COMPANY_SUPPORT']), async (req, res) => {
  const patientId = req.user?.role === 'PATIENT' ? await getPatientProfileId(req.user.userId) : String(req.query.patientId ?? '').trim();
  if (!patientId) throw badRequest('Patient profile is required');
  const holdId = String(req.query.holdId ?? '').trim() || undefined;
  const appointmentId = String(req.query.appointmentId ?? '').trim() || undefined;
  const kind = String(req.query.kind ?? '').trim().toUpperCase() || undefined;
  const subjectProfileId = getRequestedSubjectProfileId(req);
  const items = await listBookingDocuments({
    organizationId: req.user?.organizationId ?? '',
    patientId,
    holdId,
    appointmentId,
    kind: kind === 'INSURANCE' || kind === 'IDENTITY' || kind === 'AUTHORIZATION' ? kind : undefined,
    subjectProfileId,
  });
  res.json({ items, count: items.length });
});

appointmentsRouter.post('/booking-documents', allowRoles(['PATIENT', 'COMPANY_ADMIN', 'COMPANY_SUPPORT']), validateBody(bookingDocumentSchema), async (req, res) => {
  const patientId = req.user?.role === 'PATIENT' ? await getPatientProfileId(req.user.userId) : String(req.body?.patientId ?? '').trim();
  if (!patientId) throw badRequest('Patient profile is required');
  if (req.body.holdId) {
    const hold = await getSlotHold(req.body.holdId, req.user?.organizationId);
    if (!hold) throw badRequest('Slot hold not found for document upload.');
    if (hold.patientId !== patientId) throw badRequest('Booking document upload does not match the active patient hold.');
  }
  const item = await createBookingDocument({
    organizationId: req.user?.organizationId ?? '',
    patientId,
    holdId: req.body.holdId ?? null,
    kind: req.body.kind,
    fileName: req.body.fileName,
    ocrPreview: req.body.ocrPreview ?? null,
    redactedFields: req.body.redactedFields,
    metadata: { source: 'booking_documents_api', actorId: req.user?.userId ?? null, subjectProfileId: req.body.subjectProfileId ?? null, subjectLabel: req.body.subjectLabel ?? null },
  });
  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId: req.user?.organizationId,
    action: 'booking.document_uploaded',
    resource: 'booking_document',
    resourceId: item.id,
    details: { patientId, holdId: item.holdId ?? null, kind: item.kind, fileName: item.fileName },
  });
  res.status(201).json({ item });
});

appointmentsRouter.patch('/booking-documents/:documentId/redaction', allowRoles(['PATIENT', 'COMPANY_ADMIN', 'COMPANY_SUPPORT']), validateBody(bookingDocumentRedactionSchema), async (req, res) => {
  const patientId = req.user?.role === 'PATIENT' ? await getPatientProfileId(req.user.userId) : String(req.body?.patientId ?? '').trim();
  if (!patientId) throw badRequest('Patient profile is required');
  const item = await updateBookingDocumentRedaction({
    organizationId: req.user?.organizationId ?? '',
    patientId,
    documentId: req.params.documentId,
    redactedFields: req.body.redactedFields,
    ocrPreview: req.body.ocrPreview ?? null,
  });
  if (!item) throw notFound('Booking document not found');
  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId: req.user?.organizationId,
    action: 'booking.document_redacted',
    resource: 'booking_document',
    resourceId: item.id,
    details: { patientId, redactedFields: item.redactedFields },
  });
  res.json({ item });
});


appointmentsRouter.post('/holds/:holdId/extend', allowRoles(['PATIENT', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'PROVIDER', 'NURSE']), validateBody(holdMutationSchema), async (req, res) => {
  const existing = await getSlotHold(req.params.holdId, req.user?.organizationId);
  if (!existing) throw notFound('Slot hold not found');
  if (req.user?.role === 'PATIENT') {
    const patientId = await getPatientProfileId(req.user.userId);
    if (!patientId || existing.patientId !== patientId) throw badRequest('Slot hold does not belong to the current patient session.');
  }
  if (req.user?.role && ['PROVIDER', 'NURSE'].includes(req.user.role)) {
    const providerId = await getProviderProfileId(req.user.userId);
    if (!providerId || existing.providerId !== providerId) throw badRequest('Slot hold does not belong to the current provider schedule.');
  }
  const hold = await extendSlotHold({ holdId: req.params.holdId, organizationId: req.user?.organizationId, actorId: req.user?.userId, extendMinutes: req.body.extendMinutes, note: req.body.note ?? undefined });
  if (!hold) throw notFound('Slot hold not found');
  res.json({ hold });
});

appointmentsRouter.post('/holds/:holdId/release', allowRoles(['PATIENT', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'PROVIDER', 'NURSE']), async (req, res) => {
  const existing = await getSlotHold(req.params.holdId, req.user?.organizationId);
  if (!existing) throw notFound('Slot hold not found');
  if (req.user?.role === 'PATIENT') {
    const patientId = await getPatientProfileId(req.user.userId);
    if (!patientId || existing.patientId !== patientId) throw badRequest('Slot hold does not belong to the current patient session.');
  }
  if (req.user?.role && ['PROVIDER', 'NURSE'].includes(req.user.role)) {
    const providerId = await getProviderProfileId(req.user.userId);
    if (!providerId || existing.providerId !== providerId) throw badRequest('Slot hold does not belong to the current provider schedule.');
  }
  const hold = await releaseSlotHold({ holdId: req.params.holdId, organizationId: req.user?.organizationId, actorId: req.user?.userId, note: String(req.body?.note ?? '').trim() || undefined });
  if (!hold) throw notFound('Slot hold not found');
  res.json({ hold });
});

appointmentsRouter.post('/book-with-hold', allowRoles(['PATIENT', 'COMPANY_ADMIN', 'COMPANY_SUPPORT']), validateBody(bookWithHoldSchema), async (req, res) => {
  const hold = await getSlotHold(req.body.holdId, req.user?.organizationId);
  if (!hold) throw badRequest('Slot hold was not found. Refresh availability and select a new slot.');
  if (hold.status !== 'HELD') throw badRequest('Slot hold is no longer active. Refresh availability and select a new slot.');
  if (new Date(hold.expiresAt).getTime() <= Date.now()) throw badRequest('Slot hold has expired. Refresh availability and select a new slot.');
  const patientContext = req.user?.role === 'PATIENT' ? await getPatientContext(req.user.userId, req.user?.organizationId, getRequestedSubjectProfileId(req)) : null;
  const patientId = patientContext ? patientContext.patientProfileId : req.body.patientId;
  if (!patientId || patientId !== hold.patientId) throw badRequest('Slot hold does not belong to the current patient session.');
  if (hold.providerId !== req.body.providerId || hold.service !== req.body.service || hold.location !== req.body.location || hold.startsAt !== new Date(req.body.startsAt).toISOString() || hold.endsAt !== new Date(req.body.endsAt).toISOString()) {
    throw badRequest('Booking details do not match the active slot hold.');
  }

  const policy = await evaluateBookingPolicy({
    organizationId: req.body.organizationId,
    providerId: req.body.providerId,
    service: req.body.service,
    location: req.body.location,
    startsAt: new Date(req.body.startsAt),
    endsAt: new Date(req.body.endsAt),
  });
  if (policy.requiresPolicyAcceptance && req.body.policyAccepted !== true) throw badRequest('Review and accept the cancellation/refund policy before confirming this booking.');
  if (!req.body.intakeCompleted) throw badRequest('Complete the appointment intake form before confirming this booking.');
  let insuranceDocument = null;
  let identityDocument = null;
  let authorizationDocument = null;
  if (policy.requiresInsuranceDocument) {
    if (req.body.insuranceUploaded !== true || !req.body.insuranceDocumentId) throw badRequest('Insurance documentation is required before this booking can be confirmed.');
    insuranceDocument = await getBookingDocument({ organizationId: req.user?.organizationId ?? '', patientId, documentId: req.body.insuranceDocumentId });
    if (!insuranceDocument || insuranceDocument.kind !== 'INSURANCE') throw badRequest('Insurance document could not be verified for this booking.');
  }
  if (policy.requiresIdentityDocument) {
    if (req.body.idUploaded !== true || !req.body.idDocumentId) throw badRequest('Identity documentation is required before this booking can be confirmed.');
    identityDocument = await getBookingDocument({ organizationId: req.user?.organizationId ?? '', patientId, documentId: req.body.idDocumentId });
    if (!identityDocument || identityDocument.kind !== 'IDENTITY') throw badRequest('Identity document could not be verified for this booking.');
  }
  if (policy.authorizationRequired) {
    if (req.body.authorizationConfirmed !== true) throw badRequest('Prior authorization must be confirmed before this booking can be confirmed.');
    if (req.body.authorizationDocumentId) {
      authorizationDocument = await getBookingDocument({ organizationId: req.user?.organizationId ?? '', patientId, documentId: req.body.authorizationDocumentId });
      if (!authorizationDocument || authorizationDocument.kind !== 'AUTHORIZATION') throw badRequest('Authorization document could not be verified for this booking.');
    }
  }
  if (req.body.paymentMethod && !policy.allowedPaymentMethods.includes(req.body.paymentMethod)) throw badRequest('Selected payment method is not allowed for the booking channel and facility configuration.');
  if (policy.overrideRequired) throw badRequest(policy.reasons[0] || 'Selected slot violates booking policy constraints.');

  const providerWindow = await validateProviderBookingWindow({
    organizationId: req.body.organizationId,
    providerId: req.body.providerId,
    startsAt: new Date(req.body.startsAt),
    endsAt: new Date(req.body.endsAt),
  });
  if (!providerWindow.ok) throw badRequest(providerWindow.reason);

  const created = await prisma.appointment.create({
    data: {
      patientId,
      providerId: req.body.providerId,
      organizationId: req.body.organizationId,
      service: req.body.service,
      location: req.body.location,
      startsAt: new Date(req.body.startsAt),
      endsAt: new Date(req.body.endsAt),
      notes: stripLegacyAppointmentSubjectNotes(req.body.notes) ?? undefined,
    },
    include: {
      patient: { include: { user: true } },
      provider: { include: { user: true } },
      telehealthSession: true,
      payments: true,
    },
  });

  await markSlotHoldBooked({ holdId: hold.id, appointmentId: created.id, actorId: req.user?.userId });
  const persistedSubject = await persistAppointmentSubjectMeta(created, {
    subjectProfileId: req.body.subjectProfileId ?? hold.metadata?.subjectProfileId ?? null,
    subjectLabel: req.body.subjectLabel ?? hold.metadata?.subjectLabel ?? null,
    subjectRelationship: req.body.subjectRelationship ?? hold.metadata?.subjectRelationship ?? null,
  });
  await ensureAppointmentAccessRecord({
    organizationId: created.organizationId,
    appointmentId: created.id,
    patientId: created.patientId,
    providerId: created.providerId,
    subjectProfileId: persistedSubject?.subjectProfileId ?? req.body.subjectProfileId ?? hold.metadata?.subjectProfileId ?? null,
    appointmentType: req.body.appointmentType,
    location: created.location,
  });

  const linkedDocuments = await attachBookingDocumentsToAppointment({
    organizationId: req.user?.organizationId ?? '',
    patientId,
    appointmentId: created.id,
    documentIds: [req.body.insuranceDocumentId, req.body.idDocumentId, req.body.authorizationDocumentId].filter((value): value is string => typeof value === 'string' && value.length > 0),
  });

  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId: req.body.organizationId,
    action: 'appointment.created_from_hold',
    resource: 'appointment',
    resourceId: created.id,
    details: { holdId: hold.id, providerId: req.body.providerId, patientId, startsAt: req.body.startsAt, endsAt: req.body.endsAt },
  });

  res.status(201).json({ ...(await serializeAppointment(created)), linkedDocuments });
});

appointmentsRouter.get('/', async (req, res) => {
  const role = req.user!.role;
  const status = req.query.status ? String(req.query.status) : undefined;
  const requestedSubjectProfileId = getRequestedSubjectProfileId(req);
  const patientContext = role === 'PATIENT' ? await getPatientContext(req.user!.userId, req.user?.organizationId, requestedSubjectProfileId) : null;
  const patientProfileId = role === 'PATIENT' ? patientContext?.patientProfileId : undefined;
  const providerProfileId = ['PROVIDER', 'NURSE', 'PHARMACIST', 'LAB_TECH'].includes(role)
    ? await getProviderProfileId(req.user!.userId)
    : undefined;

  const where: Record<string, any> = req.user?.organizationId ? { organizationId: req.user.organizationId } : {};

  if (role === 'PATIENT') {
    where.patientId = patientProfileId ?? '__none__';
  } else if (providerProfileId) {
    where.providerId = providerProfileId;
  }

  if (status && appointmentStatusSchema.options.includes(status as (typeof appointmentStatusSchema.options)[number])) {
    where.status = status;
  }

  const items = await prisma.appointment.findMany({
    where,
    include: {
      patient: { include: { user: true } },
      provider: { include: { user: true } },
      telehealthSession: true,
      payments: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { startsAt: 'asc' },
  });

  const serializedItems = await Promise.all(items.map((item) => serializeAppointment(item)));
  const filteredItems = role === 'PATIENT'
    ? serializedItems.filter((item) => requestedSubjectProfileId ? item.subjectProfileId === requestedSubjectProfileId : !item.subjectProfileId)
    : serializedItems;

  res.json({ items: filteredItems });
});


async function enforcePatientAppointmentAccess(req: any, item: any) {
  if (req.user?.role !== 'PATIENT') return;
  const requestedSubjectProfileId = getRequestedSubjectProfileId(req);
  const patientContext = await getPatientContext(req.user.userId, req.user?.organizationId, requestedSubjectProfileId);
  if (!patientContext || item.patientId !== patientContext.patientProfileId) {
    throw notFound('Appointment not found');
  }
  const subject = await getResolvedAppointmentSubjectMeta(item);
  if (requestedSubjectProfileId) {
    if (subject?.subjectProfileId !== requestedSubjectProfileId) throw notFound('Appointment not found');
  } else if (subject?.subjectProfileId) {
    throw notFound('Appointment not found');
  }
}

const appointmentConsentMutationSchema = z.object({
  note: z.string().trim().max(500).optional().nullable(),
});

appointmentsRouter.get('/:appointmentId', async (req, res) => {
  const item = await prisma.appointment.findUnique({
    where: { id: req.params.appointmentId },
    include: {
      patient: { include: { user: true } },
      provider: { include: { user: true } },
      telehealthSession: true,
      payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      records: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!item) {
    throw notFound('Appointment not found');
  }

  await enforcePatientAppointmentAccess(req, item);
  res.json({ ...(await serializeAppointment(item)), records: item.records, authorizationReview: deriveAuthorizationReview(item.payments?.[0] ?? null) });
});

appointmentsRouter.get('/:appointmentId/access-consent', allowRoles(['PATIENT', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'PROVIDER', 'NURSE']), async (req, res) => {
  const item = await prisma.appointment.findUnique({ where: { id: req.params.appointmentId } });
  if (!item) throw notFound('Appointment not found');
  await enforcePatientAppointmentAccess(req, item);
  const subject = await getResolvedAppointmentSubjectMeta(item);
  const consent = await ensureAppointmentAccessRecord({
    organizationId: item.organizationId,
    appointmentId: item.id,
    patientId: item.patientId,
    providerId: item.providerId,
    subjectProfileId: subject?.subjectProfileId ?? null,
    location: item.location,
  });
  res.json({ consent });
});

appointmentsRouter.post('/:appointmentId/access-consent/grant', allowRoles(['PATIENT']), validateBody(appointmentConsentMutationSchema), async (req, res) => {
  const item = await prisma.appointment.findUnique({ where: { id: req.params.appointmentId } });
  if (!item) throw notFound('Appointment not found');
  await enforcePatientAppointmentAccess(req, item);
  const subject = await getResolvedAppointmentSubjectMeta(item);
  const consent = await grantAppointmentAccess({
    organizationId: item.organizationId,
    appointmentId: item.id,
    patientId: item.patientId,
    providerId: item.providerId,
    subjectProfileId: subject?.subjectProfileId ?? null,
    appointmentType: req.body.appointmentType,
    location: item.location,
    grantedByUserId: req.user?.userId,
    note: req.body.note ?? null,
  });
  await writeAuditLog({ actorId: req.user?.userId, organizationId: item.organizationId, action: 'appointment.provider_access_granted', resource: 'appointment', resourceId: item.id, details: { consent } });
  res.json({ consent });
});

appointmentsRouter.post('/:appointmentId/access-consent/revoke', allowRoles(['PATIENT']), validateBody(appointmentConsentMutationSchema), async (req, res) => {
  const item = await prisma.appointment.findUnique({ where: { id: req.params.appointmentId } });
  if (!item) throw notFound('Appointment not found');
  await enforcePatientAppointmentAccess(req, item);
  const subject = await getResolvedAppointmentSubjectMeta(item);
  const consent = await revokeAppointmentAccess({
    organizationId: item.organizationId,
    appointmentId: item.id,
    patientId: item.patientId,
    providerId: item.providerId,
    subjectProfileId: subject?.subjectProfileId ?? null,
    appointmentType: req.body.appointmentType,
    location: item.location,
    revokedByUserId: req.user?.userId,
    note: req.body.note ?? null,
  });
  await writeAuditLog({ actorId: req.user?.userId, organizationId: item.organizationId, action: 'appointment.provider_access_revoked', resource: 'appointment', resourceId: item.id, details: { consent } });
  res.json({ consent });
});

appointmentsRouter.post(
  '/',
  allowRoles(['PATIENT', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'PROVIDER', 'NURSE']),
  validateBody(appointmentCreateSchema),
  async (req, res) => {
    const created = await prisma.appointment.create({
      data: {
        patientId: req.body.patientId,
        providerId: req.body.providerId,
        organizationId: req.body.organizationId,
        service: req.body.service,
        location: req.body.location,
        notes: stripLegacyAppointmentSubjectNotes(req.body.notes) ?? undefined,
        startsAt: new Date(req.body.startsAt),
        endsAt: new Date(req.body.endsAt),
      },
      include: {
        patient: { include: { user: true } },
        provider: { include: { user: true } },
        telehealthSession: true,
        payments: true,
      },
    });

    const persistedSubject = await persistAppointmentSubjectMeta(created, {
      subjectProfileId: req.body.subjectProfileId ?? null,
      subjectLabel: req.body.subjectLabel ?? null,
      subjectRelationship: req.body.subjectRelationship ?? null,
    });
    await ensureAppointmentAccessRecord({
      organizationId: created.organizationId,
      appointmentId: created.id,
      patientId: created.patientId,
      providerId: created.providerId,
      subjectProfileId: persistedSubject?.subjectProfileId ?? req.body.subjectProfileId ?? null,
      appointmentType: req.body.appointmentType,
      location: created.location,
    });

    await writeAuditLog({
      actorId: req.user?.userId,
      organizationId: req.body.organizationId,
      action: 'appointment.created',
      resource: 'appointment',
      resourceId: created.id,
      details: req.body,
    });

    res.status(201).json({ ...(await serializeAppointment(created)), linkedDocuments: [] });
  },
);

appointmentsRouter.patch(
  '/:appointmentId',
  allowRoles(['COMPANY_ADMIN', 'COMPANY_SUPPORT', 'PROVIDER', 'NURSE']),
  validateBody(appointmentPatchSchema),
  async (req, res) => {
    const existing = await prisma.appointment.findUnique({ where: { id: req.params.appointmentId } });
    if (!existing) {
      throw notFound('Appointment not found');
    }

    const nextStartsAt = req.body.startsAt ? new Date(req.body.startsAt) : existing.startsAt;
    const nextEndsAt = req.body.endsAt ? new Date(req.body.endsAt) : existing.endsAt;
    const providerWindow = await validateProviderBookingWindow({
      organizationId: existing.organizationId,
      providerId: existing.providerId,
      startsAt: nextStartsAt,
      endsAt: nextEndsAt,
      excludeAppointmentId: existing.id,
    });
    if (!providerWindow.ok) throw badRequest(providerWindow.reason);

    const existingSubject = await getResolvedAppointmentSubjectMeta(existing);
    const updated = await prisma.appointment.update({
      where: { id: existing.id },
      data: {
        status: req.body.status,
        startsAt: req.body.startsAt ? new Date(req.body.startsAt) : undefined,
        endsAt: req.body.endsAt ? new Date(req.body.endsAt) : undefined,
        notes: req.body.notes != null ? stripLegacyAppointmentSubjectNotes(req.body.notes) ?? undefined : undefined,
      },
      include: {
        patient: { include: { user: true } },
        provider: { include: { user: true } },
        telehealthSession: true,
        payments: true,
      },
    });

    const persistedSubject = await persistAppointmentSubjectMeta(updated, {
      subjectProfileId: req.body.subjectProfileId !== undefined ? req.body.subjectProfileId : existingSubject?.subjectProfileId ?? null,
      subjectLabel: req.body.subjectLabel !== undefined ? req.body.subjectLabel : existingSubject?.subjectLabel ?? null,
      subjectRelationship: req.body.subjectRelationship !== undefined ? req.body.subjectRelationship : existingSubject?.subjectRelationship ?? null,
    });
    await ensureAppointmentAccessRecord({
      organizationId: updated.organizationId,
      appointmentId: updated.id,
      patientId: updated.patientId,
      providerId: updated.providerId,
      subjectProfileId: persistedSubject?.subjectProfileId ?? existingSubject?.subjectProfileId ?? null,
      appointmentType: req.body.appointmentType,
      location: updated.location,
    });

    await writeAuditLog({
      actorId: req.user?.userId,
      organizationId: req.user?.organizationId,
      action: 'appointment.updated',
      resource: 'appointment',
      resourceId: updated.id,
      details: req.body,
    });

    res.json(await serializeAppointment(updated));
  },
);

appointmentsRouter.post(
  '/:appointmentId/confirm',
  allowRoles(['COMPANY_ADMIN', 'COMPANY_SUPPORT', 'PROVIDER', 'NURSE']),
  async (req, res) => {
    const updated = await prisma.appointment.update({
      where: { id: req.params.appointmentId },
      data: { status: 'CONFIRMED' },
      include: {
        patient: { include: { user: true } },
        provider: { include: { user: true } },
        telehealthSession: true,
        payments: true,
      },
    });

    await writeAuditLog({
      actorId: req.user?.userId,
      organizationId: req.user?.organizationId,
      action: 'appointment.confirmed',
      resource: 'appointment',
      resourceId: updated.id,
    });

    res.json(await serializeAppointment(updated));
  },
);

appointmentsRouter.post(
  '/:appointmentId/cancel',
  allowRoles(['PATIENT', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'PROVIDER', 'NURSE']),
  async (req, res) => {
    const updated = await prisma.appointment.update({
      where: { id: req.params.appointmentId },
      data: { status: 'CANCELLED' },
      include: {
        patient: { include: { user: true } },
        provider: { include: { user: true } },
        telehealthSession: true,
        payments: true,
      },
    });

    await writeAuditLog({
      actorId: req.user?.userId,
      organizationId: req.user?.organizationId,
      action: 'appointment.cancelled',
      resource: 'appointment',
      resourceId: updated.id,
    });

    res.json(await serializeAppointment(updated));
  },
);
