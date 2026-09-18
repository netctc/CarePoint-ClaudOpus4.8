import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { badRequest } from '../../lib/http';
import { env } from '../../lib/env';
import { isEmailConfigured } from '../../lib/mailer';
import { getSsoConfiguration } from '../../lib/auth-sso';
import { isV1IntegrationInScope } from '../../lib/release-integration-scope';
import {
  getGrowthItem,
  getGrowthStorageMode,
  listGrowthItems,
  transitionGrowthItem,
  upsertGrowthItem,
} from '../../lib/admin-growth-store';

export const integrationRouter = Router();
const readRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT'];
const writeRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN'];

const integrationSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(2),
  title: z.string().min(4),
  provider: z.string().min(2),
  category: z.string().min(2),
  environment: z.string().min(2),
  ownerRole: z.string().min(2),
  summary: z.string().min(10),
  tags: z.array(z.string()).default([]),
  lastHealthStatus: z.string().min(2).default('UNKNOWN'),
  note: z.string().trim().max(500).optional(),
});

function projectRuntimeState<T extends Record<string, any>>(item: T): T {
  const code = String(item.code ?? '').trim().toUpperCase();

  if (code === 'DAILY_TELEHEALTH' && env.isProduction) {
    return {
      ...item,
      status: 'DISABLED',
      lastHealthStatus: 'BLOCKED_V1',
      lastCheckedAt: null,
      runtimeNote: 'Telehealth is OUT for the v1 production pilot until real vendor room provisioning is implemented and validated.',
    };
  }

  if (code === 'STRIPE') {
    if (env.isProduction) {
      return {
        ...item,
        status: 'DISABLED',
        lastHealthStatus: 'BLOCKED_V1',
        lastCheckedAt: null,
        runtimeNote: env.stripeCredentialConfigured
          ? 'Stripe credentials are present but Stripe is OUT for the v1 production pilot; payment intent creation remains in manual-review mode.'
          : 'Stripe is OUT for the v1 production pilot; payment intent creation remains in manual-review mode.',
      };
    }

    if (!env.stripeSecretKey) {
      return {
        ...item,
        status: 'DISABLED',
        lastHealthStatus: 'NOT_CONFIGURED',
        lastCheckedAt: null,
        runtimeNote: 'Stripe is not configured; payment intent creation uses explicit manual-review fallback.',
      };
    }

    return {
      ...item,
      status: 'PENDING_VALIDATION',
      lastHealthStatus: 'UNKNOWN',
      lastCheckedAt: null,
      runtimeNote: 'Stripe credentials are present for non-production development/test use; this does not change the v1 pilot scope.',
    };
  }

  return item;
}

function summarizeProjectedItems(items: Array<Record<string, any>>) {
  return items.reduce(
    (acc, item) => {
      const status = String(item.status ?? '').trim().toUpperCase();
      acc.total += 1;
      acc.byStatus[status] = (acc.byStatus[status] ?? 0) + 1;
      if (['PUBLISHED', 'APPROVED', 'ACTIVE', 'RESOLVED'].includes(status)) acc.ready += 1;
      if (['PENDING_VALIDATION', 'DEGRADED', 'OPEN', 'ESCALATED', 'REJECTED', 'ARCHIVED', 'DISABLED'].includes(status)) acc.attentionRequired += 1;
      return acc;
    },
    { total: 0, ready: 0, attentionRequired: 0, byStatus: {} as Record<string, number> },
  );
}

integrationRouter.use(requireAuth);
integrationRouter.use(allowRoles(readRoles));

integrationRouter.get('/summary', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const items = (await listGrowthItems('integrations', organizationId)).map(projectRuntimeState);
  res.json({ summary: summarizeProjectedItems(items), storageMode: getGrowthStorageMode('integrations') });
});

