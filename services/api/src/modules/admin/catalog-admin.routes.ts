import { Router } from 'express';
import { z } from 'zod';
import { iamMiddlewareChain } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { writeAuditLog } from '../../lib/audit';
import {
  listConfigItems,
  getConfigItem,
  upsertConfigItem,
  transitionConfigItem,
  getConfigStorageMode,
} from '../../lib/admin-config-store';

export const catalogAdminRouter = Router();

const adminRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN'];

// ---------------------------------------------------------------------------
// GET /api/admin/catalog/services
// Task 12.1 — List services with filters, pagination, and sort
// ---------------------------------------------------------------------------

catalogAdminRouter.get(
  '/catalog/services',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_ORG', message: 'Organization scope is required.' },
      });
    }

    // Pagination
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));

    // Sort
    const sortBy = (req.query.sortBy as string) || 'name';
    const sortOrder = (req.query.sortOrder as string) === 'desc' ? 'desc' : 'asc';

    // Fetch all items from config store
    let items = await listConfigItems('catalog', organizationId);

    // --- Apply Filters ---

    // Category filter
    const category = (req.query.category as string)?.trim().toLowerCase();
    if (category) {
      items = items.filter(
        (item) => String(item.category ?? '').toLowerCase() === category,
      );
    }

    // Provider type filter (stored in data.providerType or tags)
    const providerType = (req.query.providerType as string)?.trim().toLowerCase();
    if (providerType) {
      items = items.filter((item) => {
        const itemProviderType = String(item.providerType ?? '').toLowerCase();
        const tags = Array.isArray(item.tags) ? item.tags : [];
        return (
          itemProviderType.includes(providerType) ||
          tags.some((t: string) => t.toLowerCase().includes(providerType))
        );
      });
    }

    // Specialty filter
    const specialty = (req.query.specialty as string)?.trim().toLowerCase();
    if (specialty) {
      items = items.filter((item) => {
        const itemSpecialty = String(item.specialty ?? '').toLowerCase();
        const desc = String(item.description ?? '').toLowerCase();
        const tags = Array.isArray(item.tags) ? item.tags : [];
        return (
          itemSpecialty.includes(specialty) ||
          desc.includes(specialty) ||
          tags.some((t: string) => t.toLowerCase().includes(specialty))
        );
      });
    }

    // Department filter
    const department = (req.query.department as string)?.trim().toLowerCase();
    if (department) {
      items = items.filter((item) => {
        const itemDept = String(item.department ?? '').toLowerCase();
        return itemDept.includes(department);
      });
    }

    // Availability filter (service modes: IN_PERSON, TELEHEALTH, etc.)
    const availability = (req.query.availability as string)?.trim().toUpperCase();
    if (availability) {
      items = items.filter((item) => {
        const modes = Array.isArray(item.serviceModes) ? item.serviceModes : [];
        return modes.some((m: string) => m.toUpperCase().includes(availability));
      });
    }

    // Price range filters (min/max)
    const priceMin = req.query.priceMin ? parseFloat(req.query.priceMin as string) : undefined;
    const priceMax = req.query.priceMax ? parseFloat(req.query.priceMax as string) : undefined;
    if (priceMin !== undefined || priceMax !== undefined) {
      items = items.filter((item) => {
        const price = Number(item.price ?? item.baseAmountMinor ?? item.durationMinutes ?? 0);
        if (priceMin !== undefined && price < priceMin) return false;
        if (priceMax !== undefined && price > priceMax) return false;
        return true;
      });
    }

    // Insurance coverage filter
    const insuranceCoverage = (req.query.insuranceCoverage as string)?.trim().toLowerCase();
    if (insuranceCoverage) {
      items = items.filter((item) => {
        const requiresCoverage = item.requiresCoverageCheck;
        if (insuranceCoverage === 'true' || insuranceCoverage === 'required') {
          return requiresCoverage === true;
        }
        if (insuranceCoverage === 'false' || insuranceCoverage === 'not_required') {
          return requiresCoverage === false;
        }
        return true;
      });
    }

    // Status filter (active/archived/draft/published)
    const status = (req.query.status as string)?.trim().toUpperCase();
    if (status) {
      items = items.filter((item) => item.status === status);
    }

    // Text search (q)
    const q = (req.query.q as string)?.trim().toLowerCase();
    if (q) {
      items = items.filter((item) =>
        [item.code, item.name, item.category, item.description, ...(Array.isArray(item.tags) ? item.tags : [])]
          .join(' ')
          .toLowerCase()
          .includes(q),
      );
    }

    // --- Apply Sort ---
    items.sort((a, b) => {
      const aVal = String(a[sortBy] ?? a.name ?? '').toLowerCase();
      const bVal = String(b[sortBy] ?? b.name ?? '').toLowerCase();
      const cmp = aVal.localeCompare(bVal);
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    // --- Apply Pagination ---
    const total = items.length;
    const totalPages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;
    const paginatedItems = items.slice(skip, skip + limit);

    res.json({
      items: paginatedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      storageMode: getConfigStorageMode('catalog'),
    });
  },
);

