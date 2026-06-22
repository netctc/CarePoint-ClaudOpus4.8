import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { badRequest } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { getProviderContext } from '../../lib/provider-context';
import { getProviderWorkspaceStorageMode, getProviderWorkspaceItem, listProviderWorkspaceItems, summarizeProviderWorkspaceItems, transitionProviderWorkspaceItem, upsertProviderWorkspaceItem } from '../../lib/provider-workspace-store';
import { writeAuditLog } from '../../lib/audit';
import { isControlledMedication, validateControlledMedicationPolicy } from '../../lib/ksa-compliance';
import { assignRefillRequest, escalateRefillRequest, getRefillAgingBand, getRefillRequestHistory, listRefillRequests, reviewRefillRequest, summarizeRefillRequests } from '../../lib/refill-request-store';
import { createRefillStatusNotification } from '../../lib/refill-notifications';
import { buildRefillAuditPacket } from '../../lib/refill-audit-packet';
import { listFailedReportDeliveryExecutions } from '../../lib/report-delivery-store';
import { getAppointmentSubjectMeta } from '../../lib/appointment-subject-store';
import { resolveProviderSubjectContext, upsertFamilyPrescriptionRelease } from '../../lib/family-subject-clinical-store';
import { buildHspAccessSummary, filterItemsByHspDomainAndLocation, requireDomainScopedHspLocationAccess, summarizeHspItemsByFacility } from '../../lib/hsp-access';
async function getValidPatientProfileId(patientId: string | null | undefined, organizationId: string) {
  const normalized = String(patientId ?? '').trim();
  if (!normalized) return null;
  const profile = await prisma.patientProfile.findFirst({ where: { id: normalized, organizationId }, select: { id: true } });
  return profile?.id ?? null;
}

async function getPrescriptionsAccessContext(req: any) {
  const organizationId = String(req.user?.organizationId ?? '').trim();
  if (!organizationId) throw badRequest('Organization scope is required');
  const role = String(req.user?.role ?? '').trim().toUpperCase();
  if (['COMPANY_ADMIN', 'COMPANY_SUPPORT', 'SUPER_ADMIN'].includes(role)) {
    const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }).catch(() => null);
    const organizationName = organization?.name ?? 'Organization';
    return {
      organizationId,
      organizationName,
      providerProfileId: null,
      providerName: req.user?.email ?? 'Privileged user',
      hspAccess: buildHspAccessSummary({ organizationId, organizationName, role }),
    };
  }
  return getProviderContext(req.user?.userId, req.user?.organizationId);
}

async function withPrescriptionLocations(items: any[], context: Awaited<ReturnType<typeof getPrescriptionsAccessContext>>) {
  const appointmentIds = Array.from(new Set(items.map((item) => String(item.appointmentId ?? '').trim()).filter(Boolean)));
  const appointments = appointmentIds.length
    ? await prisma.appointment.findMany({ where: { id: { in: appointmentIds }, organizationId: context.organizationId }, select: { id: true, location: true } })
    : [];
  const appointmentMap = new Map(appointments.map((item) => [item.id, item.location]));
  return items.map((item) => ({
    ...item,
    location: String(item.location ?? '').trim() || appointmentMap.get(String(item.appointmentId ?? '').trim()) || context.hspAccess.primaryFacility?.name || null,
  }));
}

async function withRefillLocations(items: any[], context: Awaited<ReturnType<typeof getPrescriptionsAccessContext>>) {
  const prescriptions = await withPrescriptionLocations(await listProviderWorkspaceItems('prescription', context.organizationId, context.providerProfileId), context);
  const prescriptionLocationMap = new Map(prescriptions.map((item) => [String(item.id), item.location ?? null]));
  return items.map((item) => ({
    ...item,
    location: String(item.location ?? '').trim() || prescriptionLocationMap.get(String(item.prescriptionId ?? '').trim()) || context.hspAccess.primaryFacility?.name || null,
  }));
}

