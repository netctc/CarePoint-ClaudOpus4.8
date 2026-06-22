import { Router } from 'express';
import { env } from '../../lib/env';
import { getDatabaseHealth } from '../../lib/prisma';

export const healthRouter = Router();

function livenessPayload() {
  return {
    ok: true,
    service: 'care-center-api',
    nodeEnv: env.nodeEnv,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}

async function readinessPayload() {
  const database = await getDatabaseHealth();
  return {
    ok: database.ok,
    service: 'care-center-api',
    timestamp: new Date().toISOString(),
    checks: {
      database,
    },
  };
}

healthRouter.get('/', async (_req, res) => {
  const readiness = await readinessPayload();
  res.status(readiness.ok ? 200 : 503).json(readiness);
});

healthRouter.get('/live', (_req, res) => {
  res.status(200).json(livenessPayload());
});

healthRouter.get('/ready', async (_req, res) => {
  const readiness = await readinessPayload();
  res.status(readiness.ok ? 200 : 503).json(readiness);
});

healthRouter.get('/dependencies', async (_req, res) => {
  const database = await getDatabaseHealth();

  res.status(database.ok ? 200 : 503).json({
    ok: database.ok,
    service: 'care-center-api',
    timestamp: new Date().toISOString(),
    dependencies: {
      database,
      auth: {
        ok: Boolean(env.jwtAccessSecret && env.jwtRefreshSecret),
        accessTtl: env.jwtAccessTtl,
        refreshTtl: env.jwtRefreshTtl,
      },
      integrations: {
        stripeConfigured: Boolean(env.stripeSecretKey),
        telehealthVendor: env.telehealthVendor,
        dailyConfigured: Boolean(env.dailyApiKey),
        twilioConfigured: Boolean(env.twilioAccountSid && env.twilioAuthToken),
      },
    },
  });
});
