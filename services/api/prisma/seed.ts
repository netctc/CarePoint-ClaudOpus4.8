import {
  AppointmentStatus,
  PaymentStatus,
  PrismaClient,
  TelehealthStatus,
  UserRole,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

type ProviderSpec = {
  email: string;
  firstName: string;
  lastName: string;
  specialty: string | null;
  licenseNumber: string | null;
  services: string[];
  phone: string;
};

type PatientSpec = {
  email: string;
  firstName: string;
  lastName: string;
  insuranceNumber: string;
  dateOfBirth: string;
  city: string;
  gender: 'Male' | 'Female';
  chronicConditions: string[];
};

function appointmentDate(dayOffset: number, hourUtc: number, minuteUtc = 0) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset, hourUtc, minuteUtc, 0, 0));
}

function plusMinutes(input: Date, minutes: number) {
  return new Date(input.getTime() + minutes * 60 * 1000);
}

function pick<T>(items: T[], index: number) {
  return items[index % items.length];
}

function fullName(input: { firstName: string; lastName: string }) {
  return `${input.firstName} ${input.lastName}`.trim();
}

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: 'seed-org' },
    update: { name: 'Care Center Demo Org' },
    create: {
      id: 'seed-org',
      name: 'Care Center Demo Org',
    },
  });

  const passwordHash = await bcrypt.hash('ChangeMe123!', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@carecenter.local' },
    update: {
      passwordHash,
      firstName: 'System',
      lastName: 'Admin',
      role: UserRole.COMPANY_ADMIN,
      organizationId: org.id,
    },
    create: {
      email: 'admin@carecenter.local',
      passwordHash,
      firstName: 'System',
      lastName: 'Admin',
      role: UserRole.COMPANY_ADMIN,
      organizationId: org.id,
    },
  });

  const support = await prisma.user.upsert({
    where: { email: 'support@carecenter.local' },
    update: {
      passwordHash,
      firstName: 'Support',
      lastName: 'Lead',
      role: UserRole.COMPANY_SUPPORT,
      organizationId: org.id,
    },
    create: {
      email: 'support@carecenter.local',
      passwordHash,
      firstName: 'Support',
      lastName: 'Lead',
      role: UserRole.COMPANY_SUPPORT,
      organizationId: org.id,
    },
  });

  const finance = await prisma.user.upsert({
    where: { email: 'finance@carecenter.local' },
    update: {
      passwordHash,
      firstName: 'Finance',
      lastName: 'Lead',
      role: UserRole.FINANCE,
      organizationId: org.id,
    },
    create: {
      email: 'finance@carecenter.local',
      passwordHash,
      firstName: 'Finance',
      lastName: 'Lead',
      role: UserRole.FINANCE,
      organizationId: org.id,
    },
  });

  const providerSpecs: ProviderSpec[] = [
    {
      email: 'provider@carecenter.local',
      firstName: 'Demo',
      lastName: 'Provider',
      specialty: 'Family Medicine',
      licenseNumber: 'LIC-1001',
      services: ['Consultation', 'Follow-up', 'Telehealth', 'Hypertension management'],
      phone: '+966500000101',
    },
    {
      email: 'pending.provider@carecenter.local',
      firstName: 'Pending',
      lastName: 'Provider',
      specialty: 'Dermatology',
      licenseNumber: 'LIC-2001',
      services: ['Dermatology consultation', 'Skin lesion review', 'Telehealth'],
      phone: '+966500000102',
    },
    {
      email: 'incomplete.provider@carecenter.local',
      firstName: 'Incomplete',
      lastName: 'Provider',
      specialty: null,
      licenseNumber: null,
      services: [],
      phone: '+966500000103',
    },
    {
      email: 'reviewed.provider@carecenter.local',
      firstName: 'Reviewed',
      lastName: 'Provider',
      specialty: 'Pediatrics',
      licenseNumber: 'LIC-3001',
      services: ['Child wellness', 'Vaccination review', 'Telehealth'],
      phone: '+966500000104',
    },
    {
      email: 'cardiology.provider@carecenter.local',
      firstName: 'Sarah',
      lastName: 'Chen',
      specialty: 'Cardiology',
      licenseNumber: 'LIC-4001',
      services: ['Cardiology consultation', 'ECG review', 'Telehealth'],
      phone: '+966500000105',
    },
    {
      email: 'endocrinology.provider@carecenter.local',
      firstName: 'Mina',
      lastName: 'Farah',
      specialty: 'Endocrinology',
      licenseNumber: 'LIC-4002',
      services: ['Diabetes review', 'Thyroid clinic', 'Telehealth'],
      phone: '+966500000106',
    },
    {
      email: 'orthopedics.provider@carecenter.local',
      firstName: 'Omar',
      lastName: 'Sayegh',
      specialty: 'Orthopedics',
      licenseNumber: 'LIC-4003',
      services: ['Joint pain clinic', 'Fracture follow-up', 'Sports injury review'],
      phone: '+966500000107',
    },
    {
      email: 'neurology.provider@carecenter.local',
      firstName: 'Lina',
      lastName: 'Barakat',
      specialty: 'Neurology',
      licenseNumber: 'LIC-4004',
      services: ['Headache clinic', 'Neurology consultation', 'Telehealth'],
      phone: '+966500000108',
    },
    {
      email: 'obgyn.provider@carecenter.local',
      firstName: 'Rana',
      lastName: 'Haddad',
      specialty: 'Obstetrics & Gynecology',
      licenseNumber: 'LIC-4005',
      services: ['Women’s health review', 'Prenatal follow-up', 'Telehealth'],
      phone: '+966500000109',
    },
    {
      email: 'psychiatry.provider@carecenter.local',
      firstName: 'Tariq',
      lastName: 'Nassar',
      specialty: 'Psychiatry',
      licenseNumber: 'LIC-4006',
      services: ['Mental health consultation', 'Medication follow-up', 'Telehealth'],
      phone: '+966500000110',
    },
  ];

  const patientSpecs: PatientSpec[] = [
    { email: 'patient@carecenter.local', firstName: 'Demo', lastName: 'Patient', insuranceNumber: 'INS-1001', dateOfBirth: '1988-02-16', city: 'Riyadh', gender: 'Female', chronicConditions: ['Hypertension'] },
    { email: 'omar.khalid@carecenter.local', firstName: 'Omar', lastName: 'Khalid', insuranceNumber: 'INS-1002', dateOfBirth: '1979-07-12', city: 'Riyadh', gender: 'Male', chronicConditions: ['Hypertension', 'Hyperlipidemia'] },
    { email: 'layla.haddad@carecenter.local', firstName: 'Layla', lastName: 'Haddad', insuranceNumber: 'INS-1003', dateOfBirth: '1992-09-02', city: 'Jeddah', gender: 'Female', chronicConditions: ['Migraine'] },
    { email: 'yusuf.rahman@carecenter.local', firstName: 'Yusuf', lastName: 'Rahman', insuranceNumber: 'INS-1004', dateOfBirth: '1985-04-28', city: 'Dammam', gender: 'Male', chronicConditions: ['Type 2 diabetes'] },
    { email: 'fatima.noor@carecenter.local', firstName: 'Fatima', lastName: 'Noor', insuranceNumber: 'INS-1005', dateOfBirth: '1996-01-20', city: 'Riyadh', gender: 'Female', chronicConditions: ['Asthma'] },
    { email: 'sara.amine@carecenter.local', firstName: 'Sara', lastName: 'Amine', insuranceNumber: 'INS-1006', dateOfBirth: '1989-03-18', city: 'Riyadh', gender: 'Female', chronicConditions: ['Hypothyroidism'] },
    { email: 'nadine.saab@carecenter.local', firstName: 'Nadine', lastName: 'Saab', insuranceNumber: 'INS-1007', dateOfBirth: '1975-11-03', city: 'Jeddah', gender: 'Female', chronicConditions: ['Chronic kidney disease'] },
    { email: 'mariam.hassan@carecenter.local', firstName: 'Mariam', lastName: 'Hassan', insuranceNumber: 'INS-1008', dateOfBirth: '2000-12-14', city: 'Mecca', gender: 'Female', chronicConditions: ['Iron deficiency'] },
    { email: 'ibrahim.saleh@carecenter.local', firstName: 'Ibrahim', lastName: 'Saleh', insuranceNumber: 'INS-1009', dateOfBirth: '1968-10-25', city: 'Riyadh', gender: 'Male', chronicConditions: ['Heart failure'] },
    { email: 'lina.sharif@carecenter.local', firstName: 'Lina', lastName: 'Sharif', insuranceNumber: 'INS-1010', dateOfBirth: '1994-06-09', city: 'Riyadh', gender: 'Female', chronicConditions: ['PCOS'] },
    { email: 'khaled.abbas@carecenter.local', firstName: 'Khaled', lastName: 'Abbas', insuranceNumber: 'INS-1011', dateOfBirth: '1981-08-31', city: 'Dammam', gender: 'Male', chronicConditions: ['Back pain'] },
    { email: 'reem.najjar@carecenter.local', firstName: 'Reem', lastName: 'Najjar', insuranceNumber: 'INS-1012', dateOfBirth: '1998-01-07', city: 'Khobar', gender: 'Female', chronicConditions: ['Anxiety'] },
    { email: 'mohammed.rami@carecenter.local', firstName: 'Mohammed', lastName: 'Rami', insuranceNumber: 'INS-1013', dateOfBirth: '1972-05-22', city: 'Riyadh', gender: 'Male', chronicConditions: ['COPD'] },
    { email: 'salma.odeh@carecenter.local', firstName: 'Salma', lastName: 'Odeh', insuranceNumber: 'INS-1014', dateOfBirth: '1986-02-11', city: 'Riyadh', gender: 'Female', chronicConditions: ['Gestational diabetes history'] },
    { email: 'hassan.adel@carecenter.local', firstName: 'Hassan', lastName: 'Adel', insuranceNumber: 'INS-1015', dateOfBirth: '1990-09-15', city: 'Jeddah', gender: 'Male', chronicConditions: ['Allergic rhinitis'] },
    { email: 'amal.fares@carecenter.local', firstName: 'Amal', lastName: 'Fares', insuranceNumber: 'INS-1016', dateOfBirth: '1964-12-19', city: 'Riyadh', gender: 'Female', chronicConditions: ['Osteoarthritis'] },
    { email: 'samir.azzam@carecenter.local', firstName: 'Samir', lastName: 'Azzam', insuranceNumber: 'INS-1017', dateOfBirth: '1983-07-27', city: 'Dammam', gender: 'Male', chronicConditions: ['Epilepsy'] },
    { email: 'yasmin.akel@carecenter.local', firstName: 'Yasmin', lastName: 'Akel', insuranceNumber: 'INS-1018', dateOfBirth: '1997-04-05', city: 'Riyadh', gender: 'Female', chronicConditions: ['Acne'] },
    { email: 'bilal.hamdan@carecenter.local', firstName: 'Bilal', lastName: 'Hamdan', insuranceNumber: 'INS-1019', dateOfBirth: '1977-03-01', city: 'Jubail', gender: 'Male', chronicConditions: ['Sleep apnea'] },
    { email: 'dalia.shami@carecenter.local', firstName: 'Dalia', lastName: 'Shami', insuranceNumber: 'INS-1020', dateOfBirth: '1984-11-29', city: 'Riyadh', gender: 'Female', chronicConditions: ['Depression'] },
  ];

  const providerMap = new Map<string, { user: any; profile: any; spec: ProviderSpec }>();
  const patientMap = new Map<string, { user: any; profile: any; spec: PatientSpec }>();

  for (const spec of providerSpecs) {
    const user = await prisma.user.upsert({
      where: { email: spec.email },
      update: {
        passwordHash,
        firstName: spec.firstName,
        lastName: spec.lastName,
        role: UserRole.PROVIDER,
        organizationId: org.id,
      },
      create: {
        email: spec.email,
        passwordHash,
        firstName: spec.firstName,
        lastName: spec.lastName,
        role: UserRole.PROVIDER,
        organizationId: org.id,
      },
    });

    const profile = await prisma.providerProfile.upsert({
      where: { userId: user.id },
      update: {
        organizationId: org.id,
        specialty: spec.specialty,
        licenseNumber: spec.licenseNumber,
        services: spec.services,
      },
      create: {
        userId: user.id,
        organizationId: org.id,
        specialty: spec.specialty,
        licenseNumber: spec.licenseNumber,
        services: spec.services,
      },
    });

    providerMap.set(spec.email, { user, profile, spec });
  }

  for (const spec of patientSpecs) {
    const user = await prisma.user.upsert({
      where: { email: spec.email },
      update: {
        passwordHash,
        firstName: spec.firstName,
        lastName: spec.lastName,
        role: UserRole.PATIENT,
        organizationId: org.id,
      },
      create: {
        email: spec.email,
        passwordHash,
        firstName: spec.firstName,
        lastName: spec.lastName,
        role: UserRole.PATIENT,
        organizationId: org.id,
      },
    });

    const profile = await prisma.patientProfile.upsert({
      where: { userId: user.id },
      update: {
        organizationId: org.id,
        dateOfBirth: new Date(`${spec.dateOfBirth}T00:00:00.000Z`),
        insuranceNumber: spec.insuranceNumber,
        preferences: {
          preferredLanguage: 'en',
          city: spec.city,
          gender: spec.gender,
          chronicConditions: spec.chronicConditions,
          marketingOptIn: false,
        },
      },
      create: {
        userId: user.id,
        organizationId: org.id,
        dateOfBirth: new Date(`${spec.dateOfBirth}T00:00:00.000Z`),
        insuranceNumber: spec.insuranceNumber,
        preferences: {
          preferredLanguage: 'en',
          city: spec.city,
          gender: spec.gender,
          chronicConditions: spec.chronicConditions,
          marketingOptIn: false,
        },
      },
    });

    patientMap.set(spec.email, { user, profile, spec });
  }

  const providers = Array.from(providerMap.values());
  const patients = Array.from(patientMap.values());

  const appointmentServices = [
    'Initial Consultation',
    'Follow-up',
    'Telehealth Review',
    'Lab Review',
    'Medication Management',
    'Prenatal Follow-up',
    'Neurology Consultation',
    'Orthopedic Assessment',
    'Dermatology Review',
    'Behavioral Health Follow-up',
  ];
  const locations = ['Main Clinic', 'North Branch', 'Women’s Health Center', 'Virtual Care'];
  const diagnosisBank = [
    { diagnosis: 'Essential hypertension', code: 'I10', meds: ['Lisinopril 10 mg'], plan: 'Continue home blood pressure monitoring.' },
    { diagnosis: 'Type 2 diabetes mellitus', code: 'E11.9', meds: ['Metformin 500 mg'], plan: 'Repeat HbA1c in 3 months.' },
    { diagnosis: 'Migraine without aura', code: 'G43.009', meds: ['Sumatriptan 50 mg PRN'], plan: 'Headache diary reviewed.' },
    { diagnosis: 'Atopic dermatitis', code: 'L20.9', meds: ['Hydrocortisone cream'], plan: 'Skin care counseling provided.' },
    { diagnosis: 'Hypothyroidism', code: 'E03.9', meds: ['Levothyroxine 50 mcg'], plan: 'Repeat TSH in 6 weeks.' },
    { diagnosis: 'Generalized anxiety disorder', code: 'F41.1', meds: ['Sertraline 50 mg'], plan: 'Continue counseling and medication.' },
    { diagnosis: 'Osteoarthritis of knee', code: 'M17.9', meds: ['Acetaminophen PRN'], plan: 'Start physiotherapy exercises.' },
    { diagnosis: 'Iron deficiency anemia', code: 'D50.9', meds: ['Ferrous sulfate 325 mg'], plan: 'Repeat CBC in 4 weeks.' },
    { diagnosis: 'Chronic kidney disease stage 3', code: 'N18.30', meds: ['Renal-safe medication review'], plan: 'Renal function panel in 2 weeks.' },
    { diagnosis: 'Hyperlipidemia', code: 'E78.5', meds: ['Atorvastatin 20 mg'], plan: 'Lipid panel in 8 weeks.' },
  ];

  const appointments: Array<{
    id: string;
    patientEmail: string;
    providerEmail: string;
    service: string;
    location: string;
    startsAt: Date;
    endsAt: Date;
    status: AppointmentStatus;
    notes: string;
    telehealth: boolean;
  }> = [];

  appointments.push({
    id: 'seed-appt-1',
    patientEmail: 'patient@carecenter.local',
    providerEmail: 'provider@carecenter.local',
    service: 'Initial Consultation',
    location: 'Main Clinic',
    startsAt: appointmentDate(1, 10, 0),
    endsAt: appointmentDate(1, 10, 30),
    status: AppointmentStatus.CONFIRMED,
    notes: 'Please review uploaded lab summary before visit.',
    telehealth: false,
  });

  for (let index = 2; index <= 36; index += 1) {
    const patient = patients[(index - 2) % patients.length];
    const provider = providers[(index - 2) % providers.length];
    const dayOffset = -10 + Math.floor((index - 2) / 2);
    const startsAt = appointmentDate(dayOffset, 8 + ((index + 1) % 8), (index % 2) * 30);
    const durationMinutes = [20, 30, 40][index % 3];
    const location = pick(locations, index);
    const telehealth = location == 'Virtual Care';
    let status: AppointmentStatus;
    if (dayOffset <= -2) {
      status = index % 8 == 0 ? AppointmentStatus.NO_SHOW : AppointmentStatus.COMPLETED;
    } else if (dayOffset <= 2) {
      status = index % 7 == 0 ? AppointmentStatus.CANCELLED : AppointmentStatus.CONFIRMED;
    } else {
      status = index % 5 == 0 ? AppointmentStatus.REQUESTED : AppointmentStatus.CONFIRMED;
    }

    appointments.push({
      id: `seed-appt-${index}`,
      patientEmail: patient.user.email,
      providerEmail: provider.user.email,
      service: pick(appointmentServices, index),
      location,
      startsAt,
      endsAt: plusMinutes(startsAt, durationMinutes),
      status,
      notes: `Seeded visit #${index} for ${patient.spec.city}. Review chronic conditions and medication adherence.`,
      telehealth,
    });
  }

  const completedAppointments: typeof appointments = [];

  for (const item of appointments) {
    const patient = patientMap.get(item.patientEmail)!;
    const provider = providerMap.get(item.providerEmail)!;
    const appointment = await prisma.appointment.upsert({
      where: { id: item.id },
      update: {
        organizationId: org.id,
        patientId: patient.profile.id,
        providerId: provider.profile.id,
        service: item.service,
        location: item.location,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        status: item.status,
        notes: item.notes,
      },
      create: {
        id: item.id,
        organizationId: org.id,
        patientId: patient.profile.id,
        providerId: provider.profile.id,
        service: item.service,
        location: item.location,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        status: item.status,
        notes: item.notes,
      },
    });

    if (item.status === AppointmentStatus.COMPLETED) completedAppointments.push(item);

    if (item.telehealth && item.status !== AppointmentStatus.CANCELLED && item.status !== AppointmentStatus.NO_SHOW) {
      const teleStatus =
        item.status === AppointmentStatus.COMPLETED
          ? TelehealthStatus.ENDED
          : item.startsAt.getTime() < Date.now()
            ? TelehealthStatus.LIVE
            : TelehealthStatus.READY;

      await prisma.telehealthSession.upsert({
        where: { appointmentId: appointment.id },
        update: {
          vendor: 'daily',
          meetingId: `meeting-${item.id}`,
          joinUrl: `https://telehealth.local/session/${item.id}`,
          status: teleStatus,
          scheduledAt: item.startsAt,
          startedAt: teleStatus === TelehealthStatus.ENDED || teleStatus === TelehealthStatus.LIVE ? new Date(item.startsAt.getTime() + 5 * 60 * 1000) : null,
          endedAt: teleStatus === TelehealthStatus.ENDED ? new Date(item.endsAt.getTime() - 5 * 60 * 1000) : null,
        },
        create: {
          appointmentId: appointment.id,
          vendor: 'daily',
          meetingId: `meeting-${item.id}`,
          joinUrl: `https://telehealth.local/session/${item.id}`,
          status: teleStatus,
          scheduledAt: item.startsAt,
          startedAt: teleStatus === TelehealthStatus.ENDED || teleStatus === TelehealthStatus.LIVE ? new Date(item.startsAt.getTime() + 5 * 60 * 1000) : null,
          endedAt: teleStatus === TelehealthStatus.ENDED ? new Date(item.endsAt.getTime() - 5 * 60 * 1000) : null,
        },
      });
    }

    if (item.status !== AppointmentStatus.NO_SHOW) {
      const amountMinor = 25000 + ((appointments.indexOf(item) % 6) * 5000);
      const paymentStatus =
        item.status === AppointmentStatus.CANCELLED
          ? PaymentStatus.REFUNDED
          : item.status === AppointmentStatus.REQUESTED
            ? PaymentStatus.PENDING
            : item.status === AppointmentStatus.CONFIRMED
              ? PaymentStatus.AUTHORIZED
              : PaymentStatus.CAPTURED;
      await prisma.payment.upsert({
        where: { id: `seed-payment-${item.id}` },
        update: {
          appointmentId: item.id,
          patientId: patient.profile.id,
          providerId: provider.profile.id,
          amountMinor,
          currency: 'SAR',
          status: paymentStatus,
          gateway: 'manual',
          metadata: { invoiceLabel: item.service, seed: true, location: item.location },
          commissionMinor: Math.round(amountMinor * 0.1),
        },
        create: {
          id: `seed-payment-${item.id}`,
          appointmentId: item.id,
          patientId: patient.profile.id,
          providerId: provider.profile.id,
          amountMinor,
          currency: 'SAR',
          status: paymentStatus,
          gateway: 'manual',
          metadata: { invoiceLabel: item.service, seed: true, location: item.location },
          commissionMinor: Math.round(amountMinor * 0.1),
        },
      });
    }
  }

  let recordCounter = 1;
  for (const appointmentSpec of completedAppointments.slice(0, 18)) {
    const diagnosis = pick(diagnosisBank, recordCounter - 1);
    const patient = patientMap.get(appointmentSpec.patientEmail)!;
    const provider = providerMap.get(appointmentSpec.providerEmail)!;

    await prisma.medicalRecord.upsert({
      where: { id: `seed-record-${recordCounter}` },
      update: {
        patientId: patient.profile.id,
        providerId: provider.profile.id,
        appointmentId: appointmentSpec.id,
        summary: {
          title: `${appointmentSpec.service} summary`,
          diagnosis: diagnosis.diagnosis,
          diagnosisCode: diagnosis.code,
          recordType: 'ENCOUNTER',
          specialty: provider.spec.specialty,
        },
        content: {
          recordType: 'ENCOUNTER',
          medications: diagnosis.meds,
          notes: `${diagnosis.plan} Visit completed at ${appointmentSpec.location}.`,
          vitals: {
            bloodPressure: `${118 + (recordCounter % 18)}/${72 + (recordCounter % 10)} mmHg`,
            pulse: `${68 + (recordCounter % 12)} bpm`,
            temperature: `${36.4 + ((recordCounter % 4) * 0.2)} C`,
          },
          plan: [diagnosis.plan, 'Return earlier if symptoms worsen.'],
        },
      },
      create: {
        id: `seed-record-${recordCounter}`,
        patientId: patient.profile.id,
        providerId: provider.profile.id,
        appointmentId: appointmentSpec.id,
        summary: {
          title: `${appointmentSpec.service} summary`,
          diagnosis: diagnosis.diagnosis,
          diagnosisCode: diagnosis.code,
          recordType: 'ENCOUNTER',
          specialty: provider.spec.specialty,
        },
        content: {
          recordType: 'ENCOUNTER',
          medications: diagnosis.meds,
          notes: `${diagnosis.plan} Visit completed at ${appointmentSpec.location}.`,
          vitals: {
            bloodPressure: `${118 + (recordCounter % 18)}/${72 + (recordCounter % 10)} mmHg`,
            pulse: `${68 + (recordCounter % 12)} bpm`,
            temperature: `${36.4 + ((recordCounter % 4) * 0.2)} C`,
          },
          plan: [diagnosis.plan, 'Return earlier if symptoms worsen.'],
        },
      },
    });
    recordCounter += 1;
  }

  const labPanels = [
    {
      title: 'Renal function panel',
      analytes: [
        { label: 'Creatinine', value: '1.1 mg/dL', referenceRange: '0.7 - 1.3', flag: 'Normal', variant: 'success' },
        { label: 'Potassium', value: '5.3 mmol/L', referenceRange: '3.5 - 5.1', flag: 'High', variant: 'warning' },
      ],
      comment: 'Mild potassium elevation; correlate with ACE inhibitor use.',
    },
    {
      title: 'Lipid profile',
      analytes: [
        { label: 'LDL', value: '142 mg/dL', referenceRange: '< 100', flag: 'High', variant: 'warning' },
        { label: 'HDL', value: '48 mg/dL', referenceRange: '> 40', flag: 'Normal', variant: 'success' },
      ],
      comment: 'Lifestyle reinforcement recommended.',
    },
    {
      title: 'HbA1c',
      analytes: [{ label: 'HbA1c', value: '7.4%', referenceRange: '< 7.0%', flag: 'High', variant: 'warning' }],
      comment: 'Glycemic control remains above target.',
    },
    {
      title: 'CBC',
      analytes: [
        { label: 'Hemoglobin', value: '10.8 g/dL', referenceRange: '12.0 - 15.0', flag: 'Low', variant: 'warning' },
        { label: 'WBC', value: '6.1 x10^9/L', referenceRange: '4.0 - 11.0', flag: 'Normal', variant: 'success' },
      ],
      comment: 'Findings support mild iron deficiency anemia.',
    },
    {
      title: 'Thyroid panel',
      analytes: [
        { label: 'TSH', value: '5.8 mIU/L', referenceRange: '0.4 - 4.0', flag: 'High', variant: 'warning' },
        { label: 'Free T4', value: '0.9 ng/dL', referenceRange: '0.8 - 1.8', flag: 'Normal', variant: 'success' },
      ],
      comment: 'Adjust levothyroxine and repeat in six weeks.',
    },
  ];

  for (let index = 1; index <= 12; index += 1) {
    const patient = patients[(index - 1) % patients.length];
    const provider = providers[(index - 1) % providers.length];
    const panel = pick(labPanels, index - 1);
    const status = index <= 4 ? 'PENDING_REVIEW' : index <= 8 ? 'VERIFIED' : 'RELEASED';
    const requestedAt = appointmentDate(-5 + index, 7 + (index % 5), 15).toISOString();
    const verifiedAt = status === 'PENDING_REVIEW' ? null : appointmentDate(-4 + index, 9, 0).toISOString();
    const releasedAt = status === 'RELEASED' ? appointmentDate(-3 + index, 11, 10).toISOString() : null;

    await prisma.labWorkItem.upsert({
      where: { id: `seed-lab-${index}` },
      update: {
        organizationId: org.id,
        providerId: provider.profile.id,
        name: panel.title,
        status,
        data: {
          id: `seed-lab-${index}`,
          title: panel.title,
          patientId: patient.profile.id,
          patientName: fullName(patient.spec),
          testName: panel.title,
          requestedAt,
          location: index % 2 == 0 ? 'Partner Reference Lab' : 'Main Clinic Lab',
          nextStep: status === 'PENDING_REVIEW' ? 'Verify and release to patient chart' : status === 'VERIFIED' ? 'Second review or release if eligible' : 'Released to chart',
          resultStatus: status.replaceAll('_', ' '),
          values: panel.analytes,
          comments: [panel.comment],
          status,
          verifiedAt,
          secondReviewRequired: index % 3 == 0,
          secondReviewStatus: status === 'RELEASED' && index % 3 == 0 ? 'COMPLETED' : (index % 3 == 0 ? 'PENDING' : 'NOT_REQUIRED'),
          secondReviewedAt: status === 'RELEASED' && index % 3 == 0 ? appointmentDate(-2 + index, 10, 20).toISOString() : null,
          releasedAt,
          releasedByName: fullName(provider.spec),
          providerName: fullName(provider.spec),
        },
      },
      create: {
        id: `seed-lab-${index}`,
        organizationId: org.id,
        providerId: provider.profile.id,
        name: panel.title,
        status,
        data: {
          id: `seed-lab-${index}`,
          title: panel.title,
          patientId: patient.profile.id,
          patientName: fullName(patient.spec),
          testName: panel.title,
          requestedAt,
          location: index % 2 == 0 ? 'Partner Reference Lab' : 'Main Clinic Lab',
          nextStep: status === 'PENDING_REVIEW' ? 'Verify and release to patient chart' : status === 'VERIFIED' ? 'Second review or release if eligible' : 'Released to chart',
          resultStatus: status.replaceAll('_', ' '),
          values: panel.analytes,
          comments: [panel.comment],
          status,
          verifiedAt,
          secondReviewRequired: index % 3 == 0,
          secondReviewStatus: status === 'RELEASED' && index % 3 == 0 ? 'COMPLETED' : (index % 3 == 0 ? 'PENDING' : 'NOT_REQUIRED'),
          secondReviewedAt: status === 'RELEASED' && index % 3 == 0 ? appointmentDate(-2 + index, 10, 20).toISOString() : null,
          releasedAt,
          releasedByName: fullName(provider.spec),
          providerName: fullName(provider.spec),
        },
      },
    });

    if (status === 'RELEASED') {
      await prisma.medicalRecord.upsert({
        where: { id: `seed-record-lab-${index}` },
        update: {
          patientId: patient.profile.id,
          providerId: provider.profile.id,
          summary: {
            title: `${panel.title} released`,
            recordType: 'LAB_RESULT',
            resultId: `seed-lab-${index}`,
            verified: true,
            releasedToPatient: true,
          },
          content: {
            recordType: 'LAB_RESULT',
            patientVisible: true,
            testName: panel.title,
            values: panel.analytes,
            comments: [panel.comment],
            releasedAt,
          },
        },
        create: {
          id: `seed-record-lab-${index}`,
          patientId: patient.profile.id,
          providerId: provider.profile.id,
          summary: {
            title: `${panel.title} released`,
            recordType: 'LAB_RESULT',
            resultId: `seed-lab-${index}`,
            verified: true,
            releasedToPatient: true,
          },
          content: {
            recordType: 'LAB_RESULT',
            patientVisible: true,
            testName: panel.title,
            values: panel.analytes,
            comments: [panel.comment],
            releasedAt,
          },
        },
      });
    }
  }

  for (let index = 1; index <= 8; index += 1) {
    const patient = patients[(index + 2) % patients.length];
    const provider = providers[index % providers.length];
    const appointment = appointments[(index + 5) % appointments.length];

    await prisma.clinicalOrder.upsert({
      where: { id: `seed-order-${index}` },
      update: {
        organizationId: org.id,
        providerId: provider.profile.id,
        name: `Clinical order ${index}`,
        status: index % 3 == 0 ? 'SUBMITTED' : 'DRAFT',
        data: {
          id: `seed-order-${index}`,
          title: `Clinical order ${index}`,
          patientId: patient.profile.id,
          patientName: fullName(patient.spec),
          encounterId: `enc-${index}`,
          appointmentId: appointment.id,
          reason: index % 2 == 0 ? 'Medication monitoring' : 'Diagnostic work-up',
          requestedBy: fullName(provider.spec),
          orderGroups: [
            { title: 'Laboratory', description: 'Review recommended baseline diagnostics', status: 'Recommended', variant: 'info' },
            { title: 'Imaging', description: 'Add imaging if symptoms persist', status: 'Optional', variant: 'warning' },
          ],
          commonSelections: ['CBC', 'CMP', 'Lipid profile', 'Renal function panel'],
          status: index % 3 == 0 ? 'SUBMITTED' : 'DRAFT',
        },
      },
      create: {
        id: `seed-order-${index}`,
        organizationId: org.id,
        providerId: provider.profile.id,
        name: `Clinical order ${index}`,
        status: index % 3 == 0 ? 'SUBMITTED' : 'DRAFT',
        data: {
          id: `seed-order-${index}`,
          title: `Clinical order ${index}`,
          patientId: patient.profile.id,
          patientName: fullName(patient.spec),
          encounterId: `enc-${index}`,
          appointmentId: appointment.id,
          reason: index % 2 == 0 ? 'Medication monitoring' : 'Diagnostic work-up',
          requestedBy: fullName(provider.spec),
          orderGroups: [
            { title: 'Laboratory', description: 'Review recommended baseline diagnostics', status: 'Recommended', variant: 'info' },
            { title: 'Imaging', description: 'Add imaging if symptoms persist', status: 'Optional', variant: 'warning' },
          ],
          commonSelections: ['CBC', 'CMP', 'Lipid profile', 'Renal function panel'],
          status: index % 3 == 0 ? 'SUBMITTED' : 'DRAFT',
        },
      },
    });
  }

  for (let index = 1; index <= 8; index += 1) {
    const patient = patients[(index + 4) % patients.length];
    const provider = providers[(index + 1) % providers.length];
    const diagnosis = pick(diagnosisBank, index);

    await prisma.prescriptionDraft.upsert({
      where: { id: `seed-rx-${index}` },
      update: {
        organizationId: org.id,
        providerId: provider.profile.id,
        name: diagnosis.meds[0],
        status: index % 4 == 0 ? 'SIGNED' : 'DRAFT',
        data: {
          id: `seed-rx-${index}`,
          title: diagnosis.meds[0],
          patientId: patient.profile.id,
          patientName: fullName(patient.spec),
          drug: diagnosis.meds[0].split(' ')[0],
          dosage: diagnosis.meds[0],
          frequency: index % 2 == 0 ? 'Once daily' : 'Twice daily',
          duration: index % 3 == 0 ? '60 days' : '30 days',
          pharmacyName: index % 2 == 0 ? 'CarePoint Pharmacy Network' : 'Manual review',
          note: diagnosis.plan,
          complianceChecks: [
            { label: 'Allergy review', detail: 'No documented medication allergy conflict.', status: 'Clear', variant: 'success' },
            { label: 'Indication match', detail: `Linked to ${diagnosis.diagnosis}.`, status: 'Confirmed', variant: 'info' },
          ],
          status: index % 4 == 0 ? 'SIGNED' : 'DRAFT',
        },
      },
      create: {
        id: `seed-rx-${index}`,
        organizationId: org.id,
        providerId: provider.profile.id,
        name: diagnosis.meds[0],
        status: index % 4 == 0 ? 'SIGNED' : 'DRAFT',
        data: {
          id: `seed-rx-${index}`,
          title: diagnosis.meds[0],
          patientId: patient.profile.id,
          patientName: fullName(patient.spec),
          drug: diagnosis.meds[0].split(' ')[0],
          dosage: diagnosis.meds[0],
          frequency: index % 2 == 0 ? 'Once daily' : 'Twice daily',
          duration: index % 3 == 0 ? '60 days' : '30 days',
          pharmacyName: index % 2 == 0 ? 'CarePoint Pharmacy Network' : 'Manual review',
          note: diagnosis.plan,
          complianceChecks: [
            { label: 'Allergy review', detail: 'No documented medication allergy conflict.', status: 'Clear', variant: 'success' },
            { label: 'Indication match', detail: `Linked to ${diagnosis.diagnosis}.`, status: 'Confirmed', variant: 'info' },
          ],
          status: index % 4 == 0 ? 'SIGNED' : 'DRAFT',
        },
      },
    });
  }

  for (let index = 1; index <= 6; index += 1) {
    const patient = patients[(index + 6) % patients.length];
    const provider = providers[(index + 2) % providers.length];

    await prisma.rpmEnrollment.upsert({
      where: { id: `seed-rpm-${index}` },
      update: {
        organizationId: org.id,
        providerId: provider.profile.id,
        name: `${fullName(patient.spec)} RPM`,
        status: index % 4 == 0 ? 'PAUSED' : 'ACTIVE',
        data: {
          id: `seed-rpm-${index}`,
          title: `${fullName(patient.spec)} RPM enrollment`,
          patientId: patient.profile.id,
          patientName: fullName(patient.spec),
          device: index % 2 == 0 ? 'Omron BP Monitor' : 'Dexcom CGM',
          programStatus: index % 4 == 0 ? 'Paused' : 'Active',
          thresholds: [
            { label: 'Primary threshold', value: index % 2 == 0 ? '< 140/90 mmHg' : 'HbA1c < 7.0%', status: 'Configured', variant: 'success' },
          ],
          readings: [
            { time: appointmentDate(-index, 8, 10).toISOString(), metric: index % 2 == 0 ? 'Blood pressure' : 'Glucose', value: index % 2 == 0 ? `13${index}/8${index} mmHg` : `${110 + index * 5} mg/dL`, status: 'Latest', variant: 'info' },
            { time: appointmentDate(-index - 1, 8, 15).toISOString(), metric: index % 2 == 0 ? 'Blood pressure' : 'Glucose', value: index % 2 == 0 ? `14${index}/9${index} mmHg` : `${125 + index * 4} mg/dL`, status: 'Watch', variant: 'warning' },
          ],
          outreachLog: [
            { time: appointmentDate(-index, 9, 0).toISOString(), by: 'Nurse Amira', note: 'Reviewed trend and reinforced adherence.' },
          ],
          status: index % 4 == 0 ? 'PAUSED' : 'ACTIVE',
        },
      },
      create: {
        id: `seed-rpm-${index}`,
        organizationId: org.id,
        providerId: provider.profile.id,
        name: `${fullName(patient.spec)} RPM`,
        status: index % 4 == 0 ? 'PAUSED' : 'ACTIVE',
        data: {
          id: `seed-rpm-${index}`,
          title: `${fullName(patient.spec)} RPM enrollment`,
          patientId: patient.profile.id,
          patientName: fullName(patient.spec),
          device: index % 2 == 0 ? 'Omron BP Monitor' : 'Dexcom CGM',
          programStatus: index % 4 == 0 ? 'Paused' : 'Active',
          thresholds: [
            { label: 'Primary threshold', value: index % 2 == 0 ? '< 140/90 mmHg' : 'HbA1c < 7.0%', status: 'Configured', variant: 'success' },
          ],
          readings: [
            { time: appointmentDate(-index, 8, 10).toISOString(), metric: index % 2 == 0 ? 'Blood pressure' : 'Glucose', value: index % 2 == 0 ? `13${index}/8${index} mmHg` : `${110 + index * 5} mg/dL`, status: 'Latest', variant: 'info' },
            { time: appointmentDate(-index - 1, 8, 15).toISOString(), metric: index % 2 == 0 ? 'Blood pressure' : 'Glucose', value: index % 2 == 0 ? `14${index}/9${index} mmHg` : `${125 + index * 4} mg/dL`, status: 'Watch', variant: 'warning' },
          ],
          outreachLog: [
            { time: appointmentDate(-index, 9, 0).toISOString(), by: 'Nurse Amira', note: 'Reviewed trend and reinforced adherence.' },
          ],
          status: index % 4 == 0 ? 'PAUSED' : 'ACTIVE',
        },
      },
    });
  }

  for (let index = 1; index <= 10; index += 1) {
    const patient = patients[(index + 3) % patients.length];
    const provider = providers[(index + 4) % providers.length];
    const detail = index % 2 == 0 ? 'Lab result requires provider comment.' : 'RPM threshold exceeded and outreach is due.';

    await prisma.providerAlert.upsert({
      where: { id: `seed-alert-${index}` },
      update: {
        organizationId: org.id,
        providerId: provider.profile.id,
        name: `Provider alert ${index}`,
        status: index % 5 == 0 ? 'ACKNOWLEDGED' : 'OPEN',
        data: {
          id: `seed-alert-${index}`,
          title: index % 2 == 0 ? 'Lab follow-up required' : 'RPM threshold exceeded',
          detail,
          severity: index % 3 == 0 ? 'High' : 'Medium',
          variant: 'warning',
          owner: fullName(provider.spec),
          sla: `${2 + index}h remaining`,
          source: index % 2 == 0 ? 'LAB' : 'RPM',
          patientId: patient.profile.id,
          patientName: fullName(patient.spec),
          status: index % 5 == 0 ? 'ACKNOWLEDGED' : 'OPEN',
        },
      },
      create: {
        id: `seed-alert-${index}`,
        organizationId: org.id,
        providerId: provider.profile.id,
        name: `Provider alert ${index}`,
        status: index % 5 == 0 ? 'ACKNOWLEDGED' : 'OPEN',
        data: {
          id: `seed-alert-${index}`,
          title: index % 2 == 0 ? 'Lab follow-up required' : 'RPM threshold exceeded',
          detail,
          severity: index % 3 == 0 ? 'High' : 'Medium',
          variant: 'warning',
          owner: fullName(provider.spec),
          sla: `${2 + index}h remaining`,
          source: index % 2 == 0 ? 'LAB' : 'RPM',
          patientId: patient.profile.id,
          patientName: fullName(patient.spec),
          status: index % 5 == 0 ? 'ACKNOWLEDGED' : 'OPEN',
        },
      },
    });
  }

  const facilitySeeds = [
    {
      id: 'fac-main-clinic',
      name: 'Main Clinic',
      address: 'Riyadh Health District',
      serviceModes: ['IN_PERSON', 'TELEHEALTH'],
      serviceMatrix: [
        { service: 'Primary care consultation', channel: 'In-person', price: 'SAR 220', effectiveDate: '2026-04-01' },
        { service: 'Telehealth review', channel: 'Telehealth', price: 'SAR 180', effectiveDate: '2026-04-01' },
      ],
    },
    {
      id: 'fac-north-branch',
      name: 'North Branch',
      address: 'Riyadh North Corridor',
      serviceModes: ['IN_PERSON'],
      serviceMatrix: [
        { service: 'Dermatology review', channel: 'In-person', price: 'SAR 260', effectiveDate: '2026-04-01' },
        { service: 'Orthopedic assessment', channel: 'In-person', price: 'SAR 310', effectiveDate: '2026-04-01' },
      ],
    },
    {
      id: 'fac-womens-center',
      name: 'Women’s Health Center',
      address: 'Riyadh Women’s Health Campus',
      serviceModes: ['IN_PERSON', 'TELEHEALTH'],
      serviceMatrix: [
        { service: 'Prenatal follow-up', channel: 'In-person', price: 'SAR 240', effectiveDate: '2026-04-01' },
        { service: 'Women’s health telehealth review', channel: 'Telehealth', price: 'SAR 190', effectiveDate: '2026-04-01' },
      ],
    },
    {
      id: 'fac-virtual-care',
      name: 'Virtual Care',
      address: 'Digital channel',
      serviceModes: ['TELEHEALTH'],
      serviceMatrix: [
        { service: 'Telehealth review', channel: 'Telehealth', price: 'SAR 180', effectiveDate: '2026-04-01' },
        { service: 'Behavioral health follow-up', channel: 'Telehealth', price: 'SAR 210', effectiveDate: '2026-04-01' },
      ],
    },
  ];

  for (const facility of facilitySeeds) {
    await prisma.facilitySetting.upsert({
      where: { id: facility.id },
      update: {
        organizationId: org.id,
        providerId: null,
        name: facility.name,
        status: 'PUBLISHED',
        data: {
          id: facility.id,
          title: facility.name,
          name: facility.name,
          address: facility.address,
          serviceModes: facility.serviceModes,
          publishStatus: 'Published',
          serviceMatrix: facility.serviceMatrix,
          status: 'PUBLISHED',
        },
      },
      create: {
        id: facility.id,
        organizationId: org.id,
        providerId: null,
        name: facility.name,
        status: 'PUBLISHED',
        data: {
          id: facility.id,
          title: facility.name,
          name: facility.name,
          address: facility.address,
          serviceModes: facility.serviceModes,
          publishStatus: 'Published',
          serviceMatrix: facility.serviceMatrix,
          status: 'PUBLISHED',
        },
      },
    });
  }

  for (let index = 1; index <= 10; index += 1) {
    const provider = providers[(index - 1) % providers.length];
    const location = pick(locations.filter((entry) => entry != 'Virtual Care'), index);
    await prisma.providerScheduleTemplate.upsert({
      where: { id: `seed-template-${index}` },
      update: {
        organizationId: org.id,
        providerId: provider.profile.id,
        name: `${provider.spec.specialty ?? 'General'} template ${index}`,
        status: index % 3 == 0 ? 'DRAFT' : 'PUBLISHED',
        data: {
          id: `seed-template-${index}`,
          title: `${provider.spec.specialty ?? 'General'} template ${index}`,
          templateName: `${provider.spec.specialty ?? 'General'} template ${index}`,
          durationMinutes: index % 2 == 0 ? 20 : 30,
          bufferMinutes: index % 3 == 0 ? 10 : 5,
          capacity: 1,
          service: pick(appointmentServices, index),
          location,
          serviceModes: index % 2 == 0 ? ['IN_PERSON', 'TELEHEALTH'] : ['IN_PERSON'],
          pattern: [
            { day: pick(['Monday', 'Tuesday', 'Wednesday', 'Thursday'], index), hours: '09:00 - 12:00' },
            { day: pick(['Sunday', 'Monday', 'Wednesday'], index + 1), hours: '13:00 - 16:00' },
          ],
          status: index % 3 == 0 ? 'DRAFT' : 'PUBLISHED',
        },
      },
      create: {
        id: `seed-template-${index}`,
        organizationId: org.id,
        providerId: provider.profile.id,
        name: `${provider.spec.specialty ?? 'General'} template ${index}`,
        status: index % 3 == 0 ? 'DRAFT' : 'PUBLISHED',
        data: {
          id: `seed-template-${index}`,
          title: `${provider.spec.specialty ?? 'General'} template ${index}`,
          templateName: `${provider.spec.specialty ?? 'General'} template ${index}`,
          durationMinutes: index % 2 == 0 ? 20 : 30,
          bufferMinutes: index % 3 == 0 ? 10 : 5,
          capacity: 1,
          service: pick(appointmentServices, index),
          location,
          serviceModes: index % 2 == 0 ? ['IN_PERSON', 'TELEHEALTH'] : ['IN_PERSON'],
          pattern: [
            { day: pick(['Monday', 'Tuesday', 'Wednesday', 'Thursday'], index), hours: '09:00 - 12:00' },
            { day: pick(['Sunday', 'Monday', 'Wednesday'], index + 1), hours: '13:00 - 16:00' },
          ],
          status: index % 3 == 0 ? 'DRAFT' : 'PUBLISHED',
        },
      },
    });
  }

  for (let index = 1; index <= 8; index += 1) {
    const patient = patients[(index - 1) % patients.length];
    const provider = providers[(index - 1) % providers.length];
    const threadId = `seed-thread-${index}`;
    await prisma.messageThread.upsert({
      where: { id: threadId },
      update: {
        organizationId: org.id,
        patientId: patient.profile.id,
        providerId: provider.profile.id,
        subject: `Follow-up thread ${index}`,
        type: 'PATIENT_PROVIDER',
      },
      create: {
        id: threadId,
        organizationId: org.id,
        patientId: patient.profile.id,
        providerId: provider.profile.id,
        subject: `Follow-up thread ${index}`,
        type: 'PATIENT_PROVIDER',
      },
    });

    await prisma.message.upsert({
      where: { id: `seed-message-${index}-a` },
      update: {
        threadId,
        senderId: patient.user.id,
        body: `Patient update ${index}: symptoms are ${index % 2 == 0 ? 'improving' : 'unchanged'} and medications were reviewed.`,
        attachments: [],
      },
      create: {
        id: `seed-message-${index}-a`,
        threadId,
        senderId: patient.user.id,
        body: `Patient update ${index}: symptoms are ${index % 2 == 0 ? 'improving' : 'unchanged'} and medications were reviewed.`,
        attachments: [],
      },
    });

    await prisma.message.upsert({
      where: { id: `seed-message-${index}-b` },
      update: {
        threadId,
        senderId: provider.user.id,
        body: `Provider response ${index}: continue current plan and review again at the next scheduled visit.`,
        attachments: [],
      },
      create: {
        id: `seed-message-${index}-b`,
        threadId,
        senderId: provider.user.id,
        body: `Provider response ${index}: continue current plan and review again at the next scheduled visit.`,
        attachments: [],
      },
    });
  }

  await prisma.auditLog.upsert({
    where: { id: 'seed-audit-1' },
    update: {
      actorId: admin.id,
      organizationId: org.id,
      action: 'seed.completed',
      resource: 'system',
      resourceId: org.id,
      details: {
        seeded: true,
        financeUserId: finance.id,
        supportUserId: support.id,
        providerCount: providers.length,
        patientCount: patients.length,
        appointmentCount: appointments.length,
      },
    },
    create: {
      id: 'seed-audit-1',
      actorId: admin.id,
      organizationId: org.id,
      action: 'seed.completed',
      resource: 'system',
      resourceId: org.id,
      details: {
        seeded: true,
        financeUserId: finance.id,
        supportUserId: support.id,
        providerCount: providers.length,
        patientCount: patients.length,
        appointmentCount: appointments.length,
      },
    },
  });

  const pendingProvider = providerMap.get('pending.provider@carecenter.local')!;
  const incompleteProvider = providerMap.get('incomplete.provider@carecenter.local')!;
  const reviewedProvider = providerMap.get('reviewed.provider@carecenter.local')!;

  await prisma.auditLog.upsert({
    where: { id: 'seed-audit-onboarding-1' },
    update: {
      actorId: support.id,
      organizationId: org.id,
      action: 'provider.onboarding.submitted',
      resource: 'provider_onboarding',
      resourceId: pendingProvider.profile.id,
      details: { note: 'Profile submitted for review from seeded dataset.' },
    },
    create: {
      id: 'seed-audit-onboarding-1',
      actorId: support.id,
      organizationId: org.id,
      action: 'provider.onboarding.submitted',
      resource: 'provider_onboarding',
      resourceId: pendingProvider.profile.id,
      details: { note: 'Profile submitted for review from seeded dataset.' },
    },
  });

  await prisma.auditLog.upsert({
    where: { id: 'seed-audit-onboarding-2' },
    update: {
      actorId: support.id,
      organizationId: org.id,
      action: 'provider.onboarding.changes_requested',
      resource: 'provider_onboarding',
      resourceId: incompleteProvider.profile.id,
      details: {
        note: 'License number and specialty are required.',
        requestedFields: ['licenseNumber', 'specialty', 'services'],
      },
    },
    create: {
      id: 'seed-audit-onboarding-2',
      actorId: support.id,
      organizationId: org.id,
      action: 'provider.onboarding.changes_requested',
      resource: 'provider_onboarding',
      resourceId: incompleteProvider.profile.id,
      details: {
        note: 'License number and specialty are required.',
        requestedFields: ['licenseNumber', 'specialty', 'services'],
      },
    },
  });

  await prisma.auditLog.upsert({
    where: { id: 'seed-audit-onboarding-3' },
    update: {
      actorId: admin.id,
      organizationId: org.id,
      action: 'provider.onboarding.approved',
      resource: 'provider_onboarding',
      resourceId: reviewedProvider.profile.id,
      details: { note: 'Verified and approved in seed data.' },
    },
    create: {
      id: 'seed-audit-onboarding-3',
      actorId: admin.id,
      organizationId: org.id,
      action: 'provider.onboarding.approved',
      resource: 'provider_onboarding',
      resourceId: reviewedProvider.profile.id,
      details: { note: 'Verified and approved in seed data.' },
    },
  });

  await prisma.auditLog.upsert({
    where: { id: 'seed-audit-rbac-1' },
    update: {
      actorId: admin.id,
      organizationId: org.id,
      action: 'rbac.role_changed',
      resource: 'user',
      resourceId: support.id,
      details: {
        previousRole: 'COMPANY_SUPPORT',
        nextRole: 'COMPANY_SUPPORT',
        reason: 'Seed baseline role review.',
      },
    },
    create: {
      id: 'seed-audit-rbac-1',
      actorId: admin.id,
      organizationId: org.id,
      action: 'rbac.role_changed',
      resource: 'user',
      resourceId: support.id,
      details: {
        previousRole: 'COMPANY_SUPPORT',
        nextRole: 'COMPANY_SUPPORT',
        reason: 'Seed baseline role review.',
      },
    },
  });

  await prisma.auditLog.upsert({
    where: { id: 'seed-audit-booking-1' },
    update: {
      actorId: support.id,
      organizationId: org.id,
      action: 'booking.escalated',
      resource: 'booking_control',
      resourceId: 'seed-appt-1',
      details: {
        reasonCode: 'PROVIDER_DELAY',
        ownerRole: 'COMPANY_SUPPORT',
        note: 'Seeded booking escalation for control tower review.',
      },
    },
    create: {
      id: 'seed-audit-booking-1',
      actorId: support.id,
      organizationId: org.id,
      action: 'booking.escalated',
      resource: 'booking_control',
      resourceId: 'seed-appt-1',
      details: {
        reasonCode: 'PROVIDER_DELAY',
        ownerRole: 'COMPANY_SUPPORT',
        note: 'Seeded booking escalation for control tower review.',
      },
    },
  });

  await prisma.auditLog.upsert({
    where: { id: 'seed-audit-telehealth-1' },
    update: {
      actorId: support.id,
      organizationId: org.id,
      action: 'telehealth.escalated',
      resource: 'telehealth_ops',
      resourceId: 'seed-appt-1',
      details: {
        severity: 'MEDIUM',
        reasonCode: 'AUDIO_DEGRADED',
        note: 'Seeded telehealth escalation for ops workspace.',
      },
    },
    create: {
      id: 'seed-audit-telehealth-1',
      actorId: support.id,
      organizationId: org.id,
      action: 'telehealth.escalated',
      resource: 'telehealth_ops',
      resourceId: 'seed-appt-1',
      details: {
        severity: 'MEDIUM',
        reasonCode: 'AUDIO_DEGRADED',
        note: 'Seeded telehealth escalation for ops workspace.',
      },
    },
  });

  await prisma.auditLog.upsert({
    where: { id: 'seed-audit-support-1' },
    update: {
      actorId: support.id,
      organizationId: org.id,
      action: 'support.upserted',
      resource: 'support_work_item',
      resourceId: 'sup-billing-dispute-001',
      details: {
        source: 'seed',
        snapshot: {
          id: 'sup-billing-dispute-001',
          organizationId: org.id,
          code: 'SUP-1001',
          title: 'Billing dispute for missed refund promise',
          status: 'OPEN',
          priority: 'HIGH',
          category: 'BILLING',
          queue: 'Finance Support',
          channel: 'EMAIL',
          requesterName: 'Nadine Saab',
          summary: 'Patient reports that a same-day cancellation refund was promised but has not been issued.',
          tags: ['refund', 'billing'],
          createdAt: '2026-03-25T09:00:00.000Z',
          updatedAt: '2026-03-30T10:20:00.000Z',
        },
      },
    },
    create: {
      id: 'seed-audit-support-1',
      actorId: support.id,
      organizationId: org.id,
      action: 'support.upserted',
      resource: 'support_work_item',
      resourceId: 'sup-billing-dispute-001',
      details: {
        source: 'seed',
        snapshot: {
          id: 'sup-billing-dispute-001',
          organizationId: org.id,
          code: 'SUP-1001',
          title: 'Billing dispute for missed refund promise',
          status: 'OPEN',
          priority: 'HIGH',
          category: 'BILLING',
          queue: 'Finance Support',
          channel: 'EMAIL',
          requesterName: 'Nadine Saab',
          summary: 'Patient reports that a same-day cancellation refund was promised but has not been issued.',
          tags: ['refund', 'billing'],
          createdAt: '2026-03-25T09:00:00.000Z',
          updatedAt: '2026-03-30T10:20:00.000Z',
        },
      },
    },
  });

  await prisma.auditLog.upsert({
    where: { id: 'seed-audit-safety-1' },
    update: {
      actorId: admin.id,
      organizationId: org.id,
      action: 'safety.upserted',
      resource: 'safety_case',
      resourceId: 'safe-medication-001',
      details: {
        source: 'seed',
        snapshot: {
          id: 'safe-medication-001',
          organizationId: org.id,
          code: 'SAFE-2001',
          title: 'Medication dosage follow-up required',
          status: 'UNDER_REVIEW',
          severity: 'HIGH',
          category: 'CLINICAL',
          queue: 'Clinical Safety',
          patientImpact: 'Potential',
          ownerName: 'Dr. Reem Nader',
          summary: 'Case opened after patient message suggested dosage confusion following dermatology visit.',
          tags: ['medication', 'follow-up'],
          createdAt: '2026-03-24T08:15:00.000Z',
          updatedAt: '2026-03-29T12:10:00.000Z',
        },
      },
    },
    create: {
      id: 'seed-audit-safety-1',
      actorId: admin.id,
      organizationId: org.id,
      action: 'safety.upserted',
      resource: 'safety_case',
      resourceId: 'safe-medication-001',
      details: {
        source: 'seed',
        snapshot: {
          id: 'safe-medication-001',
          organizationId: org.id,
          code: 'SAFE-2001',
          title: 'Medication dosage follow-up required',
          status: 'UNDER_REVIEW',
          severity: 'HIGH',
          category: 'CLINICAL',
          queue: 'Clinical Safety',
          patientImpact: 'Potential',
          ownerName: 'Dr. Reem Nader',
          summary: 'Case opened after patient message suggested dosage confusion following dermatology visit.',
          tags: ['medication', 'follow-up'],
          createdAt: '2026-03-24T08:15:00.000Z',
          updatedAt: '2026-03-29T12:10:00.000Z',
        },
      },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
