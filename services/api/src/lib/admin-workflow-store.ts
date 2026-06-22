import { randomUUID } from 'crypto';
import { prisma } from './prisma';
import { writeAuditLog } from './audit';
import { notFound } from './http';

type WorkflowKind = 'support' | 'safety';
type StorageMode = 'model' | 'audit_fallback';

type BaseContext = {
  organizationId: string;
  actorId?: string;
};

type WorkflowItem = Record<string, any> & {
  id: string;
  organizationId: string;
  code: string;
  title: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

const supportDefaults = (organizationId: string) => [
  {
    id: 'sup-billing-dispute-001',
    organizationId,
    code: 'SUP-1001',
    title: 'Billing dispute for missed refund promise',
    status: 'OPEN',
    priority: 'HIGH',
    category: 'BILLING',
    channel: 'EMAIL',
    queue: 'Finance Support',
    requesterName: 'Nadine Saab',
    assigneeUserId: null,
    assigneeName: null,
    summary: 'Patient reports that a same-day cancellation refund was promised but has not been issued.',
    tags: ['refund', 'billing'],
    createdAt: new Date('2026-03-25T09:00:00.000Z'),
    updatedAt: new Date('2026-03-30T10:20:00.000Z'),
  },
  {
    id: 'sup-provider-portal-002',
    organizationId,
    code: 'SUP-1002',
    title: 'Provider cannot complete appointment notes',
    status: 'ESCALATED',
    priority: 'MEDIUM',
    category: 'PORTAL',
    channel: 'CHAT',
    queue: 'Provider Operations',
    requesterName: 'Dr. Omar Hasan',
    assigneeUserId: 'ops-provider',
    assigneeName: 'Provider Ops',
    summary: 'Provider notes form errors after telehealth session completion.',
    tags: ['provider', 'records'],
    createdAt: new Date('2026-03-26T11:30:00.000Z'),
    updatedAt: new Date('2026-03-31T15:45:00.000Z'),
  },
] as WorkflowItem[];

const safetyDefaults = (organizationId: string) => [
  {
    id: 'safe-medication-001',
    organizationId,
    code: 'SAFE-2001',
    title: 'Medication dosage follow-up required',
    status: 'UNDER_REVIEW',
    severity: 'HIGH',
    category: 'CLINICAL',
    queue: 'Clinical Safety',
    patientImpact: 'Potential',
    ownerName: 'Dr. Reem Nader',
    summary: 'Case opened after patient message suggested dosage confusion following dermatology visit.',
    tags: ['medication', 'follow-up'],
    createdAt: new Date('2026-03-24T08:15:00.000Z'),
    updatedAt: new Date('2026-03-29T12:10:00.000Z'),
  },
  {
    id: 'safe-telehealth-002',
    organizationId,
    code: 'SAFE-2002',
    title: 'Telehealth identity verification gap',
    status: 'NEW',
    severity: 'MEDIUM',
    category: 'PROCESS',
    queue: 'Operations Safety',
    patientImpact: 'None confirmed',
    ownerName: null,
    summary: 'Recording review found identity verification was skipped before visit start.',
    tags: ['telehealth', 'identity'],
    createdAt: new Date('2026-03-30T07:45:00.000Z'),
    updatedAt: new Date('2026-03-30T07:45:00.000Z'),
  },
] as WorkflowItem[];

const workflows = {
  support: {
    modelName: 'supportWorkItem',
    resource: 'support_work_item',
    defaultItems: supportDefaults,
    listOrderKey: 'updatedAt',
  },
  safety: {
    modelName: 'safetyCase',
    resource: 'safety_case',
    defaultItems: safetyDefaults,
    listOrderKey: 'updatedAt',
  },
} as const satisfies Record<WorkflowKind, {
  modelName: string;
  resource: string;
  defaultItems: (organizationId: string) => WorkflowItem[];
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

function getModel(kind: WorkflowKind): any | null {
  const candidate = (prisma as any)[workflows[kind].modelName];
  if (candidate && typeof candidate.findMany === 'function' && typeof candidate.upsert === 'function') {
    return candidate;
  }
  return null;
}

export function getWorkflowStorageMode(kind: WorkflowKind): StorageMode {
  return getModel(kind) ? 'model' : 'audit_fallback';
}

function normalizeModelItem(row: any): WorkflowItem {
  const data = row.data && typeof row.data === 'object' ? row.data : {};
  return {
    ...data,
    id: row.id,
    organizationId: row.organizationId,
    code: row.code,
    title: row.title ?? data.title,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalizeInput(input: Record<string, any>, organizationId: string, existing?: WorkflowItem | null): WorkflowItem {
  const now = new Date();
  const id = String(input.id ?? existing?.id ?? randomUUID());
  const code = String(input.code ?? existing?.code ?? '').trim().toUpperCase();
  const title = String(input.title ?? existing?.title ?? '').trim();

  return {
    ...(existing ?? {}),
    ...input,
    id,
    organizationId,
    code,
    title,
    status: String(input.status ?? existing?.status ?? 'OPEN').trim().toUpperCase(),
    createdAt: existing?.createdAt ? new Date(existing.createdAt) : now,
    updatedAt: now,
  };
}

async function listFallbackItems(kind: WorkflowKind, organizationId: string) {
  const baseItems = workflows[kind].defaultItems(organizationId);
  const map = new Map(baseItems.map((item) => [item.id, item]));
  const logs = await prisma.auditLog.findMany({
    where: {
      organizationId,
      resource: workflows[kind].resource,
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

export async function listWorkflowItems(kind: WorkflowKind, organizationId: string) {
  const model = getModel(kind);
  if (model) {
    const rows = await model.findMany({
      where: { organizationId },
      orderBy: { [workflows[kind].listOrderKey]: 'desc' },
    });
    return rows.map(normalizeModelItem);
  }

  return listFallbackItems(kind, organizationId);
}

export async function getWorkflowItem(kind: WorkflowKind, itemId: string, organizationId: string) {
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

export async function summarizeWorkflowItems(kind: WorkflowKind, organizationId: string) {
  const items = await listWorkflowItems(kind, organizationId);
  const summary = items.reduce(
    (acc, item) => {
      acc.total += 1;
      acc.byStatus[item.status] = (acc.byStatus[item.status] ?? 0) + 1;
      const bucket = String(item.priority ?? item.severity ?? '').trim().toUpperCase();
      if (bucket) {
        acc.byRisk[bucket] = (acc.byRisk[bucket] ?? 0) + 1;
      }
      if (item.assigneeUserId || item.ownerName || item.assigneeName) {
        acc.assigned += 1;
      }
      return acc;
    },
    {
      total: 0,
      assigned: 0,
      byStatus: {} as Record<string, number>,
      byRisk: {} as Record<string, number>,
    },
  );

  return summary;
}

export async function upsertWorkflowItem(kind: WorkflowKind, input: Record<string, any>, context: BaseContext) {
  const model = getModel(kind);
  const existing = input.id ? await getWorkflowItem(kind, String(input.id), context.organizationId).catch(() => null) : null;
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
    resource: workflows[kind].resource,
    resourceId: item.id,
    details: {
      snapshot: toAuditJson(item),
      source: 'audit_fallback',
    },
  });

  return item;
}

export async function transitionWorkflowItem(
  kind: WorkflowKind,
  itemId: string,
  status: string,
  context: BaseContext,
  note?: string | null,
  patch?: Record<string, any>,
) {
  const existing = await getWorkflowItem(kind, itemId, context.organizationId);
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
      resource: workflows[kind].resource,
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
    resource: workflows[kind].resource,
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
