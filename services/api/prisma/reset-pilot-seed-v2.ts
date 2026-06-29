import { AccountStatus, PrismaClient, ProviderOnboardingStatus, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const PASSWORD = 'ChangeMe123!';
const ORG_ID = 'v2-org-carepoint';
const ORG_NAME = 'CarePoint Healthcare Network';

// Provider specialties and types
const SPECIALTIES = [
  'General Medicine', 'Cardiology', 'Ophthalmology', 'Dermatology', 'Pediatrics',
  'Gynecology', 'Neurology', 'Orthopedics', 'ENT', 'Urology',
  'Psychiatry', 'General Nursing', 'ICU Nursing', 'Physiotherapy',
  'Clinical Psychology', 'Sports Nutrition', 'Emergency Transport',
];

const LOCATIONS = ['CarePoint Central Clinic', 'CarePoint North Branch', 'CarePoint South Branch', 'Virtual Care', 'Home Visit'];
const SERVICES = ['Consultation', 'Follow-up', 'Emergency', 'Wellness Check', 'Specialist Referral', 'Chronic Care Review'];


function escapeId(v: string) { return v.replace(/"/g, '""'); }
function randomFrom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pad2(n: number) { return String(n).padStart(2, '0'); }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function daysFromNow(n: number) { const d = new Date(); d.setDate(d.getDate() + n); return d; }
function setTime(date: Date, h: number, m: number) { const d = new Date(date); d.setHours(h, m, 0, 0); return d; }

// Provider definitions
const providerDefs = Array.from({ length: 30 }, (_, i) => {
  const num = i + 1;
  const spec = SPECIALTIES[i % SPECIALTIES.length];
  const names = [
    ['Ahmed', 'Al-Rashid'], ['Sarah', 'Johnson'], ['Mohammed', 'Hassan'], ['Emily', 'Chen'],
    ['Omar', 'Farouk'], ['Lisa', 'Martinez'], ['Khalid', 'Nasser'], ['Anna', 'Weber'],
    ['Youssef', 'Bakr'], ['Rachel', 'Kim'], ['Ali', 'Mansour'], ['Jessica', 'Taylor'],
    ['Hassan', 'Qasim'], ['Maria', 'Garcia'], ['Faisal', 'Turki'], ['Diana', 'Popov'],
    ['Samir', 'Haddad'], ['Catherine', 'Lee'], ['Tariq', 'Abbas'], ['Sophia', 'Muller'],
    ['Nabil', 'Saleh'], ['Karen', 'O\'Brien'], ['Rami', 'Ismail'], ['Laura', 'Fernandez'],
    ['Adel', 'Khoury'], ['Patricia', 'Wong'], ['Walid', 'Darwish'], ['Nicole', 'Dubois'],
    ['Ziad', 'Mahdi'], ['Megan', 'Clark'],
  ];
  const [firstName, lastName] = names[i];
  const mode = i % 3 === 0 ? 'Online' : i % 3 === 1 ? 'In-Person' : 'Both';
  return { num, id: `v2-provider-${pad2(num)}`, userId: `v2-user-provider-${pad2(num)}`, email: `test${pad2(num)}@carepoint.local`, firstName, lastName, specialty: spec, mode, location: LOCATIONS[i % 5] };
});


// Patient definitions
const patientDefs = Array.from({ length: 10 }, (_, i) => {
  const num = i + 1;
  const names: [string, string, string, string][] = [
    ['James', 'Wilson', '1985-03-15', 'Male'], ['Fatima', 'Al-Zahrani', '1990-07-22', 'Female'],
    ['Robert', 'Brown', '1978-11-03', 'Male'], ['Aisha', 'Khan', '1995-01-18', 'Female'],
    ['David', 'Miller', '1982-06-30', 'Male'], ['Noor', 'Ibrahim', '1988-09-12', 'Female'],
    ['Michael', 'Davis', '1975-04-25', 'Male'], ['Layla', 'Ahmad', '1992-12-08', 'Female'],
    ['William', 'Garcia', '1980-08-17', 'Male'], ['Amira', 'Youssef', '1993-05-21', 'Female'],
  ];
  const [firstName, lastName, dob, gender] = names[i];
  return { num, id: `v2-patient-${pad2(num)}`, userId: `v2-user-patient-${pad2(num)}`, email: `patient${pad2(num)}@carepoint.local`, firstName, lastName, dob, gender };
});

// Admin definitions
const adminDefs = [
  { id: 'v2-user-superadmin', email: 'superadmin@carepoint.local', firstName: 'System', lastName: 'Administrator', role: UserRole.SUPER_ADMIN },
  { id: 'v2-user-companyadmin', email: 'companyadmin@carepoint.local', firstName: 'Company', lastName: 'Admin', role: UserRole.COMPANY_ADMIN },
  { id: 'v2-user-support', email: 'support@carepoint.local', firstName: 'Support', lastName: 'Agent', role: UserRole.COMPANY_SUPPORT },
  { id: 'v2-user-finance', email: 'finance@carepoint.local', firstName: 'Finance', lastName: 'Manager', role: UserRole.FINANCE },
  { id: 'v2-user-nurse-admin', email: 'nurse@carepoint.local', firstName: 'Head', lastName: 'Nurse', role: UserRole.NURSE },
  { id: 'v2-user-pharmacist', email: 'pharmacist@carepoint.local', firstName: 'Chief', lastName: 'Pharmacist', role: UserRole.PHARMACIST },
  { id: 'v2-user-labtech', email: 'labtech@carepoint.local', firstName: 'Lab', lastName: 'Technician', role: UserRole.LAB_TECH },
];


async function truncateAll() {
  console.log('V2 seed: truncating all tables...');
  const tables: { tablename: string }[] = await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (!tables.length) return;
  const list = tables.map(r => `"public"."${escapeId(r.tablename)}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

async function createOrg() {
  await prisma.organization.create({ data: { id: ORG_ID, name: ORG_NAME } });
}

async function createAdmins(hash: string) {
  for (const admin of adminDefs) {
    await prisma.user.create({ data: { id: admin.id, email: admin.email, passwordHash: hash, firstName: admin.firstName, lastName: admin.lastName, role: admin.role, status: AccountStatus.ACTIVE, organizationId: ORG_ID } });
  }
}

async function createProviders(hash: string) {
  for (const p of providerDefs) {
    await prisma.user.create({ data: { id: p.userId, email: p.email, passwordHash: hash, firstName: p.firstName, lastName: p.lastName, role: UserRole.PROVIDER, status: AccountStatus.ACTIVE, organizationId: ORG_ID } });
    await prisma.providerProfile.create({ data: { id: p.id, userId: p.userId, organizationId: ORG_ID, specialty: p.specialty, licenseNumber: `LIC-${pad2(p.num)}`, services: { specialty: p.specialty, services: [p.specialty + ' Consultation', p.specialty + ' Follow-up'], serviceMode: p.mode, locations: [p.location, 'Virtual Care'], careModes: p.mode === 'Online' ? ['TELEHEALTH'] : p.mode === 'In-Person' ? ['IN_PERSON'] : ['TELEHEALTH', 'IN_PERSON', 'HOME_VISIT'], acceptsNewPatients: true } as any } });
    await prisma.providerOnboardingState.create({ data: { id: `${p.id}-onboarding`, providerId: p.id, organizationId: ORG_ID, status: ProviderOnboardingStatus.APPROVED, checklist: { licenseVerified: true, specialtyAssigned: true, schedulePublished: true, patientBookingReady: true } as any, submittedAt: new Date(), reviewedAt: new Date(), lastAction: 'APPROVED', lastActorId: 'v2-user-superadmin' } });
  }
}


async function createPatients(hash: string) {
  for (const p of patientDefs) {
    await prisma.user.create({ data: { id: p.userId, email: p.email, passwordHash: hash, firstName: p.firstName, lastName: p.lastName, role: UserRole.PATIENT, status: AccountStatus.ACTIVE, organizationId: ORG_ID } });
    await prisma.patientProfile.create({ data: { id: p.id, userId: p.userId, organizationId: ORG_ID, dateOfBirth: new Date(p.dob), insuranceNumber: `INS-${pad2(p.num)}-2026`, preferences: { locale: 'en', profile: { gender: p.gender, nationality: 'Saudi Arabia', countryRegion: 'Saudi Arabia' } } as any } });
  }
}

async function createSlots() {
  console.log('V2 seed: creating future slots (2 months)...');
  let slotCount = 0;
  for (const p of providerDefs) {
    // Create schedule template
    await prisma.providerScheduleTemplate.create({ data: { id: `${p.id}-template`, organizationId: ORG_ID, providerId: p.id, name: `${p.specialty} schedule`, status: 'PUBLISHED', data: { templateName: `${p.specialty} schedule`, service: `${p.specialty} Consultation`, location: p.location, durationMinutes: 30, serviceModes: p.mode === 'Online' ? ['TELEHEALTH'] : p.mode === 'In-Person' ? ['IN_PERSON'] : ['TELEHEALTH', 'IN_PERSON', 'HOME_VISIT'], slots: generateSlotData(p) } as any } });
    slotCount += 120; // ~3 slots/day * 40 weekdays
  }
  console.log(`  Created ${providerDefs.length} templates with ~${slotCount} slot entries.`);
}

function generateSlotData(provider: typeof providerDefs[0]) {
  const slots: any[] = [];
  for (let day = 1; day <= 60; day++) {
    const date = daysFromNow(day);
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    const hours = [9, 11, 14];
    for (const h of hours) {
      const startsAt = setTime(date, h, 0);
      const endsAt = setTime(date, h, 30);
      const mode = h === 9 ? 'TELEHEALTH' : h === 11 ? 'IN_PERSON' : 'HOME_VISIT';
      const loc = mode === 'TELEHEALTH' ? 'Virtual Care' : mode === 'HOME_VISIT' ? 'Home Visit' : provider.location;
      slots.push({ startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), service: `${provider.specialty} Consultation`, location: loc, capacity: 1, availableCount: 1, status: 'PUBLISHED', statusLabel: 'Published', serviceModes: [mode] });
    }
  }
  return slots;
}


async function createPastAppointments() {
  console.log('V2 seed: creating past appointments + reviews...');
  let apptCount = 0;
  const reviewCategories = ['communication', 'waitTime', 'careQuality', 'followUpSupport'];

  for (const patient of patientDefs) {
    // Each patient has 10-20 past appointments with random providers
    const numAppts = randomInt(10, 20);
    for (let a = 0; a < numAppts; a++) {
      const provider = providerDefs[randomInt(0, providerDefs.length - 1)];
      const daysBack = randomInt(5, 180);
      const hour = randomInt(8, 16);
      const startsAt = setTime(daysAgo(daysBack), hour, 0);
      const endsAt = setTime(daysAgo(daysBack), hour, 30);
      const status = a < numAppts - 2 ? 'COMPLETED' : randomFrom(['COMPLETED', 'CANCELLED', 'NO_SHOW']);
      const apptId = `v2-appt-${patient.num}-${pad2(a + 1)}`;

      await prisma.appointment.create({ data: { id: apptId, organizationId: ORG_ID, patientId: patient.id, providerId: provider.id, service: `${provider.specialty} Consultation`, location: randomFrom(LOCATIONS), startsAt, endsAt, status: status as any, notes: status === 'COMPLETED' ? `Routine ${provider.specialty.toLowerCase()} visit completed successfully.` : null, createdAt: daysAgo(daysBack + 1), updatedAt: startsAt } });

      // Add review for completed appointments (70% chance)
      if (status === 'COMPLETED' && Math.random() < 0.7) {
        const ratings: Record<string, number> = {};
        for (const cat of reviewCategories) { ratings[cat] = randomInt(3, 5); }
        const avgRating = Object.values(ratings).reduce((s, v) => s + v, 0) / 4;
        await prisma.medicalRecord.create({ data: { id: `v2-review-${patient.num}-${pad2(a + 1)}`, patientId: patient.id, providerId: provider.id, appointmentId: apptId, summary: { type: 'REVIEW', rating: avgRating, ratings, reviewText: randomFrom(['Excellent care and communication.', 'Very professional. Would recommend.', 'Good experience overall.', 'Quick and efficient consultation.', 'Thorough examination and clear explanation.', 'Friendly staff and minimal wait time.', 'Great follow-up care provided.']), reviewedAt: endsAt.toISOString() } as any, content: { ratings, averageRating: avgRating } as any } });
      }
      apptCount++;
    }
  }
  console.log(`  Created ${apptCount} past appointments.`);
}


async function createFutureAppointments() {
  console.log('V2 seed: creating future appointments...');
  let count = 0;
  for (const patient of patientDefs) {
    const numFuture = randomInt(1, 4);
    for (let a = 0; a < numFuture; a++) {
      const provider = providerDefs[randomInt(0, providerDefs.length - 1)];
      const daysAhead = randomInt(1, 45);
      const hour = randomInt(9, 15);
      const startsAt = setTime(daysFromNow(daysAhead), hour, 0);
      const endsAt = setTime(daysFromNow(daysAhead), hour, 30);
      await prisma.appointment.create({ data: { id: `v2-future-appt-${patient.num}-${pad2(a + 1)}`, organizationId: ORG_ID, patientId: patient.id, providerId: provider.id, service: `${provider.specialty} Consultation`, location: randomFrom(LOCATIONS), startsAt, endsAt, status: 'CONFIRMED' as any, createdAt: new Date() } });
      count++;
    }
  }
  console.log(`  Created ${count} future appointments.`);
}

async function createPrescriptions() {
  console.log('V2 seed: creating prescriptions...');
  const medications = ['Amoxicillin 500mg', 'Lisinopril 10mg', 'Metformin 850mg', 'Omeprazole 20mg', 'Atorvastatin 40mg', 'Amlodipine 5mg', 'Ibuprofen 400mg', 'Paracetamol 1g', 'Metoprolol 50mg', 'Ciprofloxacin 500mg'];
  let count = 0;
  for (const patient of patientDefs) {
    const numRx = randomInt(3, 8);
    for (let r = 0; r < numRx; r++) {
      const provider = providerDefs[randomInt(0, providerDefs.length - 1)];
      const med = randomFrom(medications);
      const status = r < 2 ? 'ACTIVE' : randomFrom(['ACTIVE', 'COMPLETED', 'CANCELLED']);
      await prisma.prescriptionDraft.create({ data: { id: `v2-rx-${patient.num}-${pad2(r + 1)}`, organizationId: ORG_ID, providerId: provider.id, name: med, status, data: { medication: med, patientId: patient.id, patientName: `${patient.firstName} ${patient.lastName}`, providerName: `Dr. ${provider.firstName} ${provider.lastName}`, dosage: randomFrom(['1 tablet daily', '2 tablets daily', '1 tablet twice daily', '1 tablet at bedtime']), duration: randomFrom(['7 days', '14 days', '30 days', '90 days']), refillable: Math.random() > 0.4, notes: `Prescribed during ${provider.specialty.toLowerCase()} consultation.` } as any } });
      count++;
    }
  }
  console.log(`  Created ${count} prescriptions.`);
}


async function createMessages() {
  console.log('V2 seed: creating message threads...');
  let threadCount = 0;
  for (const patient of patientDefs) {
    const numThreads = randomInt(2, 4);
    for (let t = 0; t < numThreads; t++) {
      const provider = providerDefs[randomInt(0, providerDefs.length - 1)];
      const threadId = `v2-thread-${patient.num}-${pad2(t + 1)}`;
      const subjects = ['Follow-up question', 'Medication concern', 'Lab results discussion', 'Appointment rescheduling', 'Symptom update', 'Prescription renewal'];
      await prisma.messageThread.create({ data: { id: threadId, organizationId: ORG_ID, patientId: patient.id, providerId: provider.id, subject: randomFrom(subjects), type: 'PATIENT_PROVIDER' as any, createdAt: daysAgo(randomInt(1, 30)) } });
      // Add 3-6 messages per thread
      const numMsgs = randomInt(3, 6);
      for (let m = 0; m < numMsgs; m++) {
        const isPatient = m % 2 === 0;
        const patientMsgs = ['Hello doctor, I have a question about my medication.', 'Thank you for the information.', 'I noticed some side effects, is that normal?', 'When should I come for my next check-up?', 'The symptoms have improved since our last visit.'];
        const providerMsgs = ['Hello! How can I help you today?', 'That is perfectly normal. Continue the medication as prescribed.', 'I recommend scheduling a follow-up in 2 weeks.', 'Please monitor your symptoms and report any changes.', 'Glad to hear about your improvement!'];
        await prisma.message.create({ data: { id: `v2-msg-${patient.num}-${pad2(t + 1)}-${pad2(m + 1)}`, threadId, senderId: isPatient ? patient.userId : provider.userId, body: isPatient ? randomFrom(patientMsgs) : randomFrom(providerMsgs), createdAt: daysAgo(randomInt(1, 20)) } });
      }
      threadCount++;
    }
  }
  console.log(`  Created ${threadCount} message threads.`);
}

async function createAlerts() {
  console.log('V2 seed: creating provider alerts...');
  const alertNames = ['Critical lab value', 'Missed medication', 'Abnormal vitals', 'Appointment no-show', 'Refill overdue', 'Patient deterioration'];
  for (let i = 0; i < 15; i++) {
    const provider = providerDefs[randomInt(0, providerDefs.length - 1)];
    const patient = patientDefs[randomInt(0, patientDefs.length - 1)];
    await prisma.providerAlert.create({ data: { id: `v2-alert-${pad2(i + 1)}`, organizationId: ORG_ID, providerId: provider.id, name: randomFrom(alertNames), status: i < 8 ? 'OPEN' : 'RESOLVED', data: { patientId: patient.id, patientName: `${patient.firstName} ${patient.lastName}`, severity: randomFrom(['HIGH', 'MEDIUM', 'LOW']), detail: `Alert regarding ${patient.firstName} ${patient.lastName} - requires attention.`, createdAt: daysAgo(randomInt(0, 10)).toISOString() } as any } });
  }
  console.log('  Created 15 alerts.');
}


async function createServiceCatalog() {
  const items = SPECIALTIES.map((spec, i) => ({
    id: `v2-catalog-${pad2(i + 1)}`,
    organizationId: ORG_ID,
    name: `${spec} Consultation`,
    code: spec.toUpperCase().replace(/[^A-Z0-9]+/g, '_'),
    status: 'PUBLISHED',
    data: { description: `Professional ${spec.toLowerCase()} consultation service.`, durationMinutes: 30, basePrice: randomInt(15000, 50000), currency: 'SAR', serviceModes: ['TELEHEALTH', 'IN_PERSON', 'HOME_VISIT'] } as any,
  }));
  for (const item of items) {
    await prisma.serviceCatalogItem.create({ data: item });
  }
}

async function main() {
  console.log('=== CarePoint V2 Comprehensive Seed ===');
  console.log(`Organization: ${ORG_NAME}`);
  console.log(`Providers: ${providerDefs.length}`);
  console.log(`Patients: ${patientDefs.length}`);
  console.log(`Admin users: ${adminDefs.length}`);
  console.log('');

  const hash = await bcrypt.hash(PASSWORD, 10);

  await truncateAll();
  await createOrg();
  await createAdmins(hash);
  await createProviders(hash);
  await createPatients(hash);
  await createServiceCatalog();
  await createSlots();
  await createPastAppointments();
  await createFutureAppointments();
  await createPrescriptions();
  await createMessages();
  await createAlerts();

  console.log('');
  console.log('=== V2 Seed Complete ===');
  console.log('');
  console.log('Login credentials (all use password: ChangeMe123!):');
  console.log('  Super Admin:    superadmin@carepoint.local');
  console.log('  Company Admin:  companyadmin@carepoint.local');
  console.log('  Support:        support@carepoint.local');
  console.log('  Finance:        finance@carepoint.local');
  console.log('  Nurse:          nurse@carepoint.local');
  console.log('  Pharmacist:     pharmacist@carepoint.local');
  console.log('  Lab Tech:       labtech@carepoint.local');
  console.log('  Providers:      test01@carepoint.local to test30@carepoint.local');
  console.log('  Patients:       patient01@carepoint.local to patient10@carepoint.local');

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
