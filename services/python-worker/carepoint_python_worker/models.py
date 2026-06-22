from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class AliasModel(BaseModel):
    class Config:
        populate_by_name = True


class StrictAliasModel(AliasModel):
    class Config:
        populate_by_name = True
        extra = "forbid"


class JobType(StrEnum):
    ADMIN_AUDIT_EXPORT = "admin.audit_export"
    ADMIN_ACCOUNTS_BULK_VALIDATE = "admin.accounts_bulk_validate"
    ADMIN_ACCOUNTS_READ_MODEL = "admin.accounts_read_model"
    ADMIN_PROVIDER_ROLE_RECONCILE = "admin.provider_role_reconcile"
    SCHEDULING_AVAILABILITY_SNAPSHOT = "scheduling.availability_snapshot"
    MESSAGING_REMINDER_PLAN = "messaging.reminder_plan"
    BILLING_PAYMENT_RECONCILE = "billing.payment_reconcile"
    CLINICAL_RECORDS_ACCESS_AUDIT = "clinical.records_access_audit"
    PLATFORM_DB_INDEX_ADVISORY = "platform.db_index_advisory"
    PLATFORM_SLO_REGRESSION_REPORT = "platform.slo_regression_report"
    PLATFORM_CONTRACT_REPLAY = "platform.contract_replay"
    PLATFORM_PRIVACY_PREFLIGHT = "platform.privacy_preflight"
    PLATFORM_RELEASE_DECISION = "platform.release_decision"
    PLATFORM_ROLLBACK_DRILL = "platform.rollback_drill"
    PLATFORM_POST_DEPLOY_VERIFY = "platform.post_deploy_verify"
    PLATFORM_CHANGE_TICKET_BUNDLE = "platform.change_ticket_bundle"
    PLATFORM_OPERATIONAL_HANDOFF = "platform.operational_handoff"
    PLATFORM_INCIDENT_SIMULATION = "platform.incident_simulation"
    PLATFORM_CAPACITY_PLAN = "platform.capacity_plan"
    PLATFORM_ALERT_POLICY_REVIEW = "platform.alert_policy_review"
    PLATFORM_DEPENDENCY_READINESS = "platform.dependency_readiness"
    PLATFORM_PRODUCTION_READINESS = "platform.production_readiness"
    PLATFORM_DATA_RETENTION_REVIEW = "platform.data_retention_review"
    PLATFORM_AUDIT_TRAIL_REVIEW = "platform.audit_trail_review"
    PLATFORM_SECURITY_POSTURE_REVIEW = "platform.security_posture_review"
    PLATFORM_SUPPLY_CHAIN_REVIEW = "platform.supply_chain_review"
    PLATFORM_SCHEMA_MIGRATION_REHEARSAL = "platform.schema_migration_rehearsal"
    PLATFORM_BACKUP_RESTORE_DRILL = "platform.backup_restore_drill"
    PLATFORM_OBSERVABILITY_COVERAGE_REVIEW = "platform.observability_coverage_review"
    PLATFORM_FEATURE_FLAG_REVIEW = "platform.feature_flag_review"
    PLATFORM_DOMAIN_MIGRATION_READINESS = "platform.domain_migration_readiness"
    PLATFORM_CUTOVER_PLAN = "platform.cutover_plan"
    PLATFORM_OWNER_REGISTRY_REVIEW = "platform.owner_registry_review"
    PLATFORM_POST_CUTOVER_MONITOR = "platform.post_cutover_monitor"
    PLATFORM_LEGACY_PATH_DECOMMISSION = "platform.legacy_path_decommission"
    PLATFORM_STEADY_STATE_OPERATIONS_REVIEW = "platform.steady_state_operations_review"
    PLATFORM_QUEUE_RESILIENCE_REVIEW = "platform.queue_resilience_review"
    PLATFORM_ARTIFACT_INTEGRITY_REVIEW = "platform.artifact_integrity_review"
    PLATFORM_RUNBOOK_FRESHNESS_REVIEW = "platform.runbook_freshness_review"
    PLATFORM_SUPPORT_ESCALATION_REVIEW = "platform.support_escalation_review"
    PLATFORM_COST_GUARDRAIL_REVIEW = "platform.cost_guardrail_review"
    PLATFORM_ENVIRONMENT_PARITY_REVIEW = "platform.environment_parity_review"
    PLATFORM_ACCESS_CONTROL_REVIEW = "platform.access_control_review"
    PLATFORM_DATA_QUALITY_REVIEW = "platform.data_quality_review"
    PLATFORM_CI_STAGING_VALIDATION_REVIEW = "platform.ci_staging_validation_review"
    PLATFORM_RELEASE_CLOSURE_REVIEW = "platform.release_closure_review"
    PLATFORM_PRODUCTION_CANARY_OBSERVATION_REVIEW = "platform.production_canary_observation_review"
    PLATFORM_INCIDENT_RESPONSE_READINESS_REVIEW = "platform.incident_response_readiness_review"
    PLATFORM_TRAFFIC_PROMOTION_READINESS_REVIEW = "platform.traffic_promotion_readiness_review"
    PLATFORM_EVIDENCE_RETENTION_AUDIT_REVIEW = "platform.evidence_retention_audit_review"
    PLATFORM_SLO_ERROR_BUDGET_REVIEW = "platform.slo_error_budget_review"
    PLATFORM_AUTO_ROLLBACK_SAFEGUARD_REVIEW = "platform.auto_rollback_safeguard_review"
    PLATFORM_THIRD_PARTY_DEPENDENCY_REVIEW = "platform.third_party_dependency_review"
    PLATFORM_CAPACITY_SCALING_READINESS_REVIEW = "platform.capacity_scaling_readiness_review"
    PLATFORM_COMPLIANCE_PRIVACY_EVIDENCE_REVIEW = "platform.compliance_privacy_evidence_review"
    PLATFORM_RUNBOOK_DRILL_VERIFICATION_REVIEW = "platform.runbook_drill_verification_review"
    PLATFORM_DISASTER_RECOVERY_BACKUP_REVIEW = "platform.disaster_recovery_backup_review"
    PLATFORM_CHANGE_MIGRATION_READINESS_REVIEW = "platform.change_migration_readiness_review"
    PLATFORM_CONFIGURATION_SECRET_ROTATION_REVIEW = "platform.configuration_secret_rotation_review"
    PLATFORM_MAINTENANCE_WINDOW_READINESS_REVIEW = "platform.maintenance_window_readiness_review"
    PLATFORM_AUDIT_FORENSICS_READINESS_REVIEW = "platform.audit_forensics_readiness_review"
    PLATFORM_BUSINESS_CONTINUITY_READINESS_REVIEW = "platform.business_continuity_readiness_review"
    PLATFORM_POST_INCIDENT_LEARNING_REVIEW = "platform.post_incident_learning_review"
    PLATFORM_TECH_DEBT_GOVERNANCE_REVIEW = "platform.tech_debt_governance_review"
    PLATFORM_VENDOR_RESILIENCE_REVIEW = "platform.vendor_resilience_review"
    PLATFORM_KNOWLEDGE_TRANSFER_READINESS_REVIEW = "platform.knowledge_transfer_readiness_review"
    PLATFORM_ARCHITECTURE_OWNERSHIP_REVIEW = "platform.architecture_ownership_review"
    PLATFORM_EXECUTIVE_METRICS_GOVERNANCE_REVIEW = "platform.executive_metrics_governance_review"
    PLATFORM_DOMAIN_ADOPTION_READINESS_REVIEW = "platform.domain_adoption_readiness_review"
    PLATFORM_PHASE_TWO_ROLLOUT_GOVERNANCE_REVIEW = "platform.phase_two_rollout_governance_review"
    PLATFORM_DOMAIN_PILOT_EXECUTION_REVIEW = "platform.domain_pilot_execution_review"
    PLATFORM_PHASE_TWO_EXPANSION_CONTROL_REVIEW = "platform.phase_two_expansion_control_review"
    PLATFORM_DOMAIN_OUTCOME_MEASUREMENT_REVIEW = "platform.domain_outcome_measurement_review"
    PLATFORM_PHASE_TWO_FEEDBACK_ADOPTION_REVIEW = "platform.phase_two_feedback_adoption_review"
    PLATFORM_DOMAIN_GRADUATION_READINESS_REVIEW = "platform.domain_graduation_readiness_review"
    PLATFORM_PHASE_TWO_LEARNING_CONSOLIDATION_REVIEW = "platform.phase_two_learning_consolidation_review"
    PLATFORM_DOMAIN_WIDE_ADOPTION_READINESS_REVIEW = "platform.domain_wide_adoption_readiness_review"
    PLATFORM_PHASE_TWO_SUPPORT_TRANSITION_REVIEW = "platform.phase_two_support_transition_review"
    PLATFORM_DOMAIN_ADOPTION_STABILIZATION_REVIEW = "platform.domain_adoption_stabilization_review"
    PLATFORM_PHASE_TWO_VALUE_REALIZATION_REVIEW = "platform.phase_two_value_realization_review"
    PLATFORM_PHASE_TWO_CLOSURE_ACCEPTANCE_REVIEW = "platform.phase_two_closure_acceptance_review"
    PLATFORM_PHASE_THREE_TRANSITION_READINESS_REVIEW = "platform.phase_three_transition_readiness_review"
    PLATFORM_PHASE_THREE_DOMAIN_WAVE_READINESS_REVIEW = "platform.phase_three_domain_wave_readiness_review"
    PLATFORM_PHASE_THREE_OPERATING_MODEL_ALIGNMENT_REVIEW = "platform.phase_three_operating_model_alignment_review"
    PLATFORM_PHASE_THREE_WAVE_EXECUTION_REVIEW = "platform.phase_three_wave_execution_review"
    PLATFORM_PHASE_THREE_ADOPTION_VALUE_TRACKING_REVIEW = "platform.phase_three_adoption_value_tracking_review"
    PLATFORM_PHASE_THREE_GAP_REMEDIATION_REVIEW = "platform.phase_three_gap_remediation_review"
    PLATFORM_MIGRATION_STAGE_COMPLETION_READINESS_REVIEW = "platform.migration_stage_completion_readiness_review"
    PLATFORM_PHASE_THREE_REMEDIATION_CLOSURE_REVIEW = "platform.phase_three_remediation_closure_review"
    PLATFORM_EXECUTIVE_OPERATIONAL_HANDOFF_REVIEW = "platform.executive_operational_handoff_review"
    PLATFORM_GLOBAL_TASK_STATUS_TRACKING_REVIEW = "platform.global_task_status_tracking_review"
    PLATFORM_PROJECT_STATE_HEALTH_REVIEW = "platform.project_state_health_review"
    PLATFORM_FINAL_ACCEPTANCE_EVIDENCE_REVIEW = "platform.final_acceptance_evidence_review"
    PLATFORM_STAGE_EXIT_READINESS_REVIEW = "platform.stage_exit_readiness_review"
    PLATFORM_STAGE_CLOSURE_CERTIFICATION_REVIEW = "platform.stage_closure_certification_review"
    PLATFORM_POST_CLOSURE_OPERATIONAL_TRANSITION_REVIEW = "platform.post_closure_operational_transition_review"
    PLATFORM_POST_CLOSURE_MONITORING_REVIEW = "platform.post_closure_monitoring_review"
    PLATFORM_STEADY_STATE_TRANSFER_VALIDATION_REVIEW = "platform.steady_state_transfer_validation_review"
    PLATFORM_STEADY_STATE_OPERATIONAL_ASSURANCE_REVIEW = "platform.steady_state_operational_assurance_review"
    PLATFORM_CONTINUOUS_IMPROVEMENT_BACKLOG_REVIEW = "platform.continuous_improvement_backlog_review"
    PLATFORM_STABLE_OPERATIONS_OPTIMIZATION_REVIEW = "platform.stable_operations_optimization_review"
    PLATFORM_RECURRING_MAINTENANCE_CYCLE_READINESS_REVIEW = "platform.recurring_maintenance_cycle_readiness_review"
    PLATFORM_MAINTENANCE_CYCLE_EXECUTION_REVIEW = "platform.maintenance_cycle_execution_review"
    PLATFORM_LONG_TERM_OPERABILITY_SUSTAINABILITY_REVIEW = "platform.long_term_operability_sustainability_review"
    PLATFORM_RECURRING_OPERATIONAL_MATURITY_AUDIT_REVIEW = "platform.recurring_operational_maturity_audit_review"
    PLATFORM_STABLE_STATE_CONTINUITY_CONTROL_REVIEW = "platform.stable_state_continuity_control_review"
    PLATFORM_OPERATIONAL_RESILIENCE_GOVERNANCE_REVIEW = "platform.operational_resilience_governance_review"
    PLATFORM_RECOVERY_CAPABILITY_VALIDATION_REVIEW = "platform.recovery_capability_validation_review"
    PLATFORM_OPERATIONAL_RESILIENCE_OPTIMIZATION_REVIEW = "platform.operational_resilience_optimization_review"
    PLATFORM_AUTOMATED_CONTINUITY_PREPAREDNESS_REVIEW = "platform.automated_continuity_preparedness_review"
    PLATFORM_AUTOMATED_CONTINUITY_EXECUTION_VALIDATION_REVIEW = "platform.automated_continuity_execution_validation_review"
    PLATFORM_OPERATIONAL_RESILIENCE_FEEDBACK_LOOP_REVIEW = "platform.operational_resilience_feedback_loop_review"
    PLATFORM_FINAL_CLOSURE_EVIDENCE_PACKAGE_REVIEW = "platform.final_closure_evidence_package_review"
    PLATFORM_GLOBAL_IMPLEMENTATION_COMPLETION_CHECKLIST_REVIEW = "platform.global_implementation_completion_checklist_review"
    PLATFORM_FINAL_OPERATIONAL_HANDOVER_REVIEW = "platform.final_operational_handover_review"
    PLATFORM_PHASE_CLOSURE_CERTIFICATION_REVIEW = "platform.phase_closure_certification_review"
    NOTIFICATIONS_DISPATCH = "notifications.dispatch"
    ANALYTICS_SNAPSHOT = "analytics.snapshot"
    AI_TRIAGE_PREVIEW = "ai.triage_preview"


