import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { badRequest } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { getProviderContext } from '../../lib/provider-context';
import { getProviderWorkspaceStorageMode, getProviderWorkspaceItem, listProviderWorkspaceItems, summarizeProviderWorkspaceItems, upsertProviderWorkspaceItem } from '../../lib/provider-workspace-store';
import { writeAuditLog } from '../../lib/audit';
import { upsertWorkflowItem } from '../../lib/admin-workflow-store';
import { filterItemsByHspDomainAndLocation, requireDomainScopedHspLocationAccess, summarizeHspItemsByFacility } from '../../lib/hsp-access';

export const providerRpmRouter = Router();
const allowedRoles = ['PROVIDER', 'NURSE'];

const outreachSchema = z.object({
  note: z.string().trim().min(2).max(1000),
  by: z.string().trim().min(2).optional(),
});

const escalateSchema = z.object({
  routeTo: z.enum(['PROVIDER_ALERT', 'SAFETY_CASE']).default('PROVIDER_ALERT'),
  note: z.string().trim().min(4).max(1000),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
});

providerRpmRouter.use(requireAuth);
providerRpmRouter.use(allowRoles(allowedRoles));

function buildAlertRecommendation(item: any) {
  const readings = Array.isArray(item.readings) ? item.readings : [];
  const alerting = readings.filter((reading: any) => ['warning', 'danger'].includes(String(reading.variant)));
  const highestVariant = alerting.some((reading: any) => String(reading.variant) === 'danger') ? 'danger' : (alerting.length ? 'warning' : 'success');
  const suggestedRoute = highestVariant === 'danger' ? 'SAFETY_CASE' : 'PROVIDER_ALERT';
  return {
    shouldEscalate: alerting.length > 0,
    highestVariant,
    suggestedRoute,
    reasons: alerting.map((reading: any) => `${reading.metric}: ${reading.value}`),
  };
}

async function withRpmLocations(items: any[], context: Awaited<ReturnType<typeof getProviderContext>>) {
  const patientIds = Array.from(new Set(items.map((item) => String(item.patientId ?? '').trim()).filter(Boolean)));
  const appointments = patientIds.length
    ? await getAppointmentLocationsForPatients(patientIds, context)
    : new Map<string, string | null>();
  return items.map((item) => ({
    ...item,
    location: String(item.location ?? item.facilityName ?? '').trim() || appointments.get(String(item.patientId ?? '').trim()) || context.hspAccess.primaryFacility?.name || null,
  }));
}

async function getAppointmentLocationsForPatients(patientIds: string[], context: Awaited<ReturnType<typeof getProviderContext>>) {
  const rows = await getRecentAppointmentLocations(patientIds, context);
  return new Map(rows.map((item) => [item.patientId, item.location]));
}

async function getRecentAppointmentLocations(patientIds: string[], context: Awaited<ReturnType<typeof getProviderContext>>) {
  const appointments = await prisma.appointment.findMany({
    where: { organizationId: context.organizationId, providerId: context.providerProfileId, patientId: { in: patientIds } },
    select: { patientId: true, location: true, startsAt: true },
    orderBy: { startsAt: 'desc' },
  }).catch(() => [] as Array<{ patientId: string; location: string | null; startsAt: Date }>);
  const seen = new Set<string>();
  return appointments.filter((item) => {
    if (seen.has(item.patientId)) return false;
    seen.add(item.patientId);
    return true;
  });
}

providerRpmRouter.get('/summary', async (req, res) => {
  const context = await getProviderContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const location = String(req.query.location ?? '').trim() || null;
  const enrichedItems = await withRpmLocations(await listProviderWorkspaceItems('rpm_enrollment', context.organizationId, context.providerProfileId), context);
  const items = filterItemsByHspDomainAndLocation(context.hspAccess, 'RPM', enrichedItems, (item) => item.location, location);
  const summary = items.reduce((acc: { total: number; byStatus: Record<string, number> }, item: any) => { acc.total += 1; acc.byStatus[String(item.status ?? 'UNKNOWN')] = (acc.byStatus[String(item.status ?? 'UNKNOWN')] ?? 0) + 1; return acc; }, { total: 0, byStatus: {} });
  const alertingCount = items.filter((item) => Array.isArray(item.readings) && item.readings.some((reading: any) => ['warning', 'danger'].includes(String(reading.variant)))).length;
  res.json({ summary: { ...summary, alertingCount }, facilityBreakdown: summarizeHspItemsByFacility(context.hspAccess, 'RPM', enrichedItems, (item) => item.location), locationFilter: location, storageMode: getProviderWorkspaceStorageMode('rpm_enrollment'), hspAccess: context.hspAccess });
});

providerRpmRouter.get('/patients', async (req, res) => {
  const context = await getProviderContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const location = String(req.query.location ?? '').trim() || null;
  const items = filterItemsByHspDomainAndLocation(context.hspAccess, 'RPM', await withRpmLocations(await listProviderWorkspaceItems('rpm_enrollment', context.organizationId, context.providerProfileId), context), (item) => item.location, location);
  res.json({
    items: items.map((item) => {
      const recommendation = buildAlertRecommendation(item);
      return {
        patientId: item.patientId,
        patientName: item.patientName,
        device: item.device,
        adherence: item.readings?.length ? `${Math.max(60, 100 - item.readings.length * 2)}% this week` : 'Pending sync',
        thresholdStatus: recommendation.shouldEscalate ? 'Alerting' : 'Within threshold',
        variant: recommendation.highestVariant === 'danger' ? 'danger' : recommendation.shouldEscalate ? 'warning' : 'success',
        latestReading: item.readings?.[0]?.value ? `${item.readings[0].value} • ${new Date(item.readings[0].time).toLocaleString()}` : 'No recent reading',
        alertRecommendation: recommendation,
      };
    }),
    facilityBreakdown: summarizeHspItemsByFacility(context.hspAccess, 'RPM', items as any[], (item: any) => item.location),
    locationFilter: location,
    storageMode: getProviderWorkspaceStorageMode('rpm_enrollment'),
    hspAccess: context.hspAccess,
  });
});

