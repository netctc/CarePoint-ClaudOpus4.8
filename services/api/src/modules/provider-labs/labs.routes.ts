import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { badRequest, forbidden } from '../../lib/http';
import { filterItemsByHspDomain, requireDomainScopedHspLocationAccess } from '../../lib/hsp-access';
import { getProviderContext } from '../../lib/provider-context';
import { getProviderWorkspaceStorageMode, getProviderWorkspaceItem, listProviderWorkspaceItems, summarizeProviderWorkspaceItems, transitionProviderWorkspaceItem, upsertProviderWorkspaceItem } from '../../lib/provider-workspace-store';
import { prisma } from '../../lib/prisma';
import { writeAuditLog } from '../../lib/audit';
import { getAppointmentSubjectMeta } from '../../lib/appointment-subject-store';
import { appendFamilyLabRelease, resolveProviderSubjectContext } from '../../lib/family-subject-clinical-store';
async function getValidPatientProfileId(patientId: string | null | undefined, organizationId: string) {
  const normalized = String(patientId ?? '').trim();
  if (!normalized) return null;
  const profile = await prisma.patientProfile.findFirst({ where: { id: normalized, organizationId }, select: { id: true } });
  return profile?.id ?? null;
}


export const providerLabsRouter = Router();
const allowedRoles = ['PROVIDER', 'NURSE', 'LAB_TECH'];
const secondReviewSchema = z.object({ note: z.string().trim().min(4).max(500).optional() });

const labSchema = z.object({ id: z.string().optional(), patientId: z.string().min(2), patientName: z.string().min(2), appointmentId: z.string().trim().min(2).optional(), testName: z.string().trim().min(2), requestedAt: z.string().trim().min(2), location: z.string().trim().min(2), nextStep: z.string().trim().min(2), resultStatus: z.string().trim().optional(), values: z.array(z.object({ label: z.string(), value: z.string(), referenceRange: z.string(), flag: z.string().optional(), variant: z.string() })).default([]), comments: z.array(z.string()).default([]), note: z.string().trim().max(1000).optional(), secondReviewerRequired: z.boolean().optional(), subjectProfileId: z.string().trim().min(2).optional(), subjectLabel: z.string().trim().min(2).max(120).optional(), subjectRelationship: z.string().trim().min(2).max(80).optional() });

type LabResultItem = Record<string, any>;

type ReleaseReadiness = {
  ready: boolean;
  requiresSecondReview: boolean;
  secondReviewCompleted: boolean;
  recommendedReviewerRole: 'PROVIDER' | 'NURSE' | 'LAB_TECH';
  allowedReviewerRoles: string[];
  verifierRole: string | null;
  verifierUserId: string | null;
  secondReviewerUserId: string | null;
  blockers: string[];
  guidance: string[];
};

function preferredSecondReviewerRole(verifierRole: string | null): 'PROVIDER' | 'NURSE' | 'LAB_TECH' {
  switch (String(verifierRole ?? '').toUpperCase()) {
    case 'LAB_TECH':
      return 'PROVIDER';
    case 'PROVIDER':
      return 'NURSE';
    case 'NURSE':
      return 'PROVIDER';
    default:
      return 'PROVIDER';
  }
}

function buildReleaseReadiness(item: LabResultItem): ReleaseReadiness {
  const verifierRole = String(item.verifiedByRole ?? '').toUpperCase() || null;
  const values = Array.isArray(item.values) ? item.values : [];
  const hasCriticalFlag = values.some((entry: any) => ['HIGH', 'LOW', 'ABNORMAL', 'CRITICAL'].includes(String(entry?.flag ?? '').toUpperCase()));
  const requiresSecondReview = item.secondReviewerRequired === true || item.secondReviewRequired === true || hasCriticalFlag;
  const secondReviewCompleted = String(item.secondReviewStatus ?? '').toUpperCase() === 'COMPLETED';
  const recommendedReviewerRole = preferredSecondReviewerRole(verifierRole);
  const allowedReviewerRoles = Array.from(new Set([recommendedReviewerRole, 'PROVIDER', 'NURSE', 'LAB_TECH'].filter((role) => role !== verifierRole)));
  const blockers: string[] = [];
  const guidance: string[] = [];

  if (String(item.status ?? '').toUpperCase() !== 'VERIFIED') blockers.push('Result must be verified before release.');
  if (requiresSecondReview && !secondReviewCompleted) blockers.push('A second reviewer must complete clinical review before portal release.');
  if (requiresSecondReview) guidance.push(`Preferred second reviewer role: ${recommendedReviewerRole}.`);
  if (verifierRole) guidance.push(`Verification recorded by ${verifierRole}. Second review must be completed by a different user.`);
  if (!requiresSecondReview) guidance.push('No second-review trigger was detected for this result.');

  return {
    ready: blockers.length === 0,
    requiresSecondReview,
    secondReviewCompleted,
    recommendedReviewerRole,
    allowedReviewerRoles,
    verifierRole,
    verifierUserId: item.verifiedByUserId ?? null,
    secondReviewerUserId: item.secondReviewerUserId ?? null,
    blockers,
    guidance,
  };
}