class JobStatus(StrEnum):
    ACCEPTED = "accepted"
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELED = "canceled"


class ArtifactRef(AliasModel):
    artifact_id: str = Field(alias="artifactId")
    artifact_type: str = Field(alias="artifactType")
    content_type: str = Field(alias="contentType")
    filename: str
    size_bytes: int = Field(alias="sizeBytes")
    sha256: str
    created_at: str = Field(alias="createdAt")
    expires_at: str | None = Field(default=None, alias="expiresAt")
    download_url: str | None = Field(default=None, alias="downloadUrl")
    path: str
    redaction_applied: bool = Field(default=True, alias="redactionApplied")
    pii_class: str = Field(default="minimized-operational", alias="piiClass")
    metadata: dict[str, Any] = Field(default_factory=dict)


class JobEnvelope(StrictAliasModel):
    job_type: JobType = Field(alias="jobType")
    idempotency_key: str = Field(alias="idempotencyKey", min_length=8, max_length=160)
    correlation_id: str | None = Field(default=None, alias="correlationId", max_length=160)
    organization_id: str | None = Field(default=None, alias="organizationId", max_length=160)
    actor_user_id: str | None = Field(default=None, alias="actorUserId", max_length=160)
    dry_run: bool = Field(default=True, alias="dryRun")
    payload: dict[str, Any] = Field(default_factory=dict)


