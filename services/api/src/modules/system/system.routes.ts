import { Router } from 'express';
import { locales, providerPortalFeatures, userRoleCatalog, workflowStatuses } from '@care-center/contracts';

export const systemRouter = Router();

const routeGroups = [
  { key: 'auth', basePath: '/api/auth', screens: ['patient sign-in', 'otp verification'] },
  { key: 'providers', basePath: '/api/providers', screens: ['provider search', 'provider profile', 'service selection', 'facility selection'] },
  { key: 'bookings', basePath: '/api/bookings', screens: ['slot selection', 'intake form', 'review and payment', 'booking confirmation'] },
  { key: 'appointments', basePath: '/api/appointments', screens: ['upcoming appointments', 'appointment detail'] },
  { key: 'telehealth', basePath: '/api/telehealth', screens: ['waiting room', 'in-call visit', 'operations dashboard'] },
  { key: 'records', basePath: '/api/records', screens: ['records hub', 'document detail'] },
  { key: 'payments', basePath: '/api/payments', screens: ['wallet methods', 'invoices and refunds'] },
  { key: 'patient', basePath: '/api/patient', screens: ['profile', 'consents', 'notifications', 'care plan', 'support', 'reminders', 'rpm'] },
  { key: 'provider', basePath: '/api/provider', screens: ['dashboard', 'calendar', 'queue', 'labs', 'orders', 'prescriptions', 'team', 'analytics'] },
  { key: 'admin', basePath: '/api', screens: ['dashboard', 'catalog', 'coverage', 'pricing', 'support', 'safety', 'reports', 'integrations', 'rbac'] },
  { key: 'hybrid-python', basePath: '/api/hybrid-python', screens: ['worker status', 'routing preview', 'canary jobs', 'job metrics', 'shadow inspection'] },
] as const;

const criticalJourneys = [
  {
    key: 'patient-booking',
    label: 'Patient booking',
    screens: ['/providers/search', '/providers/profile', '/providers/service', '/providers/location', '/booking/slot', '/booking/intake', '/booking/docs', '/booking/review', '/booking/confirmation'],
    endpoints: ['/api/providers', '/api/bookings'],
  },
  {
    key: 'provider-encounter-completion',
    label: 'Provider encounter completion',
    screens: ['/portal/queue', '/portal/chart/[patientId]', '/portal/telehealth'],
    endpoints: ['/api/provider/calendar', '/api/appointments', '/api/records', '/api/telehealth'],
  },
  {
    key: 'lab-release-to-patient',
    label: 'Lab release to patient',
    screens: ['/portal/labs/inbox', '/labs/list', '/labs/detail'],
    endpoints: ['/api/provider/labs', '/api/records'],
  },
  {
    key: 'payment-and-refund',
    label: 'Payment and refund handling',
    screens: ['/booking/review', '/billing/invoices', '/portal/payments/reconciliation', '/portal/payments/refunds'],
    endpoints: ['/api/payments', '/api/bookings'],
  },
  {
    key: 'hybrid-python-worker-canary',
    label: 'Hybrid Python worker canary',
    screens: ['/portal/system/hybrid-python'],
    endpoints: ['/api/hybrid-python/status', '/api/hybrid-python/routing-preview', '/api/hybrid-python/jobs', '/api/hybrid-python/jobs/metrics', '/api/hybrid-python/shadow/jobs'],
  },
  {
    key: 'support-and-safety',
    label: 'Support and safety escalation',
    screens: ['/support', '/portal/support/console', '/portal/safety/incidents'],
    endpoints: ['/api/patient/support', '/api/support', '/api/safety'],
  },
] as const;

systemRouter.get('/catalog', (_req, res) => {
  res.json({
    locales,
    userRoles: userRoleCatalog,
    providerPortalFeatures,
    workflowStatuses,
    routeGroups,
    criticalJourneys,
  });
});
