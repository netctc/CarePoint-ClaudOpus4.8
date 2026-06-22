import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { badRequest, notFound } from '../../lib/http';
import { getPatientContext, getRequestedSubjectProfileId } from '../../lib/patient-context';
import { getPatientWorkspaceItem, getPatientWorkspaceStorageMode, listPatientWorkspaceItems, upsertPatientWorkspaceItem } from '../../lib/patient-workspace-store';
import { prisma } from '../../lib/prisma';
import { decryptMedicalJson } from '../../lib/secure-medical-data';

export const patientQuestionnairesRouter = Router();
const allowedRoles = ['PATIENT'];

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

const questionnaireVersionCreateSchema = z.object({
  questionnaire: questionnaireSchema.default({}),
  subjectProfileId: z.string().trim().min(2).optional(),
  subjectLabel: z.string().trim().min(2).max(120).optional(),
});

type MedicalProfilePayload = {
  questionnaire: Record<string, unknown>;
  reports: Array<Record<string, unknown>>;
  shareMedicalDataWithAssignedDoctors: boolean;
  updatedAt?: string | null;
};

patientQuestionnairesRouter.use(requireAuth);
patientQuestionnairesRouter.use(allowRoles(allowedRoles));

function buildCompletion(questionnaire: Record<string, unknown>) {
  const keys = [
    'bloodType',
    'allergies',
    'chronicConditions',
    'currentMedications',
    'pastSurgeries',
    'smokingStatus',
    'pregnancyStatus',
    'heightCm',
    'weightKg',
    'emergencyNotes',
  ];
  const completed = keys.filter((key) => String(questionnaire[key] ?? '').trim().length > 0).length;
  return {
    completedCount: completed,
    totalCount: keys.length,
    completionRatio: keys.length == 0 ? 0 : completed / keys.length,
  };
}

function buildSummary(questionnaire: Record<string, unknown>) {
  const lines = [
    questionnaire['bloodType'] ? `Blood type: ${questionnaire['bloodType']}` : null,
    questionnaire['allergies'] ? `Allergies: ${questionnaire['allergies']}` : null,
    questionnaire['currentMedications'] ? `Medications: ${questionnaire['currentMedications']}` : null,
    questionnaire['chronicConditions'] ? `Conditions: ${questionnaire['chronicConditions']}` : null,
  ].filter(Boolean);
  return lines.slice(0, 3).join(' • ');
}

function normalizeVersion(item: Record<string, any>) {
  const questionnaire = item.questionnaire && typeof item.questionnaire === 'object' ? item.questionnaire : {};
  return {
    ...item,
    questionnaire,
    summary: item.summary ?? buildSummary(questionnaire),
    completion: item.completion ?? buildCompletion(questionnaire),
  };
}

async function listVersions(organizationId: string, subjectProfileId: string) {
  const items = await listPatientWorkspaceItems('patient_questionnaire_version', organizationId, subjectProfileId);
  return items
    .map((item) => normalizeVersion(item))
    .sort((a, b) => {
      const first = Number(a.versionNumber ?? 0);
      const second = Number(b.versionNumber ?? 0);
      if (first != second) return second - first;
      return String(b.submittedAt ?? b.updatedAt).localeCompare(String(a.submittedAt ?? a.updatedAt));
    });
}

async function readCurrentQuestionnaire(context: Awaited<ReturnType<typeof getPatientContext>>) {
  if (!context.organizationId) throw badRequest('Organization scope is required');
  if (context.isFamilySubject) {
    const item = await getPatientWorkspaceItem('family_profile', context.subjectProfileId, context.organizationId, context.patientProfileId);
    const fallback = item.medicalProfile && typeof item.medicalProfile === 'object'
      ? item.medicalProfile as MedicalProfilePayload
      : { questionnaire: {}, reports: [], shareMedicalDataWithAssignedDoctors: false };
    const decrypted = decryptMedicalJson<MedicalProfilePayload>(item.medicalDataCipher, fallback);
    return {
      questionnaire: decrypted.questionnaire && typeof decrypted.questionnaire === 'object' ? decrypted.questionnaire as Record<string, unknown> : {},
      source: item,
      shareMedicalDataWithAssignedDoctors: Boolean(decrypted.shareMedicalDataWithAssignedDoctors ?? false),
      reports: Array.isArray(decrypted.reports) ? decrypted.reports : [],
    };
  }

  const profile = await prisma.patientProfile.findUnique({ where: { id: context.patientProfileId } });
  if (!profile) throw badRequest('Patient profile is required');
  const preferences = profile.preferences && typeof profile.preferences === 'object' ? profile.preferences as Record<string, any> : {};
  const fallback = preferences.medicalProfile && typeof preferences.medicalProfile === 'object'
    ? preferences.medicalProfile as MedicalProfilePayload
    : { questionnaire: {}, reports: [], shareMedicalDataWithAssignedDoctors: true };
  const decrypted = decryptMedicalJson<MedicalProfilePayload>(preferences.medicalDataCipher, fallback);
  return {
    questionnaire: decrypted.questionnaire && typeof decrypted.questionnaire === 'object' ? decrypted.questionnaire as Record<string, unknown> : {},
    source: profile,
    shareMedicalDataWithAssignedDoctors: Boolean(decrypted.shareMedicalDataWithAssignedDoctors ?? true),
    reports: Array.isArray(decrypted.reports) ? decrypted.reports : [],
  };
}