class JobResult(AliasModel):
    job_type: JobType = Field(alias="jobType")
    idempotency_key: str = Field(alias="idempotencyKey")
    correlation_id: str | None = Field(default=None, alias="correlationId")
    dry_run: bool = Field(alias="dryRun")
    result_type: str = Field(alias="resultType")
    data: dict[str, Any] = Field(default_factory=dict)
    artifacts: list[ArtifactRef] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class JobAccepted(AliasModel):
    accepted: bool = True
    job_id: str = Field(alias="jobId")
    job_type: JobType = Field(alias="jobType")
    idempotency_key: str = Field(alias="idempotencyKey")
    correlation_id: str | None = Field(default=None, alias="correlationId")
    routed_to: str = Field(alias="routedTo")
    queued: bool
    task_id: str | None = Field(default=None, alias="taskId")
    dry_run: bool = Field(alias="dryRun")
    status: JobStatus = JobStatus.ACCEPTED
    duplicate: bool = False
    result: JobResult | None = None


class JobRecord(AliasModel):
    job_id: str = Field(alias="jobId")
    job_type: JobType = Field(alias="jobType")
    idempotency_key: str = Field(alias="idempotencyKey")
    correlation_id: str | None = Field(default=None, alias="correlationId")
    organization_id: str | None = Field(default=None, alias="organizationId")
    actor_user_id: str | None = Field(default=None, alias="actorUserId")
    status: JobStatus
    routed_to: str = Field(alias="routedTo")
    queued: bool
    task_id: str | None = Field(default=None, alias="taskId")
    dry_run: bool = Field(alias="dryRun")
    attempts: int = 0
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")
    result: JobResult | None = None
    error: str | None = None
    canceled_reason: str | None = Field(default=None, alias="canceledReason")


