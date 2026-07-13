import { Router } from 'express';
import { iamMiddlewareChain } from '../../middleware/rbac';
import { prisma } from '../../lib/prisma';
import { writeAuditLog } from '../../lib/audit';
import { badRequest, notFound } from '../../lib/http';

export const coverageAdminRouter = Router();

const adminRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN'];

// ─── Insurance Providers ─────────────────────────────────────────────────────

coverageAdminRouter.get(
  '/coverage/insurance-providers',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    if (!organizationId) throw badRequest('Organization scope is required');

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;
    const status = (req.query.status as string) || undefined;
    const search = (req.query.search as string) || undefined;

    const where: any = { organizationId };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.insuranceProvider.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.insuranceProvider.count({ where }),
    ]);

    res.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
  }
);

coverageAdminRouter.post(
  '/coverage/insurance-providers',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    if (!organizationId) throw badRequest('Organization scope is required');

    const { name, code, type, contactInfo, status } = req.body;
    if (!name || !code || !type) throw badRequest('name, code, and type are required');

    const item = await prisma.insuranceProvider.create({
      data: {
        name,
        code,
        type,
        contactInfo: contactInfo ?? undefined,
        status: status || 'ACTIVE',
        organizationId,
      },
    });

    await writeAuditLog({
      actorId: req.user?.userId,
      organizationId,
      action: 'coverage.insurance_provider.created',
      resource: 'insurance_provider',
      resourceId: item.id,
      details: { name, code, type },
    });

    res.status(201).json({ success: true, data: item });
  }
);

coverageAdminRouter.get(
  '/coverage/insurance-providers/:id',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    if (!organizationId) throw badRequest('Organization scope is required');

    const item = await prisma.insuranceProvider.findFirst({
      where: { id: req.params.id, organizationId },
      include: { coveragePlans: true },
    });
    if (!item) throw notFound('Insurance provider not found');

    res.json({ success: true, data: item });
  }
);

coverageAdminRouter.put(
  '/coverage/insurance-providers/:id',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    if (!organizationId) throw badRequest('Organization scope is required');

    const existing = await prisma.insuranceProvider.findFirst({
      where: { id: req.params.id, organizationId },
    });
    if (!existing) throw notFound('Insurance provider not found');

    const { name, code, type, contactInfo, status } = req.body;
    const item = await prisma.insuranceProvider.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(type !== undefined && { type }),
        ...(contactInfo !== undefined && { contactInfo }),
        ...(status !== undefined && { status }),
      },
    });

    await writeAuditLog({
      actorId: req.user?.userId,
      organizationId,
      action: 'coverage.insurance_provider.updated',
      resource: 'insurance_provider',
      resourceId: item.id,
      details: { changes: req.body },
    });

    res.json({ success: true, data: item });
  }
);

coverageAdminRouter.delete(
  '/coverage/insurance-providers/:id',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    if (!organizationId) throw badRequest('Organization scope is required');

    const existing = await prisma.insuranceProvider.findFirst({
      where: { id: req.params.id, organizationId },
    });
    if (!existing) throw notFound('Insurance provider not found');

    await prisma.insuranceProvider.delete({ where: { id: req.params.id } });

    await writeAuditLog({
      actorId: req.user?.userId,
      organizationId,
      action: 'coverage.insurance_provider.deleted',
      resource: 'insurance_provider',
      resourceId: req.params.id,
      details: { name: existing.name, code: existing.code },
    });

    res.json({ success: true, message: 'Insurance provider deleted' });
  }
);

// ─── Coverage Plans ──────────────────────────────────────────────────────────

