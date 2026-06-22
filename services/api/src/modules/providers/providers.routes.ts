import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { forbidden, notFound } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { writeAuditLog } from '../../lib/audit';
import {
  getOnboardingStorageMode,
  getStoredOnboardingState,
  listStoredOnboardingStates,
  upsertStoredOnboardingState,
} from '../../lib/provider-onboarding-store';
import { buildHspAccessSummary } from '../../lib/hsp-access';

export const providersRouter = Router();
const adminRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT'];
const onboardingActions = [
  'provider.onboarding.submitted',
  'provider.onboarding.approved',
  'provider.onboarding.rejected',
  'provider.onboarding.changes_requested',
] as const;

type ProviderProfileWithUser = Awaited<ReturnType<typeof getProviderProfileById>>;

providersRouter.use(requireAuth);

function normalizeText(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}


function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function providerServicesFromProfile(raw: unknown) {
  if (Array.isArray(raw)) return asStringArray(raw);
  if (raw && typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    const nestedServices = asStringArray(record.services);
    if (nestedServices.length) return nestedServices;
    const catalogCodes = asStringArray(record.serviceCatalogCodes);
    if (catalogCodes.length) return catalogCodes.map((code) => code.replace(/_/g, ' ').toLowerCase().split(' ').filter(Boolean).map((word) => word[0].toUpperCase() + word.slice(1)).join(' '));
  }
  return [] as string[];
}

function providerCareModesFromProfile(raw: unknown) {
  if (raw && typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    return asStringArray(record.careModes).map((mode) => mode.toUpperCase());
  }
  return [] as string[];
}

function providerLocationsFromProfile(raw: unknown, primaryFacility?: string | null) {
  const locations: string[] = [];
  if (raw && typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    locations.push(...asStringArray(record.locations));
  }
  if (primaryFacility) locations.push(primaryFacility);
  const careModes = providerCareModesFromProfile(raw);
  if (careModes.includes('TELEHEALTH') || careModes.includes('ONLINE')) locations.push('Virtual Care');
  return Array.from(new Set(locations.filter(Boolean)));
}

function providerServiceMode(raw: unknown) {
  const modes = providerCareModesFromProfile(raw);
  const hasTelehealth = modes.some((mode) => ['TELEHEALTH', 'ONLINE', 'VIRTUAL'].includes(mode));
  const hasInPerson = modes.some((mode) => ['IN_PERSON', 'IN-PERSON', 'CLINIC', 'FACILITY'].includes(mode));
  if (hasTelehealth && hasInPerson) return 'Both';
  if (hasTelehealth) return 'Online';
  if (hasInPerson) return 'In-Person';
  return 'In-Person';
}

function mapReviewStatus(action?: string) {
  switch (action) {
    case 'provider.onboarding.approved':
      return 'APPROVED';
    case 'provider.onboarding.rejected':
      return 'REJECTED';
    case 'provider.onboarding.changes_requested':
      return 'REQUEST_CHANGES';
    case 'provider.onboarding.submitted':
      return 'READY_FOR_REVIEW';
    default:
      return null;
  }
}

function buildChecklist(profile: NonNullable<ProviderProfileWithUser>) {
  const services = providerServicesFromProfile(profile.services);
  return {
    identityComplete: Boolean(profile.user.firstName && profile.user.lastName && profile.user.email),
    specialtyComplete: Boolean(profile.specialty),
    licenseComplete: Boolean(profile.licenseNumber),
    servicesComplete: services.length > 0,
  };
}

function deriveLifecycleStatus(profile: NonNullable<ProviderProfileWithUser>, latestAction?: string, storedStatus?: string | null) {
  if (storedStatus) {
    return storedStatus;
  }

  const reviewedStatus = mapReviewStatus(latestAction);
  if (reviewedStatus) {
    return reviewedStatus;
  }

  const checklist = buildChecklist(profile);
  const allComplete = Object.values(checklist).every(Boolean);
  return allComplete ? 'READY_FOR_REVIEW' : 'DRAFT';
}

async function getLatestOnboardingAuditMap(organizationId?: string) {
  const logs = await prisma.auditLog.findMany({
    where: {
      resource: 'provider_onboarding',
      ...(organizationId ? { organizationId } : {}),
      action: { in: [...onboardingActions] },
    },
    include: {
      actor: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }],
    take: 500,
  });

  const latest = new Map<string, (typeof logs)[number]>();
  for (const log of logs) {
    if (!log.resourceId || latest.has(log.resourceId)) continue;
    latest.set(log.resourceId, log);
  }
  return latest;
}

