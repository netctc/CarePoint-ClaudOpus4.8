import {
  AppointmentStatus,
  CredentialDocumentStatus,
  CredentialDocumentType,
  PaymentStatus,
  PrismaClient,
  ProviderOnboardingStatus,
  SlotStatus,
  TelehealthStatus,
  UserRole,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysFromNow(days: number, hour = 9, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function plusMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function pick<T>(arr: T[], idx: number): T {
  return arr[idx % arr.length];
}

// ─── Seed Data Definitions ────────────────────────────────────────────────────

interface RoleUserSpec {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

interface ProviderSpec {
  email: string;
  firstName: string;
  lastName: string;
  specialty: string;
  licenseNumber: string;
  services: string[];
  category: string; // Physician, Nurse, Therapist, Laboratory, Radiology, Pharmacy, HomeCare
  onboardingStatus: ProviderOnboardingStatus;
}

interface PatientSpec {
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  insuranceNumber: string;
  orgIndex: number; // 0 or 1 to assign to one of 2 orgs
}

// ─── Main Seed ────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Starting comprehensive CarePoint seed...');

  // ═══ CLEANUP — Delete all existing data in correct order ═══════════════════
  console.log('  🗑️  Clearing existing data...');
  await prisma.telehealthSession.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.publishedSlot.deleteMany();
  await prisma.timeOffBlock.deleteMany();
  await prisma.providerScheduleTemplate.deleteMany();
  await prisma.providerCredentialDocument.deleteMany();
  await prisma.providerOnboardingState.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.patientProfile.deleteMany();
  await prisma.providerProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();
  console.log('  ✓ Database cleared');

  const passwordHash = await bcrypt.hash('ChangeMe123!', 10);

  // ═══ Organizations ═══════════════════════════════════════════════════════════

  const org1 = await prisma.organization.upsert({
    where: { id: 'org-carepoint-medical' },
    update: { name: 'CarePoint Medical Center' },
    create: { id: 'org-carepoint-medical', name: 'CarePoint Medical Center' },
  });

  const org2 = await prisma.organization.upsert({
    where: { id: 'org-healthfirst-clinic' },
    update: { name: 'HealthFirst Clinic' },
    create: { id: 'org-healthfirst-clinic', name: 'HealthFirst Clinic' },
  });

  const orgs = [org1, org2];
  console.log('  ✓ Organizations created');

  // ═══ Super Admin ═══════════════════════════════════════════════════════════

  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@carepoint.local' },
    update: { passwordHash, firstName: 'Super', lastName: 'Admin', role: UserRole.SUPER_ADMIN, organizationId: org1.id },
    create: { email: 'superadmin@carepoint.local', passwordHash, firstName: 'Super', lastName: 'Admin', role: UserRole.SUPER_ADMIN, organizationId: org1.id },
  });
  console.log('  ✓ Super Admin created');

  // ═══ Role-based Users ══════════════════════════════════════════════════════

  const roleUsers: RoleUserSpec[] = [
    { email: 'companyadmin@carepoint.local', firstName: 'Carlos', lastName: 'Mendoza', role: UserRole.COMPANY_ADMIN },
    { email: 'support@carepoint.local', firstName: 'María', lastName: 'Rodríguez', role: UserRole.COMPANY_SUPPORT },
    { email: 'finance@carepoint.local', firstName: 'Roberto', lastName: 'Guzmán', role: UserRole.FINANCE },
    { email: 'provider@carepoint.local', firstName: 'Ana', lastName: 'García', role: UserRole.PROVIDER },
    { email: 'nurse@carepoint.local', firstName: 'Luisa', lastName: 'Fernández', role: UserRole.NURSE },
    { email: 'pharmacist@carepoint.local', firstName: 'Diego', lastName: 'Morales', role: UserRole.PHARMACIST },
    { email: 'labtech@carepoint.local', firstName: 'Patricia', lastName: 'Vargas', role: UserRole.LAB_TECH },
    { email: 'patient@carepoint.local', firstName: 'Juan', lastName: 'Pérez', role: UserRole.PATIENT },
  ];

  const createdRoleUsers: Array<{ user: any; spec: RoleUserSpec }> = [];
  for (const spec of roleUsers) {
    const user = await prisma.user.upsert({
      where: { email: spec.email },
      update: { passwordHash, firstName: spec.firstName, lastName: spec.lastName, role: spec.role, organizationId: org1.id },
      create: { email: spec.email, passwordHash, firstName: spec.firstName, lastName: spec.lastName, role: spec.role, organizationId: org1.id },
    });
    createdRoleUsers.push({ user, spec });
  }
  console.log('  ✓ Role-based users created');

  // ═══ Providers (All Types) ═════════════════════════════════════════════════

  const providerSpecs: ProviderSpec[] = [
    // Physicians (10)
    { email: 'dr.ramirez@carepoint.local', firstName: 'Alejandro', lastName: 'Ramírez', specialty: 'General Practice', licenseNumber: 'MED-GP-001', services: ['Consultation', 'Follow-up', 'Preventive Care'], category: 'Physician', onboardingStatus: ProviderOnboardingStatus.APPROVED },
    { email: 'dr.castillo@carepoint.local', firstName: 'Valentina', lastName: 'Castillo', specialty: 'Cardiology', licenseNumber: 'MED-CARD-002', services: ['ECG Review', 'Cardiac Consultation', 'Stress Test'], category: 'Physician', onboardingStatus: ProviderOnboardingStatus.APPROVED },
    { email: 'dr.herrera@carepoint.local', firstName: 'Sebastián', lastName: 'Herrera', specialty: 'Dermatology', licenseNumber: 'MED-DERM-003', services: ['Skin Consultation', 'Lesion Review', 'Telehealth'], category: 'Physician', onboardingStatus: ProviderOnboardingStatus.APPROVED },
    { email: 'dr.torres@carepoint.local', firstName: 'Camila', lastName: 'Torres', specialty: 'Neurology', licenseNumber: 'MED-NEUR-004', services: ['Neurological Exam', 'Headache Clinic', 'EEG Review'], category: 'Physician', onboardingStatus: ProviderOnboardingStatus.APPROVED },
    { email: 'dr.navarro@carepoint.local', firstName: 'Mateo', lastName: 'Navarro', specialty: 'Pediatrics', licenseNumber: 'MED-PED-005', services: ['Well-child Visit', 'Vaccination', 'Growth Assessment'], category: 'Physician', onboardingStatus: ProviderOnboardingStatus.APPROVED },
    { email: 'dr.silva@carepoint.local', firstName: 'Isabella', lastName: 'Silva', specialty: 'Orthopedics', licenseNumber: 'MED-ORTH-006', services: ['Joint Consultation', 'Fracture Follow-up', 'Sports Medicine'], category: 'Physician', onboardingStatus: ProviderOnboardingStatus.READY_FOR_REVIEW },
    { email: 'dr.rojas@carepoint.local', firstName: 'Daniel', lastName: 'Rojas', specialty: 'Ophthalmology', licenseNumber: 'MED-OPHT-007', services: ['Eye Exam', 'Glaucoma Screening', 'Retinal Assessment'], category: 'Physician', onboardingStatus: ProviderOnboardingStatus.READY_FOR_REVIEW },
    { email: 'dr.vega@carepoint.local', firstName: 'Sofía', lastName: 'Vega', specialty: 'Psychiatry', licenseNumber: 'MED-PSYCH-008', services: ['Mental Health Evaluation', 'Medication Management', 'Telehealth Therapy'], category: 'Physician', onboardingStatus: ProviderOnboardingStatus.APPROVED },
    { email: 'dr.molina@carepoint.local', firstName: 'Andrés', lastName: 'Molina', specialty: 'Internal Medicine', licenseNumber: 'MED-IM-009', services: ['Internal Medicine Consultation', 'Chronic Disease Management', 'Preventive Screening'], category: 'Physician', onboardingStatus: ProviderOnboardingStatus.DRAFT },
    { email: 'dr.delgado@carepoint.local', firstName: 'Luciana', lastName: 'Delgado', specialty: 'Endocrinology', licenseNumber: 'MED-ENDO-010', services: ['Diabetes Management', 'Thyroid Consultation', 'Metabolic Assessment'], category: 'Physician', onboardingStatus: ProviderOnboardingStatus.APPROVED },

    // Nurses (4)
    { email: 'nurse.guerrero@carepoint.local', firstName: 'Carmen', lastName: 'Guerrero', specialty: 'Emergency Nursing', licenseNumber: 'NUR-ER-001', services: ['Triage', 'Emergency Assessment', 'Wound Care'], category: 'Nurse', onboardingStatus: ProviderOnboardingStatus.APPROVED },
    { email: 'nurse.jimenez@carepoint.local', firstName: 'Laura', lastName: 'Jiménez', specialty: 'Pediatric Nursing', licenseNumber: 'NUR-PED-002', services: ['Pediatric Triage', 'Vaccination Administration', 'Child Health Assessment'], category: 'Nurse', onboardingStatus: ProviderOnboardingStatus.APPROVED },
    { email: 'nurse.reyes@carepoint.local', firstName: 'Fernando', lastName: 'Reyes', specialty: 'ICU Nursing', licenseNumber: 'NUR-ICU-003', services: ['Critical Care', 'Ventilator Management', 'Hemodynamic Monitoring'], category: 'Nurse', onboardingStatus: ProviderOnboardingStatus.READY_FOR_REVIEW },
    { email: 'nurse.ortiz@carepoint.local', firstName: 'Gabriela', lastName: 'Ortiz', specialty: 'Surgical Nursing', licenseNumber: 'NUR-SURG-004', services: ['Pre-op Assessment', 'Post-op Care', 'Wound Management'], category: 'Nurse', onboardingStatus: ProviderOnboardingStatus.APPROVED },

    // Therapists (4)
    { email: 'pt.martinez@carepoint.local', firstName: 'Ricardo', lastName: 'Martínez', specialty: 'Physical Therapy', licenseNumber: 'PT-PHYS-001', services: ['Musculoskeletal Rehab', 'Post-surgical Recovery', 'Sports Rehabilitation'], category: 'Therapist', onboardingStatus: ProviderOnboardingStatus.APPROVED },
    { email: 'ot.sanchez@carepoint.local', firstName: 'Elena', lastName: 'Sánchez', specialty: 'Occupational Therapy', licenseNumber: 'OT-OCC-002', services: ['Daily Living Skills', 'Hand Therapy', 'Workplace Ergonomics'], category: 'Therapist', onboardingStatus: ProviderOnboardingStatus.APPROVED },
    { email: 'st.lopez@carepoint.local', firstName: 'Miguel', lastName: 'López', specialty: 'Speech Therapy', licenseNumber: 'ST-SPE-003', services: ['Speech Assessment', 'Swallowing Therapy', 'Language Development'], category: 'Therapist', onboardingStatus: ProviderOnboardingStatus.DRAFT },
    { email: 'mh.rivera@carepoint.local', firstName: 'Claudia', lastName: 'Rivera', specialty: 'Mental Health Counseling', licenseNumber: 'MH-COUN-004', services: ['Counseling Session', 'CBT', 'Grief Therapy'], category: 'Therapist', onboardingStatus: ProviderOnboardingStatus.APPROVED },

    // Laboratory (2)
    { email: 'lab.paredes@carepoint.local', firstName: 'Jorge', lastName: 'Paredes', specialty: 'Clinical Laboratory', licenseNumber: 'LAB-CLIN-001', services: ['Blood Panel', 'Urinalysis', 'Microbiology Culture'], category: 'Laboratory', onboardingStatus: ProviderOnboardingStatus.APPROVED },
    { email: 'lab.acosta@carepoint.local', firstName: 'Adriana', lastName: 'Acosta', specialty: 'Pathology', licenseNumber: 'LAB-PATH-002', services: ['Histopathology', 'Cytology', 'Tissue Biopsy Analysis'], category: 'Laboratory', onboardingStatus: ProviderOnboardingStatus.APPROVED },

    // Radiology (2)
    { email: 'rad.fuentes@carepoint.local', firstName: 'Héctor', lastName: 'Fuentes', specialty: 'General Radiology', licenseNumber: 'RAD-GEN-001', services: ['X-Ray', 'Ultrasound', 'Fluoroscopy'], category: 'Radiology', onboardingStatus: ProviderOnboardingStatus.APPROVED },
    { email: 'rad.mejia@carepoint.local', firstName: 'Natalia', lastName: 'Mejía', specialty: 'MRI/CT Imaging', licenseNumber: 'RAD-ADV-002', services: ['MRI Scan', 'CT Scan', 'Contrast Studies'], category: 'Radiology', onboardingStatus: ProviderOnboardingStatus.READY_FOR_REVIEW },

    // Pharmacy (2)
    { email: 'pharm.castro@carepoint.local', firstName: 'Eduardo', lastName: 'Castro', specialty: 'Clinical Pharmacy', licenseNumber: 'PHARM-CLIN-001', services: ['Medication Review', 'Drug Interaction Check', 'Dosage Adjustment'], category: 'Pharmacy', onboardingStatus: ProviderOnboardingStatus.APPROVED },
    { email: 'pharm.pena@carepoint.local', firstName: 'Daniela', lastName: 'Peña', specialty: 'Community Pharmacy', licenseNumber: 'PHARM-COMM-002', services: ['Prescription Filling', 'Patient Counseling', 'OTC Guidance'], category: 'Pharmacy', onboardingStatus: ProviderOnboardingStatus.APPROVED },

    // Home Care (2)
    { email: 'hc.vargas@carepoint.local', firstName: 'Rosa', lastName: 'Vargas', specialty: 'Geriatric Home Care', licenseNumber: 'HC-GER-001', services: ['Home Health Assessment', 'Medication Administration', 'Fall Prevention'], category: 'HomeCare', onboardingStatus: ProviderOnboardingStatus.APPROVED },
    { email: 'hc.mendez@carepoint.local', firstName: 'Pablo', lastName: 'Méndez', specialty: 'Post-surgical Home Care', licenseNumber: 'HC-SURG-002', services: ['Wound Care Visit', 'Physical Therapy at Home', 'Recovery Monitoring'], category: 'HomeCare', onboardingStatus: ProviderOnboardingStatus.DRAFT },
  ];

  const providerRecords: Array<{ user: any; profile: any; spec: ProviderSpec }> = [];

  for (let i = 0; i < providerSpecs.length; i++) {
    const spec = providerSpecs[i];
    const orgId = i < 18 ? org1.id : org2.id; // Most in org1, last few in org2

    const user = await prisma.user.upsert({
      where: { email: spec.email },
      update: { passwordHash, firstName: spec.firstName, lastName: spec.lastName, role: UserRole.PROVIDER, organizationId: orgId },
      create: { email: spec.email, passwordHash, firstName: spec.firstName, lastName: spec.lastName, role: UserRole.PROVIDER, organizationId: orgId },
    });

    const profile = await prisma.providerProfile.upsert({
      where: { userId: user.id },
      update: { organizationId: orgId, specialty: spec.specialty, licenseNumber: spec.licenseNumber, services: spec.services },
      create: { userId: user.id, organizationId: orgId, specialty: spec.specialty, licenseNumber: spec.licenseNumber, services: spec.services },
    });

    // Onboarding state
    await prisma.providerOnboardingState.upsert({
      where: { providerId: profile.id },
      update: {
        organizationId: orgId,
        status: spec.onboardingStatus,
        checklist: { documentsUploaded: spec.onboardingStatus !== ProviderOnboardingStatus.DRAFT, licenseVerified: spec.onboardingStatus === ProviderOnboardingStatus.APPROVED, profileComplete: spec.onboardingStatus !== ProviderOnboardingStatus.DRAFT },
        submittedAt: spec.onboardingStatus !== ProviderOnboardingStatus.DRAFT ? daysFromNow(-30 + i) : null,
        reviewedAt: spec.onboardingStatus === ProviderOnboardingStatus.APPROVED ? daysFromNow(-20 + i) : null,
        lastActorId: superAdmin.id,
      },
      create: {
        providerId: profile.id,
        organizationId: orgId,
        status: spec.onboardingStatus,
        checklist: { documentsUploaded: spec.onboardingStatus !== ProviderOnboardingStatus.DRAFT, licenseVerified: spec.onboardingStatus === ProviderOnboardingStatus.APPROVED, profileComplete: spec.onboardingStatus !== ProviderOnboardingStatus.DRAFT },
        submittedAt: spec.onboardingStatus !== ProviderOnboardingStatus.DRAFT ? daysFromNow(-30 + i) : null,
        reviewedAt: spec.onboardingStatus === ProviderOnboardingStatus.APPROVED ? daysFromNow(-20 + i) : null,
        lastActorId: superAdmin.id,
      },
    });

    // Credential document (at least one per provider)
    const credDocId = `cred-doc-${spec.licenseNumber}`;
    await prisma.providerCredentialDocument.upsert({
      where: { id: credDocId },
      update: {
        providerId: profile.id,
        organizationId: orgId,
        type: CredentialDocumentType.LICENSE,
        title: `Medical License - ${spec.specialty}`,
        status: spec.onboardingStatus === ProviderOnboardingStatus.APPROVED ? CredentialDocumentStatus.VERIFIED : spec.onboardingStatus === ProviderOnboardingStatus.DRAFT ? CredentialDocumentStatus.MISSING : CredentialDocumentStatus.UPLOADED,
        documentUrl: spec.onboardingStatus !== ProviderOnboardingStatus.DRAFT ? `https://docs.carepoint.local/credentials/${spec.licenseNumber}.pdf` : null,
        fileName: spec.onboardingStatus !== ProviderOnboardingStatus.DRAFT ? `${spec.licenseNumber}.pdf` : null,
        referenceNumber: spec.licenseNumber,
        issuedAt: daysFromNow(-365),
        expiresAt: daysFromNow(365),
        verifiedAt: spec.onboardingStatus === ProviderOnboardingStatus.APPROVED ? daysFromNow(-15 + i) : null,
        verifiedById: spec.onboardingStatus === ProviderOnboardingStatus.APPROVED ? superAdmin.id : null,
      },
      create: {
        id: credDocId,
        providerId: profile.id,
        organizationId: orgId,
        type: CredentialDocumentType.LICENSE,
        title: `Medical License - ${spec.specialty}`,
        status: spec.onboardingStatus === ProviderOnboardingStatus.APPROVED ? CredentialDocumentStatus.VERIFIED : spec.onboardingStatus === ProviderOnboardingStatus.DRAFT ? CredentialDocumentStatus.MISSING : CredentialDocumentStatus.UPLOADED,
        documentUrl: spec.onboardingStatus !== ProviderOnboardingStatus.DRAFT ? `https://docs.carepoint.local/credentials/${spec.licenseNumber}.pdf` : null,
        fileName: spec.onboardingStatus !== ProviderOnboardingStatus.DRAFT ? `${spec.licenseNumber}.pdf` : null,
        referenceNumber: spec.licenseNumber,
        issuedAt: daysFromNow(-365),
        expiresAt: daysFromNow(365),
        verifiedAt: spec.onboardingStatus === ProviderOnboardingStatus.APPROVED ? daysFromNow(-15 + i) : null,
        verifiedById: spec.onboardingStatus === ProviderOnboardingStatus.APPROVED ? superAdmin.id : null,
      },
    });

    providerRecords.push({ user, profile, spec });
  }
  console.log('  ✓ Providers created with profiles, onboarding, and credentials');

  // ═══ Schedule Templates & Published Slots ══════════════════════════════════

  const approvedProviders = providerRecords.filter(p => p.spec.onboardingStatus === ProviderOnboardingStatus.APPROVED);

  for (const provider of approvedProviders) {
    const orgId = provider.profile.organizationId;
    const templateId = `sched-tmpl-${provider.profile.id}`;

    // Weekly schedule template (Mon-Fri, 9am-5pm with lunch break)
    const weeklyPattern = {
      monday: { start: '09:00', end: '17:00', breakStart: '12:00', breakEnd: '13:00' },
      tuesday: { start: '09:00', end: '17:00', breakStart: '12:00', breakEnd: '13:00' },
      wednesday: { start: '09:00', end: '16:00', breakStart: '12:00', breakEnd: '13:00' },
      thursday: { start: '09:00', end: '17:00', breakStart: '12:00', breakEnd: '13:00' },
      friday: { start: '09:00', end: '15:00', breakStart: '12:00', breakEnd: '13:00' },
      saturday: null,
      sunday: null,
    };

    const template = await prisma.providerScheduleTemplate.upsert({
      where: { id: templateId },
      update: {
        organizationId: orgId,
        providerId: provider.profile.id,
        name: `${provider.spec.firstName} ${provider.spec.lastName} - Weekly Schedule`,
        status: 'PUBLISHED',
        data: { weeklyPattern, slotDurationMinutes: 30, bufferMinutes: 5, timezone: 'America/Bogota' },
      },
      create: {
        id: templateId,
        organizationId: orgId,
        providerId: provider.profile.id,
        name: `${provider.spec.firstName} ${provider.spec.lastName} - Weekly Schedule`,
        status: 'PUBLISHED',
        data: { weeklyPattern, slotDurationMinutes: 30, bufferMinutes: 5, timezone: 'America/Bogota' },
      },
    });

    // Published slots for next 3 weeks (weekdays only, 9am-5pm, 30min slots)
    for (let dayOffset = 1; dayOffset <= 21; dayOffset++) {
      const slotDate = daysFromNow(dayOffset);
      const dayOfWeek = slotDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends

      const slotsPerDay = dayOfWeek === 5 ? 10 : dayOfWeek === 3 ? 12 : 14; // Fri shorter, Wed slightly shorter
      for (let slotIdx = 0; slotIdx < slotsPerDay; slotIdx++) {
        const hour = 9 + Math.floor(slotIdx / 2);
        const minute = (slotIdx % 2) * 30;
        // Skip lunch break (12:00-13:00)
        if (hour === 12) continue;

        const startsAt = daysFromNow(dayOffset, hour, minute);
        const endsAt = plusMinutes(startsAt, 30);
        const slotId = `slot-${provider.profile.id}-d${dayOffset}-s${slotIdx}`;

        await prisma.publishedSlot.upsert({
          where: { id: slotId },
          update: {
            organizationId: orgId,
            providerId: provider.profile.id,
            templateId: template.id,
            startsAt,
            endsAt,
            service: provider.spec.services[0],
            location: provider.spec.category === 'HomeCare' ? 'Home Visit' : 'Main Clinic',
            capacity: 1,
            bookedCount: 0,
            status: SlotStatus.AVAILABLE,
          },
          create: {
            id: slotId,
            organizationId: orgId,
            providerId: provider.profile.id,
            templateId: template.id,
            startsAt,
            endsAt,
            service: provider.spec.services[0],
            location: provider.spec.category === 'HomeCare' ? 'Home Visit' : 'Main Clinic',
            capacity: 1,
            bookedCount: 0,
            status: SlotStatus.AVAILABLE,
          },
        });
      }
    }
  }
  console.log('  ✓ Schedule templates and published slots created');


  // ═══ Patients ══════════════════════════════════════════════════════════════

  const patientSpecs: PatientSpec[] = [
    { email: 'juan.perez@carepoint.local', firstName: 'Juan', lastName: 'Pérez', dateOfBirth: '1985-03-15', insuranceNumber: 'INS-CP-001', orgIndex: 0 },
    { email: 'maria.gonzalez@carepoint.local', firstName: 'María', lastName: 'González', dateOfBirth: '1990-07-22', insuranceNumber: 'INS-CP-002', orgIndex: 0 },
    { email: 'carlos.rodriguez@carepoint.local', firstName: 'Carlos', lastName: 'Rodríguez', dateOfBirth: '1978-11-08', insuranceNumber: 'INS-CP-003', orgIndex: 0 },
    { email: 'ana.martinez@carepoint.local', firstName: 'Ana', lastName: 'Martínez', dateOfBirth: '1995-01-30', insuranceNumber: 'INS-CP-004', orgIndex: 0 },
    { email: 'luis.hernandez@carepoint.local', firstName: 'Luis', lastName: 'Hernández', dateOfBirth: '1968-05-12', insuranceNumber: 'INS-CP-005', orgIndex: 0 },
    { email: 'sofia.lopez@carepoint.local', firstName: 'Sofía', lastName: 'López', dateOfBirth: '1992-09-18', insuranceNumber: 'INS-CP-006', orgIndex: 0 },
    { email: 'diego.garcia@carepoint.local', firstName: 'Diego', lastName: 'García', dateOfBirth: '1982-12-03', insuranceNumber: 'INS-CP-007', orgIndex: 0 },
    { email: 'camila.torres@carepoint.local', firstName: 'Camila', lastName: 'Torres', dateOfBirth: '1999-04-25', insuranceNumber: 'INS-CP-008', orgIndex: 0 },
    { email: 'andres.morales@carepoint.local', firstName: 'Andrés', lastName: 'Morales', dateOfBirth: '1975-08-14', insuranceNumber: 'INS-CP-009', orgIndex: 0 },
    { email: 'valentina.diaz@carepoint.local', firstName: 'Valentina', lastName: 'Díaz', dateOfBirth: '1988-06-07', insuranceNumber: 'INS-CP-010', orgIndex: 0 },
    { email: 'jorge.ruiz@carepoint.local', firstName: 'Jorge', lastName: 'Ruiz', dateOfBirth: '1970-02-28', insuranceNumber: 'INS-HF-011', orgIndex: 1 },
    { email: 'laura.castro@carepoint.local', firstName: 'Laura', lastName: 'Castro', dateOfBirth: '1993-10-11', insuranceNumber: 'INS-HF-012', orgIndex: 1 },
    { email: 'pablo.vargas@carepoint.local', firstName: 'Pablo', lastName: 'Vargas', dateOfBirth: '1980-03-19', insuranceNumber: 'INS-HF-013', orgIndex: 1 },
    { email: 'elena.flores@carepoint.local', firstName: 'Elena', lastName: 'Flores', dateOfBirth: '1997-07-05', insuranceNumber: 'INS-HF-014', orgIndex: 1 },
    { email: 'ricardo.ramos@carepoint.local', firstName: 'Ricardo', lastName: 'Ramos', dateOfBirth: '1965-12-20', insuranceNumber: 'INS-HF-015', orgIndex: 1 },
    { email: 'gabriela.silva@carepoint.local', firstName: 'Gabriela', lastName: 'Silva', dateOfBirth: '1991-05-02', insuranceNumber: 'INS-CP-016', orgIndex: 0 },
    { email: 'fernando.mendez@carepoint.local', firstName: 'Fernando', lastName: 'Méndez', dateOfBirth: '1973-09-16', insuranceNumber: 'INS-CP-017', orgIndex: 0 },
    { email: 'claudia.reyes@carepoint.local', firstName: 'Claudia', lastName: 'Reyes', dateOfBirth: '1986-01-08', insuranceNumber: 'INS-CP-018', orgIndex: 0 },
    { email: 'miguel.herrera@carepoint.local', firstName: 'Miguel', lastName: 'Herrera', dateOfBirth: '1979-11-23', insuranceNumber: 'INS-HF-019', orgIndex: 1 },
    { email: 'natalia.jimenez@carepoint.local', firstName: 'Natalia', lastName: 'Jiménez', dateOfBirth: '1994-08-30', insuranceNumber: 'INS-HF-020', orgIndex: 1 },
    { email: 'roberto.acosta@carepoint.local', firstName: 'Roberto', lastName: 'Acosta', dateOfBirth: '1971-04-17', insuranceNumber: 'INS-CP-021', orgIndex: 0 },
    { email: 'daniela.ortiz@carepoint.local', firstName: 'Daniela', lastName: 'Ortiz', dateOfBirth: '1996-06-12', insuranceNumber: 'INS-CP-022', orgIndex: 0 },
  ];

  const patientRecords: Array<{ user: any; profile: any; spec: PatientSpec }> = [];

  for (const spec of patientSpecs) {
    const orgId = orgs[spec.orgIndex].id;
    const user = await prisma.user.upsert({
      where: { email: spec.email },
      update: { passwordHash, firstName: spec.firstName, lastName: spec.lastName, role: UserRole.PATIENT, organizationId: orgId },
      create: { email: spec.email, passwordHash, firstName: spec.firstName, lastName: spec.lastName, role: UserRole.PATIENT, organizationId: orgId },
    });

    const profile = await prisma.patientProfile.upsert({
      where: { userId: user.id },
      update: {
        organizationId: orgId,
        dateOfBirth: new Date(`${spec.dateOfBirth}T00:00:00.000Z`),
        insuranceNumber: spec.insuranceNumber,
        preferences: { preferredLanguage: 'es', notifications: true, marketingOptIn: false },
      },
      create: {
        userId: user.id,
        organizationId: orgId,
        dateOfBirth: new Date(`${spec.dateOfBirth}T00:00:00.000Z`),
        insuranceNumber: spec.insuranceNumber,
        preferences: { preferredLanguage: 'es', notifications: true, marketingOptIn: false },
      },
    });

    patientRecords.push({ user, profile, spec });
  }
  console.log('  ✓ Patients created');

  // ═══ Appointments (Historical + Future) ════════════════════════════════════

  const services = ['Consultation', 'Follow-up', 'Telehealth Review', 'Lab Review', 'Medication Management', 'Physical Therapy', 'Mental Health Session', 'Vaccination', 'Dermatology Review', 'Cardiac Assessment'];
  const locations = ['Main Clinic', 'North Branch', 'Telehealth', 'Home Visit', 'Specialty Center'];

  // Past appointments (55+)
  for (let i = 1; i <= 55; i++) {
    const patient = patientRecords[(i - 1) % patientRecords.length];
    const provider = approvedProviders[(i - 1) % approvedProviders.length];
    const orgId = patient.profile.organizationId;
    const dayOffset = -90 + Math.floor(i * 1.6); // Spread over last ~3 months
    const hour = 9 + (i % 7);
    const startsAt = daysFromNow(dayOffset, hour, (i % 2) * 30);
    const endsAt = plusMinutes(startsAt, 30);

    let status: AppointmentStatus;
    if (i % 10 === 0) status = AppointmentStatus.NO_SHOW;
    else if (i % 8 === 0) status = AppointmentStatus.CANCELLED;
    else status = AppointmentStatus.COMPLETED;

    const location = pick(locations, i);
    const apptId = `seed-past-appt-${i}`;

    await prisma.appointment.upsert({
      where: { id: apptId },
      update: {
        organizationId: orgId,
        patientId: patient.profile.id,
        providerId: provider.profile.id,
        service: pick(services, i),
        location,
        startsAt,
        endsAt,
        status,
        notes: `Historical appointment #${i}. ${status === AppointmentStatus.COMPLETED ? 'Visit completed successfully.' : status === AppointmentStatus.CANCELLED ? 'Cancelled by patient.' : 'Patient did not show up.'}`,
      },
      create: {
        id: apptId,
        organizationId: orgId,
        patientId: patient.profile.id,
        providerId: provider.profile.id,
        service: pick(services, i),
        location,
        startsAt,
        endsAt,
        status,
        notes: `Historical appointment #${i}. ${status === AppointmentStatus.COMPLETED ? 'Visit completed successfully.' : status === AppointmentStatus.CANCELLED ? 'Cancelled by patient.' : 'Patient did not show up.'}`,
      },
    });

    // Add telehealth session for telehealth appointments
    if (location === 'Telehealth' && status !== AppointmentStatus.CANCELLED) {
      await prisma.telehealthSession.upsert({
        where: { appointmentId: apptId },
        update: {
          vendor: 'daily',
          meetingId: `meeting-past-${i}`,
          joinUrl: `https://telehealth.carepoint.local/session/past-${i}`,
          status: status === AppointmentStatus.COMPLETED ? TelehealthStatus.ENDED : TelehealthStatus.SCHEDULED,
          scheduledAt: startsAt,
          startedAt: status === AppointmentStatus.COMPLETED ? startsAt : null,
          endedAt: status === AppointmentStatus.COMPLETED ? endsAt : null,
        },
        create: {
          appointmentId: apptId,
          vendor: 'daily',
          meetingId: `meeting-past-${i}`,
          joinUrl: `https://telehealth.carepoint.local/session/past-${i}`,
          status: status === AppointmentStatus.COMPLETED ? TelehealthStatus.ENDED : TelehealthStatus.SCHEDULED,
          scheduledAt: startsAt,
          startedAt: status === AppointmentStatus.COMPLETED ? startsAt : null,
          endedAt: status === AppointmentStatus.COMPLETED ? endsAt : null,
        },
      });
    }
  }

  // Future appointments (35)
  for (let i = 1; i <= 35; i++) {
    const patient = patientRecords[(i + 3) % patientRecords.length];
    const provider = approvedProviders[(i + 2) % approvedProviders.length];
    const orgId = patient.profile.organizationId;
    const dayOffset = 1 + Math.floor(i * 0.4); // Spread over next ~2 weeks
    const hour = 9 + (i % 7);
    const startsAt = daysFromNow(dayOffset, hour, (i % 2) * 30);
    const endsAt = plusMinutes(startsAt, 30);

    const status: AppointmentStatus = i % 3 === 0 ? AppointmentStatus.REQUESTED : AppointmentStatus.CONFIRMED;
    const location = pick(locations, i + 5);
    const apptId = `seed-future-appt-${i}`;

    await prisma.appointment.upsert({
      where: { id: apptId },
      update: {
        organizationId: orgId,
        patientId: patient.profile.id,
        providerId: provider.profile.id,
        service: pick(services, i + 3),
        location,
        startsAt,
        endsAt,
        status,
        notes: `Upcoming appointment #${i}. ${status === AppointmentStatus.REQUESTED ? 'Awaiting provider confirmation.' : 'Confirmed and scheduled.'}`,
      },
      create: {
        id: apptId,
        organizationId: orgId,
        patientId: patient.profile.id,
        providerId: provider.profile.id,
        service: pick(services, i + 3),
        location,
        startsAt,
        endsAt,
        status,
        notes: `Upcoming appointment #${i}. ${status === AppointmentStatus.REQUESTED ? 'Awaiting provider confirmation.' : 'Confirmed and scheduled.'}`,
      },
    });

    // Add telehealth session for telehealth future appointments
    if (location === 'Telehealth') {
      await prisma.telehealthSession.upsert({
        where: { appointmentId: apptId },
        update: {
          vendor: 'daily',
          meetingId: `meeting-future-${i}`,
          joinUrl: `https://telehealth.carepoint.local/session/future-${i}`,
          status: TelehealthStatus.SCHEDULED,
          scheduledAt: startsAt,
        },
        create: {
          appointmentId: apptId,
          vendor: 'daily',
          meetingId: `meeting-future-${i}`,
          joinUrl: `https://telehealth.carepoint.local/session/future-${i}`,
          status: TelehealthStatus.SCHEDULED,
          scheduledAt: startsAt,
        },
      });
    }
  }
  console.log('  ✓ Appointments created (55 past + 35 future)');

  // ═══ Audit Log Entries ═════════════════════════════════════════════════════

  const auditEntries = [
    { action: 'USER_CREATED', resource: 'User', resourceId: superAdmin.id, details: { email: 'superadmin@carepoint.local', role: 'SUPER_ADMIN' } },
    { action: 'USER_CREATED', resource: 'User', resourceId: createdRoleUsers[0].user.id, details: { email: 'companyadmin@carepoint.local', role: 'COMPANY_ADMIN' } },
    { action: 'ROLE_CHANGED', resource: 'User', resourceId: createdRoleUsers[1].user.id, details: { previousRole: 'PATIENT', newRole: 'COMPANY_SUPPORT', reason: 'Promoted to support' } },
    { action: 'PROVIDER_APPROVED', resource: 'ProviderProfile', resourceId: providerRecords[0].profile.id, details: { providerName: 'Alejandro Ramírez', specialty: 'General Practice' } },
    { action: 'PROVIDER_APPROVED', resource: 'ProviderProfile', resourceId: providerRecords[1].profile.id, details: { providerName: 'Valentina Castillo', specialty: 'Cardiology' } },
    { action: 'APPOINTMENT_CREATED', resource: 'Appointment', resourceId: 'seed-future-appt-1', details: { service: 'Consultation', patientEmail: 'juan.perez@carepoint.local' } },
    { action: 'APPOINTMENT_CONFIRMED', resource: 'Appointment', resourceId: 'seed-future-appt-2', details: { confirmedBy: 'Provider' } },
    { action: 'APPOINTMENT_CANCELLED', resource: 'Appointment', resourceId: 'seed-past-appt-8', details: { reason: 'Patient requested cancellation', cancelledBy: 'Patient' } },
    { action: 'CREDENTIAL_VERIFIED', resource: 'ProviderCredentialDocument', resourceId: `cred-doc-MED-GP-001`, details: { documentType: 'LICENSE', verifier: 'superadmin@carepoint.local' } },
    { action: 'CREDENTIAL_VERIFIED', resource: 'ProviderCredentialDocument', resourceId: `cred-doc-MED-CARD-002`, details: { documentType: 'LICENSE', verifier: 'superadmin@carepoint.local' } },
    { action: 'ONBOARDING_SUBMITTED', resource: 'ProviderOnboardingState', resourceId: providerRecords[5].profile.id, details: { providerName: 'Isabella Silva', status: 'READY_FOR_REVIEW' } },
    { action: 'ORGANIZATION_CREATED', resource: 'Organization', resourceId: org1.id, details: { name: 'CarePoint Medical Center' } },
    { action: 'ORGANIZATION_CREATED', resource: 'Organization', resourceId: org2.id, details: { name: 'HealthFirst Clinic' } },
    { action: 'LOGIN_SUCCESS', resource: 'Session', resourceId: null, details: { email: 'superadmin@carepoint.local', ip: '192.168.1.100' } },
    { action: 'LOGIN_SUCCESS', resource: 'Session', resourceId: null, details: { email: 'companyadmin@carepoint.local', ip: '192.168.1.101' } },
    { action: 'PASSWORD_RESET_REQUESTED', resource: 'User', resourceId: patientRecords[0].user.id, details: { email: 'juan.perez@carepoint.local' } },
    { action: 'PATIENT_PROFILE_UPDATED', resource: 'PatientProfile', resourceId: patientRecords[1].profile.id, details: { field: 'insuranceNumber', updatedBy: 'patient' } },
    { action: 'SCHEDULE_PUBLISHED', resource: 'ProviderScheduleTemplate', resourceId: `sched-tmpl-${providerRecords[0].profile.id}`, details: { providerName: 'Alejandro Ramírez', weeks: 3 } },
    { action: 'SLOT_BOOKED', resource: 'PublishedSlot', resourceId: null, details: { provider: 'dr.ramirez@carepoint.local', patient: 'juan.perez@carepoint.local' } },
    { action: 'PAYMENT_CAPTURED', resource: 'Payment', resourceId: null, details: { amount: 35000, currency: 'COP', gateway: 'stripe' } },
    { action: 'USER_SUSPENDED', resource: 'User', resourceId: null, details: { reason: 'Repeated no-shows', suspendedBy: 'companyadmin@carepoint.local' } },
    { action: 'TELEHEALTH_SESSION_STARTED', resource: 'TelehealthSession', resourceId: null, details: { vendor: 'daily', provider: 'dr.vega@carepoint.local' } },
    { action: 'INVITATION_SENT', resource: 'Invitation', resourceId: null, details: { invitedEmail: 'newprovider@external.com', role: 'PROVIDER' } },
    { action: 'CREDENTIAL_REJECTED', resource: 'ProviderCredentialDocument', resourceId: null, details: { reason: 'Expired document', providerEmail: 'dr.molina@carepoint.local' } },
    { action: 'REPORT_GENERATED', resource: 'ReportDefinition', resourceId: null, details: { reportType: 'Monthly Revenue', generatedBy: 'finance@carepoint.local' } },
  ];

  for (let i = 0; i < auditEntries.length; i++) {
    const entry = auditEntries[i];
    const auditId = `seed-audit-${i + 1}`;
    await prisma.auditLog.upsert({
      where: { id: auditId },
      update: {
        actorId: superAdmin.id,
        organizationId: org1.id,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        details: entry.details,
        createdAt: daysFromNow(-60 + (i * 2), 10 + (i % 8), i * 3),
      },
      create: {
        id: auditId,
        actorId: superAdmin.id,
        organizationId: org1.id,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        details: entry.details,
        createdAt: daysFromNow(-60 + (i * 2), 10 + (i % 8), i * 3),
      },
    });
  }
  console.log('  ✓ Audit log entries created');

  // ═══ Summary ═══════════════════════════════════════════════════════════════

  console.log('\n🎉 Seed completed successfully!');
  console.log('   Organizations: 2');
  console.log(`   Users: ${1 + roleUsers.length + providerSpecs.length + patientSpecs.length} (1 super admin + ${roleUsers.length} role users + ${providerSpecs.length} providers + ${patientSpecs.length} patients)`);
  console.log(`   Providers: ${providerSpecs.length} (with profiles, onboarding, credentials)`);
  console.log(`   Patients: ${patientSpecs.length}`);
  console.log('   Appointments: 90 (55 past + 35 future)');
  console.log(`   Audit entries: ${auditEntries.length}`);
  console.log(`   Published slots: ~${approvedProviders.length * 15 * 12} (3 weeks for ${approvedProviders.length} approved providers)`);
  console.log('\n   Login credentials:');
  console.log('   ─────────────────────────────────────────');
  console.log('   superadmin@carepoint.local  / ChangeMe123!  (SUPER_ADMIN)');
  console.log('   companyadmin@carepoint.local / ChangeMe123!  (COMPANY_ADMIN)');
  console.log('   All users share password: ChangeMe123!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
