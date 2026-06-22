export interface AccountMutationAuditInput {
  prisma: any;
  actorId?: string | null;
  organizationId?: string | null;
  targetAccountId?: string | null;
  action: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AccountMutationAuditResult {
  attempted: boolean;
  written: boolean;
  error?: string;
}

function safeJson(value: unknown): unknown {
  if (value == null) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return { unavailable: true };
  }
}

export async function writeAccountMutationAudit(input: AccountMutationAuditInput): Promise<AccountMutationAuditResult> {
  const prisma = input.prisma;

  if (!prisma) {
    return { attempted: false, written: false, error: 'Prisma client unavailable.' };
  }

  try {
    // Preferred generic audit model. Rename this block if your project uses another audit writer.
    if (prisma.auditLog?.create) {
      await prisma.auditLog.create({
        data: {
          actorId: input.actorId ?? null,
          organizationId: input.organizationId ?? null,
          entityType: 'ACCOUNT',
          entityId: input.targetAccountId ?? null,
          action: input.action,
          before: safeJson(input.before),
          after: safeJson(input.after),
          metadata: safeJson({
            ...(input.metadata ?? {}),
            requestId: input.requestId ?? null,
            ipAddress: input.ipAddress ?? null,
            userAgent: input.userAgent ?? null,
          }),
        },
      });
      return { attempted: true, written: true };
    }

    // Fallback model name used in some projects.
    if (prisma.auditEvent?.create) {
      await prisma.auditEvent.create({
        data: {
          actorId: input.actorId ?? null,
          organizationId: input.organizationId ?? null,
          type: `ACCOUNT_${input.action}`,
          subjectType: 'ACCOUNT',
          subjectId: input.targetAccountId ?? null,
          payload: safeJson({
            before: input.before,
            after: input.after,
            metadata: input.metadata,
            requestId: input.requestId ?? null,
            ipAddress: input.ipAddress ?? null,
            userAgent: input.userAgent ?? null,
          }),
        },
      });
      return { attempted: true, written: true };
    }

    console.warn('[account-audit] No audit model found. Account mutation audit was not persisted.', {
      action: input.action,
      actorId: input.actorId,
      targetAccountId: input.targetAccountId,
      requestId: input.requestId,
    });
    return { attempted: true, written: false, error: 'No supported audit model found.' };
  } catch (error) {
    console.warn('[account-audit] Failed to write account mutation audit.', error);
    return { attempted: true, written: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function accountAuditRequestMetadata(req: any): Pick<AccountMutationAuditInput, 'requestId' | 'ipAddress' | 'userAgent'> {
  return {
    requestId: req?.id ?? req?.requestId ?? req?.locals?.requestId ?? req?.res?.locals?.requestId ?? null,
    ipAddress: req?.ip ?? req?.headers?.['x-forwarded-for'] ?? null,
    userAgent: req?.headers?.['user-agent'] ?? null,
  };
}