async function resolvePrescriptionLocationHint(input: {
  context: Awaited<ReturnType<typeof getPrescriptionsAccessContext>>;
  patientId?: string | null;
  appointmentId?: string | null;
  explicitLocation?: string | null;
}) {
  const explicitLocation = String(input.explicitLocation ?? '').trim();
  if (explicitLocation) return explicitLocation;

  const appointmentId = String(input.appointmentId ?? '').trim();
  if (appointmentId) {
    const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId, organizationId: input.context.organizationId }, select: { location: true } }).catch(() => null);
    if (appointment?.location) return appointment.location;
  }

  const patientId = String(input.patientId ?? '').trim();
  if (patientId) {
    const latestAppointment = await prisma.appointment.findFirst({
      where: { organizationId: input.context.organizationId, patientId, providerId: input.context.providerProfileId ?? undefined },
      orderBy: { startsAt: 'desc' },
      select: { location: true },
    }).catch(() => null);
    if (latestAppointment?.location) return latestAppointment.location;
  }

  return input.context.hspAccess.primaryFacility?.name ?? null;
}


export const providerPrescriptionsRouter = Router();
const allowedRoles = ['PROVIDER', 'NURSE', 'PHARMACIST', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'SUPER_ADMIN'];
const complianceCheckSchema = z.object({ label: z.string(), detail: z.string(), status: z.string(), variant: z.string() });
const prescriptionSchema = z.object({
  id: z.string().optional(), patientId: z.string().min(2), patientName: z.string().min(2), appointmentId: z.string().optional(), drug: z.string().trim().min(2), dosage: z.string().trim().min(2), frequency: z.string().trim().min(2), duration: z.string().trim().min(2), complianceChecks: z.array(complianceCheckSchema).default([]), shortcuts: z.array(z.string()).default([]), note: z.string().trim().max(1000).optional(), controlledMedication: z.boolean().optional(), refillEligible: z.boolean().optional(), refillMaxCount: z.number().int().min(0).max(12).optional(), pharmacyName: z.string().trim().max(160).optional(), subjectProfileId: z.string().trim().min(2).optional(), subjectLabel: z.string().trim().min(2).max(120).optional(), subjectRelationship: z.string().trim().min(2).max(80).optional(),
});
const refillReviewSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'ROUTE_TO_PHARMACY', 'MARK_FULFILLED']),
  note: z.string().trim().max(500).optional(),
  queue: z.string().trim().max(120).optional(),
});
const refillAssignSchema = z.object({
  assignedRole: z.enum(['PROVIDER', 'PHARMACIST', 'NURSE']),
  ownerName: z.string().trim().max(120).optional(),
  queue: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
});

const refillEscalateSchema = z.object({
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  reason: z.string().trim().min(4).max(240),
  ownerRole: z.enum(['PROVIDER', 'PHARMACIST', 'NURSE']).optional(),
  note: z.string().trim().max(500).optional(),
});

function parseControlledOnly(value: unknown) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return null;
  if (['1', 'true', 'yes'].includes(normalized)) return true;
  if (['0', 'false', 'no'].includes(normalized)) return false;
  return null;
}

function buildRefillQueueSummary(items: any[]) {
  const base = summarizeRefillRequests(items);
  return {
    ...base,
    pending: items.filter((item) => ['ROUTED_TO_PROVIDER', 'ROUTED_TO_PHARMACY', 'APPROVED', 'MANUAL_REVIEW'].includes(String(item.status))).length,
    fulfilled: items.filter((item) => item.status === 'FULFILLED').length,
    rejected: items.filter((item) => item.status === 'REJECTED').length,
    escalated: items.filter((item) => Boolean(item.escalated)).length,
    reassigned: items.filter((item) => Boolean(item.assignedOwnerName)).length,
  };
}

