import { randomUUID } from 'crypto';
import { badRequest } from './http';
import { prisma } from './prisma';
import { decryptMedicalJson, encryptMedicalJson } from './secure-medical-data';
import { getPatientWorkspaceItem, upsertPatientWorkspaceItem } from './patient-workspace-store';

export type ResolvedProviderSubject = {
  patientProfileId: string;
  patientName: string;
  subjectProfileId: string | null;
  subjectLabel: string | null;
  subjectRelationship: string | null;
  isFamilySubject: boolean;
};

type FamilyMedicalProfile = {
  questionnaire: Record<string, any>;
  reports: any[];
  providerPrescriptions: any[];
  providerOrders: any[];
  shareMedicalDataWithAssignedDoctors: boolean;
  updatedAt: string | null;
};

function normalizeFamilyMedicalProfile(item: Record<string, any>): FamilyMedicalProfile {
  const fallback = item.medicalProfile && typeof item.medicalProfile === 'object'
    ? item.medicalProfile
    : { questionnaire: {}, reports: [], providerPrescriptions: [], providerOrders: [], shareMedicalDataWithAssignedDoctors: false };
  const medical = decryptMedicalJson<Record<string, any>>(item.medicalDataCipher, fallback);
  return {
    questionnaire: medical?.questionnaire && typeof medical.questionnaire === 'object' ? medical.questionnaire : {},
    reports: Array.isArray(medical?.reports) ? medical.reports : [],
    providerPrescriptions: Array.isArray(medical?.providerPrescriptions) ? medical.providerPrescriptions : [],
    providerOrders: Array.isArray(medical?.providerOrders) ? medical.providerOrders : [],
    shareMedicalDataWithAssignedDoctors: Boolean(medical?.shareMedicalDataWithAssignedDoctors ?? false),
    updatedAt: medical?.updatedAt ?? null,
  };
}

async function getValidPatientProfileId(patientId: string | null | undefined, organizationId: string) {
  const normalized = String(patientId ?? '').trim();
  if (!normalized) return null;
  const profile = await prisma.patientProfile.findFirst({ where: { id: normalized, organizationId }, include: { user: true } });
  return profile ?? null;
}

async function getFamilyProfile(organizationId: string, patientId: string, subjectProfileId: string) {
  return getPatientWorkspaceItem('family_profile', subjectProfileId, organizationId, patientId);
}

export async function resolveProviderSubjectContext(params: {
  organizationId: string;
  patientId: string;
  subjectProfileId?: string | null;
  subjectLabel?: string | null;
  subjectRelationship?: string | null;
}) : Promise<ResolvedProviderSubject> {
  const patientProfile = await getValidPatientProfileId(params.patientId, params.organizationId);
  if (!patientProfile) throw badRequest('Select a valid patient profile before saving provider clinical work.');
  const patientName = `${patientProfile.user.firstName} ${patientProfile.user.lastName}`.trim() || patientProfile.user.email;
  const normalizedSubjectProfileId = String(params.subjectProfileId ?? '').trim() || null;
  if (!normalizedSubjectProfileId || normalizedSubjectProfileId === patientProfile.id) {
    return {
      patientProfileId: patientProfile.id,
      patientName,
      subjectProfileId: null,
      subjectLabel: null,
      subjectRelationship: 'Self',
      isFamilySubject: false,
    };
  }
  const familyProfile = await getFamilyProfile(params.organizationId, patientProfile.id, normalizedSubjectProfileId);
  return {
    patientProfileId: patientProfile.id,
    patientName,
    subjectProfileId: familyProfile.id,
    subjectLabel: String(params.subjectLabel ?? familyProfile.profileName ?? familyProfile.title ?? 'Family member').trim(),
    subjectRelationship: String(params.subjectRelationship ?? familyProfile.relationship ?? '').trim() || null,
    isFamilySubject: true,
  };
}

async function saveFamilyMedicalProfile(params: {
  organizationId: string;
  patientId: string;
  subjectProfileId: string;
  actorId?: string;
  mutate: (medical: FamilyMedicalProfile, familyProfile: Record<string, any>) => FamilyMedicalProfile;
}) {
  const familyProfile = await getFamilyProfile(params.organizationId, params.patientId, params.subjectProfileId);
  const medical = params.mutate(normalizeFamilyMedicalProfile(familyProfile), familyProfile);
  const updatedAt = new Date().toISOString();
  const payload = {
    ...medical,
    updatedAt,
  };
  return upsertPatientWorkspaceItem('family_profile', {
    ...familyProfile,
    medicalProfileVersion: 1,
    medicalDataCipher: encryptMedicalJson(payload),
    medicalProfileSummary: {
      reportCount: Array.isArray(payload.reports) ? payload.reports.length : 0,
      questionnaireComplete: Object.values(payload.questionnaire ?? {}).filter(Boolean).length >= 3,
      prescriptionCount: Array.isArray(payload.providerPrescriptions) ? payload.providerPrescriptions.length : 0,
      orderCount: Array.isArray(payload.providerOrders) ? payload.providerOrders.length : 0,
      updatedAt,
    },
  }, {
    organizationId: params.organizationId,
    patientId: params.patientId,
    actorId: params.actorId,
  });
}

