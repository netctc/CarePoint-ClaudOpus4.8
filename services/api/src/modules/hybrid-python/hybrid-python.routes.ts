import { createHash } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import {
  hybridPythonAccountsBulkValidatePrepareSchema,
  hybridPythonAccountsReadModelPrepareSchema,
  hybridPythonProviderRoleReconcilePrepareSchema,
  hybridPythonSchedulingAvailabilitySnapshotPrepareSchema,
  hybridPythonMessagingReminderPlanPrepareSchema,
  hybridPythonBillingPaymentReconcilePrepareSchema,
  hybridPythonClinicalRecordsAccessAuditPrepareSchema,
  hybridPythonPlatformDbIndexAdvisoryPrepareSchema,
  hybridPythonPlatformSloRegressionReportPrepareSchema,
  hybridPythonPlatformContractReplayPrepareSchema,
  hybridPythonPlatformPrivacyPreflightPrepareSchema,
  hybridPythonPlatformReleaseDecisionPrepareSchema,
  hybridPythonPlatformRollbackDrillPrepareSchema,
  hybridPythonPlatformPostDeployVerifyPrepareSchema,
  hybridPythonPlatformChangeTicketBundlePrepareSchema,
  hybridPythonPlatformOperationalHandoffPrepareSchema,
  hybridPythonPlatformIncidentSimulationPrepareSchema,
  hybridPythonPlatformCapacityPlanPrepareSchema,
  hybridPythonPlatformAlertPolicyReviewPrepareSchema,
  hybridPythonPlatformDependencyReadinessPrepareSchema,
  hybridPythonPlatformProductionReadinessPrepareSchema,
  hybridPythonPlatformDataRetentionReviewPrepareSchema,
  hybridPythonPlatformAuditTrailReviewPrepareSchema,
  hybridPythonPlatformSecurityPostureReviewPrepareSchema,
  hybridPythonPlatformSupplyChainReviewPrepareSchema,
  hybridPythonPlatformSchemaMigrationRehearsalPrepareSchema,
  hybridPythonPlatformBackupRestoreDrillPrepareSchema,
  hybridPythonPlatformObservabilityCoverageReviewPrepareSchema,
  hybridPythonPlatformFeatureFlagReviewPrepareSchema,
  hybridPythonPlatformDomainMigrationReadinessPrepareSchema,
  hybridPythonPlatformCutoverPlanPrepareSchema,
  hybridPythonPlatformOwnerRegistryReviewPrepareSchema,
  hybridPythonPlatformPostCutoverMonitorPrepareSchema,
  hybridPythonPlatformLegacyPathDecommissionPrepareSchema,
  hybridPythonPlatformSteadyStateOpsReviewPrepareSchema,
  hybridPythonPlatformQueueResilienceReviewPrepareSchema,
  hybridPythonPlatformArtifactIntegrityReviewPrepareSchema,
  hybridPythonPlatformRunbookFreshnessReviewPrepareSchema,
  hybridPythonPlatformSupportEscalationReviewPrepareSchema,
  hybridPythonPlatformCostGuardrailReviewPrepareSchema,
  hybridPythonPlatformEnvironmentParityReviewPrepareSchema,
  hybridPythonPlatformAccessControlReviewPrepareSchema,
  hybridPythonPlatformDataQualityReviewPrepareSchema,
  hybridPythonPlatformCiStagingValidationReviewPrepareSchema,
  hybridPythonPlatformReleaseClosureReviewPrepareSchema,
  hybridPythonPlatformProductionCanaryObservationReviewPrepareSchema,
  hybridPythonPlatformIncidentResponseReadinessReviewPrepareSchema,
  hybridPythonPlatformTrafficPromotionReadinessReviewPrepareSchema,
  hybridPythonPlatformEvidenceRetentionAuditReviewPrepareSchema,
  hybridPythonPlatformSloErrorBudgetReviewPrepareSchema,
  hybridPythonPlatformAutoRollbackSafeguardReviewPrepareSchema,
  hybridPythonPlatformThirdPartyDependencyReviewPrepareSchema,
  hybridPythonPlatformCapacityScalingReadinessReviewPrepareSchema,
  hybridPythonPlatformCompliancePrivacyEvidenceReviewPrepareSchema,
  hybridPythonPlatformRunbookDrillVerificationReviewPrepareSchema,
  hybridPythonPlatformDisasterRecoveryBackupReviewPrepareSchema,
  hybridPythonPlatformChangeMigrationReadinessReviewPrepareSchema,
  hybridPythonPlatformConfigurationSecretRotationReviewPrepareSchema,
  hybridPythonPlatformMaintenanceWindowReadinessReviewPrepareSchema,
  hybridPythonPlatformAuditForensicsReadinessReviewPrepareSchema,
  hybridPythonPlatformBusinessContinuityReadinessReviewPrepareSchema,
  hybridPythonPlatformPostIncidentLearningReviewPrepareSchema,
  hybridPythonPlatformTechDebtGovernanceReviewPrepareSchema,
  hybridPythonPlatformVendorResilienceReviewPrepareSchema,
  hybridPythonPlatformKnowledgeTransferReadinessReviewPrepareSchema,
  hybridPythonPlatformArchitectureOwnershipReviewPrepareSchema,
  hybridPythonPlatformExecutiveMetricsGovernanceReviewPrepareSchema,
  hybridPythonPlatformDomainAdoptionReadinessReviewPrepareSchema,
  hybridPythonPlatformPhaseTwoRolloutGovernanceReviewPrepareSchema,
  hybridPythonPlatformDomainPilotExecutionReviewPrepareSchema,
  hybridPythonPlatformPhaseTwoExpansionControlReviewPrepareSchema,
  hybridPythonPlatformDomainOutcomeMeasurementReviewPrepareSchema,
  hybridPythonPlatformPhaseTwoFeedbackAdoptionReviewPrepareSchema,
  hybridPythonPlatformDomainGraduationReadinessReviewPrepareSchema,
  hybridPythonPlatformPhaseTwoLearningConsolidationReviewPrepareSchema,
  hybridPythonPlatformDomainWideAdoptionReadinessReviewPrepareSchema,
  hybridPythonPlatformPhaseTwoSupportTransitionReviewPrepareSchema,
  hybridPythonPlatformDomainAdoptionStabilizationReviewPrepareSchema,
  hybridPythonPlatformPhaseTwoValueRealizationReviewPrepareSchema,
  hybridPythonPlatformPhaseTwoClosureAcceptanceReviewPrepareSchema,
  hybridPythonPlatformPhaseThreeTransitionReadinessReviewPrepareSchema,
  hybridPythonPlatformPhaseThreeDomainWaveReadinessReviewPrepareSchema,
  hybridPythonPlatformPhaseThreeOperatingModelAlignmentReviewPrepareSchema,
  hybridPythonPlatformPhaseThreeWaveExecutionReviewPrepareSchema,
  hybridPythonPlatformPhaseThreeAdoptionValueTrackingReviewPrepareSchema,
  hybridPythonPlatformPhaseThreeGapRemediationReviewPrepareSchema,
  hybridPythonPlatformMigrationStageCompletionReadinessReviewPrepareSchema,
  hybridPythonPlatformPhaseThreeRemediationClosureReviewPrepareSchema,
  hybridPythonPlatformExecutiveOperationalHandoffReviewPrepareSchema,
  hybridPythonPlatformGlobalTaskStatusTrackingReviewPrepareSchema,
  hybridPythonPlatformProjectStateHealthReviewPrepareSchema,
  hybridPythonPlatformFinalAcceptanceEvidenceReviewPrepareSchema,
  hybridPythonPlatformStageExitReadinessReviewPrepareSchema,
  hybridPythonPlatformStageClosureCertificationReviewPrepareSchema,
  hybridPythonPlatformPostClosureOperationalTransitionReviewPrepareSchema,
  hybridPythonPlatformPostClosureMonitoringReviewPrepareSchema,
  hybridPythonPlatformSteadyStateTransferValidationReviewPrepareSchema,
  hybridPythonPlatformSteadyStateOperationalAssuranceReviewPrepareSchema,
  hybridPythonPlatformContinuousImprovementBacklogReviewPrepareSchema,
  hybridPythonPlatformStableOperationsOptimizationReviewPrepareSchema,
  hybridPythonPlatformRecurringMaintenanceCycleReadinessReviewPrepareSchema,
  hybridPythonPlatformMaintenanceCycleExecutionReviewPrepareSchema,
  hybridPythonPlatformLongTermOperabilitySustainabilityReviewPrepareSchema,
  hybridPythonPlatformRecurringOperationalMaturityAuditReviewPrepareSchema,
  hybridPythonPlatformStableStateContinuityControlReviewPrepareSchema,
  hybridPythonPlatformOperationalResilienceGovernanceReviewPrepareSchema,
  hybridPythonPlatformRecoveryCapabilityValidationReviewPrepareSchema,
  hybridPythonPlatformOperationalResilienceOptimizationReviewPrepareSchema,
  hybridPythonPlatformAutomatedContinuityPreparednessReviewPrepareSchema,
  hybridPythonPlatformAutomatedContinuityExecutionValidationReviewPrepareSchema,
  hybridPythonPlatformOperationalResilienceFeedbackLoopReviewPrepareSchema,
  hybridPythonPlatformFinalClosureEvidencePackageReviewPrepareSchema,
  hybridPythonPlatformGlobalImplementationCompletionChecklistReviewPrepareSchema,
  hybridPythonPlatformFinalOperationalHandoverReviewPrepareSchema,
  hybridPythonPlatformPhaseClosureCertificationReviewPrepareSchema,
  hybridPythonAiTriagePreviewPrepareSchema,
  hybridPythonAnalyticsSnapshotPrepareSchema,
  hybridPythonAuditExportPrepareSchema,
  hybridPythonJobCancelSchema,
  hybridPythonNotificationDispatchPrepareSchema,
  hybridPythonJobEnvelopeSchema,
  hybridPythonJobStatusSchema,
  hybridPythonShadowComparisonInputSchema,
  hybridPythonArtifactGcSchema,
  hybridPythonCanaryAssignmentRequestSchema,
  hybridPythonCanaryRolloutActionSchema,
  hybridPythonCanaryRolloutPlanSchema,
  hybridPythonRolloutReadinessQuerySchema,
  hybridPythonJobTypeSchema,
} from '@care-center/contracts';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import {
  cancelHybridPythonJob,
  enqueueHybridPythonJob,
  getHybridPythonJobMetrics,
  getHybridPythonJobStatus,
  getHybridPythonJobSummary,
  resolveHybridPythonRoutingDecision,
  getHybridPythonServiceStatus,
  getHybridPythonShadowRecords,
  getHybridPythonShadowComparisons,
  getHybridPythonCanaryGate,
  recordHybridPythonShadowComparison,
  runHybridPythonArtifactGc,
  getHybridPythonContractManifest,
  getHybridPythonContractTestVectors,
  validateHybridPythonContract,
  getHybridPythonRolloutReadiness,
  replayHybridPythonContracts,
  runHybridPythonPrivacyPreflight,
  runHybridPythonReleaseDecision,
  runHybridPythonRollbackDrill,
  runHybridPythonPostDeployVerify,
  runHybridPythonChangeTicketBundle,
  runHybridPythonOperationalHandoff,
  runHybridPythonIncidentSimulation,
  runHybridPythonCapacityPlan,
  runHybridPythonAlertPolicyReview,
  runHybridPythonDependencyReadiness,
  runHybridPythonProductionReadiness,
  runHybridPythonDataRetentionReview,
  runHybridPythonAuditTrailReview,
  runHybridPythonSecurityPostureReview,
  runHybridPythonSupplyChainReview,
  runHybridPythonSchemaMigrationRehearsal,
  runHybridPythonBackupRestoreDrill,
  runHybridPythonObservabilityCoverageReview,
  runHybridPythonFeatureFlagReview,
  runHybridPythonDomainMigrationReadiness,
  runHybridPythonCutoverPlan,
  runHybridPythonOwnerRegistryReview,
  runHybridPythonPostCutoverMonitor,
  runHybridPythonLegacyPathDecommission,
  runHybridPythonSteadyStateOpsReview,
  runHybridPythonQueueResilienceReview,
  runHybridPythonArtifactIntegrityReview,
  runHybridPythonRunbookFreshnessReview,
  runHybridPythonSupportEscalationReview,
  runHybridPythonCostGuardrailReview,
  runHybridPythonEnvironmentParityReview,
  runHybridPythonAccessControlReview,
  runHybridPythonDataQualityReview,
  runHybridPythonCiStagingValidationReview,
  runHybridPythonReleaseClosureReview,
  runHybridPythonProductionCanaryObservationReview,
  runHybridPythonIncidentResponseReadinessReview,
  runHybridPythonTrafficPromotionReadinessReview,
  runHybridPythonEvidenceRetentionAuditReview,
  runHybridPythonSloErrorBudgetReview,
  runHybridPythonAutoRollbackSafeguardReview,
  runHybridPythonThirdPartyDependencyReview,
  runHybridPythonCapacityScalingReadinessReview,
  runHybridPythonCompliancePrivacyEvidenceReview,
  runHybridPythonRunbookDrillVerificationReview,
  runHybridPythonDisasterRecoveryBackupReview,
  runHybridPythonChangeMigrationReadinessReview,
  runHybridPythonConfigurationSecretRotationReview,
  runHybridPythonMaintenanceWindowReadinessReview,
  runHybridPythonAuditForensicsReadinessReview,
  runHybridPythonBusinessContinuityReadinessReview,
  runHybridPythonPostIncidentLearningReview,
  runHybridPythonTechDebtGovernanceReview,
  runHybridPythonVendorResilienceReview,
  runHybridPythonKnowledgeTransferReadinessReview,
  runHybridPythonArchitectureOwnershipReview,
  runHybridPythonExecutiveMetricsGovernanceReview,
  runHybridPythonDomainAdoptionReadinessReview,
  runHybridPythonPhaseTwoRolloutGovernanceReview,
  runHybridPythonDomainPilotExecutionReview,
  runHybridPythonPhaseTwoExpansionControlReview,
  runHybridPythonDomainOutcomeMeasurementReview,
  runHybridPythonPhaseTwoFeedbackAdoptionReview,
  runHybridPythonDomainGraduationReadinessReview,
  runHybridPythonPhaseTwoLearningConsolidationReview,
  runHybridPythonDomainWideAdoptionReadinessReview,
  runHybridPythonPhaseTwoSupportTransitionReview,
  runHybridPythonDomainAdoptionStabilizationReview,
  runHybridPythonPhaseTwoValueRealizationReview,
  runHybridPythonPhaseTwoClosureAcceptanceReview,
  runHybridPythonPhaseThreeTransitionReadinessReview,
  runHybridPythonPhaseThreeDomainWaveReadinessReview,
  runHybridPythonPhaseThreeOperatingModelAlignmentReview,
  runHybridPythonPhaseThreeWaveExecutionReview,
  runHybridPythonPhaseThreeAdoptionValueTrackingReview,
  runHybridPythonPhaseThreeGapRemediationReview,
  runHybridPythonMigrationStageCompletionReadinessReview,
  runHybridPythonPhaseThreeRemediationClosureReview,
  runHybridPythonExecutiveOperationalHandoffReview,
  runHybridPythonGlobalTaskStatusTrackingReview,
  runHybridPythonProjectStateHealthReview,
  runHybridPythonFinalAcceptanceEvidenceReview,
  runHybridPythonStageExitReadinessReview,
  runHybridPythonStageClosureCertificationReview,
  runHybridPythonPostClosureOperationalTransitionReview,
  runHybridPythonPostClosureMonitoringReview,
  runHybridPythonSteadyStateTransferValidationReview,
  runHybridPythonSteadyStateOperationalAssuranceReview,
  runHybridPythonContinuousImprovementBacklogReview,
  runHybridPythonStableOperationsOptimizationReview,
  runHybridPythonRecurringMaintenanceCycleReadinessReview,
  runHybridPythonMaintenanceCycleExecutionReview,
  runHybridPythonLongTermOperabilitySustainabilityReview,
  runHybridPythonRecurringOperationalMaturityAuditReview,
  runHybridPythonStableStateContinuityControlReview,
  runHybridPythonOperationalResilienceGovernanceReview,
  runHybridPythonRecoveryCapabilityValidationReview,
  runHybridPythonOperationalResilienceOptimizationReview,
  runHybridPythonAutomatedContinuityPreparednessReview,
  runHybridPythonAutomatedContinuityExecutionValidationReview,
  runHybridPythonOperationalResilienceFeedbackLoopReview,
  runHybridPythonFinalClosureEvidencePackageReview,
  runHybridPythonGlobalImplementationCompletionChecklistReview,
  runHybridPythonFinalOperationalHandoverReview,
  runHybridPythonPhaseClosureCertificationReview,
  advanceHybridPythonCanaryRollout,
  getHybridPythonCanaryAssignment,
  getHybridPythonCanaryRollout,
  pauseHybridPythonCanaryRollout,
  planHybridPythonCanaryRollout,
  resumeHybridPythonCanaryRollout,
  rollbackHybridPythonCanaryRollout,
  listHybridPythonJobs,
  getHybridPythonReleaseChecklist,
  getHybridPythonEvidenceBundle,
} from '../../lib/hybrid-python';