providerPrescriptionsRouter.use(requireAuth);
providerPrescriptionsRouter.use(allowRoles(allowedRoles));
providerPrescriptionsRouter.get('/summary', async (req, res) => { const context = await getPrescriptionsAccessContext(req); const location = String(req.query.location ?? '').trim() || null; const enrichedItems = await withPrescriptionLocations(await listProviderWorkspaceItems('prescription', context.organizationId, context.providerProfileId), context); const items = filterItemsByHspDomainAndLocation(context.hspAccess, 'PRESCRIPTIONS', enrichedItems, (item) => item.location, location); const summary = { ...summarizeRefillRequests([]), total: items.length, byStatus: items.reduce((acc: Record<string, number>, item: any) => { acc[String(item.status ?? 'UNKNOWN')] = (acc[String(item.status ?? 'UNKNOWN')] ?? 0) + 1; return acc; }, {}) }; res.json({ summary, facilityBreakdown: summarizeHspItemsByFacility(context.hspAccess, 'PRESCRIPTIONS', enrichedItems, (item) => item.location), locationFilter: location, storageMode: getProviderWorkspaceStorageMode('prescription'), hspAccess: context.hspAccess }); });

providerPrescriptionsRouter.get('/compliance-preview', async (req, res) => {
  const drug = String(req.query.drug ?? '').trim();
  const pharmacyName = String(req.query.pharmacyName ?? '').trim();
  const sample = { drug, complianceChecks: [] as any[] };
  const controlledMedication = isControlledMedication(sample);
  const pharmacyRoutingState = controlledMedication ? 'PROVIDER_REVIEW' : pharmacyName ? 'PHARMACY_NETWORK' : 'MANUAL_REVIEW';
  const refillPolicy = {
    refillEligible: !controlledMedication,
    refillMaxCount: controlledMedication ? 0 : 2,
    refillWindowDays: controlledMedication ? 0 : 30,
    nextEligibleAt: null,
  };
  res.json({
    item: {
      drug,
      controlledMedication,
      requiresPolicyCheck: controlledMedication,
      pharmacyRoutingState,
      refillPolicy,
      guidance: controlledMedication
        ? ['Controlled medication detected.', 'Complete controlled-drug compliance review before signing.', 'Route refill requests to provider review instead of direct pharmacy routing.']
        : [pharmacyRoutingState === 'PHARMACY_NETWORK' ? 'Refill requests can route to the configured pharmacy network.' : 'No network pharmacy selected; refill requests will remain in manual review.', 'Confirm refill limits before signing.'],
    },
  });
});

