import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { badRequest, forbidden, notFound } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { writeAuditLog } from '../../lib/audit';
import { dispatchProviderCredentialNotifications, getProviderCredentialNotificationDispatchConfig } from '../../lib/provider-credential-notification-dispatcher';
import { runProviderCredentialGovernanceSweep } from '../../lib/provider-credential-governance-sweeper';
import { providerIamRouter } from './provider-iam.routes';

// Local mirrors of Prisma enum string values. This keeps the API build stable even
// when @prisma/client has not been regenerated yet; `npm run build:api` now also
// runs `prisma generate` before compiling the API.
const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  COMPANY_ADMIN: 'COMPANY_ADMIN',
  COMPANY_SUPPORT: 'COMPANY_SUPPORT',
  PROVIDER: 'PROVIDER',
  NURSE: 'NURSE',
  PHARMACIST: 'PHARMACIST',
  LAB_TECH: 'LAB_TECH',
  FINANCE: 'FINANCE',
  PATIENT: 'PATIENT',
} as const;
type UserRole = (typeof UserRole)[keyof typeof UserRole];

const AccountStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  ARCHIVED: 'ARCHIVED',
} as const;
type AccountStatus = (typeof AccountStatus)[keyof typeof AccountStatus];

const ProviderOnboardingStatus = {
  DRAFT: 'DRAFT',
  READY_FOR_REVIEW: 'READY_FOR_REVIEW',
  REQUEST_CHANGES: 'REQUEST_CHANGES',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
type ProviderOnboardingStatus = (typeof ProviderOnboardingStatus)[keyof typeof ProviderOnboardingStatus];

export const adminUsersRouter = Router();

// Mount IAM-enhanced provider sub-routes with full middleware chain (auth + RBAC + org-scope)
// This is mounted BEFORE the generic adminRoles middleware to use its own enforcement.
adminUsersRouter.use('/providers/iam', providerIamRouter);

/* test 
import { ProviderOnboardingStatus } from "@prisma/client";*/

export const REVIEWED_STATUSES = [
  ProviderOnboardingStatus.APPROVED,
  ProviderOnboardingStatus.REJECTED,
  ProviderOnboardingStatus.REQUEST_CHANGES,
] as const;

export function isReviewedStatus(
  status: ProviderOnboardingStatus
): status is (typeof REVIEWED_STATUSES)[number] {
  return REVIEWED_STATUSES.includes(status as any);
}
/* test */
const adminRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT'];
const organizationReadRoles = [...adminRoles, 'FINANCE'];
const organizationWriteRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'FINANCE'];
const providerRoles: UserRole[] = [UserRole.PROVIDER, UserRole.NURSE, UserRole.PHARMACIST, UserRole.LAB_TECH];
const providerSystemRoles = providerRoles;

const accountStatuses: AccountStatus[] = [AccountStatus.ACTIVE, AccountStatus.SUSPENDED, AccountStatus.ARCHIVED];
const providerOnboardingStatuses: ProviderOnboardingStatus[] = [
  ProviderOnboardingStatus.DRAFT,
  ProviderOnboardingStatus.READY_FOR_REVIEW,
  ProviderOnboardingStatus.REQUEST_CHANGES,
  ProviderOnboardingStatus.APPROVED,
  ProviderOnboardingStatus.REJECTED,
];


type CredentialDocumentType = 'LICENSE' | 'ID_DOCUMENT' | 'INSURANCE' | 'CERTIFICATION' | 'DEGREE' | 'OTHER';
type CredentialDocumentStatus = 'MISSING' | 'UPLOADED' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';

const credentialDocumentTypes: CredentialDocumentType[] = ['LICENSE', 'ID_DOCUMENT', 'INSURANCE', 'CERTIFICATION', 'DEGREE', 'OTHER'];
const credentialDocumentStatuses: CredentialDocumentStatus[] = ['MISSING', 'UPLOADED', 'VERIFIED', 'REJECTED', 'EXPIRED'];
const requiredProviderCredentialTypes: CredentialDocumentType[] = ['LICENSE', 'ID_DOCUMENT', 'INSURANCE'];

type CredentialReviewTaskStatus = 'OPEN' | 'IN_REVIEW' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';
type CredentialReviewTaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
type CredentialNotificationChannel = 'EMAIL' | 'IN_APP' | 'MANUAL';
type CredentialNotificationStatus = 'QUEUED' | 'SENT' | 'FAILED' | 'CANCELLED';

const credentialNotificationChannels: CredentialNotificationChannel[] = ['EMAIL', 'IN_APP', 'MANUAL'];
const credentialNotificationStatuses: CredentialNotificationStatus[] = ['QUEUED', 'SENT', 'FAILED', 'CANCELLED'];

const credentialReviewTaskStatuses: CredentialReviewTaskStatus[] = ['OPEN', 'IN_REVIEW', 'BLOCKED', 'COMPLETED', 'CANCELLED'];
const credentialReviewPriorities: CredentialReviewTaskPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const activeCredentialReviewTaskStatuses: CredentialReviewTaskStatus[] = ['OPEN', 'IN_REVIEW', 'BLOCKED'];

function normalizeCredentialDocumentType(value: unknown, fallback: CredentialDocumentType = 'OTHER'): CredentialDocumentType {
  const requested = clean(value).toUpperCase() as CredentialDocumentType;
  return credentialDocumentTypes.includes(requested) ? requested : fallback;
}

function normalizeCredentialDocumentStatus(value: unknown, fallback: CredentialDocumentStatus = 'UPLOADED'): CredentialDocumentStatus {
  const requested = clean(value).toUpperCase() as CredentialDocumentStatus;
  return credentialDocumentStatuses.includes(requested) ? requested : fallback;
}

function normalizeCredentialReviewTaskStatus(value: unknown, fallback: CredentialReviewTaskStatus = 'OPEN'): CredentialReviewTaskStatus {
  const requested = clean(value).toUpperCase() as CredentialReviewTaskStatus;
  return credentialReviewTaskStatuses.includes(requested) ? requested : fallback;
}

function normalizeCredentialReviewPriority(value: unknown, fallback: CredentialReviewTaskPriority = 'NORMAL'): CredentialReviewTaskPriority {
  const requested = clean(value).toUpperCase() as CredentialReviewTaskPriority;
  return credentialReviewPriorities.includes(requested) ? requested : fallback;
}

function normalizeCredentialNotificationChannel(value: unknown, fallback: CredentialNotificationChannel = 'IN_APP'): CredentialNotificationChannel {
  const requested = clean(value).toUpperCase() as CredentialNotificationChannel;
  return credentialNotificationChannels.includes(requested) ? requested : fallback;
}

function normalizeCredentialNotificationStatus(value: unknown, fallback: CredentialNotificationStatus = 'QUEUED'): CredentialNotificationStatus {
  const requested = clean(value).toUpperCase() as CredentialNotificationStatus;
  return credentialNotificationStatuses.includes(requested) ? requested : fallback;
}

function safeOptionalDate(value: unknown, fieldName: string) {
  const raw = clean(value);
  if (!raw) return null;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw badRequest(`${fieldName} must be a valid date`);
  return parsed;
}

function expiryState(expiresAt?: Date | string | null, status?: string | null) {
  if (!expiresAt) return 'NO_EXPIRY';
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return 'NO_EXPIRY';
  const today = new Date();
  const inThirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  if (expiry < today || status === 'EXPIRED') return 'EXPIRED';
  if (expiry <= inThirtyDays) return 'EXPIRING_SOON';
  return 'VALID';
}

