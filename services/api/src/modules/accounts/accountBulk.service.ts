import { randomUUID } from 'node:crypto';
import type { AccountBulkOperation, AccountBulkStatusRequest, AccountImportCommitRequest } from './accountBulk.schema';
import { buildAccountImportPreview } from './accountCsv';
import { writeAccountBulkAudit, type BulkAuditActor } from './accountBulkAudit';

type PrismaLike = {
  $transaction<T>(callback: (tx: PrismaLike) => Promise<T>): Promise<T>;
  account?: any;
  user?: any;
  accountBulkJob?: any;
};

export type BulkStatusResult = {
  jobId: string;
  operation: AccountBulkOperation;
  requested: number;
  updated: number;
  skipped: Array<{ accountId: string; reason: string }>;
};

export async function runBulkAccountStatusMutation(
  prisma: PrismaLike,
  actor: BulkAuditActor,
  request: AccountBulkStatusRequest,
): Promise<BulkStatusResult> {
  const uniqueAccountIds = [...new Set(request.accountIds)];
  const jobId = randomUUID();

  return prisma.$transaction(async (tx) => {
    await createBulkJob(tx, {
      id: jobId,
      actor,
      operation: request.operation,
      inputSummary: {
        requested: uniqueAccountIds.length,
        reason: request.reason,
        facilityId: request.facilityId ?? actor.facilityId ?? null,
      },
      status: 'RUNNING',
    });

    const accounts = await findAccountsByIds(tx, uniqueAccountIds, actor.organizationId);
    const byId = new Map(accounts.map((account: any) => [account.id, account]));
    const skipped: BulkStatusResult['skipped'] = [];
    let updated = 0;

    for (const accountId of uniqueAccountIds) {
      const account = byId.get(accountId);
      if (!account) {
        skipped.push({ accountId, reason: 'NOT_FOUND_OR_OUT_OF_SCOPE' });
        continue;
      }

      const lifecycle = resolveLifecyclePatch(request.operation, account);
      if (!lifecycle.shouldUpdate) {
        skipped.push({ accountId, reason: lifecycle.reason });
        continue;
      }

      await updateAccount(tx, accountId, lifecycle.patch);
      updated += 1;

      await writeAccountBulkAudit(tx as any, actor, {
        action: `ACCOUNT_${request.operation}`,
        accountId,
        jobId,
        reason: request.reason,
        metadata: { before: summarizeLifecycle(account), after: lifecycle.patch },
      });
    }

    await finishBulkJob(tx, jobId, 'COMPLETED', {
      requested: uniqueAccountIds.length,
      updated,
      skipped,
    });

    await writeAccountBulkAudit(tx as any, actor, {
      action: `ACCOUNT_BULK_${request.operation}_COMPLETED`,
      jobId,
      reason: request.reason,
      metadata: { requested: uniqueAccountIds.length, updated, skippedCount: skipped.length },
    });

    return { jobId, operation: request.operation, requested: uniqueAccountIds.length, updated, skipped };
  });
}

export async function previewAccountCsvImport(csvText: string) {
  return buildAccountImportPreview(csvText);
}

export async function commitAccountCsvImport(
  prisma: PrismaLike,
  actor: BulkAuditActor,
  request: AccountImportCommitRequest,
) {
  const preview = buildAccountImportPreview(request.csvText);
  if (preview.invalidRows > 0 || preview.issues.length > 0) {
    return {
      committed: false,
      reason: 'CSV_HAS_VALIDATION_ERRORS',
      preview,
    };
  }

  const jobId = randomUUID();

  return prisma.$transaction(async (tx) => {
    await createBulkJob(tx, {
      id: jobId,
      actor,
      operation: 'IMPORT_ACCOUNTS',
      inputSummary: {
        rows: preview.validRows,
        idempotencyKey: request.idempotencyKey,
        facilityId: request.facilityId ?? actor.facilityId ?? null,
      },
      status: 'RUNNING',
    });

    let created = 0;
    let updated = 0;
    const skipped: Array<{ email: string; reason: string }> = [];

    for (const row of preview.normalizedRows) {
      const existing = await findAccountByEmail(tx, row.email, actor.organizationId);
      if (existing?.deletedAt) {
        skipped.push({ email: row.email, reason: 'ACCOUNT_DELETED_REQUIRES_MANUAL_RESTORE' });
        continue;
      }

      if (existing) {
        await updateAccount(tx, existing.id, {
          displayName: row.displayName,
          role: row.role,
          phone: row.phone,
          externalReference: row.externalReference,
          updatedAt: new Date(),
        });
        updated += 1;
        await writeAccountBulkAudit(tx as any, actor, {
          action: 'ACCOUNT_IMPORT_UPDATE',
          accountId: existing.id,
          jobId,
          reason: request.reason,
          metadata: { email: row.email, idempotencyKey: request.idempotencyKey },
        });
      } else {
        const createdAccount = await createAccount(tx, {
          organizationId: actor.organizationId,
          facilityId: request.facilityId ?? actor.facilityId ?? null,
          email: row.email,
          displayName: row.displayName,
          role: row.role,
          phone: row.phone,
          externalReference: row.externalReference,
        });
        created += 1;
        await writeAccountBulkAudit(tx as any, actor, {
          action: 'ACCOUNT_IMPORT_CREATE',
          accountId: createdAccount.id,
          jobId,
          reason: request.reason,
          metadata: { email: row.email, idempotencyKey: request.idempotencyKey },
        });
      }
    }

    await finishBulkJob(tx, jobId, 'COMPLETED', {
      created,
      updated,
      skipped,
      totalRows: preview.totalRows,
    });

    await writeAccountBulkAudit(tx as any, actor, {
      action: 'ACCOUNT_IMPORT_COMPLETED',
      jobId,
      reason: request.reason,
      metadata: { created, updated, skippedCount: skipped.length, totalRows: preview.totalRows },
    });

    return { committed: true, jobId, created, updated, skipped, preview };
  });
}

