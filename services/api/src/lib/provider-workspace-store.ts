import { randomUUID } from 'crypto';
import { prisma } from './prisma';
import { writeAuditLog } from './audit';
import { notFound } from './http';

type ProviderWorkspaceKind = 'schedule_template' | 'clinical_order' | 'prescription' | 'lab_work_item' | 'rpm_enrollment' | 'provider_alert' | 'facility_setting';
type StorageMode = 'model' | 'audit_fallback';

type WorkspaceContext = {
  organizationId: string;
  actorId?: string;
  providerId?: string | null;
};

type WorkspaceItem = Record<string, any> & {
  id: string;
  organizationId: string;
  providerId?: string | null;
  status: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
};

const scheduleTemplateDefaults = (organizationId: string, providerId?: string | null) => [
  {
    id: 'tpl-hypertension-followup',
    organizationId,
    providerId,
    title: 'Hypertension Follow-up',
    templateName: 'Hypertension Follow-up',
    durationMinutes: 20,
    bufferMinutes: 10,
    capacity: 1,
    service: 'Blood pressure review',
    location: 'Virtual clinic',
    serviceModes: ['TELEHEALTH'],
    pattern: [
      { day: 'Monday', hours: '09:00 - 12:00' },
      { day: 'Wednesday', hours: '13:00 - 16:00' },
    ],
    status: 'PUBLISHED',
    createdAt: new Date('2026-03-10T08:00:00.000Z'),
    updatedAt: new Date('2026-04-01T09:30:00.000Z'),
  },
  {
    id: 'tpl-derm-clinic',
    organizationId,
    providerId,
    title: 'Dermatology Clinic',
    templateName: 'Dermatology Clinic',
    durationMinutes: 30,
    bufferMinutes: 5,
    capacity: 1,
    service: 'Dermatology follow-up',
    location: 'North Branch',
    serviceModes: ['IN_PERSON'],
    pattern: [{ day: 'Thursday', hours: '10:00 - 15:00' }],
    status: 'DRAFT',
    createdAt: new Date('2026-03-21T10:00:00.000Z'),
    updatedAt: new Date('2026-04-02T12:15:00.000Z'),
  },
] satisfies WorkspaceItem[];

const orderDefaults = (organizationId: string, providerId?: string | null) => [
  {
    id: 'ord-renal-panel',
    organizationId,
    providerId,
    title: 'Renal function panel',
    patientId: 'patient-1001',
    patientName: 'Omar Khalid',
    encounterId: 'enc-1002',
    appointmentId: 'appt-1002',
    reason: 'Medication safety follow-up',
    requestedBy: 'Dr. Sarah Chen',
    orderGroups: [
      { title: 'Laboratory order', description: 'Renal function and electrolytes panel', status: 'Recommended', variant: 'info' },
      { title: 'External referral', description: 'Cardiology referral if readings worsen', status: 'Standby', variant: 'warning' },
    ],
    commonSelections: ['Renal function panel', 'Electrolytes', 'Cardiology referral'],
    status: 'DRAFT',
    createdAt: new Date('2026-04-01T10:10:00.000Z'),
    updatedAt: new Date('2026-04-02T11:15:00.000Z'),
  },
] satisfies WorkspaceItem[];

const prescriptionDefaults = (organizationId: string, providerId?: string | null) => [
  {
    id: 'rx-lisinopril',
    organizationId,
    providerId,
    title: 'Lisinopril 10 mg',
    patientId: 'patient-1001',
    patientName: 'Omar Khalid',
    drug: 'Lisinopril',
    dosage: '10 mg tablet',
    frequency: 'Once daily',
    duration: '30 days',
    complianceChecks: [
      { label: 'Allergy review', detail: 'No medication allergy conflicts detected.', status: 'Clear', variant: 'success' },
      { label: 'Renal monitoring', detail: 'Repeat renal function within 2 weeks.', status: 'Monitor', variant: 'warning' },
    ],
    shortcuts: ['5 mg once daily', '10 mg once daily', '30-day supply'],
    status: 'DRAFT',
    createdAt: new Date('2026-04-01T10:20:00.000Z'),
    updatedAt: new Date('2026-04-02T11:20:00.000Z'),
  },
] satisfies WorkspaceItem[];