async function getProviderProfileById(providerId: string) {
  return prisma.providerProfile.findUnique({
    where: { id: providerId },
    include: {
      organization: { select: { name: true } },
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          createdAt: true,
        },
      },
      appointments: {
        select: {
          id: true,
          status: true,
          startsAt: true,
        },
        orderBy: { startsAt: 'desc' },
        take: 5,
      },
      payments: {
        select: {
          id: true,
          amountMinor: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  });
}

function mapProviderListItem(
  profile: NonNullable<ProviderProfileWithUser>,
  latestAudit?: Awaited<ReturnType<typeof getLatestOnboardingAuditMap>> extends Map<string, infer T> ? T : never,
  storedState?: any,
) {
  const services = providerServicesFromProfile(profile.services);
  const status = deriveLifecycleStatus(profile, latestAudit?.action, storedState?.status ?? null);
  const hspAccess = buildHspAccessSummary({
    organizationId: profile.organizationId,
    organizationName: (profile as any).organization?.name ?? null,
    role: profile.user.role,
    requestedFields: storedState?.requestedFields ?? null,
  });
  const locations = providerLocationsFromProfile(profile.services, hspAccess.primaryFacility?.name ?? null);

  return {
    id: profile.id,
    userId: profile.userId,
    name: `${profile.user.firstName} ${profile.user.lastName}`.trim(),
    email: profile.user.email,
    organizationName: (profile as any).organization?.name ?? null,
    role: profile.user.role,
    specialty: profile.specialty ?? 'Unassigned',
    licenseNumber: profile.licenseNumber,
    hspModel: hspAccess.accountModel,
    hspModelLabel: hspAccess.accountModelLabel,
    hspAccessScope: hspAccess.accessScope,
    hspAccessScopeLabel: hspAccess.accessScopeLabel,
    primaryFacility: hspAccess.primaryFacility?.name ?? null,
    consentScope: hspAccess.consentScope,
    services,
    serviceMode: providerServiceMode(profile.services),
    locations,
    nextAvailableLabel: profile.appointments[0]?.startsAt ? `Last scheduled ${profile.appointments[0].startsAt.toISOString()}` : 'No appointments scheduled',
    onboardingStatus: status,
    lastReviewAction: storedState?.lastAction ?? latestAudit?.action ?? null,
    lastReviewedAt: storedState?.reviewedAt ?? latestAudit?.createdAt ?? null,
    storageMode: getOnboardingStorageMode(),
  };
}

async function buildProviderDetail(providerId: string, organizationId?: string) {
  const profile = await getProviderProfileById(providerId);
  if (!profile || (organizationId && profile.organizationId !== organizationId)) {
    throw notFound('Provider not found');
  }

  const [history, latestMap, storedState] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        resource: 'provider_onboarding',
        resourceId: providerId,
        ...(organizationId ? { organizationId } : {}),
      },
      include: {
        actor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
    getLatestOnboardingAuditMap(organizationId),
    getStoredOnboardingState(providerId, organizationId),
  ]);

  const latestAudit = latestMap.get(providerId);
  const checklist = buildChecklist(profile);
  const status = deriveLifecycleStatus(profile, latestAudit?.action, storedState?.status ?? null);
  const hspAccess = buildHspAccessSummary({
    organizationId: profile.organizationId,
    organizationName: (profile as any).organization?.name ?? null,
    role: profile.user.role,
    requestedFields: storedState?.requestedFields ?? null,
  });

  return {
    id: profile.id,
    userId: profile.userId,
    profile: {
      name: `${profile.user.firstName} ${profile.user.lastName}`.trim(),
      email: profile.user.email,
      organizationName: (profile as any).organization?.name ?? null,
      role: profile.user.role,
      specialty: profile.specialty,
      licenseNumber: profile.licenseNumber,
      services: providerServicesFromProfile(profile.services),
      serviceMode: providerServiceMode(profile.services),
      locations: providerLocationsFromProfile(profile.services, hspAccess.primaryFacility?.name ?? null),
      joinedAt: profile.user.createdAt,
      hspModel: hspAccess.accountModel,
      hspModelLabel: hspAccess.accountModelLabel,
      hspAccessScope: hspAccess.accessScopeLabel,
      primaryFacility: hspAccess.primaryFacility?.name ?? null,
      consentScope: hspAccess.consentScopeLabel,
    },
    onboarding: {
      status,
      checklist,
      hspAccess,
      storageMode: getOnboardingStorageMode(),
      persistedState: storedState
        ? {
            status: storedState.status,
            submittedAt: storedState.submittedAt,
            reviewedAt: storedState.reviewedAt,
            decisionNote: storedState.decisionNote,
            requestedFields: storedState.requestedFields,
            lastAction: storedState.lastAction,
          }
        : null,
      latestReview: latestAudit
        ? {
            action: latestAudit.action,
            createdAt: latestAudit.createdAt,
            actor: latestAudit.actor
              ? {
                  id: latestAudit.actor.id,
                  name: `${latestAudit.actor.firstName} ${latestAudit.actor.lastName}`.trim(),
                  email: latestAudit.actor.email,
                  role: latestAudit.actor.role,
                }
              : null,
            details: latestAudit.details,
          }
        : null,
      history: history.map((log) => ({
        id: log.id,
        action: log.action,
        createdAt: log.createdAt,
        details: log.details,
        actor: log.actor
          ? {
              id: log.actor.id,
              name: `${log.actor.firstName} ${log.actor.lastName}`.trim(),
              email: log.actor.email,
              role: log.actor.role,
            }
          : null,
      })),
    },
    metrics: {
      recentAppointments: profile.appointments.length,
      recentPayments: profile.payments.length,
      completedAppointments: profile.appointments.filter((item) => item.status === 'COMPLETED').length,
    },
  };
}

