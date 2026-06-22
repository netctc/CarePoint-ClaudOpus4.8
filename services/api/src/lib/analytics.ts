import { prisma } from './prisma';
import { writeAuditLog } from './audit';

export const screenIdPattern = /^(P|PR|A)-\d{2}$/;
export const actionVerbPattern = /^[a-z]+(?:_[a-z]+)*$/;

export type AnalyticsEventInput = {
  actorId?: string;
  organizationId?: string;
  screenId: string;
  action: string;
  outcome?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function logScreenEvent(input: AnalyticsEventInput) {
  return writeAuditLog({
    actorId: input.actorId,
    organizationId: input.organizationId,
    action: `screen.${input.action}`,
    resource: 'analytics_event',
    resourceId: input.screenId,
    details: {
      screenId: input.screenId,
      action: input.action,
      outcome: input.outcome ?? null,
      targetId: input.targetId ?? null,
      metadata: input.metadata ?? {},
    },
  });
}

export async function summarizeScreenEvents(organizationId: string, filters?: { since?: Date | null; screenId?: string | null }) {
  const rows = await prisma.auditLog.findMany({
    where: {
      organizationId,
      resource: 'analytics_event',
      ...(filters?.screenId ? { resourceId: filters.screenId } : {}),
      ...(filters?.since ? { createdAt: { gte: filters.since } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  const byScreen: Record<string, number> = {};
  const byAction: Record<string, number> = {};

  for (const row of rows) {
    const details = row.details && typeof row.details === 'object' ? (row.details as Record<string, unknown>) : {};
    const screenId = String(details.screenId ?? row.resourceId ?? 'UNKNOWN');
    const action = String(details.action ?? row.action ?? 'unknown');
    byScreen[screenId] = (byScreen[screenId] ?? 0) + 1;
    byAction[action] = (byAction[action] ?? 0) + 1;
  }

  return {
    total: rows.length,
    byScreen,
    byAction,
    latest: rows.slice(0, 20).map((row) => ({
      id: row.id,
      at: row.createdAt,
      actorId: row.actorId,
      screenId: row.resourceId,
      details: row.details,
    })),
  };
}
