import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma';
import { writeAuditLog } from '../../lib/audit';
import { badRequest, forbidden } from '../../lib/http';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateInvitationInput {
  email: string;
  role: string;
  organizationId: string;
  expiresInHours?: number;
  actorId: string;
  actorRole: string;
}

interface AcceptInvitationInput {
  token: string;
  firstName: string;
  lastName: string;
  password: string;
}

interface RevokeInvitationInput {
  invitationId: string;
  actorId: string;
  organizationId?: string;
}

interface ListInvitationsInput {
  organizationId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Non-blocking audit write that won't fail the primary operation.
 */
async function safeWriteAuditLog(input: Parameters<typeof writeAuditLog>[0]) {
  try {
    await writeAuditLog(input);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[invitation.service] Audit logging failed:', error);
    }
  }
}

/**
 * Generate a cryptographically secure token (32 bytes, hex-encoded).
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a token using SHA-256 for storage (not bcrypt — tokens are high-entropy).
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ---------------------------------------------------------------------------
// Service Methods
// ---------------------------------------------------------------------------

/**
 * Create a new invitation.
 *
 * - Generates a 32-byte crypto token, stores SHA-256 hash (not plaintext)
 * - Validates email doesn't belong to an active user
 * - Validates Company_Admin cannot assign SUPER_ADMIN role
 * - Writes audit entry for invitation creation
 *
 * Requirements: 6.1, 6.2, 6.10, 6.11, 6.12
 */
export async function createInvitation(input: CreateInvitationInput) {
  const { email, role, organizationId, expiresInHours = 72, actorId, actorRole } = input;

  // Company_Admin cannot assign SUPER_ADMIN role (Requirement 6.11)
  if (actorRole === 'COMPANY_ADMIN' && role === 'SUPER_ADMIN') {
    throw forbidden('Company administrators cannot assign the SUPER_ADMIN role');
  }

  // Validate email doesn't belong to an active user (Requirement 6.10)
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (existingUser && existingUser.status === 'ACTIVE') {
    throw badRequest('A user with this email address already exists and is active');
  }

  // Generate secure token (Requirement 6.1)
  const token = generateToken();
  const tokenHash = hashToken(token);

  // Calculate expiration (default 72h, bounded 1-720h per schema)
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  // Create invitation record
  const invitation = await prisma.invitation.create({
    data: {
      organizationId,
      email: email.toLowerCase().trim(),
      role,
      tokenHash,
      status: 'PENDING',
      expiresAt,
      createdById: actorId,
    },
  });

  // Write audit entry (Requirement 6.12)
  await safeWriteAuditLog({
    actorId,
    organizationId,
    action: 'invitation.created',
    resource: 'invitation',
    resourceId: invitation.id,
    details: {
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt.toISOString(),
    },
  });

  return {
    id: invitation.id,
    token,
    email: invitation.email,
    role: invitation.role,
    organizationId: invitation.organizationId,
    expiresAt: invitation.expiresAt,
    status: invitation.status,
    createdAt: invitation.createdAt,
  };
}

/**
 * Accept an invitation by consuming the token.
 *
 * - Validates token has not expired, has not been consumed, has not been revoked
 * - Creates user with the pre-configured role and organization
 * - Marks invitation as ACCEPTED
 * - Writes audit entry
 *
 * Requirements: 6.3, 6.4, 6.5, 6.6, 6.12
 */
