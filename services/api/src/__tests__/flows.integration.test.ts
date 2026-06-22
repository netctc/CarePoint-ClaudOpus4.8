import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { signAccessToken } from '../lib/jwt';
import { disconnectPrisma, getDatabaseHealth } from '../lib/prisma';

const app = createApp();

const dbHealth = await getDatabaseHealth().catch(() => ({ ok: false }));
const dbReady = Boolean((dbHealth as { ok?: boolean }).ok);

afterAll(async () => {
  await disconnectPrisma().catch(() => undefined);
});

// Every router below applies requireAuth at the router level, so ANY request
// into the mounted prefix without a token must return 401. A 404 here would
// mean the router is not mounted in app.ts (the class of regression we hit with
// adminUsersRouter and the coverage module). This is the broad "all routers are
// wired and guarded" safety net.
const guardedPrefixes: Array<[string, string]> = [
  ['GET', '/api/appointments'],
  ['GET', '/api/providers'],
  ['GET', '/api/dashboard/admin'],
  ['GET', '/api/dashboard/provider'],
  ['GET', '/api/dashboard/patient'],
  ['GET', '/api/analytics/overview'],
  ['GET', '/api/audit/logs'],
  ['GET', '/api/access/rbac/summary'],
  ['GET', '/api/catalog/summary'],
  ['GET', '/api/coverage/summary'],
  ['GET', '/api/pricing/summary'],
  ['GET', '/api/payments'],
  ['GET', '/api/bookings/summary'],
  ['GET', '/api/policies/summary'],
  ['GET', '/api/campaigns/summary'],
  ['GET', '/api/integrations/summary'],
  ['GET', '/api/moderation/summary'],
  ['GET', '/api/provider/onboarding/me'],
  ['GET', '/api/provider/calendar/overview'],
  ['GET', '/api/provider/orders/summary'],
  ['GET', '/api/provider/prescriptions/summary'],
  ['GET', '/api/provider/labs/summary'],
  ['GET', '/api/provider/rpm/summary'],
  ['GET', '/api/provider/alerts'],
  ['GET', '/api/provider/analytics/overview'],
  ['GET', '/api/provider/team/summary'],
  ['GET', '/api/provider/settings/summary'],
  ['GET', '/api/patient/profile'],
  ['GET', '/api/patient/family/summary'],
  ['GET', '/api/patient/notifications'],
  ['GET', '/api/patient/care-plan/summary'],
  // Per-route requireAuth (admin account governance):
  ['GET', '/api/admin/users/organizations'],
  ['GET', '/api/admin/users/providers'],
  ['GET', '/api/admin/users/patients'],
];

describe('all protected routers are mounted and require auth', () => {
  it.each(guardedPrefixes)('%s %s without a token returns 401', async (method, path) => {
    const res = await request(app)[method.toLowerCase() as 'get'](path);
    expect(res.status).toBe(401);
  });
});

describe('auth flow validation', () => {
  it('POST /api/auth/login with an empty body returns 400 (schema validation)', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/register with an invalid body returns 400', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it.skipIf(!dbReady)('POST /api/auth/login with unknown credentials returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'no-such-user@example.com', password: 'wrong-password-123' });
    expect(res.status).toBe(401);
  });
});

// Authenticated read paths exercised against a real database with an
// organization-scoped COMPANY_ADMIN token. Endpoints filter by organizationId
// and return empty collections for an unseeded org, so 200 + a well-formed
// shape is the expectation. Skipped when no database/schema is available.
describe.skipIf(!dbReady)('authenticated read endpoints (organization-scoped)', () => {
  const token = signAccessToken({
    sub: 'integration-test-admin',
    role: 'COMPANY_ADMIN',
    organizationId: 'integration-test-org',
  });
  const auth = (path: string) => request(app).get(path).set('Authorization', `Bearer ${token}`);

  it('GET /api/catalog/services returns 200 with an items array', async () => {
    const res = await auth('/api/catalog/services');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('GET /api/catalog/summary returns 200 with a summary', async () => {
    const res = await auth('/api/catalog/summary');
    expect(res.status).toBe(200);
    expect(res.body.summary).toBeTruthy();
  });

  it('GET /api/coverage/rules returns 200 with an items array', async () => {
    const res = await auth('/api/coverage/rules');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('GET /api/dashboard/admin returns 200 with kpis (parallelized counts)', async () => {
    const res = await auth('/api/dashboard/admin');
    expect(res.status).toBe(200);
    expect(res.body.kpis).toBeTruthy();
  });

  it('GET /api/admin/users/organizations (scoped admin) returns 200 with an items array', async () => {
    const res = await auth('/api/admin/users/organizations');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });
});
