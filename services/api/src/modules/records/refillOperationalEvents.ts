/**
 * Phase 32 hotfix helper.
 *
 * Purpose:
 * Avoid runtime crashes when /api/records/refill-operational-events calls
 * listRefillOperationalEvents but the function was never defined/imported.
 *
 * This helper intentionally accepts `prisma: any` because existing CarePoint
 * schema names vary across waves. It tries known audit/log models first and
 * falls back to recent refill request records when audit tables are not present.
 */

export type RefillOperationalEvent = {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  actorName: string | null;
  patientName: string | null;
  providerName: string | null;
  facilityName: string | null;
  createdAt: string;
};

export type ListRefillOperationalEventsInput = {
  prisma: any;
  limit?: number | string | null;
  organizationId?: string | null;
  facilityId?: string | null;
};

function normalizeLimit(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 12);
  if (!Number.isFinite(parsed)) return 12;
  return Math.max(1, Math.min(50, Math.trunc(parsed)));
}

function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.trim().length > 0) return value;
  return new Date().toISOString();
}

function text(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (value == null) return fallback;
  return String(value);
}

function pickName(record: any, keys: string[]): string | null {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (value && typeof value === 'object') {
      const nested = value.displayName ?? value.name ?? value.fullName ?? value.email;
      if (typeof nested === 'string' && nested.trim()) return nested;
    }
  }
  return null;
}

function mapAuditRecord(row: any): RefillOperationalEvent {
  const rawType = text(row.eventType ?? row.action ?? row.type ?? row.category, 'REFILL_EVENT');
  const action = rawType.replaceAll('_', ' ').toLowerCase();
  const prettyAction = action.charAt(0).toUpperCase() + action.slice(1);

  return {
    id: text(row.id ?? row.eventId ?? crypto.randomUUID()),
    type: rawType,
    title: text(row.title ?? prettyAction, prettyAction),
    description: text(
      row.description ?? row.message ?? row.summary ?? row.reason ?? `Operational event recorded for refill workflow: ${prettyAction}`,
      `Operational event recorded for refill workflow: ${prettyAction}`,
    ),
    severity: row.severity === 'CRITICAL' || row.severity === 'WARNING' ? row.severity : 'INFO',
    actorName: (pickName(row, ['actor', 'user', 'performedBy', 'admin']) ?? text(row.actorName ?? '', '')) || null,
    patientName: (pickName(row, ['patient']) ?? text(row.patientName ?? '', '')) || null,
    providerName: (pickName(row, ['provider']) ?? text(row.providerName ?? '', '')) || null,
    facilityName: (pickName(row, ['facility']) ?? text(row.facilityName ?? '', '')) || null,
    createdAt: asIso(row.createdAt ?? row.timestamp ?? row.occurredAt),
  };
}

function mapRefillRequest(row: any): RefillOperationalEvent {
  const status = text(row.status ?? 'UNKNOWN');
  const statusLabel = status.replaceAll('_', ' ').toLowerCase();
  const prettyStatus = statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1);

  return {
    id: text(row.id ?? row.requestId ?? crypto.randomUUID()),
    type: `REFILL_${status}`,
    title: `Refill request ${prettyStatus}`,
    description: text(row.notes ?? row.reason ?? row.medicationName ?? 'Refill request activity was recorded.'),
    severity: status === 'REJECTED' || status === 'ESCALATED' ? 'WARNING' : 'INFO',
    actorName: null,
    patientName: (pickName(row, ['patient']) ?? text(row.patientName ?? '', '')) || null,
    providerName: (pickName(row, ['provider']) ?? text(row.providerName ?? '', '')) || null,
    facilityName: (pickName(row, ['facility']) ?? text(row.facilityName ?? '', '')) || null,
    createdAt: asIso(row.updatedAt ?? row.createdAt),
  };
}

async function tryFindMany(model: any, args: any): Promise<any[] | null> {
  if (!model || typeof model.findMany !== 'function') return null;
  try {
    return await model.findMany(args);
  } catch {
    return null;
  }
}

export async function listRefillOperationalEvents(
  input: ListRefillOperationalEventsInput,
): Promise<RefillOperationalEvent[]> {
  const limit = normalizeLimit(input.limit);
  const prisma = input.prisma;

  const auditWhere: any = {
    OR: [
      { eventType: { contains: 'REFILL', mode: 'insensitive' } },
      { action: { contains: 'REFILL', mode: 'insensitive' } },
      { type: { contains: 'REFILL', mode: 'insensitive' } },
      { category: { contains: 'REFILL', mode: 'insensitive' } },
    ],
  };

  if (input.organizationId) auditWhere.organizationId = input.organizationId;
  if (input.facilityId) auditWhere.facilityId = input.facilityId;

  const auditArgs = {
    where: auditWhere,
    take: limit,
    orderBy: { createdAt: 'desc' },
  };

  const auditRows =
    (await tryFindMany(prisma?.auditLog, auditArgs)) ??
    (await tryFindMany(prisma?.auditEvent, auditArgs)) ??
    (await tryFindMany(prisma?.operationalEvent, auditArgs));

  if (auditRows && auditRows.length > 0) {
    return auditRows.map(mapAuditRecord);
  }

  const refillWhere: any = {};
  if (input.organizationId) refillWhere.organizationId = input.organizationId;
  if (input.facilityId) refillWhere.facilityId = input.facilityId;

  const refillArgs = {
    where: refillWhere,
    take: limit,
    orderBy: { updatedAt: 'desc' },
    include: {
      patient: true,
      provider: true,
      facility: true,
    },
  };

  const refillRows =
    (await tryFindMany(prisma?.refillRequest, refillArgs)) ??
    (await tryFindMany(prisma?.medicationRefillRequest, refillArgs));

  if (refillRows && refillRows.length > 0) {
    return refillRows.map(mapRefillRequest);
  }

  return [];
}
