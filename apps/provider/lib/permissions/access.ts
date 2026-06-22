import { canRoleViewLimitedPhi, type ProviderPortalFeature } from '@care-center/contracts';
import type { ProviderRole } from './roles';
import { portalPermissions } from './roles';

export function hasPortalAccess(feature: ProviderPortalFeature, role: ProviderRole) {
  return portalPermissions[feature].includes(role);
}

export function canViewLimitedPhi(role: ProviderRole) {
  return canRoleViewLimitedPhi(role);
}
