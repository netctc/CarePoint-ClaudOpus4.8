import { upsertPatientWorkspaceItem } from './patient-workspace-store';

export type RefillNotificationLike = {
  id: string;
  patientId: string;
  prescriptionId: string;
  status: string;
  fulfillmentStatus?: string | null;
  queue?: string | null;
  pharmacyRoutingState?: string | null;
  note?: string | null;
  decisionNote?: string | null;
  controlledMedication?: boolean;
  updatedAt?: string | null;
  agingBand?: string | null;
  timelineCount?: number | null;
  escalated?: boolean | null;
  escalationSeverity?: string | null;
};

function prettify(value: string | null | undefined) {
  return String(value ?? '').trim().replaceAll('_', ' ').toLowerCase();
}

function toTitle(status: string, controlledMedication?: boolean) {
  switch (status) {
    case 'APPROVED':
      return controlledMedication ? 'Controlled refill approved for review handoff' : 'Refill approved';
    case 'REJECTED':
      return controlledMedication ? 'Controlled refill request was rejected' : 'Refill request was rejected';
    case 'ROUTED_TO_PHARMACY':
      return 'Refill routed to pharmacy';
    case 'FULFILLED':
      return 'Prescription refill fulfilled';
    case 'ROUTED_TO_PROVIDER':
      return 'Refill routed to provider review';
    case 'MANUAL_REVIEW':
      return 'Refill awaiting manual review';
    default:
      return 'Prescription refill update';
  }
}

function toPriority(request: RefillNotificationLike) {
  if (request.status === 'REJECTED' || request.controlledMedication) return 'high';
  if (request.status === 'FULFILLED' || request.status === 'APPROVED') return 'medium';
  return 'low';
}

function toMessage(request: RefillNotificationLike) {
  const base = [
    `Prescription ${request.prescriptionId} is now ${prettify(request.status) || 'updated'}.`,
    request.fulfillmentStatus ? `Fulfillment status: ${prettify(request.fulfillmentStatus)}.` : null,
    request.queue ? `Queue: ${prettify(request.queue)}.` : null,
    request.pharmacyRoutingState ? `Routing: ${prettify(request.pharmacyRoutingState)}.` : null,
    request.agingBand ? `Aging band: ${prettify(request.agingBand)}.` : null,
    request.escalated ? `Escalation: ${prettify(request.escalationSeverity ?? 'high')}.` : null,
    request.timelineCount ? `Timeline updates: ${request.timelineCount}.` : null,
    request.decisionNote ?? request.note ?? null,
  ].filter(Boolean);
  return base.join(' ');
}

export async function createRefillStatusNotification(
  organizationId: string,
  request: RefillNotificationLike,
  actorId?: string | null,
) {
  if (!organizationId || !request.patientId) return null;
  return upsertPatientWorkspaceItem(
    'patient_notification',
    {
      id: `refill-${request.id}-${String(request.status).toLowerCase()}`,
      title: toTitle(String(request.status), request.controlledMedication),
      category: 'Prescription',
      message: toMessage(request),
      actionLabel: 'Open prescription',
      actionTarget: `/prescriptions/detail?id=${encodeURIComponent(request.prescriptionId)}`,
      prescriptionId: request.prescriptionId,
      refillRequestId: request.id,
      refillAgingBand: request.agingBand ?? null,
      refillTimelineCount: request.timelineCount ?? null,
      refillEscalated: request.escalated ?? false,
      refillEscalationSeverity: request.escalationSeverity ?? null,
      read: false,
      priority: request.escalated ? 'high' : toPriority(request),
      status: 'UNREAD',
      createdAt: request.updatedAt ?? new Date().toISOString(),
      updatedAt: request.updatedAt ?? new Date().toISOString(),
    },
    {
      organizationId,
      patientId: request.patientId,
      actorId: actorId ?? undefined,
    },
  );
}
