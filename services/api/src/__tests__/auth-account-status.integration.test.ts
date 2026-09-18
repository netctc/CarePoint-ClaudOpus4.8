import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { signRefreshToken } from '../lib/jwt';
import { disconnectPrisma, getDatabaseHealth, prisma } from '../lib/prisma';

const app = createApp();
const dbHealth = await getDatabaseHealth().catch(() => ({ ok: false }));
const dbReady = Boolean((dbHealth as { ok?: boolean }).ok);
const suffix = randomUUID();
const orgA = `status-org-a-${suffix}`;
const orgB = `status-org-b-${suffix}`;
const password = 'ReleaseV1-Status-Test-42!';

afterAll(async () => {
  await disconnectPrisma().catch(() => undefined);
});

describe.skipIf(!dbReady)('auth account-status enforcement', () => {
  beforeAll(async () => {
    await prisma.organization.createMany({
      data: [
        { id: orgA, name: `Status Org A ${suffix}` },
        { id: orgB, name: `Status Org B ${suffix}` },
      ],
    });
  });

  it('blocks password login for a suspended account even with the correct password', async () => {
    const email = `suspended-${suffix}@example.com`;
    const user = await prisma.user.create({
      data: {
        id: `suspended-${suffix}`,
        email,
        passwordHash: await bcrypt.hash(password, 10),
        firstName: 'Suspended',
        lastName: 'Patient',
        role: 'PATIENT',
        status: 'SUSPENDED',
        organizationId: orgA,
      },
    });

    const res = await request(app).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(401);
    expect(res.body.accessToken).toBeUndefined();

    const activeTokens = await prisma.refreshToken.count({
      where: { userId: user.id, revokedAt: null },
    });
    expect(activeTokens).toBe(0);
  });

  it('cannot complete a privileged challenge after the account is archived', async () => {
    const email = `challenge-${suffix}@carecenter.local`;
    const user = await prisma.user.create({
      data: {
        id: `challenge-${suffix}`,
        email,
        passwordHash: await bcrypt.hash(password, 10),
        firstName: 'Challenge',
        lastName: 'Admin',
        role: 'COMPANY_ADMIN',
        status: 'ACTIVE',
        organizationId: orgA,
      },
    });

    const start = await request(app).post('/api/auth/challenge/start').send({
      email,
      password,
      managedDevice: true,
      riskAcknowledged: true,
      channel: 'email',
    });
    expect(start.status).toBe(202);
    expect(typeof start.body.devCode).toBe('string');

    await prisma.user.update({ where: { id: user.id }, data: { status: 'ARCHIVED' } });

    const verify = await request(app).post('/api/auth/challenge/verify').send({
      challengeId: start.body.challengeId,
      code: start.body.devCode,
    });
    expect(verify.status).toBe(401);
    expect(verify.body.accessToken).toBeUndefined();
  });

  it('revokes stored refresh tokens and denies refresh for an archived account', async () => {
    const user = await prisma.user.create({
      data: {
        id: `archived-refresh-${suffix}`,
        email: `archived-refresh-${suffix}@example.com`,
        passwordHash: 'not-used',
        firstName: 'Archived',
        lastName: 'Refresh',
        role: 'PATIENT',
        status: 'ARCHIVED',
        organizationId: orgA,
      },
    });
    const rawRefreshToken = signRefreshToken({
      sub: user.id,
      role: 'PATIENT',
      organizationId: orgA,
    });
    const stored = await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: await bcrypt.hash(rawRefreshToken, 10),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: rawRefreshToken });
    expect(res.status).toBe(401);

    const refreshedStored = await prisma.refreshToken.findUnique({ where: { id: stored.id } });
    expect(refreshedStored?.revokedAt).toBeTruthy();
  });

  it('refresh emits current database role and organization instead of stale JWT claims', async () => {
    const user = await prisma.user.create({
      data: {
        id: `current-state-${suffix}`,
        email: `current-state-${suffix}@example.com`,
        passwordHash: 'not-used',
        firstName: 'Current',
        lastName: 'State',
        role: 'PATIENT',
        status: 'ACTIVE',
        organizationId: orgA,
      },
    });
    const rawRefreshToken = signRefreshToken({
      sub: user.id,
      role: 'PATIENT',
      organizationId: orgA,
    });
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: await bcrypt.hash(rawRefreshToken, 10),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    // Simulate stale claims defensively. The governed role-change route also
    // revokes refresh tokens, but refresh must never trust token claims alone.
    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'FINANCE', organizationId: orgB },
    });

    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: rawRefreshToken });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('FINANCE');
    expect(res.body.user.organizationId).toBe(orgB);
  });
});