const labDefaults = (organizationId: string, providerId?: string | null) => [
  {
    id: 'lab-renal-panel',
    organizationId,
    providerId,
    title: 'Renal function panel',
    patientId: 'patient-1001',
    patientName: 'Omar Khalid',
    testName: 'Renal function panel',
    requestedAt: 'Today, 09:05 AM',
    location: 'Virtual order / partner lab',
    nextStep: 'Confirm fasting and schedule pickup',
    resultStatus: 'Ready for verification',
    values: [
      { label: 'Creatinine', value: '1.1 mg/dL', referenceRange: '0.7 - 1.3', flag: 'Normal', variant: 'success' },
      { label: 'Potassium', value: '5.3 mmol/L', referenceRange: '3.5 - 5.1', flag: 'High', variant: 'warning' },
    ],
    comments: ['Mild potassium elevation; correlate with ACE inhibitor use.'],
    status: 'PENDING_REVIEW',
    createdAt: new Date('2026-04-02T07:45:00.000Z'),
    updatedAt: new Date('2026-04-02T08:30:00.000Z'),
  },
] satisfies WorkspaceItem[];

const rpmDefaults = (organizationId: string, providerId?: string | null) => [
  {
    id: 'rpm-omar-khalid',
    organizationId,
    providerId,
    title: 'Omar Khalid RPM enrollment',
    patientId: 'patient-1001',
    patientName: 'Omar Khalid',
    device: 'Omron BP Monitor',
    programStatus: 'Active',
    thresholds: [
      { label: 'Systolic BP', value: '< 140 mmHg', status: 'Configured', variant: 'success' },
      { label: 'Diastolic BP', value: '< 90 mmHg', status: 'Configured', variant: 'success' },
    ],
    readings: [
      { time: '2026-04-02T09:10:00.000Z', metric: 'Blood pressure', value: '128/82 mmHg', status: 'Within threshold', variant: 'success' },
      { time: '2026-04-01T08:40:00.000Z', metric: 'Blood pressure', value: '145/95 mmHg', status: 'Caution', variant: 'warning' },
    ],
    outreachLog: [
      { time: '2026-04-01T09:00:00.000Z', by: 'Nurse Amira', note: 'Called patient to reinforce adherence and repeat reading.' },
    ],
    status: 'ACTIVE',
    createdAt: new Date('2026-03-28T09:00:00.000Z'),
    updatedAt: new Date('2026-04-02T09:10:00.000Z'),
  },
] satisfies WorkspaceItem[];

const alertDefaults = (organizationId: string, providerId?: string | null) => [
  {
    id: 'alert-rpm-khalid',
    organizationId,
    providerId,
    title: 'RPM threshold exceeded',
    detail: 'Omar Khalid recorded 145/95 mmHg yesterday and needs outreach.',
    severity: 'High',
    variant: 'warning',
    owner: 'Dr. Sarah Chen',
    sla: '4h remaining',
    source: 'RPM',
    patientId: 'patient-1001',
    status: 'OPEN',
    createdAt: new Date('2026-04-01T08:45:00.000Z'),
    updatedAt: new Date('2026-04-02T08:45:00.000Z'),
  },
  {
    id: 'alert-lab-followup',
    organizationId,
    providerId,
    title: 'Lab result requires comment',
    detail: 'Renal function panel has a potassium value outside the reference range.',
    severity: 'Medium',
    variant: 'warning',
    owner: 'Dr. Sarah Chen',
    sla: '1d remaining',
    source: 'LAB',
    patientId: 'patient-1001',
    status: 'OPEN',
    createdAt: new Date('2026-04-02T08:30:00.000Z'),
    updatedAt: new Date('2026-04-02T08:30:00.000Z'),
  },
] satisfies WorkspaceItem[];