class ShadowRecord(StrictAliasModel):
    route: str
    method: str
    correlation_id: str | None = Field(default=None, alias="correlationId")
    organization_id: str | None = Field(default=None, alias="organizationId")
    actor_user_id: str | None = Field(default=None, alias="actorUserId")
    payload_shape: dict[str, Any] = Field(default_factory=dict, alias="payloadShape")


class ShadowComparisonInput(StrictAliasModel):
    route: str
    method: str = "POST"
    correlation_id: str | None = Field(default=None, alias="correlationId")
    organization_id: str | None = Field(default=None, alias="organizationId")
    actor_user_id: str | None = Field(default=None, alias="actorUserId")
    subject_key: str | None = Field(default=None, alias="subjectKey")
    job_type: JobType | None = Field(default=None, alias="jobType")
    node_status: str | None = Field(default=None, alias="nodeStatus")
    python_status: str | None = Field(default=None, alias="pythonStatus")
    node_result: dict[str, Any] = Field(default_factory=dict, alias="nodeResult")
    python_result: dict[str, Any] = Field(default_factory=dict, alias="pythonResult")
    ignored_fields: list[str] = Field(default_factory=list, alias="ignoredFields")
    payload_classification: str = Field(default="sanitized-non-phi", alias="payloadClassification")


