import 'express-async-errors';
import cors from 'cors';
import express from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './lib/env';
import { apiRoutePaths } from '@care-center/contracts';
import { requestContext } from './middleware/request-context';
import { errorHandler } from './middleware/error-handler';
import { notFound } from './lib/http';
import { healthRouter } from './modules/health/health.routes';
import { authRouter } from './modules/auth/auth.routes';
import { appointmentsRouter } from './modules/appointments/appointments.routes';
import { recordsRouter } from './modules/records/records.routes';
import { messagingRouter } from './modules/messaging/messaging.routes';
import { telehealthRouter } from './modules/telehealth/telehealth.routes';
import { paymentsRouter } from './modules/payments/payments.routes';
import { providersRouter } from './modules/providers/providers.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';
import { adminUsersRouter } from './modules/admin-users/admin-users.routes';
import { auditRouter } from './modules/audit/audit.routes';
import { iamAuditRouter } from './modules/audit/iam-audit.routes';
import { rbacRouter } from './modules/access/rbac.routes';
import { userRoleRouter } from './modules/access/user-role.routes';
import { catalogRouter } from './modules/catalog/catalog.routes';
import { pricingRouter } from './modules/pricing/pricing.routes';
import { policyRouter } from './modules/policy/policy.routes';
import { bookingsRouter } from './modules/bookings/bookings.routes';
import { supportRouter } from './modules/support/support.routes';
import { safetyRouter } from './modules/safety/safety.routes';
import { reportRouter } from './modules/reports/report.routes';
import { campaignRouter } from './modules/campaigns/campaign.routes';
import { integrationRouter } from './modules/integrations/integration.routes';
import { moderationRouter } from './modules/moderation/moderation.routes';
import { providerOnboardingRouter } from './modules/provider-onboarding/onboarding.routes';
import { providerCalendarRouter } from './modules/provider-calendar/calendar.routes';
import { providerOrdersRouter } from './modules/provider-orders/orders.routes';
import { providerPrescriptionsRouter } from './modules/provider-prescriptions/prescriptions.routes';
import { providerLabsRouter } from './modules/provider-labs/labs.routes';
import { providerRpmRouter } from './modules/provider-rpm/rpm.routes';
import { providerAlertsRouter } from './modules/provider-alerts/alerts.routes';
import { providerAnalyticsRouter } from './modules/provider-analytics/analytics.routes';
import { providerTeamRouter } from './modules/provider-team/team.routes';
import { providerSettingsRouter } from './modules/provider-settings/settings.routes';
import { patientFamilyRouter } from './modules/patient-family/family.routes';
import { patientNotificationsRouter } from './modules/patient-notifications/notifications.routes';
import { patientSupportRouter } from './modules/patient-support/support.routes';
import { patientRemindersRouter } from './modules/patient-reminders/reminders.routes';
import { patientCarePlanRouter } from './modules/patient-care-plan/care-plan.routes';
import { patientRpmRouter } from './modules/patient-rpm/rpm.routes';
import { patientQuestionnairesRouter } from './modules/patient-questionnaires/questionnaires.routes';
import { analyticsRouter } from './modules/analytics/analytics.routes';
import { patientConsentsRouter } from './modules/patient-consents/consents.routes';
import { patientPreferencesRouter } from './modules/patient-preferences/preferences.routes';
import { patientProfileRouter } from './modules/patient-profile/profile.routes';
import { getDatabaseHealth } from './lib/prisma';
import { systemRouter } from './modules/system/system.routes';
import { hspRouter } from './modules/hsp/hsp.routes';
import { coverageRouter } from './modules/coverage/coverage.routes';
import { releaseRouter } from './modules/release/release.routes';
import { hybridPythonRouter } from './modules/hybrid-python/hybrid-python.routes';
import { iamRouter } from './modules/iam/iam.routes';
import { adminActionsRouter } from './modules/admin/admin-actions.routes';


