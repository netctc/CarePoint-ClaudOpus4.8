import { randomUUID } from 'crypto';
import { prisma } from './prisma';
import { writeAuditLog } from './audit';
import { notFound } from './http';

type GrowthKind = 'reports' | 'campaigns' | 'integrations' | 'moderation';
type StorageMode = 'model' | 'audit_fallback';

type BaseContext = {
  organizationId: string;
  actorId?: string;
};

type GrowthItem = Record<string, any> & {
  id: string;
  organizationId: string;
  code: string;
  title: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

const reportDefaults = (organizationId: string) => [
  {
    id: 'report-utilization-weekly',
    organizationId,
    code: 'UTILIZATION_WEEKLY',
    title: 'Weekly Utilization Watch',
    status: 'PUBLISHED',
    category: 'OPERATIONS',
    ownerRole: 'COMPANY_SUPPORT',
    schedule: 'WEEKLY',
    destination: 'ops@carecenter.local',
    metricKeys: ['bookings', 'telehealth', 'refunds'],
    summary: 'Tracks weekly booking conversion, telehealth completion, and refund trends.',
    tags: ['ops', 'weekly'],
    version: 3,
    lastRunAt: new Date('2026-03-31T07:00:00.000Z'),
    createdAt: new Date('2025-11-01T09:00:00.000Z'),
    updatedAt: new Date('2026-03-31T07:00:00.000Z'),
  },
  {
    id: 'report-finance-monthly',
    organizationId,
    code: 'FINANCE_MONTHLY',
    title: 'Monthly Finance Close Pack',
    status: 'DRAFT',
    category: 'FINANCE',
    ownerRole: 'FINANCE',
    schedule: 'MONTHLY',
    destination: 'finance@carecenter.local',
    metricKeys: ['captured_amount', 'refund_rate', 'holds'],
    summary: 'Monthly finance close pack with payment hold and refund exception analysis.',
    tags: ['finance', 'monthly'],
    version: 1,
    lastRunAt: null,
    createdAt: new Date('2026-03-20T09:30:00.000Z'),
    updatedAt: new Date('2026-03-30T12:10:00.000Z'),
  },
] satisfies GrowthItem[];

const campaignDefaults = (organizationId: string) => [
  {
    id: 'camp-telehealth-adoption',
    organizationId,
    code: 'TELEHEALTH_ADOPTION_Q2',
    title: 'Telehealth Adoption Nudges',
    status: 'APPROVED',
    audience: 'PATIENTS',
    channel: 'EMAIL',
    ownerRole: 'COMPANY_SUPPORT',
    scheduledFor: new Date('2026-04-05T08:00:00.000Z'),
    suppressionCount: 124,
    deliverySummary: { sent: 0, failed: 0 },
    summary: 'Patient re-engagement campaign for follow-up visits eligible for telehealth.',
    tags: ['telehealth', 'engagement'],
    createdAt: new Date('2026-03-18T10:00:00.000Z'),
    updatedAt: new Date('2026-03-29T16:30:00.000Z'),
  },
  {
    id: 'camp-provider-reminders',
    organizationId,
    code: 'PROVIDER_REMINDERS',
    title: 'Provider Documentation Reminders',
    status: 'DRAFT',
    audience: 'PROVIDERS',
    channel: 'IN_APP',
    ownerRole: 'COMPANY_ADMIN',
    scheduledFor: null,
    suppressionCount: 0,
    deliverySummary: { sent: 0, failed: 0 },
    summary: 'Reminder flow for incomplete notes and unsigned visit records.',
    tags: ['provider', 'compliance'],
    createdAt: new Date('2026-03-28T11:15:00.000Z'),
    updatedAt: new Date('2026-03-30T10:45:00.000Z'),
  },
] satisfies GrowthItem[];

const integrationDefaults = (organizationId: string) => [
  {
    id: 'int-stripe',
    organizationId,
    code: 'STRIPE',
    title: 'Stripe Payments',
    status: 'ACTIVE',
    provider: 'Stripe',
    category: 'PAYMENTS',
    environment: 'PRODUCTION',
    ownerRole: 'COMPANY_ADMIN',
    lastHealthStatus: 'HEALTHY',
    lastCheckedAt: new Date('2026-04-01T08:15:00.000Z'),
    lastRotatedAt: new Date('2026-02-10T09:00:00.000Z'),
    summary: 'Primary online payments integration for card capture and refund workflows.',
    tags: ['payments', 'critical'],
    createdAt: new Date('2025-06-01T09:00:00.000Z'),
    updatedAt: new Date('2026-04-01T08:15:00.000Z'),
  },
  {
    id: 'int-daily',
    organizationId,
    code: 'DAILY_TELEHEALTH',
    title: 'Daily Telehealth',
    status: 'DEGRADED',
    provider: 'Daily',
    category: 'TELEHEALTH',
    environment: 'PRODUCTION',
    ownerRole: 'COMPANY_SUPPORT',
    lastHealthStatus: 'DEGRADED',
    lastCheckedAt: new Date('2026-04-01T07:40:00.000Z'),
    lastRotatedAt: new Date('2026-01-19T11:00:00.000Z'),
    summary: 'Telehealth session orchestration and meeting link generation.',
    tags: ['telehealth', 'vendor'],
    createdAt: new Date('2025-06-10T10:30:00.000Z'),
    updatedAt: new Date('2026-04-01T07:40:00.000Z'),
  },
] satisfies GrowthItem[];

const moderationDefaults = (organizationId: string) => [
  {
    id: 'mod-review-001',
    organizationId,
    code: 'MOD-3001',
    title: 'Potential fake five-star review cluster',
    status: 'OPEN',
    queue: 'Trust & Safety',
    priority: 'HIGH',
    source: 'PATIENT_REVIEW',
    riskSignals: ['velocity_spike', 'shared_device'],
    ownerName: null,
    reviewerUserId: null,
    disputedEntity: 'provider-profile-01',
    summary: 'Multiple new five-star reviews posted within a short window from overlapping device fingerprints.',
    tags: ['fraud', 'reviews'],
    createdAt: new Date('2026-03-31T09:05:00.000Z'),
    updatedAt: new Date('2026-03-31T09:05:00.000Z'),
  },
  {
    id: 'mod-review-002',
    organizationId,
    code: 'MOD-3002',
    title: 'Abusive language in provider feedback',
    status: 'ESCALATED',
    queue: 'Trust & Safety',
    priority: 'MEDIUM',
    source: 'PATIENT_REVIEW',
    riskSignals: ['abuse_classifier'],
    ownerName: 'Support Lead',
    reviewerUserId: 'ops-support',
    disputedEntity: 'provider-profile-02',
    summary: 'Review flagged by abuse classifier and escalated for manual moderation.',
    tags: ['abuse', 'moderation'],
    createdAt: new Date('2026-03-30T13:25:00.000Z'),
    updatedAt: new Date('2026-03-31T11:00:00.000Z'),
  },
] satisfies GrowthItem[];

const growthConfigs = {
  reports: {
    modelName: 'reportDefinition',
    resource: 'report_definition',
    defaultItems: reportDefaults,
    listOrderKey: 'updatedAt',
  },
  campaigns: {
    modelName: 'campaign',
    resource: 'campaign',
    defaultItems: campaignDefaults,
    listOrderKey: 'updatedAt',
  },
  integrations: {
    modelName: 'integrationConnection',
    resource: 'integration_connection',
    defaultItems: integrationDefaults,
    listOrderKey: 'updatedAt',
  },
  moderation: {
    modelName: 'moderationCase',
    resource: 'moderation_case',
    defaultItems: moderationDefaults,
    listOrderKey: 'updatedAt',
  },
} as const satisfies Record<GrowthKind, {
  modelName: string;
  resource: string;
  defaultItems: (organizationId: string) => GrowthItem[];
  listOrderKey: string;
}>;

function toAuditJson(value: unknown): any {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((entry) => toAuditJson(entry));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, toAuditJson(entry)]));
  }
  return value ?? null;
}

