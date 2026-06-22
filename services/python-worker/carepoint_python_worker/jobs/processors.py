from __future__ import annotations

import csv
import hashlib
import io
from datetime import date, datetime, timezone
from statistics import mean
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from ..artifacts import artifact_store, redact_record
from ..compat import model_dump, model_validate
from ..models import ArtifactRef, JobEnvelope, JobResult, JobType


class ExportFilters(BaseModel):
    from_date: date = Field(alias="from")
    to_date: date = Field(alias="to")
    actor_id: str | None = Field(default=None, alias="actorId")
    resource: str | None = None
    resource_id: str | None = Field(default=None, alias="resourceId")
    action: str | None = None

    class Config:
        populate_by_name = True


class AuditExportPayload(BaseModel):
    format: Literal["csv", "json"] = "csv"
    max_rows: int = Field(default=10000, alias="maxRows", ge=1, le=50000)
    include_phi: bool = Field(default=False, alias="includePhi")
    filters: ExportFilters
    rows: list[dict[str, Any]] = Field(default_factory=list)

    class Config:
        populate_by_name = True


class BulkAccountRow(BaseModel):
    email: str
    role: str
    organization_id: str | None = Field(default=None, alias="organizationId")
    display_name: str | None = Field(default=None, alias="displayName")

    class Config:
        populate_by_name = True

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if "@" not in normalized or normalized.startswith("@") or normalized.endswith("@"):
            raise ValueError("email is invalid")
        return normalized

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        normalized = value.strip().upper()
        if not normalized:
            raise ValueError("role is required")
        return normalized


class BulkValidatePayload(BaseModel):
    rows: list[dict[str, Any]] = Field(default_factory=list)
    csv_text: str | None = Field(default=None, alias="csvText")
    allowed_roles: list[str] = Field(default_factory=list, alias="allowedRoles")
    allowed_email_domains: list[str] = Field(default_factory=list, alias="allowedEmailDomains")
    require_organization: bool = Field(default=True, alias="requireOrganization")

    class Config:
        populate_by_name = True


class AccountsReadModelPayload(BaseModel):
    rows: list[dict[str, Any]] = Field(default_factory=list)
    cursor: str | None = None
    limit: int = Field(default=100, ge=1, le=500)
    filters: dict[str, Any] = Field(default_factory=dict)
    sort: str = "createdAt:desc"
    include_totals: bool = Field(default=False, alias="includeTotals")

    class Config:
        populate_by_name = True


class ProviderRoleReconcilePayload(BaseModel):
    schema_models: list[str] = Field(default_factory=list, alias="schemaModels")
    schema_fields: dict[str, list[str]] = Field(default_factory=dict, alias="schemaFields")
    migration_models: list[str] = Field(default_factory=list, alias="migrationModels")
    code_references: list[str] = Field(default_factory=list, alias="codeReferences")
    provider_rows: list[dict[str, Any]] = Field(default_factory=list, alias="providerRows")
    expected_role_catalog_model: str = Field(default="ProviderRoleCatalog", alias="expectedRoleCatalogModel")
    expected_provider_role_field: str = Field(default="roleCatalogId", alias="expectedProviderRoleField")

    class Config:
        populate_by_name = True


class AvailabilityWindow(BaseModel):
    provider_hash: str | None = Field(default=None, alias="providerHash")
    resource_hash: str | None = Field(default=None, alias="resourceHash")
    starts_at: str = Field(alias="startsAt")
    ends_at: str = Field(alias="endsAt")
    status: Literal["available", "blocked", "booked", "tentative"] = "available"

    class Config:
        populate_by_name = True


class SchedulingAvailabilityPayload(BaseModel):
    windows: list[AvailabilityWindow] = Field(default_factory=list)
    timezone: str = "UTC"
    group_by: Literal["status", "providerHash", "resourceHash"] = Field(default="status", alias="groupBy")
    include_window_sample: bool = Field(default=True, alias="includeWindowSample")

    class Config:
        populate_by_name = True


class ReminderPlanPayload(BaseModel):
    channel: Literal["email", "sms", "in_app"] = "email"
    template_id: str = Field(alias="templateId")
    recipient_hashes: list[str] = Field(default_factory=list, alias="recipientHashes")
    recipients: list[str] = Field(default_factory=list)
    variables: dict[str, Any] = Field(default_factory=dict)
    send_after: str | None = Field(default=None, alias="sendAfter")
    batch_size: int = Field(default=100, alias="batchSize", ge=1, le=1000)

    class Config:
        populate_by_name = True




class PaymentReconcileRow(BaseModel):
    payment_id_hash: str | None = Field(default=None, alias="paymentIdHash")
    external_id_hash: str | None = Field(default=None, alias="externalIdHash")
    gateway: str = "unknown"
    gateway_status: str | None = Field(default=None, alias="gatewayStatus")
    status: str = "unknown"
    amount_minor: int = Field(default=0, alias="amountMinor")
    currency: str = "USD"
    created_at: str | None = Field(default=None, alias="createdAt")
    settled_at: str | None = Field(default=None, alias="settledAt")
    organization_id: str | None = Field(default=None, alias="organizationId")

    class Config:
        populate_by_name = True


class PaymentReconcilePayload(BaseModel):
    rows: list[PaymentReconcileRow] = Field(default_factory=list)
    gateway: str = "stripe"
    currency: str | None = None
    tolerance_minor: int = Field(default=0, alias="toleranceMinor", ge=0, le=1000000)
    include_row_sample: bool = Field(default=True, alias="includeRowSample")

    class Config:
        populate_by_name = True


class ClinicalAccessEvent(BaseModel):
    actor_hash: str | None = Field(default=None, alias="actorHash")
    patient_hash: str | None = Field(default=None, alias="patientHash")
    resource_hash: str | None = Field(default=None, alias="resourceHash")
    action: str = "read"
    outcome: str = "allowed"
    created_at: str | None = Field(default=None, alias="createdAt")
    break_glass: bool = Field(default=False, alias="breakGlass")
    reason_code: str | None = Field(default=None, alias="reasonCode")
    organization_id: str | None = Field(default=None, alias="organizationId")

    class Config:
        populate_by_name = True


class ClinicalAccessAuditPayload(BaseModel):
    events: list[ClinicalAccessEvent] = Field(default_factory=list)
    window: dict[str, Any] = Field(default_factory=dict)
    anomaly_thresholds: dict[str, int] = Field(default_factory=dict, alias="anomalyThresholds")
    include_event_sample: bool = Field(default=True, alias="includeEventSample")

    class Config:
        populate_by_name = True


class DbModelStat(BaseModel):
    model: str
    row_count: int = Field(default=0, alias="rowCount", ge=0)
    indexes: list[list[str]] = Field(default_factory=list)
    unique_indexes: list[list[str]] = Field(default_factory=list, alias="uniqueIndexes")

    class Config:
        populate_by_name = True


class DbQueryObservation(BaseModel):
    endpoint: str | None = None
    model: str
    filter_fields: list[str] = Field(default_factory=list, alias="filterFields")
    order_by_fields: list[str] = Field(default_factory=list, alias="orderByFields")
    select_fields: list[str] = Field(default_factory=list, alias="selectFields")
    estimated_rows: int = Field(default=0, alias="estimatedRows", ge=0)
    avg_duration_ms: float = Field(default=0, alias="avgDurationMs", ge=0)
    p95_duration_ms: float = Field(default=0, alias="p95DurationMs", ge=0)
    full_scan: bool = Field(default=False, alias="fullScan")
    include_depth: int = Field(default=0, alias="includeDepth", ge=0)

    class Config:
        populate_by_name = True


class DbIndexAdvisoryPayload(BaseModel):
    models: list[DbModelStat] = Field(default_factory=list)
    queries: list[DbQueryObservation] = Field(default_factory=list)
    include_prisma_hints: bool = Field(default=True, alias="includePrismaHints")
    target_p95_ms: float = Field(default=500, alias="targetP95Ms", ge=1)

    class Config:
        populate_by_name = True


class SloRegressionPayload(BaseModel):
    route: str = "/api/hybrid-python/jobs"
    baseline_samples_ms: list[float] = Field(default_factory=list, alias="baselineSamplesMs")
    current_samples_ms: list[float] = Field(default_factory=list, alias="currentSamplesMs")
    baseline_error_count: int = Field(default=0, alias="baselineErrorCount", ge=0)
    current_error_count: int = Field(default=0, alias="currentErrorCount", ge=0)
    baseline_request_count: int = Field(default=0, alias="baselineRequestCount", ge=0)
    current_request_count: int = Field(default=0, alias="currentRequestCount", ge=0)
    thresholds: dict[str, float] = Field(default_factory=dict)
    dimensions: dict[str, str] = Field(default_factory=dict)

    class Config:
        populate_by_name = True


class ContractReplayPayload(BaseModel):
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    contract_ids: list[str] = Field(default_factory=list, alias="contractIds")
    vector_ids: list[str] = Field(default_factory=list, alias="vectorIds")
    fail_fast: bool = Field(default=False, alias="failFast")
    include_successful_results: bool = Field(default=False, alias="includeSuccessfulResults")
    max_vectors: int = Field(default=50, alias="maxVectors", ge=1, le=100)

    class Config:
        populate_by_name = True


class PrivacyPreflightCandidate(BaseModel):
    route: str
    job_type: str | None = Field(default=None, alias="jobType")
    classification: str = "unknown"
    payload_keys: list[str] = Field(default_factory=list, alias="payloadKeys")
    payload_shape: dict[str, Any] = Field(default_factory=dict, alias="payloadShape")

    class Config:
        populate_by_name = True


class PrivacyPreflightPayload(BaseModel):
    candidates: list[PrivacyPreflightCandidate] = Field(default_factory=list)
    fail_on_warnings: bool = Field(default=False, alias="failOnWarnings")

    class Config:
        populate_by_name = True


class ReleaseEvidenceStatus(BaseModel):
    decision: str | None = None
    recommendation: str | None = None
    allowed: bool | None = None
    status: str | None = None
    overall_status: str | None = Field(default=None, alias="overallStatus")
    failed: int | None = None
    passed: int | None = None
    blocked_candidates: int | None = Field(default=None, alias="blockedCandidates")
    warning_candidates: int | None = Field(default=None, alias="warningCandidates")
    current_percent: int | None = Field(default=None, alias="currentPercent")
    target_percent: int | None = Field(default=None, alias="targetPercent")

    class Config:
        populate_by_name = True


class ReleaseDecisionPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    target_canary_percent: int = Field(default=5, alias="targetCanaryPercent", ge=0, le=100)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    gate: dict[str, Any] = Field(default_factory=dict)
    checklist: dict[str, Any] = Field(default_factory=dict)
    contract_replay: dict[str, Any] = Field(default_factory=dict, alias="contractReplay")
    privacy_preflight: dict[str, Any] = Field(default_factory=dict, alias="privacyPreflight")
    slo_regression: dict[str, Any] = Field(default_factory=dict, alias="sloRegression")
    rollout: dict[str, Any] = Field(default_factory=dict)
    evidence: dict[str, Any] = Field(default_factory=dict)
    allow_warn: bool = Field(default=False, alias="allowWarn")

    class Config:
        populate_by_name = True


class RollbackDrillPayload(BaseModel):
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    trigger: str = "operator-drill"
    observed_metrics: dict[str, Any] = Field(default_factory=dict, alias="observedMetrics")
    operators: list[str] = Field(default_factory=list)
    require_evidence_bundle: bool = Field(default=True, alias="requireEvidenceBundle")
    include_commands: bool = Field(default=True, alias="includeCommands")

    class Config:
        populate_by_name = True


class PostDeployVerifyPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    target_canary_percent: int = Field(default=5, alias="targetCanaryPercent", ge=0, le=100)
    health_checks: list[dict[str, Any]] = Field(default_factory=list, alias="healthChecks")
    smoke_checks: list[dict[str, Any]] = Field(default_factory=list, alias="smokeChecks")
    slo_regression: dict[str, Any] = Field(default_factory=dict, alias="sloRegression")
    release_decision: dict[str, Any] = Field(default_factory=dict, alias="releaseDecision")
    rollout: dict[str, Any] = Field(default_factory=dict)
    job_summary: dict[str, Any] = Field(default_factory=dict, alias="jobSummary")
    comparison_summary: dict[str, Any] = Field(default_factory=dict, alias="comparisonSummary")
    privacy_preflight: dict[str, Any] = Field(default_factory=dict, alias="privacyPreflight")
    require_clean_privacy: bool = Field(default=True, alias="requireCleanPrivacy")

    class Config:
        populate_by_name = True


class ChangeTicketBundlePayload(BaseModel):
    change_id: str = Field(default="option-b-change", alias="changeId")
    release_id: str = Field(default="option-b-release", alias="releaseId")
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    evidence_bundle: dict[str, Any] = Field(default_factory=dict, alias="evidenceBundle")
    release_decision: dict[str, Any] = Field(default_factory=dict, alias="releaseDecision")
    rollback_drill: dict[str, Any] = Field(default_factory=dict, alias="rollbackDrill")
    contract_replay: dict[str, Any] = Field(default_factory=dict, alias="contractReplay")
    privacy_preflight: dict[str, Any] = Field(default_factory=dict, alias="privacyPreflight")
    slo_regression: dict[str, Any] = Field(default_factory=dict, alias="sloRegression")
    artifact_refs: list[dict[str, Any]] = Field(default_factory=list, alias="artifactRefs")
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    include_runbook: bool = Field(default=True, alias="includeRunbook")

    class Config:
        populate_by_name = True


class OperationalHandoffPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    owner_contacts: list[dict[str, Any]] = Field(default_factory=list, alias="ownerContacts")
    dashboard_links: list[dict[str, Any]] = Field(default_factory=list, alias="dashboardLinks")
    alert_policies: list[dict[str, Any]] = Field(default_factory=list, alias="alertPolicies")
    runbook_links: list[dict[str, Any]] = Field(default_factory=list, alias="runbookLinks")
    known_risks: list[dict[str, Any]] = Field(default_factory=list, alias="knownRisks")
    support_windows: list[dict[str, Any]] = Field(default_factory=list, alias="supportWindows")
    artifact_refs: list[dict[str, Any]] = Field(default_factory=list, alias="artifactRefs")
    include_quickstart: bool = Field(default=True, alias="includeQuickstart")

    class Config:
        populate_by_name = True


class IncidentSimulationPayload(BaseModel):
    scenario: Literal["python_down", "latency_regression", "shadow_mismatch", "privacy_block", "queue_backlog", "artifact_leak_signal"] = "latency_regression"
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    observed_metrics: dict[str, Any] = Field(default_factory=dict, alias="observedMetrics")
    gate: dict[str, Any] = Field(default_factory=dict)
    slo: dict[str, Any] = Field(default_factory=dict)
    privacy: dict[str, Any] = Field(default_factory=dict)
    rollout: dict[str, Any] = Field(default_factory=dict)
    operators: list[str] = Field(default_factory=list)
    include_commands: bool = Field(default=True, alias="includeCommands")

    class Config:
        populate_by_name = True


class CapacityPlanPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    target_canary_percent: int = Field(default=5, alias="targetCanaryPercent", ge=0, le=100)
    expected_requests_per_minute: float = Field(default=0, alias="expectedRequestsPerMinute", ge=0)
    average_duration_ms: float = Field(default=500, alias="averageDurationMs", ge=1)
    p95_duration_ms: float = Field(default=1000, alias="p95DurationMs", ge=1)
    queue_depth: int = Field(default=0, alias="queueDepth", ge=0)
    max_queue_wait_seconds: int = Field(default=60, alias="maxQueueWaitSeconds", ge=1)
    current_worker_count: int = Field(default=1, alias="currentWorkerCount", ge=0)
    worker_concurrency: int = Field(default=1, alias="workerConcurrency", ge=1, le=128)
    target_utilization: float = Field(default=0.70, alias="targetUtilization", ge=0.1, le=0.95)
    observed_error_rate: float = Field(default=0, alias="observedErrorRate", ge=0, le=1)
    backlog_growth_per_minute: float = Field(default=0, alias="backlogGrowthPerMinute")
    dependencies: list[dict[str, Any]] = Field(default_factory=list)

    class Config:
        populate_by_name = True


class AlertPolicyReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    alert_policies: list[dict[str, Any]] = Field(default_factory=list, alias="alertPolicies")
    dashboard_links: list[dict[str, Any]] = Field(default_factory=list, alias="dashboardLinks")
    required_signals: list[str] = Field(default_factory=list, alias="requiredSignals")
    min_policy_count: int = Field(default=4, alias="minPolicyCount", ge=0, le=100)
    require_on_call: bool = Field(default=True, alias="requireOnCall")

    class Config:
        populate_by_name = True



class DependencyReadinessPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    dependencies: list[dict[str, Any]] = Field(default_factory=list)
    required_dependencies: list[str] = Field(default_factory=list, alias="requiredDependencies")
    min_healthy_percent: float = Field(default=1.0, alias="minHealthyPercent", ge=0.0, le=1.0)
    fail_on_critical: bool = Field(default=True, alias="failOnCritical")

    class Config:
        populate_by_name = True


class ProductionReadinessPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    target_canary_percent: int = Field(default=5, alias="targetCanaryPercent", ge=0, le=100)
    evidence: dict[str, Any] = Field(default_factory=dict)
    required_evidence: list[str] = Field(
        default_factory=lambda: [
            "contractReplay",
            "privacyPreflight",
            "sloRegression",
            "capacityPlan",
            "alertPolicyReview",
            "dependencyReadiness",
            "rollbackDrill",
        ],
        alias="requiredEvidence",
    )
    allow_warnings: bool = Field(default=False, alias="allowWarnings")
    artifact_refs: list[dict[str, Any]] = Field(default_factory=list, alias="artifactRefs")

    class Config:
        populate_by_name = True


class DataRetentionReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    retention_policies: list[dict[str, Any]] = Field(default_factory=list, alias="retentionPolicies")
    artifact_summary: dict[str, Any] = Field(default_factory=dict, alias="artifactSummary")
    job_summary: dict[str, Any] = Field(default_factory=dict, alias="jobSummary")
    gc_summary: dict[str, Any] = Field(default_factory=dict, alias="gcSummary")
    max_artifact_ttl_seconds: int = Field(default=604800, alias="maxArtifactTtlSeconds", ge=60, le=31536000)
    require_explicit_ttl: bool = Field(default=True, alias="requireExplicitTtl")
    require_redaction: bool = Field(default=True, alias="requireRedaction")

    class Config:
        populate_by_name = True


class AuditTrailReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    audit_events: list[dict[str, Any]] = Field(default_factory=list, alias="auditEvents")
    required_event_fields: list[str] = Field(
        default_factory=lambda: ["eventType", "actorUserId", "correlationId", "route", "timestamp"],
        alias="requiredEventFields",
    )
    evidence: dict[str, Any] = Field(default_factory=dict)
    require_mutation_dry_run: bool = Field(default=True, alias="requireMutationDryRun")

    class Config:
        populate_by_name = True


class SecurityPostureReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    controls: dict[str, Any] = Field(default_factory=dict)
    findings: list[dict[str, Any]] = Field(default_factory=list)
    required_controls: list[str] = Field(
        default_factory=lambda: [
            "signedBridge",
            "csrfForCookieAuth",
            "rateLimitAuth",
            "objectLevelAuthTests",
            "secretScanPassing",
            "corsProdWhitelist",
            "httpOnlyCookies",
        ],
        alias="requiredControls",
    )
    max_high_findings: int = Field(default=0, alias="maxHighFindings", ge=0, le=1000)
    max_critical_findings: int = Field(default=0, alias="maxCriticalFindings", ge=0, le=1000)

    class Config:
        populate_by_name = True


class SupplyChainReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    scans: list[dict[str, Any]] = Field(default_factory=list)
    sbom_present: bool = Field(default=False, alias="sbomPresent")
    lockfiles_present: bool = Field(default=True, alias="lockfilesPresent")
    image_scan_present: bool = Field(default=False, alias="imageScanPresent")
    max_high_vulnerabilities: int = Field(default=0, alias="maxHighVulnerabilities", ge=0, le=1000)
    max_critical_vulnerabilities: int = Field(default=0, alias="maxCriticalVulnerabilities", ge=0, le=1000)
    require_sbom: bool = Field(default=True, alias="requireSbom")
    require_image_scan: bool = Field(default=True, alias="requireImageScan")

    class Config:
        populate_by_name = True


class SchemaMigrationRehearsalPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    migrations: list[dict[str, Any]] = Field(default_factory=list)
    schema_drift: dict[str, Any] = Field(default_factory=dict, alias="schemaDrift")
    rehearsal_evidence: dict[str, Any] = Field(default_factory=dict, alias="rehearsalEvidence")
    required_checks: list[str] = Field(
        default_factory=lambda: ["prismaValidate", "migrateStatus", "rollbackPlan", "backfillPlan", "seedSafe"],
        alias="requiredChecks",
    )
    allow_destructive: bool = Field(default=False, alias="allowDestructive")
    require_shadow_replay: bool = Field(default=True, alias="requireShadowReplay")
    max_destructive_steps: int = Field(default=0, alias="maxDestructiveSteps", ge=0, le=100)

    class Config:
        populate_by_name = True


class BackupRestoreDrillPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    backups: list[dict[str, Any]] = Field(default_factory=list)
    restore_tests: list[dict[str, Any]] = Field(default_factory=list, alias="restoreTests")
    required_stores: list[str] = Field(default_factory=lambda: ["postgres", "redis", "artifact_store"], alias="requiredStores")
    rpo_minutes: int = Field(default=60, alias="rpoMinutes", ge=1, le=10080)
    rto_minutes: int = Field(default=120, alias="rtoMinutes", ge=1, le=10080)
    require_recent_restore: bool = Field(default=True, alias="requireRecentRestore")
    require_restore_integrity_check: bool = Field(default=True, alias="requireRestoreIntegrityCheck")

    class Config:
        populate_by_name = True


class ObservabilityCoverageReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    traces: list[dict[str, Any]] = Field(default_factory=list)
    metrics: list[dict[str, Any]] = Field(default_factory=list)
    logs: list[dict[str, Any]] = Field(default_factory=list)
    dashboards: list[dict[str, Any]] = Field(default_factory=list)
    required_signals: list[str] = Field(
        default_factory=lambda: ["request_id", "trace_id", "p95_latency", "error_rate", "queue_depth"],
        alias="requiredSignals",
    )
    min_trace_coverage_percent: float = Field(default=95.0, alias="minTraceCoveragePercent", ge=0, le=100)
    max_uncorrelated_logs: int = Field(default=0, alias="maxUncorrelatedLogs", ge=0, le=100000)
    require_dashboard_links: bool = Field(default=True, alias="requireDashboardLinks")

    class Config:
        populate_by_name = True


class FeatureFlagReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    flags: dict[str, Any] = Field(default_factory=dict)
    expected_settings: dict[str, Any] = Field(default_factory=dict, alias="expectedSettings")
    required_flags: list[str] = Field(
        default_factory=lambda: [
            "HYBRID_PYTHON_ENABLED",
            "HYBRID_PYTHON_SHADOW_MODE",
            "HYBRID_PYTHON_CANARY_PERCENT",
            "PYTHON_SERVICES_BASE_URL",
            "PYTHON_WORKER_REQUIRE_SIGNATURE",
        ],
        alias="requiredFlags",
    )
    max_canary_percent: int = Field(default=5, alias="maxCanaryPercent", ge=0, le=100)
    require_kill_switch: bool = Field(default=True, alias="requireKillSwitch")
    require_signed_bridge: bool = Field(default=True, alias="requireSignedBridge")

    class Config:
        populate_by_name = True


class DomainMigrationReadinessPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    candidate_owner: str = Field(default="python-worker", alias="candidateOwner")
    evidence: dict[str, Any] = Field(default_factory=dict)
    required_evidence: list[str] = Field(
        default_factory=lambda: [
            "contractReplay",
            "privacyPreflight",
            "sloRegression",
            "observabilityCoverage",
            "featureFlagReview",
            "productionReadiness",
        ],
        alias="requiredEvidence",
    )
    shadow_comparison_summary: dict[str, Any] = Field(default_factory=dict, alias="shadowComparisonSummary")
    canary_gate: dict[str, Any] = Field(default_factory=dict, alias="canaryGate")
    target_canary_percent: int = Field(default=5, alias="targetCanaryPercent", ge=0, le=100)
    max_canary_percent: int = Field(default=10, alias="maxCanaryPercent", ge=0, le=100)
    require_node_fallback: bool = Field(default=True, alias="requireNodeFallback")
    require_owner_approval: bool = Field(default=True, alias="requireOwnerApproval")

    class Config:
        populate_by_name = True


class CutoverPlanPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    from_owner: str = Field(default="node", alias="fromOwner")
    to_owner: str = Field(default="python-worker", alias="toOwner")
    target_canary_percent: int = Field(default=10, alias="targetCanaryPercent", ge=0, le=100)
    stages: list[int] = Field(default_factory=lambda: [0, 1, 5, 10])
    evidence: dict[str, Any] = Field(default_factory=dict)
    rollback_triggers: list[str] = Field(default_factory=list, alias="rollbackTriggers")
    operator_approvals: list[dict[str, Any]] = Field(default_factory=list, alias="operatorApprovals")
    dry_run_required: bool = Field(default=True, alias="dryRunRequired")

    class Config:
        populate_by_name = True


class OwnerRegistryReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    domains: list[dict[str, Any]] = Field(default_factory=list)
    owner_registry: dict[str, Any] = Field(default_factory=dict, alias="ownerRegistry")
    required_owners: list[str] = Field(
        default_factory=lambda: ["nodeApiOwner", "pythonWorkerOwner", "dataOwner", "securityOwner", "rollbackOwner", "incidentOwner"],
        alias="requiredOwners",
    )
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    require_rollback_owner: bool = Field(default=True, alias="requireRollbackOwner")
    require_incident_owner: bool = Field(default=True, alias="requireIncidentOwner")

    class Config:
        populate_by_name = True


class PostCutoverMonitorPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    monitor_window_minutes: int = Field(default=60, alias="monitorWindowMinutes", ge=1, le=10080)
    target_canary_percent: int = Field(default=10, alias="targetCanaryPercent", ge=0, le=100)
    metrics: dict[str, Any] = Field(default_factory=dict)
    thresholds: dict[str, Any] = Field(default_factory=dict)
    evidence: dict[str, Any] = Field(default_factory=dict)
    rollback_triggers: list[str] = Field(default_factory=list, alias="rollbackTriggers")
    require_node_fallback: bool = Field(default=True, alias="requireNodeFallback")

    class Config:
        populate_by_name = True


class LegacyPathDecommissionPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    legacy_paths: list[dict[str, Any]] = Field(default_factory=list, alias="legacyPaths")
    evidence: dict[str, Any] = Field(default_factory=dict)
    required_evidence: list[str] = Field(
        default_factory=lambda: ["postCutoverMonitor", "ownerRegistry", "rollbackDrill", "observabilityCoverage", "productionReadiness"],
        alias="requiredEvidence",
    )
    fallback_plan: dict[str, Any] = Field(default_factory=dict, alias="fallbackPlan")
    rollback_triggers: list[str] = Field(default_factory=list, alias="rollbackTriggers")
    require_zero_traffic: bool = Field(default=True, alias="requireZeroTraffic")
    require_operator_approval: bool = Field(default=True, alias="requireOperatorApproval")

    class Config:
        populate_by_name = True


class SteadyStateOpsReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    runbook_links: list[dict[str, Any]] = Field(default_factory=list, alias="runbookLinks")
    dashboard_links: list[dict[str, Any]] = Field(default_factory=list, alias="dashboardLinks")
    alert_policies: list[dict[str, Any]] = Field(default_factory=list, alias="alertPolicies")
    incident_history: list[dict[str, Any]] = Field(default_factory=list, alias="incidentHistory")
    metrics: dict[str, Any] = Field(default_factory=dict)
    thresholds: dict[str, Any] = Field(default_factory=dict)
    evidence: dict[str, Any] = Field(default_factory=dict)
    required_operational_controls: list[str] = Field(
        default_factory=lambda: ["runbook", "dashboard", "alerts", "onCall", "ownerRegistry", "rollbackDrill", "postCutoverMonitor"],
        alias="requiredOperationalControls",
    )
    require_on_call: bool = Field(default=True, alias="requireOnCall")

    class Config:
        populate_by_name = True


class QueueResilienceReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    queues: list[dict[str, Any]] = Field(default_factory=list)
    retry_policy: dict[str, Any] = Field(default_factory=dict, alias="retryPolicy")
    dlq_policy: dict[str, Any] = Field(default_factory=dict, alias="dlqPolicy")
    idempotency_evidence: dict[str, Any] = Field(default_factory=dict, alias="idempotencyEvidence")
    metrics: dict[str, Any] = Field(default_factory=dict)
    thresholds: dict[str, Any] = Field(default_factory=dict)
    evidence: dict[str, Any] = Field(default_factory=dict)
    require_dlq: bool = Field(default=True, alias="requireDlq")
    require_idempotency: bool = Field(default=True, alias="requireIdempotency")

    class Config:
        populate_by_name = True


class ArtifactIntegrityReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    artifacts: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    required_fields: list[str] = Field(
        default_factory=lambda: ["artifactId", "artifactType", "sha256", "sizeBytes", "redactionApplied", "piiClass", "expiresAt"],
        alias="requiredFields",
    )
    allowed_pii_classes: list[str] = Field(
        default_factory=lambda: [
            "aggregate-non-phi",
            "minimized-operational",
            "metadata-only",
            "artifact-metadata-only",
            "release-evidence-metadata-only",
            "queue-resilience-metadata-only",
        ],
        alias="allowedPiiClasses",
    )
    max_artifact_age_hours: int = Field(default=168, alias="maxArtifactAgeHours", ge=1, le=8760)
    require_sha256: bool = Field(default=True, alias="requireSha256")
    require_redaction: bool = Field(default=True, alias="requireRedaction")
    require_expiry: bool = Field(default=True, alias="requireExpiry")

    class Config:
        populate_by_name = True


class RunbookFreshnessReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    runbooks: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    thresholds: dict[str, Any] = Field(default_factory=dict)
    required_runbooks: list[str] = Field(default_factory=lambda: ["deploy", "rollback", "incident", "privacy", "support"], alias="requiredRunbooks")
    max_staleness_days: int = Field(default=90, alias="maxStalenessDays", ge=1, le=1095)
    require_owner: bool = Field(default=True, alias="requireOwner")
    require_approval: bool = Field(default=True, alias="requireApproval")

    class Config:
        populate_by_name = True


class SupportEscalationReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    support_tiers: list[dict[str, Any]] = Field(default_factory=list, alias="supportTiers")
    escalation_paths: list[dict[str, Any]] = Field(default_factory=list, alias="escalationPaths")
    evidence: dict[str, Any] = Field(default_factory=dict)
    thresholds: dict[str, Any] = Field(default_factory=dict)
    require_24x7: bool = Field(default=False, alias="require24x7")
    require_named_owner: bool = Field(default=True, alias="requireNamedOwner")
    require_customer_comms: bool = Field(default=True, alias="requireCustomerComms")

    class Config:
        populate_by_name = True


class CostGuardrailReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    costs: dict[str, Any] = Field(default_factory=dict)
    budgets: dict[str, Any] = Field(default_factory=dict)
    forecast: dict[str, Any] = Field(default_factory=dict)
    thresholds: dict[str, Any] = Field(default_factory=dict)
    evidence: dict[str, Any] = Field(default_factory=dict)
    require_forecast: bool = Field(default=True, alias="requireForecast")
    require_worker_costs: bool = Field(default=True, alias="requireWorkerCosts")
    require_artifact_storage_costs: bool = Field(default=True, alias="requireArtifactStorageCosts")
    class Config:
        populate_by_name = True

class EnvironmentParityReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    staging: dict[str, Any] = Field(default_factory=dict)
    production: dict[str, Any] = Field(default_factory=dict)
    required_keys: list[str] = Field(default_factory=lambda: ["PYTHON_SERVICES_BASE_URL", "PYTHON_WORKER_REQUIRE_SIGNATURE", "HYBRID_PYTHON_ENABLED", "HYBRID_PYTHON_CANARY_PERCENT"], alias="requiredKeys")
    required_services: list[str] = Field(default_factory=lambda: ["node-api", "python-worker-api", "python-worker-celery", "redis"], alias="requiredServices")
    drift_allowlist: list[str] = Field(default_factory=lambda: ["HYBRID_PYTHON_CANARY_PERCENT", "NODE_ENV", "LOG_LEVEL"], alias="driftAllowlist")
    evidence: dict[str, Any] = Field(default_factory=dict)
    require_hmac_parity: bool = Field(default=True, alias="requireHmacParity")
    require_secret_fingerprints: bool = Field(default=True, alias="requireSecretFingerprints")
    class Config:
        populate_by_name = True




class AccessControlReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    controls: list[dict[str, Any]] = Field(default_factory=list)
    authorization_matrix: dict[str, Any] = Field(default_factory=dict, alias="authorizationMatrix")
    abac_policies: list[dict[str, Any]] = Field(default_factory=list, alias="abacPolicies")
    object_access_tests: list[dict[str, Any]] = Field(default_factory=list, alias="objectAccessTests")
    negative_tests: list[dict[str, Any]] = Field(default_factory=list, alias="negativeTests")
    test_results: list[dict[str, Any]] = Field(default_factory=list, alias="testResults")
    evidence: dict[str, Any] = Field(default_factory=dict)
    thresholds: dict[str, Any] = Field(default_factory=dict)
    required_controls: list[str] = Field(default_factory=lambda: ["rbac", "abac", "objectLevelAuth", "negativeCrossOrgTests"], alias="requiredControls")
    require_bola_negative_tests: bool = Field(default=True, alias="requireBolaNegativeTests")
    require_cross_org_denies: bool = Field(default=True, alias="requireCrossOrgDenies")

    class Config:
        populate_by_name = True


class DataQualityReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    datasets: list[dict[str, Any]] = Field(default_factory=list)
    metrics: dict[str, Any] = Field(default_factory=dict)
    thresholds: dict[str, Any] = Field(default_factory=dict)
    evidence: dict[str, Any] = Field(default_factory=dict)
    required_checks: list[str] = Field(default_factory=lambda: ["freshness", "nullRate", "duplicateRate", "schemaVersion", "redaction"], alias="requiredChecks")
    max_freshness_minutes: int = Field(default=60, alias="maxFreshnessMinutes", ge=1, le=43200)
    max_null_rate: float = Field(default=0.05, alias="maxNullRate", ge=0, le=1)
    max_duplicate_rate: float = Field(default=0.001, alias="maxDuplicateRate", ge=0, le=1)
    expected_schema_version: str | None = Field(default=None, alias="expectedSchemaVersion")
    allowed_pii_classes: list[str] = Field(default_factory=lambda: ["aggregate-non-phi", "metadata-only", "redacted-sample", "data-quality-aggregate-metadata-only"], alias="allowedPiiClasses")
    require_redaction: bool = Field(default=True, alias="requireRedaction")

    class Config:
        populate_by_name = True

class CiStagingValidationReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    checks: list[dict[str, Any]] = Field(default_factory=list)
    builds: dict[str, Any] = Field(default_factory=dict)
    docker: dict[str, Any] = Field(default_factory=dict)
    hmac: dict[str, Any] = Field(default_factory=dict)
    redis: dict[str, Any] = Field(default_factory=dict)
    artifact_registry: dict[str, Any] = Field(default_factory=dict, alias="artifactRegistry")
    canary: dict[str, Any] = Field(default_factory=dict)
    observability: dict[str, Any] = Field(default_factory=dict)
    evidence: dict[str, Any] = Field(default_factory=dict)
    required_checks: list[str] = Field(default_factory=lambda: [
        "npm-ci",
        "build-contracts",
        "build-api",
        "python-tests",
        "docker-compose-smoke",
        "signed-hmac",
        "redis-status-store",
        "artifact-registry",
        "canary-rollback",
        "observability",
        "node-bridge-routes",
    ], alias="requiredChecks")
    require_signed_bridge: bool = Field(default=True, alias="requireSignedBridge")
    require_docker_smoke: bool = Field(default=True, alias="requireDockerSmoke")
    require_ts_build: bool = Field(default=True, alias="requireTsBuild")
    require_python_tests: bool = Field(default=True, alias="requirePythonTests")

    class Config:
        populate_by_name = True


class ReleaseClosureReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    gate_results: dict[str, Any] = Field(default_factory=dict, alias="gateResults")
    evidence_bundle: dict[str, Any] = Field(default_factory=dict, alias="evidenceBundle")
    validation_summary: dict[str, Any] = Field(default_factory=dict, alias="validationSummary")
    risks: list[dict[str, Any]] = Field(default_factory=list)
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    required_gates: list[str] = Field(default_factory=lambda: [
        "costGuardrail",
        "environmentParity",
        "accessControl",
        "dataQuality",
        "ciStagingValidation",
        "releaseDecision",
        "rollbackDrill",
        "postDeployVerify",
        "changeTicketBundle",
    ], alias="requiredGates")
    require_evidence_bundle: bool = Field(default=True, alias="requireEvidenceBundle")
    require_approvals: bool = Field(default=True, alias="requireApprovals")
    allow_known_risks: bool = Field(default=False, alias="allowKnownRisks")

    class Config:
        populate_by_name = True



class ProductionCanaryObservationReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    window_minutes: int = Field(default=30, alias="windowMinutes", ge=1, le=1440)
    current_canary_percent: int = Field(default=0, alias="currentCanaryPercent", ge=0, le=100)
    target_canary_percent: int | None = Field(default=None, alias="targetCanaryPercent", ge=0, le=100)
    metrics: dict[str, Any] = Field(default_factory=dict)
    thresholds: dict[str, Any] = Field(default_factory=dict)
    signals: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    rollback_triggers: list[dict[str, Any]] = Field(default_factory=list, alias="rollbackTriggers")
    required_signals: list[str] = Field(default_factory=lambda: ["errorRate", "p95LatencyMs", "mismatchRate", "failedJobs", "queueLagSeconds", "hmacRejects", "artifactFailures"], alias="requiredSignals")
    require_rollback_triggers: bool = Field(default=True, alias="requireRollbackTriggers")
    max_error_rate: float = Field(default=0.01, alias="maxErrorRate", ge=0, le=1)
    max_p95_latency_ms: int = Field(default=2000, alias="maxP95LatencyMs", ge=1, le=120000)
    max_mismatch_rate: float = Field(default=0.005, alias="maxMismatchRate", ge=0, le=1)
    max_failed_jobs: int = Field(default=0, alias="maxFailedJobs", ge=0, le=100000)
    max_queue_lag_seconds: int = Field(default=60, alias="maxQueueLagSeconds", ge=0, le=86400)
    max_artifact_failures: int = Field(default=0, alias="maxArtifactFailures", ge=0, le=100000)
    min_sample_size: int = Field(default=25, alias="minSampleSize", ge=0, le=1000000)

    class Config:
        populate_by_name = True


class IncidentResponseReadinessReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    oncall: list[dict[str, Any]] = Field(default_factory=list)
    escalation_paths: list[dict[str, Any]] = Field(default_factory=list, alias="escalationPaths")
    runbooks: list[dict[str, Any]] = Field(default_factory=list)
    comms: dict[str, Any] = Field(default_factory=dict)
    drills: list[dict[str, Any]] = Field(default_factory=list)
    thresholds: dict[str, Any] = Field(default_factory=dict)
    evidence: dict[str, Any] = Field(default_factory=dict)
    required_coverage: list[str] = Field(default_factory=lambda: ["primaryOncall", "secondaryOncall", "rollbackOwner", "incidentCommander", "customerComms", "runbook", "pagerRoute"], alias="requiredCoverage")
    require_recent_drill: bool = Field(default=True, alias="requireRecentDrill")
    max_ack_minutes: int = Field(default=15, alias="maxAckMinutes", ge=1, le=1440)
    max_escalation_minutes: int = Field(default=30, alias="maxEscalationMinutes", ge=1, le=1440)

    class Config:
        populate_by_name = True


class TrafficPromotionReadinessReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    current_canary_percent: int = Field(default=0, alias="currentCanaryPercent", ge=0, le=100)
    target_canary_percent: int = Field(default=0, alias="targetCanaryPercent", ge=0, le=100)
    max_promotion_step_percent: int = Field(default=10, alias="maxPromotionStepPercent", ge=1, le=100)
    gate_evidence: dict[str, Any] = Field(default_factory=dict, alias="gateEvidence")
    production_observation: dict[str, Any] = Field(default_factory=dict, alias="productionObservation")
    incident_readiness: dict[str, Any] = Field(default_factory=dict, alias="incidentReadiness")
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    freeze_windows: list[dict[str, Any]] = Field(default_factory=list, alias="freezeWindows")
    rollback_plan: dict[str, Any] = Field(default_factory=dict, alias="rollbackPlan")
    evidence: dict[str, Any] = Field(default_factory=dict)
    thresholds: dict[str, Any] = Field(default_factory=dict)
    required_gates: list[str] = Field(default_factory=lambda: ["releaseClosure", "productionCanaryObservation", "incidentResponseReadiness", "rollbackPlan", "operatorApproval"], alias="requiredGates")
    require_operator_approval: bool = Field(default=True, alias="requireOperatorApproval")
    require_clean_observation: bool = Field(default=True, alias="requireCleanObservation")
    require_incident_readiness: bool = Field(default=True, alias="requireIncidentReadiness")
    class Config:
        populate_by_name = True


class EvidenceRetentionAuditReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    artifacts: list[dict[str, Any]] = Field(default_factory=list)
    evidence_bundle: dict[str, Any] = Field(default_factory=dict, alias="evidenceBundle")
    retention_policy: dict[str, Any] = Field(default_factory=dict, alias="retentionPolicy")
    required_artifact_types: list[str] = Field(default_factory=lambda: ["platform.release_closure_review.report", "platform.production_canary_observation_review.report", "platform.incident_response_readiness_review.report"], alias="requiredArtifactTypes")
    allowed_pii_classes: list[str] = Field(default_factory=lambda: ["release-closure-evidence-metadata-only", "production-canary-observation-metadata-only", "incident-response-readiness-metadata-only", "traffic-promotion-readiness-metadata-only", "metadata-only", "aggregate-non-phi"], alias="allowedPiiClasses")
    require_checksums: bool = Field(default=True, alias="requireChecksums")
    require_protected_downloads: bool = Field(default=True, alias="requireProtectedDownloads")
    require_redaction: bool = Field(default=True, alias="requireRedaction")
    min_retention_days: int = Field(default=30, alias="minRetentionDays", ge=1, le=3650)
    evidence: dict[str, Any] = Field(default_factory=dict)
    class Config:
        populate_by_name = True

class SloErrorBudgetReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    window_minutes: int = Field(default=60, alias="windowMinutes", ge=1, le=1440)
    slo_targets: dict[str, Any] = Field(default_factory=dict, alias="sloTargets")
    metrics: dict[str, Any] = Field(default_factory=dict)
    services: list[dict[str, Any]] = Field(default_factory=list)
    thresholds: dict[str, Any] = Field(default_factory=dict)
    evidence: dict[str, Any] = Field(default_factory=dict)
    required_signals: list[str] = Field(default_factory=lambda: ["availability", "latency", "errorBudgetRemaining", "burnRate", "alertCoverage"], alias="requiredSignals")
    max_burn_rate: float = Field(default=2.0, alias="maxBurnRate", ge=0, le=100)
    min_error_budget_remaining: float = Field(default=20.0, alias="minErrorBudgetRemaining", ge=0, le=100)
    max_p95_latency_ms: int = Field(default=2000, alias="maxP95LatencyMs", ge=1, le=120000)
    max_error_rate: float = Field(default=0.01, alias="maxErrorRate", ge=0, le=1)
    min_sample_size: int = Field(default=25, alias="minSampleSize", ge=0, le=1000000)
    require_alert_coverage: bool = Field(default=True, alias="requireAlertCoverage")

    class Config:
        populate_by_name = True


class AutoRollbackSafeguardReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    rollout_id: str = Field(default="option-b-rollout", alias="rolloutId", min_length=1, max_length=160)
    canary_percent: int = Field(default=0, alias="canaryPercent", ge=0, le=100)
    safeguards: list[dict[str, Any]] = Field(default_factory=list)
    rollback_triggers: list[dict[str, Any]] = Field(default_factory=list, alias="rollbackTriggers")
    feature_flags: list[dict[str, Any]] = Field(default_factory=list, alias="featureFlags")
    runbook: dict[str, Any] = Field(default_factory=dict)
    evidence: dict[str, Any] = Field(default_factory=dict)
    required_safeguards: list[str] = Field(default_factory=lambda: ["automaticTrigger", "manualOverride", "nodeFallback", "featureFlagKillSwitch", "rollbackRunbook", "recentDrill"], alias="requiredSafeguards")
    max_detection_minutes: int = Field(default=5, alias="maxDetectionMinutes", ge=1, le=1440)
    max_rollback_minutes: int = Field(default=15, alias="maxRollbackMinutes", ge=1, le=1440)
    require_manual_override: bool = Field(default=True, alias="requireManualOverride")
    require_node_fallback: bool = Field(default=True, alias="requireNodeFallback")
    require_kill_switch: bool = Field(default=True, alias="requireKillSwitch")

    class Config:
        populate_by_name = True




class ThirdPartyDependencyReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    dependencies: list[dict[str, Any]] = Field(default_factory=list)
    providers: list[dict[str, Any]] = Field(default_factory=list)
    incidents: list[dict[str, Any]] = Field(default_factory=list)
    status_pages: list[dict[str, Any]] = Field(default_factory=list, alias="statusPages")
    thresholds: dict[str, Any] = Field(default_factory=dict)
    evidence: dict[str, Any] = Field(default_factory=dict)
    required_dependencies: list[str] = Field(default_factory=lambda: ["redis", "objectStorage", "database", "observability", "authProvider"], alias="requiredDependencies")
    max_error_rate: float = Field(default=0.01, alias="maxErrorRate", ge=0, le=1)
    max_p95_latency_ms: int = Field(default=2000, alias="maxP95LatencyMs", ge=1, le=120000)
    min_rate_limit_headroom_percent: float = Field(default=20.0, alias="minRateLimitHeadroomPercent", ge=0, le=100)
    require_failover_evidence: bool = Field(default=True, alias="requireFailoverEvidence")
    require_status_page_clear: bool = Field(default=True, alias="requireStatusPageClear")

    class Config:
        populate_by_name = True


class CapacityScalingReadinessReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    current_canary_percent: int = Field(default=0, alias="currentCanaryPercent", ge=0, le=100)
    target_canary_percent: int = Field(default=0, alias="targetCanaryPercent", ge=0, le=100)
    metrics: dict[str, Any] = Field(default_factory=dict)
    queues: list[dict[str, Any]] = Field(default_factory=list)
    workers: list[dict[str, Any]] = Field(default_factory=list)
    autoscaling: dict[str, Any] = Field(default_factory=dict)
    load_test: dict[str, Any] = Field(default_factory=dict, alias="loadTest")
    thresholds: dict[str, Any] = Field(default_factory=dict)
    evidence: dict[str, Any] = Field(default_factory=dict)
    required_signals: list[str] = Field(default_factory=lambda: ["queueLagSeconds", "cpuPercent", "memoryPercent", "p95LatencyMs", "workerConcurrency", "autoscalingReady", "loadTestPassed"], alias="requiredSignals")
    max_queue_lag_seconds: int = Field(default=60, alias="maxQueueLagSeconds", ge=0, le=86400)
    max_cpu_percent: float = Field(default=75.0, alias="maxCpuPercent", ge=0, le=100)
    max_memory_percent: float = Field(default=80.0, alias="maxMemoryPercent", ge=0, le=100)
    max_p95_latency_ms: int = Field(default=2000, alias="maxP95LatencyMs", ge=1, le=120000)
    min_worker_concurrency: int = Field(default=2, alias="minWorkerConcurrency", ge=0, le=100000)
    require_load_test: bool = Field(default=True, alias="requireLoadTest")
    require_autoscaling: bool = Field(default=True, alias="requireAutoscaling")

    class Config:
        populate_by_name = True



class CompliancePrivacyEvidenceReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    evidence: dict[str, Any] = Field(default_factory=dict)
    artifacts: list[dict[str, Any]] = Field(default_factory=list)
    privacy_reviews: list[dict[str, Any]] = Field(default_factory=list, alias="privacyReviews")
    compliance_controls: list[dict[str, Any]] = Field(default_factory=list, alias="complianceControls")
    dpia: dict[str, Any] = Field(default_factory=dict)
    dpa_records: list[dict[str, Any]] = Field(default_factory=list, alias="dpaRecords")
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    required_evidence: list[str] = Field(default_factory=lambda: ["privacyPreflight", "dataRetention", "auditTrail", "securityPosture", "accessControl", "dataQuality"], alias="requiredEvidence")
    allowed_pii_classes: list[str] = Field(default_factory=lambda: ["metadata-only", "aggregate-non-phi", "minimized-operational", "compliance-privacy-evidence-metadata-only", "privacy-preflight-metadata-only", "audit-trail-metadata-only", "data-retention-metadata-only"], alias="allowedPiiClasses")
    require_dpia: bool = Field(default=True, alias="requireDpia")
    require_dpa: bool = Field(default=True, alias="requireDpa")
    require_redaction: bool = Field(default=True, alias="requireRedaction")
    require_approvals: bool = Field(default=True, alias="requireApprovals")

    class Config:
        populate_by_name = True


class RunbookDrillVerificationReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    runbooks: list[dict[str, Any]] = Field(default_factory=list)
    drills: list[dict[str, Any]] = Field(default_factory=list)
    scenarios: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    required_runbooks: list[str] = Field(default_factory=lambda: ["rollback", "incident", "supportEscalation", "artifactRecovery", "dataPrivacy"], alias="requiredRunbooks")
    required_drills: list[str] = Field(default_factory=lambda: ["rollback", "incident", "restore", "supportEscalation"], alias="requiredDrills")
    max_runbook_age_days: int = Field(default=90, alias="maxRunbookAgeDays", ge=1, le=3650)
    max_drill_age_days: int = Field(default=45, alias="maxDrillAgeDays", ge=1, le=3650)
    require_recent_drill: bool = Field(default=True, alias="requireRecentDrill")
    require_owner_ack: bool = Field(default=True, alias="requireOwnerAck")

    class Config:
        populate_by_name = True


class DisasterRecoveryBackupReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    backups: list[dict[str, Any]] = Field(default_factory=list)
    restore_drills: list[dict[str, Any]] = Field(default_factory=list, alias="restoreDrills")
    dependencies: list[dict[str, Any]] = Field(default_factory=list)
    rpo_rto_targets: dict[str, Any] = Field(default_factory=dict, alias="rpoRtoTargets")
    thresholds: dict[str, Any] = Field(default_factory=dict)
    evidence: dict[str, Any] = Field(default_factory=dict)
    required_backups: list[str] = Field(default_factory=lambda: ["database", "redis", "artifactStorage", "configuration"], alias="requiredBackups")
    max_backup_age_hours: int = Field(default=24, alias="maxBackupAgeHours", ge=1, le=8760)
    max_restore_age_days: int = Field(default=30, alias="maxRestoreAgeDays", ge=1, le=3650)
    max_rpo_minutes: int = Field(default=60, alias="maxRpoMinutes", ge=1, le=10080)
    max_rto_minutes: int = Field(default=240, alias="maxRtoMinutes", ge=1, le=10080)
    require_encryption: bool = Field(default=True, alias="requireEncryption")
    require_restore_drill: bool = Field(default=True, alias="requireRestoreDrill")
    require_offsite_copy: bool = Field(default=True, alias="requireOffsiteCopy")

    class Config:
        populate_by_name = True


class ChangeMigrationReadinessReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    migrations: list[dict[str, Any]] = Field(default_factory=list)
    change_tickets: list[dict[str, Any]] = Field(default_factory=list, alias="changeTickets")
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    rollback_plan: dict[str, Any] = Field(default_factory=dict, alias="rollbackPlan")
    rollout_plan: dict[str, Any] = Field(default_factory=dict, alias="rolloutPlan")
    data_backfill: dict[str, Any] = Field(default_factory=dict, alias="dataBackfill")
    evidence: dict[str, Any] = Field(default_factory=dict)
    required_migrations: list[str] = Field(default_factory=list, alias="requiredMigrations")
    max_ticket_age_days: int = Field(default=30, alias="maxTicketAgeDays", ge=1, le=3650)
    require_approval: bool = Field(default=True, alias="requireApproval")
    require_rollback_plan: bool = Field(default=True, alias="requireRollbackPlan")
    require_backup_before_migration: bool = Field(default=True, alias="requireBackupBeforeMigration")
    require_dry_run_rehearsal: bool = Field(default=True, alias="requireDryRunRehearsal")

    class Config:
        populate_by_name = True



class ConfigurationSecretRotationReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    secrets: list[dict[str, Any]] = Field(default_factory=list)
    config_items: list[dict[str, Any]] = Field(default_factory=list, alias="configItems")
    rotations: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    required_secrets: list[str] = Field(default_factory=lambda: ["pythonWorkerHmac", "redis", "database", "artifactStorage"], alias="requiredSecrets")
    max_secret_age_days: int = Field(default=90, alias="maxSecretAgeDays", ge=1, le=3650)
    max_config_drift_count: int = Field(default=0, alias="maxConfigDriftCount", ge=0, le=10000)
    require_rotation_window: bool = Field(default=True, alias="requireRotationWindow")
    require_external_secret_store: bool = Field(default=True, alias="requireExternalSecretStore")
    require_break_glass: bool = Field(default=True, alias="requireBreakGlass")
    class Config:
        populate_by_name = True

class MaintenanceWindowReadinessReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    maintenance_windows: list[dict[str, Any]] = Field(default_factory=list, alias="maintenanceWindows")
    tasks: list[dict[str, Any]] = Field(default_factory=list)
    freeze_periods: list[dict[str, Any]] = Field(default_factory=list, alias="freezePeriods")
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    comms: dict[str, Any] = Field(default_factory=dict)
    evidence: dict[str, Any] = Field(default_factory=dict)
    required_tasks: list[str] = Field(default_factory=lambda: ["preflight", "backup", "rollback", "postVerify"], alias="requiredTasks")
    max_window_age_days: int = Field(default=30, alias="maxWindowAgeDays", ge=1, le=3650)
    require_approval: bool = Field(default=True, alias="requireApproval")
    require_comms: bool = Field(default=True, alias="requireComms")
    require_rollback_task: bool = Field(default=True, alias="requireRollbackTask")
    require_low_traffic_window: bool = Field(default=True, alias="requireLowTrafficWindow")
    class Config:
        populate_by_name = True

class NotificationDispatchPayload(BaseModel):
    channel: Literal["email", "sms", "in_app"] = "email"
    template_id: str = Field(alias="templateId")
    recipients: list[str] = Field(default_factory=list)
    variables: dict[str, Any] = Field(default_factory=dict)

    class Config:
        populate_by_name = True


class AnalyticsSnapshotPayload(BaseModel):
    metric: str = "generic"
    values: list[float] = Field(default_factory=list)
    dimensions: dict[str, str] = Field(default_factory=dict)


class AiTriagePreviewPayload(BaseModel):
    text: str
    locale: str = "en"
    context: dict[str, Any] = Field(default_factory=dict)


def _result(
    job: JobEnvelope,
    result_type: str,
    data: dict[str, Any],
    warnings: list[str] | None = None,
    artifacts: list[ArtifactRef] | None = None,
) -> JobResult:
    return JobResult(
        jobType=job.job_type,
        idempotencyKey=job.idempotency_key,
        correlationId=job.correlation_id,
        dryRun=job.dry_run,
        resultType=result_type,
        data=data,
        artifacts=artifacts or [],
        warnings=warnings or [],
    )


def _rows_from_csv_text(csv_text: str) -> list[dict[str, Any]]:
    reader = csv.DictReader(io.StringIO(csv_text))
    if not reader.fieldnames:
        raise ValueError("csvText must include a header row")
    return [dict(row) for row in reader]


def _audit_selected_columns() -> list[str]:
    return [
        "createdAt",
        "actorId",
        "organizationId",
        "resource",
        "resourceId",
        "action",
        "outcome",
        "requestId",
    ]


def _hash_value(value: str) -> str:
    return hashlib.sha256(value.strip().lower().encode("utf-8")).hexdigest()[:16]


def _mask_email(email: str | None) -> str | None:
    if not email or "@" not in email:
        return None
    local, domain = email.split("@", 1)
    if not local:
        return f"***@{domain}"
    return f"{local[:1]}***@{domain}"


def _parse_datetime(value: str) -> datetime | None:
    try:
        normalized = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed
    except Exception:
        return None


def process_audit_export(job: JobEnvelope) -> JobResult:
    payload = model_validate(AuditExportPayload, job.payload)
    filters = payload.filters
    artifact_name = f"audit-export-{filters.from_date.isoformat()}-{filters.to_date.isoformat()}.{payload.format}"
    selected_columns = _audit_selected_columns()
    warnings: list[str] = []
    if payload.include_phi:
        warnings.append("PHI requested; Node must enforce export policy and audit approval before delivery")
    if job.dry_run and not payload.rows:
        warnings.append("dry-run: Python wrote only a sanitized export plan; Node remains owner of production row fetch")
    if payload.rows:
        warnings.append("artifact generated from Node-supplied minimized rows; Python did not query PHI tables")

    plan = {
        "artifactName": artifact_name,
        "format": payload.format,
        "maxRows": payload.max_rows,
        "filters": model_dump(filters, by_alias=True, mode="json"),
        "selectedColumns": selected_columns,
        "organizationIdPresent": bool(job.organization_id),
        "actorUserIdPresent": bool(job.actor_user_id),
        "requiresSignedUrl": True,
        "requiresAuditEvent": True,
    }

    artifacts: list[ArtifactRef] = []
    prefix = artifact_name.rsplit(".", 1)[0]
    if payload.rows:
        rows = [redact_record(row, selected_columns) for row in payload.rows[: payload.max_rows]]
        if payload.format == "json":
            artifacts.append(
                artifact_store.write_json(
                    prefix=prefix,
                    artifact_type="admin.audit_export.rows",
                    payload={"rows": rows},
                    metadata={"rowCount": len(rows), "redactionApplied": True, "piiClass": "minimized-operational", "source": "node-prefiltered"},
                )
            )
        else:
            artifacts.append(
                artifact_store.write_csv(
                    prefix=prefix,
                    artifact_type="admin.audit_export.rows",
                    rows=rows,
                    columns=selected_columns,
                    metadata={"rowCount": len(rows), "redactionApplied": True, "piiClass": "minimized-operational", "source": "node-prefiltered"},
                )
            )
    else:
        artifacts.append(
            artifact_store.write_json(
                prefix=prefix,
                artifact_type="admin.audit_export.plan",
                payload=plan,
                metadata={"rowCount": 0, "redactionApplied": True, "piiClass": "none", "source": "python-plan"},
            )
        )

    row_count = min(len(payload.rows), payload.max_rows) if payload.rows else 0
    return _result(
        job,
        "admin.audit_export.prepared",
        {**plan, "rowEstimate": row_count, "artifactGenerated": bool(artifacts), "delivery": {"mode": "python-artifact-store" if payload.rows else "node-owned", "requiresSignedUrl": True, "requiresAuditEvent": True}},
        warnings,
        artifacts,
    )


def process_bulk_account_validate(job: JobEnvelope) -> JobResult:
    payload = model_validate(BulkValidatePayload, job.payload)
    errors: list[dict[str, Any]] = []
    valid_rows: list[dict[str, Any]] = []
    source_rows = list(payload.rows)
    csv_rows = 0
    warnings = ["dry-run: validation only; Node remains owner of account mutation"] if job.dry_run else []

    if payload.csv_text:
        parsed_rows = _rows_from_csv_text(payload.csv_text)
        csv_rows = len(parsed_rows)
        source_rows.extend(parsed_rows)
        warnings.append("csvText parsed in Python worker; account creation remains Node-owned")
    if len(source_rows) > 5000:
        raise ValueError("bulk account validation is limited to 5000 rows per job")

    allowed_roles = {role.strip().upper() for role in payload.allowed_roles if role.strip()}
    allowed_domains = {domain.strip().lower().removeprefix("@") for domain in payload.allowed_email_domains if domain.strip()}
    seen_emails: dict[str, int] = {}
    duplicates: list[dict[str, Any]] = []

    for index, raw_row in enumerate(source_rows):
        try:
            row = model_validate(BulkAccountRow, raw_row)
            email_domain = row.email.rsplit("@", 1)[1]
            if allowed_roles and row.role not in allowed_roles:
                raise ValueError(f"role {row.role!r} is not allowed for this import")
            if allowed_domains and email_domain not in allowed_domains:
                raise ValueError(f"email domain {email_domain!r} is not allowed for this import")
            if payload.require_organization and not row.organization_id:
                raise ValueError("organizationId is required")
            if row.email in seen_emails:
                duplicates.append({"emailHash": _hash_value(row.email), "firstIndex": seen_emails[row.email], "duplicateIndex": index})
                raise ValueError("duplicate email in import")
            seen_emails[row.email] = index
            cleaned = model_dump(row, by_alias=True)
            cleaned["emailHash"] = _hash_value(row.email)
            cleaned["emailMasked"] = _mask_email(row.email)
            cleaned.pop("email", None)
            valid_rows.append(cleaned)
        except Exception as exc:
            row_keys = sorted(raw_row.keys()) if isinstance(raw_row, dict) else []
            errors.append({"index": index, "message": str(exc), "rowKeys": row_keys})

    summary = {
        "totalRows": len(source_rows),
        "inputRows": len(payload.rows),
        "csvRows": csv_rows,
        "validRows": len(valid_rows),
        "invalidRows": len(errors),
        "duplicateEmails": duplicates[:100],
        "errors": errors[:100],
        "truncatedErrors": max(0, len(errors) - 100),
    }
    artifact = artifact_store.write_json(
        prefix="accounts-bulk-validation",
        artifact_type="admin.accounts_bulk_validate.report",
        payload=summary,
        metadata={"rowCount": len(source_rows), "redactionApplied": True, "piiClass": "minimized-operational", "source": "python-validator"},
    )
    return _result(job, "admin.accounts_bulk_validate.completed", {**summary, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, warnings, [artifact])


def process_accounts_read_model(job: JobEnvelope) -> JobResult:
    payload = model_validate(AccountsReadModelPayload, job.payload)
    if len(payload.rows) > payload.limit:
        source_rows = payload.rows[: payload.limit]
    else:
        source_rows = payload.rows

    rows: list[dict[str, Any]] = []
    role_counts: dict[str, int] = {}
    status_counts: dict[str, int] = {}
    for raw in source_rows:
        email = str(raw.get("email") or raw.get("userEmail") or "").strip().lower()
        role = str(raw.get("role") or raw.get("primaryRole") or "UNKNOWN").strip().upper() or "UNKNOWN"
        status_value = str(raw.get("status") or raw.get("accountStatus") or "UNKNOWN").strip().upper() or "UNKNOWN"
        role_counts[role] = role_counts.get(role, 0) + 1
        status_counts[status_value] = status_counts.get(status_value, 0) + 1
        rows.append(
            {
                "id": raw.get("id") or raw.get("userId"),
                "displayName": raw.get("displayName") or raw.get("name"),
                "role": role,
                "status": status_value,
                "organizationId": raw.get("organizationId") or job.organization_id,
                "emailMasked": _mask_email(email),
                "emailHash": _hash_value(email) if email else None,
                "lastLoginAt": raw.get("lastLoginAt"),
                "createdAt": raw.get("createdAt"),
            }
        )

    next_cursor = None
    if payload.rows and len(payload.rows) >= payload.limit:
        last = rows[-1] if rows else {}
        next_cursor = str(last.get("id") or payload.cursor or "next-page")

    read_model = {
        "cursor": payload.cursor,
        "nextCursor": next_cursor,
        "limit": payload.limit,
        "filters": payload.filters,
        "sort": payload.sort,
        "rowCount": len(rows),
        "roleCounts": role_counts,
        "statusCounts": status_counts,
        "rows": rows,
        "nodeOwnedSourceQuery": True,
        "pythonOwnsPresentationShapeOnly": True,
    }
    artifact = artifact_store.write_json(
        prefix="accounts-read-model",
        artifact_type="admin.accounts_read_model.page",
        payload=read_model,
        metadata={"rowCount": len(rows), "redactionApplied": True, "piiClass": "minimized-admin-read-model", "source": "node-prefiltered" if payload.rows else "python-plan"},
    )
    warnings = [
        "Python shaped a minimized read model only; Node remains owner of Prisma filters, RBAC/ABAC and source rows.",
        "Raw account email values were replaced with hash/masked form before result/artifact output.",
    ]
    if not payload.rows:
        warnings.append("no rows supplied: generated plan-only read-model artifact for canary contract validation")
    return _result(job, "admin.accounts_read_model.prepared", {**read_model, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, warnings, [artifact])


def process_provider_role_reconcile(job: JobEnvelope) -> JobResult:
    payload = model_validate(ProviderRoleReconcilePayload, job.payload)
    schema_models = set(payload.schema_models)
    migration_models = set(payload.migration_models)
    provider_fields = set(payload.schema_fields.get("ProviderProfile", []))
    blockers: list[str] = []
    recommendations: list[str] = []

    if payload.expected_role_catalog_model not in schema_models:
        blockers.append(f"schema missing model {payload.expected_role_catalog_model}")
        recommendations.append(f"restore {payload.expected_role_catalog_model} in schema.prisma or remove code/migration references")
    if payload.expected_role_catalog_model in migration_models and payload.expected_role_catalog_model not in schema_models:
        blockers.append(f"migration references {payload.expected_role_catalog_model} but current schema omits it")
    if payload.expected_provider_role_field not in provider_fields:
        blockers.append(f"ProviderProfile missing field {payload.expected_provider_role_field}")
        recommendations.append(f"add ProviderProfile.{payload.expected_provider_role_field} with an explicit index or remove dependent code paths")

    orphaned_rows = []
    for index, row in enumerate(payload.provider_rows[:1000]):
        role_catalog_id = row.get(payload.expected_provider_role_field) or row.get("roleCatalogId")
        role_name = row.get("role") or row.get("roleName")
        if role_name and not role_catalog_id:
            orphaned_rows.append({"index": index, "providerHash": _hash_value(str(row.get("providerId") or row.get("id") or index)), "role": str(role_name)})

    if orphaned_rows:
        blockers.append("provider rows contain role names without roleCatalogId")
        recommendations.append("backfill ProviderProfile.roleCatalogId from ProviderRoleCatalog before enabling Python canary for provider-role workflows")

    referenced_symbols = sorted(set(payload.code_references))[:50]
    report = {
        "readyForCanary": not blockers,
        "blockers": blockers,
        "recommendations": recommendations,
        "observed": {
            "schemaModels": sorted(schema_models),
            "migrationModels": sorted(migration_models),
            "providerProfileFields": sorted(provider_fields),
            "codeReferences": referenced_symbols,
            "orphanedProviderRoleRows": orphaned_rows[:50],
            "truncatedOrphans": max(0, len(orphaned_rows) - 50),
        },
        "nodeOwnedMutation": True,
    }
    artifact = artifact_store.write_json(
        prefix="provider-role-reconcile",
        artifact_type="admin.provider_role_reconcile.report",
        payload=report,
        metadata={"rowCount": len(payload.provider_rows), "redactionApplied": True, "piiClass": "schema-metadata-only", "source": "python-advisory"},
    )
    return _result(job, "admin.provider_role_reconcile.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["advisory only: Python did not mutate schema, migrations, users or roles"], [artifact])


def process_scheduling_availability_snapshot(job: JobEnvelope) -> JobResult:
    payload = model_validate(SchedulingAvailabilityPayload, job.payload)
    status_counts: dict[str, int] = {}
    group_counts: dict[str, int] = {}
    invalid_windows: list[dict[str, Any]] = []
    total_minutes = 0.0
    for index, window in enumerate(payload.windows):
        status_counts[window.status] = status_counts.get(window.status, 0) + 1
        group_key = getattr(window, payload.group_by) or window.status
        group_counts[str(group_key)] = group_counts.get(str(group_key), 0) + 1
        starts = _parse_datetime(window.starts_at)
        ends = _parse_datetime(window.ends_at)
        if not starts or not ends or ends <= starts:
            invalid_windows.append({"index": index, "status": window.status, "reason": "invalid or non-positive time range"})
            continue
        total_minutes += (ends - starts).total_seconds() / 60

    sample = []
    if payload.include_window_sample:
        for window in payload.windows[:20]:
            sample.append({"providerHash": window.provider_hash, "resourceHash": window.resource_hash, "startsAt": window.starts_at, "endsAt": window.ends_at, "status": window.status})

    snapshot = {
        "timezone": payload.timezone,
        "windowCount": len(payload.windows),
        "validWindowCount": len(payload.windows) - len(invalid_windows),
        "invalidWindowCount": len(invalid_windows),
        "statusCounts": status_counts,
        "groupBy": payload.group_by,
        "groupCounts": group_counts,
        "totalWindowMinutes": round(total_minutes, 2),
        "invalidWindows": invalid_windows[:50],
        "sample": sample,
        "nodeOwnedCalendarQuery": True,
    }
    artifact = artifact_store.write_json(
        prefix="availability-snapshot",
        artifact_type="scheduling.availability_snapshot.report",
        payload=snapshot,
        metadata={"rowCount": len(payload.windows), "redactionApplied": True, "piiClass": "schedule-metadata-minimized", "source": "node-prefiltered"},
    )
    return _result(job, "scheduling.availability_snapshot.computed", {**snapshot, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Python computed scheduling aggregates only; Node remains owner of booking rules and appointment mutations"], [artifact])


def process_messaging_reminder_plan(job: JobEnvelope) -> JobResult:
    payload = model_validate(ReminderPlanPayload, job.payload)
    supplied_hashes = [item.strip().lower() for item in payload.recipient_hashes if item.strip()]
    derived_hashes = [_hash_value(item) for item in payload.recipients if item.strip()]
    unique_hashes = sorted(set(supplied_hashes + derived_hashes))
    batches = [unique_hashes[index : index + payload.batch_size] for index in range(0, len(unique_hashes), payload.batch_size)]
    plan = {
        "channel": payload.channel,
        "templateId": payload.template_id,
        "recipientHashCount": len(unique_hashes),
        "rawRecipientCount": len(payload.recipients),
        "duplicateRecipients": len(supplied_hashes + derived_hashes) - len(unique_hashes),
        "batchSize": payload.batch_size,
        "batchCount": len(batches),
        "batches": [{"batchIndex": index, "recipientHashCount": len(batch)} for index, batch in enumerate(batches)],
        "sendAfter": payload.send_after,
        "variablesKeys": sorted(payload.variables.keys()),
        "deliveryMode": "disabled-dry-run-plan",
    }
    artifact = artifact_store.write_json(
        prefix="reminder-plan",
        artifact_type="messaging.reminder_plan.report",
        payload=plan,
        metadata={"rowCount": len(unique_hashes), "redactionApplied": True, "piiClass": "recipient-hash-planning", "source": "python-planner"},
    )
    return _result(job, "messaging.reminder_plan.planned", {**plan, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["dry-run only: Python did not send messages and did not persist raw recipients"], [artifact])



def _normalized_status(value: str | None) -> str:
    return (value or "unknown").strip().lower().replace(" ", "_") or "unknown"


def process_billing_payment_reconcile(job: JobEnvelope) -> JobResult:
    payload = model_validate(PaymentReconcilePayload, job.payload)
    rows = payload.rows[:10000]
    totals_by_currency: dict[str, int] = {}
    counts_by_status: dict[str, int] = {}
    counts_by_gateway_status: dict[str, int] = {}
    mismatch_rows: list[dict[str, Any]] = []
    missing_external_id = 0
    negative_amounts = 0

    success_gateway_statuses = {"paid", "succeeded", "settled", "captured"}
    failure_gateway_statuses = {"failed", "canceled", "cancelled", "refunded", "disputed"}
    success_internal_statuses = {"paid", "succeeded", "settled", "captured", "completed"}
    failure_internal_statuses = {"failed", "canceled", "cancelled", "refunded", "disputed"}

    sample: list[dict[str, Any]] = []
    for index, row in enumerate(rows):
        currency = (row.currency or payload.currency or "USD").upper()
        status = _normalized_status(row.status)
        gateway_status = _normalized_status(row.gateway_status)
        totals_by_currency[currency] = totals_by_currency.get(currency, 0) + int(row.amount_minor or 0)
        counts_by_status[status] = counts_by_status.get(status, 0) + 1
        counts_by_gateway_status[gateway_status] = counts_by_gateway_status.get(gateway_status, 0) + 1
        if not row.external_id_hash:
            missing_external_id += 1
        if int(row.amount_minor or 0) < 0:
            negative_amounts += 1

        mismatch_reason: str | None = None
        if status in success_internal_statuses and gateway_status in failure_gateway_statuses:
            mismatch_reason = "internal_success_gateway_failure"
        elif status in failure_internal_statuses and gateway_status in success_gateway_statuses:
            mismatch_reason = "internal_failure_gateway_success"
        elif row.gateway_status is None:
            mismatch_reason = "missing_gateway_status"
        if mismatch_reason:
            mismatch_rows.append({
                "index": index,
                "paymentIdHash": row.payment_id_hash or _hash_value(str(index)),
                "externalIdHash": row.external_id_hash,
                "status": status,
                "gatewayStatus": gateway_status,
                "reason": mismatch_reason,
            })
        if payload.include_row_sample and len(sample) < 25:
            sample.append({
                "paymentIdHash": row.payment_id_hash or _hash_value(str(index)),
                "externalIdHash": row.external_id_hash,
                "gateway": row.gateway,
                "status": status,
                "gatewayStatus": gateway_status,
                "amountMinor": row.amount_minor,
                "currency": currency,
            })

    report = {
        "gateway": payload.gateway,
        "rowCount": len(rows),
        "totalsByCurrencyMinor": totals_by_currency,
        "countsByStatus": counts_by_status,
        "countsByGatewayStatus": counts_by_gateway_status,
        "mismatchCount": len(mismatch_rows),
        "mismatches": mismatch_rows[:100],
        "truncatedMismatches": max(0, len(mismatch_rows) - 100),
        "missingExternalIdCount": missing_external_id,
        "negativeAmountCount": negative_amounts,
        "sample": sample,
        "nodeOwnedPaymentMutation": True,
        "nodeOwnedWebhookIdempotency": True,
    }
    artifact = artifact_store.write_json(
        prefix="billing-payment-reconcile",
        artifact_type="billing.payment_reconcile.report",
        payload=report,
        metadata={"rowCount": len(rows), "redactionApplied": True, "piiClass": "billing-metadata-minimized", "source": "node-prefiltered" if rows else "python-plan"},
    )
    return _result(
        job,
        "billing.payment_reconcile.completed",
        {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")},
        ["advisory only: Python did not mutate payments, ledgers, webhooks or external gateway state"],
        [artifact],
    )


def _hour_from_created_at(value: str | None) -> int | None:
    parsed = _parse_datetime(value or "") if value else None
    return parsed.hour if parsed else None


def process_clinical_records_access_audit(job: JobEnvelope) -> JobResult:
    payload = model_validate(ClinicalAccessAuditPayload, job.payload)
    events = payload.events[:20000]
    max_patients_per_actor = int(payload.anomaly_thresholds.get("maxPatientsPerActor", 25))
    max_denied_per_actor = int(payload.anomaly_thresholds.get("maxDeniedPerActor", 10))

    by_outcome: dict[str, int] = {}
    by_action: dict[str, int] = {}
    actor_patients: dict[str, set[str]] = {}
    denied_by_actor: dict[str, int] = {}
    break_glass_events: list[dict[str, Any]] = []
    outside_hours_events: list[dict[str, Any]] = []
    missing_reason_break_glass = 0

    sample: list[dict[str, Any]] = []
    for index, event in enumerate(events):
        actor = event.actor_hash or "unknown-actor"
        patient = event.patient_hash or "unknown-patient"
        action = _normalized_status(event.action)
        outcome = _normalized_status(event.outcome)
        by_action[action] = by_action.get(action, 0) + 1
        by_outcome[outcome] = by_outcome.get(outcome, 0) + 1
        actor_patients.setdefault(actor, set()).add(patient)
        if outcome in {"denied", "failed", "error", "blocked"}:
            denied_by_actor[actor] = denied_by_actor.get(actor, 0) + 1
        if event.break_glass:
            if not event.reason_code:
                missing_reason_break_glass += 1
            break_glass_events.append({
                "index": index,
                "actorHash": actor,
                "patientHash": patient,
                "resourceHash": event.resource_hash,
                "action": action,
                "outcome": outcome,
                "reasonCode": event.reason_code,
            })
        hour = _hour_from_created_at(event.created_at)
        if hour is not None and (hour < 6 or hour > 22):
            outside_hours_events.append({"index": index, "actorHash": actor, "patientHash": patient, "hourUtc": hour, "action": action, "outcome": outcome})
        if payload.include_event_sample and len(sample) < 25:
            sample.append({
                "actorHash": actor,
                "patientHash": patient,
                "resourceHash": event.resource_hash,
                "action": action,
                "outcome": outcome,
                "breakGlass": event.break_glass,
                "reasonCode": event.reason_code,
            })

    high_fanout_actors = [
        {"actorHash": actor, "distinctPatientCount": len(patients)}
        for actor, patients in sorted(actor_patients.items())
        if len(patients) > max_patients_per_actor
    ]
    high_denied_actors = [
        {"actorHash": actor, "deniedCount": count}
        for actor, count in sorted(denied_by_actor.items())
        if count > max_denied_per_actor
    ]
    risk_indicators = {
        "breakGlassCount": len(break_glass_events),
        "missingReasonBreakGlassCount": missing_reason_break_glass,
        "outsideHoursCount": len(outside_hours_events),
        "highFanoutActors": high_fanout_actors[:100],
        "highDeniedActors": high_denied_actors[:100],
    }
    report = {
        "eventCount": len(events),
        "window": payload.window,
        "countsByOutcome": by_outcome,
        "countsByAction": by_action,
        "distinctActorCount": len(actor_patients),
        "distinctPatientCount": len({patient for patients in actor_patients.values() for patient in patients}),
        "riskIndicators": risk_indicators,
        "breakGlassEvents": break_glass_events[:100],
        "outsideHoursEvents": outside_hours_events[:100],
        "sample": sample,
        "nodeOwnedRecordAuthorization": True,
        "nodeOwnedAuditWrite": True,
    }
    artifact = artifact_store.write_json(
        prefix="clinical-records-access-audit",
        artifact_type="clinical.records_access_audit.report",
        payload=report,
        metadata={"rowCount": len(events), "redactionApplied": True, "piiClass": "clinical-access-metadata-hashed", "source": "node-prefiltered" if events else "python-plan"},
    )
    return _result(
        job,
        "clinical.records_access_audit.completed",
        {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")},
        ["hashed access metadata only: Python did not receive chart content, notes, diagnoses, prescriptions or lab results"],
        [artifact],
    )


def _index_signature(fields: list[str]) -> tuple[str, ...]:
    return tuple(field.strip() for field in fields if field and field.strip())


def _model_index_map(models: list[DbModelStat]) -> dict[str, set[tuple[str, ...]]]:
    result: dict[str, set[tuple[str, ...]]] = {}
    for model in models:
        indexes = {_index_signature(index) for index in model.indexes + model.unique_indexes}
        result[model.model] = {index for index in indexes if index}
    return result


def _has_prefix_index(existing: set[tuple[str, ...]], candidate: tuple[str, ...]) -> bool:
    if not candidate:
        return True
    return any(index[: len(candidate)] == candidate for index in existing)


def process_platform_db_index_advisory(job: JobEnvelope) -> JobResult:
    payload = model_validate(DbIndexAdvisoryPayload, job.payload)
    existing_by_model = _model_index_map(payload.models)
    model_rows = {item.model: item.row_count for item in payload.models}
    recommendations: list[dict[str, Any]] = []
    warnings: list[str] = [
        "advisory only: Python did not connect to PostgreSQL and did not write Prisma migrations",
        "Node/Prisma remain owner of schema changes; validate all index suggestions with EXPLAIN ANALYZE and staging data",
    ]

    priority_models = {
        "Appointment": [
            ["organizationId", "startsAt"],
            ["providerId", "startsAt"],
            ["patientId", "startsAt"],
            ["status", "startsAt"],
        ],
        "AuditLog": [["organizationId", "createdAt"], ["resource", "resourceId", "createdAt"], ["actorId", "createdAt"]],
        "Message": [["threadId", "createdAt"]],
        "MessageThread": [["organizationId", "updatedAt"], ["patientId", "updatedAt"], ["providerId", "updatedAt"]],
        "Payment": [["status", "createdAt"], ["gateway", "externalId"], ["organizationId", "createdAt"]],
        "RefreshToken": [["userId", "revokedAt", "expiresAt"]],
        "PatientProfile": [["organizationId"]],
        "ProviderProfile": [["organizationId"]],
    }

    for model, index_sets in priority_models.items():
        existing = existing_by_model.get(model, set())
        for fields in index_sets:
            candidate = tuple(fields)
            if _has_prefix_index(existing, candidate):
                continue
            recommendations.append(
                {
                    "model": model,
                    "fields": list(candidate),
                    "priority": "medium" if model_rows.get(model, 0) < 100000 else "high",
                    "reason": "baseline index from CarePoint architecture report for operational/admin growth paths",
                    "prisma": f"@@index([{', '.join(candidate)}])" if payload.include_prisma_hints else None,
                    "source": "baseline-report",
                }
            )

    for query in payload.queries[:2000]:
        existing = existing_by_model.get(query.model, set())
        candidate_fields = _index_signature([*query.filter_fields, *query.order_by_fields])
        if not candidate_fields:
            continue
        if _has_prefix_index(existing, candidate_fields):
            continue
        priority = "low"
        reasons = []
        if query.full_scan:
            priority = "high"
            reasons.append("query reports fullScan=true")
        if query.p95_duration_ms > payload.target_p95_ms:
            priority = "high"
            reasons.append(f"p95DurationMs {query.p95_duration_ms:g} exceeds target {payload.target_p95_ms:g}")
        if query.estimated_rows >= 10000 and priority != "high":
            priority = "medium"
            reasons.append("estimatedRows suggests growth-sensitive scan")
        if query.include_depth >= 3:
            reasons.append("deep include/select shape should be reviewed for over-fetching")
        if not reasons:
            reasons.append("observed query has filter/order fields without a matching prefix index")
        recommendations.append(
            {
                "model": query.model,
                "fields": list(candidate_fields),
                "priority": priority,
                "endpoint": query.endpoint,
                "reason": "; ".join(reasons),
                "observed": {
                    "estimatedRows": query.estimated_rows,
                    "avgDurationMs": query.avg_duration_ms,
                    "p95DurationMs": query.p95_duration_ms,
                    "fullScan": query.full_scan,
                    "includeDepth": query.include_depth,
                },
                "prisma": f"@@index([{', '.join(candidate_fields)}])" if payload.include_prisma_hints else None,
                "source": "query-observation",
            }
        )

    deduped: dict[tuple[str, tuple[str, ...]], dict[str, Any]] = {}
    priority_rank = {"high": 3, "medium": 2, "low": 1}
    for item in recommendations:
        key = (str(item["model"]), tuple(item["fields"]))
        existing = deduped.get(key)
        if existing is None or priority_rank.get(str(item["priority"]), 0) > priority_rank.get(str(existing["priority"]), 0):
            deduped[key] = item
    ordered = sorted(deduped.values(), key=lambda item: (-priority_rank.get(str(item["priority"]), 0), str(item["model"]), str(item["fields"])))

    report = {
        "modelCount": len(payload.models),
        "queryObservationCount": len(payload.queries),
        "recommendationCount": len(ordered),
        "highPriorityCount": sum(1 for item in ordered if item["priority"] == "high"),
        "recommendations": ordered[:200],
        "truncatedRecommendations": max(0, len(ordered) - 200),
        "migrationOwner": "Node/Prisma",
        "requiresExplainAnalyze": True,
        "requiresStagingReplay": True,
    }
    artifact = artifact_store.write_json(
        prefix="platform-db-index-advisory",
        artifact_type="platform.db_index_advisory.report",
        payload=report,
        metadata={"rowCount": len(ordered), "redactionApplied": True, "piiClass": "schema-query-metadata-only", "source": "python-advisory"},
    )
    return _result(job, "platform.db_index_advisory.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, warnings, [artifact])


def _percentile(values: list[float], percentile: float) -> float | None:
    if not values:
        return None
    ordered = sorted(float(value) for value in values)
    if len(ordered) == 1:
        return ordered[0]
    rank = (len(ordered) - 1) * percentile
    lower = int(rank)
    upper = min(lower + 1, len(ordered) - 1)
    weight = rank - lower
    return ordered[lower] * (1 - weight) + ordered[upper] * weight


def _error_rate(errors: int, requests: int) -> float:
    if requests <= 0:
        return 0.0
    return errors / requests


def process_platform_slo_regression_report(job: JobEnvelope) -> JobResult:
    payload = model_validate(SloRegressionPayload, job.payload)
    thresholds = {
        "maxP95RegressionPercent": float(payload.thresholds.get("maxP95RegressionPercent", 20)),
        "maxErrorRate": float(payload.thresholds.get("maxErrorRate", 0.01)),
        "targetP95Ms": float(payload.thresholds.get("targetP95Ms", 500)),
        "targetP99Ms": float(payload.thresholds.get("targetP99Ms", 2000)),
    }
    baseline_p95 = _percentile(payload.baseline_samples_ms, 0.95)
    current_p95 = _percentile(payload.current_samples_ms, 0.95)
    current_p99 = _percentile(payload.current_samples_ms, 0.99)
    baseline_p50 = _percentile(payload.baseline_samples_ms, 0.50)
    current_p50 = _percentile(payload.current_samples_ms, 0.50)
    baseline_error_rate = _error_rate(payload.baseline_error_count, payload.baseline_request_count)
    current_error_rate = _error_rate(payload.current_error_count, payload.current_request_count)

    reasons: list[str] = []
    recommendation = "advance"
    regression_percent = None
    if baseline_p95 and current_p95 is not None and baseline_p95 > 0:
        regression_percent = ((current_p95 - baseline_p95) / baseline_p95) * 100
        if regression_percent > thresholds["maxP95RegressionPercent"]:
            recommendation = "rollback"
            reasons.append(f"p95 regression {regression_percent:.1f}% exceeds {thresholds['maxP95RegressionPercent']:.1f}%")
    if current_p95 is not None and current_p95 > thresholds["targetP95Ms"]:
        recommendation = "rollback" if current_p95 > thresholds["targetP95Ms"] * 1.5 else ("hold" if recommendation == "advance" else recommendation)
        reasons.append(f"current p95 {current_p95:.1f}ms exceeds target {thresholds['targetP95Ms']:.1f}ms")
    if current_p99 is not None and current_p99 > thresholds["targetP99Ms"]:
        recommendation = "hold" if recommendation == "advance" else recommendation
        reasons.append(f"current p99 {current_p99:.1f}ms exceeds target {thresholds['targetP99Ms']:.1f}ms")
    if current_error_rate > thresholds["maxErrorRate"]:
        recommendation = "rollback"
        reasons.append(f"current error rate {current_error_rate:.4f} exceeds {thresholds['maxErrorRate']:.4f}")
    if not payload.current_samples_ms:
        recommendation = "hold"
        reasons.append("currentSamplesMs is empty; cannot advance canary without latency evidence")
    if not reasons:
        reasons.append("current samples are within configured SLO thresholds")

    report = {
        "route": payload.route,
        "recommendation": recommendation,
        "reasons": reasons,
        "thresholds": thresholds,
        "baseline": {
            "sampleCount": len(payload.baseline_samples_ms),
            "p50Ms": baseline_p50,
            "p95Ms": baseline_p95,
            "errorCount": payload.baseline_error_count,
            "requestCount": payload.baseline_request_count,
            "errorRate": baseline_error_rate,
        },
        "current": {
            "sampleCount": len(payload.current_samples_ms),
            "p50Ms": current_p50,
            "p95Ms": current_p95,
            "p99Ms": current_p99,
            "errorCount": payload.current_error_count,
            "requestCount": payload.current_request_count,
            "errorRate": current_error_rate,
        },
        "regressionPercentP95": regression_percent,
        "dimensions": payload.dimensions,
        "canaryGateInput": True,
    }
    artifact = artifact_store.write_json(
        prefix="platform-slo-regression-report",
        artifact_type="platform.slo_regression_report.report",
        payload=report,
        metadata={"rowCount": len(payload.current_samples_ms), "redactionApplied": True, "piiClass": "aggregate-telemetry-only", "source": "python-slo-evaluator"},
    )
    return _result(job, "platform.slo_regression_report.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["aggregate telemetry only: Python did not inspect request/response payloads"], [artifact])



def process_platform_contract_replay(job: JobEnvelope) -> JobResult:
    from ..contracts import build_contract_test_vectors, validate_contract_envelope

    payload = model_validate(ContractReplayPayload, job.payload)
    wanted_job_types = set(payload.job_types)
    wanted_contract_ids = set(payload.contract_ids)
    wanted_vector_ids = set(payload.vector_ids)
    all_vectors = build_contract_test_vectors()
    selected = []
    for vector in all_vectors:
        vector_json = model_dump(vector, by_alias=True, mode="json")
        if vector.job_type == JobType.PLATFORM_CONTRACT_REPLAY:
            continue
        if wanted_job_types and vector.job_type.value not in wanted_job_types:
            continue
        if wanted_contract_ids and vector.contract_id not in wanted_contract_ids:
            continue
        if wanted_vector_ids and vector_json["vectorId"] not in wanted_vector_ids:
            continue
        selected.append(vector)
        if len(selected) >= payload.max_vectors:
            break

    results: list[dict[str, Any]] = []
    passed = 0
    failed = 0
    for vector in selected:
        vector_json = model_dump(vector, by_alias=True, mode="json")
        validation = validate_contract_envelope(vector.envelope)
        validation_json = model_dump(validation, by_alias=True, mode="json")
        item: dict[str, Any] = {
            "vectorId": vector_json["vectorId"],
            "contractId": vector.contract_id,
            "jobType": vector.job_type.value,
            "expectedResultType": vector.expected_result_type,
            "validationAllowed": validation.allowed,
            "status": "pending",
            "errors": list(validation.errors),
            "warnings": list(validation.warnings),
        }
        if not validation.allowed:
            item["status"] = "failed"
            item["actualResultType"] = None
            failed += 1
            results.append(item)
            if payload.fail_fast:
                break
            continue
        try:
            actual = PROCESSORS[vector.envelope.job_type](vector.envelope)
            actual_json = model_dump(actual, by_alias=True, mode="json")
            item["actualResultType"] = actual.result_type
            item["artifactCount"] = len(actual.artifacts)
            if actual.result_type == vector.expected_result_type:
                item["status"] = "passed"
                passed += 1
                if payload.include_successful_results:
                    item["resultDataKeys"] = sorted(actual_json.get("data", {}).keys())
            else:
                item["status"] = "failed"
                item["errors"].append(f"expected {vector.expected_result_type} but got {actual.result_type}")
                failed += 1
        except Exception as exc:
            item["status"] = "failed"
            item["actualResultType"] = None
            item["errors"].append(str(exc))
            failed += 1
        results.append(item)
        if payload.fail_fast and item["status"] == "failed":
            break

    report = {
        "schemaVersion": "2026-05-option-b-v14",
        "selectedVectorCount": len(selected),
        "passed": passed,
        "failed": failed,
        "decision": "pass" if failed == 0 and selected else "fail" if failed else "hold",
        "results": results,
        "ciGateReady": failed == 0 and bool(selected),
        "selectors": {
            "jobTypes": sorted(wanted_job_types),
            "contractIds": sorted(wanted_contract_ids),
            "vectorIds": sorted(wanted_vector_ids),
        },
    }
    artifact = artifact_store.write_json(
        prefix="platform-contract-replay",
        artifact_type="platform.contract_replay.report",
        payload=report,
        metadata={"rowCount": len(results), "redactionApplied": True, "piiClass": "contract-vector-metadata-only", "source": "python-contract-replay"},
    )
    return _result(job, "platform.contract_replay.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["replayed sanitized built-in contract vectors only; no production payloads were fetched"], [artifact])


def _preflight_key_risk(key: str) -> str | None:
    normalized = "".join(ch for ch in key.lower() if ch.isalnum() or ch == "_")
    secret_like = {"accesstoken", "authorization", "cookie", "password", "refreshtoken", "secret", "token", "apikey", "api_key", "cvv", "cardnumber", "creditcard"}
    phi_like = {"address", "chart", "clinicalnote", "dateofbirth", "diagnosis", "dob", "fullchart", "labresult", "medicalrecord", "note", "patientemail", "patientphone", "phone", "prescription", "ssn", "socialsecuritynumber"}
    if normalized in secret_like:
        return "secret"
    if normalized in phi_like:
        return "phi"
    return None


def _flatten_shape_keys(shape: dict[str, Any], prefix: str = "") -> list[str]:
    keys: list[str] = []
    for raw_key, value in shape.items():
        key = str(raw_key)
        path = f"{prefix}.{key}" if prefix else key
        keys.append(path)
        if isinstance(value, dict):
            keys.extend(_flatten_shape_keys(value, path))
    return keys


def process_platform_privacy_preflight(job: JobEnvelope) -> JobResult:
    payload = model_validate(PrivacyPreflightPayload, job.payload)
    reports: list[dict[str, Any]] = []
    blocked = 0
    warned = 0
    for idx, candidate in enumerate(payload.candidates):
        keys = sorted({*candidate.payload_keys, *_flatten_shape_keys(candidate.payload_shape)})
        blockers = []
        warnings = []
        for key in keys:
            risk = _preflight_key_risk(key.split(".")[-1])
            if risk == "secret":
                blockers.append({"key": key, "risk": "secret-or-token"})
            elif risk == "phi":
                blockers.append({"key": key, "risk": "phi-or-direct-identifier"})
        if not candidate.job_type:
            warnings.append("jobType is missing; cannot map candidate to a concrete Option B contract")
        elif candidate.job_type not in {item.value for item in JobType}:
            blockers.append({"key": "jobType", "risk": "unknown-job-type"})
        if candidate.classification in {"unknown", "raw", "phi", "secret"}:
            warnings.append(f"classification {candidate.classification!r} requires explicit data minimization review")
        status = "blocked" if blockers else "warn" if warnings else "pass"
        if blockers:
            blocked += 1
        if warnings:
            warned += 1
        reports.append({
            "index": idx,
            "route": candidate.route,
            "jobType": candidate.job_type,
            "classification": candidate.classification,
            "payloadKeys": keys[:100],
            "status": status,
            "blockers": blockers,
            "warnings": warnings,
        })

    decision = "block" if blocked else "hold" if warned and payload.fail_on_warnings else "pass"
    report = {
        "candidateCount": len(payload.candidates),
        "blockedCandidates": blocked,
        "warningCandidates": warned,
        "decision": decision,
        "rawValuesAllowed": False,
        "requiredInputMode": "payload-key-shape-only",
        "reports": reports,
    }
    artifact = artifact_store.write_json(
        prefix="platform-privacy-preflight",
        artifact_type="platform.privacy_preflight.report",
        payload=report,
        metadata={"rowCount": len(reports), "redactionApplied": True, "piiClass": "payload-shape-metadata-only", "source": "python-privacy-preflight"},
    )
    return _result(job, "platform.privacy_preflight.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["preflight uses payload keys/shapes only; do not send raw payload values"], [artifact])




def _status_text(value: Any, *keys: str) -> str | None:
    if not isinstance(value, dict):
        return None
    for key in keys:
        if key in value and value[key] is not None:
            return str(value[key]).strip().lower()
    return None


def _bool_value(value: Any, key: str) -> bool | None:
    if isinstance(value, dict) and key in value:
        raw = value[key]
        if isinstance(raw, bool):
            return raw
    return None


def process_platform_release_decision(job: JobEnvelope) -> JobResult:
    payload = model_validate(ReleaseDecisionPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    checks: list[dict[str, Any]] = []

    gate_allowed = _bool_value(payload.gate, "allowed")
    gate_recommendation = _status_text(payload.gate, "recommendation", "decision")
    if gate_allowed is False or gate_recommendation == "rollback":
        blockers.append("canary gate is not allowing promotion")
    elif gate_recommendation == "hold" or gate_allowed is None:
        warnings.append("canary gate evidence is missing or recommends hold")
    checks.append({"name": "canaryGate", "status": gate_recommendation or "missing", "passed": gate_allowed is True})

    checklist_status = _status_text(payload.checklist, "overallStatus", "overall_status", "status")
    if checklist_status == "fail":
        blockers.append("release checklist status is fail")
    elif checklist_status in {"warn", "missing", None}:
        warnings.append("release checklist is missing or has warnings")
    checks.append({"name": "releaseChecklist", "status": checklist_status or "missing", "passed": checklist_status == "pass"})

    replay_decision = _status_text(payload.contract_replay, "decision", "status")
    replay_failed = int(payload.contract_replay.get("failed", 0)) if isinstance(payload.contract_replay, dict) else 0
    if replay_decision == "fail" or replay_failed > 0:
        blockers.append("contract replay failed")
    elif replay_decision not in {"pass", "passed"}:
        warnings.append("contract replay evidence is missing or inconclusive")
    checks.append({"name": "contractReplay", "status": replay_decision or "missing", "failed": replay_failed})

    privacy_decision = _status_text(payload.privacy_preflight, "decision", "status")
    blocked_candidates = int(payload.privacy_preflight.get("blockedCandidates", 0)) if isinstance(payload.privacy_preflight, dict) else 0
    if privacy_decision == "block" or blocked_candidates > 0:
        blockers.append("privacy preflight blocked one or more payload shapes")
    elif privacy_decision in {"hold", "warn", None}:
        warnings.append("privacy preflight is missing or not clean")
    checks.append({"name": "privacyPreflight", "status": privacy_decision or "missing", "blockedCandidates": blocked_candidates})

    slo_recommendation = _status_text(payload.slo_regression, "recommendation", "decision")
    if slo_recommendation == "rollback":
        blockers.append("SLO regression evidence recommends rollback")
    elif slo_recommendation in {"hold", None}:
        warnings.append("SLO regression evidence is missing or recommends hold")
    checks.append({"name": "sloRegression", "status": slo_recommendation or "missing"})

    rollout_status = _status_text(payload.rollout, "status")
    current_percent = int(payload.rollout.get("currentPercent", 0)) if isinstance(payload.rollout, dict) else 0
    target_percent = int(payload.rollout.get("targetPercent", payload.target_canary_percent)) if isinstance(payload.rollout, dict) else payload.target_canary_percent
    if target_percent > payload.target_canary_percent:
        warnings.append("rollout target in evidence exceeds requested target canary percent")
    checks.append({"name": "rolloutState", "status": rollout_status or "missing", "currentPercent": current_percent, "targetPercent": target_percent})

    decision = "rollback" if blockers else "hold" if warnings and not payload.allow_warn else "advance"
    next_actions = []
    if decision == "advance":
        next_actions.extend([
            f"Advance canary for {payload.route} toward {payload.target_canary_percent}% using the rollout controller.",
            "Record the generated artifact id in the change ticket before promotion.",
            "Keep HYBRID_PYTHON_ENABLED and route-level rollback switches documented for the release window.",
        ])
    elif decision == "rollback":
        next_actions.extend([
            "Set HYBRID_PYTHON_CANARY_PERCENT=0 for the affected route or execute canary rollback.",
            "Keep Node path authoritative and attach blockers to the release ticket.",
            "Run platform.rollback_drill with the same route/jobTypes before retrying promotion.",
        ])
    else:
        next_actions.extend([
            "Hold canary promotion until warnings are resolved or explicitly accepted.",
            "Re-run contract replay, privacy preflight and SLO regression with fresh evidence.",
        ])

    report = {
        "releaseId": payload.release_id,
        "route": payload.route,
        "jobTypes": payload.job_types,
        "targetCanaryPercent": payload.target_canary_percent,
        "decision": decision,
        "blockers": blockers,
        "warnings": warnings,
        "checks": checks,
        "nextActions": next_actions,
        "nodeOwnsDeployment": True,
        "pythonDecisionIsAdvisory": True,
    }
    artifact = artifact_store.write_json(
        prefix="platform-release-decision",
        artifact_type="platform.release_decision.report",
        payload=report,
        metadata={"rowCount": len(checks), "redactionApplied": True, "piiClass": "release-evidence-metadata-only", "source": "python-release-gate"},
    )
    return _result(job, "platform.release_decision.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["advisory only: CI/operator remains owner of deployment and rollback execution"], [artifact])


def process_platform_rollback_drill(job: JobEnvelope) -> JobResult:
    payload = model_validate(RollbackDrillPayload, job.payload)
    job_types = payload.job_types or ["all-hybrid-python-routes"]
    steps = [
        {"order": 1, "action": "freeze-promotion", "detail": f"Pause canary advancement for {payload.route}."},
        {"order": 2, "action": "route-back-to-node", "detail": "Set route canary to 0 or disable HYBRID_PYTHON_ENABLED for the affected slice."},
        {"order": 3, "action": "verify-node-path", "detail": "Confirm Node/Express endpoint continues to serve production traffic."},
        {"order": 4, "action": "capture-evidence", "detail": "Attach job summary, comparison summary, SLO report and release decision artifact to the ticket."},
        {"order": 5, "action": "post-rollback-monitoring", "detail": "Monitor p95, p99, error rate, queue depth and failed job count for at least one release window."},
    ]
    commands = []
    if payload.include_commands:
        commands = [
            "curl -X POST /api/hybrid-python/canary/rollout/rollback -d {dryRun:false,reason:rollback-drill}",
            "export HYBRID_PYTHON_CANARY_PERCENT=0",
            "export HYBRID_PYTHON_ENABLED=false  # only for full bridge disablement",
        ]
    acceptance_checks = [
        "New requests route to Node path for the selected slice.",
        "No non-dry-run Python jobs remain queued for the selected job types.",
        "SLO regression report no longer recommends rollback.",
        "Evidence bundle was captured after rollback.",
    ]
    if payload.require_evidence_bundle:
        acceptance_checks.append("Release ticket includes /api/hybrid-python/evidence/bundle output.")

    report = {
        "route": payload.route,
        "jobTypes": job_types,
        "trigger": payload.trigger,
        "operators": payload.operators,
        "observedMetricKeys": sorted(payload.observed_metrics.keys()),
        "steps": steps,
        "commands": commands,
        "acceptanceChecks": acceptance_checks,
        "rollbackOwner": "Node/Express and release operator",
        "mutatesState": False,
        "dryRunOnly": True,
    }
    artifact = artifact_store.write_json(
        prefix="platform-rollback-drill",
        artifact_type="platform.rollback_drill.plan",
        payload=report,
        metadata={"rowCount": len(steps), "redactionApplied": True, "piiClass": "rollback-procedure-metadata-only", "source": "python-drill-planner"},
    )
    return _result(job, "platform.rollback_drill.planned", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["dry-run only: Python did not mutate rollout state or deployment settings"], [artifact])


def _status_value(value: Any, *keys: str) -> str | None:
    if not isinstance(value, dict):
        return None
    for key in keys:
        raw = value.get(key)
        if raw is not None:
            return str(raw).strip().lower()
    return None


def _as_bool(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"true", "pass", "passed", "ok", "healthy", "success", "succeeded"}:
            return True
        if lowered in {"false", "fail", "failed", "error", "unhealthy"}:
            return False
    return None


def process_platform_post_deploy_verify(job: JobEnvelope) -> JobResult:
    payload = model_validate(PostDeployVerifyPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    checks: list[dict[str, Any]] = []

    for index, check in enumerate(payload.health_checks):
        name = str(check.get("name") or check.get("service") or f"health-{index}")
        ok = _as_bool(check.get("ok"))
        status_text = str(check.get("status") or ("pass" if ok is True else "fail" if ok is False else "unknown")).lower()
        passed = ok is True or status_text in {"ok", "pass", "passed", "healthy"}
        if not passed:
            blockers.append(f"health check {name} did not pass")
        checks.append({"name": name, "type": "health", "status": status_text, "passed": passed})

    for index, check in enumerate(payload.smoke_checks):
        name = str(check.get("name") or check.get("route") or f"smoke-{index}")
        expected = int(check.get("expectedStatus") or check.get("expectedStatusCode") or 200)
        actual = check.get("statusCode", check.get("actualStatus", check.get("actualStatusCode")))
        explicit_ok = _as_bool(check.get("ok"))
        try:
            actual_int = int(actual) if actual is not None else None
        except Exception:
            actual_int = None
        passed = explicit_ok is True or (actual_int == expected)
        if not passed:
            blockers.append(f"smoke check {name} failed expected status {expected} got {actual_int}")
        checks.append({"name": name, "type": "smoke", "expectedStatus": expected, "actualStatus": actual_int, "passed": passed})

    slo_recommendation = _status_value(payload.slo_regression, "recommendation", "decision")
    if slo_recommendation == "rollback":
        blockers.append("SLO regression recommends rollback after deployment")
    elif slo_recommendation in {"hold", None}:
        warnings.append("SLO regression evidence is missing or recommends hold")
    checks.append({"name": "sloRegression", "type": "gate", "status": slo_recommendation or "missing", "passed": slo_recommendation == "advance"})

    release_decision = _status_value(payload.release_decision, "decision", "recommendation")
    if release_decision == "rollback":
        blockers.append("release decision recommends rollback")
    elif release_decision in {"hold", None}:
        warnings.append("release decision evidence is missing or recommends hold")
    checks.append({"name": "releaseDecision", "type": "gate", "status": release_decision or "missing", "passed": release_decision == "advance"})

    rollout_status = _status_value(payload.rollout, "status") or "missing"
    current_percent = int(payload.rollout.get("currentPercent", 0)) if isinstance(payload.rollout, dict) else 0
    if rollout_status == "rollback":
        blockers.append("rollout state is rollback")
    if current_percent > payload.target_canary_percent:
        warnings.append("rollout current percent is higher than target canary percent in verification payload")
    checks.append({"name": "rolloutState", "type": "state", "status": rollout_status, "currentPercent": current_percent, "targetCanaryPercent": payload.target_canary_percent})

    failed_jobs = int(payload.job_summary.get("failedJobs", payload.job_summary.get("failed", 0))) if isinstance(payload.job_summary, dict) else 0
    if failed_jobs:
        blockers.append(f"job summary reports {failed_jobs} failed Python jobs")
    checks.append({"name": "jobSummary", "type": "state", "failedJobs": failed_jobs, "passed": failed_jobs == 0})

    mismatch_rate = float(payload.comparison_summary.get("mismatchRate", 0.0)) if isinstance(payload.comparison_summary, dict) else 0.0
    if mismatch_rate > 0.05:
        blockers.append(f"shadow comparison mismatch rate {mismatch_rate:.4f} exceeds 0.05")
    checks.append({"name": "shadowComparisons", "type": "state", "mismatchRate": mismatch_rate, "passed": mismatch_rate <= 0.05})

    privacy_decision = _status_value(payload.privacy_preflight, "decision", "status")
    blocked_candidates = int(payload.privacy_preflight.get("blockedCandidates", 0)) if isinstance(payload.privacy_preflight, dict) else 0
    if payload.require_clean_privacy and (privacy_decision == "block" or blocked_candidates > 0):
        blockers.append("privacy preflight is not clean after deployment")
    elif privacy_decision in {"hold", "warn", None}:
        warnings.append("privacy preflight evidence is missing or not clean")
    checks.append({"name": "privacyPreflight", "type": "gate", "status": privacy_decision or "missing", "blockedCandidates": blocked_candidates})

    decision = "rollback" if blockers else "hold" if warnings else "pass"
    next_actions = []
    if decision == "pass":
        next_actions = [
            "Attach this post-deploy verification artifact to the release ticket.",
            "Continue monitoring p95, p99, error rate, failed jobs and comparison mismatch rate for the release window.",
        ]
    elif decision == "rollback":
        next_actions = [
            "Rollback the affected canary route to 0 and keep Node authoritative.",
            "Capture fresh evidence bundle and run platform.rollback_drill before retrying promotion.",
        ]
    else:
        next_actions = [
            "Hold further canary advancement until missing or warning evidence is remediated.",
            "Re-run SLO regression, privacy preflight and smoke checks with fresh post-deploy evidence.",
        ]

    report = {
        "releaseId": payload.release_id,
        "route": payload.route,
        "jobTypes": payload.job_types,
        "targetCanaryPercent": payload.target_canary_percent,
        "decision": decision,
        "blockers": blockers,
        "warnings": warnings,
        "checks": checks,
        "nextActions": next_actions,
        "nodeOwnsRollback": True,
        "pythonVerificationIsAdvisory": True,
    }
    artifact = artifact_store.write_json(
        prefix="platform-post-deploy-verify",
        artifact_type="platform.post_deploy_verify.report",
        payload=report,
        metadata={"rowCount": len(checks), "redactionApplied": True, "piiClass": "post-deploy-evidence-metadata-only", "source": "python-post-deploy-verifier"},
    )
    return _result(job, "platform.post_deploy_verify.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["advisory only: Python does not execute deployment or rollback"], [artifact])


def process_platform_change_ticket_bundle(job: JobEnvelope) -> JobResult:
    payload = model_validate(ChangeTicketBundlePayload, job.payload)
    sections = []
    missing: list[str] = []

    def add_section(name: str, value: dict[str, Any], required: bool = True) -> None:
        present = bool(value)
        if required and not present:
            missing.append(name)
        status = _status_value(value, "decision", "recommendation", "overallStatus", "status") or ("present" if present else "missing")
        sections.append({"name": name, "present": present, "status": status, "keys": sorted(value.keys())[:40] if isinstance(value, dict) else []})

    add_section("evidenceBundle", payload.evidence_bundle)
    add_section("releaseDecision", payload.release_decision)
    add_section("rollbackDrill", payload.rollback_drill)
    add_section("contractReplay", payload.contract_replay)
    add_section("privacyPreflight", payload.privacy_preflight)
    add_section("sloRegression", payload.slo_regression)

    artifact_refs = []
    for ref in payload.artifact_refs[:50]:
        artifact_refs.append({
            "artifactId": ref.get("artifactId") or ref.get("artifact_id"),
            "artifactType": ref.get("artifactType") or ref.get("artifact_type"),
            "sha256": ref.get("sha256"),
            "redactionApplied": bool(ref.get("redactionApplied", True)),
        })

    approvals = []
    for approval in payload.approvals[:25]:
        approvals.append({
            "role": approval.get("role"),
            "status": str(approval.get("status") or "pending").lower(),
            "approvedAt": approval.get("approvedAt"),
        })

    approval_statuses = {str(item.get("status") or "pending").lower() for item in approvals}
    if "rejected" in approval_statuses:
        missing.append("approvals")
    if not approvals:
        missing.append("approvals")

    completeness = round(100 * (len(sections) - len([item for item in sections if not item["present"]])) / max(1, len(sections)), 2)
    ticket_status = "incomplete" if missing else "ready_for_review"
    runbook = []
    if payload.include_runbook:
        runbook = [
            "Confirm Node/Express remains owner of auth, RBAC/ABAC, Prisma, deployment and rollback.",
            "Attach contract replay, privacy preflight, SLO regression, release decision and post-deploy verification artifacts.",
            "Record route, canary percent, rollback command and monitoring window in the change ticket.",
            "Do not promote if any artifact decision is rollback/block/fail.",
        ]

    report = {
        "changeId": payload.change_id,
        "releaseId": payload.release_id,
        "route": payload.route,
        "jobTypes": payload.job_types,
        "ticketStatus": ticket_status,
        "missingEvidence": sorted(set(missing)),
        "evidenceCompletenessPercent": completeness,
        "sections": sections,
        "artifactRefs": artifact_refs,
        "approvals": approvals,
        "runbook": runbook,
        "nodeOwnsTicketWorkflow": True,
        "pythonBundleIsAdvisory": True,
    }
    artifact = artifact_store.write_json(
        prefix="platform-change-ticket-bundle",
        artifact_type="platform.change_ticket_bundle.report",
        payload=report,
        metadata={"rowCount": len(sections), "redactionApplied": True, "piiClass": "change-ticket-evidence-metadata-only", "source": "python-change-ticket-bundler"},
    )
    return _result(job, "platform.change_ticket_bundle.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["ticket bundle is metadata-only; external ticket creation and approvals remain operator-owned"], [artifact])


def process_platform_operational_handoff(job: JobEnvelope) -> JobResult:
    payload = model_validate(OperationalHandoffPayload, job.payload)
    missing: list[str] = []

    def normalized_items(items: list[dict[str, Any]], *, label: str, required: bool = True, limit: int = 50) -> list[dict[str, Any]]:
        if required and not items:
            missing.append(label)
        result: list[dict[str, Any]] = []
        for index, item in enumerate(items[:limit]):
            result.append({
                "name": item.get("name") or item.get("title") or item.get("role") or f"{label}-{index + 1}",
                "role": item.get("role"),
                "status": str(item.get("status") or item.get("state") or "provided").lower(),
                "url": item.get("url") or item.get("href"),
                "notes": item.get("notes") or item.get("description"),
            })
        return result

    owners = normalized_items(payload.owner_contacts, label="ownerContacts")
    dashboards = normalized_items(payload.dashboard_links, label="dashboardLinks")
    alerts = normalized_items(payload.alert_policies, label="alertPolicies")
    runbooks = normalized_items(payload.runbook_links, label="runbookLinks")
    risks = normalized_items(payload.known_risks, label="knownRisks", required=False)
    support_windows = normalized_items(payload.support_windows, label="supportWindows", required=False)

    artifact_refs = [
        {
            "artifactId": ref.get("artifactId") or ref.get("artifact_id"),
            "artifactType": ref.get("artifactType") or ref.get("artifact_type"),
            "sha256": ref.get("sha256"),
            "redactionApplied": bool(ref.get("redactionApplied", True)),
        }
        for ref in payload.artifact_refs[:50]
    ]
    if not artifact_refs:
        missing.append("artifactRefs")

    quickstart = []
    if payload.include_quickstart:
        quickstart = [
            "Check /api/hybrid-python/status and /api/hybrid-python/release/checklist before promotion.",
            "Use /api/hybrid-python/canary/gate and SLO regression artifacts to decide hold/advance/rollback.",
            "For rollback, set route canary to 0; keep Node/Express path authoritative.",
            "Attach evidence bundle, post-deploy verification and change-ticket bundle to the release ticket.",
        ]

    completeness_sections = [owners, dashboards, alerts, runbooks, artifact_refs]
    completeness = round(100 * sum(1 for section in completeness_sections if section) / len(completeness_sections), 2)
    handoff_status = "ready_for_handoff" if not missing else "incomplete"
    report = {
        "releaseId": payload.release_id,
        "route": payload.route,
        "jobTypes": payload.job_types,
        "handoffStatus": handoff_status,
        "missingSections": sorted(set(missing)),
        "handoffCompletenessPercent": completeness,
        "ownerContacts": owners,
        "dashboardLinks": dashboards,
        "alertPolicies": alerts,
        "runbookLinks": runbooks,
        "knownRisks": risks,
        "supportWindows": support_windows,
        "artifactRefs": artifact_refs,
        "quickstart": quickstart,
        "nodeOwnsOperationsExecution": True,
        "pythonHandoffIsAdvisory": True,
    }
    artifact = artifact_store.write_json(
        prefix="platform-operational-handoff",
        artifact_type="platform.operational_handoff.pack",
        payload=report,
        metadata={"rowCount": len(owners) + len(dashboards) + len(alerts) + len(runbooks), "redactionApplied": True, "piiClass": "operational-handoff-metadata-only", "source": "python-operational-handoff"},
    )
    return _result(job, "platform.operational_handoff.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["handoff pack is advisory; operators and Node/CI remain owners of execution"], [artifact])


def process_platform_incident_simulation(job: JobEnvelope) -> JobResult:
    payload = model_validate(IncidentSimulationPayload, job.payload)
    scenario = payload.scenario
    metrics = payload.observed_metrics or {}
    blockers: list[str] = []
    warnings: list[str] = []

    gate_recommendation = _status_value(payload.gate, "recommendation", "decision")
    slo_recommendation = _status_value(payload.slo, "recommendation", "decision")
    privacy_decision = _status_value(payload.privacy, "decision", "status")
    rollout_status = _status_value(payload.rollout, "status", "state")

    if scenario in {"python_down", "privacy_block", "artifact_leak_signal"}:
        blockers.append(f"scenario requires rollback/hold: {scenario}")
    if gate_recommendation == "rollback" or slo_recommendation == "rollback":
        blockers.append("gate or SLO evidence recommends rollback")
    if privacy_decision in {"block", "fail", "failed", "rollback"}:
        blockers.append("privacy evidence blocks promotion")
    if scenario == "queue_backlog" and float(metrics.get("queueDepth", metrics.get("queue_depth", 0)) or 0) > 100:
        warnings.append("queue depth exceeds drill threshold")
    if rollout_status in {"paused", "rollback", "rolled_back"}:
        warnings.append(f"rollout status is {rollout_status}")

    severity = "sev2" if blockers else "sev3" if warnings or scenario in {"latency_regression", "shadow_mismatch", "queue_backlog"} else "sev4"
    recommendation = "rollback" if blockers else "hold" if warnings or scenario in {"latency_regression", "shadow_mismatch", "queue_backlog"} else "monitor"

    response_steps = [
        {"order": 1, "action": "declare-incident", "detail": f"Open incident for {scenario} on {payload.route} with severity {severity}."},
        {"order": 2, "action": "freeze-canary", "detail": "Pause canary advancement and stop promoting additional subjects."},
        {"order": 3, "action": "collect-evidence", "detail": "Capture status, metrics, SLO report, privacy preflight, gate and evidence bundle."},
        {"order": 4, "action": "route-decision", "detail": "Rollback to Node path if recommendation is rollback; otherwise hold and monitor."},
        {"order": 5, "action": "post-incident-review", "detail": "Document root cause, corrective action and contract/update needed before resuming canary."},
    ]
    commands = []
    if payload.include_commands:
        commands = [
            "curl /api/hybrid-python/status",
            "curl /api/hybrid-python/canary/gate?minComparisons=0",
            "curl -X POST /api/hybrid-python/canary/rollout/pause -d {dryRun:false,reason:incident-drill}",
            "curl -X POST /api/hybrid-python/canary/rollout/rollback -d {dryRun:false,reason:incident-drill}  # if rollback recommended",
        ]

    report = {
        "scenario": scenario,
        "route": payload.route,
        "jobTypes": payload.job_types,
        "severity": severity,
        "recommendation": recommendation,
        "blockers": blockers,
        "warnings": warnings,
        "operators": payload.operators,
        "observedMetricKeys": sorted(metrics.keys()),
        "responseSteps": response_steps,
        "commands": commands,
        "acceptanceChecks": [
            "Canary promotion is paused or rolled back according to the drill recommendation.",
            "Node/Express path remains available for the affected slice.",
            "Evidence bundle and incident timeline are attached to the ticket.",
            "Canary is not resumed until contract replay, privacy preflight and SLO regression are clean.",
        ],
        "mutatesState": False,
        "dryRunOnly": True,
    }
    artifact = artifact_store.write_json(
        prefix="platform-incident-simulation",
        artifact_type="platform.incident_simulation.report",
        payload=report,
        metadata={"rowCount": len(response_steps), "redactionApplied": True, "piiClass": "incident-drill-metadata-only", "source": "python-incident-simulator"},
    )
    return _result(job, "platform.incident_simulation.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["incident simulation is dry-run only; Python did not mutate rollout state or notify operators"], [artifact])


def _normalized_signal_text(value: Any) -> str:
    return " ".join(str(value or "").lower().replace("_", "-").split())


def process_platform_capacity_plan(job: JobEnvelope) -> JobResult:
    payload = model_validate(CapacityPlanPayload, job.payload)
    rpm = float(payload.expected_requests_per_minute or 0)
    avg_ms = max(1.0, float(payload.average_duration_ms or 1))
    p95_ms = max(avg_ms, float(payload.p95_duration_ms or avg_ms))
    concurrency_per_worker = max(1, int(payload.worker_concurrency))
    current_slots = max(0, int(payload.current_worker_count)) * concurrency_per_worker
    target_utilization = max(0.1, min(float(payload.target_utilization), 0.95))
    # Approximate Little's Law for the worker pool. This is advisory only; real sizing must be checked with staging data.
    required_concurrency = (rpm * (avg_ms / 1000.0) / 60.0) / target_utilization if rpm else 0.0
    p95_concurrency = (rpm * (p95_ms / 1000.0) / 60.0) / target_utilization if rpm else 0.0
    recommended_workers = max(1 if rpm > 0 else 0, int((p95_concurrency + concurrency_per_worker - 1) // concurrency_per_worker))
    backlog_minutes = (payload.queue_depth / rpm) if rpm > 0 else (0 if payload.queue_depth == 0 else None)
    blockers: list[str] = []
    warnings: list[str] = []
    if current_slots < required_concurrency:
        blockers.append("current worker slots are below estimated average concurrency demand")
    if recommended_workers > payload.current_worker_count:
        warnings.append("recommended worker count exceeds current worker count")
    if payload.observed_error_rate > 0.01:
        blockers.append("observed error rate exceeds 1% capacity gate")
    if payload.backlog_growth_per_minute > 0:
        warnings.append("queue backlog is growing; hold canary until stable")
    if backlog_minutes is not None and backlog_minutes * 60 > payload.max_queue_wait_seconds:
        blockers.append("estimated queue drain time exceeds maxQueueWaitSeconds")
    unhealthy_dependencies = [item for item in payload.dependencies if str(item.get("status", item.get("state", "ok"))).lower() not in {"ok", "healthy", "pass", "green"}]
    if unhealthy_dependencies:
        blockers.append("one or more dependencies are not healthy")

    recommendation = "rollback" if any("error rate" in item or "dependencies" in item for item in blockers) else "hold" if blockers or warnings else "advance"
    report = {
        "releaseId": payload.release_id,
        "route": payload.route,
        "jobTypes": payload.job_types,
        "targetCanaryPercent": payload.target_canary_percent,
        "input": {
            "expectedRequestsPerMinute": rpm,
            "averageDurationMs": avg_ms,
            "p95DurationMs": p95_ms,
            "queueDepth": payload.queue_depth,
            "currentWorkerCount": payload.current_worker_count,
            "workerConcurrency": concurrency_per_worker,
            "targetUtilization": target_utilization,
            "observedErrorRate": payload.observed_error_rate,
            "backlogGrowthPerMinute": payload.backlog_growth_per_minute,
        },
        "estimates": {
            "currentWorkerSlots": current_slots,
            "requiredAverageConcurrency": round(required_concurrency, 3),
            "requiredP95Concurrency": round(p95_concurrency, 3),
            "recommendedWorkerCount": recommended_workers,
            "estimatedBacklogDrainMinutes": None if backlog_minutes is None else round(backlog_minutes, 3),
        },
        "recommendation": recommendation,
        "blockers": blockers,
        "warnings": warnings,
        "unhealthyDependencies": unhealthy_dependencies,
        "nextActions": [
            "Validate recommended worker count with staging load before increasing canary.",
            "Keep Node/Express route as rollback path while Python worker capacity is tuned.",
            "Attach capacity plan to change ticket/evidence bundle before promotion.",
        ],
        "nodeOwnsInfraChange": True,
        "pythonCapacityPlanIsAdvisory": True,
    }
    artifact = artifact_store.write_json(
        prefix="platform-capacity-plan",
        artifact_type="platform.capacity_plan.report",
        payload=report,
        metadata={"rowCount": len(payload.dependencies), "redactionApplied": True, "piiClass": "operational-capacity-metadata-only", "source": "python-capacity-plan"},
    )
    return _result(job, "platform.capacity_plan.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["capacity plan is advisory; CI/operators own deployment and worker scaling"], [artifact])


def process_platform_alert_policy_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(AlertPolicyReviewPayload, job.payload)
    default_required = [
        "python-down",
        "error-rate",
        "latency-p95",
        "queue-backlog",
        "shadow-mismatch",
        "privacy-block",
        "artifact-leak",
    ]
    required = payload.required_signals or default_required
    policies = payload.alert_policies[:100]
    dashboards = payload.dashboard_links[:50]
    coverage: dict[str, bool] = {}
    policy_blob = "\n".join(_normalized_signal_text(item.get("name", "")) + " " + _normalized_signal_text(item.get("signal", "")) + " " + _normalized_signal_text(item.get("query", "")) for item in policies)
    aliases = {
        "python-down": ["python-down", "readyz", "service-down", "python worker down", "python-worker-down"],
        "error-rate": ["error-rate", "5xx", "failed-jobs", "failure-rate"],
        "latency-p95": ["latency-p95", "p95", "http-request", "duration"],
        "queue-backlog": ["queue-backlog", "queue depth", "queue-depth", "backlog"],
        "shadow-mismatch": ["shadow-mismatch", "comparison", "mismatch"],
        "privacy-block": ["privacy-block", "privacy preflight", "blocked-candidates"],
        "artifact-leak": ["artifact-leak", "artifact", "redaction", "leak"],
    }
    for signal in required:
        candidates = aliases.get(signal, [signal])
        coverage[signal] = any(_normalized_signal_text(candidate) in policy_blob for candidate in candidates)
    missing = sorted(signal for signal, ok in coverage.items() if not ok)
    active_count = sum(1 for item in policies if str(item.get("status", "active")).lower() in {"active", "enabled", "ok"})
    on_call_present = any(str(item.get("onCall", item.get("owner", ""))).strip() for item in policies) or any(str(item.get("onCall", item.get("owner", ""))).strip() for item in dashboards)
    blockers: list[str] = []
    warnings: list[str] = []
    if len(policies) < payload.min_policy_count:
        blockers.append("not enough alert policies supplied for review")
    if missing:
        blockers.append("required alert signals are missing")
    if payload.require_on_call and not on_call_present:
        warnings.append("no on-call owner found in alert or dashboard metadata")
    if active_count < len(policies):
        warnings.append("one or more alert policies are not active")
    decision = "pass" if not blockers else "hold"
    report = {
        "releaseId": payload.release_id,
        "route": payload.route,
        "jobTypes": payload.job_types,
        "decision": decision,
        "policyCount": len(policies),
        "activePolicyCount": active_count,
        "dashboardCount": len(dashboards),
        "coverage": coverage,
        "missingSignals": missing,
        "blockers": blockers,
        "warnings": warnings,
        "onCallPresent": on_call_present,
        "nextActions": [
            "Add missing alert policies before production canary promotion.",
            "Link alert review artifact in the operational handoff and change ticket bundle.",
            "Keep Python alert review advisory; monitor creation remains observability-platform owned.",
        ],
        "nodeOwnsAlertRouting": True,
        "pythonAlertReviewIsAdvisory": True,
    }
    artifact = artifact_store.write_json(
        prefix="platform-alert-policy-review",
        artifact_type="platform.alert_policy_review.report",
        payload=report,
        metadata={"rowCount": len(policies), "redactionApplied": True, "piiClass": "operational-alert-policy-metadata-only", "source": "python-alert-policy-review"},
    )
    return _result(job, "platform.alert_policy_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["alert policy review is advisory; Python did not create monitors or page operators"], [artifact])



def _dependency_status_ok(value: Any) -> bool:
    return str(value or "unknown").strip().lower() in {"ok", "healthy", "pass", "passing", "green", "ready", "available"}


def _dependency_name(value: Any) -> str:
    return str(value or "").strip().lower().replace("_", "-")


def process_platform_dependency_readiness(job: JobEnvelope) -> JobResult:
    payload = model_validate(DependencyReadinessPayload, job.payload)
    default_required = ["python-worker", "node-api", "redis", "artifact-store"]
    required = [_dependency_name(item) for item in (payload.required_dependencies or default_required) if _dependency_name(item)]
    dependencies = payload.dependencies[:100]
    by_name = {_dependency_name(item.get("name")): item for item in dependencies if _dependency_name(item.get("name"))}

    missing = [name for name in required if name not in by_name]
    unhealthy: list[dict[str, Any]] = []
    healthy: list[dict[str, Any]] = []
    critical_unhealthy: list[dict[str, Any]] = []
    for name, item in sorted(by_name.items()):
        status_value = item.get("status", item.get("state", "unknown"))
        normalized = {
            "name": name,
            "status": str(status_value or "unknown"),
            "critical": bool(item.get("critical", name in required)),
            "latencyMs": item.get("latencyMs", item.get("latency_ms")),
            "errorRate": item.get("errorRate", item.get("error_rate")),
            "detail": item.get("detail"),
        }
        if _dependency_status_ok(status_value):
            healthy.append(normalized)
        else:
            unhealthy.append(normalized)
            if normalized["critical"]:
                critical_unhealthy.append(normalized)

    observed_count = max(1, len(by_name))
    healthy_percent = len(healthy) / observed_count
    blockers: list[str] = []
    warnings: list[str] = []
    if missing:
        blockers.append("required dependencies are missing from readiness evidence")
    if critical_unhealthy:
        blockers.append("one or more critical dependencies are unhealthy")
    if healthy_percent < payload.min_healthy_percent:
        blockers.append("healthy dependency percentage is below minHealthyPercent")
    if unhealthy and not critical_unhealthy:
        warnings.append("non-critical dependencies are degraded")

    decision = "rollback" if payload.fail_on_critical and critical_unhealthy else "hold" if blockers or warnings else "pass"
    report = {
        "releaseId": payload.release_id,
        "route": payload.route,
        "jobTypes": payload.job_types,
        "decision": decision,
        "requiredDependencies": required,
        "observedDependencyCount": len(by_name),
        "healthyDependencyCount": len(healthy),
        "healthyPercent": round(healthy_percent, 4),
        "minHealthyPercent": payload.min_healthy_percent,
        "missingDependencies": missing,
        "unhealthyDependencies": unhealthy,
        "criticalUnhealthyDependencies": critical_unhealthy,
        "blockers": blockers,
        "warnings": warnings,
        "nextActions": [
            "Keep Node/Express route as fallback until required dependencies are healthy.",
            "Attach dependency readiness output to the release evidence bundle.",
            "Operators own dependency remediation; Python performs advisory evaluation only.",
        ],
        "nodeOwnsDependencyRemediation": True,
        "pythonDependencyCheckIsAdvisory": True,
    }
    artifact = artifact_store.write_json(
        prefix="platform-dependency-readiness",
        artifact_type="platform.dependency_readiness.report",
        payload=report,
        metadata={"rowCount": len(dependencies), "redactionApplied": True, "piiClass": "operational-dependency-metadata-only", "source": "python-dependency-readiness"},
    )
    return _result(job, "platform.dependency_readiness.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["dependency readiness is advisory; Python did not call dependencies or mutate infrastructure"], [artifact])


def _status_from_evidence(section: Any) -> str | None:
    if not isinstance(section, dict):
        return None
    for key in ("decision", "recommendation", "status", "overallStatus", "overall_status", "result"):
        value = section.get(key)
        if value is not None:
            return str(value).strip().lower().replace(" ", "_")
    return None


def process_platform_production_readiness(job: JobEnvelope) -> JobResult:
    payload = model_validate(ProductionReadinessPayload, job.payload)
    evidence = payload.evidence or {}
    required = [str(item) for item in payload.required_evidence if str(item).strip()]
    missing = [name for name in required if not evidence.get(name)]
    blockers: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    section_statuses: dict[str, str | None] = {}

    rollback_statuses = {"rollback", "failed", "fail", "blocked", "error", "critical"}
    hold_statuses = {"hold", "warning", "warn", "incomplete", "pending", "degraded"}
    pass_statuses = {"advance", "pass", "passed", "ready", "ready_for_review", "ready_for_handoff", "ok"}

    for name, section in sorted(evidence.items()):
        status = _status_from_evidence(section)
        section_statuses[name] = status
        if status in rollback_statuses:
            blockers.append({"section": name, "status": status, "reason": "rollback/failure status in evidence"})
        elif status in hold_statuses:
            warnings.append({"section": name, "status": status, "reason": "hold/warning status in evidence"})
        elif status and status not in pass_statuses:
            warnings.append({"section": name, "status": status, "reason": "unknown evidence status; operator review required"})

    if missing:
        warnings.append({"section": "requiredEvidence", "status": "missing", "reason": ", ".join(missing)})
    privacy = evidence.get("privacyPreflight") or {}
    if isinstance(privacy, dict) and int(privacy.get("blockedCandidates") or 0) > 0:
        blockers.append({"section": "privacyPreflight", "status": "blocked", "reason": "blockedCandidates > 0"})
    contract = evidence.get("contractReplay") or {}
    if isinstance(contract, dict) and int(contract.get("failed") or 0) > 0:
        blockers.append({"section": "contractReplay", "status": "failed", "reason": "failed replay vectors > 0"})

    decision = "rollback" if blockers else "hold" if (missing or warnings) and not payload.allow_warnings else "advance"
    report = {
        "releaseId": payload.release_id,
        "route": payload.route,
        "jobTypes": payload.job_types,
        "targetCanaryPercent": payload.target_canary_percent,
        "decision": decision,
        "requiredEvidence": required,
        "missingEvidence": missing,
        "sectionStatuses": section_statuses,
        "blockers": blockers,
        "warnings": warnings,
        "artifactRefs": payload.artifact_refs[:100],
        "acceptanceChecks": [
            "All required evidence sections are present and sanitized.",
            "Contract replay, privacy preflight, SLO, capacity, alert and dependency gates are clean before canary increase.",
            "Rollback drill and Node fallback remain available for the target route.",
        ],
        "nodeOwnsTrafficPromotion": True,
        "pythonProductionReadinessIsAdvisory": True,
    }
    artifact = artifact_store.write_json(
        prefix="platform-production-readiness",
        artifact_type="platform.production_readiness.report",
        payload=report,
        metadata={"rowCount": len(evidence), "redactionApplied": True, "piiClass": "production-readiness-evidence-metadata-only", "source": "python-production-readiness"},
    )
    return _result(job, "platform.production_readiness.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["production readiness is advisory; Node/CI/operators own promotion and rollback"], [artifact])



def _boolish(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in {"1", "true", "yes", "y", "ok", "pass", "passed", "enabled", "active"}


def _intish(value: Any, default: int = 0) -> int:
    try:
        return int(float(str(value)))
    except (TypeError, ValueError):
        return default


def process_platform_data_retention_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(DataRetentionReviewPayload, job.payload)
    blockers: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    policies = payload.retention_policies

    if payload.require_explicit_ttl and not policies:
        blockers.append({"section": "retentionPolicies", "reason": "no retention policies supplied"})

    normalized_policies: list[dict[str, Any]] = []
    for index, policy in enumerate(policies):
        name = str(policy.get("name") or policy.get("artifactType") or f"policy-{index}")
        ttl = _intish(policy.get("ttlSeconds") or policy.get("ttl_seconds"), -1)
        redaction_required = _boolish(policy.get("redactionRequired", True))
        gc_enabled = _boolish(policy.get("gcEnabled", policy.get("gc_enabled", True)))
        normalized = {
            "name": name,
            "artifactType": policy.get("artifactType") or policy.get("artifact_type") or "*",
            "ttlSeconds": ttl if ttl >= 0 else None,
            "redactionRequired": redaction_required,
            "gcEnabled": gc_enabled,
        }
        normalized_policies.append(normalized)
        if payload.require_explicit_ttl and ttl < 0:
            blockers.append({"section": "retentionPolicies", "policy": name, "reason": "ttlSeconds missing"})
        if ttl > payload.max_artifact_ttl_seconds:
            blockers.append({"section": "retentionPolicies", "policy": name, "reason": "ttlSeconds exceeds maxArtifactTtlSeconds", "ttlSeconds": ttl})
        if payload.require_redaction and not redaction_required:
            blockers.append({"section": "retentionPolicies", "policy": name, "reason": "redaction is not required"})
        if not gc_enabled:
            warnings.append({"section": "retentionPolicies", "policy": name, "reason": "GC disabled for policy"})

    artifact_summary = payload.artifact_summary or {}
    total_artifacts = _intish(artifact_summary.get("totalArtifacts") or artifact_summary.get("total") or artifact_summary.get("count"), 0)
    unredacted = _intish(artifact_summary.get("unredactedArtifacts") or artifact_summary.get("redactionMissing") or artifact_summary.get("unredacted"), 0)
    expired = _intish(artifact_summary.get("expiredArtifacts") or payload.gc_summary.get("expiredArtifacts"), 0)
    max_observed_ttl = _intish(artifact_summary.get("maxTtlSeconds") or artifact_summary.get("max_ttl_seconds"), 0)
    high_risk = _intish(artifact_summary.get("highRiskArtifacts") or artifact_summary.get("highRiskPiiArtifacts"), 0)
    gc_dry_run = _boolish(payload.gc_summary.get("dryRun", True)) if payload.gc_summary else True

    if payload.require_redaction and unredacted > 0:
        blockers.append({"section": "artifactSummary", "reason": "unredacted artifacts detected", "count": unredacted})
    if high_risk > 0:
        blockers.append({"section": "artifactSummary", "reason": "high-risk artifact classification detected", "count": high_risk})
    if max_observed_ttl > payload.max_artifact_ttl_seconds:
        blockers.append({"section": "artifactSummary", "reason": "observed artifact TTL exceeds maxArtifactTtlSeconds", "maxObservedTtlSeconds": max_observed_ttl})
    if expired > 0 and gc_dry_run:
        warnings.append({"section": "gcSummary", "reason": "expired artifacts exist but GC was dry-run", "expiredArtifacts": expired})

    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {
        "releaseId": payload.release_id,
        "route": payload.route,
        "jobTypes": payload.job_types,
        "decision": decision,
        "policyCount": len(normalized_policies),
        "artifactCount": total_artifacts,
        "maxArtifactTtlSeconds": payload.max_artifact_ttl_seconds,
        "requireExplicitTtl": payload.require_explicit_ttl,
        "requireRedaction": payload.require_redaction,
        "normalizedPolicies": normalized_policies[:100],
        "artifactSummary": artifact_summary,
        "jobSummary": payload.job_summary,
        "gcSummary": payload.gc_summary,
        "blockers": blockers,
        "warnings": warnings,
        "acceptanceChecks": [
            "Every artifact class has an explicit TTL at or below the approved maximum.",
            "Redaction is required for artifacts generated by Python workers.",
            "Expired artifact cleanup remains operator-owned and validated by dry-run evidence before deletion.",
        ],
        "nodeOwnsRetentionSettings": True,
        "pythonRetentionReviewIsAdvisory": True,
    }
    artifact = artifact_store.write_json(
        prefix="platform-data-retention-review",
        artifact_type="platform.data_retention_review.report",
        payload=report,
        metadata={"rowCount": len(normalized_policies), "redactionApplied": True, "piiClass": "retention-policy-metadata-only", "source": "python-data-retention-review"},
    )
    return _result(job, "platform.data_retention_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["data retention review is advisory; Python did not delete artifacts or mutate policies"], [artifact])


def process_platform_audit_trail_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(AuditTrailReviewPayload, job.payload)
    required = [field for field in payload.required_event_fields if field]
    events = payload.audit_events
    missing_by_event: list[dict[str, Any]] = []
    mutation_without_dry_run: list[dict[str, Any]] = []
    event_type_counts: dict[str, int] = {}

    for index, event in enumerate(events):
        event_type = str(event.get("eventType") or event.get("type") or event.get("action") or "unknown")
        event_type_counts[event_type] = event_type_counts.get(event_type, 0) + 1
        missing = [field for field in required if not event.get(field)]
        if missing:
            missing_by_event.append({"index": index, "eventType": event_type, "missingFields": missing})
        lower_type = event_type.lower()
        mutation_like = any(token in lower_type for token in ("advance", "rollback", "pause", "resume", "plan", "cancel", "delete", "gc", "artifact.download"))
        if payload.require_mutation_dry_run and mutation_like and not _boolish(event.get("dryRun")) and not event.get("approvalId"):
            mutation_without_dry_run.append({"index": index, "eventType": event_type, "reason": "mutation-like event missing dryRun=true or approvalId"})

    blockers: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    if not events:
        blockers.append({"section": "auditEvents", "reason": "no audit events supplied"})
    if missing_by_event:
        blockers.append({"section": "auditEvents", "reason": "required audit fields missing", "events": missing_by_event[:25]})
    if mutation_without_dry_run:
        warnings.append({"section": "auditEvents", "reason": "mutation-like events need dryRun evidence or approvalId", "events": mutation_without_dry_run[:25]})

    evidence_status = _status_from_evidence(payload.evidence)
    if evidence_status in {"failed", "fail", "blocked", "rollback", "critical"}:
        blockers.append({"section": "evidence", "reason": "audit evidence indicates failure", "status": evidence_status})
    elif evidence_status in {"hold", "warning", "warn", "pending", "incomplete"}:
        warnings.append({"section": "evidence", "reason": "audit evidence requires operator review", "status": evidence_status})

    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {
        "releaseId": payload.release_id,
        "route": payload.route,
        "jobTypes": payload.job_types,
        "decision": decision,
        "eventCount": len(events),
        "eventTypeCounts": event_type_counts,
        "requiredEventFields": required,
        "missingByEvent": missing_by_event[:100],
        "mutationWithoutDryRun": mutation_without_dry_run[:100],
        "evidenceStatus": evidence_status,
        "blockers": blockers,
        "warnings": warnings,
        "acceptanceChecks": [
            "Release-affecting events have actor, correlation ID, route and timestamp metadata.",
            "Mutation-like events provide dry-run evidence or explicit operator approval identifiers.",
            "Node/audit pipeline remains the owner of durable audit writes.",
        ],
        "nodeOwnsAuditWrites": True,
        "pythonAuditReviewIsAdvisory": True,
    }
    artifact = artifact_store.write_json(
        prefix="platform-audit-trail-review",
        artifact_type="platform.audit_trail_review.report",
        payload=report,
        metadata={"rowCount": len(events), "redactionApplied": True, "piiClass": "audit-trail-metadata-only", "source": "python-audit-trail-review"},
    )
    return _result(job, "platform.audit_trail_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["audit trail review is advisory; Python did not write audit logs or mutate rollout state"], [artifact])


def _severity(value: Any) -> str:
    return str(value or "unknown").strip().lower().replace("_", "-")


def _control_enabled(controls: dict[str, Any], key: str) -> bool:
    candidates = {key, key[0].lower() + key[1:], key.lower(), key.replace("-", "_"), key.replace("_", "-")}
    for candidate in candidates:
        if candidate in controls:
            return _boolish(controls.get(candidate))
    return False


def process_platform_security_posture_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(SecurityPostureReviewPayload, job.payload)
    controls = payload.controls or {}
    required_controls = [str(item) for item in payload.required_controls if str(item).strip()]
    missing_controls = [name for name in required_controls if not _control_enabled(controls, name)]
    findings = payload.findings[:1000]
    severity_counts: dict[str, int] = {}
    high_or_critical: list[dict[str, Any]] = []
    for item in findings:
        severity = _severity(item.get("severity", item.get("level", item.get("risk"))))
        severity_counts[severity] = severity_counts.get(severity, 0) + 1
        if severity in {"high", "critical", "crit", "blocker"}:
            high_or_critical.append({
                "id": item.get("id") or item.get("ruleId") or item.get("control") or "finding",
                "severity": severity,
                "component": item.get("component") or item.get("area") or item.get("path"),
                "status": item.get("status", "open"),
            })
    critical_count = severity_counts.get("critical", 0) + severity_counts.get("crit", 0) + severity_counts.get("blocker", 0)
    high_count = severity_counts.get("high", 0)
    blockers: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    if missing_controls:
        blockers.append({"section": "controls", "reason": "required security controls missing or disabled", "missingControls": missing_controls})
    if critical_count > payload.max_critical_findings:
        blockers.append({"section": "findings", "reason": "critical findings exceed threshold", "criticalFindings": critical_count})
    if high_count > payload.max_high_findings:
        warnings.append({"section": "findings", "reason": "high findings exceed threshold", "highFindings": high_count})
    if not controls:
        warnings.append({"section": "controls", "reason": "no control evidence supplied"})

    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {
        "releaseId": payload.release_id,
        "route": payload.route,
        "jobTypes": payload.job_types,
        "decision": decision,
        "requiredControls": required_controls,
        "missingControls": missing_controls,
        "controlSummary": {name: _control_enabled(controls, name) for name in required_controls},
        "findingCount": len(findings),
        "severityCounts": severity_counts,
        "highOrCriticalFindings": high_or_critical[:100],
        "blockers": blockers,
        "warnings": warnings,
        "acceptanceChecks": [
            "Signed bridge, CSRF/rate-limit coverage, object-level authorization tests and secret scanning are present before canary promotion.",
            "Critical security findings are zero or explicitly remediated before production canary increase.",
            "Python only reviews sanitized security posture metadata; it does not change auth, RBAC, cookies or WAF policy.",
        ],
        "nodeOwnsSecurityControls": True,
        "pythonSecurityReviewIsAdvisory": True,
    }
    artifact = artifact_store.write_json(
        prefix="platform-security-posture-review",
        artifact_type="platform.security_posture_review.report",
        payload=report,
        metadata={"rowCount": len(findings), "redactionApplied": True, "piiClass": "security-posture-metadata-only", "source": "python-security-posture-review"},
    )
    return _result(job, "platform.security_posture_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["security posture review is advisory; Python did not mutate controls or approve release"], [artifact])


def process_platform_supply_chain_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(SupplyChainReviewPayload, job.payload)
    scans = payload.scans[:100]
    totals = {"critical": 0, "high": 0, "medium": 0, "low": 0, "unknown": 0}
    scan_summaries: list[dict[str, Any]] = []
    for scan in scans:
        kind = str(scan.get("type") or scan.get("scanner") or scan.get("name") or "scan")
        critical = _intish(scan.get("critical", scan.get("criticalCount", 0)))
        high = _intish(scan.get("high", scan.get("highCount", 0)))
        medium = _intish(scan.get("medium", scan.get("mediumCount", 0)))
        low = _intish(scan.get("low", scan.get("lowCount", 0)))
        unknown = _intish(scan.get("unknown", scan.get("unknownCount", 0)))
        totals["critical"] += critical
        totals["high"] += high
        totals["medium"] += medium
        totals["low"] += low
        totals["unknown"] += unknown
        scan_summaries.append({
            "type": kind,
            "status": scan.get("status", "unknown"),
            "critical": critical,
            "high": high,
            "medium": medium,
            "low": low,
            "unknown": unknown,
            "target": scan.get("target") or scan.get("component"),
        })
    blockers: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    if payload.require_sbom and not payload.sbom_present:
        blockers.append({"section": "sbom", "reason": "SBOM evidence is required but missing"})
    if payload.require_image_scan and not payload.image_scan_present:
        blockers.append({"section": "imageScan", "reason": "container/image scan evidence is required but missing"})
    if not payload.lockfiles_present:
        blockers.append({"section": "lockfiles", "reason": "dependency lockfiles are missing"})
    if totals["critical"] > payload.max_critical_vulnerabilities:
        blockers.append({"section": "vulnerabilities", "reason": "critical vulnerabilities exceed threshold", "critical": totals["critical"]})
    if totals["high"] > payload.max_high_vulnerabilities:
        warnings.append({"section": "vulnerabilities", "reason": "high vulnerabilities exceed threshold", "high": totals["high"]})
    if not scans:
        warnings.append({"section": "scans", "reason": "no scan evidence supplied"})

    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {
        "releaseId": payload.release_id,
        "route": payload.route,
        "jobTypes": payload.job_types,
        "decision": decision,
        "scanCount": len(scans),
        "sbomPresent": payload.sbom_present,
        "lockfilesPresent": payload.lockfiles_present,
        "imageScanPresent": payload.image_scan_present,
        "vulnerabilityTotals": totals,
        "scanSummaries": scan_summaries,
        "blockers": blockers,
        "warnings": warnings,
        "acceptanceChecks": [
            "SBOM, lockfiles and image scan evidence exist before production canary increase.",
            "Critical vulnerabilities are zero or explicitly remediated; high vulnerabilities require review or waiver.",
            "Python only evaluates sanitized scan summaries; dependency upgrades and image rebuilds remain CI/operator-owned.",
        ],
        "nodeOwnsDependencyUpdates": True,
        "pythonSupplyChainReviewIsAdvisory": True,
    }
    artifact = artifact_store.write_json(
        prefix="platform-supply-chain-review",
        artifact_type="platform.supply_chain_review.report",
        payload=report,
        metadata={"rowCount": len(scans), "redactionApplied": True, "piiClass": "supply-chain-scan-summary-only", "source": "python-supply-chain-review"},
    )
    return _result(job, "platform.supply_chain_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["supply chain review is advisory; Python did not update packages, images or registries"], [artifact])


def process_platform_schema_migration_rehearsal(job: JobEnvelope) -> JobResult:
    payload = model_validate(SchemaMigrationRehearsalPayload, job.payload)
    migrations = payload.migrations[:200]
    blockers: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []

    evidence = payload.rehearsal_evidence or {}
    missing_checks = [name for name in payload.required_checks if not _boolish(evidence.get(name))]
    if missing_checks:
        blockers.append({"section": "rehearsalEvidence", "reason": "required migration rehearsal checks missing or false", "missingChecks": missing_checks})

    drift_status = _status_from_evidence(payload.schema_drift)
    if drift_status in {"failed", "fail", "blocked", "rollback", "critical", "drift"}:
        blockers.append({"section": "schemaDrift", "reason": "schema drift evidence is blocking", "status": drift_status})
    elif drift_status in {"hold", "warning", "warn", "pending", "incomplete", "unknown"} and payload.schema_drift:
        warnings.append({"section": "schemaDrift", "reason": "schema drift evidence requires review", "status": drift_status})

    destructive_steps: list[dict[str, Any]] = []
    migration_summaries: list[dict[str, Any]] = []
    for index, migration in enumerate(migrations):
        name = str(migration.get("name") or migration.get("id") or f"migration-{index}")
        operation = str(migration.get("operation") or migration.get("type") or "unknown").lower()
        destructive = _boolish(migration.get("destructive")) or any(token in operation for token in ("drop", "delete", "truncate", "rename", "alter-required"))
        requires_backfill = _boolish(migration.get("requiresBackfill", migration.get("requires_backfill")))
        has_backfill_plan = _boolish(migration.get("backfillPlan", migration.get("backfill_plan"))) or _boolish(evidence.get("backfillPlan"))
        has_rollback = _boolish(migration.get("rollbackPlan", migration.get("rollback_plan"))) or _boolish(evidence.get("rollbackPlan"))
        summary = {
            "name": name,
            "operation": operation,
            "destructive": destructive,
            "requiresBackfill": requires_backfill,
            "hasBackfillPlan": has_backfill_plan,
            "hasRollbackPlan": has_rollback,
            "estimatedRows": _intish(migration.get("estimatedRows", migration.get("rowCount", 0))),
        }
        migration_summaries.append(summary)
        if destructive:
            destructive_steps.append(summary)
        if requires_backfill and not has_backfill_plan:
            blockers.append({"section": "migrations", "migration": name, "reason": "backfill required but no backfill plan evidence"})
        if not has_rollback:
            blockers.append({"section": "migrations", "migration": name, "reason": "rollback plan evidence missing"})

    if destructive_steps and not payload.allow_destructive:
        blockers.append({"section": "migrations", "reason": "destructive migration steps are not allowed", "destructiveSteps": destructive_steps[:25]})
    if len(destructive_steps) > payload.max_destructive_steps:
        blockers.append({"section": "migrations", "reason": "destructive steps exceed maxDestructiveSteps", "count": len(destructive_steps), "maxDestructiveSteps": payload.max_destructive_steps})
    if payload.require_shadow_replay and not _boolish(evidence.get("shadowReplay")):
        warnings.append({"section": "rehearsalEvidence", "reason": "shadow replay evidence missing"})
    if not migrations:
        warnings.append({"section": "migrations", "reason": "no migration metadata supplied"})

    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {
        "releaseId": payload.release_id,
        "route": payload.route,
        "jobTypes": payload.job_types,
        "decision": decision,
        "migrationCount": len(migrations),
        "destructiveStepCount": len(destructive_steps),
        "missingChecks": missing_checks,
        "migrationSummaries": migration_summaries,
        "schemaDriftStatus": drift_status,
        "rehearsalEvidence": evidence,
        "blockers": blockers,
        "warnings": warnings,
        "acceptanceChecks": [
            "Prisma validate/generate/migrate status evidence is clean before canary promotion.",
            "Every migration that needs rollback or backfill has explicit rehearsal evidence.",
            "Python only reviews migration metadata; Node/Prisma/CI remain owners of schema changes and execution.",
        ],
        "nodeOwnsPrismaMigrations": True,
        "pythonMigrationReviewIsAdvisory": True,
    }
    artifact = artifact_store.write_json(
        prefix="platform-schema-migration-rehearsal",
        artifact_type="platform.schema_migration_rehearsal.report",
        payload=report,
        metadata={"rowCount": len(migrations), "redactionApplied": True, "piiClass": "schema-migration-metadata-only", "source": "python-schema-migration-rehearsal"},
    )
    return _result(job, "platform.schema_migration_rehearsal.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["schema migration rehearsal is advisory; Python did not run Prisma migrations or mutate schema"], [artifact])


def process_platform_backup_restore_drill(job: JobEnvelope) -> JobResult:
    payload = model_validate(BackupRestoreDrillPayload, job.payload)
    backups = payload.backups[:100]
    restore_tests = payload.restore_tests[:100]
    blockers: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []

    backup_by_store: dict[str, dict[str, Any]] = {}
    for item in backups:
        store = str(item.get("store") or item.get("name") or item.get("type") or "unknown")
        backup_by_store[store] = item

    restore_by_store: dict[str, dict[str, Any]] = {}
    for item in restore_tests:
        store = str(item.get("store") or item.get("name") or item.get("type") or "unknown")
        restore_by_store[store] = item

    store_summaries: list[dict[str, Any]] = []
    for store in payload.required_stores:
        backup = backup_by_store.get(store, {})
        restore = restore_by_store.get(store, {})
        backup_ok = _boolish(backup.get("ok", backup.get("healthy", backup.get("present"))))
        restore_ok = _boolish(restore.get("ok", restore.get("passed", restore.get("success"))))
        integrity_ok = _boolish(restore.get("integrityOk", restore.get("checksumOk", restore.get("integrity"))))
        backup_age_minutes = _intish(backup.get("ageMinutes", backup.get("backupAgeMinutes", 0)), 0)
        restore_duration_minutes = _intish(restore.get("durationMinutes", restore.get("rtoMinutes", 0)), 0)
        summary = {
            "store": store,
            "backupPresent": bool(backup),
            "backupOk": backup_ok,
            "restoreTestPresent": bool(restore),
            "restoreOk": restore_ok,
            "integrityOk": integrity_ok,
            "backupAgeMinutes": backup_age_minutes,
            "restoreDurationMinutes": restore_duration_minutes,
        }
        store_summaries.append(summary)
        if not backup:
            blockers.append({"section": "backups", "store": store, "reason": "backup evidence missing"})
        elif not backup_ok:
            blockers.append({"section": "backups", "store": store, "reason": "backup evidence is not healthy"})
        if backup_age_minutes and backup_age_minutes > payload.rpo_minutes:
            blockers.append({"section": "backups", "store": store, "reason": "backup age exceeds RPO", "backupAgeMinutes": backup_age_minutes, "rpoMinutes": payload.rpo_minutes})
        if payload.require_recent_restore and not restore:
            blockers.append({"section": "restoreTests", "store": store, "reason": "restore test evidence missing"})
        elif restore and not restore_ok:
            blockers.append({"section": "restoreTests", "store": store, "reason": "restore test failed"})
        if restore_duration_minutes and restore_duration_minutes > payload.rto_minutes:
            warnings.append({"section": "restoreTests", "store": store, "reason": "restore duration exceeds RTO", "restoreDurationMinutes": restore_duration_minutes, "rtoMinutes": payload.rto_minutes})
        if payload.require_restore_integrity_check and restore and not integrity_ok:
            blockers.append({"section": "restoreTests", "store": store, "reason": "restore integrity check missing or failed"})

    if not backups:
        blockers.append({"section": "backups", "reason": "no backup evidence supplied"})
    if payload.require_recent_restore and not restore_tests:
        blockers.append({"section": "restoreTests", "reason": "no restore test evidence supplied"})

    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {
        "releaseId": payload.release_id,
        "route": payload.route,
        "jobTypes": payload.job_types,
        "decision": decision,
        "requiredStores": payload.required_stores,
        "rpoMinutes": payload.rpo_minutes,
        "rtoMinutes": payload.rto_minutes,
        "backupCount": len(backups),
        "restoreTestCount": len(restore_tests),
        "storeSummaries": store_summaries,
        "blockers": blockers,
        "warnings": warnings,
        "acceptanceChecks": [
            "PostgreSQL, Redis and artifact store backup evidence is present and within RPO.",
            "Restore drill evidence includes successful integrity checks and RTO observations.",
            "Python only reviews backup/restore metadata; operators and infrastructure own backup jobs and restore execution.",
        ],
        "nodeOwnsDataPlaneRollback": True,
        "pythonBackupRestoreReviewIsAdvisory": True,
    }
    artifact = artifact_store.write_json(
        prefix="platform-backup-restore-drill",
        artifact_type="platform.backup_restore_drill.report",
        payload=report,
        metadata={"rowCount": len(store_summaries), "redactionApplied": True, "piiClass": "backup-restore-metadata-only", "source": "python-backup-restore-drill"},
    )
    return _result(job, "platform.backup_restore_drill.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["backup restore drill is advisory; Python did not access backup archives or restore data"], [artifact])


def _canonical_signal_name(value: Any) -> str:
    return "".join(ch if ch.isalnum() else "_" for ch in str(value).strip().lower()).strip("_")


def _collect_signal_names(items: list[dict[str, Any]]) -> set[str]:
    names: set[str] = set()
    for item in items:
        for key in ("signal", "name", "metric", "field", "type"):
            raw = item.get(key)
            if raw is not None:
                names.add(_canonical_signal_name(raw))
        for raw_key in item.keys():
            names.add(_canonical_signal_name(raw_key))
    return {name for name in names if name}


def _floatish(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


def process_platform_observability_coverage_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(ObservabilityCoverageReviewPayload, job.payload)
    traces = payload.traces[:1000]
    metrics = payload.metrics[:1000]
    logs = payload.logs[:1000]
    dashboards = payload.dashboards[:100]
    blockers: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []

    observed_signals = set()
    observed_signals.update(_collect_signal_names(traces))
    observed_signals.update(_collect_signal_names(metrics))
    observed_signals.update(_collect_signal_names(logs))
    observed_signals.update(_collect_signal_names(dashboards))
    required = [_canonical_signal_name(item) for item in payload.required_signals]
    missing_signals = [signal for signal in required if signal and signal not in observed_signals]
    if missing_signals:
        blockers.append({"section": "signals", "reason": "required observability signals missing", "missingSignals": missing_signals})

    trace_coverage_values = []
    for item in traces:
        for key in ("coveragePercent", "traceCoveragePercent", "coverage"):
            if key in item:
                trace_coverage_values.append(_floatish(item.get(key)))
    trace_coverage_percent = min(trace_coverage_values) if trace_coverage_values else 0.0
    if trace_coverage_percent < payload.min_trace_coverage_percent:
        blockers.append({"section": "traces", "reason": "trace coverage below threshold", "traceCoveragePercent": trace_coverage_percent, "minTraceCoveragePercent": payload.min_trace_coverage_percent})

    uncorrelated_logs = 0
    for item in logs:
        has_trace = bool(item.get("traceId") or item.get("trace_id") or item.get("correlationId") or item.get("correlation_id") or item.get("requestId") or item.get("request_id"))
        if not has_trace:
            uncorrelated_logs += 1
    if uncorrelated_logs > payload.max_uncorrelated_logs:
        warnings.append({"section": "logs", "reason": "uncorrelated log count exceeds threshold", "uncorrelatedLogs": uncorrelated_logs, "maxUncorrelatedLogs": payload.max_uncorrelated_logs})

    if payload.require_dashboard_links and not dashboards:
        blockers.append({"section": "dashboards", "reason": "dashboard evidence missing"})
    unhealthy_dashboards = [item for item in dashboards if item.get("url") is None and item.get("link") is None and item.get("dashboardUrl") is None]
    if unhealthy_dashboards:
        warnings.append({"section": "dashboards", "reason": "some dashboard entries do not include a link", "count": len(unhealthy_dashboards)})

    if not traces and not metrics:
        blockers.append({"section": "evidence", "reason": "trace or metric evidence is required"})

    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {
        "releaseId": payload.release_id,
        "route": payload.route,
        "jobTypes": payload.job_types,
        "decision": decision,
        "traceCount": len(traces),
        "metricCount": len(metrics),
        "logSampleCount": len(logs),
        "dashboardCount": len(dashboards),
        "observedSignals": sorted(observed_signals),
        "missingSignals": missing_signals,
        "traceCoveragePercent": trace_coverage_percent,
        "uncorrelatedLogs": uncorrelated_logs,
        "blockers": blockers,
        "warnings": warnings,
        "acceptanceChecks": [
            "Request ID and trace ID are available across Node bridge, Python worker and artifact-producing jobs.",
            "p95 latency, error rate and queue depth metrics are visible before canary promotion.",
            "Dashboards exist for release operators; Python only reviews observability metadata and does not create monitors.",
        ],
        "nodeOwnsRuntimeInstrumentation": True,
        "pythonObservabilityReviewIsAdvisory": True,
    }
    artifact = artifact_store.write_json(
        prefix="platform-observability-coverage-review",
        artifact_type="platform.observability_coverage_review.report",
        payload=report,
        metadata={"rowCount": len(traces) + len(metrics) + len(logs), "redactionApplied": True, "piiClass": "observability-metadata-only", "source": "python-observability-coverage-review"},
    )
    return _result(job, "platform.observability_coverage_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["observability coverage review is advisory; Python did not create dashboards, alerts or instrumentation"], [artifact])


def _flag_bool(flags: dict[str, Any], name: str, default: bool = False) -> bool:
    value = flags.get(name)
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on", "enabled"}


def _flag_int(flags: dict[str, Any], name: str, default: int = 0) -> int:
    return _intish(flags.get(name), default)


def process_platform_feature_flag_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(FeatureFlagReviewPayload, job.payload)
    flags = dict(payload.flags)
    blockers: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []

    missing_flags = [name for name in payload.required_flags if name not in flags or flags.get(name) in (None, "")]
    if missing_flags:
        blockers.append({"section": "flags", "reason": "required feature flags missing", "missingFlags": missing_flags})

    canary_percent = _flag_int(flags, "HYBRID_PYTHON_CANARY_PERCENT", 0)
    if canary_percent > payload.max_canary_percent:
        blockers.append({"section": "flags", "flag": "HYBRID_PYTHON_CANARY_PERCENT", "reason": "canary percent exceeds approved maximum", "value": canary_percent, "maxCanaryPercent": payload.max_canary_percent})

    if payload.require_signed_bridge and not _flag_bool(flags, "PYTHON_WORKER_REQUIRE_SIGNATURE", False):
        blockers.append({"section": "flags", "flag": "PYTHON_WORKER_REQUIRE_SIGNATURE", "reason": "signed bridge must be required before production canary"})

    if payload.require_kill_switch and "HYBRID_PYTHON_ENABLED" not in flags:
        blockers.append({"section": "flags", "flag": "HYBRID_PYTHON_ENABLED", "reason": "kill switch flag missing"})
    elif payload.require_kill_switch and _flag_bool(flags, "HYBRID_PYTHON_ENABLED", False) and canary_percent == 0 and not _flag_bool(flags, "HYBRID_PYTHON_SHADOW_MODE", True):
        warnings.append({"section": "flags", "reason": "hybrid enabled with 0 canary and shadow mode disabled; verify rollout intent"})

    for name, expected in payload.expected_settings.items():
        actual = flags.get(name)
        if str(actual).lower() != str(expected).lower():
            warnings.append({"section": "expectedSettings", "flag": name, "reason": "flag value differs from expected setting", "expected": str(expected), "actual": str(actual)})

    if flags.get("PYTHON_SERVICES_BASE_URL") and not str(flags.get("PYTHON_SERVICES_BASE_URL")).startswith(("http://", "https://")):
        blockers.append({"section": "flags", "flag": "PYTHON_SERVICES_BASE_URL", "reason": "base URL must be http(s)"})

    decision = "rollback" if blockers else "hold" if warnings else "pass"
    safe_flags = {name: ("[set]" if any(token in name.lower() for token in ("secret", "token", "key")) else value) for name, value in flags.items()}
    report = {
        "releaseId": payload.release_id,
        "route": payload.route,
        "jobTypes": payload.job_types,
        "decision": decision,
        "requiredFlags": payload.required_flags,
        "missingFlags": missing_flags,
        "canaryPercent": canary_percent,
        "maxCanaryPercent": payload.max_canary_percent,
        "shadowMode": _flag_bool(flags, "HYBRID_PYTHON_SHADOW_MODE", False),
        "signedBridgeRequired": _flag_bool(flags, "PYTHON_WORKER_REQUIRE_SIGNATURE", False),
        "safeFlags": safe_flags,
        "blockers": blockers,
        "warnings": warnings,
        "acceptanceChecks": [
            "Feature flags include an immediate Node-owned kill switch and a canary percentage cap.",
            "Signed bridge is required before production canary promotion.",
            "The review redacts secret-like flag values and does not mutate runtime configuration.",
        ],
        "nodeOwnsFeatureFlagApplication": True,
        "pythonFeatureFlagReviewIsAdvisory": True,
    }
    artifact = artifact_store.write_json(
        prefix="platform-feature-flag-review",
        artifact_type="platform.feature_flag_review.report",
        payload=report,
        metadata={"rowCount": len(flags), "redactionApplied": True, "piiClass": "feature-flag-metadata-only", "source": "python-feature-flag-review"},
    )
    return _result(job, "platform.feature_flag_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["feature flag review is advisory; Python did not mutate configuration or traffic routing"], [artifact])



def _evidence_status_map(evidence: dict[str, Any]) -> dict[str, str | None]:
    return {str(name): _status_from_evidence(section) for name, section in sorted(evidence.items())}


def process_platform_domain_migration_readiness(job: JobEnvelope) -> JobResult:
    payload = model_validate(DomainMigrationReadinessPayload, job.payload)
    evidence = payload.evidence or {}
    blockers: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    rollback_statuses = {"rollback", "failed", "fail", "blocked", "error", "critical", "block"}
    hold_statuses = {"hold", "warning", "warn", "incomplete", "pending", "degraded"}
    pass_statuses = {"advance", "pass", "passed", "ready", "ready_for_review", "ready_for_handoff", "ok"}

    missing = [name for name in payload.required_evidence if not evidence.get(name)]
    if missing:
        warnings.append({"section": "requiredEvidence", "reason": "required evidence sections missing", "missingEvidence": missing})

    section_statuses = _evidence_status_map(evidence)
    for name, status in section_statuses.items():
        if status in rollback_statuses:
            blockers.append({"section": name, "status": status, "reason": "blocking evidence status for domain migration"})
        elif status in hold_statuses:
            warnings.append({"section": name, "status": status, "reason": "evidence requires operator review"})
        elif status and status not in pass_statuses:
            warnings.append({"section": name, "status": status, "reason": "unknown evidence status"})

    canary_status = _status_from_evidence(payload.canary_gate)
    if payload.canary_gate:
        if payload.canary_gate.get("allowed") is False or canary_status in {"rollback", "blocked", "fail", "failed"}:
            blockers.append({"section": "canaryGate", "status": canary_status, "reason": "canary gate is not allowing promotion"})
        elif canary_status in {"hold", "warning", "warn"}:
            warnings.append({"section": "canaryGate", "status": canary_status, "reason": "canary gate holds promotion"})
    else:
        warnings.append({"section": "canaryGate", "reason": "canary gate evidence missing"})

    mismatch_rate = float(payload.shadow_comparison_summary.get("mismatchRate") or 0) if payload.shadow_comparison_summary else 0.0
    if mismatch_rate > 0.05:
        blockers.append({"section": "shadowComparisonSummary", "reason": "shadow mismatch rate exceeds rollback threshold", "mismatchRate": mismatch_rate})
    elif mismatch_rate > 0:
        warnings.append({"section": "shadowComparisonSummary", "reason": "shadow mismatches require review", "mismatchRate": mismatch_rate})
    if not payload.shadow_comparison_summary:
        warnings.append({"section": "shadowComparisonSummary", "reason": "shadow comparison evidence missing"})

    if payload.target_canary_percent > payload.max_canary_percent:
        blockers.append({"section": "canary", "reason": "target canary exceeds approved maximum", "targetCanaryPercent": payload.target_canary_percent, "maxCanaryPercent": payload.max_canary_percent})
    if payload.require_node_fallback and not _boolish(evidence.get("nodeFallbackAvailable", evidence.get("nodeFallback"))):
        blockers.append({"section": "nodeFallback", "reason": "Node fallback/kill switch evidence is required before migration readiness"})
    approvals = evidence.get("ownerApprovals") or evidence.get("approvals") or []
    if payload.require_owner_approval and not (_boolish(evidence.get("ownerApproved")) or approvals):
        warnings.append({"section": "ownerApprovals", "reason": "domain owner approval evidence missing"})

    decision = "rollback" if blockers else "hold" if warnings else "advance"
    report = {
        "releaseId": payload.release_id,
        "domain": payload.domain,
        "route": payload.route,
        "jobTypes": payload.job_types,
        "candidateOwner": payload.candidate_owner,
        "decision": decision,
        "targetCanaryPercent": payload.target_canary_percent,
        "maxCanaryPercent": payload.max_canary_percent,
        "missingEvidence": missing,
        "sectionStatuses": section_statuses,
        "shadowMismatchRate": mismatch_rate,
        "canaryGateStatus": canary_status,
        "blockers": blockers,
        "warnings": warnings,
        "acceptanceChecks": [
            "Node fallback, kill switch and rollback path are confirmed before any domain ownership shift.",
            "Shadow comparison and SLO evidence are clean for the candidate route and job types.",
            "Privacy, contract replay, observability and feature-flag gates are attached to the evidence bundle.",
        ],
        "nodeOwnsProductionTrafficUntilCutover": True,
        "pythonReadinessGateIsAdvisory": True,
    }
    artifact = artifact_store.write_json(
        prefix="platform-domain-migration-readiness",
        artifact_type="platform.domain_migration_readiness.report",
        payload=report,
        metadata={"rowCount": len(evidence), "redactionApplied": True, "piiClass": "domain-migration-evidence-metadata-only", "source": "python-domain-migration-readiness"},
    )
    return _result(job, "platform.domain_migration_readiness.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["domain migration readiness is advisory; Node/CI/operators own traffic promotion and rollback"], [artifact])


def process_platform_cutover_plan(job: JobEnvelope) -> JobResult:
    payload = model_validate(CutoverPlanPayload, job.payload)
    blockers: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    evidence_statuses = _evidence_status_map(payload.evidence or {})

    for name, status in evidence_statuses.items():
        if status in {"rollback", "failed", "fail", "blocked", "error", "critical", "block"}:
            blockers.append({"section": name, "status": status, "reason": "cutover evidence is blocking"})
        elif status in {"hold", "warning", "warn", "incomplete", "pending", "degraded"}:
            warnings.append({"section": name, "status": status, "reason": "cutover evidence requires review"})

    if payload.dry_run_required and not job.dry_run:
        blockers.append({"section": "executionMode", "reason": "cutover plan must remain dry-run"})
    if payload.target_canary_percent == 0:
        warnings.append({"section": "canary", "reason": "target canary percent is 0; plan will remain shadow-only"})
    if not payload.rollback_triggers:
        warnings.append({"section": "rollbackTriggers", "reason": "rollback triggers missing; default triggers will be used"})
    if not payload.operator_approvals:
        warnings.append({"section": "operatorApprovals", "reason": "operator approvals missing"})

    bounded_stages = sorted({max(0, min(100, int(stage))) for stage in payload.stages + [0, payload.target_canary_percent] if int(stage) <= payload.target_canary_percent or int(stage) == 0})
    if payload.target_canary_percent not in bounded_stages:
        bounded_stages.append(payload.target_canary_percent)
    bounded_stages = sorted(set(bounded_stages))

    default_triggers = [
        "shadow mismatch rate exceeds 5%",
        "p95 latency regression exceeds approved SLO threshold",
        "privacy preflight blocks any payload shape",
        "Python worker readiness or Redis dependency fails",
        "operator triggers HYBRID_PYTHON_ENABLED=false or canary percent 0",
    ]
    rollback_triggers = payload.rollback_triggers or default_triggers
    steps: list[dict[str, Any]] = [
        {"order": 1, "phase": "preflight", "action": "Attach contract replay, privacy, SLO, observability, feature-flag and domain readiness evidence."},
        {"order": 2, "phase": "fallback", "action": "Confirm Node route remains the source of truth and rollback switch is tested."},
        {"order": 3, "phase": "shadow", "action": f"Run shadow comparison for {payload.route} until acceptance thresholds are met."},
    ]
    order = 4
    for stage in bounded_stages:
        if stage == 0:
            continue
        steps.append({"order": order, "phase": "canary", "action": f"Advance canary for {payload.route} to {stage}% after gate decision=advance.", "targetPercent": stage})
        order += 1
        steps.append({"order": order, "phase": "verify", "action": "Run post-deploy verify, SLO regression, privacy preflight and evidence bundle refresh.", "targetPercent": stage})
        order += 1
    steps.append({"order": order, "phase": "handoff", "action": "Update owner matrix only after production readiness and operational handoff are accepted."})

    decision = "rollback" if blockers else "hold" if warnings else "ready"
    report = {
        "releaseId": payload.release_id,
        "domain": payload.domain,
        "route": payload.route,
        "jobTypes": payload.job_types,
        "fromOwner": payload.from_owner,
        "toOwner": payload.to_owner,
        "decision": decision,
        "targetCanaryPercent": payload.target_canary_percent,
        "stages": bounded_stages,
        "steps": steps,
        "rollbackTriggers": rollback_triggers,
        "evidenceStatuses": evidence_statuses,
        "operatorApprovalCount": len(payload.operator_approvals),
        "blockers": blockers,
        "warnings": warnings,
        "mutatesState": False,
        "dryRunOnly": True,
        "nodeOwnsCutoverExecution": True,
        "pythonCutoverPlanIsAdvisory": True,
    }
    artifact = artifact_store.write_json(
        prefix="platform-cutover-plan",
        artifact_type="platform.cutover_plan.report",
        payload=report,
        metadata={"rowCount": len(steps), "redactionApplied": True, "piiClass": "cutover-plan-metadata-only", "source": "python-cutover-plan"},
    )
    return _result(job, "platform.cutover_plan.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["cutover plan is advisory and dry-run; Node/CI/operators own promotion and rollback"], [artifact])


def _owner_record_name(record: dict[str, Any], index: int) -> str:
    return str(record.get("domain") or record.get("route") or record.get("name") or f"owner-record-{index}")


def process_platform_owner_registry_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(OwnerRegistryReviewPayload, job.payload)
    records = payload.domains or []
    if not records and payload.owner_registry:
        for name, value in sorted(payload.owner_registry.items()):
            if isinstance(value, dict):
                records.append({"domain": name, **value})
            else:
                records.append({"domain": name, "owner": value})

    blockers: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    owner_summaries: list[dict[str, Any]] = []
    approved_roles = {str(item.get("role") or item.get("owner") or "").strip() for item in payload.approvals if str(item.get("status") or "approved").lower() in {"approved", "accepted", "ok", "pass"}}

    if not records:
        warnings.append({"section": "ownerRegistry", "reason": "no owner records supplied; review is incomplete"})

    for index, record in enumerate(records[:200]):
        name = _owner_record_name(record, index)
        missing = [owner for owner in payload.required_owners if not record.get(owner)]
        has_rollback_owner = bool(record.get("rollbackOwner"))
        has_incident_owner = bool(record.get("incidentOwner"))
        has_node_fallback_owner = bool(record.get("nodeApiOwner") or record.get("fallbackOwner"))
        summary = {
            "name": name,
            "route": record.get("route") or payload.route,
            "jobTypes": record.get("jobTypes") or payload.job_types,
            "missingOwners": missing,
            "hasRollbackOwner": has_rollback_owner,
            "hasIncidentOwner": has_incident_owner,
            "hasNodeFallbackOwner": has_node_fallback_owner,
            "approved": bool(record.get("approved")) or bool(approved_roles),
        }
        owner_summaries.append(summary)
        if payload.require_rollback_owner and not has_rollback_owner:
            blockers.append({"section": "ownerRegistry", "record": name, "reason": "rollbackOwner is required before cutover"})
        if payload.require_incident_owner and not has_incident_owner:
            blockers.append({"section": "ownerRegistry", "record": name, "reason": "incidentOwner is required before cutover"})
        if not has_node_fallback_owner:
            blockers.append({"section": "ownerRegistry", "record": name, "reason": "Node fallback/API owner is required while Python remains progressive"})
        if missing:
            warnings.append({"section": "ownerRegistry", "record": name, "reason": "owner fields missing", "missingOwners": missing})
        if not summary["approved"]:
            warnings.append({"section": "approvals", "record": name, "reason": "owner registry approval missing"})

    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {
        "releaseId": payload.release_id,
        "domain": payload.domain,
        "route": payload.route,
        "jobTypes": payload.job_types,
        "decision": decision,
        "recordCount": len(records),
        "ownerSummaries": owner_summaries,
        "requiredOwners": payload.required_owners,
        "approvalCount": len(payload.approvals),
        "blockers": blockers,
        "warnings": warnings,
        "acceptanceChecks": [
            "Each candidate domain/route has Node API/fallback, Python worker, data, security, rollback and incident owners.",
            "Owner changes are reflected in runbooks and change tickets before canary increases.",
            "Python produces an owner-registry review only; it does not mutate RBAC, on-call or deployment ownership.",
        ],
        "nodeOwnsFallbackUntilFullCutover": True,
        "pythonOwnerRegistryReviewIsAdvisory": True,
    }
    artifact = artifact_store.write_json(
        prefix="platform-owner-registry-review",
        artifact_type="platform.owner_registry_review.report",
        payload=report,
        metadata={"rowCount": len(records), "redactionApplied": True, "piiClass": "owner-registry-metadata-only", "source": "python-owner-registry-review"},
    )
    return _result(job, "platform.owner_registry_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["owner registry review is advisory; Node/CI/operators own ownership changes"], [artifact])


def process_platform_post_cutover_monitor(job: JobEnvelope) -> JobResult:
    payload = model_validate(PostCutoverMonitorPayload, job.payload)
    metrics = payload.metrics or {}
    thresholds = payload.thresholds or {}
    blockers: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []

    p95_ms = float(metrics.get("p95Ms") or metrics.get("p95LatencyMs") or metrics.get("p95") or 0)
    error_rate = float(metrics.get("errorRate") or metrics.get("error_rate") or 0)
    mismatch_rate = float(metrics.get("mismatchRate") or metrics.get("shadowMismatchRate") or 0)
    failed_jobs = _intish(metrics.get("failedJobs") or metrics.get("failedJobCount") or 0)
    queue_depth = _intish(metrics.get("queueDepth") or 0)
    request_count = _intish(metrics.get("requestCount") or metrics.get("requests") or 0)
    max_p95_ms = float(thresholds.get("maxP95Ms") or thresholds.get("targetP95Ms") or 500)
    max_error_rate = float(thresholds.get("maxErrorRate") or 0.01)
    max_mismatch_rate = float(thresholds.get("maxMismatchRate") or 0.05)
    max_failed_jobs = _intish(thresholds.get("maxFailedJobs") or 0)
    max_queue_depth = _intish(thresholds.get("maxQueueDepth") or 1000)
    min_requests = _intish(thresholds.get("minRequestCount") or 1)

    if request_count < min_requests:
        warnings.append({"section": "traffic", "reason": "not enough traffic observed in monitor window", "requestCount": request_count, "minRequestCount": min_requests})
    if p95_ms and p95_ms > max_p95_ms:
        blockers.append({"section": "latency", "reason": "p95 latency exceeds threshold", "p95Ms": p95_ms, "maxP95Ms": max_p95_ms})
    if error_rate > max_error_rate:
        blockers.append({"section": "errors", "reason": "error rate exceeds threshold", "errorRate": error_rate, "maxErrorRate": max_error_rate})
    if mismatch_rate > max_mismatch_rate:
        blockers.append({"section": "shadowComparison", "reason": "shadow mismatch rate exceeds threshold", "mismatchRate": mismatch_rate, "maxMismatchRate": max_mismatch_rate})
    if failed_jobs > max_failed_jobs:
        blockers.append({"section": "jobs", "reason": "failed jobs exceed threshold", "failedJobs": failed_jobs, "maxFailedJobs": max_failed_jobs})
    if queue_depth > max_queue_depth:
        warnings.append({"section": "queue", "reason": "queue depth exceeds warning threshold", "queueDepth": queue_depth, "maxQueueDepth": max_queue_depth})
    if payload.require_node_fallback and not _boolish(payload.evidence.get("nodeFallbackAvailable", payload.evidence.get("nodeFallback"))):
        blockers.append({"section": "nodeFallback", "reason": "Node fallback evidence is required during post-cutover monitoring"})

    evidence_statuses = _evidence_status_map(payload.evidence or {})
    for name, status in evidence_statuses.items():
        if status in {"rollback", "failed", "fail", "blocked", "error", "critical", "block"}:
            blockers.append({"section": name, "status": status, "reason": "blocking evidence status during post-cutover monitor"})
        elif status in {"hold", "warning", "warn", "incomplete", "pending", "degraded"}:
            warnings.append({"section": name, "status": status, "reason": "post-cutover evidence requires review"})

    default_triggers = [
        "p95 latency exceeds threshold",
        "error rate exceeds threshold",
        "shadow mismatch rate exceeds threshold",
        "failed jobs exceed threshold",
        "Node fallback evidence missing",
    ]
    decision = "rollback" if blockers else "hold" if warnings else "continue"
    report = {
        "releaseId": payload.release_id,
        "domain": payload.domain,
        "route": payload.route,
        "jobTypes": payload.job_types,
        "decision": decision,
        "monitorWindowMinutes": payload.monitor_window_minutes,
        "targetCanaryPercent": payload.target_canary_percent,
        "metricsSummary": {
            "requestCount": request_count,
            "p95Ms": p95_ms,
            "errorRate": error_rate,
            "mismatchRate": mismatch_rate,
            "failedJobs": failed_jobs,
            "queueDepth": queue_depth,
        },
        "thresholds": {
            "maxP95Ms": max_p95_ms,
            "maxErrorRate": max_error_rate,
            "maxMismatchRate": max_mismatch_rate,
            "maxFailedJobs": max_failed_jobs,
            "maxQueueDepth": max_queue_depth,
            "minRequestCount": min_requests,
        },
        "evidenceStatuses": evidence_statuses,
        "rollbackTriggers": payload.rollback_triggers or default_triggers,
        "blockers": blockers,
        "warnings": warnings,
        "acceptanceChecks": [
            "Post-cutover metrics stay within p95, error, mismatch and failed-job thresholds for the monitor window.",
            "Node fallback and kill switch stay available until the cutover is declared stable.",
            "Python monitor is advisory; rollout state changes and rollback execution remain Node/CI/operator-owned.",
        ],
        "nodeOwnsRollback": True,
        "pythonPostCutoverMonitorIsAdvisory": True,
    }
    artifact = artifact_store.write_json(
        prefix="platform-post-cutover-monitor",
        artifact_type="platform.post_cutover_monitor.report",
        payload=report,
        metadata={"rowCount": request_count, "redactionApplied": True, "piiClass": "post-cutover-telemetry-metadata-only", "source": "python-post-cutover-monitor"},
    )
    return _result(job, "platform.post_cutover_monitor.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["post-cutover monitor is advisory; Python did not mutate rollout state"], [artifact])


def process_platform_legacy_path_decommission(job: JobEnvelope) -> JobResult:
    payload = model_validate(LegacyPathDecommissionPayload, job.payload)
    blockers: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    path_summaries: list[dict[str, Any]] = []

    evidence_statuses = _evidence_status_map(payload.evidence or {})
    for required in payload.required_evidence:
        status = evidence_statuses.get(required.lower()) or evidence_statuses.get(required)
        if status is None:
            blockers.append({"section": "evidence", "name": required, "reason": "required evidence is missing"})
        elif status in {"rollback", "failed", "fail", "blocked", "error", "critical", "block"}:
            blockers.append({"section": required, "status": status, "reason": "blocking evidence status"})
        elif status in {"hold", "warning", "warn", "incomplete", "pending", "degraded"}:
            warnings.append({"section": required, "status": status, "reason": "evidence requires operator review"})

    if not payload.legacy_paths:
        warnings.append({"section": "legacyPaths", "reason": "no legacy paths supplied; report is plan-only"})

    for index, path in enumerate(payload.legacy_paths[:500]):
        path_name = str(path.get("path") or path.get("route") or path.get("name") or f"legacy-{index}")
        traffic_percent = float(path.get("trafficPercent") or path.get("traffic") or 0)
        fallback_available = _boolish(path.get("fallbackAvailable", path.get("nodeFallbackAvailable", False)))
        decommission_approved = _boolish(path.get("decommissionApproved", path.get("approved", False)))
        replacement_route = path.get("replacementRoute") or payload.route
        summary = {
            "path": path_name,
            "replacementRoute": replacement_route,
            "trafficPercent": traffic_percent,
            "fallbackAvailable": fallback_available,
            "decommissionApproved": decommission_approved,
            "owner": path.get("owner") or path.get("nodeOwner") or "unknown",
        }
        path_summaries.append(summary)
        if payload.require_zero_traffic and traffic_percent > 0:
            blockers.append({"section": "legacyPaths", "path": path_name, "reason": "legacy path still receives traffic", "trafficPercent": traffic_percent})
        if not fallback_available:
            blockers.append({"section": "legacyPaths", "path": path_name, "reason": "fallback evidence is missing before decommission"})
        if payload.require_operator_approval and not decommission_approved:
            warnings.append({"section": "legacyPaths", "path": path_name, "reason": "operator decommission approval is missing"})

    fallback_ready = _boolish(payload.fallback_plan.get("available", payload.fallback_plan.get("tested", False)))
    rollback_tested = _boolish(payload.fallback_plan.get("rollbackTested", payload.fallback_plan.get("tested", False)))
    if not fallback_ready:
        blockers.append({"section": "fallbackPlan", "reason": "fallback plan must be available/tested before decommission"})
    if not rollback_tested:
        warnings.append({"section": "fallbackPlan", "reason": "rollback test evidence should be attached before code cleanup"})

    default_triggers = [
        "traffic appears on a decommissioned legacy path",
        "replacement route error rate exceeds threshold",
        "fallback or rollback test evidence is withdrawn",
        "operators report unresolved incident during decommission window",
    ]
    decision = "hold" if blockers or warnings else "ready"
    report = {
        "releaseId": payload.release_id,
        "domain": payload.domain,
        "route": payload.route,
        "jobTypes": payload.job_types,
        "decision": decision,
        "legacyPathCount": len(payload.legacy_paths),
        "legacyPaths": path_summaries,
        "requiredEvidence": payload.required_evidence,
        "evidenceStatuses": evidence_statuses,
        "fallbackPlan": {
            "available": fallback_ready,
            "rollbackTested": rollback_tested,
            "owner": payload.fallback_plan.get("owner"),
        },
        "rollbackTriggers": payload.rollback_triggers or default_triggers,
        "blockers": blockers,
        "warnings": warnings,
        "acceptanceChecks": [
            "Legacy path receives 0% traffic and has a tested replacement path.",
            "Owner, fallback and rollback evidence are attached to the change ticket.",
            "Python report is advisory; CI/operators own route removal, code cleanup and deployment rollback.",
        ],
        "mutatesCodeOrTraffic": False,
        "nodeOwnsFallbackUntilDecommissionComplete": True,
        "pythonDecommissionReviewIsAdvisory": True,
    }
    artifact = artifact_store.write_json(
        prefix="platform-legacy-path-decommission",
        artifact_type="platform.legacy_path_decommission.report",
        payload=report,
        metadata={"rowCount": len(payload.legacy_paths), "redactionApplied": True, "piiClass": "legacy-path-decommission-metadata-only", "source": "python-legacy-path-decommission"},
    )
    return _result(job, "platform.legacy_path_decommission.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["legacy path decommission review is advisory; Python did not remove routes or change traffic"], [artifact])


def process_platform_steady_state_operations_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(SteadyStateOpsReviewPayload, job.payload)
    blockers: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []

    control_presence = {
        "runbook": bool(payload.runbook_links) or bool(payload.evidence.get("runbook")),
        "dashboard": bool(payload.dashboard_links) or bool(payload.evidence.get("dashboard")),
        "alerts": bool(payload.alert_policies) or bool(payload.evidence.get("alerts")),
        "onCall": _boolish(payload.evidence.get("onCall", payload.evidence.get("onCallReady", False))),
        "ownerRegistry": bool(payload.evidence.get("ownerRegistry")),
        "rollbackDrill": bool(payload.evidence.get("rollbackDrill")),
        "postCutoverMonitor": bool(payload.evidence.get("postCutoverMonitor")),
    }
    for control in payload.required_operational_controls:
        if not control_presence.get(control, False):
            blockers.append({"section": "operationalControls", "control": control, "reason": "required steady-state control missing"})
    if payload.require_on_call and not control_presence.get("onCall", False):
        blockers.append({"section": "onCall", "reason": "on-call evidence is required for steady-state operations"})

    metrics = payload.metrics or {}
    thresholds = payload.thresholds or {}
    p95_ms = float(metrics.get("p95Ms") or metrics.get("p95LatencyMs") or metrics.get("p95") or 0)
    error_rate = float(metrics.get("errorRate") or metrics.get("error_rate") or 0)
    failed_jobs = _intish(metrics.get("failedJobs") or metrics.get("failedJobCount") or 0)
    incident_count = _intish(metrics.get("incidentCount") or len(payload.incident_history))
    max_p95_ms = float(thresholds.get("maxP95Ms") or 500)
    max_error_rate = float(thresholds.get("maxErrorRate") or 0.01)
    max_failed_jobs = _intish(thresholds.get("maxFailedJobs") or 0)
    max_open_incidents = _intish(thresholds.get("maxOpenIncidents") or 0)

    if p95_ms and p95_ms > max_p95_ms:
        blockers.append({"section": "latency", "reason": "steady-state p95 exceeds threshold", "p95Ms": p95_ms, "maxP95Ms": max_p95_ms})
    if error_rate > max_error_rate:
        blockers.append({"section": "errors", "reason": "steady-state error rate exceeds threshold", "errorRate": error_rate, "maxErrorRate": max_error_rate})
    if failed_jobs > max_failed_jobs:
        blockers.append({"section": "jobs", "reason": "failed jobs exceed steady-state threshold", "failedJobs": failed_jobs, "maxFailedJobs": max_failed_jobs})

    open_incidents = []
    for index, incident in enumerate(payload.incident_history[:500]):
        status = str(incident.get("status") or "").strip().lower()
        severity = str(incident.get("severity") or incident.get("level") or "").strip().lower()
        if status not in {"resolved", "closed", "done", "mitigated"}:
            open_incidents.append({"index": index, "severity": severity or "unknown", "status": status or "unknown", "summary": incident.get("summary") or incident.get("title")})
        if severity in {"sev0", "sev1", "critical"} and status not in {"resolved", "closed", "done", "mitigated"}:
            blockers.append({"section": "incidents", "reason": "critical incident remains open", "index": index, "severity": severity})
    if len(open_incidents) > max_open_incidents:
        warnings.append({"section": "incidents", "reason": "open incident count exceeds steady-state threshold", "openIncidents": len(open_incidents), "maxOpenIncidents": max_open_incidents})

    evidence_statuses = _evidence_status_map(payload.evidence or {})
    for name, status in evidence_statuses.items():
        if status in {"rollback", "failed", "fail", "blocked", "error", "critical", "block"}:
            blockers.append({"section": name, "status": status, "reason": "blocking evidence status during steady-state review"})
        elif status in {"hold", "warning", "warn", "incomplete", "pending", "degraded"}:
            warnings.append({"section": name, "status": status, "reason": "steady-state evidence requires review"})

    decision = "rollback" if any(item.get("section") in {"latency", "errors", "incidents"} for item in blockers) else "hold" if blockers or warnings else "operate"
    report = {
        "releaseId": payload.release_id,
        "domain": payload.domain,
        "route": payload.route,
        "jobTypes": payload.job_types,
        "decision": decision,
        "operationalControls": control_presence,
        "metricsSummary": {
            "p95Ms": p95_ms,
            "errorRate": error_rate,
            "failedJobs": failed_jobs,
            "incidentCount": incident_count,
            "openIncidents": len(open_incidents),
        },
        "thresholds": {
            "maxP95Ms": max_p95_ms,
            "maxErrorRate": max_error_rate,
            "maxFailedJobs": max_failed_jobs,
            "maxOpenIncidents": max_open_incidents,
        },
        "evidenceStatuses": evidence_statuses,
        "runbookCount": len(payload.runbook_links),
        "dashboardCount": len(payload.dashboard_links),
        "alertPolicyCount": len(payload.alert_policies),
        "openIncidents": open_incidents[:50],
        "blockers": blockers,
        "warnings": warnings,
        "acceptanceChecks": [
            "Runbook, dashboard, alert policy, on-call and ownership evidence are attached and current.",
            "Aggregate SLO and incident metrics remain within steady-state thresholds.",
            "Python review is advisory; operations ownership and traffic routing remain with Node/CI/operators.",
        ],
        "mutatesOwnershipOrRouting": False,
        "pythonSteadyStateReviewIsAdvisory": True,
    }
    artifact = artifact_store.write_json(
        prefix="platform-steady-state-ops-review",
        artifact_type="platform.steady_state_operations_review.report",
        payload=report,
        metadata={"rowCount": incident_count, "redactionApplied": True, "piiClass": "steady-state-ops-metadata-only", "source": "python-steady-state-ops-review"},
    )
    return _result(job, "platform.steady_state_operations_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["steady-state operations review is advisory; Python did not change ownership or routing"], [artifact])


def process_platform_queue_resilience_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(QueueResilienceReviewPayload, job.payload)
    blockers: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    queue_summaries: list[dict[str, Any]] = []

    thresholds = payload.thresholds or {}
    max_queue_depth = _intish(thresholds.get("maxQueueDepth") or 1000)
    max_oldest_age_seconds = _intish(thresholds.get("maxOldestAgeSeconds") or 300)
    min_consumers = _intish(thresholds.get("minConsumers") or 1)
    max_drain_minutes = _intish(thresholds.get("maxDrainMinutes") or 60)
    max_error_rate = float(thresholds.get("maxErrorRate") or 0.01)

    if not payload.queues:
        warnings.append({"section": "queues", "reason": "no queue telemetry supplied; review is plan-only"})

    for index, queue in enumerate(payload.queues[:100]):
        name = str(queue.get("name") or queue.get("queue") or f"queue-{index}")
        depth = _intish(queue.get("depth") or queue.get("queueDepth") or queue.get("pending") or 0)
        oldest_age_seconds = _intish(queue.get("oldestAgeSeconds") or queue.get("oldestMessageAgeSeconds") or 0)
        consumers = _intish(queue.get("consumers") or queue.get("workerCount") or queue.get("workers") or 0)
        failed = _intish(queue.get("failed") or queue.get("failedJobs") or 0)
        processed = _intish(queue.get("processed") or queue.get("processedJobs") or queue.get("completed") or 0)
        retry_enabled = _boolish(queue.get("retryEnabled", payload.retry_policy.get("enabled", False)))
        dlq_enabled = _boolish(queue.get("dlqEnabled", payload.dlq_policy.get("enabled", False)))
        drain_rate = float(queue.get("drainRatePerMinute") or queue.get("processingRatePerMinute") or 0)
        error_rate = float(queue.get("errorRate") or (failed / max(processed + failed, 1)))
        estimated_drain_minutes = (depth / drain_rate) if drain_rate > 0 else (float("inf") if depth > 0 else 0.0)
        summary = {
            "name": name,
            "depth": depth,
            "oldestAgeSeconds": oldest_age_seconds,
            "consumers": consumers,
            "failedJobs": failed,
            "processedJobs": processed,
            "errorRate": error_rate,
            "retryEnabled": retry_enabled,
            "dlqEnabled": dlq_enabled,
            "drainRatePerMinute": drain_rate,
            "estimatedDrainMinutes": estimated_drain_minutes if estimated_drain_minutes != float("inf") else None,
        }
        queue_summaries.append(summary)
        if consumers < min_consumers:
            blockers.append({"section": "queue", "queue": name, "reason": "consumer count below threshold", "consumers": consumers, "minConsumers": min_consumers})
        if depth > max_queue_depth:
            blockers.append({"section": "queue", "queue": name, "reason": "queue depth exceeds threshold", "depth": depth, "maxQueueDepth": max_queue_depth})
        if oldest_age_seconds > max_oldest_age_seconds:
            blockers.append({"section": "queue", "queue": name, "reason": "oldest queued item age exceeds threshold", "oldestAgeSeconds": oldest_age_seconds, "maxOldestAgeSeconds": max_oldest_age_seconds})
        if estimated_drain_minutes != float("inf") and estimated_drain_minutes > max_drain_minutes:
            warnings.append({"section": "queue", "queue": name, "reason": "estimated drain time exceeds target", "estimatedDrainMinutes": estimated_drain_minutes, "maxDrainMinutes": max_drain_minutes})
        if error_rate > max_error_rate:
            blockers.append({"section": "queue", "queue": name, "reason": "queue error rate exceeds threshold", "errorRate": error_rate, "maxErrorRate": max_error_rate})
        if not retry_enabled:
            warnings.append({"section": "retryPolicy", "queue": name, "reason": "retry policy is not enabled or not evidenced"})
        if payload.require_dlq and not dlq_enabled:
            blockers.append({"section": "dlqPolicy", "queue": name, "reason": "DLQ policy is required before canary expansion"})

    idempotency_ready = _boolish(payload.idempotency_evidence.get("enabled", payload.idempotency_evidence.get("ready", False))) or _boolish(payload.evidence.get("idempotency", False))
    if payload.require_idempotency and not idempotency_ready:
        blockers.append({"section": "idempotency", "reason": "idempotency evidence is required for resilient queue processing"})

    evidence_statuses = _evidence_status_map(payload.evidence or {})
    for name, status in evidence_statuses.items():
        if status in {"rollback", "failed", "fail", "blocked", "error", "critical", "block"}:
            blockers.append({"section": name, "status": status, "reason": "blocking evidence status during queue resilience review"})
        elif status in {"hold", "warning", "warn", "incomplete", "pending", "degraded"}:
            warnings.append({"section": name, "status": status, "reason": "queue resilience evidence requires review"})

    decision = "rollback" if any(item.get("section") == "queue" and item.get("reason") in {"consumer count below threshold", "queue depth exceeds threshold", "oldest queued item age exceeds threshold", "queue error rate exceeds threshold"} for item in blockers) else "hold" if blockers or warnings else "pass"
    total_depth = sum(item["depth"] for item in queue_summaries)
    report = {
        "releaseId": payload.release_id,
        "domain": payload.domain,
        "route": payload.route,
        "jobTypes": payload.job_types,
        "decision": decision,
        "queueCount": len(payload.queues),
        "totalQueueDepth": total_depth,
        "queues": queue_summaries,
        "thresholds": {
            "maxQueueDepth": max_queue_depth,
            "maxOldestAgeSeconds": max_oldest_age_seconds,
            "minConsumers": min_consumers,
            "maxDrainMinutes": max_drain_minutes,
            "maxErrorRate": max_error_rate,
        },
        "retryPolicy": {"enabled": _boolish(payload.retry_policy.get("enabled", False)), "maxAttempts": payload.retry_policy.get("maxAttempts")},
        "dlqPolicy": {"enabled": _boolish(payload.dlq_policy.get("enabled", False)), "destination": payload.dlq_policy.get("destination")},
        "idempotencyReady": idempotency_ready,
        "evidenceStatuses": evidence_statuses,
        "blockers": blockers,
        "warnings": warnings,
        "acceptanceChecks": [
            "Queue depth, age, failure rate and drain estimates remain within agreed thresholds.",
            "DLQ, retry policy and idempotency evidence are present before canary expansion.",
            "Python review is advisory; workers, Redis and rollout execution remain operator/CI-owned.",
        ],
        "mutatesQueuesOrWorkers": False,
        "nodeOwnsTrafficAndRollback": True,
        "pythonQueueResilienceReviewIsAdvisory": True,
    }
    artifact = artifact_store.write_json(
        prefix="platform-queue-resilience-review",
        artifact_type="platform.queue_resilience_review.report",
        payload=report,
        metadata={"rowCount": len(payload.queues), "redactionApplied": True, "piiClass": "queue-resilience-metadata-only", "source": "python-queue-resilience-review"},
    )
    return _result(job, "platform.queue_resilience_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["queue resilience review is advisory; Python did not mutate queues or workers"], [artifact])


def process_platform_artifact_integrity_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(ArtifactIntegrityReviewPayload, job.payload)
    blockers: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    artifact_summaries: list[dict[str, Any]] = []
    allowed = {value.strip().lower() for value in payload.allowed_pii_classes}
    forbidden_tokens = {"phi", "clinical-content", "raw-pii", "direct-identifiers", "payment-secret", "token"}

    if not payload.artifacts:
        warnings.append({"section": "artifacts", "reason": "no artifact metadata supplied; review is plan-only"})

    for index, artifact in enumerate(payload.artifacts[:1000]):
        artifact_id = str(artifact.get("artifactId") or artifact.get("id") or f"artifact-{index}")
        artifact_type = str(artifact.get("artifactType") or artifact.get("type") or "unknown")
        sha256 = str(artifact.get("sha256") or "")
        size_bytes = _intish(artifact.get("sizeBytes") or artifact.get("size") or 0)
        redaction_applied = _boolish(artifact.get("redactionApplied", False))
        pii_class = str(artifact.get("piiClass") or "unknown").strip().lower()
        expires_at = artifact.get("expiresAt") or artifact.get("expires_at")
        missing = [field for field in payload.required_fields if field not in artifact or artifact.get(field) in (None, "")]
        summary = {
            "artifactId": artifact_id,
            "artifactType": artifact_type,
            "sizeBytes": size_bytes,
            "sha256Present": bool(sha256),
            "redactionApplied": redaction_applied,
            "piiClass": pii_class,
            "expiresAtPresent": bool(expires_at),
            "missingFields": missing,
        }
        artifact_summaries.append(summary)
        if missing:
            blockers.append({"section": "artifact", "artifactId": artifact_id, "reason": "required artifact metadata is missing", "missingFields": missing})
        if payload.require_sha256 and (len(sha256) != 64 or any(ch not in "0123456789abcdefABCDEF" for ch in sha256)):
            blockers.append({"section": "artifact", "artifactId": artifact_id, "reason": "sha256 is missing or invalid"})
        if payload.require_redaction and not redaction_applied:
            blockers.append({"section": "artifact", "artifactId": artifact_id, "reason": "redactionApplied must be true"})
        if payload.require_expiry and not expires_at:
            blockers.append({"section": "artifact", "artifactId": artifact_id, "reason": "expiresAt is required for generated artifacts"})
        if pii_class not in allowed or any(token in pii_class for token in forbidden_tokens):
            blockers.append({"section": "artifact", "artifactId": artifact_id, "reason": "piiClass is not allowed for Python-generated release artifacts", "piiClass": pii_class})
        if size_bytes <= 0:
            warnings.append({"section": "artifact", "artifactId": artifact_id, "reason": "artifact size is missing or zero"})

    evidence_statuses = _evidence_status_map(payload.evidence or {})
    for name, status in evidence_statuses.items():
        if status in {"rollback", "failed", "fail", "blocked", "error", "critical", "block"}:
            blockers.append({"section": name, "status": status, "reason": "blocking evidence status during artifact integrity review"})
        elif status in {"hold", "warning", "warn", "incomplete", "pending", "degraded"}:
            warnings.append({"section": name, "status": status, "reason": "artifact integrity evidence requires review"})

    decision = "rollback" if any(item.get("section") == "artifact" and "piiClass" in item.get("reason", "") for item in blockers) else "hold" if blockers or warnings else "pass"
    report = {
        "releaseId": payload.release_id,
        "domain": payload.domain,
        "route": payload.route,
        "jobTypes": payload.job_types,
        "decision": decision,
        "artifactCount": len(payload.artifacts),
        "artifacts": artifact_summaries,
        "requiredFields": payload.required_fields,
        "allowedPiiClasses": payload.allowed_pii_classes,
        "evidenceStatuses": evidence_statuses,
        "blockers": blockers,
        "warnings": warnings,
        "acceptanceChecks": [
            "Every generated artifact includes artifactId, artifactType, sha256, sizeBytes, redactionApplied, piiClass and expiresAt.",
            "Only minimized/metadata piiClass values are allowed for Python release artifacts.",
            "Python review is advisory; artifact access control and delivery remain Node/operator-owned.",
        ],
        "mutatesArtifactsOrAccess": False,
        "nodeOwnsArtifactDelivery": True,
        "pythonArtifactIntegrityReviewIsAdvisory": True,
    }
    artifact = artifact_store.write_json(
        prefix="platform-artifact-integrity-review",
        artifact_type="platform.artifact_integrity_review.report",
        payload=report,
        metadata={"rowCount": len(payload.artifacts), "redactionApplied": True, "piiClass": "artifact-integrity-metadata-only", "source": "python-artifact-integrity-review"},
    )
    return _result(job, "platform.artifact_integrity_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["artifact integrity review is advisory; Python did not change artifact access or retention"], [artifact])


def _parse_review_date(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        return _parse_datetime(value)
    return None


def process_platform_runbook_freshness_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(RunbookFreshnessReviewPayload, job.payload)
    blockers: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    now = datetime.now(timezone.utc)
    max_staleness_days = int(payload.thresholds.get("maxStalenessDays", payload.max_staleness_days) or payload.max_staleness_days)
    required = {str(item).strip().lower() for item in payload.required_runbooks if str(item).strip()}
    found_required: set[str] = set()
    summaries: list[dict[str, Any]] = []
    if not payload.runbooks:
        blockers.append({"section": "runbooks", "reason": "no runbook metadata supplied"})
    for index, runbook in enumerate(payload.runbooks[:500]):
        name = str(runbook.get("name") or runbook.get("title") or runbook.get("type") or f"runbook-{index}")
        category = str(runbook.get("category") or runbook.get("type") or name).strip().lower()
        owner = str(runbook.get("owner") or runbook.get("ownerTeam") or "").strip()
        url = str(runbook.get("url") or runbook.get("link") or "").strip()
        reviewed = _parse_review_date(runbook.get("lastReviewedAt") or runbook.get("reviewedAt") or runbook.get("updatedAt"))
        approved = _boolish(runbook.get("approved", runbook.get("reviewApproved", False)))
        days_since = (now - reviewed).days if reviewed else None
        key = category if category in required else name.strip().lower()
        if key in required:
            found_required.add(key)
        summaries.append({"name": name, "category": category, "ownerPresent": bool(owner), "urlPresent": bool(url), "approved": approved, "lastReviewedAt": reviewed.isoformat() if reviewed else None, "daysSinceReview": days_since, "isRequired": key in required})
        if payload.require_owner and not owner:
            blockers.append({"section": "runbook", "runbook": name, "reason": "owner is required"})
        if not url:
            warnings.append({"section": "runbook", "runbook": name, "reason": "runbook link is missing"})
        if not reviewed:
            blockers.append({"section": "runbook", "runbook": name, "reason": "lastReviewedAt/reviewedAt is required"})
        elif days_since is not None and days_since > max_staleness_days:
            blockers.append({"section": "runbook", "runbook": name, "reason": "runbook is stale", "daysSinceReview": days_since, "maxStalenessDays": max_staleness_days})
        if payload.require_approval and not approved:
            blockers.append({"section": "runbook", "runbook": name, "reason": "approval is required"})
    missing = sorted(required - found_required)
    for category in missing:
        blockers.append({"section": "requiredRunbooks", "category": category, "reason": "required runbook category is missing"})
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    for name, status in evidence_statuses.items():
        if status in {"rollback", "failed", "fail", "blocked", "error", "critical", "block"}:
            blockers.append({"section": name, "status": status, "reason": "blocking evidence status during runbook freshness review"})
        elif status in {"hold", "warning", "warn", "incomplete", "pending", "degraded"}:
            warnings.append({"section": name, "status": status, "reason": "runbook evidence requires review"})
    decision = "rollback" if any(item.get("reason") == "runbook is stale" for item in blockers) and len(blockers) >= 3 else "hold" if blockers or warnings else "pass"
    report = {"releaseId": payload.release_id, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "runbookCount": len(payload.runbooks), "runbooks": summaries, "requiredRunbooks": sorted(required), "missingRequiredRunbooks": missing, "maxStalenessDays": max_staleness_days, "evidenceStatuses": evidence_statuses, "blockers": blockers, "warnings": warnings, "acceptanceChecks": ["Required deploy, rollback, incident, privacy and support runbooks are present.", "Runbooks have owners, approvals and recent review timestamps.", "Python review is advisory and cannot mutate docs, ownership or rollout state."], "mutatesDocumentationOrOwnership": False, "nodeOwnsRolloutAndFallback": True, "pythonRunbookFreshnessReviewIsAdvisory": True}
    artifact = artifact_store.write_json(prefix="platform-runbook-freshness-review", artifact_type="platform.runbook_freshness_review.report", payload=report, metadata={"rowCount": len(payload.runbooks), "redactionApplied": True, "piiClass": "runbook-metadata-only", "source": "python-runbook-freshness-review"})
    return _result(job, "platform.runbook_freshness_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["runbook freshness review is advisory; Python did not mutate docs or ownership"], [artifact])


def process_platform_support_escalation_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(SupportEscalationReviewPayload, job.payload)
    blockers: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    max_ack = int(payload.thresholds.get("maxAckMinutes", 30) or 30)
    max_escalation = int(payload.thresholds.get("maxEscalationMinutes", 60) or 60)
    tier_summaries: list[dict[str, Any]] = []
    path_summaries: list[dict[str, Any]] = []
    if not payload.support_tiers:
        blockers.append({"section": "supportTiers", "reason": "no support tier metadata supplied"})
    if not payload.escalation_paths:
        blockers.append({"section": "escalationPaths", "reason": "no escalation path metadata supplied"})
    for index, tier in enumerate(payload.support_tiers[:100]):
        name = str(tier.get("name") or tier.get("tier") or f"tier-{index}")
        owner = str(tier.get("owner") or tier.get("ownerTeam") or tier.get("team") or "").strip()
        coverage = str(tier.get("coverage") or tier.get("hours") or "business-hours").strip().lower()
        ack = _intish(tier.get("ackMinutes") or tier.get("targetAckMinutes") or tier.get("slaMinutes") or max_ack)
        comms = _boolish(tier.get("customerComms", tier.get("customerCommunication", False)))
        tier_summaries.append({"name": name, "ownerPresent": bool(owner), "coverage": coverage, "ackMinutes": ack, "customerComms": comms})
        if payload.require_named_owner and not owner:
            blockers.append({"section": "supportTier", "tier": name, "reason": "named owner is required"})
        if payload.require_24x7 and "24" not in coverage and "always" not in coverage:
            blockers.append({"section": "supportTier", "tier": name, "reason": "24x7 coverage is required"})
        if ack > max_ack:
            blockers.append({"section": "supportTier", "tier": name, "reason": "ack target exceeds threshold", "ackMinutes": ack, "maxAckMinutes": max_ack})
        if payload.require_customer_comms and not comms:
            warnings.append({"section": "supportTier", "tier": name, "reason": "customer communication process is missing"})
    for index, path in enumerate(payload.escalation_paths[:100]):
        name = str(path.get("name") or path.get("path") or f"path-{index}")
        from_tier = str(path.get("from") or path.get("fromTier") or "").strip()
        to_tier = str(path.get("to") or path.get("toTier") or path.get("target") or "").strip()
        trigger = str(path.get("trigger") or path.get("condition") or "").strip()
        max_minutes = _intish(path.get("maxMinutes") or path.get("targetMinutes") or max_escalation)
        enabled = _boolish(path.get("enabled", True))
        path_summaries.append({"name": name, "fromTier": from_tier, "toTier": to_tier, "triggerPresent": bool(trigger), "maxMinutes": max_minutes, "enabled": enabled})
        if not enabled:
            blockers.append({"section": "escalationPath", "path": name, "reason": "escalation path is disabled"})
        if not from_tier or not to_tier:
            blockers.append({"section": "escalationPath", "path": name, "reason": "from/to tiers are required"})
        if not trigger:
            warnings.append({"section": "escalationPath", "path": name, "reason": "trigger condition is missing"})
        if max_minutes > max_escalation:
            blockers.append({"section": "escalationPath", "path": name, "reason": "escalation target exceeds threshold", "maxMinutes": max_minutes, "maxEscalationMinutes": max_escalation})
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    for name, status in evidence_statuses.items():
        if status in {"rollback", "failed", "fail", "blocked", "error", "critical", "block"}:
            blockers.append({"section": name, "status": status, "reason": "blocking evidence status during support escalation review"})
        elif status in {"hold", "warning", "warn", "incomplete", "pending", "degraded"}:
            warnings.append({"section": name, "status": status, "reason": "support evidence requires review"})
    decision = "rollback" if any(item.get("reason") in {"24x7 coverage is required", "ack target exceeds threshold", "escalation path is disabled"} for item in blockers) else "hold" if blockers or warnings else "pass"
    report = {"releaseId": payload.release_id, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "supportTierCount": len(payload.support_tiers), "escalationPathCount": len(payload.escalation_paths), "supportTiers": tier_summaries, "escalationPaths": path_summaries, "thresholds": {"maxAckMinutes": max_ack, "maxEscalationMinutes": max_escalation, "require24x7": payload.require_24x7}, "evidenceStatuses": evidence_statuses, "blockers": blockers, "warnings": warnings, "acceptanceChecks": ["Support tiers have named owners and ack targets.", "Escalation paths are enabled and documented.", "Python review is advisory; paging/ticketing/on-call remains operator-owned."], "mutatesOnCallOrTicketing": False, "nodeOwnsIncidentAndRollbackExecution": True, "pythonSupportEscalationReviewIsAdvisory": True}
    artifact = artifact_store.write_json(prefix="platform-support-escalation-review", artifact_type="platform.support_escalation_review.report", payload=report, metadata={"rowCount": len(payload.support_tiers) + len(payload.escalation_paths), "redactionApplied": True, "piiClass": "support-escalation-metadata-only", "source": "python-support-escalation-review"})
    return _result(job, "platform.support_escalation_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["support escalation review is advisory; Python did not page teams or mutate support tools"], [artifact])


def _money_value(mapping: dict[str, Any], *keys: str) -> float:
    for key in keys:
        if key in mapping:
            return _floatish(mapping.get(key), 0.0)
    return 0.0

def process_platform_cost_guardrail_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(CostGuardrailReviewPayload, job.payload)
    costs, budgets, forecast, thresholds = payload.costs or {}, payload.budgets or {}, payload.forecast or {}, payload.thresholds or {}
    blockers: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    daily_cost = _money_value(costs, "dailyCost", "daily", "today")
    monthly_forecast = _money_value(forecast, "monthlyForecast", "forecastMonthly", "monthEndEstimate") or _money_value(costs, "monthlyForecast", "forecastMonthly")
    monthly_budget = _money_value(budgets, "monthlyBudget", "month", "budget")
    worker_cost = _money_value(costs, "workerCost", "pythonWorkerCost", "workers")
    queue_cost = _money_value(costs, "queueCost", "redisCost", "queues")
    artifact_storage_cost = _money_value(costs, "artifactStorageCost", "artifactCost", "storage")
    max_daily_cost = _money_value(thresholds, "maxDailyCost", "dailyMax") or _money_value(budgets, "maxDailyCost")
    if max_daily_cost and daily_cost > max_daily_cost: blockers.append({"section":"dailyCost","reason":"daily cost exceeds guardrail","dailyCost":daily_cost,"maxDailyCost":max_daily_cost})
    if monthly_budget and monthly_forecast > monthly_budget: blockers.append({"section":"forecast","reason":"monthly forecast exceeds budget","monthlyForecast":monthly_forecast,"monthlyBudget":monthly_budget})
    if payload.require_forecast and not monthly_forecast: blockers.append({"section":"forecast","reason":"monthly forecast evidence missing"})
    if payload.require_worker_costs and worker_cost <= 0: warnings.append({"section":"workerCost","reason":"worker cost evidence missing or zero"})
    if payload.require_artifact_storage_costs and artifact_storage_cost <= 0: warnings.append({"section":"artifactStorageCost","reason":"artifact storage cost evidence missing or zero"})
    for key, value in {"maxWorkerCost": worker_cost, "maxQueueCost": queue_cost, "maxArtifactStorageCost": artifact_storage_cost}.items():
        limit = _money_value(thresholds, key)
        if limit and value > limit: blockers.append({"section":key,"reason":"cost exceeds threshold","value":value,"limit":limit})
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    for name, status in evidence_statuses.items():
        if status in {"rollback","failed","fail","blocked","error","critical","block"}: blockers.append({"section":name,"status":status,"reason":"blocking evidence status during cost review"})
        elif status in {"hold","warning","warn","incomplete","pending","degraded"}: warnings.append({"section":name,"status":status,"reason":"cost evidence requires review"})
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId":payload.release_id,"domain":payload.domain,"route":payload.route,"jobTypes":payload.job_types,"decision":decision,"costSummary":{"dailyCost":daily_cost,"monthlyForecast":monthly_forecast,"monthlyBudget":monthly_budget,"workerCost":worker_cost,"queueCost":queue_cost,"artifactStorageCost":artifact_storage_cost},"evidenceStatuses":evidence_statuses,"blockers":blockers,"warnings":warnings,"acceptanceChecks":["Daily and monthly forecast costs are inside guardrails.","Worker, queue and artifact storage cost evidence is present.","Python review is advisory and aggregate-only."],"mutatesBillingOrCloudResources":False,"pythonCostGuardrailReviewIsAdvisory":True}
    artifact = artifact_store.write_json(prefix="platform-cost-guardrail-review", artifact_type="platform.cost_guardrail_review.report", payload=report, metadata={"rowCount":1,"redactionApplied":True,"piiClass":"finops-aggregate-cost-metadata-only","source":"python-cost-guardrail-review"})
    return _result(job,"platform.cost_guardrail_review.completed",{**report,"artifactGenerated":True,"artifact":model_dump(artifact, by_alias=True, mode="json")},["cost guardrail review is advisory; Python did not query or mutate billing providers"],[artifact])

def _env_map(mapping: dict[str, Any]) -> dict[str, Any]:
    env = mapping.get("env") or mapping.get("variables") or mapping.get("keys") or {}
    return env if isinstance(env, dict) else {str(item): True for item in env} if isinstance(env, list) else {}

def _env_services(mapping: dict[str, Any]) -> set[str]:
    services = mapping.get("services") or mapping.get("dependencies") or []
    if isinstance(services, dict): return {str(k) for k, v in services.items() if _boolish(v if not isinstance(v, dict) else v.get("enabled", v.get("present", True)))}
    if isinstance(services, list): return {str(item.get("name") if isinstance(item, dict) else item) for item in services if item}
    return set()

def _env_fingerprints(mapping: dict[str, Any]) -> dict[str, str]:
    fps = mapping.get("secretFingerprints") or mapping.get("secret_fingerprints") or mapping.get("secrets") or {}
    return {str(k): str(v.get("fingerprint") if isinstance(v, dict) else v) for k, v in fps.items()} if isinstance(fps, dict) else {}

def process_platform_environment_parity_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(EnvironmentParityReviewPayload, job.payload)
    staging_env, production_env = _env_map(payload.staging), _env_map(payload.production)
    staging_keys, production_keys = set(staging_env), set(production_env)
    staging_services, production_services = _env_services(payload.staging), _env_services(payload.production)
    blockers: list[dict[str, Any]] = []; warnings: list[dict[str, Any]] = []; allow=set(payload.drift_allowlist)
    miss_st=[k for k in payload.required_keys if k not in staging_keys]; miss_pr=[k for k in payload.required_keys if k not in production_keys]
    if miss_st: blockers.append({"section":"staging","reason":"required environment keys missing","missingKeys":miss_st})
    if miss_pr: blockers.append({"section":"production","reason":"required environment keys missing","missingKeys":miss_pr})
    unmatched=sorted((staging_keys ^ production_keys) - allow)
    if unmatched: blockers.append({"section":"envKeys","reason":"staging/production key drift outside allowlist","keys":unmatched})
    svc_st=[s for s in payload.required_services if s not in staging_services]; svc_pr=[s for s in payload.required_services if s not in production_services]
    if svc_st: blockers.append({"section":"stagingServices","reason":"required service missing in staging","services":svc_st})
    if svc_pr: blockers.append({"section":"productionServices","reason":"required service missing in production","services":svc_pr})
    if payload.require_hmac_parity:
        for key in ("PYTHON_WORKER_REQUIRE_SIGNATURE","PYTHON_SERVICES_SHARED_SECRET_NAME","PYTHON_SERVICES_SHARED_SECRET_FINGERPRINT"):
            if key in staging_env and key in production_env and str(staging_env[key]) != str(production_env[key]): blockers.append({"section":"hmac","reason":"HMAC/signature setting differs","key":key})
    st_fps, pr_fps = _env_fingerprints(payload.staging), _env_fingerprints(payload.production)
    if payload.require_secret_fingerprints:
        if not st_fps or not pr_fps: warnings.append({"section":"secretFingerprints","reason":"secret fingerprint evidence missing"})
        mismatched=[n for n in sorted(set(st_fps)&set(pr_fps)) if st_fps[n] != pr_fps[n]]
        if mismatched: blockers.append({"section":"secretFingerprints","reason":"secret fingerprint drift","secrets":mismatched})
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    for name, status in evidence_statuses.items():
        if status in {"rollback","failed","fail","blocked","error","critical","block"}: blockers.append({"section":name,"status":status,"reason":"blocking evidence status during environment parity review"})
        elif status in {"hold","warning","warn","incomplete","pending","degraded"}: warnings.append({"section":name,"status":status,"reason":"environment evidence requires review"})
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report={"releaseId":payload.release_id,"domain":payload.domain,"route":payload.route,"jobTypes":payload.job_types,"decision":decision,"requiredKeys":payload.required_keys,"requiredServices":payload.required_services,"driftAllowlist":payload.drift_allowlist,"keySummary":{"stagingCount":len(staging_keys),"productionCount":len(production_keys),"unmatchedKeys":unmatched},"serviceSummary":{"staging":sorted(staging_services),"production":sorted(production_services)},"evidenceStatuses":evidence_statuses,"blockers":blockers,"warnings":warnings,"acceptanceChecks":["Required env vars and services exist in staging and production.","Secret values are never sent; only names or fingerprints are compared.","HMAC/signature settings match before rollout."],"containsSecretValues":False,"mutatesEnvironment":False,"pythonEnvironmentParityReviewIsAdvisory":True}
    artifact=artifact_store.write_json(prefix="platform-environment-parity-review", artifact_type="platform.environment_parity_review.report", payload=report, metadata={"rowCount":len(payload.required_keys)+len(payload.required_services),"redactionApplied":True,"piiClass":"environment-config-metadata-only","source":"python-environment-parity-review"})
    return _result(job,"platform.environment_parity_review.completed",{**report,"artifactGenerated":True,"artifact":model_dump(artifact, by_alias=True, mode="json")},["environment parity review is advisory; Python did not read secret values or mutate environment configuration"],[artifact])


def _canonical_review_key(value: Any) -> str:
    return "".join(ch for ch in str(value).strip().lower() if ch.isalnum())


def _status_is_pass(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"pass", "passed", "ok", "success", "succeeded", "denied", "blocked", "true"}


def _outcome_denied(value: Any) -> bool:
    return str(value).strip().lower() in {"denied", "deny", "blocked", "forbidden", "403", "unauthorized", "not_allowed", "not allowed"}


def _collect_access_control_names(payload: AccessControlReviewPayload) -> set[str]:
    names: set[str] = set()
    for item in payload.controls:
        for key in ("name", "type", "control", "category"):
            if item.get(key):
                names.add(_canonical_review_key(item[key]))
        if _boolish(item.get("enabled", item.get("present", False))):
            names.add(_canonical_review_key(item.get("name") or item.get("type") or item.get("control") or "control"))
    if payload.authorization_matrix:
        names.update({"rbac", "authorizationmatrix"})
    if payload.abac_policies:
        names.update({"abac", "abacpolicies"})
    if payload.object_access_tests:
        names.update({"objectlevelauth", "bola", "objectaccesstests"})
    if payload.negative_tests:
        names.update({"negativecrossorgtests", "negativetests"})
    evidence_keys = {_canonical_review_key(key) for key in payload.evidence.keys()}
    for key in evidence_keys:
        if "rbac" in key:
            names.add("rbac")
        if "abac" in key:
            names.add("abac")
        if "object" in key or "bola" in key:
            names.update({"objectlevelauth", "bola"})
        if "crossorg" in key or "negative" in key:
            names.add("negativecrossorgtests")
    return {name for name in names if name}


def process_platform_access_control_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(AccessControlReviewPayload, job.payload)
    blockers: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    all_tests = (payload.test_results or []) + (payload.object_access_tests or []) + (payload.negative_tests or [])
    control_names = _collect_access_control_names(payload)
    required = {_canonical_review_key(item) for item in payload.required_controls}
    aliases = {
        "objectlevelauth": {"objectlevelauth", "objectaccess", "objectaccesstests", "bola"},
        "negativecrossorgtests": {"negativecrossorgtests", "crossorg", "crosstenant", "negativetests"},
    }
    missing_controls = []
    for control in sorted(required):
        candidates = aliases.get(control, {control})
        if not (control_names & candidates):
            missing_controls.append(control)
    if missing_controls:
        blockers.append({"section": "controls", "reason": "required authorization controls are missing", "missingControls": missing_controls})
    if not all_tests:
        warnings.append({"section": "tests", "reason": "no authorization test results supplied"})

    test_summaries: list[dict[str, Any]] = []
    negative_cross_org_count = 0
    bola_negative_count = 0
    failed_authz_tests = 0
    bypass_failures = 0
    for index, item in enumerate(all_tests[:1000]):
        name = str(item.get("name") or item.get("id") or item.get("case") or f"authz-test-{index}")
        category_text = " ".join(str(item.get(key, "")) for key in ("type", "category", "control", "scope", "name"))
        canonical = _canonical_review_key(category_text)
        passed = _status_is_pass(item.get("passed", item.get("status", item.get("result", item.get("actualOutcome")))))
        expected = item.get("expectedOutcome") or item.get("expected") or item.get("should")
        actual = item.get("actualOutcome") or item.get("actual") or item.get("outcome") or item.get("status")
        is_cross_org = _boolish(item.get("crossOrg", item.get("crossOrganization", False))) or "crossorg" in canonical or "crosstenant" in canonical
        is_bola = _boolish(item.get("objectLevel", item.get("bola", False))) or "bola" in canonical or "object" in canonical
        is_negative = _boolish(item.get("negative", False)) or "negative" in canonical or str(expected).strip().lower() in {"denied", "deny", "blocked", "forbidden", "403"}
        denied = _outcome_denied(actual)
        summary = {"name": name, "passed": passed, "expectedOutcome": expected, "actualOutcome": actual, "crossOrg": is_cross_org, "objectLevelOrBola": is_bola, "negative": is_negative}
        test_summaries.append(summary)
        if is_negative and is_cross_org:
            negative_cross_org_count += 1
            if not denied or not passed:
                bypass_failures += 1
                blockers.append({"section": "negativeCrossOrgTests", "test": name, "reason": "negative cross-org test did not produce a clean deny"})
        if is_negative and is_bola:
            bola_negative_count += 1
            if not denied or not passed:
                bypass_failures += 1
                blockers.append({"section": "objectLevelAuth", "test": name, "reason": "BOLA/object-level negative test did not produce a clean deny"})
        if not passed:
            failed_authz_tests += 1
            warnings.append({"section": "tests", "test": name, "reason": "authorization test result was not passing"})
    if payload.require_cross_org_denies and negative_cross_org_count == 0:
        blockers.append({"section": "negativeCrossOrgTests", "reason": "negative cross-org deny evidence is required"})
    if payload.require_bola_negative_tests and bola_negative_count == 0:
        blockers.append({"section": "objectLevelAuth", "reason": "BOLA/object-level negative deny evidence is required"})

    evidence_statuses = _evidence_status_map(payload.evidence or {})
    for name, status in evidence_statuses.items():
        if status in {"rollback", "failed", "fail", "blocked", "error", "critical", "block"}:
            blockers.append({"section": name, "status": status, "reason": "blocking evidence status during access control review"})
        elif status in {"hold", "warning", "warn", "incomplete", "pending", "degraded"}:
            warnings.append({"section": name, "status": status, "reason": "access control evidence requires review"})
    decision = "rollback" if bypass_failures or any(item.get("section") in {"negativeCrossOrgTests", "objectLevelAuth"} for item in blockers) else "hold" if blockers or warnings else "pass"
    report = {
        "releaseId": payload.release_id,
        "domain": payload.domain,
        "route": payload.route,
        "jobTypes": payload.job_types,
        "decision": decision,
        "requiredControls": payload.required_controls,
        "presentControls": sorted(control_names),
        "missingControls": missing_controls,
        "testSummary": {"total": len(all_tests), "negativeCrossOrg": negative_cross_org_count, "bolaOrObjectLevelNegative": bola_negative_count, "failed": failed_authz_tests, "bypassFailures": bypass_failures},
        "tests": test_summaries,
        "evidenceStatuses": evidence_statuses,
        "blockers": blockers,
        "warnings": warnings,
        "acceptanceChecks": [
            "RBAC, ABAC and object-level authorization evidence is present before rollout.",
            "Negative cross-org and BOLA tests deny access without bypasses.",
            "Python review is advisory; Node remains owner of auth, RBAC/ABAC, object scope and Prisma writes.",
        ],
        "mutatesAuthorization": False,
        "nodeOwnsAuthzAndObjectScope": True,
        "pythonAccessControlReviewIsAdvisory": True,
    }
    artifact = artifact_store.write_json(prefix="platform-access-control-review", artifact_type="platform.access_control_review.report", payload=report, metadata={"rowCount": len(all_tests), "redactionApplied": True, "piiClass": "authorization-evidence-metadata-only", "source": "python-access-control-review"})
    return _result(job, "platform.access_control_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["access control review is advisory; Python did not evaluate live permissions or mutate authorization state"], [artifact])


def _dataset_metric(dataset: dict[str, Any], metrics: dict[str, Any], name: str, *keys: str, default: Any = None) -> Any:
    for key in keys:
        if key in dataset:
            return dataset[key]
    metric_bucket = metrics.get(name) if isinstance(metrics.get(name), dict) else None
    if metric_bucket:
        for key in keys:
            if key in metric_bucket:
                return metric_bucket[key]
    return default


def process_platform_data_quality_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(DataQualityReviewPayload, job.payload)
    blockers: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    datasets = payload.datasets[:1000]
    max_freshness = _intish(payload.thresholds.get("maxFreshnessMinutes", payload.max_freshness_minutes), payload.max_freshness_minutes)
    max_null_rate = _floatish(payload.thresholds.get("maxNullRate", payload.max_null_rate), payload.max_null_rate)
    max_duplicate_rate = _floatish(payload.thresholds.get("maxDuplicateRate", payload.max_duplicate_rate), payload.max_duplicate_rate)
    allowed_pii = {str(item).strip().lower() for item in payload.allowed_pii_classes}
    if not datasets:
        blockers.append({"section": "datasets", "reason": "no data quality dataset metrics supplied"})

    dataset_summaries: list[dict[str, Any]] = []
    stale_count = 0
    null_rate_failures = 0
    duplicate_rate_failures = 0
    schema_failures = 0
    redaction_failures = 0
    for index, dataset in enumerate(datasets):
        name = str(dataset.get("name") or dataset.get("dataset") or dataset.get("table") or f"dataset-{index}")
        freshness = _intish(_dataset_metric(dataset, payload.metrics, name, "freshnessMinutes", "ageMinutes", "freshnessAgeMinutes", "lagMinutes", default=0), 0)
        null_rate = _floatish(_dataset_metric(dataset, payload.metrics, name, "nullRate", "maxNullRate", default=0.0), 0.0)
        duplicate_rate = _floatish(_dataset_metric(dataset, payload.metrics, name, "duplicateRate", "dupeRate", default=0.0), 0.0)
        schema_version = str(dataset.get("schemaVersion") or dataset.get("schema_version") or "")
        expected_schema = str(dataset.get("expectedSchemaVersion") or payload.expected_schema_version or "")
        redaction_applied = _boolish(dataset.get("redactionApplied", dataset.get("redacted", True)))
        pii_class = str(dataset.get("piiClass") or dataset.get("classification") or "metadata-only").strip().lower()
        sensitive_present = dataset.get("sensitiveFieldsPresent") or dataset.get("forbiddenSensitiveFields") or []
        if isinstance(sensitive_present, bool):
            sensitive_count = 1 if sensitive_present else 0
        elif isinstance(sensitive_present, list):
            sensitive_count = len(sensitive_present)
        else:
            sensitive_count = 0
        summary = {"name": name, "freshnessMinutes": freshness, "nullRate": null_rate, "duplicateRate": duplicate_rate, "schemaVersion": schema_version or None, "expectedSchemaVersion": expected_schema or None, "redactionApplied": redaction_applied, "piiClass": pii_class, "sensitiveFieldCount": sensitive_count}
        dataset_summaries.append(summary)
        if "freshness" in {_canonical_review_key(item) for item in payload.required_checks} and freshness > max_freshness:
            stale_count += 1
            blockers.append({"section": "freshness", "dataset": name, "reason": "freshness exceeds threshold", "freshnessMinutes": freshness, "maxFreshnessMinutes": max_freshness})
        if null_rate > max_null_rate:
            null_rate_failures += 1
            blockers.append({"section": "nullRate", "dataset": name, "reason": "null rate exceeds threshold", "nullRate": null_rate, "maxNullRate": max_null_rate})
        if duplicate_rate > max_duplicate_rate:
            duplicate_rate_failures += 1
            blockers.append({"section": "duplicateRate", "dataset": name, "reason": "duplicate rate exceeds threshold", "duplicateRate": duplicate_rate, "maxDuplicateRate": max_duplicate_rate})
        if expected_schema and schema_version != expected_schema:
            schema_failures += 1
            blockers.append({"section": "schemaVersion", "dataset": name, "reason": "schema version does not match expected version", "schemaVersion": schema_version or None, "expectedSchemaVersion": expected_schema})
        if payload.require_redaction and (not redaction_applied or pii_class not in allowed_pii or sensitive_count > 0):
            redaction_failures += 1
            blockers.append({"section": "redaction", "dataset": name, "reason": "redaction/classification evidence is not acceptable", "redactionApplied": redaction_applied, "piiClass": pii_class, "sensitiveFieldCount": sensitive_count})
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    for name, status in evidence_statuses.items():
        if status in {"rollback", "failed", "fail", "blocked", "error", "critical", "block"}:
            blockers.append({"section": name, "status": status, "reason": "blocking evidence status during data quality review"})
        elif status in {"hold", "warning", "warn", "incomplete", "pending", "degraded"}:
            warnings.append({"section": name, "status": status, "reason": "data quality evidence requires review"})
    decision = "rollback" if redaction_failures else "hold" if blockers or warnings else "pass"
    report = {
        "releaseId": payload.release_id,
        "domain": payload.domain,
        "route": payload.route,
        "jobTypes": payload.job_types,
        "decision": decision,
        "datasetCount": len(datasets),
        "datasets": dataset_summaries,
        "thresholds": {"maxFreshnessMinutes": max_freshness, "maxNullRate": max_null_rate, "maxDuplicateRate": max_duplicate_rate},
        "failureSummary": {"staleDatasets": stale_count, "nullRateFailures": null_rate_failures, "duplicateRateFailures": duplicate_rate_failures, "schemaFailures": schema_failures, "redactionFailures": redaction_failures},
        "evidenceStatuses": evidence_statuses,
        "blockers": blockers,
        "warnings": warnings,
        "acceptanceChecks": [
            "Freshness, null-rate and duplicate-rate metrics are inside thresholds.",
            "Schema version evidence matches the expected contract version.",
            "Samples/artifacts are redacted and classified as aggregate or metadata-only before Python review.",
        ],
        "mutatesDataOrSchemas": False,
        "nodeOwnsSourceQueriesAndRepairs": True,
        "pythonDataQualityReviewIsAdvisory": True,
    }
    artifact = artifact_store.write_json(prefix="platform-data-quality-review", artifact_type="platform.data_quality_review.report", payload=report, metadata={"rowCount": len(datasets), "redactionApplied": True, "piiClass": "data-quality-aggregate-metadata-only", "source": "python-data-quality-review"})
    return _result(job, "platform.data_quality_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["data quality review is advisory; Python did not read source rows or mutate schemas/data"], [artifact])


def _passed_status(value: Any) -> bool | None:
    if isinstance(value, dict):
        explicit = _as_bool(value.get("passed"))
        if explicit is not None:
            return explicit
        ok = _as_bool(value.get("ok"))
        if ok is not None:
            return ok
        status = _status_value(value, "status", "decision", "recommendation", "result", "outcome")
        if status in {"pass", "passed", "ok", "healthy", "success", "succeeded", "advance", "ready", "clean"}:
            return True
        if status in {"fail", "failed", "error", "unhealthy", "rollback", "block", "blocked"}:
            return False
        if status in {"hold", "warn", "warning", "missing", "unknown"}:
            return None
    return _as_bool(value)


def _collect_named_statuses(items: list[dict[str, Any]], *, name_keys: tuple[str, ...] = ("name", "check", "id")) -> dict[str, dict[str, Any]]:
    collected: dict[str, dict[str, Any]] = {}
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        name = None
        for key in name_keys:
            if item.get(key):
                name = str(item.get(key))
                break
        if not name:
            name = f"check-{index}"
        collected[name] = item
    return collected


def process_platform_ci_staging_validation_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(CiStagingValidationReviewPayload, job.payload)
    checks_by_name = _collect_named_statuses(payload.checks)
    blockers: list[str] = []
    warnings: list[str] = []
    checks: list[dict[str, Any]] = []

    def add_check(name: str, source: dict[str, Any] | None, *, required: bool = True, detail: str | None = None) -> None:
        source = source or {}
        status = _passed_status(source)
        passed = status is True
        missing = status is None and not source
        if required and not passed:
            if missing:
                blockers.append(f"required check {name} is missing")
            else:
                blockers.append(f"required check {name} did not pass")
        elif status is None:
            warnings.append(f"check {name} is inconclusive")
        checks.append({
            "name": name,
            "required": required,
            "passed": passed,
            "status": _status_value(source, "status", "decision", "recommendation", "result", "outcome") or ("missing" if missing else "unknown"),
            "detail": detail or str(source.get("detail") or source.get("summary") or "")[:240],
        })

    for required in payload.required_checks:
        source = checks_by_name.get(required) or checks_by_name.get(required.replace("-", "_"))
        add_check(required, source, required=True)

    build_contracts = payload.builds.get("contracts", {}) if isinstance(payload.builds, dict) else {}
    build_api = payload.builds.get("api", {}) if isinstance(payload.builds, dict) else {}
    npm_ci = payload.builds.get("npmCi", payload.builds.get("npm-ci", {})) if isinstance(payload.builds, dict) else {}
    if payload.require_ts_build:
        add_check("npm-ci-evidence", npm_ci if isinstance(npm_ci, dict) else {"status": npm_ci}, required=True)
        add_check("build-contracts-evidence", build_contracts if isinstance(build_contracts, dict) else {"status": build_contracts}, required=True)
        add_check("build-api-evidence", build_api if isinstance(build_api, dict) else {"status": build_api}, required=True)

    python_tests = payload.evidence.get("pythonTests", {}) if isinstance(payload.evidence, dict) else {}
    if payload.require_python_tests:
        add_check("python-tests-evidence", python_tests if isinstance(python_tests, dict) else {"status": python_tests}, required=True)

    if payload.require_docker_smoke:
        add_check("docker-compose-smoke-evidence", payload.docker, required=True)

    if payload.require_signed_bridge:
        signature_required = _as_bool(payload.hmac.get("signatureRequired")) if isinstance(payload.hmac, dict) else None
        rejects_unsigned = _as_bool(payload.hmac.get("rejectsUnsigned")) if isinstance(payload.hmac, dict) else None
        accepts_signed = _as_bool(payload.hmac.get("acceptsSigned")) if isinstance(payload.hmac, dict) else None
        hmac_passed = signature_required is True and rejects_unsigned is True and accepts_signed is True
        add_check("signed-hmac-evidence", {"passed": hmac_passed, "status": "passed" if hmac_passed else "failed", "detail": "signatureRequired/rejectsUnsigned/acceptsSigned"}, required=True)

    redis_passed = _passed_status(payload.redis)
    if payload.redis and redis_passed is not True:
        warnings.append("redis status store evidence is present but not clean")
    artifact_passed = _passed_status(payload.artifact_registry)
    if payload.artifact_registry and artifact_passed is not True:
        warnings.append("artifact registry evidence is present but not clean")
    canary_passed = _passed_status(payload.canary)
    if payload.canary and canary_passed is not True:
        warnings.append("canary rollback evidence is present but not clean")
    observability_passed = _passed_status(payload.observability)
    if payload.observability and observability_passed is not True:
        warnings.append("observability evidence is present but not clean")

    failed_checks = sum(1 for item in checks if item["required"] and not item["passed"])
    passed_checks = sum(1 for item in checks if item["passed"])
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    next_actions = [
        "Attach the generated report to the release ticket before canary increase.",
        "Run npm ci, build:contracts, build:api, Python tests and Docker/Compose smoke in CI/staging with real dependencies.",
    ]
    if decision == "rollback":
        next_actions.insert(0, "Keep HYBRID_PYTHON_CANARY_PERCENT=0 and route affected traffic to Node until blockers are remediated.")
    elif decision == "hold":
        next_actions.insert(0, "Hold further promotion until inconclusive or warning evidence is replaced with passing staging evidence.")

    report = {
        "releaseId": payload.release_id,
        "domain": payload.domain,
        "route": payload.route,
        "jobTypes": payload.job_types,
        "decision": decision,
        "passedChecks": passed_checks,
        "failedRequiredChecks": failed_checks,
        "checks": checks,
        "blockers": blockers,
        "warnings": warnings,
        "nextActions": next_actions,
        "technicalChecklistCovered": payload.required_checks,
        "mutatesCiOrStaging": False,
        "pythonValidationIsAdvisory": True,
        "nodeCiOwnsExecution": True,
    }
    artifact = artifact_store.write_json(prefix="platform-ci-staging-validation-review", artifact_type="platform.ci_staging_validation_review.report", payload=report, metadata={"rowCount": len(checks), "redactionApplied": True, "piiClass": "ci-staging-validation-metadata-only", "source": "python-ci-staging-validation-review"})
    return _result(job, "platform.ci_staging_validation_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["CI/staging validation review is advisory; Python did not run builds, Docker, smoke tests or deployment commands"], [artifact])


def process_platform_release_closure_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(ReleaseClosureReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    gate_summaries: list[dict[str, Any]] = []

    for gate_name in payload.required_gates:
        raw = payload.gate_results.get(gate_name) if isinstance(payload.gate_results, dict) else None
        if raw is None and isinstance(payload.gate_results, dict):
            raw = payload.gate_results.get(gate_name.replace("-", "_"))
        passed = _passed_status(raw)
        status = _status_value(raw, "decision", "recommendation", "status", "result", "outcome") if isinstance(raw, dict) else None
        present = bool(raw)
        if not present:
            blockers.append(f"required gate {gate_name} is missing")
        elif status == "rollback" or passed is False:
            blockers.append(f"required gate {gate_name} is failing or recommends rollback")
        elif status == "hold" or passed is None:
            warnings.append(f"required gate {gate_name} is not clean")
        gate_summaries.append({"name": gate_name, "present": present, "status": status or ("missing" if not present else "unknown"), "passed": passed is True})

    if payload.require_evidence_bundle and not payload.evidence_bundle:
        blockers.append("evidence bundle is required but missing")
    if payload.require_approvals:
        approved = [item for item in payload.approvals if _passed_status(item) is True or str(item.get("status", "")).lower() in {"approved", "accepted"}]
        if not approved:
            blockers.append("at least one release approval is required")
    open_risks = [risk for risk in payload.risks if str(risk.get("status", "open")).lower() not in {"closed", "mitigated", "accepted", "waived"}]
    critical_open = [risk for risk in open_risks if str(risk.get("severity", "")).lower() in {"critical", "high", "blocker"}]
    if critical_open:
        blockers.append(f"{len(critical_open)} high/critical risks remain open")
    elif open_risks and not payload.allow_known_risks:
        warnings.append(f"{len(open_risks)} known risks remain open")

    validation_status = _status_value(payload.validation_summary, "decision", "status", "overallStatus") if isinstance(payload.validation_summary, dict) else None
    if validation_status == "rollback":
        blockers.append("validation summary recommends rollback")
    elif validation_status in {"hold", "warn", "warning"}:
        warnings.append("validation summary is not clean")

    decision = "rollback" if blockers else "hold" if warnings else "pass"
    closure_state = "closed-ready" if decision == "pass" else "blocked" if decision == "rollback" else "pending-remediation"
    next_actions = []
    if decision == "pass":
        next_actions = [
            "Mark V25/V26 as replaced by the cumulative V27 closure package in release notes.",
            "Attach checksum, unzip validation output, evidence bundle and gate reports to the release ticket.",
            "Proceed only with operator-approved canary changes; Node remains the rollback authority.",
        ]
    elif decision == "rollback":
        next_actions = [
            "Do not close the stage; keep canary at 0 or rollback affected routes to Node.",
            "Remediate missing/failing gates and regenerate the closure package before retrying.",
        ]
    else:
        next_actions = [
            "Keep the stage open while warning evidence, approvals or accepted risks are completed.",
            "Re-run release closure review with updated sanitized gate summaries.",
        ]

    report = {
        "releaseId": payload.release_id,
        "domain": payload.domain,
        "route": payload.route,
        "jobTypes": payload.job_types,
        "decision": decision,
        "closureState": closure_state,
        "gateSummaries": gate_summaries,
        "blockers": blockers,
        "warnings": warnings,
        "riskSummary": {"total": len(payload.risks), "open": len(open_risks), "criticalOpen": len(critical_open)},
        "approvalCount": len(payload.approvals),
        "evidenceBundlePresent": bool(payload.evidence_bundle),
        "nextActions": next_actions,
        "mutatesReleaseTicketOrDeployment": False,
        "pythonClosureReviewIsAdvisory": True,
        "nodeCiOperatorsOwnClosure": True,
    }
    artifact = artifact_store.write_json(prefix="platform-release-closure-review", artifact_type="platform.release_closure_review.report", payload=report, metadata={"rowCount": len(gate_summaries), "redactionApplied": True, "piiClass": "release-closure-evidence-metadata-only", "source": "python-release-closure-review"})
    return _result(job, "platform.release_closure_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["release closure review is advisory; Python did not approve, deploy, rollback or close external tickets"], [artifact])



def _normalize_key(value: str) -> str:
    return "".join(ch for ch in value.lower() if ch.isalnum())


def _metric_number(*sources: Any, keys: tuple[str, ...]) -> float | None:
    normalized_keys = {_normalize_key(key) for key in keys}
    for source in sources:
        if not isinstance(source, dict):
            continue
        for key, value in source.items():
            if _normalize_key(str(key)) in normalized_keys:
                try:
                    if value is None or value == "":
                        continue
                    return float(value)
                except (TypeError, ValueError):
                    continue
    return None


def _coverage_matches(item: dict[str, Any], coverage_name: str) -> bool:
    coverage_key = _normalize_key(coverage_name)
    candidate_keys = {
        _normalize_key(str(item.get("name", ""))),
        _normalize_key(str(item.get("role", ""))),
        _normalize_key(str(item.get("coverage", ""))),
        _normalize_key(str(item.get("type", ""))),
        _normalize_key(str(item.get("id", ""))),
    }
    if coverage_key in candidate_keys:
        return True
    capabilities = item.get("capabilities") or item.get("covers") or item.get("coverageAreas") or []
    if isinstance(capabilities, str):
        capabilities = [capabilities]
    if isinstance(capabilities, list):
        return coverage_key in {_normalize_key(str(value)) for value in capabilities}
    return False


def process_platform_production_canary_observation_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(ProductionCanaryObservationReviewPayload, job.payload)
    signal_map = _collect_named_statuses(payload.signals, name_keys=("name", "metric", "signal", "id"))
    blockers: list[str] = []
    warnings: list[str] = []
    evaluated_signals: list[dict[str, Any]] = []

    thresholds = dict(payload.thresholds or {})
    max_error_rate = float(thresholds.get("maxErrorRate", payload.max_error_rate))
    max_p95_latency_ms = float(thresholds.get("maxP95LatencyMs", payload.max_p95_latency_ms))
    max_mismatch_rate = float(thresholds.get("maxMismatchRate", payload.max_mismatch_rate))
    max_failed_jobs = float(thresholds.get("maxFailedJobs", payload.max_failed_jobs))
    max_queue_lag_seconds = float(thresholds.get("maxQueueLagSeconds", payload.max_queue_lag_seconds))
    max_artifact_failures = float(thresholds.get("maxArtifactFailures", payload.max_artifact_failures))
    min_sample_size = float(thresholds.get("minSampleSize", payload.min_sample_size))

    metrics = payload.metrics or {}
    comparisons = metrics.get("comparisons") if isinstance(metrics.get("comparisons"), dict) else {}
    jobs = metrics.get("jobs") if isinstance(metrics.get("jobs"), dict) else {}
    queue = metrics.get("queue") if isinstance(metrics.get("queue"), dict) else {}
    hmac = metrics.get("hmac") if isinstance(metrics.get("hmac"), dict) else {}
    artifacts = metrics.get("artifacts") if isinstance(metrics.get("artifacts"), dict) else {}

    numeric_checks = [
        ("errorRate", _metric_number(metrics, jobs, keys=("errorRate", "pythonErrorRate", "failedRate")), max_error_rate, "le"),
        ("p95LatencyMs", _metric_number(metrics, jobs, keys=("p95LatencyMs", "pythonP95LatencyMs", "latencyP95Ms")), max_p95_latency_ms, "le"),
        ("mismatchRate", _metric_number(metrics, comparisons, keys=("mismatchRate", "shadowMismatchRate")), max_mismatch_rate, "le"),
        ("failedJobs", _metric_number(metrics, jobs, keys=("failedJobs", "failedJobCount", "failures")), max_failed_jobs, "le"),
        ("queueLagSeconds", _metric_number(metrics, queue, keys=("queueLagSeconds", "lagSeconds", "maxLagSeconds")), max_queue_lag_seconds, "le"),
        ("artifactFailures", _metric_number(metrics, artifacts, keys=("artifactFailures", "failedWrites", "downloadFailures")), max_artifact_failures, "le"),
    ]
    sample_size = _metric_number(metrics, jobs, comparisons, keys=("sampleSize", "totalJobs", "totalComparisons", "count"))
    if sample_size is None:
        warnings.append("sample size is missing from production canary metrics")
    elif sample_size < min_sample_size:
        warnings.append(f"sample size {sample_size:g} is below minimum {min_sample_size:g}")

    for name in payload.required_signals:
        signal = signal_map.get(name) or signal_map.get(name.replace("-", "_")) or signal_map.get(name.replace("_", "-"))
        status = _passed_status(signal) if signal else None
        if signal and status is False:
            blockers.append(f"required production signal {name} is failing")
        elif not signal and name not in {item[0] for item in numeric_checks}:
            warnings.append(f"required production signal {name} is missing")

    for name, value, threshold, direction in numeric_checks:
        passed = value is not None and (value <= threshold if direction == "le" else value >= threshold)
        if value is None:
            warnings.append(f"metric {name} is missing")
        elif not passed:
            blockers.append(f"metric {name}={value:g} exceeds threshold {threshold:g}")
        evaluated_signals.append({"name": name, "value": value, "threshold": threshold, "passed": passed if value is not None else False})

    if payload.require_rollback_triggers:
        if not payload.rollback_triggers:
            blockers.append("rollback triggers are required but missing")
        else:
            enabled_triggers = [trigger for trigger in payload.rollback_triggers if _as_bool(trigger.get("enabled")) is not False]
            if not enabled_triggers:
                blockers.append("rollback triggers are present but none are enabled")

    trigger_fired = [trigger for trigger in payload.rollback_triggers if _as_bool(trigger.get("fired")) is True or str(trigger.get("status", "")).lower() in {"fired", "triggered", "breached"}]
    if trigger_fired:
        blockers.append(f"{len(trigger_fired)} rollback triggers are already firing")

    hmac_rejects = _metric_number(metrics, hmac, keys=("hmacRejects", "unsignedRejects", "signatureRejects"))
    if hmac_rejects is None:
        warnings.append("HMAC reject signal is missing")
    elif hmac_rejects < 0:
        blockers.append("HMAC reject signal is invalid")

    decision = "rollback" if blockers else "hold" if warnings else "pass"
    next_actions = []
    if decision == "pass":
        next_actions = [
            "Attach the canary observation report to the release evidence bundle before any operator-approved percentage increase.",
            "Continue monitoring aggregate production signals for at least the next canary window.",
        ]
    elif decision == "rollback":
        next_actions = [
            "Pause canary promotion and route affected traffic back to Node using the existing rollback path.",
            "Investigate breached aggregate signals before re-running the observation review.",
        ]
    else:
        next_actions = [
            "Hold the current canary percentage until missing or inconclusive telemetry is replaced with clean evidence.",
            "Do not advance canary solely from this advisory report; operator approval remains required.",
        ]

    report = {
        "releaseId": payload.release_id,
        "domain": payload.domain,
        "route": payload.route,
        "jobTypes": payload.job_types,
        "decision": decision,
        "windowMinutes": payload.window_minutes,
        "currentCanaryPercent": payload.current_canary_percent,
        "targetCanaryPercent": payload.target_canary_percent,
        "evaluatedSignals": evaluated_signals,
        "sampleSize": sample_size,
        "rollbackTriggerCount": len(payload.rollback_triggers),
        "rollbackTriggersFiring": len(trigger_fired),
        "blockers": blockers,
        "warnings": warnings,
        "nextActions": next_actions,
        "mutatesCanaryOrTraffic": False,
        "pythonObservationIsAdvisory": True,
        "nodeRolloutOwnsTraffic": True,
    }
    artifact = artifact_store.write_json(prefix="platform-production-canary-observation-review", artifact_type="platform.production_canary_observation_review.report", payload=report, metadata={"rowCount": len(evaluated_signals), "redactionApplied": True, "piiClass": "production-canary-observation-metadata-only", "source": "python-production-canary-observation-review"})
    return _result(job, "platform.production_canary_observation_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["production canary observation review is advisory; Python did not alter rollout state, traffic routing or alerts"], [artifact])


def process_platform_incident_response_readiness_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(IncidentResponseReadinessReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    coverage_summary: list[dict[str, Any]] = []
    all_coverage_items = payload.oncall + payload.escalation_paths + payload.runbooks
    if payload.comms:
        all_coverage_items.append({**payload.comms, "name": payload.comms.get("name") or "customerComms"})

    for coverage in payload.required_coverage:
        matched = [item for item in all_coverage_items if isinstance(item, dict) and _coverage_matches(item, coverage)]
        passed = any(_passed_status(item) is not False and _as_bool(item.get("enabled")) is not False for item in matched)
        if not matched:
            blockers.append(f"required incident coverage {coverage} is missing")
        elif not passed:
            blockers.append(f"required incident coverage {coverage} is disabled or failing")
        coverage_summary.append({"name": coverage, "present": bool(matched), "passed": passed})

    max_ack_minutes = int(payload.thresholds.get("maxAckMinutes", payload.max_ack_minutes)) if isinstance(payload.thresholds, dict) else payload.max_ack_minutes
    max_escalation_minutes = int(payload.thresholds.get("maxEscalationMinutes", payload.max_escalation_minutes)) if isinstance(payload.thresholds, dict) else payload.max_escalation_minutes

    for item in payload.oncall:
        ack = _metric_number(item, keys=("ackMinutes", "maxAckMinutes", "ackSloMinutes"))
        if ack is not None and ack > max_ack_minutes:
            blockers.append(f"on-call ack time {ack:g}m exceeds threshold {max_ack_minutes}m")
    for path in payload.escalation_paths:
        escalation = _metric_number(path, keys=("maxMinutes", "escalationMinutes", "targetMinutes"))
        if escalation is not None and escalation > max_escalation_minutes:
            blockers.append(f"escalation path {path.get('name', 'unknown')} exceeds threshold {max_escalation_minutes}m")

    if payload.require_recent_drill:
        recent_drills = [drill for drill in payload.drills if _passed_status(drill) is True or str(drill.get("status", "")).lower() in {"passed", "success", "completed"}]
        if not recent_drills:
            warnings.append("recent incident or rollback drill evidence is missing")

    comms_ready = _passed_status(payload.comms)
    if payload.comms and comms_ready is False:
        blockers.append("incident communications evidence is failing")
    elif not payload.comms:
        warnings.append("incident communications metadata is missing")

    stale_runbooks = [rb for rb in payload.runbooks if str(rb.get("status", "")).lower() in {"stale", "expired", "missing"} or _passed_status(rb) is False]
    if stale_runbooks:
        blockers.append(f"{len(stale_runbooks)} runbooks are stale, missing or failing")

    decision = "rollback" if blockers else "hold" if warnings else "pass"
    if decision == "pass":
        next_actions = [
            "Keep on-call, escalation, customer-comms and rollback-owner evidence attached to the release evidence bundle.",
            "Re-run readiness review after ownership or paging-route changes.",
        ]
    elif decision == "rollback":
        next_actions = [
            "Do not advance canary or close incident-readiness tasks until missing coverage is remediated.",
            "Confirm runbooks, paging routes and rollback owner coverage with SRE/release owners.",
        ]
    else:
        next_actions = [
            "Hold promotion until drill or communications warning evidence is refreshed.",
            "Replace free-text evidence with sanitized structured metadata before re-running.",
        ]

    report = {
        "releaseId": payload.release_id,
        "domain": payload.domain,
        "route": payload.route,
        "jobTypes": payload.job_types,
        "decision": decision,
        "coverageSummary": coverage_summary,
        "oncallCount": len(payload.oncall),
        "escalationPathCount": len(payload.escalation_paths),
        "runbookCount": len(payload.runbooks),
        "drillCount": len(payload.drills),
        "blockers": blockers,
        "warnings": warnings,
        "nextActions": next_actions,
        "mutatesOncallOrTickets": False,
        "pythonReadinessReviewIsAdvisory": True,
        "operatorsOwnIncidentResponse": True,
    }
    artifact = artifact_store.write_json(prefix="platform-incident-response-readiness-review", artifact_type="platform.incident_response_readiness_review.report", payload=report, metadata={"rowCount": len(coverage_summary), "redactionApplied": True, "piiClass": "incident-response-readiness-metadata-only", "source": "python-incident-response-readiness-review"})
    return _result(job, "platform.incident_response_readiness_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["incident-response readiness review is advisory; Python did not page responders, mutate tickets or change on-call schedules"], [artifact])



def _dict_decision(value: Any) -> str | None:
    if not isinstance(value, dict):
        return None
    for key in ("decision", "status", "result"):
        raw = value.get(key)
        if raw is None:
            continue
        normalized = str(raw).strip().lower()
        if normalized in {"pass", "passed", "success", "succeeded", "approved", "ready", "green"}:
            return "pass"
        if normalized in {"rollback", "fail", "failed", "blocked", "red", "breached"}:
            return "rollback"
        if normalized in {"hold", "warning", "pending", "missing", "unknown", "yellow"}:
            return "hold"
    return None


def _approved_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [item for item in items if _dict_decision(item) == "pass" or _as_bool(item.get("approved")) is True]


def process_platform_traffic_promotion_readiness_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(TrafficPromotionReadinessReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    gate_summary: list[dict[str, Any]] = []
    current = payload.current_canary_percent
    target = payload.target_canary_percent
    step = target - current
    if target < current:
        blockers.append("target canary percent is below current percent; use rollback controls instead of promotion")
    elif step == 0:
        warnings.append("target canary percent equals current percent; no promotion step requested")
    elif step > payload.max_promotion_step_percent:
        blockers.append(f"promotion step {step}% exceeds max allowed step {payload.max_promotion_step_percent}%")
    aliases = {"releaseClosure": ["releaseClosure", "release_closure", "platform.release_closure_review"], "productionCanaryObservation": ["productionCanaryObservation", "production_canary_observation", "platform.production_canary_observation_review"], "incidentResponseReadiness": ["incidentResponseReadiness", "incident_response_readiness", "platform.incident_response_readiness_review"], "rollbackPlan": ["rollbackPlan", "rollback_plan"], "operatorApproval": ["operatorApproval", "operator_approval", "approval"]}
    derived = {"productionCanaryObservation": payload.production_observation, "incidentResponseReadiness": payload.incident_readiness, "rollbackPlan": payload.rollback_plan, "operatorApproval": {"decision": "pass"} if _approved_items(payload.approvals) else {}}
    for required in payload.required_gates:
        evidence = None
        for candidate in aliases.get(required, [required]):
            if candidate in payload.gate_evidence:
                evidence = payload.gate_evidence[candidate]
                break
        if evidence is None and required in derived:
            evidence = derived[required]
        d = _dict_decision(evidence)
        if d == "rollback": blockers.append(f"required promotion gate {required} is failing")
        elif d == "hold": warnings.append(f"required promotion gate {required} is holding or incomplete")
        elif d != "pass": warnings.append(f"required promotion gate {required} is missing")
        gate_summary.append({"name": required, "decision": d or "missing"})
    if payload.require_clean_observation and _dict_decision(payload.production_observation) != "pass": warnings.append("clean production canary observation evidence is required before promotion")
    if payload.require_incident_readiness and _dict_decision(payload.incident_readiness) != "pass": warnings.append("incident response readiness evidence is required before promotion")
    if payload.require_operator_approval and not _approved_items(payload.approvals): blockers.append("operator approval is required before any traffic promotion")
    active_freezes = [w for w in payload.freeze_windows if _as_bool(w.get("active")) is True or str(w.get("status", "")).lower() in {"active", "blocked", "frozen"}]
    if active_freezes: blockers.append(f"{len(active_freezes)} active freeze windows block traffic promotion")
    rollback_ready = _dict_decision(payload.rollback_plan) == "pass" or _as_bool(payload.rollback_plan.get("ready")) is True
    if not rollback_ready: blockers.append("rollback plan must be present and ready before traffic promotion")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    next_actions = ["Attach this advisory report to the evidence bundle before changing traffic percentages.", "Have the Node/control-plane operator execute any promotion; Python does not mutate rollout state."] if decision == "pass" else ["Hold the current traffic percentage until promotion blockers and warnings are resolved.", "Re-run production observation and incident readiness reviews with sanitized evidence before promotion."] if decision == "hold" else ["Do not promote traffic; use the rollback path if failing production gates or active freezes are confirmed.", "Resolve blockers, refresh operator approval and re-run the promotion readiness review."]
    report = {"releaseId": payload.release_id, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "currentCanaryPercent": current, "targetCanaryPercent": target, "promotionStepPercent": step, "maxPromotionStepPercent": payload.max_promotion_step_percent, "gateSummary": gate_summary, "approvalCount": len(payload.approvals), "activeFreezeWindowCount": len(active_freezes), "rollbackPlanReady": rollback_ready, "blockers": blockers, "warnings": warnings, "nextActions": next_actions, "mutatesTrafficOrRollout": False, "pythonPromotionReviewIsAdvisory": True, "nodeControlPlaneOwnsPromotion": True}
    artifact = artifact_store.write_json(prefix="platform-traffic-promotion-readiness-review", artifact_type="platform.traffic_promotion_readiness_review.report", payload=report, metadata={"rowCount": len(gate_summary), "redactionApplied": True, "piiClass": "traffic-promotion-readiness-metadata-only", "source": "python-traffic-promotion-readiness-review"})
    return _result(job, "platform.traffic_promotion_readiness_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["traffic promotion readiness review is advisory; Python did not mutate rollout state, feature flags or traffic percentages"], [artifact])


def process_platform_evidence_retention_audit_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(EvidenceRetentionAuditReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    artifacts = list(payload.artifacts)
    bundle_artifacts = payload.evidence_bundle.get("artifacts") if isinstance(payload.evidence_bundle, dict) else None
    if isinstance(bundle_artifacts, list): artifacts.extend([x for x in bundle_artifacts if isinstance(x, dict)])
    seen_types = {str(x.get("artifactType") or x.get("type") or "") for x in artifacts}
    for t in payload.required_artifact_types:
        if t not in seen_types: warnings.append(f"required artifact type {t} is missing from retention audit evidence")
    days = _metric_number(payload.retention_policy, keys=("minRetentionDays", "retentionDays", "days"))
    if days is not None and days < payload.min_retention_days: blockers.append(f"retention policy {days:g}d is below minimum {payload.min_retention_days}d")
    allowed = set(payload.allowed_pii_classes)
    summary=[]
    for i,a in enumerate(artifacts):
        t = str(a.get("artifactType") or a.get("type") or f"artifact-{i}")
        sha = a.get("sha256") or a.get("checksum")
        pii = str(a.get("piiClass") or a.get("dataClassification") or "")
        red = _as_bool(a.get("redactionApplied"))
        prot = _as_bool(a.get("downloadProtected"))
        if prot is None: prot = not bool(a.get("downloadUrl") or a.get("publicUrl"))
        exp = a.get("expiresAt") or a.get("expiration")
        if payload.require_checksums and not sha: blockers.append(f"artifact {t} is missing sha256/checksum")
        if payload.require_redaction and red is False: blockers.append(f"artifact {t} is not marked redacted")
        elif payload.require_redaction and red is None: warnings.append(f"artifact {t} is missing redactionApplied metadata")
        if pii and pii not in allowed: blockers.append(f"artifact {t} piiClass {pii} is not allowed")
        elif not pii: warnings.append(f"artifact {t} is missing piiClass metadata")
        if payload.require_protected_downloads and not prot: blockers.append(f"artifact {t} does not show protected download metadata")
        if not exp: warnings.append(f"artifact {t} is missing expiration metadata")
        summary.append({"artifactType": t, "hasSha256": bool(sha), "piiClass": pii or None, "redactionApplied": red, "downloadProtected": prot, "expiresAt": exp})
    if not artifacts: blockers.append("no artifacts were supplied for evidence retention audit")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    next_actions = ["Keep artifact metadata attached to the release evidence bundle and preserve according to retention policy.", "Re-run the audit when artifact retention windows or piiClass policies change."] if decision == "pass" else ["Hold closure until artifact metadata includes required checksums, piiClass, redaction and retention details.", "Do not expose raw logs or payload bodies to Python; submit sanitized artifact metadata only."] if decision == "hold" else ["Treat retention audit blockers as release-closure blockers until remediated.", "Regenerate missing protected artifacts or replace disallowed piiClass evidence before proceeding."]
    report = {"releaseId": payload.release_id, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "artifactCount": len(artifacts), "artifactSummary": summary, "requiredArtifactTypes": payload.required_artifact_types, "minRetentionDays": payload.min_retention_days, "blockers": blockers, "warnings": warnings, "nextActions": next_actions, "mutatesArtifactsOrRetention": False, "pythonRetentionAuditIsAdvisory": True, "nodeArtifactRegistryOwnsDownloads": True}
    artifact = artifact_store.write_json(prefix="platform-evidence-retention-audit-review", artifact_type="platform.evidence_retention_audit_review.report", payload=report, metadata={"rowCount": len(summary), "redactionApplied": True, "piiClass": "evidence-retention-audit-metadata-only", "source": "python-evidence-retention-audit-review"})
    return _result(job, "platform.evidence_retention_audit_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["evidence retention audit review is advisory; Python did not delete, expose or mutate artifacts"], [artifact])


def process_platform_slo_error_budget_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(SloErrorBudgetReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    thresholds = dict(payload.thresholds or {})
    max_burn_rate = float(thresholds.get("maxBurnRate", payload.max_burn_rate))
    min_budget = float(thresholds.get("minErrorBudgetRemaining", payload.min_error_budget_remaining))
    max_latency = int(thresholds.get("maxP95LatencyMs", payload.max_p95_latency_ms))
    max_error_rate = float(thresholds.get("maxErrorRate", payload.max_error_rate))
    min_sample = int(thresholds.get("minSampleSize", payload.min_sample_size))

    metric_sources: list[tuple[str, dict[str, Any]]] = [("aggregate", payload.metrics)]
    for idx, svc in enumerate(payload.services):
        name = str(svc.get("name") or svc.get("service") or f"service-{idx}")
        metric_sources.append((name, svc))

    summary: list[dict[str, Any]] = []
    for name, metrics in metric_sources:
        if not isinstance(metrics, dict):
            warnings.append(f"{name} metrics are not an object")
            continue
        sample = _metric_number(metrics, keys=("sampleSize", "requests", "requestCount", "count"))
        error_rate = _metric_number(metrics, keys=("errorRate", "errorsRate"))
        p95 = _metric_number(metrics, keys=("p95LatencyMs", "latencyP95Ms", "p95"))
        burn = _metric_number(metrics, keys=("burnRate", "errorBudgetBurnRate"))
        budget = _metric_number(metrics, keys=("errorBudgetRemaining", "errorBudgetRemainingPercent", "budgetRemainingPercent"))
        availability = _metric_number(metrics, keys=("availability", "availabilityPercent"))
        if sample is not None and sample < min_sample:
            warnings.append(f"{name} sample size {sample:g} is below minimum {min_sample}")
        if error_rate is not None and error_rate > max_error_rate:
            blockers.append(f"{name} error rate {error_rate:g} exceeds {max_error_rate:g}")
        if p95 is not None and p95 > max_latency:
            blockers.append(f"{name} p95 latency {p95:g}ms exceeds {max_latency}ms")
        if burn is not None and burn > max_burn_rate:
            blockers.append(f"{name} burn rate {burn:g} exceeds {max_burn_rate:g}")
        if budget is not None and budget < min_budget:
            blockers.append(f"{name} error budget remaining {budget:g}% is below {min_budget:g}%")
        target_availability = _metric_number(payload.slo_targets, keys=("availability", "availabilityPercent"))
        if target_availability is not None and availability is not None and availability < target_availability:
            blockers.append(f"{name} availability {availability:g}% is below target {target_availability:g}%")
        for signal in payload.required_signals:
            normalized = signal.lower()
            if normalized in {"latency", "p95latencyms"} and p95 is None:
                warnings.append(f"{name} missing p95 latency signal")
            elif normalized in {"errorrate", "errors"} and error_rate is None:
                warnings.append(f"{name} missing error rate signal")
            elif normalized in {"burnrate", "errorbudgetburnrate"} and burn is None:
                warnings.append(f"{name} missing burn rate signal")
            elif normalized in {"errorbudgetremaining", "budgetremaining"} and budget is None:
                warnings.append(f"{name} missing error budget remaining signal")
            elif normalized == "availability" and availability is None:
                warnings.append(f"{name} missing availability signal")
        summary.append({"name": name, "sampleSize": sample, "errorRate": error_rate, "p95LatencyMs": p95, "burnRate": burn, "errorBudgetRemaining": budget, "availability": availability})

    alert_coverage = _as_bool(payload.evidence.get("alertCoverage"))
    if alert_coverage is None:
        alert_coverage = _as_bool(payload.metrics.get("alertCoverage"))
    if payload.require_alert_coverage and alert_coverage is not True:
        warnings.append("alert coverage evidence is required for SLO/error-budget review")
    if not payload.metrics and not payload.services:
        blockers.append("no aggregate metrics or service SLO evidence supplied")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    next_actions = ["Attach the SLO/error-budget report to promotion evidence before increasing canary traffic.", "Keep Node/control-plane responsible for alert, paging and rollout changes."] if decision == "pass" else ["Hold traffic promotion until missing SLO signals and alert coverage evidence are complete.", "Re-run production observation with aggregate SLO data and sanitized service metrics."] if decision == "hold" else ["Pause promotion or roll back via Node/control-plane because SLO/error-budget blockers breached thresholds.", "Investigate latency, error-rate or burn-rate regressions before re-running this review."]
    report = {"releaseId": payload.release_id, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "windowMinutes": payload.window_minutes, "summary": summary, "thresholds": {"maxBurnRate": max_burn_rate, "minErrorBudgetRemaining": min_budget, "maxP95LatencyMs": max_latency, "maxErrorRate": max_error_rate, "minSampleSize": min_sample}, "alertCoverage": alert_coverage, "blockers": blockers, "warnings": warnings, "nextActions": next_actions, "mutatesAlertsOrRollout": False, "pythonSloReviewIsAdvisory": True, "nodeControlPlaneOwnsRollout": True}
    artifact = artifact_store.write_json(prefix="platform-slo-error-budget-review", artifact_type="platform.slo_error_budget_review.report", payload=report, metadata={"rowCount": len(summary), "redactionApplied": True, "piiClass": "slo-error-budget-metadata-only", "source": "python-slo-error-budget-review"})
    return _result(job, "platform.slo_error_budget_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["SLO/error-budget review is advisory; Python did not mutate alerting, paging, feature flags or rollout state"], [artifact])


def process_platform_auto_rollback_safeguard_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(AutoRollbackSafeguardReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    all_items = list(payload.safeguards) + list(payload.rollback_triggers) + list(payload.feature_flags)

    def item_named(names: set[str]) -> dict[str, Any] | None:
        for item in all_items:
            label = str(item.get("name") or item.get("type") or item.get("key") or item.get("id") or "").lower()
            if label in names:
                return item
        for key, value in payload.evidence.items():
            if str(key).lower() in names and isinstance(value, dict):
                return value
            if str(key).lower() in names:
                return {"name": key, "enabled": value, "ready": value}
        return None

    aliases = {
        "automaticTrigger": {"automatictrigger", "auto-trigger", "autorollbacktrigger", "error-budget-breach", "rollback-trigger"},
        "manualOverride": {"manualoverride", "manual-override", "operatoroverride"},
        "nodeFallback": {"nodefallback", "node-fallback", "nodepath", "fallbacktonode"},
        "featureFlagKillSwitch": {"featureflagkillswitch", "kill-switch", "killswitch", "featureflag"},
        "rollbackRunbook": {"rollbackrunbook", "rollback-runbook", "runbook"},
        "recentDrill": {"recentdrill", "rollback-drill", "drill"},
    }
    safeguard_summary: list[dict[str, Any]] = []
    for required in payload.required_safeguards:
        item = item_named(aliases.get(required, {required.lower()}))
        if required == "featureFlagKillSwitch" and not item:
            for flag in payload.feature_flags:
                if _as_bool(flag.get("killSwitch")) is True or str(flag.get("type", "")).lower() in {"killswitch", "kill-switch"}:
                    item = flag
                    break
        if required == "rollbackRunbook" and not item and payload.runbook:
            item = payload.runbook
        ready = _as_bool(item.get("ready")) if isinstance(item, dict) else None
        enabled = _as_bool(item.get("enabled")) if isinstance(item, dict) else None
        decision = _dict_decision(item) if isinstance(item, dict) else None
        status = decision or ("pass" if ready is True or enabled is True else "missing")
        if status == "rollback" or ready is False or enabled is False:
            blockers.append(f"required rollback safeguard {required} is not ready")
        elif status in {"hold", "missing", None}:
            warnings.append(f"required rollback safeguard {required} is missing or incomplete")
        safeguard_summary.append({"name": required, "status": status, "ready": ready, "enabled": enabled})

    enabled_triggers = [t for t in payload.rollback_triggers if _as_bool(t.get("enabled")) is True]
    if not enabled_triggers:
        blockers.append("at least one enabled rollback trigger is required")
    fired = [t for t in payload.rollback_triggers if _as_bool(t.get("fired")) is True or str(t.get("status", "")).lower() in {"fired", "breached", "triggered"}]
    if fired:
        blockers.append(f"{len(fired)} rollback triggers are already fired/breached")
    detection = min([v for v in (_metric_number(t, keys=("detectionMinutes", "detectMinutes", "detectionMins")) for t in enabled_triggers) if v is not None], default=None)
    rollback_minutes = _metric_number(payload.evidence, keys=("rollbackMinutes", "rollbackMins", "estimatedRollbackMinutes"))
    if detection is not None and detection > payload.max_detection_minutes:
        warnings.append(f"rollback detection time {detection:g}m exceeds {payload.max_detection_minutes}m")
    if rollback_minutes is not None and rollback_minutes > payload.max_rollback_minutes:
        blockers.append(f"estimated rollback time {rollback_minutes:g}m exceeds {payload.max_rollback_minutes}m")
    if payload.require_manual_override and _as_bool(payload.evidence.get("manualOverride")) is not True and not item_named(aliases["manualOverride"]):
        blockers.append("manual rollback override evidence is required")
    if payload.require_node_fallback and _as_bool(payload.evidence.get("nodeFallback")) is not True and not item_named(aliases["nodeFallback"]):
        blockers.append("Node fallback evidence is required")
    kill_switch_items = [f for f in payload.feature_flags if _as_bool(f.get("killSwitch")) is True or str(f.get("type", "")).lower() in {"killswitch", "kill-switch"}]
    if payload.require_kill_switch and not kill_switch_items and not item_named(aliases["featureFlagKillSwitch"]):
        blockers.append("feature-flag kill switch evidence is required")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    next_actions = ["Keep rollback safeguards attached to the promotion evidence bundle.", "Use Node/control-plane to execute any rollback or feature-flag changes."] if decision == "pass" else ["Hold promotion until safeguard metadata, drill evidence and trigger timing are complete.", "Re-run after confirming manual override, Node fallback and kill switch readiness."] if decision == "hold" else ["Do not promote traffic; execute or rehearse rollback through Node/control-plane if blockers reflect production state.", "Fix breached triggers, missing kill switch or rollback timing blockers before re-running."]
    report = {"releaseId": payload.release_id, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "rolloutId": payload.rollout_id, "canaryPercent": payload.canary_percent, "decision": decision, "safeguardSummary": safeguard_summary, "enabledRollbackTriggerCount": len(enabled_triggers), "firedRollbackTriggerCount": len(fired), "detectionMinutes": detection, "rollbackMinutes": rollback_minutes, "blockers": blockers, "warnings": warnings, "nextActions": next_actions, "mutatesRollbackOrFlags": False, "pythonRollbackSafeguardReviewIsAdvisory": True, "nodeControlPlaneOwnsRollback": True}
    artifact = artifact_store.write_json(prefix="platform-auto-rollback-safeguard-review", artifact_type="platform.auto_rollback_safeguard_review.report", payload=report, metadata={"rowCount": len(safeguard_summary), "redactionApplied": True, "piiClass": "auto-rollback-safeguard-metadata-only", "source": "python-auto-rollback-safeguard-review"})
    return _result(job, "platform.auto_rollback_safeguard_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["auto-rollback safeguard review is advisory; Python did not execute rollback, mutate feature flags or alter traffic"], [artifact])




def process_platform_third_party_dependency_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(ThirdPartyDependencyReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    thresholds = dict(payload.thresholds or {})
    max_error_rate = float(thresholds.get("maxErrorRate", payload.max_error_rate))
    max_p95 = int(thresholds.get("maxP95LatencyMs", payload.max_p95_latency_ms))
    min_headroom = float(thresholds.get("minRateLimitHeadroomPercent", payload.min_rate_limit_headroom_percent))

    dependency_items: list[dict[str, Any]] = []
    for idx, item in enumerate(list(payload.dependencies) + list(payload.providers)):
        if not isinstance(item, dict):
            warnings.append(f"dependency item {idx} is not an object")
            continue
        name = str(item.get("name") or item.get("provider") or item.get("type") or f"dependency-{idx}")
        status = str(item.get("status") or item.get("health") or "unknown").lower()
        decision = _dict_decision(item)
        error_rate = _metric_number(item, keys=("errorRate", "errorsRate"))
        p95 = _metric_number(item, keys=("p95LatencyMs", "latencyP95Ms", "p95"))
        headroom = _metric_number(item, keys=("rateLimitHeadroomPercent", "headroomPercent", "quotaHeadroomPercent"))
        failover_ready = _as_bool(item.get("failoverReady"))
        dependency_items.append({"name": name, "status": status, "decision": decision, "errorRate": error_rate, "p95LatencyMs": p95, "rateLimitHeadroomPercent": headroom, "failoverReady": failover_ready})
        if decision == "rollback" or status in {"down", "degraded", "major_outage", "incident", "blocked"}:
            blockers.append(f"dependency {name} status is {status}")
        elif decision == "hold" or status in {"unknown", "partial", "maintenance"}:
            warnings.append(f"dependency {name} status requires review: {status}")
        if error_rate is not None and error_rate > max_error_rate:
            blockers.append(f"dependency {name} error rate {error_rate:g} exceeds {max_error_rate:g}")
        if p95 is not None and p95 > max_p95:
            blockers.append(f"dependency {name} p95 latency {p95:g}ms exceeds {max_p95}ms")
        if headroom is not None and headroom < min_headroom:
            blockers.append(f"dependency {name} rate-limit headroom {headroom:g}% is below {min_headroom:g}%")
        if payload.require_failover_evidence and failover_ready is not True:
            warnings.append(f"dependency {name} missing failover readiness evidence")

    normalized_names = {str(item.get("name") or item.get("provider") or item.get("type") or "").lower().replace("-", "").replace("_", "") for item in list(payload.dependencies) + list(payload.providers) if isinstance(item, dict)}
    alias_map = {
        "objectstorage": {"objectstorage", "s3", "gcs", "blobstorage", "artifactstorage"},
        "authprovider": {"authprovider", "auth", "oidc", "oauth", "clerk", "auth0"},
        "observability": {"observability", "datadog", "prometheus", "grafana", "sentry"},
    }
    for required in payload.required_dependencies:
        key = required.lower().replace("-", "").replace("_", "")
        aliases = alias_map.get(key, {key})
        if not normalized_names.intersection(aliases):
            warnings.append(f"required dependency {required} is missing from evidence")

    active_incidents = []
    for incident in payload.incidents:
        status = str(incident.get("status") or incident.get("state") or "unknown").lower() if isinstance(incident, dict) else "unknown"
        if status not in {"resolved", "closed", "mitigated", "none"}:
            active_incidents.append(incident)
    if active_incidents:
        blockers.append(f"{len(active_incidents)} active third-party incident(s) are present")

    if payload.require_status_page_clear:
        unhealthy_pages = []
        for page in payload.status_pages:
            status = str(page.get("status") or page.get("health") or "unknown").lower() if isinstance(page, dict) else "unknown"
            if status not in {"ok", "operational", "resolved", "green", "none"}:
                unhealthy_pages.append(page)
        if unhealthy_pages:
            blockers.append(f"{len(unhealthy_pages)} status page signal(s) are not clear")

    if not dependency_items:
        blockers.append("no dependency/provider evidence supplied")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    next_actions = ["Attach third-party dependency evidence to the traffic expansion bundle.", "Keep vendor configuration and failover changes owned by Node/control-plane/operators."] if decision == "pass" else ["Hold traffic expansion until missing dependency coverage and failover evidence are complete.", "Re-run with status-page, incident, error-rate, latency and rate-limit evidence."] if decision == "hold" else ["Do not expand traffic while dependency blockers or active incidents remain.", "Use Node/control-plane and operator runbooks for failover or rollback execution."]
    report = {"releaseId": payload.release_id, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "dependencySummary": dependency_items, "activeIncidentCount": len(active_incidents), "thresholds": {"maxErrorRate": max_error_rate, "maxP95LatencyMs": max_p95, "minRateLimitHeadroomPercent": min_headroom}, "blockers": blockers, "warnings": warnings, "nextActions": next_actions, "mutatesVendorConfig": False, "pythonDependencyReviewIsAdvisory": True, "nodeControlPlaneOwnsVendorActions": True}
    artifact = artifact_store.write_json(prefix="platform-third-party-dependency-review", artifact_type="platform.third_party_dependency_review.report", payload=report, metadata={"rowCount": len(dependency_items), "redactionApplied": True, "piiClass": "third-party-dependency-metadata-only", "source": "python-third-party-dependency-review"})
    return _result(job, "platform.third_party_dependency_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["third-party dependency review is advisory; Python did not call vendors or mutate provider configuration"], [artifact])


def process_platform_capacity_scaling_readiness_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(CapacityScalingReadinessReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    thresholds = dict(payload.thresholds or {})
    max_lag = int(thresholds.get("maxQueueLagSeconds", payload.max_queue_lag_seconds))
    max_cpu = float(thresholds.get("maxCpuPercent", payload.max_cpu_percent))
    max_memory = float(thresholds.get("maxMemoryPercent", payload.max_memory_percent))
    max_p95 = int(thresholds.get("maxP95LatencyMs", payload.max_p95_latency_ms))
    min_concurrency = int(thresholds.get("minWorkerConcurrency", payload.min_worker_concurrency))

    sources: list[tuple[str, dict[str, Any]]] = [("aggregate", payload.metrics)]
    for idx, queue in enumerate(payload.queues):
        if isinstance(queue, dict):
            sources.append((str(queue.get("name") or queue.get("queue") or f"queue-{idx}"), queue))
    for idx, worker in enumerate(payload.workers):
        if isinstance(worker, dict):
            sources.append((str(worker.get("name") or worker.get("pool") or f"worker-{idx}"), worker))

    summary: list[dict[str, Any]] = []
    for name, metrics in sources:
        if not isinstance(metrics, dict):
            warnings.append(f"{name} capacity metrics are not an object")
            continue
        queue_lag = _metric_number(metrics, keys=("queueLagSeconds", "lagSeconds", "oldestJobAgeSeconds"))
        cpu = _metric_number(metrics, keys=("cpuPercent", "cpuUtilizationPercent"))
        memory = _metric_number(metrics, keys=("memoryPercent", "memoryUtilizationPercent"))
        p95 = _metric_number(metrics, keys=("p95LatencyMs", "latencyP95Ms", "p95"))
        concurrency = _metric_number(metrics, keys=("workerConcurrency", "concurrency", "workers", "workerCount"))
        backlog = _metric_number(metrics, keys=("backlog", "queueDepth", "pendingJobs"))
        if queue_lag is not None and queue_lag > max_lag:
            blockers.append(f"{name} queue lag {queue_lag:g}s exceeds {max_lag}s")
        if cpu is not None and cpu > max_cpu:
            blockers.append(f"{name} cpu {cpu:g}% exceeds {max_cpu:g}%")
        if memory is not None and memory > max_memory:
            blockers.append(f"{name} memory {memory:g}% exceeds {max_memory:g}%")
        if p95 is not None and p95 > max_p95:
            blockers.append(f"{name} p95 latency {p95:g}ms exceeds {max_p95}ms")
        if concurrency is not None and concurrency < min_concurrency:
            blockers.append(f"{name} worker concurrency {concurrency:g} is below {min_concurrency}")
        if backlog is not None and backlog > 0 and queue_lag is None:
            warnings.append(f"{name} has backlog {backlog:g} but no queue lag signal")
        summary.append({"name": name, "queueLagSeconds": queue_lag, "cpuPercent": cpu, "memoryPercent": memory, "p95LatencyMs": p95, "workerConcurrency": concurrency, "backlog": backlog})

    autoscaling_ready = _as_bool(payload.autoscaling.get("ready")) or _as_bool(payload.autoscaling.get("enabled"))
    load_test_passed = _as_bool(payload.load_test.get("passed")) or (_dict_decision(payload.load_test) == "pass")
    if payload.require_autoscaling and autoscaling_ready is not True:
        warnings.append("autoscaling readiness evidence is required")
    if payload.require_load_test and load_test_passed is not True:
        warnings.append("load-test pass evidence is required before sustained traffic expansion")
    if payload.target_canary_percent < payload.current_canary_percent:
        warnings.append("target canary is below current canary; this is a contraction, not expansion")
    if payload.target_canary_percent > 100:
        blockers.append("target canary cannot exceed 100 percent")
    if not payload.metrics and not payload.queues and not payload.workers:
        blockers.append("no capacity metrics, queue evidence or worker evidence supplied")
    for signal in payload.required_signals:
        normalized = signal.lower()
        if normalized == "autoscalingready" and autoscaling_ready is not True:
            warnings.append("required signal autoscalingReady is missing or false")
        if normalized == "loadtestpassed" and load_test_passed is not True:
            warnings.append("required signal loadTestPassed is missing or false")

    decision = "rollback" if blockers else "hold" if warnings else "pass"
    next_actions = ["Attach capacity scaling readiness to promotion evidence before sustained traffic increase.", "Use Node/control-plane or infrastructure automation to change autoscaling and traffic levels."] if decision == "pass" else ["Hold expansion until autoscaling, load-test and capacity evidence are complete.", "Re-run with queue lag, CPU, memory, latency and worker concurrency signals."] if decision == "hold" else ["Do not expand traffic; capacity blockers require rollback or remediation before retry.", "Use Node/control-plane and infrastructure runbooks for any scaling or rollback action."]
    report = {"releaseId": payload.release_id, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "currentCanaryPercent": payload.current_canary_percent, "targetCanaryPercent": payload.target_canary_percent, "decision": decision, "capacitySummary": summary, "autoscalingReady": autoscaling_ready, "loadTestPassed": load_test_passed, "thresholds": {"maxQueueLagSeconds": max_lag, "maxCpuPercent": max_cpu, "maxMemoryPercent": max_memory, "maxP95LatencyMs": max_p95, "minWorkerConcurrency": min_concurrency}, "blockers": blockers, "warnings": warnings, "nextActions": next_actions, "mutatesAutoscalingOrTraffic": False, "pythonCapacityReviewIsAdvisory": True, "nodeControlPlaneOwnsScaling": True}
    artifact = artifact_store.write_json(prefix="platform-capacity-scaling-readiness-review", artifact_type="platform.capacity_scaling_readiness_review.report", payload=report, metadata={"rowCount": len(summary), "redactionApplied": True, "piiClass": "capacity-scaling-readiness-metadata-only", "source": "python-capacity-scaling-readiness-review"})
    return _result(job, "platform.capacity_scaling_readiness_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["capacity scaling readiness review is advisory; Python did not change autoscaling, queues or traffic"], [artifact])



def _metadata_name(item: dict[str, Any], fallback: str) -> str:
    return str(item.get("name") or item.get("id") or item.get("type") or item.get("artifactType") or fallback)


def _normalized_token(value: Any) -> str:
    return str(value or "").lower().replace("-", "").replace("_", "").replace(" ", "")


def _days_from_metadata(item: dict[str, Any], keys: tuple[str, ...]) -> int | None:
    for key in ("ageDays", "daysSinceUpdate", "daysSinceDrill"):
        value = _metric_number(item, keys=(key,))
        if value is not None:
            return int(value)
    for key in keys:
        raw = item.get(key)
        if not raw:
            continue
        try:
            parsed = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return max(0, (now - parsed).days)
        except Exception:
            continue
    return None


def process_platform_compliance_privacy_evidence_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(CompliancePrivacyEvidenceReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    aliases = {
        "privacypreflight": ["privacyPreflight", "privacy_preflight", "platform.privacy_preflight"],
        "dataretention": ["dataRetention", "data_retention", "platform.data_retention_review"],
        "audittrail": ["auditTrail", "audit_trail", "platform.audit_trail_review"],
        "securityposture": ["securityPosture", "security_posture", "platform.security_posture_review"],
        "accesscontrol": ["accessControl", "access_control", "platform.access_control_review"],
        "dataquality": ["dataQuality", "data_quality", "platform.data_quality_review"],
    }
    gate_summary: list[dict[str, Any]] = []
    for required in payload.required_evidence:
        key = _normalized_token(required)
        evidence = None
        for candidate in aliases.get(key, [required]):
            if candidate in payload.evidence:
                evidence = payload.evidence[candidate]
                break
        if evidence is None:
            for item in payload.privacy_reviews + payload.compliance_controls:
                if key in _normalized_token(_metadata_name(item, "")):
                    evidence = item
                    break
        decision = _dict_decision(evidence)
        if decision == "rollback":
            blockers.append(f"required compliance/privacy evidence {required} is failing")
        elif decision == "hold":
            warnings.append(f"required compliance/privacy evidence {required} requires review")
        elif decision != "pass":
            blockers.append(f"required compliance/privacy evidence {required} is missing")
        gate_summary.append({"name": required, "decision": decision or "missing"})

    artifact_summary: list[dict[str, Any]] = []
    allowed = set(payload.allowed_pii_classes)
    for idx, artifact in enumerate(payload.artifacts):
        if not isinstance(artifact, dict):
            warnings.append(f"artifact {idx} is not an object")
            continue
        name = _metadata_name(artifact, f"artifact-{idx}")
        pii = str(artifact.get("piiClass") or artifact.get("dataClassification") or "")
        redacted = _as_bool(artifact.get("redactionApplied"))
        protected = _as_bool(artifact.get("downloadProtected"))
        if protected is None:
            protected = not bool(artifact.get("downloadUrl") or artifact.get("publicUrl"))
        if payload.require_redaction and redacted is not True:
            blockers.append(f"artifact {name} is not marked redacted")
        if pii and pii not in allowed:
            blockers.append(f"artifact {name} piiClass {pii} is not allowed")
        elif not pii:
            warnings.append(f"artifact {name} missing piiClass metadata")
        if protected is False:
            blockers.append(f"artifact {name} exposes an unprotected download URL")
        artifact_summary.append({"name": name, "piiClass": pii or "missing", "redactionApplied": redacted, "downloadProtected": protected})

    control_summary: list[dict[str, Any]] = []
    for idx, control in enumerate(payload.compliance_controls):
        if not isinstance(control, dict):
            continue
        name = _metadata_name(control, f"control-{idx}")
        decision = _dict_decision(control)
        if decision == "rollback":
            blockers.append(f"compliance control {name} is failing")
        elif decision == "hold" or decision is None:
            warnings.append(f"compliance control {name} requires review")
        control_summary.append({"name": name, "decision": decision or "unknown"})

    dpia_decision = _dict_decision(payload.dpia)
    if payload.require_dpia and dpia_decision != "pass" and _as_bool(payload.dpia.get("approved")) is not True:
        blockers.append("DPIA/privacy assessment approval evidence is required")
    active_dpas = [record for record in payload.dpa_records if isinstance(record, dict) and (_dict_decision(record) == "pass" or str(record.get("status", "")).lower() in {"active", "approved", "signed"})]
    if payload.require_dpa and not active_dpas:
        warnings.append("DPA/vendor data processing evidence is missing or not active")
    approved = _approved_items(payload.approvals)
    if payload.require_approvals and not approved:
        blockers.append("compliance/privacy owner approval is required")
    if not payload.evidence and not payload.privacy_reviews and not payload.compliance_controls:
        blockers.append("no compliance/privacy evidence supplied")

    decision = "rollback" if blockers else "hold" if warnings else "pass"
    next_actions = [
        "Attach this sanitized compliance/privacy evidence report to the sustained-traffic release bundle.",
        "Keep privacy approvals, DPA updates and artifact access controls owned by compliance operators and Node/control-plane.",
    ] if decision == "pass" else [
        "Hold sustained traffic until required privacy, compliance, DPA and artifact metadata are complete.",
        "Re-run with privacy preflight, data-retention, audit-trail, security, access-control and data-quality evidence.",
    ] if decision == "hold" else [
        "Do not advance sustained traffic while compliance/privacy blockers remain.",
        "Resolve missing approvals, unsafe artifact metadata or failing privacy gates before re-running.",
    ]
    report = {"releaseId": payload.release_id, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "gateSummary": gate_summary, "artifactSummary": artifact_summary, "controlSummary": control_summary, "dpiaDecision": dpia_decision or ("pass" if _as_bool(payload.dpia.get("approved")) else "missing"), "activeDpaRecordCount": len(active_dpas), "approvalCount": len(approved), "blockers": blockers, "warnings": warnings, "nextActions": next_actions, "mutatesPrivacyOrComplianceSystems": False, "pythonComplianceReviewIsAdvisory": True, "nodeAndComplianceOwnEvidence": True}
    artifact = artifact_store.write_json(prefix="platform-compliance-privacy-evidence-review", artifact_type="platform.compliance_privacy_evidence_review.report", payload=report, metadata={"rowCount": len(gate_summary) + len(artifact_summary) + len(control_summary), "redactionApplied": True, "piiClass": "compliance-privacy-evidence-metadata-only", "source": "python-compliance-privacy-evidence-review"})
    return _result(job, "platform.compliance_privacy_evidence_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["compliance/privacy evidence review is advisory; Python did not mutate privacy systems, artifact ACLs or approvals"], [artifact])


def process_platform_runbook_drill_verification_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(RunbookDrillVerificationReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    runbook_summary: list[dict[str, Any]] = []
    drill_summary: list[dict[str, Any]] = []

    def matches_required(item: dict[str, Any], required: str) -> bool:
        token = _normalized_token(required)
        return token in _normalized_token(_metadata_name(item, "")) or token in _normalized_token(item.get("category")) or token in _normalized_token(item.get("scenario"))

    for required in payload.required_runbooks:
        candidates = [item for item in payload.runbooks if isinstance(item, dict) and matches_required(item, required)]
        if not candidates:
            blockers.append(f"required runbook {required} is missing")
            continue
        for item in candidates[:1]:
            name = _metadata_name(item, required)
            decision = _dict_decision(item)
            ready = _as_bool(item.get("ready"))
            owner_ack = _as_bool(item.get("ownerAck", item.get("ownerAcknowledged")))
            age_days = _days_from_metadata(item, ("updatedAt", "lastReviewedAt", "reviewedAt"))
            if decision == "rollback" or ready is False:
                blockers.append(f"runbook {name} is not ready")
            elif decision == "hold" or ready is None:
                warnings.append(f"runbook {name} requires readiness review")
            if age_days is not None and age_days > payload.max_runbook_age_days:
                warnings.append(f"runbook {name} age {age_days}d exceeds {payload.max_runbook_age_days}d")
            if payload.require_owner_ack and owner_ack is not True:
                warnings.append(f"runbook {name} missing owner acknowledgement")
            if not (item.get("url") or item.get("link") or item.get("artifactId")):
                warnings.append(f"runbook {name} missing link/artifact reference")
            runbook_summary.append({"name": name, "decision": decision or ("pass" if ready else "unknown"), "ageDays": age_days, "ownerAck": owner_ack})

    recent_drills = 0
    for required in payload.required_drills:
        candidates = [item for item in payload.drills + payload.scenarios if isinstance(item, dict) and matches_required(item, required)]
        if not candidates:
            blockers.append(f"required drill {required} is missing")
            continue
        for item in candidates[:1]:
            name = _metadata_name(item, required)
            decision = _dict_decision(item)
            passed = _as_bool(item.get("passed"))
            age_days = _days_from_metadata(item, ("executedAt", "lastDrilledAt", "completedAt"))
            if decision == "rollback" or passed is False:
                blockers.append(f"drill {name} did not pass")
            elif decision == "hold" or passed is None:
                warnings.append(f"drill {name} requires outcome review")
            if age_days is not None and age_days <= payload.max_drill_age_days:
                recent_drills += 1
            elif age_days is not None:
                warnings.append(f"drill {name} age {age_days}d exceeds {payload.max_drill_age_days}d")
            drill_summary.append({"name": name, "decision": decision or ("pass" if passed else "unknown"), "ageDays": age_days})

    if payload.require_recent_drill and recent_drills == 0:
        blockers.append("at least one recent passing drill is required")
    if not payload.runbooks:
        blockers.append("no runbook metadata supplied")
    if not payload.drills and not payload.scenarios:
        blockers.append("no drill/scenario metadata supplied")

    evidence_statuses = _evidence_status_map(payload.evidence or {})
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")

    decision = "rollback" if blockers else "hold" if warnings else "pass"
    next_actions = [
        "Attach runbook and drill verification to the sustained-traffic evidence bundle.",
        "Keep actual incident, rollback and support execution in operator runbooks and Node/control-plane.",
    ] if decision == "pass" else [
        "Hold sustained traffic until missing runbooks, stale drills or owner acknowledgements are resolved.",
        "Re-run after rollback, incident, restore and support-escalation drills have passing sanitized evidence.",
    ] if decision == "hold" else [
        "Do not proceed to sustained operations while runbook or drill blockers remain.",
        "Complete required drills and owner review before re-running this advisory gate.",
    ]
    report = {"releaseId": payload.release_id, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "runbookSummary": runbook_summary, "drillSummary": drill_summary, "recentDrillCount": recent_drills, "evidenceStatuses": evidence_statuses, "blockers": blockers, "warnings": warnings, "nextActions": next_actions, "mutatesRunbooksOrIncidents": False, "pythonRunbookDrillReviewIsAdvisory": True, "operatorsOwnDrillsAndRunbooks": True}
    artifact = artifact_store.write_json(prefix="platform-runbook-drill-verification-review", artifact_type="platform.runbook_drill_verification_review.report", payload=report, metadata={"rowCount": len(runbook_summary) + len(drill_summary), "redactionApplied": True, "piiClass": "runbook-drill-verification-metadata-only", "source": "python-runbook-drill-verification-review"})
    return _result(job, "platform.runbook_drill_verification_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["runbook drill verification is advisory; Python did not mutate runbooks, incident tickets or paging systems"], [artifact])


def _age_hours_from_metadata(item: dict[str, Any]) -> int | None:
    value = _metric_number(item, keys=("ageHours", "hoursSinceBackup", "backupAgeHours"))
    if value is not None:
        return int(value)
    days = _days_from_metadata(item, ("createdAt", "completedAt", "backupCompletedAt"))
    if days is not None:
        return days * 24
    return None


def _token_matches(item: dict[str, Any], required: str) -> bool:
    token = _normalized_token(required)
    return token in _normalized_token(_metadata_name(item, "")) or token in _normalized_token(item.get("category")) or token in _normalized_token(item.get("type"))


def process_platform_disaster_recovery_backup_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(DisasterRecoveryBackupReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    backup_summary: list[dict[str, Any]] = []
    restore_summary: list[dict[str, Any]] = []
    max_age_hours = int(payload.thresholds.get("maxBackupAgeHours", payload.max_backup_age_hours)) if isinstance(payload.thresholds, dict) else payload.max_backup_age_hours
    max_rpo = int(payload.rpo_rto_targets.get("maxRpoMinutes", payload.max_rpo_minutes)) if isinstance(payload.rpo_rto_targets, dict) else payload.max_rpo_minutes
    max_rto = int(payload.rpo_rto_targets.get("maxRtoMinutes", payload.max_rto_minutes)) if isinstance(payload.rpo_rto_targets, dict) else payload.max_rto_minutes

    for required in payload.required_backups:
        candidates = [item for item in payload.backups if isinstance(item, dict) and _token_matches(item, required)]
        if not candidates:
            blockers.append(f"required backup {required} is missing")
            continue
        item = candidates[0]
        name = _metadata_name(item, required)
        decision = _dict_decision(item)
        verified = _as_bool(item.get("verified", item.get("checksumVerified")))
        encrypted = _as_bool(item.get("encrypted"))
        offsite = _as_bool(item.get("offsite", item.get("offsiteCopy")))
        age_hours = _age_hours_from_metadata(item)
        if decision == "rollback" or verified is False:
            blockers.append(f"backup {name} is not verified")
        elif decision == "hold" or verified is None:
            warnings.append(f"backup {name} requires verification review")
        if payload.require_encryption and encrypted is not True:
            blockers.append(f"backup {name} is not marked encrypted")
        if payload.require_offsite_copy and offsite is not True:
            warnings.append(f"backup {name} missing offsite-copy evidence")
        if age_hours is not None and age_hours > max_age_hours:
            blockers.append(f"backup {name} age {age_hours}h exceeds {max_age_hours}h")
        if not (item.get("sha256") or item.get("checksum") or item.get("artifactId") or item.get("backupId")):
            warnings.append(f"backup {name} missing checksum or artifact reference")
        backup_summary.append({"name": name, "decision": decision or ("pass" if verified else "unknown"), "verified": verified, "encrypted": encrypted, "offsiteCopy": offsite, "ageHours": age_hours})

    recent_restore_count = 0
    for idx, drill in enumerate(payload.restore_drills):
        if not isinstance(drill, dict):
            continue
        name = _metadata_name(drill, f"restore-drill-{idx}")
        decision = _dict_decision(drill)
        passed = _as_bool(drill.get("passed"))
        age_days = _days_from_metadata(drill, ("executedAt", "completedAt", "lastRestoredAt"))
        rpo = _metric_number(drill, keys=("rpoMinutes", "actualRpoMinutes"))
        rto = _metric_number(drill, keys=("rtoMinutes", "actualRtoMinutes"))
        if decision == "rollback" or passed is False:
            blockers.append(f"restore drill {name} did not pass")
        elif decision == "hold" or passed is None:
            warnings.append(f"restore drill {name} requires outcome review")
        if age_days is not None and age_days <= payload.max_restore_age_days:
            recent_restore_count += 1
        elif age_days is not None:
            warnings.append(f"restore drill {name} age {age_days}d exceeds {payload.max_restore_age_days}d")
        if rpo is not None and rpo > max_rpo:
            blockers.append(f"restore drill {name} RPO {rpo:g}m exceeds {max_rpo}m")
        if rto is not None and rto > max_rto:
            blockers.append(f"restore drill {name} RTO {rto:g}m exceeds {max_rto}m")
        restore_summary.append({"name": name, "decision": decision or ("pass" if passed else "unknown"), "ageDays": age_days, "rpoMinutes": rpo, "rtoMinutes": rto})

    if payload.require_restore_drill and recent_restore_count == 0:
        blockers.append("at least one recent passing restore drill is required")
    if not payload.backups:
        blockers.append("no backup metadata supplied")

    evidence_statuses = _evidence_status_map(payload.evidence or {})
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")

    decision = "rollback" if blockers else "hold" if warnings else "pass"
    next_actions = ["Attach DR/backup readiness evidence to the sustained-operations release bundle.", "Keep backup restore execution and disaster-recovery failover owned by operators and infrastructure automation."] if decision == "pass" else ["Hold sustained operation expansion until backup verification, offsite-copy and restore-drill warnings are resolved.", "Re-run with sanitized backup ids, checksums, encryption/offsite metadata and RPO/RTO drill evidence."] if decision == "hold" else ["Do not advance sustained operations while DR/backup blockers remain.", "Refresh required backups or restore drills and keep traffic on the safe Node-owned path before retrying."]
    report = {"releaseId": payload.release_id, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "backupSummary": backup_summary, "restoreSummary": restore_summary, "recentRestoreDrillCount": recent_restore_count, "evidenceStatuses": evidence_statuses, "thresholds": {"maxBackupAgeHours": max_age_hours, "maxRpoMinutes": max_rpo, "maxRtoMinutes": max_rto}, "blockers": blockers, "warnings": warnings, "nextActions": next_actions, "mutatesBackupOrRestoreSystems": False, "pythonDisasterRecoveryReviewIsAdvisory": True, "operatorsOwnBackupAndRestore": True}
    artifact = artifact_store.write_json(prefix="platform-disaster-recovery-backup-review", artifact_type="platform.disaster_recovery_backup_review.report", payload=report, metadata={"rowCount": len(backup_summary) + len(restore_summary), "redactionApplied": True, "piiClass": "disaster-recovery-backup-metadata-only", "source": "python-disaster-recovery-backup-review"})
    return _result(job, "platform.disaster_recovery_backup_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["disaster-recovery backup review is advisory; Python did not restore backups, fail over systems or mutate secrets"], [artifact])


def process_platform_change_migration_readiness_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(ChangeMigrationReadinessReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    migration_summary: list[dict[str, Any]] = []
    ticket_summary: list[dict[str, Any]] = []

    required = payload.required_migrations or [str(item.get("name") or item.get("id") or item.get("type")) for item in payload.migrations if isinstance(item, dict)]
    for req in [item for item in required if item and item != "None"]:
        matches = [item for item in payload.migrations if isinstance(item, dict) and _token_matches(item, req)]
        if not matches:
            blockers.append(f"required migration {req} is missing")
            continue
        item = matches[0]
        name = _metadata_name(item, req)
        decision = _dict_decision(item)
        dry_run = _as_bool(item.get("dryRunPassed", item.get("rehearsalPassed", item.get("dryRun"))))
        reversible = _as_bool(item.get("reversible", item.get("backwardCompatible")))
        destructive = _as_bool(item.get("destructive"))
        backup_before = _as_bool(item.get("backupBeforeMigration", item.get("backupReady")))
        if decision == "rollback":
            blockers.append(f"migration {name} is failing")
        elif decision == "hold":
            warnings.append(f"migration {name} requires review")
        if payload.require_dry_run_rehearsal and dry_run is not True:
            blockers.append(f"migration {name} missing passing dry-run rehearsal")
        if destructive is True and reversible is not True:
            blockers.append(f"destructive migration {name} is not marked reversible/backward-compatible")
        if payload.require_backup_before_migration and backup_before is not True:
            blockers.append(f"migration {name} missing backup-before-migration evidence")
        migration_summary.append({"name": name, "decision": decision or ("pass" if dry_run is True else "unknown"), "dryRunPassed": dry_run, "reversible": reversible, "destructive": destructive, "backupBeforeMigration": backup_before})

    for idx, ticket in enumerate(payload.change_tickets):
        if not isinstance(ticket, dict):
            continue
        name = _metadata_name(ticket, f"change-ticket-{idx}")
        decision = _dict_decision(ticket)
        age_days = _days_from_metadata(ticket, ("updatedAt", "approvedAt", "createdAt"))
        if decision == "rollback":
            blockers.append(f"change ticket {name} is not approved")
        elif decision == "hold" or decision is None:
            warnings.append(f"change ticket {name} requires approval/status review")
        if age_days is not None and age_days > payload.max_ticket_age_days:
            warnings.append(f"change ticket {name} age {age_days}d exceeds {payload.max_ticket_age_days}d")
        ticket_summary.append({"name": name, "decision": decision or "unknown", "ageDays": age_days})

    approvals = _approved_items(payload.approvals)
    rollback_decision = _dict_decision(payload.rollback_plan)
    rollout_decision = _dict_decision(payload.rollout_plan)
    backfill_decision = _dict_decision(payload.data_backfill)
    if payload.require_approval and not approvals:
        blockers.append("change/migration owner approval is required")
    if payload.require_rollback_plan and rollback_decision != "pass":
        blockers.append("rollback/backout plan must be present and passing")
    if rollout_decision == "rollback":
        blockers.append("rollout plan is failing")
    elif rollout_decision in {None, "hold"}:
        warnings.append("rollout plan requires review")
    if backfill_decision == "rollback":
        blockers.append("data backfill plan is failing")
    elif payload.data_backfill and backfill_decision in {None, "hold"}:
        warnings.append("data backfill plan requires review")
    if not payload.migrations and not payload.change_tickets:
        blockers.append("no change/migration metadata supplied")

    evidence_statuses = _evidence_status_map(payload.evidence or {})
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")

    decision = "rollback" if blockers else "hold" if warnings else "pass"
    next_actions = ["Attach change/migration readiness evidence to the release bundle before operator-controlled migration windows.", "Keep schema migration execution, ticket approval and traffic changes owned by Node/control-plane and CI/CD operators."] if decision == "pass" else ["Hold migration execution until warnings around tickets, rollout plan or backfill evidence are resolved.", "Re-run with passing dry-run rehearsal, approvals, rollback plan and backup-before-migration metadata."] if decision == "hold" else ["Do not execute migrations while readiness blockers remain.", "Resolve approval, dry-run, reversibility, backup and rollback blockers before retrying."]
    report = {"releaseId": payload.release_id, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "migrationSummary": migration_summary, "ticketSummary": ticket_summary, "approvalCount": len(approvals), "rollbackPlanDecision": rollback_decision or "missing", "rolloutPlanDecision": rollout_decision or "missing", "dataBackfillDecision": backfill_decision or ("not-supplied" if not payload.data_backfill else "missing"), "evidenceStatuses": evidence_statuses, "blockers": blockers, "warnings": warnings, "nextActions": next_actions, "mutatesSchemaOrChangeSystems": False, "pythonChangeMigrationReviewIsAdvisory": True, "nodeCiOperatorsOwnMigration": True}
    artifact = artifact_store.write_json(prefix="platform-change-migration-readiness-review", artifact_type="platform.change_migration_readiness_review.report", payload=report, metadata={"rowCount": len(migration_summary) + len(ticket_summary), "redactionApplied": True, "piiClass": "change-migration-readiness-metadata-only", "source": "python-change-migration-readiness-review"})
    return _result(job, "platform.change_migration_readiness_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["change/migration readiness review is advisory; Python did not apply migrations, approve tickets or mutate schemas"], [artifact])



class AuditForensicsReadinessReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    audit_trails: list[dict[str, Any]] = Field(default_factory=list, alias="auditTrails")
    forensic_artifacts: list[dict[str, Any]] = Field(default_factory=list, alias="forensicArtifacts")
    investigation_drills: list[dict[str, Any]] = Field(default_factory=list, alias="investigationDrills")
    chain_of_custody: dict[str, Any] = Field(default_factory=dict, alias="chainOfCustody")
    evidence: dict[str, Any] = Field(default_factory=dict)
    required_sources: list[str] = Field(default_factory=lambda: ["apiAudit", "authAudit", "workerAudit", "artifactAccessAudit"], alias="requiredSources")
    max_audit_gap_minutes: int = Field(default=15, alias="maxAuditGapMinutes", ge=1, le=10080)
    max_artifact_age_days: int = Field(default=30, alias="maxArtifactAgeDays", ge=1, le=3650)
    require_immutable_storage: bool = Field(default=True, alias="requireImmutableStorage")
    require_chain_of_custody: bool = Field(default=True, alias="requireChainOfCustody")
    require_investigation_drill: bool = Field(default=True, alias="requireInvestigationDrill")
    class Config:
        populate_by_name = True


class BusinessContinuityReadinessReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    continuity_plans: list[dict[str, Any]] = Field(default_factory=list, alias="continuityPlans")
    teams: list[dict[str, Any]] = Field(default_factory=list)
    communications: dict[str, Any] = Field(default_factory=dict)
    fallback_procedures: list[dict[str, Any]] = Field(default_factory=list, alias="fallbackProcedures")
    exercises: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    required_plans: list[str] = Field(default_factory=lambda: ["support", "operations", "billing", "clinical"], alias="requiredPlans")
    max_exercise_age_days: int = Field(default=180, alias="maxExerciseAgeDays", ge=1, le=3650)
    require_owner_ack: bool = Field(default=True, alias="requireOwnerAck")
    require_comms: bool = Field(default=True, alias="requireComms")
    require_fallback: bool = Field(default=True, alias="requireFallback")
    require_exercise: bool = Field(default=True, alias="requireExercise")
    class Config:
        populate_by_name = True


class PostIncidentLearningReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    incidents: list[dict[str, Any]] = Field(default_factory=list)
    postmortems: list[dict[str, Any]] = Field(default_factory=list)
    action_items: list[dict[str, Any]] = Field(default_factory=list, alias="actionItems")
    regressions: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    required_incident_classes: list[str] = Field(default_factory=lambda: ["sev1", "sev2", "rollback", "privacy"], alias="requiredIncidentClasses")
    max_open_action_item_age_days: int = Field(default=30, alias="maxOpenActionItemAgeDays", ge=1, le=3650)
    require_postmortem: bool = Field(default=True, alias="requirePostmortem")
    require_owner_ack: bool = Field(default=True, alias="requireOwnerAck")
    require_regression_test: bool = Field(default=True, alias="requireRegressionTest")

    class Config:
        populate_by_name = True


class TechDebtGovernanceReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    debt_items: list[dict[str, Any]] = Field(default_factory=list, alias="debtItems")
    waivers: list[dict[str, Any]] = Field(default_factory=list)
    ownership: list[dict[str, Any]] = Field(default_factory=list)
    remediation_plan: dict[str, Any] = Field(default_factory=dict, alias="remediationPlan")
    evidence: dict[str, Any] = Field(default_factory=dict)
    required_categories: list[str] = Field(default_factory=lambda: ["security", "reliability", "contracts", "observability"], alias="requiredCategories")
    max_critical_debt_items: int = Field(default=0, alias="maxCriticalDebtItems", ge=0, le=1000)
    max_waiver_age_days: int = Field(default=90, alias="maxWaiverAgeDays", ge=1, le=3650)
    require_owner_ack: bool = Field(default=True, alias="requireOwnerAck")
    require_remediation_plan: bool = Field(default=True, alias="requireRemediationPlan")

    class Config:
        populate_by_name = True


class VendorResilienceReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    vendors: list[dict[str, Any]] = Field(default_factory=list)
    services: list[dict[str, Any]] = Field(default_factory=list)
    incidents: list[dict[str, Any]] = Field(default_factory=list)
    exit_plans: list[dict[str, Any]] = Field(default_factory=list, alias="exitPlans")
    evidence: dict[str, Any] = Field(default_factory=dict)
    required_vendors: list[str] = Field(default_factory=lambda: ["payments", "messaging", "artifactStorage"], alias="requiredVendors")
    max_status_age_minutes: int = Field(default=60, alias="maxStatusAgeMinutes", ge=1, le=10080)
    max_open_incident_age_days: int = Field(default=3, alias="maxOpenIncidentAgeDays", ge=1, le=3650)
    require_sla_evidence: bool = Field(default=True, alias="requireSlaEvidence")
    require_exit_plan: bool = Field(default=True, alias="requireExitPlan")
    require_owner_ack: bool = Field(default=True, alias="requireOwnerAck")

    class Config:
        populate_by_name = True


class KnowledgeTransferReadinessReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    knowledge_artifacts: list[dict[str, Any]] = Field(default_factory=list, alias="knowledgeArtifacts")
    owners: list[dict[str, Any]] = Field(default_factory=list)
    training_sessions: list[dict[str, Any]] = Field(default_factory=list, alias="trainingSessions")
    handoff_checklists: list[dict[str, Any]] = Field(default_factory=list, alias="handoffChecklists")
    evidence: dict[str, Any] = Field(default_factory=dict)
    required_topics: list[str] = Field(default_factory=lambda: ["runbooks", "oncall", "rollback", "privacy"], alias="requiredTopics")
    max_artifact_age_days: int = Field(default=90, alias="maxArtifactAgeDays", ge=1, le=3650)
    require_secondary_owner: bool = Field(default=True, alias="requireSecondaryOwner")
    require_training: bool = Field(default=True, alias="requireTraining")
    require_handoff_checklist: bool = Field(default=True, alias="requireHandoffChecklist")

    class Config:
        populate_by_name = True


class ArchitectureOwnershipReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    architecture_artifacts: list[dict[str, Any]] = Field(default_factory=list, alias="architectureArtifacts")
    service_boundaries: list[dict[str, Any]] = Field(default_factory=list, alias="serviceBoundaries")
    owners: list[dict[str, Any]] = Field(default_factory=list)
    decision_records: list[dict[str, Any]] = Field(default_factory=list, alias="decisionRecords")
    evidence: dict[str, Any] = Field(default_factory=dict)
    required_domains: list[str] = Field(default_factory=lambda: ["api", "worker", "contracts", "observability"], alias="requiredDomains")
    max_artifact_age_days: int = Field(default=90, alias="maxArtifactAgeDays", ge=1, le=3650)
    require_owner_ack: bool = Field(default=True, alias="requireOwnerAck")
    require_adr: bool = Field(default=True, alias="requireAdr")
    require_boundary_doc: bool = Field(default=True, alias="requireBoundaryDoc")
    class Config:
        populate_by_name = True

class ExecutiveMetricsGovernanceReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    metric_definitions: list[dict[str, Any]] = Field(default_factory=list, alias="metricDefinitions")
    dashboards: list[dict[str, Any]] = Field(default_factory=list)
    review_cadence: dict[str, Any] = Field(default_factory=dict, alias="reviewCadence")
    owners: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    required_metrics: list[str] = Field(default_factory=lambda: ["availability", "latency", "errorRate", "cost", "privacy"], alias="requiredMetrics")
    max_metric_age_days: int = Field(default=45, alias="maxMetricAgeDays", ge=1, le=3650)
    require_owner_ack: bool = Field(default=True, alias="requireOwnerAck")
    require_dashboard: bool = Field(default=True, alias="requireDashboard")
    require_cadence: bool = Field(default=True, alias="requireCadence")
    class Config:
        populate_by_name = True



class DomainAdoptionReadinessReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    phase: str = Field(default="phase-2", min_length=2, max_length=80)
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    domains: list[dict[str, Any]] = Field(default_factory=list)
    owners: list[dict[str, Any]] = Field(default_factory=list)
    rollback_plan: dict[str, Any] = Field(default_factory=dict, alias="rollbackPlan")
    evidence: dict[str, Any] = Field(default_factory=dict)
    required_domains: list[str] = Field(default_factory=lambda: ["admin", "scheduling", "messaging", "billing", "clinical"], alias="requiredDomains")
    min_readiness_score: float = Field(default=85, alias="minReadinessScore", ge=0, le=100)
    max_open_blockers: int = Field(default=0, alias="maxOpenBlockers", ge=0, le=1000)
    require_owner_ack: bool = Field(default=True, alias="requireOwnerAck")
    require_rollback_plan: bool = Field(default=True, alias="requireRollbackPlan")
    class Config:
        populate_by_name = True

class PhaseTwoRolloutGovernanceReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    phase: str = Field(default="phase-2", min_length=2, max_length=80)
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    milestones: list[dict[str, Any]] = Field(default_factory=list)
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    cohorts: list[dict[str, Any]] = Field(default_factory=list)
    guardrails: list[dict[str, Any]] = Field(default_factory=list)
    communications_plan: dict[str, Any] = Field(default_factory=dict, alias="communicationsPlan")
    support_plan: dict[str, Any] = Field(default_factory=dict, alias="supportPlan")
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_approval_count: int = Field(default=2, alias="minApprovalCount", ge=0, le=50)
    max_open_blockers: int = Field(default=0, alias="maxOpenBlockers", ge=0, le=1000)
    require_comms_plan: bool = Field(default=True, alias="requireCommsPlan")
    require_support_plan: bool = Field(default=True, alias="requireSupportPlan")
    require_guardrails: bool = Field(default=True, alias="requireGuardrails")
    class Config:
        populate_by_name = True


class DomainPilotExecutionReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    phase: str = Field(default="phase-2", min_length=2, max_length=80)
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    pilot_domains: list[dict[str, Any]] = Field(default_factory=list, alias="pilotDomains")
    pilot_runs: list[dict[str, Any]] = Field(default_factory=list, alias="pilotRuns")
    acceptance_criteria: list[dict[str, Any]] = Field(default_factory=list, alias="acceptanceCriteria")
    operator_approvals: list[dict[str, Any]] = Field(default_factory=list, alias="operatorApprovals")
    rollback_plan: dict[str, Any] = Field(default_factory=dict, alias="rollbackPlan")
    evidence: dict[str, Any] = Field(default_factory=dict)
    required_pilot_domains: list[str] = Field(default_factory=lambda: ["admin", "scheduling"], alias="requiredPilotDomains")
    min_success_rate: float = Field(default=0.95, alias="minSuccessRate", ge=0, le=1)
    max_error_rate: float = Field(default=0.01, alias="maxErrorRate", ge=0, le=1)
    max_open_blockers: int = Field(default=0, alias="maxOpenBlockers", ge=0, le=1000)
    min_approval_count: int = Field(default=2, alias="minApprovalCount", ge=0, le=50)
    require_rollback_plan: bool = Field(default=True, alias="requireRollbackPlan")
    require_operator_approval: bool = Field(default=True, alias="requireOperatorApproval")
    class Config:
        populate_by_name = True


class DomainOutcomeMeasurementReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    phase: str = Field(default="phase-2", min_length=2, max_length=80)
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    outcome_metrics: list[dict[str, Any]] = Field(default_factory=list, alias="outcomeMetrics")
    baselines: list[dict[str, Any]] = Field(default_factory=list)
    adoption_signals: list[dict[str, Any]] = Field(default_factory=list, alias="adoptionSignals")
    support_signals: list[dict[str, Any]] = Field(default_factory=list, alias="supportSignals")
    evidence: dict[str, Any] = Field(default_factory=dict)
    required_metrics: list[str] = Field(default_factory=lambda: ["success_rate", "latency", "satisfaction"], alias="requiredMetrics")
    min_success_rate: float = Field(default=0.95, alias="minSuccessRate", ge=0, le=1)
    max_regression_percent: float = Field(default=5, alias="maxRegressionPercent", ge=0, le=100)
    min_adoption_score: float = Field(default=0.75, alias="minAdoptionScore", ge=0, le=1)
    max_support_ticket_rate: float = Field(default=0.05, alias="maxSupportTicketRate", ge=0, le=1)
    require_baselines: bool = Field(default=True, alias="requireBaselines")
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True



class DomainGraduationReadinessReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    phase: str = Field(default="phase-2", min_length=2, max_length=80)
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    graduation_candidates: list[dict[str, Any]] = Field(default_factory=list, alias="graduationCandidates")
    graduation_criteria: list[dict[str, Any]] = Field(default_factory=list, alias="graduationCriteria")
    outcome_summary: dict[str, Any] = Field(default_factory=dict, alias="outcomeSummary")
    risk_register: list[dict[str, Any]] = Field(default_factory=list, alias="riskRegister")
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    required_candidates: list[str] = Field(default_factory=list, alias="requiredCandidates")
    min_outcome_score: float = Field(default=0.85, alias="minOutcomeScore", ge=0, le=1)
    max_open_high_risks: int = Field(default=0, alias="maxOpenHighRisks", ge=0, le=1000)
    min_approval_count: int = Field(default=2, alias="minApprovalCount", ge=0, le=50)
    require_criteria: bool = Field(default=True, alias="requireCriteria")
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True

class PhaseTwoLearningConsolidationReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    phase: str = Field(default="phase-2", min_length=2, max_length=80)
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    learnings: list[dict[str, Any]] = Field(default_factory=list)
    experiments: list[dict[str, Any]] = Field(default_factory=list)
    decisions: list[dict[str, Any]] = Field(default_factory=list)
    playbook_updates: list[dict[str, Any]] = Field(default_factory=list, alias="playbookUpdates")
    owners: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_learning_count: int = Field(default=2, alias="minLearningCount", ge=0, le=1000)
    min_decision_count: int = Field(default=1, alias="minDecisionCount", ge=0, le=1000)
    min_owner_ack_count: int = Field(default=2, alias="minOwnerAckCount", ge=0, le=100)
    require_playbook_updates: bool = Field(default=True, alias="requirePlaybookUpdates")
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True

class DomainWideAdoptionReadinessReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    phase: str = Field(default="phase-2", min_length=2, max_length=80)
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    adoption_domains: list[dict[str, Any]] = Field(default_factory=list, alias="adoptionDomains")
    rollout_evidence: list[dict[str, Any]] = Field(default_factory=list, alias="rolloutEvidence")
    owner_approvals: list[dict[str, Any]] = Field(default_factory=list, alias="ownerApprovals")
    support_readiness: dict[str, Any] = Field(default_factory=dict, alias="supportReadiness")
    rollback_plan: dict[str, Any] = Field(default_factory=dict, alias="rollbackPlan")
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_domain_count: int = Field(default=2, alias="minDomainCount", ge=0, le=1000)
    min_owner_approval_count: int = Field(default=2, alias="minOwnerApprovalCount", ge=0, le=100)
    max_open_blockers: int = Field(default=0, alias="maxOpenBlockers", ge=0, le=1000)
    require_support_readiness: bool = Field(default=True, alias="requireSupportReadiness")
    require_rollback_plan: bool = Field(default=True, alias="requireRollbackPlan")
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True

class PhaseTwoSupportTransitionReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    phase: str = Field(default="phase-2", min_length=2, max_length=80)
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    support_queues: list[dict[str, Any]] = Field(default_factory=list, alias="supportQueues")
    escalation_paths: list[dict[str, Any]] = Field(default_factory=list, alias="escalationPaths")
    training_artifacts: list[dict[str, Any]] = Field(default_factory=list, alias="trainingArtifacts")
    runbook_updates: list[dict[str, Any]] = Field(default_factory=list, alias="runbookUpdates")
    owner_approvals: list[dict[str, Any]] = Field(default_factory=list, alias="ownerApprovals")
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_queue_count: int = Field(default=1, alias="minQueueCount", ge=0, le=1000)
    min_training_count: int = Field(default=2, alias="minTrainingCount", ge=0, le=1000)
    min_owner_approval_count: int = Field(default=2, alias="minOwnerApprovalCount", ge=0, le=100)
    require_escalation_paths: bool = Field(default=True, alias="requireEscalationPaths")
    require_runbook_updates: bool = Field(default=True, alias="requireRunbookUpdates")
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True

class DomainAdoptionStabilizationReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    phase: str = Field(default="phase-2", min_length=2, max_length=80)
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    stabilization_domains: list[dict[str, Any]] = Field(default_factory=list, alias="stabilizationDomains")
    health_signals: list[dict[str, Any]] = Field(default_factory=list, alias="healthSignals")
    support_signals: list[dict[str, Any]] = Field(default_factory=list, alias="supportSignals")
    regression_watch: list[dict[str, Any]] = Field(default_factory=list, alias="regressionWatch")
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_domain_count: int = Field(default=2, alias="minDomainCount", ge=0, le=1000)
    min_health_signal_count: int = Field(default=2, alias="minHealthSignalCount", ge=0, le=1000)
    min_approval_count: int = Field(default=2, alias="minApprovalCount", ge=0, le=100)
    max_open_blockers: int = Field(default=0, alias="maxOpenBlockers", ge=0, le=1000)
    require_support_signals: bool = Field(default=True, alias="requireSupportSignals")
    require_regression_watch: bool = Field(default=True, alias="requireRegressionWatch")
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True

class PhaseTwoValueRealizationReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    phase: str = Field(default="phase-2", min_length=2, max_length=80)
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    value_metrics: list[dict[str, Any]] = Field(default_factory=list, alias="valueMetrics")
    benefit_baselines: list[dict[str, Any]] = Field(default_factory=list, alias="benefitBaselines")
    adoption_summary: dict[str, Any] = Field(default_factory=dict, alias="adoptionSummary")
    executive_reviews: list[dict[str, Any]] = Field(default_factory=list, alias="executiveReviews")
    owner_approvals: list[dict[str, Any]] = Field(default_factory=list, alias="ownerApprovals")
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_value_metric_count: int = Field(default=2, alias="minValueMetricCount", ge=0, le=1000)
    min_owner_approval_count: int = Field(default=2, alias="minOwnerApprovalCount", ge=0, le=100)
    min_adoption_score: float = Field(default=0.80, alias="minAdoptionScore", ge=0, le=1)
    require_benefit_baselines: bool = Field(default=True, alias="requireBenefitBaselines")
    require_executive_reviews: bool = Field(default=True, alias="requireExecutiveReviews")
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True



class PhaseThreeDomainWaveReadinessReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    phase: str = Field(default="phase-3", min_length=2, max_length=80)
    wave_id: str = Field(default="phase3-wave", alias="waveId", min_length=2, max_length=160)
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    domains: list[dict[str, Any]] = Field(default_factory=list)
    wave_criteria: list[dict[str, Any]] = Field(default_factory=list, alias="waveCriteria")
    guardrails: list[dict[str, Any]] = Field(default_factory=list)
    support_coverage: list[dict[str, Any]] = Field(default_factory=list, alias="supportCoverage")
    rollback_coverage: list[dict[str, Any]] = Field(default_factory=list, alias="rollbackCoverage")
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_domain_count: int = Field(default=1, alias="minDomainCount", ge=0, le=1000)
    min_guardrail_count: int = Field(default=2, alias="minGuardrailCount", ge=0, le=1000)
    min_approval_count: int = Field(default=2, alias="minApprovalCount", ge=0, le=100)
    require_support_coverage: bool = Field(default=True, alias="requireSupportCoverage")
    require_rollback_coverage: bool = Field(default=True, alias="requireRollbackCoverage")
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True

class PhaseThreeOperatingModelAlignmentReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    phase: str = Field(default="phase-3", min_length=2, max_length=80)
    operating_model: str = Field(default="phase3-scale", alias="operatingModel", min_length=2, max_length=160)
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    ownership_matrix: list[dict[str, Any]] = Field(default_factory=list, alias="ownershipMatrix")
    support_model: list[dict[str, Any]] = Field(default_factory=list, alias="supportModel")
    runbook_coverage: list[dict[str, Any]] = Field(default_factory=list, alias="runbookCoverage")
    metric_governance: list[dict[str, Any]] = Field(default_factory=list, alias="metricGovernance")
    training_coverage: list[dict[str, Any]] = Field(default_factory=list, alias="trainingCoverage")
    escalation_model: list[dict[str, Any]] = Field(default_factory=list, alias="escalationModel")
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_owner_count: int = Field(default=2, alias="minOwnerCount", ge=0, le=100)
    min_runbook_count: int = Field(default=1, alias="minRunbookCount", ge=0, le=1000)
    min_approval_count: int = Field(default=2, alias="minApprovalCount", ge=0, le=100)
    require_support_model: bool = Field(default=True, alias="requireSupportModel")
    require_metrics: bool = Field(default=True, alias="requireMetrics")
    require_training: bool = Field(default=True, alias="requireTraining")
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True



class PhaseThreeWaveExecutionReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    phase: str = Field(default="phase-3", min_length=2, max_length=80)
    wave_id: str = Field(default="phase3-wave", alias="waveId", min_length=2, max_length=160)
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    wave_execution: list[dict[str, Any]] = Field(default_factory=list, alias="waveExecution")
    domain_signals: list[dict[str, Any]] = Field(default_factory=list, alias="domainSignals")
    guardrail_checks: list[dict[str, Any]] = Field(default_factory=list, alias="guardrailChecks")
    rollback_readiness: list[dict[str, Any]] = Field(default_factory=list, alias="rollbackReadiness")
    support_incidents: list[dict[str, Any]] = Field(default_factory=list, alias="supportIncidents")
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_executed_domain_count: int = Field(default=1, alias="minExecutedDomainCount", ge=0, le=1000)
    max_open_critical_incidents: int = Field(default=0, alias="maxOpenCriticalIncidents", ge=0, le=1000)
    min_approval_count: int = Field(default=2, alias="minApprovalCount", ge=0, le=100)
    require_rollback_readiness: bool = Field(default=True, alias="requireRollbackReadiness")
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True


class PhaseThreeAdoptionValueTrackingReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    phase: str = Field(default="phase-3", min_length=2, max_length=80)
    wave_id: str = Field(default="phase3-wave", alias="waveId", min_length=2, max_length=160)
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    adoption_metrics: list[dict[str, Any]] = Field(default_factory=list, alias="adoptionMetrics")
    value_metrics: list[dict[str, Any]] = Field(default_factory=list, alias="valueMetrics")
    user_feedback: list[dict[str, Any]] = Field(default_factory=list, alias="userFeedback")
    benefit_hypotheses: list[dict[str, Any]] = Field(default_factory=list, alias="benefitHypotheses")
    owner_reviews: list[dict[str, Any]] = Field(default_factory=list, alias="ownerReviews")
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_adoption_score: float = Field(default=0.75, alias="minAdoptionScore", ge=0, le=1)
    min_value_score: float = Field(default=0.70, alias="minValueScore", ge=0, le=1)
    max_critical_feedback: int = Field(default=0, alias="maxCriticalFeedback", ge=0, le=1000)
    min_approval_count: int = Field(default=2, alias="minApprovalCount", ge=0, le=100)
    require_feedback_review: bool = Field(default=True, alias="requireFeedbackReview")
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True

class PhaseThreeGapRemediationReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    phase: str = Field(default="phase-3", min_length=2, max_length=80)
    wave_id: str = Field(default="phase3-wave", alias="waveId", min_length=2, max_length=160)
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    remediation_items: list[dict[str, Any]] = Field(default_factory=list, alias="remediationItems")
    open_risks: list[dict[str, Any]] = Field(default_factory=list, alias="openRisks")
    risk_acceptances: list[dict[str, Any]] = Field(default_factory=list, alias="riskAcceptances")
    owner_actions: list[dict[str, Any]] = Field(default_factory=list, alias="ownerActions")
    evidence: dict[str, Any] = Field(default_factory=dict)
    max_open_critical_gaps: int = Field(default=0, alias="maxOpenCriticalGaps", ge=0, le=1000)
    min_owner_action_count: int = Field(default=1, alias="minOwnerActionCount", ge=0, le=1000)
    min_risk_acceptance_count: int = Field(default=0, alias="minRiskAcceptanceCount", ge=0, le=1000)
    require_risk_acceptance: bool = Field(default=True, alias="requireRiskAcceptance")
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True


class MigrationStageCompletionReadinessReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    stage: str = Field(default="python-migration-stage", min_length=2, max_length=120)
    phase: str = Field(default="phase-3", min_length=2, max_length=80)
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    completion_criteria: list[dict[str, Any]] = Field(default_factory=list, alias="completionCriteria")
    validation_results: list[dict[str, Any]] = Field(default_factory=list, alias="validationResults")
    closure_approvals: list[dict[str, Any]] = Field(default_factory=list, alias="closureApprovals")
    residual_risks: list[dict[str, Any]] = Field(default_factory=list, alias="residualRisks")
    final_evidence: dict[str, Any] = Field(default_factory=dict, alias="finalEvidence")
    min_criteria_count: int = Field(default=3, alias="minCriteriaCount", ge=0, le=1000)
    min_validation_count: int = Field(default=2, alias="minValidationCount", ge=0, le=1000)
    max_open_high_risks: int = Field(default=0, alias="maxOpenHighRisks", ge=0, le=1000)
    min_approval_count: int = Field(default=2, alias="minApprovalCount", ge=0, le=100)
    require_validation_results: bool = Field(default=True, alias="requireValidationResults")
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True



class PhaseThreeRemediationClosureReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    stage: str = Field(default="python-migration-stage", min_length=2, max_length=120)
    phase: str = Field(default="phase-3", min_length=2, max_length=80)
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    closure_items: list[dict[str, Any]] = Field(default_factory=list, alias="closureItems")
    remediation_evidence: list[dict[str, Any]] = Field(default_factory=list, alias="remediationEvidence")
    residual_risks: list[dict[str, Any]] = Field(default_factory=list, alias="residualRisks")
    acceptance_records: list[dict[str, Any]] = Field(default_factory=list, alias="acceptanceRecords")
    owner_approvals: list[dict[str, Any]] = Field(default_factory=list, alias="ownerApprovals")
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_closure_item_count: int = Field(default=2, alias="minClosureItemCount", ge=0, le=1000)
    min_remediation_evidence_count: int = Field(default=1, alias="minRemediationEvidenceCount", ge=0, le=1000)
    max_open_high_risks: int = Field(default=0, alias="maxOpenHighRisks", ge=0, le=1000)
    min_approval_count: int = Field(default=2, alias="minApprovalCount", ge=0, le=100)
    require_acceptance_records: bool = Field(default=True, alias="requireAcceptanceRecords")
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True


class ExecutiveOperationalHandoffReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    stage: str = Field(default="python-migration-stage", min_length=2, max_length=120)
    phase: str = Field(default="phase-3", min_length=2, max_length=80)
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    executive_summary: dict[str, Any] = Field(default_factory=dict, alias="executiveSummary")
    handoff_items: list[dict[str, Any]] = Field(default_factory=list, alias="handoffItems")
    support_model: list[dict[str, Any]] = Field(default_factory=list, alias="supportModel")
    kpi_baselines: list[dict[str, Any]] = Field(default_factory=list, alias="kpiBaselines")
    governance_decisions: list[dict[str, Any]] = Field(default_factory=list, alias="governanceDecisions")
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_handoff_item_count: int = Field(default=3, alias="minHandoffItemCount", ge=0, le=1000)
    min_kpi_baseline_count: int = Field(default=2, alias="minKpiBaselineCount", ge=0, le=1000)
    min_approval_count: int = Field(default=2, alias="minApprovalCount", ge=0, le=100)
    require_support_model: bool = Field(default=True, alias="requireSupportModel")
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True



class GlobalTaskStatusTrackingReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    stage: str = Field(default="python-migration-stage", min_length=2, max_length=120)
    phase: str = Field(default="phase-3", min_length=2, max_length=80)
    domain: str = Field(default="global", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    tasks: list[dict[str, Any]] = Field(default_factory=list)
    milestones: list[dict[str, Any]] = Field(default_factory=list)
    owners: list[dict[str, Any]] = Field(default_factory=list)
    blockers: list[dict[str, Any]] = Field(default_factory=list)
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_task_count: int = Field(default=3, alias="minTaskCount", ge=0, le=5000)
    min_milestone_count: int = Field(default=1, alias="minMilestoneCount", ge=0, le=1000)
    min_owner_count: int = Field(default=1, alias="minOwnerCount", ge=0, le=500)
    min_approval_count: int = Field(default=1, alias="minApprovalCount", ge=0, le=100)
    max_open_critical_blockers: int = Field(default=0, alias="maxOpenCriticalBlockers", ge=0, le=1000)
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True

class ProjectStateHealthReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    stage: str = Field(default="python-migration-stage", min_length=2, max_length=120)
    phase: str = Field(default="phase-3", min_length=2, max_length=80)
    domain: str = Field(default="global", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    applications: list[dict[str, Any]] = Field(default_factory=list)
    migration_status: dict[str, Any] = Field(default_factory=dict, alias="migrationStatus")
    risk_register: list[dict[str, Any]] = Field(default_factory=list, alias="riskRegister")
    closure_criteria: list[dict[str, Any]] = Field(default_factory=list, alias="closureCriteria")
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_application_count: int = Field(default=3, alias="minApplicationCount", ge=0, le=1000)
    min_completion_percent: float = Field(default=0.75, alias="minCompletionPercent", ge=0, le=1)
    max_open_high_risks: int = Field(default=0, alias="maxOpenHighRisks", ge=0, le=1000)
    min_closure_criteria_count: int = Field(default=2, alias="minClosureCriteriaCount", ge=0, le=1000)
    min_approval_count: int = Field(default=1, alias="minApprovalCount", ge=0, le=100)
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True



class StageClosureCertificationReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    stage: str = Field(default="python-migration-stage", min_length=2, max_length=120)
    phase: str = Field(default="phase-3", min_length=2, max_length=80)
    domain: str = Field(default="global", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    certification_items: list[dict[str, Any]] = Field(default_factory=list, alias="certificationItems")
    final_evidence: list[dict[str, Any]] = Field(default_factory=list, alias="finalEvidence")
    signoffs: list[dict[str, Any]] = Field(default_factory=list)
    release_artifacts: dict[str, Any] = Field(default_factory=dict, alias="releaseArtifacts")
    residual_risks: list[dict[str, Any]] = Field(default_factory=list, alias="residualRisks")
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_certification_item_count: int = Field(default=3, alias="minCertificationItemCount", ge=0, le=1000)
    min_signoff_count: int = Field(default=2, alias="minSignoffCount", ge=0, le=100)
    max_open_high_risks: int = Field(default=0, alias="maxOpenHighRisks", ge=0, le=1000)
    require_release_artifacts: bool = Field(default=True, alias="requireReleaseArtifacts")
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True

class PostClosureOperationalTransitionReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    stage: str = Field(default="post-closure", min_length=2, max_length=120)
    phase: str = Field(default="phase-3", min_length=2, max_length=80)
    domain: str = Field(default="global", min_length=2, max_length=120)
    operating_mode: str = Field(default="steady-state-transition", alias="operatingMode", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    transition_items: list[dict[str, Any]] = Field(default_factory=list, alias="transitionItems")
    monitoring_plan: dict[str, Any] = Field(default_factory=dict, alias="monitoringPlan")
    ownership_handoff: dict[str, Any] = Field(default_factory=dict, alias="ownershipHandoff")
    support_readiness: list[dict[str, Any]] = Field(default_factory=list, alias="supportReadiness")
    kpi_baselines: list[dict[str, Any]] = Field(default_factory=list, alias="kpiBaselines")
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_transition_item_count: int = Field(default=2, alias="minTransitionItemCount", ge=0, le=1000)
    min_support_readiness_count: int = Field(default=2, alias="minSupportReadinessCount", ge=0, le=1000)
    min_approval_count: int = Field(default=2, alias="minApprovalCount", ge=0, le=100)
    require_monitoring_plan: bool = Field(default=True, alias="requireMonitoringPlan")
    require_ownership_handoff: bool = Field(default=True, alias="requireOwnershipHandoff")
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True


class PostClosureMonitoringReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    stage: str = Field(default="post-closure", min_length=2, max_length=120)
    phase: str = Field(default="phase-3", min_length=2, max_length=80)
    domain: str = Field(default="global", min_length=2, max_length=120)
    operating_mode: str = Field(default="post-closure-monitoring", alias="operatingMode", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    monitoring_windows: list[dict[str, Any]] = Field(default_factory=list, alias="monitoringWindows")
    slo_signals: list[dict[str, Any]] = Field(default_factory=list, alias="sloSignals")
    incident_signals: list[dict[str, Any]] = Field(default_factory=list, alias="incidentSignals")
    adoption_signals: list[dict[str, Any]] = Field(default_factory=list, alias="adoptionSignals")
    regression_checks: list[dict[str, Any]] = Field(default_factory=list, alias="regressionChecks")
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_monitoring_window_count: int = Field(default=2, alias="minMonitoringWindowCount", ge=0, le=1000)
    min_slo_signal_count: int = Field(default=2, alias="minSloSignalCount", ge=0, le=1000)
    min_approval_count: int = Field(default=2, alias="minApprovalCount", ge=0, le=100)
    max_open_incidents: int = Field(default=0, alias="maxOpenIncidents", ge=0, le=1000)
    max_slo_breaches: int = Field(default=0, alias="maxSloBreaches", ge=0, le=1000)
    require_regression_checks: bool = Field(default=True, alias="requireRegressionChecks")
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True


class SteadyStateTransferValidationReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    stage: str = Field(default="steady-state-transfer", min_length=2, max_length=120)
    phase: str = Field(default="phase-3", min_length=2, max_length=80)
    target_state: str = Field(default="stable-operations", alias="targetState", min_length=2, max_length=120)
    domain: str = Field(default="global", min_length=2, max_length=120)
    operating_mode: str = Field(default="steady-state", alias="operatingMode", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    transfer_items: list[dict[str, Any]] = Field(default_factory=list, alias="transferItems")
    ownership_matrix: list[dict[str, Any]] = Field(default_factory=list, alias="ownershipMatrix")
    runbook_coverage: list[dict[str, Any]] = Field(default_factory=list, alias="runbookCoverage")
    monitoring_readiness: list[dict[str, Any]] = Field(default_factory=list, alias="monitoringReadiness")
    knowledge_transfer: list[dict[str, Any]] = Field(default_factory=list, alias="knowledgeTransfer")
    support_model: dict[str, Any] = Field(default_factory=dict, alias="supportModel")
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_transfer_item_count: int = Field(default=2, alias="minTransferItemCount", ge=0, le=1000)
    min_owner_ack_count: int = Field(default=2, alias="minOwnerAckCount", ge=0, le=1000)
    min_runbook_count: int = Field(default=2, alias="minRunbookCount", ge=0, le=1000)
    min_monitoring_readiness_count: int = Field(default=2, alias="minMonitoringReadinessCount", ge=0, le=1000)
    min_approval_count: int = Field(default=2, alias="minApprovalCount", ge=0, le=100)
    require_support_model: bool = Field(default=True, alias="requireSupportModel")
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True



class SteadyStateOperationalAssuranceReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    stage: str = Field(default="steady-state-operations", min_length=2, max_length=120)
    phase: str = Field(default="post-phase-3", min_length=2, max_length=80)
    target_state: str = Field(default="stable-operations", alias="targetState", min_length=2, max_length=120)
    domain: str = Field(default="global", min_length=2, max_length=120)
    operating_mode: str = Field(default="steady-state", alias="operatingMode", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    operational_metrics: list[dict[str, Any]] = Field(default_factory=list, alias="operationalMetrics")
    slo_health: list[dict[str, Any]] = Field(default_factory=list, alias="sloHealth")
    incident_trends: list[dict[str, Any]] = Field(default_factory=list, alias="incidentTrends")
    support_queues: list[dict[str, Any]] = Field(default_factory=list, alias="supportQueues")
    runbook_audits: list[dict[str, Any]] = Field(default_factory=list, alias="runbookAudits")
    ownership_reviews: list[dict[str, Any]] = Field(default_factory=list, alias="ownershipReviews")
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_operational_metric_count: int = Field(default=2, alias="minOperationalMetricCount", ge=0, le=1000)
    min_slo_health_count: int = Field(default=2, alias="minSloHealthCount", ge=0, le=1000)
    max_open_sev1_incidents: int = Field(default=0, alias="maxOpenSev1Incidents", ge=0, le=1000)
    max_overdue_support_items: int = Field(default=0, alias="maxOverdueSupportItems", ge=0, le=10000)
    min_runbook_audit_count: int = Field(default=1, alias="minRunbookAuditCount", ge=0, le=1000)
    min_ownership_review_count: int = Field(default=1, alias="minOwnershipReviewCount", ge=0, le=1000)
    min_approval_count: int = Field(default=2, alias="minApprovalCount", ge=0, le=100)
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True

class ContinuousImprovementBacklogReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    stage: str = Field(default="continuous-improvement", min_length=2, max_length=120)
    phase: str = Field(default="post-phase-3", min_length=2, max_length=80)
    domain: str = Field(default="global", min_length=2, max_length=120)
    operating_mode: str = Field(default="steady-state-improvement", alias="operatingMode", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    improvement_items: list[dict[str, Any]] = Field(default_factory=list, alias="improvementItems")
    value_hypotheses: list[dict[str, Any]] = Field(default_factory=list, alias="valueHypotheses")
    technical_debt_items: list[dict[str, Any]] = Field(default_factory=list, alias="technicalDebtItems")
    risk_items: list[dict[str, Any]] = Field(default_factory=list, alias="riskItems")
    owner_commitments: list[dict[str, Any]] = Field(default_factory=list, alias="ownerCommitments")
    governance_reviews: list[dict[str, Any]] = Field(default_factory=list, alias="governanceReviews")
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_improvement_item_count: int = Field(default=2, alias="minImprovementItemCount", ge=0, le=1000)
    min_owner_commitment_count: int = Field(default=1, alias="minOwnerCommitmentCount", ge=0, le=1000)
    max_open_high_risks: int = Field(default=0, alias="maxOpenHighRisks", ge=0, le=1000)
    min_governance_review_count: int = Field(default=1, alias="minGovernanceReviewCount", ge=0, le=1000)
    min_approval_count: int = Field(default=1, alias="minApprovalCount", ge=0, le=100)
    require_value_hypotheses: bool = Field(default=False, alias="requireValueHypotheses")
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True


class StableOperationsOptimizationReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    stage: str = Field(default="stable-operations-optimization", min_length=2, max_length=120)
    phase: str = Field(default="post-phase-3", min_length=2, max_length=80)
    domain: str = Field(default="global", min_length=2, max_length=120)
    operating_mode: str = Field(default="steady-state-optimization", alias="operatingMode", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    optimization_metrics: list[dict[str, Any]] = Field(default_factory=list, alias="optimizationMetrics")
    cost_signals: list[dict[str, Any]] = Field(default_factory=list, alias="costSignals")
    reliability_signals: list[dict[str, Any]] = Field(default_factory=list, alias="reliabilitySignals")
    automation_opportunities: list[dict[str, Any]] = Field(default_factory=list, alias="automationOpportunities")
    debt_items: list[dict[str, Any]] = Field(default_factory=list, alias="debtItems")
    guardrail_reviews: list[dict[str, Any]] = Field(default_factory=list, alias="guardrailReviews")
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_optimization_metric_count: int = Field(default=2, alias="minOptimizationMetricCount", ge=0, le=1000)
    min_guardrail_review_count: int = Field(default=1, alias="minGuardrailReviewCount", ge=0, le=1000)
    max_open_critical_debt: int = Field(default=0, alias="maxOpenCriticalDebt", ge=0, le=1000)
    min_approval_count: int = Field(default=1, alias="minApprovalCount", ge=0, le=100)
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True

class RecurringMaintenanceCycleReadinessReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    stage: str = Field(default="recurring-maintenance", min_length=2, max_length=120)
    phase: str = Field(default="steady-state", min_length=2, max_length=80)
    target_cycle: str = Field(default="monthly-operations-maintenance", alias="targetCycle", min_length=2, max_length=120)
    domain: str = Field(default="global", min_length=2, max_length=120)
    operating_mode: str = Field(default="recurring-maintenance", alias="operatingMode", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    maintenance_windows: list[dict[str, Any]] = Field(default_factory=list, alias="maintenanceWindows")
    patch_cadence: dict[str, Any] = Field(default_factory=dict, alias="patchCadence")
    dependency_update_plan: dict[str, Any] = Field(default_factory=dict, alias="dependencyUpdatePlan")
    backup_validation: dict[str, Any] = Field(default_factory=dict, alias="backupValidation")
    runbook_schedule: list[dict[str, Any]] = Field(default_factory=list, alias="runbookSchedule")
    owner_roster: list[dict[str, Any]] = Field(default_factory=list, alias="ownerRoster")
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_maintenance_window_count: int = Field(default=1, alias="minMaintenanceWindowCount", ge=0, le=1000)
    min_owner_count: int = Field(default=1, alias="minOwnerCount", ge=0, le=500)
    min_approval_count: int = Field(default=1, alias="minApprovalCount", ge=0, le=100)
    require_patch_cadence: bool = Field(default=True, alias="requirePatchCadence")
    require_backup_validation: bool = Field(default=True, alias="requireBackupValidation")
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True


class MaintenanceCycleExecutionReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    stage: str = Field(default="maintenance-cycle-execution", min_length=2, max_length=120)
    phase: str = Field(default="steady-state", min_length=2, max_length=80)
    cycle_id: str = Field(default="monthly-operations-maintenance", alias="cycleId", min_length=2, max_length=120)
    domain: str = Field(default="global", min_length=2, max_length=120)
    operating_mode: str = Field(default="governed-maintenance-execution", alias="operatingMode", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    execution_items: list[dict[str, Any]] = Field(default_factory=list, alias="executionItems")
    patch_results: list[dict[str, Any]] = Field(default_factory=list, alias="patchResults")
    dependency_results: list[dict[str, Any]] = Field(default_factory=list, alias="dependencyResults")
    backup_results: list[dict[str, Any]] = Field(default_factory=list, alias="backupResults")
    validation_results: list[dict[str, Any]] = Field(default_factory=list, alias="validationResults")
    rollback_readiness: dict[str, Any] = Field(default_factory=dict, alias="rollbackReadiness")
    communications: list[dict[str, Any]] = Field(default_factory=list)
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_execution_item_count: int = Field(default=2, alias="minExecutionItemCount", ge=0, le=1000)
    min_validation_result_count: int = Field(default=2, alias="minValidationResultCount", ge=0, le=1000)
    max_failed_critical_items: int = Field(default=0, alias="maxFailedCriticalItems", ge=0, le=1000)
    min_approval_count: int = Field(default=1, alias="minApprovalCount", ge=0, le=100)
    require_backup_results: bool = Field(default=True, alias="requireBackupResults")
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True


class LongTermOperabilitySustainabilityReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    stage: str = Field(default="long-term-operability-sustainability", min_length=2, max_length=120)
    phase: str = Field(default="steady-state", min_length=2, max_length=80)
    horizon: str = Field(default="quarterly-sustainability", min_length=2, max_length=120)
    domain: str = Field(default="global", min_length=2, max_length=120)
    operating_mode: str = Field(default="long-term-sustainability", alias="operatingMode", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    sustainability_metrics: list[dict[str, Any]] = Field(default_factory=list, alias="sustainabilityMetrics")
    ownership_signals: list[dict[str, Any]] = Field(default_factory=list, alias="ownershipSignals")
    knowledge_base_reviews: list[dict[str, Any]] = Field(default_factory=list, alias="knowledgeBaseReviews")
    dependency_lifecycle: dict[str, Any] = Field(default_factory=dict, alias="dependencyLifecycle")
    budget_signals: list[dict[str, Any]] = Field(default_factory=list, alias="budgetSignals")
    risk_acceptances: list[dict[str, Any]] = Field(default_factory=list, alias="riskAcceptances")
    improvement_cadence: dict[str, Any] = Field(default_factory=dict, alias="improvementCadence")
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_sustainability_metric_count: int = Field(default=2, alias="minSustainabilityMetricCount", ge=0, le=1000)
    min_ownership_signal_count: int = Field(default=1, alias="minOwnershipSignalCount", ge=0, le=1000)
    min_knowledge_review_count: int = Field(default=1, alias="minKnowledgeReviewCount", ge=0, le=1000)
    max_open_high_risks: int = Field(default=0, alias="maxOpenHighRisks", ge=0, le=1000)
    min_approval_count: int = Field(default=1, alias="minApprovalCount", ge=0, le=100)
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True



class RecurringOperationalMaturityAuditReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    stage: str = Field(default="recurring-operational-maturity-audit", min_length=2, max_length=120)
    phase: str = Field(default="steady-state", min_length=2, max_length=80)
    audit_cycle: str = Field(default="quarterly-operations-maturity", alias="auditCycle", min_length=2, max_length=120)
    domain: str = Field(default="global", min_length=2, max_length=120)
    operating_mode: str = Field(default="recurring-maturity-governance", alias="operatingMode", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    maturity_dimensions: list[dict[str, Any]] = Field(default_factory=list, alias="maturityDimensions")
    control_checks: list[dict[str, Any]] = Field(default_factory=list, alias="controlChecks")
    incident_learnings: list[dict[str, Any]] = Field(default_factory=list, alias="incidentLearnings")
    support_signals: list[dict[str, Any]] = Field(default_factory=list, alias="supportSignals")
    operator_evidence: list[dict[str, Any]] = Field(default_factory=list, alias="operatorEvidence")
    risks: list[dict[str, Any]] = Field(default_factory=list)
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_maturity_dimension_count: int = Field(default=2, alias="minMaturityDimensionCount", ge=0, le=1000)
    min_control_check_count: int = Field(default=2, alias="minControlCheckCount", ge=0, le=1000)
    min_operator_evidence_count: int = Field(default=1, alias="minOperatorEvidenceCount", ge=0, le=1000)
    max_open_high_risks: int = Field(default=0, alias="maxOpenHighRisks", ge=0, le=1000)
    min_approval_count: int = Field(default=1, alias="minApprovalCount", ge=0, le=100)
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True


class StableStateContinuityControlReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    stage: str = Field(default="stable-state-continuity-control", min_length=2, max_length=120)
    phase: str = Field(default="steady-state", min_length=2, max_length=80)
    horizon: str = Field(default="quarterly-continuity", min_length=2, max_length=120)
    domain: str = Field(default="global", min_length=2, max_length=120)
    operating_mode: str = Field(default="stable-state-continuity", alias="operatingMode", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    continuity_controls: list[dict[str, Any]] = Field(default_factory=list, alias="continuityControls")
    dr_signals: list[dict[str, Any]] = Field(default_factory=list, alias="drSignals")
    dependency_continuity: list[dict[str, Any]] = Field(default_factory=list, alias="dependencyContinuity")
    operational_fallbacks: list[dict[str, Any]] = Field(default_factory=list, alias="operationalFallbacks")
    communication_checks: list[dict[str, Any]] = Field(default_factory=list, alias="communicationChecks")
    risks: list[dict[str, Any]] = Field(default_factory=list)
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_continuity_control_count: int = Field(default=2, alias="minContinuityControlCount", ge=0, le=1000)
    min_dr_signal_count: int = Field(default=1, alias="minDrSignalCount", ge=0, le=1000)
    min_fallback_count: int = Field(default=1, alias="minFallbackCount", ge=0, le=1000)
    max_open_high_risks: int = Field(default=0, alias="maxOpenHighRisks", ge=0, le=1000)
    min_approval_count: int = Field(default=1, alias="minApprovalCount", ge=0, le=100)
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True

class OperationalResilienceGovernanceReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    stage: str = Field(default="operational-resilience-governance", min_length=2, max_length=120)
    phase: str = Field(default="steady-state", min_length=2, max_length=80)
    governance_cycle: str = Field(default="quarterly-resilience-governance", alias="governanceCycle", min_length=2, max_length=120)
    domain: str = Field(default="global", min_length=2, max_length=120)
    operating_mode: str = Field(default="resilience-governance", alias="operatingMode", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    resilience_controls: list[dict[str, Any]] = Field(default_factory=list, alias="resilienceControls")
    chaos_drills: list[dict[str, Any]] = Field(default_factory=list, alias="chaosDrills")
    failover_readiness: list[dict[str, Any]] = Field(default_factory=list, alias="failoverReadiness")
    service_ownership: list[dict[str, Any]] = Field(default_factory=list, alias="serviceOwnership")
    risk_items: list[dict[str, Any]] = Field(default_factory=list, alias="riskItems")
    governance_reviews: list[dict[str, Any]] = Field(default_factory=list, alias="governanceReviews")
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_resilience_control_count: int = Field(default=2, alias="minResilienceControlCount", ge=0, le=1000)
    min_chaos_drill_count: int = Field(default=1, alias="minChaosDrillCount", ge=0, le=1000)
    min_failover_readiness_count: int = Field(default=1, alias="minFailoverReadinessCount", ge=0, le=1000)
    min_ownership_count: int = Field(default=1, alias="minOwnershipCount", ge=0, le=1000)
    max_open_high_risks: int = Field(default=0, alias="maxOpenHighRisks", ge=0, le=1000)
    min_approval_count: int = Field(default=1, alias="minApprovalCount", ge=0, le=100)
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True


class RecoveryCapabilityValidationReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    stage: str = Field(default="recovery-capability-validation", min_length=2, max_length=120)
    phase: str = Field(default="steady-state", min_length=2, max_length=80)
    validation_window: str = Field(default="quarterly-recovery-validation", alias="validationWindow", min_length=2, max_length=120)
    domain: str = Field(default="global", min_length=2, max_length=120)
    operating_mode: str = Field(default="recovery-capability-validation", alias="operatingMode", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    restore_tests: list[dict[str, Any]] = Field(default_factory=list, alias="restoreTests")
    rto_rpo_checks: list[dict[str, Any]] = Field(default_factory=list, alias="rtoRpoChecks")
    backup_integrity: list[dict[str, Any]] = Field(default_factory=list, alias="backupIntegrity")
    incident_replay_results: list[dict[str, Any]] = Field(default_factory=list, alias="incidentReplayResults")
    dependency_recovery: list[dict[str, Any]] = Field(default_factory=list, alias="dependencyRecovery")
    communication_validation: list[dict[str, Any]] = Field(default_factory=list, alias="communicationValidation")
    risks: list[dict[str, Any]] = Field(default_factory=list)
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_restore_test_count: int = Field(default=1, alias="minRestoreTestCount", ge=0, le=1000)
    min_rto_rpo_check_count: int = Field(default=1, alias="minRtoRpoCheckCount", ge=0, le=1000)
    min_backup_integrity_count: int = Field(default=1, alias="minBackupIntegrityCount", ge=0, le=1000)
    max_open_high_risks: int = Field(default=0, alias="maxOpenHighRisks", ge=0, le=1000)
    min_approval_count: int = Field(default=1, alias="minApprovalCount", ge=0, le=100)
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True


class OperationalResilienceOptimizationReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    stage: str = Field(default="operational-resilience-optimization", min_length=2, max_length=120)
    phase: str = Field(default="steady-state", min_length=2, max_length=80)
    optimization_cycle: str = Field(default="quarterly-resilience-optimization", alias="optimizationCycle", min_length=2, max_length=120)
    domain: str = Field(default="global", min_length=2, max_length=120)
    operating_mode: str = Field(default="resilience-optimization", alias="operatingMode", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    resilience_metrics: list[dict[str, Any]] = Field(default_factory=list, alias="resilienceMetrics")
    optimization_actions: list[dict[str, Any]] = Field(default_factory=list, alias="optimizationActions")
    automation_candidates: list[dict[str, Any]] = Field(default_factory=list, alias="automationCandidates")
    incident_patterns: list[dict[str, Any]] = Field(default_factory=list, alias="incidentPatterns")
    capacity_signals: list[dict[str, Any]] = Field(default_factory=list, alias="capacitySignals")
    risk_items: list[dict[str, Any]] = Field(default_factory=list, alias="riskItems")
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_resilience_metric_count: int = Field(default=2, alias="minResilienceMetricCount", ge=0, le=1000)
    min_optimization_action_count: int = Field(default=1, alias="minOptimizationActionCount", ge=0, le=1000)
    min_automation_candidate_count: int = Field(default=1, alias="minAutomationCandidateCount", ge=0, le=1000)
    max_open_high_risks: int = Field(default=0, alias="maxOpenHighRisks", ge=0, le=1000)
    min_approval_count: int = Field(default=1, alias="minApprovalCount", ge=0, le=100)
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True


class AutomatedContinuityPreparednessReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    stage: str = Field(default="automated-continuity-preparedness", min_length=2, max_length=120)
    phase: str = Field(default="steady-state", min_length=2, max_length=80)
    preparedness_window: str = Field(default="quarterly-continuity-automation", alias="preparednessWindow", min_length=2, max_length=120)
    domain: str = Field(default="global", min_length=2, max_length=120)
    operating_mode: str = Field(default="automated-continuity-preparedness", alias="operatingMode", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    automation_controls: list[dict[str, Any]] = Field(default_factory=list, alias="automationControls")
    continuity_runbooks: list[dict[str, Any]] = Field(default_factory=list, alias="continuityRunbooks")
    scheduler_readiness: list[dict[str, Any]] = Field(default_factory=list, alias="schedulerReadiness")
    dependency_hooks: list[dict[str, Any]] = Field(default_factory=list, alias="dependencyHooks")
    notification_templates: list[dict[str, Any]] = Field(default_factory=list, alias="notificationTemplates")
    risks: list[dict[str, Any]] = Field(default_factory=list)
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_automation_control_count: int = Field(default=2, alias="minAutomationControlCount", ge=0, le=1000)
    min_runbook_count: int = Field(default=1, alias="minRunbookCount", ge=0, le=1000)
    min_scheduler_readiness_count: int = Field(default=1, alias="minSchedulerReadinessCount", ge=0, le=1000)
    min_dependency_hook_count: int = Field(default=1, alias="minDependencyHookCount", ge=0, le=1000)
    max_open_high_risks: int = Field(default=0, alias="maxOpenHighRisks", ge=0, le=1000)
    min_approval_count: int = Field(default=1, alias="minApprovalCount", ge=0, le=100)
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True


class AutomatedContinuityExecutionValidationReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    stage: str = Field(default="automated-continuity-execution-validation", min_length=2, max_length=120)
    phase: str = Field(default="steady-state", min_length=2, max_length=80)
    execution_window: str = Field(default="quarterly-continuity-execution", alias="executionWindow", min_length=2, max_length=120)
    domain: str = Field(default="global", min_length=2, max_length=120)
    operating_mode: str = Field(default="automated-continuity-execution-validation", alias="operatingMode", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    execution_runs: list[dict[str, Any]] = Field(default_factory=list, alias="executionRuns")
    scheduler_events: list[dict[str, Any]] = Field(default_factory=list, alias="schedulerEvents")
    dependency_hooks: list[dict[str, Any]] = Field(default_factory=list, alias="dependencyHooks")
    notification_deliveries: list[dict[str, Any]] = Field(default_factory=list, alias="notificationDeliveries")
    runbook_checkpoints: list[dict[str, Any]] = Field(default_factory=list, alias="runbookCheckpoints")
    risk_items: list[dict[str, Any]] = Field(default_factory=list, alias="riskItems")
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_execution_run_count: int = Field(default=1, alias="minExecutionRunCount", ge=0, le=1000)
    min_scheduler_event_count: int = Field(default=1, alias="minSchedulerEventCount", ge=0, le=1000)
    min_dependency_hook_count: int = Field(default=1, alias="minDependencyHookCount", ge=0, le=1000)
    min_runbook_checkpoint_count: int = Field(default=1, alias="minRunbookCheckpointCount", ge=0, le=1000)
    max_open_high_risks: int = Field(default=0, alias="maxOpenHighRisks", ge=0, le=1000)
    min_approval_count: int = Field(default=1, alias="minApprovalCount", ge=0, le=100)
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True


class OperationalResilienceFeedbackLoopReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    stage: str = Field(default="operational-resilience-feedback-loop", min_length=2, max_length=120)
    phase: str = Field(default="steady-state", min_length=2, max_length=80)
    feedback_cycle: str = Field(default="quarterly-resilience-feedback", alias="feedbackCycle", min_length=2, max_length=120)
    domain: str = Field(default="global", min_length=2, max_length=120)
    operating_mode: str = Field(default="operational-resilience-feedback-loop", alias="operatingMode", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    feedback_signals: list[dict[str, Any]] = Field(default_factory=list, alias="feedbackSignals")
    remediation_items: list[dict[str, Any]] = Field(default_factory=list, alias="remediationItems")
    learning_items: list[dict[str, Any]] = Field(default_factory=list, alias="learningItems")
    metric_adjustments: list[dict[str, Any]] = Field(default_factory=list, alias="metricAdjustments")
    owner_responses: list[dict[str, Any]] = Field(default_factory=list, alias="ownerResponses")
    risks: list[dict[str, Any]] = Field(default_factory=list)
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_feedback_signal_count: int = Field(default=2, alias="minFeedbackSignalCount", ge=0, le=1000)
    min_remediation_item_count: int = Field(default=1, alias="minRemediationItemCount", ge=0, le=1000)
    min_learning_item_count: int = Field(default=1, alias="minLearningItemCount", ge=0, le=1000)
    max_open_high_risks: int = Field(default=0, alias="maxOpenHighRisks", ge=0, le=1000)
    min_approval_count: int = Field(default=1, alias="minApprovalCount", ge=0, le=100)
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True

class FinalClosureEvidencePackageReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    stage: str = Field(default="final-closure-evidence-package", min_length=2, max_length=120)
    phase: str = Field(default="closure", min_length=2, max_length=80)
    closure_window: str = Field(default="pre-handover-final-evidence", alias="closureWindow", min_length=2, max_length=120)
    domain: str = Field(default="global", min_length=2, max_length=120)
    operating_mode: str = Field(default="final-closure-evidence-package", alias="operatingMode", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    version_summary: list[dict[str, Any]] = Field(default_factory=list, alias="versionSummary")
    validation_results: list[dict[str, Any]] = Field(default_factory=list, alias="validationResults")
    contract_evidence: list[dict[str, Any]] = Field(default_factory=list, alias="contractEvidence")
    api_route_evidence: list[dict[str, Any]] = Field(default_factory=list, alias="apiRouteEvidence")
    worker_evidence: list[dict[str, Any]] = Field(default_factory=list, alias="workerEvidence")
    residual_risks: list[dict[str, Any]] = Field(default_factory=list, alias="residualRisks")
    signoffs: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_version_summary_count: int = Field(default=1, alias="minVersionSummaryCount", ge=0, le=1000)
    min_validation_result_count: int = Field(default=2, alias="minValidationResultCount", ge=0, le=1000)
    min_contract_evidence_count: int = Field(default=1, alias="minContractEvidenceCount", ge=0, le=1000)
    min_api_route_evidence_count: int = Field(default=1, alias="minApiRouteEvidenceCount", ge=0, le=1000)
    min_worker_evidence_count: int = Field(default=1, alias="minWorkerEvidenceCount", ge=0, le=1000)
    max_open_high_risks: int = Field(default=0, alias="maxOpenHighRisks", ge=0, le=1000)
    min_signoff_count: int = Field(default=2, alias="minSignoffCount", ge=0, le=100)
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True


class GlobalImplementationCompletionChecklistReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    stage: str = Field(default="global-implementation-completion-checklist", min_length=2, max_length=120)
    phase: str = Field(default="closure", min_length=2, max_length=80)
    checklist_scope: str = Field(default="option-b-python-progressive", alias="checklistScope", min_length=2, max_length=120)
    domain: str = Field(default="global", min_length=2, max_length=120)
    operating_mode: str = Field(default="completion-checklist-review", alias="operatingMode", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    functional_areas: list[dict[str, Any]] = Field(default_factory=list, alias="functionalAreas")
    implementation_tasks: list[dict[str, Any]] = Field(default_factory=list, alias="implementationTasks")
    validation_tasks: list[dict[str, Any]] = Field(default_factory=list, alias="validationTasks")
    handover_tasks: list[dict[str, Any]] = Field(default_factory=list, alias="handoverTasks")
    deferred_items: list[dict[str, Any]] = Field(default_factory=list, alias="deferredItems")
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_functional_area_count: int = Field(default=3, alias="minFunctionalAreaCount", ge=0, le=1000)
    min_implementation_task_count: int = Field(default=5, alias="minImplementationTaskCount", ge=0, le=1000)
    min_validation_task_count: int = Field(default=3, alias="minValidationTaskCount", ge=0, le=1000)
    min_handover_task_count: int = Field(default=1, alias="minHandoverTaskCount", ge=0, le=1000)
    max_open_critical_deferred_items: int = Field(default=0, alias="maxOpenCriticalDeferredItems", ge=0, le=1000)
    min_approval_count: int = Field(default=1, alias="minApprovalCount", ge=0, le=100)
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True




class FinalOperationalHandoverReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    stage: str = Field(default="final-operational-handover", min_length=2, max_length=120)
    phase: str = Field(default="closure", min_length=2, max_length=80)
    handover_scope: str = Field(default="option-b-python-progressive", alias="handoverScope", min_length=2, max_length=120)
    domain: str = Field(default="global", min_length=2, max_length=120)
    operating_mode: str = Field(default="final-operational-handover", alias="operatingMode", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    runbooks: list[dict[str, Any]] = Field(default_factory=list)
    owner_assignments: list[dict[str, Any]] = Field(default_factory=list, alias="ownerAssignments")
    support_model: list[dict[str, Any]] = Field(default_factory=list, alias="supportModel")
    monitoring_controls: list[dict[str, Any]] = Field(default_factory=list, alias="monitoringControls")
    escalation_paths: list[dict[str, Any]] = Field(default_factory=list, alias="escalationPaths")
    operational_risks: list[dict[str, Any]] = Field(default_factory=list, alias="operationalRisks")
    signoffs: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_runbook_count: int = Field(default=2, alias="minRunbookCount", ge=0, le=1000)
    min_owner_assignment_count: int = Field(default=2, alias="minOwnerAssignmentCount", ge=0, le=1000)
    min_support_model_count: int = Field(default=1, alias="minSupportModelCount", ge=0, le=1000)
    min_monitoring_control_count: int = Field(default=1, alias="minMonitoringControlCount", ge=0, le=1000)
    min_escalation_path_count: int = Field(default=1, alias="minEscalationPathCount", ge=0, le=1000)
    max_open_high_risks: int = Field(default=0, alias="maxOpenHighRisks", ge=0, le=1000)
    min_signoff_count: int = Field(default=2, alias="minSignoffCount", ge=0, le=100)
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True


class PhaseClosureCertificationReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    stage: str = Field(default="phase-closure-certification", min_length=2, max_length=120)
    phase: str = Field(default="closure", min_length=2, max_length=80)
    certification_scope: str = Field(default="option-b-python-progressive", alias="certificationScope", min_length=2, max_length=120)
    domain: str = Field(default="global", min_length=2, max_length=120)
    operating_mode: str = Field(default="phase-closure-certification", alias="operatingMode", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    closure_criteria: list[dict[str, Any]] = Field(default_factory=list, alias="closureCriteria")
    evidence_package: list[dict[str, Any]] = Field(default_factory=list, alias="evidencePackage")
    handover_evidence: list[dict[str, Any]] = Field(default_factory=list, alias="handoverEvidence")
    residual_risks: list[dict[str, Any]] = Field(default_factory=list, alias="residualRisks")
    release_artifacts: list[dict[str, Any]] = Field(default_factory=list, alias="releaseArtifacts")
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    next_phase_backlog: list[dict[str, Any]] = Field(default_factory=list, alias="nextPhaseBacklog")
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_closure_criteria_count: int = Field(default=2, alias="minClosureCriteriaCount", ge=0, le=1000)
    min_evidence_package_count: int = Field(default=1, alias="minEvidencePackageCount", ge=0, le=1000)
    min_handover_evidence_count: int = Field(default=1, alias="minHandoverEvidenceCount", ge=0, le=1000)
    min_release_artifact_count: int = Field(default=2, alias="minReleaseArtifactCount", ge=0, le=1000)
    max_open_high_risks: int = Field(default=0, alias="maxOpenHighRisks", ge=0, le=1000)
    min_approval_count: int = Field(default=2, alias="minApprovalCount", ge=0, le=100)
    require_next_phase_backlog_separation: bool = Field(default=True, alias="requireNextPhaseBacklogSeparation")
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True

class FinalAcceptanceEvidenceReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    stage: str = Field(default="python-migration-stage", min_length=2, max_length=120)
    phase: str = Field(default="phase-3", min_length=2, max_length=80)
    domain: str = Field(default="global", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    acceptance_criteria: list[dict[str, Any]] = Field(default_factory=list, alias="acceptanceCriteria")
    validation_evidence: list[dict[str, Any]] = Field(default_factory=list, alias="validationEvidence")
    test_results: list[dict[str, Any]] = Field(default_factory=list, alias="testResults")
    residual_risks: list[dict[str, Any]] = Field(default_factory=list, alias="residualRisks")
    signoffs: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_acceptance_criteria_count: int = Field(default=3, alias="minAcceptanceCriteriaCount", ge=0, le=1000)
    min_validation_evidence_count: int = Field(default=2, alias="minValidationEvidenceCount", ge=0, le=1000)
    min_signoff_count: int = Field(default=2, alias="minSignoffCount", ge=0, le=100)
    max_open_high_risks: int = Field(default=0, alias="maxOpenHighRisks", ge=0, le=1000)
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True

class StageExitReadinessReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    stage: str = Field(default="python-migration-stage", min_length=2, max_length=120)
    phase: str = Field(default="phase-3", min_length=2, max_length=80)
    target_state: str = Field(default="stage-complete", alias="targetState", min_length=2, max_length=120)
    domain: str = Field(default="global", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    exit_criteria: list[dict[str, Any]] = Field(default_factory=list, alias="exitCriteria")
    operational_handoff: list[dict[str, Any]] = Field(default_factory=list, alias="operationalHandoff")
    evidence_bundle: dict[str, Any] = Field(default_factory=dict, alias="evidenceBundle")
    rollback_plan: dict[str, Any] = Field(default_factory=dict, alias="rollbackPlan")
    support_readiness: list[dict[str, Any]] = Field(default_factory=list, alias="supportReadiness")
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_exit_criteria_count: int = Field(default=3, alias="minExitCriteriaCount", ge=0, le=1000)
    min_handoff_count: int = Field(default=2, alias="minHandoffCount", ge=0, le=1000)
    min_support_readiness_count: int = Field(default=2, alias="minSupportReadinessCount", ge=0, le=1000)
    min_approval_count: int = Field(default=2, alias="minApprovalCount", ge=0, le=100)
    require_rollback_plan: bool = Field(default=True, alias="requireRollbackPlan")
    require_evidence_bundle: bool = Field(default=True, alias="requireEvidenceBundle")
    class Config:
        populate_by_name = True

class PhaseTwoClosureAcceptanceReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    phase: str = Field(default="phase-2", min_length=2, max_length=80)
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    closure_criteria: list[dict[str, Any]] = Field(default_factory=list, alias="closureCriteria")
    acceptance_evidence: list[dict[str, Any]] = Field(default_factory=list, alias="acceptanceEvidence")
    open_risks: list[dict[str, Any]] = Field(default_factory=list, alias="openRisks")
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    value_realization_summary: dict[str, Any] = Field(default_factory=dict, alias="valueRealizationSummary")
    support_transition: dict[str, Any] = Field(default_factory=dict, alias="supportTransition")
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_criteria_count: int = Field(default=3, alias="minCriteriaCount", ge=0, le=1000)
    min_approval_count: int = Field(default=2, alias="minApprovalCount", ge=0, le=100)
    max_open_high_risks: int = Field(default=0, alias="maxOpenHighRisks", ge=0, le=1000)
    min_value_score: float = Field(default=0.80, alias="minValueScore", ge=0, le=1)
    require_support_transition: bool = Field(default=True, alias="requireSupportTransition")
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True

class PhaseThreeTransitionReadinessReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    phase: str = Field(default="phase-2", min_length=2, max_length=80)
    next_phase: str = Field(default="phase-3", alias="nextPhase", min_length=2, max_length=80)
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    transition_milestones: list[dict[str, Any]] = Field(default_factory=list, alias="transitionMilestones")
    dependency_readiness: list[dict[str, Any]] = Field(default_factory=list, alias="dependencyReadiness")
    owner_handoffs: list[dict[str, Any]] = Field(default_factory=list, alias="ownerHandoffs")
    rollout_guardrails: list[dict[str, Any]] = Field(default_factory=list, alias="rolloutGuardrails")
    entry_criteria: list[dict[str, Any]] = Field(default_factory=list, alias="entryCriteria")
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    min_milestone_count: int = Field(default=2, alias="minMilestoneCount", ge=0, le=1000)
    min_owner_handoff_count: int = Field(default=2, alias="minOwnerHandoffCount", ge=0, le=100)
    min_approval_count: int = Field(default=2, alias="minApprovalCount", ge=0, le=100)
    require_guardrails: bool = Field(default=True, alias="requireGuardrails")
    require_entry_criteria: bool = Field(default=True, alias="requireEntryCriteria")
    require_evidence: bool = Field(default=True, alias="requireEvidence")
    class Config:
        populate_by_name = True

class PhaseTwoFeedbackAdoptionReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    phase: str = Field(default="phase-2", min_length=2, max_length=80)
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    feedback_items: list[dict[str, Any]] = Field(default_factory=list, alias="feedbackItems")
    adoption_decisions: list[dict[str, Any]] = Field(default_factory=list, alias="adoptionDecisions")
    owner_responses: list[dict[str, Any]] = Field(default_factory=list, alias="ownerResponses")
    communications: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    max_open_critical_feedback: int = Field(default=0, alias="maxOpenCriticalFeedback", ge=0, le=1000)
    min_owner_response_count: int = Field(default=2, alias="minOwnerResponseCount", ge=0, le=100)
    require_adoption_decisions: bool = Field(default=True, alias="requireAdoptionDecisions")
    require_communications: bool = Field(default=True, alias="requireCommunications")
    class Config:
        populate_by_name = True

class PhaseTwoExpansionControlReviewPayload(BaseModel):
    release_id: str = Field(default="option-b-release", alias="releaseId")
    phase: str = Field(default="phase-2", min_length=2, max_length=80)
    domain: str = Field(default="platform", min_length=2, max_length=120)
    route: str = "/api/hybrid-python/jobs"
    job_types: list[str] = Field(default_factory=list, alias="jobTypes")
    waves: list[dict[str, Any]] = Field(default_factory=list)
    traffic_limits: dict[str, Any] = Field(default_factory=dict, alias="trafficLimits")
    rollback_triggers: list[dict[str, Any]] = Field(default_factory=list, alias="rollbackTriggers")
    checkpoints: list[dict[str, Any]] = Field(default_factory=list)
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    max_target_percent: float = Field(default=25, alias="maxTargetPercent", ge=0, le=100)
    min_checkpoint_passes: int = Field(default=2, alias="minCheckpointPasses", ge=0, le=100)
    min_approval_count: int = Field(default=2, alias="minApprovalCount", ge=0, le=50)
    require_rollback_triggers: bool = Field(default=True, alias="requireRollbackTriggers")
    require_traffic_limits: bool = Field(default=True, alias="requireTrafficLimits")
    class Config:
        populate_by_name = True

def process_platform_configuration_secret_rotation_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(ConfigurationSecretRotationReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    secret_summary: list[dict[str, Any]] = []
    config_summary: list[dict[str, Any]] = []
    rotation_summary: list[dict[str, Any]] = []
    for required in payload.required_secrets:
        matches = [item for item in payload.secrets if isinstance(item, dict) and _token_matches(item, required)]
        if not matches:
            blockers.append(f"required secret metadata {required} is missing")
            continue
        item = matches[0]
        name = _metadata_name(item, required)
        decision = _dict_decision(item)
        age_days = _metric_number(item, keys=("ageDays", "secretAgeDays", "daysSinceRotation"))
        external_store = _as_bool(item.get("externalStore", item.get("managedByExternalStore", item.get("inSecretManager"))))
        rotation_due = _as_bool(item.get("rotationDue", item.get("expired")))
        break_glass_ready = _as_bool(item.get("breakGlassReady", item.get("breakGlassTested")))
        if decision == "rollback": blockers.append(f"secret {name} is failing rotation review")
        elif decision == "hold": warnings.append(f"secret {name} requires rotation review")
        if age_days is not None and age_days > payload.max_secret_age_days: blockers.append(f"secret {name} age {age_days:g}d exceeds {payload.max_secret_age_days}d")
        if payload.require_external_secret_store and external_store is not True: blockers.append(f"secret {name} is not marked as externally managed")
        if rotation_due is True: blockers.append(f"secret {name} is marked rotation-due/expired")
        if payload.require_break_glass and break_glass_ready is not True: warnings.append(f"secret {name} missing break-glass readiness evidence")
        secret_summary.append({"name": name, "decision": decision or ("pass" if external_store is True and rotation_due is not True else "unknown"), "ageDays": age_days, "externalStore": external_store, "rotationDue": rotation_due, "breakGlassReady": break_glass_ready})
    for idx,item in enumerate(payload.config_items):
        if not isinstance(item, dict): continue
        name = _metadata_name(item, f"config-{idx}")
        decision = _dict_decision(item)
        drift = _as_bool(item.get("drift", item.get("driftDetected", item.get("outOfSync"))))
        redacted = _as_bool(item.get("redacted", item.get("valuesRedacted")))
        if decision == "rollback" or drift is True: warnings.append(f"configuration {name} has drift or failing evidence")
        elif decision == "hold": warnings.append(f"configuration {name} requires review")
        if redacted is False: blockers.append(f"configuration {name} is not marked redacted/minimized")
        config_summary.append({"name": name, "decision": decision or ("hold" if drift else "pass"), "drift": drift, "redacted": redacted})
    drift_count = sum(1 for item in config_summary if item.get("drift") is True or item.get("decision") in {"hold","rollback"})
    if drift_count > payload.max_config_drift_count: blockers.append(f"configuration drift count {drift_count} exceeds allowed {payload.max_config_drift_count}")
    recent_rotation_count = 0
    for idx,item in enumerate(payload.rotations):
        if not isinstance(item, dict): continue
        name = _metadata_name(item, f"rotation-{idx}")
        decision = _dict_decision(item)
        age_days = _days_from_metadata(item, ("completedAt", "rotatedAt", "reviewedAt"))
        scheduled = _as_bool(item.get("scheduled", item.get("windowScheduled")))
        passed = decision == "pass" or _as_bool(item.get("passed", item.get("completed"))) is True
        if decision == "rollback": blockers.append(f"rotation {name} is failing")
        elif decision == "hold": warnings.append(f"rotation {name} requires review")
        if passed and (age_days is None or age_days <= payload.max_secret_age_days): recent_rotation_count += 1
        if payload.require_rotation_window and scheduled is not True: warnings.append(f"rotation {name} missing scheduled window metadata")
        rotation_summary.append({"name": name, "decision": decision or ("pass" if passed else "unknown"), "ageDays": age_days, "scheduled": scheduled})
    if payload.require_rotation_window and not payload.rotations: blockers.append("at least one sanitized rotation-window record is required")
    if not payload.secrets and not payload.config_items: blockers.append("no configuration/secret metadata supplied")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    for name,status in evidence_statuses.items():
        if status == "rollback": blockers.append(f"evidence {name} is failing")
        elif status == "hold": warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    next_actions = ["Attach configuration/secret rotation evidence to the sustained-operations bundle.", "Keep secret rotation execution, value access and environment mutation owned by Node/control-plane and secret manager."] if decision == "pass" else ["Hold sustained operations until secret age, drift and rotation-window warnings are resolved.", "Re-run with sanitized external-store, redaction, break-glass and rotation metadata."] if decision == "hold" else ["Do not expand sustained traffic while configuration/secret blockers remain.", "Resolve missing/expired secrets, config drift and redaction blockers before retrying."]
    report = {"releaseId": payload.release_id, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "secretSummary": secret_summary, "configSummary": config_summary, "rotationSummary": rotation_summary, "driftCount": drift_count, "recentRotationCount": recent_rotation_count, "evidenceStatuses": evidence_statuses, "blockers": blockers, "warnings": warnings, "nextActions": next_actions, "mutatesSecretsOrConfiguration": False, "pythonSecretRotationReviewIsAdvisory": True, "nodeAndSecretManagerOwnMutation": True}
    artifact = artifact_store.write_json(prefix="platform-configuration-secret-rotation-review", artifact_type="platform.configuration_secret_rotation_review.report", payload=report, metadata={"rowCount": len(secret_summary)+len(config_summary)+len(rotation_summary), "redactionApplied": True, "piiClass": "configuration-secret-rotation-metadata-only", "source": "python-configuration-secret-rotation-review"})
    return _result(job, "platform.configuration_secret_rotation_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["configuration/secret rotation review is advisory; Python did not read, rotate or expose secret values"], [artifact])


def process_platform_maintenance_window_readiness_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(MaintenanceWindowReadinessReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    window_summary: list[dict[str, Any]] = []
    task_summary: list[dict[str, Any]] = []
    freeze_summary: list[dict[str, Any]] = []
    passing_windows = 0
    for idx,window in enumerate(payload.maintenance_windows):
        if not isinstance(window, dict): continue
        name = _metadata_name(window, f"maintenance-window-{idx}")
        decision = _dict_decision(window)
        age_days = _days_from_metadata(window, ("approvedAt", "reviewedAt", "createdAt"))
        low_traffic = _as_bool(window.get("lowTraffic", window.get("lowTrafficWindow")))
        conflict = _as_bool(window.get("conflict", window.get("freezeConflict")))
        if decision == "rollback" or conflict is True: blockers.append(f"maintenance window {name} has failing or freeze-conflict evidence")
        elif decision == "hold" or decision is None: warnings.append(f"maintenance window {name} requires approval/status review")
        if age_days is not None and age_days > payload.max_window_age_days: warnings.append(f"maintenance window {name} age {age_days}d exceeds {payload.max_window_age_days}d")
        if payload.require_low_traffic_window and low_traffic is not True: blockers.append(f"maintenance window {name} is not marked as low-traffic")
        if decision == "pass" and conflict is not True: passing_windows += 1
        window_summary.append({"name": name, "decision": decision or "unknown", "ageDays": age_days, "lowTraffic": low_traffic, "freezeConflict": conflict})
    if not payload.maintenance_windows or passing_windows == 0: blockers.append("at least one passing maintenance window is required")
    for required in payload.required_tasks:
        matches = [item for item in payload.tasks if isinstance(item, dict) and _token_matches(item, required)]
        if not matches:
            blockers.append(f"required maintenance task {required} is missing")
            continue
        item = matches[0]
        name = _metadata_name(item, required)
        decision = _dict_decision(item)
        passed = decision == "pass" or _as_bool(item.get("passed", item.get("completed"))) is True
        owner_ack = _as_bool(item.get("ownerAck", item.get("ownerAcknowledged")))
        if decision == "rollback" or passed is not True: blockers.append(f"maintenance task {name} is not passing")
        elif decision == "hold": warnings.append(f"maintenance task {name} requires review")
        if owner_ack is False: warnings.append(f"maintenance task {name} missing owner acknowledgement")
        task_summary.append({"name": name, "decision": decision or ("pass" if passed else "unknown"), "passed": passed, "ownerAck": owner_ack})
    if payload.require_rollback_task and not any("rollback" in _normalized_token(item.get("name", item.get("type", ""))) and (_dict_decision(item) == "pass" or _as_bool(item.get("passed", item.get("completed"))) is True) for item in payload.tasks if isinstance(item, dict)):
        blockers.append("passing rollback/backout task is required")
    for idx,freeze in enumerate(payload.freeze_periods):
        if not isinstance(freeze, dict): continue
        name = _metadata_name(freeze, f"freeze-{idx}")
        active = _as_bool(freeze.get("active", freeze.get("applies")))
        exception_approved = _as_bool(freeze.get("exceptionApproved", freeze.get("overrideApproved")))
        if active is True and exception_approved is not True: blockers.append(f"active freeze period {name} has no approved exception")
        freeze_summary.append({"name": name, "active": active, "exceptionApproved": exception_approved})
    approvals = _approved_items(payload.approvals)
    comms_decision = _dict_decision(payload.comms)
    if payload.require_approval and not approvals: blockers.append("maintenance owner approval is required")
    if payload.require_comms and comms_decision != "pass": blockers.append("maintenance communications plan must be present and passing")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    for name,status in evidence_statuses.items():
        if status == "rollback": blockers.append(f"evidence {name} is failing")
        elif status == "hold": warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    next_actions = ["Attach maintenance-window readiness evidence to the sustained-operations bundle.", "Keep scheduling, paging, traffic and maintenance execution operator-owned outside Python."] if decision == "pass" else ["Hold maintenance execution until window, task, comms or owner warnings are resolved.", "Re-run with passing low-traffic window, approvals, comms, backup and rollback task metadata."] if decision == "hold" else ["Do not enter the maintenance window while readiness blockers remain.", "Resolve missing window, freeze, task, approval and comms blockers before retrying."]
    report = {"releaseId": payload.release_id, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "windowSummary": window_summary, "taskSummary": task_summary, "freezeSummary": freeze_summary, "approvalCount": len(approvals), "commsDecision": comms_decision or "missing", "evidenceStatuses": evidence_statuses, "blockers": blockers, "warnings": warnings, "nextActions": next_actions, "mutatesSchedulesOrTraffic": False, "pythonMaintenanceWindowReviewIsAdvisory": True, "operatorsOwnMaintenanceExecution": True}
    artifact = artifact_store.write_json(prefix="platform-maintenance-window-readiness-review", artifact_type="platform.maintenance_window_readiness_review.report", payload=report, metadata={"rowCount": len(window_summary)+len(task_summary)+len(freeze_summary), "redactionApplied": True, "piiClass": "maintenance-window-readiness-metadata-only", "source": "python-maintenance-window-readiness-review"})
    return _result(job, "platform.maintenance_window_readiness_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["maintenance-window readiness review is advisory; Python did not schedule windows, page operators or change traffic"], [artifact])


def process_platform_audit_forensics_readiness_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(AuditForensicsReadinessReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    audit_summary: list[dict[str, Any]] = []
    artifact_summary: list[dict[str, Any]] = []
    drill_summary: list[dict[str, Any]] = []
    for required in payload.required_sources:
        matches = [item for item in payload.audit_trails if isinstance(item, dict) and _token_matches(item, required)]
        if not matches:
            blockers.append(f"required audit source {required} is missing")
            continue
        item = matches[0]
        name = _metadata_name(item, required)
        decision = _dict_decision(item)
        raw_gap = item.get("gapMinutes", item.get("maxGapMinutes"))
        try:
            gap_minutes = int(raw_gap) if raw_gap is not None else None
        except (TypeError, ValueError):
            gap_minutes = None
        immutable = _as_bool(item.get("immutable", item.get("appendOnly")))
        complete = _as_bool(item.get("complete", item.get("coverageComplete")))
        if decision == "rollback" or complete is False:
            blockers.append(f"audit source {name} is failing or incomplete")
        elif decision == "hold" or decision is None:
            warnings.append(f"audit source {name} requires review")
        if gap_minutes is None:
            warnings.append(f"audit source {name} missing gap metadata")
        elif gap_minutes > payload.max_audit_gap_minutes:
            blockers.append(f"audit source {name} gap {gap_minutes}m exceeds {payload.max_audit_gap_minutes}m")
        if payload.require_immutable_storage and immutable is not True:
            blockers.append(f"audit source {name} is not marked immutable/append-only")
        audit_summary.append({"name": name, "decision": decision or "unknown", "gapMinutes": gap_minutes, "immutable": immutable, "complete": complete})
    if not payload.audit_trails:
        blockers.append("no audit trail metadata supplied")
    for idx, item in enumerate(payload.forensic_artifacts):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"forensic-artifact-{idx}")
        decision = _dict_decision(item)
        age_days = _days_from_metadata(item, ("createdAt", "capturedAt", "reviewedAt"))
        if age_days is None and item.get("ageDays") is not None:
            try:
                age_days = int(item.get("ageDays"))
            except (TypeError, ValueError):
                age_days = None
        redacted = _as_bool(item.get("redactionApplied", item.get("redacted")))
        immutable = _as_bool(item.get("immutable", item.get("writeOnce")))
        verified = _as_bool(item.get("verified", item.get("checksumVerified")))
        if decision == "rollback" or verified is False:
            blockers.append(f"forensic artifact {name} is failing or unverified")
        elif decision == "hold":
            warnings.append(f"forensic artifact {name} requires review")
        if redacted is not True:
            blockers.append(f"forensic artifact {name} must be redacted")
        if payload.require_immutable_storage and immutable is not True:
            blockers.append(f"forensic artifact {name} is not immutable/write-once")
        if age_days is not None and age_days > payload.max_artifact_age_days:
            warnings.append(f"forensic artifact {name} age {age_days}d exceeds {payload.max_artifact_age_days}d")
        artifact_summary.append({"name": name, "decision": decision or "unknown", "ageDays": age_days, "redactionApplied": redacted, "immutable": immutable, "verified": verified})
    if not payload.forensic_artifacts:
        warnings.append("no forensic artifact metadata supplied")
    passing_drills = 0
    for idx, item in enumerate(payload.investigation_drills):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"investigation-drill-{idx}")
        decision = _dict_decision(item)
        passed = decision == "pass" or _as_bool(item.get("passed", item.get("completed"))) is True
        age_days = _days_from_metadata(item, ("completedAt", "reviewedAt", "createdAt"))
        if age_days is None and item.get("ageDays") is not None:
            try:
                age_days = int(item.get("ageDays"))
            except (TypeError, ValueError):
                age_days = None
        if decision == "rollback" or passed is not True:
            blockers.append(f"investigation drill {name} is not passing")
        elif decision == "hold":
            warnings.append(f"investigation drill {name} requires review")
        if age_days is not None and age_days > payload.max_artifact_age_days:
            warnings.append(f"investigation drill {name} age {age_days}d exceeds {payload.max_artifact_age_days}d")
        if passed:
            passing_drills += 1
        drill_summary.append({"name": name, "decision": decision or ("pass" if passed else "unknown"), "passed": passed, "ageDays": age_days})
    if payload.require_investigation_drill and passing_drills == 0:
        blockers.append("at least one passing investigation/forensics drill is required")
    chain_decision = _dict_decision(payload.chain_of_custody)
    chain_verified = _as_bool(payload.chain_of_custody.get("verified", payload.chain_of_custody.get("complete"))) if isinstance(payload.chain_of_custody, dict) else None
    if payload.require_chain_of_custody and chain_decision != "pass" and chain_verified is not True:
        blockers.append("chain-of-custody evidence must be present and passing")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    next_actions = ["Attach audit/forensics readiness evidence to the sustained-operations bundle.", "Keep log retention, forensic export and incident investigation execution outside Python."] if decision == "pass" else ["Hold sustained operations until audit gaps, artifact redaction or drill warnings are resolved.", "Re-run with immutable audit source, chain-of-custody and forensic drill metadata."] if decision == "hold" else ["Do not expand sustained traffic while audit/forensics blockers remain.", "Resolve missing sources, non-redacted artifacts and chain-of-custody blockers before retrying."]
    report = {"releaseId": payload.release_id, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "auditSummary": audit_summary, "artifactSummary": artifact_summary, "drillSummary": drill_summary, "chainOfCustodyDecision": chain_decision or ("pass" if chain_verified else "missing"), "evidenceStatuses": evidence_statuses, "blockers": blockers, "warnings": warnings, "nextActions": next_actions, "mutatesAuditOrForensicSystems": False, "pythonAuditForensicsReviewIsAdvisory": True, "nodeAndSecurityOwnInvestigation": True}
    artifact = artifact_store.write_json(prefix="platform-audit-forensics-readiness-review", artifact_type="platform.audit_forensics_readiness_review.report", payload=report, metadata={"rowCount": len(audit_summary)+len(artifact_summary)+len(drill_summary), "redactionApplied": True, "piiClass": "audit-forensics-readiness-metadata-only", "source": "python-audit-forensics-readiness-review"})
    return _result(job, "platform.audit_forensics_readiness_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["audit/forensics readiness review is advisory; Python did not query logs, export evidence or mutate investigations"], [artifact])


def process_platform_business_continuity_readiness_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(BusinessContinuityReadinessReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    plan_summary: list[dict[str, Any]] = []
    team_summary: list[dict[str, Any]] = []
    fallback_summary: list[dict[str, Any]] = []
    exercise_summary: list[dict[str, Any]] = []
    for required in payload.required_plans:
        matches = [item for item in payload.continuity_plans if isinstance(item, dict) and _token_matches(item, required)]
        if not matches:
            blockers.append(f"required continuity plan {required} is missing")
            continue
        item = matches[0]
        name = _metadata_name(item, required)
        decision = _dict_decision(item)
        approved = decision == "pass" or _as_bool(item.get("approved", item.get("ready"))) is True
        owner_ack = _as_bool(item.get("ownerAck", item.get("ownerAcknowledged")))
        reviewed_age = _days_from_metadata(item, ("lastReviewedAt", "approvedAt", "reviewedAt"))
        if decision == "rollback" or approved is not True:
            blockers.append(f"continuity plan {name} is not approved/ready")
        elif decision == "hold":
            warnings.append(f"continuity plan {name} requires review")
        if payload.require_owner_ack and owner_ack is not True:
            blockers.append(f"continuity plan {name} missing owner acknowledgement")
        plan_summary.append({"name": name, "decision": decision or ("pass" if approved else "unknown"), "ownerAck": owner_ack, "reviewedAgeDays": reviewed_age})
    if not payload.continuity_plans:
        blockers.append("no continuity plan metadata supplied")
    for idx, item in enumerate(payload.teams):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"team-{idx}")
        decision = _dict_decision(item)
        coverage = _as_bool(item.get("coverageReady", item.get("coverage")))
        primary = _as_bool(item.get("primaryOnCall", item.get("primaryReady")))
        backup = _as_bool(item.get("backupOnCall", item.get("backupReady")))
        if decision == "rollback" or coverage is False:
            blockers.append(f"continuity team {name} is failing coverage")
        elif decision == "hold" or coverage is None:
            warnings.append(f"continuity team {name} coverage requires review")
        if primary is False or backup is False:
            warnings.append(f"continuity team {name} missing primary or backup coverage metadata")
        team_summary.append({"name": name, "decision": decision or "unknown", "coverageReady": coverage, "primaryReady": primary, "backupReady": backup})
    comms_decision = _dict_decision(payload.communications)
    if payload.require_comms and comms_decision != "pass":
        blockers.append("business continuity communications plan must be present and passing")
    passing_fallbacks = 0
    for idx, item in enumerate(payload.fallback_procedures):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"fallback-{idx}")
        decision = _dict_decision(item)
        tested = decision == "pass" or _as_bool(item.get("tested", item.get("ready"))) is True
        if decision == "rollback" or tested is not True:
            blockers.append(f"fallback procedure {name} is not tested/ready")
        elif decision == "hold":
            warnings.append(f"fallback procedure {name} requires review")
        if tested:
            passing_fallbacks += 1
        fallback_summary.append({"name": name, "decision": decision or ("pass" if tested else "unknown"), "tested": tested})
    if payload.require_fallback and passing_fallbacks == 0:
        blockers.append("at least one tested fallback/manual procedure is required")
    passing_exercises = 0
    for idx, item in enumerate(payload.exercises):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"continuity-exercise-{idx}")
        decision = _dict_decision(item)
        passed = decision == "pass" or _as_bool(item.get("passed", item.get("completed"))) is True
        age_days = _days_from_metadata(item, ("completedAt", "reviewedAt", "createdAt"))
        if age_days is None and item.get("ageDays") is not None:
            try:
                age_days = int(item.get("ageDays"))
            except (TypeError, ValueError):
                age_days = None
        if decision == "rollback" or passed is not True:
            blockers.append(f"business continuity exercise {name} is not passing")
        elif decision == "hold":
            warnings.append(f"business continuity exercise {name} requires review")
        if age_days is not None and age_days > payload.max_exercise_age_days:
            warnings.append(f"business continuity exercise {name} age {age_days}d exceeds {payload.max_exercise_age_days}d")
        if passed:
            passing_exercises += 1
        exercise_summary.append({"name": name, "decision": decision or ("pass" if passed else "unknown"), "passed": passed, "ageDays": age_days})
    if payload.require_exercise and passing_exercises == 0:
        blockers.append("at least one passing business continuity exercise is required")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    next_actions = ["Attach business-continuity readiness evidence to the sustained-operations bundle.", "Keep customer comms, manual fallback execution and continuity ownership outside Python."] if decision == "pass" else ["Hold sustained operations until continuity plan, team coverage or exercise warnings are resolved.", "Re-run with owner acknowledgements, tested fallback and passing continuity exercise metadata."] if decision == "hold" else ["Do not expand sustained traffic while business-continuity blockers remain.", "Resolve missing plans, comms, fallback and exercise blockers before retrying."]
    report = {"releaseId": payload.release_id, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "planSummary": plan_summary, "teamSummary": team_summary, "fallbackSummary": fallback_summary, "exerciseSummary": exercise_summary, "commsDecision": comms_decision or "missing", "evidenceStatuses": evidence_statuses, "blockers": blockers, "warnings": warnings, "nextActions": next_actions, "mutatesContinuityOrCustomerComms": False, "pythonBusinessContinuityReviewIsAdvisory": True, "operatorsOwnContinuityExecution": True}
    artifact = artifact_store.write_json(prefix="platform-business-continuity-readiness-review", artifact_type="platform.business_continuity_readiness_review.report", payload=report, metadata={"rowCount": len(plan_summary)+len(team_summary)+len(fallback_summary)+len(exercise_summary), "redactionApplied": True, "piiClass": "business-continuity-readiness-metadata-only", "source": "python-business-continuity-readiness-review"})
    return _result(job, "platform.business_continuity_readiness_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["business-continuity readiness review is advisory; Python did not send communications, mutate rosters or execute fallback procedures"], [artifact])


def process_platform_post_incident_learning_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(PostIncidentLearningReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    incident_summary: list[dict[str, Any]] = []
    action_summary: list[dict[str, Any]] = []
    regression_summary: list[dict[str, Any]] = []

    for required in payload.required_incident_classes:
        matches = [item for item in payload.incidents if isinstance(item, dict) and _token_matches(item, required)]
        if not matches:
            warnings.append(f"incident class {required} has no explicit sanitized sample")
            continue
        for item in matches[:1]:
            name = _metadata_name(item, required)
            decision = _dict_decision(item)
            postmortem_linked = _as_bool(item.get("postmortemLinked", item.get("postmortemComplete")))
            owner_ack = _as_bool(item.get("ownerAck", item.get("ownerAcknowledged")))
            if decision == "rollback":
                blockers.append(f"incident {name} has failing learning evidence")
            elif decision == "hold":
                warnings.append(f"incident {name} requires learning review")
            if payload.require_postmortem and postmortem_linked is not True:
                warnings.append(f"incident {name} missing linked/complete postmortem metadata")
            if payload.require_owner_ack and owner_ack is not True:
                warnings.append(f"incident {name} missing owner acknowledgement")
            incident_summary.append({"name": name, "decision": decision or "unknown", "postmortemLinked": postmortem_linked, "ownerAck": owner_ack})

    completed_postmortems = 0
    for idx, item in enumerate(payload.postmortems):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"postmortem-{idx}")
        decision = _dict_decision(item)
        complete = decision == "pass" or _as_bool(item.get("completed", item.get("approved"))) is True
        owner_ack = _as_bool(item.get("ownerAck", item.get("ownerAcknowledged")))
        if decision == "rollback":
            blockers.append(f"postmortem {name} is failing")
        elif decision == "hold" or not complete:
            warnings.append(f"postmortem {name} requires completion/approval review")
        if payload.require_owner_ack and owner_ack is False:
            warnings.append(f"postmortem {name} missing owner acknowledgement")
        if complete:
            completed_postmortems += 1

    for idx, item in enumerate(payload.action_items):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"action-{idx}")
        decision = _dict_decision(item)
        status = str(item.get("status") or "").strip().lower()
        owner_ack = _as_bool(item.get("ownerAck", item.get("ownerAcknowledged")))
        age_days = _days_from_metadata(item, ("createdAt", "openedAt", "dueAt", "updatedAt"))
        open_item = status in {"open", "todo", "in_progress", "pending"} or _as_bool(item.get("closed", item.get("completed"))) is False
        if decision == "rollback":
            blockers.append(f"action item {name} is failing")
        elif decision == "hold":
            warnings.append(f"action item {name} requires review")
        if open_item and age_days is not None and age_days > payload.max_open_action_item_age_days:
            blockers.append(f"open action item {name} age {age_days}d exceeds {payload.max_open_action_item_age_days}d")
        if payload.require_owner_ack and owner_ack is False:
            warnings.append(f"action item {name} missing owner acknowledgement")
        action_summary.append({"name": name, "decision": decision or ("hold" if open_item else "pass"), "status": status or "unknown", "ageDays": age_days, "ownerAck": owner_ack})

    for idx, item in enumerate(payload.regressions):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"regression-{idx}")
        decision = _dict_decision(item)
        passed = decision == "pass" or _as_bool(item.get("passed", item.get("testPassed"))) is True
        if decision == "rollback" or passed is False:
            blockers.append(f"regression guard {name} is failing")
        elif decision == "hold" or passed is None:
            warnings.append(f"regression guard {name} requires outcome review")
        regression_summary.append({"name": name, "decision": decision or ("pass" if passed else "unknown"), "passed": passed})

    if payload.require_postmortem and not payload.postmortems:
        blockers.append("at least one sanitized postmortem record is required")
    if payload.require_regression_test and not payload.regressions:
        blockers.append("at least one regression guard record is required")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")

    decision = "rollback" if blockers else "hold" if warnings else "pass"
    next_actions = ["Attach post-incident learning evidence to the sustained-operations bundle.", "Keep ticket remediation, postmortem approval and incident-system mutation operator-owned outside Python."] if decision == "pass" else ["Hold sustained expansion until postmortem, action item or regression-test warnings are resolved.", "Re-run with sanitized incident classes, owner acknowledgement and regression guard evidence."] if decision == "hold" else ["Do not expand sustained traffic while post-incident learning blockers remain.", "Resolve overdue action items, missing postmortems or failing regression guards before retrying."]
    report = {"releaseId": payload.release_id, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "incidentSummary": incident_summary, "completedPostmortemCount": completed_postmortems, "actionSummary": action_summary, "regressionSummary": regression_summary, "evidenceStatuses": evidence_statuses, "blockers": blockers, "warnings": warnings, "nextActions": next_actions, "mutatesIncidentsOrTickets": False, "pythonPostIncidentLearningReviewIsAdvisory": True, "operatorsOwnRemediation": True}
    artifact = artifact_store.write_json(prefix="platform-post-incident-learning-review", artifact_type="platform.post_incident_learning_review.report", payload=report, metadata={"rowCount": len(incident_summary)+len(action_summary)+len(regression_summary), "redactionApplied": True, "piiClass": "post-incident-learning-metadata-only", "source": "python-post-incident-learning-review"})
    return _result(job, "platform.post_incident_learning_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["post-incident learning review is advisory; Python did not mutate incident records, tickets or postmortems"], [artifact])


def process_platform_tech_debt_governance_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(TechDebtGovernanceReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    debt_summary: list[dict[str, Any]] = []
    waiver_summary: list[dict[str, Any]] = []
    category_seen: set[str] = set()
    critical_count = 0

    for idx, item in enumerate(payload.debt_items):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"debt-{idx}")
        category = str(item.get("category") or item.get("type") or "uncategorized")
        category_seen.add(_normalized_token(category))
        decision = _dict_decision(item)
        severity = str(item.get("severity") or item.get("risk") or "medium").strip().lower()
        owner_ack = _as_bool(item.get("ownerAck", item.get("ownerAcknowledged")))
        remediation = _as_bool(item.get("remediationPlanned", item.get("tracked")))
        if severity in {"critical", "sev1", "blocker"}:
            critical_count += 1
            if decision != "pass":
                blockers.append(f"critical debt item {name} is not explicitly accepted")
        if decision == "rollback":
            blockers.append(f"debt item {name} is failing governance review")
        elif decision == "hold":
            warnings.append(f"debt item {name} requires governance review")
        if payload.require_owner_ack and owner_ack is not True:
            warnings.append(f"debt item {name} missing owner acknowledgement")
        if remediation is False:
            warnings.append(f"debt item {name} missing remediation tracking")
        debt_summary.append({"name": name, "category": category, "severity": severity, "decision": decision or "unknown", "ownerAck": owner_ack, "remediationPlanned": remediation})

    for required in payload.required_categories:
        if _normalized_token(required) not in category_seen:
            warnings.append(f"required technical-debt category {required} has no explicit metadata")
    if critical_count > payload.max_critical_debt_items:
        blockers.append(f"critical debt item count {critical_count} exceeds allowed {payload.max_critical_debt_items}")

    for idx, item in enumerate(payload.waivers):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"waiver-{idx}")
        decision = _dict_decision(item)
        age_days = _days_from_metadata(item, ("approvedAt", "createdAt", "updatedAt"))
        approved = decision == "pass" or _as_bool(item.get("approved")) is True
        expires = item.get("expiresAt") or item.get("expiry")
        if not approved:
            warnings.append(f"waiver {name} is not approved")
        if age_days is not None and age_days > payload.max_waiver_age_days:
            blockers.append(f"waiver {name} age {age_days}d exceeds {payload.max_waiver_age_days}d")
        if not expires:
            warnings.append(f"waiver {name} missing expiration metadata")
        waiver_summary.append({"name": name, "decision": decision or ("pass" if approved else "unknown"), "ageDays": age_days, "expiresAt": expires})

    owner_ack_count = len(_approved_items(payload.ownership))
    plan_decision = _dict_decision(payload.remediation_plan)
    if payload.require_owner_ack and owner_ack_count == 0 and payload.debt_items:
        warnings.append("technical-debt ownership acknowledgement is required")
    if payload.require_remediation_plan and plan_decision != "pass":
        blockers.append("passing technical-debt remediation plan is required")
    if not payload.debt_items and not payload.waivers:
        warnings.append("no technical-debt or waiver metadata supplied")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")

    decision = "rollback" if blockers else "hold" if warnings else "pass"
    next_actions = ["Attach technical-debt governance evidence to the sustained-operations bundle.", "Keep backlog mutation, waiver approval and remediation execution owned by engineering leads and Node/control-plane."] if decision == "pass" else ["Hold sustained expansion until debt ownership, waivers or category warnings are resolved.", "Re-run with sanitized debt register, approved waivers and a passing remediation plan."] if decision == "hold" else ["Do not expand sustained traffic while technical-debt governance blockers remain.", "Resolve critical debt, expired waivers or missing remediation plan before retrying."]
    report = {"releaseId": payload.release_id, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "debtSummary": debt_summary, "waiverSummary": waiver_summary, "criticalDebtItemCount": critical_count, "ownerAckCount": owner_ack_count, "remediationPlanDecision": plan_decision or "missing", "evidenceStatuses": evidence_statuses, "blockers": blockers, "warnings": warnings, "nextActions": next_actions, "mutatesBacklogOrWaivers": False, "pythonTechDebtGovernanceReviewIsAdvisory": True, "engineeringLeadsOwnRemediation": True}
    artifact = artifact_store.write_json(prefix="platform-tech-debt-governance-review", artifact_type="platform.tech_debt_governance_review.report", payload=report, metadata={"rowCount": len(debt_summary)+len(waiver_summary), "redactionApplied": True, "piiClass": "tech-debt-governance-metadata-only", "source": "python-tech-debt-governance-review"})
    return _result(job, "platform.tech_debt_governance_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["technical-debt governance review is advisory; Python did not mutate backlog items, waivers or remediation plans"], [artifact])


def process_platform_vendor_resilience_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(VendorResilienceReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    vendor_summary: list[dict[str, Any]] = []
    service_summary: list[dict[str, Any]] = []
    incident_summary: list[dict[str, Any]] = []
    exit_plan_summary: list[dict[str, Any]] = []

    for required in payload.required_vendors:
        matches = [item for item in payload.vendors if isinstance(item, dict) and _token_matches(item, required)]
        if not matches:
            blockers.append(f"required vendor metadata {required} is missing")
            continue
        item = matches[0]
        name = _metadata_name(item, required)
        decision = _dict_decision(item)
        status_age = _metric_number(item, keys=("statusAgeMinutes", "ageMinutes", "minutesSinceStatus"))
        sla_ready = _as_bool(item.get("slaReady", item.get("slaEvidence", item.get("slaMet"))))
        status_green = _as_bool(item.get("statusGreen", item.get("healthy", item.get("available"))))
        owner_ack = _as_bool(item.get("ownerAck", item.get("ownerAcknowledged")))
        if decision == "rollback":
            blockers.append(f"vendor {name} is failing resilience review")
        elif decision == "hold":
            warnings.append(f"vendor {name} requires resilience review")
        if status_age is not None and status_age > payload.max_status_age_minutes:
            warnings.append(f"vendor {name} status age {status_age:g}m exceeds {payload.max_status_age_minutes}m")
        if status_green is False:
            blockers.append(f"vendor {name} is not reporting healthy/available status")
        if payload.require_sla_evidence and sla_ready is not True:
            warnings.append(f"vendor {name} missing SLA evidence")
        if payload.require_owner_ack and owner_ack is not True:
            warnings.append(f"vendor {name} missing owner acknowledgement")
        vendor_summary.append({"name": name, "decision": decision or ("pass" if status_green is True else "unknown"), "statusAgeMinutes": status_age, "slaReady": sla_ready, "statusGreen": status_green, "ownerAck": owner_ack})

    for idx, item in enumerate(payload.services):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"service-{idx}")
        decision = _dict_decision(item)
        degraded = _as_bool(item.get("degraded", item.get("partialOutage")))
        redundancy_ready = _as_bool(item.get("redundancyReady", item.get("fallbackReady")))
        if decision == "rollback" or degraded is True:
            blockers.append(f"dependent service {name} is degraded or failing")
        elif decision == "hold":
            warnings.append(f"dependent service {name} requires review")
        if redundancy_ready is False:
            warnings.append(f"dependent service {name} missing redundancy/fallback readiness")
        service_summary.append({"name": name, "decision": decision or ("hold" if degraded else "pass"), "degraded": degraded, "redundancyReady": redundancy_ready})

    for idx, item in enumerate(payload.incidents):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"vendor-incident-{idx}")
        decision = _dict_decision(item)
        age_days = _days_from_metadata(item, ("openedAt", "createdAt", "startedAt", "updatedAt"))
        resolved = decision == "pass" or _as_bool(item.get("resolved", item.get("closed"))) is True
        if decision == "rollback":
            blockers.append(f"vendor incident {name} is failing")
        elif not resolved and age_days is not None and age_days > payload.max_open_incident_age_days:
            blockers.append(f"open vendor incident {name} age {age_days}d exceeds {payload.max_open_incident_age_days}d")
        elif decision == "hold" or not resolved:
            warnings.append(f"vendor incident {name} requires review")
        incident_summary.append({"name": name, "decision": decision or ("pass" if resolved else "hold"), "ageDays": age_days, "resolved": resolved})

    for idx, item in enumerate(payload.exit_plans):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"exit-plan-{idx}")
        decision = _dict_decision(item)
        tested = decision == "pass" or _as_bool(item.get("tested", item.get("validated"))) is True
        owner_ack = _as_bool(item.get("ownerAck", item.get("ownerAcknowledged")))
        if decision == "rollback" or tested is False:
            blockers.append(f"vendor exit plan {name} is failing or untested")
        elif decision == "hold" or tested is None:
            warnings.append(f"vendor exit plan {name} requires review")
        if payload.require_owner_ack and owner_ack is not True:
            warnings.append(f"vendor exit plan {name} missing owner acknowledgement")
        exit_plan_summary.append({"name": name, "decision": decision or ("pass" if tested else "unknown"), "tested": tested, "ownerAck": owner_ack})

    if payload.require_exit_plan and not exit_plan_summary:
        blockers.append("at least one tested vendor exit/contingency plan is required")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")

    decision = "rollback" if blockers else "hold" if warnings else "pass"
    next_actions = ["Attach vendor resilience evidence to the sustained-operations bundle.", "Keep vendor escalation, procurement and provider configuration changes owned by Node/control-plane and operators."] if decision == "pass" else ["Hold sustained expansion until vendor status, SLA or exit-plan warnings are resolved.", "Re-run with sanitized vendor health, SLA, incident and contingency-plan evidence."] if decision == "hold" else ["Do not expand sustained traffic while vendor resilience blockers remain.", "Resolve vendor health, open incident or contingency-plan blockers before retrying."]
    report = {"releaseId": payload.release_id, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "vendorSummary": vendor_summary, "serviceSummary": service_summary, "incidentSummary": incident_summary, "exitPlanSummary": exit_plan_summary, "evidenceStatuses": evidence_statuses, "blockers": blockers, "warnings": warnings, "nextActions": next_actions, "mutatesVendorsOrProviderConfig": False, "pythonVendorResilienceReviewIsAdvisory": True, "operatorsOwnVendorRemediation": True}
    artifact = artifact_store.write_json(prefix="platform-vendor-resilience-review", artifact_type="platform.vendor_resilience_review.report", payload=report, metadata={"rowCount": len(vendor_summary)+len(service_summary)+len(incident_summary)+len(exit_plan_summary), "redactionApplied": True, "piiClass": "vendor-resilience-metadata-only", "source": "python-vendor-resilience-review"})
    return _result(job, "platform.vendor_resilience_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["vendor resilience review is advisory; Python did not mutate vendors, provider config, escalation tickets or procurement records"], [artifact])


def process_platform_knowledge_transfer_readiness_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(KnowledgeTransferReadinessReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    artifact_summary: list[dict[str, Any]] = []
    owner_summary: list[dict[str, Any]] = []
    training_summary: list[dict[str, Any]] = []
    checklist_summary: list[dict[str, Any]] = []

    for required in payload.required_topics:
        matches = [item for item in payload.knowledge_artifacts if isinstance(item, dict) and _token_matches(item, required)]
        if not matches:
            blockers.append(f"required knowledge topic {required} is missing")
            continue
        item = matches[0]
        name = _metadata_name(item, required)
        decision = _dict_decision(item)
        age_days = _days_from_metadata(item, ("reviewedAt", "updatedAt", "createdAt"))
        reviewed = decision == "pass" or _as_bool(item.get("reviewed", item.get("approved"))) is True
        redacted = _as_bool(item.get("redacted", item.get("secretsRedacted", item.get("sanitized"))))
        if decision == "rollback":
            blockers.append(f"knowledge artifact {name} is failing review")
        elif decision == "hold" or not reviewed:
            warnings.append(f"knowledge artifact {name} requires review/approval")
        if age_days is not None and age_days > payload.max_artifact_age_days:
            blockers.append(f"knowledge artifact {name} age {age_days}d exceeds {payload.max_artifact_age_days}d")
        if redacted is False:
            blockers.append(f"knowledge artifact {name} is not marked redacted/sanitized")
        artifact_summary.append({"name": name, "decision": decision or ("pass" if reviewed else "hold"), "ageDays": age_days, "reviewed": reviewed, "redacted": redacted})

    primary_count = 0
    secondary_count = 0
    for idx, item in enumerate(payload.owners):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"owner-{idx}")
        decision = _dict_decision(item)
        role = str(item.get("role") or item.get("ownerRole") or "primary").strip().lower()
        acknowledged = decision == "pass" or _as_bool(item.get("acknowledged", item.get("ownerAck", item.get("trained")))) is True
        if "secondary" in role or "backup" in role:
            secondary_count += 1
        else:
            primary_count += 1
        if decision == "rollback":
            blockers.append(f"knowledge-transfer owner {name} is failing")
        elif decision == "hold" or not acknowledged:
            warnings.append(f"knowledge-transfer owner {name} requires acknowledgement")
        owner_summary.append({"name": name, "role": role, "decision": decision or ("pass" if acknowledged else "hold"), "acknowledged": acknowledged})
    if primary_count == 0:
        blockers.append("at least one primary owner acknowledgement is required")
    if payload.require_secondary_owner and secondary_count == 0:
        blockers.append("secondary/backup owner acknowledgement is required")

    for idx, item in enumerate(payload.training_sessions):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"training-{idx}")
        decision = _dict_decision(item)
        completed = decision == "pass" or _as_bool(item.get("completed", item.get("passed"))) is True
        coverage = _metric_number(item, keys=("coveragePercent", "completionPercent", "attendancePercent"))
        if decision == "rollback" or completed is False:
            blockers.append(f"training session {name} is failing or incomplete")
        elif decision == "hold" or completed is None:
            warnings.append(f"training session {name} requires completion review")
        if coverage is not None and coverage < 80:
            warnings.append(f"training session {name} coverage {coverage:g}% is below 80%")
        training_summary.append({"name": name, "decision": decision or ("pass" if completed else "unknown"), "completed": completed, "coveragePercent": coverage})
    if payload.require_training and not training_summary:
        blockers.append("at least one training/session completion record is required")

    for idx, item in enumerate(payload.handoff_checklists):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"handoff-{idx}")
        decision = _dict_decision(item)
        completed = decision == "pass" or _as_bool(item.get("completed", item.get("passed"))) is True
        if decision == "rollback" or completed is False:
            blockers.append(f"handoff checklist {name} is failing or incomplete")
        elif decision == "hold" or completed is None:
            warnings.append(f"handoff checklist {name} requires review")
        checklist_summary.append({"name": name, "decision": decision or ("pass" if completed else "unknown"), "completed": completed})
    if payload.require_handoff_checklist and not checklist_summary:
        blockers.append("at least one handoff checklist is required")

    evidence_statuses = _evidence_status_map(payload.evidence or {})
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")

    decision = "rollback" if blockers else "hold" if warnings else "pass"
    next_actions = ["Attach knowledge-transfer evidence to the sustained-operations bundle.", "Keep documentation publication, ownership changes and training assignments operator-owned outside Python."] if decision == "pass" else ["Hold sustained expansion until knowledge artifacts, training or ownership warnings are resolved.", "Re-run with reviewed artifacts, primary/backup owners, training completion and handoff checklist evidence."] if decision == "hold" else ["Do not expand sustained traffic while knowledge-transfer blockers remain.", "Resolve missing topics, stale artifacts, missing owners or incomplete training before retrying."]
    report = {"releaseId": payload.release_id, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "artifactSummary": artifact_summary, "ownerSummary": owner_summary, "trainingSummary": training_summary, "checklistSummary": checklist_summary, "primaryOwnerCount": primary_count, "secondaryOwnerCount": secondary_count, "evidenceStatuses": evidence_statuses, "blockers": blockers, "warnings": warnings, "nextActions": next_actions, "mutatesDocsOrOwnership": False, "pythonKnowledgeTransferReviewIsAdvisory": True, "operatorsOwnHandoffExecution": True}
    artifact = artifact_store.write_json(prefix="platform-knowledge-transfer-readiness-review", artifact_type="platform.knowledge_transfer_readiness_review.report", payload=report, metadata={"rowCount": len(artifact_summary)+len(owner_summary)+len(training_summary)+len(checklist_summary), "redactionApplied": True, "piiClass": "knowledge-transfer-metadata-only", "source": "python-knowledge-transfer-readiness-review"})
    return _result(job, "platform.knowledge_transfer_readiness_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["knowledge-transfer readiness review is advisory; Python did not mutate documents, owners, calendars or training systems"], [artifact])


def process_platform_architecture_ownership_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(ArchitectureOwnershipReviewPayload, job.payload)
    blockers: list[str] = []; warnings: list[str] = []
    artifact_summary: list[dict[str, Any]] = []; boundary_summary: list[dict[str, Any]] = []; owner_summary: list[dict[str, Any]] = []; adr_summary: list[dict[str, Any]] = []
    for required in payload.required_domains:
        matches=[i for i in payload.architecture_artifacts if isinstance(i, dict) and _token_matches(i, required)]
        if not matches:
            blockers.append(f"required architecture artifact {required} is missing"); continue
        item=matches[0]; name=_metadata_name(item, required); decision=_dict_decision(item); age=_metric_number(item, keys=("ageDays","daysSinceReview","artifactAgeDays")); approved=decision=="pass" or _as_bool(item.get("approved", item.get("reviewed"))) is True; redacted=_as_bool(item.get("redacted", item.get("sanitized", item.get("secretsRedacted"))))
        if decision=="rollback": blockers.append(f"architecture artifact {name} is failing review")
        elif decision=="hold" or not approved: warnings.append(f"architecture artifact {name} requires approval")
        if age is not None and age > payload.max_artifact_age_days: blockers.append(f"architecture artifact {name} age {age:g}d exceeds {payload.max_artifact_age_days}d")
        if redacted is False: blockers.append(f"architecture artifact {name} is not marked redacted/sanitized")
        artifact_summary.append({"name":name,"decision":decision or ("pass" if approved else "hold"),"ageDays":age,"approved":approved,"redacted":redacted})
    for idx,item in enumerate(payload.service_boundaries):
        if not isinstance(item, dict): continue
        name=_metadata_name(item, f"boundary-{idx}"); decision=_dict_decision(item); documented=decision=="pass" or _as_bool(item.get("documented", item.get("boundaryDocumented"))) is True; drift=_as_bool(item.get("drift", item.get("ownershipDrift", item.get("outOfSync"))))
        if decision=="rollback" or drift is True: blockers.append(f"service boundary {name} is failing or has ownership drift")
        elif decision=="hold" or not documented: warnings.append(f"service boundary {name} requires boundary documentation review")
        boundary_summary.append({"name":name,"decision":decision or ("pass" if documented and drift is not True else "hold"),"documented":documented,"drift":drift})
    if payload.require_boundary_doc and not boundary_summary: blockers.append("at least one service-boundary document is required")
    owner_ack=0
    for idx,item in enumerate(payload.owners):
        if not isinstance(item, dict): continue
        name=_metadata_name(item, f"owner-{idx}"); decision=_dict_decision(item); ack=decision=="pass" or _as_bool(item.get("acknowledged", item.get("ownerAck", item.get("approved")))) is True
        if ack: owner_ack += 1
        if decision=="rollback": blockers.append(f"architecture owner {name} is failing")
        elif payload.require_owner_ack and (decision=="hold" or not ack): warnings.append(f"architecture owner {name} requires acknowledgement")
        owner_summary.append({"name":name,"decision":decision or ("pass" if ack else "hold"),"acknowledged":ack})
    if payload.require_owner_ack and owner_ack == 0: blockers.append("at least one architecture owner acknowledgement is required")
    for idx,item in enumerate(payload.decision_records):
        if not isinstance(item, dict): continue
        name=_metadata_name(item, f"adr-{idx}"); decision=_dict_decision(item); approved=decision=="pass" or _as_bool(item.get("approved", item.get("accepted"))) is True; linked=_as_bool(item.get("linked", item.get("traceable", item.get("linkedToRelease"))))
        if decision=="rollback" or approved is False: blockers.append(f"decision record {name} is failing or rejected")
        elif decision=="hold" or approved is None: warnings.append(f"decision record {name} requires review")
        if linked is False: warnings.append(f"decision record {name} is not linked to release evidence")
        adr_summary.append({"name":name,"decision":decision or ("pass" if approved else "unknown"),"approved":approved,"linked":linked})
    if payload.require_adr and not adr_summary: blockers.append("at least one architecture decision record is required")
    evidence_statuses=_evidence_status_map(payload.evidence or {})
    for name,status in evidence_statuses.items():
        if status=="rollback": blockers.append(f"evidence {name} is failing")
        elif status=="hold": warnings.append(f"evidence {name} requires review")
    decision="rollback" if blockers else "hold" if warnings else "pass"
    report={"releaseId":payload.release_id,"domain":payload.domain,"route":payload.route,"jobTypes":payload.job_types,"decision":decision,"artifactSummary":artifact_summary,"boundarySummary":boundary_summary,"ownerSummary":owner_summary,"decisionRecordSummary":adr_summary,"evidenceStatuses":evidence_statuses,"blockers":blockers,"warnings":warnings,"nextActions":["Attach architecture ownership evidence to the sustained-operations bundle."],"mutatesArchitectureOrOwnership":False,"pythonArchitectureOwnershipReviewIsAdvisory":True,"operatorsOwnArchitectureChanges":True}
    artifact=artifact_store.write_json(prefix="platform-architecture-ownership-review", artifact_type="platform.architecture_ownership_review.report", payload=report, metadata={"rowCount":len(artifact_summary)+len(boundary_summary)+len(owner_summary)+len(adr_summary),"redactionApplied":True,"piiClass":"architecture-ownership-metadata-only","source":"python-architecture-ownership-review"})
    return _result(job,"platform.architecture_ownership_review.completed",{**report,"artifactGenerated":True,"artifact":model_dump(artifact, by_alias=True, mode="json")},["architecture ownership review is advisory; Python did not mutate architecture records, ownership assignments or service boundaries"],[artifact])


def process_platform_executive_metrics_governance_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(ExecutiveMetricsGovernanceReviewPayload, job.payload)
    blockers: list[str] = []; warnings: list[str] = []
    metric_summary: list[dict[str, Any]] = []; dashboard_summary: list[dict[str, Any]] = []; owner_summary: list[dict[str, Any]] = []
    for required in payload.required_metrics:
        matches=[i for i in payload.metric_definitions if isinstance(i, dict) and _token_matches(i, required)]
        if not matches:
            blockers.append(f"required executive metric {required} is missing"); continue
        item=matches[0]; name=_metadata_name(item, required); decision=_dict_decision(item); age=_metric_number(item, keys=("ageDays","definitionAgeDays","daysSinceReview")); approved=decision=="pass" or _as_bool(item.get("approved", item.get("reviewed"))) is True; owner_ack=_as_bool(item.get("ownerAck", item.get("ownerAcknowledged"))); redacted=_as_bool(item.get("redacted", item.get("sanitized", item.get("minimized"))))
        if decision=="rollback": blockers.append(f"executive metric {name} is failing governance review")
        elif decision=="hold" or not approved: warnings.append(f"executive metric {name} requires definition approval")
        if age is not None and age > payload.max_metric_age_days: warnings.append(f"executive metric {name} age {age:g}d exceeds {payload.max_metric_age_days}d")
        if payload.require_owner_ack and owner_ack is not True: warnings.append(f"executive metric {name} missing owner acknowledgement")
        if redacted is False: blockers.append(f"executive metric {name} is not marked redacted/minimized")
        metric_summary.append({"name":name,"decision":decision or ("pass" if approved else "hold"),"ageDays":age,"approved":approved,"ownerAck":owner_ack,"redacted":redacted})
    for idx,item in enumerate(payload.dashboards):
        if not isinstance(item, dict): continue
        name=_metadata_name(item, f"dashboard-{idx}"); decision=_dict_decision(item); linked=_as_bool(item.get("linked", item.get("traceable"))); fresh=_as_bool(item.get("fresh", item.get("freshnessOk", item.get("current")))); access=_as_bool(item.get("accessReviewed", item.get("rbacReviewed")))
        if decision=="rollback" or fresh is False: blockers.append(f"executive dashboard {name} is stale or failing")
        elif decision=="hold" or linked is not True: warnings.append(f"executive dashboard {name} requires linkage review")
        dashboard_summary.append({"name":name,"decision":decision or ("pass" if fresh is True and linked is True else "hold"),"linked":linked,"fresh":fresh,"accessReviewed":access})
    if payload.require_dashboard and not dashboard_summary: blockers.append("at least one executive dashboard record is required")
    cadence_decision=_dict_decision(payload.review_cadence); cadence_defined=bool(payload.review_cadence); cadence_owner_ack=_as_bool(payload.review_cadence.get("ownerAck", payload.review_cadence.get("ownerAcknowledged"))) if isinstance(payload.review_cadence, dict) else None
    cadence_summary={"decision":cadence_decision or ("pass" if cadence_defined else "missing"),"defined":cadence_defined,"ownerAck":cadence_owner_ack}
    if payload.require_cadence and not cadence_defined: blockers.append("executive metrics review cadence is required")
    elif cadence_decision=="rollback": blockers.append("executive metrics review cadence is failing")
    elif cadence_decision=="hold" or (payload.require_owner_ack and cadence_owner_ack is not True): warnings.append("executive metrics review cadence requires owner acknowledgement")
    owner_ack=0
    for idx,item in enumerate(payload.owners):
        if not isinstance(item, dict): continue
        name=_metadata_name(item, f"metrics-owner-{idx}"); decision=_dict_decision(item); ack=decision=="pass" or _as_bool(item.get("acknowledged", item.get("ownerAck", item.get("approved")))) is True
        if ack: owner_ack += 1
        if decision=="rollback": blockers.append(f"metrics owner {name} is failing")
        elif payload.require_owner_ack and (decision=="hold" or not ack): warnings.append(f"metrics owner {name} requires acknowledgement")
        owner_summary.append({"name":name,"decision":decision or ("pass" if ack else "hold"),"acknowledged":ack})
    if payload.require_owner_ack and owner_ack == 0: blockers.append("at least one executive metrics owner acknowledgement is required")
    evidence_statuses=_evidence_status_map(payload.evidence or {})
    for name,status in evidence_statuses.items():
        if status=="rollback": blockers.append(f"evidence {name} is failing")
        elif status=="hold": warnings.append(f"evidence {name} requires review")
    decision="rollback" if blockers else "hold" if warnings else "pass"
    report={"releaseId":payload.release_id,"domain":payload.domain,"route":payload.route,"jobTypes":payload.job_types,"decision":decision,"metricSummary":metric_summary,"dashboardSummary":dashboard_summary,"cadenceSummary":cadence_summary,"ownerSummary":owner_summary,"evidenceStatuses":evidence_statuses,"blockers":blockers,"warnings":warnings,"nextActions":["Attach executive metrics governance evidence to the sustained-operations bundle."],"mutatesDashboardsOrReports":False,"pythonExecutiveMetricsGovernanceReviewIsAdvisory":True,"operatorsOwnExecutiveReporting":True}
    artifact=artifact_store.write_json(prefix="platform-executive-metrics-governance-review", artifact_type="platform.executive_metrics_governance_review.report", payload=report, metadata={"rowCount":len(metric_summary)+len(dashboard_summary)+len(owner_summary)+(1 if cadence_defined else 0),"redactionApplied":True,"piiClass":"executive-metrics-governance-metadata-only","source":"python-executive-metrics-governance-review"})
    return _result(job,"platform.executive_metrics_governance_review.completed",{**report,"artifactGenerated":True,"artifact":model_dump(artifact, by_alias=True, mode="json")},["executive metrics governance review is advisory; Python did not mutate dashboards, reporting destinations or metric ownership"],[artifact])



def process_platform_domain_adoption_readiness_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(DomainAdoptionReadinessReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    domain_summary: list[dict[str, Any]] = []
    owner_summary: list[dict[str, Any]] = []
    open_blocker_count = 0

    for required in payload.required_domains:
        matches = [item for item in payload.domains if isinstance(item, dict) and _token_matches(item, required)]
        if not matches:
            blockers.append(f"required Phase 2 domain {required} is missing")
            continue
        item = matches[0]
        name = _metadata_name(item, required)
        decision = _dict_decision(item)
        score = _metric_number(item, keys=("readinessScore", "score", "adoptionReadinessScore"))
        owner_ack = _as_bool(item.get("ownerAck", item.get("ownerAcknowledged", item.get("acknowledged"))))
        rollback_ready = _as_bool(item.get("rollbackReady", item.get("rollbackTested", item.get("rollbackPlanReady"))))
        redacted = _as_bool(item.get("redacted", item.get("sanitized", item.get("minimized"))))
        item_blockers = int(_metric_number(item, keys=("openBlockers", "blockers", "criticalIssues")) or 0)
        open_blocker_count += item_blockers
        if decision == "rollback": blockers.append(f"Phase 2 domain {name} is failing readiness review")
        elif decision == "hold": warnings.append(f"Phase 2 domain {name} requires readiness review")
        if score is None: warnings.append(f"Phase 2 domain {name} missing readiness score")
        elif score < payload.min_readiness_score: blockers.append(f"Phase 2 domain {name} readiness score {score:g} below required {payload.min_readiness_score:g}")
        if payload.require_owner_ack and owner_ack is not True: warnings.append(f"Phase 2 domain {name} missing owner acknowledgement")
        if payload.require_rollback_plan and rollback_ready is not True: blockers.append(f"Phase 2 domain {name} missing rollback readiness evidence")
        if redacted is False: blockers.append(f"Phase 2 domain {name} is not marked redacted/minimized")
        domain_summary.append({"name": name, "decision": decision or ("pass" if score is not None and score >= payload.min_readiness_score and rollback_ready is True else "hold"), "readinessScore": score, "ownerAck": owner_ack, "rollbackReady": rollback_ready, "redacted": redacted, "openBlockers": item_blockers})

    owner_ack_count = 0
    for idx,item in enumerate(payload.owners):
        if not isinstance(item, dict): continue
        name = _metadata_name(item, f"owner-{idx}")
        decision = _dict_decision(item)
        ack = decision == "pass" or _as_bool(item.get("acknowledged", item.get("ownerAck", item.get("approved")))) is True
        if ack: owner_ack_count += 1
        if decision == "rollback": blockers.append(f"Phase 2 adoption owner {name} is failing")
        elif payload.require_owner_ack and (decision == "hold" or not ack): warnings.append(f"Phase 2 adoption owner {name} requires acknowledgement")
        owner_summary.append({"name": name, "decision": decision or ("pass" if ack else "hold"), "acknowledged": ack})
    if payload.require_owner_ack and owner_ack_count == 0:
        blockers.append("at least one Phase 2 adoption owner acknowledgement is required")
    if open_blocker_count > payload.max_open_blockers:
        blockers.append(f"Phase 2 domain open blocker count {open_blocker_count} exceeds allowed {payload.max_open_blockers}")

    rollback_decision = _dict_decision(payload.rollback_plan)
    rollback_tested = _as_bool(payload.rollback_plan.get("tested", payload.rollback_plan.get("rollbackTested"))) if isinstance(payload.rollback_plan, dict) else None
    rollback_owner_ack = _as_bool(payload.rollback_plan.get("ownerAck", payload.rollback_plan.get("ownerAcknowledged"))) if isinstance(payload.rollback_plan, dict) else None
    rollback_summary = {"decision": rollback_decision or ("pass" if rollback_tested is True else "missing"), "tested": rollback_tested, "ownerAck": rollback_owner_ack}
    if payload.require_rollback_plan and not payload.rollback_plan:
        blockers.append("Phase 2 adoption rollback plan is required")
    elif rollback_decision == "rollback":
        blockers.append("Phase 2 adoption rollback plan is failing")
    elif payload.require_rollback_plan and rollback_tested is not True:
        blockers.append("Phase 2 adoption rollback plan must be tested")

    evidence_statuses = _evidence_status_map(payload.evidence or {})
    for name,status in evidence_statuses.items():
        if status == "rollback": blockers.append(f"evidence {name} is failing")
        elif status == "hold": warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    next_actions = ["Attach Phase 2 domain-adoption readiness evidence to the release bundle.", "Keep domain routing, feature flags and tenant enablement operator-owned outside Python."] if decision == "pass" else ["Hold Phase 2 adoption until domain warnings are resolved.", "Re-run with sanitized domain readiness, owner acknowledgement and rollback evidence."] if decision == "hold" else ["Do not enter Phase 2 adoption while domain readiness blockers remain.", "Resolve missing domains, rollback readiness, low scores or blocker-count violations before retrying."]
    report = {"releaseId": payload.release_id, "phase": payload.phase, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "domainSummary": domain_summary, "ownerSummary": owner_summary, "rollbackSummary": rollback_summary, "openBlockerCount": open_blocker_count, "evidenceStatuses": evidence_statuses, "blockers": blockers, "warnings": warnings, "nextActions": next_actions, "mutatesDomainRoutingOrFlags": False, "pythonDomainAdoptionReadinessReviewIsAdvisory": True, "operatorsOwnPhase2Adoption": True}
    artifact = artifact_store.write_json(prefix="platform-domain-adoption-readiness-review", artifact_type="platform.domain_adoption_readiness_review.report", payload=report, metadata={"rowCount": len(domain_summary)+len(owner_summary)+(1 if payload.rollback_plan else 0), "redactionApplied": True, "piiClass": "domain-adoption-readiness-metadata-only", "source": "python-domain-adoption-readiness-review"})
    return _result(job, "platform.domain_adoption_readiness_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Phase 2 domain adoption review is advisory; Python did not mutate routing, feature flags, tenants or domain ownership"], [artifact])


def process_platform_phase_two_rollout_governance_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(PhaseTwoRolloutGovernanceReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    milestone_summary: list[dict[str, Any]] = []
    approval_summary: list[dict[str, Any]] = []
    cohort_summary: list[dict[str, Any]] = []
    guardrail_summary: list[dict[str, Any]] = []
    open_blocker_count = 0

    for idx,item in enumerate(payload.milestones):
        if not isinstance(item, dict): continue
        name = _metadata_name(item, f"milestone-{idx}")
        decision = _dict_decision(item)
        completed = decision == "pass" or _as_bool(item.get("completed", item.get("met"))) is True
        item_blockers = int(_metric_number(item, keys=("openBlockers", "blockers", "criticalIssues")) or 0)
        open_blocker_count += item_blockers
        if decision == "rollback": blockers.append(f"Phase 2 milestone {name} is failing")
        elif decision == "hold" or not completed: warnings.append(f"Phase 2 milestone {name} requires completion")
        milestone_summary.append({"name": name, "decision": decision or ("pass" if completed else "hold"), "completed": completed, "openBlockers": item_blockers})
    if not milestone_summary:
        blockers.append("at least one Phase 2 rollout milestone is required")

    approval_count = 0
    for idx,item in enumerate(payload.approvals):
        if not isinstance(item, dict): continue
        name = _metadata_name(item, f"approval-{idx}")
        decision = _dict_decision(item)
        approved = decision == "pass" or _as_bool(item.get("approved", item.get("accepted", item.get("ownerAck")))) is True
        if approved: approval_count += 1
        if decision == "rollback": blockers.append(f"Phase 2 approval {name} is rejected/failing")
        elif decision == "hold" or not approved: warnings.append(f"Phase 2 approval {name} requires approval")
        approval_summary.append({"name": name, "decision": decision or ("pass" if approved else "hold"), "approved": approved})
    if approval_count < payload.min_approval_count:
        blockers.append(f"Phase 2 approval count {approval_count} below required {payload.min_approval_count}")

    for idx,item in enumerate(payload.cohorts):
        if not isinstance(item, dict): continue
        name = _metadata_name(item, f"cohort-{idx}")
        decision = _dict_decision(item)
        defined = decision == "pass" or _as_bool(item.get("defined", item.get("cohortDefined"))) is True
        rollback_ready = _as_bool(item.get("rollbackReady", item.get("reversible")))
        if decision == "rollback": blockers.append(f"Phase 2 cohort {name} is failing")
        elif decision == "hold" or not defined: warnings.append(f"Phase 2 cohort {name} requires definition")
        if rollback_ready is False: blockers.append(f"Phase 2 cohort {name} is not rollback-ready")
        cohort_summary.append({"name": name, "decision": decision or ("pass" if defined and rollback_ready is not False else "hold"), "defined": defined, "rollbackReady": rollback_ready})

    for idx,item in enumerate(payload.guardrails):
        if not isinstance(item, dict): continue
        name = _metadata_name(item, f"guardrail-{idx}")
        decision = _dict_decision(item)
        enabled = decision == "pass" or _as_bool(item.get("enabled", item.get("active"))) is True
        if decision == "rollback" or enabled is False: blockers.append(f"Phase 2 guardrail {name} is disabled or failing")
        elif decision == "hold": warnings.append(f"Phase 2 guardrail {name} requires review")
        guardrail_summary.append({"name": name, "decision": decision or ("pass" if enabled else "hold"), "enabled": enabled})
    if payload.require_guardrails and not guardrail_summary:
        blockers.append("at least one Phase 2 rollout guardrail is required")

    comms_decision = _dict_decision(payload.communications_plan)
    comms_approved = _as_bool(payload.communications_plan.get("approved", payload.communications_plan.get("ready"))) if isinstance(payload.communications_plan, dict) else None
    comms_redacted = _as_bool(payload.communications_plan.get("redacted", payload.communications_plan.get("sanitized"))) if isinstance(payload.communications_plan, dict) else None
    communications_summary = {"decision": comms_decision or ("pass" if comms_approved is True else "missing"), "approved": comms_approved, "redacted": comms_redacted}
    if payload.require_comms_plan and not payload.communications_plan: blockers.append("Phase 2 communications plan is required")
    elif comms_decision == "rollback" or comms_approved is False: blockers.append("Phase 2 communications plan is failing or rejected")
    elif payload.require_comms_plan and comms_approved is not True: warnings.append("Phase 2 communications plan requires approval")
    if comms_redacted is False: blockers.append("Phase 2 communications plan is not marked redacted/sanitized")

    support_decision = _dict_decision(payload.support_plan)
    support_approved = _as_bool(payload.support_plan.get("approved", payload.support_plan.get("ready"))) if isinstance(payload.support_plan, dict) else None
    support_owner_ack = _as_bool(payload.support_plan.get("ownerAck", payload.support_plan.get("ownerAcknowledged"))) if isinstance(payload.support_plan, dict) else None
    support_summary = {"decision": support_decision or ("pass" if support_approved is True else "missing"), "approved": support_approved, "ownerAck": support_owner_ack}
    if payload.require_support_plan and not payload.support_plan: blockers.append("Phase 2 support plan is required")
    elif support_decision == "rollback" or support_approved is False: blockers.append("Phase 2 support plan is failing or rejected")
    elif payload.require_support_plan and support_approved is not True: warnings.append("Phase 2 support plan requires approval")

    if open_blocker_count > payload.max_open_blockers:
        blockers.append(f"Phase 2 rollout open blocker count {open_blocker_count} exceeds allowed {payload.max_open_blockers}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    for name,status in evidence_statuses.items():
        if status == "rollback": blockers.append(f"evidence {name} is failing")
        elif status == "hold": warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    next_actions = ["Attach Phase 2 rollout governance evidence to the release bundle.", "Keep traffic promotion, cohort mutation, notifications and approvals operator-owned outside Python."] if decision == "pass" else ["Hold Phase 2 rollout until governance warnings are resolved.", "Re-run with sanitized milestones, approvals, cohorts, guardrails, communications and support evidence."] if decision == "hold" else ["Do not expand Phase 2 rollout while governance blockers remain.", "Resolve missing milestones, approvals, disabled guardrails, communications/support blockers or open blockers before retrying."]
    report = {"releaseId": payload.release_id, "phase": payload.phase, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "milestoneSummary": milestone_summary, "approvalSummary": approval_summary, "cohortSummary": cohort_summary, "guardrailSummary": guardrail_summary, "communicationsSummary": communications_summary, "supportSummary": support_summary, "approvalCount": approval_count, "openBlockerCount": open_blocker_count, "evidenceStatuses": evidence_statuses, "blockers": blockers, "warnings": warnings, "nextActions": next_actions, "mutatesTrafficCohortsOrApprovals": False, "pythonPhaseTwoRolloutGovernanceReviewIsAdvisory": True, "operatorsOwnPhase2Rollout": True}
    artifact = artifact_store.write_json(prefix="platform-phase-two-rollout-governance-review", artifact_type="platform.phase_two_rollout_governance_review.report", payload=report, metadata={"rowCount": len(milestone_summary)+len(approval_summary)+len(cohort_summary)+len(guardrail_summary), "redactionApplied": True, "piiClass": "phase-two-rollout-governance-metadata-only", "source": "python-phase-two-rollout-governance-review"})
    return _result(job, "platform.phase_two_rollout_governance_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Phase 2 rollout governance review is advisory; Python did not promote traffic, mutate cohorts, notify users or approve releases"], [artifact])



def process_platform_domain_pilot_execution_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(DomainPilotExecutionReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    domain_summary: list[dict[str, Any]] = []
    run_summary: list[dict[str, Any]] = []
    criteria_summary: list[dict[str, Any]] = []
    approval_summary: list[dict[str, Any]] = []
    open_blocker_count = 0

    for required in payload.required_pilot_domains:
        matches = [item for item in payload.pilot_domains if isinstance(item, dict) and _token_matches(item, required)]
        if not matches:
            blockers.append(f"required pilot domain {required} is missing")
            continue
        item = matches[0]
        name = _metadata_name(item, required)
        decision = _dict_decision(item)
        enabled = decision == "pass" or _as_bool(item.get("enabled", item.get("pilotEnabled"))) is True
        owner_ack = _as_bool(item.get("ownerAck", item.get("acknowledged")))
        if decision == "rollback" or enabled is False:
            blockers.append(f"pilot domain {name} is disabled or failing")
        elif decision == "hold" or not enabled:
            warnings.append(f"pilot domain {name} requires enablement evidence")
        if owner_ack is False:
            blockers.append(f"pilot domain {name} owner acknowledgement is false")
        elif owner_ack is not True:
            warnings.append(f"pilot domain {name} requires owner acknowledgement")
        domain_summary.append({"name": name, "decision": decision or ("pass" if enabled and owner_ack is True else "hold"), "enabled": enabled, "ownerAck": owner_ack})

    for idx, item in enumerate(payload.pilot_runs):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"pilot-run-{idx}")
        decision = _dict_decision(item)
        completed = decision == "pass" or _as_bool(item.get("completed", item.get("finished"))) is True
        success_rate = _metric_number(item, keys=("successRate", "success_rate", "successPercent"))
        error_rate = _metric_number(item, keys=("errorRate", "error_rate", "failureRate"))
        if success_rate is not None and success_rate > 1:
            success_rate = success_rate / 100
        if error_rate is not None and error_rate > 1:
            error_rate = error_rate / 100
        item_blockers = int(_metric_number(item, keys=("openBlockers", "blockers", "criticalIssues")) or 0)
        open_blocker_count += item_blockers
        if decision == "rollback":
            blockers.append(f"pilot run {name} is failing")
        elif decision == "hold" or not completed:
            warnings.append(f"pilot run {name} requires completion")
        if success_rate is not None and success_rate < payload.min_success_rate:
            blockers.append(f"pilot run {name} success rate {success_rate:.4f} below required {payload.min_success_rate:.4f}")
        if error_rate is not None and error_rate > payload.max_error_rate:
            blockers.append(f"pilot run {name} error rate {error_rate:.4f} above allowed {payload.max_error_rate:.4f}")
        run_summary.append({"name": name, "decision": decision or ("pass" if completed else "hold"), "completed": completed, "successRate": success_rate, "errorRate": error_rate, "openBlockers": item_blockers})
    if not run_summary:
        blockers.append("at least one Phase 2 pilot run is required")

    for idx, item in enumerate(payload.acceptance_criteria):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"criterion-{idx}")
        decision = _dict_decision(item)
        met = decision == "pass" or _as_bool(item.get("met", item.get("passed"))) is True
        if decision == "rollback" or met is False:
            blockers.append(f"acceptance criterion {name} is not met")
        elif decision == "hold" or not met:
            warnings.append(f"acceptance criterion {name} requires review")
        criteria_summary.append({"name": name, "decision": decision or ("pass" if met else "hold"), "met": met})
    if not criteria_summary:
        blockers.append("at least one Phase 2 pilot acceptance criterion is required")

    approval_count = 0
    for idx, item in enumerate(payload.operator_approvals):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"approval-{idx}")
        decision = _dict_decision(item)
        approved = decision == "pass" or _as_bool(item.get("approved", item.get("ownerAck", item.get("accepted")))) is True
        if approved:
            approval_count += 1
        if decision == "rollback":
            blockers.append(f"operator approval {name} is rejected/failing")
        elif decision == "hold" or not approved:
            warnings.append(f"operator approval {name} requires approval")
        approval_summary.append({"name": name, "decision": decision or ("pass" if approved else "hold"), "approved": approved})
    if payload.require_operator_approval and approval_count < payload.min_approval_count:
        blockers.append(f"operator approval count {approval_count} below required {payload.min_approval_count}")

    rollback_decision = _dict_decision(payload.rollback_plan)
    rollback_tested = _as_bool(payload.rollback_plan.get("tested", payload.rollback_plan.get("drilled"))) if isinstance(payload.rollback_plan, dict) else None
    rollback_owner_ack = _as_bool(payload.rollback_plan.get("ownerAck", payload.rollback_plan.get("ownerAcknowledged"))) if isinstance(payload.rollback_plan, dict) else None
    rollback_summary = {"decision": rollback_decision or ("pass" if rollback_tested is True else "missing"), "tested": rollback_tested, "ownerAck": rollback_owner_ack}
    if payload.require_rollback_plan and not payload.rollback_plan:
        blockers.append("Phase 2 pilot rollback plan is required")
    elif rollback_decision == "rollback" or rollback_tested is False:
        blockers.append("Phase 2 pilot rollback plan is failing or untested")
    elif payload.require_rollback_plan and rollback_tested is not True:
        warnings.append("Phase 2 pilot rollback plan requires tested evidence")

    if open_blocker_count > payload.max_open_blockers:
        blockers.append(f"pilot open blocker count {open_blocker_count} exceeds allowed {payload.max_open_blockers}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    for name, status in evidence_statuses.items():
        if status == "rollback": blockers.append(f"evidence {name} is failing")
        elif status == "hold": warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    next_actions = ["Attach Phase 2 pilot execution evidence to the domain rollout bundle.", "Keep domain enablement, traffic allocation and rollback execution operator-owned outside Python."] if decision == "pass" else ["Hold Phase 2 pilot expansion until pilot warnings are resolved.", "Re-run with sanitized pilot runs, acceptance criteria, approvals and rollback evidence."] if decision == "hold" else ["Do not expand pilot domains while execution blockers remain.", "Resolve missing pilot domains, failed runs, unmet criteria, approval gaps or rollback blockers before retrying."]
    report = {"releaseId": payload.release_id, "phase": payload.phase, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "domainSummary": domain_summary, "runSummary": run_summary, "criteriaSummary": criteria_summary, "approvalSummary": approval_summary, "rollbackSummary": rollback_summary, "approvalCount": approval_count, "openBlockerCount": open_blocker_count, "thresholds": {"minSuccessRate": payload.min_success_rate, "maxErrorRate": payload.max_error_rate, "maxOpenBlockers": payload.max_open_blockers}, "evidenceStatuses": evidence_statuses, "blockers": blockers, "warnings": warnings, "nextActions": next_actions, "mutatesPilotTrafficOrDomains": False, "pythonDomainPilotExecutionReviewIsAdvisory": True, "operatorsOwnPilotExecution": True}
    artifact = artifact_store.write_json(prefix="platform-domain-pilot-execution-review", artifact_type="platform.domain_pilot_execution_review.report", payload=report, metadata={"rowCount": len(domain_summary)+len(run_summary)+len(criteria_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "domain-pilot-execution-metadata-only", "source": "python-domain-pilot-execution-review"})
    return _result(job, "platform.domain_pilot_execution_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Phase 2 domain pilot execution review is advisory; Python did not enable domains, mutate traffic, update flags or execute rollback"], [artifact])


def process_platform_phase_two_expansion_control_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(PhaseTwoExpansionControlReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    wave_summary: list[dict[str, Any]] = []
    trigger_summary: list[dict[str, Any]] = []
    checkpoint_summary: list[dict[str, Any]] = []
    approval_summary: list[dict[str, Any]] = []

    traffic_decision = _dict_decision(payload.traffic_limits)
    current_percent = _metric_number(payload.traffic_limits, keys=("currentPercent", "currentTrafficPercent"))
    target_percent = _metric_number(payload.traffic_limits, keys=("targetPercent", "targetTrafficPercent"))
    max_target = _metric_number(payload.traffic_limits, keys=("maxTargetPercent", "maxTrafficPercent")) or payload.max_target_percent
    traffic_summary = {"decision": traffic_decision or ("pass" if target_percent is not None else "missing"), "currentPercent": current_percent, "targetPercent": target_percent, "maxTargetPercent": max_target}
    if payload.require_traffic_limits and not payload.traffic_limits:
        blockers.append("Phase 2 expansion traffic limits are required")
    elif traffic_decision == "rollback":
        blockers.append("Phase 2 expansion traffic limits are failing")
    if target_percent is not None and target_percent > max_target:
        blockers.append(f"target percent {target_percent:g} exceeds allowed {max_target:g}")

    for idx, item in enumerate(payload.waves):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"wave-{idx}")
        decision = _dict_decision(item)
        completed = decision == "pass" or _as_bool(item.get("completed", item.get("ready"))) is True
        wave_target = _metric_number(item, keys=("targetPercent", "trafficPercent"))
        if decision == "rollback": blockers.append(f"expansion wave {name} is failing")
        elif decision == "hold" or not completed: warnings.append(f"expansion wave {name} requires completion/readiness")
        if wave_target is not None and wave_target > max_target:
            blockers.append(f"expansion wave {name} target {wave_target:g} exceeds allowed {max_target:g}")
        wave_summary.append({"name": name, "decision": decision or ("pass" if completed else "hold"), "completed": completed, "targetPercent": wave_target})
    if not wave_summary:
        blockers.append("at least one Phase 2 expansion wave is required")

    for idx, item in enumerate(payload.rollback_triggers):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"rollback-trigger-{idx}")
        decision = _dict_decision(item)
        configured = decision == "pass" or _as_bool(item.get("configured", item.get("enabled"))) is True
        if decision == "rollback" or configured is False: blockers.append(f"rollback trigger {name} is disabled or failing")
        elif decision == "hold" or not configured: warnings.append(f"rollback trigger {name} requires configuration")
        trigger_summary.append({"name": name, "decision": decision or ("pass" if configured else "hold"), "configured": configured})
    if payload.require_rollback_triggers and not trigger_summary:
        blockers.append("at least one Phase 2 rollback trigger is required")

    passed_checkpoints = 0
    for idx, item in enumerate(payload.checkpoints):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"checkpoint-{idx}")
        decision = _dict_decision(item)
        passed = decision == "pass" or _as_bool(item.get("passed", item.get("met"))) is True
        if passed:
            passed_checkpoints += 1
        if decision == "rollback": blockers.append(f"expansion checkpoint {name} is failing")
        elif decision == "hold" or not passed: warnings.append(f"expansion checkpoint {name} requires pass evidence")
        checkpoint_summary.append({"name": name, "decision": decision or ("pass" if passed else "hold"), "passed": passed})
    if passed_checkpoints < payload.min_checkpoint_passes:
        blockers.append(f"checkpoint pass count {passed_checkpoints} below required {payload.min_checkpoint_passes}")

    approval_count = 0
    for idx, item in enumerate(payload.approvals):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"approval-{idx}")
        decision = _dict_decision(item)
        approved = decision == "pass" or _as_bool(item.get("approved", item.get("accepted", item.get("ownerAck")))) is True
        if approved:
            approval_count += 1
        if decision == "rollback": blockers.append(f"expansion approval {name} is rejected/failing")
        elif decision == "hold" or not approved: warnings.append(f"expansion approval {name} requires approval")
        approval_summary.append({"name": name, "decision": decision or ("pass" if approved else "hold"), "approved": approved})
    if approval_count < payload.min_approval_count:
        blockers.append(f"expansion approval count {approval_count} below required {payload.min_approval_count}")

    evidence_statuses = _evidence_status_map(payload.evidence or {})
    for name, status in evidence_statuses.items():
        if status == "rollback": blockers.append(f"evidence {name} is failing")
        elif status == "hold": warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    next_actions = ["Attach Phase 2 expansion-control evidence to the rollout bundle.", "Keep traffic limits, wave activation, cohort mutation and rollback execution operator-owned outside Python."] if decision == "pass" else ["Hold Phase 2 expansion until control warnings are resolved.", "Re-run with sanitized waves, checkpoints, rollback triggers, traffic limits and approval evidence."] if decision == "hold" else ["Do not expand Phase 2 traffic while expansion-control blockers remain.", "Resolve traffic-limit, checkpoint, rollback-trigger or approval blockers before retrying."]
    report = {"releaseId": payload.release_id, "phase": payload.phase, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "waveSummary": wave_summary, "trafficSummary": traffic_summary, "rollbackTriggerSummary": trigger_summary, "checkpointSummary": checkpoint_summary, "approvalSummary": approval_summary, "checkpointPassCount": passed_checkpoints, "approvalCount": approval_count, "evidenceStatuses": evidence_statuses, "blockers": blockers, "warnings": warnings, "nextActions": next_actions, "mutatesTrafficOrRollbackState": False, "pythonPhaseTwoExpansionControlReviewIsAdvisory": True, "operatorsOwnExpansionControls": True}
    artifact = artifact_store.write_json(prefix="platform-phase-two-expansion-control-review", artifact_type="platform.phase_two_expansion_control_review.report", payload=report, metadata={"rowCount": len(wave_summary)+len(trigger_summary)+len(checkpoint_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "phase-two-expansion-control-metadata-only", "source": "python-phase-two-expansion-control-review"})
    return _result(job, "platform.phase_two_expansion_control_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Phase 2 expansion-control review is advisory; Python did not change traffic, feature flags, cohorts or rollback state"], [artifact])


def process_platform_domain_outcome_measurement_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(DomainOutcomeMeasurementReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    metric_summary: list[dict[str, Any]] = []
    baseline_summary: list[dict[str, Any]] = []
    adoption_summary: list[dict[str, Any]] = []
    support_summary: list[dict[str, Any]] = []

    for required in payload.required_metrics:
        matches = [item for item in payload.outcome_metrics if isinstance(item, dict) and _token_matches(item, required)]
        if not matches:
            blockers.append(f"required outcome metric {required} is missing")
            continue
    for idx, item in enumerate(payload.outcome_metrics):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"outcome-metric-{idx}")
        decision = _dict_decision(item)
        value = _metric_number(item, keys=("value", "current", "score", "rate", "p95Ms"))
        target = _metric_number(item, keys=("target", "threshold", "minTarget", "maxTarget"))
        regression = _metric_number(item, keys=("regressionPercent", "deltaPercent", "changePercent")) or 0
        if decision == "rollback":
            blockers.append(f"outcome metric {name} is failing")
        elif decision == "hold":
            warnings.append(f"outcome metric {name} requires review")
        if _token_matches({"name": name}, "success_rate") and value is not None and value < payload.min_success_rate:
            blockers.append(f"success-rate metric {name} value {value:g} below required {payload.min_success_rate:g}")
        if regression > payload.max_regression_percent:
            blockers.append(f"outcome metric {name} regression {regression:g}% exceeds allowed {payload.max_regression_percent:g}%")
        metric_summary.append({"name": name, "decision": decision or "pass", "value": value, "target": target, "regressionPercent": regression})

    for idx, item in enumerate(payload.baselines):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"baseline-{idx}")
        decision = _dict_decision(item)
        approved = decision == "pass" or _as_bool(item.get("approved", item.get("validated"))) is True
        stale = _as_bool(item.get("stale", item.get("outdated")))
        if decision == "rollback" or stale is True:
            blockers.append(f"baseline {name} is stale or failing")
        elif decision == "hold" or not approved:
            warnings.append(f"baseline {name} requires approval/validation")
        baseline_summary.append({"name": name, "decision": decision or ("pass" if approved else "hold"), "approved": approved, "stale": stale})
    if payload.require_baselines and not baseline_summary:
        blockers.append("at least one sanitized outcome baseline is required")

    for idx, item in enumerate(payload.adoption_signals):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"adoption-signal-{idx}")
        decision = _dict_decision(item)
        score = _metric_number(item, keys=("score", "adoptionScore", "usageScore", "activationRate"))
        if decision == "rollback":
            blockers.append(f"adoption signal {name} is failing")
        elif decision == "hold":
            warnings.append(f"adoption signal {name} requires review")
        if score is not None and score < payload.min_adoption_score:
            warnings.append(f"adoption signal {name} score {score:g} below target {payload.min_adoption_score:g}")
        adoption_summary.append({"name": name, "decision": decision or ("pass" if score is None or score >= payload.min_adoption_score else "hold"), "score": score})

    for idx, item in enumerate(payload.support_signals):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"support-signal-{idx}")
        decision = _dict_decision(item)
        ticket_rate = _metric_number(item, keys=("ticketRate", "supportTicketRate", "deflectionRate"))
        open_blockers = int(_metric_number(item, keys=("openBlockers", "criticalOpen", "openCritical")) or 0)
        if decision == "rollback" or open_blockers > 0:
            blockers.append(f"support signal {name} has blockers or failing evidence")
        elif decision == "hold":
            warnings.append(f"support signal {name} requires review")
        if ticket_rate is not None and ticket_rate > payload.max_support_ticket_rate:
            warnings.append(f"support signal {name} ticket rate {ticket_rate:g} above target {payload.max_support_ticket_rate:g}")
        support_summary.append({"name": name, "decision": decision or ("rollback" if open_blockers else "pass"), "ticketRate": ticket_rate, "openBlockers": open_blockers})

    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("Phase 2 outcome evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback": blockers.append(f"evidence {name} is failing")
        elif status == "hold": warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    next_actions = ["Attach Phase 2 domain outcome measurements to the pilot evidence bundle.", "Keep metric publication, domain promotion and remediation decisions operator-owned outside Python."] if decision == "pass" else ["Hold Phase 2 outcome expansion until metric/adoption/support warnings are resolved.", "Re-run with sanitized baselines, outcome metrics, adoption signals, support signals and evidence."] if decision == "hold" else ["Do not expand Phase 2 domains while outcome blockers remain.", "Resolve missing metrics, stale baselines, regressions, support blockers or failing evidence before retrying."]
    report = {"releaseId": payload.release_id, "phase": payload.phase, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "metricSummary": metric_summary, "baselineSummary": baseline_summary, "adoptionSummary": adoption_summary, "supportSummary": support_summary, "evidenceStatuses": evidence_statuses, "thresholds": {"minSuccessRate": payload.min_success_rate, "maxRegressionPercent": payload.max_regression_percent, "minAdoptionScore": payload.min_adoption_score, "maxSupportTicketRate": payload.max_support_ticket_rate}, "blockers": blockers, "warnings": warnings, "nextActions": next_actions, "mutatesMetricsOrDomains": False, "pythonDomainOutcomeMeasurementReviewIsAdvisory": True, "operatorsOwnOutcomeDecisions": True}
    artifact = artifact_store.write_json(prefix="platform-domain-outcome-measurement-review", artifact_type="platform.domain_outcome_measurement_review.report", payload=report, metadata={"rowCount": len(metric_summary)+len(baseline_summary)+len(adoption_summary)+len(support_summary), "redactionApplied": True, "piiClass": "domain-outcome-measurement-metadata-only", "source": "python-domain-outcome-measurement-review"})
    return _result(job, "platform.domain_outcome_measurement_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Phase 2 domain outcome measurement review is advisory; Python did not publish metrics, promote domains, notify users or mutate product configuration"], [artifact])


def process_platform_phase_two_feedback_adoption_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(PhaseTwoFeedbackAdoptionReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    feedback_summary: list[dict[str, Any]] = []
    decision_summary: list[dict[str, Any]] = []
    owner_summary: list[dict[str, Any]] = []
    communications_summary: list[dict[str, Any]] = []
    open_critical = 0

    for idx, item in enumerate(payload.feedback_items):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"feedback-{idx}")
        decision = _dict_decision(item)
        severity = str(item.get("severity") or item.get("priority") or "").lower()
        closed = decision == "pass" or _as_bool(item.get("closed", item.get("resolved"))) is True
        if severity in {"critical", "blocker", "high"} and not closed:
            open_critical += 1
        if decision == "rollback": blockers.append(f"feedback item {name} is blocking/failing")
        elif decision == "hold" or not closed: warnings.append(f"feedback item {name} requires triage or closure")
        feedback_summary.append({"name": name, "decision": decision or ("pass" if closed else "hold"), "severity": severity or None, "closed": closed})
    if open_critical > payload.max_open_critical_feedback:
        blockers.append(f"open critical feedback count {open_critical} exceeds allowed {payload.max_open_critical_feedback}")

    for idx, item in enumerate(payload.adoption_decisions):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"adoption-decision-{idx}")
        decision = _dict_decision(item)
        approved = decision == "pass" or _as_bool(item.get("approved", item.get("accepted"))) is True
        rollback_ready = _as_bool(item.get("rollbackReady", item.get("rollbackPlanReady")))
        if decision == "rollback": blockers.append(f"adoption decision {name} is rejected/failing")
        elif decision == "hold" or not approved: warnings.append(f"adoption decision {name} requires approval")
        if rollback_ready is False: blockers.append(f"adoption decision {name} lacks rollback readiness")
        decision_summary.append({"name": name, "decision": decision or ("pass" if approved else "hold"), "approved": approved, "rollbackReady": rollback_ready})
    if payload.require_adoption_decisions and not decision_summary:
        blockers.append("at least one sanitized adoption decision is required")

    owner_response_count = 0
    for idx, item in enumerate(payload.owner_responses):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"owner-response-{idx}")
        decision = _dict_decision(item)
        responded = decision == "pass" or _as_bool(item.get("responded", item.get("ownerAck", item.get("acknowledged")))) is True
        if responded:
            owner_response_count += 1
        if decision == "rollback": blockers.append(f"owner response {name} is failing")
        elif decision == "hold" or not responded: warnings.append(f"owner response {name} is missing acknowledgement")
        owner_summary.append({"name": name, "decision": decision or ("pass" if responded else "hold"), "responded": responded})
    if owner_response_count < payload.min_owner_response_count:
        blockers.append(f"owner response count {owner_response_count} below required {payload.min_owner_response_count}")

    for idx, item in enumerate(payload.communications):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"communication-{idx}")
        decision = _dict_decision(item)
        approved = decision == "pass" or _as_bool(item.get("approved", item.get("ready"))) is True
        redacted = _as_bool(item.get("redacted", item.get("minimized")))
        if decision == "rollback" or redacted is False: blockers.append(f"communication {name} is failing or not redacted")
        elif decision == "hold" or not approved: warnings.append(f"communication {name} requires approval")
        communications_summary.append({"name": name, "decision": decision or ("pass" if approved else "hold"), "approved": approved, "redacted": redacted})
    if payload.require_communications and not communications_summary:
        warnings.append("Phase 2 feedback/adoption communications evidence is recommended before expansion")

    evidence_statuses = _evidence_status_map(payload.evidence or {})
    for name, status in evidence_statuses.items():
        if status == "rollback": blockers.append(f"evidence {name} is failing")
        elif status == "hold": warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    next_actions = ["Attach Phase 2 feedback/adoption review to the domain rollout bundle.", "Keep adoption decisions, customer communications and roadmap changes operator-owned outside Python."] if decision == "pass" else ["Hold Phase 2 adoption expansion until feedback and owner-response warnings are resolved.", "Re-run with sanitized feedback, owner responses, adoption decisions, communications and evidence."] if decision == "hold" else ["Do not expand Phase 2 adoption while critical feedback or approval blockers remain.", "Resolve open critical feedback, missing owner responses, rejected decisions or redaction blockers before retrying."]
    report = {"releaseId": payload.release_id, "phase": payload.phase, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "feedbackSummary": feedback_summary, "adoptionDecisionSummary": decision_summary, "ownerResponseSummary": owner_summary, "communicationsSummary": communications_summary, "openCriticalFeedbackCount": open_critical, "ownerResponseCount": owner_response_count, "evidenceStatuses": evidence_statuses, "blockers": blockers, "warnings": warnings, "nextActions": next_actions, "mutatesFeedbackOrAdoptionState": False, "pythonFeedbackAdoptionReviewIsAdvisory": True, "operatorsOwnAdoptionAndComms": True}
    artifact = artifact_store.write_json(prefix="platform-phase-two-feedback-adoption-review", artifact_type="platform.phase_two_feedback_adoption_review.report", payload=report, metadata={"rowCount": len(feedback_summary)+len(decision_summary)+len(owner_summary)+len(communications_summary), "redactionApplied": True, "piiClass": "phase-two-feedback-adoption-metadata-only", "source": "python-phase-two-feedback-adoption-review"})
    return _result(job, "platform.phase_two_feedback_adoption_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Phase 2 feedback/adoption review is advisory; Python did not close feedback, change rollout state, send communications or mutate roadmap decisions"], [artifact])


def _phase2_simple_summary(items: list[dict[str, Any]], label: str, blockers: list[str], warnings: list[str], required_bool_keys: tuple[str, ...] = ()) -> list[dict[str, Any]]:
    summary: list[dict[str, Any]] = []
    for idx, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"{label}-{idx}")
        decision = _dict_decision(item)
        missing = [key for key in required_bool_keys if _as_bool(item.get(key)) is False]
        if decision == "rollback" or missing:
            blockers.append(f"{label} {name} is failing or missing {', '.join(missing)}")
        elif decision == "hold":
            warnings.append(f"{label} {name} requires review")
        summary.append({"name": name, "decision": decision or ("rollback" if missing else "pass"), "missingRequired": missing})
    return summary


def process_platform_domain_graduation_readiness_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(DomainGraduationReadinessReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    candidate_summary = _phase2_simple_summary(payload.graduation_candidates, "graduation-candidate", blockers, warnings, ("ownerAck", "rollbackReady"))
    criteria_summary = _phase2_simple_summary(payload.graduation_criteria, "graduation-criterion", blockers, warnings, ("met",))
    approval_summary = _phase2_simple_summary(payload.approvals, "approval", blockers, warnings, ("approved",))
    risk_summary: list[dict[str, Any]] = []
    for required in payload.required_candidates:
        if not any(_token_matches(item, required) for item in payload.graduation_candidates if isinstance(item, dict)):
            blockers.append(f"required graduation candidate {required} is missing")
    if not candidate_summary:
        blockers.append("at least one sanitized domain graduation candidate is required")
    if payload.require_criteria and not criteria_summary:
        blockers.append("graduation criteria evidence is required")
    if sum(1 for item in approval_summary if item.get("decision") == "pass") < payload.min_approval_count:
        blockers.append(f"approval count is below required {payload.min_approval_count}")
    score = _metric_number(payload.outcome_summary, keys=("score", "outcomeScore", "graduationScore", "readinessScore"))
    outcome_decision = _dict_decision(payload.outcome_summary)
    if outcome_decision == "rollback": blockers.append("outcome summary is failing")
    elif outcome_decision == "hold": warnings.append("outcome summary requires review")
    if score is not None and score < payload.min_outcome_score:
        blockers.append(f"outcome score {score:g} below required {payload.min_outcome_score:g}")
    open_high = 0
    for idx, item in enumerate(payload.risk_register):
        if not isinstance(item, dict): continue
        name = _metadata_name(item, f"risk-{idx}"); decision = _dict_decision(item); severity = str(item.get("severity") or item.get("priority") or "").lower(); closed = decision == "pass" or _as_bool(item.get("closed", item.get("mitigated"))) is True
        if severity in {"high", "critical", "blocker"} and not closed: open_high += 1
        if decision == "rollback": blockers.append(f"risk {name} is failing")
        elif decision == "hold" or not closed: warnings.append(f"risk {name} requires mitigation review")
        risk_summary.append({"name": name, "decision": decision or ("pass" if closed else "hold"), "severity": severity or None, "closed": closed})
    if open_high > payload.max_open_high_risks:
        blockers.append(f"open high/critical risk count {open_high} exceeds allowed {payload.max_open_high_risks}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses: blockers.append("domain graduation evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback": blockers.append(f"evidence {name} is failing")
        elif status == "hold": warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "phase": payload.phase, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "candidateSummary": candidate_summary, "criteriaSummary": criteria_summary, "outcomeSummary": {"decision": outcome_decision or ("pass" if score is None or score >= payload.min_outcome_score else "rollback"), "score": score}, "riskSummary": risk_summary, "approvalSummary": approval_summary, "evidenceStatuses": evidence_statuses, "thresholds": {"minOutcomeScore": payload.min_outcome_score, "maxOpenHighRisks": payload.max_open_high_risks, "minApprovalCount": payload.min_approval_count}, "blockers": blockers, "warnings": warnings, "nextActions": ["Attach sanitized graduation evidence bundle." if decision == "pass" else "Resolve graduation blockers/warnings before broad adoption."], "mutatesDomainGraduationState": False, "pythonDomainGraduationReadinessReviewIsAdvisory": True, "operatorsOwnGraduationDecisions": True}
    artifact = artifact_store.write_json(prefix="platform-domain-graduation-readiness-review", artifact_type="platform.domain_graduation_readiness_review.report", payload=report, metadata={"rowCount": len(candidate_summary)+len(criteria_summary)+len(risk_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "domain-graduation-readiness-metadata-only", "source": "python-domain-graduation-readiness-review"})
    return _result(job, "platform.domain_graduation_readiness_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Domain graduation readiness review is advisory; Python did not graduate domains, change traffic, enable features or execute rollback"], [artifact])


def process_platform_phase_two_learning_consolidation_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(PhaseTwoLearningConsolidationReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    learning_summary = _phase2_simple_summary(payload.learnings, "learning", blockers, warnings, ("captured",))
    experiment_summary = _phase2_simple_summary(payload.experiments, "experiment", blockers, warnings, ("analyzed",))
    decision_summary = _phase2_simple_summary(payload.decisions, "decision", blockers, warnings, ("approved",))
    playbook_summary = _phase2_simple_summary(payload.playbook_updates, "playbook-update", blockers, warnings, ("approved", "ownerAck"))
    owner_summary = _phase2_simple_summary(payload.owners, "owner", blockers, warnings, ("acknowledged",))
    if len(learning_summary) < payload.min_learning_count: blockers.append(f"learning count {len(learning_summary)} is below required {payload.min_learning_count}")
    if len(decision_summary) < payload.min_decision_count: blockers.append(f"decision count {len(decision_summary)} is below required {payload.min_decision_count}")
    if sum(1 for item in owner_summary if item.get("decision") == "pass") < payload.min_owner_ack_count: blockers.append(f"owner acknowledgement count is below required {payload.min_owner_ack_count}")
    if payload.require_playbook_updates and not playbook_summary: blockers.append("at least one approved playbook update is required")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses: blockers.append("Phase 2 learning consolidation evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback": blockers.append(f"evidence {name} is failing")
        elif status == "hold": warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "phase": payload.phase, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "learningSummary": learning_summary, "experimentSummary": experiment_summary, "decisionSummary": decision_summary, "playbookSummary": playbook_summary, "ownerSummary": owner_summary, "evidenceStatuses": evidence_statuses, "thresholds": {"minLearningCount": payload.min_learning_count, "minDecisionCount": payload.min_decision_count, "minOwnerAckCount": payload.min_owner_ack_count}, "blockers": blockers, "warnings": warnings, "nextActions": ["Attach consolidated Phase 2 learning summary." if decision == "pass" else "Resolve learning consolidation blockers/warnings before closing pilots."], "mutatesPlaybooksOrRollout": False, "pythonPhaseTwoLearningConsolidationReviewIsAdvisory": True, "operatorsOwnLearningClosure": True}
    artifact = artifact_store.write_json(prefix="platform-phase-two-learning-consolidation-review", artifact_type="platform.phase_two_learning_consolidation_review.report", payload=report, metadata={"rowCount": len(learning_summary)+len(experiment_summary)+len(decision_summary)+len(playbook_summary)+len(owner_summary), "redactionApplied": True, "piiClass": "phase-two-learning-consolidation-metadata-only", "source": "python-phase-two-learning-consolidation-review"})
    return _result(job, "platform.phase_two_learning_consolidation_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Phase 2 learning consolidation review is advisory; Python did not publish playbooks, alter roadmap decisions, notify users or mutate rollout state"], [artifact])

def process_platform_domain_wide_adoption_readiness_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(DomainWideAdoptionReadinessReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    domain_summary = _phase2_simple_summary(payload.adoption_domains, "adoption-domain", blockers, warnings, ("ownerAck", "rollbackReady"))
    rollout_summary = _phase2_simple_summary(payload.rollout_evidence, "rollout-evidence", blockers, warnings, ("validated",))
    approval_summary = _phase2_simple_summary(payload.owner_approvals, "owner-approval", blockers, warnings, ("approved",))
    if len(domain_summary) < payload.min_domain_count:
        blockers.append(f"adoption domain count {len(domain_summary)} is below required {payload.min_domain_count}")
    open_blockers = sum(int(_metric_number(item, keys=("openBlockers", "blockers", "criticalOpen")) or 0) for item in payload.adoption_domains if isinstance(item, dict))
    if open_blockers > payload.max_open_blockers:
        blockers.append(f"open blocker count {open_blockers} exceeds allowed {payload.max_open_blockers}")
    if sum(1 for item in approval_summary if item.get("decision") == "pass") < payload.min_owner_approval_count:
        blockers.append(f"owner approval count is below required {payload.min_owner_approval_count}")
    support_decision = _dict_decision(payload.support_readiness)
    support_ready = support_decision == "pass" or _as_bool(payload.support_readiness.get("ready", payload.support_readiness.get("approved"))) is True
    if payload.require_support_readiness and not payload.support_readiness:
        blockers.append("support readiness evidence is required")
    elif support_decision == "rollback" or (payload.require_support_readiness and not support_ready):
        blockers.append("support readiness is failing or not approved")
    elif support_decision == "hold":
        warnings.append("support readiness requires review")
    rollback_decision = _dict_decision(payload.rollback_plan)
    rollback_ready = rollback_decision == "pass" or _as_bool(payload.rollback_plan.get("tested", payload.rollback_plan.get("ready"))) is True
    if payload.require_rollback_plan and not payload.rollback_plan:
        blockers.append("rollback plan evidence is required")
    elif rollback_decision == "rollback" or (payload.require_rollback_plan and not rollback_ready):
        blockers.append("rollback plan is failing or not tested")
    elif rollback_decision == "hold":
        warnings.append("rollback plan requires review")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("domain-wide adoption evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback": blockers.append(f"evidence {name} is failing")
        elif status == "hold": warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "phase": payload.phase, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "domainSummary": domain_summary, "rolloutSummary": rollout_summary, "approvalSummary": approval_summary, "supportReadiness": {"decision": support_decision or ("pass" if support_ready else "rollback"), "ready": support_ready}, "rollbackPlan": {"decision": rollback_decision or ("pass" if rollback_ready else "rollback"), "ready": rollback_ready}, "evidenceStatuses": evidence_statuses, "thresholds": {"minDomainCount": payload.min_domain_count, "minOwnerApprovalCount": payload.min_owner_approval_count, "maxOpenBlockers": payload.max_open_blockers}, "blockers": blockers, "warnings": warnings, "nextActions": ["Attach sanitized domain-wide adoption readiness evidence." if decision == "pass" else "Resolve domain-wide adoption blockers/warnings before broad rollout."], "mutatesDomainAdoptionOrTraffic": False, "pythonDomainWideAdoptionReadinessReviewIsAdvisory": True, "operatorsOwnBroadAdoption": True}
    artifact = artifact_store.write_json(prefix="platform-domain-wide-adoption-readiness-review", artifact_type="platform.domain_wide_adoption_readiness_review.report", payload=report, metadata={"rowCount": len(domain_summary)+len(rollout_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "domain-wide-adoption-readiness-metadata-only", "source": "python-domain-wide-adoption-readiness-review"})
    return _result(job, "platform.domain_wide_adoption_readiness_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Domain-wide adoption readiness review is advisory; Python did not expand traffic, enable domains, change flags or execute rollback"], [artifact])


def process_platform_phase_two_support_transition_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(PhaseTwoSupportTransitionReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    queue_summary = _phase2_simple_summary(payload.support_queues, "support-queue", blockers, warnings, ("ready",))
    escalation_summary = _phase2_simple_summary(payload.escalation_paths, "escalation-path", blockers, warnings, ("documented", "ownerAck"))
    training_summary = _phase2_simple_summary(payload.training_artifacts, "training-artifact", blockers, warnings, ("completed",))
    runbook_summary = _phase2_simple_summary(payload.runbook_updates, "runbook-update", blockers, warnings, ("approved", "published"))
    approval_summary = _phase2_simple_summary(payload.owner_approvals, "owner-approval", blockers, warnings, ("approved",))
    if len(queue_summary) < payload.min_queue_count:
        blockers.append(f"support queue count {len(queue_summary)} is below required {payload.min_queue_count}")
    if payload.require_escalation_paths and not escalation_summary:
        blockers.append("at least one escalation path is required")
    if len(training_summary) < payload.min_training_count:
        blockers.append(f"training artifact count {len(training_summary)} is below required {payload.min_training_count}")
    if payload.require_runbook_updates and not runbook_summary:
        blockers.append("at least one approved/published runbook update is required")
    if sum(1 for item in approval_summary if item.get("decision") == "pass") < payload.min_owner_approval_count:
        blockers.append(f"owner approval count is below required {payload.min_owner_approval_count}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("Phase 2 support transition evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback": blockers.append(f"evidence {name} is failing")
        elif status == "hold": warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "phase": payload.phase, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "queueSummary": queue_summary, "escalationSummary": escalation_summary, "trainingSummary": training_summary, "runbookSummary": runbook_summary, "approvalSummary": approval_summary, "evidenceStatuses": evidence_statuses, "thresholds": {"minQueueCount": payload.min_queue_count, "minTrainingCount": payload.min_training_count, "minOwnerApprovalCount": payload.min_owner_approval_count}, "blockers": blockers, "warnings": warnings, "nextActions": ["Attach sanitized Phase 2 support transition evidence." if decision == "pass" else "Resolve support transition blockers/warnings before broad adoption."], "mutatesSupportQueuesOrEscalations": False, "pythonPhaseTwoSupportTransitionReviewIsAdvisory": True, "operatorsOwnSupportTransition": True}
    artifact = artifact_store.write_json(prefix="platform-phase-two-support-transition-review", artifact_type="platform.phase_two_support_transition_review.report", payload=report, metadata={"rowCount": len(queue_summary)+len(escalation_summary)+len(training_summary)+len(runbook_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "phase-two-support-transition-metadata-only", "source": "python-phase-two-support-transition-review"})
    return _result(job, "platform.phase_two_support_transition_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Phase 2 support transition review is advisory; Python did not change queues, escalation routing, notifications or runbooks"], [artifact])

def process_platform_domain_adoption_stabilization_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(DomainAdoptionStabilizationReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    domain_summary = _phase2_simple_summary(payload.stabilization_domains, "stabilization-domain", blockers, warnings, ("stable", "ownerAck"))
    health_summary = _phase2_simple_summary(payload.health_signals, "health-signal", blockers, warnings, ("healthy",))
    support_summary = _phase2_simple_summary(payload.support_signals, "support-signal", blockers, warnings, tuple())
    regression_summary = _phase2_simple_summary(payload.regression_watch, "regression-watch", blockers, warnings, ("active",))
    approval_summary = _phase2_simple_summary(payload.approvals, "approval", blockers, warnings, ("approved",))
    if len(domain_summary) < payload.min_domain_count:
        blockers.append(f"stabilization domain count {len(domain_summary)} is below required {payload.min_domain_count}")
    if len(health_summary) < payload.min_health_signal_count:
        blockers.append(f"health signal count {len(health_summary)} is below required {payload.min_health_signal_count}")
    open_blockers = sum(int(_metric_number(item, keys=("openBlockers", "blockers", "criticalOpen")) or 0) for item in payload.stabilization_domains if isinstance(item, dict))
    open_blockers += sum(int(_metric_number(item, keys=("openEscalations", "openBlockers")) or 0) for item in payload.support_signals if isinstance(item, dict))
    if open_blockers > payload.max_open_blockers:
        blockers.append(f"open blocker/escalation count {open_blockers} exceeds allowed {payload.max_open_blockers}")
    if payload.require_support_signals and not support_summary:
        blockers.append("support stabilization signals are required")
    if payload.require_regression_watch and not regression_summary:
        blockers.append("regression watch evidence is required")
    if sum(1 for item in approval_summary if item.get("decision") == "pass") < payload.min_approval_count:
        blockers.append(f"approval count is below required {payload.min_approval_count}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("domain adoption stabilization evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback": blockers.append(f"evidence {name} is failing")
        elif status == "hold": warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "phase": payload.phase, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "domainSummary": domain_summary, "healthSummary": health_summary, "supportSummary": support_summary, "regressionSummary": regression_summary, "approvalSummary": approval_summary, "evidenceStatuses": evidence_statuses, "thresholds": {"minDomainCount": payload.min_domain_count, "minHealthSignalCount": payload.min_health_signal_count, "minApprovalCount": payload.min_approval_count, "maxOpenBlockers": payload.max_open_blockers}, "blockers": blockers, "warnings": warnings, "nextActions": ["Attach sanitized Phase 2 stabilization evidence." if decision == "pass" else "Resolve stabilization blockers/warnings before declaring broad adoption stable."], "mutatesTrafficFlagsOrUsers": False, "pythonDomainAdoptionStabilizationReviewIsAdvisory": True, "operatorsOwnStabilization": True}
    artifact = artifact_store.write_json(prefix="platform-domain-adoption-stabilization-review", artifact_type="platform.domain_adoption_stabilization_review.report", payload=report, metadata={"rowCount": len(domain_summary)+len(health_summary)+len(support_summary)+len(regression_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "domain-adoption-stabilization-metadata-only", "source": "python-domain-adoption-stabilization-review"})
    return _result(job, "platform.domain_adoption_stabilization_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Domain adoption stabilization review is advisory; Python did not change traffic, feature flags, users or rollback controls"], [artifact])


def process_platform_phase_two_value_realization_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(PhaseTwoValueRealizationReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    metric_summary = _phase2_simple_summary(payload.value_metrics, "value-metric", blockers, warnings, ("realized",))
    baseline_summary = _phase2_simple_summary(payload.benefit_baselines, "benefit-baseline", blockers, warnings, ("approved",))
    executive_summary = _phase2_simple_summary(payload.executive_reviews, "executive-review", blockers, warnings, ("completed",))
    approval_summary = _phase2_simple_summary(payload.owner_approvals, "owner-approval", blockers, warnings, ("approved",))
    if len(metric_summary) < payload.min_value_metric_count:
        blockers.append(f"value metric count {len(metric_summary)} is below required {payload.min_value_metric_count}")
    if payload.require_benefit_baselines and not baseline_summary:
        blockers.append("benefit baselines are required")
    if payload.require_executive_reviews and not executive_summary:
        blockers.append("executive reviews are required")
    if sum(1 for item in approval_summary if item.get("decision") == "pass") < payload.min_owner_approval_count:
        blockers.append(f"owner approval count is below required {payload.min_owner_approval_count}")
    adoption_decision = _dict_decision(payload.adoption_summary)
    adoption_score = _metric_number(payload.adoption_summary, keys=("score", "adoptionScore", "value"))
    if not payload.adoption_summary:
        blockers.append("adoption summary is required")
    elif adoption_decision == "rollback": blockers.append("adoption summary is failing")
    elif adoption_decision == "hold": warnings.append("adoption summary requires review")
    if adoption_score is not None and adoption_score < payload.min_adoption_score:
        blockers.append(f"adoption score {adoption_score} is below required {payload.min_adoption_score}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("Phase 2 value realization evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback": blockers.append(f"evidence {name} is failing")
        elif status == "hold": warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "phase": payload.phase, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "metricSummary": metric_summary, "baselineSummary": baseline_summary, "adoptionSummary": {"decision": adoption_decision or ("pass" if payload.adoption_summary else "rollback"), "score": adoption_score}, "executiveSummary": executive_summary, "approvalSummary": approval_summary, "evidenceStatuses": evidence_statuses, "thresholds": {"minValueMetricCount": payload.min_value_metric_count, "minOwnerApprovalCount": payload.min_owner_approval_count, "minAdoptionScore": payload.min_adoption_score}, "blockers": blockers, "warnings": warnings, "nextActions": ["Attach sanitized Phase 2 value-realization evidence." if decision == "pass" else "Resolve value-realization blockers/warnings before closing Phase 2."], "mutatesFinancialRoadmapOrReports": False, "pythonPhaseTwoValueRealizationReviewIsAdvisory": True, "operatorsOwnValueRealization": True}
    artifact = artifact_store.write_json(prefix="platform-phase-two-value-realization-review", artifact_type="platform.phase_two_value_realization_review.report", payload=report, metadata={"rowCount": len(metric_summary)+len(baseline_summary)+len(executive_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "phase-two-value-realization-metadata-only", "source": "python-phase-two-value-realization-review"})
    return _result(job, "platform.phase_two_value_realization_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Phase 2 value realization review is advisory; Python did not publish reports, change roadmap commitments or update financial systems"], [artifact])




def process_platform_stage_closure_certification_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(StageClosureCertificationReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    certification_summary = _phase2_simple_summary(payload.certification_items, "certification-item", blockers, warnings, ("certified",))
    evidence_summary = _phase2_simple_summary(payload.final_evidence, "final-evidence", blockers, warnings, ("validated",))
    signoff_summary = _phase2_simple_summary(payload.signoffs, "signoff", blockers, warnings, ("approved",))
    artifact_decision = _dict_decision(payload.release_artifacts)
    release_artifacts_ready = _as_bool(payload.release_artifacts.get("archived", payload.release_artifacts.get("ready"))) is True and _as_bool(payload.release_artifacts.get("checksumVerified", True)) is not False
    if artifact_decision == "rollback" or (payload.require_release_artifacts and not release_artifacts_ready):
        blockers.append("release artifact packet is missing, failing or not checksum verified")
    elif artifact_decision == "hold":
        warnings.append("release artifact packet requires review")
    risk_summary: list[dict[str, Any]] = []
    open_high = 0
    for idx, item in enumerate(payload.residual_risks):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"risk-{idx}")
        decision = _dict_decision(item)
        severity = str(item.get("severity") or item.get("priority") or "").lower()
        closed = decision == "pass" or _as_bool(item.get("closed", item.get("accepted"))) is True
        if severity in {"critical", "blocker", "sev1", "high"} and not closed:
            open_high += 1
        if decision == "rollback":
            blockers.append(f"residual risk {name} is failing")
        elif decision == "hold" or not closed:
            warnings.append(f"residual risk {name} requires acceptance or closure")
        risk_summary.append({"name": name, "decision": decision or ("pass" if closed else "hold"), "severity": severity or None, "closedOrAccepted": closed})
    if len(certification_summary) < payload.min_certification_item_count:
        blockers.append(f"certification item count {len(certification_summary)} is below required {payload.min_certification_item_count}")
    if len(signoff_summary) < payload.min_signoff_count:
        blockers.append(f"signoff count {len(signoff_summary)} is below required {payload.min_signoff_count}")
    if open_high > payload.max_open_high_risks:
        blockers.append(f"open high residual risk count {open_high} exceeds allowed {payload.max_open_high_risks}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("stage closure certification evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "stage": payload.stage, "phase": payload.phase, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "certificationSummary": certification_summary, "finalEvidenceSummary": evidence_summary, "signoffSummary": signoff_summary, "riskSummary": risk_summary, "releaseArtifacts": {"decision": artifact_decision or ("pass" if release_artifacts_ready else "hold"), "ready": release_artifacts_ready}, "evidenceStatuses": evidence_statuses, "thresholds": {"minCertificationItemCount": payload.min_certification_item_count, "minSignoffCount": payload.min_signoff_count, "maxOpenHighRisks": payload.max_open_high_risks}, "blockers": blockers, "warnings": warnings, "nextActions": ["Archive signed stage-closure certification packet and proceed to post-closure operational transition control." if decision == "pass" else "Resolve certification blockers/warnings before formally closing the migration stage."], "mutatesReleaseCertificationRiskOrTickets": False, "pythonStageClosureCertificationReviewIsAdvisory": True, "operatorsOwnFormalCertification": True}
    artifact = artifact_store.write_json(prefix="platform-stage-closure-certification-review", artifact_type="platform.stage_closure_certification_review.report", payload=report, metadata={"rowCount": len(certification_summary)+len(evidence_summary)+len(signoff_summary)+len(risk_summary), "redactionApplied": True, "piiClass": "stage-closure-certification-metadata-only", "source": "python-stage-closure-certification-review"})
    return _result(job, "platform.stage_closure_certification_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Stage closure certification review is advisory; Python did not certify release, close risks, mutate tickets or publish executive status"], [artifact])


def process_platform_post_closure_operational_transition_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(PostClosureOperationalTransitionReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    transition_summary = _phase2_simple_summary(payload.transition_items, "transition-item", blockers, warnings, ("completed", "ownerAck"))
    support_summary = _phase2_simple_summary(payload.support_readiness, "support-readiness", blockers, warnings, ("ready",))
    kpi_summary = _phase2_simple_summary(payload.kpi_baselines, "kpi-baseline", blockers, warnings, ("baselined",))
    approval_summary = _phase2_simple_summary(payload.approvals, "approval", blockers, warnings, ("approved",))
    monitoring_decision = _dict_decision(payload.monitoring_plan)
    monitoring_ready = _as_bool(payload.monitoring_plan.get("ready", payload.monitoring_plan.get("validated"))) is True
    ownership_decision = _dict_decision(payload.ownership_handoff)
    ownership_ready = _as_bool(payload.ownership_handoff.get("completed", payload.ownership_handoff.get("ownerAck"))) is True or _as_bool(payload.ownership_handoff.get("ownerAck")) is True
    if monitoring_decision == "rollback" or (payload.require_monitoring_plan and not monitoring_ready):
        blockers.append("post-closure monitoring plan is missing or not ready")
    elif monitoring_decision == "hold":
        warnings.append("post-closure monitoring plan requires review")
    if ownership_decision == "rollback" or (payload.require_ownership_handoff and not ownership_ready):
        blockers.append("ownership handoff is missing or incomplete")
    elif ownership_decision == "hold":
        warnings.append("ownership handoff requires review")
    if len(transition_summary) < payload.min_transition_item_count:
        blockers.append(f"transition item count {len(transition_summary)} is below required {payload.min_transition_item_count}")
    if len(support_summary) < payload.min_support_readiness_count:
        blockers.append(f"support readiness count {len(support_summary)} is below required {payload.min_support_readiness_count}")
    if len(approval_summary) < payload.min_approval_count:
        blockers.append(f"approval count {len(approval_summary)} is below required {payload.min_approval_count}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("post-closure operational transition evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "stage": payload.stage, "phase": payload.phase, "domain": payload.domain, "operatingMode": payload.operating_mode, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "transitionSummary": transition_summary, "monitoringPlan": {"decision": monitoring_decision or ("pass" if monitoring_ready else "hold"), "ready": monitoring_ready}, "ownershipHandoff": {"decision": ownership_decision or ("pass" if ownership_ready else "hold"), "ready": ownership_ready}, "supportSummary": support_summary, "kpiSummary": kpi_summary, "approvalSummary": approval_summary, "evidenceStatuses": evidence_statuses, "thresholds": {"minTransitionItemCount": payload.min_transition_item_count, "minSupportReadinessCount": payload.min_support_readiness_count, "minApprovalCount": payload.min_approval_count}, "blockers": blockers, "warnings": warnings, "nextActions": ["Move stage closure into steady-state monitoring and support transition governance." if decision == "pass" else "Resolve post-closure transition blockers/warnings before moving to steady-state operations."], "mutatesOwnershipSupportAlertsOrReleaseState": False, "pythonPostClosureOperationalTransitionReviewIsAdvisory": True, "operatorsOwnPostClosureTransition": True}
    artifact = artifact_store.write_json(prefix="platform-post-closure-operational-transition-review", artifact_type="platform.post_closure_operational_transition_review.report", payload=report, metadata={"rowCount": len(transition_summary)+len(support_summary)+len(kpi_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "post-closure-operational-transition-metadata-only", "source": "python-post-closure-operational-transition-review"})
    return _result(job, "platform.post_closure_operational_transition_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Post-closure operational transition review is advisory; Python did not change ownership, support queues, alerts, roadmap or release state"], [artifact])


def process_platform_post_closure_monitoring_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(PostClosureMonitoringReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    window_summary = _phase2_simple_summary(payload.monitoring_windows, "monitoring-window", blockers, warnings, ("completed",))
    slo_summary = _phase2_simple_summary(payload.slo_signals, "slo-signal", blockers, warnings, ("met",))
    incident_summary = _phase2_simple_summary(payload.incident_signals, "incident-signal", blockers, warnings, tuple())
    adoption_summary = _phase2_simple_summary(payload.adoption_signals, "adoption-signal", blockers, warnings, tuple())
    regression_summary = _phase2_simple_summary(payload.regression_checks, "regression-check", blockers, warnings, ("passed",))
    approval_summary = _phase2_simple_summary(payload.approvals, "approval", blockers, warnings, ("approved",))
    open_incidents = sum(int(_metric_number(item, keys=("openIncidents", "open", "activeIncidents", "incidentCount")) or 0) for item in payload.incident_signals if isinstance(item, dict))
    slo_breaches = sum(int(_metric_number(item, keys=("breaches", "sloBreaches", "errorBudgetBreaches")) or 0) for item in payload.slo_signals if isinstance(item, dict))
    if len(window_summary) < payload.min_monitoring_window_count:
        blockers.append(f"monitoring window count {len(window_summary)} is below required {payload.min_monitoring_window_count}")
    if len(slo_summary) < payload.min_slo_signal_count:
        blockers.append(f"SLO signal count {len(slo_summary)} is below required {payload.min_slo_signal_count}")
    if open_incidents > payload.max_open_incidents:
        blockers.append(f"open incident count {open_incidents} exceeds allowed {payload.max_open_incidents}")
    if slo_breaches > payload.max_slo_breaches:
        blockers.append(f"SLO breach count {slo_breaches} exceeds allowed {payload.max_slo_breaches}")
    if payload.require_regression_checks and not regression_summary:
        blockers.append("post-closure regression checks are required")
    if len(approval_summary) < payload.min_approval_count:
        blockers.append(f"approval count {len(approval_summary)} is below required {payload.min_approval_count}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("post-closure monitoring evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "stage": payload.stage, "phase": payload.phase, "domain": payload.domain, "operatingMode": payload.operating_mode, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "monitoringWindowSummary": window_summary, "sloSummary": slo_summary, "incidentSummary": incident_summary, "adoptionSummary": adoption_summary, "regressionSummary": regression_summary, "approvalSummary": approval_summary, "evidenceStatuses": evidence_statuses, "thresholds": {"minMonitoringWindowCount": payload.min_monitoring_window_count, "minSloSignalCount": payload.min_slo_signal_count, "minApprovalCount": payload.min_approval_count, "maxOpenIncidents": payload.max_open_incidents, "maxSloBreaches": payload.max_slo_breaches}, "observed": {"openIncidents": open_incidents, "sloBreaches": slo_breaches}, "blockers": blockers, "warnings": warnings, "nextActions": ["Proceed to steady-state transfer validation after monitoring remains stable." if decision == "pass" else "Resolve post-closure monitoring blockers/warnings before stable-operations transfer."], "mutatesAlertsTrafficSupportOrReleaseState": False, "pythonPostClosureMonitoringReviewIsAdvisory": True, "operatorsOwnPostClosureMonitoring": True}
    artifact = artifact_store.write_json(prefix="platform-post-closure-monitoring-review", artifact_type="platform.post_closure_monitoring_review.report", payload=report, metadata={"rowCount": len(window_summary)+len(slo_summary)+len(incident_summary)+len(adoption_summary)+len(regression_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "post-closure-monitoring-metadata-only", "source": "python-post-closure-monitoring-review"})
    return _result(job, "platform.post_closure_monitoring_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Post-closure monitoring review is advisory; Python did not change alerts, traffic, support queues, operating mode or release state"], [artifact])


def process_platform_steady_state_transfer_validation_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(SteadyStateTransferValidationReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    transfer_summary = _phase2_simple_summary(payload.transfer_items, "transfer-item", blockers, warnings, ("completed", "ownerAck"))
    owner_summary = _phase2_simple_summary(payload.ownership_matrix, "ownership-entry", blockers, warnings, ("ownerAck",))
    runbook_summary = _phase2_simple_summary(payload.runbook_coverage, "runbook", blockers, warnings, ("published",))
    monitoring_summary = _phase2_simple_summary(payload.monitoring_readiness, "monitoring-readiness", blockers, warnings, ("ready",))
    knowledge_summary = _phase2_simple_summary(payload.knowledge_transfer, "knowledge-transfer", blockers, warnings, ("completed",))
    approval_summary = _phase2_simple_summary(payload.approvals, "approval", blockers, warnings, ("approved",))
    support_decision = _dict_decision(payload.support_model)
    support_ready = _as_bool(payload.support_model.get("ready", payload.support_model.get("ownerAck"))) is True or support_decision == "pass"
    if len(transfer_summary) < payload.min_transfer_item_count:
        blockers.append(f"transfer item count {len(transfer_summary)} is below required {payload.min_transfer_item_count}")
    if len(owner_summary) < payload.min_owner_ack_count:
        blockers.append(f"ownership acknowledgement count {len(owner_summary)} is below required {payload.min_owner_ack_count}")
    if len(runbook_summary) < payload.min_runbook_count:
        blockers.append(f"runbook coverage count {len(runbook_summary)} is below required {payload.min_runbook_count}")
    if len(monitoring_summary) < payload.min_monitoring_readiness_count:
        blockers.append(f"monitoring readiness count {len(monitoring_summary)} is below required {payload.min_monitoring_readiness_count}")
    if len(approval_summary) < payload.min_approval_count:
        blockers.append(f"approval count {len(approval_summary)} is below required {payload.min_approval_count}")
    if support_decision == "rollback" or (payload.require_support_model and not support_ready):
        blockers.append("steady-state support model is missing or not ready")
    elif support_decision == "hold":
        warnings.append("steady-state support model requires review")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("steady-state transfer evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "stage": payload.stage, "phase": payload.phase, "targetState": payload.target_state, "domain": payload.domain, "operatingMode": payload.operating_mode, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "transferSummary": transfer_summary, "ownershipSummary": owner_summary, "runbookSummary": runbook_summary, "monitoringSummary": monitoring_summary, "knowledgeTransferSummary": knowledge_summary, "supportModel": {"decision": support_decision or ("pass" if support_ready else "hold"), "ready": support_ready}, "approvalSummary": approval_summary, "evidenceStatuses": evidence_statuses, "thresholds": {"minTransferItemCount": payload.min_transfer_item_count, "minOwnerAckCount": payload.min_owner_ack_count, "minRunbookCount": payload.min_runbook_count, "minMonitoringReadinessCount": payload.min_monitoring_readiness_count, "minApprovalCount": payload.min_approval_count}, "blockers": blockers, "warnings": warnings, "nextActions": ["Accept stable operations transfer through operator-owned governance." if decision == "pass" else "Resolve transfer validation blockers/warnings before declaring stable operations."], "mutatesOwnershipSupportRunbooksOrStatus": False, "pythonSteadyStateTransferValidationReviewIsAdvisory": True, "operatorsOwnSteadyStateTransfer": True}
    artifact = artifact_store.write_json(prefix="platform-steady-state-transfer-validation-review", artifact_type="platform.steady_state_transfer_validation_review.report", payload=report, metadata={"rowCount": len(transfer_summary)+len(owner_summary)+len(runbook_summary)+len(monitoring_summary)+len(knowledge_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "steady-state-transfer-validation-metadata-only", "source": "python-steady-state-transfer-validation-review"})
    return _result(job, "platform.steady_state_transfer_validation_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Steady-state transfer validation review is advisory; Python did not reassign owners, mutate support queues, publish runbooks or change operating status"], [artifact])



def process_platform_steady_state_operational_assurance_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(SteadyStateOperationalAssuranceReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    metric_summary = _phase2_simple_summary(payload.operational_metrics, "operational-metric", blockers, warnings, ("met", "healthy"))
    slo_summary = _phase2_simple_summary(payload.slo_health, "slo-health", blockers, warnings, ("met", "healthy"))
    incident_summary = _phase2_simple_summary(payload.incident_trends, "incident-trend", blockers, warnings, tuple())
    support_summary = _phase2_simple_summary(payload.support_queues, "support-queue", blockers, warnings, tuple())
    runbook_summary = _phase2_simple_summary(payload.runbook_audits, "runbook-audit", blockers, warnings, ("fresh", "published", "validated"))
    ownership_summary = _phase2_simple_summary(payload.ownership_reviews, "ownership-review", blockers, warnings, ("ownerAck", "accepted", "approved"))
    approval_summary = _phase2_simple_summary(payload.approvals, "approval", blockers, warnings, ("approved",))
    open_sev1 = 0
    for item in payload.incident_trends:
        if not isinstance(item, dict):
            continue
        severity = str(item.get("severity") or item.get("priority") or item.get("name") or "").lower()
        open_count = int(_metric_number(item, keys=("openIncidents", "open", "activeIncidents", "incidentCount")) or 0)
        if severity in {"sev1", "critical", "blocker", "p0"}:
            open_sev1 += open_count
    overdue_support = sum(int(_metric_number(item, keys=("overdueItems", "overdue", "breachedSla", "slaBreaches")) or 0) for item in payload.support_queues if isinstance(item, dict))
    slo_breaches = sum(int(_metric_number(item, keys=("breaches", "sloBreaches", "errorBudgetBreaches")) or 0) for item in payload.slo_health if isinstance(item, dict))
    if len(metric_summary) < payload.min_operational_metric_count:
        blockers.append(f"operational metric count {len(metric_summary)} is below required {payload.min_operational_metric_count}")
    if len(slo_summary) < payload.min_slo_health_count:
        blockers.append(f"SLO health count {len(slo_summary)} is below required {payload.min_slo_health_count}")
    if open_sev1 > payload.max_open_sev1_incidents:
        blockers.append(f"open Sev1/critical incident count {open_sev1} exceeds allowed {payload.max_open_sev1_incidents}")
    if overdue_support > payload.max_overdue_support_items:
        blockers.append(f"overdue support item count {overdue_support} exceeds allowed {payload.max_overdue_support_items}")
    if len(runbook_summary) < payload.min_runbook_audit_count:
        blockers.append(f"runbook audit count {len(runbook_summary)} is below required {payload.min_runbook_audit_count}")
    if len(ownership_summary) < payload.min_ownership_review_count:
        blockers.append(f"ownership review count {len(ownership_summary)} is below required {payload.min_ownership_review_count}")
    if len(approval_summary) < payload.min_approval_count:
        blockers.append(f"approval count {len(approval_summary)} is below required {payload.min_approval_count}")
    if slo_breaches > 0:
        warnings.append(f"SLO breach count observed during assurance review: {slo_breaches}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("steady-state operational assurance evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "stage": payload.stage, "phase": payload.phase, "targetState": payload.target_state, "domain": payload.domain, "operatingMode": payload.operating_mode, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "operationalMetricSummary": metric_summary, "sloHealthSummary": slo_summary, "incidentTrendSummary": incident_summary, "supportQueueSummary": support_summary, "runbookAuditSummary": runbook_summary, "ownershipReviewSummary": ownership_summary, "approvalSummary": approval_summary, "evidenceStatuses": evidence_statuses, "observed": {"openSev1Incidents": open_sev1, "overdueSupportItems": overdue_support, "sloBreaches": slo_breaches}, "thresholds": {"minOperationalMetricCount": payload.min_operational_metric_count, "minSloHealthCount": payload.min_slo_health_count, "maxOpenSev1Incidents": payload.max_open_sev1_incidents, "maxOverdueSupportItems": payload.max_overdue_support_items, "minRunbookAuditCount": payload.min_runbook_audit_count, "minOwnershipReviewCount": payload.min_ownership_review_count, "minApprovalCount": payload.min_approval_count}, "blockers": blockers, "warnings": warnings, "nextActions": ["Move steady-state operation into recurring continuous-improvement governance." if decision == "pass" else "Resolve operational assurance blockers/warnings before accepting stable recurring operations."], "mutatesSloAlertSupportStaffingOrStatus": False, "pythonSteadyStateOperationalAssuranceReviewIsAdvisory": True, "operatorsOwnSteadyStateAssurance": True}
    artifact = artifact_store.write_json(prefix="platform-steady-state-operational-assurance-review", artifact_type="platform.steady_state_operational_assurance_review.report", payload=report, metadata={"rowCount": len(metric_summary)+len(slo_summary)+len(incident_summary)+len(support_summary)+len(runbook_summary)+len(ownership_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "steady-state-operational-assurance-metadata-only", "source": "python-steady-state-operational-assurance-review"})
    return _result(job, "platform.steady_state_operational_assurance_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Steady-state operational assurance review is advisory; Python did not mutate SLOs, alert policies, support queues, staffing plans or operating status"], [artifact])


def process_platform_continuous_improvement_backlog_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(ContinuousImprovementBacklogReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    improvement_summary = _phase2_simple_summary(payload.improvement_items, "improvement-item", blockers, warnings, ("prioritized", "accepted", "ready"))
    value_summary = _phase2_simple_summary(payload.value_hypotheses, "value-hypothesis", blockers, warnings, ("validated", "accepted"))
    tech_debt_summary = _phase2_simple_summary(payload.technical_debt_items, "technical-debt-item", blockers, warnings, ("accepted", "planned"))
    owner_summary = _phase2_simple_summary(payload.owner_commitments, "owner-commitment", blockers, warnings, ("ownerAck", "committed"))
    governance_summary = _phase2_simple_summary(payload.governance_reviews, "governance-review", blockers, warnings, ("approved", "completed"))
    approval_summary = _phase2_simple_summary(payload.approvals, "approval", blockers, warnings, ("approved",))
    risk_summary: list[dict[str, Any]] = []
    open_high = 0
    for idx, item in enumerate(payload.risk_items):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"risk-item-{idx}")
        decision = _dict_decision(item)
        severity = str(item.get("severity") or item.get("priority") or "").lower()
        closed = decision == "pass" or _as_bool(item.get("closed", item.get("accepted", item.get("mitigated")))) is True
        if severity in {"high", "critical", "blocker", "sev1"} and not closed:
            open_high += 1
        if decision == "rollback":
            blockers.append(f"risk item {name} is failing")
        elif decision == "hold" or not closed:
            warnings.append(f"risk item {name} requires owner acceptance or mitigation")
        risk_summary.append({"name": name, "decision": decision or ("pass" if closed else "hold"), "severity": severity or None, "closedOrAccepted": closed})
    if len(improvement_summary) < payload.min_improvement_item_count:
        blockers.append(f"improvement item count {len(improvement_summary)} is below required {payload.min_improvement_item_count}")
    if payload.require_value_hypotheses and not value_summary:
        blockers.append("value hypotheses are required for continuous-improvement backlog acceptance")
    if len(owner_summary) < payload.min_owner_commitment_count:
        blockers.append(f"owner commitment count {len(owner_summary)} is below required {payload.min_owner_commitment_count}")
    if open_high > payload.max_open_high_risks:
        blockers.append(f"open high/critical risk count {open_high} exceeds allowed {payload.max_open_high_risks}")
    if len(governance_summary) < payload.min_governance_review_count:
        blockers.append(f"governance review count {len(governance_summary)} is below required {payload.min_governance_review_count}")
    if len(approval_summary) < payload.min_approval_count:
        blockers.append(f"approval count {len(approval_summary)} is below required {payload.min_approval_count}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("continuous-improvement backlog evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "stage": payload.stage, "phase": payload.phase, "domain": payload.domain, "operatingMode": payload.operating_mode, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "improvementSummary": improvement_summary, "valueHypothesisSummary": value_summary, "technicalDebtSummary": tech_debt_summary, "riskSummary": risk_summary, "ownerCommitmentSummary": owner_summary, "governanceReviewSummary": governance_summary, "approvalSummary": approval_summary, "evidenceStatuses": evidence_statuses, "thresholds": {"minImprovementItemCount": payload.min_improvement_item_count, "minOwnerCommitmentCount": payload.min_owner_commitment_count, "maxOpenHighRisks": payload.max_open_high_risks, "minGovernanceReviewCount": payload.min_governance_review_count, "minApprovalCount": payload.min_approval_count}, "blockers": blockers, "warnings": warnings, "nextActions": ["Accept continuous-improvement backlog into recurring operator-owned roadmap governance." if decision == "pass" else "Resolve continuous-improvement backlog blockers/warnings before roadmap governance acceptance."], "mutatesTicketsRoadmapBudgetOwnersOrRisks": False, "pythonContinuousImprovementBacklogReviewIsAdvisory": True, "operatorsOwnContinuousImprovementBacklog": True}
    artifact = artifact_store.write_json(prefix="platform-continuous-improvement-backlog-review", artifact_type="platform.continuous_improvement_backlog_review.report", payload=report, metadata={"rowCount": len(improvement_summary)+len(value_summary)+len(tech_debt_summary)+len(risk_summary)+len(owner_summary)+len(governance_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "continuous-improvement-backlog-metadata-only", "source": "python-continuous-improvement-backlog-review"})
    return _result(job, "platform.continuous_improvement_backlog_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Continuous-improvement backlog review is advisory; Python did not mutate tickets, roadmap, budget, owner assignments or risk acceptance"], [artifact])


def process_platform_stable_operations_optimization_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(StableOperationsOptimizationReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    optimization_summary = _phase2_simple_summary(payload.optimization_metrics, "optimization-metric", blockers, warnings, ("met", "healthy", "accepted"))
    cost_summary = _phase2_simple_summary(payload.cost_signals, "cost-signal", blockers, warnings, ("healthy", "met", "accepted"))
    reliability_summary = _phase2_simple_summary(payload.reliability_signals, "reliability-signal", blockers, warnings, ("healthy", "met", "stable"))
    automation_summary = _phase2_simple_summary(payload.automation_opportunities, "automation-opportunity", blockers, warnings, ("ready", "accepted", "approved"))
    guardrail_summary = _phase2_simple_summary(payload.guardrail_reviews, "guardrail-review", blockers, warnings, ("approved", "passed", "met"))
    approval_summary = _phase2_simple_summary(payload.approvals, "approval", blockers, warnings, ("approved",))
    debt_summary: list[dict[str, Any]] = []
    open_critical_debt = 0
    for idx, item in enumerate(payload.debt_items):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"debt-item-{idx}")
        decision = _dict_decision(item)
        severity = str(item.get("severity") or item.get("priority") or "").lower()
        closed = decision == "pass" or _as_bool(item.get("closed", item.get("accepted", item.get("planned")))) is True
        if severity in {"critical", "blocker", "sev1", "high"} and not closed:
            open_critical_debt += 1
        if decision == "rollback":
            blockers.append(f"debt item {name} is failing")
        elif decision == "hold" or not closed:
            warnings.append(f"debt item {name} requires owner acceptance, planning or closure")
        debt_summary.append({"name": name, "decision": decision or ("pass" if closed else "hold"), "severity": severity or None, "closedOrAccepted": closed})
    if len(optimization_summary) < payload.min_optimization_metric_count:
        blockers.append(f"optimization metric count {len(optimization_summary)} is below required {payload.min_optimization_metric_count}")
    if len(guardrail_summary) < payload.min_guardrail_review_count:
        blockers.append(f"guardrail review count {len(guardrail_summary)} is below required {payload.min_guardrail_review_count}")
    if open_critical_debt > payload.max_open_critical_debt:
        blockers.append(f"open critical/high debt count {open_critical_debt} exceeds allowed {payload.max_open_critical_debt}")
    if len(approval_summary) < payload.min_approval_count:
        blockers.append(f"approval count {len(approval_summary)} is below required {payload.min_approval_count}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("stable-operations optimization evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "stage": payload.stage, "phase": payload.phase, "domain": payload.domain, "operatingMode": payload.operating_mode, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "optimizationMetricSummary": optimization_summary, "costSignalSummary": cost_summary, "reliabilitySignalSummary": reliability_summary, "automationOpportunitySummary": automation_summary, "debtSummary": debt_summary, "guardrailReviewSummary": guardrail_summary, "approvalSummary": approval_summary, "evidenceStatuses": evidence_statuses, "observed": {"openCriticalDebt": open_critical_debt}, "thresholds": {"minOptimizationMetricCount": payload.min_optimization_metric_count, "minGuardrailReviewCount": payload.min_guardrail_review_count, "maxOpenCriticalDebt": payload.max_open_critical_debt, "minApprovalCount": payload.min_approval_count}, "blockers": blockers, "warnings": warnings, "nextActions": ["Accept operator-owned optimization candidates into recurring maintenance and improvement governance." if decision == "pass" else "Resolve optimization blockers/warnings before applying stable-operation changes."], "mutatesTicketsBudgetsAutomationInfraSloAlertsOrRisks": False, "pythonStableOperationsOptimizationReviewIsAdvisory": True, "operatorsOwnStableOperationsOptimization": True}
    artifact = artifact_store.write_json(prefix="platform-stable-operations-optimization-review", artifact_type="platform.stable_operations_optimization_review.report", payload=report, metadata={"rowCount": len(optimization_summary)+len(cost_summary)+len(reliability_summary)+len(automation_summary)+len(debt_summary)+len(guardrail_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "stable-operations-optimization-metadata-only", "source": "python-stable-operations-optimization-review"})
    return _result(job, "platform.stable_operations_optimization_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Stable-operations optimization review is advisory; Python did not mutate tickets, budgets, automation, infrastructure, SLOs, alerts or risk records"], [artifact])


def process_platform_recurring_maintenance_cycle_readiness_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(RecurringMaintenanceCycleReadinessReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    window_summary = _phase2_simple_summary(payload.maintenance_windows, "maintenance-window", blockers, warnings, ("approved", "scheduled", "ready"))
    runbook_summary = _phase2_simple_summary(payload.runbook_schedule, "runbook-schedule", blockers, warnings, ("scheduled", "ready", "approved"))
    owner_summary = _phase2_simple_summary(payload.owner_roster, "owner", blockers, warnings, ("ownerAck", "ready", "accepted"))
    approval_summary = _phase2_simple_summary(payload.approvals, "approval", blockers, warnings, ("approved",))
    patch_decision = _dict_decision(payload.patch_cadence)
    dependency_decision = _dict_decision(payload.dependency_update_plan)
    backup_decision = _dict_decision(payload.backup_validation)
    if len(window_summary) < payload.min_maintenance_window_count:
        blockers.append(f"maintenance window count {len(window_summary)} is below required {payload.min_maintenance_window_count}")
    if len(owner_summary) < payload.min_owner_count:
        blockers.append(f"owner roster count {len(owner_summary)} is below required {payload.min_owner_count}")
    if len(approval_summary) < payload.min_approval_count:
        blockers.append(f"approval count {len(approval_summary)} is below required {payload.min_approval_count}")
    if payload.require_patch_cadence and (not payload.patch_cadence or patch_decision in {"rollback", "hold"}):
        (blockers if patch_decision == "rollback" or not payload.patch_cadence else warnings).append("patch cadence requires passing evidence")
    if dependency_decision == "rollback":
        blockers.append("dependency update plan is failing")
    elif dependency_decision == "hold":
        warnings.append("dependency update plan requires review")
    if payload.require_backup_validation and (not payload.backup_validation or backup_decision in {"rollback", "hold"}):
        (blockers if backup_decision == "rollback" or not payload.backup_validation else warnings).append("backup validation requires passing evidence")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("recurring-maintenance readiness evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "stage": payload.stage, "phase": payload.phase, "targetCycle": payload.target_cycle, "domain": payload.domain, "operatingMode": payload.operating_mode, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "maintenanceWindowSummary": window_summary, "patchCadenceDecision": patch_decision or ("pass" if payload.patch_cadence else "hold"), "dependencyUpdatePlanDecision": dependency_decision or ("pass" if payload.dependency_update_plan else "hold"), "backupValidationDecision": backup_decision or ("pass" if payload.backup_validation else "hold"), "runbookScheduleSummary": runbook_summary, "ownerRosterSummary": owner_summary, "approvalSummary": approval_summary, "evidenceStatuses": evidence_statuses, "thresholds": {"minMaintenanceWindowCount": payload.min_maintenance_window_count, "minOwnerCount": payload.min_owner_count, "minApprovalCount": payload.min_approval_count}, "blockers": blockers, "warnings": warnings, "nextActions": ["Start the recurring operator-owned maintenance cadence with optimization backlog governance." if decision == "pass" else "Resolve recurring-maintenance blockers/warnings before entering regular maintenance cadence."], "mutatesCalendarsPatchesDependenciesBackupsSecretsOrOwners": False, "pythonRecurringMaintenanceCycleReadinessReviewIsAdvisory": True, "operatorsOwnRecurringMaintenanceCycle": True}
    artifact = artifact_store.write_json(prefix="platform-recurring-maintenance-cycle-readiness-review", artifact_type="platform.recurring_maintenance_cycle_readiness_review.report", payload=report, metadata={"rowCount": len(window_summary)+len(runbook_summary)+len(owner_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "recurring-maintenance-cycle-readiness-metadata-only", "source": "python-recurring-maintenance-cycle-readiness-review"})
    return _result(job, "platform.recurring_maintenance_cycle_readiness_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Recurring-maintenance readiness review is advisory; Python did not schedule calendars, execute patches, upgrade dependencies, run backups, rotate secrets or change owner assignments"], [artifact])


def _maintenance_item_failed(item: dict[str, Any]) -> bool:
    decision = _dict_decision(item)
    status = str(item.get("status") or item.get("state") or item.get("result") or "").lower()
    severity = str(item.get("severity") or item.get("priority") or "").lower()
    explicit_failed = decision == "rollback" or status in {"failed", "failure", "rollback", "blocked"}
    critical = severity in {"critical", "blocker", "sev1", "high"}
    return explicit_failed and critical


def process_platform_maintenance_cycle_execution_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(MaintenanceCycleExecutionReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    execution_summary = _phase2_simple_summary(payload.execution_items, "execution-item", blockers, warnings, ("completed", "passed", "executed", "done"))
    patch_summary = _phase2_simple_summary(payload.patch_results, "patch-result", blockers, warnings, ("completed", "passed", "applied", "verified"))
    dependency_summary = _phase2_simple_summary(payload.dependency_results, "dependency-result", blockers, warnings, ("completed", "passed", "updated", "verified"))
    backup_summary = _phase2_simple_summary(payload.backup_results, "backup-result", blockers, warnings, ("completed", "validated", "passed"))
    validation_summary = _phase2_simple_summary(payload.validation_results, "validation-result", blockers, warnings, ("completed", "validated", "passed"))
    communication_summary = _phase2_simple_summary(payload.communications, "communication", blockers, warnings, ("sent", "completed", "acknowledged"))
    approval_summary = _phase2_simple_summary(payload.approvals, "approval", blockers, warnings, ("approved",))
    failed_critical = sum(1 for item in (payload.execution_items + payload.patch_results + payload.dependency_results + payload.backup_results + payload.validation_results) if isinstance(item, dict) and _maintenance_item_failed(item))
    rollback_decision = _dict_decision(payload.rollback_readiness)
    if len(execution_summary) < payload.min_execution_item_count:
        blockers.append(f"execution item count {len(execution_summary)} is below required {payload.min_execution_item_count}")
    if len(validation_summary) < payload.min_validation_result_count:
        blockers.append(f"validation result count {len(validation_summary)} is below required {payload.min_validation_result_count}")
    if failed_critical > payload.max_failed_critical_items:
        blockers.append(f"failed critical/high maintenance item count {failed_critical} exceeds allowed {payload.max_failed_critical_items}")
    if payload.require_backup_results and not backup_summary:
        blockers.append("backup validation results are required for maintenance execution acceptance")
    if rollback_decision == "rollback":
        blockers.append("rollback readiness is failing")
    elif rollback_decision == "hold" or not payload.rollback_readiness:
        warnings.append("rollback readiness requires review")
    if len(approval_summary) < payload.min_approval_count:
        blockers.append(f"approval count {len(approval_summary)} is below required {payload.min_approval_count}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("maintenance-cycle execution evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "stage": payload.stage, "phase": payload.phase, "cycleId": payload.cycle_id, "domain": payload.domain, "operatingMode": payload.operating_mode, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "executionSummary": execution_summary, "patchResultSummary": patch_summary, "dependencyResultSummary": dependency_summary, "backupResultSummary": backup_summary, "validationResultSummary": validation_summary, "rollbackReadinessDecision": rollback_decision or ("pass" if payload.rollback_readiness else "hold"), "communicationSummary": communication_summary, "approvalSummary": approval_summary, "evidenceStatuses": evidence_statuses, "observed": {"failedCriticalItems": failed_critical}, "thresholds": {"minExecutionItemCount": payload.min_execution_item_count, "minValidationResultCount": payload.min_validation_result_count, "maxFailedCriticalItems": payload.max_failed_critical_items, "minApprovalCount": payload.min_approval_count}, "blockers": blockers, "warnings": warnings, "nextActions": ["Archive maintenance execution evidence and continue recurring operator-owned maintenance cadence." if decision == "pass" else "Resolve maintenance execution blockers/warnings before accepting the maintenance cycle."], "mutatesPatchesDependenciesBackupsCalendarsSecretsTicketsOrOwners": False, "pythonMaintenanceCycleExecutionReviewIsAdvisory": True, "operatorsOwnMaintenanceCycleExecution": True}
    artifact = artifact_store.write_json(prefix="platform-maintenance-cycle-execution-review", artifact_type="platform.maintenance_cycle_execution_review.report", payload=report, metadata={"rowCount": len(execution_summary)+len(patch_summary)+len(dependency_summary)+len(backup_summary)+len(validation_summary)+len(communication_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "maintenance-cycle-execution-metadata-only", "source": "python-maintenance-cycle-execution-review"})
    return _result(job, "platform.maintenance_cycle_execution_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Maintenance-cycle execution review is advisory; Python did not execute patches, update dependencies, run backups, schedule calendars, rotate secrets, mutate tickets or change owners"], [artifact])


def process_platform_long_term_operability_sustainability_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(LongTermOperabilitySustainabilityReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    sustainability_summary = _phase2_simple_summary(payload.sustainability_metrics, "sustainability-metric", blockers, warnings, ("met", "healthy", "stable"))
    ownership_summary = _phase2_simple_summary(payload.ownership_signals, "ownership-signal", blockers, warnings, ("ownerAck", "healthy", "accepted"))
    knowledge_summary = _phase2_simple_summary(payload.knowledge_base_reviews, "knowledge-base-review", blockers, warnings, ("current", "reviewed", "approved"))
    budget_summary = _phase2_simple_summary(payload.budget_signals, "budget-signal", blockers, warnings, ("healthy", "approved", "withinBudget"))
    approval_summary = _phase2_simple_summary(payload.approvals, "approval", blockers, warnings, ("approved",))
    dependency_decision = _dict_decision(payload.dependency_lifecycle)
    improvement_decision = _dict_decision(payload.improvement_cadence)
    risk_summary: list[dict[str, Any]] = []
    open_high = 0
    for idx, item in enumerate(payload.risk_acceptances):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"risk-acceptance-{idx}")
        decision = _dict_decision(item)
        severity = str(item.get("severity") or item.get("priority") or "").lower()
        accepted = decision == "pass" or _as_bool(item.get("accepted", item.get("closed", item.get("mitigated")))) is True
        if severity in {"critical", "blocker", "sev1", "high"} and not accepted:
            open_high += 1
        if decision == "rollback":
            blockers.append(f"risk acceptance {name} is failing")
        elif decision == "hold" or not accepted:
            warnings.append(f"risk acceptance {name} requires owner acceptance or mitigation")
        risk_summary.append({"name": name, "decision": decision or ("pass" if accepted else "hold"), "severity": severity or None, "acceptedOrClosed": accepted})
    if len(sustainability_summary) < payload.min_sustainability_metric_count:
        blockers.append(f"sustainability metric count {len(sustainability_summary)} is below required {payload.min_sustainability_metric_count}")
    if len(ownership_summary) < payload.min_ownership_signal_count:
        blockers.append(f"ownership signal count {len(ownership_summary)} is below required {payload.min_ownership_signal_count}")
    if len(knowledge_summary) < payload.min_knowledge_review_count:
        blockers.append(f"knowledge-base review count {len(knowledge_summary)} is below required {payload.min_knowledge_review_count}")
    if open_high > payload.max_open_high_risks:
        blockers.append(f"open high/critical long-term risk count {open_high} exceeds allowed {payload.max_open_high_risks}")
    if dependency_decision == "rollback":
        blockers.append("dependency lifecycle is failing")
    elif dependency_decision == "hold" or not payload.dependency_lifecycle:
        warnings.append("dependency lifecycle requires review")
    if improvement_decision == "rollback":
        blockers.append("improvement cadence is failing")
    elif improvement_decision == "hold" or not payload.improvement_cadence:
        warnings.append("improvement cadence requires review")
    if len(approval_summary) < payload.min_approval_count:
        blockers.append(f"approval count {len(approval_summary)} is below required {payload.min_approval_count}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("long-term operability sustainability evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "stage": payload.stage, "phase": payload.phase, "horizon": payload.horizon, "domain": payload.domain, "operatingMode": payload.operating_mode, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "sustainabilityMetricSummary": sustainability_summary, "ownershipSignalSummary": ownership_summary, "knowledgeBaseReviewSummary": knowledge_summary, "dependencyLifecycleDecision": dependency_decision or ("pass" if payload.dependency_lifecycle else "hold"), "budgetSignalSummary": budget_summary, "riskAcceptanceSummary": risk_summary, "improvementCadenceDecision": improvement_decision or ("pass" if payload.improvement_cadence else "hold"), "approvalSummary": approval_summary, "evidenceStatuses": evidence_statuses, "observed": {"openHighRisks": open_high}, "thresholds": {"minSustainabilityMetricCount": payload.min_sustainability_metric_count, "minOwnershipSignalCount": payload.min_ownership_signal_count, "minKnowledgeReviewCount": payload.min_knowledge_review_count, "maxOpenHighRisks": payload.max_open_high_risks, "minApprovalCount": payload.min_approval_count}, "blockers": blockers, "warnings": warnings, "nextActions": ["Accept long-term operability package into quarterly sustainability governance." if decision == "pass" else "Resolve long-term operability blockers/warnings before declaring sustainability steady-state."], "mutatesBudgetsOwnersRoadmapDependenciesKnowledgeBaseOrRisks": False, "pythonLongTermOperabilitySustainabilityReviewIsAdvisory": True, "operatorsOwnLongTermSustainability": True}
    artifact = artifact_store.write_json(prefix="platform-long-term-operability-sustainability-review", artifact_type="platform.long_term_operability_sustainability_review.report", payload=report, metadata={"rowCount": len(sustainability_summary)+len(ownership_summary)+len(knowledge_summary)+len(budget_summary)+len(risk_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "long-term-operability-sustainability-metadata-only", "source": "python-long-term-operability-sustainability-review"})
    return _result(job, "platform.long_term_operability_sustainability_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Long-term operability sustainability review is advisory; Python did not mutate budgets, owners, roadmap, dependencies, knowledge base articles or risk records"], [artifact])


def process_platform_recurring_operational_maturity_audit_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(RecurringOperationalMaturityAuditReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    maturity_summary = _phase2_simple_summary(payload.maturity_dimensions, "maturity-dimension", blockers, warnings, ("met", "healthy", "accepted"))
    control_summary = _phase2_simple_summary(payload.control_checks, "control-check", blockers, warnings, ("passed", "met", "approved"))
    learning_summary = _phase2_simple_summary(payload.incident_learnings, "incident-learning", blockers, warnings, ("closed", "learned", "accepted"))
    support_summary = _phase2_simple_summary(payload.support_signals, "support-signal", blockers, warnings, ("healthy", "met", "stable"))
    operator_evidence_summary = _phase2_simple_summary(payload.operator_evidence, "operator-evidence", blockers, warnings, ("complete", "validated", "approved"))
    approval_summary = _phase2_simple_summary(payload.approvals, "approval", blockers, warnings, ("approved",))
    risk_summary: list[dict[str, Any]] = []
    open_high = 0
    low_maturity = 0
    for item in payload.maturity_dimensions:
        if isinstance(item, dict):
            score = item.get("score", item.get("maturityScore"))
            try:
                score_float = float(score)
            except (TypeError, ValueError):
                score_float = None
            if score_float is not None and score_float < 0.75:
                low_maturity += 1
                warnings.append(f"maturity dimension {_metadata_name(item, 'maturity-dimension')} score is below 0.75")
    for idx, item in enumerate(payload.risks):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"risk-{idx}")
        decision = _dict_decision(item)
        severity = str(item.get("severity") or item.get("priority") or "").lower()
        accepted = decision == "pass" or _as_bool(item.get("accepted", item.get("closed", item.get("mitigated")))) is True
        if severity in {"critical", "blocker", "sev1", "high"} and not accepted:
            open_high += 1
        if decision == "rollback":
            blockers.append(f"operational maturity risk {name} is failing")
        elif decision == "hold" or not accepted:
            warnings.append(f"operational maturity risk {name} requires owner acceptance or mitigation")
        risk_summary.append({"name": name, "decision": decision or ("pass" if accepted else "hold"), "severity": severity or None, "acceptedOrClosed": accepted})
    if len(maturity_summary) < payload.min_maturity_dimension_count:
        blockers.append(f"maturity dimension count {len(maturity_summary)} is below required {payload.min_maturity_dimension_count}")
    if len(control_summary) < payload.min_control_check_count:
        blockers.append(f"control check count {len(control_summary)} is below required {payload.min_control_check_count}")
    if len(operator_evidence_summary) < payload.min_operator_evidence_count:
        blockers.append(f"operator evidence count {len(operator_evidence_summary)} is below required {payload.min_operator_evidence_count}")
    if open_high > payload.max_open_high_risks:
        blockers.append(f"open high/critical operational maturity risk count {open_high} exceeds allowed {payload.max_open_high_risks}")
    if len(approval_summary) < payload.min_approval_count:
        blockers.append(f"approval count {len(approval_summary)} is below required {payload.min_approval_count}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("recurring operational maturity audit evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "stage": payload.stage, "phase": payload.phase, "auditCycle": payload.audit_cycle, "domain": payload.domain, "operatingMode": payload.operating_mode, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "maturityDimensionSummary": maturity_summary, "controlCheckSummary": control_summary, "incidentLearningSummary": learning_summary, "supportSignalSummary": support_summary, "operatorEvidenceSummary": operator_evidence_summary, "riskSummary": risk_summary, "approvalSummary": approval_summary, "evidenceStatuses": evidence_statuses, "observed": {"openHighRisks": open_high, "lowMaturityDimensions": low_maturity}, "thresholds": {"minMaturityDimensionCount": payload.min_maturity_dimension_count, "minControlCheckCount": payload.min_control_check_count, "minOperatorEvidenceCount": payload.min_operator_evidence_count, "maxOpenHighRisks": payload.max_open_high_risks, "minApprovalCount": payload.min_approval_count}, "blockers": blockers, "warnings": warnings, "nextActions": ["Accept recurring operational maturity audit into steady-state governance." if decision == "pass" else "Resolve operational maturity blockers/warnings before governance acceptance."], "mutatesMaturityRisksTicketsOwnersRoadmapsControlsOrSupportQueues": False, "pythonRecurringOperationalMaturityAuditReviewIsAdvisory": True, "operatorsOwnOperationalMaturityGovernance": True}
    artifact = artifact_store.write_json(prefix="platform-recurring-operational-maturity-audit-review", artifact_type="platform.recurring_operational_maturity_audit_review.report", payload=report, metadata={"rowCount": len(maturity_summary)+len(control_summary)+len(learning_summary)+len(support_summary)+len(operator_evidence_summary)+len(risk_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "recurring-operational-maturity-audit-metadata-only", "source": "python-recurring-operational-maturity-audit-review"})
    return _result(job, "platform.recurring_operational_maturity_audit_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Recurring operational maturity audit review is advisory; Python did not mutate maturity scores, risks, tickets, owners, roadmaps, controls or support queues"], [artifact])


def process_platform_stable_state_continuity_control_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(StableStateContinuityControlReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    continuity_summary = _phase2_simple_summary(payload.continuity_controls, "continuity-control", blockers, warnings, ("passed", "met", "approved"))
    dr_summary = _phase2_simple_summary(payload.dr_signals, "dr-signal", blockers, warnings, ("validated", "passed", "ready"))
    dependency_summary = _phase2_simple_summary(payload.dependency_continuity, "dependency-continuity", blockers, warnings, ("healthy", "ready", "met"))
    fallback_summary = _phase2_simple_summary(payload.operational_fallbacks, "operational-fallback", blockers, warnings, ("ready", "validated", "approved"))
    communication_summary = _phase2_simple_summary(payload.communication_checks, "communication-check", blockers, warnings, ("approved", "tested", "ready"))
    approval_summary = _phase2_simple_summary(payload.approvals, "approval", blockers, warnings, ("approved",))
    risk_summary: list[dict[str, Any]] = []
    open_high = 0
    for idx, item in enumerate(payload.risks):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"continuity-risk-{idx}")
        decision = _dict_decision(item)
        severity = str(item.get("severity") or item.get("priority") or "").lower()
        accepted = decision == "pass" or _as_bool(item.get("accepted", item.get("closed", item.get("mitigated")))) is True
        if severity in {"critical", "blocker", "sev1", "high"} and not accepted:
            open_high += 1
        if decision == "rollback":
            blockers.append(f"continuity risk {name} is failing")
        elif decision == "hold" or not accepted:
            warnings.append(f"continuity risk {name} requires owner acceptance or mitigation")
        risk_summary.append({"name": name, "decision": decision or ("pass" if accepted else "hold"), "severity": severity or None, "acceptedOrClosed": accepted})
    if len(continuity_summary) < payload.min_continuity_control_count:
        blockers.append(f"continuity control count {len(continuity_summary)} is below required {payload.min_continuity_control_count}")
    if len(dr_summary) < payload.min_dr_signal_count:
        blockers.append(f"DR signal count {len(dr_summary)} is below required {payload.min_dr_signal_count}")
    if len(fallback_summary) < payload.min_fallback_count:
        blockers.append(f"operational fallback count {len(fallback_summary)} is below required {payload.min_fallback_count}")
    if open_high > payload.max_open_high_risks:
        blockers.append(f"open high/critical continuity risk count {open_high} exceeds allowed {payload.max_open_high_risks}")
    if len(approval_summary) < payload.min_approval_count:
        blockers.append(f"approval count {len(approval_summary)} is below required {payload.min_approval_count}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("stable-state continuity control evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "stage": payload.stage, "phase": payload.phase, "horizon": payload.horizon, "domain": payload.domain, "operatingMode": payload.operating_mode, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "continuityControlSummary": continuity_summary, "drSignalSummary": dr_summary, "dependencyContinuitySummary": dependency_summary, "operationalFallbackSummary": fallback_summary, "communicationCheckSummary": communication_summary, "riskSummary": risk_summary, "approvalSummary": approval_summary, "evidenceStatuses": evidence_statuses, "observed": {"openHighRisks": open_high}, "thresholds": {"minContinuityControlCount": payload.min_continuity_control_count, "minDrSignalCount": payload.min_dr_signal_count, "minFallbackCount": payload.min_fallback_count, "maxOpenHighRisks": payload.max_open_high_risks, "minApprovalCount": payload.min_approval_count}, "blockers": blockers, "warnings": warnings, "nextActions": ["Accept continuity controls into quarterly stable-state continuity governance." if decision == "pass" else "Resolve continuity control blockers/warnings before stable-state acceptance."], "mutatesFailoversDependenciesCommunicationsRisksRunbooksOrOwners": False, "pythonStableStateContinuityControlReviewIsAdvisory": True, "operatorsOwnStableStateContinuityControls": True}
    artifact = artifact_store.write_json(prefix="platform-stable-state-continuity-control-review", artifact_type="platform.stable_state_continuity_control_review.report", payload=report, metadata={"rowCount": len(continuity_summary)+len(dr_summary)+len(dependency_summary)+len(fallback_summary)+len(communication_summary)+len(risk_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "stable-state-continuity-control-metadata-only", "source": "python-stable-state-continuity-control-review"})
    return _result(job, "platform.stable_state_continuity_control_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Stable-state continuity control review is advisory; Python did not execute failovers, alter dependencies, mutate communications, accept risks, change runbooks or modify owners"], [artifact])


def process_platform_operational_resilience_governance_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(OperationalResilienceGovernanceReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    control_summary = _phase2_simple_summary(payload.resilience_controls, "resilience-control", blockers, warnings, ("passed", "met", "healthy", "validated"))
    chaos_summary = _phase2_simple_summary(payload.chaos_drills, "chaos-drill", blockers, warnings, ("passed", "completed", "validated"))
    failover_summary = _phase2_simple_summary(payload.failover_readiness, "failover-readiness", blockers, warnings, ("ready", "validated", "passed"))
    ownership_summary = _phase2_simple_summary(payload.service_ownership, "service-ownership", blockers, warnings, ("ownerAck", "approved", "ready"))
    governance_summary = _phase2_simple_summary(payload.governance_reviews, "governance-review", blockers, warnings, ("approved", "completed", "accepted"))
    approval_summary = _phase2_simple_summary(payload.approvals, "approval", blockers, warnings, ("approved",))
    risk_summary: list[dict[str, Any]] = []
    open_high = 0
    for idx, item in enumerate(payload.risk_items):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"risk-{idx}")
        decision = _dict_decision(item)
        severity = str(item.get("severity") or item.get("priority") or "").lower()
        accepted = decision == "pass" or _as_bool(item.get("accepted", item.get("closed", item.get("mitigated")))) is True
        if severity in {"critical", "blocker", "sev1", "high"} and not accepted:
            open_high += 1
        if decision == "rollback":
            blockers.append(f"operational resilience risk {name} is failing")
        elif decision == "hold" or not accepted:
            warnings.append(f"operational resilience risk {name} requires owner acceptance or mitigation")
        risk_summary.append({"name": name, "decision": decision or ("pass" if accepted else "hold"), "severity": severity or None, "acceptedOrClosed": accepted})
    if len(control_summary) < payload.min_resilience_control_count:
        blockers.append(f"resilience control count {len(control_summary)} is below required {payload.min_resilience_control_count}")
    if len(chaos_summary) < payload.min_chaos_drill_count:
        blockers.append(f"chaos drill count {len(chaos_summary)} is below required {payload.min_chaos_drill_count}")
    if len(failover_summary) < payload.min_failover_readiness_count:
        blockers.append(f"failover readiness count {len(failover_summary)} is below required {payload.min_failover_readiness_count}")
    if len(ownership_summary) < payload.min_ownership_count:
        blockers.append(f"service ownership count {len(ownership_summary)} is below required {payload.min_ownership_count}")
    if open_high > payload.max_open_high_risks:
        blockers.append(f"open high/critical resilience risk count {open_high} exceeds allowed {payload.max_open_high_risks}")
    if len(approval_summary) < payload.min_approval_count:
        blockers.append(f"approval count {len(approval_summary)} is below required {payload.min_approval_count}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("operational resilience governance evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "stage": payload.stage, "phase": payload.phase, "governanceCycle": payload.governance_cycle, "domain": payload.domain, "operatingMode": payload.operating_mode, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "resilienceControlSummary": control_summary, "chaosDrillSummary": chaos_summary, "failoverReadinessSummary": failover_summary, "serviceOwnershipSummary": ownership_summary, "governanceReviewSummary": governance_summary, "riskSummary": risk_summary, "approvalSummary": approval_summary, "evidenceStatuses": evidence_statuses, "observed": {"openHighRisks": open_high}, "thresholds": {"minResilienceControlCount": payload.min_resilience_control_count, "minChaosDrillCount": payload.min_chaos_drill_count, "minFailoverReadinessCount": payload.min_failover_readiness_count, "minOwnershipCount": payload.min_ownership_count, "maxOpenHighRisks": payload.max_open_high_risks, "minApprovalCount": payload.min_approval_count}, "blockers": blockers, "warnings": warnings, "nextActions": ["Accept resilience governance package into recurring steady-state governance." if decision == "pass" else "Resolve resilience governance blockers/warnings before recurring acceptance."], "mutatesControlsFailoversRisksGovernanceOwnersOrTickets": False, "pythonOperationalResilienceGovernanceReviewIsAdvisory": True, "operatorsOwnOperationalResilienceGovernance": True}
    artifact = artifact_store.write_json(prefix="platform-operational-resilience-governance-review", artifact_type="platform.operational_resilience_governance_review.report", payload=report, metadata={"rowCount": len(control_summary)+len(chaos_summary)+len(failover_summary)+len(ownership_summary)+len(governance_summary)+len(risk_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "operational-resilience-governance-metadata-only", "source": "python-operational-resilience-governance-review"})
    return _result(job, "platform.operational_resilience_governance_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Operational resilience governance review is advisory; Python did not mutate controls, execute failovers, accept risks, publish governance, change owners or modify tickets"], [artifact])


def process_platform_recovery_capability_validation_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(RecoveryCapabilityValidationReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    restore_summary = _phase2_simple_summary(payload.restore_tests, "restore-test", blockers, warnings, ("passed", "validated", "completed"))
    rto_rpo_summary = _phase2_simple_summary(payload.rto_rpo_checks, "rto-rpo-check", blockers, warnings, ("passed", "met", "withinTarget", "validated"))
    backup_summary = _phase2_simple_summary(payload.backup_integrity, "backup-integrity", blockers, warnings, ("passed", "verified", "validated"))
    replay_summary = _phase2_simple_summary(payload.incident_replay_results, "incident-replay-result", blockers, warnings, ("passed", "completed", "validated"))
    dependency_summary = _phase2_simple_summary(payload.dependency_recovery, "dependency-recovery", blockers, warnings, ("healthy", "ready", "validated"))
    communication_summary = _phase2_simple_summary(payload.communication_validation, "communication-validation", blockers, warnings, ("approved", "validated", "ready"))
    approval_summary = _phase2_simple_summary(payload.approvals, "approval", blockers, warnings, ("approved",))
    risk_summary: list[dict[str, Any]] = []
    open_high = 0
    for idx, item in enumerate(payload.risks):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"risk-{idx}")
        decision = _dict_decision(item)
        severity = str(item.get("severity") or item.get("priority") or "").lower()
        accepted = decision == "pass" or _as_bool(item.get("accepted", item.get("closed", item.get("mitigated")))) is True
        if severity in {"critical", "blocker", "sev1", "high"} and not accepted:
            open_high += 1
        if decision == "rollback":
            blockers.append(f"recovery capability risk {name} is failing")
        elif decision == "hold" or not accepted:
            warnings.append(f"recovery capability risk {name} requires owner acceptance or mitigation")
        risk_summary.append({"name": name, "decision": decision or ("pass" if accepted else "hold"), "severity": severity or None, "acceptedOrClosed": accepted})
    if len(restore_summary) < payload.min_restore_test_count:
        blockers.append(f"restore test count {len(restore_summary)} is below required {payload.min_restore_test_count}")
    if len(rto_rpo_summary) < payload.min_rto_rpo_check_count:
        blockers.append(f"RTO/RPO check count {len(rto_rpo_summary)} is below required {payload.min_rto_rpo_check_count}")
    if len(backup_summary) < payload.min_backup_integrity_count:
        blockers.append(f"backup integrity count {len(backup_summary)} is below required {payload.min_backup_integrity_count}")
    if open_high > payload.max_open_high_risks:
        blockers.append(f"open high/critical recovery risk count {open_high} exceeds allowed {payload.max_open_high_risks}")
    if len(approval_summary) < payload.min_approval_count:
        blockers.append(f"approval count {len(approval_summary)} is below required {payload.min_approval_count}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("recovery capability validation evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "stage": payload.stage, "phase": payload.phase, "validationWindow": payload.validation_window, "domain": payload.domain, "operatingMode": payload.operating_mode, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "restoreTestSummary": restore_summary, "rtoRpoCheckSummary": rto_rpo_summary, "backupIntegritySummary": backup_summary, "incidentReplaySummary": replay_summary, "dependencyRecoverySummary": dependency_summary, "communicationValidationSummary": communication_summary, "riskSummary": risk_summary, "approvalSummary": approval_summary, "evidenceStatuses": evidence_statuses, "observed": {"openHighRisks": open_high}, "thresholds": {"minRestoreTestCount": payload.min_restore_test_count, "minRtoRpoCheckCount": payload.min_rto_rpo_check_count, "minBackupIntegrityCount": payload.min_backup_integrity_count, "maxOpenHighRisks": payload.max_open_high_risks, "minApprovalCount": payload.min_approval_count}, "blockers": blockers, "warnings": warnings, "nextActions": ["Accept recovery capability validation into recurring resilience governance." if decision == "pass" else "Resolve recovery capability blockers/warnings before accepting recovery capability."], "mutatesBackupsRestoresFailoversCommunicationsRisksOrOwners": False, "pythonRecoveryCapabilityValidationReviewIsAdvisory": True, "operatorsOwnRecoveryCapabilityValidation": True}
    artifact = artifact_store.write_json(prefix="platform-recovery-capability-validation-review", artifact_type="platform.recovery_capability_validation_review.report", payload=report, metadata={"rowCount": len(restore_summary)+len(rto_rpo_summary)+len(backup_summary)+len(replay_summary)+len(dependency_summary)+len(communication_summary)+len(risk_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "recovery-capability-validation-metadata-only", "source": "python-recovery-capability-validation-review"})
    return _result(job, "platform.recovery_capability_validation_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Recovery capability validation review is advisory; Python did not execute restores, alter backups, fail over dependencies, send communications, accept risks or change owners"], [artifact])


def _risk_item_summary(items: list[dict[str, Any]], label: str, blockers: list[str], warnings: list[str]) -> tuple[list[dict[str, Any]], int]:
    summary: list[dict[str, Any]] = []
    open_high = 0
    for idx, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"{label}-{idx}")
        decision = _dict_decision(item)
        severity = str(item.get("severity") or item.get("priority") or "").lower()
        accepted = decision == "pass" or _as_bool(item.get("accepted", item.get("closed", item.get("mitigated")))) is True
        if severity in {"critical", "blocker", "sev1", "high"} and not accepted:
            open_high += 1
        if decision == "rollback":
            blockers.append(f"{label} {name} is failing")
        elif decision == "hold" or not accepted:
            warnings.append(f"{label} {name} requires owner acceptance or mitigation")
        summary.append({"name": name, "decision": decision or ("pass" if accepted else "hold"), "severity": severity or None, "acceptedOrClosed": accepted})
    return summary, open_high


def process_platform_operational_resilience_optimization_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(OperationalResilienceOptimizationReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    metric_summary = _phase2_simple_summary(payload.resilience_metrics, "resilience-metric", blockers, warnings, ("passed", "healthy", "withinTarget", "optimized"))
    action_summary = _phase2_simple_summary(payload.optimization_actions, "optimization-action", blockers, warnings, ("approved", "completed", "ready", "planned"))
    automation_summary = _phase2_simple_summary(payload.automation_candidates, "automation-candidate", blockers, warnings, ("approved", "ready", "validated"))
    incident_summary = _phase2_simple_summary(payload.incident_patterns, "incident-pattern", blockers, warnings, ("reviewed", "mitigated", "accepted"))
    capacity_summary = _phase2_simple_summary(payload.capacity_signals, "capacity-signal", blockers, warnings, ("healthy", "withinTarget", "ready"))
    approval_summary = _phase2_simple_summary(payload.approvals, "approval", blockers, warnings, ("approved",))
    risk_summary, open_high = _risk_item_summary(payload.risk_items, "resilience optimization risk", blockers, warnings)
    if len(metric_summary) < payload.min_resilience_metric_count:
        blockers.append(f"resilience metric count {len(metric_summary)} is below required {payload.min_resilience_metric_count}")
    if len(action_summary) < payload.min_optimization_action_count:
        blockers.append(f"optimization action count {len(action_summary)} is below required {payload.min_optimization_action_count}")
    if len(automation_summary) < payload.min_automation_candidate_count:
        blockers.append(f"automation candidate count {len(automation_summary)} is below required {payload.min_automation_candidate_count}")
    if open_high > payload.max_open_high_risks:
        blockers.append(f"open high/critical resilience optimization risk count {open_high} exceeds allowed {payload.max_open_high_risks}")
    if len(approval_summary) < payload.min_approval_count:
        blockers.append(f"approval count {len(approval_summary)} is below required {payload.min_approval_count}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("operational resilience optimization evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "stage": payload.stage, "phase": payload.phase, "optimizationCycle": payload.optimization_cycle, "domain": payload.domain, "operatingMode": payload.operating_mode, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "resilienceMetricSummary": metric_summary, "optimizationActionSummary": action_summary, "automationCandidateSummary": automation_summary, "incidentPatternSummary": incident_summary, "capacitySignalSummary": capacity_summary, "riskSummary": risk_summary, "approvalSummary": approval_summary, "evidenceStatuses": evidence_statuses, "observed": {"openHighRisks": open_high}, "thresholds": {"minResilienceMetricCount": payload.min_resilience_metric_count, "minOptimizationActionCount": payload.min_optimization_action_count, "minAutomationCandidateCount": payload.min_automation_candidate_count, "maxOpenHighRisks": payload.max_open_high_risks, "minApprovalCount": payload.min_approval_count}, "blockers": blockers, "warnings": warnings, "nextActions": ["Accept resilience optimization package into the recurring steady-state improvement loop." if decision == "pass" else "Resolve resilience optimization blockers/warnings before enabling automated continuity sequencing."], "mutatesResilienceAutomationCapacityRisksOrOwners": False, "pythonOperationalResilienceOptimizationReviewIsAdvisory": True, "operatorsOwnResilienceOptimization": True}
    artifact = artifact_store.write_json(prefix="platform-operational-resilience-optimization-review", artifact_type="platform.operational_resilience_optimization_review.report", payload=report, metadata={"rowCount": len(metric_summary)+len(action_summary)+len(automation_summary)+len(incident_summary)+len(capacity_summary)+len(risk_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "operational-resilience-optimization-metadata-only", "source": "python-operational-resilience-optimization-review"})
    return _result(job, "platform.operational_resilience_optimization_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Operational resilience optimization review is advisory; Python did not change resilience controls, automation, capacity, risks, tickets, runbooks or owners"], [artifact])


def process_platform_automated_continuity_preparedness_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(AutomatedContinuityPreparednessReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    control_summary = _phase2_simple_summary(payload.automation_controls, "automation-control", blockers, warnings, ("passed", "enabled", "ready", "validated"))
    runbook_summary = _phase2_simple_summary(payload.continuity_runbooks, "continuity-runbook", blockers, warnings, ("approved", "current", "validated", "ready"))
    scheduler_summary = _phase2_simple_summary(payload.scheduler_readiness, "scheduler-readiness", blockers, warnings, ("ready", "healthy", "validated"))
    dependency_summary = _phase2_simple_summary(payload.dependency_hooks, "dependency-hook", blockers, warnings, ("ready", "healthy", "validated"))
    template_summary = _phase2_simple_summary(payload.notification_templates, "notification-template", blockers, warnings, ("approved", "ready", "validated"))
    approval_summary = _phase2_simple_summary(payload.approvals, "approval", blockers, warnings, ("approved",))
    risk_summary, open_high = _risk_item_summary(payload.risks, "automated continuity risk", blockers, warnings)
    if len(control_summary) < payload.min_automation_control_count:
        blockers.append(f"automation control count {len(control_summary)} is below required {payload.min_automation_control_count}")
    if len(runbook_summary) < payload.min_runbook_count:
        blockers.append(f"continuity runbook count {len(runbook_summary)} is below required {payload.min_runbook_count}")
    if len(scheduler_summary) < payload.min_scheduler_readiness_count:
        blockers.append(f"scheduler readiness count {len(scheduler_summary)} is below required {payload.min_scheduler_readiness_count}")
    if len(dependency_summary) < payload.min_dependency_hook_count:
        blockers.append(f"dependency hook count {len(dependency_summary)} is below required {payload.min_dependency_hook_count}")
    if open_high > payload.max_open_high_risks:
        blockers.append(f"open high/critical automated continuity risk count {open_high} exceeds allowed {payload.max_open_high_risks}")
    if len(approval_summary) < payload.min_approval_count:
        blockers.append(f"approval count {len(approval_summary)} is below required {payload.min_approval_count}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("automated continuity preparedness evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "stage": payload.stage, "phase": payload.phase, "preparednessWindow": payload.preparedness_window, "domain": payload.domain, "operatingMode": payload.operating_mode, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "automationControlSummary": control_summary, "continuityRunbookSummary": runbook_summary, "schedulerReadinessSummary": scheduler_summary, "dependencyHookSummary": dependency_summary, "notificationTemplateSummary": template_summary, "riskSummary": risk_summary, "approvalSummary": approval_summary, "evidenceStatuses": evidence_statuses, "observed": {"openHighRisks": open_high}, "thresholds": {"minAutomationControlCount": payload.min_automation_control_count, "minRunbookCount": payload.min_runbook_count, "minSchedulerReadinessCount": payload.min_scheduler_readiness_count, "minDependencyHookCount": payload.min_dependency_hook_count, "maxOpenHighRisks": payload.max_open_high_risks, "minApprovalCount": payload.min_approval_count}, "blockers": blockers, "warnings": warnings, "nextActions": ["Accept automated continuity preparedness package for recurring steady-state continuity governance." if decision == "pass" else "Resolve automated continuity preparedness blockers/warnings before scheduled automation enablement."], "mutatesSchedulersHooksTemplatesRunbooksRisksOrOwners": False, "pythonAutomatedContinuityPreparednessReviewIsAdvisory": True, "operatorsOwnAutomatedContinuityPreparedness": True}
    artifact = artifact_store.write_json(prefix="platform-automated-continuity-preparedness-review", artifact_type="platform.automated_continuity_preparedness_review.report", payload=report, metadata={"rowCount": len(control_summary)+len(runbook_summary)+len(scheduler_summary)+len(dependency_summary)+len(template_summary)+len(risk_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "automated-continuity-preparedness-metadata-only", "source": "python-automated-continuity-preparedness-review"})
    return _result(job, "platform.automated_continuity_preparedness_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Automated continuity preparedness review is advisory; Python did not enable schedulers, mutate hooks, publish templates, change runbooks, accept risks or change owners"], [artifact])


def process_platform_automated_continuity_execution_validation_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(AutomatedContinuityExecutionValidationReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    execution_summary = _phase2_simple_summary(payload.execution_runs, "execution-run", blockers, warnings, ("passed", "completed", "validated", "succeeded"))
    scheduler_summary = _phase2_simple_summary(payload.scheduler_events, "scheduler-event", blockers, warnings, ("passed", "completed", "validated", "healthy", "ready"))
    dependency_summary = _phase2_simple_summary(payload.dependency_hooks, "dependency-hook", blockers, warnings, ("passed", "validated", "healthy", "ready"))
    notification_summary = _phase2_simple_summary(payload.notification_deliveries, "notification-delivery", blockers, warnings, ("passed", "delivered", "validated", "approved", "ready"))
    runbook_summary = _phase2_simple_summary(payload.runbook_checkpoints, "runbook-checkpoint", blockers, warnings, ("passed", "completed", "current", "validated", "approved"))
    approval_summary = _phase2_simple_summary(payload.approvals, "approval", blockers, warnings, ("approved",))
    risk_summary, open_high = _risk_item_summary(payload.risk_items, "automated continuity execution risk", blockers, warnings)
    if len(execution_summary) < payload.min_execution_run_count:
        blockers.append(f"execution run count {len(execution_summary)} is below required {payload.min_execution_run_count}")
    if len(scheduler_summary) < payload.min_scheduler_event_count:
        blockers.append(f"scheduler event count {len(scheduler_summary)} is below required {payload.min_scheduler_event_count}")
    if len(dependency_summary) < payload.min_dependency_hook_count:
        blockers.append(f"dependency hook count {len(dependency_summary)} is below required {payload.min_dependency_hook_count}")
    if len(runbook_summary) < payload.min_runbook_checkpoint_count:
        blockers.append(f"runbook checkpoint count {len(runbook_summary)} is below required {payload.min_runbook_checkpoint_count}")
    if open_high > payload.max_open_high_risks:
        blockers.append(f"open high/critical automated continuity execution risk count {open_high} exceeds allowed {payload.max_open_high_risks}")
    if len(approval_summary) < payload.min_approval_count:
        blockers.append(f"approval count {len(approval_summary)} is below required {payload.min_approval_count}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("automated continuity execution validation evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "stage": payload.stage, "phase": payload.phase, "executionWindow": payload.execution_window, "domain": payload.domain, "operatingMode": payload.operating_mode, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "executionRunSummary": execution_summary, "schedulerEventSummary": scheduler_summary, "dependencyHookSummary": dependency_summary, "notificationDeliverySummary": notification_summary, "runbookCheckpointSummary": runbook_summary, "riskSummary": risk_summary, "approvalSummary": approval_summary, "evidenceStatuses": evidence_statuses, "observed": {"openHighRisks": open_high}, "thresholds": {"minExecutionRunCount": payload.min_execution_run_count, "minSchedulerEventCount": payload.min_scheduler_event_count, "minDependencyHookCount": payload.min_dependency_hook_count, "minRunbookCheckpointCount": payload.min_runbook_checkpoint_count, "maxOpenHighRisks": payload.max_open_high_risks, "minApprovalCount": payload.min_approval_count}, "blockers": blockers, "warnings": warnings, "nextActions": ["Accept automated continuity execution validation into the steady-state continuity feedback loop." if decision == "pass" else "Resolve automated continuity execution blockers/warnings before relying on recurring automation."], "mutatesSchedulersHooksNotificationsFailoversRisksOrOwners": False, "pythonAutomatedContinuityExecutionValidationReviewIsAdvisory": True, "operatorsOwnAutomatedContinuityExecution": True}
    artifact = artifact_store.write_json(prefix="platform-automated-continuity-execution-validation-review", artifact_type="platform.automated_continuity_execution_validation_review.report", payload=report, metadata={"rowCount": len(execution_summary)+len(scheduler_summary)+len(dependency_summary)+len(notification_summary)+len(runbook_summary)+len(risk_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "automated-continuity-execution-validation-metadata-only", "source": "python-automated-continuity-execution-validation-review"})
    return _result(job, "platform.automated_continuity_execution_validation_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Automated continuity execution validation review is advisory; Python did not trigger schedulers, mutate hooks, send notifications, execute failovers, accept risks or change owners"], [artifact])


def process_platform_operational_resilience_feedback_loop_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(OperationalResilienceFeedbackLoopReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    feedback_summary = _phase2_simple_summary(payload.feedback_signals, "feedback-signal", blockers, warnings, ("passed", "reviewed", "healthy", "validated", "completed"))
    remediation_summary = _phase2_simple_summary(payload.remediation_items, "remediation-item", blockers, warnings, ("passed", "ownerAck", "approved", "ready", "completed"))
    learning_summary = _phase2_simple_summary(payload.learning_items, "learning-item", blockers, warnings, ("passed", "completed", "reviewed", "accepted", "approved"))
    metric_summary = _phase2_simple_summary(payload.metric_adjustments, "metric-adjustment", blockers, warnings, ("passed", "approved", "validated", "reviewed"))
    owner_summary = _phase2_simple_summary(payload.owner_responses, "owner-response", blockers, warnings, ("passed", "approved", "ownerAck", "accepted"))
    approval_summary = _phase2_simple_summary(payload.approvals, "approval", blockers, warnings, ("approved",))
    risk_summary, open_high = _risk_item_summary(payload.risks, "operational resilience feedback risk", blockers, warnings)
    if len(feedback_summary) < payload.min_feedback_signal_count:
        blockers.append(f"feedback signal count {len(feedback_summary)} is below required {payload.min_feedback_signal_count}")
    if len(remediation_summary) < payload.min_remediation_item_count:
        blockers.append(f"remediation item count {len(remediation_summary)} is below required {payload.min_remediation_item_count}")
    if len(learning_summary) < payload.min_learning_item_count:
        blockers.append(f"learning item count {len(learning_summary)} is below required {payload.min_learning_item_count}")
    if open_high > payload.max_open_high_risks:
        blockers.append(f"open high/critical operational resilience feedback risk count {open_high} exceeds allowed {payload.max_open_high_risks}")
    if len(approval_summary) < payload.min_approval_count:
        blockers.append(f"approval count {len(approval_summary)} is below required {payload.min_approval_count}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("operational resilience feedback-loop evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "stage": payload.stage, "phase": payload.phase, "feedbackCycle": payload.feedback_cycle, "domain": payload.domain, "operatingMode": payload.operating_mode, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "feedbackSignalSummary": feedback_summary, "remediationItemSummary": remediation_summary, "learningItemSummary": learning_summary, "metricAdjustmentSummary": metric_summary, "ownerResponseSummary": owner_summary, "riskSummary": risk_summary, "approvalSummary": approval_summary, "evidenceStatuses": evidence_statuses, "observed": {"openHighRisks": open_high}, "thresholds": {"minFeedbackSignalCount": payload.min_feedback_signal_count, "minRemediationItemCount": payload.min_remediation_item_count, "minLearningItemCount": payload.min_learning_item_count, "maxOpenHighRisks": payload.max_open_high_risks, "minApprovalCount": payload.min_approval_count}, "blockers": blockers, "warnings": warnings, "nextActions": ["Accept resilience feedback loop for the next recurring operational improvement cycle." if decision == "pass" else "Resolve resilience feedback blockers/warnings before changing baselines or remediation governance."], "mutatesMetricsRoadmapRemediationRisksGovernanceOrOwners": False, "pythonOperationalResilienceFeedbackLoopReviewIsAdvisory": True, "operatorsOwnResilienceFeedbackLoop": True}
    artifact = artifact_store.write_json(prefix="platform-operational-resilience-feedback-loop-review", artifact_type="platform.operational_resilience_feedback_loop_review.report", payload=report, metadata={"rowCount": len(feedback_summary)+len(remediation_summary)+len(learning_summary)+len(metric_summary)+len(owner_summary)+len(risk_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "operational-resilience-feedback-loop-metadata-only", "source": "python-operational-resilience-feedback-loop-review"})
    return _result(job, "platform.operational_resilience_feedback_loop_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Operational resilience feedback-loop review is advisory; Python did not change metrics, mutate roadmap items, assign remediation, accept risks, publish governance or change owners"], [artifact])


def process_platform_final_closure_evidence_package_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(FinalClosureEvidencePackageReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    version_summary = _phase2_simple_summary(payload.version_summary, "version-summary", blockers, warnings, ("passed", "completed", "validated", "approved"))
    validation_summary = _phase2_simple_summary(payload.validation_results, "validation-result", blockers, warnings, ("passed", "completed", "validated", "verified"))
    contract_summary = _phase2_simple_summary(payload.contract_evidence, "contract-evidence", blockers, warnings, ("passed", "completed", "validated", "verified"))
    api_summary = _phase2_simple_summary(payload.api_route_evidence, "api-route-evidence", blockers, warnings, ("passed", "completed", "validated", "verified"))
    worker_summary = _phase2_simple_summary(payload.worker_evidence, "worker-evidence", blockers, warnings, ("passed", "completed", "validated", "healthy", "verified"))
    signoff_summary = _phase2_simple_summary(payload.signoffs, "signoff", blockers, warnings, ("approved", "signed", "ownerAck"))
    risk_summary, open_high = _risk_item_summary(payload.residual_risks, "final closure residual risk", blockers, warnings)
    if len(version_summary) < payload.min_version_summary_count:
        blockers.append(f"version summary count {len(version_summary)} is below required {payload.min_version_summary_count}")
    if len(validation_summary) < payload.min_validation_result_count:
        blockers.append(f"validation result count {len(validation_summary)} is below required {payload.min_validation_result_count}")
    if len(contract_summary) < payload.min_contract_evidence_count:
        blockers.append(f"contract evidence count {len(contract_summary)} is below required {payload.min_contract_evidence_count}")
    if len(api_summary) < payload.min_api_route_evidence_count:
        blockers.append(f"API route evidence count {len(api_summary)} is below required {payload.min_api_route_evidence_count}")
    if len(worker_summary) < payload.min_worker_evidence_count:
        blockers.append(f"worker evidence count {len(worker_summary)} is below required {payload.min_worker_evidence_count}")
    if open_high > payload.max_open_high_risks:
        blockers.append(f"open high final closure residual risk count {open_high} exceeds allowed {payload.max_open_high_risks}")
    if len(signoff_summary) < payload.min_signoff_count:
        blockers.append(f"signoff count {len(signoff_summary)} is below required {payload.min_signoff_count}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("final closure evidence package is required")
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "stage": payload.stage, "phase": payload.phase, "closureWindow": payload.closure_window, "domain": payload.domain, "operatingMode": payload.operating_mode, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "versionSummary": version_summary, "validationSummary": validation_summary, "contractEvidenceSummary": contract_summary, "apiRouteEvidenceSummary": api_summary, "workerEvidenceSummary": worker_summary, "riskSummary": risk_summary, "signoffSummary": signoff_summary, "evidenceStatuses": evidence_statuses, "observed": {"openHighRisks": open_high}, "thresholds": {"minVersionSummaryCount": payload.min_version_summary_count, "minValidationResultCount": payload.min_validation_result_count, "minContractEvidenceCount": payload.min_contract_evidence_count, "minApiRouteEvidenceCount": payload.min_api_route_evidence_count, "minWorkerEvidenceCount": payload.min_worker_evidence_count, "maxOpenHighRisks": payload.max_open_high_risks, "minSignoffCount": payload.min_signoff_count}, "blockers": blockers, "warnings": warnings, "nextActions": ["Archive final closure evidence package and proceed to formal operational handover release." if decision == "pass" else "Resolve final closure evidence blockers/warnings before handover release."], "mutatesReleaseRiskTicketsHandoverOrOwners": False, "pythonFinalClosureEvidencePackageReviewIsAdvisory": True, "operatorsOwnFinalClosureEvidence": True}
    artifact = artifact_store.write_json(prefix="platform-final-closure-evidence-package-review", artifact_type="platform.final_closure_evidence_package_review.report", payload=report, metadata={"rowCount": len(version_summary)+len(validation_summary)+len(contract_summary)+len(api_summary)+len(worker_summary)+len(risk_summary)+len(signoff_summary), "redactionApplied": True, "piiClass": "final-closure-evidence-package-metadata-only", "source": "python-final-closure-evidence-package-review"})
    return _result(job, "platform.final_closure_evidence_package_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Final closure evidence package review is advisory; Python did not certify releases, mutate tickets, accept risks, publish handover or change owners"], [artifact])


def process_platform_global_implementation_completion_checklist_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(GlobalImplementationCompletionChecklistReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    functional_summary = _phase2_simple_summary(payload.functional_areas, "functional-area", blockers, warnings, ("passed", "completed", "validated", "approved"))
    implementation_summary = _phase2_simple_summary(payload.implementation_tasks, "implementation-task", blockers, warnings, ("passed", "completed", "done", "validated"))
    validation_summary = _phase2_simple_summary(payload.validation_tasks, "validation-task", blockers, warnings, ("passed", "completed", "validated", "verified"))
    handover_summary = _phase2_simple_summary(payload.handover_tasks, "handover-task", blockers, warnings, ("passed", "completed", "ready", "approved"))
    approval_summary = _phase2_simple_summary(payload.approvals, "approval", blockers, warnings, ("approved",))
    deferred_summary: list[dict[str, Any]] = []
    open_critical_deferred = 0
    for idx, item in enumerate(payload.deferred_items):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"deferred-item-{idx}")
        decision = _dict_decision(item)
        severity = str(item.get("severity") or item.get("priority") or "").lower()
        accepted = decision == "pass" or _as_bool(item.get("accepted", item.get("approved"))) is True
        if severity in {"critical", "blocker", "sev1", "high"} and not accepted:
            open_critical_deferred += 1
        if decision == "rollback":
            blockers.append(f"deferred item {name} is failing")
        elif decision == "hold" or not accepted:
            warnings.append(f"deferred item {name} requires acceptance or closure")
        deferred_summary.append({"name": name, "decision": decision or ("pass" if accepted else "hold"), "severity": severity or None, "accepted": accepted})
    if len(functional_summary) < payload.min_functional_area_count:
        blockers.append(f"functional area count {len(functional_summary)} is below required {payload.min_functional_area_count}")
    if len(implementation_summary) < payload.min_implementation_task_count:
        blockers.append(f"implementation task count {len(implementation_summary)} is below required {payload.min_implementation_task_count}")
    if len(validation_summary) < payload.min_validation_task_count:
        blockers.append(f"validation task count {len(validation_summary)} is below required {payload.min_validation_task_count}")
    if len(handover_summary) < payload.min_handover_task_count:
        blockers.append(f"handover task count {len(handover_summary)} is below required {payload.min_handover_task_count}")
    if open_critical_deferred > payload.max_open_critical_deferred_items:
        blockers.append(f"open critical deferred item count {open_critical_deferred} exceeds allowed {payload.max_open_critical_deferred_items}")
    if len(approval_summary) < payload.min_approval_count:
        blockers.append(f"approval count {len(approval_summary)} is below required {payload.min_approval_count}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("global implementation completion checklist evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "stage": payload.stage, "phase": payload.phase, "checklistScope": payload.checklist_scope, "domain": payload.domain, "operatingMode": payload.operating_mode, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "functionalAreaSummary": functional_summary, "implementationTaskSummary": implementation_summary, "validationTaskSummary": validation_summary, "handoverTaskSummary": handover_summary, "deferredItemSummary": deferred_summary, "approvalSummary": approval_summary, "evidenceStatuses": evidence_statuses, "observed": {"openCriticalDeferredItems": open_critical_deferred}, "thresholds": {"minFunctionalAreaCount": payload.min_functional_area_count, "minImplementationTaskCount": payload.min_implementation_task_count, "minValidationTaskCount": payload.min_validation_task_count, "minHandoverTaskCount": payload.min_handover_task_count, "maxOpenCriticalDeferredItems": payload.max_open_critical_deferred_items, "minApprovalCount": payload.min_approval_count}, "blockers": blockers, "warnings": warnings, "nextActions": ["Use this checklist as the closure baseline and proceed to final handover release." if decision == "pass" else "Resolve completion checklist blockers/warnings before declaring closure."], "mutatesTasksPercentagesRisksHandoverOrOwners": False, "pythonGlobalImplementationCompletionChecklistReviewIsAdvisory": True, "operatorsOwnImplementationCompletionChecklist": True}
    artifact = artifact_store.write_json(prefix="platform-global-implementation-completion-checklist-review", artifact_type="platform.global_implementation_completion_checklist_review.report", payload=report, metadata={"rowCount": len(functional_summary)+len(implementation_summary)+len(validation_summary)+len(handover_summary)+len(deferred_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "global-implementation-completion-checklist-metadata-only", "source": "python-global-implementation-completion-checklist-review"})
    return _result(job, "platform.global_implementation_completion_checklist_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Global implementation completion checklist review is advisory; Python did not close tasks, alter percentages, accept deferred items, publish handover or change owners"], [artifact])



def process_platform_final_operational_handover_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(FinalOperationalHandoverReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    runbook_summary = _phase2_simple_summary(payload.runbooks, "runbook", blockers, warnings, ("current", "approved", "validated", "completed"))
    owner_summary = _phase2_simple_summary(payload.owner_assignments, "owner-assignment", blockers, warnings, ("assigned", "approved", "ownerAck", "completed"))
    support_summary = _phase2_simple_summary(payload.support_model, "support-model", blockers, warnings, ("approved", "ready", "validated"))
    monitoring_summary = _phase2_simple_summary(payload.monitoring_controls, "monitoring-control", blockers, warnings, ("healthy", "validated", "ready"))
    escalation_summary = _phase2_simple_summary(payload.escalation_paths, "escalation-path", blockers, warnings, ("validated", "approved", "ready"))
    signoff_summary = _phase2_simple_summary(payload.signoffs, "signoff", blockers, warnings, ("approved", "signed", "ownerAck"))
    risk_summary: list[dict[str, Any]] = []
    open_high = 0
    for idx, item in enumerate(payload.operational_risks):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"operational-risk-{idx}")
        decision = _dict_decision(item)
        severity = str(item.get("severity") or item.get("priority") or "").lower()
        accepted = decision == "pass" or _as_bool(item.get("accepted", item.get("approved"))) is True
        if severity in {"critical", "blocker", "sev1", "high"} and not accepted:
            open_high += 1
        if decision == "rollback":
            blockers.append(f"operational risk {name} is failing")
        elif decision == "hold" or not accepted:
            warnings.append(f"operational risk {name} requires acceptance or closure")
        risk_summary.append({"name": name, "decision": decision or ("pass" if accepted else "hold"), "severity": severity or None, "accepted": accepted})
    if len(runbook_summary) < payload.min_runbook_count:
        blockers.append(f"runbook count {len(runbook_summary)} is below required {payload.min_runbook_count}")
    if len(owner_summary) < payload.min_owner_assignment_count:
        blockers.append(f"owner assignment count {len(owner_summary)} is below required {payload.min_owner_assignment_count}")
    if len(support_summary) < payload.min_support_model_count:
        blockers.append(f"support model count {len(support_summary)} is below required {payload.min_support_model_count}")
    if len(monitoring_summary) < payload.min_monitoring_control_count:
        blockers.append(f"monitoring control count {len(monitoring_summary)} is below required {payload.min_monitoring_control_count}")
    if len(escalation_summary) < payload.min_escalation_path_count:
        blockers.append(f"escalation path count {len(escalation_summary)} is below required {payload.min_escalation_path_count}")
    if open_high > payload.max_open_high_risks:
        blockers.append(f"open high operational risk count {open_high} exceeds allowed {payload.max_open_high_risks}")
    if len(signoff_summary) < payload.min_signoff_count:
        blockers.append(f"signoff count {len(signoff_summary)} is below required {payload.min_signoff_count}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("final operational handover evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "stage": payload.stage, "phase": payload.phase, "handoverScope": payload.handover_scope, "domain": payload.domain, "operatingMode": payload.operating_mode, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "runbookSummary": runbook_summary, "ownerAssignmentSummary": owner_summary, "supportModelSummary": support_summary, "monitoringControlSummary": monitoring_summary, "escalationPathSummary": escalation_summary, "operationalRiskSummary": risk_summary, "signoffSummary": signoff_summary, "evidenceStatuses": evidence_statuses, "observed": {"openHighOperationalRisks": open_high}, "thresholds": {"minRunbookCount": payload.min_runbook_count, "minOwnerAssignmentCount": payload.min_owner_assignment_count, "minSupportModelCount": payload.min_support_model_count, "minMonitoringControlCount": payload.min_monitoring_control_count, "minEscalationPathCount": payload.min_escalation_path_count, "maxOpenHighRisks": payload.max_open_high_risks, "minSignoffCount": payload.min_signoff_count}, "blockers": blockers, "warnings": warnings, "nextActions": ["Proceed to phase closure certification and archive handover evidence." if decision == "pass" else "Resolve final operational handover blockers/warnings before certification."], "mutatesOwnersRunbooksSupportRisksControlsOrHandover": False, "pythonFinalOperationalHandoverReviewIsAdvisory": True, "operatorsOwnFinalOperationalHandover": True}
    artifact = artifact_store.write_json(prefix="platform-final-operational-handover-review", artifact_type="platform.final_operational_handover_review.report", payload=report, metadata={"rowCount": len(runbook_summary)+len(owner_summary)+len(support_summary)+len(monitoring_summary)+len(escalation_summary)+len(risk_summary)+len(signoff_summary), "redactionApplied": True, "piiClass": "final-operational-handover-metadata-only", "source": "python-final-operational-handover-review"})
    return _result(job, "platform.final_operational_handover_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Final operational handover review is advisory; Python did not assign owners, publish runbooks, activate support, accept risks, mutate controls or declare handover"], [artifact])


def process_platform_phase_closure_certification_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(PhaseClosureCertificationReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    criteria_summary = _phase2_simple_summary(payload.closure_criteria, "closure-criterion", blockers, warnings, ("met", "satisfied", "completed", "approved"))
    evidence_summary = _phase2_simple_summary(payload.evidence_package, "evidence-package-item", blockers, warnings, ("complete", "validated", "approved", "published"))
    handover_summary = _phase2_simple_summary(payload.handover_evidence, "handover-evidence", blockers, warnings, ("approved", "completed", "validated"))
    artifact_summary = _phase2_simple_summary(payload.release_artifacts, "release-artifact", blockers, warnings, ("published", "verified", "completed"))
    approval_summary = _phase2_simple_summary(payload.approvals, "approval", blockers, warnings, ("approved", "signed"))
    backlog_summary = _phase2_simple_summary(payload.next_phase_backlog, "next-phase-backlog", blockers, warnings, ("separated", "approved", "created", "triaged"))
    risk_summary: list[dict[str, Any]] = []
    open_high = 0
    for idx, item in enumerate(payload.residual_risks):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"residual-risk-{idx}")
        decision = _dict_decision(item)
        severity = str(item.get("severity") or item.get("priority") or "").lower()
        accepted = decision == "pass" or _as_bool(item.get("accepted", item.get("approved"))) is True
        if severity in {"critical", "blocker", "sev1", "high"} and not accepted:
            open_high += 1
        if decision == "rollback":
            blockers.append(f"residual risk {name} is failing")
        elif decision == "hold" or not accepted:
            warnings.append(f"residual risk {name} requires acceptance or closure")
        risk_summary.append({"name": name, "decision": decision or ("pass" if accepted else "hold"), "severity": severity or None, "accepted": accepted})
    if len(criteria_summary) < payload.min_closure_criteria_count:
        blockers.append(f"closure criteria count {len(criteria_summary)} is below required {payload.min_closure_criteria_count}")
    if len(evidence_summary) < payload.min_evidence_package_count:
        blockers.append(f"evidence package count {len(evidence_summary)} is below required {payload.min_evidence_package_count}")
    if len(handover_summary) < payload.min_handover_evidence_count:
        blockers.append(f"handover evidence count {len(handover_summary)} is below required {payload.min_handover_evidence_count}")
    if len(artifact_summary) < payload.min_release_artifact_count:
        blockers.append(f"release artifact count {len(artifact_summary)} is below required {payload.min_release_artifact_count}")
    if open_high > payload.max_open_high_risks:
        blockers.append(f"open high residual risk count {open_high} exceeds allowed {payload.max_open_high_risks}")
    if len(approval_summary) < payload.min_approval_count:
        blockers.append(f"approval count {len(approval_summary)} is below required {payload.min_approval_count}")
    if payload.require_next_phase_backlog_separation and not backlog_summary:
        blockers.append("next-phase backlog separation evidence is required")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("phase closure certification evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "stage": payload.stage, "phase": payload.phase, "certificationScope": payload.certification_scope, "domain": payload.domain, "operatingMode": payload.operating_mode, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "closureCriteriaSummary": criteria_summary, "evidencePackageSummary": evidence_summary, "handoverEvidenceSummary": handover_summary, "residualRiskSummary": risk_summary, "releaseArtifactSummary": artifact_summary, "approvalSummary": approval_summary, "nextPhaseBacklogSummary": backlog_summary, "evidenceStatuses": evidence_statuses, "observed": {"openHighResidualRisks": open_high}, "thresholds": {"minClosureCriteriaCount": payload.min_closure_criteria_count, "minEvidencePackageCount": payload.min_evidence_package_count, "minHandoverEvidenceCount": payload.min_handover_evidence_count, "minReleaseArtifactCount": payload.min_release_artifact_count, "maxOpenHighRisks": payload.max_open_high_risks, "minApprovalCount": payload.min_approval_count, "requireNextPhaseBacklogSeparation": payload.require_next_phase_backlog_separation}, "blockers": blockers, "warnings": warnings, "nextActions": ["Declare this implementation phase closed and keep future work in the separated post-closure backlog." if decision == "pass" else "Resolve certification blockers/warnings before declaring phase closure."], "mutatesCertificationReleasesRisksTicketsBacklogOrOwners": False, "pythonPhaseClosureCertificationReviewIsAdvisory": True, "operatorsOwnPhaseClosureCertification": True}
    artifact = artifact_store.write_json(prefix="platform-phase-closure-certification-review", artifact_type="platform.phase_closure_certification_review.report", payload=report, metadata={"rowCount": len(criteria_summary)+len(evidence_summary)+len(handover_summary)+len(risk_summary)+len(artifact_summary)+len(approval_summary)+len(backlog_summary), "redactionApplied": True, "piiClass": "phase-closure-certification-metadata-only", "source": "python-phase-closure-certification-review"})
    return _result(job, "platform.phase_closure_certification_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Phase closure certification review is advisory; Python did not certify the phase, tag releases, close tickets, accept risks, mutate backlog or change owners"], [artifact])


def process_platform_final_acceptance_evidence_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(FinalAcceptanceEvidenceReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    criteria_summary = _phase2_simple_summary(payload.acceptance_criteria, "acceptance-criterion", blockers, warnings, ("met", "satisfied", "completed"))
    validation_summary = _phase2_simple_summary(payload.validation_evidence, "validation-evidence", blockers, warnings, ("validated", "passed", "completed"))
    test_summary = _phase2_simple_summary(payload.test_results, "test-result", blockers, warnings, ("passed", "success", "completed"))
    signoff_summary = _phase2_simple_summary(payload.signoffs, "signoff", blockers, warnings, ("approved", "signed", "ownerAck"))
    risk_summary: list[dict[str, Any]] = []
    open_high = 0
    for idx, item in enumerate(payload.residual_risks):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"risk-{idx}")
        decision = _dict_decision(item)
        severity = str(item.get("severity") or item.get("priority") or "").lower()
        closed = decision == "pass" or _as_bool(item.get("closed", item.get("accepted"))) is True
        if severity in {"critical", "blocker", "sev1", "high"} and not closed:
            open_high += 1
        if decision == "rollback":
            blockers.append(f"residual risk {name} is failing")
        elif decision == "hold" or not closed:
            warnings.append(f"residual risk {name} requires acceptance or closure")
        risk_summary.append({"name": name, "decision": decision or ("pass" if closed else "hold"), "severity": severity or None, "closedOrAccepted": closed})
    if len(criteria_summary) < payload.min_acceptance_criteria_count:
        blockers.append(f"acceptance criteria count {len(criteria_summary)} is below required {payload.min_acceptance_criteria_count}")
    if len(validation_summary) < payload.min_validation_evidence_count:
        blockers.append(f"validation evidence count {len(validation_summary)} is below required {payload.min_validation_evidence_count}")
    if len(signoff_summary) < payload.min_signoff_count:
        blockers.append(f"signoff count {len(signoff_summary)} is below required {payload.min_signoff_count}")
    if open_high > payload.max_open_high_risks:
        blockers.append(f"open high residual risk count {open_high} exceeds allowed {payload.max_open_high_risks}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("final acceptance evidence bundle is required")
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "stage": payload.stage, "phase": payload.phase, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "criteriaSummary": criteria_summary, "validationSummary": validation_summary, "testSummary": test_summary, "riskSummary": risk_summary, "signoffSummary": signoff_summary, "evidenceStatuses": evidence_statuses, "thresholds": {"minAcceptanceCriteriaCount": payload.min_acceptance_criteria_count, "minValidationEvidenceCount": payload.min_validation_evidence_count, "minSignoffCount": payload.min_signoff_count, "maxOpenHighRisks": payload.max_open_high_risks}, "blockers": blockers, "warnings": warnings, "nextActions": ["Archive final acceptance bundle and request formal stage-exit review." if decision == "pass" else "Resolve acceptance evidence blockers/warnings before stage-exit review."], "mutatesReleaseQaOrRiskSystems": False, "pythonFinalAcceptanceEvidenceReviewIsAdvisory": True, "operatorsOwnFinalAcceptance": True}
    artifact = artifact_store.write_json(prefix="platform-final-acceptance-evidence-review", artifact_type="platform.final_acceptance_evidence_review.report", payload=report, metadata={"rowCount": len(criteria_summary)+len(validation_summary)+len(test_summary)+len(risk_summary)+len(signoff_summary), "redactionApplied": True, "piiClass": "final-acceptance-evidence-metadata-only", "source": "python-final-acceptance-evidence-review"})
    return _result(job, "platform.final_acceptance_evidence_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Final acceptance evidence review is advisory; Python did not mutate release, QA, risk, task or approval systems"], [artifact])


def process_platform_stage_exit_readiness_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(StageExitReadinessReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    criteria_summary = _phase2_simple_summary(payload.exit_criteria, "exit-criterion", blockers, warnings, ("satisfied", "met", "completed"))
    handoff_summary = _phase2_simple_summary(payload.operational_handoff, "operational-handoff", blockers, warnings, ("completed", "ownerAck", "ready"))
    support_summary = _phase2_simple_summary(payload.support_readiness, "support-readiness", blockers, warnings, ("ready", "completed", "ownerAck"))
    approval_summary = _phase2_simple_summary(payload.approvals, "approval", blockers, warnings, ("approved",))
    rollback_decision = _dict_decision(payload.rollback_plan)
    evidence_bundle_decision = _dict_decision(payload.evidence_bundle)
    if len(criteria_summary) < payload.min_exit_criteria_count:
        blockers.append(f"exit criteria count {len(criteria_summary)} is below required {payload.min_exit_criteria_count}")
    if len(handoff_summary) < payload.min_handoff_count:
        blockers.append(f"handoff count {len(handoff_summary)} is below required {payload.min_handoff_count}")
    if len(support_summary) < payload.min_support_readiness_count:
        blockers.append(f"support readiness count {len(support_summary)} is below required {payload.min_support_readiness_count}")
    if len(approval_summary) < payload.min_approval_count:
        blockers.append(f"approval count {len(approval_summary)} is below required {payload.min_approval_count}")
    if payload.require_rollback_plan and (not payload.rollback_plan or rollback_decision in {"rollback", "hold"}):
        (blockers if rollback_decision == "rollback" or not payload.rollback_plan else warnings).append("rollback plan requires passing evidence")
    if payload.require_evidence_bundle and (not payload.evidence_bundle or evidence_bundle_decision in {"rollback", "hold"}):
        (blockers if evidence_bundle_decision == "rollback" or not payload.evidence_bundle else warnings).append("stage-exit evidence bundle requires passing evidence")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "stage": payload.stage, "phase": payload.phase, "targetState": payload.target_state, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "criteriaSummary": criteria_summary, "handoffSummary": handoff_summary, "supportSummary": support_summary, "approvalSummary": approval_summary, "rollbackPlanDecision": rollback_decision, "evidenceBundleDecision": evidence_bundle_decision, "evidenceStatuses": evidence_statuses, "thresholds": {"minExitCriteriaCount": payload.min_exit_criteria_count, "minHandoffCount": payload.min_handoff_count, "minSupportReadinessCount": payload.min_support_readiness_count, "minApprovalCount": payload.min_approval_count}, "blockers": blockers, "warnings": warnings, "nextActions": ["Stage-exit package is ready for operator-owned closure decision." if decision == "pass" else "Resolve stage-exit blockers/warnings before declaring migration stage complete."], "mutatesRoadmapReleaseSupportOrOwnership": False, "pythonStageExitReadinessReviewIsAdvisory": True, "operatorsOwnStageExit": True}
    artifact = artifact_store.write_json(prefix="platform-stage-exit-readiness-review", artifact_type="platform.stage_exit_readiness_review.report", payload=report, metadata={"rowCount": len(criteria_summary)+len(handoff_summary)+len(support_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "stage-exit-readiness-metadata-only", "source": "python-stage-exit-readiness-review"})
    return _result(job, "platform.stage_exit_readiness_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Stage exit readiness review is advisory; Python did not mutate roadmap, release, ownership, support queue or approval systems"], [artifact])

def process_notifications_dispatch(job: JobEnvelope) -> JobResult:
    payload = model_validate(NotificationDispatchPayload, job.payload)
    unique_recipients = sorted({recipient.strip() for recipient in payload.recipients if recipient.strip()})
    return _result(
        job,
        "notifications.dispatch.planned",
        {"channel": payload.channel, "templateId": payload.template_id, "recipientCount": len(unique_recipients), "duplicateRecipients": len(payload.recipients) - len(unique_recipients), "dispatchMode": "dry-run" if job.dry_run else "queue"},
        ["no messages were sent by Python; delivery provider ownership remains outside v3"] if job.dry_run else [],
    )


def process_analytics_snapshot(job: JobEnvelope) -> JobResult:
    payload = model_validate(AnalyticsSnapshotPayload, job.payload)
    values = payload.values
    return _result(job, "analytics.snapshot.computed", {"metric": payload.metric, "count": len(values), "min": min(values) if values else None, "max": max(values) if values else None, "avg": mean(values) if values else None, "dimensions": payload.dimensions})


def process_ai_triage_preview(job: JobEnvelope) -> JobResult:
    payload = model_validate(AiTriagePreviewPayload, job.payload)
    text = payload.text.lower()
    urgent_terms = ["chest pain", "suicidal", "stroke", "seizure", "shortness of breath", "unconscious"]
    elevated_terms = ["fever", "severe pain", "bleeding", "dizzy", "dizziness", "infection", "vomiting"]
    urgent_hits = [term for term in urgent_terms if term in text]
    elevated_hits = [term for term in elevated_terms if term in text]
    risk_level = "urgent_review" if urgent_hits else "elevated_review" if elevated_hits else "routine_review"
    return _result(job, "ai.triage_preview.generated", {"riskLevel": risk_level, "matchedSignals": urgent_hits + elevated_hits, "locale": payload.locale, "nonDiagnostic": True, "requiresClinicalReview": True}, ["preview only: not a diagnosis and not a substitute for clinician review"])



def process_platform_phase_two_closure_acceptance_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(PhaseTwoClosureAcceptanceReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    criteria_summary = _phase2_simple_summary(payload.closure_criteria, "closure-criterion", blockers, warnings, ("met",))
    evidence_summary = _phase2_simple_summary(payload.acceptance_evidence, "acceptance-evidence", blockers, warnings, ("attached", "approved"))
    approval_summary = _phase2_simple_summary(payload.approvals, "approval", blockers, warnings, ("approved",))
    if len(criteria_summary) < payload.min_criteria_count:
        blockers.append(f"closure criteria count {len(criteria_summary)} is below required {payload.min_criteria_count}")
    if not evidence_summary:
        blockers.append("at least one acceptance evidence item is required")
    open_high = 0
    risk_summary: list[dict[str, Any]] = []
    for idx, item in enumerate(payload.open_risks):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"risk-{idx}")
        decision = _dict_decision(item)
        severity = str(item.get("severity") or item.get("priority") or "").lower()
        closed = decision == "pass" or _as_bool(item.get("closed", item.get("mitigated"))) is True
        if severity in {"high", "critical", "blocker"} and not closed:
            open_high += 1
        if decision == "rollback":
            blockers.append(f"risk {name} is failing")
        elif decision == "hold" or not closed:
            warnings.append(f"risk {name} requires closure review")
        risk_summary.append({"name": name, "decision": decision or ("pass" if closed else "hold"), "severity": severity or None, "closed": closed})
    if open_high > payload.max_open_high_risks:
        blockers.append(f"open high/critical risk count {open_high} exceeds allowed {payload.max_open_high_risks}")
    if sum(1 for item in approval_summary if item.get("decision") == "pass") < payload.min_approval_count:
        blockers.append(f"approval count is below required {payload.min_approval_count}")
    value_decision = _dict_decision(payload.value_realization_summary)
    value_score = _metric_number(payload.value_realization_summary, keys=("score", "valueScore", "realizationScore"))
    if not payload.value_realization_summary:
        blockers.append("value realization summary is required")
    elif value_decision == "rollback":
        blockers.append("value realization summary is failing")
    elif value_decision == "hold":
        warnings.append("value realization summary requires review")
    if value_score is not None and value_score < payload.min_value_score:
        blockers.append(f"value realization score {value_score:g} is below required {payload.min_value_score:g}")
    support_decision = _dict_decision(payload.support_transition)
    support_ready = support_decision == "pass" or _as_bool(payload.support_transition.get("ready", payload.support_transition.get("approved"))) is True
    if payload.require_support_transition and not payload.support_transition:
        blockers.append("support transition evidence is required")
    elif support_decision == "rollback" or (payload.require_support_transition and not support_ready):
        blockers.append("support transition is failing or not ready")
    elif support_decision == "hold":
        warnings.append("support transition requires review")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("Phase 2 closure acceptance evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "phase": payload.phase, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "criteriaSummary": criteria_summary, "acceptanceEvidenceSummary": evidence_summary, "riskSummary": risk_summary, "approvalSummary": approval_summary, "valueRealizationSummary": {"decision": value_decision or ("pass" if value_score is None or value_score >= payload.min_value_score else "rollback"), "score": value_score}, "supportTransition": {"decision": support_decision or ("pass" if support_ready else "rollback"), "ready": support_ready}, "evidenceStatuses": evidence_statuses, "thresholds": {"minCriteriaCount": payload.min_criteria_count, "minApprovalCount": payload.min_approval_count, "maxOpenHighRisks": payload.max_open_high_risks, "minValueScore": payload.min_value_score}, "blockers": blockers, "warnings": warnings, "nextActions": ["Attach sanitized Phase 2 closure acceptance package." if decision == "pass" else "Resolve Phase 2 closure blockers/warnings before closure signoff."], "mutatesPhaseClosureOrRoadmap": False, "pythonPhaseTwoClosureAcceptanceReviewIsAdvisory": True, "operatorsOwnPhaseClosure": True}
    artifact = artifact_store.write_json(prefix="platform-phase-two-closure-acceptance-review", artifact_type="platform.phase_two_closure_acceptance_review.report", payload=report, metadata={"rowCount": len(criteria_summary)+len(evidence_summary)+len(risk_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "phase-two-closure-acceptance-metadata-only", "source": "python-phase-two-closure-acceptance-review"})
    return _result(job, "platform.phase_two_closure_acceptance_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Phase 2 closure acceptance review is advisory; Python did not close phases, mutate roadmap state, publish executive reporting or change rollout controls"], [artifact])


def process_platform_phase_three_transition_readiness_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(PhaseThreeTransitionReadinessReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    milestone_summary = _phase2_simple_summary(payload.transition_milestones, "transition-milestone", blockers, warnings, ("completed",))
    dependency_summary = _phase2_simple_summary(payload.dependency_readiness, "dependency", blockers, warnings, ("ready",))
    handoff_summary = _phase2_simple_summary(payload.owner_handoffs, "owner-handoff", blockers, warnings, ("accepted",))
    guardrail_summary = _phase2_simple_summary(payload.rollout_guardrails, "rollout-guardrail", blockers, warnings, ("enabled",))
    criteria_summary = _phase2_simple_summary(payload.entry_criteria, "entry-criterion", blockers, warnings, ("met",))
    approval_summary = _phase2_simple_summary(payload.approvals, "approval", blockers, warnings, ("approved",))
    if len(milestone_summary) < payload.min_milestone_count:
        blockers.append(f"transition milestone count {len(milestone_summary)} is below required {payload.min_milestone_count}")
    if len(handoff_summary) < payload.min_owner_handoff_count:
        blockers.append(f"owner handoff count {len(handoff_summary)} is below required {payload.min_owner_handoff_count}")
    if payload.require_guardrails and not guardrail_summary:
        blockers.append("Phase 3 rollout guardrails are required")
    if payload.require_entry_criteria and not criteria_summary:
        blockers.append("Phase 3 entry criteria are required")
    if sum(1 for item in approval_summary if item.get("decision") == "pass") < payload.min_approval_count:
        blockers.append(f"approval count is below required {payload.min_approval_count}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("Phase 3 transition readiness evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "phase": payload.phase, "nextPhase": payload.next_phase, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "milestoneSummary": milestone_summary, "dependencySummary": dependency_summary, "handoffSummary": handoff_summary, "guardrailSummary": guardrail_summary, "entryCriteriaSummary": criteria_summary, "approvalSummary": approval_summary, "evidenceStatuses": evidence_statuses, "thresholds": {"minMilestoneCount": payload.min_milestone_count, "minOwnerHandoffCount": payload.min_owner_handoff_count, "minApprovalCount": payload.min_approval_count}, "blockers": blockers, "warnings": warnings, "nextActions": ["Attach sanitized Phase 3 transition readiness package." if decision == "pass" else "Resolve Phase 3 transition blockers/warnings before entering the next phase."], "mutatesPhaseTransitionOrTraffic": False, "pythonPhaseThreeTransitionReadinessReviewIsAdvisory": True, "operatorsOwnPhaseTransition": True}
    artifact = artifact_store.write_json(prefix="platform-phase-three-transition-readiness-review", artifact_type="platform.phase_three_transition_readiness_review.report", payload=report, metadata={"rowCount": len(milestone_summary)+len(dependency_summary)+len(handoff_summary)+len(guardrail_summary)+len(criteria_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "phase-three-transition-readiness-metadata-only", "source": "python-phase-three-transition-readiness-review"})
    return _result(job, "platform.phase_three_transition_readiness_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Phase 3 transition readiness review is advisory; Python did not change traffic, transition ownership, enable features or execute rollout actions"], [artifact])


def process_platform_phase_three_domain_wave_readiness_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(PhaseThreeDomainWaveReadinessReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    domain_summary = _phase2_simple_summary(payload.domains, "domain", blockers, warnings, ("waveReady", "ownerAck", "rollbackReady"))
    criteria_summary = _phase2_simple_summary(payload.wave_criteria, "wave-criterion", blockers, warnings, ("met",))
    guardrail_summary = _phase2_simple_summary(payload.guardrails, "guardrail", blockers, warnings, ("enabled",))
    support_summary = _phase2_simple_summary(payload.support_coverage, "support-coverage", blockers, warnings, ("ready",))
    rollback_summary = _phase2_simple_summary(payload.rollback_coverage, "rollback-coverage", blockers, warnings, ("tested",))
    approval_summary = _phase2_simple_summary(payload.approvals, "approval", blockers, warnings, ("approved",))
    if len(domain_summary) < payload.min_domain_count:
        blockers.append(f"domain count {len(domain_summary)} is below required {payload.min_domain_count}")
    if not criteria_summary:
        blockers.append("at least one Phase 3 wave criterion is required")
    if len(guardrail_summary) < payload.min_guardrail_count:
        blockers.append(f"guardrail count {len(guardrail_summary)} is below required {payload.min_guardrail_count}")
    if payload.require_support_coverage and not support_summary:
        blockers.append("support coverage is required for Phase 3 domain wave readiness")
    if payload.require_rollback_coverage and not rollback_summary:
        blockers.append("rollback coverage is required for Phase 3 domain wave readiness")
    if sum(1 for item in approval_summary if item.get("decision") == "pass") < payload.min_approval_count:
        blockers.append(f"approval count is below required {payload.min_approval_count}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("Phase 3 domain wave readiness evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback": blockers.append(f"evidence {name} is failing")
        elif status == "hold": warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "phase": payload.phase, "waveId": payload.wave_id, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "domainSummary": domain_summary, "criteriaSummary": criteria_summary, "guardrailSummary": guardrail_summary, "supportSummary": support_summary, "rollbackSummary": rollback_summary, "approvalSummary": approval_summary, "evidenceStatuses": evidence_statuses, "thresholds": {"minDomainCount": payload.min_domain_count, "minGuardrailCount": payload.min_guardrail_count, "minApprovalCount": payload.min_approval_count}, "blockers": blockers, "warnings": warnings, "nextActions": ["Attach sanitized Phase 3 domain-wave readiness package." if decision == "pass" else "Resolve Phase 3 domain-wave blockers/warnings before operator-owned wave launch."], "mutatesWaveTrafficOrFlags": False, "pythonPhaseThreeDomainWaveReadinessReviewIsAdvisory": True, "operatorsOwnDomainWaveRollout": True}
    artifact = artifact_store.write_json(prefix="platform-phase-three-domain-wave-readiness-review", artifact_type="platform.phase_three_domain_wave_readiness_review.report", payload=report, metadata={"rowCount": len(domain_summary)+len(criteria_summary)+len(guardrail_summary)+len(support_summary)+len(rollback_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "phase-three-domain-wave-readiness-metadata-only", "source": "python-phase-three-domain-wave-readiness-review"})
    return _result(job, "platform.phase_three_domain_wave_readiness_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Phase 3 domain wave readiness review is advisory; Python did not launch waves, mutate traffic, change feature flags or contact customers"], [artifact])


def process_platform_phase_three_operating_model_alignment_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(PhaseThreeOperatingModelAlignmentReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    owner_summary = _phase2_simple_summary(payload.ownership_matrix, "owner", blockers, warnings, ("accepted",))
    support_summary = _phase2_simple_summary(payload.support_model, "support-model", blockers, warnings, ("ready",))
    runbook_summary = _phase2_simple_summary(payload.runbook_coverage, "runbook", blockers, warnings, ("published", "ownerAck"))
    metric_summary = _phase2_simple_summary(payload.metric_governance, "metric-governance", blockers, warnings, ("enabled", "ownerAck"))
    training_summary = _phase2_simple_summary(payload.training_coverage, "training", blockers, warnings, ("completed",))
    escalation_summary = _phase2_simple_summary(payload.escalation_model, "escalation", blockers, warnings, ("documented", "ownerAck"))
    approval_summary = _phase2_simple_summary(payload.approvals, "approval", blockers, warnings, ("approved",))
    if len(owner_summary) < payload.min_owner_count:
        blockers.append(f"ownership acknowledgement count {len(owner_summary)} is below required {payload.min_owner_count}")
    if payload.require_support_model and not support_summary:
        blockers.append("support model alignment evidence is required")
    if len(runbook_summary) < payload.min_runbook_count:
        blockers.append(f"runbook coverage count {len(runbook_summary)} is below required {payload.min_runbook_count}")
    if payload.require_metrics and not metric_summary:
        blockers.append("metric governance evidence is required")
    if payload.require_training and not training_summary:
        blockers.append("training coverage evidence is required")
    if not escalation_summary:
        blockers.append("escalation model evidence is required")
    if sum(1 for item in approval_summary if item.get("decision") == "pass") < payload.min_approval_count:
        blockers.append(f"approval count is below required {payload.min_approval_count}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("Phase 3 operating model alignment evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback": blockers.append(f"evidence {name} is failing")
        elif status == "hold": warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "phase": payload.phase, "operatingModel": payload.operating_model, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "ownerSummary": owner_summary, "supportSummary": support_summary, "runbookSummary": runbook_summary, "metricSummary": metric_summary, "trainingSummary": training_summary, "escalationSummary": escalation_summary, "approvalSummary": approval_summary, "evidenceStatuses": evidence_statuses, "thresholds": {"minOwnerCount": payload.min_owner_count, "minRunbookCount": payload.min_runbook_count, "minApprovalCount": payload.min_approval_count}, "blockers": blockers, "warnings": warnings, "nextActions": ["Attach sanitized Phase 3 operating model alignment package." if decision == "pass" else "Resolve Phase 3 operating model blockers/warnings before scale-out."], "mutatesOperatingModelSupportOrStaffing": False, "pythonPhaseThreeOperatingModelAlignmentReviewIsAdvisory": True, "operatorsOwnOperatingModel": True}
    artifact = artifact_store.write_json(prefix="platform-phase-three-operating-model-alignment-review", artifact_type="platform.phase_three_operating_model_alignment_review.report", payload=report, metadata={"rowCount": len(owner_summary)+len(support_summary)+len(runbook_summary)+len(metric_summary)+len(training_summary)+len(escalation_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "phase-three-operating-model-alignment-metadata-only", "source": "python-phase-three-operating-model-alignment-review"})
    return _result(job, "platform.phase_three_operating_model_alignment_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Phase 3 operating model alignment review is advisory; Python did not assign staff, mutate support queues, publish governance records or change traffic"], [artifact])


def process_platform_phase_three_wave_execution_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(PhaseThreeWaveExecutionReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    execution_summary = _phase2_simple_summary(payload.wave_execution, "wave-execution", blockers, warnings, ("executed", "completed", "complete"))
    signal_summary = _phase2_simple_summary(payload.domain_signals, "domain-signal", blockers, warnings, ("healthy", "stable", "ok"))
    guardrail_summary = _phase2_simple_summary(payload.guardrail_checks, "guardrail-check", blockers, warnings, ("passed", "enabled", "met"))
    rollback_summary = _phase2_simple_summary(payload.rollback_readiness, "rollback-readiness", blockers, warnings, ("ready", "tested"))
    approval_summary = _phase2_simple_summary(payload.approvals, "approval", blockers, warnings, ("approved",))
    if len(execution_summary) < payload.min_executed_domain_count:
        blockers.append(f"executed domain count {len(execution_summary)} is below required {payload.min_executed_domain_count}")
    if payload.require_rollback_readiness and not rollback_summary:
        blockers.append("Phase 3 rollback readiness evidence is required during wave execution")
    open_critical = 0
    incident_summary: list[dict[str, Any]] = []
    for idx, item in enumerate(payload.support_incidents):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"incident-{idx}")
        decision = _dict_decision(item)
        severity = str(item.get("severity") or item.get("priority") or "").lower()
        closed = decision == "pass" or _as_bool(item.get("closed", item.get("resolved"))) is True
        if severity in {"critical", "blocker", "sev1"} and not closed:
            open_critical += 1
        if decision == "rollback":
            blockers.append(f"support incident {name} is failing")
        elif decision == "hold" or not closed:
            warnings.append(f"support incident {name} requires review")
        incident_summary.append({"name": name, "decision": decision or ("pass" if closed else "hold"), "severity": severity or None, "closed": closed})
    if open_critical > payload.max_open_critical_incidents:
        blockers.append(f"open critical incident count {open_critical} exceeds allowed {payload.max_open_critical_incidents}")
    if sum(1 for item in approval_summary if item.get("decision") == "pass") < payload.min_approval_count:
        blockers.append(f"approval count is below required {payload.min_approval_count}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("Phase 3 wave execution evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "phase": payload.phase, "waveId": payload.wave_id, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "executionSummary": execution_summary, "domainSignalSummary": signal_summary, "guardrailSummary": guardrail_summary, "rollbackSummary": rollback_summary, "incidentSummary": incident_summary, "approvalSummary": approval_summary, "evidenceStatuses": evidence_statuses, "thresholds": {"minExecutedDomainCount": payload.min_executed_domain_count, "maxOpenCriticalIncidents": payload.max_open_critical_incidents, "minApprovalCount": payload.min_approval_count}, "blockers": blockers, "warnings": warnings, "nextActions": ["Attach sanitized Phase 3 wave execution package." if decision == "pass" else "Resolve Phase 3 wave execution blockers/warnings before expanding the wave."], "mutatesWaveExecutionOrTraffic": False, "pythonPhaseThreeWaveExecutionReviewIsAdvisory": True, "operatorsOwnWaveExecution": True}
    artifact = artifact_store.write_json(prefix="platform-phase-three-wave-execution-review", artifact_type="platform.phase_three_wave_execution_review.report", payload=report, metadata={"rowCount": len(execution_summary)+len(signal_summary)+len(guardrail_summary)+len(rollback_summary)+len(incident_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "phase-three-wave-execution-metadata-only", "source": "python-phase-three-wave-execution-review"})
    return _result(job, "platform.phase_three_wave_execution_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Phase 3 wave execution review is advisory; Python did not execute waves, increase traffic, mutate feature flags or contact customers"], [artifact])


def process_platform_phase_three_adoption_value_tracking_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(PhaseThreeAdoptionValueTrackingReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    adoption_summary = _phase2_simple_summary(payload.adoption_metrics, "adoption-metric", blockers, warnings, ("met", "healthy", "realized"))
    value_summary = _phase2_simple_summary(payload.value_metrics, "value-metric", blockers, warnings, ("met", "realized", "validated"))
    hypothesis_summary = _phase2_simple_summary(payload.benefit_hypotheses, "benefit-hypothesis", blockers, warnings, ("validated", "met", "approved"))
    owner_summary = _phase2_simple_summary(payload.owner_reviews, "owner-review", blockers, warnings, ("completed", "approved", "accepted"))
    approval_summary = _phase2_simple_summary(payload.approvals, "approval", blockers, warnings, ("approved",))
    adoption_scores = [_metric_number(item, keys=("score", "adoptionScore", "value")) for item in payload.adoption_metrics if isinstance(item, dict)]
    value_scores = [_metric_number(item, keys=("score", "valueScore", "value")) for item in payload.value_metrics if isinstance(item, dict)]
    adoption_scores = [score for score in adoption_scores if score is not None]
    value_scores = [score for score in value_scores if score is not None]
    min_adoption_observed = min(adoption_scores) if adoption_scores else None
    min_value_observed = min(value_scores) if value_scores else None
    if not adoption_summary:
        blockers.append("at least one adoption metric is required")
    if not value_summary:
        blockers.append("at least one value metric is required")
    if min_adoption_observed is not None and min_adoption_observed < payload.min_adoption_score:
        blockers.append(f"minimum adoption score {min_adoption_observed:g} is below required {payload.min_adoption_score:g}")
    if min_value_observed is not None and min_value_observed < payload.min_value_score:
        blockers.append(f"minimum value score {min_value_observed:g} is below required {payload.min_value_score:g}")
    critical_feedback = 0
    feedback_summary: list[dict[str, Any]] = []
    for idx, item in enumerate(payload.user_feedback):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"feedback-{idx}")
        decision = _dict_decision(item)
        severity = str(item.get("severity") or item.get("priority") or "").lower()
        addressed = decision == "pass" or _as_bool(item.get("addressed", item.get("closed"))) is True
        if severity in {"critical", "blocker", "sev1"} and not addressed:
            critical_feedback += 1
        if decision == "rollback":
            blockers.append(f"user feedback {name} is failing")
        elif decision == "hold" or not addressed:
            warnings.append(f"user feedback {name} requires review")
        feedback_summary.append({"name": name, "decision": decision or ("pass" if addressed else "hold"), "severity": severity or None, "addressed": addressed})
    if payload.require_feedback_review and not feedback_summary:
        blockers.append("Phase 3 user feedback review is required")
    if critical_feedback > payload.max_critical_feedback:
        blockers.append(f"critical feedback count {critical_feedback} exceeds allowed {payload.max_critical_feedback}")
    if sum(1 for item in approval_summary if item.get("decision") == "pass") < payload.min_approval_count:
        blockers.append(f"approval count is below required {payload.min_approval_count}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("Phase 3 adoption/value evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "phase": payload.phase, "waveId": payload.wave_id, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "adoptionSummary": adoption_summary, "valueSummary": value_summary, "feedbackSummary": feedback_summary, "benefitHypothesisSummary": hypothesis_summary, "ownerReviewSummary": owner_summary, "approvalSummary": approval_summary, "evidenceStatuses": evidence_statuses, "thresholds": {"minAdoptionScore": payload.min_adoption_score, "minValueScore": payload.min_value_score, "maxCriticalFeedback": payload.max_critical_feedback, "minApprovalCount": payload.min_approval_count}, "observedScores": {"minAdoptionScore": min_adoption_observed, "minValueScore": min_value_observed}, "blockers": blockers, "warnings": warnings, "nextActions": ["Attach sanitized Phase 3 adoption and value tracking package." if decision == "pass" else "Resolve Phase 3 adoption/value blockers/warnings before expanding rollout."], "mutatesAdoptionMetricsOrRoadmap": False, "pythonPhaseThreeAdoptionValueTrackingReviewIsAdvisory": True, "operatorsOwnValueTracking": True}
    artifact = artifact_store.write_json(prefix="platform-phase-three-adoption-value-tracking-review", artifact_type="platform.phase_three_adoption_value_tracking_review.report", payload=report, metadata={"rowCount": len(adoption_summary)+len(value_summary)+len(feedback_summary)+len(hypothesis_summary)+len(owner_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "phase-three-adoption-value-tracking-metadata-only", "source": "python-phase-three-adoption-value-tracking-review"})
    return _result(job, "platform.phase_three_adoption_value_tracking_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Phase 3 adoption value tracking review is advisory; Python did not mutate metrics stores, publish executive reports, change roadmap state or alter traffic"], [artifact])


def process_platform_phase_three_gap_remediation_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(PhaseThreeGapRemediationReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    remediation_summary = _phase2_simple_summary(payload.remediation_items, "remediation-item", blockers, warnings, ("ownerAck",))
    owner_summary = _phase2_simple_summary(payload.owner_actions, "owner-action", blockers, warnings, ("completed", "ownerAck"))
    acceptance_summary = _phase2_simple_summary(payload.risk_acceptances, "risk-acceptance", blockers, warnings, ("accepted", "ownerAck"))
    risk_summary: list[dict[str, Any]] = []
    open_critical = 0
    for idx, item in enumerate(payload.open_risks):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"risk-{idx}")
        decision = _dict_decision(item)
        severity = str(item.get("severity") or item.get("priority") or "").lower()
        closed = decision == "pass" or _as_bool(item.get("closed", item.get("mitigated"))) is True
        if severity in {"critical", "blocker", "sev1", "high"} and not closed:
            open_critical += 1
        if decision == "rollback":
            blockers.append(f"open risk {name} is failing")
        elif decision == "hold" or not closed:
            warnings.append(f"open risk {name} requires remediation review")
        risk_summary.append({"name": name, "decision": decision or ("pass" if closed else "hold"), "severity": severity or None, "closed": closed})
    if not remediation_summary:
        blockers.append("at least one sanitized remediation item is required")
    if open_critical > payload.max_open_critical_gaps:
        blockers.append(f"open critical/high gap count {open_critical} exceeds allowed {payload.max_open_critical_gaps}")
    if len(owner_summary) < payload.min_owner_action_count:
        blockers.append(f"owner action count {len(owner_summary)} is below required {payload.min_owner_action_count}")
    if payload.require_risk_acceptance and len(acceptance_summary) < payload.min_risk_acceptance_count:
        blockers.append(f"risk acceptance count {len(acceptance_summary)} is below required {payload.min_risk_acceptance_count}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("Phase 3 remediation evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "phase": payload.phase, "waveId": payload.wave_id, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "remediationSummary": remediation_summary, "riskSummary": risk_summary, "riskAcceptanceSummary": acceptance_summary, "ownerActionSummary": owner_summary, "evidenceStatuses": evidence_statuses, "thresholds": {"maxOpenCriticalGaps": payload.max_open_critical_gaps, "minOwnerActionCount": payload.min_owner_action_count, "minRiskAcceptanceCount": payload.min_risk_acceptance_count}, "blockers": blockers, "warnings": warnings, "nextActions": ["Attach sanitized gap remediation closeout package." if decision == "pass" else "Resolve Phase 3 remediation blockers/warnings before declaring the wave complete."], "mutatesBacklogRisksOrRollout": False, "pythonPhaseThreeGapRemediationReviewIsAdvisory": True, "operatorsOwnRemediation": True}
    artifact = artifact_store.write_json(prefix="platform-phase-three-gap-remediation-review", artifact_type="platform.phase_three_gap_remediation_review.report", payload=report, metadata={"rowCount": len(remediation_summary)+len(risk_summary)+len(acceptance_summary)+len(owner_summary), "redactionApplied": True, "piiClass": "phase-three-gap-remediation-metadata-only", "source": "python-phase-three-gap-remediation-review"})
    return _result(job, "platform.phase_three_gap_remediation_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Phase 3 gap remediation review is advisory; Python did not mutate backlog, risks, tickets, rollout state or approvals"], [artifact])


def process_platform_migration_stage_completion_readiness_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(MigrationStageCompletionReadinessReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    criteria_summary = _phase2_simple_summary(payload.completion_criteria, "completion-criterion", blockers, warnings, ("met",))
    validation_summary = _phase2_simple_summary(payload.validation_results, "validation-result", blockers, warnings, ("passed",))
    approval_summary = _phase2_simple_summary(payload.closure_approvals, "closure-approval", blockers, warnings, ("approved",))
    risk_summary: list[dict[str, Any]] = []
    open_high = 0
    for idx, item in enumerate(payload.residual_risks):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"residual-risk-{idx}")
        decision = _dict_decision(item)
        severity = str(item.get("severity") or item.get("priority") or "").lower()
        accepted = _as_bool(item.get("accepted", item.get("ownerAccepted"))) is True
        closed = decision == "pass" or _as_bool(item.get("closed", item.get("mitigated"))) is True or accepted
        if severity in {"high", "critical", "blocker", "sev1"} and not closed:
            open_high += 1
        if decision == "rollback":
            blockers.append(f"residual risk {name} is failing")
        elif decision == "hold" or not closed:
            warnings.append(f"residual risk {name} requires acceptance or mitigation")
        risk_summary.append({"name": name, "decision": decision or ("pass" if closed else "hold"), "severity": severity or None, "closedOrAccepted": closed})
    if len(criteria_summary) < payload.min_criteria_count:
        blockers.append(f"completion criterion count {len(criteria_summary)} is below required {payload.min_criteria_count}")
    if payload.require_validation_results and len(validation_summary) < payload.min_validation_count:
        blockers.append(f"validation result count {len(validation_summary)} is below required {payload.min_validation_count}")
    if open_high > payload.max_open_high_risks:
        blockers.append(f"open high/critical residual risk count {open_high} exceeds allowed {payload.max_open_high_risks}")
    if sum(1 for item in approval_summary if item.get("decision") == "pass") < payload.min_approval_count:
        blockers.append(f"closure approval count is below required {payload.min_approval_count}")
    evidence_statuses = _evidence_status_map(payload.final_evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("migration stage final evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"final evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"final evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "stage": payload.stage, "phase": payload.phase, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "criteriaSummary": criteria_summary, "validationSummary": validation_summary, "residualRiskSummary": risk_summary, "approvalSummary": approval_summary, "finalEvidenceStatuses": evidence_statuses, "thresholds": {"minCriteriaCount": payload.min_criteria_count, "minValidationCount": payload.min_validation_count, "maxOpenHighRisks": payload.max_open_high_risks, "minApprovalCount": payload.min_approval_count}, "blockers": blockers, "warnings": warnings, "nextActions": ["Attach sanitized migration-stage completion package and request operator closeout." if decision == "pass" else "Resolve stage completion blockers/warnings before closing this migration stage."], "mutatesStageRoadmapOrRollout": False, "pythonMigrationStageCompletionReadinessReviewIsAdvisory": True, "operatorsOwnStageCloseout": True}
    artifact = artifact_store.write_json(prefix="platform-migration-stage-completion-readiness-review", artifact_type="platform.migration_stage_completion_readiness_review.report", payload=report, metadata={"rowCount": len(criteria_summary)+len(validation_summary)+len(risk_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "migration-stage-completion-readiness-metadata-only", "source": "python-migration-stage-completion-readiness-review"})
    return _result(job, "platform.migration_stage_completion_readiness_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Migration stage completion readiness review is advisory; Python did not close phases, mutate roadmap, approve risks or change rollout state"], [artifact])



def process_platform_phase_three_remediation_closure_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(PhaseThreeRemediationClosureReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    closure_summary = _phase2_simple_summary(payload.closure_items, "closure-item", blockers, warnings, ("closed", "ownerAck"))
    remediation_summary = _phase2_simple_summary(payload.remediation_evidence, "remediation-evidence", blockers, warnings, ("validated",))
    acceptance_summary = _phase2_simple_summary(payload.acceptance_records, "acceptance-record", blockers, warnings, ("accepted", "ownerAck"))
    approval_summary = _phase2_simple_summary(payload.owner_approvals, "owner-approval", blockers, warnings, ("approved",))
    risk_summary: list[dict[str, Any]] = []
    open_high = 0
    for idx, item in enumerate(payload.residual_risks):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"residual-risk-{idx}")
        decision = _dict_decision(item)
        severity = str(item.get("severity") or item.get("priority") or "").lower()
        closed = decision == "pass" or _as_bool(item.get("closed", item.get("accepted", item.get("mitigated")))) is True
        if severity in {"high", "critical", "blocker", "sev1"} and not closed:
            open_high += 1
        if decision == "rollback":
            blockers.append(f"residual risk {name} is failing")
        elif decision == "hold" or not closed:
            warnings.append(f"residual risk {name} requires closure review")
        risk_summary.append({"name": name, "decision": decision or ("pass" if closed else "hold"), "severity": severity or None, "closed": closed})
    if len(closure_summary) < payload.min_closure_item_count:
        blockers.append(f"closure item count {len(closure_summary)} is below required {payload.min_closure_item_count}")
    if len(remediation_summary) < payload.min_remediation_evidence_count:
        blockers.append(f"remediation evidence count {len(remediation_summary)} is below required {payload.min_remediation_evidence_count}")
    if payload.require_acceptance_records and not acceptance_summary:
        blockers.append("acceptance records are required for remediation closure")
    if len(approval_summary) < payload.min_approval_count:
        blockers.append(f"owner approval count {len(approval_summary)} is below required {payload.min_approval_count}")
    if open_high > payload.max_open_high_risks:
        blockers.append(f"open high/critical residual risk count {open_high} exceeds allowed {payload.max_open_high_risks}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("Phase 3 remediation closure evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "stage": payload.stage, "phase": payload.phase, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "closureSummary": closure_summary, "remediationEvidenceSummary": remediation_summary, "riskSummary": risk_summary, "acceptanceSummary": acceptance_summary, "approvalSummary": approval_summary, "evidenceStatuses": evidence_statuses, "thresholds": {"minClosureItemCount": payload.min_closure_item_count, "minRemediationEvidenceCount": payload.min_remediation_evidence_count, "maxOpenHighRisks": payload.max_open_high_risks, "minApprovalCount": payload.min_approval_count}, "blockers": blockers, "warnings": warnings, "nextActions": ["Attach sanitized Phase 3 remediation closure package." if decision == "pass" else "Resolve remediation closure blockers/warnings before executive handoff."], "mutatesRemediationTicketsOrRisks": False, "pythonPhaseThreeRemediationClosureReviewIsAdvisory": True, "operatorsOwnRemediationClosure": True}
    artifact = artifact_store.write_json(prefix="platform-phase-three-remediation-closure-review", artifact_type="platform.phase_three_remediation_closure_review.report", payload=report, metadata={"rowCount": len(closure_summary)+len(remediation_summary)+len(risk_summary)+len(acceptance_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "phase-three-remediation-closure-metadata-only", "source": "python-phase-three-remediation-closure-review"})
    return _result(job, "platform.phase_three_remediation_closure_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Phase 3 remediation closure review is advisory; Python did not close tickets, approve risks, mutate backlog or change rollout state"], [artifact])


def process_platform_executive_operational_handoff_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(ExecutiveOperationalHandoffReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    handoff_summary = _phase2_simple_summary(payload.handoff_items, "handoff-item", blockers, warnings, ("completed", "ownerAck"))
    support_summary = _phase2_simple_summary(payload.support_model, "support-model", blockers, warnings, ("ready", "ownerAck"))
    kpi_summary = _phase2_simple_summary(payload.kpi_baselines, "kpi-baseline", blockers, warnings, ("baselined",))
    governance_summary = _phase2_simple_summary(payload.governance_decisions, "governance-decision", blockers, warnings, ("approved",))
    approval_summary = _phase2_simple_summary(payload.approvals, "approval", blockers, warnings, ("approved",))
    executive_decision = _dict_decision(payload.executive_summary)
    executive_score = _metric_number(payload.executive_summary, keys=("score", "readinessScore", "handoffScore"))
    if executive_decision == "rollback":
        blockers.append("executive summary is failing")
    elif executive_decision == "hold":
        warnings.append("executive summary requires review")
    if len(handoff_summary) < payload.min_handoff_item_count:
        blockers.append(f"handoff item count {len(handoff_summary)} is below required {payload.min_handoff_item_count}")
    if payload.require_support_model and not support_summary:
        blockers.append("support model readiness is required")
    if len(kpi_summary) < payload.min_kpi_baseline_count:
        blockers.append(f"KPI baseline count {len(kpi_summary)} is below required {payload.min_kpi_baseline_count}")
    if len(approval_summary) < payload.min_approval_count:
        blockers.append(f"approval count {len(approval_summary)} is below required {payload.min_approval_count}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("executive operational handoff evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "stage": payload.stage, "phase": payload.phase, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "executiveSummary": {"decision": executive_decision or ("pass" if executive_score is None else "pass"), "score": executive_score}, "handoffSummary": handoff_summary, "supportModelSummary": support_summary, "kpiBaselineSummary": kpi_summary, "governanceDecisionSummary": governance_summary, "approvalSummary": approval_summary, "evidenceStatuses": evidence_statuses, "thresholds": {"minHandoffItemCount": payload.min_handoff_item_count, "minKpiBaselineCount": payload.min_kpi_baseline_count, "minApprovalCount": payload.min_approval_count}, "blockers": blockers, "warnings": warnings, "nextActions": ["Attach sanitized executive operational handoff package and archive stage evidence." if decision == "pass" else "Resolve executive handoff blockers/warnings before final stage exit."], "mutatesOwnershipSupportOrMetrics": False, "pythonExecutiveOperationalHandoffReviewIsAdvisory": True, "operatorsOwnExecutiveHandoff": True}
    artifact = artifact_store.write_json(prefix="platform-executive-operational-handoff-review", artifact_type="platform.executive_operational_handoff_review.report", payload=report, metadata={"rowCount": len(handoff_summary)+len(support_summary)+len(kpi_summary)+len(governance_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "executive-operational-handoff-metadata-only", "source": "python-executive-operational-handoff-review"})
    return _result(job, "platform.executive_operational_handoff_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Executive operational handoff review is advisory; Python did not assign ownership, publish executive metrics, change support queues or close the stage"], [artifact])


def process_platform_global_task_status_tracking_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(GlobalTaskStatusTrackingReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    task_summary = _phase2_simple_summary(payload.tasks, "task", blockers, warnings, ("completed", "done", "ownerAck", "evidence"))
    milestone_summary = _phase2_simple_summary(payload.milestones, "milestone", blockers, warnings, ("completed", "done"))
    owner_summary = _phase2_simple_summary(payload.owners, "owner", blockers, warnings, ("ownerAck", "approved"))
    approval_summary = _phase2_simple_summary(payload.approvals, "approval", blockers, warnings, ("approved",))
    blocker_summary: list[dict[str, Any]] = []
    open_critical = 0
    for idx, item in enumerate(payload.blockers):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"blocker-{idx}")
        decision = _dict_decision(item)
        severity = str(item.get("severity") or item.get("priority") or "").lower()
        closed = decision == "pass" or _as_bool(item.get("closed", item.get("resolved"))) is True
        if severity in {"critical", "blocker", "sev1", "high"} and not closed:
            open_critical += 1
        if decision == "rollback":
            blockers.append(f"blocker {name} is failing")
        elif decision == "hold" or not closed:
            warnings.append(f"blocker {name} requires closure review")
        blocker_summary.append({"name": name, "decision": decision or ("pass" if closed else "hold"), "severity": severity or None, "closed": closed})
    if len(task_summary) < payload.min_task_count:
        blockers.append(f"task count {len(task_summary)} is below required {payload.min_task_count}")
    if len(milestone_summary) < payload.min_milestone_count:
        blockers.append(f"milestone count {len(milestone_summary)} is below required {payload.min_milestone_count}")
    if len(owner_summary) < payload.min_owner_count:
        blockers.append(f"owner acknowledgement count {len(owner_summary)} is below required {payload.min_owner_count}")
    if len(approval_summary) < payload.min_approval_count:
        blockers.append(f"approval count {len(approval_summary)} is below required {payload.min_approval_count}")
    if open_critical > payload.max_open_critical_blockers:
        blockers.append(f"open critical/high blocker count {open_critical} exceeds allowed {payload.max_open_critical_blockers}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("global task status evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    completed_tasks = sum(1 for item in task_summary if item.get("decision") == "pass")
    completion_rate = completed_tasks / len(task_summary) if task_summary else 0.0
    report = {"releaseId": payload.release_id, "stage": payload.stage, "phase": payload.phase, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "taskSummary": task_summary, "milestoneSummary": milestone_summary, "ownerSummary": owner_summary, "blockerSummary": blocker_summary, "approvalSummary": approval_summary, "evidenceStatuses": evidence_statuses, "completionRate": completion_rate, "thresholds": {"minTaskCount": payload.min_task_count, "minMilestoneCount": payload.min_milestone_count, "minOwnerCount": payload.min_owner_count, "minApprovalCount": payload.min_approval_count, "maxOpenCriticalBlockers": payload.max_open_critical_blockers}, "blockers": blockers, "warnings": warnings, "nextActions": ["Attach sanitized closure tracker and archive global status evidence." if decision == "pass" else "Resolve task-status blockers/warnings before closing the migration stage."], "mutatesTicketsTasksOrOwners": False, "pythonGlobalTaskStatusTrackingReviewIsAdvisory": True, "operatorsOwnTaskTracker": True}
    artifact = artifact_store.write_json(prefix="platform-global-task-status-tracking-review", artifact_type="platform.global_task_status_tracking_review.report", payload=report, metadata={"rowCount": len(task_summary)+len(milestone_summary)+len(owner_summary)+len(blocker_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "global-task-status-tracking-metadata-only", "source": "python-global-task-status-tracking-review"})
    return _result(job, "platform.global_task_status_tracking_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Global task status tracking review is advisory; Python did not mutate tasks, tickets, owners, status dashboards or approvals"], [artifact])


def process_platform_project_state_health_review(job: JobEnvelope) -> JobResult:
    payload = model_validate(ProjectStateHealthReviewPayload, job.payload)
    blockers: list[str] = []
    warnings: list[str] = []
    application_summary = _phase2_simple_summary(payload.applications, "application", blockers, warnings, ("ownerAck", "ready"))
    criteria_summary = _phase2_simple_summary(payload.closure_criteria, "closure-criterion", blockers, warnings, ("satisfied", "completed"))
    approval_summary = _phase2_simple_summary(payload.approvals, "approval", blockers, warnings, ("approved",))
    app_scores = [_metric_number(item, keys=("completionPercent", "completion", "score", "readinessScore")) for item in payload.applications if isinstance(item, dict)]
    app_scores = [score for score in app_scores if score is not None]
    migration_score = _metric_number(payload.migration_status, keys=("completionPercent", "completion", "score", "readinessScore"))
    min_observed_completion = min(app_scores + ([migration_score] if migration_score is not None else [])) if (app_scores or migration_score is not None) else None
    risk_summary: list[dict[str, Any]] = []
    open_high = 0
    for idx, item in enumerate(payload.risk_register):
        if not isinstance(item, dict):
            continue
        name = _metadata_name(item, f"risk-{idx}")
        decision = _dict_decision(item)
        severity = str(item.get("severity") or item.get("priority") or "").lower()
        closed = decision == "pass" or _as_bool(item.get("closed", item.get("mitigated"))) is True
        if severity in {"critical", "blocker", "sev1", "high"} and not closed:
            open_high += 1
        if decision == "rollback":
            blockers.append(f"risk {name} is failing")
        elif decision == "hold" or not closed:
            warnings.append(f"risk {name} requires review")
        risk_summary.append({"name": name, "decision": decision or ("pass" if closed else "hold"), "severity": severity or None, "closed": closed})
    migration_decision = _dict_decision(payload.migration_status)
    if migration_decision == "rollback":
        blockers.append("migration status is failing")
    elif migration_decision == "hold":
        warnings.append("migration status requires review")
    if len(application_summary) < payload.min_application_count:
        blockers.append(f"application status count {len(application_summary)} is below required {payload.min_application_count}")
    if min_observed_completion is not None and min_observed_completion < payload.min_completion_percent:
        blockers.append(f"minimum completion percent {min_observed_completion:g} is below required {payload.min_completion_percent:g}")
    if len(criteria_summary) < payload.min_closure_criteria_count:
        blockers.append(f"closure criteria count {len(criteria_summary)} is below required {payload.min_closure_criteria_count}")
    if len(approval_summary) < payload.min_approval_count:
        blockers.append(f"approval count {len(approval_summary)} is below required {payload.min_approval_count}")
    if open_high > payload.max_open_high_risks:
        blockers.append(f"open high/critical risk count {open_high} exceeds allowed {payload.max_open_high_risks}")
    evidence_statuses = _evidence_status_map(payload.evidence or {})
    if payload.require_evidence and not evidence_statuses:
        blockers.append("project state health evidence is required")
    for name, status in evidence_statuses.items():
        if status == "rollback":
            blockers.append(f"evidence {name} is failing")
        elif status == "hold":
            warnings.append(f"evidence {name} requires review")
    decision = "rollback" if blockers else "hold" if warnings else "pass"
    report = {"releaseId": payload.release_id, "stage": payload.stage, "phase": payload.phase, "domain": payload.domain, "route": payload.route, "jobTypes": payload.job_types, "decision": decision, "applicationSummary": application_summary, "migrationStatus": {"decision": migration_decision or "pass", "completionPercent": migration_score}, "riskSummary": risk_summary, "closureCriteriaSummary": criteria_summary, "approvalSummary": approval_summary, "evidenceStatuses": evidence_statuses, "thresholds": {"minApplicationCount": payload.min_application_count, "minCompletionPercent": payload.min_completion_percent, "maxOpenHighRisks": payload.max_open_high_risks, "minClosureCriteriaCount": payload.min_closure_criteria_count, "minApprovalCount": payload.min_approval_count}, "observed": {"minCompletionPercent": min_observed_completion, "openHighRisks": open_high}, "blockers": blockers, "warnings": warnings, "nextActions": ["Attach sanitized global project state health packet and proceed to final stage closure review." if decision == "pass" else "Resolve project state health blockers/warnings before declaring this migration stage complete."], "mutatesRoadmapBudgetOrRollout": False, "pythonProjectStateHealthReviewIsAdvisory": True, "operatorsOwnGlobalProjectState": True}
    artifact = artifact_store.write_json(prefix="platform-project-state-health-review", artifact_type="platform.project_state_health_review.report", payload=report, metadata={"rowCount": len(application_summary)+len(risk_summary)+len(criteria_summary)+len(approval_summary), "redactionApplied": True, "piiClass": "project-state-health-metadata-only", "source": "python-project-state-health-review"})
    return _result(job, "platform.project_state_health_review.completed", {**report, "artifactGenerated": True, "artifact": model_dump(artifact, by_alias=True, mode="json")}, ["Project state health review is advisory; Python did not mutate roadmap, budget, staffing, rollout state, approvals or status dashboards"], [artifact])


PROCESSORS = {
    JobType.ADMIN_AUDIT_EXPORT: process_audit_export,
    JobType.ADMIN_ACCOUNTS_BULK_VALIDATE: process_bulk_account_validate,
    JobType.ADMIN_ACCOUNTS_READ_MODEL: process_accounts_read_model,
    JobType.ADMIN_PROVIDER_ROLE_RECONCILE: process_provider_role_reconcile,
    JobType.SCHEDULING_AVAILABILITY_SNAPSHOT: process_scheduling_availability_snapshot,
    JobType.MESSAGING_REMINDER_PLAN: process_messaging_reminder_plan,
    JobType.BILLING_PAYMENT_RECONCILE: process_billing_payment_reconcile,
    JobType.CLINICAL_RECORDS_ACCESS_AUDIT: process_clinical_records_access_audit,
    JobType.PLATFORM_DB_INDEX_ADVISORY: process_platform_db_index_advisory,
    JobType.PLATFORM_SLO_REGRESSION_REPORT: process_platform_slo_regression_report,
    JobType.PLATFORM_CONTRACT_REPLAY: process_platform_contract_replay,
    JobType.PLATFORM_PRIVACY_PREFLIGHT: process_platform_privacy_preflight,
    JobType.PLATFORM_RELEASE_DECISION: process_platform_release_decision,
    JobType.PLATFORM_ROLLBACK_DRILL: process_platform_rollback_drill,
    JobType.PLATFORM_POST_DEPLOY_VERIFY: process_platform_post_deploy_verify,
    JobType.PLATFORM_CHANGE_TICKET_BUNDLE: process_platform_change_ticket_bundle,
    JobType.PLATFORM_OPERATIONAL_HANDOFF: process_platform_operational_handoff,
    JobType.PLATFORM_INCIDENT_SIMULATION: process_platform_incident_simulation,
    JobType.PLATFORM_CAPACITY_PLAN: process_platform_capacity_plan,
    JobType.PLATFORM_ALERT_POLICY_REVIEW: process_platform_alert_policy_review,
    JobType.PLATFORM_DEPENDENCY_READINESS: process_platform_dependency_readiness,
    JobType.PLATFORM_PRODUCTION_READINESS: process_platform_production_readiness,
    JobType.PLATFORM_DATA_RETENTION_REVIEW: process_platform_data_retention_review,
    JobType.PLATFORM_AUDIT_TRAIL_REVIEW: process_platform_audit_trail_review,
    JobType.PLATFORM_SECURITY_POSTURE_REVIEW: process_platform_security_posture_review,
    JobType.PLATFORM_SUPPLY_CHAIN_REVIEW: process_platform_supply_chain_review,
    JobType.PLATFORM_SCHEMA_MIGRATION_REHEARSAL: process_platform_schema_migration_rehearsal,
    JobType.PLATFORM_BACKUP_RESTORE_DRILL: process_platform_backup_restore_drill,
    JobType.PLATFORM_OBSERVABILITY_COVERAGE_REVIEW: process_platform_observability_coverage_review,
    JobType.PLATFORM_FEATURE_FLAG_REVIEW: process_platform_feature_flag_review,
    JobType.PLATFORM_DOMAIN_MIGRATION_READINESS: process_platform_domain_migration_readiness,
    JobType.PLATFORM_CUTOVER_PLAN: process_platform_cutover_plan,
    JobType.PLATFORM_OWNER_REGISTRY_REVIEW: process_platform_owner_registry_review,
    JobType.PLATFORM_POST_CUTOVER_MONITOR: process_platform_post_cutover_monitor,
    JobType.PLATFORM_LEGACY_PATH_DECOMMISSION: process_platform_legacy_path_decommission,
    JobType.PLATFORM_STEADY_STATE_OPERATIONS_REVIEW: process_platform_steady_state_operations_review,
    JobType.PLATFORM_QUEUE_RESILIENCE_REVIEW: process_platform_queue_resilience_review,
    JobType.PLATFORM_ARTIFACT_INTEGRITY_REVIEW: process_platform_artifact_integrity_review,
    JobType.PLATFORM_RUNBOOK_FRESHNESS_REVIEW: process_platform_runbook_freshness_review,
    JobType.PLATFORM_SUPPORT_ESCALATION_REVIEW: process_platform_support_escalation_review,
    JobType.PLATFORM_COST_GUARDRAIL_REVIEW: process_platform_cost_guardrail_review,
    JobType.PLATFORM_ENVIRONMENT_PARITY_REVIEW: process_platform_environment_parity_review,
    JobType.PLATFORM_ACCESS_CONTROL_REVIEW: process_platform_access_control_review,
    JobType.PLATFORM_DATA_QUALITY_REVIEW: process_platform_data_quality_review,
    JobType.PLATFORM_CI_STAGING_VALIDATION_REVIEW: process_platform_ci_staging_validation_review,
    JobType.PLATFORM_RELEASE_CLOSURE_REVIEW: process_platform_release_closure_review,
    JobType.PLATFORM_PRODUCTION_CANARY_OBSERVATION_REVIEW: process_platform_production_canary_observation_review,
    JobType.PLATFORM_INCIDENT_RESPONSE_READINESS_REVIEW: process_platform_incident_response_readiness_review,
    JobType.PLATFORM_TRAFFIC_PROMOTION_READINESS_REVIEW: process_platform_traffic_promotion_readiness_review,
    JobType.PLATFORM_EVIDENCE_RETENTION_AUDIT_REVIEW: process_platform_evidence_retention_audit_review,
    JobType.PLATFORM_SLO_ERROR_BUDGET_REVIEW: process_platform_slo_error_budget_review,
    JobType.PLATFORM_AUTO_ROLLBACK_SAFEGUARD_REVIEW: process_platform_auto_rollback_safeguard_review,
    JobType.PLATFORM_THIRD_PARTY_DEPENDENCY_REVIEW: process_platform_third_party_dependency_review,
    JobType.PLATFORM_CAPACITY_SCALING_READINESS_REVIEW: process_platform_capacity_scaling_readiness_review,
    JobType.PLATFORM_COMPLIANCE_PRIVACY_EVIDENCE_REVIEW: process_platform_compliance_privacy_evidence_review,
    JobType.PLATFORM_RUNBOOK_DRILL_VERIFICATION_REVIEW: process_platform_runbook_drill_verification_review,
    JobType.PLATFORM_DISASTER_RECOVERY_BACKUP_REVIEW: process_platform_disaster_recovery_backup_review,
    JobType.PLATFORM_CHANGE_MIGRATION_READINESS_REVIEW: process_platform_change_migration_readiness_review,
    JobType.PLATFORM_CONFIGURATION_SECRET_ROTATION_REVIEW: process_platform_configuration_secret_rotation_review,
    JobType.PLATFORM_MAINTENANCE_WINDOW_READINESS_REVIEW: process_platform_maintenance_window_readiness_review,
    JobType.PLATFORM_AUDIT_FORENSICS_READINESS_REVIEW: process_platform_audit_forensics_readiness_review,
    JobType.PLATFORM_BUSINESS_CONTINUITY_READINESS_REVIEW: process_platform_business_continuity_readiness_review,
    JobType.PLATFORM_POST_INCIDENT_LEARNING_REVIEW: process_platform_post_incident_learning_review,
    JobType.PLATFORM_TECH_DEBT_GOVERNANCE_REVIEW: process_platform_tech_debt_governance_review,
    JobType.PLATFORM_VENDOR_RESILIENCE_REVIEW: process_platform_vendor_resilience_review,
    JobType.PLATFORM_KNOWLEDGE_TRANSFER_READINESS_REVIEW: process_platform_knowledge_transfer_readiness_review,
    JobType.PLATFORM_ARCHITECTURE_OWNERSHIP_REVIEW: process_platform_architecture_ownership_review,
    JobType.PLATFORM_EXECUTIVE_METRICS_GOVERNANCE_REVIEW: process_platform_executive_metrics_governance_review,
    JobType.PLATFORM_DOMAIN_ADOPTION_READINESS_REVIEW: process_platform_domain_adoption_readiness_review,
    JobType.PLATFORM_PHASE_TWO_ROLLOUT_GOVERNANCE_REVIEW: process_platform_phase_two_rollout_governance_review,
    JobType.PLATFORM_DOMAIN_PILOT_EXECUTION_REVIEW: process_platform_domain_pilot_execution_review,
    JobType.PLATFORM_PHASE_TWO_EXPANSION_CONTROL_REVIEW: process_platform_phase_two_expansion_control_review,
    JobType.PLATFORM_DOMAIN_OUTCOME_MEASUREMENT_REVIEW: process_platform_domain_outcome_measurement_review,
    JobType.PLATFORM_PHASE_TWO_FEEDBACK_ADOPTION_REVIEW: process_platform_phase_two_feedback_adoption_review,
    JobType.PLATFORM_DOMAIN_GRADUATION_READINESS_REVIEW: process_platform_domain_graduation_readiness_review,
    JobType.PLATFORM_PHASE_TWO_LEARNING_CONSOLIDATION_REVIEW: process_platform_phase_two_learning_consolidation_review,
    JobType.PLATFORM_DOMAIN_WIDE_ADOPTION_READINESS_REVIEW: process_platform_domain_wide_adoption_readiness_review,
    JobType.PLATFORM_PHASE_TWO_SUPPORT_TRANSITION_REVIEW: process_platform_phase_two_support_transition_review,
    JobType.PLATFORM_DOMAIN_ADOPTION_STABILIZATION_REVIEW: process_platform_domain_adoption_stabilization_review,
    JobType.PLATFORM_PHASE_TWO_VALUE_REALIZATION_REVIEW: process_platform_phase_two_value_realization_review,
    JobType.PLATFORM_PHASE_TWO_CLOSURE_ACCEPTANCE_REVIEW: process_platform_phase_two_closure_acceptance_review,
    JobType.PLATFORM_PHASE_THREE_TRANSITION_READINESS_REVIEW: process_platform_phase_three_transition_readiness_review,
    JobType.PLATFORM_PHASE_THREE_DOMAIN_WAVE_READINESS_REVIEW: process_platform_phase_three_domain_wave_readiness_review,
    JobType.PLATFORM_PHASE_THREE_OPERATING_MODEL_ALIGNMENT_REVIEW: process_platform_phase_three_operating_model_alignment_review,
    JobType.PLATFORM_PHASE_THREE_WAVE_EXECUTION_REVIEW: process_platform_phase_three_wave_execution_review,
    JobType.PLATFORM_PHASE_THREE_ADOPTION_VALUE_TRACKING_REVIEW: process_platform_phase_three_adoption_value_tracking_review,
    JobType.PLATFORM_PHASE_THREE_GAP_REMEDIATION_REVIEW: process_platform_phase_three_gap_remediation_review,
    JobType.PLATFORM_MIGRATION_STAGE_COMPLETION_READINESS_REVIEW: process_platform_migration_stage_completion_readiness_review,
    JobType.PLATFORM_PHASE_THREE_REMEDIATION_CLOSURE_REVIEW: process_platform_phase_three_remediation_closure_review,
    JobType.PLATFORM_EXECUTIVE_OPERATIONAL_HANDOFF_REVIEW: process_platform_executive_operational_handoff_review,
    JobType.PLATFORM_GLOBAL_TASK_STATUS_TRACKING_REVIEW: process_platform_global_task_status_tracking_review,
    JobType.PLATFORM_PROJECT_STATE_HEALTH_REVIEW: process_platform_project_state_health_review,
    JobType.PLATFORM_FINAL_ACCEPTANCE_EVIDENCE_REVIEW: process_platform_final_acceptance_evidence_review,
    JobType.PLATFORM_STAGE_EXIT_READINESS_REVIEW: process_platform_stage_exit_readiness_review,
    JobType.PLATFORM_STAGE_CLOSURE_CERTIFICATION_REVIEW: process_platform_stage_closure_certification_review,
    JobType.PLATFORM_POST_CLOSURE_OPERATIONAL_TRANSITION_REVIEW: process_platform_post_closure_operational_transition_review,
    JobType.PLATFORM_POST_CLOSURE_MONITORING_REVIEW: process_platform_post_closure_monitoring_review,
    JobType.PLATFORM_STEADY_STATE_TRANSFER_VALIDATION_REVIEW: process_platform_steady_state_transfer_validation_review,
    JobType.PLATFORM_STEADY_STATE_OPERATIONAL_ASSURANCE_REVIEW: process_platform_steady_state_operational_assurance_review,
    JobType.PLATFORM_CONTINUOUS_IMPROVEMENT_BACKLOG_REVIEW: process_platform_continuous_improvement_backlog_review,
    JobType.PLATFORM_STABLE_OPERATIONS_OPTIMIZATION_REVIEW: process_platform_stable_operations_optimization_review,
    JobType.PLATFORM_RECURRING_MAINTENANCE_CYCLE_READINESS_REVIEW: process_platform_recurring_maintenance_cycle_readiness_review,
    JobType.PLATFORM_MAINTENANCE_CYCLE_EXECUTION_REVIEW: process_platform_maintenance_cycle_execution_review,
    JobType.PLATFORM_LONG_TERM_OPERABILITY_SUSTAINABILITY_REVIEW: process_platform_long_term_operability_sustainability_review,
    JobType.PLATFORM_RECURRING_OPERATIONAL_MATURITY_AUDIT_REVIEW: process_platform_recurring_operational_maturity_audit_review,
    JobType.PLATFORM_STABLE_STATE_CONTINUITY_CONTROL_REVIEW: process_platform_stable_state_continuity_control_review,
    JobType.PLATFORM_OPERATIONAL_RESILIENCE_GOVERNANCE_REVIEW: process_platform_operational_resilience_governance_review,
    JobType.PLATFORM_RECOVERY_CAPABILITY_VALIDATION_REVIEW: process_platform_recovery_capability_validation_review,
    JobType.PLATFORM_OPERATIONAL_RESILIENCE_OPTIMIZATION_REVIEW: process_platform_operational_resilience_optimization_review,
    JobType.PLATFORM_AUTOMATED_CONTINUITY_PREPAREDNESS_REVIEW: process_platform_automated_continuity_preparedness_review,
    JobType.PLATFORM_AUTOMATED_CONTINUITY_EXECUTION_VALIDATION_REVIEW: process_platform_automated_continuity_execution_validation_review,
    JobType.PLATFORM_OPERATIONAL_RESILIENCE_FEEDBACK_LOOP_REVIEW: process_platform_operational_resilience_feedback_loop_review,
    JobType.PLATFORM_FINAL_CLOSURE_EVIDENCE_PACKAGE_REVIEW: process_platform_final_closure_evidence_package_review,
    JobType.PLATFORM_GLOBAL_IMPLEMENTATION_COMPLETION_CHECKLIST_REVIEW: process_platform_global_implementation_completion_checklist_review,
    JobType.PLATFORM_FINAL_OPERATIONAL_HANDOVER_REVIEW: process_platform_final_operational_handover_review,
    JobType.PLATFORM_PHASE_CLOSURE_CERTIFICATION_REVIEW: process_platform_phase_closure_certification_review,
    JobType.NOTIFICATIONS_DISPATCH: process_notifications_dispatch,
    JobType.ANALYTICS_SNAPSHOT: process_analytics_snapshot,
    JobType.AI_TRIAGE_PREVIEW: process_ai_triage_preview,
}


def process_job(job: JobEnvelope) -> JobResult:
    return PROCESSORS[job.job_type](job)
