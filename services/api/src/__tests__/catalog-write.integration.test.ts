import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { signAccessToken } from '../lib/jwt';
import { disconnectPrisma, getDatabaseHealth, prisma } from '../lib/prisma';

// Write/persistence flow for the service catalog: creates a service through the
// API and verifies it is persisted and listed back. Seeds a real admin User
// (the create path writes an audit log with a FK to the actor) and cleans up
// every created row at the Prisma level in afterAll. Requires a database.
// Intended for the disposable test/dev/pilot database, not production.

const app = createApp();

const dbHealth = await getDatabaseHealth().catch(() => ({ ok: false }));
const dbReady = Boolean((dbHealth as { ok?: boolean }).ok);

describe.skipIf(!dbReady)('catalog service write flow (create + persistence)', () => {
  let seedOrgId = '';
  let seedUserId = '';
  let token = '';

  beforeAll(async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const org = await prisma.organization.create({ data: { name: `itest-cat-org-${stamp}` } });
    seedOrgId = org.id;
    const user = await prisma.user.create({
      data: {
        email: `itest-cat-admin-${stamp}@example.com`,
        passwordHash: 'integration-test-not-a-real-hash',
        firstName: 'Catalog',
        lastName: 'Tester',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        organizationId: org.id,
      },
    });
    seedUserId = user.id;
    token = signAccessToken({ sub: user.id, role: 'SUPER_ADMIN', organizationId: org.id });
  });

  afterAll(async () => {
    try {
      await prisma.serviceCatalogItem.deleteMany({ where: { organizationId: seedOrgId } }).catch(() => undefined);
      await prisma.auditLog
        .deleteMany({ where: { OR: [{ organizationId: seedOrgId }, { actorId: seedUserId }] } })
        .catch(() => undefined);
      if (seedUserId) await prisma.user.delete({ where: { id: seedUserId } }).catch(() => undefined);
      if (seedOrgId) await prisma.organization.delete({ where: { id: seedOrgId } }).catch(() => undefined);
    } finally {
      await disconnectPrisma().catch(() => undefined);
    }
  });

  it('creates a catalog service (201) and lists it back', async () => {
    const code = `ITEST-${Date.now().toString().slice(-7)}`;
    const body = {
      code,
      name: 'Integration Test Service',
      category: 'General',
      description: 'Created by the integration test suite.',
      durationMinutes: 30,
      serviceModes: ['IN_PERSON'],
      tags: ['itest'],
    };

    const createRes = await request(app)
      .post('/api/catalog/services')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

    expect(createRes.status).toBe(201);
    expect(createRes.body.item?.id).toBeTruthy();
    expect(createRes.body.item?.code).toBe(code);

    const listRes = await request(app)
      .get('/api/catalog/services')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    const codes = (listRes.body.items as Array<{ code: string }>).map((i) => i.code);
    expect(codes).toContain(code);
  });

  it('rejects an invalid service body (400)', async () => {
    const res = await request(app)
      .post('/api/catalog/services')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'x' });
    expect(res.status).toBe(400);
  });
});
