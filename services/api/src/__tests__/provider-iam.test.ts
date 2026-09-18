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

describe('provider IAM routes - authentication and authorization', () => {
  it('GET /api/admin/users/providers/iam without auth returns 401', async () => {
    const res = await request(app).get('/api/admin/users/providers/iam');
    expect(res.status).toBe(401);
  });

  it('POST /api/admin/users/providers/iam without auth returns 401', async () => {
    const res = await request(app).post('/api/admin/users/providers/iam');
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/users/providers/iam/:id without auth returns 401', async () => {
    const res = await request(app).get('/api/admin/users/providers/iam/some-id');
    expect(res.status).toBe(401);
  });

  it('PATIENT role cannot access provider IAM list (403)', async () => {
    const token = signAccessToken({
      sub: 'test-patient',
      role: 'PATIENT',
      organizationId: 'org-1',
    });
    const res = await request(app)
      .get('/api/admin/users/providers/iam')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('PROVIDER role cannot access provider IAM list (403)', async () => {
    const token = signAccessToken({
      sub: 'test-provider',
      role: 'PROVIDER',
      organizationId: 'org-1',
    });
    const res = await request(app)
      .get('/api/admin/users/providers/iam')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('FINANCE role cannot access provider IAM list (403)', async () => {
    const token = signAccessToken({
      sub: 'test-finance',
      role: 'FINANCE',
      organizationId: 'org-1',
    });
    const res = await request(app)
      .get('/api/admin/users/providers/iam')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('COMPANY_ADMIN without organizationId returns 403', async () => {
    const token = signAccessToken({
      sub: 'test-company-admin',
      role: 'COMPANY_ADMIN',
      // Authenticated but missing the tenant scope required by this surface.
    });
    const res = await request(app)
      .get('/api/admin/users/providers/iam')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe.skipIf(!dbReady)('provider IAM routes - with database', () => {
  it('SUPER_ADMIN can list providers (200 + pagination)', async () => {
    const token = signAccessToken({
      sub: 'test-superadmin',
      role: 'SUPER_ADMIN',
    });
    const res = await request(app)
      .get('/api/admin/users/providers/iam')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.pageSize).toBe(20);
    expect(typeof res.body.pagination.totalCount).toBe('number');
    expect(typeof res.body.pagination.totalPages).toBe('number');
    expect(typeof res.body.pagination.hasNextPage).toBe('boolean');
    expect(typeof res.body.pagination.hasPreviousPage).toBe('boolean');
  });

  it('SUPER_ADMIN can list providers with custom page size', async () => {
    const token = signAccessToken({
      sub: 'test-superadmin',
      role: 'SUPER_ADMIN',
    });
    const res = await request(app)
      .get('/api/admin/users/providers/iam?page=1&pageSize=5')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.pageSize).toBe(5);
    expect(res.body.items.length).toBeLessThanOrEqual(5);
  });

  it('COMPANY_ADMIN can list providers in own org (200)', async () => {
    // We need an existing org; use a token with an org ID
    // If there are no providers, we expect an empty list
    const token = signAccessToken({
      sub: 'test-company-admin',
      role: 'COMPANY_ADMIN',
      organizationId: 'nonexistent-org-for-test',
    });
    const res = await request(app)
      .get('/api/admin/users/providers/iam')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    // Should return empty since org doesn't exist
    expect(res.body.items.length).toBe(0);
    expect(res.body.pagination.totalCount).toBe(0);
  });

  it('provider list items have expected shape', async () => {
    const token = signAccessToken({
      sub: 'test-superadmin',
      role: 'SUPER_ADMIN',
    });
    const res = await request(app)
      .get('/api/admin/users/providers/iam')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    if (res.body.items.length > 0) {
      const item = res.body.items[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('email');
      expect(item).toHaveProperty('specialty');
      expect(item).toHaveProperty('licenseNumber');
      expect(item).toHaveProperty('onboardingStatus');
      expect(item).toHaveProperty('credentialSummary');
      expect(item).toHaveProperty('organizationId');
      expect(item.credentialSummary).toHaveProperty('total');
      expect(item.credentialSummary).toHaveProperty('verified');
      expect(item.credentialSummary).toHaveProperty('expired');
      expect(item.credentialSummary).toHaveProperty('expiringSoon');
    }
  });

  it('GET /providers/iam/:id returns 404 for unknown provider', async () => {
    const token = signAccessToken({
      sub: 'test-superadmin',
      role: 'SUPER_ADMIN',
    });
    const res = await request(app)
      .get('/api/admin/users/providers/iam/nonexistent-provider-id')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('POST /providers/iam rejects missing required fields (400)', async () => {
    const token = signAccessToken({
      sub: 'test-superadmin',
      role: 'SUPER_ADMIN',
    });
    const res = await request(app)
      .post('/api/admin/users/providers/iam')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'test@example.com' }); // missing firstName, lastName

    expect(res.status).toBe(400);
  });

  it('POST /providers/iam rejects invalid email (400)', async () => {
    const token = signAccessToken({
      sub: 'test-superadmin',
      role: 'SUPER_ADMIN',
    });
    const res = await request(app)
      .post('/api/admin/users/providers/iam')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'not-an-email',
        firstName: 'Test',
        lastName: 'Provider',
        organizationId: 'org-1',
      });

    expect(res.status).toBe(400);
  });

  it('SUPER_ADMIN requires organizationId for provider creation (400)', async () => {
    const token = signAccessToken({
      sub: 'test-superadmin',
      role: 'SUPER_ADMIN',
    });
    const res = await request(app)
      .post('/api/admin/users/providers/iam')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'newprovider@test.com',
        firstName: 'New',
        lastName: 'Provider',
        // No organizationId
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('organizationId');
  });
});
