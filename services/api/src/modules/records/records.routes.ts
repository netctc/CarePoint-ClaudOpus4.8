import { Router } from 'express';
import { z } from 'zod';
type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' | 'PENDING' | string;
import { medicalRecordCreateSchema } from '@care-center/contracts';
import { allowRoles } from '../../middleware/rbac';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { badRequest, forbidden, notFound } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { writeAuditLog } from '../../lib/audit';
import { isPatientVisibleRecord, sanitizePatientRecord } from '../../lib/ksa-compliance';
import { getActiveChartAccessException, grantChartAccessException, listChartAccessExceptions, revokeChartAccessException } from '../../lib/chart-access-store';
import { createRefillRequest, getRefillAgingBand, getRefillOwnershipHistory, getRefillRequestHistory, listRefillOperationalEvents, listRefillRequests, summarizeRefillRequests } from '../../lib/refill-request-store';
import { createRefillStatusNotification } from '../../lib/refill-notifications';
import { buildRefillAuditPacket } from '../../lib/refill-audit-packet';
import { createRefillAuditScope, getRefillAuditScope, listRefillAuditScopes } from '../../lib/refill-audit-scope-store';
import { listFailedReportDeliveryExecutions } from '../../lib/report-delivery-store';
import { decryptMedicalJson } from '../../lib/secure-medical-data';
import { listPatientConsentItems } from '../../lib/patient-consent-store';
import { getPatientContext, getRequestedSubjectProfileId } from '../../lib/patient-context';
import { getProviderContext } from '../../lib/provider-context';
import { isLocationWithinHspAccess } from '../../lib/hsp-access';
import { listAppointmentSubjectMeta } from '../../lib/appointment-subject-store';
import { getPatientWorkspaceItem } from '../../lib/patient-workspace-store';


const providerLinkedAppointmentStatuses: AppointmentStatus[] = ['REQUESTED', 'CONFIRMED', 'COMPLETED'];

export const recordsRouter = Router();
recordsRouter.use(requireAuth);

const encounterNoteSchema = z.object({
  patientId: z.string().trim().min(2),
  appointmentId: z.string().trim().min(2).optional().nullable(),
  providerId: z.string().trim().min(2).optional().nullable(),
  subjective: z.string().trim().default(''),
  objective: z.string().trim().default(''),
  assessment: z.string().trim().default(''),
  plan: z.string().trim().default(''),
  diagnosisCode: z.string().trim().default(''),
  signatureAttested: z.boolean().optional().default(false),
});

const chartAccessExceptionSchema = z.object({
  patientId: z.string().trim().min(2),
  providerId: z.string().trim().min(2),
  reasonCode: z.enum(['CROSS_COVERAGE', 'ON_CALL', 'ESCALATED_REVIEW', 'LAB_RELEASE_BACKUP', 'MEDICATION_RECONCILIATION', 'TEMPORARY_TEAM_ASSIGNMENT']),
  note: z.string().trim().max(600).optional(),
  expiresAt: z.string().trim().optional(),
});

const revokeChartAccessSchema = z.object({
  note: z.string().trim().max(600).optional(),
});

const refillRequestSchema = z.object({
  note: z.string().trim().max(600).optional(),
});


const refillAuditScopeSchema = z.object({
  title: z.string().trim().min(4).max(120),
  note: z.string().trim().max(400).optional(),
  limit: z.number().int().min(1).max(250).optional(),
  queue: z.string().trim().max(120).optional(),
  assignedRole: z.enum(['PROVIDER', 'PHARMACIST', 'NURSE']).optional(),
  controlledOnly: z.boolean().optional(),
  escalatedOnly: z.boolean().optional(),
  includeExecutions: z.boolean().optional(),
  includeOperationalEvents: z.boolean().optional(),
});

type EncounterNotePayload = z.infer<typeof encounterNoteSchema>;

type ChartAccessDecision = {
  allowed: boolean;
  path: 'ASSIGNED_PROVIDER' | 'CARE_TEAM_EXCEPTION' | 'DENIED';
  providerId: string;
  appointmentCount: number;
  authoredCount: number;
  exception: Awaited<ReturnType<typeof getActiveChartAccessException>>;
};

async function getPatientProfileId(userId: string) {
  const profile = await prisma.patientProfile.findUnique({ where: { userId }, select: { id: true } });
  return profile?.id;
}
async function getProviderProfileId(userId: string) {
  const profile = await prisma.providerProfile.findUnique({ where: { userId }, select: { id: true } });
  return profile?.id;
}

async function getProviderChartCounts(providerId: string, patientId: string, organizationId?: string, hspAccess?: any) {
  const [appointments, authoredCount] = await Promise.all([
    prisma.appointment.findMany({ where: { organizationId, providerId, patientId }, select: { location: true } }),
    prisma.medicalRecord.count({ where: { patientId, providerId } }),
  ]);
  const appointmentCount = appointments.filter((item) => isLocationWithinHspAccess(hspAccess, item.location)).length;
  return { appointmentCount, authoredCount };
}

async function getChartAccessDecision(userId: string, patientId: string, organizationId?: string): Promise<ChartAccessDecision> {
  const context = await getProviderContext(userId, organizationId);
  const providerId = context.providerProfileId;
  if (!providerId) throw forbidden('Provider profile is required to access the chart.');
  const { appointmentCount, authoredCount } = await getProviderChartCounts(providerId, patientId, context.organizationId, context.hspAccess);
  if (appointmentCount > 0 || authoredCount > 0) {
    return { allowed: true, path: 'ASSIGNED_PROVIDER', providerId, appointmentCount, authoredCount, exception: null };
  }
  const exception = await getActiveChartAccessException(providerId, patientId, organizationId);
  if (exception) {
    return { allowed: true, path: 'CARE_TEAM_EXCEPTION', providerId, appointmentCount, authoredCount, exception };
  }
  return { allowed: false, path: 'DENIED', providerId, appointmentCount, authoredCount, exception: null };
}

async function enforceProviderChartAccess(userId: string, patientId: string, organizationId?: string) {
  const decision = await getChartAccessDecision(userId, patientId, organizationId);
  if (!decision.allowed) {
    await writeAuditLog({ actorId: userId, organizationId, action: 'chart.access_denied', resource: 'patient_chart', resourceId: patientId, details: { providerId: decision.providerId, patientId, appointmentCount: decision.appointmentCount, authoredCount: decision.authoredCount } });
    throw forbidden('This patient chart is outside the assigned-provider scope. A care-team exception is required before access can be granted.');
  }
  await writeAuditLog({ actorId: userId, organizationId, action: 'chart.access_granted', resource: 'patient_chart', resourceId: patientId, details: { providerId: decision.providerId, patientId, accessPath: decision.path, chartAccessExceptionId: decision.exception?.id ?? null, reasonCode: decision.exception?.reasonCode ?? null } });
  return decision;
}

function toRecordPayload(item: any) {
  return {
    id: item.id,
    patientId: item.patientId,
    appointmentId: item.appointmentId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    patientName: item.patient ? `${item.patient.user.firstName} ${item.patient.user.lastName}`.trim() : null,
    providerName: item.appointment?.provider ? `${item.appointment.provider.user.firstName} ${item.appointment.provider.user.lastName}`.trim() : null,
    summary: item.summary,
    content: item.content,
  };
}

