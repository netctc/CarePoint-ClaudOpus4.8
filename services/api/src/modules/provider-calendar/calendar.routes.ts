import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { badRequest } from '../../lib/http';
import { filterItemsByHspDomain, requireDomainScopedHspLocationAccess, resolveHspAccessForProvider } from '../../lib/hsp-access';
import { prisma } from '../../lib/prisma';
import { getProviderContext, formatPersonName } from '../../lib/provider-context';
import { getProviderWorkspaceStorageMode, getProviderWorkspaceItem, listProviderWorkspaceItems, summarizeProviderWorkspaceItems, transitionProviderWorkspaceItem, upsertProviderWorkspaceItem } from '../../lib/provider-workspace-store';
import { cancelPublishedSlot, createManualPublishedSlot, ensurePublishedTemplateSlotsForProvider, getProviderPublishedSlots, publishTemplateSlotsFromWorkspace, updateManualPublishedSlot } from '../../lib/scheduling-store';

export const providerCalendarRouter = Router();
const allowedRoles = ['PROVIDER', 'NURSE', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'SUPER_ADMIN'];

const manualPublishedSlotSchema = z.object({
  service: z.string().trim().min(2),
  location: z.string().trim().min(2),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  capacity: z.number().int().positive().max(20).default(1),
});

const templateSchema = z.object({
  id: z.string().optional(),
  templateName: z.string().trim().min(2),
  durationMinutes: z.number().int().positive().max(480),
  bufferMinutes: z.number().int().min(0).max(120),
  capacity: z.number().int().positive().max(20),
  service: z.string().trim().min(2),
  location: z.string().trim().min(2),
  serviceModes: z.array(z.string()).default([]),
  pattern: z.array(z.object({ day: z.string().min(2), hours: z.string().min(2) })).default([]),
  note: z.string().trim().max(500).optional(),
});


type ProviderCalendarScope = {
  organizationId?: string;
  organizationName?: string;
  providerProfileId?: string;
  providerName?: string;
  specialty?: string | null;
  licenseNumber?: string | null;
};

async function resolveProviderCalendarScope(req: any): Promise<ProviderCalendarScope> {
  const role = String(req.user?.role ?? '').toUpperCase();
  if (role === 'PROVIDER' || role === 'NURSE') {
    return getProviderContext(req.user?.userId, req.user?.organizationId);
  }

  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');

  const requestedProviderId = String(req.query.providerId ?? req.body?.providerId ?? '').trim();
  const provider = await prisma.providerProfile.findFirst({
    where: requestedProviderId
      ? { id: requestedProviderId, organizationId }
      : { organizationId },
    include: { user: true },
    orderBy: requestedProviderId ? undefined : { userId: 'asc' },
  });

  if (!provider) throw badRequest('A providerId is required for this calendar scope.');

  return {
    organizationId,
    organizationName: provider.user?.organizationId ? undefined : 'Organization',
    providerProfileId: provider.id,
    providerName: `${provider.user?.firstName ?? ''} ${provider.user?.lastName ?? ''}`.trim() || provider.user?.email || 'Provider',
    specialty: provider.specialty ?? null,
    licenseNumber: provider.licenseNumber ?? null,
  };
}

providerCalendarRouter.use(requireAuth);
providerCalendarRouter.use(allowRoles(allowedRoles));

async function resolveCalendarHspAccess(context: ProviderCalendarScope, role?: string | null) {
  return resolveHspAccessForProvider({
    providerProfileId: context.providerProfileId,
    organizationId: context.organizationId,
    organizationName: context.organizationName,
    role,
  });
}