class CanaryGateDecision(AliasModel):
    allowed: bool
    recommendation: str
    reasons: list[str]
    job_summary: dict[str, Any] = Field(alias="jobSummary")
    comparison_summary: dict[str, Any] = Field(alias="comparisonSummary")
    thresholds: dict[str, Any]


class DependencyHealth(BaseModel):
    ok: bool
    name: str
    status: str
    detail: str | None = None


class ServiceManifest(AliasModel):
    service: str
    version: str
    mode: str
    queue_enabled: bool = Field(alias="queueEnabled")
    capabilities: list[str]
    job_types: list[str] = Field(alias="jobTypes")
    security: dict[str, Any] = Field(default_factory=dict)
    metrics: dict[str, Any] = Field(default_factory=dict)
    storage: dict[str, Any] = Field(default_factory=dict)



class ContractCapability(AliasModel):
    contract_id: str = Field(alias="contractId")
    job_type: JobType = Field(alias="jobType")
    owner: str
    node_route: str = Field(alias="nodeRoute")
    python_route: str = Field(alias="pythonRoute")
    stage: str
    canary_max_percent: int = Field(alias="canaryMaxPercent", ge=0, le=100)
    shadow_supported: bool = Field(alias="shadowSupported")
    dry_run_only: bool = Field(alias="dryRunOnly")
    data_classification: str = Field(alias="dataClassification")
    acceptance_checks: list[str] = Field(default_factory=list, alias="acceptanceChecks")
    safeguards: list[str] = Field(default_factory=list)
    rollback: str


