export type BulkAuditActor = {
  userId: string;
  organizationId: string;
  role?: string;
  facilityId?: string | null;
  requestId?: string | null;
};

export type BulkAuditEvent = {
  action: string;
  accountId?: string | null;
  jobId?: string | null;
  reason: string;
  metadata?: Record<string, unknown>;
};

type AuditClient = {
  auditLog?: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
  auditEvent?: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
};

export async function writeAccountBulkAudit(
  prisma: AuditClient,
  actor: BulkAuditActor,
  event: BulkAuditEvent,
): Promise<void> {
  const payload = {
    organizationId: actor.organizationId,
    facilityId: actor.facilityId ?? null,
    actorUserId: actor.userId,
    actorRole: actor.role ?? null,
    entityType: 'ACCOUNT',
    entityId: event.accountId ?? event.jobId ?? null,
    action: event.action,
    reason: event.reason,
    requestId: actor.requestId ?? null,
    metadata: {
      ...(event.metadata ?? {}),
      jobId: event.jobId ?? null,
      source: 'accounts_phase31_bulk',
    },
    createdAt: new Date(),
  };

  if (prisma.auditLog?.create) {
    await prisma.auditLog.create({ data: payload });
    return;
  }

  if (prisma.auditEvent?.create) {
    await prisma.auditEvent.create({ data: payload });
  }
}
