// Keep these enum mirrors local so TypeScript can compile before or during Prisma client generation.
// The Prisma schema stores the same string values; generated Prisma enum types are structurally compatible.
const CredentialDocumentType = {
  LICENSE: 'LICENSE',
  ID_DOCUMENT: 'ID_DOCUMENT',
  INSURANCE: 'INSURANCE',
  CERTIFICATION: 'CERTIFICATION',
  DEGREE: 'DEGREE',
  OTHER: 'OTHER',
} as const;
type CredentialDocumentType = (typeof CredentialDocumentType)[keyof typeof CredentialDocumentType];

const CredentialDocumentStatus = {
  MISSING: 'MISSING',
  UPLOADED: 'UPLOADED',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
} as const;
type CredentialDocumentStatus = (typeof CredentialDocumentStatus)[keyof typeof CredentialDocumentStatus];

const ProviderCredentialReviewTaskStatus = {
  OPEN: 'OPEN',
  IN_REVIEW: 'IN_REVIEW',
  BLOCKED: 'BLOCKED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
type ProviderCredentialReviewTaskStatus = (typeof ProviderCredentialReviewTaskStatus)[keyof typeof ProviderCredentialReviewTaskStatus];

const ProviderCredentialReviewPriority = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;
type ProviderCredentialReviewPriority = (typeof ProviderCredentialReviewPriority)[keyof typeof ProviderCredentialReviewPriority];

const ProviderCredentialNotificationChannel = {
  EMAIL: 'EMAIL',
  IN_APP: 'IN_APP',
  MANUAL: 'MANUAL',
} as const;
type ProviderCredentialNotificationChannel = (typeof ProviderCredentialNotificationChannel)[keyof typeof ProviderCredentialNotificationChannel];

const ProviderCredentialNotificationStatus = {
  QUEUED: 'QUEUED',
  SENT: 'SENT',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;
type ProviderCredentialNotificationStatus = (typeof ProviderCredentialNotificationStatus)[keyof typeof ProviderCredentialNotificationStatus];
import { prisma } from './prisma';
import { writeAuditLog } from './audit';

type SweepActor = {
  userId?: string | null;
  organizationId?: string | null;
};

type SweepOptions = {
  actor?: SweepActor;
  organizationId?: string | null;
  providerId?: string | null;
  dryRun?: boolean;
  createReviewTasks?: boolean;
  queueReminders?: boolean;
  markExpired?: boolean;
  expiringSoonDays?: number;
  dueInDays?: number;
  limit?: number;
};

type SweepCandidate = {
  providerId: string;
  organizationId: string;
  documentId?: string | null;
  type: CredentialDocumentType;
  title: string;
  reason: 'MISSING_REQUIRED_DOCUMENT' | 'EXPIRED_DOCUMENT' | 'EXPIRING_SOON_DOCUMENT' | 'REJECTED_DOCUMENT';
  priority: ProviderCredentialReviewPriority;
  dueAt: Date;
  notificationSubject: string;
  notificationMessage: string;
  recipientEmail?: string | null;
};

type SweepResult = {
  dryRun: boolean;
  scannedProviders: number;
  expiredDocumentsDetected: number;
  expiredDocumentsUpdated: number;
  missingRequiredDocumentsDetected: number;
  expiringSoonDocumentsDetected: number;
  rejectedDocumentsDetected: number;
  reviewTasksCreated: number;
  reviewTasksSkippedExisting: number;
  remindersQueued: number;
  remindersSkippedExisting: number;
  candidates: Array<{
    providerId: string;
    organizationId: string;
    documentId?: string | null;
    type: CredentialDocumentType;
    reason: SweepCandidate['reason'];
    priority: ProviderCredentialReviewPriority;
    dueAt: string;
    title: string;
  }>;
};

const requiredCredentialTypes: CredentialDocumentType[] = [
  CredentialDocumentType.LICENSE,
  CredentialDocumentType.ID_DOCUMENT,
  CredentialDocumentType.INSURANCE,
];

const activeReviewTaskStatuses: ProviderCredentialReviewTaskStatus[] = [
  ProviderCredentialReviewTaskStatus.OPEN,
  ProviderCredentialReviewTaskStatus.IN_REVIEW,
  ProviderCredentialReviewTaskStatus.BLOCKED,
];

function daysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

function providerDisplayName(provider: any) {
  return [provider?.user?.firstName, provider?.user?.lastName].filter(Boolean).join(' ').trim() || provider?.user?.email || 'Provider';
}

function readableCredentialType(type: CredentialDocumentType) {
  return String(type).replaceAll('_', ' ').toLowerCase();
}

function documentIsCurrentlyValid(document: any) {
  if (!document) return false;
  if (document.status !== CredentialDocumentStatus.VERIFIED) return false;
  if (!document.expiresAt) return true;
  return new Date(document.expiresAt).getTime() >= Date.now();
}

function documentExpiresSoon(document: any, threshold: Date) {
  if (!document?.expiresAt) return false;
  const expiresAt = new Date(document.expiresAt);
  return expiresAt.getTime() >= Date.now() && expiresAt <= threshold;
}

function candidateKey(candidate: SweepCandidate) {
  return `${candidate.providerId}:${candidate.documentId ?? candidate.type}:${candidate.reason}`;
}

function mapCandidate(candidate: SweepCandidate) {
  return {
    providerId: candidate.providerId,
    organizationId: candidate.organizationId,
    documentId: candidate.documentId ?? null,
    type: candidate.type,
    reason: candidate.reason,
    priority: candidate.priority,
    dueAt: candidate.dueAt.toISOString(),
    title: candidate.title,
  };
}

async function hasActiveTask(candidate: SweepCandidate) {
  return prisma.providerCredentialReviewTask.findFirst({
    where: {
      organizationId: candidate.organizationId,
      providerId: candidate.providerId,
      status: { in: activeReviewTaskStatuses },
      OR: [
        ...(candidate.documentId ? [{ documentId: candidate.documentId }] : []),
        { title: candidate.title },
      ],
    },
    select: { id: true },
  });
}

async function hasQueuedReminder(providerId: string, organizationId: string, taskId?: string | null, documentId?: string | null) {
  return prisma.providerCredentialNotification.findFirst({
    where: {
      providerId,
      organizationId,
      status: ProviderCredentialNotificationStatus.QUEUED,
      ...(taskId ? { taskId } : documentId ? { documentId } : {}),
    },
    select: { id: true },
  });
}

async function buildCredentialCandidates(options: Required<Pick<SweepOptions, 'expiringSoonDays' | 'dueInDays'>> & SweepOptions) {
  const threshold = daysFromNow(options.expiringSoonDays);
  const dueSoon = daysFromNow(Math.min(options.dueInDays, options.expiringSoonDays));
  const dueDefault = daysFromNow(options.dueInDays);

  const providers = await prisma.providerProfile.findMany({
    where: {
      ...(options.organizationId ? { organizationId: options.organizationId } : {}),
      ...(options.providerId ? { id: options.providerId } : {}),
      user: { status: 'ACTIVE' },
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, status: true } },
      credentialDocuments: true,
    },
    take: options.limit,
    orderBy: { id: 'asc' },
  });

  const candidates = new Map<string, SweepCandidate>();
  let expiredDocumentsDetected = 0;
  let missingRequiredDocumentsDetected = 0;
  let expiringSoonDocumentsDetected = 0;
  let rejectedDocumentsDetected = 0;

  for (const provider of providers) {
    const name = providerDisplayName(provider);
    const documentsByType = new Map<CredentialDocumentType, any[]>();
    for (const document of provider.credentialDocuments) {
      const docs = documentsByType.get(document.type) ?? [];
      docs.push(document);
      documentsByType.set(document.type, docs);
    }

    for (const type of requiredCredentialTypes) {
      const documents = documentsByType.get(type) ?? [];
      if (!documents.some(documentIsCurrentlyValid)) {
        missingRequiredDocumentsDetected += 1;
        const candidate: SweepCandidate = {
          providerId: provider.id,
          organizationId: provider.organizationId,
          type,
          title: `Missing required ${readableCredentialType(type)} for ${name}`,
          reason: 'MISSING_REQUIRED_DOCUMENT',
          priority: ProviderCredentialReviewPriority.HIGH,
          dueAt: dueSoon,
          recipientEmail: provider.user.email,
          notificationSubject: `Missing required ${readableCredentialType(type)}`,
          notificationMessage: `Please upload or verify the required ${readableCredentialType(type)} for ${name}.`,
        };
        candidates.set(candidateKey(candidate), candidate);
      }
    }

    for (const document of provider.credentialDocuments) {
      const expiresAt = document.expiresAt ? new Date(document.expiresAt) : null;
      if (document.status === CredentialDocumentStatus.REJECTED) {
        rejectedDocumentsDetected += 1;
        const candidate: SweepCandidate = {
          providerId: provider.id,
          organizationId: provider.organizationId,
          documentId: document.id,
          type: document.type,
          title: `Rejected credential requires correction: ${document.title}`,
          reason: 'REJECTED_DOCUMENT',
          priority: ProviderCredentialReviewPriority.HIGH,
          dueAt: dueSoon,
          recipientEmail: provider.user.email,
          notificationSubject: `Credential requires correction: ${document.title}`,
          notificationMessage: `The credential document "${document.title}" needs correction before provider credentialing can be approved.`,
        };
        candidates.set(candidateKey(candidate), candidate);
        continue;
      }

      if (expiresAt && expiresAt.getTime() < Date.now() && document.status !== CredentialDocumentStatus.EXPIRED) {
        expiredDocumentsDetected += 1;
        const candidate: SweepCandidate = {
          providerId: provider.id,
          organizationId: provider.organizationId,
          documentId: document.id,
          type: document.type,
          title: `Expired credential renewal required: ${document.title}`,
          reason: 'EXPIRED_DOCUMENT',
          priority: ProviderCredentialReviewPriority.URGENT,
          dueAt: daysFromNow(1),
          recipientEmail: provider.user.email,
          notificationSubject: `Expired credential: ${document.title}`,
          notificationMessage: `The credential document "${document.title}" is expired and must be renewed immediately.`,
        };
        candidates.set(candidateKey(candidate), candidate);
        continue;
      }

      if (document.status === CredentialDocumentStatus.VERIFIED && documentExpiresSoon(document, threshold)) {
        expiringSoonDocumentsDetected += 1;
        const candidate: SweepCandidate = {
          providerId: provider.id,
          organizationId: provider.organizationId,
          documentId: document.id,
          type: document.type,
          title: `Credential renewal due soon: ${document.title}`,
          reason: 'EXPIRING_SOON_DOCUMENT',
          priority: ProviderCredentialReviewPriority.NORMAL,
          dueAt: dueDefault,
          recipientEmail: provider.user.email,
          notificationSubject: `Credential expiring soon: ${document.title}`,
          notificationMessage: `The credential document "${document.title}" will expire soon. Please upload the renewed document before the expiry date.`,
        };
        candidates.set(candidateKey(candidate), candidate);
      }
    }
  }

  return {
    providers,
    candidates: Array.from(candidates.values()),
    expiredDocumentsDetected,
    missingRequiredDocumentsDetected,
    expiringSoonDocumentsDetected,
    rejectedDocumentsDetected,
  };
}

