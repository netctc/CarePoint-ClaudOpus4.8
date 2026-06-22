import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { badRequest } from '../../lib/http';
import { getProviderContext } from '../../lib/provider-context';
import { buildHspAccessSummary, deriveDefaultFacilities, getGrantedHspDomains } from '../../lib/hsp-access';
import { hspConsentGrantScopes, listHspConsentGrants, revokeHspConsentGrant, upsertHspConsentGrant } from '../../lib/hsp-consent-store';

export const hspRouter = Router();

hspRouter.use(requireAuth);

hspRouter.get('/me', allowRoles(['PROVIDER', 'NURSE', 'PHARMACIST', 'LAB_TECH']), async (req, res) => {
  const context = await getProviderContext(req.user?.userId, req.user?.organizationId);
  res.json({ item: context.hspAccess });
});

hspRouter.get('/organization-summary', allowRoles(['COMPANY_ADMIN', 'COMPANY_SUPPORT', 'SUPER_ADMIN']), async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const organizationName = String(req.query.organizationName ?? req.user?.organizationId ?? 'Organization');
  const facilities = deriveDefaultFacilities(organizationId, organizationName, null);
  const overview = buildHspAccessSummary({ organizationId, organizationName, role: req.user?.role });
  const grants = listHspConsentGrants(organizationId, 'ALL');
  res.json({
    summary: {
      organizationId,
      organizationName,
      linkedFacilities: facilities.length,
      model: overview.accountModel,
      accessScope: overview.accessScope,
      consentScope: overview.consentScope,
      activeConsentGrants: grants.filter((item) => item.status === 'ACTIVE').length,
      revokedConsentGrants: grants.filter((item) => item.status === 'REVOKED').length,
      grantedDomains: getGrantedHspDomains(overview),
    },
    facilities,
    grants,
  });
});

hspRouter.get('/consent-grants', allowRoles(['PROVIDER', 'NURSE', 'PHARMACIST', 'LAB_TECH', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'SUPER_ADMIN']), async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');

  const role = String(req.user?.role ?? '').toUpperCase();
  const providerScoped = ['PROVIDER', 'NURSE', 'PHARMACIST', 'LAB_TECH'].includes(role)
    ? await getProviderContext(req.user?.userId, organizationId)
    : null;
  const organizationName = providerScoped?.organizationName ?? String(req.query.organizationName ?? 'Organization');
  const facilities = deriveDefaultFacilities(organizationId, organizationName, null);
  const status = String(req.query.status ?? 'ALL').toUpperCase();
  const grants = listHspConsentGrants(organizationId, status === 'ACTIVE' || status === 'REVOKED' ? status : 'ALL');
  const summary = providerScoped?.hspAccess ?? buildHspAccessSummary({ organizationId, organizationName, role: req.user?.role });

  res.json({
    item: {
      summary: { ...summary, grantedDomains: getGrantedHspDomains(summary) },
      facilities,
      grants,
      canManage: ['COMPANY_ADMIN', 'COMPANY_SUPPORT', 'SUPER_ADMIN'].includes(role),
    },
  });
});

const consentGrantSchema = z.object({
  sourceFacilityId: z.string().min(1),
  targetFacilityId: z.string().min(1),
  scope: z.enum(hspConsentGrantScopes).default('LIMITED'),
  domains: z.array(z.string().min(1)).default([]),
  note: z.string().max(500).optional(),
});

hspRouter.post('/consent-grants', allowRoles(['COMPANY_ADMIN', 'COMPANY_SUPPORT', 'SUPER_ADMIN']), async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const body = consentGrantSchema.parse(req.body ?? {});
  const facilities = deriveDefaultFacilities(organizationId, String(req.body?.organizationName ?? 'Organization'), null);
  const source = facilities.find((item) => item.id === body.sourceFacilityId);
  const target = facilities.find((item) => item.id === body.targetFacilityId);
  if (!source || !target) throw badRequest('Source and target facilities must belong to the organization');
  if (source.id === target.id) throw badRequest('Source and target facilities must be different');

  const item = upsertHspConsentGrant({
    organizationId,
    sourceFacilityId: source.id,
    sourceFacilityName: source.name,
    targetFacilityId: target.id,
    targetFacilityName: target.name,
    scope: body.scope,
    domains: body.domains,
    note: body.note ?? null,
    updatedByRole: req.user?.role ?? null,
  });

  res.status(201).json({ item });
});

hspRouter.post('/consent-grants/:grantId/revoke', allowRoles(['COMPANY_ADMIN', 'COMPANY_SUPPORT', 'SUPER_ADMIN']), async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const note = typeof req.body?.note === 'string' ? req.body.note : null;
  const item = revokeHspConsentGrant(organizationId, String(req.params.grantId ?? ''), req.user?.role ?? null, note);
  if (!item) throw badRequest('Consent grant not found');
  res.json({ item });
});
