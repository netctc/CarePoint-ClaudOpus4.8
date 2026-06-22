#!/usr/bin/env python3
from __future__ import annotations

import compileall
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SERVICE = ROOT / "services" / "python-worker"

REQUIRED_FILES = [
    SERVICE / "Dockerfile",
    SERVICE / "requirements.txt",
    SERVICE / "pyproject.toml",
    SERVICE / "carepoint_python_worker" / "main.py",
    SERVICE / "carepoint_python_worker" / "models.py",
    SERVICE / "carepoint_python_worker" / "security.py",
    SERVICE / "carepoint_python_worker" / "artifacts.py",
    SERVICE / "carepoint_python_worker" / "celery_app.py",
    SERVICE / "carepoint_python_worker" / "jobs" / "processors.py",
    SERVICE / "carepoint_python_worker" / "jobs" / "store.py",
    SERVICE / "carepoint_python_worker" / "jobs" / "shadow_store.py",
    SERVICE / "carepoint_python_worker" / "jobs" / "shadow_compare_store.py",
    SERVICE / "carepoint_python_worker" / "canary.py",
    SERVICE / "carepoint_python_worker" / "contracts.py",
    SERVICE / "carepoint_python_worker" / "rollout.py",
    SERVICE / "carepoint_python_worker" / "release.py",
    ROOT / "services" / "api" / "src" / "lib" / "hybrid-python.ts",
    ROOT / "services" / "api" / "src" / "modules" / "hybrid-python" / "hybrid-python.routes.ts",
]

errors: list[str] = []
for path in REQUIRED_FILES:
    if not path.exists():
        errors.append(f"missing required file: {path.relative_to(ROOT)}")

if not compileall.compile_dir(SERVICE / "carepoint_python_worker", quiet=1):
    errors.append("python worker package failed compileall")