export async function acceptInvitation(input: AcceptInvitationInput) {
  const { token, firstName, lastName, password } = input;

  const tokenHash = hashToken(token);

  // Find invitation by token hash
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash },
  });

  if (!invitation) {
    throw badRequest('Invalid invitation token');
  }

  // Check if already consumed (Requirement 6.6)
  if (invitation.status === 'ACCEPTED') {
    throw badRequest('This invitation has already been used');
  }

  // Check if revoked (Requirement 6.9)
  if (invitation.status === 'REVOKED') {
    throw badRequest('This invitation has been revoked');
  }

  // Check if expired (Requirement 6.5)
  if (invitation.status === 'EXPIRED' || new Date() > invitation.expiresAt) {
    // Mark as expired if not already
    if (invitation.status !== 'EXPIRED') {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });

      await safeWriteAuditLog({
        actorId: undefined,
        organizationId: invitation.organizationId,
        action: 'invitation.expired',
        resource: 'invitation',
        resourceId: invitation.id,
        details: {
          email: invitation.email,
          role: invitation.role,
          expiredAt: invitation.expiresAt.toISOString(),
        },
      });
    }
    throw badRequest(
      'This invitation has expired. Please ask the administrator to send a new invitation.',
    );
  }

  // Hash password using bcrypt (following existing auth patterns)
  const passwordHash = await bcrypt.hash(password, 10);

  // Create user with pre-configured role and organization (Requirement 6.4)
  const user = await prisma.user.create({
    data: {
      email: invitation.email,
      passwordHash,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role: invitation.role,
      organizationId: invitation.organizationId,
    },
  });

  // Create provider profile if role requires it
  if (['PROVIDER', 'NURSE', 'PHARMACIST', 'LAB_TECH'].includes(invitation.role)) {
    await prisma.providerProfile.create({
      data: {
        userId: user.id,
        organizationId: invitation.organizationId,
        specialty: null,
        licenseNumber: null,
        services: [],
      },
    });
  }

  // Create patient profile if role is PATIENT
  if (invitation.role === 'PATIENT') {
    await prisma.patientProfile.create({
      data: {
        userId: user.id,
        organizationId: invitation.organizationId,
        preferences: {},
      },
    });
  }

  // Mark invitation as ACCEPTED
  const updatedInvitation = await prisma.invitation.update({
    where: { id: invitation.id },
    data: {
      status: 'ACCEPTED',
      acceptedAt: new Date(),
      consumedById: user.id,
    },
  });

  // Write audit entry (Requirement 6.12)
  await safeWriteAuditLog({
    actorId: user.id,
    organizationId: invitation.organizationId,
    action: 'invitation.accepted',
    resource: 'invitation',
    resourceId: invitation.id,
    details: {
      email: invitation.email,
      role: invitation.role,
      userId: user.id,
    },
  });

  return {
    id: updatedInvitation.id,
    email: updatedInvitation.email,
    role: updatedInvitation.role,
    status: updatedInvitation.status,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      organizationId: user.organizationId,
    },
  };
}

/**
 * Revoke a pending invitation.
 *
 * - Marks the invitation as REVOKED, preventing future acceptance
 * - Writes audit entry
 *
 * Requirements: 6.9, 6.12
 */
export async function revokeInvitation(input: RevokeInvitationInput) {
  const { invitationId, actorId, organizationId } = input;

  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
  });

  if (!invitation) {
    throw badRequest('Invitation not found');
  }

  // Only PENDING invitations can be revoked
  if (invitation.status !== 'PENDING') {
    throw badRequest(
      `Cannot revoke an invitation with status ${invitation.status}. Only PENDING invitations can be revoked.`,
    );
  }

  // Org-boundary check for non-SUPER_ADMIN
  if (organizationId && invitation.organizationId !== organizationId) {
    throw forbidden('Organization boundary violation');
  }

  const updated = await prisma.invitation.update({
    where: { id: invitationId },
    data: {
      status: 'REVOKED',
      revokedAt: new Date(),
    },
  });

  // Write audit entry (Requirement 6.12)
  await safeWriteAuditLog({
    actorId,
    organizationId: invitation.organizationId,
    action: 'invitation.revoked',
    resource: 'invitation',
    resourceId: invitation.id,
    details: {
      email: invitation.email,
      role: invitation.role,
      revokedBy: actorId,
    },
  });

  return {
    id: updated.id,
    email: updated.email,
    role: updated.role,
    status: updated.status,
    revokedAt: updated.revokedAt,
  };
}

/**
 * List invitations with org-scoped filtering and status display.
 *
 * - Super_Admin sees all invitations across all organizations
 * - Company_Admin sees only invitations belonging to their organization
 *
 * Requirements: 6.7, 6.8
 */
export async function listInvitations(input: ListInvitationsInput) {
  const { organizationId, status, page = 1, limit = 20 } = input;

  const where: Record<string, unknown> = {};

  // Org-scoped filtering
  if (organizationId) {
    where.organizationId = organizationId;
  }

  // Status filtering
  if (status) {
    where.status = status;
  }

  const skip = (page - 1) * limit;

  const [invitations, total] = await Promise.all([
    prisma.invitation.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        consumedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.invitation.count({ where }),
  ]);

  return {
    items: invitations.map((inv: any) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      status: inv.status,
      organizationId: inv.organizationId,
      organizationName: inv.organization?.name ?? null,
      expiresAt: inv.expiresAt,
      acceptedAt: inv.acceptedAt,
      revokedAt: inv.revokedAt,
      createdAt: inv.createdAt,
      createdBy: inv.createdBy
        ? {
            id: inv.createdBy.id,
            email: inv.createdBy.email,
            name: `${inv.createdBy.firstName} ${inv.createdBy.lastName}`.trim(),
          }
        : null,
      consumedBy: inv.consumedBy
        ? {
            id: inv.consumedBy.id,
            email: inv.consumedBy.email,
            name: `${inv.consumedBy.firstName} ${inv.consumedBy.lastName}`.trim(),
          }
        : null,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
