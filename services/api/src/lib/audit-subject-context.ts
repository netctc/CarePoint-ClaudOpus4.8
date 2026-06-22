export type AuditSubjectContext = {
  subjectProfileId: string | null;
  subjectLabel: string | null;
  subjectRelationship: string | null;
  isFamilySubject: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function readString(value: unknown) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function readBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : null;
}

export function extractAuditSubjectContext(details: unknown): AuditSubjectContext | null {
  const record = asRecord(details);
  if (!record) return null;

  const nested = asRecord(record.subjectContext) ?? asRecord(record.subject) ?? null;
  const subjectProfileId = readString(record.subjectProfileId) ?? readString(record.profileId) ?? readString(nested?.subjectProfileId) ?? readString(nested?.profileId);
  const subjectLabel = readString(record.subjectLabel) ?? readString(record.subjectName) ?? readString(record.profileName) ?? readString(nested?.subjectLabel) ?? readString(nested?.subjectName) ?? readString(nested?.profileName);
  const subjectRelationship = readString(record.subjectRelationship) ?? readString(record.relationship) ?? readString(nested?.subjectRelationship) ?? readString(nested?.relationship);
  const explicitIsFamily = readBoolean(record.isFamilySubject) ?? readBoolean(nested?.isFamilySubject);
  const isFamilySubject = explicitIsFamily ?? Boolean(subjectProfileId);

  if (!subjectProfileId && !subjectLabel && !subjectRelationship && !isFamilySubject) return null;

  return {
    subjectProfileId,
    subjectLabel,
    subjectRelationship,
    isFamilySubject,
  };
}

export function withAuditSubjectContext(details: unknown) {
  const record = asRecord(details);
  const subjectContext = extractAuditSubjectContext(details);
  if (!record) {
    return subjectContext ? { subjectContext } : details;
  }
  if (!subjectContext) return record;
  return {
    ...record,
    subjectContext,
  };
}
