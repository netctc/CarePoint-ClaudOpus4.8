import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { disconnectPrisma, getDatabaseHealth, prisma } from '../lib/prisma';

const app = createApp();
const dbHealth = await getDatabaseHealth().catch(() => ({ ok: false }));
const dbReady = Boolean((dbHealth as { ok?: boolean }).ok);

const suffix = randomUUID();
const email = `privileged-${suffix}@carecenter.local`;
const password = 'ReleaseV1-Test-Password-42!';
const organizationId = `org-${suffix}`;
const userId = `user-${suffix}`;

afterAll(async () => {
  await disconnectPrisma().catch(() => undefined);
});

describe('public privileged-account bootstrap guard', () => {
  it('blocks privileged role creation through the public register endpoint', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: `blocked-${suffix}@carecenter.local`,
      password,
      firstName: 'Blocked',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      organizationName: 'Blocked public bootstrap',
    });

    expect(res.status).toBe(403);
  });
});

describe.skipIf(!dbReady)('privileged v1 authentication hardening', () => {
  beforeAll(async () => {
    await prisma.organization.create({
      data: {
        id: organizationId,
        name: `Privileged auth v1 test ${suffix}`,
      },
    });

    await prisma.user.create({
      data: {
        id: userId,
        email,
        passwordHash: await bcrypt.hash(password, 10),
        firstName: 'Release',
        lastName: 'Admin',
        role: 'COMPANY_ADMIN',
        organizationId,
      },
    });
  });

  it('does not mint a session from password-only login for privileged roles', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password });

    expect(res.status).toBe(403);
    expect(res.body.accessToken).toBeUndefined();
  });

  it('forces delivered email OTP and only issues a session after challenge verification', async () => {
    const start = await request(app).post('/api/auth/challenge/start').send({
      email,
      password,
      managedDevice: true,
      riskAcknowledged: true,
      // Compatibility input from the existing clients. The release router must
      // refuse to treat this as real TOTP and enforce email delivery instead.
      channel: 'totp',
    });

    expect(start.status).toBe(202);
    expect(start.body.channel).toBe('email');
    expect(typeof start.body.challengeId).toBe('string');
    expect(typeof start.body.devCode).toBe('string');

    const verify = await request(app).post('/api/auth/challenge/verify').send({
      challengeId: start.body.challengeId,
      code: start.body.devCode,
    });

    expect(verify.status).toBe(200);
    expect(typeof verify.body.accessToken).toBe('string');
    expect(verify.body.user.role).toBe('COMPANY_ADMIN');
  });
});