// ---------------------------------------------------------------------------
// GET /api/admin/catalog/services/:id/dependencies
// Task 12.2 — Service dependency graph
// ---------------------------------------------------------------------------

catalogAdminRouter.get(
  '/catalog/services/:id/dependencies',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    const { id } = req.params;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_ORG', message: 'Organization scope is required.' },
      });
    }

    // Verify the service exists
    let service: any;
    try {
      service = await getConfigItem('catalog', id, organizationId);
    } catch {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Service not found.' },
      });
    }

    // Attempt to find dependencies from data.dependencies / data.dependsOn fields
    const allServices = await listConfigItems('catalog', organizationId);

    // Services this one depends on (from data.dependsOn or data.dependencies)
    const dependsOnCodes: string[] = Array.isArray(service.dependsOn)
      ? service.dependsOn
      : Array.isArray(service.dependencies)
        ? service.dependencies
        : [];

    const dependsOn = allServices
      .filter((s) => dependsOnCodes.includes(s.code) || dependsOnCodes.includes(s.id))
      .map((s) => ({ id: s.id, code: s.code, name: s.name, status: s.status }));

    // Services that depend on this one (reverse lookup)
    const dependedOnBy = allServices
      .filter((s) => {
        if (s.id === id) return false;
        const sDeps: string[] = Array.isArray(s.dependsOn)
          ? s.dependsOn
          : Array.isArray(s.dependencies)
            ? s.dependencies
            : [];
        return sDeps.includes(service.code) || sDeps.includes(service.id);
      })
      .map((s) => ({ id: s.id, code: s.code, name: s.name, status: s.status }));

    res.json({
      serviceId: id,
      serviceName: service.name,
      serviceCode: service.code,
      dependsOn,
      dependedOnBy,
    });
  },
);

// ---------------------------------------------------------------------------
// POST /api/admin/catalog/services/:id/clone
// Task 12.3 — Clone a service with a new ID and " (Copy)" suffix
// ---------------------------------------------------------------------------

catalogAdminRouter.post(
  '/catalog/services/:id/clone',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    const actorId: string | undefined = req.user?.userId;
    const { id } = req.params;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_ORG', message: 'Organization scope is required.' },
      });
    }

    // Get the original service
    let original: any;
    try {
      original = await getConfigItem('catalog', id, organizationId);
    } catch {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Service not found.' },
      });
    }

    // Create the clone with modified name and code
    const cloneData = {
      ...original,
      id: undefined, // Let the system generate a new ID
      name: `${original.name} (Copy)`,
      code: `${original.code}_COPY_${Date.now()}`,
      status: 'DRAFT',
      version: 1,
    };

    // Remove fields that should not be copied
    delete cloneData.id;
    delete cloneData.createdAt;
    delete cloneData.updatedAt;

    const cloned = await upsertConfigItem('catalog', cloneData, {
      organizationId,
      actorId,
    });

    // Audit log the clone action
    await writeAuditLog({
      actorId,
      organizationId,
      action: 'service_catalog.cloned',
      resource: 'service_catalog',
      resourceId: cloned.id,
      details: {
        originalId: id,
        originalCode: original.code,
        clonedId: cloned.id,
        clonedCode: cloned.code,
      },
    });

    res.status(201).json({
      success: true,
      data: cloned,
    });
  },
);

// ---------------------------------------------------------------------------
// POST /api/admin/catalog/services/archive
// Task 12.4 — Bulk archive services by IDs
// ---------------------------------------------------------------------------

const archiveServicesSchema = z.object({
  serviceIds: z.array(z.string().min(1)).min(1, 'At least one service ID is required'),
  reason: z.string().trim().max(500).optional(),
});

catalogAdminRouter.post(
  '/catalog/services/archive',
  ...iamMiddlewareChain(adminRoles),
  validateBody(archiveServicesSchema),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    const actorId: string | undefined = req.user?.userId;
    const { serviceIds, reason } = req.body as z.infer<typeof archiveServicesSchema>;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_ORG', message: 'Organization scope is required.' },
      });
    }

    const archived: any[] = [];
    const failed: { id: string; error: string }[] = [];

    for (const serviceId of serviceIds) {
      try {
        const item = await transitionConfigItem(
          'catalog',
          serviceId,
          'ARCHIVED',
          { organizationId, actorId },
          reason ?? null,
        );
        archived.push(item);
      } catch (err: any) {
        failed.push({ id: serviceId, error: err.message ?? 'Failed to archive' });
      }
    }

    // Write a bulk audit log entry
    await writeAuditLog({
      actorId,
      organizationId,
      action: 'service_catalog.bulk_archived',
      resource: 'service_catalog',
      details: {
        archivedCount: archived.length,
        failedCount: failed.length,
        serviceIds,
        reason: reason ?? null,
      },
    });

    res.json({
      success: true,
      data: {
        archived: archived.map((item) => ({ id: item.id, code: item.code, name: item.name, status: item.status })),
        archivedCount: archived.length,
        failed,
        failedCount: failed.length,
      },
    });
  },
);

