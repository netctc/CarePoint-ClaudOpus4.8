import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { badRequest } from '../../lib/http';
import { getProviderContext } from '../../lib/provider-context';
import { prisma } from '../../lib/prisma';
import { writeAuditLog } from '../../lib/audit';
import { filterItemsByHspDomainAndLocation, summarizeHspItemsByFacility, requireDomainScopedHspLocationAccess } from '../../lib/hsp-access';
import { extractAuditSubjectContext } from '../../lib/audit-subject-context';
import { extractAuditFacilityContext, matchesAuditFacilityLocation, summarizeAuditItemsByFacility } from '../../lib/audit-facility-context';
import { formatSubjectSummary, matchesSubjectScope, normalizeSubjectScope, summarizeAuditSubjectContexts, summarizeExportItemsBySubject } from '../../lib/subject-reporting';

export const providerAnalyticsRouter = Router();
const allowedRoles = ['PROVIDER', 'NURSE'];

providerAnalyticsRouter.use(requireAuth);
providerAnalyticsRouter.use(allowRoles(allowedRoles));

providerAnalyticsRouter.get('/overview', async (req: any, res: any) => {
  const context = await getProviderContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const location = String(req.query.location ?? '').trim() || null;
  if (location) requireDomainScopedHspLocationAccess(context.hspAccess, 'ANALYTICS', location, 'Requested analytics facility');

  const [appointmentRowsRaw, paymentRowsRaw, threadRowsRaw] = await Promise.all([
    prisma.appointment.findMany({
      where: { organizationId: context.organizationId, providerId: context.providerProfileId },
      select: { id: true, patientId: true, status: true, location: true, telehealthSession: { select: { id: true } } },
    }),
    prisma.payment.findMany({
      where: { providerId: context.providerProfileId, status: { in: ['AUTHORIZED', 'CAPTURED'] } },
      select: { amountMinor: true, appointment: { select: { location: true, patientId: true } } },
    }),
    prisma.messageThread.findMany({ where: { organizationId: context.organizationId, providerId: context.providerProfileId }, select: { id: true, patientId: true } }),
  ]);
  const appointmentRows = appointmentRowsRaw as any[];
  const paymentRows = paymentRowsRaw as any[];
  const threadRows = threadRowsRaw as any[];
  const scopedAppointments = filterItemsByHspDomainAndLocation(context.hspAccess, 'ANALYTICS', appointmentRows, (item) => item.location, location);
  const accessiblePatientIds = new Set(scopedAppointments.map((item) => item.patientId).filter(Boolean));
  const scopedPayments = paymentRows.filter((item) => accessiblePatientIds.has(item.appointment?.patientId) && (!location || String(item.appointment?.location ?? '').toLowerCase().includes(location.toLowerCase())));
  const scopedThreads = threadRows.filter((item) => !item.patientId || accessiblePatientIds.has(item.patientId));
  const appointments = scopedAppointments.length;
  const completed = scopedAppointments.filter((item) => item.status === 'COMPLETED').length;
  const telehealth = scopedAppointments.filter((item) => Boolean(item.telehealthSession)).length;
  const revenueMinor = scopedPayments.reduce((sum, item) => sum + Number(item.amountMinor ?? 0), 0);
  const threads = scopedThreads.length;

  const utilization = [
    { label: 'Completed visits', value: completed },
    { label: 'Telehealth visits', value: telehealth },
    { label: 'Open threads', value: threads },
  ];
  const satisfaction = [
    { label: 'Completion rate', value: appointments ? Math.round((completed / appointments) * 100) : 0 },
    { label: 'Telehealth share', value: appointments ? Math.round((telehealth / appointments) * 100) : 0 },
    { label: 'Collection health', value: revenueMinor ? Math.min(100, Math.round(revenueMinor / 1000)) : 0 },
  ];

  res.json({
    metrics: [
      { label: 'Visits handled', value: String(appointments), detail: location ? `Appointments in ${location}` : 'Appointments in accessible facilities' },
      { label: 'Completed', value: String(completed), detail: 'Completed appointments in scope' },
      { label: 'Revenue captured', value: `$${(revenueMinor / 100).toFixed(2)}`, detail: 'Payments linked to scoped appointments' },
      { label: 'Inbox threads', value: String(threads), detail: 'Threads tied to patients in the scoped facility cohort' },
    ],
    utilization,
    satisfaction,
    facilityBreakdown: summarizeHspItemsByFacility(context.hspAccess, 'ANALYTICS', appointmentRows, (item) => item.location),
    locationFilter: location,
    hspAccess: context.hspAccess,
  });
});


