import { getRefillAgingBand, getRefillOwnershipHistory, listRefillRequests, type RefillRequest } from "./refill-request-store";

function chooseMatchingRequest(item: Record<string, any>, requests: RefillRequest[]) {
  const refillRequestId = String(item.refillRequestId ?? '').trim();
  const prescriptionId = String(item.prescriptionId ?? '').trim();
  if (refillRequestId) {
    const exact = requests.find((entry) => entry.id === refillRequestId);
    if (exact) return exact;
  }
  if (prescriptionId) {
    const byPrescription = requests.find((entry) => entry.prescriptionId === prescriptionId);
    if (byPrescription) return byPrescription;
  }
  return null;
}

export async function enrichPatientNotificationItems(items: Record<string, any>[], options: { patientId?: string | null; organizationId?: string | null }) {
  if (!options.patientId) return items;
  const refillRequests = await listRefillRequests({
    organizationId: options.organizationId ?? null,
    patientId: options.patientId,
    status: 'ALL' as any,
  });
  return items.map((item) => {
    const match = chooseMatchingRequest(item, refillRequests);
    if (!match) return item;
    const ownershipHistory = getRefillOwnershipHistory(match);
    const latestOwnership = ownershipHistory[0] ?? null;
    const escalationCount = ownershipHistory.filter((entry) => entry.type === 'ESCALATION').length;
    const fulfillmentCount = ownershipHistory.filter((entry) => entry.type === 'FULFILLMENT').length;
    const assignmentCount = ownershipHistory.filter((entry) => entry.type === 'ASSIGNMENT').length;
    return {
      ...item,
      refillRequestId: item.refillRequestId ?? match.id,
      prescriptionId: item.prescriptionId ?? match.prescriptionId,
      refillStatus: match.status,
      refillQueue: match.queue ?? null,
      refillFulfillmentStatus: match.fulfillmentStatus ?? null,
      refillEscalated: Boolean(match.escalated),
      refillEscalationSeverity: match.escalationSeverity ?? null,
      refillAgingBand: getRefillAgingBand(match),
      refillTimelineCount: Array.isArray(match.timeline) ? match.timeline.length : 0,
      ownershipHistoryCount: ownershipHistory.length,
      ownershipAssignmentCount: assignmentCount,
      ownershipEscalationCount: escalationCount,
      ownershipFulfillmentCount: fulfillmentCount,
      latestOwnershipLabel: latestOwnership?.label ?? null,
      latestOwnershipAt: latestOwnership?.at ?? null,
      latestOwnershipQueue: latestOwnership?.queue ?? null,
      latestOwnershipNote: latestOwnership?.note ?? null,
    };
  });
}
