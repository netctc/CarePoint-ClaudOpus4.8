import { Router } from 'express';
import { allowRoles } from '../../middleware/rbac';
import { requireAuth } from '../../middleware/auth';
import { badRequest, notFound } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { writeAuditLog } from '../../lib/audit';
import { extractAuditSubjectContext } from '../../lib/audit-subject-context';
import { extractAuditFacilityContext, matchesAuditFacilityLocation, summarizeAuditItemsByFacility } from '../../lib/audit-facility-context';
import { matchesSubjectScope, normalizeSubjectScope, summarizeExportItemsBySubject } from '../../lib/subject-reporting';

export const auditRouter = Router();
const auditRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'FINANCE'];

auditRouter.use(requireAuth);
auditRouter.use(allowRoles(auditRoles));

function buildAuditWhere(req: any) {
  const organizationId = req.user?.organizationId;
  const action = String(req.query.action ?? '').trim();
  const resource = String(req.query.resource ?? '').trim();
  const actorId = String(req.query.actorId ?? '').trim();
  const from = String(req.query.from ?? '').trim();
  const to = String(req.query.to ?? '').trim();

  const createdAt: Record<string, Date> = {};
  if (from) {
    createdAt.gte = new Date(from);
  }
  if (to) {
    createdAt.lte = new Date(to);
  }

  return {
    ...(organizationId ? { organizationId } : {}),
    ...(action ? { action } : {}),
    ...(resource ? { resource } : {}),
    ...(actorId ? { actorId } : {}),
    ...(Object.keys(createdAt).length ? { createdAt } : {}),
  };
}

function mapAuditItem(log: any) {
  const subjectContext = extractAuditSubjectContext(log.details);
  const facilityContext = extractAuditFacilityContext(log.details, log.action, log.resource);
  return {
    id: log.id,
    action: log.action,
    resource: log.resource,
    resourceId: log.resourceId,
    details: log.details,
    subjectContext,
    facilityContext,
    createdAt: log.createdAt,
    actor: log.actor
      ? {
          id: log.actor.id,
          email: log.actor.email,
          name: `${log.actor.firstName} ${log.actor.lastName}`.trim(),
          role: log.actor.role,
        }
      : null,
  };
}

async function fetchAuditLogs(req: any) {
  const q = String(req.query.q ?? '').trim().toLowerCase();
  const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 1000);

  const logs = await prisma.auditLog.findMany({
    where: buildAuditWhere(req),
    include: {
      actor: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const subjectScope = getRequestedSubjectScope(req);
  const location = String(req.query.location ?? '').trim() || null;
  return logs
    .map(mapAuditItem)
    .filter((item: any) => matchesSubjectScope(item.subjectContext, subjectScope))
    .filter((item: any) => matchesAuditFacilityLocation(item.details, location))
    .filter((item: any) => {
      if (!q) return true;
      return [
        item.action,
        item.resource,
        item.resourceId ?? '',
        item.actor?.email ?? '',
        item.actor?.name ?? '',
        item.subjectContext?.subjectLabel ?? '',
        item.subjectContext?.subjectRelationship ?? '',
        JSON.stringify(item.details ?? {}),
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
}


function getRequestedSubjectScope(req: any) {
  return normalizeSubjectScope(req.query.subjectScope);
}

function getExportPurpose(req: any) {
  return String(req.query.purpose ?? req.query.purposeOfUse ?? '').trim();
}

function buildWatermark(req: any, itemCount: number) {
  const purpose = getExportPurpose(req);
  if (!purpose) {
    throw badRequest('Audit export requires a purpose parameter.');
  }
  return {
    purpose,
    subjectScope: getRequestedSubjectScope(req),
    exportedAt: new Date().toISOString(),
    exportedBy: req.user?.userId ?? 'unknown',
    actorRole: req.user?.role ?? 'unknown',
    organizationId: req.user?.organizationId ?? null,
    itemCount,
  };
}

function toCsv(items: Array<Record<string, any>>) {
  const rows = [
    ['id', 'createdAt', 'action', 'resource', 'resourceId', 'actorEmail', 'actorName', 'actorRole', 'subjectProfileId', 'subjectLabel', 'subjectRelationship', 'familySubject', 'exportPurpose', 'exportWatermark', 'details'],
    ...items.map((item: any) => [
      item.id,
      item.createdAt instanceof Date ? item.createdAt.toISOString() : String(item.createdAt ?? ''),
      item.action,
      item.resource,
      item.resourceId ?? '',
      item.actor?.email ?? '',
      item.actor?.name ?? '',
      item.actor?.role ?? '',
      item.subjectContext?.subjectProfileId ?? '',
      item.subjectContext?.subjectLabel ?? '',
      item.subjectContext?.subjectRelationship ?? '',
      item.subjectContext?.isFamilySubject ? 'true' : 'false',
      item.exportPurpose ?? '',
      item.exportWatermark ?? '',
      JSON.stringify(item.details ?? {}),
    ]),
  ];

  return rows
    .map((row) =>
      row
        .map((value) => {
          const stringValue = String(value ?? '');
          return '"' + stringValue.replace(/"/g, '""') + '"';
        })
        .join(','),
    )
    .join('\n');
}

auditRouter.get('/logs', async (req: any, res: any) => {
  const items = await fetchAuditLogs(req);
  res.json({ items, count: items.length, facilityBreakdown: summarizeAuditItemsByFacility(items, (item: any) => item.details), locationFilter: String(req.query.location ?? '').trim() || null });
});

auditRouter.get('/export', async (req: any, res: any) => {
  const format = String(req.query.format ?? 'json').trim().toLowerCase();
  const items = await fetchAuditLogs(req);
  const watermark = buildWatermark(req, items.length);
  const exportedItems = items.map((item: any) => ({
    ...item,
    exportPurpose: watermark.purpose,
    exportWatermark: `${watermark.exportedAt} | ${watermark.exportedBy} | ${watermark.actorRole}`,
  }));

  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId: req.user?.organizationId,
    action: 'audit.exported',
    resource: 'audit_log',
    details: watermark,
  });

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-export-${Date.now()}.csv"`);
    return res.send(toCsv(exportedItems));
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="audit-export-${Date.now()}.json"`);
  return res.send(JSON.stringify({ exportMetadata: { ...watermark, locationFilter: String(req.query.location ?? '').trim() || null, subjectSummary: summarizeExportItemsBySubject(exportedItems), facilityBreakdown: summarizeAuditItemsByFacility(exportedItems, (item: any) => item.details) }, items: exportedItems, count: exportedItems.length }, null, 2));
});

auditRouter.get('/logs/:auditId', async (req: any, res: any) => {
  const log = await prisma.auditLog.findUnique({
    where: { id: req.params.auditId },
    include: {
      actor: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      },
    },
  });

  if (!log || (req.user?.organizationId && log.organizationId && log.organizationId !== req.user.organizationId)) {
    throw notFound('Audit log not found');
  }

  res.json(mapAuditItem(log));
});

auditRouter.get('/resources/:resource/:resourceId', async (req: any, res: any) => {
  const logs = await prisma.auditLog.findMany({
    where: {
      resource: req.params.resource,
      resourceId: req.params.resourceId,
      ...(req.user?.organizationId ? { organizationId: req.user.organizationId } : {}),
    },
    include: {
      actor: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  res.json({
    resource: req.params.resource,
    resourceId: req.params.resourceId,
    items: logs.map(mapAuditItem),
  });
});