function validateEncounterNote(payload: EncounterNotePayload, mode: 'validate' | 'sign') {
  const issues: string[] = [];
  const warnings: string[] = [];
  const trimmed = {
    subjective: payload.subjective.trim(),
    objective: payload.objective.trim(),
    assessment: payload.assessment.trim(),
    plan: payload.plan.trim(),
    diagnosisCode: payload.diagnosisCode.trim().toUpperCase(),
  };

  if (!trimmed.subjective) issues.push('Subjective notes are required.');
  if (!trimmed.objective) issues.push('Objective findings are required.');
  if (!trimmed.assessment) issues.push('Assessment notes are required.');
  if (!trimmed.plan) issues.push('Plan notes are required.');

  if (trimmed.subjective && trimmed.subjective.length < 12) warnings.push('Subjective note is very short for a production-signable encounter.');
  if (trimmed.plan && trimmed.plan.length < 12) warnings.push('Plan note is very short; include follow-up actions and medication guidance when applicable.');

  if (!trimmed.diagnosisCode) {
    issues.push('Diagnosis code is required before signing the encounter note.');
  } else if (!/^[A-Z][0-9][0-9A-Z](\.[0-9A-Z]{1,4})?$/i.test(trimmed.diagnosisCode)) {
    warnings.push('Diagnosis code does not match the expected ICD-style format.');
  }

  if (mode === 'sign' && !payload.signatureAttested) {
    issues.push('Provider signature attestation is required before signing.');
  }

  return {
    ready: issues.length === 0,
    issues,
    warnings,
    diagnosisCode: trimmed.diagnosisCode,
    recommendedTitle: mode === 'sign' ? 'Signed encounter note' : 'Encounter note draft',
    sectionsCompleted: ['subjective', 'objective', 'assessment', 'plan'].filter((key) => Boolean((trimmed as Record<string, string>)[key])).length,
  };
}

function extractRecordType(item: any) {
  return String(item?.content?.recordType ?? item?.summary?.recordType ?? item?.summary?.type ?? '').toUpperCase();
}

function isLabRecord(item: any) {
  return extractRecordType(item) === 'LAB_RESULT';
}

function isPrescriptionRecord(item: any) {
  return extractRecordType(item) === 'PRESCRIPTION';
}

function toPatientLabItem(item: any) {
  const summary = item.summary ?? {};
  const content = item.content ?? {};
  const values = Array.isArray(content.values) ? content.values : [];
  const flaggedCount = values.filter((entry: any) => ['HIGH', 'LOW', 'ABNORMAL', 'CRITICAL'].includes(String(entry?.flag ?? '').toUpperCase())).length;
  return {
    id: item.id,
    labResultId: summary.resultId ?? item.id,
    title: content.testName ?? summary.title ?? 'Lab result',
    testName: content.testName ?? summary.title ?? 'Lab result',
    collectedAt: content.collectedAt ?? item.createdAt,
    verifiedAt: content.verifiedAt ?? null,
    releasedAt: content.releasedAt ?? item.createdAt,
    status: content.releasedToPatient ? 'RELEASED' : 'PENDING_PORTAL_RELEASE',
    patientVisible: Boolean(content.patientVisible ?? content.releasedToPatient),
    secondReviewStatus: content.secondReviewStatus ?? summary.secondReviewStatus ?? 'NOT_REQUIRED',
    flaggedCount,
    providerName: item.providerName,
    values,
    comments: Array.isArray(content.comments) ? content.comments : [],
    guidance: flaggedCount > 0 ? 'One or more values were marked for follow-up review.' : 'Released to your portal after clinician verification.',
    trendPoints: Array.isArray(content.trendPoints) ? content.trendPoints : [],
    history: Array.isArray(content.history) ? content.history : [],
  };
}

function toPatientPrescriptionItem(item: any) {
  const summary = item.summary ?? {};
  const content = item.content ?? {};
  const refillPolicy = typeof content.refillPolicy === 'object' && content.refillPolicy ? content.refillPolicy : {
    refillEligible: Boolean(content.refillEligible),
    refillMaxCount: Number(content.refillMaxCount ?? 0),
    refillWindowDays: content.controlledMedication ? 0 : 30,
    nextEligibleAt: null,
  };
  return {
    id: item.id,
    prescriptionId: summary.prescriptionId ?? item.id,
    title: content.drug ?? summary.title ?? 'Prescription',
    status: content.prescriptionStatus ?? (content.releasedToPatient ? 'ACTIVE' : 'PENDING_PORTAL_RELEASE'),
    dosage: content.dosage ?? null,
    frequency: content.frequency ?? null,
    duration: content.duration ?? null,
    note: content.note ?? null,
    pharmacyName: content.pharmacyName ?? null,
    controlledMedication: Boolean(content.controlledMedication),
    controlledPolicyApproved: Boolean(content.controlledPolicyApproved ?? true),
    refillEligible: Boolean(refillPolicy.refillEligible ?? content.refillEligible),
    refillMaxCount: Number(refillPolicy.refillMaxCount ?? content.refillMaxCount ?? 0),
    refillPolicy,
    pharmacyRoutingState: content.pharmacyRoutingState ?? (content.controlledMedication ? 'PROVIDER_REVIEW' : content.pharmacyName ? 'PHARMACY_NETWORK' : 'MANUAL_REVIEW'),
    fulfillmentStatus: content.fulfillmentStatus ?? (content.pharmacyRoutingState === 'PHARMACY_NETWORK' ? 'READY_FOR_FULFILLMENT' : 'AWAITING_REVIEW'),
    fulfillmentTimeline: Array.isArray(content.fulfillmentTimeline) ? content.fulfillmentTimeline : [],
    releasedAt: content.releasedAt ?? item.createdAt,
    patientVisible: Boolean(content.patientVisible ?? content.releasedToPatient),
    providerName: item.providerName,
    refillRequests: Array.isArray(content.refillRequests) ? content.refillRequests : [],
  };
}

function buildPrescriptionRefillView(entry: any, requests: any[]) {
  const refillRequests = requests.filter((request) => request.prescriptionId === entry.prescriptionId);
  const timeline = [
    ...(Array.isArray(entry.fulfillmentTimeline) ? entry.fulfillmentTimeline : []),
    ...refillRequests.flatMap((request) => Array.isArray(request.timeline) ? request.timeline : [{ at: request.updatedAt ?? request.createdAt ?? null, label: `Refill ${String(request.status ?? 'PENDING').replaceAll('_', ' ').toLowerCase()}`, status: request.status ?? 'PENDING', note: request.decisionNote ?? request.note ?? null }]),
  ].filter(Boolean).sort((a: any, b: any) => String(b.at ?? '').localeCompare(String(a.at ?? '')));
  const latestRequest = refillRequests[0] ?? null;
  const ownershipHistory = refillRequests
    .flatMap((request) => getRefillOwnershipHistory(request).map((event) => ({
      ...event,
      requestId: request.id,
      status: request.status ?? null,
      fulfillmentStatus: request.fulfillmentStatus ?? null,
      assignedRole: request.assignedRole ?? null,
      prescriptionId: request.prescriptionId ?? entry.prescriptionId,
    })))
    .sort((a: any, b: any) => String(b.at ?? '').localeCompare(String(a.at ?? '')));
  const governanceFlags = {
    controlledMedication: Boolean(entry.controlledMedication),
    escalatedRefill: Boolean(latestRequest?.escalated),
    ownershipUpdates: ownershipHistory.length,
    exportReady: ownershipHistory.some((event: any) => ['ESCALATION', 'REVIEW'].includes(String(event.type ?? '').toUpperCase())) || Boolean(entry.controlledMedication),
  };
  const governanceNotes = [
    governanceFlags.controlledMedication ? 'Controlled-medication refill activity remains governed and requires provider review before fulfillment.' : null,
    governanceFlags.escalatedRefill ? 'The latest refill request is escalated and may appear in governed audit packet exports.' : null,
    governanceFlags.ownershipUpdates > 0 ? `${governanceFlags.ownershipUpdates} ownership or escalation update(s) are recorded in the live refill history.` : null,
    governanceFlags.exportReady ? 'This prescription has refill workflow history that is eligible for governed operational export review.' : null,
  ].filter(Boolean);
  const governanceSummary = {
    latestOwnershipLabel: ownershipHistory[0]?.label ?? null,
    escalationCount: ownershipHistory.filter((event: any) => String(event.type ?? '').toUpperCase() === 'ESCALATION').length,
    reviewCount: ownershipHistory.filter((event: any) => String(event.type ?? '').toUpperCase() === 'REVIEW').length,
    fulfillmentCount: ownershipHistory.filter((event: any) => String(event.type ?? '').toUpperCase() === 'FULFILLMENT').length,
    pendingGovernanceReview: Boolean(entry.controlledMedication) || Boolean(latestRequest?.escalated),
  };
  return {
    ...entry,
    refillRequests,
    refillTimeline: timeline,
    ownershipHistory,
    latestRefillStatus: latestRequest?.status ?? null,
    fulfillmentStatus: latestRequest?.fulfillmentStatus ?? entry.fulfillmentStatus ?? null,
    pharmacyQueue: latestRequest?.queue ?? null,
    governanceFlags,
    governanceNotes,
    governanceSummary,
  };
}