function isAllowedCorsOrigin(origin?: string) {
  if (!origin) return true;
  if (env.frontendAllowedOrigins.includes(origin)) return true;
  if (!env.allowLocalhostCorsWildcard) return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

export function createApp(getIo?: () => SocketIOServer | undefined) {
  const app = express();

  const corsOptions: cors.CorsOptions = {
    origin(origin, callback) {
      if (isAllowedCorsOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS origin not allowed: ${origin ?? 'unknown'}`));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  };

  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));
  app.use(helmet());
  app.use(requestContext);
  app.use(morgan('dev'));
  app.use(cookieParser() as unknown as express.RequestHandler);
  app.use(express.json());
  app.use((req, _res, next) => {
    const io = getIo?.();
    if (io) {
      req.io = io;
    }
    next();
  });

  app.get('/livez', (_req, res) => {
    res.status(200).json({ ok: true, service: 'care-center-api', timestamp: new Date().toISOString() });
  });
  app.get('/readyz', async (_req, res) => {
    const database = await getDatabaseHealth();
    res.status(database.ok ? 200 : 503).json({ ok: database.ok, service: 'care-center-api', database, timestamp: new Date().toISOString() });
  });
  app.get('/healthz', async (_req, res) => {
    const database = await getDatabaseHealth();
    res.status(database.ok ? 200 : 503).json({ ok: database.ok, service: 'care-center-api', database, timestamp: new Date().toISOString() });
  });
  app.use('/api/health', healthRouter);
  app.use('/api/system', systemRouter);
  app.use(apiRoutePaths.hybridPython, hybridPythonRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/appointments', appointmentsRouter);
  app.use(apiRoutePaths.records, recordsRouter);
  app.use(apiRoutePaths.records, releaseRouter);
  app.use(apiRoutePaths.messaging, messagingRouter);
  app.use('/api/telehealth', telehealthRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/providers', providersRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/admin/users', adminUsersRouter);
  app.use('/api/admin/audit', iamAuditRouter);
  app.use('/api/admin', adminActionsRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/audit', auditRouter);
  app.use('/api/access/rbac', rbacRouter);
  app.use('/api/access/hsp', hspRouter);
  app.use('/api/access', userRoleRouter);
  app.use('/api/catalog', catalogRouter);
  app.use(apiRoutePaths.coverage, coverageRouter);
  app.use('/api/pricing', pricingRouter);
  app.use('/api/policies', policyRouter);
  app.use('/api/bookings', bookingsRouter);
  app.use('/api/support', supportRouter);
  app.use('/api/safety', safetyRouter);
  app.use('/api/reports', reportRouter);
  app.use('/api/campaigns', campaignRouter);
  app.use('/api/integrations', integrationRouter);
  app.use('/api/moderation', moderationRouter);
  app.use('/api/provider/onboarding', providerOnboardingRouter);
  app.use('/api/provider/calendar', providerCalendarRouter);
  app.use('/api/provider/orders', providerOrdersRouter);
  app.use('/api/provider/prescriptions', providerPrescriptionsRouter);
  app.use('/api/provider/labs', providerLabsRouter);
  app.use('/api/provider/rpm', providerRpmRouter);
  app.use('/api/provider/alerts', providerAlertsRouter);
  app.use('/api/provider/analytics', providerAnalyticsRouter);
  app.use('/api/provider/team', providerTeamRouter);
  app.use('/api/provider/settings', providerSettingsRouter);
  app.use('/api/patient/preferences', patientPreferencesRouter);
  app.use('/api/patient/profile', patientProfileRouter);
  app.use('/api/patient/consents', patientConsentsRouter);
  app.use('/api/patient/family', patientFamilyRouter);
  app.use('/api/patient/notifications', patientNotificationsRouter);
  app.use('/api/patient/support', patientSupportRouter);
  app.use('/api/patient/reminders', patientRemindersRouter);
  app.use('/api/patient/care-plan', patientCarePlanRouter);
  app.use('/api/patient/rpm', patientRpmRouter);
  app.use('/api/patient/questionnaires', patientQuestionnairesRouter);
  app.use('/api/iam', iamRouter);

  app.use((req, _res, next) => {
    next(notFound(`Route not found: ${req.method} ${req.originalUrl}`));
  });

  app.use(errorHandler);

  return app;
}
