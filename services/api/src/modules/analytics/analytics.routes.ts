import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { badRequest } from '../../lib/http';
import { actionVerbPattern, logScreenEvent, screenIdPattern, summarizeScreenEvents } from '../../lib/analytics';

export const analyticsRouter = Router();
const readRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'PROVIDER', 'NURSE', 'FINANCE', 'PATIENT'];
const summaryRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT'];

const analyticsEventSchema = z.object({
  screenId: z.string().regex(screenIdPattern, 'screenId must match P-xx, PR-xx, or A-xx'),
  action: z.string().regex(actionVerbPattern, 'action must be a stable snake_case verb'),
  outcome: z.string().trim().min(2).max(60).optional().nullable(),
  targetId: z.string().trim().min(1).max(160).optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
});

analyticsRouter.use(requireAuth);
analyticsRouter.use(allowRoles(readRoles));

analyticsRouter.post('/events', validateBody(analyticsEventSchema), async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');

  await logScreenEvent({
    actorId: req.user?.userId,
    organizationId,
    screenId: req.body.screenId,
    action: req.body.action,
    outcome: req.body.outcome ?? null,
    targetId: req.body.targetId ?? null,
    metadata: req.body.metadata ?? null,
  });

  res.status(202).json({ accepted: true, requestId: req.requestId ?? null });
});

analyticsRouter.get('/events/summary', allowRoles(summaryRoles), async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const screenId = String(req.query.screenId ?? '').trim();
  const sinceDays = Number(req.query.sinceDays ?? 30);
  const since = Number.isFinite(sinceDays) && sinceDays > 0 ? new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000) : null;
  const summary = await summarizeScreenEvents(organizationId, {
    since,
    screenId: screenId || null,
  });
  res.json({ summary, requestId: req.requestId ?? null });
});