export async function appendFamilyLabRelease(params: {
  organizationId: string;
  patientId: string;
  subjectProfileId: string;
  actorId?: string;
  labItem: Record<string, any>;
}) {
  return saveFamilyMedicalProfile({
    organizationId: params.organizationId,
    patientId: params.patientId,
    subjectProfileId: params.subjectProfileId,
    actorId: params.actorId,
    mutate: (medical) => {
      const nextReports = Array.isArray(medical.reports) ? [...medical.reports] : [];
      const reportId = String(params.labItem.id ?? randomUUID());
      const report = {
        id: reportId,
        fileName: `${String(params.labItem.testName ?? 'Lab result')} – clinician release`,
        category: 'Lab result',
        reportDate: params.labItem.verifiedAt ?? params.labItem.requestedAt ?? new Date().toISOString(),
        providerName: params.labItem.releasedByName ?? params.labItem.providerName ?? null,
        facilityName: params.labItem.location ?? null,
        notes: Array.isArray(params.labItem.comments) ? params.labItem.comments.join(' | ') : (params.labItem.note ?? null),
        grantedToScheduledDoctors: true,
        accessScope: 'SCHEDULED_DOCTORS_ONLY',
        uploadedAt: new Date().toISOString(),
        source: 'PROVIDER_RELEASE',
        recordType: 'LAB_RESULT',
        values: Array.isArray(params.labItem.values) ? params.labItem.values : [],
        secondReviewStatus: params.labItem.secondReviewStatus ?? 'NOT_REQUIRED',
        releasedByProvider: true,
      };
      const existingIndex = nextReports.findIndex((item) => String(item.id ?? '') === reportId);
      if (existingIndex >= 0) nextReports[existingIndex] = report;
      else nextReports.unshift(report);
      return { ...medical, reports: nextReports };
    },
  });
}

export async function upsertFamilyPrescriptionRelease(params: {
  organizationId: string;
  patientId: string;
  subjectProfileId: string;
  actorId?: string;
  prescriptionItem: Record<string, any>;
}) {
  return saveFamilyMedicalProfile({
    organizationId: params.organizationId,
    patientId: params.patientId,
    subjectProfileId: params.subjectProfileId,
    actorId: params.actorId,
    mutate: (medical) => {
      const nextItems = Array.isArray(medical.providerPrescriptions) ? [...medical.providerPrescriptions] : [];
      const itemId = String(params.prescriptionItem.id ?? randomUUID());
      const next = {
        id: itemId,
        prescriptionId: itemId,
        title: `${String(params.prescriptionItem.drug ?? 'Prescription')}`,
        drug: params.prescriptionItem.drug ?? 'Prescription',
        dosage: params.prescriptionItem.dosage ?? '',
        frequency: params.prescriptionItem.frequency ?? '',
        duration: params.prescriptionItem.duration ?? '',
        status: 'ACTIVE',
        fulfillmentStatus: params.prescriptionItem.fulfillmentStatus ?? 'AWAITING_REVIEW',
        pharmacyRoutingState: params.prescriptionItem.pharmacyRoutingState ?? 'MANUAL_REVIEW',
        refillEligible: Boolean(params.prescriptionItem.refillEligible ?? false),
        refillMaxCount: Number(params.prescriptionItem.refillMaxCount ?? 0),
        controlledMedication: Boolean(params.prescriptionItem.controlledMedication ?? false),
        pharmacyName: params.prescriptionItem.pharmacyName ?? null,
        note: params.prescriptionItem.note ?? null,
        providerName: params.prescriptionItem.signedByName ?? params.prescriptionItem.providerName ?? null,
        patientVisible: true,
        releasedAt: new Date().toISOString(),
        recordType: 'PRESCRIPTION',
        source: 'PROVIDER_RELEASE',
      };
      const existingIndex = nextItems.findIndex((item) => String(item.id ?? item.prescriptionId ?? '') === itemId);
      if (existingIndex >= 0) nextItems[existingIndex] = next;
      else nextItems.unshift(next);
      return { ...medical, providerPrescriptions: nextItems };
    },
  });
}

export async function upsertFamilyClinicalOrder(params: {
  organizationId: string;
  patientId: string;
  subjectProfileId: string;
  actorId?: string;
  orderItem: Record<string, any>;
}) {
  return saveFamilyMedicalProfile({
    organizationId: params.organizationId,
    patientId: params.patientId,
    subjectProfileId: params.subjectProfileId,
    actorId: params.actorId,
    mutate: (medical) => {
      const nextItems = Array.isArray(medical.providerOrders) ? [...medical.providerOrders] : [];
      const itemId = String(params.orderItem.id ?? randomUUID());
      const next = {
        id: itemId,
        orderId: itemId,
        title: params.orderItem.title ?? params.orderItem.reason ?? 'Clinical order',
        reason: params.orderItem.reason ?? null,
        note: params.orderItem.note ?? null,
        orderGroups: Array.isArray(params.orderItem.orderGroups) ? params.orderItem.orderGroups : [],
        commonSelections: Array.isArray(params.orderItem.commonSelections) ? params.orderItem.commonSelections : [],
        submittedAt: new Date().toISOString(),
        patientVisible: true,
        recordType: 'CLINICAL_ORDER',
        source: 'PROVIDER_ORDER',
      };
      const existingIndex = nextItems.findIndex((item) => String(item.id ?? item.orderId ?? '') === itemId);
      if (existingIndex >= 0) nextItems[existingIndex] = next;
      else nextItems.unshift(next);
      return { ...medical, providerOrders: nextItems };
    },
  });
}