function buildLabHistory(items: any[], entry: any) {
  const title = String(entry.testName ?? entry.title ?? '').trim();
  const history = items
    .filter((item) => String(item.title ?? item.testName ?? '').trim() === title)
    .slice(0, 6)
    .map((item) => ({
      id: item.id,
      releasedAt: item.releasedAt ?? item.collectedAt ?? null,
      flaggedCount: item.flaggedCount ?? 0,
      valueSummary: Array.isArray(item.values) && item.values.length
        ? item.values.slice(0, 2).map((value: any) => `${value.label}: ${value.value}`).join(' · ')
        : 'No analyte summary available',
    }));
  const trendPoints = history.map((item, index) => ({
    index,
    releasedAt: item.releasedAt,
    flaggedCount: item.flaggedCount,
  }));
  return { history, trendPoints };
}



function normalizeFamilyMedicalProfile(item: any) {
  const fallback = item?.medicalProfile && typeof item.medicalProfile === 'object'
    ? item.medicalProfile
    : { questionnaire: {}, reports: [], shareMedicalDataWithAssignedDoctors: false };
  const medical = decryptMedicalJson<Record<string, any>>(item?.medicalDataCipher, fallback);
  return {
    questionnaire: medical?.questionnaire && typeof medical.questionnaire === 'object' ? medical.questionnaire : {},
    reports: Array.isArray(medical?.reports) ? medical.reports : [],
    providerPrescriptions: Array.isArray(medical?.providerPrescriptions) ? medical.providerPrescriptions : [],
    providerOrders: Array.isArray(medical?.providerOrders) ? medical.providerOrders : [],
    shareMedicalDataWithAssignedDoctors: Boolean(medical?.shareMedicalDataWithAssignedDoctors ?? false),
    updatedAt: medical?.updatedAt ?? null,
  };
}

async function getFamilySubjectContext(userId: string, organizationId: string | undefined, subjectProfileId?: string | null) {
  const context = await getPatientContext(userId, organizationId, subjectProfileId);
  if (!context.isFamilySubject || !context.organizationId) return null;
  const familyProfile = await getPatientWorkspaceItem('family_profile', context.subjectProfileId, context.organizationId, context.patientProfileId);
  const medical = normalizeFamilyMedicalProfile(familyProfile);
  return { context, familyProfile, medical };
}

async function getFamilySubjectContextByPatientId(patientId: string, organizationId: string | undefined, subjectProfileId?: string | null) {
  const normalizedSubjectProfileId = String(subjectProfileId ?? '').trim();
  if (!normalizedSubjectProfileId || !organizationId) return null;
  const familyProfile = await getPatientWorkspaceItem('family_profile', normalizedSubjectProfileId, organizationId, patientId);
  const medical = normalizeFamilyMedicalProfile(familyProfile);
  return {
    context: {
      organizationId,
      patientProfileId: patientId,
      patientName: null,
      subjectKind: 'family' as const,
      subjectProfileId: familyProfile.id,
      subjectName: String(familyProfile.profileName ?? familyProfile.title ?? 'Family member'),
      subjectRelationship: familyProfile.relationship ? String(familyProfile.relationship) : null,
      isFamilySubject: true,
    },
    familyProfile,
    medical,
  };
}

async function getProviderFamilySubjectAccessDecision(userId: string, patientId: string, subjectProfileId: string, organizationId?: string) {
  const chartDecision = await getChartAccessDecision(userId, patientId, organizationId);
  if (!chartDecision.allowed) {
    return { allowed: false, reason: 'NO_CHART_ACCESS', chartDecision, family: null, providerSubjectAppointmentCount: 0 };
  }
  const family = await getFamilySubjectContextByPatientId(patientId, organizationId, subjectProfileId);
  if (!family) {
    return { allowed: false, reason: 'SUBJECT_NOT_FOUND', chartDecision, family: null, providerSubjectAppointmentCount: 0 };
  }
  const appointments = await prisma.appointment.findMany({
    where: {
      organizationId,
      patientId,
      providerId: chartDecision.providerId,
      status: { in: providerLinkedAppointmentStatuses },
    },
    select: { id: true },
  });
  const appointmentIds = new Set(appointments.map((item) => item.id));
  const subjectMeta = await listAppointmentSubjectMeta({ organizationId, patientId });
  const matchingAppointments = subjectMeta.filter((item) => item.subjectProfileId === family.context.subjectProfileId && appointmentIds.has(item.appointmentId));
  return {
    allowed: matchingAppointments.length > 0,
    reason: matchingAppointments.length > 0 ? 'SCHEDULED_APPOINTMENT_FOR_SUBJECT' : 'NO_SCHEDULED_APPOINTMENT_FOR_SUBJECT',
    chartDecision,
    family,
    providerSubjectAppointmentCount: matchingAppointments.length,
  };
}

