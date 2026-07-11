import { NextFunction, Request, Response } from 'express';
import { unauthorized } from '../lib/http';

export type OrgFilter = {
  organizationId: string;
};

declare global {
  namespace Express {
    interface Request {
      orgFilter?: OrgFilter;
    }
  }
}

/**
 * Middleware that enforces organization boundaries for non-SUPER_ADMIN users.
 *
 * - SUPER_ADMIN bypasses org scoping entirely (cross-org access).
 * - All other roles must have an organizationId in their JWT; rejects with 401 if missing.
 * - Attaches `req.orgFilter = { organizationId }` for downstream handlers to use in queries.
 */
export function enforceOrgScope(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(unauthorized('Authentication required'));
  }

  // SUPER_ADMIN bypasses org scoping
  if (req.user.role === 'SUPER_ADMIN') {
    return next();
  }

  // All other roles must have organizationId in JWT
  if (!req.user.organizationId) {
    return next(unauthorized('Missing organization context'));
  }

  // Attach org filter for use in handlers
  req.orgFilter = { organizationId: req.user.organizationId };
  next();
}