const facilityDefaults = (organizationId: string) => [
  {
    id: 'fac-main-clinic',
    organizationId,
    providerId: null,
    title: 'Main Clinic',
    name: 'Main Clinic',
    address: 'Riyadh Health District',
    serviceModes: ['IN_PERSON', 'TELEHEALTH'],
    publishStatus: 'Published',
    serviceMatrix: [
      { service: 'Primary care consultation', channel: 'In-person', price: '$55.00', effectiveDate: '2026-04-01' },
      { service: 'Blood pressure review', channel: 'Telehealth', price: '$40.00', effectiveDate: '2026-04-01' },
    ],
    status: 'PUBLISHED',
    createdAt: new Date('2026-03-01T09:00:00.000Z'),
    updatedAt: new Date('2026-04-01T09:00:00.000Z'),
  },
] satisfies WorkspaceItem[];

const config = {
  schedule_template: {
    modelName: 'providerScheduleTemplate',
    resource: 'provider_schedule_template',
    defaults: scheduleTemplateDefaults,
    label: 'schedule template',
  },
  clinical_order: {
    modelName: 'clinicalOrder',
    resource: 'clinical_order',
    defaults: orderDefaults,
    label: 'clinical order',
  },
  prescription: {
    modelName: 'prescriptionDraft',
    resource: 'prescription_draft',
    defaults: prescriptionDefaults,
    label: 'prescription draft',
  },
  lab_work_item: {
    modelName: 'labWorkItem',
    resource: 'lab_work_item',
    defaults: labDefaults,
    label: 'lab work item',
  },
  rpm_enrollment: {
    modelName: 'rpmEnrollment',
    resource: 'rpm_enrollment',
    defaults: rpmDefaults,
    label: 'rpm enrollment',
  },
  provider_alert: {
    modelName: 'providerAlert',
    resource: 'provider_alert',
    defaults: alertDefaults,
    label: 'provider alert',
  },
  facility_setting: {
    modelName: 'facilitySetting',
    resource: 'facility_setting',
    defaults: facilityDefaults,
    label: 'facility setting',
  },
} as const;

function getModel(kind: ProviderWorkspaceKind): any | null {
  const candidate = (prisma as any)[config[kind].modelName];
  if (candidate && typeof candidate.findMany === 'function' && typeof candidate.upsert === 'function') {
    return candidate;
  }
  return null;
}

function getModelOrAllowedFallback(kind: ProviderWorkspaceKind): any | null {
  const model = getModel(kind);
  if (!model && process.env.NODE_ENV === 'production' && process.env.ALLOW_AUDIT_FALLBACK_IN_PRODUCTION !== 'true') {
    throw new Error(`Missing Prisma model "${config[kind].modelName}" for ${kind}; audit fallback is disabled in production.`);
  }
  return model;
}

export function getProviderWorkspaceStorageMode(kind: ProviderWorkspaceKind): StorageMode {
  return getModelOrAllowedFallback(kind) ? 'model' : 'audit_fallback';
}