export async function runProviderCredentialGovernanceSweep(options: SweepOptions = {}): Promise<SweepResult> {
  const normalized = {
    ...options,
    dryRun: Boolean(options.dryRun),
    createReviewTasks: options.createReviewTasks !== false,
    queueReminders: options.queueReminders !== false,
    markExpired: options.markExpired !== false,
    expiringSoonDays: clampInteger(options.expiringSoonDays, 30, 1, 365),
    dueInDays: clampInteger(options.dueInDays, 7, 1, 90),
    limit: clampInteger(options.limit, 250, 1, 1000),
  };

  const candidateResult = await buildCredentialCandidates(normalized);
  const result: SweepResult = {
    dryRun: normalized.dryRun,
    scannedProviders: candidateResult.providers.length,
    expiredDocumentsDetected: candidateResult.expiredDocumentsDetected,
    expiredDocumentsUpdated: 0,
    missingRequiredDocumentsDetected: candidateResult.missingRequiredDocumentsDetected,
    expiringSoonDocumentsDetected: candidateResult.expiringSoonDocumentsDetected,
    rejectedDocumentsDetected: candidateResult.rejectedDocumentsDetected,
    reviewTasksCreated: 0,
    reviewTasksSkippedExisting: 0,
    remindersQueued: 0,
    remindersSkippedExisting: 0,
    candidates: candidateResult.candidates.map(mapCandidate),
  };

  if (normalized.dryRun) return result;

  if (normalized.markExpired) {
    const expiredDocumentIds = candidateResult.candidates
      .filter((candidate) => candidate.reason === 'EXPIRED_DOCUMENT' && candidate.documentId)
      .map((candidate) => candidate.documentId as string);
    if (expiredDocumentIds.length > 0) {
      const updated = await prisma.providerCredentialDocument.updateMany({
        where: {
          id: { in: expiredDocumentIds },
          status: { not: CredentialDocumentStatus.EXPIRED },
          ...(normalized.organizationId ? { organizationId: normalized.organizationId } : {}),
        },
        data: { status: CredentialDocumentStatus.EXPIRED },
      });
      result.expiredDocumentsUpdated = updated.count;
    }
  }

  for (const candidate of candidateResult.candidates) {
    let taskId: string | null = null;
    if (normalized.createReviewTasks) {
      const existingTask = await hasActiveTask(candidate);
      if (existingTask) {
        result.reviewTasksSkippedExisting += 1;
        taskId = existingTask.id;
      } else {
        const task = await prisma.providerCredentialReviewTask.create({
          data: {
            organizationId: candidate.organizationId,
            providerId: candidate.providerId,
            documentId: candidate.documentId ?? null,
            title: candidate.title,
            status: ProviderCredentialReviewTaskStatus.OPEN,
            priority: candidate.priority,
            dueAt: candidate.dueAt,
            createdById: normalized.actor?.userId ?? null,
            blockReason: candidate.reason,
            decisionNote: 'Created automatically by provider credential governance sweep.',
            metadata: { reason: candidate.reason, generatedBy: 'provider-credential-governance-sweeper' },
          },
          select: { id: true },
        });
        result.reviewTasksCreated += 1;
        taskId = task.id;
      }
    }

    if (normalized.queueReminders) {
      const existingReminder = await hasQueuedReminder(candidate.providerId, candidate.organizationId, taskId, candidate.documentId ?? null);
      if (existingReminder) {
        result.remindersSkippedExisting += 1;
      } else {
        await prisma.providerCredentialNotification.create({
          data: {
            organizationId: candidate.organizationId,
            providerId: candidate.providerId,
            documentId: candidate.documentId ?? null,
            taskId,
            channel: ProviderCredentialNotificationChannel.EMAIL,
            status: ProviderCredentialNotificationStatus.QUEUED,
            subject: candidate.notificationSubject,
            message: candidate.notificationMessage,
            recipientEmail: candidate.recipientEmail ?? null,
            scheduledFor: new Date(),
            createdById: normalized.actor?.userId ?? null,
            metadata: { reason: candidate.reason, generatedBy: 'provider-credential-governance-sweeper' },
          },
        });
        result.remindersQueued += 1;
      }
    }
  }

  await writeAuditLog({
    actorId: normalized.actor?.userId ?? undefined,
    organizationId: normalized.organizationId ?? normalized.actor?.organizationId ?? undefined,
    action: normalized.dryRun ? 'admin.provider.credential_governance_sweep.previewed' : 'admin.provider.credential_governance_sweep.executed',
    resource: 'provider_credential_governance_sweep',
    details: result,
  });

  return result;
}
