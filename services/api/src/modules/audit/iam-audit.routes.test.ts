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

describe('GET /api/admin/audit (no database)', () => {
  it('returns 401 when no auth token is provided', async () => {
    const res = await request(app).get('/api/admin/audit');
    expect(res.status).toBe(401);
  });

  it('returns 403 when user role is not SUPER_ADMIN or COMPANY_ADMIN', async () => {
    const token = signAccessToken({
      sub: 'provider-user',
      role: 'PROVIDER',
      organizationId: 'org-1',
    });

    const res = await request(app)
      .get('/api/admin/audit')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 401 when COMPANY_ADMIN has no organizationId', async () => {
    const token = signAccessToken({
      sub: 'admin-user',
      role: 'COMPANY_ADMIN',
    });

    const res = await request(app)
      .get('/api/admin/audit')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
  });

  it('rejects pageSize above 50', async () => {
    const token = signAccessToken({
      sub: 'super-admin',
      role: 'SUPER_ADMIN',
    });

    const res = await request(app)
      .get('/api/admin/audit?pageSize=100')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('rejects invalid page number', async () => {
    const token = signAccessToken({
      sub: 'super-admin',
      role: 'SUPER_ADMIN',
    });

    const res = await request(app)
      .get('/api/admin/audit?page=0')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('rejects date range exceeding 365 days', async () => {
    const token = signAccessToken({
      sub: 'super-admin',
      role: 'SUPER_ADMIN',
    });

    const res = await request(app)
      .get('/api/admin/audit?dateFrom=2020-01-01&dateTo=2022-01-01')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('365 days');
  });

  it('rejects dateFrom after dateTo', async () => {
    const token = signAccessToken({
      sub: 'super-admin',
      role: 'SUPER_ADMIN',
    });

    const res = await request(app)
      .get('/api/admin/audit?dateFrom=2024-06-01&dateTo=2024-01-01')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('before');
  });
});

describe('POST /api/admin/audit/export (no database)', () => {
  it('returns 401 when no auth token is provided', async () => {
    const res = await request(app)
      .post('/api/admin/audit/export')
      .send({ format: 'json', purpose: 'compliance review' });
    expect(res.status).toBe(401);
  });

  it('returns 403 when user role is not SUPER_ADMIN or COMPANY_ADMIN', async () => {
    const token = signAccessToken({
      sub: 'provider-user',
      role: 'PROVIDER',
      organizationId: 'org-1',
    });

    const res = await request(app)
      .post('/api/admin/audit/export')
      .set('Authorization', `Bearer ${token}`)
      .send({ format: 'json', purpose: 'compliance review' });

    expect(res.status).toBe(403);
  });

  it('returns 401 when COMPANY_ADMIN has no organizationId', async () => {
    const token = signAccessToken({
      sub: 'admin-user',
      role: 'COMPANY_ADMIN',
    });

    const res = await request(app)
      .post('/api/admin/audit/export')
      .set('Authorization', `Bearer ${token}`)
      .send({ format: 'json', purpose: 'compliance review' });

    expect(res.status).toBe(401);
  });

  it('rejects request without purpose', async () => {
    const token = signAccessToken({
      sub: 'super-admin',
      role: 'SUPER_ADMIN',
    });

    const res = await request(app)
      .post('/api/admin/audit/export')
      .set('Authorization', `Bearer ${token}`)
      .send({ format: 'json' });

    expect(res.status).toBe(400);
  });

  it('rejects request with empty purpose', async () => {
    const token = signAccessToken({
      sub: 'super-admin',
      role: 'SUPER_ADMIN',
    });

    const res = await request(app)
      .post('/api/admin/audit/export')
      .set('Authorization', `Bearer ${token}`)
      .send({ format: 'json', purpose: '' });

    expect(res.status).toBe(400);
  });

  it('rejects invalid format', async () => {
    const token = signAccessToken({
      sub: 'super-admin',
      role: 'SUPER_ADMIN',
    });

    const res = await request(app)
      .post('/api/admin/audit/export')
      .set('Authorization', `Bearer ${token}`)
      .send({ format: 'xml', purpose: 'compliance' });

    expect(res.status).toBe(400);
  });

  it('rejects date range exceeding 365 days', async () => {
    const token = signAccessToken({
      sub: 'super-admin',
      role: 'SUPER_ADMIN',
    });

    const res = await request(app)
      .post('/api/admin/audit/export')
      .set('Authorization', `Bearer ${token}`)
      .send({ format: 'json', purpose: 'review', dateFrom: '2020-01-01', dateTo: '2022-01-01' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('365 days');
  });
});

describe.skipIf(!dbReady)('POST /api/admin/audit/export (requires database)', () => {
  it('returns 200 with JSON export for SUPER_ADMIN', async () => {
    const token = signAccessToken({
      sub: 'super-admin-user',
      role: 'SUPER_ADMIN',
    });

    const res = await request(app)
      .post('/api/admin/audit/export')
      .set('Authorization', `Bearer ${token}`)
      .send({ format: 'json', purpose: 'Quarterly compliance audit' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('metadata');
    expect(res.body).toHaveProperty('entries');
    expect(res.body.metadata).toHaveProperty('purpose', 'Quarterly compliance audit');
    expect(res.body.metadata).toHaveProperty('exportedBy');
    expect(res.body.metadata.exportedBy).toHaveProperty('id', 'super-admin-user');
    expect(res.body.metadata.exportedBy).toHaveProperty('name');
    expect(res.body.metadata).toHaveProperty('generatedAt');
    expect(res.body.metadata).toHaveProperty('totalEntries');
    expect(Array.isArray(res.body.entries)).toBe(true);
  });

  it('returns CSV content for csv format', async () => {
    const token = signAccessToken({
      sub: 'super-admin-user',
      role: 'SUPER_ADMIN',
    });

    const res = await request(app)
      .post('/api/admin/audit/export')
      .set('Authorization', `Bearer ${token}`)
      .send({ format: 'csv', purpose: 'Monthly report' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const csvText = res.text;
    expect(csvText).toContain('# Export Purpose: Monthly report');
    expect(csvText).toContain('# Exported By:');
    expect(csvText).toContain('# Generated At:');
    expect(csvText).toContain('# Total Entries:');
    expect(csvText).toContain('id,actorId,actorName,action,resource,resourceId,organizationId,timestamp,details');
  });

  it('returns 200 with org-scoped results for COMPANY_ADMIN', async () => {
    const token = signAccessToken({
      sub: 'company-admin-user',
      role: 'COMPANY_ADMIN',
      organizationId: 'org-1',
    });

    const res = await request(app)
      .post('/api/admin/audit/export')
      .set('Authorization', `Bearer ${token}`)
      .send({ format: 'json', purpose: 'Internal review' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('metadata');
    expect(res.body).toHaveProperty('entries');
  });

  it('applies action filter to export', async () => {
    const token = signAccessToken({
      sub: 'super-admin-user',
      role: 'SUPER_ADMIN',
    });

    const res = await request(app)
      .post('/api/admin/audit/export')
      .set('Authorization', `Bearer ${token}`)
      .send({ format: 'json', purpose: 'check', action: 'user.created' });

    expect(res.status).toBe(200);
    for (const entry of res.body.entries) {
      expect(entry.action).toBe('user.created');
    }
  });
});

describe('GET /api/admin/audit/:id (no database)', () => {
  it('returns 401 when no auth token is provided', async () => {
    const res = await request(app).get('/api/admin/audit/some-id');
    expect(res.status).toBe(401);
  });

  it('returns 403 when user role is not SUPER_ADMIN or COMPANY_ADMIN', async () => {
    const token = signAccessToken({
      sub: 'provider-user',
      role: 'PROVIDER',
      organizationId: 'org-1',
    });

    const res = await request(app)
      .get('/api/admin/audit/some-id')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 401 when COMPANY_ADMIN has no organizationId', async () => {
    const token = signAccessToken({
      sub: 'admin-user',
      role: 'COMPANY_ADMIN',
    });

    const res = await request(app)
      .get('/api/admin/audit/some-id')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
  });
});

describe.skipIf(!dbReady)('GET /api/admin/audit (requires database)', () => {
  it('returns 200 with paginated response shape for SUPER_ADMIN', async () => {
    const token = signAccessToken({
      sub: 'super-admin-user',
      role: 'SUPER_ADMIN',
    });

    const res = await request(app)
      .get('/api/admin/audit')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('page', 1);
    expect(res.body).toHaveProperty('pageSize', 50);
    expect(res.body).toHaveProperty('totalCount');
    expect(res.body).toHaveProperty('totalPages');
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('returns 200 with paginated response for COMPANY_ADMIN with org context', async () => {
    const token = signAccessToken({
      sub: 'company-admin-user',
      role: 'COMPANY_ADMIN',
      organizationId: 'org-1',
    });

    const res = await request(app)
      .get('/api/admin/audit')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('page', 1);
    expect(res.body).toHaveProperty('pageSize', 50);
    expect(res.body).toHaveProperty('totalCount');
    expect(res.body).toHaveProperty('totalPages');
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('respects page and pageSize parameters', async () => {
    const token = signAccessToken({
      sub: 'super-admin-user',
      role: 'SUPER_ADMIN',
    });

    const res = await request(app)
      .get('/api/admin/audit?page=1&pageSize=10')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(10);
    expect(res.body.items.length).toBeLessThanOrEqual(10);
  });

  it('returns items with expected shape', async () => {
    const token = signAccessToken({
      sub: 'super-admin-user',
      role: 'SUPER_ADMIN',
    });

    const res = await request(app)
      .get('/api/admin/audit')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    for (const item of res.body.items) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('actorId');
      expect(item).toHaveProperty('actorName');
      expect(item).toHaveProperty('action');
      expect(item).toHaveProperty('resource');
      expect(item).toHaveProperty('resourceId');
      expect(item).toHaveProperty('organizationId');
      expect(item).toHaveProperty('timestamp');
      expect(item).toHaveProperty('changeSummary');
      // Timestamp should be ISO 8601
      if (item.timestamp) {
        expect(new Date(item.timestamp).toISOString()).toBe(item.timestamp);
      }
    }
  });

  it('returns items in reverse chronological order', async () => {
    const token = signAccessToken({
      sub: 'super-admin-user',
      role: 'SUPER_ADMIN',
    });

    const res = await request(app)
      .get('/api/admin/audit')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const timestamps = res.body.items.map((item: any) => new Date(item.timestamp).getTime());
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i - 1]).toBeGreaterThanOrEqual(timestamps[i]);
    }
  });

  it('returns empty items array when no results match (empty state)', async () => {
    const token = signAccessToken({
      sub: 'super-admin-user',
      role: 'SUPER_ADMIN',
    });

    const res = await request(app)
      .get('/api/admin/audit?action=nonexistent_action_xyz')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.totalCount).toBe(0);
  });

  it('applies action filter', async () => {
    const token = signAccessToken({
      sub: 'super-admin-user',
      role: 'SUPER_ADMIN',
    });

    const res = await request(app)
      .get('/api/admin/audit?action=user.created')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    for (const item of res.body.items) {
      expect(item.action).toBe('user.created');
    }
  });

  it('applies resource filter', async () => {
    const token = signAccessToken({
      sub: 'super-admin-user',
      role: 'SUPER_ADMIN',
    });

    const res = await request(app)
      .get('/api/admin/audit?resource=user')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    for (const item of res.body.items) {
      expect(item.resource).toBe('user');
    }
  });

  it('SUPER_ADMIN can filter by organizationId', async () => {
    const token = signAccessToken({
      sub: 'super-admin-user',
      role: 'SUPER_ADMIN',
    });

    const res = await request(app)
      .get('/api/admin/audit?organizationId=org-1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    for (const item of res.body.items) {
      expect(item.organizationId).toBe('org-1');
    }
  });

  it('defaults date range to last 30 days', async () => {
    const token = signAccessToken({
      sub: 'super-admin-user',
      role: 'SUPER_ADMIN',
    });

    const res = await request(app)
      .get('/api/admin/audit')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // All returned items should be within last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const item of res.body.items) {
      const itemDate = new Date(item.timestamp);
      expect(itemDate.getTime()).toBeGreaterThanOrEqual(thirtyDaysAgo.getTime() - 1000); // 1s tolerance
    }
  });
});

describe.skipIf(!dbReady)('GET /api/admin/audit/:id (requires database)', () => {
  it('returns 404 for a non-existent audit entry', async () => {
    const token = signAccessToken({
      sub: 'super-admin-user',
      role: 'SUPER_ADMIN',
    });

    const res = await request(app)
      .get('/api/admin/audit/nonexistent-id-xyz')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns full audit detail with expected shape for SUPER_ADMIN', async () => {
    const token = signAccessToken({
      sub: 'super-admin-user',
      role: 'SUPER_ADMIN',
    });

    // First, get a valid audit entry ID from the list
    const listRes = await request(app)
      .get('/api/admin/audit?pageSize=1')
      .set('Authorization', `Bearer ${token}`);

    if (listRes.body.items.length === 0) return; // no entries to test

    const entryId = listRes.body.items[0].id;

    const res = await request(app)
      .get(`/api/admin/audit/${entryId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', entryId);
    expect(res.body).toHaveProperty('actorId');
    expect(res.body).toHaveProperty('actorName');
    expect(res.body).toHaveProperty('action');
    expect(res.body).toHaveProperty('resource');
    expect(res.body).toHaveProperty('resourceId');
    expect(res.body).toHaveProperty('organizationId');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('details');
    expect(res.body).toHaveProperty('resourceLink');
    expect(res.body.resourceLink).toHaveProperty('active');

    // Timestamp should be ISO 8601
    if (res.body.timestamp) {
      expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
    }

    // resourceLink should have the correct shape
    if (res.body.resourceLink.active) {
      expect(res.body.resourceLink).toHaveProperty('url');
      expect(res.body.resourceLink.url).toMatch(/^\/portal\/iam\//);
    } else {
      expect(res.body.resourceLink).toHaveProperty('label');
    }
  });

  it('COMPANY_ADMIN returns 404 for an entry from a different org', async () => {
    const superToken = signAccessToken({
      sub: 'super-admin-user',
      role: 'SUPER_ADMIN',
    });

    // Get all audit entries
    const listRes = await request(app)
      .get('/api/admin/audit?pageSize=50')
      .set('Authorization', `Bearer ${superToken}`);

    if (listRes.body.items.length === 0) return;

    // Find an entry with an orgId that is different from 'org-test-different'
    const entry = listRes.body.items.find(
      (item: any) => item.organizationId && item.organizationId !== 'org-test-different',
    );
    if (!entry) return; // no entry with org to test

    // COMPANY_ADMIN with a DIFFERENT org
    const companyToken = signAccessToken({
      sub: 'company-admin-different',
      role: 'COMPANY_ADMIN',
      organizationId: 'org-test-different',
    });

    const res = await request(app)
      .get(`/api/admin/audit/${entry.id}`)
      .set('Authorization', `Bearer ${companyToken}`);

    expect(res.status).toBe(404);
  });
});