providerPrescriptionsRouter.get('/items', async (req, res) => { const context = await getPrescriptionsAccessContext(req); const patientId = String(req.query.patientId ?? '').trim(); const subjectProfileId = String(req.query.subjectProfileId ?? '').trim(); const location = String(req.query.location ?? '').trim() || null; const items = filterItemsByHspDomainAndLocation(context.hspAccess, 'PRESCRIPTIONS', await withPrescriptionLocations((await listProviderWorkspaceItems('prescription', context.organizationId, context.providerProfileId)).filter((item) => (!patientId || item.patientId === patientId) && (!subjectProfileId || item.subjectProfileId === subjectProfileId)), context), (item) => item.location, location); res.json({ items, count: items.length, locationFilter: location, storageMode: getProviderWorkspaceStorageMode('prescription'), hspAccess: context.hspAccess }); });
providerPrescriptionsRouter.get('/items/:prescriptionId', async (req, res) => { const context = await getPrescriptionsAccessContext(req); const [item] = await withPrescriptionLocations([await getProviderWorkspaceItem('prescription', req.params.prescriptionId, context.organizationId, context.providerProfileId)], context); requireDomainScopedHspLocationAccess(context.hspAccess, 'PRESCRIPTIONS', item.location, 'Prescription location'); res.json({ item, storageMode: getProviderWorkspaceStorageMode('prescription'), hspAccess: context.hspAccess }); });
providerPrescriptionsRouter.get('/refill-requests', async (req, res) => {
  const patientId = String(req.query.patientId ?? '').trim() || null;
  const status = String(req.query.status ?? 'ALL').trim().toUpperCase() as any;
  const assignedRole = String(req.query.assignedRole ?? 'ALL').trim().toUpperCase() as any;
  const queue = String(req.query.queue ?? '').trim() || null;
  const agingBand = String(req.query.agingBand ?? 'ALL').trim().toUpperCase() as any;
  const controlledOnly = parseControlledOnly(req.query.controlledOnly);
  const context = await getPrescriptionsAccessContext(req);
  const location = String(req.query.location ?? '').trim() || null;
  const items = filterItemsByHspDomainAndLocation(context.hspAccess, 'PRESCRIPTIONS', await withRefillLocations(await listRefillRequests({ organizationId: req.user?.organizationId, patientId, status, assignedRole, queue, agingBand, controlledOnly }), context), (item) => item.location, location);
  const enrichedItems = items.map((item) => ({ ...item, agingBand: getRefillAgingBand(item) }));
  res.json({ items: enrichedItems, count: enrichedItems.length, locationFilter: location, summary: buildRefillQueueSummary(items as any[]), hspAccess: context.hspAccess });
});
providerPrescriptionsRouter.get('/pharmacy-queue', async (req, res) => {
  const assignedRole = String(req.query.assignedRole ?? 'PHARMACIST').trim().toUpperCase() as any;
  const status = String(req.query.status ?? 'ALL').trim().toUpperCase() as any;
  const queue = String(req.query.queue ?? '').trim() || null;
  const agingBand = String(req.query.agingBand ?? 'ALL').trim().toUpperCase() as any;
  const controlledOnly = parseControlledOnly(req.query.controlledOnly);
  const context = await getPrescriptionsAccessContext(req);
  const location = String(req.query.location ?? '').trim() || null;
  const items = filterItemsByHspDomainAndLocation(context.hspAccess, 'PRESCRIPTIONS', await withRefillLocations(await listRefillRequests({ organizationId: req.user?.organizationId, assignedRole, status, queue, agingBand, controlledOnly }), context), (item) => item.location, location);
  const summary = buildRefillQueueSummary(items as any[]);
  const enrichedItems = items.map((item) => ({ ...item, agingBand: getRefillAgingBand(item) }));
  res.json({ items: enrichedItems, count: enrichedItems.length, locationFilter: location, summary, hspAccess: context.hspAccess });
});
providerPrescriptionsRouter.get('/refill-queue-options', async (_req, res) => {
  res.json({
    assignedRoles: ['PROVIDER', 'PHARMACIST', 'NURSE'],
    queues: ['PROVIDER_REVIEW', 'PHARMACY_NETWORK', 'MANUAL_REVIEW', 'READY_FOR_FULFILLMENT'],
    escalationSeverities: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    agingBands: ['LT_24H', 'H24_TO_48H', 'GT_48H'],
  });
});

providerPrescriptionsRouter.get('/audit-packet-summary', async (req, res) => {
  const context = await getPrescriptionsAccessContext(req);
  const location = String(req.query.location ?? '').trim() || null;
  const packet = await buildRefillAuditPacket({ organizationId: context.organizationId, limit: Number.parseInt(String(req.query.limit ?? '50'), 10) });
  const latestFailedDeliveries = await listFailedReportDeliveryExecutions(context.organizationId, { limit: 5 });
  const accessibleRequests = filterItemsByHspDomainAndLocation(context.hspAccess, 'PRESCRIPTIONS', await withRefillLocations(await listRefillRequests({ organizationId: context.organizationId, status: 'ALL' as any }), context), (item) => item.location, location);
  res.json({
    summary: packet.summary,
    accessibleSummary: buildRefillQueueSummary(accessibleRequests as any[]),
    governanceNotes: packet.governanceNotes,
    locationFilter: location,
    facilityBreakdown: summarizeHspItemsByFacility(context.hspAccess, 'PRESCRIPTIONS', accessibleRequests as any[], (item: any) => item.location),
    latestFailedDeliveries: latestFailedDeliveries.map((item) => ({
      id: item.id,
      title: item.title,
      destination: item.destination ?? null,
      executedAt: item.executedAt,
      summary: item.summary,
    })),
    hspAccess: context.hspAccess,
  });
});


