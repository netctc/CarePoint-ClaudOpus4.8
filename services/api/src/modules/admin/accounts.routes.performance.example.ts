import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { prisma } from '../../lib/prisma';
import {
  buildAccountListPage,
  buildAccountOrderBy,
  buildAccountSearchWhere,
  normalizeAccountListQuery,
} from '../../lib/account-list-query';

export const adminAccountsPerformanceExampleRouter = Router();

adminAccountsPerformanceExampleRouter.use(requireAuth);
adminAccountsPerformanceExampleRouter.use(allowRoles(['SUPER_ADMIN', 'COMPANY_ADMIN', 'SUPPORT']));

adminAccountsPerformanceExampleRouter.get('/accounts', async (req, res) => {
  const query = normalizeAccountListQuery(req.query as Record<string, unknown>);

  // Preserve organization boundaries for non-super-admin users.
  const forcedOrganizationId = req.user?.role === 'SUPER_ADMIN' ? undefined : req.user?.organizationId;
  const where = buildAccountSearchWhere(query, forcedOrganizationId);

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip: query.skip,
      take: query.take,
      orderBy: buildAccountOrderBy(query),
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  res.json(
    buildAccountListPage({
      total,
      query,
      items: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        organizationId: user.organizationId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })),
    }),
  );
});