async function persistOnboardingTransition(input: {
  providerId: string;
  organizationId?: string;
  actorId?: string;
  status: string;
  note?: string | null;
  requestedFields?: string[];
  action: string;
  checklist: Record<string, boolean>;
}) {
  if (!input.organizationId) {
    return null;
  }

  return upsertStoredOnboardingState({
    providerId: input.providerId,
    organizationId: input.organizationId,
    actorId: input.actorId,
    status: input.status,
    note: input.note,
    requestedFields: input.requestedFields,
    action: input.action,
    checklist: input.checklist,
  });
}

providersRouter.get('/', async (req, res) => {
  const query = normalizeText(req.query.q);
  const profiles = await prisma.providerProfile.findMany({
    where: req.user?.organizationId ? { organizationId: req.user.organizationId } : undefined,
    include: {
      organization: { select: { name: true } },
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          createdAt: true,
        },
      },
      appointments: {
        select: {
          startsAt: true,
        },
        orderBy: { startsAt: 'desc' },
        take: 1,
      },
    },
    orderBy: [{ specialty: 'asc' }, { id: 'asc' }],
  });

  const [latestAuditMap, storedStateMap] = await Promise.all([
    getLatestOnboardingAuditMap(req.user?.organizationId),
    listStoredOnboardingStates(profiles.map((profile) => profile.id), req.user?.organizationId),
  ]);

  const items = profiles
    .map((profile) => mapProviderListItem(profile as any, latestAuditMap.get(profile.id) as any, storedStateMap.get(profile.id)))
    .filter((item) => {
      if (!query) return true;
      return [item.name, item.specialty, item.email, ...item.services].join(' ').toLowerCase().includes(query);
    });

  res.json({ items, count: items.length });
});

providersRouter.get('/queue', allowRoles(adminRoles), async (req, res) => {
  const q = normalizeText(req.query.q);
  const statusFilter = String(req.query.status ?? '').trim().toUpperCase();

  const profiles = await prisma.providerProfile.findMany({
    where: req.user?.organizationId ? { organizationId: req.user.organizationId } : undefined,
    include: {
      organization: { select: { name: true } },
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          createdAt: true,
        },
      },
      appointments: {
        select: {
          startsAt: true,
        },
        orderBy: { startsAt: 'desc' },
        take: 1,
      },
    },
    orderBy: [{ id: 'asc' }],
  });

  const [latestAuditMap, storedStateMap] = await Promise.all([
    getLatestOnboardingAuditMap(req.user?.organizationId),
    listStoredOnboardingStates(profiles.map((profile) => profile.id), req.user?.organizationId),
  ]);

  const items = profiles
    .map((profile) => {
      const latestAudit = latestAuditMap.get(profile.id);
      const storedState = storedStateMap.get(profile.id);
      const checklist = buildChecklist(profile as any);
      const onboardingStatus = deriveLifecycleStatus(profile as any, latestAudit?.action, storedState?.status ?? null);
      return {
        ...mapProviderListItem(profile as any, latestAudit as any, storedState),
        checklist,
        submittedAt: storedState?.submittedAt ?? latestAudit?.createdAt ?? profile.user.createdAt,
        needsReview: ['READY_FOR_REVIEW', 'REQUEST_CHANGES'].includes(onboardingStatus),
      };
    })
    .filter((item) => {
      if (statusFilter && item.onboardingStatus !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return [item.name, item.specialty, item.email, item.onboardingStatus].join(' ').toLowerCase().includes(q);
    });

  const summary = (items as Array<{ onboardingStatus: string }>).reduce<Record<string, number>>((acc, item) => {
    acc[item.onboardingStatus] = (acc[item.onboardingStatus] ?? 0) + 1;
    return acc;
  }, {});

  res.json({ items, summary, count: items.length, storageMode: getOnboardingStorageMode() });
});

