import { Router } from 'express';
import { iamMiddlewareChain } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { changeRoleSchema } from '../iam/schemas';
import { prisma } from '../../lib/prisma';
import { badRequest, forbidden, notFound } from '../../lib/http';
import { writeAuditLog } from '../../lib/audit';

export const userRoleRouter = Router();

/**
 * PATCH /api/access/users/:id/role
 *
 * Changes a user's role with:
 * - Validation via changeRoleSchema (role + reason 1-500 chars)
 * - COMPANY_ADMIN cannot assign SUPER_ADMIN (403)
 * - Last COMPANY_ADMIN protection (400)
 * - Refresh token revocation on role change (within transaction)
 * - Audit entry with previousRole, newRole, reason, actorId
 *
 * Requirements: 2.3, 2.4, 2.5, 2.6, 2.8
 */
userRoleRouter.patch(
  '/users/:id/role',
  ...iamMiddlewareChain(['SUPER_ADMIN', 'COMPANY_ADMIN']),
  validateBody(changeRoleSchema),
  async (req, res) => {
    const targetUserId = req.params.id;
    const { role: newRole, reason } = req.body;
    const actor = req.user!;

    // Find target user
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw notFound('User not found');
    }

    // Organization boundary: Company_Admin can only change roles within their own org
    if (actor.role === 'COMPANY_ADMIN') {
      if (!targetUser.organizationId || targetUser.organizationId !== actor.organizationId) {
        throw notFound('User not found');
      }
    }

    // Check: Company_Admin cannot assign SUPER_ADMIN role (Requirement 2.4)
    if (actor.role === 'COMPANY_ADMIN' && newRole === 'SUPER_ADMIN') {
      throw forbidden('Company administrators cannot assign the SUPER_ADMIN role');
    }

    // Check: Cannot change a SUPER_ADMIN user's role unless you are SUPER_ADMIN
    if (targetUser.role === 'SUPER_ADMIN' && actor.role !== 'SUPER_ADMIN') {
      throw forbidden('Only a SUPER_ADMIN can modify a SUPER_ADMIN account');
    }

    // If role isn't actually changing, still allow (idempotent) but skip revocation
    if (targetUser.role === newRole) {
      return res.json({
        id: targetUser.id,
        email: targetUser.email,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        role: targetUser.role,
        organizationId: targetUser.organizationId,
        status: targetUser.status,
      });
    }

    // Check: Last COMPANY_ADMIN protection (Requirement 2.5)
    if (targetUser.role === 'COMPANY_ADMIN' && newRole !== 'COMPANY_ADMIN' && targetUser.organizationId) {
      const adminCount = await prisma.user.count({
        where: {
          organizationId: targetUser.organizationId,
          role: 'COMPANY_ADMIN',
          status: 'ACTIVE',
        },
      });

      if (adminCount <= 1) {
        throw badRequest(
          'Cannot change role: the organization must retain at least one COMPANY_ADMIN',
        );
      }
    }

    const previousRole = targetUser.role;

    // Within a transaction: update role + revoke all refresh tokens (Requirement 2.8)
    const updatedUser = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: targetUserId },
        data: { role: newRole },
      });

      // Revoke all refresh tokens for the user
      await tx.refreshToken.updateMany({
        where: {
          userId: targetUserId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      return updated;
    });

    // Write audit entry (Requirement 2.3, 2.6)
    await writeAuditLog({
      actorId: actor.userId,
      organizationId: actor.organizationId ?? targetUser.organizationId ?? undefined,
      action: 'access.role_changed',
      resource: 'user',
      resourceId: updatedUser.id,
      details: {
        previousRole,
        newRole,
        reason,
        actorId: actor.userId,
      },
    });

    res.json({
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      role: updatedUser.role,
      organizationId: updatedUser.organizationId,
      status: updatedUser.status,
    });
  },
);
