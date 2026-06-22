import { randomUUID } from 'crypto';
import { prisma } from './prisma';
import { writeAuditLog } from './audit';
import { notFound } from './http';

type PatientWorkspaceKind = 'family_profile' | 'patient_notification' | 'patient_support_ticket' | 'patient_reminder' | 'patient_care_plan' | 'patient_rpm_program' | 'patient_questionnaire_version';
type StorageMode = 'model' | 'audit_fallback';

type WorkspaceContext = {
  organizationId: string;
  actorId?: string;
  patientId?: string | null;
};

type WorkspaceItem = Record<string, any> & {
  id: string;
  organizationId: string;
  patientId?: string | null;
  status: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
};

const familyDefaults = (organizationId: string, patientId?: string | null) => [
  {
    id: 'family-self',
    organizationId,
    patientId,
    title: 'Primary profile',
    profileName: 'Self',
    relationship: 'Self',
    accessLevel: 'Full access',
    permissions: ['Booking', 'Messages', 'Records', 'Billing'],
    status: 'ACTIVE',
    createdAt: new Date('2026-03-20T09:00:00.000Z'),
    updatedAt: new Date('2026-04-02T09:00:00.000Z'),
  },
  {
    id: 'family-dependent-lina',
    organizationId,
    patientId,
    title: 'Lina Khalid',
    profileName: 'Lina Khalid',
    relationship: 'Daughter',
    accessLevel: 'Managed dependent',
    permissions: ['Booking', 'Messages', 'Records'],
    dateOfBirth: '2018-05-14',
    status: 'ACTIVE',
    createdAt: new Date('2026-03-25T10:00:00.000Z'),
    updatedAt: new Date('2026-04-01T11:30:00.000Z'),
  },
] satisfies WorkspaceItem[];

const notificationDefaults = (organizationId: string, patientId?: string | null) => [
  {
    id: 'notif-upcoming-visit',
    organizationId,
    patientId,
    title: 'Upcoming visit tomorrow',
    category: 'Appointment',
    message: 'Your blood pressure review starts tomorrow at 10:00 AM.',
    actionLabel: 'Open appointment',
    actionTarget: '/appointments/detail?id=appt-1001',
    read: false,
    priority: 'high',
    status: 'UNREAD',
    createdAt: new Date('2026-04-02T08:00:00.000Z'),
    updatedAt: new Date('2026-04-02T08:00:00.000Z'),
  },
  {
    id: 'notif-lab-ready',
    organizationId,
    patientId,
    title: 'Lab result posted',
    category: 'Lab',
    message: 'A new renal panel result is available in your records hub.',
    actionLabel: 'View result',
    actionTarget: '/labs/detail?id=lab-renal-panel',
    read: true,
    priority: 'medium',
    status: 'READ',
    createdAt: new Date('2026-04-01T14:10:00.000Z'),
    updatedAt: new Date('2026-04-01T15:00:00.000Z'),
  },
] satisfies WorkspaceItem[];

const supportDefaults = (organizationId: string, patientId?: string | null) => [
  {
    id: 'ticket-billing-followup',
    organizationId,
    patientId,
    title: 'Billing clarification request',
    subject: 'Billing clarification request',
    category: 'Billing',
    priority: 'medium',
    owner: 'Patient support',
    timeline: [
      { time: '2026-04-01T09:15:00.000Z', label: 'Ticket opened', detail: 'Patient requested invoice clarification.' },
      { time: '2026-04-01T10:30:00.000Z', label: 'Assigned', detail: 'Assigned to finance liaison.' },
    ],
    status: 'OPEN',
    createdAt: new Date('2026-04-01T09:15:00.000Z'),
    updatedAt: new Date('2026-04-02T08:45:00.000Z'),
  },
] satisfies WorkspaceItem[];

const reminderDefaults = (organizationId: string, patientId?: string | null) => [
  {
    id: 'rem-lisinopril-morning',
    organizationId,
    patientId,
    title: 'Lisinopril reminder',
    medication: 'Lisinopril 10 mg',
    schedule: 'Daily at 08:00',
    adherence: '6/7 doses this week',
    lastTakenAt: '2026-04-02T08:05:00.000Z',
    enabled: true,
    status: 'ACTIVE',
    createdAt: new Date('2026-03-28T08:00:00.000Z'),
    updatedAt: new Date('2026-04-02T08:05:00.000Z'),
  },
] satisfies WorkspaceItem[];