// ---------------------------------------------------------------------------
// GET /api/admin/catalog/services/:id/metrics
// Task 13.4 — Service workspace metrics
// ---------------------------------------------------------------------------

catalogAdminRouter.get(
  '/catalog/services/:id/metrics',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    const { id } = req.params;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_ORG', message: 'Organization scope is required.' },
      });
    }

    // Verify the service exists
    let service: any;
    try {
      service = await getConfigItem('catalog', id, organizationId);
    } catch {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Service not found.' },
      });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    // The service name/code is stored in the Appointment.service field
    const serviceCode = service.code;
    const serviceName = service.name;

    // Build a where clause that matches appointments for this service
    // Appointments store service as a string — match by code or name
    const serviceMatchConditions = [
      { service: { contains: serviceCode, mode: 'insensitive' as any } },
      { service: { contains: serviceName, mode: 'insensitive' as any } },
    ];

    // Provider count — unique providers who have appointments for this service
    const providerAppointments = await prisma.appointment.findMany({
      where: {
        organizationId,
        OR: serviceMatchConditions,
      },
      select: { providerId: true },
      distinct: ['providerId'],
    });
    const providerCount = providerAppointments.length;

    // Total appointment count for this service
    const appointmentCount = await prisma.appointment.count({
      where: {
        organizationId,
        OR: serviceMatchConditions,
      },
    });

    // Monthly utilization (appointments in the last 30 days)
    const monthlyAppointments = await prisma.appointment.count({
      where: {
        organizationId,
        OR: serviceMatchConditions,
        startsAt: { gte: thirtyDaysAgo },
      },
    });

    // Total appointments in last 30 days (all services) for utilization rate
    const totalMonthlyAppointments = await prisma.appointment.count({
      where: {
        organizationId,
        startsAt: { gte: thirtyDaysAgo },
      },
    });

    const monthlyUtilization =
      totalMonthlyAppointments > 0
        ? Math.round((monthlyAppointments / totalMonthlyAppointments) * 100 * 10) / 10
        : 0;

    // Yearly utilization (appointments in the last year)
    const yearlyAppointments = await prisma.appointment.count({
      where: {
        organizationId,
        OR: serviceMatchConditions,
        startsAt: { gte: oneYearAgo },
      },
    });

    const totalYearlyAppointments = await prisma.appointment.count({
      where: {
        organizationId,
        startsAt: { gte: oneYearAgo },
      },
    });

    const yearlyUtilization =
      totalYearlyAppointments > 0
        ? Math.round((yearlyAppointments / totalYearlyAppointments) * 100 * 10) / 10
        : 0;

    // Demand trends — monthly appointment counts for the last 6 months
    const demandTrends: { month: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now);
      monthStart.setMonth(monthStart.getMonth() - i);
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);

      const count = await prisma.appointment.count({
        where: {
          organizationId,
          OR: serviceMatchConditions,
          startsAt: { gte: monthStart, lt: monthEnd },
        },
      });

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      demandTrends.push({
        month: monthNames[monthStart.getMonth()],
        count,
      });
    }

    // Satisfaction score — derived from completed vs total appointments for this service
    const completedForService = await prisma.appointment.count({
      where: {
        organizationId,
        OR: serviceMatchConditions,
        status: 'COMPLETED',
      },
    });

    const ratedAppointments = await prisma.appointment.count({
      where: {
        organizationId,
        OR: serviceMatchConditions,
        status: { in: ['COMPLETED', 'CANCELLED', 'NO_SHOW'] },
      },
    });

    const satisfactionScore =
      ratedAppointments > 0
        ? Math.round((completedForService / ratedAppointments) * 5 * 10) / 10
        : 4.5;

    // Revenue — sum of payments for appointments matching this service
    const payments = await prisma.payment.findMany({
      where: {
        organizationId,
        appointment: {
          OR: serviceMatchConditions,
        },
      },
      select: { amountMinor: true },
    });

    const revenue = payments.reduce((sum: number, p: any) => sum + (p.amountMinor ?? 0), 0);

    res.json({
      serviceId: id,
      serviceName: service.name,
      serviceCode: service.code,
      providerCount,
      appointmentCount,
      monthlyUtilization,
      yearlyUtilization,
      demandTrends,
      satisfactionScore,
      revenue,
    });
  },
);
