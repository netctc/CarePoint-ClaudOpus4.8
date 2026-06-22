import type { AdminPermission, AdminRole } from './roles';
import { hasPermission } from './permissions';

export type PortalRoute = {
  href: string;
  label: string;
  permission: AdminPermission;
};

export const PORTAL_ROUTES: PortalRoute[] = [
  { href: '/portal/dashboard', label: 'Dashboard', permission: 'dashboard:view' },
  { href: '/portal/providers', label: 'CarePoint Provider', permission: 'providers:view' },
  { href: '/portal/providers/onboarding', label: 'Provider Queue', permission: 'providers:review' },
  { href: '/portal/catalog/services', label: 'Service Catalog', permission: 'catalog:manage' },
  { href: '/portal/coverage', label: 'Coverage', permission: 'coverage:manage' },
  { href: '/portal/bookings/control-tower', label: 'Booking Control', permission: 'bookings:control' },
  { href: '/portal/telehealth/operations', label: 'Telehealth Ops', permission: 'telehealth:ops' },
  { href: '/portal/payments/reconciliation', label: 'Payments', permission: 'finance:view' },
  { href: '/portal/payments/refunds', label: 'Refunds', permission: 'refunds:manage' },
  { href: '/portal/pricing/commissions', label: 'Pricing Rules', permission: 'pricing:manage' },
  { href: '/portal/reviews/moderation', label: 'Review Moderation', permission: 'reviews:moderate' },
  { href: '/portal/support/console', label: 'Support Console', permission: 'support:view' },
  { href: '/portal/safety/incidents', label: 'Safety Cases', permission: 'safety:view' },
  { href: '/portal/policy/templates', label: 'Policy Templates', permission: 'policy:manage' },
  { href: '/portal/access/rbac', label: 'Access & RBAC', permission: 'rbac:manage' },
  { href: '/portal/access/hsp-consents', label: 'HSP Consent Access', permission: 'rbac:manage' },
  { href: '/portal/audit/logs', label: 'Audit Logs', permission: 'audit:view' },
  { href: '/portal/audit/refill-governance', label: 'Refill Governance', permission: 'audit:view' },
  { href: '/portal/reports/builder', label: 'Reports', permission: 'reports:view' },
  { href: '/portal/notifications/campaigns', label: 'Campaigns', permission: 'notifications:manage' },
  { href: '/portal/settings/integrations', label: 'Integrations', permission: 'integrations:manage' }
];

export function getVisibleRoutes(role: AdminRole): PortalRoute[] {
  return PORTAL_ROUTES.filter((route) => hasPermission(role, route.permission));
}
