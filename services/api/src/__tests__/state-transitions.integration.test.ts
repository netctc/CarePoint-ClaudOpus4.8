import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { signAccessToken } from '../lib/jwt';
import { disconnectPrisma, getDatabaseHealth, prisma } from '../lib/prisma';

// State-transition flows: account activate/suspend and catalog service
// publish/archive. Reuses a seeded admin + organization; cleans up at the
// Prisma level. Requires a database (disposable test/dev/pilot DB).

const app = createApp();

const dbHealth = await getDatabaseHealth().catch(() => ({ ok: false }));
const dbReady = Boolean((dbHealth as { ok?: boolean }).ok);

describe.skipIf(!dbReady)('state transitions (accounts + catalog)', () => {
  let seedOrgId = '';
  let seedUserId = '';
  let token = '';

  beforeAll(async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const org = await prisma.organization.create({ data: { name: `itest-state-org-${stamp}` } });
    seedOrgId = org.id;
    const user = await prisma.user.create({
      data: {
        email: `itest-state-admin-${stamp}@example.com`,
        passwordHash: 'integration-test-not-a-real-hash',
        firstName: 'State',
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
    const where = { organizationId: seedOrgId };
    try {
      await prisma.auditLog
        .deleteMany({ where: { OR: [{ organizationId: seedOrgId }, { actorId: seedUserId }] } })
        .catch(() => undefined);
      await prisma.serviceCatalogItem.deleteMany({ where }).catch(() => undefined);
      await prisma.providerOnboardingState.deleteMany({ where }).catch(() => undefined);
      await prisma.providerProfile.deleteMany({ where }).catch(() => undefined);
      await prisma.patientProfile.deleteMany({ where }).catch(() => undefined);
      await prisma.refreshToken
        .deleteMany({ where: { user: { is: { organizationId: seedOrgId } } } })
        .catch(() => undefined);
      await prisma.user.deleteMany({ where }).catch(() => undefined);
      await prisma.organization.delete({ where: { id: seedOrgId } }).catch(() => undefined);
    } finally {
      await disconnectPrisma().catch(() => undefined);
    }
  });

  const authPost = (path: string, body?: object) =>
    request(app).post(path).set('Authorization', `Bearer ${token}`).send(body ?? {});
  const authPatch = (path: string, body?: object) =>
    request(app).patch(path).set('Authorization', `Bearer ${token}`).send(body ?? {});

  it('suspends and reactivates a patient account', async () => {
    const email = `itest-state-patient-${Date.now()}@example.com`;
    const password = `State-Flow-${Date.now()}-Aa9!`;
    const created = await authPost('/api/admin/users/patients', {
      email,
      firstName: 'St',
      lastName: 'Ate',
      password,
    });
    expect(created.status).toBe(201);
    const patientId = created.body.item.id as string;

    const suspended = await authPatch(`/api/admin/users/patients/${patientId}/status`, {
      status: 'SUSPENDED',
      deactivationReason: 'integration test',
    });
    expect(suspended.status).toBe(200);
    expect(String(suspended.body.item?.status).toUpperCase()).toBe('SUSPENDED');

    const reactivated = await authPatch(`/api/admin/users/patients/${patientId}/status`, { status: 'ACTIVE' });
    expect(reactivated.status).toBe(200);
    expect(String(reactivated.body.item?.status).toUpperCase()).toBe('ACTIVE');
  });

  it('publishes and archives a catalog service', async () => {
    const code = `ITEST-ST-${Date.now().toString().slice(-7)}`;
    const created = await authPost('/api/catalog/services', {
      code,
      name: 'State Transition Service',
      category: 'General',
      description: 'Created by the integration test suite.',
      durationMinutes: 30,
    });
    expect(created.status).toBe(201);
    const serviceId = created.body.item.id as string;

    const published = await authPost(`/api/catalog/services/${serviceId}/publish`, { note: 'go live' });
    expect(published.status).toBe(200);
    expect(String(published.body.item?.status).toUpperCase()).toBe('PUBLISHED');

    const archived = await authPost(`/api/catalog/services/${serviceId}/archive`, { note: 'retire' });
    expect(archived.status).toBe(200);
    expect(String(archived.body.item?.status).toUpperCase()).toBe('ARCHIVED');
  });
});
