import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

export type RefillRequestStatus =
  | 'PENDING'
  | 'ROUTED_TO_PROVIDER'
  | 'ROUTED_TO_PHARMACY'
  | 'MANUAL_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'FULFILLED';

export type RefillAssignedRole = 'PROVIDER' | 'PHARMACIST' | 'NURSE';
export type RefillEscalationSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RefillAgingBand = 'LT_24H' | 'H24_TO_48H' | 'GT_48H';

export type RefillTimelineEvent = {
  id: string;
  at: string;
  status: RefillRequestStatus;
  label: string;
  note?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  queue?: string | null;
  agingBand?: RefillAgingBand | null;
};

export type RefillOwnershipHistoryEntry = {
  id: string;
  at: string;
  type: 'ASSIGNMENT' | 'ESCALATION' | 'FULFILLMENT' | 'REVIEW';
  label: string;
  queue?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  note?: string | null;
};

export type RefillRequest = {
  id: string;
  organizationId?: string | null;
  patientId: string;
  prescriptionId: string;
  requestedByUserId?: string | null;
  controlledMedication: boolean;
  refillEligible: boolean;
  refillMaxCount: number;
  pharmacyRoutingState: 'PROVIDER_REVIEW' | 'PHARMACY_NETWORK' | 'MANUAL_REVIEW';
  status: RefillRequestStatus;
  assignedRole?: RefillAssignedRole | null;
  assignedOwnerName?: string | null;
  queue?: string | null;
  fulfillmentStatus?: 'AWAITING_REVIEW' | 'IN_PROVIDER_QUEUE' | 'IN_PHARMACY_QUEUE' | 'READY_FOR_FULFILLMENT' | 'FULFILLED' | 'DECLINED';
  escalated?: boolean | null;
  escalationSeverity?: RefillEscalationSeverity | null;
  escalationReason?: string | null;
  escalationOwnerRole?: RefillAssignedRole | null;
  escalatedAt?: string | null;
  note?: string | null;
  decisionNote?: string | null;
  decisionByUserId?: string | null;
  reviewedAt?: string | null;
  fulfilledAt?: string | null;
  timeline?: RefillTimelineEvent[];
  createdAt: string;
  updatedAt: string;
};

type StoreShape = {
  items?: RefillRequest[];
};

const storeDir = path.join(process.cwd(), '.data');
const storePath = path.join(storeDir, 'refill-requests.json');

async function readStore(): Promise<StoreShape> {
  try {
    const raw = await readFile(storePath, 'utf8');
    const parsed = JSON.parse(raw || '{}') as StoreShape;
    return { items: Array.isArray(parsed.items) ? parsed.items : [] };
  } catch {
    return { items: [] };
  }
}

async function writeStore(store: StoreShape) {
  await mkdir(storeDir, { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2), 'utf8');
}

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function deriveAssignment(pharmacyRoutingState: 'PROVIDER_REVIEW' | 'PHARMACY_NETWORK' | 'MANUAL_REVIEW', controlledMedication: boolean) {
  if (controlledMedication || pharmacyRoutingState === 'PROVIDER_REVIEW') {
    return {
      assignedRole: 'PROVIDER' as const,
      queue: 'PROVIDER_REVIEW',
      fulfillmentStatus: 'IN_PROVIDER_QUEUE' as const,
      baseStatus: 'ROUTED_TO_PROVIDER' as const,
    };
  }
  if (pharmacyRoutingState === 'PHARMACY_NETWORK') {
    return {
      assignedRole: 'PHARMACIST' as const,
      queue: 'PHARMACY_NETWORK',
      fulfillmentStatus: 'IN_PHARMACY_QUEUE' as const,
      baseStatus: 'ROUTED_TO_PHARMACY' as const,
    };
  }
  return {
    assignedRole: 'NURSE' as const,
    queue: 'MANUAL_REVIEW',
    fulfillmentStatus: 'AWAITING_REVIEW' as const,
    baseStatus: 'MANUAL_REVIEW' as const,
  };
}