function enforceSecondReviewerPolicy(item: LabResultItem, actor: { userId?: string; role?: string }) {
  const readiness = buildReleaseReadiness(item);
  if (!readiness.requiresSecondReview) {
    return readiness;
  }
  const reviewerUserId = actor.userId ?? null;
  const reviewerRole = String(actor.role ?? '').toUpperCase();
  if (reviewerUserId && reviewerUserId === readiness.verifierUserId) {
    throw forbidden('Second review must be completed by a different clinical user than the verifier.');
  }
  if (!readiness.allowedReviewerRoles.includes(reviewerRole)) {
    throw forbidden(`Second review requires one of these reviewer roles: ${readiness.allowedReviewerRoles.join(', ')}.`);
  }
  return readiness;
}

providerLabsRouter.use(requireAuth);
providerLabsRouter.use(allowRoles(allowedRoles));
providerLabsRouter.get('/summary', async (req, res) => { const context = await getProviderContext(req.user?.userId, req.user?.organizationId); if (!context.organizationId) throw badRequest('Organization scope is required'); const items = filterItemsByHspDomain(context.hspAccess, 'LABS', await listProviderWorkspaceItems('lab_work_item', context.organizationId, context.providerProfileId), (item) => item.location); const summary = await summarizeProviderWorkspaceItems('lab_work_item', context.organizationId, context.providerProfileId); res.json({ summary: { ...summary, accessibleCount: items.length, pendingAccessibleCount: items.filter((item) => item.status !== 'RELEASED').length }, storageMode: getProviderWorkspaceStorageMode('lab_work_item'), hspAccess: context.hspAccess }); });
providerLabsRouter.get('/inbox', async (req, res) => { const context = await getProviderContext(req.user?.userId, req.user?.organizationId); if (!context.organizationId) throw badRequest('Organization scope is required'); const patientId = String(req.query.patientId ?? '').trim(); const subjectProfileId = String(req.query.subjectProfileId ?? '').trim(); const items = filterItemsByHspDomain(context.hspAccess, 'LABS', await listProviderWorkspaceItems('lab_work_item', context.organizationId, context.providerProfileId), (item) => item.location).filter((item) => (!patientId || item.patientId === patientId) && (!subjectProfileId || item.subjectProfileId === subjectProfileId)); res.json({ items, pendingCount: items.filter((item) => item.status !== 'RELEASED').length, storageMode: getProviderWorkspaceStorageMode('lab_work_item'), hspAccess: context.hspAccess }); });
providerLabsRouter.get('/results/:resultId', async (req, res) => { const context = await getProviderContext(req.user?.userId, req.user?.organizationId); if (!context.organizationId) throw badRequest('Organization scope is required'); const item = await getProviderWorkspaceItem('lab_work_item', req.params.resultId, context.organizationId, context.providerProfileId); requireDomainScopedHspLocationAccess(context.hspAccess, 'LABS', item.location, 'Lab-result location'); const relatedRecords = item.patientId ? await prisma.medicalRecord.findMany({ where: { patientId: item.patientId }, orderBy: { createdAt: 'desc' }, take: 5 }) : []; res.json({ item: { ...item, relatedRecords }, releaseReadiness: buildReleaseReadiness(item), storageMode: getProviderWorkspaceStorageMode('lab_work_item'), hspAccess: context.hspAccess }); });
providerLabsRouter.get('/results/:resultId/release-readiness', async (req, res) => { const context = await getProviderContext(req.user?.userId, req.user?.organizationId); if (!context.organizationId) throw badRequest('Organization scope is required'); const item = await getProviderWorkspaceItem('lab_work_item', req.params.resultId, context.organizationId, context.providerProfileId); requireDomainScopedHspLocationAccess(context.hspAccess, 'LABS', item.location, 'Lab-result location'); res.json({ itemId: item.id, releaseReadiness: buildReleaseReadiness(item), storageMode: getProviderWorkspaceStorageMode('lab_work_item'), hspAccess: context.hspAccess }); });
providerLabsRouter.post('/orders', validateBody(labSchema), async (req, res) => { const context = await getProviderContext(req.user?.userId, req.user?.organizationId); if (!context.organizationId) throw badRequest('Organization scope is required'); const appointmentSubject = req.body.appointmentId ? await getAppointmentSubjectMeta({ appointmentId: req.body.appointmentId, organizationId: context.organizationId, patientId: req.body.patientId }).catch(() => null) : null; const subject = await resolveProviderSubjectContext({ organizationId: context.organizationId, patientId: req.body.patientId, subjectProfileId: req.body.subjectProfileId ?? appointmentSubject?.subjectProfileId ?? null, subjectLabel: req.body.subjectLabel ?? appointmentSubject?.subjectLabel ?? null, subjectRelationship: req.body.subjectRelationship ?? appointmentSubject?.subjectRelationship ?? null }); requireDomainScopedHspLocationAccess(context.hspAccess, 'LABS', req.body.location, 'Lab-order location'); const item = await upsertProviderWorkspaceItem('lab_work_item', { ...req.body, patientId: subject.patientProfileId, patientName: subject.subjectLabel ?? subject.patientName, subjectProfileId: subject.subjectProfileId, subjectLabel: subject.subjectLabel, subjectRelationship: subject.subjectRelationship, isFamilySubject: subject.isFamilySubject, status: req.body.status ?? 'PENDING_REVIEW' }, { organizationId: context.organizationId, providerId: context.providerProfileId, actorId: req.user?.userId }); res.status(201).json({ item, storageMode: getProviderWorkspaceStorageMode('lab_work_item'), hspAccess: context.hspAccess }); });
providerLabsRouter.post('/results/:resultId/verify', allowRoles(['LAB_TECH', 'PROVIDER', 'NURSE']), async (req, res) => { const context = await getProviderContext(req.user?.userId, req.user?.organizationId); if (!context.organizationId) throw badRequest('Organization scope is required'); const existing = await getProviderWorkspaceItem('lab_work_item', req.params.resultId, context.organizationId, context.providerProfileId); requireDomainScopedHspLocationAccess(context.hspAccess, 'LABS', existing.location, 'Lab-result location'); const transitioned = await transitionProviderWorkspaceItem('lab_work_item', req.params.resultId, 'VERIFIED', { organizationId: context.organizationId, providerId: context.providerProfileId, actorId: req.user?.userId }, String(req.body?.note ?? '').trim() || null); const item = await upsertProviderWorkspaceItem('lab_work_item', { ...transitioned, id: transitioned.id, verifiedAt: new Date().toISOString(), verifiedByUserId: req.user?.userId ?? null, verifiedByRole: req.user?.role ?? null, secondReviewRequired: buildReleaseReadiness(transitioned).requiresSecondReview }, { organizationId: context.organizationId, providerId: context.providerProfileId, actorId: req.user?.userId }); await writeAuditLog({ actorId: req.user?.userId, organizationId: context.organizationId, action: 'provider.lab.verified', resource: 'lab_work_item', resourceId: item.id, details: { previousStatus: existing.status, patientId: item.patientId ?? null, testName: item.testName ?? null, verifiedByRole: req.user?.role ?? null } }); res.json({ item, releaseReadiness: buildReleaseReadiness(item), storageMode: getProviderWorkspaceStorageMode('lab_work_item'), hspAccess: context.hspAccess }); });
providerLabsRouter.post('/results/:resultId/second-review', allowRoles(['PROVIDER', 'NURSE', 'LAB_TECH']), validateBody(secondReviewSchema), async (req, res) => { const context = await getProviderContext(req.user?.userId, req.user?.organizationId); if (!context.organizationId) throw badRequest('Organization scope is required'); const existing = await getProviderWorkspaceItem('lab_work_item', req.params.resultId, context.organizationId, context.providerProfileId); requireDomainScopedHspLocationAccess(context.hspAccess, 'LABS', existing.location, 'Lab-result location'); const reviewerId = req.user?.userId ?? null; const readiness = enforceSecondReviewerPolicy(existing, { userId: reviewerId ?? undefined, role: req.user?.role ?? undefined }); const item = await upsertProviderWorkspaceItem('lab_work_item', { ...existing, id: existing.id, secondReviewRequired: readiness.requiresSecondReview, secondReviewStatus: 'COMPLETED', secondReviewedAt: new Date().toISOString(), secondReviewerUserId: reviewerId, secondReviewerRole: req.user?.role ?? null, secondReviewNote: String(req.body?.note ?? '').trim() || null, releaseReady: true }, { organizationId: context.organizationId, providerId: context.providerProfileId, actorId: reviewerId ?? undefined }); await writeAuditLog({ actorId: reviewerId, organizationId: context.organizationId, action: 'provider.lab.second_review_completed', resource: 'lab_work_item', resourceId: item.id, details: { patientId: item.patientId ?? null, testName: item.testName ?? null, note: req.body.note ?? null, reviewerRole: req.user?.role ?? null } }); res.json({ item, releaseReadiness: buildReleaseReadiness(item), storageMode: getProviderWorkspaceStorageMode('lab_work_item'), hspAccess: context.hspAccess }); });

