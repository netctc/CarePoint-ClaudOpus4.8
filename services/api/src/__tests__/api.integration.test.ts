import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { signAccessToken } from '../lib/jwt';
import { disconnectPrisma, getDatabaseHealth } from '../lib/prisma';

// In-process Express app (no network listener needed for supertest).
const app = createApp();

// Determine database availability once, at collection time, so DB-dependent
// tests are skipped cleanly when Postgres/schema is not present (e.g. a quick
// local run without `prisma db push`). CI pushes the schema before running.
const dbHealth = await getDatabaseHealth().catch(() => ({ ok: false }));
const dbReady = Boolean((dbHealth as { ok?: boolean }).ok);

afterAll(async () => {
  await disconnectPrisma().catch(() => undefined);
});

describe('health endpoints (no auth, no database)', () => {
  it('GET /livez returns ok', async () => {
    const res = await request(app).get('/livez');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.service).toBe('care-center-api');
  });

  it('GET /api/health/live returns ok', async () => {
    const res = await request(app).get('/api/health/live');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('authentication and routing guards', () => {
  it('GET /api/dashboard/admin without a token returns 401', async () => {
    const res = await request(app).get('/api/dashboard/admin');
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/users/organizations is mounted and requires auth (401, not 404)', async () => {
    // A 404 here would mean adminUsersRouter is not mounted in app.ts again
    // (the regression we fixed). 401 proves the router is wired and guarded.
    const res = await request(app).get('/api/admin/users/organizations');
    expect(res.status).toBe(401);
  });

  it('rejects an invalid bearer token with 401', async () => {
    const res = await request(app)
      .get('/api/dashboard/admin')
      .set('Authorization', 'Bearer not-a-valid-token');
    expect(res.status).toBe(401);
  });

  it('returns 404 for an unknown route', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
  });
});

describe.skipIf(!dbReady)('organizations endpoint (requires database)', () => {
  it('lists organizations for a SUPER_ADMIN token (200 + items array)', async () => {
    // Exercises the mounted admin router AND the batched organization summary
    // query (Fase 2 N+1 fix) against a real Postgres database.
    const token = signAccessToken({ sub: 'integration-test-superadmin', role: 'SUPER_ADMIN' });
    const res = await request(app)
      .get('/api/admin/users/organizations')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(typeof res.body.count).toBe('number');
  });
});