function mapCredentialDocument(document: any) {
  const computedExpiryState = expiryState(document.expiresAt, document.status);
  return {
    id: document.id,
    providerId: document.providerId,
    type: document.type,
    title: document.title,
    status: computedExpiryState === 'EXPIRED' && document.status === 'VERIFIED' ? 'EXPIRED' : document.status,
    storedStatus: document.status,
    documentUrl: document.documentUrl ?? null,
    fileName: document.fileName ?? null,
    referenceNumber: document.referenceNumber ?? null,
    issuedAt: document.issuedAt ?? null,
    expiresAt: document.expiresAt ?? null,
    expiryState: computedExpiryState,
    rejectionReason: document.rejectionReason ?? null,
    verifiedAt: document.verifiedAt ?? null,
    verifiedByName: document.verifiedBy ? `${document.verifiedBy.firstName} ${document.verifiedBy.lastName}`.trim() : null,
    notes: document.notes ?? null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function mapProviderCredentialReviewTask(task: any) {
  return {
    id: task.id,
    organizationId: task.organizationId,
    providerId: task.providerId,
    documentId: task.documentId ?? null,
    documentType: task.document?.type ?? null,
    documentTitle: task.document?.title ?? null,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueAt: task.dueAt ?? null,
    assignedToId: task.assignedToId ?? null,
    assignedToName: task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}`.trim() : null,
    assignedToEmail: task.assignedTo?.email ?? null,
    createdByName: task.createdBy ? `${task.createdBy.firstName} ${task.createdBy.lastName}`.trim() : null,
    completedAt: task.completedAt ?? null,
    cancelledAt: task.cancelledAt ?? null,
    blockReason: task.blockReason ?? null,
    decisionNote: task.decisionNote ?? null,
    providerName: task.provider?.user ? `${task.provider.user.firstName} ${task.provider.user.lastName}`.trim() : null,
    providerEmail: task.provider?.user?.email ?? null,
    organizationName: task.organization?.name ?? null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

function mapProviderCredentialNotification(notification: any) {
  return {
    id: notification.id,
    organizationId: notification.organizationId,
    providerId: notification.providerId,
    providerName: notification.provider?.user ? `${notification.provider.user.firstName} ${notification.provider.user.lastName}`.trim() : null,
    providerEmail: notification.provider?.user?.email ?? null,
    documentId: notification.documentId ?? null,
    documentType: notification.document?.type ?? null,
    documentTitle: notification.document?.title ?? null,
    taskId: notification.taskId ?? null,
    taskTitle: notification.task?.title ?? null,
    channel: notification.channel,
    status: notification.status,
    subject: notification.subject,
    message: notification.message,
    recipientEmail: notification.recipientEmail ?? null,
    scheduledFor: notification.scheduledFor ?? null,
    sentAt: notification.sentAt ?? null,
    failureReason: notification.failureReason ?? null,
    deliveryProvider: notification.deliveryProvider ?? null,
    deliveryProviderMessageId: notification.deliveryProviderMessageId ?? null,
    dispatchAttemptCount: notification.dispatchAttemptCount ?? 0,
    lastDispatchAt: notification.lastDispatchAt ?? null,
    createdByName: notification.createdBy ? `${notification.createdBy.firstName} ${notification.createdBy.lastName}`.trim() : null,
    organizationName: notification.organization?.name ?? null,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
  };
}

function providerReviewTaskInclude() {
  return {
    assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
    createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    document: { select: { id: true, type: true, title: true, status: true } },
  };
}

function providerNotificationInclude() {
  return {
    provider: { include: { user: true } },
    document: { select: { id: true, type: true, title: true, status: true, expiresAt: true } },
    task: { select: { id: true, title: true, status: true, priority: true, dueAt: true } },
    createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    organization: { select: { name: true } },
  };
}

function activeReviewTaskWhere(providerId: string, documentId?: string | null) {
  return {
    providerId,
    ...(documentId ? { documentId } : {}),
    status: { in: activeCredentialReviewTaskStatuses },
  };
}

function autoReviewTaskTitle(document: any) {
  const label = document?.title || String(document?.type ?? 'credential document').replaceAll('_', ' ');
  return `Review ${label}`;
}

function notificationPayloadFromBody(body: any, defaults: { subject: string; message: string; recipientEmail?: string | null }) {
  const status = normalizeCredentialNotificationStatus(body?.status, 'QUEUED');
  return {
    channel: normalizeCredentialNotificationChannel(body?.channel, 'EMAIL'),
    status,
    subject: clean(body?.subject) || defaults.subject,
    message: clean(body?.message) || defaults.message,
    recipientEmail: clean(body?.recipientEmail) || defaults.recipientEmail || null,
    scheduledFor: body?.scheduledFor !== undefined ? safeOptionalDate(body.scheduledFor, 'scheduledFor') : null,
    sentAt: status === 'SENT' ? new Date() : null,
    failureReason: status === 'FAILED' ? clean(body?.failureReason) || 'Manual reminder marked failed' : null,
  };
}

async function resolveReviewerId(req: any, value: unknown) {
  const raw = clean(value);
  if (!raw) return null;
  const where = raw.includes('@') ? { email: raw.toLowerCase() } : { id: raw };
  const reviewer = await prisma.user.findFirst({
    where: {
      ...where,
      role: { in: [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.COMPANY_SUPPORT] },
      ...(req.user?.organizationId ? { organizationId: req.user.organizationId } : {}),
    },
    select: { id: true, organizationId: true },
  });
  if (!reviewer) throw badRequest('Assigned reviewer was not found or is not an admin/support user');
  if (req.user?.organizationId && reviewer.organizationId !== req.user.organizationId) throw forbidden('Assigned reviewer is outside the current organization scope');
  return reviewer.id;
}

async function ensureOpenCredentialReviewTask(tx: any, current: any, document: any, actorId?: string) {
  if (!document?.id) return null;
  if (['VERIFIED', 'REJECTED'].includes(String(document.status))) return null;
  const existing = await tx.providerCredentialReviewTask.findFirst({ where: activeReviewTaskWhere(current.id, document.id), orderBy: { createdAt: 'desc' } });
  if (existing) return existing;
  const state = expiryState(document.expiresAt, document.status);
  return tx.providerCredentialReviewTask.create({
    data: {
      organizationId: current.organizationId,
      providerId: current.id,
      documentId: document.id,
      title: autoReviewTaskTitle(document),
      priority: state === 'EXPIRING_SOON' || state === 'EXPIRED' ? 'HIGH' : 'NORMAL',
      dueAt: state === 'EXPIRING_SOON' || state === 'EXPIRED' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null,
      createdById: actorId ?? null,
      metadata: { source: 'credential_document_auto_review' },
    },
  });
}

async function closeOpenCredentialReviewTasksForDocument(tx: any, current: any, document: any, status: CredentialDocumentStatus, decisionNote?: string | null) {
  if (!document?.id || !['VERIFIED', 'REJECTED', 'EXPIRED'].includes(status)) return;
  await tx.providerCredentialReviewTask.updateMany({
    where: activeReviewTaskWhere(current.id, document.id),
    data: {
      status: status === 'VERIFIED' ? 'COMPLETED' : 'BLOCKED',
      completedAt: status === 'VERIFIED' ? new Date() : null,
      blockReason: status === 'REJECTED' ? clean(decisionNote) || 'Credential document rejected' : status === 'EXPIRED' ? 'Credential document expired' : null,
      decisionNote: clean(decisionNote) || `${document.type} marked ${status}`,
    },
  });
}

function credentialSummary(documents: any[] = []) {
  const mapped = documents.map(mapCredentialDocument);
  return {
    total: mapped.length,
    verified: mapped.filter((item) => item.status === 'VERIFIED').length,
    uploaded: mapped.filter((item) => item.status === 'UPLOADED').length,
    rejected: mapped.filter((item) => item.status === 'REJECTED').length,
    expired: mapped.filter((item) => item.expiryState === 'EXPIRED').length,
    expiringSoon: mapped.filter((item) => item.expiryState === 'EXPIRING_SOON').length,
    missingRequiredTypes: requiredProviderCredentialTypes.filter((type) => !mapped.some((item) => item.type === type && item.status === 'VERIFIED')),
  };
}

async function syncProviderCredentialChecklist(tx: any, providerId: string, actorId?: string) {
  const profile = await tx.providerProfile.findUnique({
    where: { id: providerId },
    include: { organization: { select: { name: true } }, user: true, roleCatalog: true, onboardingState: true, credentialDocuments: { include: { verifiedBy: true } }, credentialReviewTasks: { where: { status: { in: activeCredentialReviewTaskStatuses } }, include: providerReviewTaskInclude(), orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }, { createdAt: 'desc' }], take: 6 } },
  });
  if (!profile) return null;

  await ensureProviderOnboardingState(
    tx,
    profile,
    actorId,
    profile.onboardingState?.status ?? ProviderOnboardingStatus.DRAFT,
    profile.onboardingState?.decisionNote ?? null,
  );

  return tx.providerProfile.findUnique({
    where: { id: providerId },
    include: { organization: { select: { name: true } }, user: true, roleCatalog: true, onboardingState: true, credentialDocuments: { include: { verifiedBy: true } }, credentialReviewTasks: { where: { status: { in: activeCredentialReviewTaskStatuses } }, include: providerReviewTaskInclude(), orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }, { createdAt: 'desc' }], take: 6 } },
  });
}

function normalizeProviderOnboardingStatus(value: unknown, fallback: ProviderOnboardingStatus = ProviderOnboardingStatus.DRAFT): ProviderOnboardingStatus {
  const requested = clean(value).toUpperCase() as ProviderOnboardingStatus;
  return providerOnboardingStatuses.includes(requested) ? requested : fallback;
}

function normalizeAccountStatus(value: unknown, fallback: AccountStatus = AccountStatus.ACTIVE): AccountStatus {
  const requested = clean(value).toUpperCase() as AccountStatus;
  return accountStatuses.includes(requested) ? requested : fallback;
}

function statusPatch(body: any, currentStatus: AccountStatus = AccountStatus.ACTIVE) {
  if (body?.status === undefined && body?.deactivationReason === undefined) return {};

  const status = body?.status === undefined ? currentStatus : normalizeAccountStatus(body.status, currentStatus);
  const nowInactive = status !== AccountStatus.ACTIVE;
  return {
    status,
    deactivatedAt: nowInactive ? new Date() : null,
    deactivationReason: nowInactive ? clean(body?.deactivationReason) || null : null,
  };
}

function statusAuditAction(resourcePrefix: 'admin.patient' | 'admin.provider' | 'admin.user', from: AccountStatus, to: AccountStatus) {
  if (to === AccountStatus.ACTIVE && from !== AccountStatus.ACTIVE) return `${resourcePrefix}.restored`;
  if (to === AccountStatus.SUSPENDED) return `${resourcePrefix}.suspended`;
  if (to === AccountStatus.ARCHIVED) return `${resourcePrefix}.archived`;
  return `${resourcePrefix}.status_changed`;
}

function profileResource(type: 'PATIENT' | 'PROVIDER') {
  return type === 'PATIENT' ? 'patient_profile' : 'provider_profile';
}

async function revokeSessions(tx: any, userId: string) {
  await tx.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

async function resolveExistingActorId(tx: any, actorId?: string) {
  if (!actorId) return null;
  const actor = await tx.user.findUnique({ where: { id: actorId }, select: { id: true } }).catch(() => null);
  return actor?.id ?? null;
}

async function safeWriteAccountAuditLog(input: Parameters<typeof writeAuditLog>[0]) {
  try {
    const actorId = input.actorId ? await resolveExistingActorId(prisma, input.actorId) : null;
    await writeAuditLog({ ...input, actorId: actorId ?? undefined });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[admin-users] Account operation completed but audit logging failed.', error);
    }
  }
}

function translateProviderPrismaError(error: unknown, operation: 'create' | 'update') {
  if (error instanceof PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return badRequest('Email is already used by another account', { code: error.code, target: error.meta?.target ?? null });
    }

    if (error.code === 'P2003') {
      return badRequest(`Provider ${operation} failed because a linked organization, admin actor, or related credential record was not found. Refresh the page, verify the selected organization, then retry.`, { code: error.code, field: error.meta?.field_name ?? null });
    }

    if (error.code === 'P2021' || error.code === 'P2022') {
      return badRequest(`Provider ${operation} failed because the account-governance database migrations are not fully applied. Run Prisma migrate and Prisma generate, then restart the API.`, { code: error.code, meta: error.meta ?? null });
    }
  }

  return error;
}



// Organization management has its own role gate because the Admin portal also
// signs in FINANCE users. Keeping these routes above the broader account-user
// router guard prevents the generic "Role is not allowed" runtime error while
// avoiding accidental FINANCE access to patient/provider CRUD endpoints.
adminUsersRouter.get('/organizations', requireAuth, allowRoles(organizationReadRoles), async (req, res) => {
  if (req.user?.organizationId && !isSuperAdmin(req)) {
    const organization = await prisma.organization.findUnique({ where: { id: req.user.organizationId } });
    const items = organization ? [await mapOrganization(organization)] : [];
    res.json({ items, count: items.length, scoped: true, fallbackOrganizationName: defaultOrganizationName, canManage: organizationWriteRoles.includes(req.user.role) });
    return;
  }

  const q = clean(req.query.q).toLowerCase();
  const organizations = await prisma.organization.findMany({ orderBy: { name: 'asc' }, take: 500 });
  const summaries = await getOrganizationDependencySummariesBatched(organizations.map((organization) => organization.id));
  const mapped = organizations.map((organization) => buildOrganizationView(organization, summaries.get(organization.id) ?? {}));
  const items = mapped.filter((organization) => !q || [organization.name, organization.id].join(' ').toLowerCase().includes(q));
  res.json({ items, count: items.length, scoped: false, fallbackOrganizationName: defaultOrganizationName, canManage: organizationWriteRoles.includes(req.user?.role ?? '') });
});

adminUsersRouter.post('/organizations', requireAuth, allowRoles(organizationWriteRoles), async (req, res) => {
  const name = clean(req.body?.name);
  if (!name) throw badRequest('Organization name is required');

  const duplicate = await prisma.organization.findFirst({ where: { name: { equals: name, mode: 'insensitive' } }, select: { id: true } });
  if (duplicate) throw badRequest('Organization name is already used');

  const organization = await prisma.organization.create({ data: { name } });
  await writeAuditLog({ actorId: req.user?.userId, organizationId: organization.id, action: 'admin.organization.created', resource: 'organization', resourceId: organization.id, details: { name } });
  res.status(201).json({ item: await mapOrganization(organization) });
});

adminUsersRouter.put('/organizations/:organizationId', requireAuth, allowRoles(organizationWriteRoles), async (req, res) => {
  const current = await prisma.organization.findUnique({ where: { id: req.params.organizationId } });
  if (!current) throw notFound('Organization not found');

  const name = clean(req.body?.name);
  if (!name) throw badRequest('Organization name is required');
  const duplicate = await prisma.organization.findFirst({ where: { name: { equals: name, mode: 'insensitive' }, id: { not: current.id } }, select: { id: true } });
  if (duplicate) throw badRequest('Organization name is already used');

  const organization = await prisma.organization.update({ where: { id: current.id }, data: { name } });
  await writeAuditLog({ actorId: req.user?.userId, organizationId: organization.id, action: 'admin.organization.updated', resource: 'organization', resourceId: organization.id, details: { fromName: current.name, toName: name } });
  res.json({ item: await mapOrganization(organization) });
});

adminUsersRouter.delete('/organizations/:organizationId', requireAuth, allowRoles(organizationWriteRoles), async (req, res) => {
  const current = await prisma.organization.findUnique({ where: { id: req.params.organizationId } });
  if (!current) throw notFound('Organization not found');

  if (current.name?.toLowerCase() === defaultOrganizationName.toLowerCase()) {
    throw badRequest('Fallback organization cannot be deleted because account creation can use it automatically.');
  }

  const dependencySummary = await getOrganizationDependencySummary(current.id);
  if (countTotal(dependencySummary) > 0) {
    throw badRequest('Organization cannot be deleted while protected downstream records exist.', { dependencies: dependencySummary });
  }

  await prisma.organization.delete({ where: { id: current.id } });
  await writeAuditLog({ actorId: req.user?.userId, organizationId: current.id, action: 'admin.organization.deleted', resource: 'organization', resourceId: current.id, details: { name: current.name } });
  res.status(204).send();
});

adminUsersRouter.use(requireAuth, allowRoles(adminRoles));

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeEmail(value: unknown) {
  return clean(value).toLowerCase();
}

function isSuperAdmin(req: any) {
  return req.user?.role === UserRole.SUPER_ADMIN || req.user?.role === 'SUPER_ADMIN';
}

const defaultOrganizationName = 'Unassigned CarePoint Organization';

async function ensureFallbackOrganization(tx: any = prisma) {
  const existing = await tx.organization.findFirst({
    where: { name: { equals: defaultOrganizationName, mode: 'insensitive' } },
    select: { id: true, name: true },
  });
  if (existing) return existing;

  return tx.organization.create({
    data: { name: defaultOrganizationName },
    select: { id: true, name: true },
  });
}

async function getOrganizationId(req: any, input?: unknown) {
  const explicit = clean(input);
  if (req.user?.organizationId) return req.user.organizationId;

  if (explicit) {
    const exists = await prisma.organization.findUnique({ where: { id: explicit }, select: { id: true } });
    if (!exists) throw badRequest('Selected organization was not found');
    return explicit;
  }

  const fallback = await ensureFallbackOrganization();
  return fallback.id;
}

function splitName(body: any) {
  const firstName = clean(body.firstName);
  const lastName = clean(body.lastName);
  const fullName = clean(body.name);
  if (firstName || lastName) return { firstName, lastName };

  const parts = fullName.split(/\s+/).filter(Boolean);
  return { firstName: parts.shift() ?? '', lastName: parts.join(' ') || 'User' };
}

function validateProviderRole(role: unknown): UserRole {
  const requested = clean(role).toUpperCase() as UserRole;
  return providerRoles.includes(requested) ? requested : UserRole.PROVIDER;
}



function parseBooleanInput(value: unknown, fallback: boolean) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = clean(value).toLowerCase();
  if (['true', '1', 'yes', 'active'].includes(normalized)) return true;
  if (['false', '0', 'no', 'inactive'].includes(normalized)) return false;
  return fallback;
}

function providerRoleCode(value: unknown, fallbackLabel?: unknown) {
  const raw = clean(value) || clean(fallbackLabel);
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

function providerRoleLabel(value: unknown) {
  return clean(value).replace(/\s+/g, ' ').slice(0, 120);
}

function mapProviderRoleCatalog(role: any, providerCount = 0) {
  return {
    id: role.id,
    organizationId: role.organizationId ?? null,
    organizationName: role.organization?.name ?? null,
    code: role.code,
    label: role.label,
    description: role.description ?? null,
    systemRole: role.systemRole,
    isActive: Boolean(role.isActive),
    isSystem: Boolean(role.isSystem),
    sortOrder: role.sortOrder ?? 100,
    providerCount,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}

async function ensureDefaultProviderRoleCatalog(tx: any = prisma) {
  const defaults = [
    { id: 'provider-role-provider', code: 'PROVIDER', label: 'Provider', systemRole: UserRole.PROVIDER, sortOrder: 10 },
    { id: 'provider-role-nurse', code: 'NURSE', label: 'Nurse', systemRole: UserRole.NURSE, sortOrder: 20 },
    { id: 'provider-role-pharmacist', code: 'PHARMACIST', label: 'Pharmacist', systemRole: UserRole.PHARMACIST, sortOrder: 30 },
    { id: 'provider-role-lab-tech', code: 'LAB_TECH', label: 'Lab technician', systemRole: UserRole.LAB_TECH, sortOrder: 40 },
  ];

  for (const item of defaults) {
    await tx.providerRoleCatalog.upsert({
      where: { code: item.code },
      update: { label: item.label, systemRole: item.systemRole, isActive: true, isSystem: true, sortOrder: item.sortOrder },
      create: { id: item.id, code: item.code, label: item.label, systemRole: item.systemRole, isActive: true, isSystem: true, sortOrder: item.sortOrder },
    });
  }
}

async function providerRoleUsageCount(role: any) {
  const direct = await prisma.providerProfile.count({ where: { roleCatalogId: role.id } });
  if (!role.isSystem) return direct;

  const legacy = await prisma.providerProfile.count({ where: { roleCatalogId: null, user: { role: role.systemRole } } });
  return direct + legacy;
}

async function resolveProviderRoleSelection(req: any, value: unknown, fallback: UserRole = UserRole.PROVIDER) {
  await ensureDefaultProviderRoleCatalog();
  const raw = clean(value);
  if (!raw) {
    const fallbackCode = providerRoleCode(fallback);
    const fallbackCatalog = await prisma.providerRoleCatalog.findFirst({ where: { code: fallbackCode, isActive: true } });
    return { systemRole: fallback, catalogId: fallbackCatalog?.id ?? null, code: fallbackCode };
  }

  const code = providerRoleCode(raw);
  const catalog = await prisma.providerRoleCatalog.findFirst({
    where: {
      isActive: true,
      OR: [{ id: raw }, { code }],
    },
  });

  if (catalog && providerSystemRoles.includes(catalog.systemRole)) {
    return { systemRole: catalog.systemRole, catalogId: catalog.id, code: catalog.code };
  }

  const requestedSystemRole = code as UserRole;
  if (providerSystemRoles.includes(requestedSystemRole)) return { systemRole: requestedSystemRole, catalogId: null, code };

  throw badRequest('Selected provider role is not active or does not exist');
}

function safeDate(value: unknown) {
  const raw = clean(value);
  if (!raw) return null;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw badRequest('dateOfBirth must be a valid date');
  return parsed;
}

function parseServices(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);

  const raw = clean(value);
  if (!raw) return [];
  return raw.split(/[,|]/).map((item) => item.trim()).filter(Boolean);
}

function parseIds(value: unknown) {
  const values = Array.isArray(value) ? value : [value];
  return Array.from(new Set(values.map((item) => clean(item)).filter(Boolean)));
}

function normalizeAccountType(value: unknown): 'PATIENT' | 'PROVIDER' {
  const requested = clean(value).toUpperCase();
  if (requested === 'PATIENT' || requested === 'PROVIDER') return requested;
  throw badRequest('type must be PATIENT or PROVIDER');
}

function assertSameOrg(req: any, organizationId: string) {
  if (req.user?.organizationId && req.user.organizationId !== organizationId) {
    throw forbidden('Requested account is outside the current organization scope');
  }
}

async function assertEmailAvailable(email: string, currentUserId?: string) {
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing && existing.id !== currentUserId) throw badRequest('Email is already used by another account');
}

function countTotal(summary: Record<string, number>) {
  return Object.values(summary).reduce((sum, value) => sum + value, 0);
}

function compactDependencySummary(summary: Record<string, number>) {
  return Object.fromEntries(Object.entries(summary).filter(([, value]) => value > 0));
}

async function getPatientDeletionSummary(patientId: string, userId: string) {
  const [
    appointments,
    messageThreads,
    appointmentSubjects,
    familyProfiles,
    notifications,
    supportTickets,
    reminderPlans,
    carePlanItems,
    rpmPrograms,
    consentRecords,
    sentMessages,
    actorAuditLogs,
  ] = await Promise.all([
    prisma.appointment.count({ where: { patientId } }),
    prisma.medicalRecord.count({ where: { patientId } }),
    prisma.messageThread.count({ where: { patientId } }),
    prisma.payment.count({ where: { patientId } }),
    prisma.appointmentSubjectContext.count({ where: { patientId } }),
    prisma.patientFamilyProfile.count({ where: { patientId } }),
    prisma.patientNotificationItem.count({ where: { patientId } }),
    prisma.patientSupportTicket.count({ where: { patientId } }),
    prisma.patientReminderPlan.count({ where: { patientId } }),
    prisma.patientCarePlanItem.count({ where: { patientId } }),
    prisma.patientRpmProgram.count({ where: { patientId } }),
    prisma.patientConsentRecord.count({ where: { patientId } }),
    prisma.message.count({ where: { senderId: userId } }),
    prisma.auditLog.count({ where: { actorId: userId } }),
  ]);

  return compactDependencySummary({
    appointments,
    messageThreads,
    appointmentSubjects,
    familyProfiles,
    notifications,
    supportTickets,
    reminderPlans,
    carePlanItems,
    rpmPrograms,
    consentRecords,
    sentMessages,
    actorAuditLogs,
  });
}

async function getProviderDeletionSummary(providerId: string, userId: string) {
  const [
    appointments,
    medicalRecords,
    messageThreads,
    payments,
    schedules,
    clinicalOrders,
    prescriptions,
    labWorkItems,
    rpmEnrollments,
    providerAlerts,
    facilitySettings,
    sentMessages,
    actorAuditLogs,
  ] = await Promise.all([
    prisma.appointment.count({ where: { providerId } }),
    prisma.medicalRecord.count({ where: { providerId } }),
    prisma.messageThread.count({ where: { providerId } }),
    prisma.payment.count({ where: { providerId } }),
    prisma.providerScheduleTemplate.count({ where: { providerId } }),
    prisma.clinicalOrder.count({ where: { providerId } }),
    prisma.prescriptionDraft.count({ where: { providerId } }),
    prisma.labWorkItem.count({ where: { providerId } }),
    prisma.rpmEnrollment.count({ where: { providerId } }),
    prisma.providerAlert.count({ where: { providerId } }),
    prisma.facilitySetting.count({ where: { providerId } }),
    prisma.message.count({ where: { senderId: userId } }),
    prisma.auditLog.count({ where: { actorId: userId } }),
  ]);

  return compactDependencySummary({
    appointments,
    medicalRecords,
    messageThreads,
    payments,
    schedules,
    clinicalOrders,
    prescriptions,
    labWorkItems,
    rpmEnrollments,
    providerAlerts,
    facilitySettings,
    sentMessages,
    actorAuditLogs,
  });
}

async function mapPatient(profile: any) {
  const dependencySummary = await getPatientDeletionSummary(profile.id, profile.userId);
  return {
    id: profile.id,
    userId: profile.userId,
    type: 'PATIENT',
    name: `${profile.user.firstName} ${profile.user.lastName}`.trim(),
    firstName: profile.user.firstName,
    lastName: profile.user.lastName,
    email: profile.user.email,
    role: profile.user.role,
    status: profile.user.status ?? AccountStatus.ACTIVE,
    deactivatedAt: profile.user.deactivatedAt ?? null,
    deactivationReason: profile.user.deactivationReason ?? null,
    organizationId: profile.organizationId,
    organizationName: profile.organization?.name ?? null,
    dateOfBirth: profile.dateOfBirth,
    insuranceNumber: profile.insuranceNumber,
    dependencySummary,
    canDelete: countTotal(dependencySummary) === 0,
    createdAt: profile.user.createdAt,
    updatedAt: profile.user.updatedAt,
  };
}


function buildProviderOnboardingChecklist(profile: any) {
  const services = Array.isArray(profile.services) ? profile.services : [];
  const documents = Array.isArray(profile.credentialDocuments) ? profile.credentialDocuments : [];
  const summary = credentialSummary(documents);
  const hasVerifiedLicense = documents.some((document: any) => document.type === 'LICENSE' && document.status === 'VERIFIED');

  return [
    {
      label: 'Professional license',
      detail: profile.licenseNumber ? 'License number captured for credentialing review.' : 'License number is missing and must be supplied before approval.',
      status: profile.licenseNumber ? 'Ready' : 'Missing',
      variant: profile.licenseNumber ? 'success' : 'warning',
    },
    {
      label: 'Verified license document',
      detail: hasVerifiedLicense ? 'License document has been verified.' : 'A verified professional license document is required.',
      status: hasVerifiedLicense ? 'Verified' : 'Pending',
      variant: hasVerifiedLicense ? 'success' : 'warning',
    },
    {
      label: 'Identity and insurance documents',
      detail: summary.missingRequiredTypes.length === 0 ? 'Required identity and insurance documents are verified.' : `Missing verified documents: ${summary.missingRequiredTypes.join(', ')}`,
      status: summary.missingRequiredTypes.length === 0 ? 'Verified' : 'Pending',
      variant: summary.missingRequiredTypes.length === 0 ? 'success' : 'warning',
    },
    {
      label: 'Clinical specialty',
      detail: profile.specialty ? 'Specialty captured for service routing.' : 'Specialty is not set.',
      status: profile.specialty ? 'Ready' : 'Missing',
      variant: profile.specialty ? 'success' : 'warning',
    },
    {
      label: 'Service scope',
      detail: services.length > 0 ? services.join(', ') : 'No service channels assigned.',
      status: services.length > 0 ? 'Ready' : 'Pending',
      variant: services.length > 0 ? 'success' : 'info',
    },
  ];
}

async function ensureProviderOnboardingState(tx: any, profile: any, actorId?: string, status: ProviderOnboardingStatus = ProviderOnboardingStatus.DRAFT, decisionNote?: string | null) {
  const safeActorId = await resolveExistingActorId(tx, actorId);

  return tx.providerOnboardingState.upsert({
    where: { providerId: profile.id },
    create: {
      providerId: profile.id,
      organizationId: profile.organizationId,
      status,
      checklist: buildProviderOnboardingChecklist(profile),
      requestedFields: {
        specialty: profile.specialty ?? '',
        licenseNumber: profile.licenseNumber ?? '',
        services: Array.isArray(profile.services) ? profile.services : [],
      },
      decisionNote: decisionNote ?? null,
      submittedAt: status === ProviderOnboardingStatus.READY_FOR_REVIEW ? new Date() : null,
      /* reviewedAt: [ProviderOnboardingStatus.APPROVED, ProviderOnboardingStatus.REJECTED, ProviderOnboardingStatus.REQUEST_CHANGES].includes(status) ? new Date() : null,*/
	  reviewedAt: isReviewedStatus(status) ? new Date() : null,
      lastAction: 'admin.provider.onboarding_initialized',
      lastActorId: safeActorId,
    },
    update: {
      organizationId: profile.organizationId,
      checklist: buildProviderOnboardingChecklist(profile),
      requestedFields: {
        specialty: profile.specialty ?? '',
        licenseNumber: profile.licenseNumber ?? '',
        services: Array.isArray(profile.services) ? profile.services : [],
      },
      ...(status ? { status } : {}),
      ...(decisionNote !== undefined ? { decisionNote } : {}),
      submittedAt: status === ProviderOnboardingStatus.READY_FOR_REVIEW ? new Date() : undefined,
      /* reviewedAt: [ProviderOnboardingStatus.APPROVED, ProviderOnboardingStatus.REJECTED, ProviderOnboardingStatus.REQUEST_CHANGES].includes(status) ? new Date() : undefined,*/
	  reviewedAt: isReviewedStatus(status) ? new Date() : undefined,
      lastAction: 'admin.provider.onboarding_initialized',
      ...(safeActorId ? { lastActorId: safeActorId } : {}),
    },
  });
}

function mapProviderOnboarding(state: any) {
  if (!state) {
    return {
      status: ProviderOnboardingStatus.DRAFT,
      checklist: [],
      submittedAt: null,
      reviewedAt: null,
      decisionNote: null,
      requestedFields: {},
      lastAction: null,
    };
  }

  return {
    id: state.id,
    status: state.status ?? ProviderOnboardingStatus.DRAFT,
    checklist: Array.isArray(state.checklist) ? state.checklist : [],
    submittedAt: state.submittedAt ?? null,
    reviewedAt: state.reviewedAt ?? null,
    decisionNote: state.decisionNote ?? null,
    requestedFields: state.requestedFields ?? {},
    lastAction: state.lastAction ?? null,
  };
}

async function mapProvider(profile: any) {
  const dependencySummary = await getProviderDeletionSummary(profile.id, profile.userId);
  const credentialDocuments = Array.isArray(profile.credentialDocuments) ? profile.credentialDocuments.map(mapCredentialDocument) : [];
  return {
    id: profile.id,
    userId: profile.userId,
    type: 'PROVIDER',
    name: `${profile.user.firstName} ${profile.user.lastName}`.trim(),
    firstName: profile.user.firstName,
    lastName: profile.user.lastName,
    email: profile.user.email,
    role: profile.roleCatalog?.code ?? profile.user.role,
    roleLabel: profile.roleCatalog?.label ?? profile.user.role,
    roleCatalogId: profile.roleCatalogId ?? null,
    systemRole: profile.user.role,
    status: profile.user.status ?? AccountStatus.ACTIVE,
    deactivatedAt: profile.user.deactivatedAt ?? null,
    deactivationReason: profile.user.deactivationReason ?? null,
    organizationId: profile.organizationId,
    organizationName: profile.organization?.name ?? null,
    specialty: profile.specialty,
    licenseNumber: profile.licenseNumber,
    services: Array.isArray(profile.services) ? profile.services : [],
    onboarding: mapProviderOnboarding(profile.onboardingState),
    onboardingStatus: profile.onboardingState?.status ?? ProviderOnboardingStatus.DRAFT,
    credentialDocuments,
    credentialReviewTasks: Array.isArray(profile.credentialReviewTasks) ? profile.credentialReviewTasks.map(mapProviderCredentialReviewTask) : [],
    credentialSummary: credentialSummary(profile.credentialDocuments ?? []),
    dependencySummary,
    canDelete: countTotal(dependencySummary) === 0,
    createdAt: profile.user.createdAt,
    updatedAt: profile.user.updatedAt,
  };
}

async function findPatient(id: string) {
  return prisma.patientProfile.findUnique({ where: { id }, include: { organization: { select: { name: true } }, user: true } });
}

async function findProvider(id: string) {
  return prisma.providerProfile.findUnique({ where: { id }, include: { organization: { select: { name: true } }, user: true, roleCatalog: true, onboardingState: true, credentialDocuments: { include: { verifiedBy: true }, orderBy: { createdAt: 'desc' } }, credentialReviewTasks: { where: { status: { in: activeCredentialReviewTaskStatuses } }, include: providerReviewTaskInclude(), orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }, { createdAt: 'desc' }], take: 6 } } });
}

function scopedOrganizationWhere(req: any) {
  return req.user?.organizationId ? { organizationId: req.user.organizationId } : {};
}

function incrementCounter(target: Record<string, number>, key: string | null | undefined) {
  const normalized = clean(key || 'UNKNOWN') || 'UNKNOWN';
  target[normalized] = (target[normalized] ?? 0) + 1;
}

function statusCountTemplate<T extends string>(values: T[]) {
  return Object.fromEntries(values.map((value) => [value, 0])) as Record<T, number>;
}

function dateOnly(value?: Date | string | null) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function isOverdue(value?: Date | string | null) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < Date.now();
}

async function buildGovernanceSummary(req: any) {
  const orgWhere = scopedOrganizationWhere(req);

  const [patients, providers, onboardingStates, credentialDocuments, reviewTasks, notifications, recentAuditEvents] = await Promise.all([
    prisma.patientProfile.findMany({ where: orgWhere, include: { organization: { select: { name: true } }, user: true }, take: 5000 }),
    prisma.providerProfile.findMany({ where: orgWhere, include: { organization: { select: { name: true } }, user: true, onboardingState: true }, take: 5000 }),
    prisma.providerOnboardingState.findMany({ where: orgWhere, take: 5000 }),
    prisma.providerCredentialDocument.findMany({ where: orgWhere, include: { provider: { include: { user: true } }, organization: { select: { name: true } }, verifiedBy: { select: { firstName: true, lastName: true, email: true } } }, take: 5000 }),
    prisma.providerCredentialReviewTask.findMany({ where: orgWhere, include: { assignedTo: { select: { firstName: true, lastName: true, email: true } }, provider: { include: { user: true } }, document: { select: { type: true, title: true } }, organization: { select: { name: true } } }, take: 5000 }),
    prisma.providerCredentialNotification.findMany({ where: orgWhere, include: { provider: { include: { user: true } }, document: { select: { type: true, title: true, expiresAt: true } }, task: { select: { title: true, status: true, priority: true, dueAt: true } }, organization: { select: { name: true } } }, take: 5000 }),
    prisma.auditLog.findMany({ where: { ...orgWhere, action: { startsWith: 'admin.' }, resource: { in: ['patient_profile', 'provider_profile', 'provider_credential_document', 'provider_credential_review_task', 'provider_credential_notification'] } }, orderBy: { createdAt: 'desc' }, take: 20 }),
  ]);

  const patientStatusCounts = statusCountTemplate(accountStatuses);
  const providerStatusCounts = statusCountTemplate(accountStatuses);
  patients.forEach((patient) => incrementCounter(patientStatusCounts, patient.user.status ?? AccountStatus.ACTIVE));
  providers.forEach((provider) => incrementCounter(providerStatusCounts, provider.user.status ?? AccountStatus.ACTIVE));

  const onboardingStatusCounts = statusCountTemplate(providerOnboardingStatuses);
  providers.forEach((provider) => incrementCounter(onboardingStatusCounts, provider.onboardingState?.status ?? ProviderOnboardingStatus.DRAFT));

  const documentStatusCounts = statusCountTemplate(credentialDocumentStatuses);
  const documentTypeCounts = statusCountTemplate(credentialDocumentTypes);
  const expiryCounts = { NO_EXPIRY: 0, VALID: 0, EXPIRING_SOON: 0, EXPIRED: 0 } as Record<string, number>;
  credentialDocuments.forEach((document) => {
    incrementCounter(documentStatusCounts, document.status);
    incrementCounter(documentTypeCounts, document.type);
    incrementCounter(expiryCounts, expiryState(document.expiresAt, document.status));
  });

  const taskStatusCounts = statusCountTemplate(credentialReviewTaskStatuses);
  const taskPriorityCounts = statusCountTemplate(credentialReviewPriorities);
  reviewTasks.forEach((task) => {
    incrementCounter(taskStatusCounts, task.status);
    incrementCounter(taskPriorityCounts, task.priority);
  });

  const notificationStatusCounts = statusCountTemplate(credentialNotificationStatuses);
  const notificationChannelCounts = statusCountTemplate(credentialNotificationChannels);
  notifications.forEach((notification) => {
    incrementCounter(notificationStatusCounts, notification.status);
    incrementCounter(notificationChannelCounts, notification.channel);
  });

  const activeTasks = reviewTasks.filter((task) => activeCredentialReviewTaskStatuses.includes(task.status));
  const overdueTasks = activeTasks.filter((task) => isOverdue(task.dueAt));
  const expiringDocuments = credentialDocuments.filter((document) => expiryState(document.expiresAt, document.status) === 'EXPIRING_SOON');
  const expiredDocuments = credentialDocuments.filter((document) => expiryState(document.expiresAt, document.status) === 'EXPIRED');
  const failedNotifications = notifications.filter((notification) => notification.status === 'FAILED');
  const queuedNotifications = notifications.filter((notification) => notification.status === 'QUEUED');

  return {
    generatedAt: new Date().toISOString(),
    scope: req.user?.organizationId ? 'ORGANIZATION' : 'GLOBAL',
    organizationId: req.user?.organizationId ?? undefined,
    accounts: {
      patients: { total: patients.length, statusCounts: patientStatusCounts },
      providers: { total: providers.length, statusCounts: providerStatusCounts },
      combinedTotal: patients.length + providers.length,
    },
    providerOnboarding: {
      total: onboardingStates.length,
      statusCounts: onboardingStatusCounts,
      readyForReview: onboardingStatusCounts.READY_FOR_REVIEW ?? 0,
      approved: onboardingStatusCounts.APPROVED ?? 0,
      rejected: onboardingStatusCounts.REJECTED ?? 0,
    },
    credentials: {
      total: credentialDocuments.length,
      statusCounts: documentStatusCounts,
      typeCounts: documentTypeCounts,
      expiryCounts,
      expiringSoon: expiringDocuments.length,
      expired: expiredDocuments.length,
      verified: documentStatusCounts.VERIFIED ?? 0,
      rejected: documentStatusCounts.REJECTED ?? 0,
    },
    reviewTasks: {
      total: reviewTasks.length,
      active: activeTasks.length,
      overdue: overdueTasks.length,
      statusCounts: taskStatusCounts,
      priorityCounts: taskPriorityCounts,
    },
    notifications: {
      total: notifications.length,
      queued: queuedNotifications.length,
      failed: failedNotifications.length,
      statusCounts: notificationStatusCounts,
      channelCounts: notificationChannelCounts,
    },
    riskItems: {
      expiredCredentials: expiredDocuments.slice(0, 15).map((document) => ({
        id: document.id,
        providerId: document.providerId,
        providerName: document.provider?.user ? `${document.provider.user.firstName} ${document.provider.user.lastName}`.trim() : null,
        providerEmail: document.provider?.user?.email ?? null,
        organizationName: document.organization?.name ?? null,
        type: document.type,
        title: document.title,
        expiresAt: document.expiresAt,
        status: document.status,
      })),
      expiringCredentials: expiringDocuments.slice(0, 15).map((document) => ({
        id: document.id,
        providerId: document.providerId,
        providerName: document.provider?.user ? `${document.provider.user.firstName} ${document.provider.user.lastName}`.trim() : null,
        providerEmail: document.provider?.user?.email ?? null,
        organizationName: document.organization?.name ?? null,
        type: document.type,
        title: document.title,
        expiresAt: document.expiresAt,
        status: document.status,
      })),
      overdueReviewTasks: overdueTasks.slice(0, 15).map((task) => ({
        id: task.id,
        providerId: task.providerId,
        providerName: task.provider?.user ? `${task.provider.user.firstName} ${task.provider.user.lastName}`.trim() : null,
        providerEmail: task.provider?.user?.email ?? null,
        organizationName: task.organization?.name ?? null,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueAt: task.dueAt,
        assignedTo: task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}`.trim() || task.assignedTo.email : null,
      })),
      failedNotifications: failedNotifications.slice(0, 15).map((notification) => ({
        id: notification.id,
        providerId: notification.providerId,
        providerName: notification.provider?.user ? `${notification.provider.user.firstName} ${notification.provider.user.lastName}`.trim() : null,
        providerEmail: notification.provider?.user?.email ?? null,
        organizationName: notification.organization?.name ?? null,
        channel: notification.channel,
        subject: notification.subject,
        failureReason: notification.failureReason,
        updatedAt: notification.updatedAt,
      })),
    },
    recentActivity: recentAuditEvents.map((event) => ({
      id: event.id,
      action: event.action,
      resource: event.resource,
      resourceId: event.resourceId,
      createdAt: event.createdAt,
    })),
  };
}