function buildFamilySubjectRecords(family: NonNullable<Awaited<ReturnType<typeof getFamilySubjectContext>>>) {
  const items: any[] = [];
  const questionnaire = family.medical.questionnaire ?? {};
  if (Object.keys(questionnaire).length) {
    items.push({
      id: `${family.context.subjectProfileId}-questionnaire`,
      patientId: family.context.subjectProfileId,
      appointmentId: null,
      createdAt: family.familyProfile.updatedAt ?? family.familyProfile.createdAt ?? new Date().toISOString(),
      updatedAt: family.familyProfile.updatedAt ?? family.familyProfile.createdAt ?? new Date().toISOString(),
      patientName: family.context.subjectName,
      providerName: null,
      summary: {
        title: 'Health questionnaire',
        type: 'QUESTIONNAIRE',
        recordType: 'QUESTIONNAIRE',
        patientVisible: true,
      },
      content: {
        recordType: 'QUESTIONNAIRE',
        patientVisible: true,
        questionnaire,
      },
    });
  }
  items.push(...family.medical.reports.map((report: any) => ({
    id: String(report.id ?? `${family.context.subjectProfileId}-${report.fileName ?? 'report'}`),
    patientId: family.context.subjectProfileId,
    appointmentId: null,
    createdAt: report.uploadedAt ?? family.familyProfile.updatedAt ?? new Date().toISOString(),
    updatedAt: report.uploadedAt ?? family.familyProfile.updatedAt ?? new Date().toISOString(),
    patientName: family.context.subjectName,
    providerName: report.providerName ?? null,
    summary: {
      title: report.fileName ?? 'Uploaded report',
      type: 'PATIENT_UPLOADED_REPORT',
      recordType: 'PATIENT_UPLOADED_REPORT',
      patientVisible: true,
      reportCategory: report.category ?? 'Medical report',
    },
    content: {
      recordType: 'PATIENT_UPLOADED_REPORT',
      patientVisible: true,
      fileName: report.fileName ?? 'Uploaded report',
      category: report.category ?? 'Medical report',
      reportDate: report.reportDate ?? null,
      facilityName: report.facilityName ?? null,
      providerName: report.providerName ?? null,
      notes: report.notes ?? null,
      uploadedAt: report.uploadedAt ?? null,
    },
  })));
  items.push(...(Array.isArray(family.medical.providerOrders) ? family.medical.providerOrders : []).map((order: any) => ({
    id: String(order.id ?? `${family.context.subjectProfileId}-order`),
    patientId: family.context.subjectProfileId,
    appointmentId: null,
    createdAt: order.submittedAt ?? family.familyProfile.updatedAt ?? new Date().toISOString(),
    updatedAt: order.submittedAt ?? family.familyProfile.updatedAt ?? new Date().toISOString(),
    patientName: family.context.subjectName,
    providerName: null,
    summary: {
      title: order.title ?? 'Clinical order',
      type: 'CLINICAL_ORDER',
      recordType: 'CLINICAL_ORDER',
      patientVisible: true,
    },
    content: {
      recordType: 'CLINICAL_ORDER',
      patientVisible: true,
      title: order.title ?? 'Clinical order',
      reason: order.reason ?? null,
      note: order.note ?? null,
      orderGroups: Array.isArray(order.orderGroups) ? order.orderGroups : [],
      commonSelections: Array.isArray(order.commonSelections) ? order.commonSelections : [],
      submittedAt: order.submittedAt ?? null,
    },
  })));
  return items;
}

function buildFamilyLabItems(family: NonNullable<Awaited<ReturnType<typeof getFamilySubjectContext>>>) {
  return family.medical.reports
    .filter((report: any) => String(report.category ?? '').toLowerCase().includes('lab') || String(report.category ?? '').toLowerCase().includes('pathology'))
    .map((report: any) => ({
      id: String(report.id ?? `${family.context.subjectProfileId}-lab`),
      labResultId: String(report.id ?? `${family.context.subjectProfileId}-lab`),
      title: report.fileName ?? report.category ?? 'Lab result',
      testName: report.category ?? 'Lab result',
      collectedAt: report.reportDate ?? report.uploadedAt ?? null,
      verifiedAt: null,
      releasedAt: report.uploadedAt ?? null,
      status: 'PATIENT_UPLOADED',
      patientVisible: true,
      secondReviewStatus: 'NOT_REQUIRED',
      flaggedCount: 0,
      providerName: report.providerName ?? null,
      values: [],
      comments: report.notes ? [report.notes] : [],
      guidance: 'Uploaded by the patient for the selected family profile.',
      trendPoints: [],
      history: [],
    }));
}

function buildFamilyPrescriptionItems(family: NonNullable<Awaited<ReturnType<typeof getFamilySubjectContext>>>) {
  const raw = String(family.medical.questionnaire?.currentMedications ?? '').trim();
  if (!raw) return [] as any[];
  return raw
    .split(/\n|;|,/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry, index) => ({
      id: `${family.context.subjectProfileId}-rx-${index + 1}`,
      prescriptionId: `${family.context.subjectProfileId}-rx-${index + 1}`,
      title: entry,
      drug: entry,
      dosage: '',
      frequency: '',
      duration: '',
      status: 'ACTIVE',
      fulfillmentStatus: 'PATIENT_REPORTED',
      pharmacyRoutingState: 'NOT_ROUTED',
      refillEligible: false,
      refillMaxCount: 0,
      refillRequests: [],
      controlledMedication: false,
      note: 'Patient-reported medication for the selected family profile.',
    }));
}

async function getEncryptedPatientReports(patientId: string) {
  const profile = await prisma.patientProfile.findUnique({ where: { id: patientId } });
  if (!profile) return { medical: { reports: [], shareMedicalDataWithAssignedDoctors: false }, preferences: {} as Record<string, unknown> };
  const preferences = profile.preferences && typeof profile.preferences === 'object' ? profile.preferences as Record<string, unknown> : {};
  const fallback = preferences.medicalProfile && typeof preferences.medicalProfile === 'object'
    ? preferences.medicalProfile as Record<string, any>
    : { questionnaire: {}, reports: [], shareMedicalDataWithAssignedDoctors: true };
  const medical = decryptMedicalJson<Record<string, any>>(preferences.medicalDataCipher, fallback);
  return { medical, preferences };
}