providerCalendarRouter.get('/overview', async (req, res) => {
  const context = await resolveProviderCalendarScope(req);
  if (!context.organizationId || !context.providerProfileId) throw badRequest('Organization and provider scope are required');

  await ensurePublishedTemplateSlotsForProvider({ organizationId: context.organizationId, providerId: context.providerProfileId });
  const hspAccess = await resolveCalendarHspAccess(context, req.user?.role);

  const appointments = (await prisma.appointment.findMany({
    where: {
      organizationId: context.organizationId,
      providerId: context.providerProfileId,
      startsAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    orderBy: { startsAt: 'asc' },
    take: 60,
    include: { patient: { include: { user: true } }, telehealthSession: true },
  })) as any[];

  const publishedSlots = await getProviderPublishedSlots({
    organizationId: context.organizationId,
    providerId: context.providerProfileId,
    startsAt: new Date(),
    endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  const scopedAppointments = filterItemsByHspDomain(hspAccess, 'CALENDAR', appointments, (item) => item.location);
  const scopedPublishedSlots = filterItemsByHspDomain(hspAccess, 'CALENDAR', publishedSlots, (item) => item.location);
  const facilities = Array.from(new Set([
    ...scopedAppointments.map((item) => item.location).filter(Boolean),
    ...scopedPublishedSlots.map((item) => item.location).filter(Boolean),
  ])).sort();

  const days = scopedAppointments.reduce<Record<string, any[]>>((acc, item) => {
    const key = item.startsAt.toISOString().slice(0, 10);
    acc[key] ??= [];
    acc[key].push({
      id: item.id,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      patientName: formatPersonName(item.patient?.user),
      service: item.service,
      location: item.location,
      modality: item.telehealthSession ? 'TELEHEALTH' : 'IN_PERSON',
      status: item.status,
      kind: 'appointment',
    });
    return acc;
  }, {});

  for (const slot of scopedPublishedSlots) {
    const key = slot.startsAt.slice(0, 10);
    days[key] ??= [];
    days[key].push({
      id: slot.id,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      patientName: null,
      service: slot.service,
      location: slot.location,
      modality: slot.modality,
      status: slot.statusLabel,
      availableCount: slot.availableCount,
      activeHoldCount: slot.activeHoldCount,
      kind: 'slot',
    });
  }

  (Object.values(days) as any[]).forEach((entries: any[]) => entries.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()));

  res.json({
    providerId: context.providerProfileId,
    summary: {
      upcomingCount: scopedAppointments.filter((item) => item.startsAt >= new Date()).length,
      telehealthCount: scopedAppointments.filter((item) => Boolean(item.telehealthSession)).length,
      facilityCount: facilities.length,
      templateSummary: await summarizeProviderWorkspaceItems('schedule_template', context.organizationId, context.providerProfileId),
      publishedSlotCount: scopedPublishedSlots.length,
      availableSlotCount: scopedPublishedSlots.reduce((total, item) => total + item.availableCount, 0),
      heldSlotCount: scopedPublishedSlots.filter((item) => item.activeHoldCount > 0).length,
    },
    facilities,
    days,
    publishedSlots: scopedPublishedSlots,
    hspAccess,
  });
});

providerCalendarRouter.get('/availability', async (req, res) => {
  const context = await resolveProviderCalendarScope(req);
  if (!context.organizationId || !context.providerProfileId) throw badRequest('Organization and provider scope are required');
  const hspAccess = await resolveCalendarHspAccess(context, req.user?.role);
  const days = Math.min(Math.max(Number(req.query.days ?? 14), 1), 21);
  const service = String(req.query.service ?? '').trim() || undefined;
  const location = String(req.query.location ?? '').trim() || undefined;
  if (location) requireDomainScopedHspLocationAccess(hspAccess, 'CALENDAR', location, 'Requested calendar location');
  const items = await getProviderPublishedSlots({
    organizationId: context.organizationId,
    providerId: context.providerProfileId,
    service,
    location,
    startsAt: new Date(),
    endsAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
  });
  const scopedItems = filterItemsByHspDomain(hspAccess, 'CALENDAR', items, (item) => item.location);
  res.json({ items: scopedItems, count: scopedItems.length, hspAccess });
});

providerCalendarRouter.get('/published-slots', async (req, res) => {
  const context = await resolveProviderCalendarScope(req);
  if (!context.organizationId || !context.providerProfileId) throw badRequest('Organization and provider scope are required');
  const hspAccess = await resolveCalendarHspAccess(context, req.user?.role);
  const days = Math.min(Math.max(Number(req.query.days ?? 14), 1), 30);
  const items = await getProviderPublishedSlots({
    organizationId: context.organizationId,
    providerId: context.providerProfileId,
    startsAt: new Date(),
    endsAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
  });
  const scopedItems = filterItemsByHspDomain(hspAccess, 'CALENDAR', items, (item) => item.location);
  res.json({ items: scopedItems, count: scopedItems.length, hspAccess });
});

providerCalendarRouter.post('/published-slots', validateBody(manualPublishedSlotSchema), async (req, res) => {
  const context = await resolveProviderCalendarScope(req);
  if (!context.organizationId || !context.providerProfileId) throw badRequest('Organization and provider scope are required');
  const hspAccess = await resolveCalendarHspAccess(context, req.user?.role);
  requireDomainScopedHspLocationAccess(hspAccess, 'CALENDAR', req.body.location, 'Published-slot location');
  const item = await createManualPublishedSlot({
    organizationId: context.organizationId,
    providerId: context.providerProfileId,
    actorId: req.user?.userId,
    service: req.body.service,
    location: req.body.location,
    startsAt: new Date(req.body.startsAt),
    endsAt: new Date(req.body.endsAt),
    capacity: req.body.capacity,
  });
  res.status(201).json({ item, hspAccess });
});

providerCalendarRouter.patch('/published-slots/:slotId', validateBody(manualPublishedSlotSchema.partial()), async (req, res) => {
  const context = await resolveProviderCalendarScope(req);
  if (!context.organizationId || !context.providerProfileId) throw badRequest('Organization and provider scope are required');
  const hspAccess = await resolveCalendarHspAccess(context, req.user?.role);
  if (req.body.location) requireDomainScopedHspLocationAccess(hspAccess, 'CALENDAR', req.body.location, 'Published-slot location');
  const item = await updateManualPublishedSlot({
    slotId: req.params.slotId,
    organizationId: context.organizationId,
    providerId: context.providerProfileId,
    actorId: req.user?.userId,
    service: req.body.service,
    location: req.body.location,
    startsAt: req.body.startsAt ? new Date(req.body.startsAt) : undefined,
    endsAt: req.body.endsAt ? new Date(req.body.endsAt) : undefined,
    capacity: req.body.capacity,
  });
  res.json({ item, hspAccess });
});

providerCalendarRouter.post('/published-slots/:slotId/cancel', async (req, res) => {
  const context = await resolveProviderCalendarScope(req);
  if (!context.organizationId || !context.providerProfileId) throw badRequest('Organization and provider scope are required');
  const item = await cancelPublishedSlot({
    slotId: req.params.slotId,
    organizationId: context.organizationId,
    providerId: context.providerProfileId,
    actorId: req.user?.userId,
    note: String(req.body?.note ?? '').trim() || undefined,
  });
  res.json({ item });
});

providerCalendarRouter.get('/templates', async (req, res) => {
  const context = await resolveProviderCalendarScope(req);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const hspAccess = await resolveCalendarHspAccess(context, req.user?.role);

  const q = String(req.query.q ?? '').trim().toLowerCase();
  const status = String(req.query.status ?? '').trim().toUpperCase();
  const templateRows = await listProviderWorkspaceItems('schedule_template', context.organizationId, context.providerProfileId);
  const items = filterItemsByHspDomain(hspAccess, 'CALENDAR', templateRows as any[], (item) => item.location).filter((item) => {
    if (status && item.status !== status) return false;
    if (!q) return true;
    return [item.templateName, item.service, item.location, ...(Array.isArray(item.serviceModes) ? item.serviceModes : [])].join(' ').toLowerCase().includes(q);
  });

  res.json({ items, count: items.length, storageMode: getProviderWorkspaceStorageMode('schedule_template'), hspAccess });
});

providerCalendarRouter.get('/templates/:templateId', async (req, res) => {
  const context = await resolveProviderCalendarScope(req);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const hspAccess = await resolveCalendarHspAccess(context, req.user?.role);
  const item = await getProviderWorkspaceItem('schedule_template', req.params.templateId, context.organizationId, context.providerProfileId);
  requireDomainScopedHspLocationAccess(hspAccess, 'CALENDAR', item.location, 'Template location');
  res.json({ item, storageMode: getProviderWorkspaceStorageMode('schedule_template'), hspAccess });
});

providerCalendarRouter.post('/templates', validateBody(templateSchema), async (req, res) => {
  const context = await resolveProviderCalendarScope(req);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const hspAccess = await resolveCalendarHspAccess(context, req.user?.role);
  requireDomainScopedHspLocationAccess(hspAccess, 'CALENDAR', req.body.location, 'Template location');
  const item = await upsertProviderWorkspaceItem('schedule_template', req.body, {
    organizationId: context.organizationId,
    providerId: context.providerProfileId,
    actorId: req.user?.userId,
  });
  res.status(201).json({ item, storageMode: getProviderWorkspaceStorageMode('schedule_template'), hspAccess });
});

providerCalendarRouter.put('/templates/:templateId', validateBody(templateSchema.partial().extend({ id: z.string().optional() })), async (req, res) => {
  const context = await resolveProviderCalendarScope(req);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const hspAccess = await resolveCalendarHspAccess(context, req.user?.role);
  if (req.body.location) requireDomainScopedHspLocationAccess(hspAccess, 'CALENDAR', req.body.location, 'Template location');
  const item = await upsertProviderWorkspaceItem('schedule_template', { ...req.body, id: req.params.templateId }, {
    organizationId: context.organizationId,
    providerId: context.providerProfileId,
    actorId: req.user?.userId,
  });
  res.json({ item, storageMode: getProviderWorkspaceStorageMode('schedule_template'), hspAccess });
});

providerCalendarRouter.post('/templates/:templateId/publish', async (req, res) => {
  const context = await resolveProviderCalendarScope(req);
  if (!context.organizationId || !context.providerProfileId) throw badRequest('Organization and provider scope are required');
  const hspAccess = await resolveCalendarHspAccess(context, req.user?.role);
  const existingTemplate = await getProviderWorkspaceItem('schedule_template', req.params.templateId, context.organizationId, context.providerProfileId);
  requireDomainScopedHspLocationAccess(hspAccess, 'CALENDAR', existingTemplate.location, 'Template location');
  const item = await transitionProviderWorkspaceItem('schedule_template', req.params.templateId, 'PUBLISHED', {
    organizationId: context.organizationId,
    providerId: context.providerProfileId,
    actorId: req.user?.userId,
  }, String(req.body?.note ?? '').trim() || null);
  const publishResult = await publishTemplateSlotsFromWorkspace({
    organizationId: context.organizationId,
    providerId: context.providerProfileId,
    actorId: req.user?.userId,
    template: item,
  });
  res.json({ item, publishResult, storageMode: getProviderWorkspaceStorageMode('schedule_template'), hspAccess });
});