function getRequestedSubjectScope(req: any) {
  return normalizeSubjectScope(req.query.subjectScope);
}

function providerAuditWhere(context: Awaited<ReturnType<typeof getProviderContext>>) {
  return {
    organizationId: context.organizationId,
    OR: [
      { actorId: context.user.id },
      { resourceId: context.providerProfileId },
    ],
  };
}

function mapProviderAudit(log: any, acknowledgedAuditIds: Set<string>) {
  return {
    id: log.id,
    action: log.action,
    resource: log.resource,
    resourceId: log.resourceId,
    details: log.details,
    subjectContext: extractAuditSubjectContext(log.details),
    createdAt: log.createdAt,
    actor: log.actor
      ? {
          id: log.actor.id,
          email: log.actor.email,
          name: `${log.actor.firstName ?? ''} ${log.actor.lastName ?? ''}`.trim(),
          role: log.actor.role,
        }
      : null,
    acknowledged: acknowledgedAuditIds.has(log.id),
  };
}

providerAnalyticsRouter.get('/compliance/summary', async (req: any, res: any) => {
  const context = await getProviderContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');

  const subjectScope = getRequestedSubjectScope(req);
  const location = String(req.query.location ?? '').trim() || null;
  if (location) requireDomainScopedHspLocationAccess(context.hspAccess, 'ANALYTICS', location, 'Requested compliance facility');
  const [auditCount, outstandingAlerts, threadCount, paymentCount, recentAuditLogs] = await Promise.all([
    prisma.auditLog.count({ where: providerAuditWhere(context) as any }),
    prisma.providerAlert.count({ where: { organizationId: context.organizationId, providerId: context.providerProfileId, status: { notIn: ['RESOLVED'] } } as any }).catch(() => 0),
    prisma.messageThread.count({ where: { organizationId: context.organizationId, providerId: context.providerProfileId } }),
    prisma.payment.count({ where: { providerId: context.providerProfileId } }),
    prisma.auditLog.findMany({ where: providerAuditWhere(context) as any, orderBy: { createdAt: 'desc' }, take: 200 }),
  ]);

  const acknowledged = await prisma.auditLog.count({
    where: {
      organizationId: context.organizationId,
      actorId: context.user.id,
      action: 'provider.audit_acknowledged',
      resource: 'audit_log',
    },
  });
  const filteredRecentLogs = recentAuditLogs
    .filter((item: any) => matchesSubjectScope(extractAuditSubjectContext(item.details), subjectScope))
    .filter((item: any) => matchesAuditFacilityLocation(item.details, location));
  const scopedAuditCount = filteredRecentLogs.length;

  res.json({
    summary: {
      providerName: context.providerName,
      providerProfileId: context.providerProfileId,
      organizationId: context.organizationId,
      auditEvents: scopedAuditCount,
      acknowledgedEvents: acknowledged,
      openPolicyItems: Math.max(scopedAuditCount - acknowledged, 0),
      messageThreads: threadCount,
      paymentsInScope: paymentCount,
      outstandingAlerts,
      subjectSummary: formatSubjectSummary(summarizeAuditSubjectContexts(filteredRecentLogs)),
      subjectScope,
      locationFilter: location,
      facilityBreakdown: summarizeAuditItemsByFacility(filteredRecentLogs, (item: any) => item.details),
      scopeIntegrity: { facilityTagged: filteredRecentLogs.filter((item: any) => Boolean(extractAuditFacilityContext(item.details, item.action, item.resource)?.location)).length, unscoped: filteredRecentLogs.filter((item: any) => !extractAuditFacilityContext(item.details, item.action, item.resource)?.location).length },
      hspAccess: context.hspAccess,
    },
  });
});

