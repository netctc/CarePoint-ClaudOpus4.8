import { prisma } from './prisma';
import { writeAuditLog } from './audit';

type DispatchOutcomeStatus = 'SENT' | 'FAILED' | 'SKIPPED';

type DispatchOptions = {
  actorId?: string | null;
  organizationId?: string | null;
  notificationId?: string | null;
  limit?: number;
  includeManual?: boolean;
  force?: boolean;
};

type DispatchOutcome = {
  notificationId: string;
  status: DispatchOutcomeStatus;
  channel: string;
  provider?: string | null;
  providerMessageId?: string | null;
  failureReason?: string | null;
};

function boolEnv(name: string, fallback = false) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'y', 'on'].includes(value.trim().toLowerCase());
}

function deliveryProvider() {
  return (process.env.PROVIDER_CREDENTIAL_NOTIFICATION_PROVIDER ?? 'audit').trim().toLowerCase() || 'audit';
}

function deliveryConfig() {
  return {
    provider: deliveryProvider(),
    dryRun: boolEnv('PROVIDER_CREDENTIAL_NOTIFICATION_DRY_RUN', true),
    webhookUrl: process.env.PROVIDER_CREDENTIAL_NOTIFICATION_WEBHOOK_URL ?? '',
    webhookToken: process.env.PROVIDER_CREDENTIAL_NOTIFICATION_WEBHOOK_TOKEN ?? '',
    fromEmail: process.env.SMTP_FROM ?? process.env.PROVIDER_CREDENTIAL_NOTIFICATION_FROM ?? 'noreply@carecenter.local',
  };
}

function dueFilter(now: Date) {
  return [{ scheduledFor: null }, { scheduledFor: { lte: now } }];
}

function providerDisplayName(notification: any) {
  const user = notification.provider?.user;
  return user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : null;
}

function notificationPayload(notification: any) {
  return {
    id: notification.id,
    organizationId: notification.organizationId,
    organizationName: notification.organization?.name ?? null,
    providerId: notification.providerId,
    providerName: providerDisplayName(notification),
    providerEmail: notification.provider?.user?.email ?? null,
    documentId: notification.documentId ?? null,
    documentType: notification.document?.type ?? null,
    documentTitle: notification.document?.title ?? null,
    taskId: notification.taskId ?? null,
    taskTitle: notification.task?.title ?? null,
    channel: notification.channel,
    recipientEmail: notification.recipientEmail ?? notification.provider?.user?.email ?? null,
    subject: notification.subject,
    message: notification.message,
    scheduledFor: notification.scheduledFor,
    fromEmail: deliveryConfig().fromEmail,
    metadata: notification.metadata ?? {},
  };
}

async function sendViaWebhook(notification: any): Promise<{ providerMessageId?: string | null }> {
  const config = deliveryConfig();
  if (!config.webhookUrl) throw new Error('Provider credential notification webhook URL is not configured');

  const response = await fetch(config.webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.webhookToken ? { Authorization: `Bearer ${config.webhookToken}` } : {}),
    },
    body: JSON.stringify(notificationPayload(notification)),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Webhook dispatch failed with HTTP ${response.status}${text ? `: ${text.slice(0, 240)}` : ''}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return { providerMessageId: `webhook-${notification.id}` };

  const body = await response.json().catch(() => null) as any;
  return { providerMessageId: body?.id ?? body?.messageId ?? body?.providerMessageId ?? `webhook-${notification.id}` };
}

async function deliver(notification: any): Promise<DispatchOutcome> {
  const config = deliveryConfig();
  const channel = String(notification.channel ?? 'IN_APP');

  if (channel === 'MANUAL') {
    return { notificationId: notification.id, status: 'SKIPPED', channel, provider: 'manual', failureReason: 'Manual reminders are not dispatched by the automated worker' };
  }

  if (channel === 'IN_APP') {
    return { notificationId: notification.id, status: 'SENT', channel, provider: 'in_app', providerMessageId: `in-app-${notification.id}` };
  }

  if (config.dryRun) {
    return { notificationId: notification.id, status: 'SENT', channel, provider: `${config.provider}:dry_run`, providerMessageId: `dry-run-${notification.id}` };
  }

  if (config.provider === 'webhook') {
    const result = await sendViaWebhook(notification);
    return { notificationId: notification.id, status: 'SENT', channel, provider: 'webhook', providerMessageId: result.providerMessageId ?? null };
  }

  throw new Error(`Unsupported provider credential notification provider: ${config.provider}`);
}

