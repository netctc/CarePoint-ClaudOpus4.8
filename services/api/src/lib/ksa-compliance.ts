import { prisma } from './prisma';
import { getPatientConsentItem } from './patient-consent-store';

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function toUpper(value: unknown) {
  return String(value ?? '').trim().toUpperCase();
}

function isTruthy(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = String(value ?? '').trim().toLowerCase();
  return ['true', '1', 'yes', 'y', 'accepted', 'verified', 'released', 'active', 'signed'].includes(text);
}

export function requiresRelationshipEvidence(relationship: string) {
  const normalized = relationship.trim().toUpperCase();
  return normalized !== 'SELF';
}

export function hasVerifiedRelationshipEvidence(item: Record<string, any>) {
  if (!requiresRelationshipEvidence(String(item.relationship ?? 'SELF'))) return true;
  return toUpper(item.evidenceStatus) === 'VERIFIED';
}

export function hasAcceptedFamilyConsent(item: Record<string, any>) {
  if (!requiresRelationshipEvidence(String(item.relationship ?? 'SELF'))) return true;
  return ['ACCEPTED', 'VERIFIED'].includes(toUpper(item.consentStatus));
}

export function canInviteFamilyProfile(item: Record<string, any>) {
  return hasVerifiedRelationshipEvidence(item) && hasAcceptedFamilyConsent(item);
}

const controlledMedicationKeywords = ['MORPHINE', 'OXYCODONE', 'TRAMADOL', 'CODEINE', 'FENTANYL', 'METHYLPHENIDATE'];

export function isControlledMedication(item: Record<string, any>) {
  if (isTruthy(item.controlledMedication)) return true;
  const drugName = toUpper(item.drug ?? item.title ?? '');
  return controlledMedicationKeywords.some((keyword) => drugName.includes(keyword));
}

export function validateControlledMedicationPolicy(item: Record<string, any>) {
  if (!isControlledMedication(item)) return;
  const checks = Array.isArray(item.complianceChecks) ? item.complianceChecks : [];
  const hasControlledCheck = checks.some((check) => {
    const label = toUpper((check as Record<string, any>).label);
    const status = toUpper((check as Record<string, any>).status);
    return (label.includes('CONTROL') || label.includes('NARCOTIC') || label.includes('REGULATED')) && ['CLEAR', 'APPROVED', 'PASS'].includes(status);
  });
  if (!hasControlledCheck) {
    throw new Error('Controlled medication requires a successful controlled-drug policy check before signing.');
  }
}

export function derivePatientRecordType(record: Record<string, any>) {
  const summary = asObject(record.summary);
  const content = asObject(record.content);
  const type = toUpper(content.recordType ?? summary.recordType ?? content.type ?? summary.type);
  if (type) return type;
  if (content.testName || content.values) return 'LAB_RESULT';
  if (content.drug || content.dosage) return 'PRESCRIPTION';
  return 'GENERAL';
}

export function isPatientVisibleRecord(record: Record<string, any>) {
  const summary = asObject(record.summary);
  const content = asObject(record.content);
  const type = derivePatientRecordType(record);
  if (content.patientVisible !== undefined && !isTruthy(content.patientVisible)) return false;
  if (type === 'LAB_RESULT') {
    const verified = content.verified ?? summary.verified ?? content.resultVerified;
    const released = content.releasedToPatient ?? summary.releasedToPatient ?? content.patientReleased;
    return isTruthy(verified) && isTruthy(released);
  }
  if (type === 'PRESCRIPTION') {
    const signed = content.signed ?? summary.signed ?? content.prescriptionStatus;
    const released = content.releasedToPatient ?? summary.releasedToPatient ?? content.patientReleased ?? true;
    const controlledApproved = !isControlledMedication(content) || isTruthy(content.controlledPolicyApproved ?? content.controlledMedicationApproved ?? false);
    return (isTruthy(signed) || ['SIGNED', 'ACTIVE'].includes(toUpper(signed))) && isTruthy(released) && controlledApproved;
  }
  return true;
}

export function sanitizePatientRecord(record: Record<string, any>) {
  const content = asObject(record.content);
  const sanitizedContent = { ...content };
  delete sanitizedContent.internalNotes;
  delete sanitizedContent.internalComment;
  delete sanitizedContent.supportOnlyNotes;
  delete sanitizedContent.rawPayload;
  return { ...record, content: sanitizedContent, recordType: derivePatientRecordType(record) };
}

export async function getTelehealthPolicySnapshot(sessionId: string, organizationId?: string) {
  const rows = await prisma.auditLog.findMany({
    where: { organizationId, resource: 'telehealth_session_policy', resourceId: sessionId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  for (const row of rows) {
    const details = asObject(row.details);
    const snapshot = asObject(details.snapshot);
    if (snapshot.sessionId === sessionId || !snapshot.sessionId) {
      return {
        sessionId,
        disclaimerVersion: String(snapshot.disclaimerVersion ?? 'v1.0'),
        recordingEnabled: isTruthy(snapshot.recordingEnabled),
        recordingRequiresConsent: snapshot.recordingRequiresConsent === undefined ? true : isTruthy(snapshot.recordingRequiresConsent),
        locale: String(snapshot.locale ?? 'en'),
      };
    }
  }
  return { sessionId, disclaimerVersion: 'v1.0', recordingEnabled: false, recordingRequiresConsent: true, locale: 'en' };
}

export async function getTelehealthPatientReadiness(sessionId: string, organizationId?: string, patientId?: string | null) {
  const rows = await prisma.auditLog.findMany({
    where: { organizationId, resource: 'telehealth_patient_readiness', resourceId: sessionId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  for (const row of rows) {
    const details = asObject(row.details);
    const snapshot = asObject(details.snapshot);
    if (patientId && snapshot.patientId && snapshot.patientId !== patientId) continue;
    if (snapshot.sessionId === sessionId || !snapshot.sessionId) {
      return {
        sessionId,
        patientId: snapshot.patientId ?? patientId ?? null,
        disclaimerAccepted: isTruthy(snapshot.disclaimerAccepted),
        disclaimerAcceptedAt: snapshot.disclaimerAcceptedAt ?? null,
        recordingConsentAccepted: isTruthy(snapshot.recordingConsentAccepted),
        recordingConsentAcceptedAt: snapshot.recordingConsentAcceptedAt ?? null,
        deviceCheckCompleted: isTruthy(snapshot.deviceCheckCompleted),
        locale: String(snapshot.locale ?? 'en'),
        updatedAt: row.createdAt,
      };
    }
  }
  return {
    sessionId,
    patientId: patientId ?? null,
    disclaimerAccepted: false,
    disclaimerAcceptedAt: null,
    recordingConsentAccepted: false,
    recordingConsentAcceptedAt: null,
    deviceCheckCompleted: false,
    locale: 'en',
    updatedAt: null,
  };
}

export async function hasAcceptedTelehealthConsent(organizationId: string, patientId?: string | null) {
  if (!patientId) return false;
  const item = await getPatientConsentItem('TELEHEALTH', organizationId, patientId).catch(() => null);
  return toUpper(item?.status) === 'ACCEPTED';
}
