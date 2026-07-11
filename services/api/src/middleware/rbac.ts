import { NextFunction, Request, Response, RequestHandler } from 'express';
import { forbidden, unauthorized } from '../lib/http';
import { requireAuth } from './auth';
import { enforceOrgScope } from './org-scope';

/**
 * RBAC middleware that verifies the authenticated user's role has the required
 * permission before allowing the request to proceed.
 *
 * If the permission check fails, returns 403 with an "Insufficient permissions"
 * error and does NOT evaluate organization-scope rules (Requirement 8.4, 8.8).
 */
export function allowRoles(roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(unauthorized('Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(forbidden('Insufficient permissions'));
    }

    next();
  };
}

/**
 * Canonical IAM middleware chain that enforces the correct evaluation order:
 *
 *   1. requireAuth — JWT verification, extracts userId/role/orgId
 *   2. allowRoles — Permission/role check (returns 403 if insufficient)
 *   3. enforceOrgScope — Organization boundary enforcement
 *
 * This ordering guarantees that permission checks short-circuit BEFORE
 * organization-scope rules are evaluated (Requirements 8.4, 8.8).
 *
 * Usage:
 *   router.use(...iamMiddlewareChain(['SUPER_ADMIN', 'COMPANY_ADMIN']));
 *   // or on individual routes:
 *   router.get('/resource', ...iamMiddlewareChain(['SUPER_ADMIN']), handler);
 */
export function iamMiddlewareChain(roles: string[]): RequestHandler[] {
  return [requireAuth, allowRoles(roles), enforceOrgScope];
}
