import { z } from 'zod';

/**
 * Zod validation schemas for the IAM module.
 *
 * These schemas are used by route handlers via the `validateBody()` middleware
 * to enforce request payload constraints before reaching service logic.
 */

// ---------------------------------------------------------------------------
// Invitation creation
// ---------------------------------------------------------------------------

export const createInvitationSchema = z.object({
  email: z.string().email(),
  role: z.enum([
    'COMPANY_ADMIN',
    'COMPANY_SUPPORT',
    'PROVIDER',
    'NURSE',
    'PHARMACIST',
    'LAB_TECH',
    'FINANCE',
  ]),
  expiresInHours: z.number().min(1).max(720).optional().default(72),
});

// ---------------------------------------------------------------------------
// Appointment creation
// ---------------------------------------------------------------------------

export const createAppointmentSchema = z.object({
  patientId: z.string().min(1),
  service: z.string().min(1),
  location: z.string().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

// ---------------------------------------------------------------------------
// Schedule template creation
// ---------------------------------------------------------------------------

export const createTemplateSchema = z.object({
  name: z.string().min(2),
  dayPatterns: z
    .array(
      z.object({
        dayOfWeek: z.number().min(0).max(6),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
      }),
    )
    .min(1),
  serviceType: z.string().min(1),
  location: z.string().min(1),
  serviceModes: z.array(z.string()).min(1),
  duration: z.number().min(1).max(480),
  buffer: z.number().min(0).max(120).default(0),
  capacity: z.number().min(1).max(20).default(1),
});

// ---------------------------------------------------------------------------
// Time-off block creation
// ---------------------------------------------------------------------------

export const createTimeOffSchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  reason: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Role change
// ---------------------------------------------------------------------------

export const changeRoleSchema = z.object({
  role: z.enum([
    'SUPER_ADMIN',
    'COMPANY_ADMIN',
    'COMPANY_SUPPORT',
    'PROVIDER',
    'NURSE',
    'PHARMACIST',
    'LAB_TECH',
    'FINANCE',
    'PATIENT',
  ]),
  reason: z.string().min(1).max(500),
});

// ---------------------------------------------------------------------------
// User creation
// ---------------------------------------------------------------------------

export const createUserSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  role: z.enum([
    'SUPER_ADMIN',
    'COMPANY_ADMIN',
    'COMPANY_SUPPORT',
    'PROVIDER',
    'NURSE',
    'PHARMACIST',
    'LAB_TECH',
    'FINANCE',
    'PATIENT',
  ]),
  organizationId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Appointment cancellation
// ---------------------------------------------------------------------------

export const cancelAppointmentSchema = z.object({
  reason: z.string().min(1).max(500),
});

// ---------------------------------------------------------------------------
// Audit export
// ---------------------------------------------------------------------------

export const auditExportSchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
  purpose: z.string().min(1),
});