// Runtime capability inventory intentionally exposes booleans and release
// scope only; secret values and provider payloads never leave the server.
integrationRouter.get('/runtime-capabilities', async (_req, res) => {
  const sso = getSsoConfiguration(null);
  const emailConfigured = isEmailConfigured();
  const smsConfigured = Boolean(env.twilioAccountSid && env.twilioAuthToken);
  const telehealthConfigured = Boolean(env.dailyApiKey);
  res.json({
    releaseScope: {
      telehealth: {
        inScope: isV1IntegrationInScope('telehealth'),
        configured: telehealthConfigured,
        runtimeEnabled: !env.isProduction && telehealthConfigured,
        note: telehealthConfigured
          ? 'Daily configuration is present, but telehealth remains OUT for the v1 production pilot.'
          : 'OUT for v1 production pilot: Daily room provisioning is not enabled.',
      },
      patientEmailOtp: {
        inScope: isV1IntegrationInScope('patientEmailOtp'),
        configured: emailConfigured,
        runtimeEnabled: emailConfigured,
        note: emailConfigured
          ? 'Email OTP is IN for v1 and provider configuration is detected.'
          : 'Email OTP is IN for v1 and must be configured before production privileged authentication can succeed.',
      },
      patientSmsOtp: {
        inScope: isV1IntegrationInScope('patientSmsOtp'),
        configured: smsConfigured,
        runtimeEnabled: false,
        note: smsConfigured
          ? 'Twilio credentials are present, but SMS OTP remains OUT for v1 and no production SMS delivery adapter is enabled.'
          : 'OUT for v1: no production SMS delivery adapter is enabled.',
      },
      stripePayments: {
        inScope: isV1IntegrationInScope('stripePayments'),
        configured: env.stripeCredentialConfigured,
        runtimeEnabled: Boolean(env.stripeSecretKey),
        manualFallback: !env.stripeSecretKey,
        validated: false,
        note: env.stripeCredentialConfigured
          ? 'Stripe credentials are present, but Stripe remains OUT for the v1 production pilot; production uses explicit manual-review mode.'
          : 'Stripe is OUT for v1; payment intents remain in explicit manual-review mode.',
      },
      enterpriseSso: {
        inScope: isV1IntegrationInScope('enterpriseSso'),
        configured: env.ssoConfigurationPresent,
        runtimeEnabled: sso.available,
        note: env.ssoConfigurationPresent
          ? 'Enterprise SSO configuration is present, but SSO remains OUT for the v1 production pilot.'
          : 'Enterprise SSO is OUT for the v1 production pilot and is not configured.',
      },
    },
  });
});

integrationRouter.get('/', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const q = String(req.query.q ?? '').trim().toLowerCase();
  const status = String(req.query.status ?? '').trim().toUpperCase();
  const category = String(req.query.category ?? '').trim().toLowerCase();
  const items = (await listGrowthItems('integrations', organizationId)).map(projectRuntimeState).filter((item) => {
    if (status && item.status !== status) return false;
    if (category && String(item.category ?? '').trim().toLowerCase() !== category) return false;
    if (!q) return true;
    return [item.code, item.title, item.provider ?? '', item.summary ?? '', ...(Array.isArray(item.tags) ? item.tags : [])].join(' ').toLowerCase().includes(q);
  });
  res.json({ items, count: items.length, storageMode: getGrowthStorageMode('integrations') });
});

integrationRouter.get('/:integrationId', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = projectRuntimeState(await getGrowthItem('integrations', req.params.integrationId, organizationId));
  res.json({ item, storageMode: getGrowthStorageMode('integrations') });
});

integrationRouter.post('/', allowRoles(writeRoles), validateBody(integrationSchema), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await upsertGrowthItem(
    'integrations',
    { ...req.body, status: 'PENDING_VALIDATION', lastHealthStatus: 'UNKNOWN', lastCheckedAt: null },
    { organizationId, actorId },
  );
  res.status(201).json({ item: projectRuntimeState(item), storageMode: getGrowthStorageMode('integrations') });
});

integrationRouter.put('/:integrationId', allowRoles(writeRoles), validateBody(integrationSchema.partial().extend({ id: z.string().optional() })), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await upsertGrowthItem(
    'integrations',
    {
      ...req.body,
      id: req.params.integrationId,
      status: 'PENDING_VALIDATION',
      lastHealthStatus: 'UNKNOWN',
      lastCheckedAt: null,
    },
    { organizationId, actorId },
  );
  res.json({ item: projectRuntimeState(item), storageMode: getGrowthStorageMode('integrations') });
});

integrationRouter.post('/:integrationId/rotate-secret', allowRoles(writeRoles), async (_req, _res) => {
  throw badRequest('Secret rotation is an external provider/secret-manager operation. Rotate the credential outside CarePoint, then record and validate the result without storing the secret value here.');
});

integrationRouter.post('/:integrationId/disable', allowRoles(writeRoles), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await transitionGrowthItem('integrations', req.params.integrationId, 'DISABLED', { organizationId, actorId }, String(req.body?.note ?? '').trim() || null, {
    lastHealthStatus: 'DISABLED',
    lastCheckedAt: new Date().toISOString(),
  });
  res.json({ item: projectRuntimeState(item), storageMode: getGrowthStorageMode('integrations') });
});