coverageAdminRouter.get(
  '/coverage/plans',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    if (!organizationId) throw badRequest('Organization scope is required');

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;
    const status = (req.query.status as string) || undefined;
    const insuranceProviderId = (req.query.insuranceProviderId as string) || undefined;
    const search = (req.query.search as string) || undefined;

    const where: any = { organizationId };
    if (status) where.status = status;
    if (insuranceProviderId) where.insuranceProviderId = insuranceProviderId;
    if (search) {
      where.OR = [{ name: { contains: search, mode: 'insensitive' } }];
    }

    const [items, total] = await Promise.all([
      prisma.coveragePlan.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { insuranceProvider: { select: { id: true, name: true, code: true } } },
      }),
      prisma.coveragePlan.count({ where }),
    ]);

    res.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
  }
);

coverageAdminRouter.post(
  '/coverage/plans',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    if (!organizationId) throw badRequest('Organization scope is required');

    const { insuranceProviderId, name, type, coverage, deductible, copay, coinsurance, status } = req.body;
    if (!insuranceProviderId || !name || !type) throw badRequest('insuranceProviderId, name, and type are required');

    // Verify insurance provider belongs to org
    const provider = await prisma.insuranceProvider.findFirst({
      where: { id: insuranceProviderId, organizationId },
    });
    if (!provider) throw badRequest('Insurance provider not found in organization');

    const item = await prisma.coveragePlan.create({
      data: {
        insuranceProviderId,
        name,
        type,
        coverage: coverage ?? undefined,
        deductible: deductible ?? 0,
        copay: copay ?? 0,
        coinsurance: coinsurance ?? 0,
        status: status || 'ACTIVE',
        organizationId,
      },
    });

    await writeAuditLog({
      actorId: req.user?.userId,
      organizationId,
      action: 'coverage.plan.created',
      resource: 'coverage_plan',
      resourceId: item.id,
      details: { name, type, insuranceProviderId },
    });

    res.status(201).json({ success: true, data: item });
  }
);

coverageAdminRouter.get(
  '/coverage/plans/:id',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    if (!organizationId) throw badRequest('Organization scope is required');

    const item = await prisma.coveragePlan.findFirst({
      where: { id: req.params.id, organizationId },
      include: {
        insuranceProvider: { select: { id: true, name: true, code: true } },
        geographicCoverages: true,
        serviceCoverages: true,
        networkProviders: true,
        authorizationRequirements: true,
      },
    });
    if (!item) throw notFound('Coverage plan not found');

    res.json({ success: true, data: item });
  }
);

coverageAdminRouter.put(
  '/coverage/plans/:id',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    if (!organizationId) throw badRequest('Organization scope is required');

    const existing = await prisma.coveragePlan.findFirst({
      where: { id: req.params.id, organizationId },
    });
    if (!existing) throw notFound('Coverage plan not found');

    const { name, type, coverage, deductible, copay, coinsurance, status } = req.body;
    const item = await prisma.coveragePlan.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(coverage !== undefined && { coverage }),
        ...(deductible !== undefined && { deductible }),
        ...(copay !== undefined && { copay }),
        ...(coinsurance !== undefined && { coinsurance }),
        ...(status !== undefined && { status }),
      },
    });

    await writeAuditLog({
      actorId: req.user?.userId,
      organizationId,
      action: 'coverage.plan.updated',
      resource: 'coverage_plan',
      resourceId: item.id,
      details: { changes: req.body },
    });

    res.json({ success: true, data: item });
  }
);

coverageAdminRouter.delete(
  '/coverage/plans/:id',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    if (!organizationId) throw badRequest('Organization scope is required');

    const existing = await prisma.coveragePlan.findFirst({
      where: { id: req.params.id, organizationId },
    });
    if (!existing) throw notFound('Coverage plan not found');

    await prisma.coveragePlan.delete({ where: { id: req.params.id } });

    await writeAuditLog({
      actorId: req.user?.userId,
      organizationId,
      action: 'coverage.plan.deleted',
      resource: 'coverage_plan',
      resourceId: req.params.id,
      details: { name: existing.name },
    });

    res.json({ success: true, message: 'Coverage plan deleted' });
  }
);


// ─── Geographic Coverage ─────────────────────────────────────────────────────