async function getPatientReportAccessDecision(userId: string, patientId: string, organizationId?: string, subjectProfileId?: string | null) {
  const normalizedSubjectProfileId = String(subjectProfileId ?? '').trim();
  if (normalizedSubjectProfileId) {
    const subjectDecision = await getProviderFamilySubjectAccessDecision(userId, patientId, normalizedSubjectProfileId, organizationId);
    if (!subjectDecision.allowed || !subjectDecision.family) {
      return {
        allowed: false,
        reason: subjectDecision.reason,
        items: [] as any[],
        providerAppointmentCount: subjectDecision.providerSubjectAppointmentCount,
        chartAccessPath: subjectDecision.chartDecision?.path ?? 'DENIED',
        subject: subjectDecision.family ? {
          id: subjectDecision.family.context.subjectProfileId,
          name: subjectDecision.family.context.subjectName,
          relationship: subjectDecision.family.context.subjectRelationship,
        } : null,
      };
    }
    const reports = Array.isArray(subjectDecision.family.medical?.reports) ? subjectDecision.family.medical.reports : [];
    const shareMedicalData = Boolean(subjectDecision.family.medical?.shareMedicalDataWithAssignedDoctors ?? false);
    const consents = organizationId ? await listPatientConsentItems(organizationId, patientId).catch(() => []) : [];
    const dataSharingAccepted = consents.some((item: any) => String(item.consentType ?? '').toUpperCase() === 'DATA_SHARING' && String(item.status ?? '').toUpperCase() === 'ACCEPTED');
    const allowed = subjectDecision.providerSubjectAppointmentCount > 0 && shareMedicalData && dataSharingAccepted;
    const items = allowed
      ? reports.filter((item: any) => Boolean(item?.grantedToScheduledDoctors ?? false)).map((item: any) => ({
          id: item.id,
          fileName: item.fileName,
          category: item.category,
          reportDate: item.reportDate ?? null,
          providerName: item.providerName ?? null,
          facilityName: item.facilityName ?? null,
          notes: item.notes ?? null,
          uploadedAt: item.uploadedAt ?? null,
          accessScope: item.accessScope ?? 'SCHEDULED_DOCTORS_ONLY',
          subjectProfileId: subjectDecision.family!.context.subjectProfileId,
          subjectLabel: subjectDecision.family!.context.subjectName,
          subjectRelationship: subjectDecision.family!.context.subjectRelationship ?? null,
        }))
      : [];
    return {
      allowed,
      reason: allowed ? 'SCHEDULED_APPOINTMENT_AND_PATIENT_CONSENT_FOR_SUBJECT' : (!dataSharingAccepted ? 'PATIENT_CONSENT_REQUIRED' : 'REPORTS_NOT_SHARED_FOR_SUBJECT'),
      items,
      providerAppointmentCount: subjectDecision.providerSubjectAppointmentCount,
      chartAccessPath: subjectDecision.chartDecision.path,
      subject: {
        id: subjectDecision.family.context.subjectProfileId,
        name: subjectDecision.family.context.subjectName,
        relationship: subjectDecision.family.context.subjectRelationship,
      },
    };
  }

  const chartDecision = await getChartAccessDecision(userId, patientId, organizationId);
  if (!chartDecision.allowed) return { allowed: false, reason: 'NO_CHART_ACCESS', items: [] as any[] };
  const { medical } = await getEncryptedPatientReports(patientId);
  const reports = Array.isArray(medical?.reports) ? medical.reports : [];
  const shareMedicalData = Boolean(medical?.shareMedicalDataWithAssignedDoctors ?? true);
  const consents = organizationId ? await listPatientConsentItems(organizationId, patientId).catch(() => []) : [];
  const dataSharingAccepted = consents.some((item: any) => String(item.consentType ?? '').toUpperCase() === 'DATA_SHARING' && String(item.status ?? '').toUpperCase() === 'ACCEPTED');
  const providerAppointmentCount = await prisma.appointment.count({ where: { organizationId, patientId, providerId: chartDecision.providerId, status: { in: providerLinkedAppointmentStatuses } } });
  const allowed = providerAppointmentCount > 0 && shareMedicalData && dataSharingAccepted;
  const items = allowed
    ? reports.filter((item: any) => Boolean(item?.grantedToScheduledDoctors ?? true)).map((item: any) => ({
        id: item.id,
        fileName: item.fileName,
        category: item.category,
        reportDate: item.reportDate ?? null,
        providerName: item.providerName ?? null,
        facilityName: item.facilityName ?? null,
        notes: item.notes ?? null,
        uploadedAt: item.uploadedAt ?? null,
        accessScope: item.accessScope ?? 'SCHEDULED_DOCTORS_ONLY',
      }))
    : [];
  return {
    allowed,
    reason: allowed ? 'SCHEDULED_APPOINTMENT_AND_PATIENT_CONSENT' : (providerAppointmentCount === 0 ? 'NO_SCHEDULED_APPOINTMENT' : (!dataSharingAccepted ? 'PATIENT_CONSENT_REQUIRED' : 'REPORTS_NOT_SHARED')),
    items,
    providerAppointmentCount,
    chartAccessPath: chartDecision.path,
    subject: null,
  };
}

