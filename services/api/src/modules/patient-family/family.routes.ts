import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { badRequest } from '../../lib/http';
import { getPatientContext } from '../../lib/patient-context';
import { getPatientWorkspaceStorageMode, getPatientWorkspaceItem, listPatientWorkspaceItems, summarizePatientWorkspaceItems, upsertPatientWorkspaceItem } from '../../lib/patient-workspace-store';
import { canInviteFamilyProfile, hasVerifiedRelationshipEvidence, requiresRelationshipEvidence } from '../../lib/ksa-compliance';
import { decryptMedicalJson, encryptMedicalJson } from '../../lib/secure-medical-data';

export const patientFamilyRouter = Router();
const allowedRoles = ['PATIENT'];

const familyProfileSchema = z.object({
  id: z.string().trim().min(2).optional(),
  profileName: z.string().trim().min(2).max(120),
  relationship: z.string().trim().min(2).max(80),
  accessLevel: z.string().trim().min(2).max(80),
  permissions: z.array(z.string().trim().min(2).max(80)).default([]),
  dateOfBirth: z.string().trim().optional(),
  gender: z.enum(['Male', 'Female', 'Prefer not to say']).optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'INVITED', 'PENDING']).optional(),
  legalRelationshipType: z.string().trim().min(2).max(80).optional(),
  consentStatus: z.enum(['PENDING', 'ACCEPTED', 'REVOKED', 'VERIFIED']).optional(),
  evidenceStatus: z.enum(['REQUIRED', 'PENDING', 'VERIFIED', 'REJECTED']).optional(),
  evidenceFiles: z.array(z.object({
    fileName: z.string().trim().min(2).max(180),
    documentType: z.string().trim().min(2).max(80),
    uploadedAt: z.string().trim().min(4).optional(),
  })).default([]),
});

const evidenceSchema = z.object({
  documents: z.array(z.object({
    fileName: z.string().trim().min(2).max(180),
    documentType: z.string().trim().min(2).max(80),
    uploadedAt: z.string().trim().optional(),
  })).min(1),
  legalRelationshipType: z.string().trim().min(2).max(80),
  reviewerNote: z.string().trim().max(500).optional(),
  markVerified: z.boolean().default(false),
});

const reportSchema = z.object({
  id: z.string().trim().min(2).optional(),
  fileName: z.string().trim().min(2).max(180),
  category: z.string().trim().min(2).max(80),
  reportDate: z.string().trim().max(40).optional().or(z.literal('')),
  providerName: z.string().trim().max(120).optional().or(z.literal('')),
  facilityName: z.string().trim().max(120).optional().or(z.literal('')),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
  grantedToScheduledDoctors: z.boolean().default(false),
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

const medicalProfileSchema = z.object({
  questionnaire: questionnaireSchema.optional(),
  reports: z.array(reportSchema).default([]),
  shareMedicalDataWithAssignedDoctors: z.boolean().default(false),
});

function normalizeFamilyProfile(input: Record<string, any>) {
  const relationship = String(input.relationship ?? 'Self').trim();
  const evidenceRequired = requiresRelationshipEvidence(relationship);
  const evidenceFiles = Array.isArray(input.evidenceFiles) ? input.evidenceFiles : [];
  const evidenceStatus = input.evidenceStatus ?? (evidenceRequired ? (evidenceFiles.length ? 'PENDING' : 'REQUIRED') : 'VERIFIED');
  const consentStatus = input.consentStatus ?? (evidenceRequired ? 'PENDING' : 'VERIFIED');
  const requestedPermissions = Array.isArray(input.permissions) ? input.permissions.map((permission) => String(permission)) : [];
  const blockedPermissions = evidenceRequired && evidenceStatus !== 'VERIFIED'
    ? requestedPermissions.filter((permission) => String(permission).toUpperCase().includes('RECORD'))
    : [];
  const permissions = requestedPermissions.filter((permission) => !blockedPermissions.includes(permission));
  return {
    ...input,
    relationship,
    permissions,
    requestedPermissions,
    pendingPermissions: blockedPermissions,
    complianceWarnings: blockedPermissions.length
      ? ['Medical-record permissions stay disabled until legal relationship evidence is verified.']
      : [],
    legalRelationshipType: input.legalRelationshipType ?? (evidenceRequired ? relationship : 'SELF'),
    evidenceFiles,
    evidenceStatus,
    consentStatus,
  };
}

function getMedicalProfile(item: Record<string, any>) {
  const fallback = item.medicalProfile && typeof item.medicalProfile === 'object'
    ? item.medicalProfile
    : { questionnaire: {}, reports: [], shareMedicalDataWithAssignedDoctors: false };
  const decrypted = decryptMedicalJson<Record<string, any>>(item.medicalDataCipher, fallback);
  return {
    questionnaire: decrypted.questionnaire && typeof decrypted.questionnaire === 'object' ? decrypted.questionnaire : {},
    reports: Array.isArray(decrypted.reports) ? decrypted.reports.map((report: any) => ({
      id: String(report.id ?? randomUUID()),
      fileName: String(report.fileName ?? 'Report'),
      category: String(report.category ?? 'Medical report'),
      reportDate: report.reportDate ? String(report.reportDate) : '',
      providerName: report.providerName ? String(report.providerName) : '',
      facilityName: report.facilityName ? String(report.facilityName) : '',
      notes: report.notes ? String(report.notes) : '',
      grantedToScheduledDoctors: Boolean(report.grantedToScheduledDoctors ?? false),
      accessScope: Boolean(report.grantedToScheduledDoctors ?? false) ? 'SCHEDULED_DOCTORS_ONLY' : 'PRIVATE',
      uploadedAt: String(report.uploadedAt ?? new Date().toISOString()),
    })) : [],
    shareMedicalDataWithAssignedDoctors: Boolean(decrypted.shareMedicalDataWithAssignedDoctors ?? false),
    updatedAt: decrypted.updatedAt ?? null,
  };
}

patientFamilyRouter.use(requireAuth);
patientFamilyRouter.use(allowRoles(allowedRoles));

patientFamilyRouter.get('/summary', async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const summary = await summarizePatientWorkspaceItems('family_profile', context.organizationId, context.patientProfileId);
  const items = await listPatientWorkspaceItems('family_profile', context.organizationId, context.patientProfileId);
  res.json({
    summary: {
      ...summary,
      dependentCount: items.filter((item) => String(item.relationship).toLowerCase() !== 'self').length,
      activeCount: items.filter((item) => item.status === 'ACTIVE').length,
      verifiedRelationshipCount: items.filter((item) => hasVerifiedRelationshipEvidence(item)).length,
    },
    storageMode: getPatientWorkspaceStorageMode('family_profile'),
  });
});

patientFamilyRouter.get('/profiles', async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const items = await listPatientWorkspaceItems('family_profile', context.organizationId, context.patientProfileId);
  res.json({ items, storageMode: getPatientWorkspaceStorageMode('family_profile') });
});

