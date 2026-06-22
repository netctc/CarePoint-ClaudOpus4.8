import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { badRequest } from '../../lib/http';
import { getProviderContext, formatPersonName } from '../../lib/provider-context';
import { getProviderWorkspaceStorageMode, getProviderWorkspaceItem, listProviderWorkspaceItems, summarizeProviderWorkspaceItems, transitionProviderWorkspaceItem, upsertProviderWorkspaceItem } from '../../lib/provider-workspace-store';
import { prisma } from '../../lib/prisma';
import { writeAuditLog } from '../../lib/audit';
import { getAppointmentSubjectMeta } from '../../lib/appointment-subject-store';
import { resolveProviderSubjectContext, upsertFamilyClinicalOrder } from '../../lib/family-subject-clinical-store';
import { filterItemsByHspDomainAndLocation, requireDomainScopedHspLocationAccess, summarizeHspItemsByFacility } from '../../lib/hsp-access';
async function getValidPatientProfileId(patientId: string | null | undefined, organizationId: string) {
  const normalized = String(patientId ?? '').trim();
  if (!normalized) return null;
  const profile = await prisma.patientProfile.findFirst({ where: { id: normalized, organizationId }, select: { id: true } });
  return profile?.id ?? null;
}

async function withOrderLocations(items: any[], context: Awaited<ReturnType<typeof getProviderContext>>) {
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

async function resolveOrderLocationHint(input: {
  context: Awaited<ReturnType<typeof getProviderContext>>;
  patientId?: string | null;
  appointmentId?: string | null;
  encounterId?: string | null;
  explicitLocation?: string | null;
}) {
  const explicitLocation = String(input.explicitLocation ?? '').trim();
  if (explicitLocation) return explicitLocation;

  const appointmentId = String(input.appointmentId ?? '').trim();
  if (appointmentId) {
    const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId, organizationId: input.context.organizationId }, select: { location: true } }).catch(() => null);
    if (appointment?.location) return appointment.location;
  }

  const encounterId = String(input.encounterId ?? '').trim();
  if (encounterId) {
    const encounterRecord = await prisma.medicalRecord.findFirst({ where: { id: encounterId, patientId: String(input.patientId ?? '').trim() || undefined }, include: { appointment: { select: { location: true } } } }).catch(() => null);
    if (encounterRecord?.appointment?.location) return encounterRecord.appointment.location;
  }

  const patientId = String(input.patientId ?? '').trim();
  if (patientId) {
    const latestAppointment = await prisma.appointment.findFirst({
      where: { organizationId: input.context.organizationId, patientId, providerId: input.context.providerProfileId },
      orderBy: { startsAt: 'desc' },
      select: { location: true },
    }).catch(() => null);
    if (latestAppointment?.location) return latestAppointment.location;
  }

  return input.context.hspAccess.primaryFacility?.name ?? null;
}


export const providerOrdersRouter = Router();
const allowedRoles = ['PROVIDER', 'NURSE'];

const orderSchema = z.object({
  id: z.string().optional(),
  patientId: z.string().min(2),
  patientName: z.string().min(2),
  encounterId: z.string().optional(),
  appointmentId: z.string().optional(),
  reason: z.string().trim().min(2),
  requestedBy: z.string().trim().min(2),
  orderGroups: z.array(z.object({ title: z.string(), description: z.string(), status: z.string(), variant: z.string() })).default([]),
  commonSelections: z.array(z.string()).default([]),
  location: z.string().trim().min(2).max(160).optional(),
  note: z.string().trim().max(1000).optional(),
  subjectProfileId: z.string().trim().min(2).optional(),
  subjectLabel: z.string().trim().min(2).max(120).optional(),
  subjectRelationship: z.string().trim().min(2).max(80).optional(),
});

providerOrdersRouter.use(requireAuth);
providerOrdersRouter.use(allowRoles(allowedRoles));

