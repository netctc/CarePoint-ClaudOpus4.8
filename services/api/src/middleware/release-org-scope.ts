import { Router } from 'express';
import { forbidden } from '../lib/http';
import { requireAuth } from './auth';

// Release-v1 boundary for multi-tenant surfaces whose underlying legacy
// queries historically treated a missing organizationId as an unscoped query.
// SUPER_ADMIN is the only role permitted to operate without an organization
// scope; every other authenticated role must fail closed.
export const releaseOrganizationScopeGuard = Router();

releaseOrganizationScopeGuard.use(requireAuth);
releaseOrganizationScopeGuard.use((req, _res, next) => {
  if (req.user?.role === 'SUPER_ADMIN') {
    next();
    return;
  }

  if (!req.user?.organizationId) {
    next(forbidden('Organization scope is required for this resource'));
    return;
  }

  next();
});