patientFamilyRouter.get('/profiles/:profileId', async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const item = await getPatientWorkspaceItem('family_profile', req.params.profileId, context.organizationId, context.patientProfileId);
  res.json({ item, storageMode: getPatientWorkspaceStorageMode('family_profile') });
});

patientFamilyRouter.get('/profiles/:profileId/medical', async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const item = await getPatientWorkspaceItem('family_profile', req.params.profileId, context.organizationId, context.patientProfileId);
  res.json({
    subject: {
      kind: 'family',
      id: item.id,
      name: item.profileName ?? item.title ?? 'Family member',
      relationship: item.relationship ?? null,
    },
    medical: getMedicalProfile(item),
    encryption: {
      status: 'APPLICATION_ENCRYPTED',
      atRest: true,
      consentRequiredForProviderAccess: true,
    },
  });
});

patientFamilyRouter.put('/profiles/:profileId/medical', validateBody(medicalProfileSchema), async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const item = await getPatientWorkspaceItem('family_profile', req.params.profileId, context.organizationId, context.patientProfileId);
  const existingMedical = getMedicalProfile(item);
  const medical = {
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
  const updated = await upsertPatientWorkspaceItem('family_profile', {
    ...item,
    medicalProfileVersion: 1,
    medicalDataCipher: encryptMedicalJson(medical),
    medicalProfileSummary: {
      reportCount: medical.reports.length,
      questionnaireComplete: Object.values((req.body.questionnaire ?? existingMedical.questionnaire) ?? {}).filter(Boolean).length >= 3,
      updatedAt: medical.updatedAt,
    },
  }, {
    organizationId: context.organizationId,
    patientId: context.patientProfileId,
    actorId: req.user?.userId,
  });
  res.json({
    subject: {
      kind: 'family',
      id: updated.id,
      name: updated.profileName ?? updated.title ?? 'Family member',
      relationship: updated.relationship ?? null,
    },
    medical: getMedicalProfile(updated),
    encryption: { status: 'APPLICATION_ENCRYPTED', atRest: true, consentRequiredForProviderAccess: true },
    storageMode: getPatientWorkspaceStorageMode('family_profile'),
  });
});

patientFamilyRouter.post('/profiles', validateBody(familyProfileSchema), async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const normalized = normalizeFamilyProfile(req.body) as any;
  const item = await upsertPatientWorkspaceItem('family_profile', {
    ...normalized,
    medicalProfileSummary: normalized.medicalProfileSummary ?? null,
  }, {
    organizationId: context.organizationId,
    patientId: context.patientProfileId,
    actorId: req.user?.userId,
  });
  res.status(req.body.id ? 200 : 201).json({ item, storageMode: getPatientWorkspaceStorageMode('family_profile') });
});

patientFamilyRouter.post('/profiles/:profileId/evidence', validateBody(evidenceSchema), async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const item = await getPatientWorkspaceItem('family_profile', req.params.profileId, context.organizationId, context.patientProfileId);
  const updated = await upsertPatientWorkspaceItem('family_profile', {
    ...item,
    legalRelationshipType: req.body.legalRelationshipType,
    evidenceFiles: req.body.documents.map((document) => ({ ...document, uploadedAt: document.uploadedAt ?? new Date().toISOString() })),
    evidenceStatus: req.body.markVerified ? 'VERIFIED' : 'PENDING',
    consentStatus: req.body.markVerified ? 'VERIFIED' : item.consentStatus ?? 'PENDING',
    reviewerNote: req.body.reviewerNote ?? null,
    status: item.status ?? 'PENDING',
  }, {
    organizationId: context.organizationId,
    patientId: context.patientProfileId,
    actorId: req.user?.userId,
  });
  res.json({ item: updated, storageMode: getPatientWorkspaceStorageMode('family_profile') });
});

patientFamilyRouter.post('/profiles/:profileId/invite', async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const item = await getPatientWorkspaceItem('family_profile', req.params.profileId, context.organizationId, context.patientProfileId);
  if (!canInviteFamilyProfile(item)) {
    throw badRequest('Dependent invite requires verified legal relationship evidence and accepted consent state.');
  }
  const updated = await upsertPatientWorkspaceItem('family_profile', {
    ...item,
    status: 'INVITED',
    inviteSentAt: new Date().toISOString(),
  }, {
    organizationId: context.organizationId,
    patientId: context.patientProfileId,
    actorId: req.user?.userId,
  });
  res.json({ item: updated, storageMode: getPatientWorkspaceStorageMode('family_profile') });
});
