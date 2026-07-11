import { Router } from 'express';
import { z } from 'zod';
import { iamMiddlewareChain } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { createInvitationSchema } from './schemas';
import {
  createInvitation,
  listInvitations,
  revokeInvitation,
  acceptInvitation,
} from './invitation.service';

// ---------------------------------------------------------------------------
// Accept invitation body schema (public endpoint — no auth required)
// ---------------------------------------------------------------------------

const acceptInvitationSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  password: z.string().min(8),
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const invitationRouter = Router();

// Roles allowed to manage invitations
const manageRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN'];

// ---------------------------------------------------------------------------
// POST /api/iam/invitations — Create invitation (authenticated)
// Requirements: 6.1, 6.3
// ---------------------------------------------------------------------------
invitationRouter.post(
  '/',
  ...iamMiddlewareChain(manageRoles),
  validateBody(createInvitationSchema),
  async (req, res, next) => {
    try {
      const result = await createInvitation({
        email: req.body.email,
        role: req.body.role,
        expiresInHours: req.body.expiresInHours,
        organizationId: req.user!.organizationId ?? req.body.organizationId,
        actorId: req.user!.userId,
        actorRole: req.user!.role,
      });

      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/iam/invitations — List invitations (authenticated, org-scoped)
// Requirements: 6.7, 6.8
// ---------------------------------------------------------------------------
invitationRouter.get(
  '/',
  ...iamMiddlewareChain(manageRoles),
  async (req, res, next) => {
    try {
      const page = parseInt(String(req.query.page ?? '1'), 10);
      const limit = parseInt(String(req.query.limit ?? '20'), 10);
      const status = req.query.status ? String(req.query.status) : undefined;

      const result = await listInvitations({
        organizationId: req.orgFilter?.organizationId,
        status,
        page,
        limit,
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /api/iam/invitations/:id/revoke — Revoke invitation (authenticated)
// Requirements: 6.9
// ---------------------------------------------------------------------------
invitationRouter.patch(
  '/:id/revoke',
  ...iamMiddlewareChain(manageRoles),
  async (req, res, next) => {
    try {
      const result = await revokeInvitation({
        invitationId: req.params.id,
        actorId: req.user!.userId,
        organizationId: req.orgFilter?.organizationId,
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/iam/invitations/:token/accept — Accept invitation (public)
// Requirements: 6.3, 6.8
// ---------------------------------------------------------------------------
invitationRouter.post(
  '/:token/accept',
  validateBody(acceptInvitationSchema),
  async (req, res, next) => {
    try {
      const result = await acceptInvitation({
        token: req.params.token,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        password: req.body.password,
      });

      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);
