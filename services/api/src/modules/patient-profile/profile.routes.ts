import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' | 'PENDING' | string;
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { badRequest } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { getPatientContext, toIsoString } from '../../lib/patient-context';
import { writeAuditLog } from '../../lib/audit';
import { decryptMedicalJson, encryptMedicalJson } from '../../lib/secure-medical-data';

export const patientProfileRouter = Router();
const allowedRoles = ['PATIENT'];

const profileSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  dateOfBirth: z.string().trim().min(8).max(30),
  nationalId: z.string().trim().max(40).optional().or(z.literal('')),
  emergencyContact: z.string().trim().min(5).max(120),
  gender: z.enum(['Male', 'Female', 'Prefer not to say']),
  nationality: z.string().trim().max(80).optional().or(z.literal('')),
  countryRegion: z.string().trim().min(2).max(80),
});

const reportSchema = z.object({
  id: z.string().trim().min(2).optional(),
  fileName: z.string().trim().min(2).max(180),
  category: z.string().trim().min(2).max(80),
  reportDate: z.string().trim().max(40).optional().or(z.literal('')),
  providerName: z.string().trim().max(120).optional().or(z.literal('')),
  facilityName: z.string().trim().max(120).optional().or(z.literal('')),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
  grantedToScheduledDoctors: z.boolean().default(true),
});

const questionnaireSchema = z.object({
  bloodType: z.string().trim().max(20).optional().or(z.literal('')),
  allergies: z.string().trim().max(600).optional().or(z.literal('')),
  chronicConditions: z.string().trim().max(600).optional().or(z.literal('')),
  currentMedications: z.string().trim().max(600).optional().or(z.literal('')),
  pastSurgeries: z.string().trim().max(600).optional().or(z.literal('')),
  smokingStatus: z.enum(['Never', 'Former', 'Current', 'Prefer not to say']).optional().or(z.literal('')),
  pregnancyStatus: z.enum(['Not applicable', 'Pregnant', 'Planning', 'Prefer not to say']).optional().or(z.literal('')),
  heightCm: z.string().trim().max(20).optional().or(z.literal('')),
  weightKg: z.string().trim().max(20).optional().or(z.literal('')),
  emergencyNotes: z.string().trim().max(600).optional().or(z.literal('')),
});

const providerLinkedAppointmentStatuses: AppointmentStatus[] = ['REQUESTED', 'CONFIRMED', 'COMPLETED'];

const medicalProfileSchema = z.object({
  questionnaire: questionnaireSchema.optional(),
  reports: z.array(reportSchema).default([]),
  shareMedicalDataWithAssignedDoctors: z.boolean().default(true),
});

type MedicalReport = z.infer<typeof reportSchema> & {
  id: string;
  uploadedAt: string;
  accessScope: 'SCHEDULED_DOCTORS_ONLY' | 'PRIVATE';
};

type MedicalProfilePayload = {
  questionnaire: Record<string, unknown>;
  reports: MedicalReport[];
  shareMedicalDataWithAssignedDoctors: boolean;
  updatedAt?: string | null;
};

patientProfileRouter.use(requireAuth);
patientProfileRouter.use(allowRoles(allowedRoles));

function parseDate(input: string) {
  const trimmed = input.trim();
  const slashMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    const [, dd, mm, yyyy] = slashMatch;
    const date = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
    if (!Number.isNaN(date.getTime())) return date;
  }
  const fallback = new Date(trimmed);
  if (!Number.isNaN(fallback.getTime())) return fallback;
  throw badRequest('Date of birth must be a valid date.');
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

function getPreferences(profile: any) {
  return profile?.preferences && typeof profile.preferences === 'object' ? profile.preferences as Record<string, unknown> : {};
}