coverageAdminRouter.get(
  '/coverage/plans/:planId/geographic',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    if (!organizationId) throw badRequest('Organization scope is required');

    // Verify plan belongs to org
    const plan = await prisma.coveragePlan.findFirst({
      where: { id: req.params.planId, organizationId },
    });
    if (!plan) throw notFound('Coverage plan not found');

    const items = await prisma.geographicCoverage.findMany({
      where: { planId: req.params.planId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: items });
  }
);

coverageAdminRouter.post(
  '/coverage/geographic',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    if (!organizationId) throw badRequest('Organization scope is required');

    const { planId, country, state, city, zipCodes, radius } = req.body;
    if (!planId || !country) throw badRequest('planId and country are required');

    const plan = await prisma.coveragePlan.findFirst({
      where: { id: planId, organizationId },
    });
    if (!plan) throw notFound('Coverage plan not found');

    const item = await prisma.geographicCoverage.create({
      data: {
        planId,
        country,
        state: state ?? null,
        city: city ?? null,
        zipCodes: zipCodes ?? [],
        radius: radius ?? null,
      },
    });

    await writeAuditLog({
      actorId: req.user?.userId,
      organizationId,
      action: 'coverage.geographic.created',
      resource: 'geographic_coverage',
      resourceId: item.id,
      details: { planId, country, state, city },
    });

    res.status(201).json({ success: true, data: item });
  }
);

coverageAdminRouter.put(
  '/coverage/geographic/:id',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    if (!organizationId) throw badRequest('Organization scope is required');

    const existing = await prisma.geographicCoverage.findUnique({
      where: { id: req.params.id },
      include: { plan: { select: { organizationId: true } } },
    });
    if (!existing || existing.plan.organizationId !== organizationId) throw notFound('Geographic coverage not found');

    const { country, state, city, zipCodes, radius } = req.body;
    const item = await prisma.geographicCoverage.update({
      where: { id: req.params.id },
      data: {
        ...(country !== undefined && { country }),
        ...(state !== undefined && { state }),
        ...(city !== undefined && { city }),
        ...(zipCodes !== undefined && { zipCodes }),
        ...(radius !== undefined && { radius }),
      },
    });

    await writeAuditLog({
      actorId: req.user?.userId,
      organizationId,
      action: 'coverage.geographic.updated',
      resource: 'geographic_coverage',
      resourceId: item.id,
      details: { changes: req.body },
    });

    res.json({ success: true, data: item });
  }
);

coverageAdminRouter.delete(
  '/coverage/geographic/:id',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    if (!organizationId) throw badRequest('Organization scope is required');

    const existing = await prisma.geographicCoverage.findUnique({
      where: { id: req.params.id },
      include: { plan: { select: { organizationId: true } } },
    });
    if (!existing || existing.plan.organizationId !== organizationId) throw notFound('Geographic coverage not found');

    await prisma.geographicCoverage.delete({ where: { id: req.params.id } });

    await writeAuditLog({
      actorId: req.user?.userId,
      organizationId,
      action: 'coverage.geographic.deleted',
      resource: 'geographic_coverage',
      resourceId: req.params.id,
      details: { planId: existing.planId, country: existing.country },
    });

    res.json({ success: true, message: 'Geographic coverage deleted' });
  }
);

// ─── Service Coverage ────────────────────────────────────────────────────────

coverageAdminRouter.get(
  '/coverage/plans/:planId/services',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    if (!organizationId) throw badRequest('Organization scope is required');

    const plan = await prisma.coveragePlan.findFirst({
      where: { id: req.params.planId, organizationId },
    });
    if (!plan) throw notFound('Coverage plan not found');

    const items = await prisma.serviceCoverage.findMany({
      where: { planId: req.params.planId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: items });
  }
);

