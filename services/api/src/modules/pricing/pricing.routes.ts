import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { badRequest } from '../../lib/http';
import { getConfigStorageMode, getConfigItem, listConfigItems, summarizeConfigItems, transitionConfigItem, upsertConfigItem } from '../../lib/admin-config-store';

export const pricingRouter = Router();
const readRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'FINANCE'];
const writeRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'FINANCE'];

const pricingBaseSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(2),
  name: z.string().min(2),
  serviceCode: z.string().min(2),
  visitType: z.string().min(2),
  currency: z.string().length(3),
  baseAmountMinor: z.number().int().positive(),
  providerCommissionBps: z.number().int().min(0).max(10000),
  organizationCommissionBps: z.number().int().min(0).max(10000),
  refundWindowHours: z.number().int().min(0).max(720),
  note: z.string().trim().max(500).optional(),
});

const pricingSchema = pricingBaseSchema.superRefine((value, ctx) => {
  if (value.providerCommissionBps + value.organizationCommissionBps !== 10000) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provider and organization commissions must total 10000 basis points',
      path: ['organizationCommissionBps'],
    });
  }
});

pricingRouter.use(requireAuth);
pricingRouter.use(allowRoles(readRoles));

pricingRouter.get('/summary', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const summary = await summarizeConfigItems('pricing', organizationId);
  res.json({ summary });
});

pricingRouter.get('/rules', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');

  const q = String(req.query.q ?? '').trim().toLowerCase();
  const status = String(req.query.status ?? '').trim().toUpperCase();
  const serviceCode = String(req.query.serviceCode ?? '').trim().toUpperCase();
  const items = (await listConfigItems('pricing', organizationId)).filter((item) => {
    if (status && item.status !== status) return false;
    if (serviceCode && String(item.serviceCode ?? '').trim().toUpperCase() !== serviceCode) return false;
    if (!q) return true;
    return [item.code, item.name, item.serviceCode, item.visitType, item.currency].join(' ').toLowerCase().includes(q);
  });

  res.json({ items, count: items.length, storageMode: getConfigStorageMode('pricing') });
});

pricingRouter.get('/rules/:ruleId', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await getConfigItem('pricing', req.params.ruleId, organizationId);
  res.json({ item, storageMode: getConfigStorageMode('pricing') });
});

pricingRouter.post('/rules', allowRoles(writeRoles), validateBody(pricingSchema), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await upsertConfigItem('pricing', req.body, { organizationId, actorId });
  res.status(201).json({ item, storageMode: getConfigStorageMode('pricing') });
});

pricingRouter.put('/rules/:ruleId', allowRoles(writeRoles), validateBody(pricingBaseSchema.partial().extend({ id: z.string().optional() })), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');

  const existing = await getConfigItem('pricing', req.params.ruleId, organizationId);
  const mergedProviderCommissionBps = Number(req.body?.providerCommissionBps ?? existing.providerCommissionBps);
  const mergedOrganizationCommissionBps = Number(req.body?.organizationCommissionBps ?? existing.organizationCommissionBps);
  if (mergedProviderCommissionBps + mergedOrganizationCommissionBps !== 10000) {
    throw badRequest('Provider and organization commissions must total 10000 basis points');
  }

  const item = await upsertConfigItem('pricing', { ...req.body, id: req.params.ruleId }, { organizationId, actorId });
  res.json({ item, storageMode: getConfigStorageMode('pricing') });
});

pricingRouter.post('/rules/:ruleId/publish', allowRoles(writeRoles), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await transitionConfigItem('pricing', req.params.ruleId, 'PUBLISHED', { organizationId, actorId }, String(req.body?.note ?? '').trim() || null);
  res.json({ item, storageMode: getConfigStorageMode('pricing') });
});

pricingRouter.post('/simulations', allowRoles(readRoles), async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');

  const serviceCode = String(req.body?.serviceCode ?? '').trim().toUpperCase();
  const amountMinor = Number(req.body?.amountMinor ?? 0);
  if (!serviceCode || amountMinor <= 0) {
    throw badRequest('serviceCode and amountMinor are required');
  }

  const candidates = await listConfigItems('pricing', organizationId);
  const matched = candidates.find((item) => String(item.serviceCode ?? '').trim().toUpperCase() === serviceCode && item.status !== 'ARCHIVED');
  if (!matched) {
    throw badRequest('No pricing rule found for serviceCode');
  }

  const providerShareMinor = Math.round((amountMinor * Number(matched.providerCommissionBps ?? 0)) / 10000);
  const organizationShareMinor = amountMinor - providerShareMinor;

  res.json({
    simulation: {
      ruleId: matched.id,
      serviceCode,
      amountMinor,
      currency: matched.currency,
      providerShareMinor,
      organizationShareMinor,
      refundWindowHours: matched.refundWindowHours,
    },
    storageMode: getConfigStorageMode('pricing'),
  });
});