contracts = (ROOT / "packages" / "contracts" / "src" / "index.ts").read_text(encoding="utf-8")
for needle in [
    "hybridPythonJobEnvelopeSchema",
    "hybridPythonJobRecordSchema",
    "hybridPythonArtifactRefSchema",
    "hybridPythonJobMetricsSchema",
    "hybridPythonShadowMetricsSchema",
    "hybridPythonAuditExportPrepareSchema",
    "hybridPythonShadowComparisonInputSchema",
    "hybridPythonCanaryGateSchema",
    "hybridPythonArtifactGcSchema",
    "hybridPythonContractManifestSchema",
    "hybridPythonContractTestVectorSchema",
    "hybridPythonContractValidationReportSchema",
    "hybridPythonCanaryRolloutPlanSchema",
    "hybridPythonCanaryRolloutActionSchema",
    "hybridPythonCanaryRolloutStateSchema",
    "hybridPythonCanaryAssignmentRequestSchema",
    "hybridPythonCanaryAssignmentSchema",
    "hybridPythonRolloutReadinessReportSchema",
    "hybridPythonEvidenceBundleSchema",
    "hybridPythonReleaseChecklistReportSchema",
    "hybridPythonRoutingDecisionSchema",
    "hybridPythonAccountsReadModelPrepareSchema",
    "hybridPythonProviderRoleReconcilePrepareSchema",
    "hybridPythonSchedulingAvailabilitySnapshotPrepareSchema",
    "hybridPythonMessagingReminderPlanPrepareSchema",
    "hybridPythonBillingPaymentReconcilePrepareSchema",
    "hybridPythonClinicalRecordsAccessAuditPrepareSchema",
    "hybridPythonPlatformDbIndexAdvisoryPrepareSchema",
    "hybridPythonPlatformSloRegressionReportPrepareSchema",
    "hybridPythonPlatformContractReplayPrepareSchema",
    "hybridPythonPlatformPrivacyPreflightPrepareSchema",
    "hybridPythonPlatformReleaseDecisionPrepareSchema",
    "hybridPythonPlatformRollbackDrillPrepareSchema",
    "hybridPythonPlatformPostDeployVerifyPrepareSchema",
    "hybridPythonPlatformChangeTicketBundlePrepareSchema",
    "hybridPythonPlatformCapacityPlanPrepareSchema",
    "hybridPythonPlatformAlertPolicyReviewPrepareSchema",
    "hybridPythonPlatformDependencyReadinessPrepareSchema",
    "hybridPythonPlatformProductionReadinessPrepareSchema",
    "hybridPythonPlatformDataRetentionReviewPrepareSchema",
    "hybridPythonPlatformAuditTrailReviewPrepareSchema",
    "hybridPythonPlatformSecurityPostureReviewPrepareSchema",
    "hybridPythonPlatformSupplyChainReviewPrepareSchema",
    "hybridPythonPlatformSchemaMigrationRehearsalPrepareSchema",
    "hybridPythonPlatformBackupRestoreDrillPrepareSchema",
    "hybridPythonPlatformObservabilityCoverageReviewPrepareSchema",
    "hybridPythonPlatformFeatureFlagReviewPrepareSchema",
    "hybridPythonPlatformDomainMigrationReadinessPrepareSchema",
    "hybridPythonPlatformCutoverPlanPrepareSchema",
    "hybridPythonPlatformOwnerRegistryReviewPrepareSchema",
    "hybridPythonPlatformPostCutoverMonitorPrepareSchema",
    "hybridPythonPlatformLegacyPathDecommissionPrepareSchema",
    "hybridPythonPlatformSteadyStateOpsReviewPrepareSchema",
    "hybridPythonPlatformQueueResilienceReviewPrepareSchema",
    "hybridPythonPlatformArtifactIntegrityReviewPrepareSchema",
    "hybridPythonPlatformRunbookFreshnessReviewPrepareSchema",
    "hybridPythonPlatformSupportEscalationReviewPrepareSchema",
    "hybridPythonPlatformCostGuardrailReviewPrepareSchema",
    "hybridPythonPlatformEnvironmentParityReviewPrepareSchema",
    "hybridPythonPlatformAccessControlReviewPrepareSchema",
    "hybridPythonPlatformDataQualityReviewPrepareSchema",
    "hybridPythonPlatformCiStagingValidationReviewPrepareSchema",
    "hybridPythonPlatformReleaseClosureReviewPrepareSchema",
    "hybridPythonPlatformProductionCanaryObservationReviewPrepareSchema",
    "hybridPythonPlatformIncidentResponseReadinessReviewPrepareSchema",
    "hybridPythonPlatformTrafficPromotionReadinessReviewPrepareSchema",
    "hybridPythonPlatformEvidenceRetentionAuditReviewPrepareSchema",
    "hybridPythonPlatformSloErrorBudgetReviewPrepareSchema",
    "hybridPythonPlatformAutoRollbackSafeguardReviewPrepareSchema",
    "hybridPythonPlatformThirdPartyDependencyReviewPrepareSchema",
    "hybridPythonPlatformCapacityScalingReadinessReviewPrepareSchema",
    "hybridPythonPlatformCompliancePrivacyEvidenceReviewPrepareSchema",
    "hybridPythonPlatformRunbookDrillVerificationReviewPrepareSchema",
    "hybridPythonPlatformDisasterRecoveryBackupReviewPrepareSchema",
    "hybridPythonPlatformChangeMigrationReadinessReviewPrepareSchema",
    "hybridPythonPlatformConfigurationSecretRotationReviewPrepareSchema",
    "hybridPythonPlatformMaintenanceWindowReadinessReviewPrepareSchema",
    "hybridPythonPlatformAuditForensicsReadinessReviewPrepareSchema",
    "hybridPythonPlatformBusinessContinuityReadinessReviewPrepareSchema",
    "hybridPythonPlatformPostIncidentLearningReviewPrepareSchema",
    "hybridPythonPlatformTechDebtGovernanceReviewPrepareSchema",
    "hybridPythonPlatformVendorResilienceReviewPrepareSchema",
    "hybridPythonPlatformKnowledgeTransferReadinessReviewPrepareSchema",
    "hybridPythonPlatformArchitectureOwnershipReviewPrepareSchema",
    "hybridPythonPlatformExecutiveMetricsGovernanceReviewPrepareSchema",
    "hybridPythonPlatformDomainAdoptionReadinessReviewPrepareSchema",
    "hybridPythonPlatformPhaseTwoRolloutGovernanceReviewPrepareSchema",
    "hybridPythonPlatformDomainPilotExecutionReviewPrepareSchema",
    "hybridPythonPlatformPhaseTwoExpansionControlReviewPrepareSchema",
    "hybridPythonPlatformDomainOutcomeMeasurementReviewPrepareSchema",
    "hybridPythonPlatformPhaseTwoFeedbackAdoptionReviewPrepareSchema",
    "hybridPythonPlatformDomainGraduationReadinessReviewPrepareSchema",
    "hybridPythonPlatformPhaseTwoLearningConsolidationReviewPrepareSchema",
    "hybridPythonPlatformDomainWideAdoptionReadinessReviewPrepareSchema",
    "hybridPythonPlatformPhaseTwoSupportTransitionReviewPrepareSchema",
    "hybridPythonPlatformDomainAdoptionStabilizationReviewPrepareSchema",
    "hybridPythonPlatformPhaseTwoValueRealizationReviewPrepareSchema",
    "hybridPythonPlatformPhaseTwoClosureAcceptanceReviewPrepareSchema",
    "hybridPythonPlatformPhaseThreeTransitionReadinessReviewPrepareSchema",
    "hybridPythonPlatformPhaseThreeDomainWaveReadinessReviewPrepareSchema",
    "hybridPythonPlatformPhaseThreeOperatingModelAlignmentReviewPrepareSchema",
    "hybridPythonPlatformPhaseThreeWaveExecutionReviewPrepareSchema",
    "hybridPythonPlatformPhaseThreeAdoptionValueTrackingReviewPrepareSchema",
    "hybridPythonPlatformPhaseThreeGapRemediationReviewPrepareSchema",
    "hybridPythonPlatformMigrationStageCompletionReadinessReviewPrepareSchema",
    "hybridPythonPlatformPhaseThreeRemediationClosureReviewPrepareSchema",
    "hybridPythonPlatformExecutiveOperationalHandoffReviewPrepareSchema",
    "hybridPythonPlatformGlobalTaskStatusTrackingReviewPrepareSchema",
    "hybridPythonPlatformProjectStateHealthReviewPrepareSchema",
    "hybridPythonPlatformFinalAcceptanceEvidenceReviewPrepareSchema",
    "hybridPythonPlatformStageExitReadinessReviewPrepareSchema",
    "hybridPythonPlatformStageClosureCertificationReviewPrepareSchema",
    "hybridPythonPlatformPostClosureOperationalTransitionReviewPrepareSchema",
    "hybridPythonPlatformPostClosureMonitoringReviewPrepareSchema",
    "hybridPythonPlatformSteadyStateTransferValidationReviewPrepareSchema",
    "hybridPythonPlatformSteadyStateOperationalAssuranceReviewPrepareSchema",
    "hybridPythonPlatformContinuousImprovementBacklogReviewPrepareSchema",
    "hybridPythonPlatformStableOperationsOptimizationReviewPrepareSchema",
    "hybridPythonPlatformRecurringMaintenanceCycleReadinessReviewPrepareSchema",
    "hybridPythonPlatformMaintenanceCycleExecutionReviewPrepareSchema",
    "hybridPythonPlatformLongTermOperabilitySustainabilityReviewPrepareSchema",
    "hybridPythonPlatformRecurringOperationalMaturityAuditReviewPrepareSchema",
    "hybridPythonPlatformStableStateContinuityControlReviewPrepareSchema",
    "hybridPythonPlatformOperationalResilienceGovernanceReviewPrepareSchema",
    "hybridPythonPlatformRecoveryCapabilityValidationReviewPrepareSchema",
    "hybridPythonPlatformOperationalResilienceOptimizationReviewPrepareSchema",
    "hybridPythonPlatformAutomatedContinuityPreparednessReviewPrepareSchema",
    "hybridPythonPlatformAutomatedContinuityExecutionValidationReviewPrepareSchema",
    "hybridPythonPlatformFinalClosureEvidencePackageReviewPrepareSchema",
    "hybridPythonPlatformGlobalImplementationCompletionChecklistReviewPrepareSchema",
    "hybridPythonPlatformFinalOperationalHandoverReviewPrepareSchema",
    "hybridPythonPlatformPhaseClosureCertificationReviewPrepareSchema",
    "hybridPythonPlatformOperationalResilienceFeedbackLoopReviewPrepareSchema",
]:
    if needle not in contracts:
        errors.append(f"contracts missing {needle}")