providerOrdersRouter.get('/summary', async (req, res) => {
  const context = await getProviderContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const location = String(req.query.location ?? '').trim() || null;
  const enrichedItems = await withOrderLocations(await listProviderWorkspaceItems('clinical_order', context.organizationId, context.providerProfileId), context);
  const items = filterItemsByHspDomainAndLocation(context.hspAccess, 'ORDERS', enrichedItems, (item) => item.location, location);
  const summary = items.reduce((acc: { total: number; byStatus: Record<string, number> }, item: any) => { acc.total += 1; acc.byStatus[String(item.status ?? 'UNKNOWN')] = (acc.byStatus[String(item.status ?? 'UNKNOWN')] ?? 0) + 1; return acc; }, { total: 0, byStatus: {} });
  res.json({ summary, facilityBreakdown: summarizeHspItemsByFacility(context.hspAccess, 'ORDERS', enrichedItems, (item) => item.location), locationFilter: location, storageMode: getProviderWorkspaceStorageMode('clinical_order'), hspAccess: context.hspAccess });
});

providerOrdersRouter.get('/composer-context', async (req, res) => {
  const context = await getProviderContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');

  const patientId = String(req.query.patientId ?? '').trim();
  const encounterId = String(req.query.encounterId ?? '').trim();
  const appointmentId = String(req.query.appointmentId ?? '').trim();

  const appointment = appointmentId
    ? await prisma.appointment.findFirst({
        where: { id: appointmentId, organizationId: context.organizationId, providerId: context.providerProfileId },
        include: { patient: { include: { user: true } } },
      })
    : null;
  requireDomainScopedHspLocationAccess(context.hspAccess, 'ORDERS', appointment?.location ?? context.hspAccess.primaryFacility?.name ?? null, 'Order-composer location');

  const records = patientId
    ? await prisma.medicalRecord.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' }, take: 3 })
    : appointment?.patientId
      ? await prisma.medicalRecord.findMany({ where: { patientId: appointment.patientId }, orderBy: { createdAt: 'desc' }, take: 3 })
      : [];

  const appointmentSubject = appointmentId && appointment?.patientId
    ? await getAppointmentSubjectMeta({ appointmentId, organizationId: context.organizationId, patientId: appointment.patientId }).catch(() => null)
    : null;
  res.json({
    item: {
      encounterId: encounterId || appointmentId || 'enc-live-context',
      patientId: patientId || appointment?.patientId || null,
      patientName: appointmentSubject?.subjectLabel ?? (appointment ? formatPersonName(appointment.patient?.user) : null),
      subjectProfileId: appointmentSubject?.subjectProfileId ?? null,
      subjectLabel: appointmentSubject?.subjectLabel ?? null,
      subjectRelationship: appointmentSubject?.subjectRelationship ?? null,
      reason: appointment?.service ?? 'Clinical follow-up',
      requestedBy: context.providerName,
      recentRecords: records.map((record) => ({ id: record.id, createdAt: record.createdAt, summary: record.summary })),
      commonSelections: ['Renal function panel', 'Electrolytes', 'Cardiology referral', 'Dietitian consult'],
    },
    storageMode: getProviderWorkspaceStorageMode('clinical_order'),
    hspAccess: context.hspAccess,
  });
});

providerOrdersRouter.get('/items', async (req, res) => {
  const context = await getProviderContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const patientId = String(req.query.patientId ?? '').trim();
  const subjectProfileId = String(req.query.subjectProfileId ?? '').trim();
  const status = String(req.query.status ?? '').trim().toUpperCase();
  const location = String(req.query.location ?? '').trim() || null;
  const items = filterItemsByHspDomainAndLocation(context.hspAccess, 'ORDERS', await withOrderLocations((await listProviderWorkspaceItems('clinical_order', context.organizationId, context.providerProfileId)).filter((item) => {
    if (patientId && item.patientId !== patientId) return false;
    if (subjectProfileId && item.subjectProfileId !== subjectProfileId) return false;
    if (status && item.status !== status) return false;
    return true;
  }), context), (item) => item.location, location);
  res.json({ items, count: items.length, locationFilter: location, storageMode: getProviderWorkspaceStorageMode('clinical_order'), hspAccess: context.hspAccess });
});