providersRouter.get('/queue/:providerId', allowRoles(adminRoles), async (req, res) => {
  const detail = await buildProviderDetail(req.params.providerId, req.user?.organizationId);
  res.json(detail);
});

providersRouter.post('/queue/:providerId/submit', allowRoles(adminRoles), async (req, res) => {
  const detail = await buildProviderDetail(req.params.providerId, req.user?.organizationId);

  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId: req.user?.organizationId,
    action: 'provider.onboarding.submitted',
    resource: 'provider_onboarding',
    resourceId: detail.id,
    details: {
      note: req.body?.note ?? null,
      source: 'admin_queue',
      storageMode: getOnboardingStorageMode(),
    },
  });

  await persistOnboardingTransition({
    providerId: detail.id,
    organizationId: req.user?.organizationId,
    actorId: req.user?.userId,
    status: 'READY_FOR_REVIEW',
    note: req.body?.note ?? null,
    action: 'provider.onboarding.submitted',
    checklist: detail.onboarding.checklist,
  });

  res.status(202).json(await buildProviderDetail(req.params.providerId, req.user?.organizationId));
});

providersRouter.post('/queue/:providerId/approve', allowRoles(adminRoles), async (req, res) => {
  const detail = await buildProviderDetail(req.params.providerId, req.user?.organizationId);

  if (!Object.values(detail.onboarding.checklist).every(Boolean)) {
    throw forbidden('Provider cannot be approved until all onboarding checklist items are complete');
  }

  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId: req.user?.organizationId,
    action: 'provider.onboarding.approved',
    resource: 'provider_onboarding',
    resourceId: detail.id,
    details: {
      note: req.body?.note ?? null,
      approvedBy: req.user?.role,
      storageMode: getOnboardingStorageMode(),
    },
  });

  await persistOnboardingTransition({
    providerId: detail.id,
    organizationId: req.user?.organizationId,
    actorId: req.user?.userId,
    status: 'APPROVED',
    note: req.body?.note ?? null,
    action: 'provider.onboarding.approved',
    checklist: detail.onboarding.checklist,
  });

  res.json(await buildProviderDetail(req.params.providerId, req.user?.organizationId));
});

providersRouter.post('/queue/:providerId/request-changes', allowRoles(adminRoles), async (req, res) => {
  const detail = await buildProviderDetail(req.params.providerId, req.user?.organizationId);
  const requestedFields = Array.isArray(req.body?.requestedFields) ? req.body.requestedFields.map(String) : [];

  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId: req.user?.organizationId,
    action: 'provider.onboarding.changes_requested',
    resource: 'provider_onboarding',
    resourceId: detail.id,
    details: {
      note: req.body?.note ?? null,
      requestedFields,
      storageMode: getOnboardingStorageMode(),
    },
  });

  await persistOnboardingTransition({
    providerId: detail.id,
    organizationId: req.user?.organizationId,
    actorId: req.user?.userId,
    status: 'REQUEST_CHANGES',
    note: req.body?.note ?? null,
    requestedFields,
    action: 'provider.onboarding.changes_requested',
    checklist: detail.onboarding.checklist,
  });

  res.json(await buildProviderDetail(req.params.providerId, req.user?.organizationId));
});

providersRouter.post('/queue/:providerId/reject', allowRoles(adminRoles), async (req, res) => {
  const detail = await buildProviderDetail(req.params.providerId, req.user?.organizationId);

  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId: req.user?.organizationId,
    action: 'provider.onboarding.rejected',
    resource: 'provider_onboarding',
    resourceId: detail.id,
    details: {
      note: req.body?.note ?? null,
      reasonCode: req.body?.reasonCode ?? null,
      storageMode: getOnboardingStorageMode(),
    },
  });

  await persistOnboardingTransition({
    providerId: detail.id,
    organizationId: req.user?.organizationId,
    actorId: req.user?.userId,
    status: 'REJECTED',
    note: req.body?.note ?? null,
    action: 'provider.onboarding.rejected',
    checklist: detail.onboarding.checklist,
  });

  res.json(await buildProviderDetail(req.params.providerId, req.user?.organizationId));
});

providersRouter.get('/:providerId', allowRoles(adminRoles), async (req, res) => {
  const detail = await buildProviderDetail(req.params.providerId, req.user?.organizationId);
  res.json(detail);
});