function getMedicalProfile(profile: any): MedicalProfilePayload {
  const preferences = getPreferences(profile);
  const fallback = preferences.medicalProfile && typeof preferences.medicalProfile === 'object'
    ? preferences.medicalProfile as MedicalProfilePayload
    : { questionnaire: {}, reports: [], shareMedicalDataWithAssignedDoctors: true };
  const decrypted = decryptMedicalJson<MedicalProfilePayload>(preferences.medicalDataCipher, fallback);
  const reports = Array.isArray(decrypted?.reports) ? decrypted.reports : [];
  return {
    questionnaire: decrypted?.questionnaire && typeof decrypted.questionnaire === 'object' ? decrypted.questionnaire : {},
    reports: reports.map((report: any) => ({
      id: String(report.id ?? randomUUID()),
      fileName: String(report.fileName ?? 'Report'),
      category: String(report.category ?? 'Medical report'),
      reportDate: report.reportDate ? String(report.reportDate) : '',
      providerName: report.providerName ? String(report.providerName) : '',
      facilityName: report.facilityName ? String(report.facilityName) : '',
      notes: report.notes ? String(report.notes) : '',
      grantedToScheduledDoctors: Boolean(report.grantedToScheduledDoctors ?? true),
      uploadedAt: String(report.uploadedAt ?? new Date().toISOString()),
      accessScope: Boolean(report.grantedToScheduledDoctors ?? true) ? 'SCHEDULED_DOCTORS_ONLY' : 'PRIVATE',
    })),
    shareMedicalDataWithAssignedDoctors: Boolean(decrypted?.shareMedicalDataWithAssignedDoctors ?? true),
    updatedAt: decrypted?.updatedAt ?? null,
  };
}

function normalizeProfile(user: any, profile: any) {
  const preferences = getPreferences(profile);
  const details = preferences.profile && typeof preferences.profile === 'object' ? preferences.profile as Record<string, unknown> : {};
  return {
    id: profile?.id,
    fullName: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
    dateOfBirth: toIsoString(profile?.dateOfBirth),
    nationalId: details.nationalId ?? '',
    emergencyContact: details.emergencyContact ?? '',
    gender: details.gender ?? '',
    nationality: details.nationality ?? '',
    countryRegion: details.countryRegion ?? 'Saudi Arabia',
    locale: preferences.locale ?? 'en',
  };
}

async function getScheduledProviders(patientId: string, organizationId?: string) {
  const appointments = await prisma.appointment.findMany({
    where: {
      patientId,
      organizationId,
      status: { in: providerLinkedAppointmentStatuses },
    },
    include: {
      provider: {
        include: { user: true },
      },
    },
    orderBy: { startsAt: 'desc' },
    take: 20,
  });

  const deduped = new Map<string, Record<string, unknown>>();
  for (const appointment of appointments) {
    if (!appointment.providerId || deduped.has(appointment.providerId)) continue;
    deduped.set(appointment.providerId, {
      providerId: appointment.providerId,
      providerName: `${appointment.provider.user.firstName ?? ''} ${appointment.provider.user.lastName ?? ''}`.trim() || appointment.service,
      specialty: appointment.provider.specialty ?? null,
      appointmentId: appointment.id,
      startsAt: appointment.startsAt.toISOString(),
      service: appointment.service,
      location: appointment.location,
    });
  }
  return Array.from(deduped.values());
}

patientProfileRouter.get('/', async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId);
  const user = await prisma.user.findUnique({
    where: { id: context.user.id },
    include: { patientProfile: true },
  });
  if (!user?.patientProfile) throw badRequest('Patient profile is required');
  res.json({ profile: normalizeProfile(user, user.patientProfile) });
});

patientProfileRouter.get('/medical', async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId);
  const profile = await prisma.patientProfile.findUnique({ where: { id: context.patientProfileId } });
  if (!profile) throw badRequest('Patient profile is required');
  const medical = getMedicalProfile(profile);
  const scheduledProviders = await getScheduledProviders(context.patientProfileId, context.organizationId);
  res.json({
    subject: {
      kind: 'self',
      id: context.patientProfileId,
      name: context.patientName,
    },
    medical,
    scheduledProviders,
    encryption: {
      status: 'APPLICATION_ENCRYPTED',
      atRest: true,
      consentRequiredForProviderAccess: true,
    },
  });
});