providerRpmRouter.get('/patients/:patientId', async (req, res) => {
  const context = await getProviderContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const items = await withRpmLocations(await listProviderWorkspaceItems('rpm_enrollment', context.organizationId, context.providerProfileId), context);
  const fallback = await getProviderWorkspaceItem('rpm_enrollment', req.params.patientId, context.organizationId, context.providerProfileId).catch(() => null);
  const item = items.find((entry) => entry.patientId === req.params.patientId) ?? (fallback ? (await withRpmLocations([fallback], context))[0] : null);
  if (!item) throw badRequest('RPM patient not found');
  requireDomainScopedHspLocationAccess(context.hspAccess, 'RPM', item.location, 'RPM patient location');
  res.json({ item: { ...item, alertRecommendation: buildAlertRecommendation(item) }, storageMode: getProviderWorkspaceStorageMode('rpm_enrollment'), hspAccess: context.hspAccess });
});

providerRpmRouter.post('/patients/:patientId/outreach', validateBody(outreachSchema), async (req, res) => {
  const context = await getProviderContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const items = await withRpmLocations(await listProviderWorkspaceItems('rpm_enrollment', context.organizationId, context.providerProfileId), context);
  const existing = items.find((entry) => entry.patientId === req.params.patientId);
  if (!existing) throw badRequest('RPM patient not found');
  requireDomainScopedHspLocationAccess(context.hspAccess, 'RPM', existing.location, 'RPM patient location');

  const updated = await upsertProviderWorkspaceItem('rpm_enrollment', {
    ...existing,
    outreachLog: [
      { time: new Date().toISOString(), by: req.body.by || context.providerName, note: req.body.note },
      ...(Array.isArray(existing.outreachLog) ? existing.outreachLog : []),
    ].slice(0, 20),
  }, {
    organizationId: context.organizationId,
    providerId: context.providerProfileId,
    actorId: req.user?.userId,
  });

  res.json({ item: updated, storageMode: getProviderWorkspaceStorageMode('rpm_enrollment'), hspAccess: context.hspAccess });
});

providerRpmRouter.post('/patients/:patientId/escalate', validateBody(escalateSchema), async (req, res) => {
  const context = await getProviderContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const items = await withRpmLocations(await listProviderWorkspaceItems('rpm_enrollment', context.organizationId, context.providerProfileId), context);
  const fallback = await getProviderWorkspaceItem('rpm_enrollment', req.params.patientId, context.organizationId, context.providerProfileId).catch(() => null);
  const existing = items.find((entry) => entry.patientId === req.params.patientId) ?? (fallback ? (await withRpmLocations([fallback], context))[0] : null);
  if (!existing) throw badRequest('RPM patient not found');
  requireDomainScopedHspLocationAccess(context.hspAccess, 'RPM', existing.location, 'RPM patient location');

  const recommendation = buildAlertRecommendation(existing);
  const severity = req.body.severity ?? (recommendation.highestVariant === 'danger' ? 'HIGH' : 'MEDIUM');
  const alert = await upsertProviderWorkspaceItem('provider_alert', {
    code: `ALT-RPM-${Date.now().toString().slice(-6)}`,
    title: `RPM threshold escalation for ${existing.patientName}`,
    status: 'OPEN',
    severity,
    patientId: existing.patientId,
    patientName: existing.patientName,
    queue: 'Clinical Alerts',
    summary: req.body.note,
    source: 'RPM',
    reasonCodes: recommendation.reasons,
    variant: recommendation.highestVariant,
  }, {
    organizationId: context.organizationId,
    providerId: context.providerProfileId,
    actorId: req.user?.userId,
  });

  let safetyCase: any = null;
  if (req.body.routeTo === 'SAFETY_CASE' || recommendation.highestVariant === 'danger') {
    safetyCase = await upsertWorkflowItem('safety', {
      code: `SAFE-RPM-${Date.now().toString().slice(-6)}`,
      title: `RPM escalation: ${existing.patientName}`,
      status: 'NEW',
      category: 'CLINICAL',
      severity,
      queue: 'Clinical Safety',
      patientImpact: 'Remote monitoring threshold exceeded',
      ownerName: null,
      summary: req.body.note,
      tags: ['rpm', existing.device ?? 'monitoring-device'],
      sourceType: 'RPM_ENROLLMENT',
      sourcePatientId: existing.patientId,
      sourcePatientName: existing.patientName,
    }, { organizationId: context.organizationId, actorId: req.user?.userId });
  }

  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId: context.organizationId,
    action: 'provider.rpm.escalated',
    resource: 'rpm_enrollment',
    resourceId: existing.patientId ?? req.params.patientId,
    details: {
      patientId: existing.patientId,
      patientName: existing.patientName,
      routeTo: req.body.routeTo,
      severity,
      providerAlertId: alert.id,
      safetyCaseId: safetyCase?.id ?? null,
      reasons: recommendation.reasons,
    },
  });

  res.json({
    item: { ...existing, alertRecommendation: recommendation },
    providerAlert: alert,
    safetyCase,
    storageMode: getProviderWorkspaceStorageMode('rpm_enrollment'),
    hspAccess: context.hspAccess,
  });
});
