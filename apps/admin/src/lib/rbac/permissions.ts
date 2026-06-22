import type { AdminPermission, AdminRole } from './roles';

export const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  super_admin: [
    'dashboard:view',
    'providers:view',
    'providers:review',
    'providers:approve',
    'bookings:control',
    'catalog:manage',
    'coverage:manage',
    'telehealth:ops',
    'finance:view',
    'refunds:manage',
    'pricing:manage',
    'reviews:moderate',
    'support:view',
    'safety:view',
    'policy:manage',
    'audit:view',
    'rbac:manage',
    'reports:view',
    'notifications:manage',
    'integrations:manage'
  ],
  ops_admin: [
    'dashboard:view',
    'providers:view',
    'providers:review',
    'bookings:control',
    'catalog:manage',
    'coverage:manage',
    'telehealth:ops',
    'pricing:manage',
    'reviews:moderate',
    'reports:view',
    'notifications:manage'
  ],
  provider_reviewer: ['dashboard:view', 'providers:view', 'providers:review', 'providers:approve'],
  finance_admin: ['dashboard:view', 'providers:view', 'finance:view', 'refunds:manage', 'pricing:manage', 'reports:view'],
  support_admin: ['dashboard:view', 'providers:view', 'support:view', 'bookings:control', 'telehealth:ops', 'reviews:moderate', 'notifications:manage'],
  safety_admin: ['dashboard:view', 'safety:view', 'audit:view', 'telehealth:ops', 'policy:manage', 'reports:view'],
  readonly_auditor: ['dashboard:view', 'audit:view', 'reports:view']
};

export function hasPermission(role: AdminRole, permission: AdminPermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function requirePermission<T>(role: AdminRole, permission: AdminPermission, value: T): T | null {
  return hasPermission(role, permission) ? value : null;
}