coverageAdminRouter.post(
  '/coverage/services',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    if (!organizationId) throw badRequest('Organization scope is required');

    const { planId, serviceId, covered, priorAuthRequired, copayAmount, limits } = req.body;
    if (!planId || !serviceId) throw badRequest('planId and serviceId are required');

    const plan = await prisma.coveragePlan.findFirst({
      where: { id: planId, organizationId },
    });
    if (!plan) throw notFound('Coverage plan not found');

    const item = await prisma.serviceCoverage.create({
      data: {
        planId,
        serviceId,
        covered: covered ?? true,
        priorAuthRequired: priorAuthRequired ?? false,
        copayAmount: copayAmount ?? 0,
        limits: limits ?? undefined,
      },
    });

    await writeAuditLog({
      actorId: req.user?.userId,
      organizationId,
      action: 'coverage.service.created',
      resource: 'service_coverage',
      resourceId: item.id,
      details: { planId, serviceId, covered },
    });

    res.status(201).json({ success: true, data: item });
  }
);

coverageAdminRouter.put(
  '/coverage/services/:id',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    if (!organizationId) throw badRequest('Organization scope is required');

    const existing = await prisma.serviceCoverage.findUnique({
      where: { id: req.params.id },
      include: { plan: { select: { organizationId: true } } },
    });
    if (!existing || existing.plan.organizationId !== organizationId) throw notFound('Service coverage not found');

    const { covered, priorAuthRequired, copayAmount, limits } = req.body;
    const item = await prisma.serviceCoverage.update({
      where: { id: req.params.id },
      data: {
        ...(covered !== undefined && { covered }),
        ...(priorAuthRequired !== undefined && { priorAuthRequired }),
        ...(copayAmount !== undefined && { copayAmount }),
        ...(limits !== undefined && { limits }),
      },
    });

    await writeAuditLog({
      actorId: req.user?.userId,
      organizationId,
      action: 'coverage.service.updated',
      resource: 'service_coverage',
      resourceId: item.id,
      details: { changes: req.body },
    });

    res.json({ success: true, data: item });
  }
);

coverageAdminRouter.delete(
  '/coverage/services/:id',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    if (!organizationId) throw badRequest('Organization scope is required');

    const existing = await prisma.serviceCoverage.findUnique({
      where: { id: req.params.id },
      include: { plan: { select: { organizationId: true } } },
    });
    if (!existing || existing.plan.organizationId !== organizationId) throw notFound('Service coverage not found');

    await prisma.serviceCoverage.delete({ where: { id: req.params.id } });

    await writeAuditLog({
      actorId: req.user?.userId,
      organizationId,
      action: 'coverage.service.deleted',
      resource: 'service_coverage',
      resourceId: req.params.id,
      details: { planId: existing.planId, serviceId: existing.serviceId },
    });

    res.json({ success: true, message: 'Service coverage deleted' });
  }
);

// ─── Network Providers ───────────────────────────────────────────────────────

coverageAdminRouter.get(
  '/coverage/plans/:planId/network',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    if (!organizationId) throw badRequest('Organization scope is required');

    const plan = await prisma.coveragePlan.findFirst({
      where: { id: req.params.planId, organizationId },
    });
    if (!plan) throw notFound('Coverage plan not found');

    const items = await prisma.networkProvider.findMany({
      where: { planId: req.params.planId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: items });
  }
);

coverageAdminRouter.post(
  '/coverage/network',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    if (!organizationId) throw badRequest('Organization scope is required');

    const { planId, providerId, inNetwork, tier, effectiveDate, terminationDate } = req.body;
    if (!planId || !providerId || !effectiveDate) throw badRequest('planId, providerId, and effectiveDate are required');

    const plan = await prisma.coveragePlan.findFirst({
      where: { id: planId, organizationId },
    });
    if (!plan) throw notFound('Coverage plan not found');

    const item = await prisma.networkProvider.create({
      data: {
        planId,
        providerId,
        inNetwork: inNetwork ?? true,
        tier: tier ?? null,
        effectiveDate: new Date(effectiveDate),
        terminationDate: terminationDate ? new Date(terminationDate) : null,
      },
    });

    await writeAuditLog({
      actorId: req.user?.userId,
      organizationId,
      action: 'coverage.network_provider.created',
      resource: 'network_provider',
      resourceId: item.id,
      details: { planId, providerId, inNetwork },
    });

    res.status(201).json({ success: true, data: item });
  }
);

