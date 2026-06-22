import { z } from 'zod';

const roleSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[A-Z0-9_]+$/, 'Role must be an uppercase enum value.');

const statusSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[A-Z0-9_]+$/, 'Status must be an uppercase enum value.');

const optionalNameSchema = z
  .string()
  .trim()
  .max(120)
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

export const createAccountPhase30Schema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  firstName: optionalNameSchema,
  lastName: optionalNameSchema,
  role: roleSchema,
  status: statusSchema.default('ACTIVE'),
  organizationId: z.string().trim().min(1).max(128).optional(),
  phone: z.string().trim().max(40).optional(),
  locale: z.string().trim().max(16).optional(),
});

export const updateAccountPhase30Schema = z
  .object({
    email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()).optional(),
    firstName: optionalNameSchema,
    lastName: optionalNameSchema,
    role: roleSchema.optional(),
    status: statusSchema.optional(),
    organizationId: z.string().trim().min(1).max(128).optional(),
    phone: z.string().trim().max(40).optional().nullable(),
    locale: z.string().trim().max(16).optional().nullable(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export const accountStatusReasonPhase30Schema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export type CreateAccountPhase30Input = z.infer<typeof createAccountPhase30Schema>;
export type UpdateAccountPhase30Input = z.infer<typeof updateAccountPhase30Schema>;
export type AccountStatusReasonPhase30Input = z.infer<typeof accountStatusReasonPhase30Schema>;

export function parsePhase30Body<T>(schema: z.ZodSchema<T>, body: unknown): { ok: true; data: T } | { ok: false; error: unknown } {
  const parsed = schema.safeParse(body);
  if (!parsed.success) return { ok: false, error: parsed.error.flatten() };
  return { ok: true, data: parsed.data };
}