function getElapsedHours(value?: string | null) {
  const millis = new Date(value ?? 0).getTime();
  if (!Number.isFinite(millis) || millis <= 0) return 0;
  return Math.max(0, (Date.now() - millis) / (60 * 60 * 1000));
}

export function getRefillAgingBand(item: Pick<RefillRequest, 'updatedAt' | 'createdAt'>): RefillAgingBand {
  const elapsedHours = getElapsedHours(item.updatedAt ?? item.createdAt);
  if (elapsedHours >= 48) return 'GT_48H';
  if (elapsedHours >= 24) return 'H24_TO_48H';
  return 'LT_24H';
}

export function summarizeRefillRequests(items: RefillRequest[]) {
  const byQueue = items.reduce<Record<string, number>>((acc, item) => {
    const key = String(item.queue ?? item.assignedRole ?? 'UNASSIGNED').toUpperCase();
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const byAgingBand = items.reduce<Record<RefillAgingBand, number>>((acc, item) => {
    const band = getRefillAgingBand(item);
    acc[band] = (acc[band] ?? 0) + 1;
    return acc;
  }, { LT_24H: 0, H24_TO_48H: 0, GT_48H: 0 });

  return {
    total: items.length,
    pharmacyQueue: items.filter((item) => String(item.assignedRole ?? '').toUpperCase() === 'PHARMACIST').length,
    agedOver24h: items.filter((item) => getRefillAgingBand(item) !== 'LT_24H').length,
    rejectedControlledMedication: items.filter((item) => item.controlledMedication && String(item.status).toUpperCase() === 'REJECTED').length,
    controlledMedicationQueue: items.filter((item) => item.controlledMedication && ['ROUTED_TO_PROVIDER', 'ROUTED_TO_PHARMACY', 'APPROVED', 'MANUAL_REVIEW'].includes(String(item.status).toUpperCase())).length,
    byQueue,
    byAgingBand,
  };
}

function appendTimeline(
  current: RefillRequest,
  event: Omit<RefillTimelineEvent, 'id' | 'at'> & { at?: string },
): RefillTimelineEvent[] {
  const nextEvent: RefillTimelineEvent = {
    id: randomId('timeline'),
    at: event.at ?? nowIso(),
    status: event.status,
    label: event.label,
    note: event.note ?? null,
    actorUserId: event.actorUserId ?? null,
    actorRole: event.actorRole ?? null,
    queue: event.queue ?? null,
    agingBand: getRefillAgingBand(current),
  };
  return [...(current.timeline ?? []), nextEvent];
}

export function getRefillOwnershipHistory(item: Pick<RefillRequest, 'timeline'>) {
  return ((item.timeline ?? []) as RefillTimelineEvent[])
    .filter((entry) => /ownership|assigned|escalat|fulfilled|approved|rejected|routed/i.test(String(entry.label)))
    .map((entry) => ({
      id: entry.id,
      at: entry.at,
      type: /escalat/i.test(String(entry.label)) ? 'ESCALATION' : /fulfilled/i.test(String(entry.label)) ? 'FULFILLMENT' : /approved|rejected|routed/i.test(String(entry.label)) ? 'REVIEW' : 'ASSIGNMENT',
      label: entry.label,
      queue: entry.queue ?? null,
      actorUserId: entry.actorUserId ?? null,
      actorRole: entry.actorRole ?? null,
      note: entry.note ?? null,
    })) as RefillOwnershipHistoryEntry[];
}

export async function getRefillRequest(id: string) {
  const store = await readStore();
  return (store.items ?? []).find((item) => item.id === id) ?? null;
}

export async function getRefillRequestHistory(id: string) {
  const item = await getRefillRequest(id);
  if (!item) return null;
  return {
    item,
    timeline: item.timeline ?? [],
    ownershipHistory: getRefillOwnershipHistory(item),
  };
}

export async function listRefillOperationalEvents(filters?: { organizationId?: string | null; limit?: number }) {
  const items = await listRefillRequests({ organizationId: filters?.organizationId ?? null, status: 'ALL' as any });
  const events = items.flatMap((item) =>
    getRefillOwnershipHistory(item).map((entry) => ({
      ...entry,
      requestId: item.id,
      prescriptionId: item.prescriptionId,
      patientId: item.patientId,
      status: item.status,
      assignedRole: item.assignedRole ?? null,
      assignedOwnerName: item.assignedOwnerName ?? null,
      escalated: Boolean(item.escalated),
      controlledMedication: Boolean(item.controlledMedication),
    })),
  ).sort((a, b) => (a.at < b.at ? 1 : -1));
  return filters?.limit ? events.slice(0, filters.limit) : events;
}

export async function listRefillRequests(filters?: {
  organizationId?: string | null;
  patientId?: string | null;
  prescriptionId?: string | null;
  requestedByUserId?: string | null;
  assignedRole?: RefillAssignedRole | 'ALL' | null;
  status?: RefillRequestStatus | 'ALL';
  queue?: string | null;
  agingBand?: RefillAgingBand | 'ALL' | null;
  controlledOnly?: boolean | null;
}) {
  const store = await readStore();
  return (store.items ?? [])
    .filter((item) => {
      if (filters?.organizationId && item.organizationId && item.organizationId !== filters.organizationId) return false;
      if (filters?.patientId && item.patientId !== filters.patientId) return false;
      if (filters?.prescriptionId && item.prescriptionId !== filters.prescriptionId) return false;
      if (filters?.requestedByUserId && item.requestedByUserId !== filters.requestedByUserId) return false;
      if (filters?.assignedRole && filters.assignedRole !== 'ALL' && item.assignedRole !== filters.assignedRole) return false;
      if (filters?.status && filters.status !== 'ALL' && item.status !== filters.status) return false;
      if (filters?.queue && String(item.queue ?? '').toUpperCase() !== String(filters.queue).toUpperCase()) return false;
      if (filters?.agingBand && filters.agingBand !== 'ALL' && getRefillAgingBand(item) !== filters.agingBand) return false;
      if (filters?.controlledOnly && !item.controlledMedication) return false;
      return true;
    })
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function createRefillRequest(input: {
  organizationId?: string | null;
  patientId: string;
  prescriptionId: string;
  requestedByUserId?: string | null;
  controlledMedication: boolean;
  refillEligible: boolean;
  refillMaxCount: number;
  pharmacyRoutingState: 'PROVIDER_REVIEW' | 'PHARMACY_NETWORK' | 'MANUAL_REVIEW';
  note?: string | null;
}) {
  const store = await readStore();
  const timestamp = nowIso();
  const existing = (store.items ?? []).find(
    (item) => item.patientId === input.patientId && item.prescriptionId === input.prescriptionId && ['PENDING', 'ROUTED_TO_PROVIDER', 'ROUTED_TO_PHARMACY', 'MANUAL_REVIEW', 'APPROVED'].includes(item.status),
  );
  const assignment = deriveAssignment(input.pharmacyRoutingState, input.controlledMedication);

  const record: RefillRequest = existing
    ? {
        ...existing,
        note: input.note ?? existing.note ?? null,
        refillEligible: input.refillEligible,
        refillMaxCount: input.refillMaxCount,
        controlledMedication: input.controlledMedication,
        pharmacyRoutingState: input.pharmacyRoutingState,
        status: assignment.baseStatus,
        assignedRole: assignment.assignedRole,
        assignedOwnerName: existing.assignedOwnerName ?? null,
        queue: assignment.queue,
        fulfillmentStatus: assignment.fulfillmentStatus,
        escalated: existing.escalated ?? false,
        escalationSeverity: existing.escalationSeverity ?? null,
        escalationReason: existing.escalationReason ?? null,
        escalationOwnerRole: existing.escalationOwnerRole ?? null,
        escalatedAt: existing.escalatedAt ?? null,
        updatedAt: timestamp,
        timeline: appendTimeline(existing, {
          status: assignment.baseStatus,
          label: 'Refill request refreshed',
          note: input.note ?? 'Existing request refreshed with latest policy state.',
          actorUserId: input.requestedByUserId ?? null,
          actorRole: 'PATIENT',
          queue: assignment.queue,
          at: timestamp,
        }),
      }
    : {
        id: randomId('refill'),
        organizationId: input.organizationId ?? null,
        patientId: input.patientId,
        prescriptionId: input.prescriptionId,
        requestedByUserId: input.requestedByUserId ?? null,
        controlledMedication: input.controlledMedication,
        refillEligible: input.refillEligible,
        refillMaxCount: input.refillMaxCount,
        pharmacyRoutingState: input.pharmacyRoutingState,
        status: assignment.baseStatus,
        assignedRole: assignment.assignedRole,
        assignedOwnerName: null,
        queue: assignment.queue,
        fulfillmentStatus: assignment.fulfillmentStatus,
        note: input.note ?? null,
        escalated: false,
        escalationSeverity: null,
        escalationReason: null,
        escalationOwnerRole: null,
        escalatedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        timeline: [
          {
            id: randomId('timeline'),
            at: timestamp,
            status: assignment.baseStatus,
            label: 'Refill requested',
            note: input.note ?? 'Patient requested prescription refill.',
            actorUserId: input.requestedByUserId ?? null,
            actorRole: 'PATIENT',
            queue: assignment.queue,
          },
        ],
      };

  const items = (store.items ?? []).filter((item) => item.id !== record.id);
  items.push(record);
  await writeStore({ items });
  return record;
}

export async function assignRefillRequest(
  id: string,
  input: {
    assignedRole: RefillAssignedRole;
    ownerName?: string | null;
    queue?: string | null;
    actorUserId?: string | null;
    actorRole?: string | null;
    note?: string | null;
  },
) {
  const store = await readStore();
  const current = (store.items ?? []).find((item) => item.id === id);
  if (!current) return null;
  const updatedAt = nowIso();
  const updated: RefillRequest = {
    ...current,
    assignedRole: input.assignedRole,
    assignedOwnerName: input.ownerName ?? current.assignedOwnerName ?? null,
    queue: input.queue ?? current.queue ?? (input.assignedRole === 'PHARMACIST' ? 'PHARMACY_NETWORK' : input.assignedRole === 'PROVIDER' ? 'PROVIDER_REVIEW' : 'MANUAL_REVIEW'),
    fulfillmentStatus: input.assignedRole === 'PHARMACIST' ? 'IN_PHARMACY_QUEUE' : input.assignedRole === 'PROVIDER' ? 'IN_PROVIDER_QUEUE' : 'AWAITING_REVIEW',
    updatedAt,
  };
  updated.timeline = appendTimeline(updated, {
    status: updated.status,
    label: 'Refill ownership updated',
    note: input.note ?? `Assigned to ${String(input.assignedRole).toLowerCase()} queue.`,
    actorUserId: input.actorUserId ?? null,
    actorRole: input.actorRole ?? null,
    queue: updated.queue,
    at: updatedAt,
  });
  const items = (store.items ?? []).map((item) => (item.id === id ? updated : item));
  await writeStore({ items });
  return updated;
}

export async function escalateRefillRequest(
  id: string,
  input: {
    severity: RefillEscalationSeverity;
    reason: string;
    ownerRole?: RefillAssignedRole | null;
    actorUserId?: string | null;
    actorRole?: string | null;
    note?: string | null;
  },
) {
  const store = await readStore();
  const current = (store.items ?? []).find((item) => item.id === id);
  if (!current) return null;
  const updatedAt = nowIso();
  const nextOwnerRole = input.ownerRole ?? current.escalationOwnerRole ?? current.assignedRole ?? 'PROVIDER';
  const updated: RefillRequest = {
    ...current,
    escalated: true,
    escalationSeverity: input.severity,
    escalationReason: input.reason,
    escalationOwnerRole: nextOwnerRole,
    escalatedAt: updatedAt,
    updatedAt,
  };
  updated.timeline = appendTimeline(updated, {
    status: updated.status,
    label: `Refill escalated (${String(input.severity).toLowerCase()})`,
    note: input.note ?? input.reason,
    actorUserId: input.actorUserId ?? null,
    actorRole: input.actorRole ?? null,
    queue: updated.queue,
    at: updatedAt,
  });
  const items = (store.items ?? []).map((item) => (item.id === id ? updated : item));
  await writeStore({ items });
  return updated;
}

export async function updateRefillRequestStatus(id: string, input: { status: RefillRequestStatus; decisionNote?: string | null }) {
  const store = await readStore();
  const current = (store.items ?? []).find((item) => item.id === id);
  if (!current) return null;
  const updated: RefillRequest = {
    ...current,
    status: input.status,
    decisionNote: input.decisionNote ?? current.decisionNote ?? null,
    updatedAt: nowIso(),
  };
  const items = (store.items ?? []).map((item) => (item.id === id ? updated : item));
  await writeStore({ items });
  return updated;
}

export async function reviewRefillRequest(
  id: string,
  input: {
    action: 'APPROVE' | 'REJECT' | 'ROUTE_TO_PHARMACY' | 'MARK_FULFILLED';
    actorUserId?: string | null;
    actorRole?: string | null;
    note?: string | null;
    queue?: string | null;
  },
) {
  const store = await readStore();
  const current = (store.items ?? []).find((item) => item.id === id);
  if (!current) return null;

  let status: RefillRequestStatus = current.status;
  let assignedRole: RefillAssignedRole | null | undefined = current.assignedRole ?? null;
  let queue: string | null | undefined = current.queue ?? null;
  let fulfillmentStatus: RefillRequest['fulfillmentStatus'] = current.fulfillmentStatus ?? 'AWAITING_REVIEW';
  let label = 'Refill request updated';
  let reviewedAt: string | null | undefined = current.reviewedAt ?? null;
  let fulfilledAt: string | null | undefined = current.fulfilledAt ?? null;

  if (input.action === 'APPROVE') {
    status = 'APPROVED';
    assignedRole = current.pharmacyRoutingState === 'PHARMACY_NETWORK' ? 'PHARMACIST' : 'PROVIDER';
    queue = current.pharmacyRoutingState === 'PHARMACY_NETWORK' ? 'PHARMACY_NETWORK' : 'READY_FOR_FULFILLMENT';
    fulfillmentStatus = 'READY_FOR_FULFILLMENT';
    label = 'Refill approved';
    reviewedAt = nowIso();
  } else if (input.action === 'REJECT') {
    status = 'REJECTED';
    assignedRole = current.assignedRole ?? 'PROVIDER';
    fulfillmentStatus = 'DECLINED';
    label = 'Refill rejected';
    reviewedAt = nowIso();
  } else if (input.action === 'ROUTE_TO_PHARMACY') {
    status = 'ROUTED_TO_PHARMACY';
    assignedRole = 'PHARMACIST';
    queue = input.queue ?? 'PHARMACY_NETWORK';
    fulfillmentStatus = 'IN_PHARMACY_QUEUE';
    label = 'Refill routed to pharmacy queue';
    reviewedAt = nowIso();
  } else if (input.action === 'MARK_FULFILLED') {
    status = 'FULFILLED';
    assignedRole = 'PHARMACIST';
    queue = input.queue ?? current.queue ?? 'DISPENSED';
    fulfillmentStatus = 'FULFILLED';
    label = 'Refill fulfilled';
    reviewedAt = current.reviewedAt ?? nowIso();
    fulfilledAt = nowIso();
  }

  const updated: RefillRequest = {
    ...current,
    status,
    assignedRole,
    queue,
    fulfillmentStatus,
    decisionByUserId: input.actorUserId ?? current.decisionByUserId ?? null,
    decisionNote: input.note ?? current.decisionNote ?? null,
    escalated: input.action === 'MARK_FULFILLED' ? false : current.escalated ?? false,
    reviewedAt,
    fulfilledAt,
    updatedAt: nowIso(),
  };
  updated.timeline = appendTimeline(updated, {
    status,
    label,
    note: input.note ?? null,
    actorUserId: input.actorUserId ?? null,
    actorRole: input.actorRole ?? null,
    queue,
    at: updated.updatedAt,
  });

  const items = (store.items ?? []).map((item) => (item.id === id ? updated : item));
  await writeStore({ items });
  return updated;
}