class ContractManifest(AliasModel):
    schema_version: str = Field(alias="schemaVersion")
    service: str
    version: str
    contract_hash: str = Field(alias="contractHash")
    contracts: list[ContractCapability]
    routing_model: dict[str, Any] = Field(default_factory=dict, alias="routingModel")


class ContractTestVector(AliasModel):
    vector_id: str = Field(alias="vectorId")
    contract_id: str = Field(alias="contractId")
    job_type: JobType = Field(alias="jobType")
    expected_result_type: str = Field(alias="expectedResultType")
    envelope: JobEnvelope
    notes: list[str] = Field(default_factory=list)


class ContractValidationReport(AliasModel):
    allowed: bool
    contract_id: str = Field(alias="contractId")
    job_type: JobType = Field(alias="jobType")
    idempotency_key: str = Field(alias="idempotencyKey")
    dry_run: bool = Field(alias="dryRun")
    data_classification: str = Field(alias="dataClassification")
    dry_run_only: bool = Field(alias="dryRunOnly")
    canary_max_percent: int = Field(alias="canaryMaxPercent", ge=0, le=100)
    payload_keys: list[str] = Field(default_factory=list, alias="payloadKeys")
    expected_result_type: str = Field(alias="expectedResultType")
    contract_hash: str = Field(alias="contractHash")
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    safeguards: list[str] = Field(default_factory=list)


class RolloutReadinessReport(AliasModel):
    decision: str
    recommendation: str
    current_canary_percent: int = Field(alias="currentCanaryPercent", ge=0, le=100)
    target_canary_percent: int = Field(alias="targetCanaryPercent", ge=0, le=100)
    next_canary_percent: int = Field(alias="nextCanaryPercent", ge=0, le=100)
    max_canary_percent: int = Field(alias="maxCanaryPercent", ge=0, le=100)
    contract_id: str | None = Field(default=None, alias="contractId")
    job_type: JobType | None = Field(default=None, alias="jobType")
    gate: CanaryGateDecision
    prerequisites: list[dict[str, Any]] = Field(default_factory=list)
    reasons: list[str] = Field(default_factory=list)
    rollback: str


class CanaryRolloutPlanRequest(StrictAliasModel):
    route: str = Field(default="/api/hybrid-python/jobs", min_length=1, max_length=240)
    current_percent: int = Field(default=0, alias="currentPercent", ge=0, le=100)
    target_percent: int = Field(default=5, alias="targetPercent", ge=0, le=100)
    stage_percents: list[int] = Field(default_factory=lambda: [0, 1, 5, 10, 25, 50], alias="stagePercents")
    min_comparisons: int = Field(default=10, alias="minComparisons", ge=0, le=10000)
    max_mismatch_rate: float = Field(default=0.05, alias="maxMismatchRate", ge=0, le=1)
    max_failed_jobs: int = Field(default=0, alias="maxFailedJobs", ge=0, le=1000)
    created_by: str | None = Field(default=None, alias="createdBy", max_length=160)
    reason: str = Field(default="operator-plan", min_length=2, max_length=500)
    dry_run: bool = Field(default=True, alias="dryRun")
    job_type: JobType | None = Field(default=None, alias="jobType")


class CanaryRolloutAction(StrictAliasModel):
    route: str = Field(default="/api/hybrid-python/jobs", min_length=1, max_length=240)
    actor_user_id: str | None = Field(default=None, alias="actorUserId", max_length=160)
    reason: str = Field(default="operator-action", min_length=2, max_length=500)
    dry_run: bool = Field(default=True, alias="dryRun")