providerPrescriptionsRouter.get('/refill-requests/:requestId/history', async (req, res) => {
  const context = await getPrescriptionsAccessContext(req);
  const history = await getRefillRequestHistory(req.params.requestId);
  if (!history) throw badRequest('Refill request not found.');
  if (history.item.organizationId && req.user?.organizationId && history.item.organizationId !== req.user.organizationId) throw badRequest('Refill request is outside provider scope.');
  const [scopedItem] = await withRefillLocations([history.item], context);
  requireDomainScopedHspLocationAccess(context.hspAccess, 'PRESCRIPTIONS', scopedItem.location, 'Refill-request location');
  res.json({ ...history, item: scopedItem, hspAccess: context.hspAccess });
});

providerPrescriptionsRouter.post('/refill-requests/:requestId/assign', validateBody(refillAssignSchema), async (req, res) => {
  const context = await getPrescriptionsAccessContext(req);
  const history = await getRefillRequestHistory(req.params.requestId);
  if (!history) throw badRequest('Refill request not found.');
  const [scopedItem] = await withRefillLocations([history.item], context);
  requireDomainScopedHspLocationAccess(context.hspAccess, 'PRESCRIPTIONS', scopedItem.location, 'Refill-request location');
  const item = await assignRefillRequest(req.params.requestId, {
    assignedRole: req.body.assignedRole,
    ownerName: req.body.ownerName ?? null,
    queue: req.body.queue ?? null,
    note: req.body.note ?? null,
    actorUserId: req.user?.userId,
    actorRole: req.user?.role,
  });
  if (!item) throw badRequest('Refill request not found.');
  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId: req.user?.organizationId,
    action: 'provider.refill_request_assigned',
    resource: 'prescription_refill_request',
    resourceId: item.id,
    details: item,
  });
  await createRefillStatusNotification(item.organizationId ?? req.user?.organizationId ?? '', {
    id: item.id,
    patientId: item.patientId,
    prescriptionId: item.prescriptionId,
    status: item.status,
    fulfillmentStatus: item.fulfillmentStatus ?? null,
    queue: item.queue ?? null,
    pharmacyRoutingState: item.pharmacyRoutingState ?? null,
    note: item.note ?? null,
    decisionNote: item.decisionNote ?? null,
    controlledMedication: item.controlledMedication,
    updatedAt: item.updatedAt,
    agingBand: getRefillAgingBand(item),
    timelineCount: Array.isArray(item.timeline) ? item.timeline.length : 0,
    escalated: Boolean(item.escalated),
    escalationSeverity: item.escalationSeverity ?? null,
  }, req.user?.userId);
  res.json({ item: { ...item, location: scopedItem.location }, hspAccess: context.hspAccess });
});

providerPrescriptionsRouter.post('/refill-requests/:requestId/escalate', validateBody(refillEscalateSchema), async (req, res) => {
  const context = await getPrescriptionsAccessContext(req);
  const history = await getRefillRequestHistory(req.params.requestId);
  if (!history) throw badRequest('Refill request not found.');
  const [scopedItem] = await withRefillLocations([history.item], context);
  requireDomainScopedHspLocationAccess(context.hspAccess, 'PRESCRIPTIONS', scopedItem.location, 'Refill-request location');
  const item = await escalateRefillRequest(req.params.requestId, {
    severity: req.body.severity,
    reason: req.body.reason,
    ownerRole: req.body.ownerRole ?? null,
    note: req.body.note ?? null,
    actorUserId: req.user?.userId,
    actorRole: req.user?.role,
  });
  if (!item) throw badRequest('Refill request not found.');
  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId: req.user?.organizationId,
    action: 'provider.refill_request_escalated',
    resource: 'prescription_refill_request',
    resourceId: item.id,
    details: item,
  });
  await createRefillStatusNotification(item.organizationId ?? req.user?.organizationId ?? '', {
    id: item.id,
    patientId: item.patientId,
    prescriptionId: item.prescriptionId,
    status: item.status,
    fulfillmentStatus: item.fulfillmentStatus ?? null,
    queue: item.queue ?? null,
    pharmacyRoutingState: item.pharmacyRoutingState ?? null,
    note: item.note ?? null,
    decisionNote: item.decisionNote ?? null,
    controlledMedication: item.controlledMedication,
    updatedAt: item.updatedAt,
    agingBand: getRefillAgingBand(item),
    timelineCount: Array.isArray(item.timeline) ? item.timeline.length : 0,
    escalated: Boolean(item.escalated),
    escalationSeverity: item.escalationSeverity ?? null,
  }, req.user?.userId);
  res.json({ item: { ...item, location: scopedItem.location }, hspAccess: context.hspAccess });
});

