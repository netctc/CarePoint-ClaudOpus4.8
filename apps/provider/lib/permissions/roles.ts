import {
  providerPortalFeatures,
  providerPortalPermissions,
  type ProviderPortalFeature as PortalFeature,
  type UserRole,
} from '@care-center/contracts';

export type ProviderRole = Exclude<UserRole, 'PATIENT'>;
export { providerPortalFeatures, providerPortalPermissions as portalPermissions };
export type { PortalFeature };