routes = (ROOT / "services" / "api" / "src" / "modules" / "hybrid-python" / "hybrid-python.routes.ts").read_text(encoding="utf-8")
for needle in ["/jobs/:idempotencyKey", "/admin/audit-export/prepare", "/jobs/metrics", "/shadow/jobs", "/shadow/comparisons", "/canary/gate", "/canary/assignment", "/canary/rollout/advance", "/canary/rollout/plan", "/canary/rollout", "/contracts/manifest", "/contracts/test-vectors", "/contracts/validate", "/rollout/readiness", "/artifacts/gc", "/release/checklist", "/evidence/bundle", "/admin/accounts/read-model/prepare", "/admin/provider-roles/reconcile/prepare", "/scheduling/availability/snapshot/prepare", "/messaging/reminders/plan/prepare", "/billing/payments/reconcile/prepare", "/clinical/records/access-audit/prepare", "/platform/db-index-advisory/prepare", "/platform/slo-regression/report/prepare", "/platform/contracts/replay/prepare", "/platform/privacy/preflight/prepare", "/platform/release/decision/prepare", "/platform/rollback/drill/prepare", "/platform/post-deploy/verify/prepare", "/platform/change-ticket/bundle/prepare", "/platform/capacity/plan/prepare", "/platform/alerts/review/prepare", "/platform/dependencies/readiness/prepare", "/platform/production/readiness/prepare", "/platform/data-retention/review/prepare", "/platform/audit-trail/review/prepare", "/platform/security/posture/review/prepare", "/platform/supply-chain/review/prepare", "/platform/schema-migration/rehearsal/prepare", "/platform/backup-restore/drill/prepare", "/platform/observability/coverage/review/prepare", "/platform/feature-flags/review/prepare", "/platform/domain-migration/readiness/prepare", "/platform/cutover/plan/prepare", "/platform/owner-registry/review/prepare", "/platform/post-cutover/monitor/prepare", "/platform/legacy-paths/decommission/prepare", "/platform/steady-state/ops/review/prepare", "/platform/queues/resilience/review/prepare", "/platform/artifacts/integrity/review/prepare", "/platform/runbooks/freshness/review/prepare", "/platform/support/escalation/review/prepare", "/platform/cost/guardrails/review/prepare", "/platform/environment/parity/review/prepare", "/platform/access-control/review/prepare", "/platform/data-quality/review/prepare", "/platform/ci-staging/validation/review/prepare", "/platform/release/closure/review/prepare", "/platform/production-canary/observation/review/prepare", "/platform/incident-response/readiness/review/prepare", "/platform/traffic/promotion/readiness/review/prepare", "/platform/evidence/retention/audit/review/prepare", "/platform/slo/error-budget/review/prepare", "/platform/auto-rollback/safeguard/review/prepare", "/platform/third-party/dependencies/review/prepare", "/platform/capacity/scaling/readiness/review/prepare", "/platform/compliance/privacy/evidence/review/prepare", "/platform/runbooks/drills/verification/review/prepare", "/platform/disaster-recovery/backups/review/prepare", "/platform/change-migration/readiness/review/prepare", "/platform/configuration/secrets/rotation/review/prepare", "/platform/maintenance/window/readiness/review/prepare", "/platform/audit-forensics/readiness/review/prepare", "/platform/business-continuity/readiness/review/prepare", "/platform/post-incident/learning/review/prepare", "/platform/tech-debt/governance/review/prepare", "/platform/vendor/resilience/review/prepare", "/platform/knowledge-transfer/readiness/review/prepare", "/platform/architecture/ownership/review/prepare", "/platform/executive-metrics/governance/review/prepare", "/platform/domain-adoption/readiness/review/prepare", "/platform/phase-two/rollout/governance/review/prepare", "/platform/domain-pilot/execution/review/prepare", "/platform/phase-two/expansion/control/review/prepare", "/platform/domain-outcomes/measurement/review/prepare", "/platform/phase-two/feedback/adoption/review/prepare", "/platform/domain-graduation/readiness/review/prepare", "/platform/phase-two/learning/consolidation/review/prepare", "/platform/domain-wide-adoption/readiness/review/prepare", "/platform/phase-two/support/transition/review/prepare", "/platform/domain-adoption/stabilization/review/prepare", "/platform/phase-two/value-realization/review/prepare", "/platform/phase-two/closure/acceptance/review/prepare", "/platform/phase-three/transition/readiness/review/prepare", "/platform/phase-three/domain-wave/readiness/review/prepare", "/platform/phase-three/operating-model/alignment/review/prepare", "/platform/phase-three/wave/execution/review/prepare", "/platform/phase-three/adoption-value/tracking/review/prepare", "/platform/phase-three/gap-remediation/review/prepare", "/platform/migration-stage/completion/readiness/review/prepare", "/platform/phase-three/remediation/closure/review/prepare", "/platform/executive-operational/handoff/review/prepare", "/platform/global-task-status/tracking/review/prepare", "/platform/project-state/health/review/prepare", "/platform/final-acceptance/evidence/review/prepare", "/platform/stage-exit/readiness/review/prepare", "/platform/stage-closure/certification/review/prepare", "/platform/post-closure/operational-transition/review/prepare", "/platform/post-closure/monitoring/review/prepare", "/platform/steady-state/transfer/validation/review/prepare", "/platform/steady-state/operational-assurance/review/prepare", "/platform/continuous-improvement/backlog/review/prepare"]:
    if needle not in routes:
        errors.append(f"Node hybrid routes missing {needle}")

