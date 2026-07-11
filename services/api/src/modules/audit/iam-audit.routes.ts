import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { iamMiddlewareChain } from '../../middleware/rbac';
import { badRequest, notFound } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { auditExportSchema } from '../iam/schemas';

export const iamAuditRouter = Router();

/**
 * Query parameter schema for `GET /api/admin/audit`
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.9
 */
const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(50),
  action: z.string().trim().optional(),
  resource: z.string().trim().optional(),
  actor: z.string().trim().optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  organizationId: z.string().trim().optional(),
});

// Apply IAM middleware chain: requireAuth → allowRoles → enforceOrgScope
iamAuditRouter.use(...iamMiddlewareChain(['SUPER_ADMIN', 'COMPANY_ADMIN']));

/**
 * GET /api/admin/audit
 *
 * Paginated audit log list (50/page max, reverse chronological).
 * Filters: action, resource, actor, dateFrom, dateTo, organizationId (Super_Admin only).
 * Company_Admin sees only their organization's entries.
 * Super_Admin sees all entries with optional organizationId filter.
 * Empty state: returns items: [] when no results match.
 */
iamAuditRouter.get('/', async (req: Request, res: Response) => {
  const parsed = auditQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw badRequest('Invalid query parameters', parsed.error.flatten().fieldErrors);
  }

  const { page, pageSize, action, resource, actor, dateFrom, dateTo, organizationId } = parsed.data;

  // Build date range with defaults: last 30 days if not specified, max 365 days
  const now = new Date();
  let effectiveDateFrom: Date;
  let effectiveDateTo: Date;

  if (dateFrom) {
    effectiveDateFrom = new Date(dateFrom);
    if (isNaN(effectiveDateFrom.getTime())) {
      throw badRequest('Invalid dateFrom parameter');
    }
  } else {
    // Default: last 30 days
    effectiveDateFrom = new Date(now);
    effectiveDateFrom.setDate(effectiveDateFrom.getDate() - 30);
  }

  if (dateTo) {
    effectiveDateTo = new Date(dateTo);
    if (isNaN(effectiveDateTo.getTime())) {
      throw badRequest('Invalid dateTo parameter');
    }
  } else {
    effectiveDateTo = now;
  }

  // Enforce max 365-day span
  const spanMs = effectiveDateTo.getTime() - effectiveDateFrom.getTime();
  const maxSpanMs = 365 * 24 * 60 * 60 * 1000;
  if (spanMs > maxSpanMs) {
    throw badRequest('Date range cannot exceed 365 days');
  }
  if (spanMs < 0) {
    throw badRequest('dateFrom must be before dateTo');
  }

  // Build WHERE clause with AND logic
  const where: Record<string, unknown> = {
    createdAt: {
      gte: effectiveDateFrom,
      lte: effectiveDateTo,
    },
  };

  // Organization scoping
  if (req.orgFilter) {
    // Company_Admin: strict org scope
    where.organizationId = req.orgFilter.organizationId;
  } else if (organizationId) {
    // Super_Admin with optional org filter
    where.organizationId = organizationId;
  }

  // Action type filter
  if (action) {
    where.action = action;
  }

  // Resource type filter
  if (resource) {
    where.resource = resource;
  }

  // Actor filter (match by actorId)
  if (actor) {
    where.actorId = actor;
  }

  // Get total count for pagination
  const totalCount = await prisma.auditLog.count({ where: where as any });
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  // Fetch paginated results
  const skip = (page - 1) * pageSize;
  const logs = await prisma.auditLog.findMany({
    where: where as any,
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
    skip,
    take: pageSize,
  });

  // Map to response shape
  const items = logs.map((log) => ({
    id: log.id,
    actorId: log.actorId,
    actorName: log.actor
      ? `${log.actor.firstName} ${log.actor.lastName}`.trim()
      : null,
    action: log.action,
    resource: log.resource,
    resourceId: log.resourceId,
    organizationId: log.organizationId,
    timestamp: log.createdAt.toISOString(),
    changeSummary: log.details ?? null,
  }));

  res.json({
    items,
    page,
    pageSize,
    totalCount,
    totalPages,
  });
});


/**
 * POST /api/admin/audit/export
 *
 * Export audit log entries in JSON or CSV format.
 * Max 10,000 entries per export.
 * Includes metadata header: purpose, exportedBy (actor name/id), generatedAt.
 * Applies same filters as the list endpoint.
 * Organization-scoped for Company_Admin.
 *
 * Validates: Requirements 7.5, 7.6
 */