function getModel(kind: GrowthKind): any | null {
  const candidate = (prisma as any)[growthConfigs[kind].modelName];
  if (candidate && typeof candidate.findMany === 'function' && typeof candidate.upsert === 'function') {
    return candidate;
  }
  return null;
}

export function getGrowthStorageMode(kind: GrowthKind): StorageMode {
  return getModel(kind) ? 'model' : 'audit_fallback';
}

function normalizeModelItem(row: any): GrowthItem {
  const data = row.data && typeof row.data === 'object' ? row.data : {};
  return {
    ...data,
    id: row.id,
    organizationId: row.organizationId,
    code: row.code,
    title: row.title ?? data.title ?? data.name,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalizeInput(input: Record<string, any>, organizationId: string, existing?: GrowthItem | null): GrowthItem {
  const now = new Date();
  const id = String(input.id ?? existing?.id ?? randomUUID());
  const code = String(input.code ?? existing?.code ?? '').trim().toUpperCase();
  const title = String(input.title ?? input.name ?? existing?.title ?? existing?.name ?? '').trim();

  return {
    ...(existing ?? {}),
    ...input,
    id,
    organizationId,
    code,
    title,
    status: String(input.status ?? existing?.status ?? 'DRAFT').trim().toUpperCase(),
    createdAt: existing?.createdAt ? new Date(existing.createdAt) : now,
    updatedAt: now,
  };
}

async function listFallbackItems(kind: GrowthKind, organizationId: string): Promise<GrowthItem[]> {
  const baseItems = growthConfigs[kind].defaultItems(organizationId);
  const map = new Map<string, GrowthItem>(baseItems.map((item) => [item.id, item] as const));
  const logs = await prisma.auditLog.findMany({
    where: {
      organizationId,
      resource: growthConfigs[kind].resource,
    },
    orderBy: { createdAt: 'asc' },
  });

  for (const log of logs) {
    const details = log.details && typeof log.details === 'object' ? (log.details as Record<string, any>) : {};
    const snapshot = details.snapshot && typeof details.snapshot === 'object' ? (details.snapshot as Record<string, any>) : null;
    if (!snapshot?.id) {
      continue;
    }
    const existing = map.get(String(snapshot.id));
    map.set(String(snapshot.id), normalizeInput(snapshot, organizationId, existing));
  }

  return Array.from(map.values()).sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
}

export async function listGrowthItems(kind: GrowthKind, organizationId: string): Promise<GrowthItem[]> {
  const model = getModel(kind);
  if (model) {
    const rows = await model.findMany({
      where: { organizationId },
      orderBy: { [growthConfigs[kind].listOrderKey]: 'desc' },
    });
    return rows.map(normalizeModelItem);
  }

  return listFallbackItems(kind, organizationId);
}

export async function getGrowthItem(kind: GrowthKind, itemId: string, organizationId: string): Promise<GrowthItem> {
  const model = getModel(kind);
  if (model) {
    const row = await model.findUnique({ where: { id: itemId } });
    if (!row || row.organizationId !== organizationId) {
      throw notFound(`${kind} item not found`);
    }
    return normalizeModelItem(row);
  }

  const items = await listFallbackItems(kind, organizationId);
  const item = items.find((entry) => entry.id === itemId);
  if (!item) {
    throw notFound(`${kind} item not found`);
  }
  return item;
}

export async function summarizeGrowthItems(kind: GrowthKind, organizationId: string) {
  const items = await listGrowthItems(kind, organizationId);
  return items.reduce(
    (acc, item) => {
      acc.total += 1;
      acc.byStatus[item.status] = (acc.byStatus[item.status] ?? 0) + 1;
      if (['PUBLISHED', 'APPROVED', 'ACTIVE', 'RESOLVED'].includes(item.status)) {
        acc.ready += 1;
      }
      if (['DEGRADED', 'OPEN', 'ESCALATED', 'REJECTED', 'ARCHIVED'].includes(item.status)) {
        acc.attentionRequired += 1;
      }
      return acc;
    },
    {
      total: 0,
      ready: 0,
      attentionRequired: 0,
      byStatus: {} as Record<string, number>,
    },
  );
}

export async function upsertGrowthItem(kind: GrowthKind, input: Record<string, any>, context: BaseContext): Promise<GrowthItem> {
  const model = getModel(kind);
  const existing = input.id ? await getGrowthItem(kind, String(input.id), context.organizationId).catch(() => null) : null;
  const item = normalizeInput(input, context.organizationId, existing);

  if (model) {
    const row = await model.upsert({
      where: { id: item.id },
      create: {
        id: item.id,
        organizationId: item.organizationId,
        code: item.code,
        title: item.title,
        status: item.status,
        data: item,
      },
      update: {
        code: item.code,
        title: item.title,
        status: item.status,
        data: item,
      },
    });
    return normalizeModelItem(row);
  }

  await writeAuditLog({
    actorId: context.actorId,
    organizationId: context.organizationId,
    action: `${kind}.upserted`,
    resource: growthConfigs[kind].resource,
    resourceId: item.id,
    details: {
      snapshot: toAuditJson(item),
      source: 'audit_fallback',
    },
  });

  return item;
}

export async function transitionGrowthItem(kind: GrowthKind, itemId: string, status: string, context: BaseContext, note?: string | null, patch?: Record<string, any>): Promise<GrowthItem> {
  const existing = await getGrowthItem(kind, itemId, context.organizationId);
  const item = normalizeInput(
    {
      ...existing,
      ...(patch ?? {}),
      status,
      lastNote: note ?? existing.lastNote ?? null,
      lastActionAt: new Date(),
    },
    context.organizationId,
    existing,
  );

  const model = getModel(kind);
  if (model) {
    const row = await model.update({
      where: { id: item.id },
      data: {
        code: item.code,
        title: item.title,
        status: item.status,
        data: item,
      },
    });

    await writeAuditLog({
      actorId: context.actorId,
      organizationId: context.organizationId,
      action: `${kind}.status_changed`,
      resource: growthConfigs[kind].resource,
      resourceId: item.id,
      details: {
        previousStatus: existing.status,
        nextStatus: item.status,
        note: note ?? null,
      },
    });

    return normalizeModelItem(row);
  }

  await writeAuditLog({
    actorId: context.actorId,
    organizationId: context.organizationId,
    action: `${kind}.status_changed`,
    resource: growthConfigs[kind].resource,
    resourceId: item.id,
    details: {
      previousStatus: existing.status,
      nextStatus: item.status,
      note: note ?? null,
      snapshot: toAuditJson(item),
      source: 'audit_fallback',
    },
  });

  return item;
}
