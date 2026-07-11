import { Router } from 'express';
import { iamMiddlewareChain } from '../../middleware/rbac';
import { prisma } from '../../lib/prisma';

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const accessReviewRouter = Router();

// Roles allowed to view access reviews
const reviewRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN'];

// ---------------------------------------------------------------------------
// GET /api/iam/access-review — List users needing role re-certification
// Requirements: 2.7
//
// Returns users holding SUPER_ADMIN or COMPANY_ADMIN roles whose last role
// certification is older than 90 days. Uses the last audit log entry with
// action 'rbac.access_review_run' or 'user.role_change' referencing the user
// as a proxy for certification timestamp, since the User model does not have
// a dedicated `lastRoleCertifiedAt` field.
//
// NOTE: If a dedicated `lastRoleCertifiedAt` field is added to the User model
// in the future, this logic should be updated to use that field directly for
// better performance and accuracy.
// ---------------------------------------------------------------------------
accessReviewRouter.get(
  '/',
  ...iamMiddlewareChain(reviewRoles),
  async (req, res, next) => {
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      // Build the where clause for users
      const where: Record<string, unknown> = {
        role: { in: ['SUPER_ADMIN', 'COMPANY_ADMIN'] },
        status: 'ACTIVE',
      };

      // Organization scoping: Company_Admin can only see users in their org
      if (req.orgFilter?.organizationId) {
        where.organizationId = req.orgFilter.organizationId;
      }

      // Fetch all privileged users matching criteria
      const privilegedUsers = await prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          organizationId: true,
          createdAt: true,
        },
      });

      // For each user, find the most recent certification audit entry
      // Certification is represented by audit actions:
      //   - 'rbac.access_review_run' (explicit access review)
      //   - 'user.role_change' where the user is the resource (role was re-certified)
      const usersNeedingReview = [];

      for (const user of privilegedUsers) {
        const lastCertification = await prisma.auditLog.findFirst({
          where: {
            OR: [
              {
                action: 'rbac.access_review_run',
                resourceId: user.id,
              },
              {
                action: 'user.role_certified',
                resourceId: user.id,
              },
              {
                action: 'user.role_change',
                resourceId: user.id,
              },
            ],
          },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        });

        const lastCertifiedAt = lastCertification?.createdAt ?? null;

        // Include user if never certified or certified more than 90 days ago
        if (!lastCertifiedAt || lastCertifiedAt < ninetyDaysAgo) {
          usersNeedingReview.push({
            id: user.id,
            email: user.email,
            name: `${user.firstName} ${user.lastName}`.trim(),
            role: user.role,
            organizationId: user.organizationId,
            lastCertifiedAt: lastCertifiedAt?.toISOString() ?? null,
          });
        }
      }

      res.json({
        items: usersNeedingReview,
        total: usersNeedingReview.length,
        staleDaysThreshold: 90,
      });
    } catch (err) {
      next(err);
    }
  },
);
