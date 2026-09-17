import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { signAccessToken } from '../lib/jwt';
import { disconnectPrisma, getDatabaseHealth, prisma } from '../lib/prisma';

// Write/persistence flows for admin-managed accounts: create a patient and a
// provider through the API and verify they are persisted and listed back.
// Each create writes User (+ PatientProfile / ProviderProfile + onboarding
// state) plus an audit log (FK to the seeded admin actor). All rows created
// under the seed organization are removed at the Prisma level in afterAll.
// Requires a database; intended for the disposable test/dev/pilot database.

const app = createApp();

const dbHealth = await getDatabaseHealth().catch(() => ({ ok: false }));
const dbReady = Boolean((dbHealth as { ok?: boolean }).ok);

describe.skipIf(!dbReady)('admin account write flows (patient + provider)', () => {
  let seedOrgId = '';
  let seedUserId = '';
  let token = '';

  beforeAll(async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const org = await prisma.organization.create({ data: { name: `itest-acct-org-${stamp}` } });
    seedOrgId = org.id;
    const user = await prisma.user.create({
      data: {
        email: `itest-acct-admin-${stamp}@example.com`,
        passwordHash: 'integration-test-not-a-real-hash',
        firstName: 'Account',
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
    // Order matters because of foreign keys: audit logs and onboarding state
    // reference the actor/org, profiles reference users, users reference org.
    const where = { organizationId: seedOrgId };
    try {
      await prisma.auditLog
        .deleteMany({ where: { OR: [{ organizationId: seedOrgId }, { actorId: seedUserId }] } })
        .catch(() => undefined);
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

  it('creates a patient account (201) with explicit temporary password and lists it back', async () => {
    const email = `itest-patient-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
    const createRes = await request(app)
      .post('/api/admin/users/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email,
        firstName: 'Pat',
        lastName: 'Ient',
        password: `P!lot-${Date.now()}-Patient-X9`,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.item?.id).toBeTruthy();
    expect(String(createRes.body.item?.email).toLowerCase()).toBe(email.toLowerCase());

    const listRes = await request(app)
      .get('/api/admin/users/patients')
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    const emails = (listRes.body.items as Array<{ email: string }>).map((i) => String(i.email).toLowerCase());
    expect(emails).toContain(email.toLowerCase());
  });

  it('rejects creating a patient without a name (400)', async () => {
    const res = await request(app)
      .post('/api/admin/users/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: `itest-bad-${Date.now()}@example.com`,
        password: `P!lot-${Date.now()}-Missing-Name-X9`,
      });
    expect(res.status).toBe(400);
  });

  it('creates a provider account (201, default role) with explicit temporary password and lists it back', async () => {
    const email = `itest-provider-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
    const createRes = await request(app)
      .post('/api/admin/users/providers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email,
        firstName: 'Prov',
        lastName: 'Ider',
        specialty: 'General Medicine',
        password: `P!lot-${Date.now()}-Provider-X9`,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.item?.id).toBeTruthy();
    expect(String(createRes.body.item?.email).toLowerCase()).toBe(email.toLowerCase());

    const listRes = await request(app)
      .get('/api/admin/users/providers')
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    const emails = (listRes.body.items as Array<{ email: string }>).map((i) => String(i.email).toLowerCase());
    expect(emails).toContain(email.toLowerCase());
  });
});