iamAuditRouter.post('/export', async (req: Request, res: Response) => {
  // Validate body (format + purpose)
  const bodyParsed = auditExportSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    throw badRequest('Invalid export parameters', bodyParsed.error.flatten().fieldErrors);
  }

  const { format, purpose } = bodyParsed.data;

  // Parse optional filter query parameters from body (same filters as list endpoint)
  const filterSchema = z.object({
    action: z.string().trim().optional(),
    resource: z.string().trim().optional(),
    actor: z.string().trim().optional(),
    dateFrom: z.string().trim().optional(),
    dateTo: z.string().trim().optional(),
    organizationId: z.string().trim().optional(),
  });

  const filterParsed = filterSchema.safeParse(req.body);
  const filters = filterParsed.success ? filterParsed.data : {};

  // Build date range with defaults
  const now = new Date();
  let effectiveDateFrom: Date;
  let effectiveDateTo: Date;

  if (filters.dateFrom) {
    effectiveDateFrom = new Date(filters.dateFrom);
    if (isNaN(effectiveDateFrom.getTime())) {
      throw badRequest('Invalid dateFrom parameter');
    }
  } else {
    effectiveDateFrom = new Date(now);
    effectiveDateFrom.setDate(effectiveDateFrom.getDate() - 30);
  }

  if (filters.dateTo) {
    effectiveDateTo = new Date(filters.dateTo);
    if (isNaN(effectiveDateTo.getTime())) {
      throw badRequest('Invalid dateTo parameter');
    }
  } else {
    effectiveDateTo = now;
  }

  // Enforce max 365-day span
  const spanMs = effectiveDateTo.getTime() - effectiveDateFrom.getTime();
  const maxSpanMs = 365 * 24 * 60 * 60 * 1000;
  if (spanMs > maxSpanMs) {
    throw badRequest('Date range cannot exceed 365 days');
  }
  if (spanMs < 0) {
    throw badRequest('dateFrom must be before dateTo');
  }

  // Build WHERE clause
  const where: Record<string, unknown> = {
    createdAt: {
      gte: effectiveDateFrom,
      lte: effectiveDateTo,
    },
  };

  // Organization scoping
  if (req.orgFilter) {
    where.organizationId = req.orgFilter.organizationId;
  } else if (filters.organizationId) {
    where.organizationId = filters.organizationId;
  }

  if (filters.action) {
    where.action = filters.action;
  }
  if (filters.resource) {
    where.resource = filters.resource;
  }
  if (filters.actor) {
    where.actorId = filters.actor;
  }

  // Count matching entries
  const totalCount = await prisma.auditLog.count({ where: where as any });

  // Enforce 10,000 entry export limit
  const EXPORT_LIMIT = 10_000;
  if (totalCount > EXPORT_LIMIT) {
    throw badRequest(
      'Result set exceeds the 10,000 entry export limit. Please narrow your filter criteria.',
    );
  }

  // Fetch all matching entries
  const logs = await prisma.auditLog.findMany({
    where: where as any,
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
    take: EXPORT_LIMIT,
  });

  // Resolve exporting actor name
  const actorUser = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, firstName: true, lastName: true },
  });

  const exportedBy = {
    id: req.user!.userId,
    name: actorUser ? `${actorUser.firstName} ${actorUser.lastName}`.trim() : req.user!.userId,
  };

  const generatedAt = new Date().toISOString();

  // Map entries to export shape
  const entries = logs.map((log) => ({
    id: log.id,
    actorId: log.actorId,
    actorName: log.actor
      ? `${log.actor.firstName} ${log.actor.lastName}`.trim()
      : null,
    action: log.action,
    resource: log.resource,
    resourceId: log.resourceId,
    organizationId: log.organizationId,
    timestamp: log.createdAt.toISOString(),
    details: log.details ?? null,
  }));

  const metadata = {
    purpose,
    exportedBy,
    generatedAt,
    totalEntries: entries.length,
  };

  if (format === 'csv') {
    // Generate CSV with metadata header and data rows
    const csvLines: string[] = [];

    // Metadata header row
    csvLines.push(`# Export Purpose: ${purpose}`);
    csvLines.push(`# Exported By: ${exportedBy.name} (${exportedBy.id})`);
    csvLines.push(`# Generated At: ${generatedAt}`);
    csvLines.push(`# Total Entries: ${entries.length}`);
    csvLines.push('');

    // Column headers
    csvLines.push('id,actorId,actorName,action,resource,resourceId,organizationId,timestamp,details');

    // Data rows
    for (const entry of entries) {
      const escapeCsv = (val: string | null | undefined): string => {
        if (val == null) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      csvLines.push(
        [
          escapeCsv(entry.id),
          escapeCsv(entry.actorId),
          escapeCsv(entry.actorName),
          escapeCsv(entry.action),
          escapeCsv(entry.resource),
          escapeCsv(entry.resourceId),
          escapeCsv(entry.organizationId),
          escapeCsv(entry.timestamp),
          escapeCsv(entry.details ? JSON.stringify(entry.details) : null),
        ].join(','),
      );
    }

    const csvContent = csvLines.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-export-${generatedAt}.csv"`);
    res.send(csvContent);
  } else {
    // JSON format
    res.json({
      metadata,
      entries,
    });
  }
});