function normalizeModelItem(row: any): WorkspaceItem {
  const data = row.data && typeof row.data === 'object' ? row.data : {};
  return {
    ...data,
    id: row.id,
    organizationId: row.organizationId,
    providerId: row.providerId ?? data.providerId ?? null,
    title: data.title ?? data.name ?? row.name ?? row.id,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalizeItem(input: Record<string, any>, context: WorkspaceContext, existing?: WorkspaceItem | null): WorkspaceItem {
  const now = new Date();
  return {
    ...(existing ?? {}),
    ...input,
    id: String(input.id ?? existing?.id ?? randomUUID()),
    organizationId: context.organizationId,
    providerId: input.providerId ?? existing?.providerId ?? context.providerId ?? null,
    title: String(input.title ?? input.templateName ?? input.name ?? input.testName ?? input.patientName ?? existing?.title ?? 'Workspace item').trim(),
    status: String(input.status ?? existing?.status ?? 'DRAFT').trim().toUpperCase(),
    createdAt: existing?.createdAt ? new Date(existing.createdAt) : now,
    updatedAt: now,
  };
}

async function listFallbackItems(kind: ProviderWorkspaceKind, organizationId: string, providerId?: string | null): Promise<WorkspaceItem[]> {
  const defaults = config[kind].defaults(organizationId, providerId);
  const map = new Map<string, WorkspaceItem>(defaults.map((item) => [item.id, item] as const));
  const logs = await prisma.auditLog.findMany({
    where: {
      organizationId,
      resource: config[kind].resource,
    },
    orderBy: { createdAt: 'asc' },
  });

  for (const log of logs) {
    const details = log.details && typeof log.details === 'object' ? (log.details as Record<string, any>) : null;
    const snapshot = details?.snapshot && typeof details.snapshot === 'object' ? (details.snapshot as Record<string, any>) : null;
    if (!snapshot) continue;
    const normalized = normalizeItem(snapshot, { organizationId, providerId: snapshot.providerId ?? providerId ?? null }, map.get(String(snapshot.id)) ?? null);
    map.set(normalized.id, {
      ...normalized,
      createdAt: details?.createdAt ? new Date(details.createdAt) : normalized.createdAt,
      updatedAt: log.createdAt,
    });
  }

  return Array.from(map.values()).filter((item) => !providerId || !item.providerId || item.providerId === providerId);
}

export async function listProviderWorkspaceItems(kind: ProviderWorkspaceKind, organizationId: string, providerId?: string | null): Promise<WorkspaceItem[]> {
  const model = getModelOrAllowedFallback(kind);
  if (model) {
    const rows = await model.findMany({
      where: { organizationId, ...(providerId ? { OR: [{ providerId }, { providerId: null }] } : {}) },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(normalizeModelItem);
  }

  const items = await listFallbackItems(kind, organizationId, providerId);
  return items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function getProviderWorkspaceItem(kind: ProviderWorkspaceKind, id: string, organizationId: string, providerId?: string | null): Promise<WorkspaceItem> {
  const items = await listProviderWorkspaceItems(kind, organizationId, providerId);
  const item = items.find((entry) => entry.id === id);
  if (!item) throw notFound(`${config[kind].label} not found`);
  return item;
}

export async function summarizeProviderWorkspaceItems(kind: ProviderWorkspaceKind, organizationId: string, providerId?: string | null) {
  const items = await listProviderWorkspaceItems(kind, organizationId, providerId);
  return items.reduce(
    (acc, item) => {
      acc.total += 1;
      acc.byStatus[item.status] = (acc.byStatus[item.status] ?? 0) + 1;
      return acc;
    },
    { total: 0, byStatus: {} as Record<string, number> },
  );
}

export async function upsertProviderWorkspaceItem(kind: ProviderWorkspaceKind, input: Record<string, any>, context: WorkspaceContext): Promise<WorkspaceItem> {
  const existing = input.id ? await getProviderWorkspaceItem(kind, String(input.id), context.organizationId, context.providerId).catch(() => null) : null;
  const normalized = normalizeItem(input, context, existing);
  const model = getModelOrAllowedFallback(kind);

  if (model) {
    const row = await model.upsert({
      where: { id: normalized.id },
      create: {
        id: normalized.id,
        organizationId: context.organizationId,
        providerId: normalized.providerId ?? null,
        name: normalized.title,
        status: normalized.status,
        data: normalized,
      },
      update: {
        providerId: normalized.providerId ?? null,
        name: normalized.title,
        status: normalized.status,
        data: normalized,
      },
    });

    await writeAuditLog({
      actorId: context.actorId,
      organizationId: context.organizationId,
      action: existing ? `${config[kind].resource}.updated` : `${config[kind].resource}.created`,
      resource: config[kind].resource,
      resourceId: normalized.id,
      details: { snapshot: normalized, createdAt: normalized.createdAt.toISOString() },
    });

    return normalizeModelItem(row);
  }

  await writeAuditLog({
    actorId: context.actorId,
    organizationId: context.organizationId,
    action: existing ? `${config[kind].resource}.updated` : `${config[kind].resource}.created`,
    resource: config[kind].resource,
    resourceId: normalized.id,
    details: { snapshot: normalized, createdAt: normalized.createdAt.toISOString() },
  });

  return normalized;
}

export async function transitionProviderWorkspaceItem(kind: ProviderWorkspaceKind, id: string, status: string, context: WorkspaceContext, note?: string | null) {
  const existing = await getProviderWorkspaceItem(kind, id, context.organizationId, context.providerId);
  return upsertProviderWorkspaceItem(kind, { ...existing, id, status, note: note ?? existing.note ?? null }, context);
}