lib = (ROOT / "services" / "api" / "src" / "lib" / "hybrid-python.ts").read_text(encoding="utf-8")
for needle in ["createHmac", "x-carepoint-python-signature", "getHybridPythonJobMetrics", "getHybridPythonShadowRecords", "recordHybridPythonShadowComparison", "getHybridPythonCanaryGate", "getHybridPythonContractManifest", "getHybridPythonContractTestVectors", "validateHybridPythonContract", "getHybridPythonRolloutReadiness", "getHybridPythonCanaryAssignment", "advanceHybridPythonCanaryRollout", "planHybridPythonCanaryRollout", "getHybridPythonCanaryRollout", "runHybridPythonArtifactGc", "resolveHybridPythonRoutingDecision", "getHybridPythonReleaseChecklist", "getHybridPythonEvidenceBundle", "replayHybridPythonContracts", "runHybridPythonPrivacyPreflight", "runHybridPythonReleaseDecision", "runHybridPythonRollbackDrill", "runHybridPythonPostDeployVerify", "runHybridPythonChangeTicketBundle", "runHybridPythonCapacityPlan", "runHybridPythonAlertPolicyReview", "runHybridPythonDependencyReadiness", "runHybridPythonProductionReadiness", "runHybridPythonDataRetentionReview", "runHybridPythonAuditTrailReview", "runHybridPythonSecurityPostureReview", "runHybridPythonSupplyChainReview", "runHybridPythonSchemaMigrationRehearsal", "runHybridPythonBackupRestoreDrill", "runHybridPythonObservabilityCoverageReview", "runHybridPythonFeatureFlagReview", "runHybridPythonDomainMigrationReadiness", "runHybridPythonCutoverPlan", "runHybridPythonOwnerRegistryReview", "runHybridPythonPostCutoverMonitor", "runHybridPythonLegacyPathDecommission", "runHybridPythonSteadyStateOpsReview", "runHybridPythonQueueResilienceReview", "runHybridPythonArtifactIntegrityReview", "runHybridPythonRunbookFreshnessReview", "runHybridPythonSupportEscalationReview", "runHybridPythonCostGuardrailReview", "runHybridPythonEnvironmentParityReview", "runHybridPythonAccessControlReview", "runHybridPythonDataQualityReview", "runHybridPythonCiStagingValidationReview", "runHybridPythonReleaseClosureReview", "runHybridPythonProductionCanaryObservationReview", "runHybridPythonIncidentResponseReadinessReview", "runHybridPythonTrafficPromotionReadinessReview", "runHybridPythonEvidenceRetentionAuditReview", "runHybridPythonSloErrorBudgetReview", "runHybridPythonAutoRollbackSafeguardReview", "runHybridPythonThirdPartyDependencyReview", "runHybridPythonCapacityScalingReadinessReview", "runHybridPythonCompliancePrivacyEvidenceReview", "runHybridPythonRunbookDrillVerificationReview", "runHybridPythonDisasterRecoveryBackupReview", "runHybridPythonChangeMigrationReadinessReview", "runHybridPythonConfigurationSecretRotationReview", "runHybridPythonMaintenanceWindowReadinessReview", "runHybridPythonAuditForensicsReadinessReview", "runHybridPythonBusinessContinuityReadinessReview", "runHybridPythonPostIncidentLearningReview", "runHybridPythonTechDebtGovernanceReview", "runHybridPythonVendorResilienceReview", "runHybridPythonKnowledgeTransferReadinessReview", "runHybridPythonArchitectureOwnershipReview", "runHybridPythonExecutiveMetricsGovernanceReview", "runHybridPythonDomainAdoptionReadinessReview", "runHybridPythonPhaseTwoRolloutGovernanceReview", "runHybridPythonDomainPilotExecutionReview", "runHybridPythonPhaseTwoExpansionControlReview", "runHybridPythonDomainOutcomeMeasurementReview", "runHybridPythonPhaseTwoFeedbackAdoptionReview", "runHybridPythonDomainGraduationReadinessReview", "runHybridPythonPhaseTwoLearningConsolidationReview", "runHybridPythonDomainWideAdoptionReadinessReview", "runHybridPythonPhaseTwoSupportTransitionReview", "runHybridPythonDomainAdoptionStabilizationReview", "runHybridPythonPhaseTwoValueRealizationReview", "runHybridPythonPhaseTwoClosureAcceptanceReview", "runHybridPythonPhaseThreeTransitionReadinessReview", "runHybridPythonPhaseThreeDomainWaveReadinessReview", "runHybridPythonPhaseThreeOperatingModelAlignmentReview", "runHybridPythonPhaseThreeWaveExecutionReview", "runHybridPythonPhaseThreeAdoptionValueTrackingReview", "runHybridPythonPhaseThreeGapRemediationReview", "runHybridPythonMigrationStageCompletionReadinessReview", "runHybridPythonPhaseThreeRemediationClosureReview", "runHybridPythonExecutiveOperationalHandoffReview", "runHybridPythonGlobalTaskStatusTrackingReview", "runHybridPythonProjectStateHealthReview", "runHybridPythonFinalAcceptanceEvidenceReview", "runHybridPythonStageExitReadinessReview", "runHybridPythonStageClosureCertificationReview", "runHybridPythonPostClosureOperationalTransitionReview", "runHybridPythonPostClosureMonitoringReview", "runHybridPythonSteadyStateTransferValidationReview", "runHybridPythonSteadyStateOperationalAssuranceReview", "runHybridPythonContinuousImprovementBacklogReview"]:
    if needle not in lib:
        errors.append(f"Node hybrid lib missing {needle}")


