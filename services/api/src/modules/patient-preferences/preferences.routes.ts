import { Router } from 'express';
import { z } from 'zod';
import { localeCodeSchema } from '@care-center/contracts';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { badRequest } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { getPatientContext } from '../../lib/patient-context';
import { writeAuditLog } from '../../lib/audit';

export const patientPreferencesRouter = Router();
const allowedRoles = ['PATIENT'];

const preferencesSchema = z.object({
  locale: localeCodeSchema.optional(),
  timezone: z.string().trim().min(2).max(80).optional(),
  notifications: z.object({
    push: z.boolean().optional(),
    sms: z.boolean().optional(),
    email: z.boolean().optional(),
  }).partial().optional(),
});

patientPreferencesRouter.use(requireAuth);
patientPreferencesRouter.use(allowRoles(allowedRoles));

patientPreferencesRouter.get('/', async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId);
  const profile = await prisma.patientProfile.findUnique({ where: { id: context.patientProfileId } });
  if (!profile) throw badRequest('Patient profile is required');
  const preferences = profile.preferences && typeof profile.preferences === 'object' ? profile.preferences : {};
  res.json({
    preferences: {
      locale: (preferences as any).locale ?? req.locale ?? 'en',
      timezone: (preferences as any).timezone ?? 'Asia/Riyadh',
      notifications: (preferences as any).notifications ?? { push: true, sms: true, email: false },
    },
  });
});

patientPreferencesRouter.patch('/', validateBody(preferencesSchema), async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId);
  const profile = await prisma.patientProfile.findUnique({ where: { id: context.patientProfileId } });
  if (!profile) throw badRequest('Patient profile is required');
  const existing = profile.preferences && typeof profile.preferences === 'object' ? (profile.preferences as Record<string, unknown>) : {};
  const nextPreferences = {
    ...existing,
    ...req.body,
    notifications: {
      ...(typeof existing.notifications === 'object' && existing.notifications ? (existing.notifications as Record<string, unknown>) : {}),
      ...(req.body.notifications ?? {}),
    },
  };
  await prisma.patientProfile.update({
    where: { id: context.patientProfileId },
    data: { preferences: nextPreferences as any },
  });
  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId: context.organizationId,
    action: 'patient.preferences_updated',
    resource: 'patient_profile',
    resourceId: context.patientProfileId,
    details: { preferences: nextPreferences },
  });
  res.json({ preferences: nextPreferences });
});
