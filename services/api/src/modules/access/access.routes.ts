import { Router } from 'express';
import { roleAssignmentCreateSchema, roleAssignmentUpdateSchema } from '@care-center/contracts';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { badRequest, notFound } from '../../lib/http';
import { writeAuditLog } from '../../lib/audit';
import { availableRoles, canViewLimitedPhi, limitedPhiRoles, portalPermissions } from './access.constants';

export const accessRouter = Router();
accessRouter.use(requireAuth);
accessRouter.use(allowRoles(['COMPANY_ADMIN', 'SUPER_ADMIN']));

function labelize(value: string) {
  return value.toLowerCase().split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function serializeAssignment(item: any) {
  const fullName = `${item.user.firstName} ${item.user.lastName}`.trim();

  return {
    id: item.id,
    userId: item.userId,
    userName: fullName || item.user.email,
    userEmail: item.user.email,
    role: labelize(item.role),
    roleCode: item.role,
    grantScope: item.grantScope,
    mfaStatus: labelize(item.mfaStatus),
    mfaStatusCode: item.mfaStatus,
    accessReview: labelize(item.accessReviewStatus),
    accessReviewCode: item.accessReviewStatus,
    assignedAt: item.assignedAt,
    reviewedAt: item.reviewedAt,
    isActive: !item.deactivatedAt,
    canViewLimitedPhi: canViewLimitedPhi(item.role),
  };
}

accessRouter.get('/roles', async (_req, res) => {
  res.json({ items: availableRoles });
});

accessRouter.get('/permissions', async (_req, res) => {
  res.json({
    items: Object.entries(portalPermissions).map(([feature, roles]) => ({ feature, roles })),
    limitedPhiRoles: [...limitedPhiRoles],
    permissions: portalPermissions,
  });
});

accessRouter.get('/assignments', async (req, res) => {
  const activeOnly = req.query.active !== 'false';
  const items = await prisma.roleAssignment.findMany({
    where: activeOnly ? { deactivatedAt: null } : undefined,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: [{ deactivatedAt: 'asc' }, { assignedAt: 'desc' }],
  });

  res.json({ items: items.map(serializeAssignment) });
});

accessRouter.post('/assignments', validateBody(roleAssignmentCreateSchema), async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.body.userId } });
  if (!user) {
    throw notFound('User not found');
  }

  const duplicate = await prisma.roleAssignment.findFirst({
    where: {
      userId: req.body.userId,
      role: req.body.role,
      deactivatedAt: null,
    },
    select: { id: true },
  });

  if (duplicate) {
    throw badRequest('An active assignment for this user and role already exists');
  }

  const created = await prisma.roleAssignment.create({
    data: {
      userId: req.body.userId,
      role: req.body.role,
      grantScope: req.body.grantScope,
      mfaStatus: req.body.mfaStatus,
      accessReviewStatus: req.body.accessReviewStatus,
      assignedById: req.user!.userId,
      reviewedAt: req.body.accessReviewStatus === 'CERTIFIED' ? new Date() : undefined,
    },
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true } },
    },
  });

  await writeAuditLog({
    actorId: req.user!.userId,
    organizationId: req.user!.organizationId,
    action: 'access.assignment_created',
    resource: 'role_assignment',
    resourceId: created.id,
    details: {
      userId: created.userId,
      role: created.role,
      grantScope: created.grantScope,
    },
  });

  res.status(201).json(serializeAssignment(created));
});

accessRouter.patch('/assignments/:assignmentId', validateBody(roleAssignmentUpdateSchema), async (req, res) => {
  const existing = await prisma.roleAssignment.findUnique({
    where: { id: req.params.assignmentId },
    include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
  });

  if (!existing) {
    throw notFound('Role assignment not found');
  }

  const updated = await prisma.roleAssignment.update({
    where: { id: existing.id },
    data: {
      grantScope: req.body.grantScope,
      mfaStatus: req.body.mfaStatus,
      accessReviewStatus: req.body.accessReviewStatus,
      reviewedAt: req.body.reviewedAt ? new Date(req.body.reviewedAt) : req.body.accessReviewStatus === 'CERTIFIED' ? new Date() : existing.reviewedAt,
    },
    include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
  });

  await writeAuditLog({
    actorId: req.user!.userId,
    organizationId: req.user!.organizationId,
    action: 'access.assignment_updated',
    resource: 'role_assignment',
    resourceId: updated.id,
    details: req.body,
  });

  res.json(serializeAssignment(updated));
});

accessRouter.patch('/assignments/:assignmentId/deactivate', async (req, res) => {
  const existing = await prisma.roleAssignment.findUnique({
    where: { id: req.params.assignmentId },
    include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
  });

  if (!existing) {
    throw notFound('Role assignment not found');
  }

  const updated = await prisma.roleAssignment.update({
    where: { id: existing.id },
    data: { deactivatedAt: new Date() },
    include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
  });

  await writeAuditLog({
    actorId: req.user!.userId,
    organizationId: req.user!.organizationId,
    action: 'access.assignment_deactivated',
    resource: 'role_assignment',
    resourceId: updated.id,
    details: { role: updated.role, userId: updated.userId },
  });

  res.json(serializeAssignment(updated));
});
