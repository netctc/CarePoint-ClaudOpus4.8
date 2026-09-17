import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { badRequest, forbidden, notFound } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { writeAuditLog } from '../../lib/audit';

const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  COMPANY_ADMIN: 'COMPANY_ADMIN',
  COMPANY_SUPPORT: 'COMPANY_SUPPORT',
  PROVIDER: 'PROVIDER',
  NURSE: 'NURSE',
  PHARMACIST: 'PHARMACIST',
  LAB_TECH: 'LAB_TECH',
  FINANCE: 'FINANCE',
  PATIENT: 'PATIENT',
} as const;
type UserRole = (typeof UserRole)[keyof typeof UserRole];

const AccountStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  ARCHIVED: 'ARCHIVED',
} as const;
type AccountStatus = (typeof AccountStatus)[keyof typeof AccountStatus];

const adminRoles = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.COMPANY_SUPPORT];
const accountStatuses = Object.values(AccountStatus);
const defaultOrganizationName = 'Unassigned CarePoint Organization';

export const iamUsersRouter = Router();
iamUsersRouter.use(requireAuth, allowRoles(adminRoles));

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeEmail(value: unknown) {
  return clean(value).toLowerCase();
}

function isSuperAdmin(req: any) {
  return req.user?.role === UserRole.SUPER_ADMIN;
}

async function ensureFallbackOrganization() {
  const existing = await prisma.organization.findFirst({
    where: { name: { equals: defaultOrganizationName, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) return existing;

  return prisma.organization.create({
    data: { name: defaultOrganizationName },
    select: { id: true },
  });
}

async function resolveOrganizationId(req: any, requested: unknown) {
  if (!isSuperAdmin(req)) {
    if (!req.user?.organizationId) throw badRequest('Organization context is required');
    return req.user.organizationId;
  }

  const explicit = clean(requested);
  if (explicit) {
    const organization = await prisma.organization.findUnique({
      where: { id: explicit },
      select: { id: true },
    });
    if (!organization) throw badRequest('Selected organization was not found');
    return organization.id;
  }

  return (await ensureFallbackOrganization()).id;
}

async function assertEmailAvailable(email: string) {
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw badRequest('Email is already used by another account');
}

async function safeAudit(input: Parameters<typeof writeAuditLog>[0]) {
  try {
    const actorId = input.actorId
      ? (await prisma.user.findUnique({ where: { id: input.actorId }, select: { id: true } }).catch(() => null))?.id
      : null;
    await writeAuditLog({ ...input, actorId: actorId ?? undefined });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[iam-users] Account operation completed but audit logging failed.', error);
    }
  }
}

function mapUser(user: any) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    name: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    role: user.role,
    status: user.status ?? AccountStatus.ACTIVE,
    organizationId: user.organizationId ?? null,
    organizationName: user.organization?.name ?? null,
    deactivatedAt: user.deactivatedAt ?? null,
    createdAt: user.createdAt,
  };
}

/**
 * GET /api/admin/users/iam-users
 *
 * Prisma enum fields do not support `contains`. Text fields use case-insensitive
 * partial matching while role search is translated into a valid enum `in`
 * filter using matching role names.
 */
iamUsersRouter.get('/', async (req, res) => {
  const page = Math.max(1, Number.parseInt(clean(req.query.page) || '1', 10) || 1);
  const pageSize = Math.max(1, Math.min(100, Number.parseInt(clean(req.query.pageSize) || '20', 10) || 20));
  const search = clean(req.query.search).toLowerCase();
  const skip = (page - 1) * pageSize;

  const orgWhere: any = req.user?.organizationId && !isSuperAdmin(req)
    ? { organizationId: req.user.organizationId }
    : {};

  const matchingRoles = search
    ? Object.values(UserRole).filter((role) => role.toLowerCase().includes(search))
    : [];

  const searchWhere: any = search
    ? {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          ...(matchingRoles.length > 0 ? [{ role: { in: matchingRoles } }] : []),
          ...(search.includes(' ')
            ? [
                {
                  AND: search.split(/\s+/).map((part) => ({
                    OR: [
                      { firstName: { contains: part, mode: 'insensitive' } },
                      { lastName: { contains: part, mode: 'insensitive' } },
                    ],
                  })),
                },
              ]
            : []),
        ],
      }
    : {};

  const where = { ...orgWhere, ...searchWhere };
  const [items, totalCount] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { organization: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  res.json({
    items: items.map(mapUser),
    page,
    pageSize,
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
  });
});