providerOrdersRouter.get('/items/:orderId', async (req, res) => {
  const context = await getProviderContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const [item] = await withOrderLocations([await getProviderWorkspaceItem('clinical_order', req.params.orderId, context.organizationId, context.providerProfileId)], context);
  requireDomainScopedHspLocationAccess(context.hspAccess, 'ORDERS', item.location, 'Clinical-order location');
  res.json({ item, storageMode: getProviderWorkspaceStorageMode('clinical_order'), hspAccess: context.hspAccess });
});

providerOrdersRouter.post('/items', validateBody(orderSchema), async (req, res) => {
  const context = await getProviderContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const appointmentSubject = req.body.appointmentId ? await getAppointmentSubjectMeta({ appointmentId: req.body.appointmentId, organizationId: context.organizationId, patientId: req.body.patientId }).catch(() => null) : null;
  const subject = await resolveProviderSubjectContext({ organizationId: context.organizationId, patientId: req.body.patientId, subjectProfileId: req.body.subjectProfileId ?? appointmentSubject?.subjectProfileId ?? null, subjectLabel: req.body.subjectLabel ?? appointmentSubject?.subjectLabel ?? null, subjectRelationship: req.body.subjectRelationship ?? appointmentSubject?.subjectRelationship ?? null });
  const location = await resolveOrderLocationHint({ context, patientId: subject.patientProfileId, appointmentId: req.body.appointmentId, encounterId: req.body.encounterId, explicitLocation: req.body.location ?? null });
  requireDomainScopedHspLocationAccess(context.hspAccess, 'ORDERS', location, 'Clinical-order location');
  const item = await upsertProviderWorkspaceItem('clinical_order', { ...req.body, location, patientId: subject.patientProfileId, patientName: subject.subjectLabel ?? subject.patientName, subjectProfileId: subject.subjectProfileId, subjectLabel: subject.subjectLabel, subjectRelationship: subject.subjectRelationship, isFamilySubject: subject.isFamilySubject }, {
    organizationId: context.organizationId,
    providerId: context.providerProfileId,
    actorId: req.user?.userId,
  });
  res.status(201).json({ item, storageMode: getProviderWorkspaceStorageMode('clinical_order'), hspAccess: context.hspAccess });
});

providerOrdersRouter.post('/items/:orderId/submit', async (req, res) => {
  const context = await getProviderContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const [existing] = await withOrderLocations([await getProviderWorkspaceItem('clinical_order', req.params.orderId, context.organizationId, context.providerProfileId)], context);
  requireDomainScopedHspLocationAccess(context.hspAccess, 'ORDERS', existing.location, 'Clinical-order location');
  const item = await transitionProviderWorkspaceItem('clinical_order', req.params.orderId, 'SUBMITTED', {
    organizationId: context.organizationId,
    providerId: context.providerProfileId,
    actorId: req.user?.userId,
  }, String(req.body?.note ?? '').trim() || null);

  const patientProfileId = await getValidPatientProfileId(item.patientId, context.organizationId);
  if (!patientProfileId) throw badRequest('The selected patient could not be found. Reopen the order from a valid chart or appointment context.');
  if (item.subjectProfileId) {
    await upsertFamilyClinicalOrder({
      organizationId: context.organizationId,
      patientId: patientProfileId,
      subjectProfileId: item.subjectProfileId,
      actorId: req.user?.userId,
      orderItem: item,
    });
  } else {
    await prisma.medicalRecord.create({
      data: {
        patientId: patientProfileId,
        providerId: context.providerProfileId,
        appointmentId: item.appointmentId ?? null,
        summary: { title: 'Clinical order submitted', orderId: item.id },
        content: {
          note: item.note ?? req.body?.note ?? null,
          selections: item.commonSelections ?? [],
          orderGroups: item.orderGroups ?? [],
        },
      },
    });
  }

  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId: context.organizationId,
    action: 'provider.order.submitted',
    resource: 'clinical_order',
    resourceId: item.id,
    details: { patientId: item.patientId ?? null, encounterId: item.encounterId ?? null },
  });

  res.json({ item, storageMode: getProviderWorkspaceStorageMode('clinical_order'), hspAccess: context.hspAccess });
});
