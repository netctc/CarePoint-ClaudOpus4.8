import { Router } from 'express';
import { userRoleCatalog, userRoles } from '@care-center/contracts';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { badRequest, forbidden, notFound } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { writeAuditLog } from '../../lib/audit';

export const rbacRouter = Router();
const adminRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT'];
const roleEditors = ['SUPER_ADMIN', 'COMPANY_ADMIN'];

const roleCatalog = userRoleCatalog;

const permissionMatrix = {
  dashboard: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'FINANCE'],
  providers: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT'],
  providerOnboarding: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT'],
  bookingControl: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT'],
  telehealthOperations: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT'],
  payments: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'FINANCE'],
  refunds: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'FINANCE'],
  auditLogs: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'FINANCE'],
  accessReview: ['SUPER_ADMIN', 'COMPANY_ADMIN'],
} as const;

rbacRouter.use(requireAuth);
rbacRouter.use(allowRoles(adminRoles));

function isValidRole(role: string) {
  return userRoles.includes(role as (typeof userRoles)[number]);
}

async function getScopedUser(userId: string, organizationId?: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user) {
    throw notFound('User not found');
  }
  if (organizationId) {
    if (!user.organizationId || user.organizationId !== organizationId) {
      throw notFound('User not found');
    }
  }
  return user;
}

function summarizeAssignment(user: any) {
  return {
    id: user.id,
    email: user.email,
    name: `${user.firstName} ${user.lastName}`.trim(),
    role: user.role,
    organizationId: user.organizationId,
    accessScope: user.organizationId ? 'organization' : 'platform',
    requiresMfaEnrollment: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'FINANCE'].includes(user.role),
    status: 'ACTIVE',
  };
}

rbacRouter.get('/roles', async (_req, res) => {
  res.json({ items: roleCatalog });
});

rbacRouter.get('/matrix', async (_req, res) => {
  res.json({ items: permissionMatrix });
});

rbacRouter.get('/assignments', async (req, res) => {
  const organizationId = req.user?.organizationId;
  const q = String(req.query.q ?? '').trim().toLowerCase();
  const role = String(req.query.role ?? '').trim();

  const users = await prisma.user.findMany({
    where: {
      ...(organizationId ? { organizationId } : {}),
      ...(role ? { role: role as any } : {}),
    },
    orderBy: [{ role: 'asc' }, { firstName: 'asc' }, { lastName: 'asc' }],
  });

  const items = users
    .map(summarizeAssignment)
    .filter((item) => {
      if (!q) return true;
      return [item.email, item.name, item.role].join(' ').toLowerCase().includes(q);
    });

  res.json({ items, count: items.length });
});

rbacRouter.get('/assignments/:userId', async (req, res) => {
  const user = await getScopedUser(req.params.userId, req.user?.organizationId);
  res.json({ item: summarizeAssignment(user) });
});

rbacRouter.post('/assignments/:userId/role', allowRoles(roleEditors), async (req, res) => {
  const target = await getScopedUser(req.params.userId, req.user?.organizationId);
  const nextRole = String(req.body?.role ?? '').trim().toUpperCase();
  const reason = String(req.body?.reason ?? '').trim() || null;

  if (!nextRole || !isValidRole(nextRole)) {
    throw badRequest('A valid role is required');
  }

  if (req.user?.role !== 'SUPER_ADMIN' && nextRole === 'SUPER_ADMIN') {
    throw forbidden('Only a SUPER_ADMIN can assign the SUPER_ADMIN role');
  }

  if (req.user?.role !== 'SUPER_ADMIN' && target.role === 'SUPER_ADMIN') {
    throw forbidden('Only a SUPER_ADMIN can modify a SUPER_ADMIN account');
  }

  if (req.user?.userId === target.id && target.role !== nextRole) {
    throw forbidden('You cannot change your own role from this endpoint');
  }

  if (target.organizationId && target.role === 'COMPANY_ADMIN' && nextRole !== 'COMPANY_ADMIN') {
    const adminCount = await prisma.user.count({
      where: {
        organizationId: target.organizationId,
        role: 'COMPANY_ADMIN',
      },
    });
    if (adminCount <= 1) {
      throw forbidden('At least one COMPANY_ADMIN must remain assigned to the organization');
    }
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: { role: nextRole as any },
  });

  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId: req.user?.organizationId,
    action: 'rbac.role_changed',
    resource: 'user',
    resourceId: updated.id,
    details: {
      previousRole: target.role,
      nextRole,
      reason,
    },
  });

  res.json({ item: summarizeAssignment(updated) });
});

rbacRouter.post('/access-review/run', allowRoles(roleEditors), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const users = await prisma.user.findMany({
    where: organizationId ? { organizationId } : undefined,
    select: { id: true, email: true, firstName: true, lastName: true, role: true },
  });

  const privileged = users.filter((user) => ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'FINANCE'].includes(user.role));
  const staleCandidates = users.filter((user) => ['COMPANY_SUPPORT', 'FINANCE'].includes(user.role));

  const review = {
    generatedAt: new Date(),
    generatedBy: req.user?.userId ?? null,
    privilegedAssignments: privileged.map((user) => ({
      id: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`.trim(),
      role: user.role,
    })),
    reviewCandidates: staleCandidates.map((user) => ({
      id: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`.trim(),
      role: user.role,
      reason: 'Privileged role requires quarterly certification',
    })),
  };

  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId,
    action: 'rbac.access_review_run',
    resource: 'rbac_review',
    resourceId: organizationId,
    details: {
      privilegedCount: review.privilegedAssignments.length,
      candidateCount: review.reviewCandidates.length,
      note: String(req.body?.note ?? '').trim() || null,
    },
  });

  res.json({ review });
});

rbacRouter.get('/summary', async (req, res) => {
  const organizationId = req.user?.organizationId;
  const users = await prisma.user.findMany({
    where: organizationId ? { organizationId } : undefined,
    select: { role: true },
  }) as Array<{ role: string }>;

  const byRole = users.reduce<Record<string, number>>((acc, user) => {
    acc[user.role] = (acc[user.role] ?? 0) + 1;
    return acc;
  }, {});

  const privilegedUsers = users.filter((user) => ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'FINANCE'].includes(user.role)).length;

  res.json({
    summary: {
      totalUsers: users.length,
      privilegedUsers,
      rolesDefined: roleCatalog.length,
      byRole,
    },
  });
});
