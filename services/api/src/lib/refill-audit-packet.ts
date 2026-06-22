import { listReportDeliveryExecutions } from './report-delivery-store';
import type { RefillAuditScope } from './refill-audit-scope-store';
import { listRefillOperationalEvents } from './refill-request-store';

export type RefillAuditPacketOptions = {
  organizationId: string;
  limit?: number | null;
  scope?: RefillAuditScope | null;
};

function normalizeUpper(value?: string | null) {
  return String(value ?? '').trim().toUpperCase();
}

function filterEvents(events: any[], scope?: RefillAuditScope | null) {
  return events.filter((item) => {
    if (scope?.queue && normalizeUpper(item.queue) !== normalizeUpper(scope.queue)) return false;
    if (scope?.assignedRole && normalizeUpper(item.assignedRole) !== normalizeUpper(scope.assignedRole)) return false;
    if (scope?.controlledOnly && !item.controlledMedication) return false;
    if (scope?.escalatedOnly && !item.escalated) return false;
    return true;
  });
}

function summarize(events: any[], executions: any[]) {
  const escalationCount = events.filter((item) => String(item.type).toUpperCase() === 'ESCALATION').length;
  const assignmentCount = events.filter((item) => String(item.type).toUpperCase() === 'ASSIGNMENT').length;
  const fulfillmentCount = events.filter((item) => String(item.type).toUpperCase() === 'FULFILLMENT').length;
  const reviewCount = events.filter((item) => String(item.type).toUpperCase() === 'REVIEW').length;
  const controlledMedicationEvents = events.filter((item) => Boolean(item.controlledMedication)).length;
  const failedDeliveryCount = executions.filter((item) => String(item.status).toUpperCase() === 'FAILED').length;
  const exportReadyCount = events.filter((item) => Boolean(item.controlledMedication) || Boolean(item.escalated)).length;
  return {
    operationalEventCount: events.length,
    assignmentCount,
    escalationCount,
    fulfillmentCount,
    reviewCount,
    controlledMedicationEvents,
    deliveryExecutionCount: executions.length,
    failedDeliveryCount,
    exportReadyCount,
  };
}

function buildGovernanceNotes(summary: ReturnType<typeof summarize>, scope?: RefillAuditScope | null) {
  const notes = [
    `${summary.exportReadyCount} event(s) are ready for governed export review.`,
    `${summary.escalationCount} escalation event(s) require governance visibility.`,
    `${summary.failedDeliveryCount} scheduled delivery execution(s) failed in the selected slice.`,
  ];
  if (scope?.controlledOnly) notes.push('Scope is restricted to controlled-medication refill workflows.');
  if (scope?.escalatedOnly) notes.push('Scope includes only escalated refill workflows.');
  if (scope?.queue) notes.push(`Scope is filtered to the ${scope.queue.replaceAll('_', ' ')} queue.`);
  if (scope?.assignedRole) notes.push(`Scope is filtered to ${scope.assignedRole} ownership.`);
  return notes;
}

export async function buildRefillAuditPacket(options: RefillAuditPacketOptions) {
  const limit = Math.max(1, Math.min(250, Number(options.scope?.limit ?? options.limit ?? 50)));
  const baseEvents = await listRefillOperationalEvents({ organizationId: options.organizationId, limit: limit * 4 });
  const filteredEvents = (options.scope?.includeOperationalEvents === false ? [] : filterEvents(baseEvents, options.scope)).slice(0, limit);
  const executions = options.scope?.includeExecutions === false
    ? []
    : await listReportDeliveryExecutions(options.organizationId, { limit });
  const summary = summarize(filteredEvents, executions);
  return {
    generatedAt: new Date().toISOString(),
    organizationId: options.organizationId,
    scope: options.scope
      ? {
          id: options.scope.id,
          title: options.scope.title,
          note: options.scope.note ?? null,
          limit: options.scope.limit,
          queue: options.scope.queue ?? null,
          assignedRole: options.scope.assignedRole ?? null,
          controlledOnly: options.scope.controlledOnly,
          escalatedOnly: options.scope.escalatedOnly,
          includeExecutions: options.scope.includeExecutions,
          includeOperationalEvents: options.scope.includeOperationalEvents,
        }
      : null,
    summary,
    governanceNotes: buildGovernanceNotes(summary, options.scope),
    operationalEvents: filteredEvents,
    deliveryExecutions: executions,
  };
}
