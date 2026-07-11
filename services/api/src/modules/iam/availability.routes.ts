import { Router } from 'express';
import { iamMiddlewareChain } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { createTemplateSchema, createTimeOffSchema } from './schemas';
import { prisma } from '../../lib/prisma';
import { forbidden } from '../../lib/http';
import {
  createTemplate,
  publishTemplate,
  createTimeOff,
  updatePublishedTemplate,
} from './availability.service';

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const availabilityRouter = Router();

// Roles allowed to manage availability
const availabilityRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'PROVIDER'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Provider role enforcement: if the authenticated user is a PROVIDER,
 * they can only manage their own availability. Resolves the provider profile
 * from the user's userId and compares against the :providerId param.
 *
 * Requirements: 5.5
 */
async function enforceProviderAccess(
  userId: string,
  role: string,
  providerId: string,
): Promise<void> {
  if (role !== 'PROVIDER') return;

  const providerProfile = await prisma.providerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!providerProfile || providerProfile.id !== providerId) {
    throw forbidden('Providers can only access their own availability');
  }
}

// ---------------------------------------------------------------------------
// GET /api/iam/availability/:providerId/templates
// List schedule templates for a provider (org-scoped)
// Requirements: 5.1
// ---------------------------------------------------------------------------
availabilityRouter.get(
  '/:providerId/templates',
  ...iamMiddlewareChain(availabilityRoles),
  async (req, res, next) => {
    try {
      const { providerId } = req.params;

      // Provider role enforcement
      await enforceProviderAccess(req.user!.userId, req.user!.role, providerId);

      // Build query filter
      const where: Record<string, unknown> = { providerId };

      // Org-scope filter (non-SUPER_ADMIN)
      if (req.orgFilter) {
        where.organizationId = req.orgFilter.organizationId;
      }

      const templates = await prisma.providerScheduleTemplate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      res.json({ data: templates });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/iam/availability/:providerId/templates
// Create a new schedule template
// Requirements: 5.2, 5.9
// ---------------------------------------------------------------------------
availabilityRouter.post(
  '/:providerId/templates',
  ...iamMiddlewareChain(availabilityRoles),
  validateBody(createTemplateSchema),
  async (req, res, next) => {
    try {
      const { providerId } = req.params;

      // Provider role enforcement
      await enforceProviderAccess(req.user!.userId, req.user!.role, providerId);

      // Determine organizationId from org-scope or user context
      const organizationId =
        req.orgFilter?.organizationId ?? req.user!.organizationId;

      const template = await createTemplate({
        name: req.body.name,
        providerId,
        organizationId: organizationId!,
        dayPatterns: req.body.dayPatterns,
        serviceType: req.body.serviceType,
        location: req.body.location,
        serviceModes: req.body.serviceModes,
        duration: req.body.duration,
        buffer: req.body.buffer,
        capacity: req.body.capacity,
      });

      res.status(201).json(template);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /api/iam/availability/templates/:id
// Update a schedule template (regenerates slots if published)
// Requirements: 5.8
// ---------------------------------------------------------------------------
availabilityRouter.patch(
  '/templates/:id',
  ...iamMiddlewareChain(availabilityRoles),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      // Fetch the template to verify ownership/org access
      const template = await prisma.providerScheduleTemplate.findUnique({
        where: { id },
        select: { providerId: true, organizationId: true },
      });

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // Provider role enforcement against the template's providerId
      if (template.providerId) {
        await enforceProviderAccess(req.user!.userId, req.user!.role, template.providerId);
      }

      // Org-scope enforcement
      if (req.orgFilter && template.organizationId !== req.orgFilter.organizationId) {
        throw forbidden('Template is outside your organization scope');
      }

      const result = await updatePublishedTemplate(id, req.body, req.user!.userId);

      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/iam/availability/templates/:id/publish
// Publish a schedule template (generates slots for 21-day horizon)
// Requirements: 5.3, 5.10
// ---------------------------------------------------------------------------
availabilityRouter.post(
  '/templates/:id/publish',
  ...iamMiddlewareChain(availabilityRoles),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      // Fetch the template to verify ownership/org access
      const template = await prisma.providerScheduleTemplate.findUnique({
        where: { id },
        select: { providerId: true, organizationId: true },
      });

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // Provider role enforcement against the template's providerId
      if (template.providerId) {
        await enforceProviderAccess(req.user!.userId, req.user!.role, template.providerId);
      }

      // Org-scope enforcement
      if (req.orgFilter && template.organizationId !== req.orgFilter.organizationId) {
        throw forbidden('Template is outside your organization scope');
      }

      const result = await publishTemplate(id, req.user!.userId);

      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/iam/availability/:providerId/time-off
// Create a time-off block (removes overlapping available slots)
// Requirements: 5.4, 5.10
// ---------------------------------------------------------------------------
availabilityRouter.post(
  '/:providerId/time-off',
  ...iamMiddlewareChain(availabilityRoles),
  validateBody(createTimeOffSchema),
  async (req, res, next) => {
    try {
      const { providerId } = req.params;

      // Provider role enforcement
      await enforceProviderAccess(req.user!.userId, req.user!.role, providerId);

      // Determine organizationId from org-scope or user context
      const organizationId =
        req.orgFilter?.organizationId ?? req.user!.organizationId;

      const result = await createTimeOff({
        providerId,
        organizationId: organizationId!,
        startsAt: new Date(req.body.startsAt),
        endsAt: new Date(req.body.endsAt),
        reason: req.body.reason,
        actorId: req.user!.userId,
      });

      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/iam/availability/:providerId/slots
// List published slots for a provider (org-scoped, optional date range)
// Requirements: 5.1, 5.7
// ---------------------------------------------------------------------------
availabilityRouter.get(
  '/:providerId/slots',
  ...iamMiddlewareChain(availabilityRoles),
  async (req, res, next) => {
    try {
      const { providerId } = req.params;

      // Provider role enforcement
      await enforceProviderAccess(req.user!.userId, req.user!.role, providerId);

      // Build query filter
      const where: Record<string, unknown> = { providerId };

      // Org-scope filter (non-SUPER_ADMIN)
      if (req.orgFilter) {
        where.organizationId = req.orgFilter.organizationId;
      }

      // Optional date range filters
      const { from, to } = req.query;
      if (from || to) {
        const startsAtFilter: Record<string, Date> = {};
        if (from) startsAtFilter.gte = new Date(String(from));
        if (to) startsAtFilter.lte = new Date(String(to));
        where.startsAt = startsAtFilter;
      }

      const slots = await prisma.publishedSlot.findMany({
        where,
        orderBy: { startsAt: 'asc' },
      });

      res.json({ data: slots });
    } catch (err) {
      next(err);
    }
  },
);