providerLabsRouter.post('/results/:resultId/release', async (req, res) => {
  const context = await getProviderContext(req.user?.userId, req.user?.organizationId);
  if (!context.organizationId) throw badRequest('Organization scope is required');
  const existing = await getProviderWorkspaceItem('lab_work_item', req.params.resultId, context.organizationId, context.providerProfileId);
  requireDomainScopedHspLocationAccess(context.hspAccess, 'LABS', existing.location, 'Lab-result location');
  const readiness = buildReleaseReadiness(existing);
  if (!readiness.ready) throw badRequest(readiness.blockers.join(' '));
  const item = await transitionProviderWorkspaceItem('lab_work_item', req.params.resultId, 'RELEASED', { organizationId: context.organizationId, providerId: context.providerProfileId, actorId: req.user?.userId }, String(req.body?.note ?? '').trim() || null);
  const patientProfileId = await getValidPatientProfileId(item.patientId, context.organizationId);
  if (!patientProfileId) throw badRequest('The selected patient could not be found. Reopen the lab result from a valid patient context.');
  if (item.subjectProfileId) {
    await appendFamilyLabRelease({
      organizationId: context.organizationId,
      patientId: patientProfileId,
      subjectProfileId: item.subjectProfileId,
      actorId: req.user?.userId,
      labItem: { ...item, releasedByName: context.providerName },
    });
  } else {
    await prisma.medicalRecord.create({ data: { patientId: patientProfileId, providerId: context.providerProfileId, summary: { title: 'Lab result released', resultId: item.id, recordType: 'LAB_RESULT', verified: true, releasedToPatient: true, secondReviewStatus: item.secondReviewStatus ?? 'NOT_REQUIRED', recommendedReviewerRole: readiness.recommendedReviewerRole }, content: { recordType: 'LAB_RESULT', patientVisible: true, verified: true, verifiedAt: item.verifiedAt ?? new Date().toISOString(), releasedToPatient: true, releasedAt: new Date().toISOString(), testName: item.testName, values: item.values ?? [], comments: item.comments ?? [], secondReviewStatus: item.secondReviewStatus ?? 'NOT_REQUIRED', secondReviewedAt: item.secondReviewedAt ?? null, reviewerRole: item.secondReviewerRole ?? null, releaseReadiness: readiness, patientGuidance: readiness.requiresSecondReview ? 'A second reviewer completed release checks before this result was published to your portal.' : 'Your clinician verified this result before portal release.' } } });
  }
  await writeAuditLog({ actorId: req.user?.userId, organizationId: context.organizationId, action: 'provider.lab.released', resource: 'lab_work_item', resourceId: item.id, details: { patientId: item.patientId ?? null, testName: item.testName ?? null, recommendedReviewerRole: readiness.recommendedReviewerRole } });
  res.json({ item, releaseReadiness: readiness, storageMode: getProviderWorkspaceStorageMode('lab_work_item'), hspAccess: context.hspAccess });
});
