import type { AppointmentSubjectMeta } from './appointment-subject-store';
import { extractAuditSubjectContext } from './audit-subject-context';


export type SubjectScope = 'all' | 'self' | 'family';

export function normalizeSubjectScope(value: unknown): SubjectScope {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized == 'self') return 'self';
  if (normalized == 'family') return 'family';
  return 'all';
}

export function matchesSubjectScope(subject: { isFamilySubject?: boolean | null } | null | undefined, scope: SubjectScope) {
  if (scope === 'all') return true;
  const isFamily = Boolean(subject?.isFamilySubject);
  return scope === 'family' ? isFamily : !isFamily;
}

export type SubjectSummary = {
  total: number;
  selfCount: number;
  familyCount: number;
  byRelationship: Record<string, number>;
  byLabel: Record<string, number>;
  latestFamilyLabel: string | null;
};

function createEmptySummary(): SubjectSummary {
  return {
    total: 0,
    selfCount: 0,
    familyCount: 0,
    byRelationship: {},
    byLabel: {},
    latestFamilyLabel: null,
  };
}

function normalizeRelationship(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return 'OTHER';
  return value.trim().toUpperCase();
}

function normalizeLabel(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return 'Family subject';
  return value.trim();
}

export function summarizeAppointmentSubjectMeta(items: AppointmentSubjectMeta[]): SubjectSummary {
  const summary = createEmptySummary();
  for (const item of items) {
    summary.total += 1;
    if (item.isFamilySubject) {
      summary.familyCount += 1;
      const relationship = normalizeRelationship(item.subjectRelationship);
      summary.byRelationship[relationship] = (summary.byRelationship[relationship] ?? 0) + 1;
      const label = normalizeLabel(item.subjectLabel);
      summary.byLabel[label] = (summary.byLabel[label] ?? 0) + 1;
      if (!summary.latestFamilyLabel) {
        summary.latestFamilyLabel = label;
      }
    } else {
      summary.selfCount += 1;
    }
  }
  return summary;
}

export function summarizeAuditSubjectContexts(items: Array<{ details?: unknown } | unknown>): SubjectSummary {
  const summary = createEmptySummary();
  for (const item of items) {
    const details = item && typeof item === 'object' && 'details' in (item as any) ? (item as any).details : item;
    const subject = extractAuditSubjectContext(details);
    summary.total += 1;
    if (subject?.isFamilySubject) {
      summary.familyCount += 1;
      const relationship = normalizeRelationship(subject.subjectRelationship);
      summary.byRelationship[relationship] = (summary.byRelationship[relationship] ?? 0) + 1;
      const label = normalizeLabel(subject.subjectLabel);
      summary.byLabel[label] = (summary.byLabel[label] ?? 0) + 1;
      if (!summary.latestFamilyLabel) {
        summary.latestFamilyLabel = label;
      }
    } else {
      summary.selfCount += 1;
    }
  }
  return summary;
}

export function mergeSubjectSummaries(...summaries: SubjectSummary[]): SubjectSummary {
  const merged = createEmptySummary();
  for (const summary of summaries) {
    merged.total += summary.total;
    merged.selfCount += summary.selfCount;
    merged.familyCount += summary.familyCount;
    for (const [relationship, count] of Object.entries(summary.byRelationship)) {
      merged.byRelationship[relationship] = (merged.byRelationship[relationship] ?? 0) + count;
    }
    for (const [label, count] of Object.entries(summary.byLabel)) {
      merged.byLabel[label] = (merged.byLabel[label] ?? 0) + count;
    }
    if (!merged.latestFamilyLabel && summary.latestFamilyLabel) {
      merged.latestFamilyLabel = summary.latestFamilyLabel;
    }
  }
  return merged;
}

export function formatSubjectSummary(summary: SubjectSummary) {
  const topRelationship = Object.entries(summary.byRelationship).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const topLabel = Object.entries(summary.byLabel).sort((a, b) => b[1] - a[1])[0]?.[0] ?? summary.latestFamilyLabel ?? null;
  return {
    total: summary.total,
    selfCount: summary.selfCount,
    familyCount: summary.familyCount,
    topRelationship,
    topLabel,
    byRelationship: summary.byRelationship,
    byLabel: summary.byLabel,
  };
}

export function summarizeExportItemsBySubject(items: Array<{ subjectContext?: { isFamilySubject?: boolean | null; subjectRelationship?: string | null; subjectLabel?: string | null } | null }>) {
  const summary = createEmptySummary();
  for (const item of items) {
    summary.total += 1;
    if (item.subjectContext?.isFamilySubject) {
      summary.familyCount += 1;
      const relationship = normalizeRelationship(item.subjectContext.subjectRelationship);
      summary.byRelationship[relationship] = (summary.byRelationship[relationship] ?? 0) + 1;
      const label = normalizeLabel(item.subjectContext.subjectLabel);
      summary.byLabel[label] = (summary.byLabel[label] ?? 0) + 1;
      if (!summary.latestFamilyLabel) summary.latestFamilyLabel = label;
    } else {
      summary.selfCount += 1;
    }
  }
  return formatSubjectSummary(summary);
}