async function buildLegacyVersion(context: Awaited<ReturnType<typeof getPatientContext>>) {
  const current = await readCurrentQuestionnaire(context);
  const questionnaire = current.questionnaire;
  const completion = buildCompletion(questionnaire);
  if (completion.completedCount == 0) return null;
  return normalizeVersion({
    id: 'legacy-current',
    versionNumber: 1,
    title: 'Questionnaire v1',
    subjectProfileId: context.subjectProfileId,
    subjectLabel: context.subjectName,
    subjectRelationship: context.subjectRelationship,
    submittedAt: new Date(0).toISOString(),
    createdAt: new Date(0),
    updatedAt: new Date(0),
    status: 'ACTIVE',
    questionnaire,
    source: 'legacy_medical_profile',
  });
}

patientQuestionnairesRouter.get('/latest', async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId, getRequestedSubjectProfileId(req));
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const versions = await listVersions(context.organizationId, context.subjectProfileId);
  const latest = versions[0] ?? await buildLegacyVersion(context);
  res.json({
    item: latest,
    count: versions.length,
    storageMode: getPatientWorkspaceStorageMode('patient_questionnaire_version'),
  });
});

patientQuestionnairesRouter.get('/history', async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId, getRequestedSubjectProfileId(req));
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const versions = await listVersions(context.organizationId, context.subjectProfileId);
  const legacy = versions.length == 0 ? await buildLegacyVersion(context) : null;
  res.json({
    items: legacy ? [legacy] : versions,
    count: legacy ? 1 : versions.length,
    storageMode: getPatientWorkspaceStorageMode('patient_questionnaire_version'),
  });
});

patientQuestionnairesRouter.get('/:versionId', async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId, getRequestedSubjectProfileId(req));
  if (!context.organizationId) throw badRequest('Organization scope is required');
  if (req.params.versionId === 'legacy-current') {
    const legacy = await buildLegacyVersion(context);
    if (!legacy) throw notFound('Questionnaire version not found');
    return res.json({ item: legacy, storageMode: getPatientWorkspaceStorageMode('patient_questionnaire_version') });
  }
  const item = await getPatientWorkspaceItem('patient_questionnaire_version', req.params.versionId, context.organizationId, context.subjectProfileId);
  res.json({ item: normalizeVersion(item), storageMode: getPatientWorkspaceStorageMode('patient_questionnaire_version') });
});

patientQuestionnairesRouter.post('/versions', validateBody(questionnaireVersionCreateSchema), async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId, getRequestedSubjectProfileId(req));
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const questionnaire = req.body.questionnaire as Record<string, unknown>;
  const versions = await listVersions(context.organizationId, context.subjectProfileId);
  const versionNumber = Math.max(0, ...versions.map((item) => Number(item.versionNumber ?? 0))) + 1;
  const submittedAt = new Date().toISOString();
  const completion = buildCompletion(questionnaire);
  const item = await upsertPatientWorkspaceItem('patient_questionnaire_version', {
    id: randomUUID(),
    title: `Questionnaire v${versionNumber}`,
    versionNumber,
    submittedAt,
    questionnaire,
    subjectProfileId: context.subjectProfileId,
    subjectLabel: context.subjectName,
    subjectRelationship: context.subjectRelationship,
    summary: buildSummary(questionnaire),
    completion,
    status: 'SUBMITTED',
  }, {
    organizationId: context.organizationId,
    patientId: context.subjectProfileId,
    actorId: req.user?.userId,
  });
  res.status(201).json({ item: normalizeVersion(item), storageMode: getPatientWorkspaceStorageMode('patient_questionnaire_version') });
});