async function getPatientScopedRecords(userId: string) {
  const patientProfileId = await getPatientProfileId(userId);
  if (!patientProfileId) return [];
  const items = await prisma.medicalRecord.findMany({
    where: { patientId: patientProfileId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      patientId: true,
      appointmentId: true,
      createdAt: true,
      updatedAt: true,
      summary: true,
      content: true,
      appointment: {
        select: {
          provider: {
            select: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });
  return items.map(toRecordPayload).filter((item) => isPatientVisibleRecord(item)).map((item) => sanitizePatientRecord(item));
}

recordsRouter.get('/', async (req, res) => {
  const role = req.user!.role;
  const patientIdQuery = String(req.query.patientId ?? '');
  const requestedSubjectProfileId = getRequestedSubjectProfileId(req);
  if (role === 'PATIENT' && requestedSubjectProfileId) {
    const family = await getFamilySubjectContext(req.user!.userId, req.user?.organizationId, requestedSubjectProfileId);
    if (family) {
      const items = buildFamilySubjectRecords(family);
      return res.json({ items, subject: { kind: 'family', id: family.context.subjectProfileId, name: family.context.subjectName, relationship: family.context.subjectRelationship } });
    }
  }
  if (['PROVIDER', 'NURSE'].includes(role) && patientIdQuery && requestedSubjectProfileId) {
    const subjectDecision = await getProviderFamilySubjectAccessDecision(req.user!.userId, patientIdQuery, requestedSubjectProfileId, req.user?.organizationId);
    if (!subjectDecision.allowed || !subjectDecision.family) {
      throw forbidden(`Family subject chart access is not available: ${subjectDecision.reason}.`);
    }
    const items = buildFamilySubjectRecords(subjectDecision.family as any);
    return res.json({
      items,
      subject: {
        kind: 'family',
        id: subjectDecision.family.context.subjectProfileId,
        name: subjectDecision.family.context.subjectName,
        relationship: subjectDecision.family.context.subjectRelationship,
      },
      access: {
        reason: subjectDecision.reason,
        providerSubjectAppointmentCount: subjectDecision.providerSubjectAppointmentCount,
        chartAccessPath: subjectDecision.chartDecision.path,
      },
    });
  }
  const where: Record<string, any> = {};
  if (role === 'PATIENT') where.patientId = (await getPatientProfileId(req.user!.userId)) ?? '__none__';
  else if (patientIdQuery) {
    where.patientId = patientIdQuery;
    if (['PROVIDER', 'NURSE'].includes(role)) {
      await enforceProviderChartAccess(req.user!.userId, patientIdQuery, req.user?.organizationId);
    }
  } else if (['PROVIDER', 'NURSE'].includes(role)) where.providerId = (await getProviderProfileId(req.user!.userId)) ?? '__none__';
  const items = await prisma.medicalRecord.findMany({ where, orderBy: { createdAt: 'desc' }, include: { patient: { include: { user: true } }, appointment: { include: { provider: { include: { user: true } } } } } });
  const payload = items.map(toRecordPayload);
  const filtered = role === 'PATIENT' ? payload.filter((item) => isPatientVisibleRecord(item)).map((item) => sanitizePatientRecord(item)) : payload;
  res.json({ items: filtered });
});

recordsRouter.get('/access-context', allowRoles(['PROVIDER', 'NURSE', 'COMPANY_ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  const patientId = String(req.query.patientId ?? '').trim();
  const requestedSubjectProfileId = getRequestedSubjectProfileId(req);
  if (!patientId) throw badRequest('patientId is required.');
  if (['PROVIDER', 'NURSE'].includes(req.user?.role ?? '')) {
    if (requestedSubjectProfileId) {
      const subjectDecision = await getProviderFamilySubjectAccessDecision(req.user!.userId, patientId, requestedSubjectProfileId, req.user?.organizationId);
      if (!subjectDecision.allowed || !subjectDecision.family) {
        throw forbidden(`Family subject chart access is not available: ${subjectDecision.reason}.`);
      }
      const providerContext = await getProviderContext(req.user!.userId, req.user?.organizationId);
      return res.json({
        allowed: true,
        accessPath: subjectDecision.chartDecision.path,
        providerId: subjectDecision.chartDecision.providerId,
        chartAccessException: subjectDecision.chartDecision.exception,
        guidance: subjectDecision.chartDecision.path === 'CARE_TEAM_EXCEPTION' ? 'Temporary care-team access exception is active for this chart.' : 'Access granted through existing provider assignment.',
        subject: {
          kind: 'family',
          id: subjectDecision.family.context.subjectProfileId,
          name: subjectDecision.family.context.subjectName,
          relationship: subjectDecision.family.context.subjectRelationship,
          providerSubjectAppointmentCount: subjectDecision.providerSubjectAppointmentCount,
        },
        hspAccess: providerContext.hspAccess,
      });
    }
    const decision = await enforceProviderChartAccess(req.user!.userId, patientId, req.user?.organizationId);
    const providerContext = await getProviderContext(req.user!.userId, req.user?.organizationId);
    return res.json({
      allowed: true,
      accessPath: decision.path,
      providerId: decision.providerId,
      chartAccessException: decision.exception,
      guidance: decision.path === 'CARE_TEAM_EXCEPTION' ? 'Temporary care-team access exception is active for this chart.' : 'Access granted through existing provider assignment.',
      hspAccess: providerContext.hspAccess,
    });
  }
  const exceptions = await listChartAccessExceptions({ organizationId: req.user?.organizationId, patientId, status: 'ACTIVE' });
  res.json({ allowed: true, accessPath: 'ADMIN_OVERRIDE', chartAccessException: exceptions[0] ?? null });
});

recordsRouter.get('/access-exceptions', allowRoles(['COMPANY_ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  const patientId = String(req.query.patientId ?? '').trim() || null;
  const providerId = String(req.query.providerId ?? '').trim() || null;
  const status = String(req.query.status ?? 'ACTIVE').trim().toUpperCase() as 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'ALL';
  const items = await listChartAccessExceptions({ organizationId: req.user?.organizationId, patientId, providerId, status });
  res.json({ items, count: items.length });
});

recordsRouter.post('/access-exceptions', allowRoles(['COMPANY_ADMIN', 'SUPER_ADMIN']), validateBody(chartAccessExceptionSchema), async (req, res) => {
  const item = await grantChartAccessException({
    organizationId: req.user?.organizationId,
    patientId: req.body.patientId,
    providerId: req.body.providerId,
    createdByUserId: req.user?.userId,
    reasonCode: req.body.reasonCode,
    note: req.body.note ?? null,
    expiresAt: req.body.expiresAt ?? null,
  });
  await writeAuditLog({ actorId: req.user?.userId, organizationId: req.user?.organizationId, action: 'chart.access_exception_granted', resource: 'patient_chart_access', resourceId: item.id, details: item });
  res.status(201).json({ item });
});

recordsRouter.post('/access-exceptions/:exceptionId/revoke', allowRoles(['COMPANY_ADMIN', 'SUPER_ADMIN']), validateBody(revokeChartAccessSchema), async (req, res) => {
  const item = await revokeChartAccessException(req.params.exceptionId, req.user?.userId, req.body.note ?? null);
  if (!item) throw notFound('Chart access exception not found');
  await writeAuditLog({ actorId: req.user?.userId, organizationId: req.user?.organizationId, action: 'chart.access_exception_revoked', resource: 'patient_chart_access', resourceId: item.id, details: item });
  res.json({ item });
});


recordsRouter.get('/provider/patient-reports', allowRoles(['PROVIDER', 'NURSE']), async (req, res) => {
  const patientId = String(req.query.patientId ?? '').trim();
  const requestedSubjectProfileId = getRequestedSubjectProfileId(req);
  if (!patientId) throw badRequest('patientId is required');
  const decision = await getPatientReportAccessDecision(req.user!.userId, patientId, req.user?.organizationId, requestedSubjectProfileId);
  if (!decision.allowed) {
    throw forbidden(`Patient-uploaded reports are not available: ${decision.reason}.`);
  }
  res.json({
    items: decision.items,
    count: decision.items.length,
    subject: decision.subject ?? null,
    access: {
      reason: decision.reason,
      providerAppointmentCount: decision.providerAppointmentCount,
      chartAccessPath: decision.chartAccessPath,
    },
  });
});

recordsRouter.get('/patient-labs', allowRoles(['PATIENT', 'COMPANY_ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  const requestedSubjectProfileId = getRequestedSubjectProfileId(req);
  if (requestedSubjectProfileId) {
    const family = await getFamilySubjectContext(req.user!.userId, req.user?.organizationId, requestedSubjectProfileId);
    if (family) {
      const items = buildFamilyLabItems(family);
      return res.json({ items, count: items.length });
    }
  }
  const items = (await getPatientScopedRecords(req.user!.userId)).filter(isLabRecord).map(toPatientLabItem);
  res.json({ items, count: items.length });
});

recordsRouter.get('/patient-labs/:labId', allowRoles(['PATIENT', 'COMPANY_ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  const requestedSubjectProfileId = getRequestedSubjectProfileId(req);
  if (requestedSubjectProfileId) {
    const family = await getFamilySubjectContext(req.user!.userId, req.user?.organizationId, requestedSubjectProfileId);
    if (family) {
      const items = buildFamilyLabItems(family);
      const item = items.find((entry) => entry.id === req.params.labId || entry.labResultId === req.params.labId);
      if (!item) throw notFound('Lab result not found');
      return res.json({ item });
    }
  }
  const items = (await getPatientScopedRecords(req.user!.userId)).filter(isLabRecord).map(toPatientLabItem);
  const item = items.find((entry) => entry.id === req.params.labId || entry.labResultId === req.params.labId);
  if (!item) throw notFound('Lab result not found');
  const history = buildLabHistory(items, item);
  res.json({ item: { ...item, ...history } });
});

recordsRouter.get('/patient-prescriptions', allowRoles(['PATIENT', 'COMPANY_ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  const requestedSubjectProfileId = getRequestedSubjectProfileId(req);
  if (requestedSubjectProfileId) {
    const family = await getFamilySubjectContext(req.user!.userId, req.user?.organizationId, requestedSubjectProfileId);
    if (family) {
      const items = buildFamilyPrescriptionItems(family);
      return res.json({ items, count: items.length });
    }
  }
  const patientProfileId = await getPatientProfileId(req.user!.userId);
  const requests = patientProfileId ? await listRefillRequests({ patientId: patientProfileId, status: 'ALL' }) : [];
  const items = (await getPatientScopedRecords(req.user!.userId)).filter(isPrescriptionRecord).map((item) => buildPrescriptionRefillView(toPatientPrescriptionItem(item), requests));
  res.json({ items, count: items.length });
});

recordsRouter.get('/patient-prescriptions/:prescriptionId', allowRoles(['PATIENT', 'COMPANY_ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  const requestedSubjectProfileId = getRequestedSubjectProfileId(req);
  if (requestedSubjectProfileId) {
    const family = await getFamilySubjectContext(req.user!.userId, req.user?.organizationId, requestedSubjectProfileId);
    if (family) {
      const items = buildFamilyPrescriptionItems(family);
      const item = items.find((entry) => entry.id === req.params.prescriptionId || entry.prescriptionId === req.params.prescriptionId);
      if (!item) throw notFound('Prescription not found');
      return res.json({ item });
    }
  }
  const patientProfileId = await getPatientProfileId(req.user!.userId);
  const requests = patientProfileId ? await listRefillRequests({ patientId: patientProfileId, status: 'ALL' }) : [];
  const items = (await getPatientScopedRecords(req.user!.userId)).filter(isPrescriptionRecord).map((item) => buildPrescriptionRefillView(toPatientPrescriptionItem(item), requests));
  const item = items.find((entry) => entry.id === req.params.prescriptionId || entry.prescriptionId === req.params.prescriptionId);
  if (!item) throw notFound('Prescription not found');
  res.json({ item });
});

recordsRouter.get('/patient-prescriptions/:prescriptionId/ownership-history', allowRoles(['PATIENT', 'COMPANY_ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  const requestedSubjectProfileId = getRequestedSubjectProfileId(req);
  if (requestedSubjectProfileId) return res.json({ items: [], count: 0 });
  const patientProfileId = await getPatientProfileId(req.user!.userId);
  const requests = patientProfileId ? await listRefillRequests({ patientId: patientProfileId, status: 'ALL' }) : [];
  const matching = requests.filter((request) => request.prescriptionId === req.params.prescriptionId);
  const items = matching
    .flatMap((request) => getRefillOwnershipHistory(request).map((event) => ({
      ...event,
      requestId: request.id,
      prescriptionId: request.prescriptionId,
      status: request.status,
      fulfillmentStatus: request.fulfillmentStatus ?? null,
      assignedRole: request.assignedRole ?? null,
    })))
    .sort((a: any, b: any) => String(b.at ?? '').localeCompare(String(a.at ?? '')));
  res.json({ items, count: items.length });
});


recordsRouter.get('/refill-audit-scopes', allowRoles(['COMPANY_ADMIN', 'SUPER_ADMIN', 'COMPANY_SUPPORT']), async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const items = await listRefillAuditScopes(organizationId);
  res.json({ items, count: items.length });
});


recordsRouter.get('/refill-audit-scopes/:scopeId', allowRoles(['COMPANY_ADMIN', 'SUPER_ADMIN', 'COMPANY_SUPPORT']), async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const scope = await getRefillAuditScope(req.params.scopeId, organizationId);
  if (!scope) throw notFound('Governed refill scope not found');
  const packet = await buildRefillAuditPacket({ organizationId, scope });
  const failures = await listFailedReportDeliveryExecutions(organizationId, { limit: Math.max(5, Math.min(50, scope.limit ?? 20)) });
  res.json({
    item: scope,
    summary: packet.summary,
    governanceNotes: packet.governanceNotes,
    latestFailures: failures.slice(0, 8),
  });
});

recordsRouter.get('/refill-audit-scope-usage', allowRoles(['COMPANY_ADMIN', 'SUPER_ADMIN', 'COMPANY_SUPPORT']), async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const scopes = await listRefillAuditScopes(organizationId);
  const items = await Promise.all(scopes.map(async (scope) => {
    const packet = await buildRefillAuditPacket({ organizationId, limit: scope.limit, scope });
    const latestExecution = packet.deliveryExecutions[0] ?? null;
    return {
      id: scope.id,
      title: scope.title,
      note: scope.note ?? null,
      updatedAt: scope.updatedAt,
      filters: {
        queue: scope.queue ?? null,
        assignedRole: scope.assignedRole ?? null,
        controlledOnly: scope.controlledOnly,
        escalatedOnly: scope.escalatedOnly,
      },
      summary: packet.summary,
      governanceNotes: packet.governanceNotes,
      latestExecution: latestExecution ? {
        id: latestExecution.id,
        title: latestExecution.title,
        status: latestExecution.status,
        executedAt: latestExecution.executedAt,
        summary: latestExecution.summary,
      } : null,
    };
  }));
  res.json({ items, count: items.length });
});

recordsRouter.post('/refill-audit-scopes', allowRoles(['COMPANY_ADMIN', 'SUPER_ADMIN', 'COMPANY_SUPPORT']), validateBody(refillAuditScopeSchema), async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await createRefillAuditScope({
    organizationId,
    title: req.body.title,
    note: req.body.note ?? null,
    limit: req.body.limit ?? null,
    queue: req.body.queue ?? null,
    assignedRole: req.body.assignedRole ?? null,
    controlledOnly: req.body.controlledOnly ?? false,
    escalatedOnly: req.body.escalatedOnly ?? false,
    includeExecutions: req.body.includeExecutions ?? true,
    includeOperationalEvents: req.body.includeOperationalEvents ?? true,
    createdByUserId: req.user?.userId,
  });
  res.status(201).json({ item });
});

recordsRouter.get('/refill-audit-packet/summary', allowRoles(['COMPANY_ADMIN', 'SUPER_ADMIN', 'COMPANY_SUPPORT', 'PROVIDER', 'NURSE', 'PHARMACIST']), async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const scopeId = String(req.query.scopeId ?? '').trim() || null;
  const scope = ['COMPANY_ADMIN', 'SUPER_ADMIN', 'COMPANY_SUPPORT'].includes(req.user?.role ?? '') ? await getRefillAuditScope(organizationId, scopeId) : null;
  const packet = await buildRefillAuditPacket({ organizationId, limit: Number.parseInt(String(req.query.limit ?? '50'), 10), scope });
  res.json({ summary: packet.summary, governanceNotes: packet.governanceNotes, scope: packet.scope });
});

recordsRouter.post('/patient-prescriptions/:prescriptionId/refill-request', allowRoles(['PATIENT']), validateBody(refillRequestSchema), async (req, res) => {
  const requestedSubjectProfileId = getRequestedSubjectProfileId(req);
  if (requestedSubjectProfileId) throw forbidden('Refill requests for dependent profiles require a provider-linked prescription release and are not yet enabled in the patient app.');
  const patientProfileId = await getPatientProfileId(req.user!.userId);
  if (!patientProfileId) throw badRequest('Patient profile is required.');
  const items = (await getPatientScopedRecords(req.user!.userId)).filter(isPrescriptionRecord).map(toPatientPrescriptionItem);
  const item = items.find((entry) => entry.id === req.params.prescriptionId || entry.prescriptionId === req.params.prescriptionId);
  if (!item) throw notFound('Prescription not found');
  if (!item.refillEligible) throw forbidden('Refill requests are not currently allowed for this prescription.');
  const request = await createRefillRequest({
    organizationId: req.user?.organizationId,
    patientId: patientProfileId,
    prescriptionId: item.prescriptionId,
    requestedByUserId: req.user?.userId,
    controlledMedication: item.controlledMedication,
    refillEligible: item.refillEligible,
    refillMaxCount: item.refillMaxCount,
    pharmacyRoutingState: item.pharmacyRoutingState,
    note: req.body.note ?? null,
  });
  await writeAuditLog({ actorId: req.user?.userId, organizationId: req.user?.organizationId, action: 'patient.prescription_refill_requested', resource: 'prescription_refill_request', resourceId: request.id, details: request });
  await createRefillStatusNotification(req.user?.organizationId ?? '', {
    id: request.id,
    patientId: request.patientId,
    prescriptionId: request.prescriptionId,
    status: request.status,
    fulfillmentStatus: request.fulfillmentStatus ?? null,
    queue: request.queue ?? null,
    pharmacyRoutingState: request.pharmacyRoutingState ?? null,
    note: request.note ?? null,
    decisionNote: request.decisionNote ?? null,
    controlledMedication: request.controlledMedication,
    updatedAt: request.updatedAt,
    agingBand: getRefillAgingBand(request),
    timelineCount: Array.isArray(request.timeline) ? request.timeline.length : 0,
    escalated: Boolean(request.escalated),
    escalationSeverity: request.escalationSeverity ?? null,
  }, req.user?.userId);
  res.status(201).json({ item: request });
});

recordsRouter.get('/refill-requests', allowRoles(['PATIENT', 'PROVIDER', 'NURSE', 'COMPANY_ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  const requestedSubjectProfileId = getRequestedSubjectProfileId(req);
  if ((req.user?.role ?? '') === 'PATIENT' && requestedSubjectProfileId) return res.json({ items: [], count: 0 });
  const status = String(req.query.status ?? 'ALL').trim().toUpperCase() as any;
  if (req.user?.role === 'PATIENT') {
    const patientProfileId = await getPatientProfileId(req.user!.userId);
    const items = patientProfileId ? await listRefillRequests({ patientId: patientProfileId, status }) : [];
    return res.json({ items, count: items.length, summary: summarizeRefillRequests(items) });
  }
  const items = await listRefillRequests({ organizationId: req.user?.organizationId, status });
  res.json({ items, count: items.length, summary: summarizeRefillRequests(items) });
});

recordsRouter.get('/refill-requests/:requestId/history', allowRoles(['PATIENT', 'PROVIDER', 'NURSE', 'COMPANY_ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  const history = await getRefillRequestHistory(req.params.requestId);
  if (!history) throw notFound('Refill request not found');
  if (req.user?.role === 'PATIENT') {
    const patientProfileId = await getPatientProfileId(req.user!.userId);
    if (!patientProfileId || history.item.patientId !== patientProfileId) throw forbidden('Refill request is outside patient scope');
  }
  if (['PROVIDER', 'NURSE'].includes(req.user?.role ?? '') && history.item.organizationId && req.user?.organizationId && history.item.organizationId !== req.user.organizationId) {
    throw forbidden('Refill request is outside provider scope');
  }
  res.json(history);
});

recordsRouter.get('/refill-operational-events', allowRoles(['COMPANY_ADMIN', 'SUPER_ADMIN', 'COMPANY_SUPPORT']), async (req, res) => {
  const limit = Number.parseInt(String(req.query.limit ?? '20'), 10);
  const items = await listRefillOperationalEvents({ organizationId: req.user?.organizationId, limit: Number.isFinite(limit) ? Math.max(1, Math.min(100, limit)) : 20 });
  res.json({ items, count: items.length });
});

recordsRouter.get('/refill-audit-packet', allowRoles(['COMPANY_ADMIN', 'SUPER_ADMIN', 'COMPANY_SUPPORT']), async (req, res) => {
  const limit = Number.parseInt(String(req.query.limit ?? '50'), 10);
  const format = String(req.query.format ?? 'json').trim().toLowerCase();
  const boundedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(250, limit)) : 50;
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const scopeId = String(req.query.scopeId ?? '').trim() || null;
  const scope = await getRefillAuditScope(organizationId, scopeId);
  const packet = await buildRefillAuditPacket({ organizationId, limit: boundedLimit, scope });

  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId,
    action: 'refill_audit_packet.exported',
    resource: 'refill_audit_packet',
    resourceId: `refill-audit-packet:${packet.generatedAt}`,
    details: { format, limit: boundedLimit, scopeId: scope?.id ?? null, summary: packet.summary },
  });

  if (format === 'csv') {
    const rows = [
      ['section', 'id', 'title', 'status', 'queue', 'detail', 'at'],
      ...packet.operationalEvents.map((item: any) => [
        'operational_event',
        String(item.id ?? ''),
        String(item.label ?? ''),
        String(item.status ?? ''),
        String(item.queue ?? ''),
        String(item.note ?? ''),
        String(item.at ?? ''),
      ]),
      ...packet.deliveryExecutions.map((item: any) => [
        'delivery_execution',
        String(item.id ?? ''),
        String(item.title ?? ''),
        String(item.status ?? ''),
        String(item.destination ?? ''),
        String(item.summary ?? ''),
        String(item.executedAt ?? ''),
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => '"' + String(value).replaceAll('"', '""') + '"').join(',')).join('\n');
    return res.type('text/csv').send(csv);
  }

  res.type('application/json').send(JSON.stringify(packet, null, 2));
});

recordsRouter.post('/encounters/validate', allowRoles(['PROVIDER', 'NURSE', 'COMPANY_ADMIN']), validateBody(encounterNoteSchema), async (req, res) => {
  if (['PROVIDER', 'NURSE'].includes(req.user?.role ?? '')) {
    await enforceProviderChartAccess(req.user!.userId, req.body.patientId, req.user?.organizationId);
  }
  const validation = validateEncounterNote(req.body, 'validate');
  res.json({ validation });
});

recordsRouter.post('/encounters/sign', allowRoles(['PROVIDER', 'NURSE', 'COMPANY_ADMIN']), validateBody(encounterNoteSchema), async (req, res) => {
  const role = req.user?.role ?? '';
  let providerId = req.body.providerId ?? null;
  if (['PROVIDER', 'NURSE'].includes(role)) {
    providerId = (await enforceProviderChartAccess(req.user!.userId, req.body.patientId, req.user?.organizationId)).providerId;
  }
  const validation = validateEncounterNote(req.body, 'sign');
  if (!validation.ready) {
    throw badRequest(validation.issues.join(' '));
  }
  if (!providerId) throw badRequest('Provider profile is required to sign the encounter note.');

  const created = await prisma.medicalRecord.create({
    data: {
      patientId: req.body.patientId,
      providerId,
      appointmentId: req.body.appointmentId ?? null,
      summary: {
        title: validation.recommendedTitle,
        type: 'encounter_note',
        signed: true,
        diagnosisCode: validation.diagnosisCode,
        attestedAt: new Date().toISOString(),
        sectionsCompleted: validation.sectionsCompleted,
        warnings: validation.warnings,
      },
      content: {
        recordType: 'ENCOUNTER_NOTE',
        patientVisible: false,
        releasedToPatient: false,
        noteStatus: 'SIGNED',
        diagnosisCode: validation.diagnosisCode,
        subjective: req.body.subjective.trim(),
        objective: req.body.objective.trim(),
        assessment: req.body.assessment.trim(),
        plan: req.body.plan.trim(),
        signatureAttested: true,
        signedAt: new Date().toISOString(),
      },
    },
    include: {
      patient: { include: { user: true } },
      appointment: { include: { provider: { include: { user: true } } } },
    },
  });

  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId: req.user?.organizationId,
    action: 'encounter_note.signed',
    resource: 'medical_record',
    resourceId: created.id,
    details: {
      patientId: req.body.patientId,
      appointmentId: req.body.appointmentId ?? null,
      providerId,
      diagnosisCode: validation.diagnosisCode,
      warnings: validation.warnings,
    },
  });

  res.status(201).json({ item: toRecordPayload(created), validation });
});

recordsRouter.get('/:recordId', async (req, res) => {
  const item = await prisma.medicalRecord.findUnique({ where: { id: req.params.recordId }, include: { patient: { include: { user: true } }, appointment: { include: { provider: { include: { user: true } } } } } });
  if (!item) throw notFound('Medical record not found');
  const payload = toRecordPayload(item);
  if (req.user?.role === 'PATIENT') {
    const patientProfileId = await getPatientProfileId(req.user.userId);
    if (payload.patientId !== patientProfileId) throw forbidden('Record is outside patient scope');
    if (!isPatientVisibleRecord(payload)) throw notFound('Medical record not found');
    return res.json({ item: sanitizePatientRecord(payload) });
  }
  if (['PROVIDER', 'NURSE'].includes(req.user?.role ?? '')) {
    await enforceProviderChartAccess(req.user!.userId, payload.patientId, req.user?.organizationId);
  }
  res.json({ item: payload });
});

recordsRouter.post('/', allowRoles(['PROVIDER', 'NURSE', 'COMPANY_ADMIN']), validateBody(medicalRecordCreateSchema), async (req, res) => {
  const created = await prisma.medicalRecord.create({ data: req.body });
  await writeAuditLog({ actorId: req.user?.userId, organizationId: req.user?.organizationId, action: 'medical_record.created', resource: 'medical_record', resourceId: created.id, details: req.body });
  res.status(201).json(created);
});