function resolveLifecyclePatch(operation: AccountBulkOperation, account: any) {
  const now = new Date();
  switch (operation) {
    case 'DEACTIVATE':
      if (account.status === 'INACTIVE' || account.deactivatedAt) {
        return { shouldUpdate: false as const, reason: 'ALREADY_INACTIVE' };
      }
      return { shouldUpdate: true as const, patch: { status: 'INACTIVE', deactivatedAt: now, updatedAt: now } };
    case 'REACTIVATE':
      if (account.status === 'ACTIVE' && !account.deactivatedAt) {
        return { shouldUpdate: false as const, reason: 'ALREADY_ACTIVE' };
      }
      return { shouldUpdate: true as const, patch: { status: 'ACTIVE', deactivatedAt: null, updatedAt: now } };
    case 'LOCK':
      if (account.lockedAt) return { shouldUpdate: false as const, reason: 'ALREADY_LOCKED' };
      return { shouldUpdate: true as const, patch: { lockedAt: now, updatedAt: now } };
    case 'UNLOCK':
      if (!account.lockedAt) return { shouldUpdate: false as const, reason: 'NOT_LOCKED' };
      return { shouldUpdate: true as const, patch: { lockedAt: null, updatedAt: now } };
    default:
      return { shouldUpdate: false as const, reason: 'UNSUPPORTED_OPERATION' };
  }
}

function summarizeLifecycle(account: any) {
  return {
    status: account.status ?? null,
    deactivatedAt: account.deactivatedAt ?? null,
    lockedAt: account.lockedAt ?? null,
  };
}

async function findAccountsByIds(tx: PrismaLike, ids: string[], organizationId: string) {
  const model = tx.account ?? tx.user;
  return model.findMany({ where: { id: { in: ids }, organizationId } });
}

async function findAccountByEmail(tx: PrismaLike, email: string, organizationId: string) {
  const model = tx.account ?? tx.user;
  return model.findFirst({ where: { email, organizationId } });
}

async function updateAccount(tx: PrismaLike, id: string, patch: Record<string, unknown>) {
  const model = tx.account ?? tx.user;
  return model.update({ where: { id }, data: patch });
}

async function createAccount(tx: PrismaLike, data: Record<string, unknown>) {
  const model = tx.account ?? tx.user;
  return model.create({ data });
}

async function createBulkJob(
  tx: PrismaLike,
  args: {
    id: string;
    actor: BulkAuditActor;
    operation: string;
    inputSummary: Record<string, unknown>;
    status: string;
  },
) {
  if (!tx.accountBulkJob?.create) return;
  await tx.accountBulkJob.create({
    data: {
      id: args.id,
      organizationId: args.actor.organizationId,
      facilityId: args.actor.facilityId ?? null,
      requestedByUserId: args.actor.userId,
      operation: args.operation,
      status: args.status,
      inputSummary: args.inputSummary,
      startedAt: new Date(),
    },
  });
}

async function finishBulkJob(tx: PrismaLike, id: string, status: string, resultSummary: Record<string, unknown>) {
  if (!tx.accountBulkJob?.update) return;
  await tx.accountBulkJob.update({
    where: { id },
    data: { status, resultSummary, finishedAt: new Date() },
  });
}