async function buildGovernanceReportRows(req: any, reportType: string) {
  const orgWhere = scopedOrganizationWhere(req);
  if (reportType === 'CREDENTIALS') {
    const documents = await prisma.providerCredentialDocument.findMany({
      where: orgWhere,
      include: { provider: { include: { user: true } }, organization: { select: { name: true } }, verifiedBy: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: [{ expiresAt: 'asc' }, { updatedAt: 'desc' }],
      take: 5000,
    });
    return {
      headers: ['organizationName', 'providerName', 'providerEmail', 'documentType', 'title', 'status', 'expiryState', 'issuedAt', 'expiresAt', 'referenceNumber', 'verifiedAt', 'verifiedBy', 'fileName', 'documentUrl'],
      rows: documents.map((document) => ({
        organizationName: document.organization?.name ?? '',
        providerName: document.provider?.user ? `${document.provider.user.firstName} ${document.provider.user.lastName}`.trim() : '',
        providerEmail: document.provider?.user?.email ?? '',
        documentType: document.type,
        title: document.title,
        status: document.status,
        expiryState: expiryState(document.expiresAt, document.status),
        issuedAt: dateOnly(document.issuedAt),
        expiresAt: dateOnly(document.expiresAt),
        referenceNumber: document.referenceNumber ?? '',
        verifiedAt: dateOnly(document.verifiedAt),
        verifiedBy: document.verifiedBy ? `${document.verifiedBy.firstName} ${document.verifiedBy.lastName}`.trim() || document.verifiedBy.email : '',
        fileName: document.fileName ?? '',
        documentUrl: document.documentUrl ?? '',
      })),
      filename: 'carepoint-provider-credential-governance.csv',
    };
  }

  if (reportType === 'TASKS') {
    const tasks = await prisma.providerCredentialReviewTask.findMany({
      where: orgWhere,
      include: { assignedTo: { select: { firstName: true, lastName: true, email: true } }, provider: { include: { user: true } }, document: { select: { type: true, title: true } }, organization: { select: { name: true } } },
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { dueAt: 'asc' }],
      take: 5000,
    });
    return {
      headers: ['organizationName', 'providerName', 'providerEmail', 'title', 'documentType', 'documentTitle', 'status', 'priority', 'dueAt', 'overdue', 'assignedTo', 'completedAt', 'cancelledAt', 'blockReason', 'decisionNote'],
      rows: tasks.map((task) => ({
        organizationName: task.organization?.name ?? '',
        providerName: task.provider?.user ? `${task.provider.user.firstName} ${task.provider.user.lastName}`.trim() : '',
        providerEmail: task.provider?.user?.email ?? '',
        title: task.title,
        documentType: task.document?.type ?? '',
        documentTitle: task.document?.title ?? '',
        status: task.status,
        priority: task.priority,
        dueAt: dateOnly(task.dueAt),
        overdue: activeCredentialReviewTaskStatuses.includes(task.status) && isOverdue(task.dueAt) ? 'YES' : 'NO',
        assignedTo: task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}`.trim() || task.assignedTo.email : '',
        completedAt: dateOnly(task.completedAt),
        cancelledAt: dateOnly(task.cancelledAt),
        blockReason: task.blockReason ?? '',
        decisionNote: task.decisionNote ?? '',
      })),
      filename: 'carepoint-provider-credential-review-tasks.csv',
    };
  }

  if (reportType === 'NOTIFICATIONS') {
    const notifications = await prisma.providerCredentialNotification.findMany({
      where: orgWhere,
      include: providerNotificationInclude(),
      orderBy: [{ status: 'asc' }, { scheduledFor: 'asc' }, { updatedAt: 'desc' }],
      take: 5000,
    });
    return {
      headers: ['organizationName', 'providerName', 'providerEmail', 'channel', 'status', 'subject', 'recipientEmail', 'scheduledFor', 'sentAt', 'deliveryProvider', 'deliveryProviderMessageId', 'dispatchAttemptCount', 'lastDispatchAt', 'failureReason', 'taskTitle', 'documentType', 'documentTitle'],
      rows: notifications.map((notification) => ({
        organizationName: notification.organization?.name ?? '',
        providerName: notification.provider?.user ? `${notification.provider.user.firstName} ${notification.provider.user.lastName}`.trim() : '',
        providerEmail: notification.provider?.user?.email ?? '',
        channel: notification.channel,
        status: notification.status,
        subject: notification.subject,
        recipientEmail: notification.recipientEmail ?? '',
        scheduledFor: dateOnly(notification.scheduledFor),
        sentAt: dateOnly(notification.sentAt),
        deliveryProvider: notification.deliveryProvider ?? '',
        deliveryProviderMessageId: notification.deliveryProviderMessageId ?? '',
        dispatchAttemptCount: notification.dispatchAttemptCount ?? 0,
        lastDispatchAt: dateOnly(notification.lastDispatchAt),
        failureReason: notification.failureReason ?? '',
        taskTitle: notification.task?.title ?? '',
        documentType: notification.document?.type ?? '',
        documentTitle: notification.document?.title ?? '',
      })),
      filename: 'carepoint-provider-credential-notifications.csv',
    };
  }

  const summary = await buildGovernanceSummary(req);
  const rows: Record<string, unknown>[] = [
    { section: 'accounts', metric: 'patients_total', value: summary.accounts.patients.total },
    { section: 'accounts', metric: 'providers_total', value: summary.accounts.providers.total },
    { section: 'accounts', metric: 'combined_total', value: summary.accounts.combinedTotal },
    ...Object.entries(summary.accounts.patients.statusCounts).map(([metric, value]) => ({ section: 'patient_status', metric, value })),
    ...Object.entries(summary.accounts.providers.statusCounts).map(([metric, value]) => ({ section: 'provider_status', metric, value })),
    ...Object.entries(summary.providerOnboarding.statusCounts).map(([metric, value]) => ({ section: 'provider_onboarding', metric, value })),
    ...Object.entries(summary.credentials.statusCounts).map(([metric, value]) => ({ section: 'credential_status', metric, value })),
    ...Object.entries(summary.credentials.expiryCounts).map(([metric, value]) => ({ section: 'credential_expiry', metric, value })),
    ...Object.entries(summary.reviewTasks.statusCounts).map(([metric, value]) => ({ section: 'review_task_status', metric, value })),
    ...Object.entries(summary.reviewTasks.priorityCounts).map(([metric, value]) => ({ section: 'review_task_priority', metric, value })),
    ...Object.entries(summary.notifications.statusCounts).map(([metric, value]) => ({ section: 'notification_status', metric, value })),
    ...Object.entries(summary.notifications.channelCounts).map(([metric, value]) => ({ section: 'notification_channel', metric, value })),
  ];
  return { headers: ['section', 'metric', 'value'], rows, filename: 'carepoint-account-governance-summary.csv' };
}

type DataQualitySeverity = 'BLOCKER' | 'WARNING' | 'INFO';
type DataQualityEntityType = 'PATIENT' | 'PROVIDER' | 'CREDENTIAL_DOCUMENT' | 'REVIEW_TASK' | 'NOTIFICATION';

type DataQualityIssue = {
  id: string;
  severity: DataQualitySeverity;
  category: string;
  entityType: DataQualityEntityType;
  entityId: string;
  organizationId?: string | null;
  organizationName?: string | null;
  accountName?: string | null;
  accountEmail?: string | null;
  title: string;
  detail: string;
  recommendation: string;
};

function accountStatusOf(user: any): AccountStatus {
  return (user?.status ?? AccountStatus.ACTIVE) as AccountStatus;
}

function providerDisplayName(provider: any) {
  return provider?.user ? `${provider.user.firstName ?? ''} ${provider.user.lastName ?? ''}`.trim() : null;
}

function patientDisplayName(patient: any) {
  return patient?.user ? `${patient.user.firstName ?? ''} ${patient.user.lastName ?? ''}`.trim() : null;
}

function addDataQualityIssue(issues: DataQualityIssue[], issue: Omit<DataQualityIssue, 'id'>) {
  issues.push({
    id: `${issue.entityType.toLowerCase()}-${issue.entityId}-${issue.category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${issues.length + 1}`,
    ...issue,
  });
}

function dataQualitySummary(issues: DataQualityIssue[], scanned: Record<string, number>) {
  return {
    totalIssues: issues.length,
    blockers: issues.filter((issue) => issue.severity === 'BLOCKER').length,
    warnings: issues.filter((issue) => issue.severity === 'WARNING').length,
    info: issues.filter((issue) => issue.severity === 'INFO').length,
    recordsScanned: scanned,
  };
}

async function buildAccountDataQualityReport(req: any) {
  const orgWhere = scopedOrganizationWhere(req);
  const now = new Date();

  const [patients, providers, credentialDocuments, reviewTasks, notifications] = await Promise.all([
    prisma.patientProfile.findMany({ where: orgWhere, include: { organization: { select: { name: true } }, user: true }, take: 5000 }),
    prisma.providerProfile.findMany({ where: orgWhere, include: { organization: { select: { name: true } }, user: true, roleCatalog: true, onboardingState: true, credentialDocuments: true }, take: 5000 }),
    prisma.providerCredentialDocument.findMany({ where: orgWhere, include: { organization: { select: { name: true } }, provider: { include: { user: true } } }, take: 5000 }),
    prisma.providerCredentialReviewTask.findMany({ where: orgWhere, include: { organization: { select: { name: true } }, provider: { include: { user: true } }, assignedTo: { select: { firstName: true, lastName: true, email: true } } }, take: 5000 }),
    prisma.providerCredentialNotification.findMany({ where: orgWhere, include: { organization: { select: { name: true } }, provider: { include: { user: true } }, task: { select: { title: true, status: true } } }, take: 5000 }),
  ]);

  const issues: DataQualityIssue[] = [];

  for (const patient of patients) {
    const status = accountStatusOf(patient.user);
    const common = {
      entityType: 'PATIENT' as DataQualityEntityType,
      entityId: patient.id,
      organizationId: patient.organizationId,
      organizationName: patient.organization?.name ?? null,
      accountName: patientDisplayName(patient),
      accountEmail: patient.user?.email ?? null,
    };

    if (status !== AccountStatus.ACTIVE && !clean(patient.user?.deactivationReason)) {
      addDataQualityIssue(issues, { ...common, severity: 'WARNING', category: 'Lifecycle metadata', title: 'Inactive patient account has no deactivation reason', detail: `${status} patient accounts should capture why access was disabled for audit review.`, recommendation: 'Edit the patient account and add a deactivation reason.' });
    }

    if (!patient.dateOfBirth) {
      addDataQualityIssue(issues, { ...common, severity: 'INFO', category: 'Patient profile completeness', title: 'Patient date of birth is missing', detail: 'Date of birth is useful for identity matching, booking verification, and medical context.', recommendation: 'Ask support or registration staff to complete the patient demographic profile.' });
    }

    if (!clean(patient.insuranceNumber)) {
      addDataQualityIssue(issues, { ...common, severity: 'INFO', category: 'Patient billing readiness', title: 'Patient insurance number is missing', detail: 'The account can remain active, but insurance-based billing or coverage checks may be incomplete.', recommendation: 'Capture insurance number where required by the organization workflow.' });
    }
  }

  for (const provider of providers) {
    const status = accountStatusOf(provider.user);
    const onboardingStatus = provider.onboardingState?.status ?? ProviderOnboardingStatus.DRAFT;
    const documents = Array.isArray(provider.credentialDocuments) ? provider.credentialDocuments : [];
    const summary = credentialSummary(documents);
    const common = {
      entityType: 'PROVIDER' as DataQualityEntityType,
      entityId: provider.id,
      organizationId: provider.organizationId,
      organizationName: provider.organization?.name ?? null,
      accountName: providerDisplayName(provider),
      accountEmail: provider.user?.email ?? null,
    };

    if (status !== AccountStatus.ACTIVE && !clean(provider.user?.deactivationReason)) {
      addDataQualityIssue(issues, { ...common, severity: 'WARNING', category: 'Lifecycle metadata', title: 'Inactive provider account has no deactivation reason', detail: `${status} provider accounts should capture why access was disabled for audit review.`, recommendation: 'Edit the provider account and add a deactivation reason.' });
    }

    if (status === AccountStatus.ACTIVE && onboardingStatus !== ProviderOnboardingStatus.APPROVED) {
      addDataQualityIssue(issues, { ...common, severity: 'WARNING', category: 'Credentialing lifecycle', title: 'Active provider is not fully approved', detail: `Current onboarding status is ${onboardingStatus}.`, recommendation: 'Complete credential review or suspend the account until review is complete.' });
    }

    if (status === AccountStatus.ACTIVE && summary.missingRequiredTypes.length > 0) {
      addDataQualityIssue(issues, { ...common, severity: 'BLOCKER', category: 'Required credentials', title: 'Active provider is missing verified required credentials', detail: `Missing verified credential types: ${summary.missingRequiredTypes.join(', ')}.`, recommendation: 'Upload and verify license, identity, and insurance documents before enabling clinical work.' });
    }

    if (!clean(provider.specialty)) {
      addDataQualityIssue(issues, { ...common, severity: 'INFO', category: 'Provider profile completeness', title: 'Provider specialty is missing', detail: 'Missing specialty reduces accuracy for service routing and provider search.', recommendation: 'Edit the provider profile and assign the appropriate clinical specialty.' });
    }

    if (!clean(provider.licenseNumber)) {
      addDataQualityIssue(issues, { ...common, severity: 'WARNING', category: 'Provider credentialing', title: 'Provider license number is missing', detail: 'License number is required for most credentialing and compliance workflows.', recommendation: 'Collect the provider license number and verify it against the uploaded license document.' });
    }

    if (!Array.isArray(provider.services) || provider.services.length === 0) {
      addDataQualityIssue(issues, { ...common, severity: 'INFO', category: 'Provider service routing', title: 'Provider has no service scope assigned', detail: 'Without service scope, booking and queue routing may not surface this provider correctly.', recommendation: 'Assign consultation, telehealth, lab, pharmacy, or other applicable service channels.' });
    }
  }

  for (const document of credentialDocuments) {
    const state = expiryState(document.expiresAt, document.status);
    if (state !== 'EXPIRED' && state !== 'EXPIRING_SOON') continue;
    addDataQualityIssue(issues, {
      entityType: 'CREDENTIAL_DOCUMENT',
      entityId: document.id,
      organizationId: document.organizationId,
      organizationName: document.organization?.name ?? null,
      accountName: providerDisplayName(document.provider),
      accountEmail: document.provider?.user?.email ?? null,
      severity: state === 'EXPIRED' ? 'BLOCKER' : 'WARNING',
      category: 'Credential expiry',
      title: state === 'EXPIRED' ? 'Credential document is expired' : 'Credential document expires soon',
      detail: `${document.type} ${document.title ? `(${document.title}) ` : ''}${state === 'EXPIRED' ? 'expired' : 'expires'} on ${dateOnly(document.expiresAt)}.`,
      recommendation: state === 'EXPIRED' ? 'Block provider approval or clinical access until a renewed credential is verified.' : 'Queue a renewal reminder and assign a credential review task.',
    });
  }

  for (const task of reviewTasks) {
    const isActive = activeCredentialReviewTaskStatuses.includes(task.status as CredentialReviewTaskStatus);
    if (!isActive || !isOverdue(task.dueAt)) continue;
    addDataQualityIssue(issues, {
      entityType: 'REVIEW_TASK',
      entityId: task.id,
      organizationId: task.organizationId,
      organizationName: task.organization?.name ?? null,
      accountName: providerDisplayName(task.provider),
      accountEmail: task.provider?.user?.email ?? null,
      severity: task.priority === 'URGENT' || task.priority === 'HIGH' ? 'BLOCKER' : 'WARNING',
      category: 'Review task SLA',
      title: 'Credential review task is overdue',
      detail: `${task.title} was due on ${dateOnly(task.dueAt)} and is still ${task.status}.`,
      recommendation: 'Assign or escalate the task, then complete or block it with a decision note.',
    });
  }

  for (const notification of notifications) {
    if (notification.status === 'FAILED') {
      addDataQualityIssue(issues, { entityType: 'NOTIFICATION', entityId: notification.id, organizationId: notification.organizationId, organizationName: notification.organization?.name ?? null, accountName: providerDisplayName(notification.provider), accountEmail: notification.provider?.user?.email ?? null, severity: 'WARNING', category: 'Reminder dispatch', title: 'Credential reminder dispatch failed', detail: notification.failureReason || notification.subject || 'The queued reminder failed to dispatch.', recommendation: 'Correct the delivery configuration or recipient address, then use Retry failed dispatch.' });
    }

    const scheduledFor = notification.scheduledFor ? new Date(notification.scheduledFor) : null;
    if (notification.status === 'QUEUED' && scheduledFor && scheduledFor < now) {
      addDataQualityIssue(issues, { entityType: 'NOTIFICATION', entityId: notification.id, organizationId: notification.organizationId, organizationName: notification.organization?.name ?? null, accountName: providerDisplayName(notification.provider), accountEmail: notification.provider?.user?.email ?? null, severity: 'INFO', category: 'Reminder queue', title: 'Credential reminder is due for dispatch', detail: `${notification.subject} was scheduled for ${dateOnly(notification.scheduledFor)} and remains queued.`, recommendation: 'Run the credential notification dispatcher or dispatch due reminders from the Admin page.' });
    }
  }

  issues.sort((a, b) => {
    const order: Record<DataQualitySeverity, number> = { BLOCKER: 0, WARNING: 1, INFO: 2 };
    return order[a.severity] - order[b.severity] || a.category.localeCompare(b.category) || (a.accountName ?? '').localeCompare(b.accountName ?? '');
  });

  return {
    generatedAt: new Date().toISOString(),
    scope: req.user?.organizationId ? 'ORGANIZATION' : 'GLOBAL',
    organizationId: req.user?.organizationId ?? undefined,
    summary: dataQualitySummary(issues, { patients: patients.length, providers: providers.length, credentialDocuments: credentialDocuments.length, reviewTasks: reviewTasks.length, notifications: notifications.length }),
    issues,
  };
}

function buildDataQualityCsvRows(report: Awaited<ReturnType<typeof buildAccountDataQualityReport>>) {
  const headers = ['severity', 'category', 'entityType', 'entityId', 'organizationName', 'accountName', 'accountEmail', 'title', 'detail', 'recommendation'];
  const rows = report.issues.map((issue) => ({ severity: issue.severity, category: issue.category, entityType: issue.entityType, entityId: issue.entityId, organizationName: issue.organizationName ?? '', accountName: issue.accountName ?? '', accountEmail: issue.accountEmail ?? '', title: issue.title, detail: issue.detail, recommendation: issue.recommendation }));
  return { headers, rows, filename: 'carepoint-account-data-quality-issues.csv' };
}


function csvEscape(value: unknown) {
  const normalized = Array.isArray(value) ? value.join('|') : value instanceof Date ? value.toISOString() : String(value ?? '');
  const escaped = normalized.replace(/"/g, '""');
  return /[",\n\r]/.test(escaped) ? '"' + escaped + '"' : escaped;
}

function toCsv(headers: string[], rows: Record<string, unknown>[]) {
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map((header) => csvEscape(row[header])).join(','));
  return lines.join('\n');
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === ',' && !quoted) {
      cells.push(cell.trim());
      cell = '';
      continue;
    }
    cell += char;
  }

  cells.push(cell.trim());
  return cells;
}

function parseCsvText(csv: unknown) {
  const raw = String(csv ?? '').replace(/^\uFEFF/, '').trim();
  if (!raw) return [];

  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
  });
}

function importRows(body: any) {
  if (Array.isArray(body?.rows)) return body.rows as Record<string, unknown>[];
  return parseCsvText(body?.csv);
}

function cell(row: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    const exact = row[name];
    if (exact !== undefined) return clean(exact);
    const looseKey = Object.keys(row).find((key) => key.trim().toLowerCase() === name.toLowerCase());
    if (looseKey) return clean(row[looseKey]);
  }
  return '';
}

async function organizationFromImportRow(req: any, row: Record<string, unknown>) {
  if (req.user?.organizationId) return req.user.organizationId;

  const organizationId = cell(row, ['organizationId', 'organization_id', 'orgId']);
  if (organizationId) {
    const exists = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
    if (!exists) throw badRequest('Organization not found for organizationId ' + organizationId);
    return organizationId;
  }

  const organizationName = cell(row, ['organizationName', 'organization', 'org']);
  if (organizationName) {
    const organization = await prisma.organization.findFirst({ where: { name: { equals: organizationName, mode: 'insensitive' } }, select: { id: true } });
    if (!organization) throw badRequest('Organization not found for organizationName ' + organizationName);
    return organization.id;
  }

  const fallback = await ensureFallbackOrganization();
  return fallback.id;
}

function importPerson(row: Record<string, unknown>) {
  const fullName = cell(row, ['name', 'fullName', 'full_name']);
  const parts = fullName.split(/\s+/).filter(Boolean);
  const firstName = cell(row, ['firstName', 'first_name', 'givenName']) || parts.shift() || '';
  const lastName = cell(row, ['lastName', 'last_name', 'familyName']) || parts.join(' ') || 'User';
  const email = normalizeEmail(cell(row, ['email', 'emailAddress', 'email_address']));
  return { firstName, lastName, email };
}

async function validateImportRows(req: any, type: 'PATIENT' | 'PROVIDER', rows: Record<string, unknown>[]) {
  const emailsInFile = new Set<string>();
  const normalized: any[] = [];
  const errors: Array<{ row: number; email?: string; messages: string[] }> = [];

  for (const [index, row] of rows.entries()) {
    const messages: string[] = [];
    const { firstName, lastName, email } = importPerson(row);
    if (!firstName) messages.push('firstName is required');
    if (!lastName) messages.push('lastName is required');
    if (!email) messages.push('email is required');
    if (email && emailsInFile.has(email)) messages.push('duplicate email inside import file');
    if (email) emailsInFile.add(email);

    let organizationId = '';
    try {
      organizationId = await organizationFromImportRow(req, row);
    } catch (error) {
      messages.push(error instanceof Error ? error.message : 'Invalid organization');
    }

    if (email) {
      const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (existing) messages.push('email already exists');
    }

    const status = normalizeAccountStatus(cell(row, ['status']), AccountStatus.ACTIVE);
    const deactivationReason = cell(row, ['deactivationReason', 'deactivation_reason', 'inactiveReason']);
    const password = cell(row, ['password', 'temporaryPassword', 'temporary_password']) || 'ChangeMe123!';

    if (messages.length > 0) {
      errors.push({ row: index + 2, email, messages });
      continue;
    }

    normalized.push({
      sourceRow: index + 2,
      organizationId,
      firstName,
      lastName,
      email,
      password,
      status,
      deactivationReason,
      dateOfBirth: type === 'PATIENT' ? cell(row, ['dateOfBirth', 'date_of_birth', 'dob']) : undefined,
      insuranceNumber: type === 'PATIENT' ? cell(row, ['insuranceNumber', 'insurance_number', 'insurance']) : undefined,
      role: type === 'PROVIDER' ? validateProviderRole(cell(row, ['role'])) : UserRole.PATIENT,
      specialty: type === 'PROVIDER' ? cell(row, ['specialty']) : undefined,
      licenseNumber: type === 'PROVIDER' ? cell(row, ['licenseNumber', 'license_number', 'license']) : undefined,
      services: type === 'PROVIDER' ? cell(row, ['services', 'serviceList', 'service_list']) : undefined,
    });
  }

  return { normalized, errors };
}



adminUsersRouter.get('/governance-summary', async (req, res) => {
  res.json(await buildGovernanceSummary(req));
});

adminUsersRouter.get('/governance-report/export', async (req, res) => {
  const requestedType = clean(req.query.type).toUpperCase() || 'SUMMARY';
  const reportType = ['SUMMARY', 'CREDENTIALS', 'TASKS', 'NOTIFICATIONS'].includes(requestedType) ? requestedType : 'SUMMARY';
  const report = await buildGovernanceReportRows(req, reportType);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
  res.send(toCsv(report.headers, report.rows));
});

adminUsersRouter.get('/data-quality', async (req, res) => {
  res.json(await buildAccountDataQualityReport(req));
});

adminUsersRouter.get('/data-quality/export', async (req, res) => {
  const report = await buildAccountDataQualityReport(req);
  const csv = buildDataQualityCsvRows(report);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${csv.filename}"`);
  res.send(toCsv(csv.headers, csv.rows));
});

adminUsersRouter.post('/credential-governance/sweep', async (req, res) => {
  const organizationId = req.user?.organizationId ?? (clean(req.body?.organizationId) || null);
  const providerId = clean(req.body?.providerId) || null;
  if (req.user?.organizationId && clean(req.body?.organizationId) && clean(req.body.organizationId) !== req.user.organizationId) {
    throw forbidden('You cannot run credential governance sweep outside your organization');
  }

  const result = await runProviderCredentialGovernanceSweep({
    actor: { userId: req.user?.userId ?? null, organizationId: req.user?.organizationId ?? undefined },
    organizationId,
    providerId,
    dryRun: Boolean(req.body?.dryRun),
    markExpired: req.body?.markExpired !== false,
    createReviewTasks: req.body?.createReviewTasks !== false,
    queueReminders: req.body?.queueReminders !== false,
    expiringSoonDays: Number(req.body?.expiringSoonDays ?? 30),
    dueInDays: Number(req.body?.dueInDays ?? 7),
    limit: Number(req.body?.limit ?? 250),
  });

  res.json({ item: result });
});

adminUsersRouter.get('/credential-review-tasks', async (req, res) => {
  const status = clean(req.query.status);
  const priority = clean(req.query.priority);
  const providerId = clean(req.query.providerId);
  const q = clean(req.query.q).toLowerCase();
  const limit = Math.min(Math.max(Number(req.query.limit ?? 50) || 50, 1), 200);
  const where: any = {
    ...(req.user?.organizationId ? { organizationId: req.user.organizationId } : {}),
    ...(status ? { status: normalizeCredentialReviewTaskStatus(status) } : {}),
    ...(priority ? { priority: normalizeCredentialReviewPriority(priority) } : {}),
    ...(providerId ? { providerId } : {}),
  };
  const tasks = await prisma.providerCredentialReviewTask.findMany({
    where,
    include: { ...providerReviewTaskInclude(), provider: { include: { user: true } }, organization: { select: { name: true } } },
    orderBy: [{ status: 'asc' }, { priority: 'desc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
    take: limit,
  });
  const items = tasks.map(mapProviderCredentialReviewTask).filter((item) => {
    if (!q) return true;
    return [item.title, item.providerName, item.providerEmail, item.assignedToName, item.assignedToEmail, item.documentTitle, item.documentType, item.priority, item.status].filter(Boolean).join(' ').toLowerCase().includes(q);
  });
  res.json({ items, count: items.length });
});

adminUsersRouter.post('/providers/:providerId/credential-review-tasks', async (req, res) => {
  const current = await findProvider(req.params.providerId);
  if (!current) throw notFound('Provider not found');
  assertSameOrg(req, current.organizationId);
  const documentId = clean(req.body?.documentId) || null;
  if (documentId) {
    const document = await prisma.providerCredentialDocument.findFirst({ where: { id: documentId, providerId: current.id } });
    if (!document) throw badRequest('Selected credential document does not belong to this provider');
  }
  const assignedToId = await resolveReviewerId(req, req.body?.assignedToId || req.body?.assignedToEmail);
  const dueAt = safeOptionalDate(req.body?.dueAt, 'dueAt');
  const task = await prisma.providerCredentialReviewTask.create({
    data: {
      organizationId: current.organizationId,
      providerId: current.id,
      documentId,
      title: clean(req.body?.title) || 'Provider credentialing review',
      status: normalizeCredentialReviewTaskStatus(req.body?.status, 'OPEN'),
      priority: normalizeCredentialReviewPriority(req.body?.priority, 'NORMAL'),
      dueAt,
      assignedToId,
      createdById: req.user?.userId ?? null,
      blockReason: clean(req.body?.blockReason) || null,
      decisionNote: clean(req.body?.decisionNote) || null,
      metadata: req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : undefined,
    },
    include: { ...providerReviewTaskInclude(), provider: { include: { user: true } }, organization: { select: { name: true } } },
  });
  await writeAuditLog({ actorId: req.user?.userId, organizationId: current.organizationId, action: 'admin.provider.credential_review_task.created', resource: 'provider_credential_review_task', resourceId: task.id, details: { providerId: current.id, documentId, status: task.status, priority: task.priority, assignedToId } });
  res.status(201).json({ item: mapProviderCredentialReviewTask(task) });
});

adminUsersRouter.patch('/credential-review-tasks/:taskId', async (req, res) => {
  const current = await prisma.providerCredentialReviewTask.findUnique({ where: { id: req.params.taskId } });
  if (!current) throw notFound('Credential review task not found');
  assertSameOrg(req, current.organizationId);
  const status = req.body?.status !== undefined ? normalizeCredentialReviewTaskStatus(req.body.status, current.status) : current.status;
  const assignedToId = req.body?.assignedToId !== undefined || req.body?.assignedToEmail !== undefined ? await resolveReviewerId(req, req.body?.assignedToId || req.body?.assignedToEmail) : current.assignedToId;
  const dueAt = req.body?.dueAt !== undefined ? safeOptionalDate(req.body.dueAt, 'dueAt') : current.dueAt;
  const task = await prisma.providerCredentialReviewTask.update({
    where: { id: current.id },
    data: {
      title: req.body?.title !== undefined ? clean(req.body.title) || current.title : current.title,
      status,
      priority: req.body?.priority !== undefined ? normalizeCredentialReviewPriority(req.body.priority, current.priority) : current.priority,
      dueAt,
      assignedToId,
      completedAt: status === 'COMPLETED' ? current.completedAt ?? new Date() : status === 'OPEN' || status === 'IN_REVIEW' ? null : current.completedAt,
      cancelledAt: status === 'CANCELLED' ? current.cancelledAt ?? new Date() : status === 'OPEN' || status === 'IN_REVIEW' ? null : current.cancelledAt,
      blockReason: req.body?.blockReason !== undefined ? clean(req.body.blockReason) || null : current.blockReason,
      decisionNote: req.body?.decisionNote !== undefined ? clean(req.body.decisionNote) || null : current.decisionNote,
    },
    include: { ...providerReviewTaskInclude(), provider: { include: { user: true } }, organization: { select: { name: true } } },
  });
  await writeAuditLog({ actorId: req.user?.userId, organizationId: current.organizationId, action: status === 'COMPLETED' ? 'admin.provider.credential_review_task.completed' : status === 'CANCELLED' ? 'admin.provider.credential_review_task.cancelled' : 'admin.provider.credential_review_task.updated', resource: 'provider_credential_review_task', resourceId: task.id, details: { providerId: task.providerId, documentId: task.documentId, fromStatus: current.status, toStatus: status, priority: task.priority, assignedToId } });
  res.json({ item: mapProviderCredentialReviewTask(task) });
});


adminUsersRouter.get('/credential-notifications', async (req, res) => {
  const status = clean(req.query.status);
  const providerId = clean(req.query.providerId);
  const documentId = clean(req.query.documentId);
  const taskId = clean(req.query.taskId);
  const q = clean(req.query.q).toLowerCase();
  const limit = Math.min(Math.max(Number(req.query.limit ?? 50) || 50, 1), 200);
  const where: any = {
    ...(req.user?.organizationId ? { organizationId: req.user.organizationId } : {}),
    ...(status ? { status: normalizeCredentialNotificationStatus(status) } : {}),
    ...(providerId ? { providerId } : {}),
    ...(documentId ? { documentId } : {}),
    ...(taskId ? { taskId } : {}),
  };
  const notifications = await prisma.providerCredentialNotification.findMany({
    where,
    include: providerNotificationInclude(),
    orderBy: [{ status: 'asc' }, { scheduledFor: 'asc' }, { createdAt: 'desc' }],
    take: limit,
  });
  const items = notifications.map(mapProviderCredentialNotification).filter((item) => {
    if (!q) return true;
    return [item.subject, item.message, item.recipientEmail, item.providerName, item.providerEmail, item.documentTitle, item.documentType, item.taskTitle, item.status, item.channel].filter(Boolean).join(' ').toLowerCase().includes(q);
  });
  res.json({ items, count: items.length });
});

adminUsersRouter.get('/credential-notifications/dispatch-config', async (_req, res) => {
  res.json({ item: getProviderCredentialNotificationDispatchConfig() });
});

adminUsersRouter.post('/credential-notifications/dispatch', async (req, res) => {
  const result = await dispatchProviderCredentialNotifications({
    actorId: req.user?.userId,
    organizationId: req.user?.organizationId ?? undefined,
    limit: Math.min(Math.max(Number(req.body?.limit ?? 25) || 25, 1), 100),
    includeManual: req.body?.includeManual === true || clean(req.body?.includeManual).toLowerCase() === 'true',
    force: req.body?.force === true || clean(req.body?.force).toLowerCase() === 'true',
  });
  res.json(result);
});

adminUsersRouter.post('/credential-notifications/:notificationId/dispatch', async (req, res) => {
  const current = await prisma.providerCredentialNotification.findUnique({ where: { id: req.params.notificationId } });
  if (!current) throw notFound('Credential notification not found');
  assertSameOrg(req, current.organizationId);
  const result = await dispatchProviderCredentialNotifications({
    actorId: req.user?.userId,
    organizationId: current.organizationId,
    notificationId: current.id,
    includeManual: req.body?.includeManual === true || clean(req.body?.includeManual).toLowerCase() === 'true',
    force: req.body?.force === true || clean(req.body?.force).toLowerCase() === 'true',
  });
  res.json(result);
});

adminUsersRouter.post('/credential-review-tasks/:taskId/reminders', async (req, res) => {
  const task = await prisma.providerCredentialReviewTask.findUnique({
    where: { id: req.params.taskId },
    include: { ...providerReviewTaskInclude(), provider: { include: { user: true } }, document: true, organization: { select: { name: true } } },
  });
  if (!task) throw notFound('Credential review task not found');
  assertSameOrg(req, task.organizationId);

  const providerName = task.provider?.user ? `${task.provider.user.firstName} ${task.provider.user.lastName}`.trim() : 'provider';
  const defaultSubject = `Credential review reminder: ${task.title}`;
  const defaultMessage = `Reminder for ${providerName}: credential review task "${task.title}" is ${task.status}${task.dueAt ? ` and due on ${task.dueAt.toISOString().slice(0, 10)}` : ''}.`;
  const payload = notificationPayloadFromBody(req.body, { subject: defaultSubject, message: defaultMessage, recipientEmail: task.assignedTo?.email ?? task.provider?.user?.email ?? null });
  const notification = await prisma.providerCredentialNotification.create({
    data: {
      organizationId: task.organizationId,
      providerId: task.providerId,
      documentId: task.documentId ?? null,
      taskId: task.id,
      createdById: req.user?.userId ?? null,
      metadata: { source: 'admin_credential_review_task_reminder', taskStatus: task.status, taskPriority: task.priority },
      ...payload,
    },
    include: providerNotificationInclude(),
  });
  await writeAuditLog({ actorId: req.user?.userId, organizationId: task.organizationId, action: 'admin.provider.credential_notification.queued', resource: 'provider_credential_notification', resourceId: notification.id, details: { providerId: task.providerId, taskId: task.id, documentId: task.documentId, channel: notification.channel, status: notification.status, recipientEmail: notification.recipientEmail } });
  res.status(201).json({ item: mapProviderCredentialNotification(notification) });
});

adminUsersRouter.post('/providers/:providerId/credential-reminders', async (req, res) => {
  const current = await findProvider(req.params.providerId);
  if (!current) throw notFound('Provider not found');
  assertSameOrg(req, current.organizationId);
  const documentId = clean(req.body?.documentId) || null;
  const document = documentId ? await prisma.providerCredentialDocument.findFirst({ where: { id: documentId, providerId: current.id } }) : null;
  if (documentId && !document) throw badRequest('Selected credential document does not belong to this provider');

  const providerName = current.user ? `${current.user.firstName} ${current.user.lastName}`.trim() : 'provider';
  const documentLabel = document?.title || document?.type || 'credential profile';
  const defaultSubject = `Credential renewal reminder: ${documentLabel}`;
  const defaultMessage = document
    ? `Reminder for ${providerName}: ${documentLabel} status is ${document.status}${document.expiresAt ? ` and expires on ${document.expiresAt.toISOString().slice(0, 10)}` : ''}. Please update or verify the credential.`
    : `Reminder for ${providerName}: provider credentialing requires follow-up. Please review the credential checklist and pending tasks.`;
  const payload = notificationPayloadFromBody(req.body, { subject: defaultSubject, message: defaultMessage, recipientEmail: current.user?.email ?? null });
  const notification = await prisma.providerCredentialNotification.create({
    data: {
      organizationId: current.organizationId,
      providerId: current.id,
      documentId,
      createdById: req.user?.userId ?? null,
      metadata: { source: 'admin_provider_credential_reminder', documentStatus: document?.status ?? null, documentExpiryState: document ? expiryState(document.expiresAt, document.status) : null },
      ...payload,
    },
    include: providerNotificationInclude(),
  });
  await writeAuditLog({ actorId: req.user?.userId, organizationId: current.organizationId, action: 'admin.provider.credential_notification.queued', resource: 'provider_credential_notification', resourceId: notification.id, details: { providerId: current.id, documentId, channel: notification.channel, status: notification.status, recipientEmail: notification.recipientEmail } });
  res.status(201).json({ item: mapProviderCredentialNotification(notification) });
});

adminUsersRouter.patch('/credential-notifications/:notificationId/status', async (req, res) => {
  const current = await prisma.providerCredentialNotification.findUnique({ where: { id: req.params.notificationId } });
  if (!current) throw notFound('Credential notification not found');
  assertSameOrg(req, current.organizationId);
  const status = normalizeCredentialNotificationStatus(req.body?.status, current.status);
  const notification = await prisma.providerCredentialNotification.update({
    where: { id: current.id },
    data: {
      status,
      sentAt: status === 'SENT' ? current.sentAt ?? new Date() : status === 'QUEUED' ? null : current.sentAt,
      failureReason: status === 'FAILED' ? clean(req.body?.failureReason) || current.failureReason || 'Marked failed by admin' : status === 'QUEUED' || status === 'SENT' ? null : current.failureReason,
      scheduledFor: req.body?.scheduledFor !== undefined ? safeOptionalDate(req.body.scheduledFor, 'scheduledFor') : current.scheduledFor,
    },
    include: providerNotificationInclude(),
  });
  await writeAuditLog({ actorId: req.user?.userId, organizationId: current.organizationId, action: 'admin.provider.credential_notification.status_changed', resource: 'provider_credential_notification', resourceId: notification.id, details: { providerId: current.providerId, documentId: current.documentId, taskId: current.taskId, fromStatus: current.status, toStatus: status } });
  res.json({ item: mapProviderCredentialNotification(notification) });
});

const accountAuditResources = [
  'organization',
  'patient_profile',
  'provider_profile',
  'provider_credential_document',
  'provider_credential_review_task',
  'provider_credential_notification',
];

function auditDateBoundary(value: unknown, fieldName: string, endOfDay = false) {
  const raw = clean(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw badRequest(`${fieldName} must be a valid date`);
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    parsed.setDate(parsed.getDate() + 1);
    return { date: parsed, exclusive: true };
  }
  return { date: parsed, exclusive: false };
}

async function buildAccountAuditFilter(req: any) {
  const requestedType = clean(req.query.type || req.query.accountType).toUpperCase();
  const accountId = clean(req.query.id || req.query.accountId);
  const requestedResource = clean(req.query.resource);
  const requestedResourceId = clean(req.query.resourceId);
  const requestedAction = clean(req.query.action);
  const requestedActor = clean(req.query.actor || req.query.actorEmail);
  const requestedFrom = clean(req.query.from || req.query.createdFrom);
  const requestedTo = clean(req.query.to || req.query.createdTo);
  const includeRelated = clean(req.query.includeRelated).toLowerCase() !== 'false';
  const limitRaw = Number.parseInt(clean(req.query.limit) || '50', 10);
  const take = Math.max(1, Math.min(Number.isFinite(limitRaw) ? limitRaw : 50, 500));

  if (requestedResource && !accountAuditResources.includes(requestedResource)) throw badRequest('Unsupported audit resource filter');
  if (requestedType && !['PATIENT', 'PROVIDER'].includes(requestedType)) throw badRequest('Unsupported audit account type filter');

  const where: any = {
    action: requestedAction ? { contains: requestedAction } : { startsWith: 'admin.' },
    resource: requestedResource || { in: accountAuditResources },
  };
  if (req.user?.organizationId) where.organizationId = req.user.organizationId;

  const fromBoundary = auditDateBoundary(requestedFrom, 'from');
  const toBoundary = auditDateBoundary(requestedTo, 'to', true);
  if (fromBoundary || toBoundary) {
    where.createdAt = {};
    if (fromBoundary) where.createdAt.gte = fromBoundary.date;
    if (toBoundary) where.createdAt[toBoundary.exclusive ? 'lt' : 'lte'] = toBoundary.date;
  }

  if (requestedActor) {
    where.actor = {
      is: {
        OR: [
          { email: { contains: requestedActor, mode: 'insensitive' } },
          { firstName: { contains: requestedActor, mode: 'insensitive' } },
          { lastName: { contains: requestedActor, mode: 'insensitive' } },
        ],
      },
    };
  }

  if (requestedResourceId) {
    where.resourceId = requestedResourceId;
  } else if (accountId && requestedType === 'PATIENT') {
    where.resource = 'patient_profile';
    where.resourceId = accountId;
  } else if (accountId && requestedType === 'PROVIDER') {
    if (!includeRelated) {
      where.resource = 'provider_profile';
      where.resourceId = accountId;
    } else {
      const [documents, tasks, notifications] = await Promise.all([
        prisma.providerCredentialDocument.findMany({ where: { providerId: accountId }, select: { id: true } }),
        prisma.providerCredentialReviewTask.findMany({ where: { providerId: accountId }, select: { id: true } }),
        prisma.providerCredentialNotification.findMany({ where: { providerId: accountId }, select: { id: true } }),
      ]);
      const orFilters: any[] = [{ resource: 'provider_profile', resourceId: accountId }];
      const documentIds = documents.map((item) => item.id);
      const taskIds = tasks.map((item) => item.id);
      const notificationIds = notifications.map((item) => item.id);
      if (documentIds.length > 0) orFilters.push({ resource: 'provider_credential_document', resourceId: { in: documentIds } });
      if (taskIds.length > 0) orFilters.push({ resource: 'provider_credential_review_task', resourceId: { in: taskIds } });
      if (notificationIds.length > 0) orFilters.push({ resource: 'provider_credential_notification', resourceId: { in: notificationIds } });
      where.OR = orFilters;
      where.resource = { in: accountAuditResources };
    }
  } else if (requestedType === 'PATIENT') {
    where.resource = 'patient_profile';
  } else if (requestedType === 'PROVIDER') {
    where.resource = includeRelated ? { in: ['provider_profile', 'provider_credential_document', 'provider_credential_review_task', 'provider_credential_notification'] } : 'provider_profile';
  }

  return {
    where,
    take,
    scope: {
      type: requestedType || null,
      accountId: accountId || null,
      resource: requestedResource || null,
      resourceId: requestedResourceId || null,
      action: requestedAction || null,
      actor: requestedActor || null,
      from: requestedFrom || null,
      to: requestedTo || null,
      includeRelated,
      limit: take,
    },
  };
}

function mapAuditLogForAccountGovernance(item: any) {
  return {
    id: item.id,
    action: item.action,
    resource: item.resource,
    resourceId: item.resourceId,
    organizationId: item.organizationId,
    organizationName: item.organization?.name ?? null,
    actorId: item.actorId,
    actorName: item.actor ? `${item.actor.firstName} ${item.actor.lastName}`.trim() : null,
    actorEmail: item.actor?.email ?? null,
    actorRole: item.actor?.role ?? null,
    details: item.details ?? null,
    createdAt: item.createdAt,
  };
}

adminUsersRouter.get('/audit/export', async (req, res) => {
  const { where, take, scope } = await buildAccountAuditFilter(req);
  const items = await prisma.auditLog.findMany({
    where,
    include: { actor: { select: { id: true, firstName: true, lastName: true, email: true, role: true } }, organization: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take,
  });

  const rows = items.map((item) => ({
    id: item.id,
    createdAt: item.createdAt.toISOString(),
    organization: item.organization?.name ?? '',
    actorName: item.actor ? `${item.actor.firstName} ${item.actor.lastName}`.trim() : '',
    actorEmail: item.actor?.email ?? '',
    actorRole: item.actor?.role ?? '',
    action: item.action,
    resource: item.resource,
    resourceId: item.resourceId ?? '',
    details: item.details ? JSON.stringify(item.details) : '',
  }));

  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId: req.user?.organizationId,
    action: 'admin.audit.filtered_exported',
    resource: 'account_audit_export',
    details: { scope, count: items.length },
  });

  const csv = toCsv(['id', 'createdAt', 'organization', 'actorName', 'actorEmail', 'actorRole', 'action', 'resource', 'resourceId', 'details'], rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="carepoint-account-audit-${Date.now()}.csv"`);
  res.send(csv);
});

adminUsersRouter.get('/audit', async (req, res) => {
  const { where, take, scope } = await buildAccountAuditFilter(req);
  const items = await prisma.auditLog.findMany({
    where,
    include: { actor: { select: { id: true, firstName: true, lastName: true, email: true, role: true } }, organization: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take,
  });

  res.json({
    items: items.map(mapAuditLogForAccountGovernance),
    count: items.length,
    scope,
  });
});

adminUsersRouter.post('/bulk-status', async (req, res) => {
  const type = normalizeAccountType(req.body?.type);
  const ids = parseIds(req.body?.ids);
  if (ids.length === 0) throw badRequest('At least one account id is required');
  if (ids.length > 100) throw badRequest('Bulk lifecycle updates are limited to 100 accounts per request');

  const status = normalizeAccountStatus(req.body?.status);
  if (!clean(req.body?.status)) throw badRequest('status is required');
  const deactivationReason = clean(req.body?.deactivationReason) || null;
  const statusData = {
    status,
    deactivatedAt: status !== AccountStatus.ACTIVE ? new Date() : null,
    deactivationReason: status !== AccountStatus.ACTIVE ? deactivationReason : null,
  };

  const profileDelegate = type === 'PATIENT' ? prisma.patientProfile : prisma.providerProfile;
  const profiles = await (profileDelegate as any).findMany({
    where: { id: { in: ids }, ...(req.user?.organizationId ? { organizationId: req.user.organizationId } : {}) },
    include: { user: true, organization: { select: { name: true } } },
  });
  if (profiles.length === 0) throw notFound('No matching accounts were found for the requested scope');

  const userIds = profiles.map((profile: any) => profile.userId);
  await prisma.$transaction(async (tx) => {
    await tx.user.updateMany({ where: { id: { in: userIds } }, data: statusData });
    if (status !== AccountStatus.ACTIVE) {
      await tx.refreshToken.updateMany({ where: { userId: { in: userIds }, revokedAt: null }, data: { revokedAt: new Date() } });
    }
  });

  await Promise.all(profiles.map((profile: any) => writeAuditLog({
    actorId: req.user?.userId,
    organizationId: profile.organizationId,
    action: statusAuditAction(type === 'PATIENT' ? 'admin.patient' : 'admin.provider', profile.user.status ?? AccountStatus.ACTIVE, status),
    resource: profileResource(type),
    resourceId: profile.id,
    details: { bulk: true, from: profile.user.status ?? AccountStatus.ACTIVE, to: status, reason: statusData.deactivationReason },
  })));

  const updated = await (profileDelegate as any).findMany({
    where: { id: { in: profiles.map((profile: any) => profile.id) } },
    include: { organization: { select: { name: true } }, user: true },
    orderBy: { user: { updatedAt: 'desc' } },
  });

  const items = await Promise.all(updated.map((profile: any) => type === 'PATIENT' ? mapPatient(profile) : mapProvider(profile)));
  res.json({ items, count: items.length, requested: ids.length, skipped: ids.length - profiles.length });
});


adminUsersRouter.get('/export', async (req, res) => {
  const type = normalizeAccountType(req.query.type);
  const q = clean(req.query.q).toLowerCase();
  const status = clean(req.query.status).toUpperCase();
  const where: any = req.user?.organizationId ? { organizationId: req.user.organizationId } : {};
  if (accountStatuses.includes(status as AccountStatus)) where.user = { is: { status: status as AccountStatus } };

  if (type === 'PATIENT') {
    const profiles = await prisma.patientProfile.findMany({ where, include: { organization: { select: { name: true } }, user: true }, orderBy: { user: { createdAt: 'desc' } }, take: 2000 });
    const rows = profiles
      .filter((profile) => !q || [profile.user.firstName, profile.user.lastName, profile.user.email, profile.insuranceNumber, profile.organization?.name, profile.user.status].join(' ').toLowerCase().includes(q))
      .map((profile) => ({
        id: profile.id,
        userId: profile.userId,
        organizationId: profile.organizationId,
        organizationName: profile.organization?.name ?? '',
        firstName: profile.user.firstName,
        lastName: profile.user.lastName,
        email: profile.user.email,
        status: profile.user.status ?? AccountStatus.ACTIVE,
        deactivatedAt: profile.user.deactivatedAt ?? '',
        deactivationReason: profile.user.deactivationReason ?? '',
        dateOfBirth: profile.dateOfBirth ?? '',
        insuranceNumber: profile.insuranceNumber ?? '',
        createdAt: profile.user.createdAt,
        updatedAt: profile.user.updatedAt,
      }));
    const headers = ['id', 'userId', 'organizationId', 'organizationName', 'firstName', 'lastName', 'email', 'status', 'deactivatedAt', 'deactivationReason', 'dateOfBirth', 'insuranceNumber', 'createdAt', 'updatedAt'];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="carepoint-patient-accounts.csv"');
    res.send(toCsv(headers, rows));
    return;
  }

  const profiles = await prisma.providerProfile.findMany({ where, include: { organization: { select: { name: true } }, user: true, roleCatalog: true, onboardingState: true, credentialDocuments: { include: { verifiedBy: true }, orderBy: { createdAt: 'desc' } }, credentialReviewTasks: { where: { status: { in: activeCredentialReviewTaskStatuses } }, include: providerReviewTaskInclude(), orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }, { createdAt: 'desc' }], take: 6 } }, orderBy: { user: { createdAt: 'desc' } }, take: 2000 });
  const rows = profiles
    .filter((profile) => !q || [profile.user.firstName, profile.user.lastName, profile.user.email, profile.specialty, profile.licenseNumber, Array.isArray(profile.services) ? profile.services.join(' ') : '', profile.organization?.name, profile.user.status].join(' ').toLowerCase().includes(q))
    .map((profile) => ({
      id: profile.id,
      userId: profile.userId,
      organizationId: profile.organizationId,
      organizationName: profile.organization?.name ?? '',
      firstName: profile.user.firstName,
      lastName: profile.user.lastName,
      email: profile.user.email,
      role: profile.user.role,
      status: profile.user.status ?? AccountStatus.ACTIVE,
      deactivatedAt: profile.user.deactivatedAt ?? '',
      deactivationReason: profile.user.deactivationReason ?? '',
      specialty: profile.specialty ?? '',
      licenseNumber: profile.licenseNumber ?? '',
      services: Array.isArray(profile.services) ? profile.services.join('|') : '',
      onboardingStatus: profile.onboardingState?.status ?? ProviderOnboardingStatus.DRAFT,
      onboardingDecisionNote: profile.onboardingState?.decisionNote ?? '',
      onboardingSubmittedAt: profile.onboardingState?.submittedAt ?? '',
      onboardingReviewedAt: profile.onboardingState?.reviewedAt ?? '',
      credentialTotal: credentialSummary(profile.credentialDocuments ?? []).total,
      credentialVerified: credentialSummary(profile.credentialDocuments ?? []).verified,
      credentialExpired: credentialSummary(profile.credentialDocuments ?? []).expired,
      credentialExpiringSoon: credentialSummary(profile.credentialDocuments ?? []).expiringSoon,
      missingCredentialTypes: credentialSummary(profile.credentialDocuments ?? []).missingRequiredTypes.join('|'),
      createdAt: profile.user.createdAt,
      updatedAt: profile.user.updatedAt,
    }));
  const headers = ['id', 'userId', 'organizationId', 'organizationName', 'firstName', 'lastName', 'email', 'role', 'status', 'deactivatedAt', 'deactivationReason', 'specialty', 'licenseNumber', 'services', 'onboardingStatus', 'onboardingDecisionNote', 'onboardingSubmittedAt', 'onboardingReviewedAt', 'credentialTotal', 'credentialVerified', 'credentialExpired', 'credentialExpiringSoon', 'missingCredentialTypes', 'createdAt', 'updatedAt'];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="carepoint-provider-accounts.csv"');
  res.send(toCsv(headers, rows));
});

adminUsersRouter.post('/import', async (req, res) => {
  const type = normalizeAccountType(req.body?.type);
  const dryRun = req.body?.dryRun === true || clean(req.body?.dryRun).toLowerCase() === 'true';
  const rows = importRows(req.body);
  if (rows.length === 0) throw badRequest('Import file must include a header row and at least one account row');
  if (rows.length > 200) throw badRequest('Account imports are limited to 200 rows per request');

  const { normalized, errors } = await validateImportRows(req, type, rows);
  if (errors.length > 0 || dryRun) {
    res.status(errors.length > 0 ? 422 : 200).json({ dryRun, type, totalRows: rows.length, validRows: normalized.length, rejectedRows: errors.length, errors });
    return;
  }

  const created: any[] = [];
  await prisma.$transaction(async (tx) => {
    for (const row of normalized) {
      const passwordHash = await bcrypt.hash(row.password, 10);
      const user = await tx.user.create({
        data: {
          email: row.email,
          firstName: row.firstName,
          lastName: row.lastName,
          role: type === 'PATIENT' ? UserRole.PATIENT : row.role,
          organizationId: row.organizationId,
          passwordHash,
          status: row.status,
          deactivatedAt: row.status !== AccountStatus.ACTIVE ? new Date() : null,
          deactivationReason: row.status !== AccountStatus.ACTIVE ? row.deactivationReason || null : null,
        },
      });

      if (type === 'PATIENT') {
        const profile = await tx.patientProfile.create({ data: { userId: user.id, organizationId: row.organizationId, dateOfBirth: row.dateOfBirth ? safeDate(row.dateOfBirth) : null, insuranceNumber: row.insuranceNumber || null, preferences: {} } });
        created.push({ sourceRow: row.sourceRow, id: profile.id, userId: user.id, email: row.email, type });
      } else {
        const profile = await tx.providerProfile.create({ data: { userId: user.id, organizationId: row.organizationId, specialty: row.specialty || null, licenseNumber: row.licenseNumber || null, services: parseServices(row.services) } });
        await ensureProviderOnboardingState(tx, profile, req.user?.userId, ProviderOnboardingStatus.DRAFT, 'Created from admin CSV import');
        created.push({ sourceRow: row.sourceRow, id: profile.id, userId: user.id, email: row.email, type, role: row.role, onboardingStatus: ProviderOnboardingStatus.DRAFT });
      }
    }
  });

  await Promise.all(created.map((item) => writeAuditLog({
    actorId: req.user?.userId,
    organizationId: normalized.find((row) => row.email === item.email)?.organizationId,
    action: type === 'PATIENT' ? 'admin.patient.imported' : 'admin.provider.imported',
    resource: profileResource(type),
    resourceId: item.id,
    details: { email: item.email, sourceRow: item.sourceRow, importBatchSize: created.length },
  })));

  res.status(201).json({ type, totalRows: rows.length, createdRows: created.length, rejectedRows: 0, items: created });
});

async function getOrganizationDependencySummary(organizationId: string) {
  const [
    users,
    patients,
    providers,
    appointments,
    appointmentSubjectContexts,
    messageThreads,
    auditLogs,
    onboardingStates,
    credentialDocuments,
    credentialReviewTasks,
    credentialNotifications,
    serviceCatalogItems,
    coverageRules,
    pricingRules,
    policyTemplates,
    supportWorkItems,
    safetyCases,
    reportDefinitions,
    campaigns,
    integrationConnections,
    moderationCases,
    providerScheduleTemplates,
    clinicalOrders,
    prescriptionDrafts,
    labWorkItems,
    rpmEnrollments,
    providerAlerts,
    facilitySettings,
    patientFamilyProfiles,
    patientNotificationItems,
    patientSupportTickets,
    patientReminderPlans,
    patientCarePlanItems,
    patientRpmPrograms,
    patientConsentRecords,
  ] = await Promise.all([
    prisma.user.count({ where: { organizationId } }),
    prisma.patientProfile.count({ where: { organizationId } }),
    prisma.providerProfile.count({ where: { organizationId } }),
    prisma.appointment.count({ where: { organizationId } }),
    prisma.appointmentSubjectContext.count({ where: { organizationId } }),
    prisma.messageThread.count({ where: { organizationId } }),
    prisma.auditLog.count({ where: { organizationId } }),
    prisma.providerOnboardingState.count({ where: { organizationId } }),
    prisma.providerCredentialDocument.count({ where: { organizationId } }),
    prisma.providerCredentialReviewTask.count({ where: { organizationId } }),
    prisma.providerCredentialNotification.count({ where: { organizationId } }),
    prisma.serviceCatalogItem.count({ where: { organizationId } }),
    prisma.coverageRule.count({ where: { organizationId } }),
    prisma.pricingRule.count({ where: { organizationId } }),
    prisma.policyTemplate.count({ where: { organizationId } }),
    prisma.supportWorkItem.count({ where: { organizationId } }),
    prisma.safetyCase.count({ where: { organizationId } }),
    prisma.reportDefinition.count({ where: { organizationId } }),
    prisma.campaign.count({ where: { organizationId } }),
    prisma.integrationConnection.count({ where: { organizationId } }),
    prisma.moderationCase.count({ where: { organizationId } }),
    prisma.providerScheduleTemplate.count({ where: { organizationId } }),
    prisma.clinicalOrder.count({ where: { organizationId } }),
    prisma.prescriptionDraft.count({ where: { organizationId } }),
    prisma.labWorkItem.count({ where: { organizationId } }),
    prisma.rpmEnrollment.count({ where: { organizationId } }),
    prisma.providerAlert.count({ where: { organizationId } }),
    prisma.facilitySetting.count({ where: { organizationId } }),
    prisma.patientFamilyProfile.count({ where: { organizationId } }),
    prisma.patientNotificationItem.count({ where: { organizationId } }),
    prisma.patientSupportTicket.count({ where: { organizationId } }),
    prisma.patientReminderPlan.count({ where: { organizationId } }),
    prisma.patientCarePlanItem.count({ where: { organizationId } }),
    prisma.patientRpmProgram.count({ where: { organizationId } }),
    prisma.patientConsentRecord.count({ where: { organizationId } }),
  ]);

  return compactDependencySummary({
    users,
    patients,
    providers,
    appointments,
    appointmentSubjectContexts,
    messageThreads,
    auditLogs,
    onboardingStates,
    credentialDocuments,
    credentialReviewTasks,
    credentialNotifications,
    serviceCatalogItems,
    coverageRules,
    pricingRules,
    policyTemplates,
    supportWorkItems,
    safetyCases,
    reportDefinitions,
    campaigns,
    integrationConnections,
    moderationCases,
    providerScheduleTemplates,
    clinicalOrders,
    prescriptionDrafts,
    labWorkItems,
    rpmEnrollments,
    providerAlerts,
    facilitySettings,
    patientFamilyProfiles,
    patientNotificationItems,
    patientSupportTickets,
    patientReminderPlans,
    patientCarePlanItems,
    patientRpmPrograms,
    patientConsentRecords,
  });
}

async function mapOrganization(organization: any) {
  const dependencySummary = await getOrganizationDependencySummary(organization.id);
  return buildOrganizationView(organization, dependencySummary);
}

// Presentation shape for an organization row, given an already-computed
// dependency summary. Kept separate so the list view can reuse a single
// batched summary computation instead of paying 35 count queries per org.
function buildOrganizationView(organization: any, dependencySummary: Record<string, number>) {
  const accountCount = (dependencySummary.users ?? 0) + (dependencySummary.patients ?? 0) + (dependencySummary.providers ?? 0);
  return {
    id: organization.id,
    name: organization.name,
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt,
    dependencySummary,
    canDelete: countTotal(dependencySummary) === 0,
    accountCount,
    isFallback: organization.name?.toLowerCase() === defaultOrganizationName.toLowerCase(),
  };
}

// Relations counted for the organization dependency summary. Used to build the
// batched summaries with one groupBy per relation instead of one count per
// (relation x organization).
const ORGANIZATION_DEPENDENCY_RELATIONS: Array<[string, any]> = [
  ['users', prisma.user],
  ['patients', prisma.patientProfile],
  ['providers', prisma.providerProfile],
  ['appointments', prisma.appointment],
  ['appointmentSubjectContexts', prisma.appointmentSubjectContext],
  ['messageThreads', prisma.messageThread],
  ['auditLogs', prisma.auditLog],
  ['onboardingStates', prisma.providerOnboardingState],
  ['credentialDocuments', prisma.providerCredentialDocument],
  ['credentialReviewTasks', prisma.providerCredentialReviewTask],
  ['credentialNotifications', prisma.providerCredentialNotification],
  ['serviceCatalogItems', prisma.serviceCatalogItem],
  ['coverageRules', prisma.coverageRule],
  ['pricingRules', prisma.pricingRule],
  ['policyTemplates', prisma.policyTemplate],
  ['supportWorkItems', prisma.supportWorkItem],
  ['safetyCases', prisma.safetyCase],
  ['reportDefinitions', prisma.reportDefinition],
  ['campaigns', prisma.campaign],
  ['integrationConnections', prisma.integrationConnection],
  ['moderationCases', prisma.moderationCase],
  ['providerScheduleTemplates', prisma.providerScheduleTemplate],
  ['clinicalOrders', prisma.clinicalOrder],
  ['prescriptionDrafts', prisma.prescriptionDraft],
  ['labWorkItems', prisma.labWorkItem],
  ['rpmEnrollments', prisma.rpmEnrollment],
  ['providerAlerts', prisma.providerAlert],
  ['facilitySettings', prisma.facilitySetting],
  ['patientFamilyProfiles', prisma.patientFamilyProfile],
  ['patientNotificationItems', prisma.patientNotificationItem],
  ['patientSupportTickets', prisma.patientSupportTicket],
  ['patientReminderPlans', prisma.patientReminderPlan],
  ['patientCarePlanItems', prisma.patientCarePlanItem],
  ['patientRpmPrograms', prisma.patientRpmProgram],
  ['patientConsentRecords', prisma.patientConsentRecord],
];

// Batched equivalent of getOrganizationDependencySummary for many organizations.
// Runs one groupBy per relation (35 queries total) instead of 35 counts per
// organization (35 x N). This is the fix for the slow GET /organizations page.
async function getOrganizationDependencySummariesBatched(organizationIds: string[]) {
  const result = new Map<string, Record<string, number>>();
  if (organizationIds.length === 0) return result;

  const perOrg: Record<string, Record<string, number>> = {};
  for (const id of organizationIds) perOrg[id] = {};

  const where = { organizationId: { in: organizationIds } };
  await Promise.all(
    ORGANIZATION_DEPENDENCY_RELATIONS.map(async ([key, delegate]) => {
      const groups = await delegate.groupBy({ by: ['organizationId'], where, _count: { _all: true } });
      for (const group of groups as Array<{ organizationId: string | null; _count: { _all: number } }>) {
        const orgId = group.organizationId;
        const count = group._count?._all ?? 0;
        if (orgId && perOrg[orgId] && count > 0) perOrg[orgId][key] = count;
      }
    }),
  );

  for (const id of organizationIds) result.set(id, compactDependencySummary(perOrg[id]));
  return result;
}



adminUsersRouter.get('/provider-roles', async (_req, res) => {
  await ensureDefaultProviderRoleCatalog();
  const roles = await prisma.providerRoleCatalog.findMany({
    include: { organization: { select: { name: true } } },
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    take: 500,
  });
  const items = await Promise.all(roles.map(async (role) => mapProviderRoleCatalog(role, await providerRoleUsageCount(role))));
  res.json({ items, count: items.length });
});

adminUsersRouter.post('/provider-roles', async (req, res) => {
  const label = providerRoleLabel(req.body?.label);
  if (!label) throw badRequest('Role label is required');

  const code = providerRoleCode(req.body?.code, label);
  if (!code) throw badRequest('Role code is required');

  const systemRole = validateProviderRole(req.body?.systemRole);
  const duplicate = await prisma.providerRoleCatalog.findUnique({ where: { code } });
  if (duplicate) throw badRequest('Provider role code already exists. Update the existing role or choose another code.');

  const role = await prisma.providerRoleCatalog.create({
    data: {
      code,
      label,
      description: clean(req.body?.description) || null,
      systemRole,
      isActive: parseBooleanInput(req.body?.isActive, true),
      isSystem: false,
      sortOrder: Number.isFinite(Number(req.body?.sortOrder)) ? Number(req.body.sortOrder) : 100,
    },
    include: { organization: { select: { name: true } } },
  });

  await safeWriteAccountAuditLog({ actorId: req.user?.userId, organizationId: req.user?.organizationId ?? undefined, action: 'admin.provider_role.created', resource: 'provider_role_catalog', resourceId: role.id, details: { code, label, systemRole } });
  res.status(201).json({ item: mapProviderRoleCatalog(role, 0) });
});

adminUsersRouter.put('/provider-roles/:roleId', async (req, res) => {
  const current = await prisma.providerRoleCatalog.findUnique({ where: { id: req.params.roleId } });
  if (!current) throw notFound('Provider role not found');

  const label = req.body?.label !== undefined ? providerRoleLabel(req.body.label) : current.label;
  if (!label) throw badRequest('Role label is required');

  const code = current.isSystem ? current.code : providerRoleCode(req.body?.code ?? current.code, label);
  if (!code) throw badRequest('Role code is required');

  const systemRole = current.isSystem ? current.systemRole : validateProviderRole(req.body?.systemRole ?? current.systemRole);
  const duplicate = await prisma.providerRoleCatalog.findFirst({ where: { code, id: { not: current.id } } });
  if (duplicate) throw badRequest('Provider role code already exists.');

  const role = await prisma.providerRoleCatalog.update({
    where: { id: current.id },
    data: {
      code,
      label,
      description: req.body?.description !== undefined ? clean(req.body.description) || null : current.description,
      systemRole,
      isActive: parseBooleanInput(req.body?.isActive, current.isActive),
      sortOrder: Number.isFinite(Number(req.body?.sortOrder)) ? Number(req.body.sortOrder) : current.sortOrder,
    },
    include: { organization: { select: { name: true } } },
  });

  await safeWriteAccountAuditLog({ actorId: req.user?.userId, organizationId: req.user?.organizationId ?? undefined, action: 'admin.provider_role.updated', resource: 'provider_role_catalog', resourceId: role.id, details: { from: current.code, to: code, label, systemRole } });
  res.json({ item: mapProviderRoleCatalog(role, await providerRoleUsageCount(role)) });
});

adminUsersRouter.delete('/provider-roles/:roleId', async (req, res) => {
  const current = await prisma.providerRoleCatalog.findUnique({ where: { id: req.params.roleId } });
  if (!current) throw notFound('Provider role not found');

  if (current.isSystem) throw badRequest('Default system provider roles cannot be deleted. You can deactivate custom roles only.');

  const providerCount = await providerRoleUsageCount(current);
  if (providerCount > 0) throw badRequest('Provider role cannot be deleted while provider accounts are using it. Reassign providers first.', { providerCount });

  await prisma.providerRoleCatalog.delete({ where: { id: current.id } });
  await safeWriteAccountAuditLog({ actorId: req.user?.userId, organizationId: req.user?.organizationId ?? undefined, action: 'admin.provider_role.deleted', resource: 'provider_role_catalog', resourceId: current.id, details: { code: current.code, label: current.label } });
  res.status(204).send();
});

adminUsersRouter.get('/patients', async (req, res) => {
  const q = clean(req.query.q).toLowerCase();
  const status = clean(req.query.status).toUpperCase();
  const where: any = req.user?.organizationId ? { organizationId: req.user.organizationId } : {};
  if (accountStatuses.includes(status as AccountStatus)) where.user = { is: { status: status as AccountStatus } };

  const profiles = await prisma.patientProfile.findMany({ where, include: { organization: { select: { name: true } }, user: true }, orderBy: { user: { createdAt: 'desc' } }, take: 500 });
  const mapped = await Promise.all(profiles.map(mapPatient));
  const items = mapped.filter((item) => !q || [item.name, item.email, item.insuranceNumber, item.organizationName, item.status].join(' ').toLowerCase().includes(q));
  res.json({ items, count: items.length });
});

adminUsersRouter.post('/patients', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const { firstName, lastName } = splitName(req.body ?? {});
  if (!email || !firstName || !lastName) throw badRequest('email, firstName and lastName are required');

  await assertEmailAvailable(email);
  const organizationId = await getOrganizationId(req, req.body?.organizationId);
  const passwordHash = await bcrypt.hash(clean(req.body?.password) || 'ChangeMe123!', 10);
  const item = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { email, firstName, lastName, role: UserRole.PATIENT, organizationId, passwordHash, ...statusPatch(req.body, AccountStatus.ACTIVE) } });
    return tx.patientProfile.create({ data: { userId: user.id, organizationId, dateOfBirth: safeDate(req.body?.dateOfBirth), insuranceNumber: clean(req.body?.insuranceNumber) || null, preferences: {} }, include: { organization: { select: { name: true } }, user: true } });
  });

  await safeWriteAccountAuditLog({ actorId: req.user?.userId, organizationId, action: 'admin.patient.created', resource: 'patient_profile', resourceId: item.id, details: { email } });
  res.status(201).json({ item: await mapPatient(item) });
});

adminUsersRouter.put('/patients/:patientId', async (req, res) => {
  const current = await findPatient(req.params.patientId);
  if (!current) throw notFound('Patient not found');
  assertSameOrg(req, current.organizationId);

  const { firstName, lastName } = splitName({ ...current.user, ...req.body });
  const email = req.body?.email !== undefined ? normalizeEmail(req.body.email) : current.user.email;
  await assertEmailAvailable(email, current.userId);

  const password = clean(req.body?.password);
  const userData: any = { email, firstName, lastName, ...statusPatch(req.body, current.user.status) };
  if (password) userData.passwordHash = await bcrypt.hash(password, 10);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: current.userId }, data: userData });
    if (userData.status && userData.status !== AccountStatus.ACTIVE) await revokeSessions(tx, current.userId);
    return tx.patientProfile.update({ where: { id: current.id }, data: { dateOfBirth: req.body?.dateOfBirth !== undefined ? safeDate(req.body.dateOfBirth) : current.dateOfBirth, insuranceNumber: req.body?.insuranceNumber !== undefined ? clean(req.body.insuranceNumber) || null : current.insuranceNumber }, include: { organization: { select: { name: true } }, user: true } });
  });

  await safeWriteAccountAuditLog({ actorId: req.user?.userId, organizationId: current.organizationId, action: password ? 'admin.patient.updated_password_reset' : 'admin.patient.updated', resource: 'patient_profile', resourceId: current.id, details: { emailChanged: email !== current.user.email, statusChanged: userData.status ? userData.status !== current.user.status : false } });
  res.json({ item: await mapPatient(updated) });
});

adminUsersRouter.patch('/patients/:patientId/status', async (req, res) => {
  const current = await findPatient(req.params.patientId);
  if (!current) throw notFound('Patient not found');
  assertSameOrg(req, current.organizationId);

  const statusData = statusPatch(req.body, current.user.status);
  if (!statusData.status) throw badRequest('status is required');

  const updated = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: current.userId }, data: statusData });
    if (statusData.status !== AccountStatus.ACTIVE) await revokeSessions(tx, current.userId);
    return tx.patientProfile.findUniqueOrThrow({ where: { id: current.id }, include: { organization: { select: { name: true } }, user: true } });
  });

  await writeAuditLog({ actorId: req.user?.userId, organizationId: current.organizationId, action: statusAuditAction('admin.patient', current.user.status, statusData.status), resource: 'patient_profile', resourceId: current.id, details: { from: current.user.status, to: statusData.status, reason: statusData.deactivationReason ?? null } });
  res.json({ item: await mapPatient(updated) });
});

adminUsersRouter.delete('/patients/:patientId', async (req, res) => {
  const current = await findPatient(req.params.patientId);
  if (!current) throw notFound('Patient not found');
  assertSameOrg(req, current.organizationId);

  const dependencySummary = await getPatientDeletionSummary(current.id, current.userId);
  if (countTotal(dependencySummary) > 0) {
    throw badRequest('Patient cannot be deleted while protected downstream records exist.', { dependencies: dependencySummary });
  }

  await prisma.$transaction(async (tx) => {
    await tx.refreshToken.deleteMany({ where: { userId: current.userId } });
    await tx.patientProfile.delete({ where: { id: current.id } });
    await tx.user.delete({ where: { id: current.userId } });
  });

  await safeWriteAccountAuditLog({ actorId: req.user?.userId, organizationId: current.organizationId, action: 'admin.patient.deleted', resource: 'patient_profile', resourceId: current.id, details: { email: current.user.email } });
  res.status(204).send();
});

adminUsersRouter.get('/providers', async (req, res) => {
  const q = clean(req.query.q).toLowerCase();
  const status = clean(req.query.status).toUpperCase();
  const where: any = req.user?.organizationId ? { organizationId: req.user.organizationId } : {};
  if (accountStatuses.includes(status as AccountStatus)) where.user = { is: { status: status as AccountStatus } };

  const profiles = await prisma.providerProfile.findMany({ where, include: { organization: { select: { name: true } }, user: true, roleCatalog: true, onboardingState: true, credentialDocuments: { include: { verifiedBy: true }, orderBy: { createdAt: 'desc' } }, credentialReviewTasks: { where: { status: { in: activeCredentialReviewTaskStatuses } }, include: providerReviewTaskInclude(), orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }, { createdAt: 'desc' }], take: 6 } }, orderBy: { user: { createdAt: 'desc' } }, take: 500 });
  const mapped = await Promise.all(profiles.map(mapProvider));
  const items = mapped.filter((item) => !q || [item.name, item.email, item.specialty, item.licenseNumber, item.services.join(' '), item.organizationName, item.status, item.onboardingStatus].join(' ').toLowerCase().includes(q));
  res.json({ items, count: items.length });
});

adminUsersRouter.post('/providers', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const { firstName, lastName } = splitName(req.body ?? {});
  if (!email || !firstName || !lastName) throw badRequest('email, firstName and lastName are required');

  await assertEmailAvailable(email);
  const organizationId = await getOrganizationId(req, req.body?.organizationId);
  const passwordHash = await bcrypt.hash(clean(req.body?.password) || 'ChangeMe123!', 10);
  const roleSelection = await resolveProviderRoleSelection(req, req.body?.role, UserRole.PROVIDER);
  const role = roleSelection.systemRole;

  let item: any;
  try {
    item = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email, firstName, lastName, role, organizationId, passwordHash, ...statusPatch(req.body, AccountStatus.ACTIVE) } });
      const profile = await tx.providerProfile.create({ data: { userId: user.id, organizationId, specialty: clean(req.body?.specialty) || null, licenseNumber: clean(req.body?.licenseNumber) || null, services: parseServices(req.body?.services), roleCatalogId: roleSelection.catalogId }, include: { organization: { select: { name: true } }, user: true, roleCatalog: true, onboardingState: true, credentialDocuments: { include: { verifiedBy: true }, orderBy: { createdAt: 'desc' } }, credentialReviewTasks: { where: { status: { in: activeCredentialReviewTaskStatuses } }, include: providerReviewTaskInclude(), orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }, { createdAt: 'desc' }], take: 6 } } });
      await ensureProviderOnboardingState(tx, profile, req.user?.userId, normalizeProviderOnboardingStatus(req.body?.onboardingStatus, ProviderOnboardingStatus.DRAFT), clean(req.body?.onboardingDecisionNote) || null);
      return tx.providerProfile.findUniqueOrThrow({ where: { id: profile.id }, include: { organization: { select: { name: true } }, user: true, roleCatalog: true, onboardingState: true, credentialDocuments: { include: { verifiedBy: true }, orderBy: { createdAt: 'desc' } }, credentialReviewTasks: { where: { status: { in: activeCredentialReviewTaskStatuses } }, include: providerReviewTaskInclude(), orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }, { createdAt: 'desc' }], take: 6 } } });
    });
  } catch (error) {
    throw translateProviderPrismaError(error, 'create');
  }

  await safeWriteAccountAuditLog({ actorId: req.user?.userId, organizationId, action: 'admin.provider.created', resource: 'provider_profile', resourceId: item.id, details: { email, role } });
  res.status(201).json({ item: await mapProvider(item) });
});

adminUsersRouter.put('/providers/:providerId', async (req, res) => {
  const current = await findProvider(req.params.providerId);
  if (!current) throw notFound('Provider not found');
  assertSameOrg(req, current.organizationId);

  const { firstName, lastName } = splitName({ ...current.user, ...req.body });
  const email = req.body?.email !== undefined ? normalizeEmail(req.body.email) : current.user.email;
  const roleSelection = await resolveProviderRoleSelection(req, req.body?.role, current.user.role);
  const role = req.body?.role !== undefined ? roleSelection.systemRole : current.user.role;
  await assertEmailAvailable(email, current.userId);

  const password = clean(req.body?.password);
  const userData: any = { email, firstName, lastName, role, ...statusPatch(req.body, current.user.status) };
  if (password) userData.passwordHash = await bcrypt.hash(password, 10);

  let updated: any;
  try {
    updated = await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: current.userId }, data: userData });
      if (userData.status && userData.status !== AccountStatus.ACTIVE) await revokeSessions(tx, current.userId);
      const profile = await tx.providerProfile.update({ where: { id: current.id }, data: { specialty: req.body?.specialty !== undefined ? clean(req.body.specialty) || null : current.specialty, licenseNumber: req.body?.licenseNumber !== undefined ? clean(req.body.licenseNumber) || null : current.licenseNumber, services: req.body?.services !== undefined ? parseServices(req.body.services) : current.services, roleCatalogId: req.body?.role !== undefined ? roleSelection.catalogId : current.roleCatalogId ?? null }, include: { organization: { select: { name: true } }, user: true, roleCatalog: true, onboardingState: true, credentialDocuments: { include: { verifiedBy: true }, orderBy: { createdAt: 'desc' } }, credentialReviewTasks: { where: { status: { in: activeCredentialReviewTaskStatuses } }, include: providerReviewTaskInclude(), orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }, { createdAt: 'desc' }], take: 6 } } });
      if (req.body?.syncOnboarding !== false) {
        await ensureProviderOnboardingState(tx, profile, req.user?.userId, normalizeProviderOnboardingStatus(req.body?.onboardingStatus, profile.onboardingState?.status ?? ProviderOnboardingStatus.DRAFT), req.body?.onboardingDecisionNote !== undefined ? clean(req.body.onboardingDecisionNote) || null : profile.onboardingState?.decisionNote ?? null);
      }
      return tx.providerProfile.findUniqueOrThrow({ where: { id: current.id }, include: { organization: { select: { name: true } }, user: true, roleCatalog: true, onboardingState: true, credentialDocuments: { include: { verifiedBy: true }, orderBy: { createdAt: 'desc' } }, credentialReviewTasks: { where: { status: { in: activeCredentialReviewTaskStatuses } }, include: providerReviewTaskInclude(), orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }, { createdAt: 'desc' }], take: 6 } } });
    });
  } catch (error) {
    throw translateProviderPrismaError(error, 'update');
  }

  await safeWriteAccountAuditLog({ actorId: req.user?.userId, organizationId: current.organizationId, action: password ? 'admin.provider.updated_password_reset' : 'admin.provider.updated', resource: 'provider_profile', resourceId: current.id, details: { emailChanged: email !== current.user.email, roleChanged: role !== current.user.role, statusChanged: userData.status ? userData.status !== current.user.status : false } });
  res.json({ item: await mapProvider(updated) });
});

adminUsersRouter.patch('/providers/:providerId/status', async (req, res) => {
  const current = await findProvider(req.params.providerId);
  if (!current) throw notFound('Provider not found');
  assertSameOrg(req, current.organizationId);

  const statusData = statusPatch(req.body, current.user.status);
  if (!statusData.status) throw badRequest('status is required');

  const updated = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: current.userId }, data: statusData });
    if (statusData.status !== AccountStatus.ACTIVE) await revokeSessions(tx, current.userId);
    return tx.providerProfile.findUniqueOrThrow({ where: { id: current.id }, include: { organization: { select: { name: true } }, user: true, roleCatalog: true, onboardingState: true, credentialDocuments: { include: { verifiedBy: true }, orderBy: { createdAt: 'desc' } }, credentialReviewTasks: { where: { status: { in: activeCredentialReviewTaskStatuses } }, include: providerReviewTaskInclude(), orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }, { createdAt: 'desc' }], take: 6 } } });
  });

  await writeAuditLog({ actorId: req.user?.userId, organizationId: current.organizationId, action: statusAuditAction('admin.provider', current.user.status, statusData.status), resource: 'provider_profile', resourceId: current.id, details: { from: current.user.status, to: statusData.status, reason: statusData.deactivationReason ?? null } });
  res.json({ item: await mapProvider(updated) });
});


adminUsersRouter.patch('/providers/:providerId/onboarding', async (req, res) => {
  const current = await findProvider(req.params.providerId);
  if (!current) throw notFound('Provider not found');
  assertSameOrg(req, current.organizationId);

  const status = normalizeProviderOnboardingStatus(req.body?.status, current.onboardingState?.status ?? ProviderOnboardingStatus.DRAFT);
  const decisionNote = clean(req.body?.decisionNote) || null;
  const requestedFields = req.body?.requestedFields && typeof req.body.requestedFields === 'object' ? req.body.requestedFields : current.onboardingState?.requestedFields ?? {};
  const checklist = Array.isArray(req.body?.checklist) ? req.body.checklist : buildProviderOnboardingChecklist(current);
  const now = new Date();

  const item = await prisma.providerOnboardingState.upsert({
    where: { providerId: current.id },
    create: {
      providerId: current.id,
      organizationId: current.organizationId,
      status,
      checklist,
      requestedFields,
      decisionNote,
      submittedAt: status === ProviderOnboardingStatus.READY_FOR_REVIEW ? now : null,
      /* reviewedAt: [ProviderOnboardingStatus.APPROVED, ProviderOnboardingStatus.REJECTED, ProviderOnboardingStatus.REQUEST_CHANGES].includes(status) ? now : null,*/
      reviewedAt: isReviewedStatus(status) ? now : null,
	  lastAction: 'admin.provider.onboarding_updated',
      lastActorId: req.user?.userId,
    },
    update: {
      status,
      checklist,
      requestedFields,
      decisionNote,
      submittedAt: status === ProviderOnboardingStatus.READY_FOR_REVIEW ? now : undefined,
      /* reviewedAt: [ProviderOnboardingStatus.APPROVED, ProviderOnboardingStatus.REJECTED, ProviderOnboardingStatus.REQUEST_CHANGES].includes(status) ? now : undefined,*/
	  reviewedAt: isReviewedStatus(status) ? now : undefined,
      lastAction: 'admin.provider.onboarding_updated',
      lastActorId: req.user?.userId,
    },
  });

  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId: current.organizationId,
    action: status === ProviderOnboardingStatus.APPROVED ? 'admin.provider.onboarding_approved' : status === ProviderOnboardingStatus.REJECTED ? 'admin.provider.onboarding_rejected' : 'admin.provider.onboarding_updated',
    resource: 'provider_profile',
    resourceId: current.id,
    details: { status, decisionNote, onboardingStateId: item.id },
  });

  const updated = await prisma.providerProfile.findUniqueOrThrow({ where: { id: current.id }, include: { organization: { select: { name: true } }, user: true, roleCatalog: true, onboardingState: true, credentialDocuments: { include: { verifiedBy: true }, orderBy: { createdAt: 'desc' } }, credentialReviewTasks: { where: { status: { in: activeCredentialReviewTaskStatuses } }, include: providerReviewTaskInclude(), orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }, { createdAt: 'desc' }], take: 6 } } });
  res.json({ item: await mapProvider(updated) });
});


adminUsersRouter.get('/providers/:providerId/credentials', async (req, res) => {
  const current = await findProvider(req.params.providerId);
  if (!current) throw notFound('Provider not found');
  assertSameOrg(req, current.organizationId);

  const documents = await prisma.providerCredentialDocument.findMany({
    where: { providerId: current.id },
    include: { verifiedBy: true },
    orderBy: [{ expiresAt: 'asc' }, { createdAt: 'desc' }],
  });

  res.json({ items: documents.map(mapCredentialDocument), summary: credentialSummary(documents), count: documents.length });
});

adminUsersRouter.post('/providers/:providerId/credentials', async (req, res) => {
  const current = await findProvider(req.params.providerId);
  if (!current) throw notFound('Provider not found');
  assertSameOrg(req, current.organizationId);

  const type = normalizeCredentialDocumentType(req.body?.type);
  const status = normalizeCredentialDocumentStatus(req.body?.status, 'UPLOADED');
  const title = clean(req.body?.title) || type.replaceAll('_', ' ');
  const issuedAt = safeOptionalDate(req.body?.issuedAt, 'issuedAt');
  const expiresAt = safeOptionalDate(req.body?.expiresAt, 'expiresAt');
  if (issuedAt && expiresAt && expiresAt < issuedAt) throw badRequest('expiresAt must be after issuedAt');

  const updatedProvider = await prisma.$transaction(async (tx) => {
    const document = await tx.providerCredentialDocument.create({
      data: {
        providerId: current.id,
        organizationId: current.organizationId,
        type,
        title,
        status,
        documentUrl: clean(req.body?.documentUrl) || null,
        fileName: clean(req.body?.fileName) || null,
        referenceNumber: clean(req.body?.referenceNumber) || null,
        issuedAt,
        expiresAt,
        rejectionReason: status === 'REJECTED' ? clean(req.body?.rejectionReason) || 'Rejected by admin review' : null,
        verifiedAt: status === 'VERIFIED' ? new Date() : null,
        verifiedById: status === 'VERIFIED' ? req.user?.userId : null,
        notes: clean(req.body?.notes) || null,
        metadata: req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : undefined,
      },
    });

    await ensureOpenCredentialReviewTask(tx, current, document, req.user?.userId);

    await tx.auditLog.create({
      data: {
        actorId: req.user?.userId,
        organizationId: current.organizationId,
        action: 'admin.provider.credential_document.created',
        resource: 'provider_credential_document',
        resourceId: document.id,
        details: { providerId: current.id, type, status, title },
      },
    });

    return syncProviderCredentialChecklist(tx, current.id, req.user?.userId);
  });

  const documents = updatedProvider?.credentialDocuments ?? [];
  res.status(201).json({ item: updatedProvider ? await mapProvider(updatedProvider) : null, documents: documents.map(mapCredentialDocument), summary: credentialSummary(documents) });
});

adminUsersRouter.put('/providers/:providerId/credentials/:documentId', async (req, res) => {
  const current = await findProvider(req.params.providerId);
  if (!current) throw notFound('Provider not found');
  assertSameOrg(req, current.organizationId);

  const existing = await prisma.providerCredentialDocument.findFirst({ where: { id: req.params.documentId, providerId: current.id } });
  if (!existing) throw notFound('Credential document not found');

  const type = req.body?.type !== undefined ? normalizeCredentialDocumentType(req.body.type, existing.type) : existing.type;
  const status = req.body?.status !== undefined ? normalizeCredentialDocumentStatus(req.body.status, existing.status) : existing.status;
  const issuedAt = req.body?.issuedAt !== undefined ? safeOptionalDate(req.body.issuedAt, 'issuedAt') : existing.issuedAt;
  const expiresAt = req.body?.expiresAt !== undefined ? safeOptionalDate(req.body.expiresAt, 'expiresAt') : existing.expiresAt;
  if (issuedAt && expiresAt && expiresAt < issuedAt) throw badRequest('expiresAt must be after issuedAt');

  const updatedProvider = await prisma.$transaction(async (tx) => {
    const document = await tx.providerCredentialDocument.update({
      where: { id: existing.id },
      data: {
        type,
        status,
        title: req.body?.title !== undefined ? clean(req.body.title) || existing.title : existing.title,
        documentUrl: req.body?.documentUrl !== undefined ? clean(req.body.documentUrl) || null : existing.documentUrl,
        fileName: req.body?.fileName !== undefined ? clean(req.body.fileName) || null : existing.fileName,
        referenceNumber: req.body?.referenceNumber !== undefined ? clean(req.body.referenceNumber) || null : existing.referenceNumber,
        issuedAt,
        expiresAt,
        rejectionReason: status === 'REJECTED' ? clean(req.body?.rejectionReason) || existing.rejectionReason || 'Rejected by admin review' : null,
        verifiedAt: status === 'VERIFIED' ? existing.verifiedAt ?? new Date() : null,
        verifiedById: status === 'VERIFIED' ? existing.verifiedById ?? req.user?.userId : null,
        notes: req.body?.notes !== undefined ? clean(req.body.notes) || null : existing.notes,
        metadata: req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : existing.metadata,
      },
    });

    if (['VERIFIED', 'REJECTED', 'EXPIRED'].includes(status)) {
      await closeOpenCredentialReviewTasksForDocument(tx, current, document, status, clean(req.body?.rejectionReason) || clean(req.body?.notes) || null);
    } else {
      await ensureOpenCredentialReviewTask(tx, current, document, req.user?.userId);
    }

    await tx.auditLog.create({
      data: {
        actorId: req.user?.userId,
        organizationId: current.organizationId,
        action: status === 'VERIFIED' ? 'admin.provider.credential_document.verified' : status === 'REJECTED' ? 'admin.provider.credential_document.rejected' : 'admin.provider.credential_document.updated',
        resource: 'provider_credential_document',
        resourceId: document.id,
        details: { providerId: current.id, fromStatus: existing.status, toStatus: status, type },
      },
    });

    return syncProviderCredentialChecklist(tx, current.id, req.user?.userId);
  });

  const documents = updatedProvider?.credentialDocuments ?? [];
  res.json({ item: updatedProvider ? await mapProvider(updatedProvider) : null, documents: documents.map(mapCredentialDocument), summary: credentialSummary(documents) });
});

adminUsersRouter.patch('/providers/:providerId/credentials/:documentId/status', async (req, res) => {
  const current = await findProvider(req.params.providerId);
  if (!current) throw notFound('Provider not found');
  assertSameOrg(req, current.organizationId);

  const existing = await prisma.providerCredentialDocument.findFirst({ where: { id: req.params.documentId, providerId: current.id } });
  if (!existing) throw notFound('Credential document not found');

  const status = normalizeCredentialDocumentStatus(req.body?.status, existing.status);
  const updatedProvider = await prisma.$transaction(async (tx) => {
    const document = await tx.providerCredentialDocument.update({
      where: { id: existing.id },
      data: {
        status,
        rejectionReason: status === 'REJECTED' ? clean(req.body?.rejectionReason) || existing.rejectionReason || 'Rejected by admin review' : null,
        verifiedAt: status === 'VERIFIED' ? existing.verifiedAt ?? new Date() : null,
        verifiedById: status === 'VERIFIED' ? existing.verifiedById ?? req.user?.userId : null,
        notes: req.body?.notes !== undefined ? clean(req.body.notes) || null : existing.notes,
      },
    });
    if (['VERIFIED', 'REJECTED', 'EXPIRED'].includes(status)) {
      await closeOpenCredentialReviewTasksForDocument(tx, current, document, status, clean(req.body?.rejectionReason) || clean(req.body?.notes) || null);
    } else {
      await ensureOpenCredentialReviewTask(tx, current, document, req.user?.userId);
    }

    await tx.auditLog.create({
      data: {
        actorId: req.user?.userId,
        organizationId: current.organizationId,
        action: status === 'VERIFIED' ? 'admin.provider.credential_document.verified' : status === 'REJECTED' ? 'admin.provider.credential_document.rejected' : 'admin.provider.credential_document.status_changed',
        resource: 'provider_credential_document',
        resourceId: document.id,
        details: { providerId: current.id, fromStatus: existing.status, toStatus: status, type: existing.type },
      },
    });
    return syncProviderCredentialChecklist(tx, current.id, req.user?.userId);
  });

  const documents = updatedProvider?.credentialDocuments ?? [];
  res.json({ item: updatedProvider ? await mapProvider(updatedProvider) : null, documents: documents.map(mapCredentialDocument), summary: credentialSummary(documents) });
});

adminUsersRouter.delete('/providers/:providerId/credentials/:documentId', async (req, res) => {
  const current = await findProvider(req.params.providerId);
  if (!current) throw notFound('Provider not found');
  assertSameOrg(req, current.organizationId);

  const existing = await prisma.providerCredentialDocument.findFirst({ where: { id: req.params.documentId, providerId: current.id } });
  if (!existing) throw notFound('Credential document not found');

  await prisma.$transaction(async (tx) => {
    await tx.providerCredentialDocument.delete({ where: { id: existing.id } });
    await tx.auditLog.create({
      data: {
        actorId: req.user?.userId,
        organizationId: current.organizationId,
        action: 'admin.provider.credential_document.deleted',
        resource: 'provider_credential_document',
        resourceId: existing.id,
        details: { providerId: current.id, type: existing.type, status: existing.status, title: existing.title },
      },
    });
    await syncProviderCredentialChecklist(tx, current.id, req.user?.userId);
  });

  res.status(204).send();
});

adminUsersRouter.delete('/providers/:providerId', async (req, res) => {
  const current = await findProvider(req.params.providerId);
  if (!current) throw notFound('Provider not found');
  assertSameOrg(req, current.organizationId);

  const dependencySummary = await getProviderDeletionSummary(current.id, current.userId);
  if (countTotal(dependencySummary) > 0) {
    throw badRequest('Provider cannot be deleted while protected downstream records exist.', { dependencies: dependencySummary });
  }

  await prisma.$transaction(async (tx) => {
    await tx.refreshToken.deleteMany({ where: { userId: current.userId } });
    await tx.providerCredentialNotification.deleteMany({ where: { providerId: current.id } });
    await tx.providerCredentialReviewTask.deleteMany({ where: { providerId: current.id } });
    await tx.providerCredentialDocument.deleteMany({ where: { providerId: current.id } });
    await tx.providerOnboardingState.deleteMany({ where: { providerId: current.id } });
    await tx.providerProfile.delete({ where: { id: current.id } });
    await tx.user.delete({ where: { id: current.userId } });
  });

  await safeWriteAccountAuditLog({ actorId: req.user?.userId, organizationId: current.organizationId, action: 'admin.provider.deleted', resource: 'provider_profile', resourceId: current.id, details: { email: current.user.email, role: current.user.role } });
  res.status(204).send();
});

// ---------------------------------------------------------------------------
// IAM User Management (Task 5.1)
// Unified user list with pagination, search, creation, and status management.
// Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9
// ---------------------------------------------------------------------------

/**
 * GET /api/admin/users/iam-users
 *
 * Paginated user list (default 20/page, sorted by createdAt DESC).
 * - Super_Admin: all users across all organizations
 * - Company_Admin: only users in own organization
 * - Search: case-insensitive partial match on firstName+lastName, email, or role
 */
adminUsersRouter.get('/iam-users', async (req, res) => {
  const page = Math.max(1, parseInt(clean(req.query.page) || '1', 10) || 1);
  const pageSize = Math.max(1, Math.min(100, parseInt(clean(req.query.pageSize) || '20', 10) || 20));
  const search = clean(req.query.search).toLowerCase();
  const skip = (page - 1) * pageSize;

  // Organization scoping: Company_Admin sees only own org
  const orgWhere: any = req.user?.organizationId && !isSuperAdmin(req)
    ? { organizationId: req.user.organizationId }
    : {};

  // Build search filter for Prisma
  const searchWhere: any = search
    ? {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { role: { contains: search, mode: 'insensitive' } },
          // Match on full name (firstName + lastName combined)
          ...(search.includes(' ')
            ? [
                {
                  AND: search.split(/\s+/).map((part) => ({
                    OR: [
                      { firstName: { contains: part, mode: 'insensitive' } },
                      { lastName: { contains: part, mode: 'insensitive' } },
                    ],
                  })),
                },
              ]
            : []),
        ],
      }
    : {};

  const where = { ...orgWhere, ...searchWhere };

  const [items, totalCount] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { organization: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  const mapped = items.map((user) => ({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    name: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    role: user.role,
    status: user.status ?? AccountStatus.ACTIVE,
    organizationId: user.organizationId ?? null,
    organizationName: user.organization?.name ?? null,
    deactivatedAt: user.deactivatedAt ?? null,
    createdAt: user.createdAt,
  }));

  res.json({
    items: mapped,
    page,
    pageSize,
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
  });
});

/**
 * POST /api/admin/users/iam-users
 *
 * Create a new user account with validation.
 * - Validates unique email platform-wide
 * - Hashes a temporary password with bcrypt
 * - Company_Admin can only create users within their own organization
 * - Super_Admin can assign any organization
 * Requirements: 1.4, 1.5, 1.9
 */
adminUsersRouter.post('/iam-users', async (req, res) => {
  const firstName = clean(req.body?.firstName);
  const lastName = clean(req.body?.lastName);
  const email = normalizeEmail(req.body?.email);
  const role = clean(req.body?.role).toUpperCase();

  // Validate required fields
  if (!firstName) throw badRequest('firstName is required');
  if (!lastName) throw badRequest('lastName is required');
  if (!email) throw badRequest('email is required');
  if (!role) throw badRequest('role is required');

  // Validate email format (basic check)
  if (!email.includes('@') || !email.includes('.')) {
    throw badRequest('email must be a valid email address');
  }

  // Validate role
  const validRoles = Object.values(UserRole);
  if (!validRoles.includes(role as UserRole)) {
    throw badRequest(`role must be one of: ${validRoles.join(', ')}`);
  }

  // Check email uniqueness platform-wide
  await assertEmailAvailable(email);

  // Determine organization
  let organizationId: string;
  if (isSuperAdmin(req)) {
    // Super_Admin can assign to any org or use the provided one
    organizationId = await getOrganizationId(req, req.body?.organizationId);
  } else {
    // Company_Admin creates users within own org only
    if (!req.user?.organizationId) {
      throw badRequest('Organization context is required');
    }
    organizationId = req.user.organizationId;
  }

  // Hash a temporary password
  const temporaryPassword = clean(req.body?.password) || 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  const user = await prisma.user.create({
    data: {
      email,
      firstName,
      lastName,
      role: role as any,
      organizationId,
      passwordHash,
      status: AccountStatus.ACTIVE,
    },
    include: { organization: { select: { id: true, name: true } } },
  });

  await safeWriteAccountAuditLog({
    actorId: req.user?.userId,
    organizationId,
    action: 'admin.user.created',
    resource: 'user',
    resourceId: user.id,
    details: { email, role, firstName, lastName },
  });

  res.status(201).json({
    item: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      role: user.role,
      status: user.status,
      organizationId: user.organizationId ?? null,
      organizationName: user.organization?.name ?? null,
      deactivatedAt: user.deactivatedAt ?? null,
      createdAt: user.createdAt,
    },
  });
});

/**
 * GET /api/admin/users/iam-users/:userId
 *
 * Get a single user by ID. Returns 403 if Company_Admin tries to access
 * a user in a different organization.
 * Requirements: 1.3, 1.8
 */
adminUsersRouter.get('/iam-users/:userId', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.userId },
    include: { organization: { select: { id: true, name: true } } },
  });

  if (!user) throw notFound('User not found');

  // Org boundary enforcement for non-Super_Admin
  if (!isSuperAdmin(req) && req.user?.organizationId && user.organizationId !== req.user.organizationId) {
    throw forbidden('Requested account is outside the current organization scope');
  }

  res.json({
    item: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      role: user.role,
      status: user.status ?? AccountStatus.ACTIVE,
      organizationId: user.organizationId ?? null,
      organizationName: user.organization?.name ?? null,
      deactivatedAt: user.deactivatedAt ?? null,
      createdAt: user.createdAt,
    },
  });
});

/**
 * PATCH /api/admin/users/iam-users/:userId/status
 *
 * Update a user's account status (ACTIVE, SUSPENDED, ARCHIVED).
 * - On SUSPENDED: revoke all refresh tokens and set deactivatedAt
 * - Company_Admin: can only change status of users within own org
 * - Super_Admin: can change status of any user
 * Requirements: 1.6, 1.8
 */
adminUsersRouter.patch('/iam-users/:userId/status', async (req, res) => {
  const newStatus = clean(req.body?.status).toUpperCase();
  if (!newStatus || !accountStatuses.includes(newStatus as AccountStatus)) {
    throw badRequest(`status must be one of: ${accountStatuses.join(', ')}`);
  }

  const user = await prisma.user.findUnique({
    where: { id: req.params.userId },
    include: { organization: { select: { id: true, name: true } } },
  });

  if (!user) throw notFound('User not found');

  // Org boundary enforcement for non-Super_Admin
  if (!isSuperAdmin(req) && req.user?.organizationId && user.organizationId !== req.user.organizationId) {
    throw forbidden('Requested account is outside the current organization scope');
  }

  const previousStatus = user.status ?? AccountStatus.ACTIVE;

  // Build update payload
  const updateData: any = {
    status: newStatus as AccountStatus,
  };

  // On SUSPENDED: set deactivatedAt
  if (newStatus === AccountStatus.SUSPENDED || newStatus === AccountStatus.ARCHIVED) {
    updateData.deactivatedAt = new Date();
    updateData.deactivationReason = clean(req.body?.reason) || null;
  } else if (newStatus === AccountStatus.ACTIVE) {
    // Reactivation: clear deactivation fields
    updateData.deactivatedAt = null;
    updateData.deactivationReason = null;
  }

  await prisma.$transaction(async (tx) => {
    // Update user status
    await tx.user.update({ where: { id: user.id }, data: updateData });

    // On SUSPENDED: revoke all active refresh tokens
    if (newStatus === AccountStatus.SUSPENDED) {
      await tx.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  });

  await safeWriteAccountAuditLog({
    actorId: req.user?.userId,
    organizationId: user.organizationId ?? undefined,
    action: statusAuditAction('admin.user', previousStatus, newStatus as AccountStatus),
    resource: 'user',
    resourceId: user.id,
    details: {
      previousStatus,
      newStatus,
      reason: clean(req.body?.reason) || null,
    },
  });

  // Fetch the updated user
  const updated = await prisma.user.findUnique({
    where: { id: user.id },
    include: { organization: { select: { id: true, name: true } } },
  });

  res.json({
    item: {
      id: updated!.id,
      firstName: updated!.firstName,
      lastName: updated!.lastName,
      name: `${updated!.firstName} ${updated!.lastName}`.trim(),
      email: updated!.email,
      role: updated!.role,
      status: updated!.status,
      organizationId: updated!.organizationId ?? null,
      organizationName: updated!.organization?.name ?? null,
      deactivatedAt: updated!.deactivatedAt ?? null,
      createdAt: updated!.createdAt,
    },
  });
});
