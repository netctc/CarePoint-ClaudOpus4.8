import { randomUUID } from 'crypto';
import { prisma } from './prisma';
import { writeAuditLog } from './audit';
import { notFound } from './http';

type StorageMode = 'model' | 'audit_fallback';

type ConsentContext = {
  organizationId: string;
  actorId?: string;
  patientId?: string | null;
};

type ConsentItem = Record<string, any> & {
  id: string;
  organizationId: string;
  patientId?: string | null;
  title: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

const defaults = (organizationId: string, patientId?: string | null) => [
  {
    id: 'consent-telehealth',
    organizationId,
    patientId,
    title: 'Telehealth consent',
    consentType: 'TELEHEALTH',
    versionLabel: 'v1.0',
    locale: 'en',
    description: 'Consent for remote consultation, device checks, and telehealth disclaimers.',
    status: 'PENDING',
    acceptedAt: null,
    revokedAt: null,
    createdAt: new Date('2026-04-01T08:00:00.000Z'),
    updatedAt: new Date('2026-04-01T08:00:00.000Z'),
  },
  {
    id: 'consent-data-sharing',
    organizationId,
    patientId,
    title: 'Data sharing consent',
    consentType: 'DATA_SHARING',
    versionLabel: 'v1.0',
    locale: 'en',
    description: 'Consent for sharing records and care coordination data with authorized providers.',
    status: 'PENDING',
    acceptedAt: null,
    revokedAt: null,
    createdAt: new Date('2026-04-01T08:00:00.000Z'),
    updatedAt: new Date('2026-04-01T08:00:00.000Z'),
  },
] satisfies ConsentItem[];

function getModel(): any | null {
  const candidate = (prisma as any).patientConsentRecord;
  if (candidate && typeof candidate.findMany === 'function' && typeof candidate.upsert === 'function') {
    return candidate;
  }
  return null;
}

export function getPatientConsentStorageMode(): StorageMode {
  return getModel() ? 'model' : 'audit_fallback';
}

function normalizeModelItem(row: any): ConsentItem {
  const data = row.data && typeof row.data === 'object' ? row.data : {};
  return {
    ...data,
    id: row.id,
    organizationId: row.organizationId,
    patientId: row.patientId ?? data.patientId ?? null,
    title: data.title ?? data.consentType ?? row.name ?? row.id,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalizeItem(input: Record<string, any>, context: ConsentContext, existing?: ConsentItem | null): ConsentItem {
  const now = new Date();
  return {
    ...(existing ?? {}),
    ...input,
    id: String(input.id ?? existing?.id ?? randomUUID()),
    organizationId: context.organizationId,
    patientId: input.patientId ?? existing?.patientId ?? context.patientId ?? null,
    title: String(input.title ?? input.consentType ?? existing?.title ?? 'Consent').trim(),
    status: String(input.status ?? existing?.status ?? 'PENDING').trim().toUpperCase(),
    createdAt: existing?.createdAt ? new Date(existing.createdAt) : now,
    updatedAt: now,
  };
}

async function listFallbackItems(organizationId: string, patientId?: string | null): Promise<ConsentItem[]> {
  const map = new Map<string, ConsentItem>(defaults(organizationId, patientId).map((item) => [item.id, item] as const));
  const logs = await prisma.auditLog.findMany({
    where: {
      organizationId,
      resource: 'patient_consent_record',
    },
    orderBy: { createdAt: 'asc' },
  });

  for (const log of logs) {
    const details = log.details && typeof log.details === 'object' ? (log.details as Record<string, any>) : {};
    const snapshot = details.snapshot && typeof details.snapshot === 'object' ? (details.snapshot as Record<string, any>) : null;
    if (!snapshot?.id) continue;
    if (patientId && snapshot.patientId && snapshot.patientId !== patientId) continue;
    const existing = map.get(String(snapshot.id));
    map.set(String(snapshot.id), normalizeItem(snapshot, { organizationId, patientId }, existing));
  }

  return Array.from(map.values()).sort((a, b) => +new Date(a.title) - +new Date(b.title));
}

async function getPublishedPolicyVersion(organizationId: string, consentType: string) {
  const items = await prisma.auditLog.findMany({
    where: {
      organizationId,
      resource: 'policy_template',
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const typeKey = consentType.trim().toUpperCase();
  for (const log of items) {
    const details = log.details && typeof log.details === 'object' ? (log.details as Record<string, any>) : {};
    const snapshot = details.snapshot && typeof details.snapshot === 'object' ? (details.snapshot as Record<string, any>) : null;
    if (!snapshot) continue;
    const category = String(snapshot.category ?? '').trim().toUpperCase();
    const code = String(snapshot.code ?? '').trim().toUpperCase();
    const appliesTo = Array.isArray(snapshot.appliesTo) ? snapshot.appliesTo.map((entry: unknown) => String(entry).trim().toUpperCase()) : [];
    const status = String(snapshot.status ?? '').trim().toUpperCase();
    if (status && status !== 'PUBLISHED') continue;
    if (category.includes('CONSENT') && (code.includes(typeKey) || appliesTo.includes('PATIENT'))) {
      return String(snapshot.versionLabel ?? snapshot.version ?? 'v1.0');
    }
  }
  return 'v1.0';
}

export async function listPatientConsentItems(organizationId: string, patientId?: string | null): Promise<ConsentItem[]> {
  const model = getModel();
  if (model) {
    const rows = await model.findMany({ where: { organizationId, patientId: patientId ?? null }, orderBy: { updatedAt: 'desc' } });
    return rows.map(normalizeModelItem);
  }
  return listFallbackItems(organizationId, patientId);
}

export async function getPatientConsentItem(itemId: string, organizationId: string, patientId?: string | null) {
  const model = getModel();
  if (model) {
    const row = await model.findUnique({ where: { id: itemId } });
    if (!row || row.organizationId !== organizationId || (patientId && row.patientId !== patientId)) {
      throw notFound('Consent record not found');
    }
    return normalizeModelItem(row);
  }

  const items = await listFallbackItems(organizationId, patientId);
  const item = items.find((entry) => entry.id === itemId || String(entry.consentType ?? '').toUpperCase() === itemId.toUpperCase());
  if (!item) throw notFound('Consent record not found');
  return item;
}

export async function summarizePatientConsentItems(organizationId: string, patientId?: string | null) {
  const items = await listPatientConsentItems(organizationId, patientId);
  return {
    total: items.length,
    acceptedCount: items.filter((item) => item.status === 'ACCEPTED').length,
    pendingCount: items.filter((item) => item.status === 'PENDING').length,
    revokedCount: items.filter((item) => item.status === 'REVOKED').length,
  };
}

export async function upsertPatientConsentItem(input: Record<string, any>, context: ConsentContext) {
  const model = getModel();
  const existing = input.id ? await getPatientConsentItem(String(input.id), context.organizationId, context.patientId).catch(() => null) : null;
  const versionLabel = input.versionLabel ?? await getPublishedPolicyVersion(context.organizationId, String(input.consentType ?? existing?.consentType ?? 'CONSENT'));
  const item = normalizeItem({ ...input, versionLabel }, context, existing);

  if (model) {
    const row = await model.upsert({
      where: { id: item.id },
      create: {
        id: item.id,
        organizationId: item.organizationId,
        patientId: item.patientId ?? null,
        name: item.title,
        status: item.status,
        data: item,
      },
      update: {
        name: item.title,
        status: item.status,
        data: item,
      },
    });

    await writeAuditLog({
      actorId: context.actorId,
      organizationId: context.organizationId,
      action: existing ? 'patient.consent_updated' : 'patient.consent_created',
      resource: 'patient_consent_record',
      resourceId: item.id,
      details: { snapshot: item },
    });

    return normalizeModelItem(row);
  }

  await writeAuditLog({
    actorId: context.actorId,
    organizationId: context.organizationId,
    action: existing ? 'patient.consent_updated' : 'patient.consent_created',
    resource: 'patient_consent_record',
    resourceId: item.id,
    details: { snapshot: item },
  });

  return item;
}

export async function listPatientConsentHistory(organizationId: string, patientId?: string | null) {
  const rows = await prisma.auditLog.findMany({
    where: {
      organizationId,
      resource: 'patient_consent_record',
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return rows
    .map((row) => {
      const details = row.details && typeof row.details === 'object' ? (row.details as Record<string, any>) : {};
      const snapshot = details.snapshot && typeof details.snapshot === 'object' ? (details.snapshot as Record<string, any>) : null;
      if (!snapshot) return null;
      if (patientId && snapshot.patientId && snapshot.patientId !== patientId) return null;
      return {
        id: row.id,
        at: row.createdAt,
        actorId: row.actorId,
        action: row.action,
        consentType: snapshot.consentType ?? null,
        status: snapshot.status ?? null,
        versionLabel: snapshot.versionLabel ?? null,
        locale: snapshot.locale ?? null,
        note: snapshot.note ?? null,
      };
    })
    .filter(Boolean);
}