class CanaryAssignmentRequest(StrictAliasModel):
    subject_key: str = Field(alias="subjectKey", min_length=1, max_length=240)
    route: str = Field(default="/api/hybrid-python/jobs", min_length=1, max_length=240)
    organization_id: str | None = Field(default=None, alias="organizationId", max_length=160)
    actor_user_id: str | None = Field(default=None, alias="actorUserId", max_length=160)
    job_type: JobType | None = Field(default=None, alias="jobType")


class CanaryAssignment(AliasModel):
    route: str
    subject_key: str = Field(alias="subjectKey")
    organization_id: str | None = Field(default=None, alias="organizationId")
    actor_user_id: str | None = Field(default=None, alias="actorUserId")
    job_type: JobType | None = Field(default=None, alias="jobType")
    bucket: int = Field(ge=0, le=99)
    canary_percent: int = Field(alias="canaryPercent", ge=0, le=100)
    route_to_python: bool = Field(alias="routeToPython")
    shadow_mode: bool = Field(alias="shadowMode")
    reason: str


class CanaryRolloutState(AliasModel):
    route: str
    status: str
    current_percent: int = Field(alias="currentPercent", ge=0, le=100)
    target_percent: int = Field(alias="targetPercent", ge=0, le=100)
    stage_percents: list[int] = Field(default_factory=list, alias="stagePercents")
    next_percent: int = Field(default=0, alias="nextPercent", ge=0, le=100)
    min_comparisons: int = Field(default=10, alias="minComparisons", ge=0, le=10000)
    max_mismatch_rate: float = Field(default=0.05, alias="maxMismatchRate", ge=0, le=1)
    max_failed_jobs: int = Field(default=0, alias="maxFailedJobs", ge=0, le=1000)
    dry_run: bool = Field(default=True, alias="dryRun")
    job_type: JobType | None = Field(default=None, alias="jobType")
    created_by: str | None = Field(default=None, alias="createdBy")
    updated_by: str | None = Field(default=None, alias="updatedBy")
    reason: str = "initial"
    last_decision: dict[str, Any] | None = Field(default=None, alias="lastDecision")
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")
    history: list[dict[str, Any]] = Field(default_factory=list)


class ReleaseChecklistItem(AliasModel):
    check_id: str = Field(alias="checkId")
    label: str
    status: str
    required: bool
    detail: str
    remediation: str = ""


class ReleaseChecklistReport(AliasModel):
    generated_at: str = Field(alias="generatedAt")
    service: str
    version: str
    schema_version: str = Field(alias="schemaVersion")
    environment: str
    overall_status: str = Field(alias="overallStatus")
    summary: dict[str, Any] = Field(default_factory=dict)
    checks: list[ReleaseChecklistItem] = Field(default_factory=list)


class EvidenceBundle(AliasModel):
    generated_at: str = Field(alias="generatedAt")
    service: str
    version: str
    schema_version: str = Field(alias="schemaVersion")
    contract_hash: str = Field(alias="contractHash")
    environment: str
    rollout: dict[str, Any] = Field(default_factory=dict)
    canary_gate: dict[str, Any] = Field(default_factory=dict, alias="canaryGate")
    job_summary: dict[str, Any] = Field(default_factory=dict, alias="jobSummary")
    shadow_summary: dict[str, Any] = Field(default_factory=dict, alias="shadowSummary")
    comparison_summary: dict[str, Any] = Field(default_factory=dict, alias="comparisonSummary")
    metrics_snapshot: dict[str, Any] = Field(default_factory=dict, alias="metricsSnapshot")
    policy_summary: dict[str, Any] = Field(default_factory=dict, alias="policySummary")
    artifact_summary: dict[str, Any] = Field(default_factory=dict, alias="artifactSummary")
    checklist: dict[str, Any] = Field(default_factory=dict)