coverageAdminRouter.put(
  '/coverage/network/:id',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    if (!organizationId) throw badRequest('Organization scope is required');

    const existing = await prisma.networkProvider.findUnique({
      where: { id: req.params.id },
      include: { plan: { select: { organizationId: true } } },
    });
    if (!existing || existing.plan.organizationId !== organizationId) throw notFound('Network provider not found');

    const { inNetwork, tier, effectiveDate, terminationDate } = req.body;
    const item = await prisma.networkProvider.update({
      where: { id: req.params.id },
      data: {
        ...(inNetwork !== undefined && { inNetwork }),
        ...(tier !== undefined && { tier }),
        ...(effectiveDate !== undefined && { effectiveDate: new Date(effectiveDate) }),
        ...(terminationDate !== undefined && { terminationDate: terminationDate ? new Date(terminationDate) : null }),
      },
    });

    await writeAuditLog({
      actorId: req.user?.userId,
      organizationId,
      action: 'coverage.network_provider.updated',
      resource: 'network_provider',
      resourceId: item.id,
      details: { changes: req.body },
    });

    res.json({ success: true, data: item });
  }
);

coverageAdminRouter.delete(
  '/coverage/network/:id',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    if (!organizationId) throw badRequest('Organization scope is required');

    const existing = await prisma.networkProvider.findUnique({
      where: { id: req.params.id },
      include: { plan: { select: { organizationId: true } } },
    });
    if (!existing || existing.plan.organizationId !== organizationId) throw notFound('Network provider not found');

    await prisma.networkProvider.delete({ where: { id: req.params.id } });

    await writeAuditLog({
      actorId: req.user?.userId,
      organizationId,
      action: 'coverage.network_provider.deleted',
      resource: 'network_provider',
      resourceId: req.params.id,
      details: { planId: existing.planId, providerId: existing.providerId },
    });

    res.json({ success: true, message: 'Network provider deleted' });
  }
);

// ─── Authorization Requirements ─────────────────────────────────────────────

coverageAdminRouter.get(
  '/coverage/plans/:planId/auth-requirements',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    if (!organizationId) throw badRequest('Organization scope is required');

    const plan = await prisma.coveragePlan.findFirst({
      where: { id: req.params.planId, organizationId },
    });
    if (!plan) throw notFound('Coverage plan not found');

    const items = await prisma.authorizationRequirement.findMany({
      where: { planId: req.params.planId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: items });
  }
);

coverageAdminRouter.post(
  '/coverage/auth-requirements',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    if (!organizationId) throw badRequest('Organization scope is required');

    const { planId, serviceId, required, criteria, validDays } = req.body;
    if (!planId || !serviceId) throw badRequest('planId and serviceId are required');

    const plan = await prisma.coveragePlan.findFirst({
      where: { id: planId, organizationId },
    });
    if (!plan) throw notFound('Coverage plan not found');

    const item = await prisma.authorizationRequirement.create({
      data: {
        planId,
        serviceId,
        required: required ?? true,
        criteria: criteria ?? undefined,
        validDays: validDays ?? 30,
      },
    });

    await writeAuditLog({
      actorId: req.user?.userId,
      organizationId,
      action: 'coverage.auth_requirement.created',
      resource: 'authorization_requirement',
      resourceId: item.id,
      details: { planId, serviceId, required },
    });

    res.status(201).json({ success: true, data: item });
  }
);