iamUsersRouter.post('/', async (req, res) => {
  const firstName = clean(req.body?.firstName);
  const lastName = clean(req.body?.lastName);
  const email = normalizeEmail(req.body?.email);
  const role = clean(req.body?.role).toUpperCase();

  if (!firstName) throw badRequest('firstName is required');
  if (!lastName) throw badRequest('lastName is required');
  if (!email) throw badRequest('email is required');
  if (!role) throw badRequest('role is required');
  if (!email.includes('@') || !email.includes('.')) throw badRequest('email must be a valid email address');

  const validRoles = Object.values(UserRole);
  if (!validRoles.includes(role as UserRole)) {
    throw badRequest(`role must be one of: ${validRoles.join(', ')}`);
  }

  await assertEmailAvailable(email);
  const organizationId = await resolveOrganizationId(req, req.body?.organizationId);
  const temporaryPassword = clean(req.body?.password) || 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  const user = await prisma.user.create({
    data: {
      email,
      firstName,
      lastName,
      role,
      organizationId,
      passwordHash,
      status: AccountStatus.ACTIVE,
    },
    include: { organization: { select: { id: true, name: true } } },
  });

  await safeAudit({
    actorId: req.user?.userId,
    organizationId,
    action: 'admin.user.created',
    resource: 'user',
    resourceId: user.id,
    details: { email, role, firstName, lastName },
  });

  res.status(201).json({ item: mapUser(user) });
});

iamUsersRouter.get('/:userId', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.userId },
    include: { organization: { select: { id: true, name: true } } },
  });

  if (!user) throw notFound('User not found');
  if (!isSuperAdmin(req) && req.user?.organizationId && user.organizationId !== req.user.organizationId) {
    throw forbidden('Requested account is outside the current organization scope');
  }

  res.json({ item: mapUser(user) });
});

iamUsersRouter.patch('/:userId/status', async (req, res) => {
  const newStatus = clean(req.body?.status).toUpperCase();
  if (!newStatus || !accountStatuses.includes(newStatus as AccountStatus)) {
    throw badRequest(`status must be one of: ${accountStatuses.join(', ')}`);
  }

  const user = await prisma.user.findUnique({
    where: { id: req.params.userId },
    include: { organization: { select: { id: true, name: true } } },
  });
  if (!user) throw notFound('User not found');

  if (!isSuperAdmin(req) && req.user?.organizationId && user.organizationId !== req.user.organizationId) {
    throw forbidden('Requested account is outside the current organization scope');
  }

  const previousStatus = (user.status ?? AccountStatus.ACTIVE) as AccountStatus;
  const status = newStatus as AccountStatus;
  const nowInactive = status !== AccountStatus.ACTIVE;
  const updateData = {
    status,
    deactivatedAt: nowInactive ? new Date() : null,
    deactivationReason: nowInactive ? clean(req.body?.reason) || null : null,
  };

  await prisma.$transaction(async (tx: any) => {
    await tx.user.update({ where: { id: user.id }, data: updateData });
    if (status === AccountStatus.SUSPENDED) {
      await tx.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  });

  const action = status === AccountStatus.ACTIVE && previousStatus !== AccountStatus.ACTIVE
    ? 'admin.user.restored'
    : status === AccountStatus.SUSPENDED
      ? 'admin.user.suspended'
      : status === AccountStatus.ARCHIVED
        ? 'admin.user.archived'
        : 'admin.user.status_changed';

  await safeAudit({
    actorId: req.user?.userId,
    organizationId: user.organizationId ?? undefined,
    action,
    resource: 'user',
    resourceId: user.id,
    details: { previousStatus, newStatus: status, reason: updateData.deactivationReason },
  });

  const updated = await prisma.user.findUnique({
    where: { id: user.id },
    include: { organization: { select: { id: true, name: true } } },
  });

  res.json({ item: mapUser(updated) });
});
