import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { signAccessToken } from '../lib/jwt';
import { disconnectPrisma, getDatabaseHealth, prisma } from '../lib/prisma';

// End-to-end appointment booking flow (patient session):
//   create slot hold -> upload INSURANCE + IDENTITY booking documents -> book.
// The booking policy (no coverage rule => permissive) still always requires
// insurance + identity documents, so the full multi-step flow is exercised.
// Seeds a patient (with profile) and a provider; cleans up at the Prisma level.
// Requires a database (disposable test/dev/pilot DB).

const app = createApp();

const dbHealth = await getDatabaseHealth().catch(() => ({ ok: false }));
const dbReady = Boolean((dbHealth as { ok?: boolean }).ok);

// A bookable UTC window comfortably in the future (>2h lead time, 06:00–23:00 UTC).
const base = new Date(Date.now() + 36 * 60 * 60 * 1000);
const day = base.toISOString().slice(0, 10);
const startsAt = `${day}T10:00:00.000Z`;
const endsAt = `${day}T10:30:00.000Z`;
const service = 'General Consultation';
const location = 'Main Clinic';

describe.skipIf(!dbReady)('appointment booking flow (hold -> documents -> book)', () => {
  let seedOrgId = '';
  let patientUserId = '';
  let providerUserId = '';
  let patientProfileId = '';
  let providerProfileId = '';
  let token = '';

  beforeAll(async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const org = await prisma.organization.create({ data: { name: `itest-appt-org-${stamp}` } });
    seedOrgId = org.id;

    const patientUser = await prisma.user.create({
      data: {
        email: `itest-appt-patient-${stamp}@example.com`,
        passwordHash: 'integration-test-not-a-real-hash',
        firstName: 'Appt',
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

    const providerUser = await prisma.user.create({
      data: {
        email: `itest-appt-provider-${stamp}@example.com`,
        passwordHash: 'integration-test-not-a-real-hash',
        firstName: 'Appt',
        lastName: 'Provider',
        role: 'PROVIDER',
        status: 'ACTIVE',
        organizationId: org.id,
      },
    });
    providerUserId = providerUser.id;
    const providerProfile = await prisma.providerProfile.create({
      data: { userId: providerUser.id, organizationId: org.id, specialty: 'General Medicine' },
    });
    providerProfileId = providerProfile.id;

    // Patient session token (slot holds derive patientId from the patient context).
    token = signAccessToken({ sub: patientUser.id, role: 'PATIENT', organizationId: org.id });
  });

  afterAll(async () => {
    const where = { organizationId: seedOrgId };
    try {
      await prisma.auditLog
        .deleteMany({ where: { OR: [{ organizationId: seedOrgId }, { actorId: patientUserId }] } })
        .catch(() => undefined);
      await prisma.appointment.deleteMany({ where }).catch(() => undefined); // cascades AppointmentSubjectContext
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

  it('books an appointment through the full hold + documents flow (201)', async () => {
    const auth = (path: string) => request(app).post(path).set('Authorization', `Bearer ${token}`);

    // 1) Hold the slot.
    const holdRes = await auth('/api/appointments/holds').send({
      providerId: providerProfileId,
      service,
      location,
      startsAt,
      endsAt,
    });
    expect(holdRes.status).toBe(201);
    const holdId = holdRes.body.hold?.id as string;
    expect(holdId).toBeTruthy();

    // 2) Upload the required booking documents.
    const insuranceRes = await auth('/api/appointments/booking-documents').send({
      holdId,
      kind: 'INSURANCE',
      fileName: 'insurance-card.pdf',
    });
    expect(insuranceRes.status).toBe(201);
    const insuranceDocumentId = insuranceRes.body.item?.id as string;

    const identityRes = await auth('/api/appointments/booking-documents').send({
      holdId,
      kind: 'IDENTITY',
      fileName: 'national-id.pdf',
    });
    expect(identityRes.status).toBe(201);
    const idDocumentId = identityRes.body.item?.id as string;

    // 3) Confirm the booking with the hold + documents.
    const bookRes = await auth('/api/appointments/book-with-hold').send({
      holdId,
      patientId: patientProfileId,
      providerId: providerProfileId,
      organizationId: seedOrgId,
      service,
      location,
      startsAt,
      endsAt,
      intakeCompleted: true,
      policyAccepted: true,
      insuranceUploaded: true,
      insuranceDocumentId,
      idUploaded: true,
      idDocumentId,
      paymentMethod: 'CARD',
    });
    expect(bookRes.status).toBe(201);
    expect(bookRes.body?.id).toBeTruthy();

    // 4) The appointment is persisted (visible to the patient's appointment list).
    const listRes = await request(app)
      .get('/api/appointments')
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
  });

  it('rejects booking confirmation without intake/documents (400)', async () => {
    // Use a different slot so it never collides with the booked appointment above.
    const altStartsAt = `${day}T11:00:00.000Z`;
    const altEndsAt = `${day}T11:30:00.000Z`;
    const holdRes = await request(app)
      .post('/api/appointments/holds')
      .set('Authorization', `Bearer ${token}`)
      .send({ providerId: providerProfileId, service, location, startsAt: altStartsAt, endsAt: altEndsAt });
    expect(holdRes.status).toBe(201);

    const bookRes = await request(app)
      .post('/api/appointments/book-with-hold')
      .set('Authorization', `Bearer ${token}`)
      .send({
        holdId: holdRes.body.hold.id,
        patientId: patientProfileId,
        providerId: providerProfileId,
        organizationId: seedOrgId,
        service,
        location,
        startsAt: altStartsAt,
        endsAt: altEndsAt,
      });
    expect(bookRes.status).toBe(400);
  });
});
