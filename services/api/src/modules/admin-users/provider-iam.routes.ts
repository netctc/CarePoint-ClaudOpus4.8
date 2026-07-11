import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { iamMiddlewareChain } from '../../middleware/rbac';
import { badRequest, forbidden, notFound } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { writeAuditLog } from '../../lib/audit';
import {
  transitionOnboardingStatus,
  OnboardingStatus,
} from '../iam/onboarding-state-machine';

/**
 * IAM Provider sub-routes.
 *
 * Provides paginated provider list, provider detail, and provider creation
 * endpoints scoped by organization. Company_Admin sees only their own org's
 * providers; Super_Admin sees all.
 *
 * Mounted at: /api/admin/users/providers/iam
 *  - GET  /            → paginated provider list
 *  - GET  /:id         → provider detail with credentials, review tasks, onboarding
 *  - POST /            → create provider (User + ProviderProfile + DRAFT onboarding)
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.6
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const ProviderOnboardingStatus = {
  DRAFT: 'DRAFT',
  READY_FOR_REVIEW: 'READY_FOR_REVIEW',
  REQUEST_CHANGES: 'REQUEST_CHANGES',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
type ProviderOnboardingStatus = (typeof ProviderOnboardingStatus)[keyof typeof ProviderOnboardingStatus];

const AccountStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  ARCHIVED: 'ARCHIVED',
} as const;
type AccountStatus = (typeof AccountStatus)[keyof typeof AccountStatus];

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

const providerSystemRoles: UserRole[] = [
  UserRole.PROVIDER,
  UserRole.NURSE,
  UserRole.PHARMACIST,
  UserRole.LAB_TECH,
];

const accountStatuses: AccountStatus[] = [
  AccountStatus.ACTIVE,
  AccountStatus.SUSPENDED,
  AccountStatus.ARCHIVED,
];

const activeCredentialReviewTaskStatuses = ['OPEN', 'IN_REVIEW', 'BLOCKED'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeEmail(value: unknown): string {
  return clean(value).toLowerCase();
}

function parsePage(value: unknown): number {
  const num = parseInt(clean(value), 10);
  return Number.isNaN(num) || num < 1 ? 1 : num;
}

function parsePageSize(value: unknown, defaultSize = DEFAULT_PAGE_SIZE): number {
  const num = parseInt(clean(value), 10);
  if (Number.isNaN(num) || num < 1) return defaultSize;
  return Math.min(num, MAX_PAGE_SIZE);
}

function expiryState(expiresAt?: Date | string | null, status?: string | null): string {
  if (!expiresAt) return 'NO_EXPIRY';
  const expiry = new Date(expiresAt as string);
  if (Number.isNaN(expiry.getTime())) return 'NO_EXPIRY';
  const today = new Date();
  const inThirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  if (expiry < today || status === 'EXPIRED') return 'EXPIRED';
  if (expiry <= inThirtyDays) return 'EXPIRING_SOON';
  return 'VALID';
}

function credentialSummary(documents: any[] = []) {
  const mapped = documents.map((doc) => ({
    status: doc.status,
    type: doc.type,
    expiryState: expiryState(doc.expiresAt, doc.status),
  }));
  const requiredTypes = ['LICENSE', 'ID_DOCUMENT', 'INSURANCE'];
  return {
    total: mapped.length,
    verified: mapped.filter((d) => d.status === 'VERIFIED').length,
    uploaded: mapped.filter((d) => d.status === 'UPLOADED').length,
    rejected: mapped.filter((d) => d.status === 'REJECTED').length,
    expired: mapped.filter((d) => d.expiryState === 'EXPIRED').length,
    expiringSoon: mapped.filter((d) => d.expiryState === 'EXPIRING_SOON').length,
    missingRequiredTypes: requiredTypes.filter(
      (type) => !mapped.some((d) => d.type === type && d.status === 'VERIFIED'),
    ),
  };
}

function mapCredentialDocumentForList(doc: any) {
  const computedExpiryState = expiryState(doc.expiresAt, doc.status);
  return {
    id: doc.id,
    type: doc.type,
    title: doc.title,
    status: computedExpiryState === 'EXPIRED' && doc.status === 'VERIFIED' ? 'EXPIRED' : doc.status,
    expiryState: computedExpiryState,
    expiresAt: doc.expiresAt ?? null,
    verifiedAt: doc.verifiedAt ?? null,
    verifiedByName: doc.verifiedBy
      ? `${doc.verifiedBy.firstName} ${doc.verifiedBy.lastName}`.trim()
      : null,
  };
}

function mapCredentialDocumentFull(doc: any) {
  const computedExpiryState = expiryState(doc.expiresAt, doc.status);
  return {
    id: doc.id,
    providerId: doc.providerId,
    type: doc.type,
    title: doc.title,
    status: computedExpiryState === 'EXPIRED' && doc.status === 'VERIFIED' ? 'EXPIRED' : doc.status,
    storedStatus: doc.status,
    documentUrl: doc.documentUrl ?? null,
    fileName: doc.fileName ?? null,
    referenceNumber: doc.referenceNumber ?? null,
    issuedAt: doc.issuedAt ?? null,
    expiresAt: doc.expiresAt ?? null,
    expiryState: computedExpiryState,
    rejectionReason: doc.rejectionReason ?? null,
    verifiedAt: doc.verifiedAt ?? null,
    verifiedByName: doc.verifiedBy
      ? `${doc.verifiedBy.firstName} ${doc.verifiedBy.lastName}`.trim()
      : null,
    notes: doc.notes ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function mapReviewTask(task: any) {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueAt: task.dueAt ?? null,
    assignedToName: task.assignedTo
      ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}`.trim()
      : null,
    documentId: task.documentId ?? null,
    documentType: task.document?.type ?? null,
    documentTitle: task.document?.title ?? null,
    completedAt: task.completedAt ?? null,
    createdAt: task.createdAt,
  };
}

function mapOnboardingHistory(state: any) {
  if (!state) {
    return {
      status: ProviderOnboardingStatus.DRAFT,
      checklist: [],
      submittedAt: null,
      reviewedAt: null,
      decisionNote: null,
      lastAction: null,
      lastActorId: null,
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
    lastActorId: state.lastActorId ?? null,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
  };
}

function mapProviderListItem(profile: any) {
  return {
    id: profile.id,
    userId: profile.userId,
    name: `${profile.user.firstName} ${profile.user.lastName}`.trim(),
    firstName: profile.user.firstName,
    lastName: profile.user.lastName,
    email: profile.user.email,
    role: profile.roleCatalog?.code ?? profile.user.role,
    roleLabel: profile.roleCatalog?.label ?? profile.user.role,
    specialty: profile.specialty ?? null,
    licenseNumber: profile.licenseNumber ?? null,
    organizationId: profile.organizationId,
    organizationName: profile.organization?.name ?? null,
    status: profile.user.status ?? AccountStatus.ACTIVE,
    onboardingStatus: profile.onboardingState?.status ?? ProviderOnboardingStatus.DRAFT,
    credentialSummary: credentialSummary(profile.credentialDocuments ?? []),
    createdAt: profile.user.createdAt,
  };
}

function mapProviderDetail(profile: any) {
  const documents = Array.isArray(profile.credentialDocuments)
    ? profile.credentialDocuments
    : [];
  const reviewTasks = Array.isArray(profile.credentialReviewTasks)
    ? profile.credentialReviewTasks
    : [];

  return {
    id: profile.id,
    userId: profile.userId,
    name: `${profile.user.firstName} ${profile.user.lastName}`.trim(),
    firstName: profile.user.firstName,
    lastName: profile.user.lastName,
    email: profile.user.email,
    role: profile.roleCatalog?.code ?? profile.user.role,
    roleLabel: profile.roleCatalog?.label ?? profile.user.role,
    systemRole: profile.user.role,
    roleCatalogId: profile.roleCatalogId ?? null,
    specialty: profile.specialty ?? null,
    licenseNumber: profile.licenseNumber ?? null,
    services: Array.isArray(profile.services) ? profile.services : [],
    organizationId: profile.organizationId,
    organizationName: profile.organization?.name ?? null,
    status: profile.user.status ?? AccountStatus.ACTIVE,
    deactivatedAt: profile.user.deactivatedAt ?? null,
    onboardingStatus: profile.onboardingState?.status ?? ProviderOnboardingStatus.DRAFT,
    onboarding: mapOnboardingHistory(profile.onboardingState),
    credentialDocuments: documents.map(mapCredentialDocumentFull),
    credentialSummary: credentialSummary(documents),
    reviewTasks: reviewTasks.map(mapReviewTask),
    createdAt: profile.user.createdAt,
    updatedAt: profile.user.updatedAt,
  };
}

async function safeWriteAuditLog(input: Parameters<typeof writeAuditLog>[0]) {
  try {
    await writeAuditLog(input);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[provider-iam] Audit logging failed:', error);
    }
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const providerIamRouter = Router();

// Apply IAM middleware chain: auth → RBAC → org-scope
// Company_Admin, Company_Support, Super_Admin can access these endpoints
const allowedRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT'];
providerIamRouter.use(...iamMiddlewareChain(allowedRoles));

// ---------------------------------------------------------------------------
// GET / — Paginated provider list
// Requirements: 3.1, 3.6
// ---------------------------------------------------------------------------
providerIamRouter.get('/', async (req: Request, res: Response) => {
  const page = parsePage(req.query.page);
  const pageSize = parsePageSize(req.query.pageSize);
  const q = clean(req.query.q).toLowerCase();
  const statusFilter = clean(req.query.status).toUpperCase();
  const onboardingFilter = clean(req.query.onboardingStatus).toUpperCase();

  // Build where clause with org scoping
  const where: any = {};

  // Organization-scoped access for Company_Admin
  if (req.orgFilter) {
    where.organizationId = req.orgFilter.organizationId;
  }

  // Status filter
  if (accountStatuses.includes(statusFilter as AccountStatus)) {
    where.user = { is: { status: statusFilter } };
  }

  // Onboarding status filter
  if (onboardingFilter && Object.values(ProviderOnboardingStatus).includes(onboardingFilter as any)) {
    where.onboardingState = { is: { status: onboardingFilter } };
  }

  // Text search filter across name, email, specialty, license
  if (q) {
    where.OR = [
      { user: { firstName: { contains: q, mode: 'insensitive' } } },
      { user: { lastName: { contains: q, mode: 'insensitive' } } },
      { user: { email: { contains: q, mode: 'insensitive' } } },
      { specialty: { contains: q, mode: 'insensitive' } },
      { licenseNumber: { contains: q, mode: 'insensitive' } },
    ];
  }

  // Count total matching records
  const totalCount = await prisma.providerProfile.count({ where });

  // Fetch paginated results
  const skip = (page - 1) * pageSize;
  const profiles = await prisma.providerProfile.findMany({
    where,
    include: {
      organization: { select: { name: true } },
      user: true,
      roleCatalog: true,
      onboardingState: true,
      credentialDocuments: {
        select: { id: true, type: true, status: true, expiresAt: true },
      },
    },
    orderBy: { user: { createdAt: 'desc' } },
    skip,
    take: pageSize,
  });

  const items = profiles.map(mapProviderListItem);
  const totalPages = Math.ceil(totalCount / pageSize);

  res.json({
    items,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  });
});

// ---------------------------------------------------------------------------
// GET /:id — Provider detail
// Requirements: 3.2, 3.6
// ---------------------------------------------------------------------------
providerIamRouter.get('/:id', async (req: Request, res: Response) => {
  const profile = await prisma.providerProfile.findUnique({
    where: { id: req.params.id },
    include: {
      organization: { select: { name: true } },
      user: true,
      roleCatalog: true,
      onboardingState: true,
      credentialDocuments: {
        include: { verifiedBy: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
      },
      credentialReviewTasks: {
        where: { status: { in: activeCredentialReviewTaskStatuses } },
        include: {
          assignedTo: { select: { firstName: true, lastName: true } },
          document: { select: { id: true, type: true, title: true } },
        },
        orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
        take: 20,
      },
    },
  });

  if (!profile) {
    throw notFound('Provider not found');
  }

  // Organization boundary enforcement for Company_Admin
  if (req.orgFilter && profile.organizationId !== req.orgFilter.organizationId) {
    throw forbidden('Requested provider is outside your organization scope');
  }

  res.json({ item: mapProviderDetail(profile) });
});

// ---------------------------------------------------------------------------
// POST / — Create provider (User + ProviderProfile + DRAFT onboarding)
// Requirements: 3.3, 3.4, 3.6
// ---------------------------------------------------------------------------
providerIamRouter.post('/', async (req: Request, res: Response) => {
  const email = normalizeEmail(req.body?.email);
  const firstName = clean(req.body?.firstName);
  const lastName = clean(req.body?.lastName);

  if (!email || !firstName || !lastName) {
    throw badRequest('email, firstName, and lastName are required');
  }

  // Validate email format
  if (!email.includes('@') || !email.includes('.')) {
    throw badRequest('A valid email address is required');
  }

  // Check email uniqueness
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existingUser) {
    throw badRequest('Email is already used by another account');
  }

  // Determine organization
  let organizationId: string;
  if (req.orgFilter) {
    // Company_Admin: always create within own org
    organizationId = req.orgFilter.organizationId;
  } else {
    // Super_Admin: use specified org or fail
    const requestedOrgId = clean(req.body?.organizationId);
    if (!requestedOrgId) {
      throw badRequest('organizationId is required for Super_Admin provider creation');
    }
    const org = await prisma.organization.findUnique({
      where: { id: requestedOrgId },
      select: { id: true },
    });
    if (!org) {
      throw badRequest('Selected organization was not found');
    }
    organizationId = requestedOrgId;
  }

  // Resolve provider role
  const roleInput = clean(req.body?.role).toUpperCase() || 'PROVIDER';
  const systemRole = providerSystemRoles.includes(roleInput as UserRole)
    ? (roleInput as UserRole)
    : UserRole.PROVIDER;

  // Resolve role catalog entry
  let roleCatalogId: string | null = null;
  const catalogEntry = await prisma.providerRoleCatalog.findFirst({
    where: { code: systemRole, isActive: true },
    select: { id: true },
  });
  if (catalogEntry) {
    roleCatalogId = catalogEntry.id;
  }

  const passwordHash = await bcrypt.hash(
    clean(req.body?.password) || 'ChangeMe123!',
    10,
  );

  let createdProfile: any;
  try {
    createdProfile = await prisma.$transaction(async (tx) => {
      // Create User
      const user = await tx.user.create({
        data: {
          email,
          firstName,
          lastName,
          role: systemRole,
          organizationId,
          passwordHash,
          status: AccountStatus.ACTIVE,
        },
      });

      // Create ProviderProfile
      const profile = await tx.providerProfile.create({
        data: {
          userId: user.id,
          organizationId,
          specialty: clean(req.body?.specialty) || null,
          licenseNumber: clean(req.body?.licenseNumber) || null,
          services: Array.isArray(req.body?.services)
            ? req.body.services
            : req.body?.services
              ? [req.body.services]
              : [],
          roleCatalogId,
        },
      });

      // Initialize onboarding state as DRAFT
      await tx.providerOnboardingState.create({
        data: {
          providerId: profile.id,
          organizationId,
          status: ProviderOnboardingStatus.DRAFT,
          checklist: [],
          lastAction: 'admin.provider.onboarding_initialized',
          lastActorId: req.user?.userId ?? null,
        },
      });

      // Return full profile for response
      return tx.providerProfile.findUniqueOrThrow({
        where: { id: profile.id },
        include: {
          organization: { select: { name: true } },
          user: true,
          roleCatalog: true,
          onboardingState: true,
          credentialDocuments: {
            include: { verifiedBy: { select: { firstName: true, lastName: true } } },
            orderBy: { createdAt: 'desc' },
          },
          credentialReviewTasks: {
            where: { status: { in: activeCredentialReviewTaskStatuses } },
            include: {
              assignedTo: { select: { firstName: true, lastName: true } },
              document: { select: { id: true, type: true, title: true } },
            },
            orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
            take: 20,
          },
        },
      });
    });
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw badRequest('Email is already used by another account');
      }
      if (error.code === 'P2003') {
        throw badRequest(
          'Provider creation failed because a referenced record was not found',
        );
      }
    }
    throw error;
  }

  // Write audit log
  await safeWriteAuditLog({
    actorId: req.user?.userId,
    organizationId,
    action: 'admin.provider.created',
    resource: 'provider_profile',
    resourceId: createdProfile.id,
    details: { email, role: systemRole, method: 'iam' },
  });

  res.status(201).json({ item: mapProviderDetail(createdProfile) });
});

// ---------------------------------------------------------------------------
// PATCH /:id/onboarding — Transition onboarding status
// Requirements: 3.5, 3.8
// ---------------------------------------------------------------------------
providerIamRouter.patch('/:id/onboarding', async (req: Request, res: Response) => {
  const providerId = req.params.id;
  const status = String(req.body?.status ?? '').trim().toUpperCase();
  const decisionNote = String(req.body?.decisionNote ?? '').trim();

  if (!status) {
    throw badRequest('status is required');
  }

  // Validate status is a known onboarding status value
  const validStatuses = Object.values(OnboardingStatus);
  if (!validStatuses.includes(status as OnboardingStatus)) {
    throw badRequest(`Unknown onboarding status: ${status}`);
  }

  // Verify the provider exists and enforce org scope
  const profile = await prisma.providerProfile.findUnique({
    where: { id: providerId },
    select: { id: true, organizationId: true },
  });

  if (!profile) {
    throw notFound('Provider not found');
  }

  // Organization boundary enforcement for Company_Admin
  if (req.orgFilter && profile.organizationId !== req.orgFilter.organizationId) {
    throw forbidden('Requested provider is outside your organization scope');
  }

  // Perform the state machine transition
  const result = await transitionOnboardingStatus(providerId, status as OnboardingStatus, {
    note: decisionNote || undefined,
    actorId: req.user!.userId,
  });

  // Write audit entry
  await safeWriteAuditLog({
    actorId: req.user?.userId,
    organizationId: profile.organizationId,
    action: `admin.provider.onboarding_${status.toLowerCase()}`,
    resource: 'provider_onboarding_state',
    resourceId: result.id,
    details: {
      providerId,
      fromStatus: undefined, // The transition function already validated
      toStatus: status,
      decisionNote: decisionNote || null,
    },
  });

  res.json({ item: result });
});

export default providerIamRouter;
