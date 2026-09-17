import { randomUUID } from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { signAccessToken } from '../lib/jwt';
import { disconnectPrisma, getDatabaseHealth, prisma } from '../lib/prisma';

const app = createApp();
const dbHealth = await getDatabaseHealth().catch(() => ({ ok: false }));
const dbReady = Boolean((dbHealth as { ok?: boolean }).ok);

const suffix = randomUUID();
const orgA = `org-a-${suffix}`;
const orgB = `org-b-${suffix}`;
const actorId = `admin-a-${suffix}`;
const userAId = `user-a-${suffix}`;
const userBId = `user-b-${suffix}`;

const scopedAdminToken = signAccessToken({
  sub: actorId,
  role: 'COMPANY_ADMIN',
  organizationId: orgA,
});
const missingScopeAdminToken = signAccessToken({
  sub: actorId,
  role: 'COMPANY_ADMIN',
});

afterAll(async () => {
  await disconnectPrisma().catch(() => undefined);
});

describe.skipIf(!dbReady)('IAM organization isolation', () => {
  beforeAll(async () => {
    await prisma.organization.createMany({
      data: [
        { id: orgA, name: `Isolation Org A ${suffix}` },
        { id: orgB, name: `Isolation Org B ${suffix}` },
      ],
    });

    await prisma.user.createMany({
      data: [
        {
          id: actorId,
          email: `admin-a-${suffix}@example.com`,
          passwordHash: 'not-used-in-this-test',
          firstName: 'Admin',
          lastName: 'A',
          role: 'COMPANY_ADMIN',
          organizationId: orgA,
        },
        {
          id: userAId,
          email: `user-a-${suffix}@example.com`,
          passwordHash: 'not-used-in-this-test',
          firstName: 'User',
          lastName: 'A',
          role: 'PATIENT',
          organizationId: orgA,
        },
        {
          id: userBId,
          email: `user-b-${suffix}@example.com`,
          passwordHash: 'not-used-in-this-test',
          firstName: 'User',
          lastName: 'B',
          role: 'PATIENT',
          organizationId: orgB,
        },
      ],
    });
  });

  it('lists only users from the COMPANY_ADMIN organization', async () => {
    const res = await request(app)
      .get('/api/admin/users/iam-users?pageSize=100')
      .set('Authorization', `Bearer ${scopedAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items.some((item: { id: string }) => item.id === userAId)).toBe(true);
    expect(res.body.items.some((item: { id: string }) => item.id === userBId)).toBe(false);
    expect(res.body.items.every((item: { organizationId: string | null }) => item.organizationId === orgA)).toBe(true);
  });

  it('returns 403 when a scoped admin requests a user from another organization', async () => {
    const res = await request(app)
      .get(`/api/admin/users/iam-users/${userBId}`)
      .set('Authorization', `Bearer ${scopedAdminToken}`);

    expect(res.status).toBe(403);
    expect(res.body.item).toBeUndefined();
  });

  it('returns 403 and does not mutate a user from another organization', async () => {
    const before = await prisma.user.findUnique({ where: { id: userBId }, select: { status: true } });

    const res = await request(app)
      .patch(`/api/admin/users/iam-users/${userBId}/status`)
      .set('Authorization', `Bearer ${scopedAdminToken}`)
      .send({ status: 'SUSPENDED', reason: 'cross-org test' });

    expect(res.status).toBe(403);
    const after = await prisma.user.findUnique({ where: { id: userBId }, select: { status: true } });
    expect(after?.status).toBe(before?.status);
  });

  it('fails closed when a non-super-admin token has no organization scope', async () => {
    const listRes = await request(app)
      .get('/api/admin/users/iam-users')
      .set('Authorization', `Bearer ${missingScopeAdminToken}`);
    expect(listRes.status).toBe(403);

    const detailRes = await request(app)
      .get(`/api/admin/users/iam-users/${userBId}`)
      .set('Authorization', `Bearer ${missingScopeAdminToken}`);
    expect(detailRes.status).toBe(403);
  });
});
