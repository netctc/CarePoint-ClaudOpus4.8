import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { badRequest } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { writeAuditLog } from '../../lib/audit';
import { getProviderContext } from '../../lib/provider-context';
import { buildHspAccessSummary, hspAccountModels, hspConsentScopes } from '../../lib/hsp-access';

export const providerOnboardingRouter = Router();
const allowedRoles = ['PROVIDER', 'NURSE'];

const onboardingSchema = z.object({
  orgName: z.string().trim().min(2),
  hspModel: z.enum(hspAccountModels).default('INSTITUTIONAL'),
  primaryFacility: z.string().trim().min(2),
  crossFacilityAccess: z.enum(hspConsentScopes).default('NONE'),
  facilityAccessNote: z.string().trim().max(300).optional().or(z.literal('')),
  licenseNumber: z.string().trim().min(2),
  payoutAccount: z.string().trim().min(2).optional().or(z.literal('')),
  checklist: z.array(z.object({
    label: z.string(),
    detail: z.string(),
    status: z.string(),
    variant: z.string(),
  })).default([]),
  attestations: z.object({
    telehealthAgreement: z.boolean().default(false),
    privacyAgreement: z.boolean().default(false),
    payoutOwnership: z.boolean().default(false),
  }).default({
    telehealthAgreement: false,
    privacyAgreement: false,
    payoutOwnership: false,
  }),
});

providerOnboardingRouter.use(requireAuth);
providerOnboardingRouter.use(allowRoles(allowedRoles));

providerOnboardingRouter.get('/me', async (req, res) => {
  const context = await getProviderContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');

  const state = await prisma.providerOnboardingState.findUnique({
    where: { providerId: context.providerProfileId },
  });

  const requestedFields = (state?.requestedFields as any) ?? {};
  const hspAccess = buildHspAccessSummary({
    organizationId: context.organizationId,
    organizationName: context.organizationName,
    role: context.user.role,
    requestedFields,
  });

  const checklist = Array.isArray(state?.checklist) ? state?.checklist : [
    { label: 'License verification', detail: 'Validate active professional license and specialization.', status: context.licenseNumber ? 'Ready' : 'Missing', variant: context.licenseNumber ? 'success' : 'warning' },
    { label: 'Facility assignment', detail: 'Confirm the primary facility and service channels.', status: 'Pending review', variant: 'info' },
    { label: 'Payout setup', detail: 'Capture bank payout ownership confirmation.', status: 'Pending', variant: 'warning' },
    { label: 'HSP access model', detail: 'Confirm whether the provider works as an individual, institutional, or organization-based HSP.', status: hspAccess.accountModelLabel, variant: 'info' },
  ];

  res.json({
    item: {
      status: state?.status ?? 'DRAFT',
      orgName: context.organizationName,
      hspModel: String(requestedFields.hspModel ?? hspAccess.accountModel),
      primaryFacility: String(requestedFields.primaryFacility ?? hspAccess.primaryFacility?.name ?? 'Main Clinic'),
      crossFacilityAccess: String(requestedFields.crossFacilityAccess ?? hspAccess.consentScope),
      facilityAccessNote: String(requestedFields.facilityAccessNote ?? ''),
      licenseNumber: String(requestedFields.licenseNumber ?? context.licenseNumber ?? ''),
      payoutAccount: String(requestedFields.payoutAccount ?? ''),
      checklist,
      attestations: requestedFields.attestations ?? {
        telehealthAgreement: false,
        privacyAgreement: false,
        payoutOwnership: false,
      },
      submittedAt: state?.submittedAt ?? null,
      reviewedAt: state?.reviewedAt ?? null,
      decisionNote: state?.decisionNote ?? null,
      hspAccess,
    },
    storageMode: 'model',
  });
});

providerOnboardingRouter.post('/me/save-draft', validateBody(onboardingSchema), async (req, res) => {
  const context = await getProviderContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');

  const item = await prisma.providerOnboardingState.upsert({
    where: { providerId: context.providerProfileId },
    create: {
      providerId: context.providerProfileId,
      organizationId: context.organizationId,
      status: 'DRAFT',
      checklist: req.body.checklist,
      requestedFields: {
        orgName: req.body.orgName,
        hspModel: req.body.hspModel,
        primaryFacility: req.body.primaryFacility,
        crossFacilityAccess: req.body.crossFacilityAccess,
        facilityAccessNote: req.body.facilityAccessNote || '',
        licenseNumber: req.body.licenseNumber,
        payoutAccount: req.body.payoutAccount || '',
        attestations: req.body.attestations,
      },
      lastAction: 'provider.save_draft',
      lastActorId: req.user?.userId,
    },
    update: {
      status: 'DRAFT',
      checklist: req.body.checklist,
      requestedFields: {
        orgName: req.body.orgName,
        hspModel: req.body.hspModel,
        primaryFacility: req.body.primaryFacility,
        crossFacilityAccess: req.body.crossFacilityAccess,
        facilityAccessNote: req.body.facilityAccessNote || '',
        licenseNumber: req.body.licenseNumber,
        payoutAccount: req.body.payoutAccount || '',
        attestations: req.body.attestations,
      },
      lastAction: 'provider.save_draft',
      lastActorId: req.user?.userId,
    },
  });

  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId: context.organizationId,
    action: 'provider.onboarding.saved_draft',
    resource: 'provider_onboarding',
    resourceId: item.id,
    details: {
      providerId: context.providerProfileId,
      status: item.status,
      hspModel: req.body.hspModel,
      primaryFacility: req.body.primaryFacility,
      crossFacilityAccess: req.body.crossFacilityAccess,
    },
  });

  res.json({ item, storageMode: 'model' });
});

providerOnboardingRouter.post('/me/submit', validateBody(onboardingSchema), async (req, res) => {
  const context = await getProviderContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');

  const item = await prisma.providerOnboardingState.upsert({
    where: { providerId: context.providerProfileId },
    create: {
      providerId: context.providerProfileId,
      organizationId: context.organizationId,
      status: 'READY_FOR_REVIEW',
      checklist: req.body.checklist,
      submittedAt: new Date(),
      requestedFields: {
        orgName: req.body.orgName,
        hspModel: req.body.hspModel,
        primaryFacility: req.body.primaryFacility,
        crossFacilityAccess: req.body.crossFacilityAccess,
        facilityAccessNote: req.body.facilityAccessNote || '',
        licenseNumber: req.body.licenseNumber,
        payoutAccount: req.body.payoutAccount || '',
        attestations: req.body.attestations,
      },
      lastAction: 'provider.submit',
      lastActorId: req.user?.userId,
    },
    update: {
      status: 'READY_FOR_REVIEW',
      checklist: req.body.checklist,
      submittedAt: new Date(),
      requestedFields: {
        orgName: req.body.orgName,
        hspModel: req.body.hspModel,
        primaryFacility: req.body.primaryFacility,
        crossFacilityAccess: req.body.crossFacilityAccess,
        facilityAccessNote: req.body.facilityAccessNote || '',
        licenseNumber: req.body.licenseNumber,
        payoutAccount: req.body.payoutAccount || '',
        attestations: req.body.attestations,
      },
      lastAction: 'provider.submit',
      lastActorId: req.user?.userId,
    },
  });

  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId: context.organizationId,
    action: 'provider.onboarding.submitted',
    resource: 'provider_onboarding',
    resourceId: item.id,
    details: {
      providerId: context.providerProfileId,
      status: item.status,
      submittedAt: item.submittedAt?.toISOString?.() ?? item.submittedAt,
    },
  });

  res.json({ item, storageMode: 'model' });
});
