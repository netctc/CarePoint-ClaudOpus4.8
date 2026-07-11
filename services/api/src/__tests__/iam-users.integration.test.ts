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

describe('IAM User Management Routes (no database)', () => {
  it('GET /api/admin/users/iam-users without auth returns 401', async () => {
    const res = await request(app).get('/api/admin/users/iam-users');
    expect(res.status).toBe(401);
  });

  it('POST /api/admin/users/iam-users without auth returns 401', async () => {
    const res = await request(app)
      .post('/api/admin/users/iam-users')
      .send({ firstName: 'Test', lastName: 'User', email: 'test@example.com', role: 'PROVIDER' });
    expect(res.status).toBe(401);
  });

  it('PATCH /api/admin/users/iam-users/:id/status without auth returns 401', async () => {
    const res = await request(app)
      .patch('/api/admin/users/iam-users/some-id/status')
      .send({ status: 'SUSPENDED' });
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/users/iam-users/:userId without auth returns 401', async () => {
    const res = await request(app).get('/api/admin/users/iam-users/some-id');
    expect(res.status).toBe(401);
  });

  it('rejects a non-admin role (PATIENT) with 403', async () => {
    const token = signAccessToken({ sub: 'test-patient', role: 'PATIENT', organizationId: 'org-1' });
    const res = await request(app)
      .get('/api/admin/users/iam-users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe.skipIf(!dbReady)('IAM User Management Routes (requires database)', () => {
  const superAdminToken = signAccessToken({ sub: 'sa-iam-test', role: 'SUPER_ADMIN' });
  const companyAdminToken = signAccessToken({ sub: 'ca-iam-test', role: 'COMPANY_ADMIN', organizationId: 'org-test-123' });

  it('GET /iam-users returns paginated response for SUPER_ADMIN', async () => {
    const res = await request(app)
      .get('/api/admin/users/iam-users')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(typeof res.body.page).toBe('number');
    expect(typeof res.body.pageSize).toBe('number');
    expect(typeof res.body.totalCount).toBe('number');
    expect(typeof res.body.totalPages).toBe('number');
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(20);
  });

  it('GET /iam-users respects ?pageSize and ?page params', async () => {
    const res = await request(app)
      .get('/api/admin/users/iam-users?page=1&pageSize=5')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pageSize).toBe(5);
    expect(res.body.items.length).toBeLessThanOrEqual(5);
  });

  it('GET /iam-users supports ?search param', async () => {
    const res = await request(app)
      .get('/api/admin/users/iam-users?search=nonexistent_user_xyz')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(0);
    expect(res.body.totalCount).toBe(0);
  });

  it('POST /iam-users rejects missing required fields', async () => {
    const res = await request(app)
      .post('/api/admin/users/iam-users')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ firstName: 'Only' });

    expect(res.status).toBe(400);
  });

  it('POST /iam-users rejects invalid email', async () => {
    const res = await request(app)
      .post('/api/admin/users/iam-users')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ firstName: 'Test', lastName: 'User', email: 'not-an-email', role: 'PROVIDER' });

    expect(res.status).toBe(400);
  });

  it('POST /iam-users rejects invalid role', async () => {
    const res = await request(app)
      .post('/api/admin/users/iam-users')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ firstName: 'Test', lastName: 'User', email: 'valid@email.com', role: 'INVALID_ROLE' });

    expect(res.status).toBe(400);
  });

  it('PATCH /iam-users/:id/status rejects invalid status', async () => {
    const res = await request(app)
      .patch('/api/admin/users/iam-users/some-nonexistent-id/status')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ status: 'INVALID' });

    expect(res.status).toBe(400);
  });

  it('PATCH /iam-users/:id/status returns 404 for non-existent user', async () => {
    const res = await request(app)
      .patch('/api/admin/users/iam-users/nonexistent-user-id/status')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ status: 'SUSPENDED' });

    expect(res.status).toBe(404);
  });

  it('GET /iam-users/:userId returns 404 for non-existent user', async () => {
    const res = await request(app)
      .get('/api/admin/users/iam-users/nonexistent-user-id')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(404);
  });

  it('items in paginated response contain required fields', async () => {
    const res = await request(app)
      .get('/api/admin/users/iam-users')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    if (res.body.items.length > 0) {
      const item = res.body.items[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('firstName');
      expect(item).toHaveProperty('lastName');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('email');
      expect(item).toHaveProperty('role');
      expect(item).toHaveProperty('status');
      expect(item).toHaveProperty('organizationName');
      expect(item).toHaveProperty('createdAt');
    }
  });
});