patientProfileRouter.put('/medical', validateBody(medicalProfileSchema), async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId);
  const profile = await prisma.patientProfile.findUnique({ where: { id: context.patientProfileId } });
  if (!profile) throw badRequest('Patient profile is required');

  const preferences = getPreferences(profile);
  const existingMedical = getMedicalProfile(profile);
  const medical: MedicalProfilePayload = {
    questionnaire: req.body.questionnaire ?? existingMedical.questionnaire,
    reports: req.body.reports.map((report) => ({
      ...report,
      id: report.id ?? randomUUID(),
      uploadedAt: new Date().toISOString(),
      accessScope: report.grantedToScheduledDoctors ? 'SCHEDULED_DOCTORS_ONLY' : 'PRIVATE',
    })),
    shareMedicalDataWithAssignedDoctors: req.body.shareMedicalDataWithAssignedDoctors,
    updatedAt: new Date().toISOString(),
  };

  await prisma.patientProfile.update({
    where: { id: context.patientProfileId },
    data: {
      preferences: {
        ...preferences,
        medicalDataCipher: encryptMedicalJson(medical),
        medicalProfileVersion: 1,
      } as any,
    },
  });

  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId: context.organizationId,
    action: 'patient.medical_profile_updated',
    resource: 'patient_medical_profile',
    resourceId: context.patientProfileId,
    details: {
      questionnaireFields: Object.keys((req.body.questionnaire ?? existingMedical.questionnaire) ?? {}),
      reportCount: medical.reports.length,
      shareMedicalDataWithAssignedDoctors: req.body.shareMedicalDataWithAssignedDoctors,
    },
  });

  const scheduledProviders = await getScheduledProviders(context.patientProfileId, context.organizationId);
  res.json({
    subject: { kind: 'self', id: context.patientProfileId, name: context.patientName },
    medical,
    scheduledProviders,
    encryption: { status: 'APPLICATION_ENCRYPTED', atRest: true, consentRequiredForProviderAccess: true },
  });
});

patientProfileRouter.put('/', validateBody(profileSchema), async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId);
  const profile = await prisma.patientProfile.findUnique({ where: { id: context.patientProfileId } });
  if (!profile) throw badRequest('Patient profile is required');

  const existingPreferences = getPreferences(profile);
  const existingProfile = existingPreferences.profile && typeof existingPreferences.profile === 'object'
    ? (existingPreferences.profile as Record<string, unknown>)
    : {};

  const nextProfile = {
    ...existingProfile,
    nationalId: req.body.nationalId || null,
    emergencyContact: req.body.emergencyContact,
    gender: req.body.gender,
    nationality: req.body.nationality || null,
    countryRegion: req.body.countryRegion,
  };

  const { firstName, lastName } = splitName(req.body.fullName);
  const updatedDateOfBirth = parseDate(req.body.dateOfBirth);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: context.user.id },
      data: { firstName, lastName },
    }),
    prisma.patientProfile.update({
      where: { id: context.patientProfileId },
      data: {
        dateOfBirth: updatedDateOfBirth,
        preferences: {
          ...existingPreferences,
          profile: nextProfile,
        } as any,
      },
    }),
  ]);

  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId: context.organizationId,
    action: 'patient.profile_updated',
    resource: 'patient_profile',
    resourceId: context.patientProfileId,
    details: {
      fullName: req.body.fullName,
      gender: req.body.gender,
      countryRegion: req.body.countryRegion,
    },
  });

  const refreshed = await prisma.user.findUnique({
    where: { id: context.user.id },
    include: { patientProfile: true },
  });

  res.json({ profile: normalizeProfile(refreshed, refreshed?.patientProfile) });
});
