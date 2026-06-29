import {
  AccountStatus,
  PrismaClient,
  ProviderOnboardingStatus,
  UserRole,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'node:fs/promises';
import path from 'node:path';

const prisma = new PrismaClient();

const PASSWORD = 'ChangeMe123!';
const ORG_ID = 'pilot-org-carepoint-v21';
const ORGANIZATION_NAME = 'CarePoint Controlled Pilot Clinic';

type ProviderSeed = {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  specialty: string;
  licenseNumber: string;
  phone: string;
  services: string[];
  inPersonLocation: string;
  inPersonPattern: Array<{ day: string; hours: string }>;
  onlinePattern: Array<{ day: string; hours: string }>;
  slotDurationMinutes: number;
};

type PatientSeed = {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'Female' | 'Male' | 'Other';
  phone: string;
  city: string;
  region: string;
  preferredLanguage: 'es' | 'en' | 'ar';
  insuranceNumber: string;
};

function escapeIdentifier(value: string) {
  return value.replace(/"/g, '""');
}

async function resetPublicTables() {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  `;
  if (!tables.length) return;
  const tableList = tables.map((row) => `"public"."${escapeIdentifier(row.tablename)}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
}

function serviceCode(input: string) {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function ageFromBirthDate(dateOfBirth: string) {
  const dob = new Date(`${dateOfBirth}T00:00:00.000Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < dob.getUTCDate())) age -= 1;
  return age;
}

const providers: ProviderSeed[] = [
  {
    id: 'pilot-hsp-cardiology',
    userId: 'pilot-user-hsp-cardiology',
    email: 'cardiology.hsp@carepoint.local',
    firstName: 'Valeria',
    lastName: 'Ramos',
    specialty: 'Cardiology',
    licenseNumber: 'HSP-CARD-5001',
    phone: '+1-555-210-5001',
    services: ['Cardiology Consultation', 'ECG Review', 'Hypertension Follow-up'],
    inPersonLocation: 'CarePoint Central Clinic - Cardiology Room 2',
    inPersonPattern: [
      { day: 'Monday', hours: '09:00 - 12:00' },
      { day: 'Wednesday', hours: '13:00 - 17:00' },
    ],
    onlinePattern: [
      { day: 'Tuesday', hours: '15:00 - 18:00' },
      { day: 'Thursday', hours: '09:00 - 11:00' },
    ],
    slotDurationMinutes: 30,
  },
  {
    id: 'pilot-hsp-pediatrics',
    userId: 'pilot-user-hsp-pediatrics',
    email: 'pediatrics.hsp@carepoint.local',
    firstName: 'Andres',
    lastName: 'Molina',
    specialty: 'Pediatrics',
    licenseNumber: 'HSP-PEDS-5002',
    phone: '+1-555-210-5002',
    services: ['Pediatric Consultation', 'Child Wellness Visit', 'Vaccination Review'],
    inPersonLocation: 'CarePoint Family Center - Pediatrics Suite',
    inPersonPattern: [
      { day: 'Monday', hours: '13:00 - 17:00' },
      { day: 'Friday', hours: '09:00 - 12:00' },
    ],
    onlinePattern: [
      { day: 'Tuesday', hours: '09:00 - 12:00' },
      { day: 'Thursday', hours: '14:00 - 17:00' },
    ],
    slotDurationMinutes: 25,
  },
  {
    id: 'pilot-hsp-dermatology',
    userId: 'pilot-user-hsp-dermatology',
    email: 'dermatology.hsp@carepoint.local',
    firstName: 'Camila',
    lastName: 'Santos',
    specialty: 'Dermatology',
    licenseNumber: 'HSP-DERM-5003',
    phone: '+1-555-210-5003',
    services: ['Dermatology Consultation', 'Skin Lesion Review', 'Acne Follow-up'],
    inPersonLocation: 'CarePoint Central Clinic - Dermatology Office',
    inPersonPattern: [
      { day: 'Tuesday', hours: '10:00 - 13:00' },
      { day: 'Thursday', hours: '10:00 - 14:00' },
    ],
    onlinePattern: [
      { day: 'Monday', hours: '16:00 - 18:00' },
      { day: 'Wednesday', hours: '09:00 - 12:00' },
    ],
    slotDurationMinutes: 20,
  },
  {
    id: 'pilot-hsp-neurology',
    userId: 'pilot-user-hsp-neurology',
    email: 'neurology.hsp@carepoint.local',
    firstName: 'Gabriel',
    lastName: 'Luna',
    specialty: 'Neurology',
    licenseNumber: 'HSP-NEUR-5004',
    phone: '+1-555-210-5004',
    services: ['Neurology Consultation', 'Migraine Review', 'Seizure Follow-up'],
    inPersonLocation: 'CarePoint Specialty Center - Neurology Room 1',
    inPersonPattern: [
      { day: 'Wednesday', hours: '10:00 - 14:00' },
      { day: 'Friday', hours: '13:00 - 16:00' },
    ],
    onlinePattern: [
      { day: 'Monday', hours: '09:00 - 11:00' },
      { day: 'Thursday', hours: '16:00 - 18:00' },
    ],
    slotDurationMinutes: 30,
  },
  {
    id: 'pilot-hsp-general-medicine',
    userId: 'pilot-user-hsp-general-medicine',
    email: 'general.medicine.hsp@carepoint.local',
    firstName: 'Lucia',
    lastName: 'Herrera',
    specialty: 'General Medicine',
    licenseNumber: 'HSP-GEN-5005',
    phone: '+1-555-210-5005',
    services: ['General Medicine Consultation', 'Preventive Checkup', 'Medication Follow-up'],
    inPersonLocation: 'CarePoint Central Clinic - General Medicine Room 4',
    inPersonPattern: [
      { day: 'Tuesday', hours: '13:00 - 17:00' },
      { day: 'Friday', hours: '09:00 - 13:00' },
    ],
    onlinePattern: [
      { day: 'Monday', hours: '12:00 - 15:00' },
      { day: 'Wednesday', hours: '15:00 - 18:00' },
    ],
    slotDurationMinutes: 30,
  },
];

const patients: PatientSeed[] = [
  ['pilot-patient-001', 'pilot-user-patient-001', 'sofia.alvarez.patient@carepoint.local', 'Sofia', 'Alvarez', '1992-01-16', 'Female', '+1-555-310-0001', 'Santo Domingo', 'DO-01', 'es', 'PILOT-INS-0001'],
  ['pilot-patient-002', 'pilot-user-patient-002', 'mateo.rojas.patient@carepoint.local', 'Mateo', 'Rojas', '1987-04-09', 'Male', '+1-555-310-0002', 'Santiago', 'DO-25', 'es', 'PILOT-INS-0002'],
  ['pilot-patient-003', 'pilot-user-patient-003', 'isabella.mendez.patient@carepoint.local', 'Isabella', 'Mendez', '1998-09-22', 'Female', '+1-555-310-0003', 'Santo Domingo', 'DO-01', 'es', 'PILOT-INS-0003'],
  ['pilot-patient-004', 'pilot-user-patient-004', 'diego.castillo.patient@carepoint.local', 'Diego', 'Castillo', '1979-12-03', 'Male', '+1-555-310-0004', 'La Vega', 'DO-13', 'es', 'PILOT-INS-0004'],
  ['pilot-patient-005', 'pilot-user-patient-005', 'valentina.suarez.patient@carepoint.local', 'Valentina', 'Suarez', '2001-06-18', 'Female', '+1-555-310-0005', 'San Pedro de Macoris', 'DO-23', 'es', 'PILOT-INS-0005'],
  ['pilot-patient-006', 'pilot-user-patient-006', 'nicolas.fernandez.patient@carepoint.local', 'Nicolas', 'Fernandez', '1983-02-25', 'Male', '+1-555-310-0006', 'Santo Domingo', 'DO-01', 'es', 'PILOT-INS-0006'],
  ['pilot-patient-007', 'pilot-user-patient-007', 'camila.garcia.patient@carepoint.local', 'Camila', 'Garcia', '1995-07-11', 'Female', '+1-555-310-0007', 'Puerto Plata', 'DO-18', 'es', 'PILOT-INS-0007'],
  ['pilot-patient-008', 'pilot-user-patient-008', 'sebastian.morales.patient@carepoint.local', 'Sebastian', 'Morales', '1972-03-29', 'Male', '+1-555-310-0008', 'San Cristobal', 'DO-21', 'es', 'PILOT-INS-0008'],
  ['pilot-patient-009', 'pilot-user-patient-009', 'emilia.navarro.patient@carepoint.local', 'Emilia', 'Navarro', '1990-11-07', 'Female', '+1-555-310-0009', 'Santo Domingo', 'DO-01', 'es', 'PILOT-INS-0009'],
  ['pilot-patient-010', 'pilot-user-patient-010', 'thiago.rivera.patient@carepoint.local', 'Thiago', 'Rivera', '1986-08-15', 'Male', '+1-555-310-0010', 'Higuey', 'DO-11', 'es', 'PILOT-INS-0010'],
  ['pilot-patient-011', 'pilot-user-patient-011', 'mia.vargas.patient@carepoint.local', 'Mia', 'Vargas', '1999-05-04', 'Female', '+1-555-310-0011', 'Bonao', 'DO-28', 'es', 'PILOT-INS-0011'],
  ['pilot-patient-012', 'pilot-user-patient-012', 'alejandro.peralta.patient@carepoint.local', 'Alejandro', 'Peralta', '1968-10-20', 'Male', '+1-555-310-0012', 'Santiago', 'DO-25', 'es', 'PILOT-INS-0012'],
  ['pilot-patient-013', 'pilot-user-patient-013', 'renata.torres.patient@carepoint.local', 'Renata', 'Torres', '1993-12-30', 'Female', '+1-555-310-0013', 'Santo Domingo', 'DO-01', 'es', 'PILOT-INS-0013'],
  ['pilot-patient-014', 'pilot-user-patient-014', 'samuel.cruz.patient@carepoint.local', 'Samuel', 'Cruz', '1981-01-08', 'Male', '+1-555-310-0014', 'La Romana', 'DO-12', 'es', 'PILOT-INS-0014'],
  ['pilot-patient-015', 'pilot-user-patient-015', 'daniela.arias.patient@carepoint.local', 'Daniela', 'Arias', '2003-04-12', 'Female', '+1-555-310-0015', 'Moca', 'DO-09', 'es', 'PILOT-INS-0015'],
  ['pilot-patient-016', 'pilot-user-patient-016', 'martin.ortiz.patient@carepoint.local', 'Martin', 'Ortiz', '1976-07-23', 'Male', '+1-555-310-0016', 'San Francisco de Macoris', 'DO-06', 'es', 'PILOT-INS-0016'],
  ['pilot-patient-017', 'pilot-user-patient-017', 'victoria.pena.patient@carepoint.local', 'Victoria', 'Pena', '1997-02-14', 'Female', '+1-555-310-0017', 'Santo Domingo', 'DO-01', 'es', 'PILOT-INS-0017'],
  ['pilot-patient-018', 'pilot-user-patient-018', 'joaquin.reyes.patient@carepoint.local', 'Joaquin', 'Reyes', '1988-09-19', 'Male', '+1-555-310-0018', 'Bani', 'DO-17', 'es', 'PILOT-INS-0018'],
  ['pilot-patient-019', 'pilot-user-patient-019', 'elena.medina.patient@carepoint.local', 'Elena', 'Medina', '1991-06-02', 'Female', '+1-555-310-0019', 'Santo Domingo Este', 'DO-32', 'es', 'PILOT-INS-0019'],
  ['pilot-patient-020', 'pilot-user-patient-020', 'rafael.silva.patient@carepoint.local', 'Rafael', 'Silva', '1970-11-28', 'Male', '+1-555-310-0020', 'Santiago', 'DO-25', 'es', 'PILOT-INS-0020'],
].map(([id, userId, email, firstName, lastName, dateOfBirth, gender, phone, city, region, preferredLanguage, insuranceNumber]) => ({
  id,
  userId,
  email,
  firstName,
  lastName,
  dateOfBirth,
  gender,
  phone,
  city,
  region,
  preferredLanguage,
  insuranceNumber,
})) as PatientSeed[];

async function createCoreUsers(passwordHash: string, organizationId: string) {
  await prisma.user.createMany({
    data: [
      {
        id: 'pilot-user-admin',
        email: 'admin@carecenter.local',
        passwordHash,
        firstName: 'Pilot',
        lastName: 'Admin',
        role: UserRole.COMPANY_ADMIN,
        status: AccountStatus.ACTIVE,
        organizationId,
      },
      {
        id: 'pilot-user-super-admin',
        email: 'super.admin@carecenter.local',
        passwordHash,
        firstName: 'System',
        lastName: 'Owner',
        role: UserRole.SUPER_ADMIN,
        status: AccountStatus.ACTIVE,
        organizationId,
      },
      {
        id: 'pilot-user-support',
        email: 'support@carecenter.local',
        passwordHash,
        firstName: 'Pilot',
        lastName: 'Support',
        role: UserRole.COMPANY_SUPPORT,
        status: AccountStatus.ACTIVE,
        organizationId,
      },
    ],
  });
}

async function createProviders(passwordHash: string, organizationId: string) {
  for (const provider of providers) {
    await prisma.user.create({
      data: {
        id: provider.userId,
        email: provider.email,
        passwordHash,
        firstName: provider.firstName,
        lastName: provider.lastName,
        role: UserRole.PROVIDER,
        status: AccountStatus.ACTIVE,
        organizationId,
      },
    });

    await prisma.providerProfile.create({
      data: {
        id: provider.id,
        userId: provider.userId,
        organizationId,
        specialty: provider.specialty,
        licenseNumber: provider.licenseNumber,
        services: {
          primarySpecialty: provider.specialty,
          serviceCatalogCodes: provider.services.map(serviceCode),
          services: provider.services,
          phone: provider.phone,
          careModes: ['TELEHEALTH', 'IN_PERSON'],
          serviceMode: 'Both',
          locations: [provider.inPersonLocation, 'Virtual Care'],
          inPersonLocation: provider.inPersonLocation,
          telehealthLocation: 'Virtual Care',
          acceptsNewPatients: true,
          pilotSeed: true,
        } as any,
      },
    });

    await prisma.providerOnboardingState.create({
      data: {
        id: `${provider.id}-onboarding-approved`,
        providerId: provider.id,
        organizationId,
        status: ProviderOnboardingStatus.APPROVED,
        checklist: {
          licenseVerified: true,
          specialtyAssigned: true,
          schedulePublished: true,
          patientBookingReady: true,
          pilotSeed: true,
        } as any,
        submittedAt: new Date(),
        reviewedAt: new Date(),
        decisionNote: 'Approved as part of V21 pilot reset seed.',
        lastAction: 'APPROVED',
        lastActorId: 'pilot-user-admin',
      },
    });

    const baseTemplateData = {
      providerId: provider.id,
      providerName: `Dr. ${provider.firstName} ${provider.lastName}`,
      specialty: provider.specialty,
      timezone: 'America/Santo_Domingo',
      bookingLeadHours: 2,
      cancellationWindowHours: 12,
      capacity: 1,
      bufferMinutes: 5,
      patientBookable: true,
      acceptsNewPatients: true,
      pilotSeed: true,
    };

    await prisma.providerScheduleTemplate.create({
      data: {
        id: `${provider.id}-telehealth-template`,
        organizationId,
        providerId: provider.id,
        name: `${provider.specialty} telehealth availability`,
        status: 'PUBLISHED',
        data: {
          id: `${provider.id}-telehealth-template`,
          title: `${provider.specialty} telehealth availability`,
          templateName: `${provider.specialty} telehealth availability`,
          service: provider.services[0],
          location: 'Virtual Care',
          modality: 'TELEHEALTH',
          serviceModes: ['TELEHEALTH'],
          durationMinutes: provider.slotDurationMinutes,
          pattern: provider.onlinePattern,
          ...baseTemplateData,
        } as any,
      },
    });

    await prisma.providerScheduleTemplate.create({
      data: {
        id: `${provider.id}-in-person-template`,
        organizationId,
        providerId: provider.id,
        name: `${provider.specialty} in-person availability`,
        status: 'PUBLISHED',
        data: {
          id: `${provider.id}-in-person-template`,
          title: `${provider.specialty} in-person availability`,
          templateName: `${provider.specialty} in-person availability`,
          service: provider.services[0],
          location: provider.inPersonLocation,
          modality: 'IN_PERSON',
          serviceModes: ['IN_PERSON'],
          durationMinutes: provider.slotDurationMinutes,
          pattern: provider.inPersonPattern,
          ...baseTemplateData,
        } as any,
      },
    });
  }
}

async function createPatients(passwordHash: string, organizationId: string) {
  for (const patient of patients) {
    await prisma.user.create({
      data: {
        id: patient.userId,
        email: patient.email,
        passwordHash,
        firstName: patient.firstName,
        lastName: patient.lastName,
        role: UserRole.PATIENT,
        status: AccountStatus.ACTIVE,
        organizationId,
      },
    });

    await prisma.patientProfile.create({
      data: {
        id: patient.id,
        userId: patient.userId,
        organizationId,
        dateOfBirth: new Date(`${patient.dateOfBirth}T00:00:00.000Z`),
        insuranceNumber: patient.insuranceNumber,
        preferences: {
          contact: {
            phone: patient.phone,
            email: patient.email,
          },
          demographic: {
            age: ageFromBirthDate(patient.dateOfBirth),
            gender: patient.gender,
            city: patient.city,
            region: patient.region,
            preferredLanguage: patient.preferredLanguage,
          },
          access: {
            portalEnabled: true,
            bookingEnabled: true,
            bookingStatus: 'READY_FOR_FUTURE_RESERVATIONS',
            hasExistingAppointments: false,
          },
          pilotSeed: true,
        } as any,
      },
    });
  }
}

async function createCatalogAndRules(organizationId: string) {
  for (const provider of providers) {
    for (const service of provider.services) {
      const code = serviceCode(service);
      await prisma.serviceCatalogItem.create({
        data: {
          id: `pilot-service-${code.toLowerCase().replace(/_/g, '-')}`,
          organizationId,
          code,
          name: service,
          status: 'PUBLISHED',
          version: 1,
          data: {
            code,
            name: service,
            specialty: provider.specialty,
            modalities: ['TELEHEALTH', 'IN_PERSON'],
            durationMinutes: provider.slotDurationMinutes,
            patientBookable: true,
            pilotSeed: true,
          } as any,
        },
      });
    }

    await prisma.coverageRule.create({
      data: {
        id: `pilot-coverage-${provider.id}`,
        organizationId,
        code: `PILOT_${serviceCode(provider.specialty)}_BOOKING`,
        name: `${provider.specialty} pilot booking policy`,
        status: 'ACTIVE',
        version: 1,
        data: {
          serviceCodes: provider.services.map(serviceCode),
          bookingLeadHours: 2,
          telehealthAllowed: true,
          authorizationRequired: false,
          weekendSlotsAllowed: true,
          weekendCalendar: 'Pilot booking calendar follows published provider templates.',
          blockedFacilities: [],
          blockedChannels: [],
          cityExceptions: [],
          pilotSeed: true,
        } as any,
      },
    });
  }

  const facilityRows = [
    {
      id: 'pilot-facility-central-clinic',
      name: 'CarePoint Central Clinic',
      address: 'Av. Winston Churchill 100, Santo Domingo',
      serviceModes: ['IN_PERSON'],
      rooms: ['Cardiology Room 2', 'Dermatology Office', 'General Medicine Room 4'],
    },
    {
      id: 'pilot-facility-specialty-family',
      name: 'CarePoint Specialty & Family Centers',
      address: 'Calle Principal 45, Santo Domingo',
      serviceModes: ['IN_PERSON', 'TELEHEALTH'],
      rooms: ['Pediatrics Suite', 'Neurology Room 1', 'Virtual Care'],
    },
  ];

  for (const facility of facilityRows) {
    await prisma.facilitySetting.create({
      data: {
        id: facility.id,
        organizationId,
        providerId: null,
        name: facility.name,
        status: 'PUBLISHED',
        data: {
          ...facility,
          publishStatus: 'Published',
          patientBookable: true,
          pilotSeed: true,
        } as any,
      },
    });
  }
}

async function resetSchedulingStore() {
  const storagePath = path.resolve(__dirname, '../data/scheduling-store.json');
  await fs.mkdir(path.dirname(storagePath), { recursive: true });
  await fs.writeFile(storagePath, JSON.stringify({ slots: [], holds: [] }, null, 2), 'utf8');
}

async function writeSeedAudit(organizationId: string) {
  await prisma.auditLog.create({
    data: {
      id: 'pilot-v21-reset-audit',
      actorId: 'pilot-user-admin',
      organizationId,
      action: 'database.reset_and_seeded',
      resource: 'pilot_seed',
      resourceId: 'V21',
      details: {
        version: 'V21',
        providers: providers.length,
        patients: patients.length,
        appointments: 0,
        providerScheduleTemplates: providers.length * 2,
        patientBookingReady: true,
      } as any,
    },
  });
}

async function validateSeed() {
  const [providerCount, patientCount, appointmentCount, publishedTemplates] = await Promise.all([
    prisma.providerProfile.count({ where: { organizationId: ORG_ID } }),
    prisma.patientProfile.count({ where: { organizationId: ORG_ID } }),
    prisma.appointment.count({ where: { organizationId: ORG_ID } }),
    prisma.providerScheduleTemplate.findMany({ where: { organizationId: ORG_ID, status: 'PUBLISHED' }, select: { data: true } }),
  ]);
  const templateCount = publishedTemplates.length;
  const onlineTemplateCount = publishedTemplates.filter((template) => String((template.data as any)?.modality ?? '').toUpperCase() === 'TELEHEALTH').length;
  const inPersonTemplateCount = publishedTemplates.filter((template) => String((template.data as any)?.modality ?? '').toUpperCase() === 'IN_PERSON').length;

  const patientsWithAppointments = await prisma.patientProfile.count({
    where: { organizationId: ORG_ID, appointments: { some: {} } },
  });

  const failures: string[] = [];
  if (providerCount !== 5) failures.push(`Expected 5 providers; found ${providerCount}.`);
  if (patientCount !== 20) failures.push(`Expected 20 patients; found ${patientCount}.`);
  if (appointmentCount !== 0) failures.push(`Expected 0 appointments after reset; found ${appointmentCount}.`);
  if (patientsWithAppointments !== 0) failures.push(`Expected 0 patients with appointments; found ${patientsWithAppointments}.`);
  if (templateCount !== 10) failures.push(`Expected 10 published schedule templates; found ${templateCount}.`);
  if (onlineTemplateCount !== 5) failures.push(`Expected 5 telehealth templates; found ${onlineTemplateCount}.`);
  if (inPersonTemplateCount !== 5) failures.push(`Expected 5 in-person templates; found ${inPersonTemplateCount}.`);

  if (failures.length) {
    throw new Error(`Pilot seed validation failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`);
  }

  return { providerCount, patientCount, appointmentCount, templateCount, onlineTemplateCount, inPersonTemplateCount };
}

async function main() {
  console.log('V21 pilot reset: truncating public database tables...');
  await resetPublicTables();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const organization = await prisma.organization.create({
    data: { id: ORG_ID, name: ORGANIZATION_NAME },
  });

  console.log('V21 pilot reset: creating access accounts, providers, schedules, patients, catalog, and booking rules...');
  await createCoreUsers(passwordHash, organization.id);
  await createProviders(passwordHash, organization.id);
  await createPatients(passwordHash, organization.id);
  await createCatalogAndRules(organization.id);
  await resetSchedulingStore();
  await writeSeedAudit(organization.id);

  const validation = await validateSeed();
  console.log('V21 pilot reset complete:', JSON.stringify({ organizationId: organization.id, organizationName: organization.name, ...validation }, null, 2));
  console.log(`Default password for seeded users: ${PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
