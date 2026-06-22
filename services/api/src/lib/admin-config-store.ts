import { randomUUID } from 'crypto';
import { prisma } from './prisma';
import { writeAuditLog } from './audit';
import { notFound } from './http';

type ConfigKind = 'catalog' | 'coverage' | 'pricing' | 'policy';
type StorageMode = 'model' | 'audit_fallback';

type BaseContext = {
  organizationId: string;
  actorId?: string;
};

type ConfigItem = Record<string, any> & {
  id: string;
  organizationId: string;
  code: string;
  status: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

const catalogDefaults = (organizationId: string) => [
  {
    id: 'svc-primary-care',
    organizationId,
    code: 'PRIMARY_CARE',
    name: 'Primary Care Consultation',
    category: 'Consultation',
    description: 'General family medicine consultation for new and existing patients.',
    serviceModes: ['IN_PERSON', 'TELEHEALTH'],
    durationMinutes: 30,
    requiresCoverageCheck: true,
    requiresLicenseValidation: true,
    status: 'PUBLISHED',
    version: 3,
    tags: ['core', 'primary-care'],
    createdAt: new Date('2025-10-15T09:00:00.000Z'),
    updatedAt: new Date('2026-03-20T11:00:00.000Z'),
  },
  {
    id: 'svc-dermatology-followup',
    organizationId,
    code: 'DERM_FOLLOWUP',
    name: 'Dermatology Follow-up',
    category: 'Specialty',
    description: 'Follow-up appointment for skin condition review and treatment adjustments.',
    serviceModes: ['IN_PERSON', 'TELEHEALTH'],
    durationMinutes: 20,
    requiresCoverageCheck: true,
    requiresLicenseValidation: true,
    status: 'DRAFT',
    version: 2,
    tags: ['specialty', 'dermatology'],
    createdAt: new Date('2026-01-10T10:30:00.000Z'),
    updatedAt: new Date('2026-03-28T15:45:00.000Z'),
  },
] satisfies ConfigItem[];

const coverageDefaults = (organizationId: string) => [
  {
    id: 'cov-standard-commercial',
    organizationId,
    code: 'COMMERCIAL_STANDARD',
    name: 'Commercial Standard Coverage',
    payer: 'Global Assurance',
    planType: 'PPO',
    serviceCodes: ['PRIMARY_CARE', 'DERM_FOLLOWUP'],
    regions: ['LB', 'AE'],
    authorizationRequired: false,
    bookingLeadHours: 2,
    telehealthAllowed: true,
    weekendSlotsAllowed: true,
    weekendCalendar: 'Fri-Sat standard schedule',
    blockedFacilities: [],
    blockedChannels: [],
    cityExceptions: ['Remote districts require support review'],
    status: 'ACTIVE',
    version: 4,
    createdAt: new Date('2025-09-01T08:00:00.000Z'),
    updatedAt: new Date('2026-03-26T09:30:00.000Z'),
  },
  {
    id: 'cov-enterprise-prior-auth',
    organizationId,
    code: 'ENTERPRISE_PRIOR_AUTH',
    name: 'Enterprise Prior Auth Policy',
    payer: 'Enterprise Health',
    planType: 'Corporate',
    serviceCodes: ['DERM_FOLLOWUP'],
    regions: ['LB'],
    authorizationRequired: true,
    bookingLeadHours: 24,
    telehealthAllowed: false,
    weekendSlotsAllowed: false,
    weekendCalendar: 'No weekend booking without admin exception',
    blockedFacilities: ['Main Clinic'],
    blockedChannels: ['TELEHEALTH'],
    cityExceptions: ['Rural outreach requires manual review'],
    status: 'DRAFT',
    version: 1,
    createdAt: new Date('2026-02-14T13:00:00.000Z'),
    updatedAt: new Date('2026-03-29T16:20:00.000Z'),
  },
] satisfies ConfigItem[];

const pricingDefaults = (organizationId: string) => [
  {
    id: 'prc-primary-care-default',
    organizationId,
    code: 'PRIMARY_CARE_DEFAULT',
    name: 'Primary Care Base Rate',
    serviceCode: 'PRIMARY_CARE',
    visitType: 'STANDARD',
    currency: 'USD',
    baseAmountMinor: 5500,
    providerCommissionBps: 7000,
    organizationCommissionBps: 3000,
    refundWindowHours: 24,
    status: 'PUBLISHED',
    version: 5,
    createdAt: new Date('2025-08-05T09:15:00.000Z'),
    updatedAt: new Date('2026-03-18T12:00:00.000Z'),
  },
  {
    id: 'prc-derm-followup-exp',
    organizationId,
    code: 'DERM_FOLLOWUP_EXPERIMENT',
    name: 'Derm Follow-up Experiment',
    serviceCode: 'DERM_FOLLOWUP',
    visitType: 'FOLLOW_UP',
    currency: 'USD',
    baseAmountMinor: 4500,
    providerCommissionBps: 6800,
    organizationCommissionBps: 3200,
    refundWindowHours: 12,
    status: 'DRAFT',
    version: 1,
    createdAt: new Date('2026-03-01T10:00:00.000Z'),
    updatedAt: new Date('2026-03-30T08:45:00.000Z'),
  },
] satisfies ConfigItem[];

const policyDefaults = (organizationId: string) => [
  {
    id: 'pol-consent-telehealth',
    organizationId,
    code: 'TELEHEALTH_CONSENT',
    name: 'Telehealth Consent Policy',
    title: 'Telehealth Consent Policy',
    category: 'Compliance',
    description: 'Required consent steps for telehealth appointments and recording permissions.',
    appliesTo: ['TELEHEALTH'],
    approvalRoles: ['COMPANY_ADMIN', 'COMPANY_SUPPORT'],
    content: {
      sections: ['Consent collection', 'Recording rules', 'Escalation path'],
    },
    status: 'PUBLISHED',
    version: 7,
    createdAt: new Date('2025-07-20T08:45:00.000Z'),
    updatedAt: new Date('2026-03-12T17:10:00.000Z'),
  },
  {
    id: 'pol-refund-exceptions',
    organizationId,
    code: 'REFUND_EXCEPTION_MATRIX',
    name: 'Refund Exception Matrix',
    title: 'Refund Exception Matrix',
    category: 'Operations',
    description: 'Decision policy for refund exceptions, approvals, and evidence requirements.',
    appliesTo: ['PAYMENTS', 'REFUNDS'],
    approvalRoles: ['FINANCE', 'COMPANY_ADMIN'],
    content: {
      sections: ['Eligibility', 'Evidence', 'Finance approval thresholds'],
    },
    status: 'DRAFT',
    version: 2,
    createdAt: new Date('2026-01-05T12:00:00.000Z'),
    updatedAt: new Date('2026-03-25T14:40:00.000Z'),
  },
] satisfies ConfigItem[];

const configs = {
  catalog: {
    modelName: 'serviceCatalogItem',
    resource: 'service_catalog',
    defaultItems: catalogDefaults,
    listOrderKey: 'name',
  },
  coverage: {
    modelName: 'coverageRule',
    resource: 'coverage_rule',
    defaultItems: coverageDefaults,
    listOrderKey: 'name',
  },
  pricing: {
    modelName: 'pricingRule',
    resource: 'pricing_rule',
    defaultItems: pricingDefaults,
    listOrderKey: 'name',
  },
  policy: {
    modelName: 'policyTemplate',
    resource: 'policy_template',
    defaultItems: policyDefaults,
    listOrderKey: 'name',
  },
} as const satisfies Record<ConfigKind, {
  modelName: string;
  resource: string;
  defaultItems: (organizationId: string) => ConfigItem[];
  listOrderKey: string;
}>;

function getModel(kind: ConfigKind): any | null {
  const candidate = (prisma as any)[configs[kind].modelName];
  if (candidate && typeof candidate.findMany === 'function' && typeof candidate.upsert === 'function') {
    return candidate;
  }
  return null;
}

function getModelOrAllowedFallback(kind: ConfigKind): any | null {
  const model = getModel(kind);
  if (!model && process.env.NODE_ENV === 'production' && process.env.ALLOW_AUDIT_FALLBACK_IN_PRODUCTION !== 'true') {
    throw new Error(`Missing Prisma model "${configs[kind].modelName}" for ${kind}; audit fallback is disabled in production.`);
  }
  return model;
}

export function getConfigStorageMode(kind: ConfigKind): StorageMode {
  return getModelOrAllowedFallback(kind) ? 'model' : 'audit_fallback';
}

function normalizeModelItem(row: any): ConfigItem {
  const data = row.data && typeof row.data === 'object' ? row.data : {};
  return {
    ...data,
    id: row.id,
    organizationId: row.organizationId,
    code: row.code,
    name: data.name ?? row.name,
    title: data.title ?? data.name ?? row.name,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalizeInput(input: Record<string, any>, organizationId: string, existing?: ConfigItem | null): ConfigItem {
  const now = new Date();
  const id = String(input.id ?? existing?.id ?? randomUUID());
  const code = String(input.code ?? existing?.code ?? '').trim().toUpperCase();
  const name = String(input.name ?? input.title ?? existing?.name ?? existing?.title ?? '').trim();
  const title = String(input.title ?? existing?.title ?? name).trim();

  const base: ConfigItem = {
    ...(existing ?? {}),
    ...input,
    id,
    organizationId,
    code,
    name,
    title,
    status: String(input.status ?? existing?.status ?? 'DRAFT').trim().toUpperCase(),
    version: Number(input.version ?? existing?.version ?? 1) || 1,
    createdAt: existing?.createdAt ? new Date(existing.createdAt) : now,
    updatedAt: now,
  };

  return base;
}

async function listFallbackItems(kind: ConfigKind, organizationId: string): Promise<ConfigItem[]> {
  const baseItems = configs[kind].defaultItems(organizationId);
  const map = new Map<string, ConfigItem>(baseItems.map((item) => [item.id, item] as const));

  const logs = await prisma.auditLog.findMany({
    where: {
      resource: configs[kind].resource,
      organizationId,
    },
    orderBy: { createdAt: 'asc' },
    take: 500,
  });

  for (const log of logs) {
    const snapshot = (log.details as any)?.snapshot;
    if (!log.resourceId || !snapshot || typeof snapshot !== 'object') {
      continue;
    }
    map.set(log.resourceId, normalizeInput({
      ...snapshot,
      id: log.resourceId,
      organizationId,
      createdAt: snapshot.createdAt ? new Date(snapshot.createdAt) : log.createdAt,
      updatedAt: snapshot.updatedAt ? new Date(snapshot.updatedAt) : log.createdAt,
    }, organizationId, map.get(log.resourceId) ?? null));
  }

  return [...map.values()].sort((a, b) => String(a[configs[kind].listOrderKey] ?? '').localeCompare(String(b[configs[kind].listOrderKey] ?? '')));
}

async function listModelItems(kind: ConfigKind, organizationId: string): Promise<ConfigItem[]> {
  const model = getModelOrAllowedFallback(kind)!;
  const rows = await model.findMany({
    where: { organizationId },
    orderBy: [{ name: 'asc' }, { updatedAt: 'desc' }],
  });
  return rows.map(normalizeModelItem);
}

export async function listConfigItems(kind: ConfigKind, organizationId: string): Promise<ConfigItem[]> {
  return getModelOrAllowedFallback(kind) ? listModelItems(kind, organizationId) : listFallbackItems(kind, organizationId);
}

export async function getConfigItem(kind: ConfigKind, id: string, organizationId: string): Promise<ConfigItem> {
  const model = getModelOrAllowedFallback(kind);
  if (model) {
    const row = await model.findUnique({ where: { id } });
    if (!row || row.organizationId !== organizationId) {
      throw notFound('Configuration item not found');
    }
    return normalizeModelItem(row);
  }

  const items = await listFallbackItems(kind, organizationId);
  const item = items.find((entry) => entry.id === id);
  if (!item) {
    throw notFound('Configuration item not found');
  }
  return item;
}

async function persistModelItem(kind: ConfigKind, item: ConfigItem) {
  const model = getModelOrAllowedFallback(kind)!;
  const { id, organizationId, code, name, title, status, version, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = item;
  const row = await model.upsert({
    where: { id },
    create: {
      id,
      organizationId,
      code,
      name: name || title,
      status,
      version,
      data: { ...rest, name, title },
    },
    update: {
      organizationId,
      code,
      name: name || title,
      status,
      version,
      data: { ...rest, name, title },
    },
  });
  return normalizeModelItem(row);
}

async function persistAuditItem(kind: ConfigKind, item: ConfigItem, context: BaseContext, action: string, note?: string | null) {
  await writeAuditLog({
    actorId: context.actorId,
    organizationId: context.organizationId,
    action,
    resource: configs[kind].resource,
    resourceId: item.id,
    details: {
      note: note ?? null,
      snapshot: item,
      storageMode: 'audit_fallback',
    },
  });
  return item;
}

export async function upsertConfigItem(kind: ConfigKind, input: Record<string, any>, context: BaseContext): Promise<ConfigItem> {
  const existing = input.id ? await getConfigItem(kind, String(input.id), context.organizationId).catch(() => null) : null;
  const nextVersion = Number(existing?.version ?? 0) + (existing ? 1 : 1);
  const item = normalizeInput({ ...input, version: input.version ?? nextVersion }, context.organizationId, existing);

  const model = getModelOrAllowedFallback(kind);
  const persisted = model
    ? await persistModelItem(kind, item)
    : await persistAuditItem(kind, item, context, `${configs[kind].resource}.${existing ? 'updated' : 'created'}`, input.note ?? null);

  if (model) {
    await writeAuditLog({
      actorId: context.actorId,
      organizationId: context.organizationId,
      action: `${configs[kind].resource}.${existing ? 'updated' : 'created'}`,
      resource: configs[kind].resource,
      resourceId: persisted.id,
      details: {
        note: input.note ?? null,
        snapshot: persisted,
        storageMode: 'model',
      },
    });
  }

  return persisted;
}

export async function transitionConfigItem(kind: ConfigKind, id: string, status: string, context: BaseContext, note?: string | null): Promise<ConfigItem> {
  const existing = await getConfigItem(kind, id, context.organizationId);
  const item = normalizeInput({ ...existing, status, version: Number(existing.version ?? 1) + 1 }, context.organizationId, existing);

  const model = getModelOrAllowedFallback(kind);
  const persisted = model
    ? await persistModelItem(kind, item)
    : await persistAuditItem(kind, item, context, `${configs[kind].resource}.${status.toLowerCase()}`, note ?? null);

  if (model) {
    await writeAuditLog({
      actorId: context.actorId,
      organizationId: context.organizationId,
      action: `${configs[kind].resource}.${status.toLowerCase()}`,
      resource: configs[kind].resource,
      resourceId: persisted.id,
      details: {
        note: note ?? null,
        snapshot: persisted,
        previousStatus: existing.status,
        nextStatus: status,
        storageMode: 'model',
      },
    });
  }

  return persisted;
}

export async function summarizeConfigItems(kind: ConfigKind, organizationId: string) {
  const items = await listConfigItems(kind, organizationId);
  const byStatus = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    count: items.length,
    byStatus,
    storageMode: getConfigStorageMode(kind),
    lastUpdatedAt: items.reduce<Date | null>((latest, item) => {
      const updatedAt = new Date(item.updatedAt);
      if (!latest || updatedAt > latest) return updatedAt;
      return latest;
    }, null),
  };
}