providerAnalyticsRouter.get('/compliance/logs', async (req: any, res: any) => {
  const context = await getProviderContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 200);
  const subjectScope = getRequestedSubjectScope(req);
  const location = String(req.query.location ?? '').trim() || null;
  if (location) requireDomainScopedHspLocationAccess(context.hspAccess, 'ANALYTICS', location, 'Requested compliance facility');
  const logs = await prisma.auditLog.findMany({
    where: providerAuditWhere(context) as any,
    include: {
      actor: {
        select: { id: true, email: true, firstName: true, lastName: true, role: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  const acknowledgements = await prisma.auditLog.findMany({
    where: {
      organizationId: context.organizationId,
      actorId: context.user.id,
      action: 'provider.audit_acknowledged',
      resource: 'audit_log',
      resourceId: { in: logs.map((item: any) => item.id) },
    },
    select: { resourceId: true },
  });
  const acknowledgedIds = new Set(acknowledgements.map((item: any) => item.resourceId).filter(Boolean) as string[]);
  const items = logs
    .map((item: any) => mapProviderAudit(item, acknowledgedIds))
    .filter((item: any) => matchesSubjectScope(item.subjectContext, subjectScope))
    .filter((item: any) => matchesAuditFacilityLocation(item.details, location));
  res.json({ items, count: items.length, subjectScope, locationFilter: location, facilityBreakdown: summarizeAuditItemsByFacility(items, (item: any) => item.details), hspAccess: context.hspAccess });
});

providerAnalyticsRouter.post('/compliance/logs/:auditId/acknowledge', async (req: any, res: any) => {
  const context = await getProviderContext(req.user?.userId, req.user?.organizationId);
  const auditId = String(req.params.auditId ?? '').trim();
  if (!auditId) throw badRequest('Audit event is required');
  await writeAuditLog({
    actorId: context.user.id,
    organizationId: context.organizationId,
    action: 'provider.audit_acknowledged',
    resource: 'audit_log',
    resourceId: auditId,
    details: { note: req.body?.note ?? null, providerProfileId: context.providerProfileId },
  });
  res.json({ ok: true, auditId });
});

providerAnalyticsRouter.get('/compliance/export', async (req: any, res: any) => {
  const context = await getProviderContext(req.user?.userId, req.user?.organizationId);
  const purpose = String(req.query.purpose ?? '').trim();
  const subjectScope = getRequestedSubjectScope(req);
  const location = String(req.query.location ?? '').trim() || null;
  if (location) requireDomainScopedHspLocationAccess(context.hspAccess, 'ANALYTICS', location, 'Requested compliance facility');
  if (!purpose) throw badRequest('Provider audit export requires a purpose parameter.');
  const format = String(req.query.format ?? 'json').trim().toLowerCase();
  const logs = await prisma.auditLog.findMany({
    where: providerAuditWhere(context) as any,
    include: {
      actor: {
        select: { id: true, email: true, firstName: true, lastName: true, role: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const watermark = {
    purpose,
    exportedAt: new Date().toISOString(),
    exportedBy: context.user.id,
    providerProfileId: context.providerProfileId,
  };
  const items = logs.map((item: any) => ({
    id: item.id,
    action: item.action,
    resource: item.resource,
    resourceId: item.resourceId,
    createdAt: item.createdAt,
    actorEmail: item.actor?.email ?? null,
    actorRole: item.actor?.role ?? null,
    details: item.details,
    subjectContext: extractAuditSubjectContext(item.details),
    exportPurpose: purpose,
    exportWatermark: `${watermark.exportedAt} | ${watermark.exportedBy}`,
  }));
  const filteredItems = items.filter((item: any) => matchesSubjectScope(item.subjectContext, subjectScope)).filter((item: any) => matchesAuditFacilityLocation(item.details, location));

  await writeAuditLog({
    actorId: context.user.id,
    organizationId: context.organizationId,
    action: 'provider.audit_exported',
    resource: 'audit_log',
    details: { ...watermark, subjectScope, location },
  });

  if (format === 'csv') {
    const header = ['id','createdAt','action','resource','resourceId','actorEmail','actorRole','subjectProfileId','subjectLabel','subjectRelationship','familySubject','exportPurpose','exportWatermark','details'];
    const rows = [header, ...filteredItems.map((item: any) => header.map((key) => {
      if (key === 'details') return JSON.stringify(item.details ?? {});
      if (key === 'subjectProfileId') return JSON.stringify(item.subjectContext?.subjectProfileId ?? '');
      if (key === 'subjectLabel') return JSON.stringify(item.subjectContext?.subjectLabel ?? '');
      if (key === 'subjectRelationship') return JSON.stringify(item.subjectContext?.subjectRelationship ?? '');
      if (key === 'familySubject') return JSON.stringify(String(Boolean(item.subjectContext?.isFamilySubject)));
      return JSON.stringify((item as any)[key] ?? '');
    }))];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="provider-compliance-${Date.now()}.csv"`);
    return res.send(rows.map((row) => row.join(',')).join('\n'));
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="provider-compliance-${Date.now()}.json"`);
  return res.send(JSON.stringify({ exportMetadata: { ...watermark, subjectScope, locationFilter: location, subjectSummary: summarizeExportItemsBySubject(filteredItems), facilityBreakdown: summarizeAuditItemsByFacility(filteredItems, (item: any) => item.details) }, items: filteredItems, count: filteredItems.length }, null, 2));
});