const carePlanDefaults = (organizationId: string, patientId?: string | null) => [
  {
    id: 'cp-bp-log',
    organizationId,
    patientId,
    title: 'Log blood pressure readings',
    domain: 'Monitoring',
    dueLabel: 'Daily before 9 PM',
    progressLabel: '5 of 7 days completed',
    guidance: 'Record your evening blood pressure after sitting for five minutes.',
    completed: false,
    status: 'OPEN',
    createdAt: new Date('2026-03-30T07:00:00.000Z'),
    updatedAt: new Date('2026-04-02T09:00:00.000Z'),
  },
  {
    id: 'cp-followup-booking',
    organizationId,
    patientId,
    title: 'Book follow-up with primary care',
    domain: 'Visit planning',
    dueLabel: 'Due this week',
    progressLabel: 'Not started',
    guidance: 'Schedule a two-week follow-up after your medication adjustment.',
    completed: false,
    status: 'OPEN',
    createdAt: new Date('2026-04-01T07:30:00.000Z'),
    updatedAt: new Date('2026-04-01T07:30:00.000Z'),
  },
] satisfies WorkspaceItem[];

const rpmDefaults = (organizationId: string, patientId?: string | null) => [
  {
    id: 'rpm-home-monitoring',
    organizationId,
    patientId,
    title: 'Home blood pressure monitoring',
    device: 'Omron BP Monitor',
    programStatus: 'ACTIVE',
    thresholds: [
      { label: 'Systolic', target: '< 140 mmHg', status: 'Configured' },
      { label: 'Diastolic', target: '< 90 mmHg', status: 'Configured' },
    ],
    readings: [
      { time: '2026-04-02T08:10:00.000Z', metric: 'Blood pressure', value: '128/82 mmHg', status: 'Within range', variant: 'success' },
      { time: '2026-04-01T08:25:00.000Z', metric: 'Blood pressure', value: '142/93 mmHg', status: 'Follow-up suggested', variant: 'warning' },
    ],
    careTeamNote: 'Repeat the reading after rest if systolic is above 140.',
    status: 'ACTIVE',
    createdAt: new Date('2026-03-29T08:00:00.000Z'),
    updatedAt: new Date('2026-04-02T08:10:00.000Z'),
  },
] satisfies WorkspaceItem[];

const questionnaireVersionDefaults = (_organizationId: string, _patientId?: string | null) => [] satisfies WorkspaceItem[];

const config = {
  family_profile: {
    modelName: 'patientFamilyProfile',
    resource: 'patient_family_profile',
    defaults: familyDefaults,
    label: 'family profile',
  },
  patient_notification: {
    modelName: 'patientNotificationItem',
    resource: 'patient_notification',
    defaults: notificationDefaults,
    label: 'patient notification',
  },
  patient_support_ticket: {
    modelName: 'patientSupportTicket',
    resource: 'patient_support_ticket',
    defaults: supportDefaults,
    label: 'patient support ticket',
  },
  patient_reminder: {
    modelName: 'patientReminderPlan',
    resource: 'patient_reminder',
    defaults: reminderDefaults,
    label: 'patient reminder',
  },
  patient_care_plan: {
    modelName: 'patientCarePlanItem',
    resource: 'patient_care_plan',
    defaults: carePlanDefaults,
    label: 'patient care plan item',
  },
  patient_rpm_program: {
    modelName: 'patientRpmProgram',
    resource: 'patient_rpm_program',
    defaults: rpmDefaults,
    label: 'patient rpm program',
  },
  patient_questionnaire_version: {
    modelName: 'patientQuestionnaireVersion',
    resource: 'patient_questionnaire_version',
    defaults: questionnaireVersionDefaults,
    label: 'patient questionnaire version',
  },
} as const;

function getModel(kind: PatientWorkspaceKind): any | null {
  const candidate = (prisma as any)[config[kind].modelName];
  if (candidate && typeof candidate.findMany === 'function' && typeof candidate.upsert === 'function') {
    return candidate;
  }
  return null;
}

