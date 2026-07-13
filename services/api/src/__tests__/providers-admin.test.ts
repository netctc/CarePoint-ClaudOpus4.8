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

describe('GET /api/admin/providers - authentication and authorization', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/admin/providers');
    expect(res.status).toBe(401);
  });

  it('returns 403 for PATIENT role', async () => {
    const token = signAccessToken({ sub: 'test-patient', role: 'PATIENT', organizationId: 'org-1' });
    const res = await request(app)
      .get('/api/admin/providers')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns 403 for PROVIDER role', async () => {
    const token = signAccessToken({ sub: 'test-provider', role: 'PROVIDER', organizationId: 'org-1' });
    const res = await request(app)
      .get('/api/admin/providers')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/admin/providers/statistics - authentication and authorization', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/admin/providers/statistics');
    expect(res.status).toBe(401);
  });

  it('returns 403 for PATIENT role', async () => {
    const token = signAccessToken({ sub: 'test-patient', role: 'PATIENT', organizationId: 'org-1' });
    const res = await request(app)
      .get('/api/admin/providers/statistics')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe.skipIf(!dbReady)('GET /api/admin/providers - with database', () => {
  it('SUPER_ADMIN can list providers with pagination (200)', async () => {
    const token = signAccessToken({ sub: 'test-superadmin', role: 'SUPER_ADMIN' });
    const res = await request(app)
      .get('/api/admin/providers')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(20);
    expect(typeof res.body.pagination.total).toBe('number');
    expect(typeof res.body.pagination.totalPages).toBe('number');
  });

  it('supports page and limit query params', async () => {
    const token = signAccessToken({ sub: 'test-superadmin', role: 'SUPER_ADMIN' });
    const res = await request(app)
      .get('/api/admin/providers?page=1&limit=5')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.limit).toBe(5);
    expect(res.body.items.length).toBeLessThanOrEqual(5);
  });

  it('supports sortBy and sortOrder query params', async () => {
    const token = signAccessToken({ sub: 'test-superadmin', role: 'SUPER_ADMIN' });
    const res = await request(app)
      .get('/api/admin/providers?sortBy=name&sortOrder=asc')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('supports status filter', async () => {
    const token = signAccessToken({ sub: 'test-superadmin', role: 'SUPER_ADMIN' });
    const res = await request(app)
      .get('/api/admin/providers?status=active')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // All returned items should have ACTIVE status
    for (const item of res.body.items) {
      expect(item.status).toBe('ACTIVE');
    }
  });

  it('returns statusIndicators array for each provider', async () => {
    const token = signAccessToken({ sub: 'test-superadmin', role: 'SUPER_ADMIN' });
    const res = await request(app)
      .get('/api/admin/providers')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    for (const item of res.body.items) {
      expect(Array.isArray(item.statusIndicators)).toBe(true);
      // Every provider must have at least Active or Inactive indicator
      const hasActiveOrInactive = item.statusIndicators.includes('Active') || item.statusIndicators.includes('Inactive');
      expect(hasActiveOrInactive).toBe(true);
    }
  });

  it('COMPANY_ADMIN scoped to own organization', async () => {
    const token = signAccessToken({
      sub: 'test-company-admin',
      role: 'COMPANY_ADMIN',
      organizationId: 'nonexistent-org-for-test',
    });
    const res = await request(app)
      .get('/api/admin/providers')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(0);
    expect(res.body.pagination.total).toBe(0);
  });
});

describe.skipIf(!dbReady)('GET /api/admin/providers/statistics - with database', () => {
  it('SUPER_ADMIN can get provider statistics (200)', async () => {
    const token = signAccessToken({ sub: 'test-superadmin', role: 'SUPER_ADMIN' });
    const res = await request(app)
      .get('/api/admin/providers/statistics')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.totalProviders).toBe('number');
    expect(typeof res.body.activeCount).toBe('number');
    expect(typeof res.body.onlineCount).toBe('number');
    expect(typeof res.body.availableTodayCount).toBe('number');
    expect(typeof res.body.avgRating).toBe('number');
    expect(typeof res.body.avgAppointmentDuration).toBe('number');
    expect(typeof res.body.cancellationRate).toBe('number');
    expect(typeof res.body.patientSatisfaction).toBe('number');
  });

  it('COMPANY_ADMIN can get provider statistics for own org (200)', async () => {
    const token = signAccessToken({
      sub: 'test-company-admin',
      role: 'COMPANY_ADMIN',
      organizationId: 'nonexistent-org-for-test',
    });
    const res = await request(app)
      .get('/api/admin/providers/statistics')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalProviders).toBe(0);
    expect(res.body.activeCount).toBe(0);
  });
});
