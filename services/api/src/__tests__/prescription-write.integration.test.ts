import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { signAccessToken } from '../lib/jwt';
import { disconnectPrisma, getDatabaseHealth, prisma } from '../lib/prisma';

// Provider prescriptions write flow: create a prescription draft via the
// provider API using a privileged (SUPER_ADMIN) context, against a seeded
// patient. Persists to the PrescriptionDraft model. Cleans up at the Prisma
// level. Requires a database (disposable test/dev/pilot DB).

const app = createApp();

const dbHealth = await getDatabaseHealth().catch(() => ({ ok: false }));
const dbReady = Boolean((dbHealth as { ok?: boolean }).ok);

describe.skipIf(!dbReady)('provider prescription write flow', () => {
  let seedOrgId = '';
  let adminUserId = '';
  let patientUserId = '';
  let patientProfileId = '';
  let token = '';

  beforeAll(async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const org = await prisma.organization.create({ data: { name: `itest-rx-org-${stamp}` } });
    seedOrgId = org.id;

    const admin = await prisma.user.create({
      data: {
        email: `itest-rx-admin-${stamp}@example.com`,
        passwordHash: 'integration-test-not-a-real-hash',
        firstName: 'Rx',
        lastName: 'Admin',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        organizationId: org.id,
      },
    });
    adminUserId = admin.id;

    const patientUser = await prisma.user.create({
      data: {
        email: `itest-rx-patient-${stamp}@example.com`,
        passwordHash: 'integration-test-not-a-real-hash',
        firstName: 'Rx',
        lastName: 'Patient',
        role: 'PATIENT',
        status: 'ACTIVE',
        organizationId: org.id,
      },
    });
    patientUserId = patientUser.id;

    const patientProfile = await prisma.patientProfile.create({
      data: { userId: patientUser.id, organizationId: org.id, preferences: {} },
    });
    patientProfileId = patientProfile.id;

    token = signAccessToken({ sub: admin.id, role: 'SUPER_ADMIN', organizationId: org.id });
  });

  afterAll(async () => {
    const where = { organizationId: seedOrgId };
    try {
      await prisma.auditLog
        .deleteMany({ where: { OR: [{ organizationId: seedOrgId }, { actorId: adminUserId }] } })
        .catch(() => undefined);
      await prisma.prescriptionDraft.deleteMany({ where }).catch(() => undefined);
      await prisma.medicalRecord.deleteMany({ where: { patientId: patientProfileId } }).catch(() => undefined);
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

  it('creates a prescription draft (201) and lists it back', async () => {
    const createRes = await request(app)
      .post('/api/provider/prescriptions/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientId: patientProfileId,
        patientName: 'Rx Patient',
        drug: 'Amoxicillin',
        dosage: '500mg',
        frequency: 'Three times daily',
        duration: '7 days',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.item?.id).toBeTruthy();
    expect(createRes.body.item?.drug).toBe('Amoxicillin');

    const listRes = await request(app)
      .get('/api/provider/prescriptions/items')
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.items)).toBe(true);
  });

  it('rejects an invalid prescription body (400)', async () => {
    const res = await request(app)
      .post('/api/provider/prescriptions/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientId: patientProfileId });
    expect(res.status).toBe(400);
  });
});