coverageAdminRouter.put(
  '/coverage/auth-requirements/:id',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    if (!organizationId) throw badRequest('Organization scope is required');

    const existing = await prisma.authorizationRequirement.findUnique({
      where: { id: req.params.id },
      include: { plan: { select: { organizationId: true } } },
    });
    if (!existing || existing.plan.organizationId !== organizationId) throw notFound('Authorization requirement not found');

    const { required, criteria, validDays } = req.body;
    const item = await prisma.authorizationRequirement.update({
      where: { id: req.params.id },
      data: {
        ...(required !== undefined && { required }),
        ...(criteria !== undefined && { criteria }),
        ...(validDays !== undefined && { validDays }),
      },
    });

    await writeAuditLog({
      actorId: req.user?.userId,
      organizationId,
      action: 'coverage.auth_requirement.updated',
      resource: 'authorization_requirement',
      resourceId: item.id,
      details: { changes: req.body },
    });

    res.json({ success: true, data: item });
  }
);

coverageAdminRouter.delete(
  '/coverage/auth-requirements/:id',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    if (!organizationId) throw badRequest('Organization scope is required');

    const existing = await prisma.authorizationRequirement.findUnique({
      where: { id: req.params.id },
      include: { plan: { select: { organizationId: true } } },
    });
    if (!existing || existing.plan.organizationId !== organizationId) throw notFound('Authorization requirement not found');

    await prisma.authorizationRequirement.delete({ where: { id: req.params.id } });

    await writeAuditLog({
      actorId: req.user?.userId,
      organizationId,
      action: 'coverage.auth_requirement.deleted',
      resource: 'authorization_requirement',
      resourceId: req.params.id,
      details: { planId: existing.planId, serviceId: existing.serviceId },
    });

    res.json({ success: true, message: 'Authorization requirement deleted' });
  }
);

// ─── Coverage Policies ───────────────────────────────────────────────────────

coverageAdminRouter.get(
  '/coverage/policies',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    if (!organizationId) throw badRequest('Organization scope is required');

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;
    const status = (req.query.status as string) || undefined;

    const where: any = { organizationId };
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.coveragePolicy.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.coveragePolicy.count({ where }),
    ]);

    res.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
  }
);

coverageAdminRouter.post(
  '/coverage/policies',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    if (!organizationId) throw badRequest('Organization scope is required');

    const { name, rules, status, effectiveDate } = req.body;
    if (!name) throw badRequest('name is required');

    const item = await prisma.coveragePolicy.create({
      data: {
        name,
        rules: rules ?? undefined,
        status: status || 'DRAFT',
        version: 1,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
        auditTrail: [{ action: 'created', actor: req.user?.userId, timestamp: new Date().toISOString() }],
        organizationId,
      },
    });

    await writeAuditLog({
      actorId: req.user?.userId,
      organizationId,
      action: 'coverage.policy.created',
      resource: 'coverage_policy',
      resourceId: item.id,
      details: { name, status: item.status },
    });

    res.status(201).json({ success: true, data: item });
  }
);

coverageAdminRouter.get(
  '/coverage/policies/:id',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    if (!organizationId) throw badRequest('Organization scope is required');

    const item = await prisma.coveragePolicy.findFirst({
      where: { id: req.params.id, organizationId },
    });
    if (!item) throw notFound('Coverage policy not found');

    res.json({ success: true, data: item });
  }
);

coverageAdminRouter.put(
  '/coverage/policies/:id',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    if (!organizationId) throw badRequest('Organization scope is required');

    const existing = await prisma.coveragePolicy.findFirst({
      where: { id: req.params.id, organizationId },
    });
    if (!existing) throw notFound('Coverage policy not found');

    const { name, rules, status, effectiveDate } = req.body;

    // Build audit trail entry
    const currentTrail = Array.isArray(existing.auditTrail) ? existing.auditTrail : [];
    const auditEntry = {
      action: 'updated',
      actor: req.user?.userId,
      timestamp: new Date().toISOString(),
      changes: Object.keys(req.body),
      previousVersion: existing.version,
    };

    const item = await prisma.coveragePolicy.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(rules !== undefined && { rules }),
        ...(status !== undefined && { status }),
        ...(effectiveDate !== undefined && { effectiveDate: effectiveDate ? new Date(effectiveDate) : null }),
        version: existing.version + 1,
        auditTrail: [...currentTrail, auditEntry],
      },
    });

    await writeAuditLog({
      actorId: req.user?.userId,
      organizationId,
      action: 'coverage.policy.updated',
      resource: 'coverage_policy',
      resourceId: item.id,
      details: { changes: req.body, previousVersion: existing.version, newVersion: item.version },
    });

    res.json({ success: true, data: item });
  }
);

