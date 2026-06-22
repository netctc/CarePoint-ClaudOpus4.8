import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { signAccessToken } from '../lib/jwt';
import { disconnectPrisma, getDatabaseHealth, prisma } from '../lib/prisma';

// Write/persistence flow: creates an organization through the API and verifies
// it is persisted and listed back. Requires a real database. Seeds a real admin
// User (the audit log written on create has a FK to the actor) and cleans up all
// created rows at the Prisma level in afterAll so it leaves no residue.
//
// NOTE: runs against the configured DATABASE_URL. Intended for the disposable
// test/dev/pilot database (the same one CI spins up), not a production DB.

const app = createApp();

const dbHealth = await getDatabaseHealth().catch(() => ({ ok: false }));
const dbReady = Boolean((dbHealth as { ok?: boolean }).ok);

describe.skipIf(!dbReady)('organization write flow (create + persistence)', () => {
  let seedOrgId = '';
  let seedUserId = '';
  let token = '';
  const createdOrgIds: string[] = [];

  beforeAll(async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const org = await prisma.organization.create({ data: { name: `itest-seed-org-${stamp}` } });
    seedOrgId = org.id;
    const user = await prisma.user.create({
      data: {
        email: `itest-admin-${stamp}@example.com`,
        passwordHash: 'integration-test-not-a-real-hash',
        firstName: 'Integration',
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
      // Audit logs reference the actor (User) and the organization via FKs;
      // remove them before deleting the rows they point at.
      await prisma.auditLog
        .deleteMany({
          where: {
            OR: [
              ...createdOrgIds.map((id) => ({ organizationId: id })),
              { organizationId: seedOrgId },
              { actorId: seedUserId },
            ],
          },
        })
        .catch(() => undefined);
      for (const id of createdOrgIds) {
        await prisma.organization.delete({ where: { id } }).catch(() => undefined);
      }
      if (seedUserId) await prisma.user.delete({ where: { id: seedUserId } }).catch(() => undefined);
      if (seedOrgId) await prisma.organization.delete({ where: { id: seedOrgId } }).catch(() => undefined);
    } finally {
      await disconnectPrisma().catch(() => undefined);
    }
  });

  it('creates an organization (201) and returns it in the list', async () => {
    const name = `itest-org-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const createRes = await request(app)
      .post('/api/admin/users/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name });

    expect(createRes.status).toBe(201);
    expect(createRes.body.item?.id).toBeTruthy();
    expect(createRes.body.item?.name).toBe(name);
    if (createRes.body.item?.id) createdOrgIds.push(createRes.body.item.id);

    const listRes = await request(app)
      .get('/api/admin/users/organizations')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    const names = (listRes.body.items as Array<{ name: string }>).map((o) => o.name);
    expect(names).toContain(name);
  });

  it('rejects creating an organization with an empty name (400)', async () => {
    const res = await request(app)
      .post('/api/admin/users/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '' });
    expect(res.status).toBe(400);
  });
});