providerPrescriptionsRouter.post('/refill-requests/:requestId/review', validateBody(refillReviewSchema), async (req, res) => {
  const context = await getPrescriptionsAccessContext(req);
  const history = await getRefillRequestHistory(req.params.requestId);
  if (!history) throw badRequest('Refill request not found.');
  const [scopedItem] = await withRefillLocations([history.item], context);
  requireDomainScopedHspLocationAccess(context.hspAccess, 'PRESCRIPTIONS', scopedItem.location, 'Refill-request location');
  const item = await reviewRefillRequest(req.params.requestId, {
    action: req.body.action,
    note: req.body.note ?? null,
    queue: req.body.queue ?? null,
    actorUserId: req.user?.userId,
    actorRole: req.user?.role,
  });
  if (!item) throw badRequest('Refill request not found.');
  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId: req.user?.organizationId,
    action: `provider.refill_request_${String(req.body.action).toLowerCase()}`,
    resource: 'prescription_refill_request',
    resourceId: item.id,
    details: item,
  });
  await createRefillStatusNotification(item.organizationId ?? req.user?.organizationId ?? '', {
    id: item.id,
    patientId: item.patientId,
    prescriptionId: item.prescriptionId,
    status: item.status,
    fulfillmentStatus: item.fulfillmentStatus ?? null,
    queue: item.queue ?? null,
    pharmacyRoutingState: item.pharmacyRoutingState ?? null,
    note: item.note ?? null,
    decisionNote: item.decisionNote ?? null,
    controlledMedication: item.controlledMedication,
    updatedAt: item.updatedAt,
    agingBand: getRefillAgingBand(item),
    timelineCount: Array.isArray(item.timeline) ? item.timeline.length : 0,
    escalated: Boolean(item.escalated),
    escalationSeverity: item.escalationSeverity ?? null,
  }, req.user?.userId);
  res.json({ item: { ...item, location: scopedItem.location }, hspAccess: context.hspAccess });
});
providerPrescriptionsRouter.post('/items', validateBody(prescriptionSchema), async (req, res) => { const context = await getPrescriptionsAccessContext(req); const appointment = req.body.appointmentId ? await prisma.appointment.findFirst({ where: { id: req.body.appointmentId, organizationId: context.organizationId }, select: { location: true } }).catch(() => null) : null; const appointmentSubject = req.body.appointmentId ? await getAppointmentSubjectMeta({ appointmentId: req.body.appointmentId, organizationId: context.organizationId, patientId: req.body.patientId }).catch(() => null) : null; const subject = await resolveProviderSubjectContext({ organizationId: context.organizationId, patientId: req.body.patientId, subjectProfileId: req.body.subjectProfileId ?? appointmentSubject?.subjectProfileId ?? null, subjectLabel: req.body.subjectLabel ?? appointmentSubject?.subjectLabel ?? null, subjectRelationship: req.body.subjectRelationship ?? appointmentSubject?.subjectRelationship ?? null }); const baseForCompliance = { ...req.body, patientId: subject.patientProfileId, patientName: subject.subjectLabel ?? subject.patientName }; const location = String(req.body.location ?? '').trim() || appointment?.location || context.hspAccess.primaryFacility?.name || null; requireDomainScopedHspLocationAccess(context.hspAccess, 'PRESCRIPTIONS', location, 'Prescription location'); const normalized = { ...baseForCompliance, location, subjectProfileId: subject.subjectProfileId, subjectLabel: subject.subjectLabel, subjectRelationship: subject.subjectRelationship, isFamilySubject: subject.isFamilySubject, controlledMedication: req.body.controlledMedication ?? isControlledMedication(baseForCompliance), refillEligible: req.body.refillEligible ?? !isControlledMedication(baseForCompliance), refillMaxCount: req.body.refillMaxCount ?? (isControlledMedication(baseForCompliance) ? 0 : 1) }; const item = await upsertProviderWorkspaceItem('prescription', normalized, { organizationId: context.organizationId, providerId: context.providerProfileId, actorId: req.user?.userId }); res.status(201).json({ item, storageMode: getProviderWorkspaceStorageMode('prescription'), hspAccess: context.hspAccess }); });
providerPrescriptionsRouter.post('/items/:prescriptionId/sign', async (req, res) => {
  const context = await getPrescriptionsAccessContext(req);
  const [existing] = await withPrescriptionLocations([await getProviderWorkspaceItem('prescription', req.params.prescriptionId, context.organizationId, context.providerProfileId)], context);
  requireDomainScopedHspLocationAccess(context.hspAccess, 'PRESCRIPTIONS', existing.location, 'Prescription location');
  validateControlledMedicationPolicy(existing);
  const controlledMedication = isControlledMedication(existing);
  const refillEligible = existing.refillEligible ?? !controlledMedication;
  const refillMaxCount = existing.refillMaxCount ?? (controlledMedication ? 0 : 1);
  const pharmacyRoutingState = controlledMedication ? 'PROVIDER_REVIEW' : existing.pharmacyName ? 'PHARMACY_NETWORK' : 'MANUAL_REVIEW';
  const item = await transitionProviderWorkspaceItem('prescription', req.params.prescriptionId, 'SIGNED', { organizationId: context.organizationId, providerId: context.providerProfileId, actorId: req.user?.userId }, String(req.body?.note ?? '').trim() || null);
  const patientProfileId = await getValidPatientProfileId(item.patientId, context.organizationId);
  if (!patientProfileId) throw badRequest('The selected patient could not be found. Reopen the prescription from a valid chart or appointment context.');
  if (item.subjectProfileId) {
    await upsertFamilyPrescriptionRelease({
      organizationId: context.organizationId,
      patientId: patientProfileId,
      subjectProfileId: item.subjectProfileId,
      actorId: req.user?.userId,
      prescriptionItem: { ...item, signedByName: context.providerName, controlledMedication, refillEligible, refillMaxCount, pharmacyRoutingState, fulfillmentStatus: pharmacyRoutingState === 'PHARMACY_NETWORK' ? 'READY_FOR_FULFILLMENT' : 'AWAITING_REVIEW' },
    });
  } else {
    await prisma.medicalRecord.create({ data: { patientId: patientProfileId, providerId: context.providerProfileId, appointmentId: item.appointmentId ?? null, summary: { title: 'Prescription signed', prescriptionId: item.id, recordType: 'PRESCRIPTION', releasedToPatient: true, signed: true }, content: { recordType: 'PRESCRIPTION', patientVisible: true, releasedToPatient: true, signed: true, prescriptionStatus: 'ACTIVE', drug: item.drug, dosage: item.dosage, frequency: item.frequency, duration: item.duration, note: item.note ?? req.body?.note ?? null, refillEligible, refillMaxCount, refillPolicy: { refillEligible, refillMaxCount, refillWindowDays: controlledMedication ? 0 : 30, nextEligibleAt: null }, pharmacyName: item.pharmacyName ?? null, pharmacyRoutingState, controlledMedication, controlledPolicyApproved: true, fulfillmentStatus: pharmacyRoutingState === 'PHARMACY_NETWORK' ? 'READY_FOR_FULFILLMENT' : 'AWAITING_REVIEW', fulfillmentTimeline: [{ at: new Date().toISOString(), label: 'Prescription signed', status: 'ACTIVE', note: 'Prescription was signed and released to the patient portal.' }] } } });
  }
  await writeAuditLog({ actorId: req.user?.userId, organizationId: context.organizationId, action: 'provider.prescription.signed', resource: 'prescription_draft', resourceId: item.id, details: { patientId: item.patientId ?? null, drug: item.drug ?? null, controlledMedication } });
  res.json({ item, storageMode: getProviderWorkspaceStorageMode('prescription'), hspAccess: context.hspAccess });
});