coverageAdminRouter.delete(
  '/coverage/policies/:id',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    if (!organizationId) throw badRequest('Organization scope is required');

    const existing = await prisma.coveragePolicy.findFirst({
      where: { id: req.params.id, organizationId },
    });
    if (!existing) throw notFound('Coverage policy not found');

    await prisma.coveragePolicy.delete({ where: { id: req.params.id } });

    await writeAuditLog({
      actorId: req.user?.userId,
      organizationId,
      action: 'coverage.policy.deleted',
      resource: 'coverage_policy',
      resourceId: req.params.id,
      details: { name: existing.name, version: existing.version },
    });

    res.json({ success: true, message: 'Coverage policy deleted' });
  }
);

// ─── Coverage Validation ─────────────────────────────────────────────────────

coverageAdminRouter.post(
  '/coverage/validate',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    if (!organizationId) throw badRequest('Organization scope is required');

    const { patientId, serviceId, planId } = req.body;
    if (!patientId || !serviceId || !planId) {
      throw badRequest('patientId, serviceId, and planId are required');
    }

    // Fetch the coverage plan
    const plan = await prisma.coveragePlan.findFirst({
      where: { id: planId, organizationId, status: 'ACTIVE' },
      include: {
        insuranceProvider: { select: { id: true, name: true, status: true } },
        serviceCoverages: { where: { serviceId } },
        authorizationRequirements: { where: { serviceId } },
      },
    });

    if (!plan) {
      res.json({
        success: true,
        data: {
          covered: false,
          reason: 'Plan not found or inactive',
          copay: null,
          priorAuthRequired: false,
          exclusions: ['Plan not available'],
        },
      });
      return;
    }

    // Check if insurance provider is active
    if (plan.insuranceProvider.status !== 'ACTIVE') {
      res.json({
        success: true,
        data: {
          covered: false,
          reason: 'Insurance provider is not active',
          copay: null,
          priorAuthRequired: false,
          exclusions: ['Insurance provider inactive'],
        },
      });
      return;
    }

    // Check service coverage
    const serviceCoverage = plan.serviceCoverages[0];
    if (!serviceCoverage) {
      // Service not explicitly listed — use plan defaults
      res.json({
        success: true,
        data: {
          covered: true,
          reason: 'Service covered under plan defaults',
          copay: plan.copay,
          coinsurance: plan.coinsurance,
          deductible: plan.deductible,
          priorAuthRequired: false,
          exclusions: [],
        },
      });
      return;
    }

    if (!serviceCoverage.covered) {
      res.json({
        success: true,
        data: {
          covered: false,
          reason: 'Service explicitly excluded from coverage',
          copay: null,
          priorAuthRequired: false,
          exclusions: ['Service not covered under this plan'],
        },
      });
      return;
    }

    // Check authorization requirements
    const authReq = plan.authorizationRequirements[0];
    const priorAuthRequired = authReq?.required ?? serviceCoverage.priorAuthRequired;

    res.json({
      success: true,
      data: {
        covered: true,
        reason: 'Service is covered',
        copay: serviceCoverage.copayAmount || plan.copay,
        coinsurance: plan.coinsurance,
        deductible: plan.deductible,
        priorAuthRequired,
        authorizationValidDays: authReq?.validDays ?? null,
        limits: serviceCoverage.limits,
        exclusions: [],
      },
    });
  }
);
