import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';
import { signAccessToken } from '../../lib/jwt';
import { disconnectPrisma, getDatabaseHealth } from '../../lib/prisma';

const app = createApp();

const dbHealth = await getDatabaseHealth().catch(() => ({ ok: false }));
const dbReady = Boolean((dbHealth as { ok?: boolean }).ok);

afterAll(async () => {
  await disconnectPrisma().catch(() => undefined);
});

describe('GET /api/iam/access-review (no database)', () => {
  it('returns 401 when no auth token is provided', async () => {
    const res = await request(app).get('/api/iam/access-review');

    expect(res.status).toBe(401);
  });

  it('returns 403 when user role is not SUPER_ADMIN or COMPANY_ADMIN', async () => {
    const token = signAccessToken({
      sub: 'provider-user',
      role: 'PROVIDER',
      organizationId: 'org-1',
    });

    const res = await request(app)
      .get('/api/iam/access-review')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 401 when COMPANY_ADMIN has no organizationId', async () => {
    const token = signAccessToken({
      sub: 'admin-user',
      role: 'COMPANY_ADMIN',
    });

    const res = await request(app)
      .get('/api/iam/access-review')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
  });
});

describe.skipIf(!dbReady)('GET /api/iam/access-review (requires database)', () => {
  it('returns 200 with items array for SUPER_ADMIN', async () => {
    const token = signAccessToken({
      sub: 'super-admin-user',
      role: 'SUPER_ADMIN',
    });

    const res = await request(app)
      .get('/api/iam/access-review')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('staleDaysThreshold', 90);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('returns 200 with items array for COMPANY_ADMIN with org context', async () => {
    const token = signAccessToken({
      sub: 'company-admin-user',
      role: 'COMPANY_ADMIN',
      organizationId: 'org-1',
    });

    const res = await request(app)
      .get('/api/iam/access-review')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('staleDaysThreshold', 90);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('returns items with expected shape', async () => {
    const token = signAccessToken({
      sub: 'super-admin-user',
      role: 'SUPER_ADMIN',
    });

    const res = await request(app)
      .get('/api/iam/access-review')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    // Each item in the response should have the expected shape
    for (const item of res.body.items) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('email');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('role');
      expect(item).toHaveProperty('organizationId');
      expect(item).toHaveProperty('lastCertifiedAt');
      expect(['SUPER_ADMIN', 'COMPANY_ADMIN']).toContain(item.role);
    }
  });
});