export const hybridPythonRouter = Router();

const adminOpsRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT'] as const;
const routingPreviewQuerySchema = z.object({
  subjectKey: z.string().trim().min(1).max(160).optional(),
  forcePython: z.enum(['0', '1', 'false', 'true']).optional(),
  route: z.string().trim().min(1).max(240).optional(),
  jobType: hybridPythonJobTypeSchema.optional(),
});
const listJobsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  status: hybridPythonJobStatusSchema.optional(),
});
const jobStatusParamsSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(160),
});
const shadowLimitQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
const shadowComparisonQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  outcome: z.enum(['match', 'shape_mismatch', 'value_mismatch']).optional(),
});
const canaryRolloutRouteQuerySchema = z.object({
  route: z.string().trim().min(1).max(240).optional(),
});

const canaryGateQuerySchema = z.object({
  maxMismatchRate: z.coerce.number().min(0).max(1).default(0.05),
  maxFailedJobs: z.coerce.number().int().min(0).max(1000).default(0),
  minComparisons: z.coerce.number().int().min(0).max(10000).default(10),
});

function parseForcePython(value: unknown) {
  return value === '1' || value === 'true';
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function buildDomainIdempotencyKey(prefix: string, input: {
  organizationId?: string;
  actorUserId?: string;
  requestBody: unknown;
}) {
  const fingerprint = createHash('sha256')
    .update(stableJson({
      organizationId: input.organizationId ?? 'platform',
      actorUserId: input.actorUserId ?? 'unknown',
      requestBody: input.requestBody,
    }))
    .digest('hex')
    .slice(0, 32);
  return `${prefix}-${fingerprint}`;
}

hybridPythonRouter.use(requireAuth, allowRoles([...adminOpsRoles]));

hybridPythonRouter.get('/status', async (req, res) => {
  const status = await getHybridPythonServiceStatus(req.requestId);
  res.json({ ...status, requestId: req.requestId ?? null });
});

hybridPythonRouter.get('/routing-preview', async (req, res) => {
  const query = routingPreviewQuerySchema.parse(req.query);
  const decision = await resolveHybridPythonRoutingDecision({
    requestId: req.requestId,
    actorUserId: req.user?.userId,
    organizationId: req.user?.organizationId,
    subjectKey: query.subjectKey,
    forcePython: parseForcePython(query.forcePython),
    route: query.route,
    jobType: query.jobType,
  });
  res.json({ decision, requestId: req.requestId ?? null });
});

hybridPythonRouter.get('/release/checklist', async (req, res) => {
  const report = await getHybridPythonReleaseChecklist(req.requestId);
  res.json({ ...report, requestId: req.requestId ?? null });
});

hybridPythonRouter.get('/evidence/bundle', async (req, res) => {
  const bundle = await getHybridPythonEvidenceBundle(req.requestId);
  res.json({ ...bundle, requestId: req.requestId ?? null });
});

hybridPythonRouter.get('/jobs', async (req, res) => {
  const query = listJobsQuerySchema.parse(req.query);
  const records = await listHybridPythonJobs({
    requestId: req.requestId,
    limit: query.limit,
    status: query.status,
  });
  res.json({ jobs: records, count: records.length, limit: query.limit ?? 50, requestId: req.requestId ?? null });
});

hybridPythonRouter.get('/jobs/summary', async (req, res) => {
  const summary = await getHybridPythonJobSummary(req.requestId);
  res.json({ ...summary, requestId: req.requestId ?? null });
});

hybridPythonRouter.get('/jobs/metrics', async (req, res) => {
  const metrics = await getHybridPythonJobMetrics(req.requestId);
  res.json({ ...metrics, requestId: req.requestId ?? null });
});

hybridPythonRouter.get('/shadow/jobs', async (req, res) => {
  const query = shadowLimitQuerySchema.parse(req.query);
  const records = await getHybridPythonShadowRecords({ requestId: req.requestId, limit: query.limit });
  res.json({ ...records, requestId: req.requestId ?? null });
});

hybridPythonRouter.get('/shadow/comparisons', async (req, res) => {
  const query = shadowComparisonQuerySchema.parse(req.query);
  const records = await getHybridPythonShadowComparisons({
    requestId: req.requestId,
    limit: query.limit,
    outcome: query.outcome,
  });
  res.json({ ...records, requestId: req.requestId ?? null });
});

hybridPythonRouter.post('/shadow/comparisons', validateBody(hybridPythonShadowComparisonInputSchema), async (req, res) => {
  const result = await recordHybridPythonShadowComparison(
    {
      ...req.body,
      correlationId: req.body.correlationId ?? req.requestId,
      organizationId: req.body.organizationId ?? req.user?.organizationId,
      actorUserId: req.body.actorUserId ?? req.user?.userId,
    },
    req.requestId,
  );
  res.status(202).json({ ...result, requestId: req.requestId ?? null });
});

hybridPythonRouter.get('/canary/gate', async (req, res) => {
  const query = canaryGateQuerySchema.parse(req.query);
  const gate = await getHybridPythonCanaryGate({ ...query, requestId: req.requestId });
  res.json({ ...gate, requestId: req.requestId ?? null });
});

hybridPythonRouter.get('/canary/rollout', async (req, res) => {
  const query = canaryRolloutRouteQuerySchema.parse(req.query);
  const state = await getHybridPythonCanaryRollout({ route: query.route, requestId: req.requestId });
  res.json({ ...state, requestId: req.requestId ?? null });
});

hybridPythonRouter.post('/canary/rollout/plan', validateBody(hybridPythonCanaryRolloutPlanSchema), async (req, res) => {
  const state = await planHybridPythonCanaryRollout(
    {
      ...req.body,
      createdBy: req.body.createdBy ?? req.user?.userId,
    },
    req.requestId,
  );
  res.status(req.body.dryRun === false ? 202 : 200).json({ ...state, requestId: req.requestId ?? null });
});

hybridPythonRouter.post('/canary/rollout/advance', validateBody(hybridPythonCanaryRolloutActionSchema), async (req, res) => {
  const state = await advanceHybridPythonCanaryRollout(
    { ...req.body, actorUserId: req.body.actorUserId ?? req.user?.userId },
    req.requestId,
  );
  res.status(req.body.dryRun === false ? 202 : 200).json({ ...state, requestId: req.requestId ?? null });
});

hybridPythonRouter.post('/canary/rollout/pause', validateBody(hybridPythonCanaryRolloutActionSchema), async (req, res) => {
  const state = await pauseHybridPythonCanaryRollout(
    { ...req.body, actorUserId: req.body.actorUserId ?? req.user?.userId },
    req.requestId,
  );
  res.json({ ...state, requestId: req.requestId ?? null });
});

hybridPythonRouter.post('/canary/rollout/resume', validateBody(hybridPythonCanaryRolloutActionSchema), async (req, res) => {
  const state = await resumeHybridPythonCanaryRollout(
    { ...req.body, actorUserId: req.body.actorUserId ?? req.user?.userId },
    req.requestId,
  );
  res.json({ ...state, requestId: req.requestId ?? null });
});

hybridPythonRouter.post('/canary/rollout/rollback', validateBody(hybridPythonCanaryRolloutActionSchema), async (req, res) => {
  const state = await rollbackHybridPythonCanaryRollout(
    { ...req.body, actorUserId: req.body.actorUserId ?? req.user?.userId },
    req.requestId,
  );
  res.status(req.body.dryRun === false ? 202 : 200).json({ ...state, requestId: req.requestId ?? null });
});

hybridPythonRouter.post('/canary/assignment', validateBody(hybridPythonCanaryAssignmentRequestSchema), async (req, res) => {
  const assignment = await getHybridPythonCanaryAssignment(
    {
      ...req.body,
      organizationId: req.body.organizationId ?? req.user?.organizationId,
      actorUserId: req.body.actorUserId ?? req.user?.userId,
    },
    req.requestId,
  );
  res.json({ ...assignment, requestId: req.requestId ?? null });
});

hybridPythonRouter.get('/contracts/manifest', async (req, res) => {
  const manifest = await getHybridPythonContractManifest(req.requestId);
  res.json({ ...manifest, requestId: req.requestId ?? null });
});

hybridPythonRouter.get('/contracts/test-vectors', async (req, res) => {
  const vectors = await getHybridPythonContractTestVectors(req.requestId);
  res.json({ vectors, count: vectors.length, requestId: req.requestId ?? null });
});

hybridPythonRouter.post('/contracts/validate', validateBody(hybridPythonJobEnvelopeSchema), async (req, res) => {
  const report = await validateHybridPythonContract(
    {
      ...req.body,
      correlationId: req.body.correlationId ?? req.requestId,
      organizationId: req.body.organizationId ?? req.user?.organizationId,
      actorUserId: req.body.actorUserId ?? req.user?.userId,
    },
    req.requestId,
  );
  res.status(report.allowed ? 200 : 422).json({ ...report, requestId: req.requestId ?? null });
});

hybridPythonRouter.get('/rollout/readiness', async (req, res) => {
  const query = hybridPythonRolloutReadinessQuerySchema.parse(req.query);
  const report = await getHybridPythonRolloutReadiness({ ...query, requestId: req.requestId });
  res.json({ ...report, requestId: req.requestId ?? null });
});

hybridPythonRouter.post('/artifacts/gc', validateBody(hybridPythonArtifactGcSchema), async (req, res) => {
  const result = await runHybridPythonArtifactGc({ dryRun: req.body.dryRun, requestId: req.requestId });
  res.json({ ...result, requestId: req.requestId ?? null });
});

hybridPythonRouter.post('/jobs', validateBody(hybridPythonJobEnvelopeSchema), async (req, res) => {
  const result = await enqueueHybridPythonJob(req.body, {
    requestId: req.requestId,
    actorUserId: req.user?.userId,
    organizationId: req.user?.organizationId,
    forcePython: parseForcePython(req.query.forcePython),
  });

  res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
});

hybridPythonRouter.get('/jobs/:idempotencyKey', async (req, res) => {
  const params = jobStatusParamsSchema.parse(req.params);
  const record = await getHybridPythonJobStatus(params.idempotencyKey, req.requestId);
  res.json({ ...record, requestId: req.requestId ?? null });
});

hybridPythonRouter.post('/jobs/:idempotencyKey/cancel', validateBody(hybridPythonJobCancelSchema), async (req, res) => {
  const params = jobStatusParamsSchema.parse(req.params);
  const record = await cancelHybridPythonJob(params.idempotencyKey, req.body, req.requestId);
  res.json({ ...record, requestId: req.requestId ?? null });
});


hybridPythonRouter.post(
  '/platform/runbooks/freshness/review/prepare',
  validateBody(hybridPythonPlatformRunbookFreshnessReviewPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('platform-runbook-freshness-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body });
    const result = await runHybridPythonRunbookFreshnessReview({ jobType: 'platform.runbook_freshness_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, runbooks: req.body.runbooks, evidence: req.body.evidence, thresholds: req.body.thresholds, requiredRunbooks: req.body.requiredRunbooks, maxStalenessDays: req.body.maxStalenessDays, requireOwner: req.body.requireOwner, requireApproval: req.body.requireApproval } }, req.requestId);
    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);

hybridPythonRouter.post(
  '/platform/support/escalation/review/prepare',
  validateBody(hybridPythonPlatformSupportEscalationReviewPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('platform-support-escalation-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body });
    const result = await runHybridPythonSupportEscalationReview({ jobType: 'platform.support_escalation_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, supportTiers: req.body.supportTiers, escalationPaths: req.body.escalationPaths, evidence: req.body.evidence, thresholds: req.body.thresholds, require24x7: req.body.require24x7, requireNamedOwner: req.body.requireNamedOwner, requireCustomerComms: req.body.requireCustomerComms } }, req.requestId);
    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);



hybridPythonRouter.post('/platform/cost/guardrails/review/prepare', validateBody(hybridPythonPlatformCostGuardrailReviewPrepareSchema), async (req, res) => {
  const idempotencyKey = buildDomainIdempotencyKey('platform-cost-guardrail-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body });
  const result = await runHybridPythonCostGuardrailReview({ jobType: 'platform.cost_guardrail_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, costs: req.body.costs, budgets: req.body.budgets, forecast: req.body.forecast, thresholds: req.body.thresholds, evidence: req.body.evidence, requireForecast: req.body.requireForecast, requireWorkerCosts: req.body.requireWorkerCosts, requireArtifactStorageCosts: req.body.requireArtifactStorageCosts } }, req.requestId);
  res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
});

hybridPythonRouter.post('/platform/environment/parity/review/prepare', validateBody(hybridPythonPlatformEnvironmentParityReviewPrepareSchema), async (req, res) => {
  const idempotencyKey = buildDomainIdempotencyKey('platform-environment-parity-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body });
  const result = await runHybridPythonEnvironmentParityReview({ jobType: 'platform.environment_parity_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, staging: req.body.staging, production: req.body.production, requiredKeys: req.body.requiredKeys, requiredServices: req.body.requiredServices, driftAllowlist: req.body.driftAllowlist, evidence: req.body.evidence, requireHmacParity: req.body.requireHmacParity, requireSecretFingerprints: req.body.requireSecretFingerprints } }, req.requestId);
  res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
});



hybridPythonRouter.post('/platform/access-control/review/prepare', validateBody(hybridPythonPlatformAccessControlReviewPrepareSchema), async (req, res) => {
  const idempotencyKey = buildDomainIdempotencyKey('platform-access-control-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body });
  const result = await runHybridPythonAccessControlReview({ jobType: 'platform.access_control_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, controls: req.body.controls, authorizationMatrix: req.body.authorizationMatrix, abacPolicies: req.body.abacPolicies, objectAccessTests: req.body.objectAccessTests, negativeTests: req.body.negativeTests, testResults: req.body.testResults, evidence: req.body.evidence, thresholds: req.body.thresholds, requiredControls: req.body.requiredControls, requireBolaNegativeTests: req.body.requireBolaNegativeTests, requireCrossOrgDenies: req.body.requireCrossOrgDenies } }, req.requestId);
  res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
});

hybridPythonRouter.post('/platform/data-quality/review/prepare', validateBody(hybridPythonPlatformDataQualityReviewPrepareSchema), async (req, res) => {
  const idempotencyKey = buildDomainIdempotencyKey('platform-data-quality-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body });
  const result = await runHybridPythonDataQualityReview({ jobType: 'platform.data_quality_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, datasets: req.body.datasets, metrics: req.body.metrics, thresholds: req.body.thresholds, evidence: req.body.evidence, requiredChecks: req.body.requiredChecks, maxFreshnessMinutes: req.body.maxFreshnessMinutes, maxNullRate: req.body.maxNullRate, maxDuplicateRate: req.body.maxDuplicateRate, expectedSchemaVersion: req.body.expectedSchemaVersion, allowedPiiClasses: req.body.allowedPiiClasses, requireRedaction: req.body.requireRedaction } }, req.requestId);
  res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
});


hybridPythonRouter.post('/platform/ci-staging/validation/review/prepare', validateBody(hybridPythonPlatformCiStagingValidationReviewPrepareSchema), async (req, res) => {
  const idempotencyKey = buildDomainIdempotencyKey('platform-ci-staging-validation-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body });
  const result = await runHybridPythonCiStagingValidationReview({ jobType: 'platform.ci_staging_validation_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, checks: req.body.checks, builds: req.body.builds, docker: req.body.docker, hmac: req.body.hmac, redis: req.body.redis, artifactRegistry: req.body.artifactRegistry, canary: req.body.canary, observability: req.body.observability, evidence: req.body.evidence, requiredChecks: req.body.requiredChecks, requireSignedBridge: req.body.requireSignedBridge, requireDockerSmoke: req.body.requireDockerSmoke, requireTsBuild: req.body.requireTsBuild, requirePythonTests: req.body.requirePythonTests } }, req.requestId);
  res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
});

hybridPythonRouter.post('/platform/release/closure/review/prepare', validateBody(hybridPythonPlatformReleaseClosureReviewPrepareSchema), async (req, res) => {
  const idempotencyKey = buildDomainIdempotencyKey('platform-release-closure-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body });
  const result = await runHybridPythonReleaseClosureReview({ jobType: 'platform.release_closure_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, gateResults: req.body.gateResults, evidenceBundle: req.body.evidenceBundle, validationSummary: req.body.validationSummary, risks: req.body.risks, approvals: req.body.approvals, requiredGates: req.body.requiredGates, requireEvidenceBundle: req.body.requireEvidenceBundle, requireApprovals: req.body.requireApprovals, allowKnownRisks: req.body.allowKnownRisks } }, req.requestId);
  res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
});


hybridPythonRouter.post('/platform/production-canary/observation/review/prepare', validateBody(hybridPythonPlatformProductionCanaryObservationReviewPrepareSchema), async (req, res) => {
  const idempotencyKey = buildDomainIdempotencyKey('platform-production-canary-observation-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body });
  const result = await runHybridPythonProductionCanaryObservationReview({ jobType: 'platform.production_canary_observation_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, windowMinutes: req.body.windowMinutes, currentCanaryPercent: req.body.currentCanaryPercent, targetCanaryPercent: req.body.targetCanaryPercent, metrics: req.body.metrics, thresholds: req.body.thresholds, signals: req.body.signals, evidence: req.body.evidence, rollbackTriggers: req.body.rollbackTriggers, requiredSignals: req.body.requiredSignals, requireRollbackTriggers: req.body.requireRollbackTriggers, maxErrorRate: req.body.maxErrorRate, maxP95LatencyMs: req.body.maxP95LatencyMs, maxMismatchRate: req.body.maxMismatchRate, maxFailedJobs: req.body.maxFailedJobs, maxQueueLagSeconds: req.body.maxQueueLagSeconds, maxArtifactFailures: req.body.maxArtifactFailures, minSampleSize: req.body.minSampleSize } }, req.requestId);
  res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
});

hybridPythonRouter.post('/platform/incident-response/readiness/review/prepare', validateBody(hybridPythonPlatformIncidentResponseReadinessReviewPrepareSchema), async (req, res) => {
  const idempotencyKey = buildDomainIdempotencyKey('platform-incident-response-readiness-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body });
  const result = await runHybridPythonIncidentResponseReadinessReview({ jobType: 'platform.incident_response_readiness_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, oncall: req.body.oncall, escalationPaths: req.body.escalationPaths, runbooks: req.body.runbooks, comms: req.body.comms, drills: req.body.drills, thresholds: req.body.thresholds, evidence: req.body.evidence, requiredCoverage: req.body.requiredCoverage, requireRecentDrill: req.body.requireRecentDrill, maxAckMinutes: req.body.maxAckMinutes, maxEscalationMinutes: req.body.maxEscalationMinutes } }, req.requestId);
  res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
});

hybridPythonRouter.post('/platform/traffic/promotion/readiness/review/prepare', validateBody(hybridPythonPlatformTrafficPromotionReadinessReviewPrepareSchema), async (req, res) => {
  const idempotencyKey = buildDomainIdempotencyKey('platform-traffic-promotion-readiness-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body });
  const result = await runHybridPythonTrafficPromotionReadinessReview({ jobType: 'platform.traffic_promotion_readiness_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, currentCanaryPercent: req.body.currentCanaryPercent, targetCanaryPercent: req.body.targetCanaryPercent, maxPromotionStepPercent: req.body.maxPromotionStepPercent, gateEvidence: req.body.gateEvidence, productionObservation: req.body.productionObservation, incidentReadiness: req.body.incidentReadiness, approvals: req.body.approvals, freezeWindows: req.body.freezeWindows, rollbackPlan: req.body.rollbackPlan, evidence: req.body.evidence, thresholds: req.body.thresholds, requiredGates: req.body.requiredGates, requireOperatorApproval: req.body.requireOperatorApproval, requireCleanObservation: req.body.requireCleanObservation, requireIncidentReadiness: req.body.requireIncidentReadiness } }, req.requestId);
  res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
});

hybridPythonRouter.post('/platform/evidence/retention/audit/review/prepare', validateBody(hybridPythonPlatformEvidenceRetentionAuditReviewPrepareSchema), async (req, res) => {
  const idempotencyKey = buildDomainIdempotencyKey('platform-evidence-retention-audit-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body });
  const result = await runHybridPythonEvidenceRetentionAuditReview({ jobType: 'platform.evidence_retention_audit_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, artifacts: req.body.artifacts, evidenceBundle: req.body.evidenceBundle, retentionPolicy: req.body.retentionPolicy, requiredArtifactTypes: req.body.requiredArtifactTypes, allowedPiiClasses: req.body.allowedPiiClasses, requireChecksums: req.body.requireChecksums, requireProtectedDownloads: req.body.requireProtectedDownloads, requireRedaction: req.body.requireRedaction, minRetentionDays: req.body.minRetentionDays, evidence: req.body.evidence } }, req.requestId);
  res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
});

hybridPythonRouter.post('/platform/slo/error-budget/review/prepare', validateBody(hybridPythonPlatformSloErrorBudgetReviewPrepareSchema), async (req, res) => {
  const idempotencyKey = buildDomainIdempotencyKey('platform-slo-error-budget-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body });
  const result = await runHybridPythonSloErrorBudgetReview({ jobType: 'platform.slo_error_budget_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, windowMinutes: req.body.windowMinutes, sloTargets: req.body.sloTargets, metrics: req.body.metrics, services: req.body.services, thresholds: req.body.thresholds, evidence: req.body.evidence, requiredSignals: req.body.requiredSignals, maxBurnRate: req.body.maxBurnRate, minErrorBudgetRemaining: req.body.minErrorBudgetRemaining, maxP95LatencyMs: req.body.maxP95LatencyMs, maxErrorRate: req.body.maxErrorRate, minSampleSize: req.body.minSampleSize, requireAlertCoverage: req.body.requireAlertCoverage } }, req.requestId);
  res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
});

hybridPythonRouter.post('/platform/auto-rollback/safeguard/review/prepare', validateBody(hybridPythonPlatformAutoRollbackSafeguardReviewPrepareSchema), async (req, res) => {
  const idempotencyKey = buildDomainIdempotencyKey('platform-auto-rollback-safeguard-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body });
  const result = await runHybridPythonAutoRollbackSafeguardReview({ jobType: 'platform.auto_rollback_safeguard_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, rolloutId: req.body.rolloutId, canaryPercent: req.body.canaryPercent, safeguards: req.body.safeguards, rollbackTriggers: req.body.rollbackTriggers, featureFlags: req.body.featureFlags, runbook: req.body.runbook, evidence: req.body.evidence, requiredSafeguards: req.body.requiredSafeguards, maxDetectionMinutes: req.body.maxDetectionMinutes, maxRollbackMinutes: req.body.maxRollbackMinutes, requireManualOverride: req.body.requireManualOverride, requireNodeFallback: req.body.requireNodeFallback, requireKillSwitch: req.body.requireKillSwitch } }, req.requestId);
  res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
});


hybridPythonRouter.post('/platform/third-party/dependencies/review/prepare', validateBody(hybridPythonPlatformThirdPartyDependencyReviewPrepareSchema), async (req, res) => {
  const idempotencyKey = buildDomainIdempotencyKey('platform-third-party-dependency-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body });
  const result = await runHybridPythonThirdPartyDependencyReview({ jobType: 'platform.third_party_dependency_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, dependencies: req.body.dependencies, providers: req.body.providers, incidents: req.body.incidents, statusPages: req.body.statusPages, thresholds: req.body.thresholds, evidence: req.body.evidence, requiredDependencies: req.body.requiredDependencies, maxErrorRate: req.body.maxErrorRate, maxP95LatencyMs: req.body.maxP95LatencyMs, minRateLimitHeadroomPercent: req.body.minRateLimitHeadroomPercent, requireFailoverEvidence: req.body.requireFailoverEvidence, requireStatusPageClear: req.body.requireStatusPageClear } }, req.requestId);
  res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
});

hybridPythonRouter.post('/platform/capacity/scaling/readiness/review/prepare', validateBody(hybridPythonPlatformCapacityScalingReadinessReviewPrepareSchema), async (req, res) => {
  const idempotencyKey = buildDomainIdempotencyKey('platform-capacity-scaling-readiness-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body });
  const result = await runHybridPythonCapacityScalingReadinessReview({ jobType: 'platform.capacity_scaling_readiness_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, currentCanaryPercent: req.body.currentCanaryPercent, targetCanaryPercent: req.body.targetCanaryPercent, metrics: req.body.metrics, queues: req.body.queues, workers: req.body.workers, autoscaling: req.body.autoscaling, loadTest: req.body.loadTest, thresholds: req.body.thresholds, evidence: req.body.evidence, requiredSignals: req.body.requiredSignals, maxQueueLagSeconds: req.body.maxQueueLagSeconds, maxCpuPercent: req.body.maxCpuPercent, maxMemoryPercent: req.body.maxMemoryPercent, maxP95LatencyMs: req.body.maxP95LatencyMs, minWorkerConcurrency: req.body.minWorkerConcurrency, requireLoadTest: req.body.requireLoadTest, requireAutoscaling: req.body.requireAutoscaling } }, req.requestId);
  res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
});


hybridPythonRouter.post('/platform/compliance/privacy/evidence/review/prepare', validateBody(hybridPythonPlatformCompliancePrivacyEvidenceReviewPrepareSchema), async (req, res) => {
  const idempotencyKey = buildDomainIdempotencyKey('platform-compliance-privacy-evidence-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body });
  const result = await runHybridPythonCompliancePrivacyEvidenceReview({ jobType: 'platform.compliance_privacy_evidence_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, evidence: req.body.evidence, artifacts: req.body.artifacts, privacyReviews: req.body.privacyReviews, complianceControls: req.body.complianceControls, dpia: req.body.dpia, dpaRecords: req.body.dpaRecords, approvals: req.body.approvals, requiredEvidence: req.body.requiredEvidence, allowedPiiClasses: req.body.allowedPiiClasses, requireDpia: req.body.requireDpia, requireDpa: req.body.requireDpa, requireRedaction: req.body.requireRedaction, requireApprovals: req.body.requireApprovals } }, req.requestId);
  res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
});

hybridPythonRouter.post('/platform/runbooks/drills/verification/review/prepare', validateBody(hybridPythonPlatformRunbookDrillVerificationReviewPrepareSchema), async (req, res) => {
  const idempotencyKey = buildDomainIdempotencyKey('platform-runbook-drill-verification-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body });
  const result = await runHybridPythonRunbookDrillVerificationReview({ jobType: 'platform.runbook_drill_verification_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, runbooks: req.body.runbooks, drills: req.body.drills, scenarios: req.body.scenarios, evidence: req.body.evidence, requiredRunbooks: req.body.requiredRunbooks, requiredDrills: req.body.requiredDrills, maxRunbookAgeDays: req.body.maxRunbookAgeDays, maxDrillAgeDays: req.body.maxDrillAgeDays, requireRecentDrill: req.body.requireRecentDrill, requireOwnerAck: req.body.requireOwnerAck } }, req.requestId);
  res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
});

hybridPythonRouter.post(
  '/admin/audit-export/prepare',
  validateBody(hybridPythonAuditExportPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('audit-export', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await enqueueHybridPythonJob(
      {
        jobType: 'admin.audit_export',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: req.body.dryRun,
        payload: {
          filters: req.body.filters,
          format: req.body.format,
          maxRows: req.body.maxRows,
          includePhi: req.body.includePhi,
          rows: req.body.rows,
        },
      },
      {
        requestId: req.requestId,
        actorUserId: req.user?.userId,
        organizationId: req.user?.organizationId,
        forcePython: parseForcePython(req.query.forcePython),
      },
    );

    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);

hybridPythonRouter.post(
  '/admin/accounts/bulk-validate/prepare',
  validateBody(hybridPythonAccountsBulkValidatePrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('accounts-bulk-validate', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await enqueueHybridPythonJob(
      {
        jobType: 'admin.accounts_bulk_validate',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: req.body.dryRun,
        payload: {
          rows: req.body.rows ?? [],
          csvText: req.body.csvText,
          allowedRoles: req.body.allowedRoles,
          allowedEmailDomains: req.body.allowedEmailDomains,
          requireOrganization: req.body.requireOrganization,
        },
      },
      {
        requestId: req.requestId,
        actorUserId: req.user?.userId,
        organizationId: req.user?.organizationId,
        forcePython: parseForcePython(req.query.forcePython),
      },
    );

    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);


hybridPythonRouter.post(
  '/admin/accounts/read-model/prepare',
  validateBody(hybridPythonAccountsReadModelPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('accounts-read-model', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await enqueueHybridPythonJob(
      {
        jobType: 'admin.accounts_read_model',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: req.body.dryRun,
        payload: {
          rows: req.body.rows ?? [],
          cursor: req.body.cursor,
          limit: req.body.limit,
          filters: req.body.filters,
          sort: req.body.sort,
          includeTotals: req.body.includeTotals,
        },
      },
      {
        requestId: req.requestId,
        actorUserId: req.user?.userId,
        organizationId: req.user?.organizationId,
        route: '/api/hybrid-python/admin/accounts/read-model/prepare',
        forcePython: parseForcePython(req.query.forcePython),
      },
    );

    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);

hybridPythonRouter.post(
  '/admin/provider-roles/reconcile/prepare',
  validateBody(hybridPythonProviderRoleReconcilePrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('provider-role-reconcile', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await enqueueHybridPythonJob(
      {
        jobType: 'admin.provider_role_reconcile',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: true,
        payload: {
          schemaModels: req.body.schemaModels,
          schemaFields: req.body.schemaFields,
          migrationModels: req.body.migrationModels,
          codeReferences: req.body.codeReferences,
          providerRows: req.body.providerRows,
          expectedRoleCatalogModel: req.body.expectedRoleCatalogModel,
          expectedProviderRoleField: req.body.expectedProviderRoleField,
        },
      },
      {
        requestId: req.requestId,
        actorUserId: req.user?.userId,
        organizationId: req.user?.organizationId,
        route: '/api/hybrid-python/admin/provider-roles/reconcile/prepare',
        forcePython: parseForcePython(req.query.forcePython),
      },
    );

    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);

hybridPythonRouter.post(
  '/scheduling/availability/snapshot/prepare',
  validateBody(hybridPythonSchedulingAvailabilitySnapshotPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('availability-snapshot', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await enqueueHybridPythonJob(
      {
        jobType: 'scheduling.availability_snapshot',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: req.body.dryRun,
        payload: {
          timezone: req.body.timezone,
          groupBy: req.body.groupBy,
          includeWindowSample: req.body.includeWindowSample,
          windows: req.body.windows ?? [],
        },
      },
      {
        requestId: req.requestId,
        actorUserId: req.user?.userId,
        organizationId: req.user?.organizationId,
        route: '/api/hybrid-python/scheduling/availability/snapshot/prepare',
        forcePython: parseForcePython(req.query.forcePython),
      },
    );

    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);

hybridPythonRouter.post(
  '/messaging/reminders/plan/prepare',
  validateBody(hybridPythonMessagingReminderPlanPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('reminder-plan', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await enqueueHybridPythonJob(
      {
        jobType: 'messaging.reminder_plan',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: true,
        payload: {
          channel: req.body.channel,
          templateId: req.body.templateId,
          recipientHashes: req.body.recipientHashes,
          recipients: req.body.recipients,
          variables: req.body.variables,
          sendAfter: req.body.sendAfter,
          batchSize: req.body.batchSize,
        },
      },
      {
        requestId: req.requestId,
        actorUserId: req.user?.userId,
        organizationId: req.user?.organizationId,
        route: '/api/hybrid-python/messaging/reminders/plan/prepare',
        forcePython: parseForcePython(req.query.forcePython),
      },
    );

    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);



hybridPythonRouter.post(
  '/billing/payments/reconcile/prepare',
  validateBody(hybridPythonBillingPaymentReconcilePrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('billing-payment-reconcile', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await enqueueHybridPythonJob(
      {
        jobType: 'billing.payment_reconcile',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: req.body.dryRun,
        payload: {
          gateway: req.body.gateway,
          currency: req.body.currency,
          toleranceMinor: req.body.toleranceMinor,
          includeRowSample: req.body.includeRowSample,
          rows: req.body.rows ?? [],
        },
      },
      {
        requestId: req.requestId,
        actorUserId: req.user?.userId,
        organizationId: req.user?.organizationId,
        route: '/api/hybrid-python/billing/payments/reconcile/prepare',
        forcePython: parseForcePython(req.query.forcePython),
      },
    );

    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);

hybridPythonRouter.post(
  '/clinical/records/access-audit/prepare',
  validateBody(hybridPythonClinicalRecordsAccessAuditPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('clinical-records-access-audit', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await enqueueHybridPythonJob(
      {
        jobType: 'clinical.records_access_audit',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: true,
        payload: {
          window: req.body.window,
          anomalyThresholds: req.body.anomalyThresholds,
          includeEventSample: req.body.includeEventSample,
          events: req.body.events ?? [],
        },
      },
      {
        requestId: req.requestId,
        actorUserId: req.user?.userId,
        organizationId: req.user?.organizationId,
        route: '/api/hybrid-python/clinical/records/access-audit/prepare',
        forcePython: parseForcePython(req.query.forcePython),
      },
    );

    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);

hybridPythonRouter.post(
  '/platform/db-index-advisory/prepare',
  validateBody(hybridPythonPlatformDbIndexAdvisoryPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('platform-db-index-advisory', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await enqueueHybridPythonJob(
      {
        jobType: 'platform.db_index_advisory',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: true,
        payload: {
          models: req.body.models ?? [],
          queries: req.body.queries ?? [],
          includePrismaHints: req.body.includePrismaHints,
          targetP95Ms: req.body.targetP95Ms,
        },
      },
      {
        requestId: req.requestId,
        actorUserId: req.user?.userId,
        organizationId: req.user?.organizationId,
        route: '/api/hybrid-python/platform/db-index-advisory/prepare',
        forcePython: parseForcePython(req.query.forcePython),
      },
    );

    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);

hybridPythonRouter.post(
  '/platform/slo-regression/report/prepare',
  validateBody(hybridPythonPlatformSloRegressionReportPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('platform-slo-regression-report', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await enqueueHybridPythonJob(
      {
        jobType: 'platform.slo_regression_report',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: true,
        payload: {
          route: req.body.route,
          baselineSamplesMs: req.body.baselineSamplesMs ?? [],
          currentSamplesMs: req.body.currentSamplesMs ?? [],
          baselineErrorCount: req.body.baselineErrorCount,
          currentErrorCount: req.body.currentErrorCount,
          baselineRequestCount: req.body.baselineRequestCount,
          currentRequestCount: req.body.currentRequestCount,
          thresholds: req.body.thresholds ?? {},
          dimensions: req.body.dimensions ?? {},
        },
      },
      {
        requestId: req.requestId,
        actorUserId: req.user?.userId,
        organizationId: req.user?.organizationId,
        route: '/api/hybrid-python/platform/slo-regression/report/prepare',
        forcePython: parseForcePython(req.query.forcePython),
      },
    );

    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);

hybridPythonRouter.post(
  '/platform/contracts/replay/prepare',
  validateBody(hybridPythonPlatformContractReplayPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('platform-contract-replay', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await replayHybridPythonContracts(
      {
        jobType: 'platform.contract_replay',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: true,
        payload: {
          jobTypes: req.body.jobTypes ?? [],
          contractIds: req.body.contractIds ?? [],
          vectorIds: req.body.vectorIds ?? [],
          failFast: req.body.failFast,
          includeSuccessfulResults: req.body.includeSuccessfulResults,
          maxVectors: req.body.maxVectors,
        },
      },
      req.requestId,
    );

    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);

hybridPythonRouter.post(
  '/platform/privacy/preflight/prepare',
  validateBody(hybridPythonPlatformPrivacyPreflightPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('platform-privacy-preflight', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await runHybridPythonPrivacyPreflight(
      {
        jobType: 'platform.privacy_preflight',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: true,
        payload: {
          candidates: req.body.candidates ?? [],
          failOnWarnings: req.body.failOnWarnings,
        },
      },
      req.requestId,
    );

    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);


hybridPythonRouter.post(
  '/platform/release/decision/prepare',
  validateBody(hybridPythonPlatformReleaseDecisionPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('platform-release-decision', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await runHybridPythonReleaseDecision(
      {
        jobType: 'platform.release_decision',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: true,
        payload: {
          releaseId: req.body.releaseId,
          targetCanaryPercent: req.body.targetCanaryPercent,
          route: req.body.route,
          jobTypes: req.body.jobTypes ?? [],
          gate: req.body.gate ?? {},
          checklist: req.body.checklist ?? {},
          contractReplay: req.body.contractReplay ?? {},
          privacyPreflight: req.body.privacyPreflight ?? {},
          sloRegression: req.body.sloRegression ?? {},
          rollout: req.body.rollout ?? {},
          evidence: req.body.evidence ?? {},
          allowWarn: req.body.allowWarn,
        },
      },
      req.requestId,
    );

    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);

hybridPythonRouter.post(
  '/platform/rollback/drill/prepare',
  validateBody(hybridPythonPlatformRollbackDrillPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('platform-rollback-drill', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await runHybridPythonRollbackDrill(
      {
        jobType: 'platform.rollback_drill',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: true,
        payload: {
          route: req.body.route,
          jobTypes: req.body.jobTypes ?? [],
          trigger: req.body.trigger,
          observedMetrics: req.body.observedMetrics ?? {},
          operators: req.body.operators ?? [],
          requireEvidenceBundle: req.body.requireEvidenceBundle,
          includeCommands: req.body.includeCommands,
        },
      },
      req.requestId,
    );

    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);



hybridPythonRouter.post(
  '/platform/post-deploy/verify/prepare',
  validateBody(hybridPythonPlatformPostDeployVerifyPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('platform-post-deploy-verify', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await runHybridPythonPostDeployVerify(
      {
        jobType: 'platform.post_deploy_verify',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: true,
        payload: {
          releaseId: req.body.releaseId,
          route: req.body.route,
          jobTypes: req.body.jobTypes ?? [],
          targetCanaryPercent: req.body.targetCanaryPercent,
          healthChecks: req.body.healthChecks ?? [],
          smokeChecks: req.body.smokeChecks ?? [],
          sloRegression: req.body.sloRegression ?? {},
          releaseDecision: req.body.releaseDecision ?? {},
          rollout: req.body.rollout ?? {},
          jobSummary: req.body.jobSummary ?? {},
          comparisonSummary: req.body.comparisonSummary ?? {},
          privacyPreflight: req.body.privacyPreflight ?? {},
          requireCleanPrivacy: req.body.requireCleanPrivacy,
        },
      },
      req.requestId,
    );

    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);

hybridPythonRouter.post(
  '/platform/change-ticket/bundle/prepare',
  validateBody(hybridPythonPlatformChangeTicketBundlePrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('platform-change-ticket-bundle', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await runHybridPythonChangeTicketBundle(
      {
        jobType: 'platform.change_ticket_bundle',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: true,
        payload: {
          changeId: req.body.changeId,
          releaseId: req.body.releaseId,
          route: req.body.route,
          jobTypes: req.body.jobTypes ?? [],
          evidenceBundle: req.body.evidenceBundle ?? {},
          releaseDecision: req.body.releaseDecision ?? {},
          rollbackDrill: req.body.rollbackDrill ?? {},
          contractReplay: req.body.contractReplay ?? {},
          privacyPreflight: req.body.privacyPreflight ?? {},
          sloRegression: req.body.sloRegression ?? {},
          artifactRefs: req.body.artifactRefs ?? [],
          approvals: req.body.approvals ?? [],
          includeRunbook: req.body.includeRunbook,
        },
      },
      req.requestId,
    );

    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);

hybridPythonRouter.post(
  '/platform/disaster-recovery/backups/review/prepare',
  validateBody(hybridPythonPlatformDisasterRecoveryBackupReviewPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('platform-disaster-recovery-backup-review', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await runHybridPythonDisasterRecoveryBackupReview(
      {
        jobType: 'platform.disaster_recovery_backup_review',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: true,
        payload: {
          releaseId: req.body.releaseId,
          domain: req.body.domain,
          route: req.body.route,
          jobTypes: req.body.jobTypes,
          backups: req.body.backups,
          restoreDrills: req.body.restoreDrills,
          dependencies: req.body.dependencies,
          rpoRtoTargets: req.body.rpoRtoTargets,
          thresholds: req.body.thresholds,
          evidence: req.body.evidence,
          requiredBackups: req.body.requiredBackups,
          maxBackupAgeHours: req.body.maxBackupAgeHours,
          maxRestoreAgeDays: req.body.maxRestoreAgeDays,
          maxRpoMinutes: req.body.maxRpoMinutes,
          maxRtoMinutes: req.body.maxRtoMinutes,
          requireEncryption: req.body.requireEncryption,
          requireRestoreDrill: req.body.requireRestoreDrill,
          requireOffsiteCopy: req.body.requireOffsiteCopy,
        },
      },
      req.requestId,
    );
    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);

hybridPythonRouter.post(
  '/platform/change-migration/readiness/review/prepare',
  validateBody(hybridPythonPlatformChangeMigrationReadinessReviewPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('platform-change-migration-readiness-review', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await runHybridPythonChangeMigrationReadinessReview(
      {
        jobType: 'platform.change_migration_readiness_review',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: true,
        payload: {
          releaseId: req.body.releaseId,
          domain: req.body.domain,
          route: req.body.route,
          jobTypes: req.body.jobTypes,
          migrations: req.body.migrations,
          changeTickets: req.body.changeTickets,
          approvals: req.body.approvals,
          rollbackPlan: req.body.rollbackPlan,
          rolloutPlan: req.body.rolloutPlan,
          dataBackfill: req.body.dataBackfill,
          evidence: req.body.evidence,
          requiredMigrations: req.body.requiredMigrations,
          maxTicketAgeDays: req.body.maxTicketAgeDays,
          requireApproval: req.body.requireApproval,
          requireRollbackPlan: req.body.requireRollbackPlan,
          requireBackupBeforeMigration: req.body.requireBackupBeforeMigration,
          requireDryRunRehearsal: req.body.requireDryRunRehearsal,
        },
      },
      req.requestId,
    );
    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);

hybridPythonRouter.post('/platform/configuration/secrets/rotation/review/prepare', validateBody(hybridPythonPlatformConfigurationSecretRotationReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-configuration-secret-rotation-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonConfigurationSecretRotationReview({ jobType: 'platform.configuration_secret_rotation_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, secrets: req.body.secrets, configItems: req.body.configItems, rotations: req.body.rotations, evidence: req.body.evidence, requiredSecrets: req.body.requiredSecrets, maxSecretAgeDays: req.body.maxSecretAgeDays, maxConfigDriftCount: req.body.maxConfigDriftCount, requireRotationWindow: req.body.requireRotationWindow, requireExternalSecretStore: req.body.requireExternalSecretStore, requireBreakGlass: req.body.requireBreakGlass } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/maintenance/window/readiness/review/prepare', validateBody(hybridPythonPlatformMaintenanceWindowReadinessReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-maintenance-window-readiness-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonMaintenanceWindowReadinessReview({ jobType: 'platform.maintenance_window_readiness_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, maintenanceWindows: req.body.maintenanceWindows, tasks: req.body.tasks, freezePeriods: req.body.freezePeriods, approvals: req.body.approvals, comms: req.body.comms, evidence: req.body.evidence, requiredTasks: req.body.requiredTasks, maxWindowAgeDays: req.body.maxWindowAgeDays, requireApproval: req.body.requireApproval, requireComms: req.body.requireComms, requireRollbackTask: req.body.requireRollbackTask, requireLowTrafficWindow: req.body.requireLowTrafficWindow } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });


hybridPythonRouter.post('/platform/audit-forensics/readiness/review/prepare', validateBody(hybridPythonPlatformAuditForensicsReadinessReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-audit-forensics-readiness-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonAuditForensicsReadinessReview({ jobType: 'platform.audit_forensics_readiness_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, auditTrails: req.body.auditTrails, forensicArtifacts: req.body.forensicArtifacts, investigationDrills: req.body.investigationDrills, chainOfCustody: req.body.chainOfCustody, evidence: req.body.evidence, requiredSources: req.body.requiredSources, maxAuditGapMinutes: req.body.maxAuditGapMinutes, maxArtifactAgeDays: req.body.maxArtifactAgeDays, requireImmutableStorage: req.body.requireImmutableStorage, requireChainOfCustody: req.body.requireChainOfCustody, requireInvestigationDrill: req.body.requireInvestigationDrill } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/business-continuity/readiness/review/prepare', validateBody(hybridPythonPlatformBusinessContinuityReadinessReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-business-continuity-readiness-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonBusinessContinuityReadinessReview({ jobType: 'platform.business_continuity_readiness_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, continuityPlans: req.body.continuityPlans, teams: req.body.teams, communications: req.body.communications, fallbackProcedures: req.body.fallbackProcedures, exercises: req.body.exercises, evidence: req.body.evidence, requiredPlans: req.body.requiredPlans, maxExerciseAgeDays: req.body.maxExerciseAgeDays, requireOwnerAck: req.body.requireOwnerAck, requireComms: req.body.requireComms, requireFallback: req.body.requireFallback, requireExercise: req.body.requireExercise } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/post-incident/learning/review/prepare', validateBody(hybridPythonPlatformPostIncidentLearningReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-post-incident-learning-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonPostIncidentLearningReview({ jobType: 'platform.post_incident_learning_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, incidents: req.body.incidents, postmortems: req.body.postmortems, actionItems: req.body.actionItems, regressions: req.body.regressions, evidence: req.body.evidence, requiredIncidentClasses: req.body.requiredIncidentClasses, maxOpenActionItemAgeDays: req.body.maxOpenActionItemAgeDays, requirePostmortem: req.body.requirePostmortem, requireOwnerAck: req.body.requireOwnerAck, requireRegressionTest: req.body.requireRegressionTest } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/tech-debt/governance/review/prepare', validateBody(hybridPythonPlatformTechDebtGovernanceReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-tech-debt-governance-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonTechDebtGovernanceReview({ jobType: 'platform.tech_debt_governance_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, debtItems: req.body.debtItems, waivers: req.body.waivers, ownership: req.body.ownership, remediationPlan: req.body.remediationPlan, evidence: req.body.evidence, requiredCategories: req.body.requiredCategories, maxCriticalDebtItems: req.body.maxCriticalDebtItems, maxWaiverAgeDays: req.body.maxWaiverAgeDays, requireOwnerAck: req.body.requireOwnerAck, requireRemediationPlan: req.body.requireRemediationPlan } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });


hybridPythonRouter.post(
  '/analytics/snapshot/prepare',
  validateBody(hybridPythonAnalyticsSnapshotPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('analytics-snapshot', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await enqueueHybridPythonJob(
      {
        jobType: 'analytics.snapshot',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: req.body.dryRun,
        payload: {
          metric: req.body.metric,
          values: req.body.values,
          dimensions: req.body.dimensions,
        },
      },
      {
        requestId: req.requestId,
        actorUserId: req.user?.userId,
        organizationId: req.user?.organizationId,
        forcePython: parseForcePython(req.query.forcePython),
      },
    );

    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);

hybridPythonRouter.post(
  '/platform/operational/handoff/prepare',
  validateBody(hybridPythonPlatformOperationalHandoffPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('platform-operational-handoff', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await runHybridPythonOperationalHandoff(
      {
        jobType: 'platform.operational_handoff',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: true,
        payload: {
          releaseId: req.body.releaseId,
          route: req.body.route,
          jobTypes: req.body.jobTypes,
          ownerContacts: req.body.ownerContacts,
          dashboardLinks: req.body.dashboardLinks,
          alertPolicies: req.body.alertPolicies,
          runbookLinks: req.body.runbookLinks,
          knownRisks: req.body.knownRisks,
          supportWindows: req.body.supportWindows,
          artifactRefs: req.body.artifactRefs,
          includeQuickstart: req.body.includeQuickstart,
        },
      },
      req.requestId,
    );

    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);

hybridPythonRouter.post(
  '/platform/incidents/simulate/prepare',
  validateBody(hybridPythonPlatformIncidentSimulationPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('platform-incident-simulation', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await runHybridPythonIncidentSimulation(
      {
        jobType: 'platform.incident_simulation',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: true,
        payload: {
          scenario: req.body.scenario,
          route: req.body.route,
          jobTypes: req.body.jobTypes,
          observedMetrics: req.body.observedMetrics,
          gate: req.body.gate,
          slo: req.body.slo,
          privacy: req.body.privacy,
          rollout: req.body.rollout,
          operators: req.body.operators,
          includeCommands: req.body.includeCommands,
        },
      },
      req.requestId,
    );

    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);


hybridPythonRouter.post(
  '/platform/capacity/plan/prepare',
  validateBody(hybridPythonPlatformCapacityPlanPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('platform-capacity-plan', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await runHybridPythonCapacityPlan(
      {
        jobType: 'platform.capacity_plan',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: true,
        payload: {
          releaseId: req.body.releaseId,
          route: req.body.route,
          jobTypes: req.body.jobTypes,
          targetCanaryPercent: req.body.targetCanaryPercent,
          expectedRequestsPerMinute: req.body.expectedRequestsPerMinute,
          averageDurationMs: req.body.averageDurationMs,
          p95DurationMs: req.body.p95DurationMs,
          queueDepth: req.body.queueDepth,
          maxQueueWaitSeconds: req.body.maxQueueWaitSeconds,
          currentWorkerCount: req.body.currentWorkerCount,
          workerConcurrency: req.body.workerConcurrency,
          targetUtilization: req.body.targetUtilization,
          observedErrorRate: req.body.observedErrorRate,
          backlogGrowthPerMinute: req.body.backlogGrowthPerMinute,
          dependencies: req.body.dependencies,
        },
      },
      req.requestId,
    );

    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);

hybridPythonRouter.post(
  '/platform/alerts/review/prepare',
  validateBody(hybridPythonPlatformAlertPolicyReviewPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('platform-alert-policy-review', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await runHybridPythonAlertPolicyReview(
      {
        jobType: 'platform.alert_policy_review',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: true,
        payload: {
          releaseId: req.body.releaseId,
          route: req.body.route,
          jobTypes: req.body.jobTypes,
          alertPolicies: req.body.alertPolicies,
          dashboardLinks: req.body.dashboardLinks,
          requiredSignals: req.body.requiredSignals,
          minPolicyCount: req.body.minPolicyCount,
          requireOnCall: req.body.requireOnCall,
        },
      },
      req.requestId,
    );

    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);


hybridPythonRouter.post(
  '/platform/dependencies/readiness/prepare',
  validateBody(hybridPythonPlatformDependencyReadinessPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('platform-dependency-readiness', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await runHybridPythonDependencyReadiness(
      {
        jobType: 'platform.dependency_readiness',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: true,
        payload: {
          releaseId: req.body.releaseId,
          route: req.body.route,
          jobTypes: req.body.jobTypes,
          dependencies: req.body.dependencies,
          requiredDependencies: req.body.requiredDependencies,
          minHealthyPercent: req.body.minHealthyPercent,
          failOnCritical: req.body.failOnCritical,
        },
      },
      req.requestId,
    );

    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);

hybridPythonRouter.post(
  '/platform/production/readiness/prepare',
  validateBody(hybridPythonPlatformProductionReadinessPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('platform-production-readiness', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await runHybridPythonProductionReadiness(
      {
        jobType: 'platform.production_readiness',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: true,
        payload: {
          releaseId: req.body.releaseId,
          route: req.body.route,
          jobTypes: req.body.jobTypes,
          targetCanaryPercent: req.body.targetCanaryPercent,
          evidence: req.body.evidence,
          requiredEvidence: req.body.requiredEvidence,
          allowWarnings: req.body.allowWarnings,
          artifactRefs: req.body.artifactRefs,
        },
      },
      req.requestId,
    );

    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);

hybridPythonRouter.post(
  '/notifications/dispatch/prepare',
  validateBody(hybridPythonNotificationDispatchPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('notifications-dispatch', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await enqueueHybridPythonJob(
      {
        jobType: 'notifications.dispatch',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: req.body.dryRun,
        payload: {
          channel: req.body.channel,
          templateId: req.body.templateId,
          recipients: req.body.recipients,
          variables: req.body.variables,
        },
      },
      {
        requestId: req.requestId,
        actorUserId: req.user?.userId,
        organizationId: req.user?.organizationId,
        forcePython: parseForcePython(req.query.forcePython),
      },
    );

    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);

hybridPythonRouter.post(
  '/ai/triage-preview/prepare',
  validateBody(hybridPythonAiTriagePreviewPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('ai-triage-preview', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await enqueueHybridPythonJob(
      {
        jobType: 'ai.triage_preview',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: req.body.dryRun,
        payload: {
          text: req.body.text,
          locale: req.body.locale,
          context: req.body.context,
        },
      },
      {
        requestId: req.requestId,
        actorUserId: req.user?.userId,
        organizationId: req.user?.organizationId,
        forcePython: parseForcePython(req.query.forcePython),
      },
    );

    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);


hybridPythonRouter.post(
  '/platform/data-retention/review/prepare',
  validateBody(hybridPythonPlatformDataRetentionReviewPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('platform-data-retention-review', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await runHybridPythonDataRetentionReview(
      {
        jobType: 'platform.data_retention_review',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: true,
        payload: {
          releaseId: req.body.releaseId,
          route: req.body.route,
          jobTypes: req.body.jobTypes,
          retentionPolicies: req.body.retentionPolicies,
          artifactSummary: req.body.artifactSummary,
          jobSummary: req.body.jobSummary,
          gcSummary: req.body.gcSummary,
          maxArtifactTtlSeconds: req.body.maxArtifactTtlSeconds,
          requireExplicitTtl: req.body.requireExplicitTtl,
          requireRedaction: req.body.requireRedaction,
        },
      },
      req.requestId,
    );
    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);

hybridPythonRouter.post(
  '/platform/audit-trail/review/prepare',
  validateBody(hybridPythonPlatformAuditTrailReviewPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('platform-audit-trail-review', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await runHybridPythonAuditTrailReview(
      {
        jobType: 'platform.audit_trail_review',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: true,
        payload: {
          releaseId: req.body.releaseId,
          route: req.body.route,
          jobTypes: req.body.jobTypes,
          auditEvents: req.body.auditEvents,
          requiredEventFields: req.body.requiredEventFields,
          evidence: req.body.evidence,
          requireMutationDryRun: req.body.requireMutationDryRun,
        },
      },
      req.requestId,
    );
    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);


hybridPythonRouter.post(
  '/platform/security/posture/review/prepare',
  validateBody(hybridPythonPlatformSecurityPostureReviewPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('platform-security-posture-review', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await runHybridPythonSecurityPostureReview(
      {
        jobType: 'platform.security_posture_review',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: true,
        payload: {
          releaseId: req.body.releaseId,
          route: req.body.route,
          jobTypes: req.body.jobTypes,
          controls: req.body.controls,
          findings: req.body.findings,
          requiredControls: req.body.requiredControls,
          maxHighFindings: req.body.maxHighFindings,
          maxCriticalFindings: req.body.maxCriticalFindings,
        },
      },
      req.requestId,
    );
    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);

hybridPythonRouter.post(
  '/platform/supply-chain/review/prepare',
  validateBody(hybridPythonPlatformSupplyChainReviewPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('platform-supply-chain-review', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await runHybridPythonSupplyChainReview(
      {
        jobType: 'platform.supply_chain_review',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: true,
        payload: {
          releaseId: req.body.releaseId,
          route: req.body.route,
          jobTypes: req.body.jobTypes,
          scans: req.body.scans,
          sbomPresent: req.body.sbomPresent,
          lockfilesPresent: req.body.lockfilesPresent,
          imageScanPresent: req.body.imageScanPresent,
          maxHighVulnerabilities: req.body.maxHighVulnerabilities,
          maxCriticalVulnerabilities: req.body.maxCriticalVulnerabilities,
          requireSbom: req.body.requireSbom,
          requireImageScan: req.body.requireImageScan,
        },
      },
      req.requestId,
    );
    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);


hybridPythonRouter.post(
  '/platform/schema-migration/rehearsal/prepare',
  validateBody(hybridPythonPlatformSchemaMigrationRehearsalPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('platform-schema-migration-rehearsal', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await runHybridPythonSchemaMigrationRehearsal(
      {
        jobType: 'platform.schema_migration_rehearsal',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: true,
        payload: {
          releaseId: req.body.releaseId,
          route: req.body.route,
          jobTypes: req.body.jobTypes,
          migrations: req.body.migrations,
          schemaDrift: req.body.schemaDrift,
          rehearsalEvidence: req.body.rehearsalEvidence,
          requiredChecks: req.body.requiredChecks,
          allowDestructive: req.body.allowDestructive,
          requireShadowReplay: req.body.requireShadowReplay,
          maxDestructiveSteps: req.body.maxDestructiveSteps,
        },
      },
      req.requestId,
    );
    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);

hybridPythonRouter.post(
  '/platform/backup-restore/drill/prepare',
  validateBody(hybridPythonPlatformBackupRestoreDrillPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('platform-backup-restore-drill', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await runHybridPythonBackupRestoreDrill(
      {
        jobType: 'platform.backup_restore_drill',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: true,
        payload: {
          releaseId: req.body.releaseId,
          route: req.body.route,
          jobTypes: req.body.jobTypes,
          backups: req.body.backups,
          restoreTests: req.body.restoreTests,
          requiredStores: req.body.requiredStores,
          rpoMinutes: req.body.rpoMinutes,
          rtoMinutes: req.body.rtoMinutes,
          requireRecentRestore: req.body.requireRecentRestore,
          requireRestoreIntegrityCheck: req.body.requireRestoreIntegrityCheck,
        },
      },
      req.requestId,
    );
    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);


hybridPythonRouter.post(
  '/platform/observability/coverage/review/prepare',
  validateBody(hybridPythonPlatformObservabilityCoverageReviewPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('platform-observability-coverage-review', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await runHybridPythonObservabilityCoverageReview(
      {
        jobType: 'platform.observability_coverage_review',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: true,
        payload: {
          releaseId: req.body.releaseId,
          route: req.body.route,
          jobTypes: req.body.jobTypes,
          traces: req.body.traces,
          metrics: req.body.metrics,
          logs: req.body.logs,
          dashboards: req.body.dashboards,
          requiredSignals: req.body.requiredSignals,
          minTraceCoveragePercent: req.body.minTraceCoveragePercent,
          maxUncorrelatedLogs: req.body.maxUncorrelatedLogs,
          requireDashboardLinks: req.body.requireDashboardLinks,
        },
      },
      req.requestId,
    );
    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);

hybridPythonRouter.post(
  '/platform/feature-flags/review/prepare',
  validateBody(hybridPythonPlatformFeatureFlagReviewPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('platform-feature-flag-review', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await runHybridPythonFeatureFlagReview(
      {
        jobType: 'platform.feature_flag_review',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: true,
        payload: {
          releaseId: req.body.releaseId,
          route: req.body.route,
          jobTypes: req.body.jobTypes,
          flags: req.body.flags,
          expectedSettings: req.body.expectedSettings,
          requiredFlags: req.body.requiredFlags,
          maxCanaryPercent: req.body.maxCanaryPercent,
          requireKillSwitch: req.body.requireKillSwitch,
          requireSignedBridge: req.body.requireSignedBridge,
        },
      },
      req.requestId,
    );
    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);


hybridPythonRouter.post(
  '/platform/domain-migration/readiness/prepare',
  validateBody(hybridPythonPlatformDomainMigrationReadinessPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('platform-domain-migration-readiness', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await runHybridPythonDomainMigrationReadiness(
      {
        jobType: 'platform.domain_migration_readiness',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: true,
        payload: {
          releaseId: req.body.releaseId,
          domain: req.body.domain,
          route: req.body.route,
          jobTypes: req.body.jobTypes,
          candidateOwner: req.body.candidateOwner,
          evidence: req.body.evidence,
          requiredEvidence: req.body.requiredEvidence,
          shadowComparisonSummary: req.body.shadowComparisonSummary,
          canaryGate: req.body.canaryGate,
          targetCanaryPercent: req.body.targetCanaryPercent,
          maxCanaryPercent: req.body.maxCanaryPercent,
          requireNodeFallback: req.body.requireNodeFallback,
          requireOwnerApproval: req.body.requireOwnerApproval,
        },
      },
      req.requestId,
    );
    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);

hybridPythonRouter.post(
  '/platform/cutover/plan/prepare',
  validateBody(hybridPythonPlatformCutoverPlanPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('platform-cutover-plan', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await runHybridPythonCutoverPlan(
      {
        jobType: 'platform.cutover_plan',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: true,
        payload: {
          releaseId: req.body.releaseId,
          domain: req.body.domain,
          route: req.body.route,
          jobTypes: req.body.jobTypes,
          fromOwner: req.body.fromOwner,
          toOwner: req.body.toOwner,
          targetCanaryPercent: req.body.targetCanaryPercent,
          stages: req.body.stages,
          evidence: req.body.evidence,
          rollbackTriggers: req.body.rollbackTriggers,
          operatorApprovals: req.body.operatorApprovals,
          dryRunRequired: req.body.dryRunRequired,
        },
      },
      req.requestId,
    );
    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);


hybridPythonRouter.post(
  '/platform/owner-registry/review/prepare',
  validateBody(hybridPythonPlatformOwnerRegistryReviewPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('platform-owner-registry-review', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await runHybridPythonOwnerRegistryReview(
      {
        jobType: 'platform.owner_registry_review',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: true,
        payload: {
          releaseId: req.body.releaseId,
          domain: req.body.domain,
          route: req.body.route,
          jobTypes: req.body.jobTypes,
          domains: req.body.domains,
          ownerRegistry: req.body.ownerRegistry,
          requiredOwners: req.body.requiredOwners,
          approvals: req.body.approvals,
          requireRollbackOwner: req.body.requireRollbackOwner,
          requireIncidentOwner: req.body.requireIncidentOwner,
        },
      },
      req.requestId,
    );
    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);

hybridPythonRouter.post(
  '/platform/post-cutover/monitor/prepare',
  validateBody(hybridPythonPlatformPostCutoverMonitorPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('platform-post-cutover-monitor', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await runHybridPythonPostCutoverMonitor(
      {
        jobType: 'platform.post_cutover_monitor',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: true,
        payload: {
          releaseId: req.body.releaseId,
          domain: req.body.domain,
          route: req.body.route,
          jobTypes: req.body.jobTypes,
          monitorWindowMinutes: req.body.monitorWindowMinutes,
          targetCanaryPercent: req.body.targetCanaryPercent,
          metrics: req.body.metrics,
          thresholds: req.body.thresholds,
          evidence: req.body.evidence,
          rollbackTriggers: req.body.rollbackTriggers,
          requireNodeFallback: req.body.requireNodeFallback,
        },
      },
      req.requestId,
    );
    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);


hybridPythonRouter.post(
  '/platform/legacy-paths/decommission/prepare',
  validateBody(hybridPythonPlatformLegacyPathDecommissionPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('platform-legacy-path-decommission', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await runHybridPythonLegacyPathDecommission(
      {
        jobType: 'platform.legacy_path_decommission',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: true,
        payload: {
          releaseId: req.body.releaseId,
          domain: req.body.domain,
          route: req.body.route,
          jobTypes: req.body.jobTypes,
          legacyPaths: req.body.legacyPaths,
          evidence: req.body.evidence,
          requiredEvidence: req.body.requiredEvidence,
          fallbackPlan: req.body.fallbackPlan,
          rollbackTriggers: req.body.rollbackTriggers,
          requireZeroTraffic: req.body.requireZeroTraffic,
          requireOperatorApproval: req.body.requireOperatorApproval,
        },
      },
      req.requestId,
    );
    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);

hybridPythonRouter.post(
  '/platform/steady-state/ops/review/prepare',
  validateBody(hybridPythonPlatformSteadyStateOpsReviewPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('platform-steady-state-ops-review', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await runHybridPythonSteadyStateOpsReview(
      {
        jobType: 'platform.steady_state_operations_review',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: true,
        payload: {
          releaseId: req.body.releaseId,
          domain: req.body.domain,
          route: req.body.route,
          jobTypes: req.body.jobTypes,
          runbookLinks: req.body.runbookLinks,
          dashboardLinks: req.body.dashboardLinks,
          alertPolicies: req.body.alertPolicies,
          incidentHistory: req.body.incidentHistory,
          metrics: req.body.metrics,
          thresholds: req.body.thresholds,
          evidence: req.body.evidence,
          requiredOperationalControls: req.body.requiredOperationalControls,
          requireOnCall: req.body.requireOnCall,
        },
      },
      req.requestId,
    );
    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);


hybridPythonRouter.post(
  '/platform/queues/resilience/review/prepare',
  validateBody(hybridPythonPlatformQueueResilienceReviewPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('platform-queue-resilience-review', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await runHybridPythonQueueResilienceReview(
      {
        jobType: 'platform.queue_resilience_review',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: true,
        payload: {
          releaseId: req.body.releaseId,
          domain: req.body.domain,
          route: req.body.route,
          jobTypes: req.body.jobTypes,
          queues: req.body.queues,
          retryPolicy: req.body.retryPolicy,
          dlqPolicy: req.body.dlqPolicy,
          idempotencyEvidence: req.body.idempotencyEvidence,
          metrics: req.body.metrics,
          thresholds: req.body.thresholds,
          evidence: req.body.evidence,
          requireDlq: req.body.requireDlq,
          requireIdempotency: req.body.requireIdempotency,
        },
      },
      req.requestId,
    );
    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);

hybridPythonRouter.post(
  '/platform/artifacts/integrity/review/prepare',
  validateBody(hybridPythonPlatformArtifactIntegrityReviewPrepareSchema),
  async (req, res) => {
    const idempotencyKey = buildDomainIdempotencyKey('platform-artifact-integrity-review', {
      organizationId: req.user?.organizationId,
      actorUserId: req.user?.userId,
      requestBody: req.body,
    });

    const result = await runHybridPythonArtifactIntegrityReview(
      {
        jobType: 'platform.artifact_integrity_review',
        idempotencyKey,
        correlationId: req.requestId,
        organizationId: req.user?.organizationId,
        actorUserId: req.user?.userId,
        dryRun: true,
        payload: {
          releaseId: req.body.releaseId,
          domain: req.body.domain,
          route: req.body.route,
          jobTypes: req.body.jobTypes,
          artifacts: req.body.artifacts,
          evidence: req.body.evidence,
          requiredFields: req.body.requiredFields,
          allowedPiiClasses: req.body.allowedPiiClasses,
          maxArtifactAgeHours: req.body.maxArtifactAgeHours,
          requireSha256: req.body.requireSha256,
          requireRedaction: req.body.requireRedaction,
          requireExpiry: req.body.requireExpiry,
        },
      },
      req.requestId,
    );
    res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null });
  },
);

hybridPythonRouter.post('/platform/vendor/resilience/review/prepare', validateBody(hybridPythonPlatformVendorResilienceReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-vendor-resilience-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonVendorResilienceReview({ jobType: 'platform.vendor_resilience_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, vendors: req.body.vendors, services: req.body.services, incidents: req.body.incidents, exitPlans: req.body.exitPlans, evidence: req.body.evidence, requiredVendors: req.body.requiredVendors, maxStatusAgeMinutes: req.body.maxStatusAgeMinutes, maxOpenIncidentAgeDays: req.body.maxOpenIncidentAgeDays, requireSlaEvidence: req.body.requireSlaEvidence, requireExitPlan: req.body.requireExitPlan, requireOwnerAck: req.body.requireOwnerAck } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/knowledge-transfer/readiness/review/prepare', validateBody(hybridPythonPlatformKnowledgeTransferReadinessReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-knowledge-transfer-readiness-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonKnowledgeTransferReadinessReview({ jobType: 'platform.knowledge_transfer_readiness_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, knowledgeArtifacts: req.body.knowledgeArtifacts, owners: req.body.owners, trainingSessions: req.body.trainingSessions, handoffChecklists: req.body.handoffChecklists, evidence: req.body.evidence, requiredTopics: req.body.requiredTopics, maxArtifactAgeDays: req.body.maxArtifactAgeDays, requireSecondaryOwner: req.body.requireSecondaryOwner, requireTraining: req.body.requireTraining, requireHandoffChecklist: req.body.requireHandoffChecklist } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/architecture/ownership/review/prepare', validateBody(hybridPythonPlatformArchitectureOwnershipReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-architecture-ownership-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonArchitectureOwnershipReview({ jobType: 'platform.architecture_ownership_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, architectureArtifacts: req.body.architectureArtifacts, serviceBoundaries: req.body.serviceBoundaries, owners: req.body.owners, decisionRecords: req.body.decisionRecords, evidence: req.body.evidence, requiredDomains: req.body.requiredDomains, maxArtifactAgeDays: req.body.maxArtifactAgeDays, requireOwnerAck: req.body.requireOwnerAck, requireAdr: req.body.requireAdr, requireBoundaryDoc: req.body.requireBoundaryDoc } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });


hybridPythonRouter.post('/platform/domain-adoption/readiness/review/prepare', validateBody(hybridPythonPlatformDomainAdoptionReadinessReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-domain-adoption-readiness-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonDomainAdoptionReadinessReview({ jobType: 'platform.domain_adoption_readiness_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, phase: req.body.phase, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, domains: req.body.domains, owners: req.body.owners, rollbackPlan: req.body.rollbackPlan, evidence: req.body.evidence, requiredDomains: req.body.requiredDomains, minReadinessScore: req.body.minReadinessScore, maxOpenBlockers: req.body.maxOpenBlockers, requireOwnerAck: req.body.requireOwnerAck, requireRollbackPlan: req.body.requireRollbackPlan } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });


hybridPythonRouter.post('/platform/domain-pilot/execution/review/prepare', validateBody(hybridPythonPlatformDomainPilotExecutionReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-domain-pilot-execution-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonDomainPilotExecutionReview({ jobType: 'platform.domain_pilot_execution_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, phase: req.body.phase, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, pilotDomains: req.body.pilotDomains, pilotRuns: req.body.pilotRuns, acceptanceCriteria: req.body.acceptanceCriteria, operatorApprovals: req.body.operatorApprovals, rollbackPlan: req.body.rollbackPlan, evidence: req.body.evidence, requiredPilotDomains: req.body.requiredPilotDomains, minSuccessRate: req.body.minSuccessRate, maxErrorRate: req.body.maxErrorRate, maxOpenBlockers: req.body.maxOpenBlockers, minApprovalCount: req.body.minApprovalCount, requireRollbackPlan: req.body.requireRollbackPlan, requireOperatorApproval: req.body.requireOperatorApproval } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/phase-two/expansion/control/review/prepare', validateBody(hybridPythonPlatformPhaseTwoExpansionControlReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-phase-two-expansion-control-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonPhaseTwoExpansionControlReview({ jobType: 'platform.phase_two_expansion_control_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, phase: req.body.phase, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, waves: req.body.waves, trafficLimits: req.body.trafficLimits, rollbackTriggers: req.body.rollbackTriggers, checkpoints: req.body.checkpoints, approvals: req.body.approvals, evidence: req.body.evidence, maxTargetPercent: req.body.maxTargetPercent, minCheckpointPasses: req.body.minCheckpointPasses, minApprovalCount: req.body.minApprovalCount, requireRollbackTriggers: req.body.requireRollbackTriggers, requireTrafficLimits: req.body.requireTrafficLimits } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });


hybridPythonRouter.post('/platform/domain-outcomes/measurement/review/prepare', validateBody(hybridPythonPlatformDomainOutcomeMeasurementReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-domain-outcome-measurement-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonDomainOutcomeMeasurementReview({ jobType: 'platform.domain_outcome_measurement_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, phase: req.body.phase, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, outcomeMetrics: req.body.outcomeMetrics, baselines: req.body.baselines, adoptionSignals: req.body.adoptionSignals, supportSignals: req.body.supportSignals, evidence: req.body.evidence, requiredMetrics: req.body.requiredMetrics, minSuccessRate: req.body.minSuccessRate, maxRegressionPercent: req.body.maxRegressionPercent, minAdoptionScore: req.body.minAdoptionScore, maxSupportTicketRate: req.body.maxSupportTicketRate, requireBaselines: req.body.requireBaselines, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/phase-two/feedback/adoption/review/prepare', validateBody(hybridPythonPlatformPhaseTwoFeedbackAdoptionReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-phase-two-feedback-adoption-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonPhaseTwoFeedbackAdoptionReview({ jobType: 'platform.phase_two_feedback_adoption_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, phase: req.body.phase, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, feedbackItems: req.body.feedbackItems, adoptionDecisions: req.body.adoptionDecisions, ownerResponses: req.body.ownerResponses, communications: req.body.communications, evidence: req.body.evidence, maxOpenCriticalFeedback: req.body.maxOpenCriticalFeedback, minOwnerResponseCount: req.body.minOwnerResponseCount, requireAdoptionDecisions: req.body.requireAdoptionDecisions, requireCommunications: req.body.requireCommunications } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });


hybridPythonRouter.post('/platform/domain-graduation/readiness/review/prepare', validateBody(hybridPythonPlatformDomainGraduationReadinessReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-domain-graduation-readiness-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonDomainGraduationReadinessReview({ jobType: 'platform.domain_graduation_readiness_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, phase: req.body.phase, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, graduationCandidates: req.body.graduationCandidates, graduationCriteria: req.body.graduationCriteria, outcomeSummary: req.body.outcomeSummary, riskRegister: req.body.riskRegister, approvals: req.body.approvals, evidence: req.body.evidence, requiredCandidates: req.body.requiredCandidates, minOutcomeScore: req.body.minOutcomeScore, maxOpenHighRisks: req.body.maxOpenHighRisks, minApprovalCount: req.body.minApprovalCount, requireCriteria: req.body.requireCriteria, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/phase-two/learning/consolidation/review/prepare', validateBody(hybridPythonPlatformPhaseTwoLearningConsolidationReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-phase-two-learning-consolidation-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonPhaseTwoLearningConsolidationReview({ jobType: 'platform.phase_two_learning_consolidation_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, phase: req.body.phase, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, learnings: req.body.learnings, experiments: req.body.experiments, decisions: req.body.decisions, playbookUpdates: req.body.playbookUpdates, owners: req.body.owners, evidence: req.body.evidence, minLearningCount: req.body.minLearningCount, minDecisionCount: req.body.minDecisionCount, minOwnerAckCount: req.body.minOwnerAckCount, requirePlaybookUpdates: req.body.requirePlaybookUpdates, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/domain-wide-adoption/readiness/review/prepare', validateBody(hybridPythonPlatformDomainWideAdoptionReadinessReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-domain-wide-adoption-readiness-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonDomainWideAdoptionReadinessReview({ jobType: 'platform.domain_wide_adoption_readiness_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, phase: req.body.phase, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, adoptionDomains: req.body.adoptionDomains, rolloutEvidence: req.body.rolloutEvidence, ownerApprovals: req.body.ownerApprovals, supportReadiness: req.body.supportReadiness, rollbackPlan: req.body.rollbackPlan, evidence: req.body.evidence, minDomainCount: req.body.minDomainCount, minOwnerApprovalCount: req.body.minOwnerApprovalCount, maxOpenBlockers: req.body.maxOpenBlockers, requireSupportReadiness: req.body.requireSupportReadiness, requireRollbackPlan: req.body.requireRollbackPlan, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/phase-two/support/transition/review/prepare', validateBody(hybridPythonPlatformPhaseTwoSupportTransitionReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-phase-two-support-transition-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonPhaseTwoSupportTransitionReview({ jobType: 'platform.phase_two_support_transition_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, phase: req.body.phase, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, supportQueues: req.body.supportQueues, escalationPaths: req.body.escalationPaths, trainingArtifacts: req.body.trainingArtifacts, runbookUpdates: req.body.runbookUpdates, ownerApprovals: req.body.ownerApprovals, evidence: req.body.evidence, minQueueCount: req.body.minQueueCount, minTrainingCount: req.body.minTrainingCount, minOwnerApprovalCount: req.body.minOwnerApprovalCount, requireEscalationPaths: req.body.requireEscalationPaths, requireRunbookUpdates: req.body.requireRunbookUpdates, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/domain-adoption/stabilization/review/prepare', validateBody(hybridPythonPlatformDomainAdoptionStabilizationReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-domain-adoption-stabilization-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonDomainAdoptionStabilizationReview({ jobType: 'platform.domain_adoption_stabilization_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, phase: req.body.phase, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, stabilizationDomains: req.body.stabilizationDomains, healthSignals: req.body.healthSignals, supportSignals: req.body.supportSignals, regressionWatch: req.body.regressionWatch, approvals: req.body.approvals, evidence: req.body.evidence, minDomainCount: req.body.minDomainCount, minHealthSignalCount: req.body.minHealthSignalCount, minApprovalCount: req.body.minApprovalCount, maxOpenBlockers: req.body.maxOpenBlockers, requireSupportSignals: req.body.requireSupportSignals, requireRegressionWatch: req.body.requireRegressionWatch, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/phase-two/value-realization/review/prepare', validateBody(hybridPythonPlatformPhaseTwoValueRealizationReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-phase-two-value-realization-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonPhaseTwoValueRealizationReview({ jobType: 'platform.phase_two_value_realization_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, phase: req.body.phase, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, valueMetrics: req.body.valueMetrics, benefitBaselines: req.body.benefitBaselines, adoptionSummary: req.body.adoptionSummary, executiveReviews: req.body.executiveReviews, ownerApprovals: req.body.ownerApprovals, evidence: req.body.evidence, minValueMetricCount: req.body.minValueMetricCount, minOwnerApprovalCount: req.body.minOwnerApprovalCount, minAdoptionScore: req.body.minAdoptionScore, requireBenefitBaselines: req.body.requireBenefitBaselines, requireExecutiveReviews: req.body.requireExecutiveReviews, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });



hybridPythonRouter.post('/platform/phase-two/closure/acceptance/review/prepare', validateBody(hybridPythonPlatformPhaseTwoClosureAcceptanceReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-phase-two-closure-acceptance-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonPhaseTwoClosureAcceptanceReview({ jobType: 'platform.phase_two_closure_acceptance_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, phase: req.body.phase, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, closureCriteria: req.body.closureCriteria, acceptanceEvidence: req.body.acceptanceEvidence, openRisks: req.body.openRisks, approvals: req.body.approvals, valueRealizationSummary: req.body.valueRealizationSummary, supportTransition: req.body.supportTransition, evidence: req.body.evidence, minCriteriaCount: req.body.minCriteriaCount, minApprovalCount: req.body.minApprovalCount, maxOpenHighRisks: req.body.maxOpenHighRisks, minValueScore: req.body.minValueScore, requireSupportTransition: req.body.requireSupportTransition, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/phase-three/transition/readiness/review/prepare', validateBody(hybridPythonPlatformPhaseThreeTransitionReadinessReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-phase-three-transition-readiness-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonPhaseThreeTransitionReadinessReview({ jobType: 'platform.phase_three_transition_readiness_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, phase: req.body.phase, nextPhase: req.body.nextPhase, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, transitionMilestones: req.body.transitionMilestones, dependencyReadiness: req.body.dependencyReadiness, ownerHandoffs: req.body.ownerHandoffs, rolloutGuardrails: req.body.rolloutGuardrails, entryCriteria: req.body.entryCriteria, approvals: req.body.approvals, evidence: req.body.evidence, minMilestoneCount: req.body.minMilestoneCount, minOwnerHandoffCount: req.body.minOwnerHandoffCount, minApprovalCount: req.body.minApprovalCount, requireGuardrails: req.body.requireGuardrails, requireEntryCriteria: req.body.requireEntryCriteria, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });


hybridPythonRouter.post('/platform/phase-three/domain-wave/readiness/review/prepare', validateBody(hybridPythonPlatformPhaseThreeDomainWaveReadinessReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-phase-three-domain-wave-readiness-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonPhaseThreeDomainWaveReadinessReview({ jobType: 'platform.phase_three_domain_wave_readiness_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, phase: req.body.phase, waveId: req.body.waveId, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, domains: req.body.domains, waveCriteria: req.body.waveCriteria, guardrails: req.body.guardrails, supportCoverage: req.body.supportCoverage, rollbackCoverage: req.body.rollbackCoverage, approvals: req.body.approvals, evidence: req.body.evidence, minDomainCount: req.body.minDomainCount, minGuardrailCount: req.body.minGuardrailCount, minApprovalCount: req.body.minApprovalCount, requireSupportCoverage: req.body.requireSupportCoverage, requireRollbackCoverage: req.body.requireRollbackCoverage, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/phase-three/operating-model/alignment/review/prepare', validateBody(hybridPythonPlatformPhaseThreeOperatingModelAlignmentReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-phase-three-operating-model-alignment-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonPhaseThreeOperatingModelAlignmentReview({ jobType: 'platform.phase_three_operating_model_alignment_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, phase: req.body.phase, operatingModel: req.body.operatingModel, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, ownershipMatrix: req.body.ownershipMatrix, supportModel: req.body.supportModel, runbookCoverage: req.body.runbookCoverage, metricGovernance: req.body.metricGovernance, trainingCoverage: req.body.trainingCoverage, escalationModel: req.body.escalationModel, approvals: req.body.approvals, evidence: req.body.evidence, minOwnerCount: req.body.minOwnerCount, minRunbookCount: req.body.minRunbookCount, minApprovalCount: req.body.minApprovalCount, requireSupportModel: req.body.requireSupportModel, requireMetrics: req.body.requireMetrics, requireTraining: req.body.requireTraining, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/phase-three/wave/execution/review/prepare', validateBody(hybridPythonPlatformPhaseThreeWaveExecutionReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-phase-three-wave-execution-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonPhaseThreeWaveExecutionReview({ jobType: 'platform.phase_three_wave_execution_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, phase: req.body.phase, waveId: req.body.waveId, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, waveExecution: req.body.waveExecution, domainSignals: req.body.domainSignals, guardrailChecks: req.body.guardrailChecks, rollbackReadiness: req.body.rollbackReadiness, supportIncidents: req.body.supportIncidents, approvals: req.body.approvals, evidence: req.body.evidence, minExecutedDomainCount: req.body.minExecutedDomainCount, maxOpenCriticalIncidents: req.body.maxOpenCriticalIncidents, minApprovalCount: req.body.minApprovalCount, requireRollbackReadiness: req.body.requireRollbackReadiness, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/phase-three/adoption-value/tracking/review/prepare', validateBody(hybridPythonPlatformPhaseThreeAdoptionValueTrackingReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-phase-three-adoption-value-tracking-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonPhaseThreeAdoptionValueTrackingReview({ jobType: 'platform.phase_three_adoption_value_tracking_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, phase: req.body.phase, waveId: req.body.waveId, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, adoptionMetrics: req.body.adoptionMetrics, valueMetrics: req.body.valueMetrics, userFeedback: req.body.userFeedback, benefitHypotheses: req.body.benefitHypotheses, ownerReviews: req.body.ownerReviews, approvals: req.body.approvals, evidence: req.body.evidence, minAdoptionScore: req.body.minAdoptionScore, minValueScore: req.body.minValueScore, maxCriticalFeedback: req.body.maxCriticalFeedback, minApprovalCount: req.body.minApprovalCount, requireFeedbackReview: req.body.requireFeedbackReview, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/phase-three/gap-remediation/review/prepare', validateBody(hybridPythonPlatformPhaseThreeGapRemediationReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-phase-three-gap-remediation-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonPhaseThreeGapRemediationReview({ jobType: 'platform.phase_three_gap_remediation_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, phase: req.body.phase, waveId: req.body.waveId, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, remediationItems: req.body.remediationItems, openRisks: req.body.openRisks, riskAcceptances: req.body.riskAcceptances, ownerActions: req.body.ownerActions, evidence: req.body.evidence, maxOpenCriticalGaps: req.body.maxOpenCriticalGaps, minOwnerActionCount: req.body.minOwnerActionCount, minRiskAcceptanceCount: req.body.minRiskAcceptanceCount, requireRiskAcceptance: req.body.requireRiskAcceptance, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/migration-stage/completion/readiness/review/prepare', validateBody(hybridPythonPlatformMigrationStageCompletionReadinessReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-migration-stage-completion-readiness-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonMigrationStageCompletionReadinessReview({ jobType: 'platform.migration_stage_completion_readiness_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, stage: req.body.stage, phase: req.body.phase, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, completionCriteria: req.body.completionCriteria, validationResults: req.body.validationResults, closureApprovals: req.body.closureApprovals, residualRisks: req.body.residualRisks, finalEvidence: req.body.finalEvidence, minCriteriaCount: req.body.minCriteriaCount, minValidationCount: req.body.minValidationCount, maxOpenHighRisks: req.body.maxOpenHighRisks, minApprovalCount: req.body.minApprovalCount, requireValidationResults: req.body.requireValidationResults, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });


hybridPythonRouter.post('/platform/phase-three/remediation/closure/review/prepare', validateBody(hybridPythonPlatformPhaseThreeRemediationClosureReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-phase-three-remediation-closure-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonPhaseThreeRemediationClosureReview({ jobType: 'platform.phase_three_remediation_closure_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, stage: req.body.stage, phase: req.body.phase, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, closureItems: req.body.closureItems, remediationEvidence: req.body.remediationEvidence, residualRisks: req.body.residualRisks, acceptanceRecords: req.body.acceptanceRecords, ownerApprovals: req.body.ownerApprovals, evidence: req.body.evidence, minClosureItemCount: req.body.minClosureItemCount, minRemediationEvidenceCount: req.body.minRemediationEvidenceCount, maxOpenHighRisks: req.body.maxOpenHighRisks, minApprovalCount: req.body.minApprovalCount, requireAcceptanceRecords: req.body.requireAcceptanceRecords, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/executive-operational/handoff/review/prepare', validateBody(hybridPythonPlatformExecutiveOperationalHandoffReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-executive-operational-handoff-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonExecutiveOperationalHandoffReview({ jobType: 'platform.executive_operational_handoff_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, stage: req.body.stage, phase: req.body.phase, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, executiveSummary: req.body.executiveSummary, handoffItems: req.body.handoffItems, supportModel: req.body.supportModel, kpiBaselines: req.body.kpiBaselines, governanceDecisions: req.body.governanceDecisions, approvals: req.body.approvals, evidence: req.body.evidence, minHandoffItemCount: req.body.minHandoffItemCount, minKpiBaselineCount: req.body.minKpiBaselineCount, minApprovalCount: req.body.minApprovalCount, requireSupportModel: req.body.requireSupportModel, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });


hybridPythonRouter.post('/platform/global-task-status/tracking/review/prepare', validateBody(hybridPythonPlatformGlobalTaskStatusTrackingReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-global-task-status-tracking-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonGlobalTaskStatusTrackingReview({ jobType: 'platform.global_task_status_tracking_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, stage: req.body.stage, phase: req.body.phase, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, tasks: req.body.tasks, milestones: req.body.milestones, owners: req.body.owners, blockers: req.body.blockers, approvals: req.body.approvals, evidence: req.body.evidence, minTaskCount: req.body.minTaskCount, minMilestoneCount: req.body.minMilestoneCount, minOwnerCount: req.body.minOwnerCount, minApprovalCount: req.body.minApprovalCount, maxOpenCriticalBlockers: req.body.maxOpenCriticalBlockers, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/project-state/health/review/prepare', validateBody(hybridPythonPlatformProjectStateHealthReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-project-state-health-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonProjectStateHealthReview({ jobType: 'platform.project_state_health_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, stage: req.body.stage, phase: req.body.phase, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, applications: req.body.applications, migrationStatus: req.body.migrationStatus, riskRegister: req.body.riskRegister, closureCriteria: req.body.closureCriteria, approvals: req.body.approvals, evidence: req.body.evidence, minApplicationCount: req.body.minApplicationCount, minCompletionPercent: req.body.minCompletionPercent, maxOpenHighRisks: req.body.maxOpenHighRisks, minClosureCriteriaCount: req.body.minClosureCriteriaCount, minApprovalCount: req.body.minApprovalCount, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });


hybridPythonRouter.post('/platform/final-acceptance/evidence/review/prepare', validateBody(hybridPythonPlatformFinalAcceptanceEvidenceReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-final-acceptance-evidence-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonFinalAcceptanceEvidenceReview({ jobType: 'platform.final_acceptance_evidence_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, stage: req.body.stage, phase: req.body.phase, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, acceptanceCriteria: req.body.acceptanceCriteria, validationEvidence: req.body.validationEvidence, testResults: req.body.testResults, residualRisks: req.body.residualRisks, signoffs: req.body.signoffs, evidence: req.body.evidence, minAcceptanceCriteriaCount: req.body.minAcceptanceCriteriaCount, minValidationEvidenceCount: req.body.minValidationEvidenceCount, minSignoffCount: req.body.minSignoffCount, maxOpenHighRisks: req.body.maxOpenHighRisks, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });


hybridPythonRouter.post('/platform/stage-closure/certification/review/prepare', validateBody(hybridPythonPlatformStageClosureCertificationReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-stage-closure-certification-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonStageClosureCertificationReview({ jobType: 'platform.stage_closure_certification_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, stage: req.body.stage, phase: req.body.phase, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, certificationItems: req.body.certificationItems, finalEvidence: req.body.finalEvidence, signoffs: req.body.signoffs, releaseArtifacts: req.body.releaseArtifacts, residualRisks: req.body.residualRisks, evidence: req.body.evidence, minCertificationItemCount: req.body.minCertificationItemCount, minSignoffCount: req.body.minSignoffCount, maxOpenHighRisks: req.body.maxOpenHighRisks, requireReleaseArtifacts: req.body.requireReleaseArtifacts, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/post-closure/operational-transition/review/prepare', validateBody(hybridPythonPlatformPostClosureOperationalTransitionReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-post-closure-operational-transition-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonPostClosureOperationalTransitionReview({ jobType: 'platform.post_closure_operational_transition_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, stage: req.body.stage, phase: req.body.phase, domain: req.body.domain, operatingMode: req.body.operatingMode, route: req.body.route, jobTypes: req.body.jobTypes, transitionItems: req.body.transitionItems, monitoringPlan: req.body.monitoringPlan, ownershipHandoff: req.body.ownershipHandoff, supportReadiness: req.body.supportReadiness, kpiBaselines: req.body.kpiBaselines, approvals: req.body.approvals, evidence: req.body.evidence, minTransitionItemCount: req.body.minTransitionItemCount, minSupportReadinessCount: req.body.minSupportReadinessCount, minApprovalCount: req.body.minApprovalCount, requireMonitoringPlan: req.body.requireMonitoringPlan, requireOwnershipHandoff: req.body.requireOwnershipHandoff, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });


hybridPythonRouter.post('/platform/post-closure/monitoring/review/prepare', validateBody(hybridPythonPlatformPostClosureMonitoringReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-post-closure-monitoring-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonPostClosureMonitoringReview({ jobType: 'platform.post_closure_monitoring_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, stage: req.body.stage, phase: req.body.phase, domain: req.body.domain, operatingMode: req.body.operatingMode, route: req.body.route, jobTypes: req.body.jobTypes, monitoringWindows: req.body.monitoringWindows, sloSignals: req.body.sloSignals, incidentSignals: req.body.incidentSignals, adoptionSignals: req.body.adoptionSignals, regressionChecks: req.body.regressionChecks, approvals: req.body.approvals, evidence: req.body.evidence, minMonitoringWindowCount: req.body.minMonitoringWindowCount, minSloSignalCount: req.body.minSloSignalCount, minApprovalCount: req.body.minApprovalCount, maxOpenIncidents: req.body.maxOpenIncidents, maxSloBreaches: req.body.maxSloBreaches, requireRegressionChecks: req.body.requireRegressionChecks, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/steady-state/transfer/validation/review/prepare', validateBody(hybridPythonPlatformSteadyStateTransferValidationReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-steady-state-transfer-validation-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonSteadyStateTransferValidationReview({ jobType: 'platform.steady_state_transfer_validation_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, stage: req.body.stage, phase: req.body.phase, targetState: req.body.targetState, domain: req.body.domain, operatingMode: req.body.operatingMode, route: req.body.route, jobTypes: req.body.jobTypes, transferItems: req.body.transferItems, ownershipMatrix: req.body.ownershipMatrix, runbookCoverage: req.body.runbookCoverage, monitoringReadiness: req.body.monitoringReadiness, knowledgeTransfer: req.body.knowledgeTransfer, supportModel: req.body.supportModel, approvals: req.body.approvals, evidence: req.body.evidence, minTransferItemCount: req.body.minTransferItemCount, minOwnerAckCount: req.body.minOwnerAckCount, minRunbookCount: req.body.minRunbookCount, minMonitoringReadinessCount: req.body.minMonitoringReadinessCount, minApprovalCount: req.body.minApprovalCount, requireSupportModel: req.body.requireSupportModel, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });


hybridPythonRouter.post('/platform/steady-state/operational-assurance/review/prepare', validateBody(hybridPythonPlatformSteadyStateOperationalAssuranceReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-steady-state-operational-assurance-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonSteadyStateOperationalAssuranceReview({ jobType: 'platform.steady_state_operational_assurance_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, stage: req.body.stage, phase: req.body.phase, targetState: req.body.targetState, domain: req.body.domain, operatingMode: req.body.operatingMode, route: req.body.route, jobTypes: req.body.jobTypes, operationalMetrics: req.body.operationalMetrics, sloHealth: req.body.sloHealth, incidentTrends: req.body.incidentTrends, supportQueues: req.body.supportQueues, runbookAudits: req.body.runbookAudits, ownershipReviews: req.body.ownershipReviews, approvals: req.body.approvals, evidence: req.body.evidence, minOperationalMetricCount: req.body.minOperationalMetricCount, minSloHealthCount: req.body.minSloHealthCount, maxOpenSev1Incidents: req.body.maxOpenSev1Incidents, maxOverdueSupportItems: req.body.maxOverdueSupportItems, minRunbookAuditCount: req.body.minRunbookAuditCount, minOwnershipReviewCount: req.body.minOwnershipReviewCount, minApprovalCount: req.body.minApprovalCount, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/continuous-improvement/backlog/review/prepare', validateBody(hybridPythonPlatformContinuousImprovementBacklogReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-continuous-improvement-backlog-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonContinuousImprovementBacklogReview({ jobType: 'platform.continuous_improvement_backlog_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, stage: req.body.stage, phase: req.body.phase, domain: req.body.domain, operatingMode: req.body.operatingMode, route: req.body.route, jobTypes: req.body.jobTypes, improvementItems: req.body.improvementItems, valueHypotheses: req.body.valueHypotheses, technicalDebtItems: req.body.technicalDebtItems, riskItems: req.body.riskItems, ownerCommitments: req.body.ownerCommitments, governanceReviews: req.body.governanceReviews, approvals: req.body.approvals, evidence: req.body.evidence, minImprovementItemCount: req.body.minImprovementItemCount, minOwnerCommitmentCount: req.body.minOwnerCommitmentCount, maxOpenHighRisks: req.body.maxOpenHighRisks, minGovernanceReviewCount: req.body.minGovernanceReviewCount, minApprovalCount: req.body.minApprovalCount, requireValueHypotheses: req.body.requireValueHypotheses, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });



hybridPythonRouter.post('/platform/stable-operations/optimization/review/prepare', validateBody(hybridPythonPlatformStableOperationsOptimizationReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-stable-operations-optimization-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonStableOperationsOptimizationReview({ jobType: 'platform.stable_operations_optimization_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, stage: req.body.stage, phase: req.body.phase, domain: req.body.domain, operatingMode: req.body.operatingMode, route: req.body.route, jobTypes: req.body.jobTypes, optimizationMetrics: req.body.optimizationMetrics, costSignals: req.body.costSignals, reliabilitySignals: req.body.reliabilitySignals, automationOpportunities: req.body.automationOpportunities, debtItems: req.body.debtItems, guardrailReviews: req.body.guardrailReviews, approvals: req.body.approvals, evidence: req.body.evidence, minOptimizationMetricCount: req.body.minOptimizationMetricCount, minGuardrailReviewCount: req.body.minGuardrailReviewCount, maxOpenCriticalDebt: req.body.maxOpenCriticalDebt, minApprovalCount: req.body.minApprovalCount, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });


hybridPythonRouter.post('/platform/maintenance-cycle/execution/review/prepare', validateBody(hybridPythonPlatformMaintenanceCycleExecutionReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-maintenance-cycle-execution-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonMaintenanceCycleExecutionReview({ jobType: 'platform.maintenance_cycle_execution_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, stage: req.body.stage, phase: req.body.phase, cycleId: req.body.cycleId, domain: req.body.domain, operatingMode: req.body.operatingMode, route: req.body.route, jobTypes: req.body.jobTypes, executionItems: req.body.executionItems, patchResults: req.body.patchResults, dependencyResults: req.body.dependencyResults, backupResults: req.body.backupResults, validationResults: req.body.validationResults, rollbackReadiness: req.body.rollbackReadiness, communications: req.body.communications, approvals: req.body.approvals, evidence: req.body.evidence, minExecutionItemCount: req.body.minExecutionItemCount, minValidationResultCount: req.body.minValidationResultCount, maxFailedCriticalItems: req.body.maxFailedCriticalItems, minApprovalCount: req.body.minApprovalCount, requireBackupResults: req.body.requireBackupResults, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });


hybridPythonRouter.post('/platform/recurring-operational-maturity/audit/review/prepare', validateBody(hybridPythonPlatformRecurringOperationalMaturityAuditReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-recurring-operational-maturity-audit-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonRecurringOperationalMaturityAuditReview({ jobType: 'platform.recurring_operational_maturity_audit_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, stage: req.body.stage, phase: req.body.phase, auditCycle: req.body.auditCycle, domain: req.body.domain, operatingMode: req.body.operatingMode, route: req.body.route, jobTypes: req.body.jobTypes, maturityDimensions: req.body.maturityDimensions, controlChecks: req.body.controlChecks, incidentLearnings: req.body.incidentLearnings, supportSignals: req.body.supportSignals, operatorEvidence: req.body.operatorEvidence, risks: req.body.risks, approvals: req.body.approvals, evidence: req.body.evidence, minMaturityDimensionCount: req.body.minMaturityDimensionCount, minControlCheckCount: req.body.minControlCheckCount, minOperatorEvidenceCount: req.body.minOperatorEvidenceCount, maxOpenHighRisks: req.body.maxOpenHighRisks, minApprovalCount: req.body.minApprovalCount, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/stable-state/continuity-control/review/prepare', validateBody(hybridPythonPlatformStableStateContinuityControlReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-stable-state-continuity-control-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonStableStateContinuityControlReview({ jobType: 'platform.stable_state_continuity_control_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, stage: req.body.stage, phase: req.body.phase, horizon: req.body.horizon, domain: req.body.domain, operatingMode: req.body.operatingMode, route: req.body.route, jobTypes: req.body.jobTypes, continuityControls: req.body.continuityControls, drSignals: req.body.drSignals, dependencyContinuity: req.body.dependencyContinuity, operationalFallbacks: req.body.operationalFallbacks, communicationChecks: req.body.communicationChecks, risks: req.body.risks, approvals: req.body.approvals, evidence: req.body.evidence, minContinuityControlCount: req.body.minContinuityControlCount, minDrSignalCount: req.body.minDrSignalCount, minFallbackCount: req.body.minFallbackCount, maxOpenHighRisks: req.body.maxOpenHighRisks, minApprovalCount: req.body.minApprovalCount, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/operational-resilience/governance/review/prepare', validateBody(hybridPythonPlatformOperationalResilienceGovernanceReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-operational-resilience-governance-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonOperationalResilienceGovernanceReview({ jobType: 'platform.operational_resilience_governance_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, stage: req.body.stage, phase: req.body.phase, governanceCycle: req.body.governanceCycle, domain: req.body.domain, operatingMode: req.body.operatingMode, route: req.body.route, jobTypes: req.body.jobTypes, resilienceControls: req.body.resilienceControls, chaosDrills: req.body.chaosDrills, failoverReadiness: req.body.failoverReadiness, serviceOwnership: req.body.serviceOwnership, riskItems: req.body.riskItems, governanceReviews: req.body.governanceReviews, approvals: req.body.approvals, evidence: req.body.evidence, minResilienceControlCount: req.body.minResilienceControlCount, minChaosDrillCount: req.body.minChaosDrillCount, minFailoverReadinessCount: req.body.minFailoverReadinessCount, minOwnershipCount: req.body.minOwnershipCount, maxOpenHighRisks: req.body.maxOpenHighRisks, minApprovalCount: req.body.minApprovalCount, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/operational-resilience/optimization/review/prepare', validateBody(hybridPythonPlatformOperationalResilienceOptimizationReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-operational-resilience-optimization-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonOperationalResilienceOptimizationReview({ jobType: 'platform.operational_resilience_optimization_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, stage: req.body.stage, phase: req.body.phase, optimizationCycle: req.body.optimizationCycle, domain: req.body.domain, operatingMode: req.body.operatingMode, route: req.body.route, jobTypes: req.body.jobTypes, resilienceMetrics: req.body.resilienceMetrics, optimizationActions: req.body.optimizationActions, automationCandidates: req.body.automationCandidates, incidentPatterns: req.body.incidentPatterns, capacitySignals: req.body.capacitySignals, riskItems: req.body.riskItems, approvals: req.body.approvals, evidence: req.body.evidence, minResilienceMetricCount: req.body.minResilienceMetricCount, minOptimizationActionCount: req.body.minOptimizationActionCount, minAutomationCandidateCount: req.body.minAutomationCandidateCount, maxOpenHighRisks: req.body.maxOpenHighRisks, minApprovalCount: req.body.minApprovalCount, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/automated-continuity/preparedness/review/prepare', validateBody(hybridPythonPlatformAutomatedContinuityPreparednessReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-automated-continuity-preparedness-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonAutomatedContinuityPreparednessReview({ jobType: 'platform.automated_continuity_preparedness_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, stage: req.body.stage, phase: req.body.phase, preparednessWindow: req.body.preparednessWindow, domain: req.body.domain, operatingMode: req.body.operatingMode, route: req.body.route, jobTypes: req.body.jobTypes, automationControls: req.body.automationControls, continuityRunbooks: req.body.continuityRunbooks, schedulerReadiness: req.body.schedulerReadiness, dependencyHooks: req.body.dependencyHooks, notificationTemplates: req.body.notificationTemplates, risks: req.body.risks, approvals: req.body.approvals, evidence: req.body.evidence, minAutomationControlCount: req.body.minAutomationControlCount, minRunbookCount: req.body.minRunbookCount, minSchedulerReadinessCount: req.body.minSchedulerReadinessCount, minDependencyHookCount: req.body.minDependencyHookCount, maxOpenHighRisks: req.body.maxOpenHighRisks, minApprovalCount: req.body.minApprovalCount, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/automated-continuity/execution/validation/review/prepare', validateBody(hybridPythonPlatformAutomatedContinuityExecutionValidationReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-automated-continuity-execution-validation-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonAutomatedContinuityExecutionValidationReview({ jobType: 'platform.automated_continuity_execution_validation_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, stage: req.body.stage, phase: req.body.phase, executionWindow: req.body.executionWindow, domain: req.body.domain, operatingMode: req.body.operatingMode, route: req.body.route, jobTypes: req.body.jobTypes, executionRuns: req.body.executionRuns, schedulerEvents: req.body.schedulerEvents, dependencyHooks: req.body.dependencyHooks, notificationDeliveries: req.body.notificationDeliveries, runbookCheckpoints: req.body.runbookCheckpoints, riskItems: req.body.riskItems, approvals: req.body.approvals, evidence: req.body.evidence, minExecutionRunCount: req.body.minExecutionRunCount, minSchedulerEventCount: req.body.minSchedulerEventCount, minDependencyHookCount: req.body.minDependencyHookCount, minRunbookCheckpointCount: req.body.minRunbookCheckpointCount, maxOpenHighRisks: req.body.maxOpenHighRisks, minApprovalCount: req.body.minApprovalCount, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/operational-resilience/feedback-loop/review/prepare', validateBody(hybridPythonPlatformOperationalResilienceFeedbackLoopReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-operational-resilience-feedback-loop-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonOperationalResilienceFeedbackLoopReview({ jobType: 'platform.operational_resilience_feedback_loop_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, stage: req.body.stage, phase: req.body.phase, feedbackCycle: req.body.feedbackCycle, domain: req.body.domain, operatingMode: req.body.operatingMode, route: req.body.route, jobTypes: req.body.jobTypes, feedbackSignals: req.body.feedbackSignals, remediationItems: req.body.remediationItems, learningItems: req.body.learningItems, metricAdjustments: req.body.metricAdjustments, ownerResponses: req.body.ownerResponses, risks: req.body.risks, approvals: req.body.approvals, evidence: req.body.evidence, minFeedbackSignalCount: req.body.minFeedbackSignalCount, minRemediationItemCount: req.body.minRemediationItemCount, minLearningItemCount: req.body.minLearningItemCount, maxOpenHighRisks: req.body.maxOpenHighRisks, minApprovalCount: req.body.minApprovalCount, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });


hybridPythonRouter.post('/platform/final-closure/evidence-package/review/prepare', validateBody(hybridPythonPlatformFinalClosureEvidencePackageReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-final-closure-evidence-package-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonFinalClosureEvidencePackageReview({ jobType: 'platform.final_closure_evidence_package_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, stage: req.body.stage, phase: req.body.phase, closureWindow: req.body.closureWindow, domain: req.body.domain, operatingMode: req.body.operatingMode, route: req.body.route, jobTypes: req.body.jobTypes, versionSummary: req.body.versionSummary, validationResults: req.body.validationResults, contractEvidence: req.body.contractEvidence, apiRouteEvidence: req.body.apiRouteEvidence, workerEvidence: req.body.workerEvidence, residualRisks: req.body.residualRisks, signoffs: req.body.signoffs, evidence: req.body.evidence, minVersionSummaryCount: req.body.minVersionSummaryCount, minValidationResultCount: req.body.minValidationResultCount, minContractEvidenceCount: req.body.minContractEvidenceCount, minApiRouteEvidenceCount: req.body.minApiRouteEvidenceCount, minWorkerEvidenceCount: req.body.minWorkerEvidenceCount, maxOpenHighRisks: req.body.maxOpenHighRisks, minSignoffCount: req.body.minSignoffCount, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/global-implementation/completion-checklist/review/prepare', validateBody(hybridPythonPlatformGlobalImplementationCompletionChecklistReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-global-implementation-completion-checklist-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonGlobalImplementationCompletionChecklistReview({ jobType: 'platform.global_implementation_completion_checklist_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, stage: req.body.stage, phase: req.body.phase, checklistScope: req.body.checklistScope, domain: req.body.domain, operatingMode: req.body.operatingMode, route: req.body.route, jobTypes: req.body.jobTypes, functionalAreas: req.body.functionalAreas, implementationTasks: req.body.implementationTasks, validationTasks: req.body.validationTasks, handoverTasks: req.body.handoverTasks, deferredItems: req.body.deferredItems, approvals: req.body.approvals, evidence: req.body.evidence, minFunctionalAreaCount: req.body.minFunctionalAreaCount, minImplementationTaskCount: req.body.minImplementationTaskCount, minValidationTaskCount: req.body.minValidationTaskCount, minHandoverTaskCount: req.body.minHandoverTaskCount, maxOpenCriticalDeferredItems: req.body.maxOpenCriticalDeferredItems, minApprovalCount: req.body.minApprovalCount, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });


hybridPythonRouter.post('/platform/final-operational/handover/review/prepare', validateBody(hybridPythonPlatformFinalOperationalHandoverReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-final-operational-handover-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonFinalOperationalHandoverReview({ jobType: 'platform.final_operational_handover_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, stage: req.body.stage, phase: req.body.phase, handoverScope: req.body.handoverScope, domain: req.body.domain, operatingMode: req.body.operatingMode, route: req.body.route, jobTypes: req.body.jobTypes, runbooks: req.body.runbooks, ownerAssignments: req.body.ownerAssignments, supportModel: req.body.supportModel, monitoringControls: req.body.monitoringControls, escalationPaths: req.body.escalationPaths, operationalRisks: req.body.operationalRisks, signoffs: req.body.signoffs, evidence: req.body.evidence, minRunbookCount: req.body.minRunbookCount, minOwnerAssignmentCount: req.body.minOwnerAssignmentCount, minSupportModelCount: req.body.minSupportModelCount, minMonitoringControlCount: req.body.minMonitoringControlCount, minEscalationPathCount: req.body.minEscalationPathCount, maxOpenHighRisks: req.body.maxOpenHighRisks, minSignoffCount: req.body.minSignoffCount, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/phase-closure/certification/review/prepare', validateBody(hybridPythonPlatformPhaseClosureCertificationReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-phase-closure-certification-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonPhaseClosureCertificationReview({ jobType: 'platform.phase_closure_certification_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, stage: req.body.stage, phase: req.body.phase, certificationScope: req.body.certificationScope, domain: req.body.domain, operatingMode: req.body.operatingMode, route: req.body.route, jobTypes: req.body.jobTypes, closureCriteria: req.body.closureCriteria, evidencePackage: req.body.evidencePackage, handoverEvidence: req.body.handoverEvidence, residualRisks: req.body.residualRisks, releaseArtifacts: req.body.releaseArtifacts, approvals: req.body.approvals, nextPhaseBacklog: req.body.nextPhaseBacklog, evidence: req.body.evidence, minClosureCriteriaCount: req.body.minClosureCriteriaCount, minEvidencePackageCount: req.body.minEvidencePackageCount, minHandoverEvidenceCount: req.body.minHandoverEvidenceCount, minReleaseArtifactCount: req.body.minReleaseArtifactCount, maxOpenHighRisks: req.body.maxOpenHighRisks, minApprovalCount: req.body.minApprovalCount, requireNextPhaseBacklogSeparation: req.body.requireNextPhaseBacklogSeparation, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });
hybridPythonRouter.post('/platform/recovery-capability/validation/review/prepare', validateBody(hybridPythonPlatformRecoveryCapabilityValidationReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-recovery-capability-validation-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonRecoveryCapabilityValidationReview({ jobType: 'platform.recovery_capability_validation_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, stage: req.body.stage, phase: req.body.phase, validationWindow: req.body.validationWindow, domain: req.body.domain, operatingMode: req.body.operatingMode, route: req.body.route, jobTypes: req.body.jobTypes, restoreTests: req.body.restoreTests, rtoRpoChecks: req.body.rtoRpoChecks, backupIntegrity: req.body.backupIntegrity, incidentReplayResults: req.body.incidentReplayResults, dependencyRecovery: req.body.dependencyRecovery, communicationValidation: req.body.communicationValidation, risks: req.body.risks, approvals: req.body.approvals, evidence: req.body.evidence, minRestoreTestCount: req.body.minRestoreTestCount, minRtoRpoCheckCount: req.body.minRtoRpoCheckCount, minBackupIntegrityCount: req.body.minBackupIntegrityCount, maxOpenHighRisks: req.body.maxOpenHighRisks, minApprovalCount: req.body.minApprovalCount, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/long-term-operability/sustainability/review/prepare', validateBody(hybridPythonPlatformLongTermOperabilitySustainabilityReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-long-term-operability-sustainability-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonLongTermOperabilitySustainabilityReview({ jobType: 'platform.long_term_operability_sustainability_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, stage: req.body.stage, phase: req.body.phase, horizon: req.body.horizon, domain: req.body.domain, operatingMode: req.body.operatingMode, route: req.body.route, jobTypes: req.body.jobTypes, sustainabilityMetrics: req.body.sustainabilityMetrics, ownershipSignals: req.body.ownershipSignals, knowledgeBaseReviews: req.body.knowledgeBaseReviews, dependencyLifecycle: req.body.dependencyLifecycle, budgetSignals: req.body.budgetSignals, riskAcceptances: req.body.riskAcceptances, improvementCadence: req.body.improvementCadence, approvals: req.body.approvals, evidence: req.body.evidence, minSustainabilityMetricCount: req.body.minSustainabilityMetricCount, minOwnershipSignalCount: req.body.minOwnershipSignalCount, minKnowledgeReviewCount: req.body.minKnowledgeReviewCount, maxOpenHighRisks: req.body.maxOpenHighRisks, minApprovalCount: req.body.minApprovalCount, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/recurring-maintenance/cycle/readiness/review/prepare', validateBody(hybridPythonPlatformRecurringMaintenanceCycleReadinessReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-recurring-maintenance-cycle-readiness-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonRecurringMaintenanceCycleReadinessReview({ jobType: 'platform.recurring_maintenance_cycle_readiness_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, stage: req.body.stage, phase: req.body.phase, targetCycle: req.body.targetCycle, domain: req.body.domain, operatingMode: req.body.operatingMode, route: req.body.route, jobTypes: req.body.jobTypes, maintenanceWindows: req.body.maintenanceWindows, patchCadence: req.body.patchCadence, dependencyUpdatePlan: req.body.dependencyUpdatePlan, backupValidation: req.body.backupValidation, runbookSchedule: req.body.runbookSchedule, ownerRoster: req.body.ownerRoster, approvals: req.body.approvals, evidence: req.body.evidence, minMaintenanceWindowCount: req.body.minMaintenanceWindowCount, minOwnerCount: req.body.minOwnerCount, minApprovalCount: req.body.minApprovalCount, requirePatchCadence: req.body.requirePatchCadence, requireBackupValidation: req.body.requireBackupValidation, requireEvidence: req.body.requireEvidence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/stage-exit/readiness/review/prepare', validateBody(hybridPythonPlatformStageExitReadinessReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-stage-exit-readiness-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonStageExitReadinessReview({ jobType: 'platform.stage_exit_readiness_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, stage: req.body.stage, phase: req.body.phase, targetState: req.body.targetState, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, exitCriteria: req.body.exitCriteria, operationalHandoff: req.body.operationalHandoff, evidenceBundle: req.body.evidenceBundle, rollbackPlan: req.body.rollbackPlan, supportReadiness: req.body.supportReadiness, approvals: req.body.approvals, evidence: req.body.evidence, minExitCriteriaCount: req.body.minExitCriteriaCount, minHandoffCount: req.body.minHandoffCount, minSupportReadinessCount: req.body.minSupportReadinessCount, minApprovalCount: req.body.minApprovalCount, requireRollbackPlan: req.body.requireRollbackPlan, requireEvidenceBundle: req.body.requireEvidenceBundle } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/phase-two/rollout/governance/review/prepare', validateBody(hybridPythonPlatformPhaseTwoRolloutGovernanceReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-phase-two-rollout-governance-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonPhaseTwoRolloutGovernanceReview({ jobType: 'platform.phase_two_rollout_governance_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, phase: req.body.phase, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, milestones: req.body.milestones, approvals: req.body.approvals, cohorts: req.body.cohorts, guardrails: req.body.guardrails, communicationsPlan: req.body.communicationsPlan, supportPlan: req.body.supportPlan, evidence: req.body.evidence, minApprovalCount: req.body.minApprovalCount, maxOpenBlockers: req.body.maxOpenBlockers, requireCommsPlan: req.body.requireCommsPlan, requireSupportPlan: req.body.requireSupportPlan, requireGuardrails: req.body.requireGuardrails } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });

hybridPythonRouter.post('/platform/executive-metrics/governance/review/prepare', validateBody(hybridPythonPlatformExecutiveMetricsGovernanceReviewPrepareSchema), async (req, res) => { const idempotencyKey = buildDomainIdempotencyKey('platform-executive-metrics-governance-review', { organizationId: req.user?.organizationId, actorUserId: req.user?.userId, requestBody: req.body }); const result = await runHybridPythonExecutiveMetricsGovernanceReview({ jobType: 'platform.executive_metrics_governance_review', idempotencyKey, correlationId: req.requestId, organizationId: req.user?.organizationId, actorUserId: req.user?.userId, dryRun: true, payload: { releaseId: req.body.releaseId, domain: req.body.domain, route: req.body.route, jobTypes: req.body.jobTypes, metricDefinitions: req.body.metricDefinitions, dashboards: req.body.dashboards, reviewCadence: req.body.reviewCadence, owners: req.body.owners, evidence: req.body.evidence, requiredMetrics: req.body.requiredMetrics, maxMetricAgeDays: req.body.maxMetricAgeDays, requireOwnerAck: req.body.requireOwnerAck, requireDashboard: req.body.requireDashboard, requireCadence: req.body.requireCadence } }, req.requestId); res.status(result.accepted ? 202 : 200).json({ ...result, requestId: req.requestId ?? null }); });