/**
 * Map resource type to the corresponding IAM portal section and Prisma model for existence check.
 */
const RESOURCE_SECTION_MAP: Record<string, { section: string; model: string }> = {
  user: { section: 'users', model: 'user' },
  provider_profile: { section: 'providers', model: 'providerProfile' },
  provider_credential_document: { section: 'providers', model: 'providerCredentialDocument' },
  provider_credential_review_task: { section: 'providers', model: 'providerCredentialReviewTask' },
  provider_credential_notification: { section: 'providers', model: 'providerCredentialDocument' },
  provider_onboarding_state: { section: 'providers', model: 'providerOnboardingState' },
  provider_schedule_template: { section: 'availability', model: 'providerScheduleTemplate' },
  appointment: { section: 'schedule', model: 'appointment' },
  invitation: { section: 'invitations', model: 'invitation' },
  time_off_block: { section: 'availability', model: 'timeOffBlock' },
  published_slot: { section: 'availability', model: 'publishedSlot' },
  organization: { section: 'users', model: 'organization' },
  patient_profile: { section: 'users', model: 'patientProfile' },
  provider_role_catalog: { section: 'roles', model: 'providerRoleCatalog' },
};

/**
 * Check if a resource still exists in the database.
 */
async function checkResourceExists(resourceType: string, resourceId: string): Promise<boolean> {
  const mapping = RESOURCE_SECTION_MAP[resourceType];
  if (!mapping || !resourceId) return false;

  try {
    const model = (prisma as any)[mapping.model];
    if (!model?.findUnique) return false;
    const record = await model.findUnique({ where: { id: resourceId }, select: { id: true } });
    return record !== null;
  } catch {
    return false;
  }
}

/**
 * Generate a resource navigation link for the admin portal.
 */
function buildResourceLink(
  resourceType: string,
  resourceId: string | null,
  exists: boolean,
): { active: boolean; url?: string; label?: string } {
  if (!resourceId) {
    return { active: false, label: 'Resource no longer exists' };
  }

  if (!exists) {
    return { active: false, label: 'Resource no longer exists' };
  }

  const mapping = RESOURCE_SECTION_MAP[resourceType];
  const section = mapping?.section ?? 'users';

  return {
    active: true,
    url: `/portal/iam/${section}/${resourceId}`,
  };
}

/**
 * GET /api/admin/audit/:id
 *
 * Return the full detail view for a single audit log entry.
 * Includes full structured change data (details) and a resource navigation link.
 * If the affected resource has been deleted, the link is flagged as inactive.
 * Organization-scoped: Company_Admin can only view entries belonging to their org.
 *
 * Validates: Requirements 7.8
 */
iamAuditRouter.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const log = await prisma.auditLog.findUnique({
    where: { id },
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

  if (!log) {
    throw notFound('Audit entry not found');
  }

  // Org-scope: Company_Admin can only view entries in their org
  // If the entry belongs to a different org, return 404 (not 403, to avoid leaking existence)
  if (req.orgFilter && log.organizationId !== req.orgFilter.organizationId) {
    throw notFound('Audit entry not found');
  }

  // Check if the resource still exists
  const resourceExists = log.resourceId
    ? await checkResourceExists(log.resource, log.resourceId)
    : false;

  // Build resource navigation link
  const resourceLink = buildResourceLink(log.resource, log.resourceId, resourceExists);

  res.json({
    id: log.id,
    actorId: log.actorId,
    actorName: log.actor
      ? `${log.actor.firstName} ${log.actor.lastName}`.trim()
      : null,
    action: log.action,
    resource: log.resource,
    resourceId: log.resourceId,
    organizationId: log.organizationId,
    timestamp: log.createdAt.toISOString(),
    details: log.details ?? null,
    resourceLink,
  });
});