# V58 cumulative assertions. These are separated from the legacy route/helper arrays to
# keep the verification script readable while preserving all prior checks.
v58_required_routes = [
    "/platform/stable-operations/optimization/review/prepare",
    "/platform/recurring-maintenance/cycle/readiness/review/prepare",
    "/platform/maintenance-cycle/execution/review/prepare",
    "/platform/long-term-operability/sustainability/review/prepare",
    "/platform/recurring-operational-maturity/audit/review/prepare",
    "/platform/stable-state/continuity-control/review/prepare",
    "/platform/operational-resilience/governance/review/prepare",
    "/platform/recovery-capability/validation/review/prepare",
    "/platform/operational-resilience/optimization/review/prepare",
    "/platform/automated-continuity/preparedness/review/prepare",
    "/platform/automated-continuity/execution/validation/review/prepare",
    "/platform/operational-resilience/feedback-loop/review/prepare",
    "/platform/final-closure/evidence-package/review/prepare",
    "/platform/global-implementation/completion-checklist/review/prepare",
    "/platform/final-operational/handover/review/prepare",
    "/platform/phase-closure/certification/review/prepare",
]
for needle in v58_required_routes:
    if needle not in routes:
        errors.append(f"Node hybrid routes missing {needle}")

v58_required_helpers = [
    "runHybridPythonStableOperationsOptimizationReview",
    "runHybridPythonRecurringMaintenanceCycleReadinessReview",
    "runHybridPythonMaintenanceCycleExecutionReview",
    "runHybridPythonLongTermOperabilitySustainabilityReview",
    "runHybridPythonRecurringOperationalMaturityAuditReview",
    "runHybridPythonStableStateContinuityControlReview",
    "runHybridPythonOperationalResilienceGovernanceReview",
    "runHybridPythonRecoveryCapabilityValidationReview",
    "runHybridPythonOperationalResilienceOptimizationReview",
    "runHybridPythonAutomatedContinuityPreparednessReview",
    "runHybridPythonAutomatedContinuityExecutionValidationReview",
    "runHybridPythonOperationalResilienceFeedbackLoopReview",
    "runHybridPythonFinalClosureEvidencePackageReview",
    "runHybridPythonGlobalImplementationCompletionChecklistReview",
    "runHybridPythonFinalOperationalHandoverReview",
    "runHybridPythonPhaseClosureCertificationReview",
]
for needle in v58_required_helpers:
    if needle not in lib:
        errors.append(f"Node hybrid lib missing {needle}")

app_ts = (ROOT / "services" / "api" / "src" / "app.ts").read_text(encoding="utf-8")
if "apiRoutePaths.hybridPython" not in app_ts or "hybridPythonRouter" not in app_ts:
    errors.append("Node API app.ts does not mount hybridPythonRouter")

compose = (ROOT / "compose.yml").read_text(encoding="utf-8")
for needle in ["python-worker-api", "python-worker-celery", "PYTHON_WORKER_REQUIRE_SIGNATURE", "PYTHON_WORKER_ARTIFACT_STORAGE_DIR", "PYTHON_WORKER_ROLLOUT_STATE_PATH"]:
    if needle not in compose:
        errors.append(f"compose.yml missing {needle}")

if errors:
    print("Option B Python worker verification failed:", file=sys.stderr)
    for error in errors:
        print(f"- {error}", file=sys.stderr)
    raise SystemExit(1)

print("Option B Python worker v64 verification passed.")
