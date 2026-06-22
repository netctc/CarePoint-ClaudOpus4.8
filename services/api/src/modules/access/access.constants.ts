import {
  canRoleViewLimitedPhi,
  providerPortalPermissions,
  type UserRole,
  userRoles,
  limitedPhiRoles,
} from '@care-center/contracts';

export const availableRoles = userRoles;
export { limitedPhiRoles };

export const portalPermissions = providerPortalPermissions;

export function canViewLimitedPhi(role: UserRole | string) {
  return canRoleViewLimitedPhi(role);
}