function appendAttempt(metadata: any, outcome: DispatchOutcome, attemptedAt: Date) {
  const base = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
  const attempts = Array.isArray(base.dispatchAttempts) ? base.dispatchAttempts.slice(-9) : [];
  attempts.push({
    at: attemptedAt.toISOString(),
    status: outcome.status,
    channel: outcome.channel,
    provider: outcome.provider ?? null,
    providerMessageId: outcome.providerMessageId ?? null,
    failureReason: outcome.failureReason ?? null,
  });
  return { ...base, dispatchAttempts: attempts };
}

async function loadNotifications(options: DispatchOptions) {
  const now = new Date();
  const limit = Math.min(Math.max(Number(options.limit ?? 25) || 25, 1), 100);
  const where: any = options.notificationId
    ? { id: options.notificationId }
    : {
        status: 'QUEUED',
        ...(options.organizationId ? { organizationId: options.organizationId } : {}),
        ...(options.force ? {} : { OR: dueFilter(now) }),
        ...(options.includeManual ? {} : { channel: { not: 'MANUAL' } }),
      };

  return prisma.providerCredentialNotification.findMany({
    where,
    include: {
      provider: { include: { user: true } },
      document: { select: { id: true, type: true, title: true, status: true, expiresAt: true } },
      task: { select: { id: true, title: true, status: true, priority: true, dueAt: true } },
      organization: { select: { name: true } },
    },
    orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'asc' }],
    take: options.notificationId ? 1 : limit,
  });
}

export function getProviderCredentialNotificationDispatchConfig() {
  const config = deliveryConfig();
  return {
    provider: config.provider,
    dryRun: config.dryRun,
    webhookConfigured: Boolean(config.webhookUrl),
    fromEmail: config.fromEmail,
  };
}

export async function dispatchProviderCredentialNotifications(options: DispatchOptions = {}) {
  const notifications = await loadNotifications(options);
  const outcomes: DispatchOutcome[] = [];

  for (const notification of notifications) {
    if (notification.status !== 'QUEUED' && !options.force) {
      outcomes.push({ notificationId: notification.id, status: 'SKIPPED', channel: String(notification.channel), provider: notification.deliveryProvider ?? null, failureReason: `Notification is ${notification.status}` });
      continue;
    }

    const attemptedAt = new Date();
    let outcome: DispatchOutcome;
    try {
      outcome = await deliver(notification);
    } catch (error) {
      outcome = {
        notificationId: notification.id,
        status: 'FAILED',
        channel: String(notification.channel),
        provider: deliveryProvider(),
        failureReason: error instanceof Error ? error.message : 'Dispatch failed',
      };
    }

    if (outcome.status !== 'SKIPPED') {
      const updated = await prisma.providerCredentialNotification.update({
        where: { id: notification.id },
        data: {
          status: outcome.status,
          sentAt: outcome.status === 'SENT' ? attemptedAt : notification.sentAt,
          failureReason: outcome.status === 'FAILED' ? outcome.failureReason ?? 'Dispatch failed' : null,
          deliveryProvider: outcome.provider ?? null,
          deliveryProviderMessageId: outcome.providerMessageId ?? null,
          dispatchAttemptCount: { increment: 1 },
          lastDispatchAt: attemptedAt,
          metadata: appendAttempt(notification.metadata, outcome, attemptedAt),
        },
      });

      await writeAuditLog({
        actorId: options.actorId ?? undefined,
        organizationId: updated.organizationId,
        action: outcome.status === 'SENT' ? 'admin.provider.credential_notification.dispatched' : 'admin.provider.credential_notification.dispatch_failed',
        resource: 'provider_credential_notification',
        resourceId: updated.id,
        details: {
          providerId: updated.providerId,
          documentId: updated.documentId,
          taskId: updated.taskId,
          channel: updated.channel,
          provider: updated.deliveryProvider,
          providerMessageId: updated.deliveryProviderMessageId,
          failureReason: updated.failureReason,
          attemptCount: updated.dispatchAttemptCount,
        },
      });
    }

    outcomes.push(outcome);
  }

  const sent = outcomes.filter((item) => item.status === 'SENT').length;
  const failed = outcomes.filter((item) => item.status === 'FAILED').length;
  const skipped = outcomes.filter((item) => item.status === 'SKIPPED').length;
  return { items: outcomes, count: outcomes.length, sent, failed, skipped, config: getProviderCredentialNotificationDispatchConfig() };
}
