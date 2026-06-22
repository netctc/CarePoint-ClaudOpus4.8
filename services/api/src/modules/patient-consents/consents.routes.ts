import { Router } from 'express';
import { z } from 'zod';
import { localeCodeSchema } from '@care-center/contracts';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { badRequest } from '../../lib/http';
import { getPatientContext } from '../../lib/patient-context';
import { getPatientConsentStorageMode, getPatientConsentItem, listPatientConsentHistory, listPatientConsentItems, summarizePatientConsentItems, upsertPatientConsentItem } from '../../lib/patient-consent-store';

export const patientConsentsRouter = Router();
const allowedRoles = ['PATIENT'];

const consentDecisionSchema = z.object({
  decision: z.enum(['ACCEPTED', 'REVOKED']),
  locale: localeCodeSchema.default('en'),
  note: z.string().trim().max(500).optional(),
});

patientConsentsRouter.use(requireAuth);
patientConsentsRouter.use(allowRoles(allowedRoles));

patientConsentsRouter.get('/summary', async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const summary = await summarizePatientConsentItems(context.organizationId, context.patientProfileId);
  res.json({ summary, storageMode: getPatientConsentStorageMode() });
});

patientConsentsRouter.get('/', async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const items = await listPatientConsentItems(context.organizationId, context.patientProfileId);
  res.json({ items, storageMode: getPatientConsentStorageMode() });
});

patientConsentsRouter.get('/history', async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const items = await listPatientConsentHistory(context.organizationId, context.patientProfileId);
  res.json({ items, storageMode: getPatientConsentStorageMode() });
});

patientConsentsRouter.get('/:consentId', async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const item = await getPatientConsentItem(req.params.consentId, context.organizationId, context.patientProfileId);
  res.json({ item, storageMode: getPatientConsentStorageMode() });
});

patientConsentsRouter.put('/:consentId', validateBody(consentDecisionSchema), async (req, res) => {
  const context = await getPatientContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const existing = await getPatientConsentItem(req.params.consentId, context.organizationId, context.patientProfileId).catch(() => null);
  const consentType = String(existing?.consentType ?? req.params.consentId).trim().toUpperCase();
  const acceptedAt = req.body.decision === 'ACCEPTED' ? new Date().toISOString() : existing?.acceptedAt ?? null;
  const revokedAt = req.body.decision === 'REVOKED' ? new Date().toISOString() : null;
  const item = await upsertPatientConsentItem({
    ...(existing ?? {}),
    id: existing?.id ?? `consent-${consentType.toLowerCase().replace(/_/g, '-')}`,
    title: existing?.title ?? `${consentType.replace(/_/g, ' ')} consent`,
    consentType,
    locale: req.body.locale,
    note: req.body.note ?? null,
    acceptedAt,
    revokedAt,
    status: req.body.decision,
    actorType: 'PATIENT',
    actorId: req.user?.userId,
  }, {
    organizationId: context.organizationId,
    patientId: context.patientProfileId,
    actorId: req.user?.userId,
  });
  res.json({ item, storageMode: getPatientConsentStorageMode() });
});