function getModelOrAllowedFallback(kind: PatientWorkspaceKind): any | null {
  const model = getModel(kind);
  if (!model && process.env.NODE_ENV === 'production' && process.env.ALLOW_AUDIT_FALLBACK_IN_PRODUCTION !== 'true') {
    throw new Error(`Missing Prisma model "${config[kind].modelName}" for ${kind}; audit fallback is disabled in production.`);
  }
  return model;
}

export function getPatientWorkspaceStorageMode(kind: PatientWorkspaceKind): StorageMode {
  return getModelOrAllowedFallback(kind) ? 'model' : 'audit_fallback';
}

function normalizeModelItem(row: any): WorkspaceItem {
  const data = row.data && typeof row.data === 'object' ? row.data : {};
  return {
    ...data,
    id: row.id,
    organizationId: row.organizationId,
    patientId: row.patientId ?? data.patientId ?? null,
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
    patientId: input.patientId ?? existing?.patientId ?? context.patientId ?? null,
    title: String(input.title ?? input.profileName ?? input.subject ?? input.medication ?? input.device ?? existing?.title ?? 'Workspace item').trim(),
    status: String(input.status ?? existing?.status ?? 'DRAFT').trim().toUpperCase(),
    createdAt: existing?.createdAt ? new Date(existing.createdAt) : now,
    updatedAt: now,
  };
}

async function listFallbackItems(kind: PatientWorkspaceKind, organizationId: string, patientId?: string | null) {
  const defaults = config[kind].defaults(organizationId, patientId);
  const map = new Map(defaults.map((item) => [item.id, item]));
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
    const normalized = normalizeItem(snapshot, { organizationId, patientId: snapshot.patientId ?? patientId ?? null }, map.get(String(snapshot.id)) ?? null);
    map.set(normalized.id, {
      ...normalized,
      createdAt: details?.createdAt ? new Date(details.createdAt) : normalized.createdAt,
      updatedAt: log.createdAt,
    });
  }

  return Array.from(map.values()).filter((item) => !patientId || item.patientId === patientId);
}

export async function listPatientWorkspaceItems(kind: PatientWorkspaceKind, organizationId: string, patientId?: string | null) {
  const model = getModelOrAllowedFallback(kind);
  if (model) {
    const rows = await model.findMany({
      where: { organizationId, ...(patientId ? { patientId } : {}) },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(normalizeModelItem);
  }

  const items = await listFallbackItems(kind, organizationId, patientId);
  return items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function getPatientWorkspaceItem(kind: PatientWorkspaceKind, id: string, organizationId: string, patientId?: string | null) {
  const items = await listPatientWorkspaceItems(kind, organizationId, patientId);
  const item = items.find((entry) => entry.id === id);
  if (!item) throw notFound(`${config[kind].label} not found`);
  return item;
}

export async function summarizePatientWorkspaceItems(kind: PatientWorkspaceKind, organizationId: string, patientId?: string | null) {
  const items = await listPatientWorkspaceItems(kind, organizationId, patientId);
  return items.reduce(
    (acc, item) => {
      acc.total += 1;
      acc.byStatus[item.status] = (acc.byStatus[item.status] ?? 0) + 1;
      return acc;
    },
    { total: 0, byStatus: {} as Record<string, number> },
  );
}

export async function upsertPatientWorkspaceItem(kind: PatientWorkspaceKind, input: Record<string, any>, context: WorkspaceContext) {
  const existing = input.id ? await getPatientWorkspaceItem(kind, String(input.id), context.organizationId, context.patientId).catch(() => null) : null;
  const normalized = normalizeItem(input, context, existing);
  const model = getModelOrAllowedFallback(kind);

  if (model) {
    const row = await model.upsert({
      where: { id: normalized.id },
      create: {
        id: normalized.id,
        organizationId: context.organizationId,
        patientId: normalized.patientId ?? null,
        name: normalized.title,
        status: normalized.status,
        data: normalized,
      },
      update: {
        patientId: normalized.patientId ?? null,
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

export async function transitionPatientWorkspaceItem(kind: PatientWorkspaceKind, id: string, status: string, context: WorkspaceContext, patch?: Record<string, any>) {
  const existing = await getPatientWorkspaceItem(kind, id, context.organizationId, context.patientId);
  return upsertPatientWorkspaceItem(kind, { ...existing, ...patch, id, status }, context);
}
