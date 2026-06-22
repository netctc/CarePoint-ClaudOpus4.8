from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any

from . import __version__
from .compat import model_dump
from .models import (
    CanaryGateDecision,
    ContractCapability,
    ContractManifest,
    ContractTestVector,
    ContractValidationReport,
    JobEnvelope,
    JobType,
    RolloutReadinessReport,
)
from .policies import evaluate_job_policy

SCHEMA_VERSION = "2026-05-option-b-v64"


@dataclass(frozen=True)
class ContractDefinition:
    contract_id: str
    job_type: JobType
    owner: str
    node_route: str
    python_route: str
    stage: str
    canary_max_percent: int
    shadow_supported: bool
    dry_run_only: bool
    data_classification: str
    expected_result_type: str
    rollback: str
    acceptance_checks: tuple[str, ...]
    safeguards: tuple[str, ...]


CONTRACTS: dict[JobType, ContractDefinition] = {
    JobType.ADMIN_AUDIT_EXPORT: ContractDefinition(
        contract_id="cp.hybrid.admin.audit_export.v1",
        job_type=JobType.ADMIN_AUDIT_EXPORT,
        owner="Admin & Governance",
        node_route="/api/hybrid-python/admin/audit-export/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="shadow-to-canary",
        canary_max_percent=5,
        shadow_supported=True,
        dry_run_only=False,
        data_classification="metadata-or-node-prefiltered-rows",
        expected_result_type="admin.audit_export.prepared",
        rollback="Set HYBRID_PYTHON_ENABLED=false or HYBRID_PYTHON_CANARY_PERCENT=0; Node keeps export ownership.",
        acceptance_checks=(
            "Node performs RBAC, organization scope and audit authorization before enqueue.",
            "Python receives only filters or Node-prefiltered minimized rows.",
            "Export artifact metadata includes sha256, row count and redactionApplied=true.",
        ),
        safeguards=("signed-bridge", "idempotency-key", "artifact-redaction", "node-owned-delivery"),
    ),
    JobType.ADMIN_ACCOUNTS_BULK_VALIDATE: ContractDefinition(
        contract_id="cp.hybrid.admin.accounts_bulk_validate.v1",
        job_type=JobType.ADMIN_ACCOUNTS_BULK_VALIDATE,
        owner="Accounts & Organizations",
        node_route="/api/hybrid-python/admin/accounts/bulk-validate/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="canary-safe-dry-run",
        canary_max_percent=25,
        shadow_supported=True,
        dry_run_only=False,
        data_classification="pii-limited-admin-input",
        expected_result_type="admin.accounts_bulk_validate.completed",
        rollback="Disable canary for this job type; Node continues account mutation and authorization.",
        acceptance_checks=(
            "Python validates shape, duplicate emails, domain constraints and role allowlists only.",
            "Node remains owner of account creation, invitations, credentials and final audit writes.",
            "Validation reports are capped and redacted before artifact creation.",
        ),
        safeguards=("signed-bridge", "max-5000-rows", "dry-run-default", "node-owned-mutation"),
    ),

    JobType.ADMIN_ACCOUNTS_READ_MODEL: ContractDefinition(
        contract_id="cp.hybrid.admin.accounts_read_model.v1",
        job_type=JobType.ADMIN_ACCOUNTS_READ_MODEL,
        owner="Accounts & Organizations",
        node_route="/api/hybrid-python/admin/accounts/read-model/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="shadow-to-canary",
        canary_max_percent=10,
        shadow_supported=True,
        dry_run_only=False,
        data_classification="minimized-admin-read-model",
        expected_result_type="admin.accounts_read_model.prepared",
        rollback="Keep admin account list rendering on Node; disable route canary or set percent to 0.",
        acceptance_checks=(
            "Node performs RBAC, object scope, filters and Prisma query before passing minimized rows.",
            "Python returns masked/hash email fields only and owns presentation-shape artifacts.",
            "Shadow comparison must match Node read-model shape before canary increases.",
        ),
        safeguards=("signed-bridge", "masked-email-output", "max-500-rows", "node-owned-query"),
    ),
    JobType.ADMIN_PROVIDER_ROLE_RECONCILE: ContractDefinition(
        contract_id="cp.hybrid.admin.provider_role_reconcile.v1",
        job_type=JobType.ADMIN_PROVIDER_ROLE_RECONCILE,
        owner="Accounts & Organizations",
        node_route="/api/hybrid-python/admin/provider-roles/reconcile/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="shadow-only-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="schema-metadata-only",
        expected_result_type="admin.provider_role_reconcile.completed",
        rollback="Ignore advisory report; Node/Prisma migration path remains authoritative.",
        acceptance_checks=(
            "Report is advisory and cannot mutate Prisma schema, migrations or provider rows.",
            "Input contains schema/migration metadata and minimized references only.",
        ),
        safeguards=("dry-run-only", "advisory-only", "no-db-mutation"),
    ),
    JobType.SCHEDULING_AVAILABILITY_SNAPSHOT: ContractDefinition(
        contract_id="cp.hybrid.scheduling.availability_snapshot.v1",
        job_type=JobType.SCHEDULING_AVAILABILITY_SNAPSHOT,
        owner="Scheduling",
        node_route="/api/hybrid-python/scheduling/availability/snapshot/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="shadow-to-canary",
        canary_max_percent=10,
        shadow_supported=True,
        dry_run_only=False,
        data_classification="schedule-metadata-minimized",
        expected_result_type="scheduling.availability_snapshot.computed",
        rollback="Keep availability aggregation on Node; set route canary to 0.",
        acceptance_checks=(
            "Node passes only provider/resource hashes and availability windows.",
            "Python computes aggregates only; booking mutations and slot authority remain Node-owned.",
        ),
        safeguards=("hash-only-subjects", "no-patient-identifiers", "node-owned-booking-mutation"),
    ),
    JobType.MESSAGING_REMINDER_PLAN: ContractDefinition(
        contract_id="cp.hybrid.messaging.reminder_plan.v1",
        job_type=JobType.MESSAGING_REMINDER_PLAN,
        owner="Messaging & Notifications",
        node_route="/api/hybrid-python/messaging/reminders/plan/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="shadow-only",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="recipient-hash-planning",
        expected_result_type="messaging.reminder_plan.planned",
        rollback="Keep all reminder planning and provider sends on Node/notification provider.",
        acceptance_checks=(
            "Prefer recipientHashes; raw recipients are hashed and never persisted in artifacts.",
            "Python can only build dry-run batches; delivery provider send is disabled.",
        ),
        safeguards=("dry-run-only", "recipient-hash-output", "no-provider-send"),
    ),
    JobType.ANALYTICS_SNAPSHOT: ContractDefinition(
        contract_id="cp.hybrid.analytics.snapshot.v1",
        job_type=JobType.ANALYTICS_SNAPSHOT,
        owner="Analytics",
        node_route="/api/hybrid-python/analytics/snapshot/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="canary",
        canary_max_percent=50,
        shadow_supported=True,
        dry_run_only=False,
        data_classification="aggregate-non-phi",
        expected_result_type="analytics.snapshot.computed",
        rollback="Route analytics snapshot computation back to Node or a no-op read model.",
        acceptance_checks=(
            "Inputs are aggregate numeric values or anonymized dimensions.",
            "No PHI/PII keys are allowed by policy guard.",
            "Node remains owner of source queries and organization scope.",
        ),
        safeguards=("payload-policy-guard", "aggregate-only", "idempotency-key"),
    ),
    JobType.BILLING_PAYMENT_RECONCILE: ContractDefinition(
        contract_id="cp.hybrid.billing.payment_reconcile.v1",
        job_type=JobType.BILLING_PAYMENT_RECONCILE,
        owner="Billing & Coverage",
        node_route="/api/hybrid-python/billing/payments/reconcile/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="shadow-to-canary-advisory",
        canary_max_percent=10,
        shadow_supported=True,
        dry_run_only=False,
        data_classification="billing-metadata-minimized",
        expected_result_type="billing.payment_reconcile.completed",
        rollback="Keep reconciliation reports on Node/finance jobs; set billing route canary to 0.",
        acceptance_checks=(
            "Node passes only prefiltered payment metadata and hashed gateway/external identifiers.",
            "Python reports mismatches and totals only; Node owns payment mutations, webhook idempotency and ledger writes.",
            "No card PAN, CVV, payment method token, customer email or gateway secret may cross the bridge.",
        ),
        safeguards=("signed-bridge", "hashed-payment-identifiers", "no-gateway-mutation", "node-owned-ledger"),
    ),
    JobType.CLINICAL_RECORDS_ACCESS_AUDIT: ContractDefinition(
        contract_id="cp.hybrid.clinical.records_access_audit.v1",
        job_type=JobType.CLINICAL_RECORDS_ACCESS_AUDIT,
        owner="Clinical Records",
        node_route="/api/hybrid-python/clinical/records/access-audit/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="shadow-only-risk-indicators",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="clinical-access-metadata-hashed",
        expected_result_type="clinical.records_access_audit.completed",
        rollback="Keep record access audit review on Node/reporting; Python output is advisory and non-blocking.",
        acceptance_checks=(
            "Input contains actor/patient/resource hashes and access metadata only.",
            "Python produces risk indicators for review; Node remains owner of object-level auth and audit persistence.",
            "No chart text, notes, diagnosis, prescription, lab result or direct patient contact data may cross the bridge.",
        ),
        safeguards=("dry-run-only", "hash-only-subjects", "no-chart-content", "node-owned-object-auth"),
    ),
    JobType.PLATFORM_DB_INDEX_ADVISORY: ContractDefinition(
        contract_id="cp.hybrid.platform.db_index_advisory.v1",
        job_type=JobType.PLATFORM_DB_INDEX_ADVISORY,
        owner="Platform & DevOps",
        node_route="/api/hybrid-python/platform/db-index-advisory/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="shadow-only-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="schema-query-metadata-only",
        expected_result_type="platform.db_index_advisory.completed",
        rollback="Ignore advisory report; Node/Prisma migrations remain authoritative.",
        acceptance_checks=(
            "Input contains schema/query metadata only and no SQL rows or PHI/PII.",
            "Recommendations are validated with EXPLAIN ANALYZE before any Prisma migration is authored.",
            "Python does not connect to PostgreSQL or write migrations.",
        ),
        safeguards=("dry-run-only", "schema-metadata-only", "no-db-connection", "node-owned-prisma-migration"),
    ),
    JobType.PLATFORM_SLO_REGRESSION_REPORT: ContractDefinition(
        contract_id="cp.hybrid.platform.slo_regression_report.v1",
        job_type=JobType.PLATFORM_SLO_REGRESSION_REPORT,
        owner="Platform & DevOps",
        node_route="/api/hybrid-python/platform/slo-regression/report/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="canary-evidence",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="aggregate-telemetry-only",
        expected_result_type="platform.slo_regression_report.completed",
        rollback="Use report recommendation to set route canary to 0 or HYBRID_PYTHON_ENABLED=false.",
        acceptance_checks=(
            "Input contains aggregate latency/error samples only, not logs or payloads.",
            "Report emits advance/hold/rollback recommendation for canary review.",
            "Output can be attached to release evidence bundle.",
        ),
        safeguards=("dry-run-only", "aggregate-telemetry-only", "canary-evidence", "no-request-payloads"),
    ),
    JobType.PLATFORM_CONTRACT_REPLAY: ContractDefinition(
        contract_id="cp.hybrid.platform.contract_replay.v1",
        job_type=JobType.PLATFORM_CONTRACT_REPLAY,
        owner="Platform & DevOps",
        node_route="/api/hybrid-python/platform/contracts/replay/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="ci-release-gate",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="contract-vector-metadata-only",
        expected_result_type="platform.contract_replay.completed",
        rollback="Do not promote canary; fix failing contract vector before release.",
        acceptance_checks=(
            "Replay uses built-in sanitized test vectors only.",
            "All selected vectors must validate and return their expected resultType.",
            "Generated artifact can be attached to release evidence without PHI/PII.",
        ),
        safeguards=("dry-run-only", "sanitized-test-vectors", "ci-gate", "artifact-redaction"),
    ),
    JobType.PLATFORM_PRIVACY_PREFLIGHT: ContractDefinition(
        contract_id="cp.hybrid.platform.privacy_preflight.v1",
        job_type=JobType.PLATFORM_PRIVACY_PREFLIGHT,
        owner="Platform & DevOps",
        node_route="/api/hybrid-python/platform/privacy/preflight/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="release-gate-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="payload-shape-metadata-only",
        expected_result_type="platform.privacy_preflight.completed",
        rollback="Block rollout for candidates with secret/PHI key risks until Node-side minimization is corrected.",
        acceptance_checks=(
            "Input must contain payload keys/shapes only, not raw values.",
            "Secret, token, card and PHI-like keys block the candidate.",
            "Unknown job types or raw classifications require remediation before bridge enqueue.",
        ),
        safeguards=("shape-only", "dry-run-only", "policy-preflight", "no-raw-values"),
    ),

    JobType.PLATFORM_RELEASE_DECISION: ContractDefinition(
        contract_id="cp.hybrid.platform.release_decision.v1",
        job_type=JobType.PLATFORM_RELEASE_DECISION,
        owner="Platform & DevOps",
        node_route="/api/hybrid-python/platform/release/decision/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="release-gate-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="release-evidence-metadata-only",
        expected_result_type="platform.release_decision.completed",
        rollback="Treat the decision as advisory; do not promote if blockers exist and keep Node path authoritative.",
        acceptance_checks=(
            "Input is composed of sanitized gate, checklist, SLO, contract replay and privacy preflight outputs only.",
            "Decision artifact records blockers, warnings and next actions for the release ticket.",
        ),
        safeguards=("dry-run-only", "advisory-only", "metadata-only", "node-owned-deployment"),
    ),
    JobType.PLATFORM_ROLLBACK_DRILL: ContractDefinition(
        contract_id="cp.hybrid.platform.rollback_drill.v1",
        job_type=JobType.PLATFORM_ROLLBACK_DRILL,
        owner="Platform & DevOps",
        node_route="/api/hybrid-python/platform/rollback/drill/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="rollback-runbook-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="rollback-procedure-metadata-only",
        expected_result_type="platform.rollback_drill.planned",
        rollback="Use the generated drill to route traffic back to Node; Python does not execute rollback.",
        acceptance_checks=(
            "Drill output includes route-to-Node steps, evidence capture and SLO validation checks.",
            "No rollout state or deployment settings are mutated by Python.",
        ),
        safeguards=("dry-run-only", "procedure-only", "no-state-mutation", "operator-owned-execution"),
    ),

    JobType.PLATFORM_POST_DEPLOY_VERIFY: ContractDefinition(
        contract_id="cp.hybrid.platform.post_deploy_verify.v1",
        job_type=JobType.PLATFORM_POST_DEPLOY_VERIFY,
        owner="Platform & DevOps",
        node_route="/api/hybrid-python/platform/post-deploy/verify/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="post-deploy-release-gate-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="post-deploy-evidence-metadata-only",
        expected_result_type="platform.post_deploy_verify.completed",
        rollback="Use the verification decision to hold or roll route canary back to 0; Python does not execute rollback.",
        acceptance_checks=(
            "Input contains health, smoke, SLO and rollout evidence summaries only.",
            "Decision artifact records blockers, warnings and next actions after deployment.",
            "No request bodies, headers, PHI, tokens or raw logs may cross the bridge.",
        ),
        safeguards=("dry-run-only", "metadata-only", "advisory-only", "node-owned-rollback"),
    ),
    JobType.PLATFORM_CHANGE_TICKET_BUNDLE: ContractDefinition(
        contract_id="cp.hybrid.platform.change_ticket_bundle.v1",
        job_type=JobType.PLATFORM_CHANGE_TICKET_BUNDLE,
        owner="Platform & DevOps",
        node_route="/api/hybrid-python/platform/change-ticket/bundle/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="change-management-evidence-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="change-ticket-evidence-metadata-only",
        expected_result_type="platform.change_ticket_bundle.completed",
        rollback="Keep change management, approvals and deployment execution outside Python; use bundle as ticket evidence only.",
        acceptance_checks=(
            "Bundle references sanitized artifacts and gate summaries only.",
            "Missing evidence is reported before a change ticket is marked ready for review.",
            "Python does not create external tickets or approve deployments.",
        ),
        safeguards=("dry-run-only", "metadata-only", "no-ticket-mutation", "operator-owned-approval"),
    ),
    JobType.PLATFORM_OPERATIONAL_HANDOFF: ContractDefinition(
        contract_id="cp.hybrid.platform.operational_handoff.v1",
        job_type=JobType.PLATFORM_OPERATIONAL_HANDOFF,
        owner="Platform & DevOps",
        node_route="/api/hybrid-python/platform/operational/handoff/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="ops-handoff-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="operational-handoff-metadata-only",
        expected_result_type="platform.operational_handoff.completed",
        rollback="Use the handoff pack as release evidence only; operations execution remains in Node/CI/operator runbooks.",
        acceptance_checks=(
            "Handoff pack lists owners, dashboards, alerts, runbooks, support window and sanitized artifacts.",
            "Missing operational sections are reported before canary promotion is considered complete.",
            "No pager tokens, private credentials, raw logs or PHI may cross the bridge.",
        ),
        safeguards=("dry-run-only", "metadata-only", "no-ops-mutation", "operator-owned-execution"),
    ),
    JobType.PLATFORM_INCIDENT_SIMULATION: ContractDefinition(
        contract_id="cp.hybrid.platform.incident_simulation.v1",
        job_type=JobType.PLATFORM_INCIDENT_SIMULATION,
        owner="Platform & DevOps",
        node_route="/api/hybrid-python/platform/incidents/simulate/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="incident-drill-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="incident-drill-metadata-only",
        expected_result_type="platform.incident_simulation.completed",
        rollback="Use the simulation output to rehearse pause/rollback; Python does not change rollout state or notify operators.",
        acceptance_checks=(
            "Simulation uses sanitized scenario and aggregate evidence only.",
            "Response plan includes freeze, rollback decision, evidence capture and post-incident checks.",
            "The drill is dry-run only and does not mutate production state.",
        ),
        safeguards=("dry-run-only", "metadata-only", "no-state-mutation", "operator-owned-response"),
    ),

    JobType.PLATFORM_CAPACITY_PLAN: ContractDefinition(
        contract_id="cp.hybrid.platform.capacity_plan.v1",
        job_type=JobType.PLATFORM_CAPACITY_PLAN,
        owner="Platform / DevOps",
        node_route="/api/hybrid-python/platform/capacity/plan/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="release-gate-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="operational-capacity-metadata-only",
        expected_result_type="platform.capacity_plan.completed",
        rollback="Ignore advisory sizing and keep current Node/worker deployment; no runtime state is mutated by this job.",
        acceptance_checks=(
            "Input contains aggregate workload/queue/service metrics only.",
            "Report estimates worker slots and flags backlog/error/dependency blockers before canary promotion.",
            "Infrastructure scaling remains CI/operator-owned; Python does not modify deployment settings.",
        ),
        safeguards=("dry-run-only", "aggregate-operational-metrics", "advisory-only", "node-owned-deployment"),
    ),
    JobType.PLATFORM_ALERT_POLICY_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.alert_policy_review.v1",
        job_type=JobType.PLATFORM_ALERT_POLICY_REVIEW,
        owner="Platform / DevOps",
        node_route="/api/hybrid-python/platform/alerts/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="release-gate-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="operational-alert-policy-metadata-only",
        expected_result_type="platform.alert_policy_review.completed",
        rollback="Keep existing observability routing; alert review is advisory and creates no monitors or pages.",
        acceptance_checks=(
            "Review covers Python down, error rate, p95 latency, queue backlog, shadow mismatch, privacy block and artifact leak signals.",
            "Payload contains alert metadata only, not patient/user values or secrets.",
            "Operators link the report in operational handoff/change ticket before increasing canary.",
        ),
        safeguards=("dry-run-only", "alert-metadata-only", "advisory-only", "no-paging-side-effects"),
    ),
    JobType.PLATFORM_DEPENDENCY_READINESS: ContractDefinition(
        contract_id="cp.hybrid.platform.dependency_readiness.v1",
        job_type=JobType.PLATFORM_DEPENDENCY_READINESS,
        owner="Platform / DevOps",
        node_route="/api/hybrid-python/platform/dependencies/readiness/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="release-gate-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="operational-dependency-metadata-only",
        expected_result_type="platform.dependency_readiness.completed",
        rollback="Keep Node fallback and do not increase canary when critical dependencies are unhealthy.",
        acceptance_checks=(
            "Payload contains dependency names/status/aggregate health metadata only.",
            "Report identifies missing or unhealthy required dependencies before promotion.",
            "Python does not call dependencies, scale services or mutate rollout state.",
        ),
        safeguards=("dry-run-only", "dependency-metadata-only", "advisory-only", "operator-owned-remediation"),
    ),
    JobType.PLATFORM_PRODUCTION_READINESS: ContractDefinition(
        contract_id="cp.hybrid.platform.production_readiness.v1",
        job_type=JobType.PLATFORM_PRODUCTION_READINESS,
        owner="Platform / DevOps",
        node_route="/api/hybrid-python/platform/production/readiness/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="final-release-gate-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="production-readiness-evidence-metadata-only",
        expected_result_type="platform.production_readiness.completed",
        rollback="Treat rollback/failed evidence as a stop signal; Node/CI owns traffic promotion and rollback execution.",
        acceptance_checks=(
            "Production readiness aggregates sanitized gate outputs and artifact references only.",
            "Missing evidence, rollback signals or failed privacy/contract gates hold or rollback the release decision.",
            "The result can be attached to change tickets without secrets, raw logs, PHI or patient identifiers.",
        ),
        safeguards=("dry-run-only", "evidence-metadata-only", "advisory-only", "node-owned-promotion"),
    ),

    JobType.PLATFORM_DATA_RETENTION_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.data_retention_review.v1",
        job_type=JobType.PLATFORM_DATA_RETENTION_REVIEW,
        owner="Platform / Compliance",
        node_route="/api/hybrid-python/platform/data-retention/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="release-gate-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="retention-policy-metadata-only",
        expected_result_type="platform.data_retention_review.completed",
        rollback="Keep Node/CI as retention authority; do not advance canary until TTL and redaction blockers are cleared.",
        acceptance_checks=(
            "Retention review uses only policy metadata, artifact summaries and GC summaries.",
            "Artifacts with missing TTL, disabled redaction or high-risk PII classes block production readiness.",
            "Python never deletes artifacts; operator-owned GC remains the only deletion path.",
        ),
        safeguards=("dry-run-only", "metadata-only", "operator-owned-gc", "release-gate"),
    ),
    JobType.PLATFORM_AUDIT_TRAIL_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.audit_trail_review.v1",
        job_type=JobType.PLATFORM_AUDIT_TRAIL_REVIEW,
        owner="Platform / Compliance",
        node_route="/api/hybrid-python/platform/audit-trail/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="release-gate-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="audit-trail-metadata-only",
        expected_result_type="platform.audit_trail_review.completed",
        rollback="Hold release and keep Node route ownership until required audit event fields are complete.",
        acceptance_checks=(
            "Release, rollout, canary assignment and artifact access events contain actor, correlation ID, route and timestamp metadata.",
            "Mutation-like events must indicate dryRun or operator-approved execution path.",
            "Python only reviews evidence; Node/audit pipeline remains owner of audit writes.",
        ),
        safeguards=("dry-run-only", "audit-metadata-only", "node-owned-audit-write", "release-gate"),
    ),

    JobType.PLATFORM_SECURITY_POSTURE_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.security_posture_review.v1",
        job_type=JobType.PLATFORM_SECURITY_POSTURE_REVIEW,
        owner="Platform / Security",
        node_route="/api/hybrid-python/platform/security/posture/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="release-gate-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="security-posture-metadata-only",
        expected_result_type="platform.security_posture_review.completed",
        rollback="Hold release and keep Node route ownership until required security controls and critical findings are cleared.",
        acceptance_checks=(
            "Security posture review uses sanitized control and finding metadata only.",
            "Signed bridge, CSRF/rate limits, object-level authorization tests, CORS policy, httpOnly cookies and secret scanning are verified before canary increase.",
            "Python does not mutate auth, RBAC, cookies, CORS, rate limits or WAF policy.",
        ),
        safeguards=("dry-run-only", "security-metadata-only", "node-owned-security-controls", "release-gate"),
    ),
    JobType.PLATFORM_SUPPLY_CHAIN_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.supply_chain_review.v1",
        job_type=JobType.PLATFORM_SUPPLY_CHAIN_REVIEW,
        owner="Platform / Security",
        node_route="/api/hybrid-python/platform/supply-chain/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="release-gate-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="supply-chain-scan-summary-only",
        expected_result_type="platform.supply_chain_review.completed",
        rollback="Hold release until SBOM, lockfile, image scan and vulnerability blockers are remediated or waived by owners.",
        acceptance_checks=(
            "Supply chain review uses aggregated scan summaries only; no registry credentials, tokens or raw logs cross the bridge.",
            "SBOM, lockfiles and container image scan evidence are present before production canary increase.",
            "Python does not update dependencies, rebuild images or publish artifacts.",
        ),
        safeguards=("dry-run-only", "scan-summary-only", "ci-owned-remediation", "release-gate"),
    ),

    JobType.PLATFORM_SCHEMA_MIGRATION_REHEARSAL: ContractDefinition(
        contract_id="cp.hybrid.platform.schema_migration_rehearsal.v1",
        job_type=JobType.PLATFORM_SCHEMA_MIGRATION_REHEARSAL,
        owner="Platform / DevOps",
        node_route="/api/hybrid-python/platform/schema-migration/rehearsal/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="release-gate-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="schema-migration-metadata-only",
        expected_result_type="platform.schema_migration_rehearsal.completed",
        rollback="Hold canary increase until Prisma validation, migration status, rollback plan and backfill rehearsal evidence are clean.",
        acceptance_checks=(
            "Migration rehearsal receives only metadata: migration names, operation class, drift status and CI evidence flags.",
            "Destructive operations are blocked unless explicitly allowed and still require operator approval.",
            "Python does not execute Prisma migrations or modify schema state.",
        ),
        safeguards=("dry-run-only", "schema-metadata-only", "ci-owned-migrations", "release-gate"),
    ),
    JobType.PLATFORM_BACKUP_RESTORE_DRILL: ContractDefinition(
        contract_id="cp.hybrid.platform.backup_restore_drill.v1",
        job_type=JobType.PLATFORM_BACKUP_RESTORE_DRILL,
        owner="Platform / DevOps",
        node_route="/api/hybrid-python/platform/backup-restore/drill/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="release-gate-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="backup-restore-metadata-only",
        expected_result_type="platform.backup_restore_drill.completed",
        rollback="Hold release or canary increase until backup freshness, restore test and integrity evidence meets RPO/RTO.",
        acceptance_checks=(
            "Backup/restore drill receives only store names, status flags, ages and durations; no backup payloads cross the bridge.",
            "PostgreSQL, Redis and artifact store evidence is checked against RPO/RTO thresholds.",
            "Python does not access backup archives, restore data or mutate infrastructure.",
        ),
        safeguards=("dry-run-only", "backup-metadata-only", "operator-owned-restore", "release-gate"),
    ),

    JobType.PLATFORM_OBSERVABILITY_COVERAGE_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.observability_coverage_review.v1",
        job_type=JobType.PLATFORM_OBSERVABILITY_COVERAGE_REVIEW,
        owner="Platform / Observability",
        node_route="/api/hybrid-python/platform/observability/coverage/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="release-gate-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="observability-metadata-only",
        expected_result_type="platform.observability_coverage_review.completed",
        rollback="Hold canary promotion until trace correlation, latency/error metrics and dashboards are visible for the Python slice.",
        acceptance_checks=(
            "Trace IDs, request IDs, p95 latency, error rate and queue depth are visible before production canary increase.",
            "Dashboards and logs are represented by metadata only; no raw logs or request payloads cross the bridge.",
            "Python reviews observability evidence only and does not create monitors or instrumentation.",
        ),
        safeguards=("dry-run-only", "observability-metadata-only", "operator-owned-instrumentation", "release-gate"),
    ),
    JobType.PLATFORM_FEATURE_FLAG_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.feature_flag_review.v1",
        job_type=JobType.PLATFORM_FEATURE_FLAG_REVIEW,
        owner="Platform / Release Engineering",
        node_route="/api/hybrid-python/platform/feature-flags/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="release-gate-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="feature-flag-metadata-only",
        expected_result_type="platform.feature_flag_review.completed",
        rollback="Do not increase canary unless kill switch, shadow mode, canary cap and signed bridge flags are correctly set.",
        acceptance_checks=(
            "HYBRID_PYTHON_ENABLED is present as the immediate Node-owned kill switch.",
            "HYBRID_PYTHON_CANARY_PERCENT stays within the approved route cap.",
            "PYTHON_WORKER_REQUIRE_SIGNATURE is enabled before production canary promotion.",
        ),
        safeguards=("dry-run-only", "redacted-flag-values", "node-owned-feature-flags", "release-gate"),
    ),
    JobType.PLATFORM_DOMAIN_MIGRATION_READINESS: ContractDefinition(
        contract_id="cp.hybrid.platform.domain_migration_readiness.v1",
        job_type=JobType.PLATFORM_DOMAIN_MIGRATION_READINESS,
        owner="Platform / Release Engineering",
        node_route="/api/hybrid-python/platform/domain-migration/readiness/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="release-gate-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="domain-migration-evidence-metadata-only",
        expected_result_type="platform.domain_migration_readiness.completed",
        rollback="Hold domain ownership shift unless node fallback, shadow comparison, privacy, SLO and owner approval evidence are clean.",
        acceptance_checks=(
            "Domain migration readiness receives only sanitized gate outputs and approval metadata.",
            "Node remains production owner until a separate cutover is approved and executed.",
            "Canary target must not exceed the approved cap and rollback must remain tested.",
        ),
        safeguards=("dry-run-only", "release-evidence-only", "node-owned-fallback", "operator-owned-cutover"),
    ),
    JobType.PLATFORM_CUTOVER_PLAN: ContractDefinition(
        contract_id="cp.hybrid.platform.cutover_plan.v1",
        job_type=JobType.PLATFORM_CUTOVER_PLAN,
        owner="Platform / Release Engineering",
        node_route="/api/hybrid-python/platform/cutover/plan/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="cutover-plan-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="cutover-plan-metadata-only",
        expected_result_type="platform.cutover_plan.completed",
        rollback="Use the generated triggers to keep traffic on Node or set canary to 0; Python never executes cutover.",
        acceptance_checks=(
            "Cutover plan includes preflight evidence, staged canary percentages, verification steps and rollback triggers.",
            "Plan remains dry-run and advisory; traffic promotion and owner matrix updates are operator-owned.",
            "Node fallback remains available until post-deploy verification passes at the target stage.",
        ),
        safeguards=("dry-run-only", "plan-only", "node-owned-traffic", "operator-approval-required"),
    ),
    JobType.PLATFORM_OWNER_REGISTRY_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.owner_registry_review.v1",
        job_type=JobType.PLATFORM_OWNER_REGISTRY_REVIEW,
        owner="Platform / Release Engineering",
        node_route="/api/hybrid-python/platform/owner-registry/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="cutover-governance-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="owner-registry-metadata-only",
        expected_result_type="platform.owner_registry_review.completed",
        rollback="Hold cutover until Node fallback, rollback, security, data, incident and Python worker owners are explicitly assigned.",
        acceptance_checks=(
            "Owner registry includes Node API/fallback, Python worker, data, security, rollback and incident owners.",
            "Approvals are represented by sanitized metadata and attached to the change ticket.",
            "Python review remains advisory and cannot modify RBAC, on-call, ticketing or runtime routing.",
        ),
        safeguards=("dry-run-only", "owner-metadata-only", "operator-owned-ownership-changes", "node-owned-fallback"),
    ),
    JobType.PLATFORM_POST_CUTOVER_MONITOR: ContractDefinition(
        contract_id="cp.hybrid.platform.post_cutover_monitor.v1",
        job_type=JobType.PLATFORM_POST_CUTOVER_MONITOR,
        owner="Platform / Release Engineering",
        node_route="/api/hybrid-python/platform/post-cutover/monitor/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="post-cutover-monitor-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="post-cutover-telemetry-metadata-only",
        expected_result_type="platform.post_cutover_monitor.completed",
        rollback="Rollback or hold ownership change if p95, error rate, mismatches, failed jobs or fallback evidence breach thresholds.",
        acceptance_checks=(
            "Only aggregate operational telemetry and gate summaries are reviewed.",
            "Node fallback remains available during the post-cutover monitor window.",
            "Python produces an advisory monitor report and never mutates rollout state.",
        ),
        safeguards=("dry-run-only", "aggregate-telemetry-only", "node-owned-rollback", "post-cutover-gate"),
    ),

    JobType.PLATFORM_LEGACY_PATH_DECOMMISSION: ContractDefinition(
        contract_id="cp.hybrid.platform.legacy_path_decommission.v1",
        job_type=JobType.PLATFORM_LEGACY_PATH_DECOMMISSION,
        owner="Platform / Release Engineering",
        node_route="/api/hybrid-python/platform/legacy-paths/decommission/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="post-cutover-decommission-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="legacy-path-decommission-metadata-only",
        expected_result_type="platform.legacy_path_decommission.completed",
        rollback="Keep legacy Node path enabled until zero-traffic, fallback, owner and rollback evidence are attached.",
        acceptance_checks=(
            "Legacy path receives zero traffic and has an approved replacement route.",
            "Fallback and rollback evidence are attached before route/code removal.",
            "Python report is advisory and cannot remove routes, feature flags or Node handlers.",
        ),
        safeguards=("dry-run-only", "path-metadata-only", "operator-owned-code-cleanup", "node-owned-fallback"),
    ),
    JobType.PLATFORM_STEADY_STATE_OPERATIONS_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.steady_state_operations_review.v1",
        job_type=JobType.PLATFORM_STEADY_STATE_OPERATIONS_REVIEW,
        owner="Platform / Operations",
        node_route="/api/hybrid-python/platform/steady-state/ops/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="steady-state-operations-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="steady-state-ops-metadata-only",
        expected_result_type="platform.steady_state_operations_review.completed",
        rollback="Hold steady-state handoff if SLOs, incidents, alerts, dashboards, on-call or owner evidence are incomplete.",
        acceptance_checks=(
            "Runbook, dashboard, alerts, on-call and owner evidence are attached and current.",
            "Aggregate p95, error, failed-job and incident metrics are within thresholds.",
            "Python review is advisory and cannot mutate traffic routing, on-call or ownership.",
        ),
        safeguards=("dry-run-only", "aggregate-ops-metadata-only", "operator-owned-ops-changes", "no-routing-mutation"),
    ),

    JobType.PLATFORM_QUEUE_RESILIENCE_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.queue_resilience_review.v1",
        job_type=JobType.PLATFORM_QUEUE_RESILIENCE_REVIEW,
        owner="Platform / DevOps",
        node_route="/api/hybrid-python/platform/queues/resilience/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="post-cutover-operations-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="queue-resilience-metadata-only",
        expected_result_type="platform.queue_resilience_review.completed",
        rollback="Do not advance canary; drain or rollback queue-backed workloads via Node/CI/operator-owned controls.",
        acceptance_checks=(
            "Queue depth, oldest item age, error rate, consumers and drain estimates remain within thresholds.",
            "DLQ, retry policy and idempotency evidence are present before increasing Python worker traffic.",
            "Python review is advisory and cannot mutate Redis, Celery, workers or rollout state.",
        ),
        safeguards=("dry-run-only", "aggregate-queue-metadata", "no-redis-mutation", "node-owned-rollback"),
    ),
    JobType.PLATFORM_ARTIFACT_INTEGRITY_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.artifact_integrity_review.v1",
        job_type=JobType.PLATFORM_ARTIFACT_INTEGRITY_REVIEW,
        owner="Platform / Security",
        node_route="/api/hybrid-python/platform/artifacts/integrity/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="post-cutover-operations-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="artifact-metadata-only",
        expected_result_type="platform.artifact_integrity_review.completed",
        rollback="Hold release or disable artifact-producing Python workloads until metadata, redaction and TTL evidence is clean.",
        acceptance_checks=(
            "Generated artifacts include sha256, sizeBytes, redactionApplied, piiClass and expiresAt metadata.",
            "Only minimized/metadata piiClass values are allowed for Python-generated release artifacts.",
            "Node remains owner of artifact access control, download authorization and delivery.",
        ),
        safeguards=("dry-run-only", "artifact-metadata-only", "redaction-required", "node-owned-delivery"),
    ),
    JobType.PLATFORM_RUNBOOK_FRESHNESS_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.runbook_freshness_review.v1",
        job_type=JobType.PLATFORM_RUNBOOK_FRESHNESS_REVIEW,
        owner="Platform / Operations",
        node_route="/api/hybrid-python/platform/runbooks/freshness/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="post-cutover-operations-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="runbook-metadata-only",
        expected_result_type="platform.runbook_freshness_review.completed",
        rollback="Hold canary expansion if required runbooks are missing, stale or unapproved.",
        acceptance_checks=("Required runbooks are present.", "Runbooks have owners, approvals and fresh review timestamps.", "Python cannot mutate documentation, ownership or rollout state."),
        safeguards=("dry-run-only", "runbook-metadata-only", "no-doc-mutation", "operator-owned-handoff"),
    ),
    JobType.PLATFORM_SUPPORT_ESCALATION_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.support_escalation_review.v1",
        job_type=JobType.PLATFORM_SUPPORT_ESCALATION_REVIEW,
        owner="Platform / Support",
        node_route="/api/hybrid-python/platform/support/escalation/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="post-cutover-operations-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="support-escalation-metadata-only",
        expected_result_type="platform.support_escalation_review.completed",
        rollback="Hold production handoff if support tiers or escalation paths are incomplete.",
        acceptance_checks=("Support tiers have owners and acknowledgement targets.", "Escalation paths are enabled and documented.", "Python cannot page teams or mutate ticketing/on-call systems."),
        safeguards=("dry-run-only", "support-metadata-only", "no-paging-or-ticketing-mutation", "operator-owned-support"),
    ),

    JobType.PLATFORM_COST_GUARDRAIL_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.cost_guardrail_review.v1", job_type=JobType.PLATFORM_COST_GUARDRAIL_REVIEW, owner="Platform & FinOps", node_route="/api/hybrid-python/platform/cost/guardrails/review/prepare", python_route="/api/v1/jobs/enqueue", stage="release-gate-advisory", canary_max_percent=0, shadow_supported=True, dry_run_only=True, data_classification="finops-aggregate-cost-metadata-only", expected_result_type="platform.cost_guardrail_review.completed", rollback="Hold canary increase until cost blockers are cleared.", acceptance_checks=("Daily spend and monthly forecast are within configured guardrails.", "Worker, queue and artifact-storage costs have evidence.", "Python reviews aggregate cost metadata only."), safeguards=("dry-run-only", "aggregate-cost-metadata-only", "no-billing-provider-mutation")
    ),
    JobType.PLATFORM_ENVIRONMENT_PARITY_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.environment_parity_review.v1", job_type=JobType.PLATFORM_ENVIRONMENT_PARITY_REVIEW, owner="Platform & Release Engineering", node_route="/api/hybrid-python/platform/environment/parity/review/prepare", python_route="/api/v1/jobs/enqueue", stage="release-gate-advisory", canary_max_percent=0, shadow_supported=True, dry_run_only=True, data_classification="environment-config-metadata-only", expected_result_type="platform.environment_parity_review.completed", rollback="Hold rollout until staging and production parity blockers are remediated.", acceptance_checks=("Required variables and services are present in staging and production.", "Secret names/fingerprints are compared without exposing values.", "HMAC/signature and drift-critical settings match expectations."), safeguards=("dry-run-only", "secret-fingerprint-only", "no-secret-values")
    ),

    JobType.PLATFORM_ACCESS_CONTROL_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.access_control_review.v1",
        job_type=JobType.PLATFORM_ACCESS_CONTROL_REVIEW,
        owner="Platform & Security",
        node_route="/api/hybrid-python/platform/access-control/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="release-gate-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="authorization-evidence-metadata-only",
        expected_result_type="platform.access_control_review.completed",
        rollback="Hold rollout or rollback canary until RBAC/ABAC/BOLA blockers are remediated.",
        acceptance_checks=(
            "RBAC, ABAC and object-level authorization evidence is present.",
            "Negative cross-org and BOLA tests deny unauthorized access.",
            "Python reviews evidence only; Node remains owner of authorization and object scope.",
        ),
        safeguards=("dry-run-only", "authorization-evidence-only", "negative-cross-org-tests", "node-owned-authz"),
    ),
    JobType.PLATFORM_DATA_QUALITY_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.data_quality_review.v1",
        job_type=JobType.PLATFORM_DATA_QUALITY_REVIEW,
        owner="Platform & Data",
        node_route="/api/hybrid-python/platform/data-quality/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="release-gate-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="data-quality-aggregate-metadata-only",
        expected_result_type="platform.data_quality_review.completed",
        rollback="Hold rollout until freshness, null/duplicate rates, schema version and redaction blockers are cleared.",
        acceptance_checks=(
            "Freshness, null rate and duplicate rate stay inside thresholds.",
            "Schema version evidence matches the expected data contract.",
            "Sensitive samples are redacted before Python receives data quality metadata.",
        ),
        safeguards=("dry-run-only", "aggregate-quality-metrics-only", "redaction-required", "node-owned-source-data"),
    ),

    JobType.PLATFORM_CI_STAGING_VALIDATION_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.ci_staging_validation_review.v1",
        job_type=JobType.PLATFORM_CI_STAGING_VALIDATION_REVIEW,
        owner="Platform & DevOps",
        node_route="/api/hybrid-python/platform/ci-staging/validation/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="stage-closure-gate-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="ci-staging-validation-metadata-only",
        expected_result_type="platform.ci_staging_validation_review.completed",
        rollback="Keep HYBRID_PYTHON_CANARY_PERCENT=0 and route affected traffic to Node until CI/staging evidence is clean.",
        acceptance_checks=(
            "CI evidence covers npm ci, contracts build, API build, Python tests and Docker/Compose smoke.",
            "Signed HMAC, Redis status store, artifact registry, canary rollback and observability checks are represented by sanitized metadata.",
            "Python reviews evidence only; CI/staging commands and rollout changes remain operator-owned.",
        ),
        safeguards=("dry-run-only", "ci-evidence-metadata-only", "no-build-execution", "node-ci-owned-promotion"),
    ),
    JobType.PLATFORM_RELEASE_CLOSURE_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.release_closure_review.v1",
        job_type=JobType.PLATFORM_RELEASE_CLOSURE_REVIEW,
        owner="Platform & DevOps",
        node_route="/api/hybrid-python/platform/release/closure/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="final-stage-closure-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="release-closure-evidence-metadata-only",
        expected_result_type="platform.release_closure_review.completed",
        rollback="Do not close the stage or increase canary when required gates are missing, holding or rolling back.",
        acceptance_checks=(
            "Closure review includes V25/V26 gates plus CI/staging validation, release decision, rollback drill, post-deploy verify and change ticket evidence.",
            "Open high/critical risks or missing approvals prevent closure.",
            "Python does not approve deployments, close tickets or execute rollout changes.",
        ),
        safeguards=("dry-run-only", "release-evidence-only", "no-ticket-mutation", "operator-owned-closure"),
    ),

    JobType.PLATFORM_PRODUCTION_CANARY_OBSERVATION_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.production_canary_observation_review.v1",
        job_type=JobType.PLATFORM_PRODUCTION_CANARY_OBSERVATION_REVIEW,
        owner="Platform & SRE",
        node_route="/api/hybrid-python/platform/production-canary/observation/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="post-release-canary-observation-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="production-canary-observation-metadata-only",
        expected_result_type="platform.production_canary_observation_review.completed",
        rollback="Pause promotion and route affected traffic back to Node when production canary signals breach thresholds.",
        acceptance_checks=(
            "Aggregate production canary telemetry covers errors, latency, mismatches, failed jobs, queue lag, HMAC rejects and artifact failures.",
            "Rollback triggers are present and enabled before any further canary increase.",
            "Python reviews telemetry only; Node/control-plane owns rollout state and traffic routing.",
        ),
        safeguards=("dry-run-only", "aggregate-telemetry-only", "no-traffic-mutation", "node-owned-rollout"),
    ),
    JobType.PLATFORM_INCIDENT_RESPONSE_READINESS_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.incident_response_readiness_review.v1",
        job_type=JobType.PLATFORM_INCIDENT_RESPONSE_READINESS_REVIEW,
        owner="Platform & SRE",
        node_route="/api/hybrid-python/platform/incident-response/readiness/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="post-release-operations-readiness-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="incident-response-readiness-metadata-only",
        expected_result_type="platform.incident_response_readiness_review.completed",
        rollback="Hold promotion until on-call coverage, escalation paths, runbooks, customer comms and rollback ownership are clean.",
        acceptance_checks=(
            "Primary/secondary on-call, rollback owner, incident commander, customer comms, runbook and pager route coverage are present.",
            "Ack and escalation targets are inside thresholds and runbooks are current.",
            "Python does not page responders or mutate ticketing/on-call systems.",
        ),
        safeguards=("dry-run-only", "incident-readiness-metadata-only", "no-paging", "operator-owned-response"),
    ),
    JobType.PLATFORM_TRAFFIC_PROMOTION_READINESS_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.traffic_promotion_readiness_review.v1",
        job_type=JobType.PLATFORM_TRAFFIC_PROMOTION_READINESS_REVIEW,
        owner="Platform & SRE",
        node_route="/api/hybrid-python/platform/traffic/promotion/readiness/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="post-release-traffic-promotion-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="traffic-promotion-readiness-metadata-only",
        expected_result_type="platform.traffic_promotion_readiness_review.completed",
        rollback="Hold or roll back traffic when promotion gates, freeze windows, observation evidence or approval are not clean.",
        acceptance_checks=("Promotion step is bounded and never executed by Python.", "Release closure, production observation, incident readiness, rollback plan and operator approval are present before traffic increase.", "Active freeze windows or failing gates block promotion."),
        safeguards=("dry-run-only", "promotion-advisory-only", "no-rollout-mutation", "operator-owned-traffic"),
    ),
    JobType.PLATFORM_EVIDENCE_RETENTION_AUDIT_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.evidence_retention_audit_review.v1",
        job_type=JobType.PLATFORM_EVIDENCE_RETENTION_AUDIT_REVIEW,
        owner="Platform & Compliance",
        node_route="/api/hybrid-python/platform/evidence/retention/audit/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="post-release-evidence-retention-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="evidence-retention-audit-metadata-only",
        expected_result_type="platform.evidence_retention_audit_review.completed",
        rollback="Treat missing checksum, redaction, protected download or disallowed piiClass evidence as closure blockers until remediated.",
        acceptance_checks=("Evidence artifacts include sha256/checksum, redactionApplied, piiClass and retention/expiration metadata.", "Required release, canary and incident-readiness report artifact types are present.", "Python audits metadata only and does not download, delete or expose artifacts."),
        safeguards=("dry-run-only", "artifact-metadata-only", "no-artifact-deletion", "protected-downloads"),
    ),
    JobType.PLATFORM_SLO_ERROR_BUDGET_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.slo_error_budget_review.v1",
        job_type=JobType.PLATFORM_SLO_ERROR_BUDGET_REVIEW,
        owner="Platform & SRE",
        node_route="/api/hybrid-python/platform/slo/error-budget/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="post-promotion-slo-error-budget-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="slo-error-budget-metadata-only",
        expected_result_type="platform.slo_error_budget_review.completed",
        rollback="Hold or roll back promotion when SLO burn rate, latency, error rate or error-budget remaining breach thresholds.",
        acceptance_checks=("Aggregate SLO metrics include availability, latency, error rate, burn rate and error-budget remaining.", "Alert coverage evidence is present before traffic expansion.", "Python is advisory only and does not mutate alerts, paging or rollout state."),
        safeguards=("dry-run-only", "slo-metadata-only", "no-alert-mutation", "node-owned-rollout"),
    ),
    JobType.PLATFORM_AUTO_ROLLBACK_SAFEGUARD_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.auto_rollback_safeguard_review.v1",
        job_type=JobType.PLATFORM_AUTO_ROLLBACK_SAFEGUARD_REVIEW,
        owner="Platform & SRE",
        node_route="/api/hybrid-python/platform/auto-rollback/safeguard/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="post-promotion-rollback-safeguard-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="auto-rollback-safeguard-metadata-only",
        expected_result_type="platform.auto_rollback_safeguard_review.completed",
        rollback="Block promotion when automatic trigger, manual override, Node fallback, kill switch, runbook or drill evidence is incomplete.",
        acceptance_checks=("Rollback triggers are enabled and not already fired.", "Manual override, Node fallback and feature-flag kill switch evidence are available.", "Python reviews metadata only; Node/control-plane owns rollback execution."),
        safeguards=("dry-run-only", "rollback-safeguard-metadata-only", "no-feature-flag-mutation", "node-owned-rollback"),
    ),

    JobType.PLATFORM_THIRD_PARTY_DEPENDENCY_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.third_party_dependency_review.v1",
        job_type=JobType.PLATFORM_THIRD_PARTY_DEPENDENCY_REVIEW,
        owner="Platform & SRE",
        node_route="/api/hybrid-python/platform/third-party/dependencies/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="sustained-traffic-third-party-dependency-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="third-party-dependency-metadata-only",
        expected_result_type="platform.third_party_dependency_review.completed",
        rollback="Hold or roll back expansion when vendor health, active incidents, status pages or rate-limit headroom breach thresholds.",
        acceptance_checks=("Dependency coverage includes Redis, object/artifact storage, database, observability and auth provider evidence.", "Active third-party incidents, degraded status pages, high latency/error rate or low rate-limit headroom block promotion.", "Python reviews sanitized metadata only and does not call vendors or mutate provider configuration."),
        safeguards=("dry-run-only", "dependency-metadata-only", "no-vendor-mutation", "operator-owned-failover"),
    ),
    JobType.PLATFORM_CAPACITY_SCALING_READINESS_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.capacity_scaling_readiness_review.v1",
        job_type=JobType.PLATFORM_CAPACITY_SCALING_READINESS_REVIEW,
        owner="Platform & SRE",
        node_route="/api/hybrid-python/platform/capacity/scaling/readiness/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="sustained-traffic-capacity-scaling-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="capacity-scaling-readiness-metadata-only",
        expected_result_type="platform.capacity_scaling_readiness_review.completed",
        rollback="Hold or roll back expansion when queue lag, worker capacity, autoscaling, load-test, CPU, memory or latency evidence is incomplete or breached.",
        acceptance_checks=("Capacity evidence includes queue lag, worker concurrency, CPU, memory, latency, autoscaling and load-test status.", "Traffic expansion is advisory only and cannot be executed by Python.", "Node/control-plane and infrastructure automation remain owners of scaling and rollout mutation."),
        safeguards=("dry-run-only", "capacity-metadata-only", "no-autoscaling-mutation", "node-owned-traffic"),
    ),
    JobType.PLATFORM_COMPLIANCE_PRIVACY_EVIDENCE_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.compliance_privacy_evidence_review.v1",
        job_type=JobType.PLATFORM_COMPLIANCE_PRIVACY_EVIDENCE_REVIEW,
        owner="Platform & Compliance",
        node_route="/api/hybrid-python/platform/compliance/privacy/evidence/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="sustained-operations-compliance-privacy-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="compliance-privacy-evidence-metadata-only",
        expected_result_type="platform.compliance_privacy_evidence_review.completed",
        rollback="Block sustained traffic when privacy preflight, retention, audit, security, access-control, data-quality, DPA/DPIA or artifact metadata are incomplete.",
        acceptance_checks=("Required privacy/compliance evidence is present and passing.", "Artifacts carry redaction, protected-download and allowed piiClass metadata.", "Python is advisory only and does not mutate privacy systems, approvals or artifact ACLs."),
        safeguards=("dry-run-only", "compliance-metadata-only", "no-privacy-mutation", "operator-owned-approval"),
    ),
    JobType.PLATFORM_RUNBOOK_DRILL_VERIFICATION_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.runbook_drill_verification_review.v1",
        job_type=JobType.PLATFORM_RUNBOOK_DRILL_VERIFICATION_REVIEW,
        owner="Platform & SRE",
        node_route="/api/hybrid-python/platform/runbooks/drills/verification/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="sustained-operations-runbook-drill-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="runbook-drill-verification-metadata-only",
        expected_result_type="platform.runbook_drill_verification_review.completed",
        rollback="Block sustained operations when rollback, incident, restore, support-escalation or privacy runbooks/drills are missing, stale or failing.",
        acceptance_checks=("Required runbooks have links/artifacts, owner acknowledgement and recent review metadata.", "Required drills have passing recent execution evidence.", "Python verifies metadata only and does not mutate runbooks, tickets or paging systems."),
        safeguards=("dry-run-only", "runbook-drill-metadata-only", "no-ticket-mutation", "operator-owned-drills"),
    ),
    JobType.PLATFORM_DISASTER_RECOVERY_BACKUP_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.disaster_recovery_backup_review.v1",
        job_type=JobType.PLATFORM_DISASTER_RECOVERY_BACKUP_REVIEW,
        owner="Platform & SRE",
        node_route="/api/hybrid-python/platform/disaster-recovery/backups/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="sustained-operations-dr-backup-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="disaster-recovery-backup-metadata-only",
        expected_result_type="platform.disaster_recovery_backup_review.completed",
        rollback="Block sustained operations when required backups, encryption/offsite evidence or restore drills are missing, stale or failing.",
        acceptance_checks=("Required backup sets have verification, encryption, checksum/artifact and age evidence.", "Recent restore drill evidence proves RPO/RTO targets are within threshold.", "Python is advisory only and does not execute restore, failover or backup mutation."),
        safeguards=("dry-run-only", "dr-backup-metadata-only", "no-restore-execution", "operator-owned-dr"),
    ),
    JobType.PLATFORM_CHANGE_MIGRATION_READINESS_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.change_migration_readiness_review.v1",
        job_type=JobType.PLATFORM_CHANGE_MIGRATION_READINESS_REVIEW,
        owner="Platform & DevOps",
        node_route="/api/hybrid-python/platform/change-migration/readiness/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="sustained-operations-change-migration-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="change-migration-readiness-metadata-only",
        expected_result_type="platform.change_migration_readiness_review.completed",
        rollback="Block change windows or traffic expansion when dry-run rehearsal, approval, backup, rollback or migration reversibility evidence is incomplete.",
        acceptance_checks=("Migration dry-run/rehearsal evidence is passing and destructive migrations are reversible or blocked.", "Change tickets, approvals, rollback/backout plan and backup-before-migration evidence are present.", "Python is advisory only and does not apply migrations, approve tickets or mutate schemas."),
        safeguards=("dry-run-only", "migration-metadata-only", "no-schema-mutation", "operator-owned-change"),
    ),
    JobType.PLATFORM_CONFIGURATION_SECRET_ROTATION_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.configuration_secret_rotation_review.v1",
        job_type=JobType.PLATFORM_CONFIGURATION_SECRET_ROTATION_REVIEW,
        owner="Platform & Security",
        node_route="/api/hybrid-python/platform/configuration/secrets/rotation/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="sustained-operations-configuration-secret-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="configuration-secret-rotation-metadata-only",
        expected_result_type="platform.configuration_secret_rotation_review.completed",
        rollback="Block sustained operations when required secrets are missing, stale, unmanaged, rotation-due or config drift exceeds tolerance.",
        acceptance_checks=("Required secrets have sanitized age, external-store, rotation and break-glass evidence.", "Config drift evidence is redacted and within allowed tolerance.", "Python is advisory only and never reads or rotates secret values."),
        safeguards=("dry-run-only", "secret-metadata-only", "no-secret-value-access", "operator-owned-rotation"),
    ),
    JobType.PLATFORM_MAINTENANCE_WINDOW_READINESS_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.maintenance_window_readiness_review.v1",
        job_type=JobType.PLATFORM_MAINTENANCE_WINDOW_READINESS_REVIEW,
        owner="Platform & SRE",
        node_route="/api/hybrid-python/platform/maintenance/window/readiness/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="sustained-operations-maintenance-window-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="maintenance-window-readiness-metadata-only",
        expected_result_type="platform.maintenance_window_readiness_review.completed",
        rollback="Block maintenance windows when required approvals, comms, tasks, rollback or freeze-period evidence is incomplete.",
        acceptance_checks=("A passing low-traffic maintenance window and owner approval are present.", "Backup, rollback and post-verify tasks are passing before execution.", "Python is advisory only and does not schedule maintenance, page operators or change traffic."),
        safeguards=("dry-run-only", "maintenance-metadata-only", "operator-owned-maintenance", "no-traffic-mutation"),
    ),
    JobType.PLATFORM_AUDIT_FORENSICS_READINESS_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.audit_forensics_readiness_review.v1",
        job_type=JobType.PLATFORM_AUDIT_FORENSICS_READINESS_REVIEW,
        owner="Platform & Security",
        node_route="/api/hybrid-python/platform/audit-forensics/readiness/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="sustained-operations-audit-forensics-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="audit-forensics-readiness-metadata-only",
        expected_result_type="platform.audit_forensics_readiness_review.completed",
        rollback="Block sustained operations when audit source coverage, immutable forensic evidence, chain-of-custody or investigation drill evidence is missing or failing.",
        acceptance_checks=("Required audit sources have complete immutable metadata and gap evidence within threshold.", "Forensic artifacts are redacted, verified and chain-of-custody is passing.", "Python is advisory only and does not query logs, export evidence or mutate investigations."),
        safeguards=("dry-run-only", "audit-forensics-metadata-only", "no-log-query-or-export", "security-owned-investigation"),
    ),
    JobType.PLATFORM_BUSINESS_CONTINUITY_READINESS_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.business_continuity_readiness_review.v1",
        job_type=JobType.PLATFORM_BUSINESS_CONTINUITY_READINESS_REVIEW,
        owner="Platform & Operations",
        node_route="/api/hybrid-python/platform/business-continuity/readiness/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="sustained-operations-business-continuity-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="business-continuity-readiness-metadata-only",
        expected_result_type="platform.business_continuity_readiness_review.completed",
        rollback="Block sustained operations when continuity plans, owner acknowledgement, team coverage, fallback procedures, communications or exercises are missing or failing.",
        acceptance_checks=("Required domain continuity plans have owner acknowledgement and are approved.", "Customer/operator communications, fallback procedures and continuity exercise evidence are passing.", "Python is advisory only and does not page teams, send communications or execute fallback procedures."),
        safeguards=("dry-run-only", "business-continuity-metadata-only", "no-customer-comms", "operator-owned-continuity"),
    ),
    JobType.PLATFORM_POST_INCIDENT_LEARNING_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.post_incident_learning_review.v1",
        job_type=JobType.PLATFORM_POST_INCIDENT_LEARNING_REVIEW,
        owner="Platform & SRE",
        node_route="/api/hybrid-python/platform/post-incident/learning/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="sustained-operations-post-incident-learning-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="post-incident-learning-metadata-only",
        expected_result_type="platform.post_incident_learning_review.completed",
        rollback="Block sustained expansion when incident learnings, postmortems, action items or regression guards are missing or failing.",
        acceptance_checks=("Required incident classes have sanitized learning evidence and postmortem linkage.", "Action items are owner-acknowledged and not stale beyond the configured threshold.", "Python is advisory only and does not mutate incident tickets, postmortems or remediation backlog."),
        safeguards=("dry-run-only", "post-incident-learning-metadata-only", "no-ticket-mutation", "operator-owned-remediation"),
    ),
    JobType.PLATFORM_TECH_DEBT_GOVERNANCE_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.tech_debt_governance_review.v1",
        job_type=JobType.PLATFORM_TECH_DEBT_GOVERNANCE_REVIEW,
        owner="Platform & Engineering",
        node_route="/api/hybrid-python/platform/tech-debt/governance/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="sustained-operations-tech-debt-governance-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="tech-debt-governance-metadata-only",
        expected_result_type="platform.tech_debt_governance_review.completed",
        rollback="Block sustained expansion when critical debt, waivers, ownership or remediation-plan evidence exceeds policy.",
        acceptance_checks=("Debt register metadata covers required categories with severity and owner acknowledgement.", "Critical debt and waiver age are within policy thresholds and a remediation plan is passing.", "Python is advisory only and does not mutate backlog items, waivers or remediation plans."),
        safeguards=("dry-run-only", "tech-debt-metadata-only", "no-backlog-mutation", "engineering-owned-remediation"),
    ),
    JobType.PLATFORM_VENDOR_RESILIENCE_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.vendor_resilience_review.v1",
        job_type=JobType.PLATFORM_VENDOR_RESILIENCE_REVIEW,
        owner="Platform & SRE",
        node_route="/api/hybrid-python/platform/vendor/resilience/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="sustained-operations-vendor-resilience-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="vendor-resilience-metadata-only",
        expected_result_type="platform.vendor_resilience_review.completed",
        rollback="Block sustained expansion when critical vendors, provider incidents, SLA evidence or exit plans are missing or failing.",
        acceptance_checks=("Required vendor status metadata is present and healthy within age thresholds.", "SLA, incident and vendor exit-plan evidence are sanitized and operator-owned.", "Python is advisory only and does not mutate vendors, provider config, escalation tickets or procurement records."),
        safeguards=("dry-run-only", "vendor-resilience-metadata-only", "no-provider-config-mutation", "operator-owned-vendor-remediation"),
    ),
    JobType.PLATFORM_KNOWLEDGE_TRANSFER_READINESS_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.knowledge_transfer_readiness_review.v1",
        job_type=JobType.PLATFORM_KNOWLEDGE_TRANSFER_READINESS_REVIEW,
        owner="Platform & Engineering",
        node_route="/api/hybrid-python/platform/knowledge-transfer/readiness/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="sustained-operations-knowledge-transfer-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="knowledge-transfer-metadata-only",
        expected_result_type="platform.knowledge_transfer_readiness_review.completed",
        rollback="Block sustained expansion when runbooks, ownership, training or handoff checklist evidence is missing or stale.",
        acceptance_checks=("Required knowledge topics have reviewed, sanitized artifacts within freshness policy.", "Primary and backup owners, training and handoff checklists are complete.", "Python is advisory only and does not mutate docs, owners, calendars or training systems."),
        safeguards=("dry-run-only", "knowledge-transfer-metadata-only", "no-doc-or-owner-mutation", "operator-owned-handoff"),
    ),
    JobType.PLATFORM_ARCHITECTURE_OWNERSHIP_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.architecture_ownership_review.v1", job_type=JobType.PLATFORM_ARCHITECTURE_OWNERSHIP_REVIEW, owner="Platform & Architecture", node_route="/api/hybrid-python/platform/architecture/ownership/review/prepare", python_route="/api/v1/jobs/enqueue", stage="sustained-operations-architecture-ownership-advisory", canary_max_percent=0, shadow_supported=False, dry_run_only=True, data_classification="architecture-ownership-metadata-only", expected_result_type="platform.architecture_ownership_review.completed", rollback="Block sustained expansion when architecture artifacts, service boundaries, owners or ADR evidence are missing, stale or failing.", acceptance_checks=("Required architecture artifacts are approved, sanitized and within freshness policy.", "Service boundaries, owner acknowledgements and architecture decision records are present and passing.", "Python is advisory only and does not mutate architecture records, service boundaries or ownership assignments."), safeguards=("dry-run-only", "architecture-ownership-metadata-only", "no-architecture-mutation", "operator-owned-architecture-changes"),
    ),
    JobType.PLATFORM_EXECUTIVE_METRICS_GOVERNANCE_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.executive_metrics_governance_review.v1", job_type=JobType.PLATFORM_EXECUTIVE_METRICS_GOVERNANCE_REVIEW, owner="Platform & Leadership", node_route="/api/hybrid-python/platform/executive-metrics/governance/review/prepare", python_route="/api/v1/jobs/enqueue", stage="sustained-operations-executive-metrics-governance-advisory", canary_max_percent=0, shadow_supported=False, dry_run_only=True, data_classification="executive-metrics-governance-metadata-only", expected_result_type="platform.executive_metrics_governance_review.completed", rollback="Block sustained expansion when executive metric definitions, dashboards, cadence or owners are missing or failing.", acceptance_checks=("Required executive metrics have approved, sanitized definitions and owner acknowledgement.", "Dashboards and review cadence are present, fresh and access-reviewed.", "Python is advisory only and does not publish dashboards, send executive reports or mutate metric ownership."), safeguards=("dry-run-only", "executive-metrics-metadata-only", "no-dashboard-or-report-mutation", "operator-owned-reporting"),
    ),

    JobType.PLATFORM_DOMAIN_ADOPTION_READINESS_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.domain_adoption_readiness_review.v1",
        job_type=JobType.PLATFORM_DOMAIN_ADOPTION_READINESS_REVIEW,
        owner="Platform & Domain Owners",
        node_route="/api/hybrid-python/platform/domain-adoption/readiness/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="phase-2-domain-adoption-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="domain-adoption-readiness-metadata-only",
        expected_result_type="platform.domain_adoption_readiness_review.completed",
        rollback="Block Phase 2 adoption expansion when required domains, owner acknowledgements, rollback plans or readiness evidence are missing or failing.",
        acceptance_checks=(
            "Required product domains have sanitized readiness evidence and meet the readiness score threshold.",
            "Domain owners have acknowledged Phase 2 adoption and rollback responsibilities.",
            "Python is advisory only and does not change tenant routing, feature flags, domain ownership or product configuration.",
        ),
        safeguards=("dry-run-only", "domain-adoption-metadata-only", "no-routing-or-flag-mutation", "operator-owned-domain-adoption"),
    ),
    JobType.PLATFORM_PHASE_TWO_ROLLOUT_GOVERNANCE_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.phase_two_rollout_governance_review.v1",
        job_type=JobType.PLATFORM_PHASE_TWO_ROLLOUT_GOVERNANCE_REVIEW,
        owner="Platform & Release Governance",
        node_route="/api/hybrid-python/platform/phase-two/rollout/governance/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="phase-2-rollout-governance-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="phase-two-rollout-governance-metadata-only",
        expected_result_type="platform.phase_two_rollout_governance_review.completed",
        rollback="Block Phase 2 rollout when governance milestones, approvals, guardrails, communication or support evidence are incomplete or failing.",
        acceptance_checks=(
            "Phase 2 rollout milestones, guardrails, cohorts and approvals are present and sanitized.",
            "Communication and support plans are approved before expanding product usage.",
            "Python is advisory only and does not promote traffic, notify users, mutate cohorts or approve releases.",
        ),
        safeguards=("dry-run-only", "phase-two-governance-metadata-only", "no-cohort-or-traffic-mutation", "operator-owned-rollout-approval"),
    ),

    JobType.PLATFORM_DOMAIN_PILOT_EXECUTION_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.domain_pilot_execution_review.v1",
        job_type=JobType.PLATFORM_DOMAIN_PILOT_EXECUTION_REVIEW,
        owner="Platform & Domain Owners",
        node_route="/api/hybrid-python/platform/domain-pilot/execution/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="phase-2-domain-pilot-execution-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="domain-pilot-execution-metadata-only",
        expected_result_type="platform.domain_pilot_execution_review.completed",
        rollback="Block Phase 2 pilot expansion when pilot runs, domain checks, acceptance criteria, operator approvals or rollback evidence are missing or failing.",
        acceptance_checks=(
            "Pilot domains and pilot run evidence are sanitized and meet success/error thresholds.",
            "Acceptance criteria, operator approvals and rollback plan are present before domain pilot expansion.",
            "Python is advisory only and does not enable domains, mutate feature flags, route traffic or execute rollback.",
        ),
        safeguards=("dry-run-only", "domain-pilot-execution-metadata-only", "no-domain-or-traffic-mutation", "operator-owned-pilot-execution"),
    ),
    JobType.PLATFORM_PHASE_TWO_EXPANSION_CONTROL_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.phase_two_expansion_control_review.v1",
        job_type=JobType.PLATFORM_PHASE_TWO_EXPANSION_CONTROL_REVIEW,
        owner="Platform & Release Governance",
        node_route="/api/hybrid-python/platform/phase-two/expansion/control/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="phase-2-expansion-control-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="phase-two-expansion-control-metadata-only",
        expected_result_type="platform.phase_two_expansion_control_review.completed",
        rollback="Block Phase 2 wave expansion when traffic limits, checkpoints, rollback triggers or approval evidence are missing or failing.",
        acceptance_checks=(
            "Expansion waves are bounded by target percentages and checkpoint pass counts.",
            "Rollback triggers and operator approvals are present before expanding traffic.",
            "Python is advisory only and does not change traffic, feature flags, cohorts or rollback state.",
        ),
        safeguards=("dry-run-only", "phase-two-expansion-control-metadata-only", "no-traffic-or-rollback-mutation", "operator-owned-expansion"),
    ),
    JobType.PLATFORM_DOMAIN_OUTCOME_MEASUREMENT_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.domain_outcome_measurement_review.v1",
        job_type=JobType.PLATFORM_DOMAIN_OUTCOME_MEASUREMENT_REVIEW,
        owner="Platform & Domain Owners",
        node_route="/api/hybrid-python/platform/domain-outcomes/measurement/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="phase-2-outcome-measurement-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="domain-outcome-measurement-metadata-only",
        expected_result_type="platform.domain_outcome_measurement_review.completed",
        rollback="Block Phase 2 domain expansion when required outcome metrics, baselines, adoption signals or support evidence are missing or regressing.",
        acceptance_checks=("Required outcome metrics and baselines are sanitized and meet regression thresholds.", "Adoption/support signals are reviewed before further Phase 2 expansion.", "Python is advisory only and does not publish metrics, promote domains or mutate product configuration."),
        safeguards=("dry-run-only", "domain-outcome-metadata-only", "no-metric-or-domain-mutation", "operator-owned-outcome-decisions"),
    ),
    JobType.PLATFORM_PHASE_TWO_FEEDBACK_ADOPTION_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.phase_two_feedback_adoption_review.v1",
        job_type=JobType.PLATFORM_PHASE_TWO_FEEDBACK_ADOPTION_REVIEW,
        owner="Platform & Product Operations",
        node_route="/api/hybrid-python/platform/phase-two/feedback/adoption/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="phase-2-feedback-adoption-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="phase-two-feedback-adoption-metadata-only",
        expected_result_type="platform.phase_two_feedback_adoption_review.completed",
        rollback="Block Phase 2 adoption expansion when critical feedback, owner responses, communication approval or adoption decisions are missing or failing.",
        acceptance_checks=("Feedback, owner responses and adoption decisions are sanitized and approved.", "Communications are redacted/minimized before adoption expansion.", "Python is advisory only and does not close feedback, send communications or mutate rollout/adoption state."),
        safeguards=("dry-run-only", "feedback-adoption-metadata-only", "no-feedback-or-comms-mutation", "operator-owned-adoption-decisions"),
    ),
    JobType.PLATFORM_DOMAIN_GRADUATION_READINESS_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.domain_graduation_readiness_review.v1",
        job_type=JobType.PLATFORM_DOMAIN_GRADUATION_READINESS_REVIEW,
        owner="Platform & Domain Owners",
        node_route="/api/hybrid-python/platform/domain-graduation/readiness/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="phase-2-domain-graduation-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="domain-graduation-readiness-metadata-only",
        expected_result_type="platform.domain_graduation_readiness_review.completed",
        rollback="Block domain graduation when candidates, criteria, outcome summary, risk register, approvals or evidence are missing or failing.",
        acceptance_checks=("Graduation candidates and criteria are sanitized and meet outcome thresholds.", "Risk register and approvals are reviewed before broad adoption.", "Python is advisory only and does not graduate domains, mutate traffic or enable features."),
        safeguards=("dry-run-only", "domain-graduation-metadata-only", "no-domain-or-traffic-mutation", "operator-owned-graduation"),
    ),
    JobType.PLATFORM_PHASE_TWO_LEARNING_CONSOLIDATION_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.phase_two_learning_consolidation_review.v1",
        job_type=JobType.PLATFORM_PHASE_TWO_LEARNING_CONSOLIDATION_REVIEW,
        owner="Platform & Product Operations",
        node_route="/api/hybrid-python/platform/phase-two/learning/consolidation/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="phase-2-learning-consolidation-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="phase-two-learning-consolidation-metadata-only",
        expected_result_type="platform.phase_two_learning_consolidation_review.completed",
        rollback="Block Phase 2 pilot closure when learnings, decisions, playbook updates, owner acknowledgements or evidence are missing or failing.",
        acceptance_checks=("Pilot learnings, experiments and decisions are captured without raw feedback bodies or PHI.", "Playbook updates and owner acknowledgements are present before closing the phase.", "Python is advisory only and does not publish playbooks, mutate roadmap decisions or change rollout state."),
        safeguards=("dry-run-only", "phase-two-learning-metadata-only", "no-playbook-or-rollout-mutation", "operator-owned-learning-closure"),
    ),
    JobType.PLATFORM_DOMAIN_WIDE_ADOPTION_READINESS_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.domain_wide_adoption_readiness_review.v1",
        job_type=JobType.PLATFORM_DOMAIN_WIDE_ADOPTION_READINESS_REVIEW,
        owner="Platform & Domain Owners",
        node_route="/api/hybrid-python/platform/domain-wide-adoption/readiness/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="phase-2-domain-wide-adoption-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="domain-wide-adoption-readiness-metadata-only",
        expected_result_type="platform.domain_wide_adoption_readiness_review.completed",
        rollback="Block broad domain adoption when domains, rollout evidence, support readiness, rollback plan, approvals or evidence are missing or failing.",
        acceptance_checks=("Graduated pilot domains are sanitized and owner-approved before broad adoption.", "Support readiness and rollback plan are present before wider rollout.", "Python is advisory only and does not expand traffic, enable domains, change flags or execute rollback."),
        safeguards=("dry-run-only", "domain-wide-adoption-metadata-only", "no-domain-traffic-or-flag-mutation", "operator-owned-broad-adoption"),
    ),
    JobType.PLATFORM_PHASE_TWO_SUPPORT_TRANSITION_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.phase_two_support_transition_review.v1",
        job_type=JobType.PLATFORM_PHASE_TWO_SUPPORT_TRANSITION_REVIEW,
        owner="Platform & Support Operations",
        node_route="/api/hybrid-python/platform/phase-two/support/transition/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="phase-2-support-transition-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="phase-two-support-transition-metadata-only",
        expected_result_type="platform.phase_two_support_transition_review.completed",
        rollback="Block broad Phase 2 adoption when support queues, escalation paths, training, runbook updates, approvals or evidence are missing or failing.",
        acceptance_checks=("Support queues, escalation paths, training and runbooks are sanitized and approved.", "Owner approvals are captured before support transition.", "Python is advisory only and does not mutate support queues, escalation routing, communications or runbooks."),
        safeguards=("dry-run-only", "phase-two-support-transition-metadata-only", "no-support-queue-or-runbook-mutation", "operator-owned-support-transition"),
    ),
    JobType.PLATFORM_DOMAIN_ADOPTION_STABILIZATION_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.domain_adoption_stabilization_review.v1",
        job_type=JobType.PLATFORM_DOMAIN_ADOPTION_STABILIZATION_REVIEW,
        owner="Platform & Domain Owners",
        node_route="/api/hybrid-python/platform/domain-adoption/stabilization/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="phase-2-domain-adoption-stabilization-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="domain-adoption-stabilization-metadata-only",
        expected_result_type="platform.domain_adoption_stabilization_review.completed",
        rollback="Block Phase 2 stabilization closure when health, support, regression watch, approvals or evidence are missing or failing.",
        acceptance_checks=("Broad-adoption domains and health/support signals are sanitized and reviewed.", "Regression watch and owner approvals are present before declaring stabilization.", "Python is advisory only and does not mutate traffic, feature flags, user state or rollback controls."),
        safeguards=("dry-run-only", "domain-adoption-stabilization-metadata-only", "no-traffic-flag-or-user-mutation", "operator-owned-stabilization"),
    ),
    JobType.PLATFORM_PHASE_TWO_VALUE_REALIZATION_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.phase_two_value_realization_review.v1",
        job_type=JobType.PLATFORM_PHASE_TWO_VALUE_REALIZATION_REVIEW,
        owner="Platform, Product & Executive Sponsors",
        node_route="/api/hybrid-python/platform/phase-two/value-realization/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="phase-2-value-realization-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="phase-two-value-realization-metadata-only",
        expected_result_type="platform.phase_two_value_realization_review.completed",
        rollback="Block Phase 2 closure when value metrics, benefit baselines, adoption summary, executive review, approvals or evidence are missing or failing.",
        acceptance_checks=("Value metrics and baselines are sanitized and tied to adoption outcomes.", "Executive reviews and owner approvals are present before closing Phase 2.", "Python is advisory only and does not publish executive reports, mutate roadmap decisions or update financial systems."),
        safeguards=("dry-run-only", "phase-two-value-realization-metadata-only", "no-financial-roadmap-or-reporting-mutation", "operator-owned-value-realization"),
    ),

    JobType.PLATFORM_PHASE_TWO_CLOSURE_ACCEPTANCE_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.phase_two_closure_acceptance_review.v1",
        job_type=JobType.PLATFORM_PHASE_TWO_CLOSURE_ACCEPTANCE_REVIEW,
        owner="Platform, Product & Executive Sponsors",
        node_route="/api/hybrid-python/platform/phase-two/closure/acceptance/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="phase-2-closure-acceptance-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="phase-two-closure-acceptance-metadata-only",
        expected_result_type="platform.phase_two_closure_acceptance_review.completed",
        rollback="Block Phase 2 closure when acceptance criteria, value realization, support transition, approvals or evidence are missing or failing.",
        acceptance_checks=("Closure criteria and acceptance evidence are sanitized and complete.", "Open risks are below allowed thresholds and owner approvals are captured.", "Python is advisory only and does not close phases, publish executive reporting, mutate roadmaps or change rollout state."),
        safeguards=("dry-run-only", "phase-two-closure-acceptance-metadata-only", "no-phase-roadmap-or-rollout-mutation", "operator-owned-phase-closure"),
    ),
    JobType.PLATFORM_PHASE_THREE_TRANSITION_READINESS_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.phase_three_transition_readiness_review.v1",
        job_type=JobType.PLATFORM_PHASE_THREE_TRANSITION_READINESS_REVIEW,
        owner="Platform & Program Operations",
        node_route="/api/hybrid-python/platform/phase-three/transition/readiness/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="phase-3-transition-readiness-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="phase-three-transition-readiness-metadata-only",
        expected_result_type="platform.phase_three_transition_readiness_review.completed",
        rollback="Block Phase 3 entry when transition milestones, dependency readiness, owner handoffs, guardrails, entry criteria or approvals are missing or failing.",
        acceptance_checks=("Transition milestones, owner handoffs and entry criteria are sanitized and approved.", "Rollout guardrails and dependency readiness are attached before Phase 3 entry.", "Python is advisory only and does not transition ownership, change traffic, enable features or execute rollout actions."),
        safeguards=("dry-run-only", "phase-three-transition-readiness-metadata-only", "no-traffic-ownership-or-roadmap-mutation", "operator-owned-phase-transition"),
    ),

    JobType.PLATFORM_PHASE_THREE_DOMAIN_WAVE_READINESS_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.phase_three_domain_wave_readiness_review.v1",
        job_type=JobType.PLATFORM_PHASE_THREE_DOMAIN_WAVE_READINESS_REVIEW,
        owner="Platform & Domain Rollout Leads",
        node_route="/api/hybrid-python/platform/phase-three/domain-wave/readiness/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="phase-3-domain-wave-readiness-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="phase-three-domain-wave-readiness-metadata-only",
        expected_result_type="platform.phase_three_domain_wave_readiness_review.completed",
        rollback="Block a Phase 3 domain wave when wave criteria, guardrails, support coverage, rollback coverage, approvals or evidence are missing or failing.",
        acceptance_checks=("Domain wave candidates, criteria, support coverage and rollback coverage are sanitized and complete.", "Rollout guardrails and approvals are attached before any operator-owned wave launch.", "Python is advisory only and does not increase traffic, launch waves, mutate feature flags or contact customers."),
        safeguards=("dry-run-only", "phase-three-domain-wave-readiness-metadata-only", "no-wave-launch-traffic-or-flag-mutation", "operator-owned-domain-wave-rollout"),
    ),
    JobType.PLATFORM_PHASE_THREE_OPERATING_MODEL_ALIGNMENT_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.phase_three_operating_model_alignment_review.v1",
        job_type=JobType.PLATFORM_PHASE_THREE_OPERATING_MODEL_ALIGNMENT_REVIEW,
        owner="Platform, SRE & Domain Operations",
        node_route="/api/hybrid-python/platform/phase-three/operating-model/alignment/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="phase-3-operating-model-alignment-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="phase-three-operating-model-alignment-metadata-only",
        expected_result_type="platform.phase_three_operating_model_alignment_review.completed",
        rollback="Block Phase 3 scale-out when ownership, support model, runbook coverage, metric governance, training coverage, escalation model or approvals are incomplete.",
        acceptance_checks=("Ownership matrix, support model, runbooks, metrics, training and escalation model are sanitized and aligned.", "Approvals confirm that operating responsibilities are accepted before Phase 3 scale-out.", "Python is advisory only and does not assign staff, mutate support queues, publish governance records or change traffic."),
        safeguards=("dry-run-only", "phase-three-operating-model-alignment-metadata-only", "no-staffing-support-or-governance-mutation", "operator-owned-operating-model"),
    ),
    JobType.PLATFORM_PHASE_THREE_WAVE_EXECUTION_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.phase_three_wave_execution_review.v1",
        job_type=JobType.PLATFORM_PHASE_THREE_WAVE_EXECUTION_REVIEW,
        owner="Platform & Domain Rollout Leads",
        node_route="/api/hybrid-python/platform/phase-three/wave/execution/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="phase-3-wave-execution-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="phase-three-wave-execution-metadata-only",
        expected_result_type="platform.phase_three_wave_execution_review.completed",
        rollback="Hold or roll back Phase 3 wave expansion when executed-domain evidence, domain signals, guardrails, rollback readiness, critical incidents or approvals are missing or failing.",
        acceptance_checks=("Executed domain wave, health signals, guardrails and rollback readiness are sanitized and complete.", "Open critical incidents are within threshold and approvals are captured before further expansion.", "Python is advisory only and does not execute waves, increase traffic, mutate feature flags or contact customers."),
        safeguards=("dry-run-only", "phase-three-wave-execution-metadata-only", "no-wave-traffic-or-flag-mutation", "operator-owned-wave-execution"),
    ),
    JobType.PLATFORM_PHASE_THREE_ADOPTION_VALUE_TRACKING_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.phase_three_adoption_value_tracking_review.v1",
        job_type=JobType.PLATFORM_PHASE_THREE_ADOPTION_VALUE_TRACKING_REVIEW,
        owner="Platform, Product & Domain Owners",
        node_route="/api/hybrid-python/platform/phase-three/adoption-value/tracking/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="phase-3-adoption-value-tracking-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="phase-three-adoption-value-tracking-metadata-only",
        expected_result_type="platform.phase_three_adoption_value_tracking_review.completed",
        rollback="Hold Phase 3 expansion when adoption metrics, value metrics, feedback review, benefit hypotheses, owner reviews, approvals or evidence are missing or below thresholds.",
        acceptance_checks=("Adoption and value metrics are sanitized and above configured thresholds.", "Feedback, benefit hypotheses, owner reviews and approvals are captured before expanding rollout.", "Python is advisory only and does not mutate metrics stores, publish executive reports, change roadmap state or alter traffic."),
        safeguards=("dry-run-only", "phase-three-adoption-value-tracking-metadata-only", "no-metrics-roadmap-or-traffic-mutation", "operator-owned-value-tracking"),
    ),
    JobType.PLATFORM_PHASE_THREE_GAP_REMEDIATION_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.phase_three_gap_remediation_review.v1",
        job_type=JobType.PLATFORM_PHASE_THREE_GAP_REMEDIATION_REVIEW,
        owner="Platform, Program Operations & Domain Owners",
        node_route="/api/hybrid-python/platform/phase-three/gap-remediation/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="phase-3-gap-remediation-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="phase-three-gap-remediation-metadata-only",
        expected_result_type="platform.phase_three_gap_remediation_review.completed",
        rollback="Hold Phase 3 completion when remediation items, residual gaps, risk acceptances, owner actions or evidence are incomplete or failing.",
        acceptance_checks=("Remediation items, open risks and owner actions are sanitized and complete.", "Critical gaps are below threshold and residual risk acceptance is captured before stage completion.", "Python is advisory only and does not mutate backlog, risks, tickets, approvals or rollout state."),
        safeguards=("dry-run-only", "phase-three-gap-remediation-metadata-only", "no-backlog-risk-or-rollout-mutation", "operator-owned-remediation"),
    ),
    JobType.PLATFORM_MIGRATION_STAGE_COMPLETION_READINESS_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.migration_stage_completion_readiness_review.v1",
        job_type=JobType.PLATFORM_MIGRATION_STAGE_COMPLETION_READINESS_REVIEW,
        owner="Platform, Product & Executive Sponsors",
        node_route="/api/hybrid-python/platform/migration-stage/completion/readiness/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="migration-stage-completion-readiness-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="migration-stage-completion-readiness-metadata-only",
        expected_result_type="platform.migration_stage_completion_readiness_review.completed",
        rollback="Block stage closeout when completion criteria, validation results, closure approvals, residual risks or final evidence are missing or failing.",
        acceptance_checks=("Completion criteria and validation results are sanitized and passing.", "Residual risks are closed or accepted and final approvals are captured before stage closeout.", "Python is advisory only and does not close stages, mutate roadmap, approve risks or change rollout state."),
        safeguards=("dry-run-only", "migration-stage-completion-readiness-metadata-only", "no-stage-roadmap-or-rollout-mutation", "operator-owned-stage-closeout"),
    ),

    JobType.PLATFORM_PHASE_THREE_REMEDIATION_CLOSURE_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.phase_three_remediation_closure_review.v1",
        job_type=JobType.PLATFORM_PHASE_THREE_REMEDIATION_CLOSURE_REVIEW,
        owner="Platform, Program Operations & Domain Owners",
        node_route="/api/hybrid-python/platform/phase-three/remediation/closure/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="phase-3-remediation-closure-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="phase-three-remediation-closure-metadata-only",
        expected_result_type="platform.phase_three_remediation_closure_review.completed",
        rollback="Block final stage exit when closure items, remediation evidence, residual risks, acceptance records, owner approvals or evidence are missing or failing.",
        acceptance_checks=("Closure and remediation evidence are sanitized and complete.", "Residual risks are closed/accepted and owner approvals are captured before executive handoff.", "Python is advisory only and does not close tickets, approve risks, mutate backlog or change rollout state."),
        safeguards=("dry-run-only", "phase-three-remediation-closure-metadata-only", "no-ticket-risk-backlog-or-rollout-mutation", "operator-owned-remediation-closure"),
    ),
    JobType.PLATFORM_EXECUTIVE_OPERATIONAL_HANDOFF_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.executive_operational_handoff_review.v1",
        job_type=JobType.PLATFORM_EXECUTIVE_OPERATIONAL_HANDOFF_REVIEW,
        owner="Platform, Product, SRE & Executive Sponsors",
        node_route="/api/hybrid-python/platform/executive-operational/handoff/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="executive-operational-handoff-advisory",
        canary_max_percent=0,
        shadow_supported=False,
        dry_run_only=True,
        data_classification="executive-operational-handoff-metadata-only",
        expected_result_type="platform.executive_operational_handoff_review.completed",
        rollback="Block stage exit when executive summary, operational handoff, support model, KPI baselines, governance decisions, approvals or evidence are missing or failing.",
        acceptance_checks=("Executive handoff, support model and KPI baselines are sanitized and complete.", "Governance decisions and approvals are captured before final stage exit.", "Python is advisory only and does not assign ownership, publish metrics, mutate support queues or close the stage."),
        safeguards=("dry-run-only", "executive-operational-handoff-metadata-only", "no-ownership-support-metrics-or-stage-mutation", "operator-owned-executive-handoff"),
    ),

    JobType.PLATFORM_GLOBAL_TASK_STATUS_TRACKING_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.global_task_status_tracking_review.v52",
        job_type=JobType.PLATFORM_GLOBAL_TASK_STATUS_TRACKING_REVIEW,
        owner="Platform, Program Operations & PMO",
        node_route="/api/hybrid-python/platform/global-task-status/tracking/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="phase-3-stage-closure-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="global-task-status-tracking-metadata-only",
        expected_result_type="platform.global_task_status_tracking_review.completed",
        rollback="Ignore advisory task-status report; task systems, owners and stage closure remain operator-owned.",
        acceptance_checks=(
            "Input contains sanitized task/milestone metadata, blockers, approvals and evidence links only.",
            "Python computes advisory readiness only and cannot mutate tickets, assign owners, close tasks or publish executive status.",
            "Open critical blockers, missing owners, missing evidence and insufficient approvals trigger hold or rollback.",
        ),
        safeguards=("dry-run-only", "advisory-only", "no-ticket-mutation", "no-secrets-or-phi"),
    ),
    JobType.PLATFORM_PROJECT_STATE_HEALTH_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.project_state_health_review.v52",
        job_type=JobType.PLATFORM_PROJECT_STATE_HEALTH_REVIEW,
        owner="Platform, Product & Executive Sponsors",
        node_route="/api/hybrid-python/platform/project-state/health/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="phase-3-stage-closure-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="project-state-health-metadata-only",
        expected_result_type="platform.project_state_health_review.completed",
        rollback="Ignore advisory project-state health report; executive/project status remains managed outside Python.",
        acceptance_checks=(
            "Input contains sanitized application status, Python migration status, risk register and closure criteria only.",
            "Python produces advisory health and readiness signals only and cannot alter roadmap, budget, staffing or rollout state.",
            "Low completion, unresolved high risks, missing approvals or missing closure evidence trigger hold or rollback.",
        ),
        safeguards=("dry-run-only", "advisory-only", "no-roadmap-mutation", "no-secrets-or-phi"),
    ),

    JobType.PLATFORM_FINAL_ACCEPTANCE_EVIDENCE_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.final_acceptance_evidence_review.v53",
        job_type=JobType.PLATFORM_FINAL_ACCEPTANCE_EVIDENCE_REVIEW,
        owner="Platform, PMO, QA & Executive Sponsors",
        node_route="/api/hybrid-python/platform/final-acceptance/evidence/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="migration-stage-final-acceptance-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="final-acceptance-evidence-metadata-only",
        expected_result_type="platform.final_acceptance_evidence_review.completed",
        rollback="Block stage exit when acceptance criteria, validation evidence, test results, signoffs or residual-risk approvals are incomplete.",
        acceptance_checks=(
            "Input contains sanitized acceptance criteria, validation evidence, test summaries, residual risks and signoffs only.",
            "Python produces advisory closure readiness only and cannot approve release, close risks, mutate QA systems or publish executive status.",
            "Missing acceptance criteria, failed tests, open high risks, missing signoffs or missing evidence trigger hold or rollback.",
        ),
        safeguards=("dry-run-only", "advisory-only", "final-acceptance-evidence-metadata-only", "no-release-or-risk-mutation"),
    ),
    JobType.PLATFORM_STAGE_EXIT_READINESS_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.stage_exit_readiness_review.v53",
        job_type=JobType.PLATFORM_STAGE_EXIT_READINESS_REVIEW,
        owner="Platform, SRE, Product & Executive Sponsors",
        node_route="/api/hybrid-python/platform/stage-exit/readiness/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="migration-stage-exit-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="stage-exit-readiness-metadata-only",
        expected_result_type="platform.stage_exit_readiness_review.completed",
        rollback="Do not exit the migration stage until exit criteria, handoff, evidence archive, rollback plan, support readiness and approvals are complete.",
        acceptance_checks=(
            "Input contains sanitized stage-exit criteria, operational handoff, evidence bundle, rollback plan, support readiness and approvals only.",
            "Python produces an advisory stage-exit decision only and cannot change roadmap, release state, support queues or ownership.",
            "Missing stage-exit criteria, rollback plan, support readiness, approvals or evidence archive trigger hold or rollback.",
        ),
        safeguards=("dry-run-only", "advisory-only", "stage-exit-readiness-metadata-only", "no-roadmap-release-support-or-ownership-mutation"),
    ),

    JobType.PLATFORM_STAGE_CLOSURE_CERTIFICATION_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.stage_closure_certification_review.v54",
        job_type=JobType.PLATFORM_STAGE_CLOSURE_CERTIFICATION_REVIEW,
        owner="Platform, PMO, QA & Executive Sponsors",
        node_route="/api/hybrid-python/platform/stage-closure/certification/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="migration-stage-closure-certification-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="stage-closure-certification-metadata-only",
        expected_result_type="platform.stage_closure_certification_review.completed",
        rollback="Block formal closure certification until final evidence, signoffs, release artifacts and residual-risk acceptance are complete.",
        acceptance_checks=(
            "Input contains sanitized certification items, final evidence, signoffs, release artifacts and residual risks only.",
            "Python produces an advisory certification decision only and cannot certify the release, close risks, mutate tickets or publish executive status.",
            "Missing certification items, evidence, release artifacts, signoffs or unresolved high risks trigger hold or rollback.",
        ),
        safeguards=("dry-run-only", "advisory-only", "stage-closure-certification-metadata-only", "no-release-certification-or-risk-mutation"),
    ),
    JobType.PLATFORM_POST_CLOSURE_OPERATIONAL_TRANSITION_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.post_closure_operational_transition_review.v54",
        job_type=JobType.PLATFORM_POST_CLOSURE_OPERATIONAL_TRANSITION_REVIEW,
        owner="Platform, SRE, Product Operations & Support",
        node_route="/api/hybrid-python/platform/post-closure/operational-transition/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="post-closure-operational-transition-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="post-closure-operational-transition-metadata-only",
        expected_result_type="platform.post_closure_operational_transition_review.completed",
        rollback="Keep the stage in controlled transition until ownership, monitoring, support readiness and KPI baselines are verified.",
        acceptance_checks=(
            "Input contains sanitized transition items, monitoring plan, ownership handoff, support readiness, KPI baselines, approvals and evidence only.",
            "Python produces an advisory transition-control decision only and cannot change ownership, support queues, alerts, roadmaps or release state.",
            "Missing monitoring, ownership handoff, support readiness, approvals or evidence trigger hold or rollback.",
        ),
        safeguards=("dry-run-only", "advisory-only", "post-closure-operational-transition-metadata-only", "no-ownership-support-alert-or-release-mutation"),
    ),
    JobType.PLATFORM_POST_CLOSURE_MONITORING_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.post_closure_monitoring_review.v55",
        job_type=JobType.PLATFORM_POST_CLOSURE_MONITORING_REVIEW,
        owner="Platform, SRE, Product Operations & Support",
        node_route="/api/hybrid-python/platform/post-closure/monitoring/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="post-closure-monitoring-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="post-closure-monitoring-metadata-only",
        expected_result_type="platform.post_closure_monitoring_review.completed",
        rollback="Keep post-closure in controlled monitoring until SLO, incident, adoption and regression signals remain stable.",
        acceptance_checks=(
            "Input contains sanitized monitoring windows, SLO signals, incident signals, adoption signals, regression checks, approvals and evidence only.",
            "Python produces an advisory post-closure monitoring decision only and cannot change alert policies, traffic, support queues or release state.",
            "Open incidents, SLO breaches, failed regression checks, missing approvals or missing evidence trigger hold or rollback.",
        ),
        safeguards=("dry-run-only", "advisory-only", "post-closure-monitoring-metadata-only", "no-alert-traffic-support-or-release-mutation"),
    ),
    JobType.PLATFORM_STEADY_STATE_TRANSFER_VALIDATION_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.steady_state_transfer_validation_review.v55",
        job_type=JobType.PLATFORM_STEADY_STATE_TRANSFER_VALIDATION_REVIEW,
        owner="Platform, SRE, Product Operations & Support",
        node_route="/api/hybrid-python/platform/steady-state/transfer/validation/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="steady-state-transfer-validation-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="steady-state-transfer-validation-metadata-only",
        expected_result_type="platform.steady_state_transfer_validation_review.completed",
        rollback="Do not transfer to stable operations until ownership, runbooks, monitoring, support model, knowledge transfer, approvals and evidence are complete.",
        acceptance_checks=(
            "Input contains sanitized transfer checklist, ownership matrix, runbook coverage, monitoring readiness, support model, knowledge transfer, approvals and evidence only.",
            "Python produces an advisory steady-state transfer decision only and cannot reassign owners, mutate support queues, change runbooks or publish executive status.",
            "Missing transfer items, owner acknowledgements, runbooks, monitoring readiness, support model, approvals or evidence trigger hold or rollback.",
        ),
        safeguards=("dry-run-only", "advisory-only", "steady-state-transfer-validation-metadata-only", "no-ownership-support-runbook-or-status-mutation"),
    ),
    JobType.PLATFORM_STEADY_STATE_OPERATIONAL_ASSURANCE_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.steady_state_operational_assurance_review.v56",
        job_type=JobType.PLATFORM_STEADY_STATE_OPERATIONAL_ASSURANCE_REVIEW,
        owner="Platform, SRE, Product Operations & Support",
        node_route="/api/hybrid-python/platform/steady-state/operational-assurance/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="steady-state-operational-assurance-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="steady-state-operational-assurance-metadata-only",
        expected_result_type="platform.steady_state_operational_assurance_review.completed",
        rollback="Keep steady-state acceptance under controlled observation until operational metrics, SLO health, incidents, support queues, runbooks and ownership reviews are stable.",
        acceptance_checks=(
            "Input contains sanitized operational metrics, SLO health, incident trends, support queue summaries, runbook audits, ownership reviews, approvals and evidence only.",
            "Python produces an advisory operational-assurance decision only and cannot mutate SLOs, alert policies, support queues, staffing plans or operating status.",
            "SLO breaches, Sev1 incidents, overdue support items, stale runbooks, missing ownership reviews, approvals or evidence trigger hold or rollback.",
        ),
        safeguards=("dry-run-only", "advisory-only", "steady-state-operational-assurance-metadata-only", "no-slo-alert-support-staffing-or-status-mutation"),
    ),
    JobType.PLATFORM_CONTINUOUS_IMPROVEMENT_BACKLOG_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.continuous_improvement_backlog_review.v56",
        job_type=JobType.PLATFORM_CONTINUOUS_IMPROVEMENT_BACKLOG_REVIEW,
        owner="Platform, Product Operations, SRE & Delivery Governance",
        node_route="/api/hybrid-python/platform/continuous-improvement/backlog/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="continuous-improvement-backlog-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="continuous-improvement-backlog-metadata-only",
        expected_result_type="platform.continuous_improvement_backlog_review.completed",
        rollback="Do not accept the continuous-improvement backlog until items, owner commitments, governance reviews, high-risk items, approvals and evidence are ready.",
        acceptance_checks=(
            "Input contains sanitized improvement items, value hypotheses, technical-debt items, risk items, owner commitments, governance reviews, approvals and evidence only.",
            "Python produces an advisory improvement-backlog decision only and cannot mutate tickets, roadmap, budget, owner assignments or risk acceptance.",
            "Missing improvement items, missing owner commitments, open high risks, governance gaps, missing approvals or missing evidence trigger hold or rollback.",
        ),
        safeguards=("dry-run-only", "advisory-only", "continuous-improvement-backlog-metadata-only", "no-ticket-roadmap-budget-owner-or-risk-mutation"),
    ),

    JobType.PLATFORM_STABLE_OPERATIONS_OPTIMIZATION_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.stable_operations_optimization_review.v57",
        job_type=JobType.PLATFORM_STABLE_OPERATIONS_OPTIMIZATION_REVIEW,
        owner="Platform, SRE, FinOps, Product Operations & Delivery Governance",
        node_route="/api/hybrid-python/platform/stable-operations/optimization/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="stable-operations-optimization-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="stable-operations-optimization-metadata-only",
        expected_result_type="platform.stable_operations_optimization_review.completed",
        rollback="Do not apply optimization changes until guardrails, evidence, critical debt review, approvals and owner readiness are complete.",
        acceptance_checks=(
            "Input contains sanitized optimization metrics, cost signals, reliability signals, automation opportunities, debt items, guardrail reviews, approvals and evidence only.",
            "Python produces an advisory stable-operations optimization decision only and cannot mutate tickets, budgets, automation, SLOs, alerting, infrastructure or risk registers.",
            "Missing optimization metrics, failed guardrails, open critical debt, missing approvals or missing evidence trigger hold or rollback.",
        ),
        safeguards=("dry-run-only", "advisory-only", "stable-operations-optimization-metadata-only", "no-ticket-budget-automation-infra-slo-alert-or-risk-mutation"),
    ),
    JobType.PLATFORM_RECURRING_MAINTENANCE_CYCLE_READINESS_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.recurring_maintenance_cycle_readiness_review.v57",
        job_type=JobType.PLATFORM_RECURRING_MAINTENANCE_CYCLE_READINESS_REVIEW,
        owner="Platform, SRE, Security Operations & Delivery Governance",
        node_route="/api/hybrid-python/platform/recurring-maintenance/cycle/readiness/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="recurring-maintenance-cycle-readiness-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="recurring-maintenance-cycle-readiness-metadata-only",
        expected_result_type="platform.recurring_maintenance_cycle_readiness_review.completed",
        rollback="Do not enter recurring maintenance cadence until windows, patch cadence, dependency plan, backup validation, runbooks, owner roster, approvals and evidence are ready.",
        acceptance_checks=(
            "Input contains sanitized maintenance windows, patch cadence, dependency update plan, backup validation, runbook schedule, owner roster, approvals and evidence only.",
            "Python produces an advisory recurring-maintenance readiness decision only and cannot schedule calendars, execute patches, upgrade dependencies, rotate secrets, run restores or change owner assignments.",
            "Missing maintenance windows, owners, patch cadence, backup validation, approvals or evidence trigger hold or rollback.",
        ),
        safeguards=("dry-run-only", "advisory-only", "recurring-maintenance-cycle-readiness-metadata-only", "no-calendar-patch-dependency-backup-secret-or-owner-mutation"),
    ),
    JobType.PLATFORM_MAINTENANCE_CYCLE_EXECUTION_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.maintenance_cycle_execution_review.v58",
        job_type=JobType.PLATFORM_MAINTENANCE_CYCLE_EXECUTION_REVIEW,
        owner="Platform, SRE, Security Operations & Delivery Governance",
        node_route="/api/hybrid-python/platform/maintenance-cycle/execution/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="maintenance-cycle-execution-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="maintenance-cycle-execution-metadata-only",
        expected_result_type="platform.maintenance_cycle_execution_review.completed",
        rollback="Do not accept the recurring maintenance cycle until execution items, validations, rollback readiness, backup results, approvals and evidence are complete.",
        acceptance_checks=(
            "Input contains sanitized execution items, patch results, dependency results, backup results, validation results, rollback readiness, communications, approvals and evidence only.",
            "Python produces an advisory maintenance-cycle execution decision only and cannot execute patches, upgrade dependencies, run backups, schedule calendars, mutate tickets, rotate secrets or change owner assignments.",
            "Failed critical execution items, missing validations, missing backup results, rollback readiness gaps, missing approvals or missing evidence trigger hold or rollback.",
        ),
        safeguards=("dry-run-only", "advisory-only", "maintenance-cycle-execution-metadata-only", "no-patch-dependency-backup-calendar-secret-ticket-or-owner-mutation"),
    ),
    JobType.PLATFORM_LONG_TERM_OPERABILITY_SUSTAINABILITY_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.long_term_operability_sustainability_review.v58",
        job_type=JobType.PLATFORM_LONG_TERM_OPERABILITY_SUSTAINABILITY_REVIEW,
        owner="Platform, SRE, Product Operations, FinOps & Delivery Governance",
        node_route="/api/hybrid-python/platform/long-term-operability/sustainability/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="long-term-operability-sustainability-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="long-term-operability-sustainability-metadata-only",
        expected_result_type="platform.long_term_operability_sustainability_review.completed",
        rollback="Do not declare long-term sustainability until sustainability metrics, ownership signals, knowledge reviews, lifecycle controls, risk acceptance, approvals and evidence are complete.",
        acceptance_checks=(
            "Input contains sanitized sustainability metrics, ownership signals, knowledge-base reviews, dependency lifecycle, budget signals, risk acceptances, improvement cadence, approvals and evidence only.",
            "Python produces an advisory long-term operability decision only and cannot mutate budgets, owners, roadmap, dependency lifecycle, knowledge base or risk records.",
            "Missing sustainability metrics, ownership gaps, stale knowledge reviews, dependency lifecycle gaps, open high risks, missing approvals or missing evidence trigger hold or rollback.",
        ),
        safeguards=("dry-run-only", "advisory-only", "long-term-operability-sustainability-metadata-only", "no-budget-owner-roadmap-dependency-knowledgebase-or-risk-mutation"),
    ),

    JobType.PLATFORM_RECURRING_OPERATIONAL_MATURITY_AUDIT_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.recurring_operational_maturity_audit_review.v59",
        job_type=JobType.PLATFORM_RECURRING_OPERATIONAL_MATURITY_AUDIT_REVIEW,
        owner="Platform, SRE, Product Operations, Security Operations & Delivery Governance",
        node_route="/api/hybrid-python/platform/recurring-operational-maturity/audit/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="recurring-operational-maturity-audit-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="recurring-operational-maturity-audit-metadata-only",
        expected_result_type="platform.recurring_operational_maturity_audit_review.completed",
        rollback="Do not declare recurring operational maturity until maturity dimensions, controls, incident learnings, support signals, operator evidence, risks, approvals and evidence are complete.",
        acceptance_checks=(
            "Input contains sanitized maturity dimensions, control checks, incident learnings, support signals, operator evidence, risk items, approvals and evidence only.",
            "Python produces an advisory operational maturity decision only and cannot mutate maturity scores, risks, tickets, owners, roadmaps, controls or support queues.",
            "Low maturity scores, failing controls, missing operator evidence, open high risks, missing approvals or missing evidence trigger hold or rollback.",
        ),
        safeguards=("dry-run-only", "advisory-only", "recurring-operational-maturity-audit-metadata-only", "no-maturity-risk-ticket-owner-roadmap-control-or-support-mutation"),
    ),
    JobType.PLATFORM_STABLE_STATE_CONTINUITY_CONTROL_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.stable_state_continuity_control_review.v59",
        job_type=JobType.PLATFORM_STABLE_STATE_CONTINUITY_CONTROL_REVIEW,
        owner="Platform, SRE, Security Operations, Business Continuity & Delivery Governance",
        node_route="/api/hybrid-python/platform/stable-state/continuity-control/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="stable-state-continuity-control-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="stable-state-continuity-control-metadata-only",
        expected_result_type="platform.stable_state_continuity_control_review.completed",
        rollback="Do not accept stable-state continuity controls until continuity controls, DR signals, dependency continuity, operational fallbacks, communications, risk acceptance, approvals and evidence are complete.",
        acceptance_checks=(
            "Input contains sanitized continuity controls, disaster-recovery signals, dependency continuity, operational fallbacks, communication checks, risk items, approvals and evidence only.",
            "Python produces an advisory continuity-control decision only and cannot execute failovers, alter dependencies, mutate communications, accept risks, change runbooks or modify owners.",
            "Failing controls, DR gaps, dependency continuity failures, missing fallbacks, open high risks, missing approvals or missing evidence trigger hold or rollback.",
        ),
        safeguards=("dry-run-only", "advisory-only", "stable-state-continuity-control-metadata-only", "no-failover-dependency-communication-risk-runbook-or-owner-mutation"),
    ),
    JobType.PLATFORM_OPERATIONAL_RESILIENCE_GOVERNANCE_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.operational_resilience_governance_review.v60",
        job_type=JobType.PLATFORM_OPERATIONAL_RESILIENCE_GOVERNANCE_REVIEW,
        owner="Platform, SRE, Security Operations, Business Continuity & Delivery Governance",
        node_route="/api/hybrid-python/platform/operational-resilience/governance/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="operational-resilience-governance-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="operational-resilience-governance-metadata-only",
        expected_result_type="platform.operational_resilience_governance_review.completed",
        rollback="Do not accept resilience governance until controls, chaos drills, failover readiness, service ownership, risks, governance reviews, approvals and evidence are complete.",
        acceptance_checks=(
            "Input contains sanitized resilience controls, chaos drills, failover readiness, service ownership, risk items, governance reviews, approvals and evidence only.",
            "Python produces an advisory resilience governance decision only and cannot mutate controls, execute failovers, accept risks, publish governance, change owners or modify tickets.",
            "Missing controls, failed drills, failover readiness gaps, ownership gaps, open high risks, missing approvals or missing evidence trigger hold or rollback.",
        ),
        safeguards=("dry-run-only", "advisory-only", "operational-resilience-governance-metadata-only", "no-control-failover-risk-governance-owner-or-ticket-mutation"),
    ),
    JobType.PLATFORM_RECOVERY_CAPABILITY_VALIDATION_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.recovery_capability_validation_review.v60",
        job_type=JobType.PLATFORM_RECOVERY_CAPABILITY_VALIDATION_REVIEW,
        owner="Platform, SRE, Security Operations, Disaster Recovery & Delivery Governance",
        node_route="/api/hybrid-python/platform/recovery-capability/validation/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="recovery-capability-validation-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="recovery-capability-validation-metadata-only",
        expected_result_type="platform.recovery_capability_validation_review.completed",
        rollback="Do not accept recovery capability until restore tests, RTO/RPO checks, backup integrity, incident replay, dependency recovery, communications, risks, approvals and evidence are complete.",
        acceptance_checks=(
            "Input contains sanitized restore tests, RTO/RPO checks, backup integrity, incident replay results, dependency recovery, communication validation, risks, approvals and evidence only.",
            "Python produces an advisory recovery capability validation decision only and cannot execute restores, alter backups, fail over dependencies, send communications, accept risks or change owners.",
            "Missing restore tests, RTO/RPO gaps, backup integrity gaps, dependency recovery failures, open high risks, missing approvals or missing evidence trigger hold or rollback.",
        ),
        safeguards=("dry-run-only", "advisory-only", "recovery-capability-validation-metadata-only", "no-restore-backup-failover-communication-risk-or-owner-mutation"),
    ),
    JobType.PLATFORM_OPERATIONAL_RESILIENCE_OPTIMIZATION_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.operational_resilience_optimization_review.v61",
        job_type=JobType.PLATFORM_OPERATIONAL_RESILIENCE_OPTIMIZATION_REVIEW,
        owner="Platform, SRE, Security Operations, Business Continuity & Delivery Governance",
        node_route="/api/hybrid-python/platform/operational-resilience/optimization/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="operational-resilience-optimization-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="operational-resilience-optimization-metadata-only",
        expected_result_type="platform.operational_resilience_optimization_review.completed",
        rollback="Do not accept resilience optimization until resilience metrics, optimization actions, automation candidates, incident patterns, capacity signals, risks, approvals and evidence are complete.",
        acceptance_checks=(
            "Input contains sanitized resilience metrics, optimization actions, automation candidates, incident patterns, capacity signals, risk items, approvals and evidence only.",
            "Python produces an advisory resilience optimization decision only and cannot mutate resilience controls, enable automation, change capacity, accept risks, update runbooks or modify owners.",
            "Missing metrics, optimization gaps, automation readiness gaps, open high risks, missing approvals or missing evidence trigger hold or rollback.",
        ),
        safeguards=("dry-run-only", "advisory-only", "operational-resilience-optimization-metadata-only", "no-resilience-automation-capacity-risk-runbook-or-owner-mutation"),
    ),
    JobType.PLATFORM_AUTOMATED_CONTINUITY_PREPAREDNESS_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.automated_continuity_preparedness_review.v61",
        job_type=JobType.PLATFORM_AUTOMATED_CONTINUITY_PREPAREDNESS_REVIEW,
        owner="Platform, SRE, Security Operations, Business Continuity & Delivery Governance",
        node_route="/api/hybrid-python/platform/automated-continuity/preparedness/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="automated-continuity-preparedness-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="automated-continuity-preparedness-metadata-only",
        expected_result_type="platform.automated_continuity_preparedness_review.completed",
        rollback="Do not accept automated continuity preparedness until automation controls, runbooks, scheduler readiness, dependency hooks, notification templates, risks, approvals and evidence are complete.",
        acceptance_checks=(
            "Input contains sanitized automation controls, continuity runbooks, scheduler readiness, dependency hooks, notification templates, risk items, approvals and evidence only.",
            "Python produces an advisory automated continuity preparedness decision only and cannot enable schedulers, mutate hooks, publish templates, change runbooks, accept risks or modify owners.",
            "Missing automation controls, stale runbooks, scheduler or dependency hook gaps, open high risks, missing approvals or missing evidence trigger hold or rollback.",
        ),
        safeguards=("dry-run-only", "advisory-only", "automated-continuity-preparedness-metadata-only", "no-scheduler-hook-template-runbook-risk-or-owner-mutation"),
    ),
    JobType.PLATFORM_AUTOMATED_CONTINUITY_EXECUTION_VALIDATION_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.automated_continuity_execution_validation_review.v62",
        job_type=JobType.PLATFORM_AUTOMATED_CONTINUITY_EXECUTION_VALIDATION_REVIEW,
        owner="Platform, SRE, Security Operations, Business Continuity & Delivery Governance",
        node_route="/api/hybrid-python/platform/automated-continuity/execution/validation/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="automated-continuity-execution-validation-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="automated-continuity-execution-validation-metadata-only",
        expected_result_type="platform.automated_continuity_execution_validation_review.completed",
        rollback="Do not accept automated continuity execution until execution runs, scheduler events, dependency hooks, notification delivery evidence, runbook checkpoints, risks, approvals and evidence are complete.",
        acceptance_checks=(
            "Input contains sanitized execution runs, scheduler events, dependency hooks, notification delivery checks, runbook checkpoints, risk items, approvals and evidence only.",
            "Python produces an advisory automated continuity execution validation decision only and cannot trigger schedulers, mutate hooks, send notifications, execute failover, accept risks or change owners.",
            "Missing execution runs, scheduler failures, dependency hook gaps, runbook checkpoint gaps, open high risks, missing approvals or missing evidence trigger hold or rollback.",
        ),
        safeguards=("dry-run-only", "advisory-only", "automated-continuity-execution-validation-metadata-only", "no-scheduler-hook-notification-failover-risk-or-owner-mutation"),
    ),
    JobType.PLATFORM_OPERATIONAL_RESILIENCE_FEEDBACK_LOOP_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.operational_resilience_feedback_loop_review.v62",
        job_type=JobType.PLATFORM_OPERATIONAL_RESILIENCE_FEEDBACK_LOOP_REVIEW,
        owner="Platform, SRE, Product Operations, Security Operations & Delivery Governance",
        node_route="/api/hybrid-python/platform/operational-resilience/feedback-loop/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="operational-resilience-feedback-loop-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="operational-resilience-feedback-loop-metadata-only",
        expected_result_type="platform.operational_resilience_feedback_loop_review.completed",
        rollback="Do not accept the resilience feedback loop until feedback signals, remediation items, learning items, metric adjustments, owner responses, risks, approvals and evidence are complete.",
        acceptance_checks=(
            "Input contains sanitized feedback signals, remediation items, learning items, metric adjustments, owner responses, risks, approvals and evidence only.",
            "Python produces an advisory resilience feedback-loop decision only and cannot change metric baselines, mutate roadmap items, assign remediation, accept risks or publish governance.",
            "Missing feedback signals, remediation gaps, learning gaps, owner response gaps, open high risks, missing approvals or missing evidence trigger hold or rollback.",
        ),
        safeguards=("dry-run-only", "advisory-only", "operational-resilience-feedback-loop-metadata-only", "no-metric-roadmap-remediation-risk-governance-or-owner-mutation"),
    ),
    JobType.PLATFORM_FINAL_CLOSURE_EVIDENCE_PACKAGE_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.final_closure_evidence_package_review.v63",
        job_type=JobType.PLATFORM_FINAL_CLOSURE_EVIDENCE_PACKAGE_REVIEW,
        owner="Platform, SRE, Product Operations, Delivery Governance & Executive Sponsors",
        node_route="/api/hybrid-python/platform/final-closure/evidence-package/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="final-closure-evidence-package-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="final-closure-evidence-package-metadata-only",
        expected_result_type="platform.final_closure_evidence_package_review.completed",
        rollback="Do not request final handover until version summary, validation evidence, contract evidence, API route evidence, worker evidence, residual risks, signoffs and evidence bundle are complete.",
        acceptance_checks=(
            "Input contains sanitized version summaries, validation results, contract/API/worker evidence, residual risks, signoffs and evidence only.",
            "Python produces an advisory final closure evidence package decision only and cannot certify the release, mutate issue trackers, accept risks, publish handover or change owners.",
            "Missing evidence, failing validations, open high residual risks, missing signoffs or incomplete closure metadata trigger hold or rollback.",
        ),
        safeguards=("dry-run-only", "advisory-only", "final-closure-evidence-package-metadata-only", "no-release-certification-risk-ticket-handover-or-owner-mutation"),
    ),
    JobType.PLATFORM_GLOBAL_IMPLEMENTATION_COMPLETION_CHECKLIST_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.global_implementation_completion_checklist_review.v63",
        job_type=JobType.PLATFORM_GLOBAL_IMPLEMENTATION_COMPLETION_CHECKLIST_REVIEW,
        owner="Platform, Product Operations, SRE, Support & Delivery Governance",
        node_route="/api/hybrid-python/platform/global-implementation/completion-checklist/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="global-implementation-completion-checklist-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="global-implementation-completion-checklist-metadata-only",
        expected_result_type="platform.global_implementation_completion_checklist_review.completed",
        rollback="Do not close the implementation phase until functional areas, implementation tasks, validation tasks, handover tasks, deferred items, approvals and evidence are reviewed.",
        acceptance_checks=(
            "Input contains sanitized functional-area completion, implementation task status, validation task status, handover task status, deferred items, approvals and evidence only.",
            "Python produces an advisory completion-checklist decision only and cannot close tasks, alter percentages, accept deferred items, publish a release or change owners.",
            "Incomplete functional coverage, failed tasks, validation gaps, handover gaps, unaccepted high deferred items, missing approvals or missing evidence trigger hold or rollback.",
        ),
        safeguards=("dry-run-only", "advisory-only", "global-implementation-completion-checklist-metadata-only", "no-task-risk-release-percentage-handover-or-owner-mutation"),
    ),

    JobType.PLATFORM_FINAL_OPERATIONAL_HANDOVER_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.final_operational_handover_review.v64",
        job_type=JobType.PLATFORM_FINAL_OPERATIONAL_HANDOVER_REVIEW,
        owner="Platform, SRE, Product Operations, Support, Security Operations & Delivery Governance",
        node_route="/api/hybrid-python/platform/final-operational/handover/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="final-operational-handover-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="final-operational-handover-metadata-only",
        expected_result_type="platform.final_operational_handover_review.completed",
        rollback="Do not declare operational handover complete until runbooks, owners, support model, monitoring controls, escalation paths, operational risks, signoffs and evidence are accepted.",
        acceptance_checks=(
            "Input contains sanitized runbook, owner assignment, support model, monitoring control, escalation path, operational risk, signoff and evidence metadata only.",
            "Python produces an advisory final handover decision only and cannot assign owners, publish runbooks, activate support rotations, accept risks or mutate operational controls.",
            "Missing runbooks, unassigned owners, support/monitoring/escalation gaps, open high operational risks, missing signoffs or missing evidence trigger hold or rollback.",
        ),
        safeguards=("dry-run-only", "advisory-only", "final-operational-handover-metadata-only", "no-owner-runbook-support-risk-control-or-handover-mutation"),
    ),
    JobType.PLATFORM_PHASE_CLOSURE_CERTIFICATION_REVIEW: ContractDefinition(
        contract_id="cp.hybrid.platform.phase_closure_certification_review.v64",
        job_type=JobType.PLATFORM_PHASE_CLOSURE_CERTIFICATION_REVIEW,
        owner="Platform, Product Operations, SRE, Delivery Governance & Executive Sponsors",
        node_route="/api/hybrid-python/platform/phase-closure/certification/review/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="phase-closure-certification-advisory",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="phase-closure-certification-metadata-only",
        expected_result_type="platform.phase_closure_certification_review.completed",
        rollback="Do not certify this implementation phase until closure criteria, evidence package, handover evidence, release artifacts, residual risks, approvals, next-phase backlog and evidence are complete.",
        acceptance_checks=(
            "Input contains sanitized closure criteria, evidence package, handover evidence, residual risk, release artifact, approval, next-phase backlog and evidence metadata only.",
            "Python produces an advisory phase closure certification decision only and cannot issue executive certification, accept risks, tag releases, close tickets or mutate backlog ownership.",
            "Unmet closure criteria, incomplete evidence package, handover gaps, open high risks, missing artifacts, missing approvals, unseparated backlog items or missing evidence trigger hold or rollback.",
        ),
        safeguards=("dry-run-only", "advisory-only", "phase-closure-certification-metadata-only", "no-certification-release-ticket-risk-backlog-or-owner-mutation"),
    ),
    JobType.NOTIFICATIONS_DISPATCH: ContractDefinition(
        contract_id="cp.hybrid.notifications.dispatch.v1",
        job_type=JobType.NOTIFICATIONS_DISPATCH,
        owner="Messaging & Notifications",
        node_route="/api/hybrid-python/notifications/dispatch/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="shadow-only",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="pii-limited-recipient-planning",
        expected_result_type="notifications.dispatch.planned",
        rollback="Keep provider delivery fully disabled in Python; continue Node/provider path.",
        acceptance_checks=(
            "Python can plan deduplication only; provider delivery is disabled in v5.",
            "Non-dry-run payloads are rejected by policy.",
        ),
        safeguards=("dry-run-only", "no-provider-send", "payload-policy-guard"),
    ),
    JobType.AI_TRIAGE_PREVIEW: ContractDefinition(
        contract_id="cp.hybrid.ai.triage_preview.v1",
        job_type=JobType.AI_TRIAGE_PREVIEW,
        owner="AI Preview",
        node_route="/api/hybrid-python/ai/triage-preview/prepare",
        python_route="/api/v1/jobs/enqueue",
        stage="shadow-only-non-diagnostic",
        canary_max_percent=0,
        shadow_supported=True,
        dry_run_only=True,
        data_classification="clinical-preview-minimized",
        expected_result_type="ai.triage_preview.generated",
        rollback="Disable preview route; no clinical workflow depends on Python output.",
        acceptance_checks=(
            "Output is explicitly non-diagnostic and requires clinical review.",
            "No source text is persisted as an artifact.",
            "Non-dry-run payloads are rejected by policy.",
        ),
        safeguards=("dry-run-only", "non-diagnostic", "clinical-review-required"),
    ),
}


def _capability(contract: ContractDefinition) -> ContractCapability:
    return ContractCapability(
        contractId=contract.contract_id,
        jobType=contract.job_type,
        owner=contract.owner,
        nodeRoute=contract.node_route,
        pythonRoute=contract.python_route,
        stage=contract.stage,
        canaryMaxPercent=contract.canary_max_percent,
        shadowSupported=contract.shadow_supported,
        dryRunOnly=contract.dry_run_only,
        dataClassification=contract.data_classification,
        acceptanceChecks=list(contract.acceptance_checks),
        safeguards=list(contract.safeguards),
        rollback=contract.rollback,
    )


def _stable_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)


def contract_hash() -> str:
    payload = {
        "schemaVersion": SCHEMA_VERSION,
        "version": __version__,
        "contracts": [model_dump(_capability(CONTRACTS[job_type]), by_alias=True, mode="json") for job_type in sorted(CONTRACTS, key=lambda item: item.value)],
        "vectors": [model_dump(vector, by_alias=True, mode="json") for vector in build_contract_test_vectors()],
    }
    return hashlib.sha256(_stable_json(payload).encode("utf-8")).hexdigest()


def build_contract_manifest(service_name: str) -> ContractManifest:
    return ContractManifest(
        schemaVersion=SCHEMA_VERSION,
        service=service_name,
        version=__version__,
        contractHash=contract_hash(),
        contracts=[_capability(CONTRACTS[job_type]) for job_type in sorted(CONTRACTS, key=lambda item: item.value)],
        routingModel={
            "sourceOfTruth": "Node remains gateway for auth, RBAC/ABAC, object scope and Prisma writes.",
            "pythonResponsibilities": ["workers", "exports", "admin read models", "scheduling aggregates", "messaging plans", "billing reconciliation", "clinical access audit indicators", "db index advisory", "SLO regression reports", "post-deploy verification", "change ticket evidence bundling", "analytics", "non-diagnostic AI previews", "shadow comparison", "canary evidence", "observability coverage review", "feature flag review", "CI/staging validation review", "release closure review", "traffic promotion readiness review", "evidence retention audit review", "SLO error-budget review", "auto-rollback safeguard review", "third-party dependency review", "capacity scaling readiness review", "compliance/privacy evidence review", "runbook drill verification review", "post-incident learning review", "technical-debt governance review", "Phase 2 outcome measurement review", "Phase 2 feedback/adoption review", "Phase 2 closure acceptance review", "Phase 3 transition readiness review"],
            "promotionModel": "Contract validation plus shadow comparison gate before raising canary percentage.",
            "rollback": "HYBRID_PYTHON_ENABLED=false or HYBRID_PYTHON_CANARY_PERCENT=0 routes back to Node without data migration.",
        },
    )


def build_contract_test_vectors() -> list[ContractTestVector]:
    vectors: list[tuple[JobType, dict[str, Any], str, list[str]]] = [
        (
            JobType.ADMIN_AUDIT_EXPORT,
            {"jobType": "admin.audit_export", "idempotencyKey": "vector-audit-export-v14-0001", "correlationId": "vector-correlation-audit-export", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"format": "csv", "maxRows": 1000, "filters": {"from": "2026-01-01", "to": "2026-01-31", "resource": "Appointment"}}},
            "admin.audit_export.prepared",
            ["sanitized filter-only audit export vector; no rows or PHI"],
        ),
        (
            JobType.ADMIN_ACCOUNTS_BULK_VALIDATE,
            {"jobType": "admin.accounts_bulk_validate", "idempotencyKey": "vector-accounts-bulk-v14-0001", "correlationId": "vector-correlation-accounts-bulk", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"allowedRoles": ["PROVIDER", "NURSE"], "allowedEmailDomains": ["example.com"], "requireOrganization": True, "rows": [{"email": "provider@example.com", "role": "PROVIDER", "organizationId": "org-vector"}]}},
            "admin.accounts_bulk_validate.completed",
            ["PII-limited account import validation vector; mutation remains Node-owned"],
        ),

        (
            JobType.ADMIN_ACCOUNTS_READ_MODEL,
            {"jobType": "admin.accounts_read_model", "idempotencyKey": "vector-accounts-read-model-v14-0001", "correlationId": "vector-correlation-accounts-read-model", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"limit": 50, "cursor": None, "filters": {"role": "PROVIDER"}, "rows": [{"id": "user-vector-1", "email": "provider@example.com", "role": "PROVIDER", "status": "ACTIVE", "organizationId": "org-vector", "displayName": "Vector Provider"}]}},
            "admin.accounts_read_model.prepared",
            ["Node-prefiltered admin read-model vector; raw email must be masked/hashed in output"],
        ),
        (
            JobType.ADMIN_PROVIDER_ROLE_RECONCILE,
            {"jobType": "admin.provider_role_reconcile", "idempotencyKey": "vector-provider-role-reconcile-v14-0001", "correlationId": "vector-correlation-provider-role", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"schemaModels": ["ProviderProfile"], "schemaFields": {"ProviderProfile": ["id", "userId"]}, "migrationModels": ["ProviderRoleCatalog"], "codeReferences": ["ProviderRoleCatalog", "roleCatalogId"]}},
            "admin.provider_role_reconcile.completed",
            ["Advisory schema drift vector; no Prisma mutations"],
        ),
        (
            JobType.SCHEDULING_AVAILABILITY_SNAPSHOT,
            {"jobType": "scheduling.availability_snapshot", "idempotencyKey": "vector-availability-snapshot-v14-0001", "correlationId": "vector-correlation-scheduling", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"timezone": "UTC", "groupBy": "status", "windows": [{"providerHash": "providerhash001", "startsAt": "2026-05-05T09:00:00Z", "endsAt": "2026-05-05T09:30:00Z", "status": "available"}]}},
            "scheduling.availability_snapshot.computed",
            ["Schedule metadata vector with hashed provider identifier only"],
        ),
        (
            JobType.MESSAGING_REMINDER_PLAN,
            {"jobType": "messaging.reminder_plan", "idempotencyKey": "vector-reminder-plan-v14-0001", "correlationId": "vector-correlation-reminder", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"channel": "email", "templateId": "appointment-reminder", "recipientHashes": ["abc123def456"], "batchSize": 100}},
            "messaging.reminder_plan.planned",
            ["Dry-run reminder plan vector; provider send disabled"],
        ),
        (
            JobType.BILLING_PAYMENT_RECONCILE,
            {"jobType": "billing.payment_reconcile", "idempotencyKey": "vector-billing-payment-reconcile-v14-0001", "correlationId": "vector-correlation-billing", "organizationId": "org-vector", "actorUserId": "user-vector-finance", "dryRun": True, "payload": {"gateway": "stripe", "rows": [{"paymentIdHash": "payhash001", "externalIdHash": "exthash001", "gateway": "stripe", "status": "COMPLETED", "gatewayStatus": "succeeded", "amountMinor": 15000, "currency": "USD"}]}},
            "billing.payment_reconcile.completed",
            ["Billing metadata vector; no payment method tokens or card data"],
        ),
        (
            JobType.CLINICAL_RECORDS_ACCESS_AUDIT,
            {"jobType": "clinical.records_access_audit", "idempotencyKey": "vector-clinical-records-access-v14-0001", "correlationId": "vector-correlation-clinical", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"window": {"from": "2026-05-01", "to": "2026-05-05"}, "events": [{"actorHash": "actorhash001", "patientHash": "patienthash001", "resourceHash": "recordhash001", "action": "read", "outcome": "allowed", "createdAt": "2026-05-05T02:30:00Z", "breakGlass": False}]}},
            "clinical.records_access_audit.completed",
            ["Clinical access metadata vector; hashed identifiers only, no chart content"],
        ),
        (
            JobType.PLATFORM_DB_INDEX_ADVISORY,
            {"jobType": "platform.db_index_advisory", "idempotencyKey": "vector-db-index-advisory-v14-0001", "correlationId": "vector-correlation-db-index", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"models": [{"model": "Appointment", "rowCount": 500000, "indexes": [["id"], ["providerId"]]}], "queries": [{"endpoint": "/api/admin/accounts", "model": "Appointment", "filterFields": ["organizationId"], "orderByFields": ["startsAt"], "estimatedRows": 50000, "p95DurationMs": 1200, "fullScan": True}] }},
            "platform.db_index_advisory.completed",
            ["Schema/query metadata vector; advisory only and no migration writes"],
        ),
        (
            JobType.PLATFORM_SLO_REGRESSION_REPORT,
            {"jobType": "platform.slo_regression_report", "idempotencyKey": "vector-slo-regression-v14-0001", "correlationId": "vector-correlation-slo", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"route": "/api/hybrid-python/analytics/snapshot/prepare", "baselineSamplesMs": [100, 120, 140], "currentSamplesMs": [110, 130, 150], "baselineRequestCount": 1000, "currentRequestCount": 1000, "baselineErrorCount": 1, "currentErrorCount": 2, "thresholds": {"targetP95Ms": 500, "maxErrorRate": 0.01}}},
            "platform.slo_regression_report.completed",
            ["Aggregate telemetry vector; no payloads or logs"],
        ),
        (
            JobType.PLATFORM_CONTRACT_REPLAY,
            {"jobType": "platform.contract_replay", "idempotencyKey": "vector-contract-replay-v14-0001", "correlationId": "vector-correlation-contract-replay", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"jobTypes": ["analytics.snapshot", "platform.slo_regression_report"], "maxVectors": 5}},
            "platform.contract_replay.completed",
            ["Release gate vector; replays sanitized built-in vectors only"],
        ),
        (
            JobType.PLATFORM_PRIVACY_PREFLIGHT,
            {"jobType": "platform.privacy_preflight", "idempotencyKey": "vector-privacy-preflight-v14-0001", "correlationId": "vector-correlation-privacy-preflight", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"candidates": [{"route": "/api/hybrid-python/analytics/snapshot/prepare", "jobType": "analytics.snapshot", "classification": "aggregate-non-phi", "payloadKeys": ["metric", "values", "dimensions"]}]}},
            "platform.privacy_preflight.completed",
            ["Payload-shape-only vector; no raw values"],
        ),

        (
            JobType.PLATFORM_RELEASE_DECISION,
            {"jobType": "platform.release_decision", "idempotencyKey": "vector-release-decision-v14-0001", "correlationId": "vector-correlation-release-decision", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v14-vector", "targetCanaryPercent": 5, "route": "/api/hybrid-python/analytics/snapshot/prepare", "jobTypes": ["analytics.snapshot"], "gate": {"allowed": True, "recommendation": "advance"}, "checklist": {"overallStatus": "pass"}, "contractReplay": {"decision": "pass", "failed": 0, "passed": 2}, "privacyPreflight": {"decision": "pass", "blockedCandidates": 0}, "sloRegression": {"recommendation": "advance"}, "rollout": {"status": "planned", "currentPercent": 0, "targetPercent": 5}}},
            "platform.release_decision.completed",
            ["Release gate vector; sanitized evidence only"],
        ),
        (
            JobType.PLATFORM_ROLLBACK_DRILL,
            {"jobType": "platform.rollback_drill", "idempotencyKey": "vector-rollback-drill-v14-0001", "correlationId": "vector-correlation-rollback-drill", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"route": "/api/hybrid-python/analytics/snapshot/prepare", "jobTypes": ["analytics.snapshot"], "trigger": "vector-drill", "observedMetrics": {"p95Ms": 900, "errorRate": 0.02}, "operators": ["release-manager"]}},
            "platform.rollback_drill.planned",
            ["Rollback drill vector; procedure only and no state mutation"],
        ),

        (
            JobType.PLATFORM_POST_DEPLOY_VERIFY,
            {"jobType": "platform.post_deploy_verify", "idempotencyKey": "vector-post-deploy-verify-v14-0001", "correlationId": "vector-correlation-post-deploy", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v14-vector", "route": "/api/hybrid-python/analytics/snapshot/prepare", "jobTypes": ["analytics.snapshot"], "targetCanaryPercent": 5, "healthChecks": [{"name": "python-worker-ready", "ok": True}], "smokeChecks": [{"name": "analytics-snapshot", "statusCode": 200, "expectedStatus": 200}], "sloRegression": {"recommendation": "advance"}, "releaseDecision": {"decision": "advance"}, "rollout": {"status": "advancing", "currentPercent": 5, "targetPercent": 5}, "jobSummary": {"failedJobs": 0}, "comparisonSummary": {"mismatchRate": 0}, "privacyPreflight": {"decision": "pass", "blockedCandidates": 0}}},
            "platform.post_deploy_verify.completed",
            ["Post-deploy verification vector; sanitized operational summaries only"],
        ),
        (
            JobType.PLATFORM_CHANGE_TICKET_BUNDLE,
            {"jobType": "platform.change_ticket_bundle", "idempotencyKey": "vector-change-ticket-bundle-v14-0001", "correlationId": "vector-correlation-change-ticket", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"changeId": "CHG-OPTION-B-V14", "releaseId": "option-b-v14-vector", "route": "/api/hybrid-python/analytics/snapshot/prepare", "jobTypes": ["analytics.snapshot"], "evidenceBundle": {"contractHash": "vector-hash"}, "releaseDecision": {"decision": "advance"}, "rollbackDrill": {"mutatesState": False}, "contractReplay": {"decision": "pass", "failed": 0}, "privacyPreflight": {"decision": "pass", "blockedCandidates": 0}, "sloRegression": {"recommendation": "advance"}, "artifactRefs": [{"artifactId": "artifact-vector", "artifactType": "platform.release_decision.report", "sha256": "abc123", "redactionApplied": True}], "approvals": [{"role": "release-manager", "status": "approved"}]}},
            "platform.change_ticket_bundle.completed",
            ["Change ticket bundle vector; evidence metadata only"],
        ),
        (
            JobType.PLATFORM_OPERATIONAL_HANDOFF,
            {"jobType": "platform.operational_handoff", "idempotencyKey": "vector-operational-handoff-v14-0001", "correlationId": "vector-correlation-ops-handoff", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v14-vector", "route": "/api/hybrid-python/analytics/snapshot/prepare", "jobTypes": ["analytics.snapshot"], "ownerContacts": [{"role": "release-manager", "name": "CarePoint Release"}], "dashboardLinks": [{"name": "Hybrid Python status", "url": "/api/hybrid-python/status"}], "alertPolicies": [{"name": "canary rollback", "status": "active"}], "runbookLinks": [{"name": "rollback drill", "url": "/docs/option-b/IMPLEMENTATION_V14.md"}], "artifactRefs": [{"artifactId": "artifact-vector", "artifactType": "platform.change_ticket_bundle.report", "sha256": "abc123", "redactionApplied": True}]}},
            "platform.operational_handoff.completed",
            ["Operational handoff vector; metadata only"],
        ),
        (
            JobType.PLATFORM_INCIDENT_SIMULATION,
            {"jobType": "platform.incident_simulation", "idempotencyKey": "vector-incident-simulation-v14-0001", "correlationId": "vector-correlation-incident", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"scenario": "latency_regression", "route": "/api/hybrid-python/analytics/snapshot/prepare", "jobTypes": ["analytics.snapshot"], "observedMetrics": {"p95Ms": 1200, "errorRate": 0.01}, "gate": {"recommendation": "hold"}, "slo": {"recommendation": "hold"}, "rollout": {"status": "advancing"}, "operators": ["release-manager"]}},
            "platform.incident_simulation.completed",
            ["Incident simulation vector; dry-run only"],
        ),
        (
            JobType.PLATFORM_CAPACITY_PLAN,
            {"jobType": "platform.capacity_plan", "idempotencyKey": "vector-capacity-plan-v14-0001", "correlationId": "vector-correlation-capacity", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v14-vector", "route": "/api/hybrid-python/analytics/snapshot/prepare", "jobTypes": ["analytics.snapshot"], "targetCanaryPercent": 5, "expectedRequestsPerMinute": 120, "averageDurationMs": 450, "p95DurationMs": 900, "queueDepth": 20, "currentWorkerCount": 2, "workerConcurrency": 4, "targetUtilization": 0.7, "observedErrorRate": 0.001}},
            "platform.capacity_plan.completed",
            ["Capacity planning vector with aggregate workload and queue metrics only"],
        ),
        (
            JobType.PLATFORM_ALERT_POLICY_REVIEW,
            {"jobType": "platform.alert_policy_review", "idempotencyKey": "vector-alert-policy-review-v14-0001", "correlationId": "vector-correlation-alerts", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v14-vector", "route": "/api/hybrid-python/analytics/snapshot/prepare", "jobTypes": ["analytics.snapshot"], "alertPolicies": [{"name": "python worker down readyz", "status": "active", "onCall": "platform"}, {"name": "error-rate 5xx failed-jobs", "status": "active"}, {"name": "latency-p95 duration", "status": "active"}, {"name": "queue-backlog queue-depth", "status": "active"}, {"name": "shadow-mismatch comparison", "status": "active"}, {"name": "privacy-block privacy preflight", "status": "active"}, {"name": "artifact-leak redaction", "status": "active"}], "dashboardLinks": [{"name": "Hybrid Python", "url": "/api/hybrid-python/status", "owner": "platform"}]}},
            "platform.alert_policy_review.completed",
            ["Alert policy review vector with operational metadata only"],
        ),
        (
            JobType.PLATFORM_DEPENDENCY_READINESS,
            {"jobType": "platform.dependency_readiness", "idempotencyKey": "vector-dependency-readiness-v15-0001", "correlationId": "vector-correlation-dependency", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v15-vector", "route": "/api/hybrid-python/analytics/snapshot/prepare", "jobTypes": ["analytics.snapshot"], "requiredDependencies": ["python-worker", "node-api", "redis", "artifact-store"], "dependencies": [{"name": "python-worker", "status": "ok", "critical": True}, {"name": "node-api", "status": "ok", "critical": True}, {"name": "redis", "status": "ok", "critical": True}, {"name": "artifact-store", "status": "ok", "critical": False}]}},
            "platform.dependency_readiness.completed",
            ["Dependency readiness vector with operational health metadata only"],
        ),
        (
            JobType.PLATFORM_PRODUCTION_READINESS,
            {"jobType": "platform.production_readiness", "idempotencyKey": "vector-production-readiness-v15-0001", "correlationId": "vector-correlation-production", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v15-vector", "route": "/api/hybrid-python/analytics/snapshot/prepare", "jobTypes": ["analytics.snapshot"], "targetCanaryPercent": 5, "evidence": {"contractReplay": {"decision": "pass", "failed": 0}, "privacyPreflight": {"decision": "pass", "blockedCandidates": 0}, "sloRegression": {"recommendation": "advance"}, "capacityPlan": {"recommendation": "advance"}, "alertPolicyReview": {"decision": "pass"}, "dependencyReadiness": {"decision": "pass"}, "rollbackDrill": {"status": "ready"}}, "artifactRefs": [{"artifactId": "artifact-vector", "artifactType": "platform.production_readiness.report", "sha256": "abc123", "redactionApplied": True}]}},
            "platform.production_readiness.completed",
            ["Production readiness vector with sanitized release evidence only"],
        ),

        (
            JobType.PLATFORM_DATA_RETENTION_REVIEW,
            {"jobType": "platform.data_retention_review", "idempotencyKey": "vector-data-retention-review-v16-0001", "correlationId": "vector-correlation-data-retention", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v16-vector", "route": "/api/hybrid-python/analytics/snapshot/prepare", "jobTypes": ["analytics.snapshot"], "retentionPolicies": [{"name": "hybrid-artifacts", "artifactType": "platform.*", "ttlSeconds": 86400, "redactionRequired": True, "gcEnabled": True}], "artifactSummary": {"totalArtifacts": 2, "redactionApplied": True, "maxTtlSeconds": 86400}, "gcSummary": {"dryRun": True, "expiredArtifacts": 0}}},
            "platform.data_retention_review.completed",
            ["Retention gate vector with artifact and GC metadata only"],
        ),
        (
            JobType.PLATFORM_AUDIT_TRAIL_REVIEW,
            {"jobType": "platform.audit_trail_review", "idempotencyKey": "vector-audit-trail-review-v16-0001", "correlationId": "vector-correlation-audit-trail", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v16-vector", "route": "/api/hybrid-python/analytics/snapshot/prepare", "jobTypes": ["analytics.snapshot"], "auditEvents": [{"eventType": "canary.plan", "actorUserId": "user-vector-admin", "correlationId": "vector-correlation-audit-trail", "route": "/api/hybrid-python/canary/rollout/plan", "timestamp": "2026-05-05T00:00:00Z", "dryRun": True}], "requiredEventFields": ["eventType", "actorUserId", "correlationId", "route", "timestamp"]}},
            "platform.audit_trail_review.completed",
            ["Audit trail gate vector with operational metadata only"],
        ),

        (
            JobType.PLATFORM_SECURITY_POSTURE_REVIEW,
            {"jobType": "platform.security_posture_review", "idempotencyKey": "vector-security-posture-review-v17-0001", "correlationId": "vector-correlation-security-posture", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v17-vector", "route": "/api/hybrid-python/analytics/snapshot/prepare", "jobTypes": ["analytics.snapshot"], "controls": {"signedBridge": True, "csrfForCookieAuth": True, "rateLimitAuth": True, "objectLevelAuthTests": True, "secretScanPassing": True, "corsProdWhitelist": True, "httpOnlyCookies": True}, "findings": []}},
            "platform.security_posture_review.completed",
            ["Security posture gate vector with sanitized control metadata only"],
        ),
        (
            JobType.PLATFORM_SUPPLY_CHAIN_REVIEW,
            {"jobType": "platform.supply_chain_review", "idempotencyKey": "vector-supply-chain-review-v17-0001", "correlationId": "vector-correlation-supply-chain", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v17-vector", "route": "/api/hybrid-python/analytics/snapshot/prepare", "jobTypes": ["analytics.snapshot"], "sbomPresent": True, "lockfilesPresent": True, "imageScanPresent": True, "scans": [{"type": "npm-audit", "critical": 0, "high": 0, "medium": 0, "low": 0}, {"type": "pip-audit", "critical": 0, "high": 0, "medium": 0, "low": 0}, {"type": "container", "critical": 0, "high": 0, "medium": 0, "low": 0}]}},
            "platform.supply_chain_review.completed",
            ["Supply chain gate vector with scan-count metadata only"],
        ),

        (
            JobType.PLATFORM_SCHEMA_MIGRATION_REHEARSAL,
            {"jobType": "platform.schema_migration_rehearsal", "idempotencyKey": "vector-schema-migration-rehearsal-v18-0001", "correlationId": "vector-correlation-schema-migration", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v18-vector", "route": "/api/hybrid-python/admin/accounts/read-model/prepare", "jobTypes": ["admin.accounts_read_model"], "migrations": [{"name": "20260505_add_account_bulk_job", "operation": "create-table", "destructive": False, "rollbackPlan": True, "backfillPlan": True}], "schemaDrift": {"status": "pass"}, "rehearsalEvidence": {"prismaValidate": True, "migrateStatus": True, "rollbackPlan": True, "backfillPlan": True, "seedSafe": True, "shadowReplay": True}}},
            "platform.schema_migration_rehearsal.completed",
            ["Schema migration rehearsal vector with sanitized CI metadata only"],
        ),
        (
            JobType.PLATFORM_BACKUP_RESTORE_DRILL,
            {"jobType": "platform.backup_restore_drill", "idempotencyKey": "vector-backup-restore-drill-v18-0001", "correlationId": "vector-correlation-backup-restore", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v18-vector", "route": "/api/hybrid-python/analytics/snapshot/prepare", "jobTypes": ["analytics.snapshot"], "rpoMinutes": 60, "rtoMinutes": 120, "backups": [{"store": "postgres", "ok": True, "ageMinutes": 15}, {"store": "redis", "ok": True, "ageMinutes": 10}, {"store": "artifact_store", "ok": True, "ageMinutes": 20}], "restoreTests": [{"store": "postgres", "ok": True, "durationMinutes": 45, "integrityOk": True}, {"store": "redis", "ok": True, "durationMinutes": 5, "integrityOk": True}, {"store": "artifact_store", "ok": True, "durationMinutes": 20, "integrityOk": True}]}},
            "platform.backup_restore_drill.completed",
            ["Backup restore drill vector with store status metadata only"],
        ),
        (
            JobType.ANALYTICS_SNAPSHOT,
            {"jobType": "analytics.snapshot", "idempotencyKey": "vector-analytics-snapshot-v14-0001", "correlationId": "vector-correlation-analytics", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"metric": "latency_ms", "values": [120, 180, 240], "dimensions": {"channel": "admin"}}},
            "analytics.snapshot.computed",
            ["aggregate-only analytics vector"],
        ),

        (
            JobType.PLATFORM_OBSERVABILITY_COVERAGE_REVIEW,
            {"jobType": "platform.observability_coverage_review", "idempotencyKey": "vector-observability-coverage-v19-0001", "correlationId": "vector-correlation-observability", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v19-vector", "route": "/api/hybrid-python/analytics/snapshot/prepare", "jobTypes": ["analytics.snapshot"], "traces": [{"name": "trace_id", "coveragePercent": 99.0}, {"name": "request_id", "coveragePercent": 99.0}], "metrics": [{"metric": "p95_latency"}, {"metric": "error_rate"}, {"metric": "queue_depth"}], "logs": [{"traceId": "trace-vector", "requestId": "request-vector"}], "dashboards": [{"name": "hybrid-python-rollout", "url": "https://dashboards.example.invalid/hybrid-python"}]}},
            "platform.observability_coverage_review.completed",
            ["Observability metadata vector; no raw logs or request payloads"],
        ),
        (
            JobType.PLATFORM_FEATURE_FLAG_REVIEW,
            {"jobType": "platform.feature_flag_review", "idempotencyKey": "vector-feature-flag-review-v19-0001", "correlationId": "vector-correlation-feature-flags", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v19-vector", "route": "/api/hybrid-python/analytics/snapshot/prepare", "jobTypes": ["analytics.snapshot"], "maxCanaryPercent": 5, "flags": {"HYBRID_PYTHON_ENABLED": "true", "HYBRID_PYTHON_SHADOW_MODE": "true", "HYBRID_PYTHON_CANARY_PERCENT": "1", "PYTHON_SERVICES_BASE_URL": "http://python-worker-api:8080", "PYTHON_WORKER_REQUIRE_SIGNATURE": "true"}}},
            "platform.feature_flag_review.completed",
            ["Feature flag metadata vector; secret-like values are redacted in artifacts"],
        ),
        (
            JobType.PLATFORM_DOMAIN_MIGRATION_READINESS,
            {"jobType": "platform.domain_migration_readiness", "idempotencyKey": "vector-domain-migration-readiness-v20-0001", "correlationId": "vector-correlation-domain-migration", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v20-vector", "domain": "analytics", "route": "/api/hybrid-python/analytics/snapshot/prepare", "jobTypes": ["analytics.snapshot"], "targetCanaryPercent": 5, "maxCanaryPercent": 10, "evidence": {"contractReplay": {"decision": "pass", "failed": 0}, "privacyPreflight": {"decision": "pass", "blockedCandidates": 0}, "sloRegression": {"recommendation": "advance"}, "observabilityCoverage": {"decision": "pass"}, "featureFlagReview": {"decision": "pass"}, "productionReadiness": {"decision": "advance"}, "nodeFallbackAvailable": True, "ownerApproved": True}, "shadowComparisonSummary": {"mismatchRate": 0}, "canaryGate": {"allowed": True, "recommendation": "advance"}}},
            "platform.domain_migration_readiness.completed",
            ["Domain migration readiness vector with sanitized release evidence only"],
        ),
        (
            JobType.PLATFORM_CUTOVER_PLAN,
            {"jobType": "platform.cutover_plan", "idempotencyKey": "vector-cutover-plan-v20-0001", "correlationId": "vector-correlation-cutover", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v20-vector", "domain": "analytics", "route": "/api/hybrid-python/analytics/snapshot/prepare", "jobTypes": ["analytics.snapshot"], "fromOwner": "node", "toOwner": "python-worker", "targetCanaryPercent": 10, "stages": [0, 1, 5, 10], "evidence": {"domainMigrationReadiness": {"decision": "advance"}, "productionReadiness": {"decision": "advance"}}, "rollbackTriggers": ["shadow mismatch rate exceeds 5%"], "operatorApprovals": [{"role": "release-manager", "status": "approved"}]}},
            "platform.cutover_plan.completed",
            ["Cutover plan vector is dry-run advisory metadata"],
        ),
        (
            JobType.PLATFORM_OWNER_REGISTRY_REVIEW,
            {"jobType": "platform.owner_registry_review", "idempotencyKey": "vector-owner-registry-v21-0001", "correlationId": "vector-correlation-owner-registry", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v21-vector", "domain": "analytics", "route": "/api/hybrid-python/analytics/snapshot/prepare", "jobTypes": ["analytics.snapshot"], "domains": [{"domain": "analytics", "route": "/api/hybrid-python/analytics/snapshot/prepare", "nodeApiOwner": "api-team", "pythonWorkerOwner": "platform-python", "dataOwner": "analytics-owner", "securityOwner": "security", "rollbackOwner": "release-manager", "incidentOwner": "on-call"}], "approvals": [{"role": "release-manager", "status": "approved"}]}},
            "platform.owner_registry_review.completed",
            ["Owner registry vector; metadata only and no ownership mutation"],
        ),
        (
            JobType.PLATFORM_POST_CUTOVER_MONITOR,
            {"jobType": "platform.post_cutover_monitor", "idempotencyKey": "vector-post-cutover-monitor-v21-0001", "correlationId": "vector-correlation-post-cutover", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v21-vector", "domain": "analytics", "route": "/api/hybrid-python/analytics/snapshot/prepare", "jobTypes": ["analytics.snapshot"], "targetCanaryPercent": 10, "metrics": {"requestCount": 1000, "p95Ms": 220, "errorRate": 0.001, "mismatchRate": 0, "failedJobs": 0, "queueDepth": 2}, "thresholds": {"maxP95Ms": 500, "maxErrorRate": 0.01, "maxMismatchRate": 0.05, "maxFailedJobs": 0}, "evidence": {"nodeFallbackAvailable": True}}},
            "platform.post_cutover_monitor.completed",
            ["Post-cutover monitor vector; aggregate telemetry only"],
        ),

        (
            JobType.PLATFORM_LEGACY_PATH_DECOMMISSION,
            {"jobType": "platform.legacy_path_decommission", "idempotencyKey": "vector-legacy-path-decommission-v22-0001", "correlationId": "vector-correlation-legacy-decommission", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v22-vector", "domain": "analytics", "route": "/api/hybrid-python/analytics/snapshot/prepare", "jobTypes": ["analytics.snapshot"], "legacyPaths": [{"path": "/api/analytics/snapshot", "replacementRoute": "/api/hybrid-python/analytics/snapshot/prepare", "trafficPercent": 0, "fallbackAvailable": True, "decommissionApproved": True, "owner": "api-team"}], "evidence": {"postCutoverMonitor": {"decision": "continue"}, "ownerRegistry": {"decision": "pass"}, "rollbackDrill": {"decision": "ready"}, "observabilityCoverage": {"decision": "pass"}, "productionReadiness": {"decision": "advance"}}, "fallbackPlan": {"available": True, "rollbackTested": True, "owner": "release-manager"}}},
            "platform.legacy_path_decommission.completed",
            ["Legacy path decommission vector; metadata only and no route/code mutation"],
        ),
        (
            JobType.PLATFORM_STEADY_STATE_OPERATIONS_REVIEW,
            {"jobType": "platform.steady_state_operations_review", "idempotencyKey": "vector-steady-state-ops-v22-0001", "correlationId": "vector-correlation-steady-state", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v22-vector", "domain": "analytics", "route": "/api/hybrid-python/analytics/snapshot/prepare", "jobTypes": ["analytics.snapshot"], "runbookLinks": [{"name": "hybrid analytics runbook", "url": "https://docs.example.invalid/runbook"}], "dashboardLinks": [{"name": "hybrid analytics dashboard", "url": "https://dashboards.example.invalid/hybrid"}], "alertPolicies": [{"name": "p95 latency", "enabled": True}], "incidentHistory": [{"id": "INC-1", "status": "resolved", "severity": "sev2"}], "metrics": {"p95Ms": 220, "errorRate": 0.001, "failedJobs": 0, "incidentCount": 1}, "thresholds": {"maxP95Ms": 500, "maxErrorRate": 0.01, "maxFailedJobs": 0, "maxOpenIncidents": 0}, "evidence": {"onCall": True, "ownerRegistry": {"decision": "pass"}, "rollbackDrill": {"decision": "ready"}, "postCutoverMonitor": {"decision": "continue"}}}},
            "platform.steady_state_operations_review.completed",
            ["Steady-state operations vector; aggregate ops metadata only"],
        ),

        (
            JobType.PLATFORM_QUEUE_RESILIENCE_REVIEW,
            {"jobType": "platform.queue_resilience_review", "idempotencyKey": "vector-queue-resilience-v23-0001", "correlationId": "vector-correlation-queue-resilience", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v23-vector", "domain": "analytics", "route": "/api/hybrid-python/analytics/snapshot/prepare", "jobTypes": ["analytics.snapshot"], "queues": [{"name": "hybrid-python-default", "depth": 5, "oldestAgeSeconds": 20, "consumers": 2, "processed": 1000, "failed": 0, "retryEnabled": True, "dlqEnabled": True, "drainRatePerMinute": 120}], "retryPolicy": {"enabled": True, "maxAttempts": 3}, "dlqPolicy": {"enabled": True, "destination": "hybrid-python-dlq"}, "idempotencyEvidence": {"enabled": True}, "thresholds": {"maxQueueDepth": 1000, "maxOldestAgeSeconds": 300, "minConsumers": 1, "maxErrorRate": 0.01}}},
            "platform.queue_resilience_review.completed",
            ["Queue resilience vector with aggregate queue telemetry only"],
        ),
        (
            JobType.PLATFORM_ARTIFACT_INTEGRITY_REVIEW,
            {"jobType": "platform.artifact_integrity_review", "idempotencyKey": "vector-artifact-integrity-v23-0001", "correlationId": "vector-correlation-artifact-integrity", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v23-vector", "domain": "analytics", "route": "/api/hybrid-python/analytics/snapshot/prepare", "jobTypes": ["analytics.snapshot"], "artifacts": [{"artifactId": "artifact-vector-001", "artifactType": "platform.release_decision.report", "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "sizeBytes": 512, "redactionApplied": True, "piiClass": "metadata-only", "expiresAt": "2026-05-12T00:00:00Z"}], "evidence": {"artifactAccessAudit": {"decision": "pass"}}}},
            "platform.artifact_integrity_review.completed",
            ["Artifact integrity vector with metadata only; no artifact payloads"],
        ),
        (
            JobType.PLATFORM_RUNBOOK_FRESHNESS_REVIEW,
            {"jobType": "platform.runbook_freshness_review", "idempotencyKey": "vector-runbook-freshness-v24-0001", "correlationId": "vector-correlation-runbook-freshness", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v24-vector", "domain": "analytics", "route": "/api/hybrid-python/analytics/snapshot/prepare", "jobTypes": ["analytics.snapshot"], "runbooks": [{"name": "deploy", "category": "deploy", "owner": "platform", "url": "https://docs.example.invalid/deploy", "lastReviewedAt": "2026-05-01T00:00:00Z", "approved": True}, {"name": "rollback", "category": "rollback", "owner": "release-manager", "url": "https://docs.example.invalid/rollback", "lastReviewedAt": "2026-05-01T00:00:00Z", "approved": True}, {"name": "incident", "category": "incident", "owner": "on-call", "url": "https://docs.example.invalid/incident", "lastReviewedAt": "2026-05-01T00:00:00Z", "approved": True}, {"name": "privacy", "category": "privacy", "owner": "security", "url": "https://docs.example.invalid/privacy", "lastReviewedAt": "2026-05-01T00:00:00Z", "approved": True}, {"name": "support", "category": "support", "owner": "support", "url": "https://docs.example.invalid/support", "lastReviewedAt": "2026-05-01T00:00:00Z", "approved": True}], "thresholds": {"maxStalenessDays": 365}}},
            "platform.runbook_freshness_review.completed",
            ["Runbook freshness vector with metadata-only docs evidence"],
        ),
        (
            JobType.PLATFORM_SUPPORT_ESCALATION_REVIEW,
            {"jobType": "platform.support_escalation_review", "idempotencyKey": "vector-support-escalation-v24-0001", "correlationId": "vector-correlation-support-escalation", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v24-vector", "domain": "analytics", "route": "/api/hybrid-python/analytics/snapshot/prepare", "jobTypes": ["analytics.snapshot"], "supportTiers": [{"name": "L1", "owner": "support", "coverage": "business-hours", "ackMinutes": 15, "customerComms": True}], "escalationPaths": [{"name": "L1-to-L2", "fromTier": "L1", "toTier": "L2", "trigger": "unresolved-after-30m", "maxMinutes": 30, "enabled": True}], "thresholds": {"maxAckMinutes": 30, "maxEscalationMinutes": 60}}},
            "platform.support_escalation_review.completed",
            ["Support escalation vector with sanitized tier/path metadata only"],
        ),

        (
            JobType.PLATFORM_COST_GUARDRAIL_REVIEW,
            {"jobType": "platform.cost_guardrail_review", "idempotencyKey": "vector-cost-guardrail-v25-0001", "correlationId": "vector-correlation-cost-guardrail", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"costs": {"dailyCost": 100, "workerCost": 10, "queueCost": 2, "artifactStorageCost": 1}, "budgets": {"monthlyBudget": 5000}, "forecast": {"monthlyForecast": 3000}, "thresholds": {"maxDailyCost": 200}}},
            "platform.cost_guardrail_review.completed",
            ["Aggregate cost metadata vector; no provider billing mutations"],
        ),
        (
            JobType.PLATFORM_ENVIRONMENT_PARITY_REVIEW,
            {"jobType": "platform.environment_parity_review", "idempotencyKey": "vector-environment-parity-v25-0001", "correlationId": "vector-correlation-environment-parity", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"staging": {"env": {"PYTHON_SERVICES_BASE_URL": "http://python", "PYTHON_WORKER_REQUIRE_SIGNATURE": "true", "HYBRID_PYTHON_ENABLED": "true", "HYBRID_PYTHON_CANARY_PERCENT": "5"}, "services": ["node-api", "python-worker-api", "python-worker-celery", "redis"], "secretFingerprints": {"bridge": "abc"}}, "production": {"env": {"PYTHON_SERVICES_BASE_URL": "http://python", "PYTHON_WORKER_REQUIRE_SIGNATURE": "true", "HYBRID_PYTHON_ENABLED": "true", "HYBRID_PYTHON_CANARY_PERCENT": "5"}, "services": ["node-api", "python-worker-api", "python-worker-celery", "redis"], "secretFingerprints": {"bridge": "abc"}}}},
            "platform.environment_parity_review.completed",
            ["Environment metadata vector; secret values are omitted"],
        ),
        (
            JobType.PLATFORM_ACCESS_CONTROL_REVIEW,
            {"jobType": "platform.access_control_review", "idempotencyKey": "vector-access-control-v26-0001", "correlationId": "vector-correlation-access-control", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"controls": [{"name": "rbac", "enabled": True}, {"name": "abac", "enabled": True}, {"name": "objectLevelAuth", "enabled": True}], "authorizationMatrix": {"roles": ["SUPER_ADMIN", "COMPANY_ADMIN"]}, "abacPolicies": [{"name": "organization-scope", "enabled": True}], "objectAccessTests": [{"name": "BOLA cross-org record deny", "objectLevel": True, "negative": True, "crossOrg": True, "expectedOutcome": "denied", "actualOutcome": "denied", "passed": True}], "negativeTests": [{"name": "cross-org admin deny", "crossOrg": True, "negative": True, "expectedOutcome": "denied", "actualOutcome": "denied", "passed": True}]}},
            "platform.access_control_review.completed",
            ["Authorization evidence vector; Node remains authz source of truth"],
        ),
        (
            JobType.PLATFORM_DATA_QUALITY_REVIEW,
            {"jobType": "platform.data_quality_review", "idempotencyKey": "vector-data-quality-v26-0001", "correlationId": "vector-correlation-data-quality", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"expectedSchemaVersion": "v1", "datasets": [{"name": "hybrid_jobs", "freshnessMinutes": 5, "nullRate": 0.0, "duplicateRate": 0.0, "schemaVersion": "v1", "expectedSchemaVersion": "v1", "redactionApplied": True, "piiClass": "metadata-only"}], "thresholds": {"maxFreshnessMinutes": 60, "maxNullRate": 0.05, "maxDuplicateRate": 0.001}}},
            "platform.data_quality_review.completed",
            ["Aggregate data quality vector; no raw rows or sensitive samples"],
        ),

        (
            JobType.PLATFORM_CI_STAGING_VALIDATION_REVIEW,
            {"jobType": "platform.ci_staging_validation_review", "idempotencyKey": "vector-ci-staging-validation-v27-0001", "correlationId": "vector-correlation-ci-staging-validation", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v27-smoke", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.cost_guardrail_review", "platform.environment_parity_review", "platform.access_control_review", "platform.data_quality_review"], "checks": [{"name": "npm-ci", "status": "passed"}, {"name": "build-contracts", "status": "passed"}, {"name": "build-api", "status": "passed"}, {"name": "python-tests", "status": "passed"}, {"name": "docker-compose-smoke", "status": "passed"}, {"name": "signed-hmac", "status": "passed"}, {"name": "redis-status-store", "status": "passed"}, {"name": "artifact-registry", "status": "passed"}, {"name": "canary-rollback", "status": "passed"}, {"name": "observability", "status": "passed"}, {"name": "node-bridge-routes", "status": "passed"}], "builds": {"npmCi": {"status": "passed"}, "contracts": {"status": "passed"}, "api": {"status": "passed"}}, "docker": {"status": "passed"}, "hmac": {"signatureRequired": True, "rejectsUnsigned": True, "acceptsSigned": True}, "redis": {"status": "passed"}, "artifactRegistry": {"status": "passed"}, "canary": {"status": "passed"}, "observability": {"status": "passed"}, "evidence": {"pythonTests": {"status": "passed"}}}},
            "platform.ci_staging_validation_review.completed",
            ["Sanitized CI/staging validation vector; no raw logs, secrets, tokens or PHI"],
        ),
        (
            JobType.PLATFORM_RELEASE_CLOSURE_REVIEW,
            {"jobType": "platform.release_closure_review", "idempotencyKey": "vector-release-closure-v27-0001", "correlationId": "vector-correlation-release-closure", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v27-smoke", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.cost_guardrail_review", "platform.environment_parity_review", "platform.access_control_review", "platform.data_quality_review", "platform.ci_staging_validation_review"], "gateResults": {"costGuardrail": {"decision": "pass"}, "environmentParity": {"decision": "pass"}, "accessControl": {"decision": "pass"}, "dataQuality": {"decision": "pass"}, "ciStagingValidation": {"decision": "pass"}, "releaseDecision": {"decision": "pass"}, "rollbackDrill": {"status": "passed"}, "postDeployVerify": {"decision": "pass"}, "changeTicketBundle": {"status": "passed"}}, "evidenceBundle": {"artifactId": "artifact-vector", "sha256": "vector-sha256"}, "validationSummary": {"status": "passed"}, "risks": [{"name": "build-ts-external", "severity": "low", "status": "accepted"}], "approvals": [{"name": "release-owner", "status": "approved"}]}},
            "platform.release_closure_review.completed",
            ["Sanitized final closure vector; approval/deployment execution remains outside Python"],
        ),

        (
            JobType.PLATFORM_PRODUCTION_CANARY_OBSERVATION_REVIEW,
            {"jobType": "platform.production_canary_observation_review", "idempotencyKey": "vector-production-canary-observation-v28-0001", "correlationId": "vector-correlation-production-canary-observation", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v28-smoke", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.release_closure_review"], "windowMinutes": 30, "currentCanaryPercent": 5, "targetCanaryPercent": 10, "metrics": {"errorRate": 0.001, "p95LatencyMs": 450, "mismatchRate": 0.0, "failedJobs": 0, "queueLagSeconds": 2, "hmacRejects": 3, "artifactFailures": 0, "sampleSize": 100}, "thresholds": {"maxErrorRate": 0.01, "maxP95LatencyMs": 2000, "maxMismatchRate": 0.005, "maxFailedJobs": 0, "maxQueueLagSeconds": 60, "maxArtifactFailures": 0, "minSampleSize": 25}, "signals": [{"name": "errorRate", "status": "passed"}, {"name": "p95LatencyMs", "status": "passed"}, {"name": "mismatchRate", "status": "passed"}, {"name": "failedJobs", "status": "passed"}, {"name": "queueLagSeconds", "status": "passed"}, {"name": "hmacRejects", "status": "passed"}, {"name": "artifactFailures", "status": "passed"}], "rollbackTriggers": [{"name": "error-budget-breach", "enabled": True, "fired": False}]}},
            "platform.production_canary_observation_review.completed",
            ["Production canary observation vector with aggregate telemetry only"],
        ),
        (
            JobType.PLATFORM_INCIDENT_RESPONSE_READINESS_REVIEW,
            {"jobType": "platform.incident_response_readiness_review", "idempotencyKey": "vector-incident-response-readiness-v28-0001", "correlationId": "vector-correlation-incident-response-readiness", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v28-smoke", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.release_closure_review"], "oncall": [{"name": "primaryOncall", "enabled": True, "ackMinutes": 5}, {"name": "secondaryOncall", "enabled": True, "ackMinutes": 10}, {"name": "incidentCommander", "enabled": True}, {"name": "rollbackOwner", "enabled": True}], "escalationPaths": [{"name": "pagerRoute", "enabled": True, "maxMinutes": 15}], "runbooks": [{"name": "runbook", "status": "passed", "enabled": True}], "comms": {"customerComms": True, "status": "passed"}, "drills": [{"name": "rollback-drill", "status": "passed"}], "thresholds": {"maxAckMinutes": 15, "maxEscalationMinutes": 30}}},
            "platform.incident_response_readiness_review.completed",
            ["Incident response readiness vector with sanitized coverage metadata only"],
        ),
        (
            JobType.PLATFORM_TRAFFIC_PROMOTION_READINESS_REVIEW,
            {"jobType": "platform.traffic_promotion_readiness_review", "idempotencyKey": "vector-traffic-promotion-readiness-v29-0001", "correlationId": "vector-correlation-traffic-promotion-readiness", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v29-smoke", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.production_canary_observation_review", "platform.incident_response_readiness_review"], "currentCanaryPercent": 10, "targetCanaryPercent": 20, "maxPromotionStepPercent": 10, "gateEvidence": {"releaseClosure": {"decision": "pass"}, "productionCanaryObservation": {"decision": "pass"}, "incidentResponseReadiness": {"decision": "pass"}, "rollbackPlan": {"decision": "pass"}, "operatorApproval": {"decision": "pass"}}, "productionObservation": {"decision": "pass"}, "incidentReadiness": {"decision": "pass"}, "approvals": [{"name": "release-owner", "status": "approved"}], "freezeWindows": [], "rollbackPlan": {"ready": True, "decision": "pass"}}},
            "platform.traffic_promotion_readiness_review.completed",
            ["Traffic promotion readiness vector with advisory metadata only; Node owns rollout mutation"],
        ),
        (
            JobType.PLATFORM_EVIDENCE_RETENTION_AUDIT_REVIEW,
            {"jobType": "platform.evidence_retention_audit_review", "idempotencyKey": "vector-evidence-retention-audit-v29-0001", "correlationId": "vector-correlation-evidence-retention-audit", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v29-smoke", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.release_closure_review"], "artifacts": [{"artifactType": "platform.release_closure_review.report", "sha256": "abc123", "piiClass": "release-closure-evidence-metadata-only", "redactionApplied": True, "downloadProtected": True, "expiresAt": "2026-06-06T00:00:00Z"}, {"artifactType": "platform.production_canary_observation_review.report", "sha256": "def456", "piiClass": "production-canary-observation-metadata-only", "redactionApplied": True, "downloadProtected": True, "expiresAt": "2026-06-06T00:00:00Z"}, {"artifactType": "platform.incident_response_readiness_review.report", "sha256": "ghi789", "piiClass": "incident-response-readiness-metadata-only", "redactionApplied": True, "downloadProtected": True, "expiresAt": "2026-06-06T00:00:00Z"}], "retentionPolicy": {"retentionDays": 45}, "minRetentionDays": 30}},
            "platform.evidence_retention_audit_review.completed",
            ["Evidence retention audit vector with artifact metadata only; no raw logs or PHI"],
        ),
        (
            JobType.PLATFORM_SLO_ERROR_BUDGET_REVIEW,
            {"jobType": "platform.slo_error_budget_review", "idempotencyKey": "vector-slo-error-budget-v30-0001", "correlationId": "vector-correlation-slo-error-budget", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v30-smoke", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.traffic_promotion_readiness_review"], "windowMinutes": 60, "sloTargets": {"availability": 99.9}, "metrics": {"availability": 99.95, "errorRate": 0.001, "p95LatencyMs": 420, "burnRate": 0.8, "errorBudgetRemaining": 65, "sampleSize": 1000, "alertCoverage": True}, "thresholds": {"maxBurnRate": 2, "minErrorBudgetRemaining": 20, "maxP95LatencyMs": 2000, "maxErrorRate": 0.01, "minSampleSize": 25}, "services": [{"name": "python-worker-api", "availability": 99.96, "errorRate": 0.001, "p95LatencyMs": 400, "burnRate": 0.7, "errorBudgetRemaining": 70, "sampleSize": 500}], "evidence": {"alertCoverage": True}}},
            "platform.slo_error_budget_review.completed",
            ["SLO/error-budget vector with aggregate telemetry only; no raw logs or PHI"],
        ),
        (
            JobType.PLATFORM_AUTO_ROLLBACK_SAFEGUARD_REVIEW,
            {"jobType": "platform.auto_rollback_safeguard_review", "idempotencyKey": "vector-auto-rollback-safeguard-v30-0001", "correlationId": "vector-correlation-auto-rollback-safeguard", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v30-smoke", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.slo_error_budget_review"], "rolloutId": "option-b-v30-rollout", "canaryPercent": 20, "safeguards": [{"name": "automatictrigger", "enabled": True, "ready": True}, {"name": "manualoverride", "enabled": True, "ready": True}, {"name": "nodefallback", "enabled": True, "ready": True}, {"name": "rollbackrunbook", "enabled": True, "ready": True}, {"name": "recentdrill", "enabled": True, "ready": True}], "rollbackTriggers": [{"name": "error-budget-breach", "enabled": True, "fired": False, "detectionMinutes": 2}], "featureFlags": [{"name": "hybrid-python-enabled", "killSwitch": True, "enabled": True}], "runbook": {"name": "rollback-runbook", "ready": True, "decision": "pass"}, "evidence": {"manualOverride": True, "nodeFallback": True, "rollbackMinutes": 8}}},
            "platform.auto_rollback_safeguard_review.completed",
            ["Auto-rollback safeguard vector with trigger and kill-switch metadata only"],
        ),

        (
            JobType.PLATFORM_THIRD_PARTY_DEPENDENCY_REVIEW,
            {"jobType": "platform.third_party_dependency_review", "idempotencyKey": "vector-third-party-dependency-v31-0001", "correlationId": "vector-correlation-third-party-dependency", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v31-smoke", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.slo_error_budget_review", "platform.auto_rollback_safeguard_review"], "dependencies": [{"name": "redis", "status": "operational", "errorRate": 0.0, "p95LatencyMs": 25, "rateLimitHeadroomPercent": 80, "failoverReady": True}, {"name": "objectStorage", "status": "operational", "errorRate": 0.0, "p95LatencyMs": 120, "rateLimitHeadroomPercent": 75, "failoverReady": True}, {"name": "database", "status": "operational", "errorRate": 0.0, "p95LatencyMs": 35, "rateLimitHeadroomPercent": 70, "failoverReady": True}, {"name": "observability", "status": "operational", "errorRate": 0.0, "p95LatencyMs": 80, "rateLimitHeadroomPercent": 65, "failoverReady": True}, {"name": "authProvider", "status": "operational", "errorRate": 0.0, "p95LatencyMs": 90, "rateLimitHeadroomPercent": 60, "failoverReady": True}], "incidents": [], "statusPages": [{"name": "core-dependencies", "status": "operational"}], "thresholds": {"maxErrorRate": 0.01, "maxP95LatencyMs": 2000, "minRateLimitHeadroomPercent": 20}}},
            "platform.third_party_dependency_review.completed",
            ["Third-party dependency vector with sanitized health metadata only"],
        ),
        (
            JobType.PLATFORM_CAPACITY_SCALING_READINESS_REVIEW,
            {"jobType": "platform.capacity_scaling_readiness_review", "idempotencyKey": "vector-capacity-scaling-readiness-v31-0001", "correlationId": "vector-correlation-capacity-scaling-readiness", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v31-smoke", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.third_party_dependency_review"], "currentCanaryPercent": 20, "targetCanaryPercent": 35, "metrics": {"queueLagSeconds": 2, "cpuPercent": 45, "memoryPercent": 55, "p95LatencyMs": 420, "workerConcurrency": 8}, "queues": [{"name": "python-worker-celery", "queueLagSeconds": 2, "backlog": 0}], "workers": [{"name": "python-worker-api", "cpuPercent": 40, "memoryPercent": 50, "workerConcurrency": 4}, {"name": "python-worker-celery", "cpuPercent": 48, "memoryPercent": 58, "workerConcurrency": 8}], "autoscaling": {"enabled": True, "ready": True, "minReplicas": 2, "maxReplicas": 8}, "loadTest": {"passed": True, "decision": "pass", "peakRps": 100}, "thresholds": {"maxQueueLagSeconds": 60, "maxCpuPercent": 75, "maxMemoryPercent": 80, "maxP95LatencyMs": 2000, "minWorkerConcurrency": 2}}},
            "platform.capacity_scaling_readiness_review.completed",
            ["Capacity scaling readiness vector with aggregate operational metrics only"],
        ),
        (
            JobType.PLATFORM_COMPLIANCE_PRIVACY_EVIDENCE_REVIEW,
            {"jobType": "platform.compliance_privacy_evidence_review", "idempotencyKey": "vector-compliance-privacy-evidence-v32-0001", "correlationId": "vector-correlation-compliance-privacy-evidence", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v32-smoke", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.capacity_scaling_readiness_review"], "evidence": {"privacyPreflight": {"decision": "pass"}, "dataRetention": {"decision": "pass"}, "auditTrail": {"decision": "pass"}, "securityPosture": {"decision": "pass"}, "accessControl": {"decision": "pass"}, "dataQuality": {"decision": "pass"}}, "artifacts": [{"artifactType": "platform.release_closure_review.report", "sha256": "v32abc", "piiClass": "metadata-only", "redactionApplied": True, "downloadProtected": True}], "complianceControls": [{"name": "minimum-necessary", "decision": "pass"}], "dpia": {"approved": True, "decision": "pass"}, "dpaRecords": [{"name": "vendor-dpa", "status": "active"}], "approvals": [{"name": "privacy-owner", "status": "approved"}]}},
            "platform.compliance_privacy_evidence_review.completed",
            ["Compliance/privacy evidence vector with sanitized metadata only"],
        ),
        (
            JobType.PLATFORM_RUNBOOK_DRILL_VERIFICATION_REVIEW,
            {"jobType": "platform.runbook_drill_verification_review", "idempotencyKey": "vector-runbook-drill-verification-v32-0001", "correlationId": "vector-correlation-runbook-drill-verification", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v32-smoke", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.compliance_privacy_evidence_review"], "runbooks": [{"name": "rollback", "ready": True, "ownerAck": True, "ageDays": 10, "url": "runbook://rollback"}, {"name": "incident", "ready": True, "ownerAck": True, "ageDays": 12, "url": "runbook://incident"}, {"name": "supportEscalation", "ready": True, "ownerAck": True, "ageDays": 7, "url": "runbook://support"}, {"name": "artifactRecovery", "ready": True, "ownerAck": True, "ageDays": 14, "url": "runbook://artifact"}, {"name": "dataPrivacy", "ready": True, "ownerAck": True, "ageDays": 8, "url": "runbook://privacy"}], "drills": [{"name": "rollback", "passed": True, "ageDays": 15}, {"name": "incident", "passed": True, "ageDays": 20}, {"name": "restore", "passed": True, "ageDays": 18}, {"name": "supportEscalation", "passed": True, "ageDays": 21}], "evidence": {"operatorReview": {"decision": "pass"}}}},
            "platform.runbook_drill_verification_review.completed",
            ["Runbook drill verification vector with runbook/drill metadata only"],
        ),
        (
            JobType.PLATFORM_DISASTER_RECOVERY_BACKUP_REVIEW,
            {"jobType": "platform.disaster_recovery_backup_review", "idempotencyKey": "vector-disaster-recovery-backup-v33-0001", "correlationId": "vector-correlation-disaster-recovery-backup", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v33-smoke", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.runbook_drill_verification_review"], "backups": [{"name": "database", "verified": True, "encrypted": True, "offsiteCopy": True, "ageHours": 4, "sha256": "drdb"}, {"name": "redis", "verified": True, "encrypted": True, "offsiteCopy": True, "ageHours": 3, "sha256": "drredis"}, {"name": "artifactStorage", "verified": True, "encrypted": True, "offsiteCopy": True, "ageHours": 5, "sha256": "drartifact"}, {"name": "configuration", "verified": True, "encrypted": True, "offsiteCopy": True, "ageHours": 2, "sha256": "drconfig"}], "restoreDrills": [{"name": "restore", "passed": True, "ageDays": 10, "rpoMinutes": 15, "rtoMinutes": 90}], "rpoRtoTargets": {"maxRpoMinutes": 60, "maxRtoMinutes": 240}, "evidence": {"operatorReview": {"decision": "pass"}}}},
            "platform.disaster_recovery_backup_review.completed",
            ["DR/backup vector with sanitized backup and restore metadata only"],
        ),
        (
            JobType.PLATFORM_CHANGE_MIGRATION_READINESS_REVIEW,
            {"jobType": "platform.change_migration_readiness_review", "idempotencyKey": "vector-change-migration-readiness-v33-0001", "correlationId": "vector-correlation-change-migration-readiness", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v33-smoke", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.disaster_recovery_backup_review"], "migrations": [{"name": "schema", "decision": "pass", "dryRunPassed": True, "reversible": True, "destructive": False, "backupBeforeMigration": True}, {"name": "contracts", "decision": "pass", "dryRunPassed": True, "reversible": True, "backupBeforeMigration": True}], "changeTickets": [{"name": "CHG-option-b-v33", "status": "approved", "ageDays": 2}], "approvals": [{"name": "release-manager", "status": "approved"}], "rollbackPlan": {"decision": "pass"}, "rolloutPlan": {"decision": "pass"}, "dataBackfill": {"decision": "pass"}, "evidence": {"migrationDryRun": {"decision": "pass"}}}},
            "platform.change_migration_readiness_review.completed",
            ["Change/migration readiness vector with sanitized ticket and migration metadata only"],
        ),
        (
            JobType.PLATFORM_CONFIGURATION_SECRET_ROTATION_REVIEW,
            {"jobType": "platform.configuration_secret_rotation_review", "idempotencyKey": "vector-configuration-secret-rotation-v34-0001", "correlationId": "vector-correlation-configuration-secret-rotation", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v34-smoke", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.change_migration_readiness_review"], "secrets": [{"name": "pythonWorkerHmac", "decision": "pass", "ageDays": 12, "externalStore": True, "rotationDue": False, "breakGlassReady": True}, {"name": "redis", "decision": "pass", "ageDays": 20, "externalStore": True, "rotationDue": False, "breakGlassReady": True}, {"name": "database", "decision": "pass", "ageDays": 25, "externalStore": True, "rotationDue": False, "breakGlassReady": True}, {"name": "artifactStorage", "decision": "pass", "ageDays": 8, "externalStore": True, "rotationDue": False, "breakGlassReady": True}], "configItems": [{"name": "PYTHON_WORKER_REQUIRE_SIGNATURE", "decision": "pass", "drift": False, "redacted": True}, {"name": "HYBRID_PYTHON_CANARY_PERCENT", "decision": "pass", "drift": False, "redacted": True}], "rotations": [{"name": "quarterly-secret-rotation", "decision": "pass", "completed": True, "scheduled": True}], "evidence": {"secretManager": {"decision": "pass"}}}},
            "platform.configuration_secret_rotation_review.completed",
            ["Configuration/secret rotation vector with sanitized secret metadata only"],
        ),
        (
            JobType.PLATFORM_MAINTENANCE_WINDOW_READINESS_REVIEW,
            {"jobType": "platform.maintenance_window_readiness_review", "idempotencyKey": "vector-maintenance-window-readiness-v34-0001", "correlationId": "vector-correlation-maintenance-window-readiness", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v34-smoke", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.configuration_secret_rotation_review"], "maintenanceWindows": [{"name": "low-traffic-window", "decision": "pass", "lowTraffic": True, "approvedAt": "2026-05-01T00:00:00Z"}], "tasks": [{"name": "preflight", "decision": "pass", "passed": True, "ownerAck": True}, {"name": "backup", "decision": "pass", "passed": True, "ownerAck": True}, {"name": "rollback", "decision": "pass", "passed": True, "ownerAck": True}, {"name": "postVerify", "decision": "pass", "passed": True, "ownerAck": True}], "approvals": [{"name": "sre-lead", "status": "approved"}], "comms": {"decision": "pass"}, "evidence": {"changeCalendar": {"decision": "pass"}}}},
            "platform.maintenance_window_readiness_review.completed",
            ["Maintenance-window readiness vector with sanitized window/task metadata only"],
        ),
        (
            JobType.PLATFORM_AUDIT_FORENSICS_READINESS_REVIEW,
            {"jobType": "platform.audit_forensics_readiness_review", "idempotencyKey": "vector-audit-forensics-readiness-v35-0001", "correlationId": "vector-correlation-audit-forensics-readiness", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v35-smoke", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.maintenance_window_readiness_review"], "auditTrails": [{"name": "apiAudit", "decision": "pass", "gapMinutes": 2, "immutable": True, "complete": True}, {"name": "authAudit", "decision": "pass", "gapMinutes": 3, "immutable": True, "complete": True}, {"name": "workerAudit", "decision": "pass", "gapMinutes": 2, "immutable": True, "complete": True}, {"name": "artifactAccessAudit", "decision": "pass", "gapMinutes": 4, "immutable": True, "complete": True}], "forensicArtifacts": [{"name": "incident-evidence-bundle", "decision": "pass", "ageDays": 1, "redactionApplied": True, "immutable": True, "verified": True}], "investigationDrills": [{"name": "forensics-drill", "decision": "pass", "passed": True, "ageDays": 7}], "chainOfCustody": {"decision": "pass", "verified": True}, "evidence": {"siemExport": {"decision": "pass"}}}},
            "platform.audit_forensics_readiness_review.completed",
            ["Audit and forensics vector with sanitized evidence metadata only"],
        ),
        (
            JobType.PLATFORM_BUSINESS_CONTINUITY_READINESS_REVIEW,
            {"jobType": "platform.business_continuity_readiness_review", "idempotencyKey": "vector-business-continuity-readiness-v35-0001", "correlationId": "vector-correlation-business-continuity-readiness", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v35-smoke", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.audit_forensics_readiness_review"], "continuityPlans": [{"name": "support", "decision": "pass", "approved": True, "ownerAck": True}, {"name": "operations", "decision": "pass", "approved": True, "ownerAck": True}, {"name": "billing", "decision": "pass", "approved": True, "ownerAck": True}, {"name": "clinical", "decision": "pass", "approved": True, "ownerAck": True}], "teams": [{"name": "sre", "decision": "pass", "coverageReady": True, "primaryOnCall": True, "backupOnCall": True}], "communications": {"decision": "pass"}, "fallbackProcedures": [{"name": "manual-intake", "decision": "pass", "tested": True}], "exercises": [{"name": "continuity-tabletop", "decision": "pass", "passed": True, "ageDays": 30}], "evidence": {"continuityReview": {"decision": "pass"}}}},
            "platform.business_continuity_readiness_review.completed",
            ["Business continuity vector with sanitized plan and exercise metadata only"],
        ),
        (
            JobType.PLATFORM_POST_INCIDENT_LEARNING_REVIEW,
            {"jobType": "platform.post_incident_learning_review", "idempotencyKey": "vector-post-incident-learning-v36-0001", "correlationId": "vector-correlation-post-incident-learning", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v36-smoke", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.business_continuity_readiness_review"], "incidents": [{"name": "sev1", "decision": "pass", "postmortemLinked": True, "ownerAck": True}, {"name": "sev2", "decision": "pass", "postmortemLinked": True, "ownerAck": True}, {"name": "rollback", "decision": "pass", "postmortemLinked": True, "ownerAck": True}, {"name": "privacy", "decision": "pass", "postmortemLinked": True, "ownerAck": True}], "postmortems": [{"name": "may-release-learning", "decision": "pass", "completed": True, "ownerAck": True}], "actionItems": [{"name": "add-regression-guard", "decision": "pass", "status": "closed", "ownerAck": True, "ageDays": 5}], "regressions": [{"name": "rollback-path-regression", "decision": "pass", "passed": True}], "evidence": {"learningReview": {"decision": "pass"}}}},
            "platform.post_incident_learning_review.completed",
            ["Post-incident learning vector with sanitized incident, postmortem and action-item metadata only"],
        ),
        (
            JobType.PLATFORM_TECH_DEBT_GOVERNANCE_REVIEW,
            {"jobType": "platform.tech_debt_governance_review", "idempotencyKey": "vector-tech-debt-governance-v36-0001", "correlationId": "vector-correlation-tech-debt-governance", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v36-smoke", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.post_incident_learning_review"], "debtItems": [{"name": "security-debt-register", "category": "security", "severity": "medium", "decision": "pass", "ownerAck": True, "remediationPlanned": True}, {"name": "reliability-debt-register", "category": "reliability", "severity": "medium", "decision": "pass", "ownerAck": True, "remediationPlanned": True}, {"name": "contract-debt-register", "category": "contracts", "severity": "low", "decision": "pass", "ownerAck": True, "remediationPlanned": True}, {"name": "observability-debt-register", "category": "observability", "severity": "low", "decision": "pass", "ownerAck": True, "remediationPlanned": True}], "waivers": [{"name": "temporary-waiver", "decision": "pass", "approved": True, "ageDays": 10, "expiresAt": "2026-06-01T00:00:00Z"}], "ownership": [{"name": "platform-eng", "status": "approved"}], "remediationPlan": {"decision": "pass"}, "evidence": {"debtReview": {"decision": "pass"}}}},
            "platform.tech_debt_governance_review.completed",
            ["Technical debt governance vector with sanitized debt register, waiver and remediation-plan metadata only"],
        ),
        (
            JobType.PLATFORM_VENDOR_RESILIENCE_REVIEW,
            {"jobType": "platform.vendor_resilience_review", "idempotencyKey": "vector-vendor-resilience-v37-0001", "correlationId": "vector-correlation-vendor-resilience", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v37-smoke", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.tech_debt_governance_review"], "vendors": [{"name": "payments", "decision": "pass", "statusAgeMinutes": 5, "slaReady": True, "statusGreen": True, "ownerAck": True}, {"name": "messaging", "decision": "pass", "statusAgeMinutes": 10, "slaReady": True, "statusGreen": True, "ownerAck": True}, {"name": "artifactStorage", "decision": "pass", "statusAgeMinutes": 8, "slaReady": True, "statusGreen": True, "ownerAck": True}], "services": [{"name": "queue-provider", "decision": "pass", "degraded": False, "redundancyReady": True}], "incidents": [{"name": "vendor-status-sample", "decision": "pass", "resolved": True, "ageDays": 1}], "exitPlans": [{"name": "payments-contingency", "decision": "pass", "tested": True, "ownerAck": True}], "evidence": {"vendorReview": {"decision": "pass"}}}},
            "platform.vendor_resilience_review.completed",
            ["Vendor resilience vector with sanitized vendor, incident and exit-plan metadata only"],
        ),
        (
            JobType.PLATFORM_KNOWLEDGE_TRANSFER_READINESS_REVIEW,
            {"jobType": "platform.knowledge_transfer_readiness_review", "idempotencyKey": "vector-knowledge-transfer-readiness-v37-0001", "correlationId": "vector-correlation-knowledge-transfer", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v37-smoke", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.vendor_resilience_review"], "knowledgeArtifacts": [{"name": "runbooks", "decision": "pass", "reviewed": True, "redacted": True, "ageDays": 10}, {"name": "oncall", "decision": "pass", "reviewed": True, "redacted": True, "ageDays": 7}, {"name": "rollback", "decision": "pass", "reviewed": True, "redacted": True, "ageDays": 5}, {"name": "privacy", "decision": "pass", "reviewed": True, "redacted": True, "ageDays": 12}], "owners": [{"name": "platform-primary", "role": "primary", "decision": "pass", "acknowledged": True}, {"name": "platform-secondary", "role": "secondary", "decision": "pass", "acknowledged": True}], "trainingSessions": [{"name": "sustained-ops-training", "decision": "pass", "completed": True, "coveragePercent": 95}], "handoffChecklists": [{"name": "v37-handoff", "decision": "pass", "completed": True}], "evidence": {"handoffReview": {"decision": "pass"}}}},
            "platform.knowledge_transfer_readiness_review.completed",
            ["Knowledge transfer vector with sanitized artifact, owner and training metadata only"],
        ),
        (
            JobType.PLATFORM_ARCHITECTURE_OWNERSHIP_REVIEW,
            {"jobType": "platform.architecture_ownership_review", "idempotencyKey": "vector-architecture-ownership-v38-0001", "correlationId": "vector-correlation-architecture-ownership", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v38-smoke", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.knowledge_transfer_readiness_review"], "architectureArtifacts": [{"name": "api-architecture", "decision": "pass", "approved": True, "redacted": True, "ageDays": 10}, {"name": "worker-architecture", "decision": "pass", "approved": True, "redacted": True, "ageDays": 12}, {"name": "contracts-architecture", "decision": "pass", "approved": True, "redacted": True, "ageDays": 8}, {"name": "observability-architecture", "decision": "pass", "approved": True, "redacted": True, "ageDays": 7}], "serviceBoundaries": [{"name": "node-python-boundary", "decision": "pass", "documented": True, "drift": False}], "owners": [{"name": "architecture-owner", "role": "primary", "decision": "pass", "acknowledged": True}], "decisionRecords": [{"name": "adr-option-b-ownership", "decision": "pass", "approved": True, "linked": True}], "evidence": {"architectureReview": {"decision": "pass"}}}},
            "platform.architecture_ownership_review.completed",
            ["Architecture ownership vector with sanitized artifact, boundary, owner and ADR metadata only"],
        ),
        (
            JobType.PLATFORM_EXECUTIVE_METRICS_GOVERNANCE_REVIEW,
            {"jobType": "platform.executive_metrics_governance_review", "idempotencyKey": "vector-executive-metrics-governance-v38-0001", "correlationId": "vector-correlation-executive-metrics", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v38-smoke", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.architecture_ownership_review"], "metricDefinitions": [{"name": "availability", "decision": "pass", "approved": True, "ownerAck": True, "redacted": True, "ageDays": 5}, {"name": "latency", "decision": "pass", "approved": True, "ownerAck": True, "redacted": True, "ageDays": 5}, {"name": "errorRate", "decision": "pass", "approved": True, "ownerAck": True, "redacted": True, "ageDays": 5}, {"name": "cost", "decision": "pass", "approved": True, "ownerAck": True, "redacted": True, "ageDays": 6}, {"name": "privacy", "decision": "pass", "approved": True, "ownerAck": True, "redacted": True, "ageDays": 6}], "dashboards": [{"name": "exec-readiness-dashboard", "decision": "pass", "linked": True, "fresh": True, "accessReviewed": True}], "reviewCadence": {"decision": "pass", "ownerAck": True}, "owners": [{"name": "platform-lead", "role": "executive-owner", "decision": "pass", "acknowledged": True}], "evidence": {"metricsGovernance": {"decision": "pass"}}}},
            "platform.executive_metrics_governance_review.completed",
            ["Executive metrics governance vector with sanitized metric, dashboard, cadence and owner metadata only"],
        ),

        (
            JobType.PLATFORM_DOMAIN_ADOPTION_READINESS_REVIEW,
            {"jobType": "platform.domain_adoption_readiness_review", "idempotencyKey": "vector-domain-adoption-readiness-v39-0001", "correlationId": "vector-correlation-domain-adoption", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v39-phase-2", "phase": "phase-2", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.executive_metrics_governance_review"], "domains": [{"name": "admin", "decision": "pass", "readinessScore": 95, "ownerAck": True, "rollbackReady": True, "redacted": True}, {"name": "scheduling", "decision": "pass", "readinessScore": 92, "ownerAck": True, "rollbackReady": True, "redacted": True}, {"name": "messaging", "decision": "pass", "readinessScore": 91, "ownerAck": True, "rollbackReady": True, "redacted": True}, {"name": "billing", "decision": "pass", "readinessScore": 90, "ownerAck": True, "rollbackReady": True, "redacted": True}, {"name": "clinical", "decision": "pass", "readinessScore": 94, "ownerAck": True, "rollbackReady": True, "redacted": True}], "owners": [{"name": "domain-adoption-owner", "decision": "pass", "acknowledged": True}], "rollbackPlan": {"decision": "pass", "tested": True, "ownerAck": True}, "evidence": {"phase2Adoption": {"decision": "pass"}}}},
            "platform.domain_adoption_readiness_review.completed",
            ["Phase 2 domain adoption vector with sanitized domain, owner and rollback metadata only"],
        ),
        (
            JobType.PLATFORM_PHASE_TWO_ROLLOUT_GOVERNANCE_REVIEW,
            {"jobType": "platform.phase_two_rollout_governance_review", "idempotencyKey": "vector-phase-two-rollout-governance-v39-0001", "correlationId": "vector-correlation-phase-two-rollout", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v39-phase-2", "phase": "phase-2", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.domain_adoption_readiness_review"], "milestones": [{"name": "phase-2-entry", "decision": "pass", "completed": True}, {"name": "domain-adoption-gate", "decision": "pass", "completed": True}], "approvals": [{"name": "product", "decision": "pass", "approved": True}, {"name": "platform", "decision": "pass", "approved": True}, {"name": "support", "decision": "pass", "approved": True}], "cohorts": [{"name": "internal-users", "decision": "pass", "defined": True, "rollbackReady": True}], "guardrails": [{"name": "slo", "decision": "pass", "enabled": True}, {"name": "privacy", "decision": "pass", "enabled": True}, {"name": "support", "decision": "pass", "enabled": True}], "communicationsPlan": {"decision": "pass", "approved": True, "redacted": True}, "supportPlan": {"decision": "pass", "approved": True, "ownerAck": True}, "evidence": {"phase2Governance": {"decision": "pass"}}}},
            "platform.phase_two_rollout_governance_review.completed",
            ["Phase 2 rollout governance vector with sanitized milestone, approval, cohort and guardrail metadata only"],
        ),
        (
            JobType.PLATFORM_DOMAIN_PILOT_EXECUTION_REVIEW,
            {"jobType": "platform.domain_pilot_execution_review", "idempotencyKey": "vector-domain-pilot-execution-v40-0001", "correlationId": "vector-correlation-domain-pilot", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v40-phase-2", "phase": "phase-2", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.domain_adoption_readiness_review"], "pilotDomains": [{"name": "admin", "decision": "pass", "enabled": True, "ownerAck": True}, {"name": "scheduling", "decision": "pass", "enabled": True, "ownerAck": True}], "pilotRuns": [{"name": "admin-pilot", "decision": "pass", "completed": True, "successRate": 0.99, "errorRate": 0.001, "openBlockers": 0}, {"name": "scheduling-pilot", "decision": "pass", "completed": True, "successRate": 0.98, "errorRate": 0.002, "openBlockers": 0}], "acceptanceCriteria": [{"name": "slo", "decision": "pass", "met": True}, {"name": "support", "decision": "pass", "met": True}], "operatorApprovals": [{"name": "domain-owner", "decision": "pass", "approved": True}, {"name": "platform-owner", "decision": "pass", "approved": True}], "rollbackPlan": {"decision": "pass", "tested": True, "ownerAck": True}, "evidence": {"pilotExecution": {"decision": "pass"}}}},
            "platform.domain_pilot_execution_review.completed",
            ["Phase 2 domain pilot execution vector with sanitized pilot, approval and rollback metadata only"],
        ),
        (
            JobType.PLATFORM_PHASE_TWO_EXPANSION_CONTROL_REVIEW,
            {"jobType": "platform.phase_two_expansion_control_review", "idempotencyKey": "vector-phase-two-expansion-control-v40-0001", "correlationId": "vector-correlation-phase-two-expansion", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v40-phase-2", "phase": "phase-2", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.domain_pilot_execution_review"], "waves": [{"name": "wave-1", "decision": "pass", "targetPercent": 10, "completed": True}, {"name": "wave-2", "decision": "pass", "targetPercent": 20, "completed": True}], "trafficLimits": {"decision": "pass", "maxTargetPercent": 25, "currentPercent": 10, "targetPercent": 20}, "rollbackTriggers": [{"name": "slo-breach", "decision": "pass", "configured": True}, {"name": "privacy-block", "decision": "pass", "configured": True}], "checkpoints": [{"name": "slo", "decision": "pass", "passed": True}, {"name": "support", "decision": "pass", "passed": True}], "approvals": [{"name": "release-manager", "decision": "pass", "approved": True}, {"name": "sre", "decision": "pass", "approved": True}], "evidence": {"expansionControl": {"decision": "pass"}}}},
            "platform.phase_two_expansion_control_review.completed",
            ["Phase 2 expansion control vector with sanitized wave, traffic-limit and rollback-trigger metadata only"],
        ),
        (
            JobType.PLATFORM_DOMAIN_OUTCOME_MEASUREMENT_REVIEW,
            {"jobType": "platform.domain_outcome_measurement_review", "idempotencyKey": "vector-domain-outcome-measurement-v41-0001", "correlationId": "vector-correlation-domain-outcome", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v41-phase-2", "phase": "phase-2", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.domain_pilot_execution_review"], "outcomeMetrics": [{"name": "success_rate", "decision": "pass", "value": 0.99, "regressionPercent": 0.5}, {"name": "latency", "decision": "pass", "value": 180, "target": 250, "regressionPercent": 1.0}, {"name": "satisfaction", "decision": "pass", "value": 0.9, "regressionPercent": 0.0}], "baselines": [{"name": "pilot-baseline", "decision": "pass", "approved": True}], "adoptionSignals": [{"name": "admin-activation", "decision": "pass", "score": 0.86}], "supportSignals": [{"name": "support-load", "decision": "pass", "ticketRate": 0.01, "openBlockers": 0}], "evidence": {"outcomeMeasurement": {"decision": "pass"}}}},
            "platform.domain_outcome_measurement_review.completed",
            ["Phase 2 domain outcome measurement vector with sanitized metrics, baselines and adoption/support metadata only"],
        ),
        (
            JobType.PLATFORM_PHASE_TWO_FEEDBACK_ADOPTION_REVIEW,
            {"jobType": "platform.phase_two_feedback_adoption_review", "idempotencyKey": "vector-phase-two-feedback-adoption-v41-0001", "correlationId": "vector-correlation-feedback-adoption", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v41-phase-2", "phase": "phase-2", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.domain_outcome_measurement_review"], "feedbackItems": [{"name": "pilot-feedback", "decision": "pass", "severity": "medium", "closed": True}], "adoptionDecisions": [{"name": "expand-admin", "decision": "pass", "approved": True, "rollbackReady": True}], "ownerResponses": [{"name": "domain-owner", "decision": "pass", "responded": True}, {"name": "support-owner", "decision": "pass", "responded": True}], "communications": [{"name": "operator-update", "decision": "pass", "approved": True, "redacted": True}], "evidence": {"feedbackAdoption": {"decision": "pass"}}}},
            "platform.phase_two_feedback_adoption_review.completed",
            ["Phase 2 feedback/adoption vector with sanitized feedback, decision, owner-response and communications metadata only"],
        ),
        (
            JobType.PLATFORM_DOMAIN_GRADUATION_READINESS_REVIEW,
            {"jobType": "platform.domain_graduation_readiness_review", "idempotencyKey": "vector-domain-graduation-readiness-v42-0001", "correlationId": "vector-correlation-domain-graduation", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v42-phase-2", "phase": "phase-2", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.domain_outcome_measurement_review"], "graduationCandidates": [{"name": "admin", "decision": "pass", "ownerAck": True, "rollbackReady": True}, {"name": "scheduling", "decision": "pass", "ownerAck": True, "rollbackReady": True}], "graduationCriteria": [{"name": "outcomes", "decision": "pass", "met": True}, {"name": "support", "decision": "pass", "met": True}], "outcomeSummary": {"decision": "pass", "score": 0.91}, "riskRegister": [{"name": "pilot-risk", "decision": "pass", "severity": "medium", "closed": True}], "approvals": [{"name": "domain-owner", "decision": "pass", "approved": True}, {"name": "release-manager", "decision": "pass", "approved": True}], "evidence": {"domainGraduation": {"decision": "pass"}}}},
            "platform.domain_graduation_readiness_review.completed",
            ["Phase 2 domain graduation readiness vector with sanitized candidates, criteria, risks, approvals and evidence only"],
        ),
        (
            JobType.PLATFORM_PHASE_TWO_LEARNING_CONSOLIDATION_REVIEW,
            {"jobType": "platform.phase_two_learning_consolidation_review", "idempotencyKey": "vector-phase-two-learning-consolidation-v42-0001", "correlationId": "vector-correlation-learning-consolidation", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v42-phase-2", "phase": "phase-2", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.phase_two_feedback_adoption_review"], "learnings": [{"name": "support-triage", "decision": "pass", "captured": True}, {"name": "domain-handoff", "decision": "pass", "captured": True}], "experiments": [{"name": "admin-pilot", "decision": "pass", "analyzed": True}], "decisions": [{"name": "graduation-path", "decision": "pass", "approved": True}], "playbookUpdates": [{"name": "phase2-playbook", "decision": "pass", "approved": True, "ownerAck": True}], "owners": [{"name": "platform-owner", "decision": "pass", "acknowledged": True}, {"name": "support-owner", "decision": "pass", "acknowledged": True}], "evidence": {"learningConsolidation": {"decision": "pass"}}}},
            "platform.phase_two_learning_consolidation_review.completed",
            ["Phase 2 learning consolidation vector with sanitized learnings, decisions, playbook updates, owners and evidence only"],
        ),
        (
            JobType.PLATFORM_DOMAIN_WIDE_ADOPTION_READINESS_REVIEW,
            {"jobType": "platform.domain_wide_adoption_readiness_review", "idempotencyKey": "vector-domain-wide-adoption-readiness-v43-0001", "correlationId": "vector-correlation-domain-wide-adoption", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v43-phase-2", "phase": "phase-2", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.domain_graduation_readiness_review"], "adoptionDomains": [{"name": "admin", "decision": "pass", "ownerAck": True, "rollbackReady": True, "openBlockers": 0}, {"name": "scheduling", "decision": "pass", "ownerAck": True, "rollbackReady": True, "openBlockers": 0}], "rolloutEvidence": [{"name": "graduated-pilot-evidence", "decision": "pass", "validated": True}], "ownerApprovals": [{"name": "domain-owner", "decision": "pass", "approved": True}, {"name": "support-owner", "decision": "pass", "approved": True}], "supportReadiness": {"decision": "pass", "ready": True}, "rollbackPlan": {"decision": "pass", "tested": True}, "evidence": {"domainWideAdoption": {"decision": "pass"}}}},
            "platform.domain_wide_adoption_readiness_review.completed",
            ["Phase 2 domain-wide adoption readiness vector with sanitized domains, rollout evidence, support readiness, rollback plan, approvals and evidence only"],
        ),
        (
            JobType.PLATFORM_PHASE_TWO_SUPPORT_TRANSITION_REVIEW,
            {"jobType": "platform.phase_two_support_transition_review", "idempotencyKey": "vector-phase-two-support-transition-v43-0001", "correlationId": "vector-correlation-support-transition", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v43-phase-2", "phase": "phase-2", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.domain_wide_adoption_readiness_review"], "supportQueues": [{"name": "tier-1", "decision": "pass", "ready": True}], "escalationPaths": [{"name": "platform-escalation", "decision": "pass", "documented": True, "ownerAck": True}], "trainingArtifacts": [{"name": "support-training", "decision": "pass", "completed": True}, {"name": "rollback-training", "decision": "pass", "completed": True}], "runbookUpdates": [{"name": "phase2-support-runbook", "decision": "pass", "approved": True, "published": True}], "ownerApprovals": [{"name": "support-owner", "decision": "pass", "approved": True}, {"name": "platform-owner", "decision": "pass", "approved": True}], "evidence": {"supportTransition": {"decision": "pass"}}}},
            "platform.phase_two_support_transition_review.completed",
            ["Phase 2 support transition vector with sanitized queues, escalation paths, training, runbooks, approvals and evidence only"],
        ),
        (
            JobType.PLATFORM_DOMAIN_ADOPTION_STABILIZATION_REVIEW,
            {"jobType": "platform.domain_adoption_stabilization_review", "idempotencyKey": "vector-domain-adoption-stabilization-v44-0001", "correlationId": "vector-correlation-domain-stabilization", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v44-phase-2", "phase": "phase-2", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.domain_wide_adoption_readiness_review"], "stabilizationDomains": [{"name": "admin", "decision": "pass", "stable": True, "ownerAck": True, "openBlockers": 0}, {"name": "scheduling", "decision": "pass", "stable": True, "ownerAck": True, "openBlockers": 0}], "healthSignals": [{"name": "slo", "decision": "pass", "healthy": True}, {"name": "error-budget", "decision": "pass", "healthy": True}], "supportSignals": [{"name": "ticket-load", "decision": "pass", "ticketRate": 0.01, "openEscalations": 0}], "regressionWatch": [{"name": "latency-regression", "decision": "pass", "active": True, "regressionPercent": 1.0}], "approvals": [{"name": "domain-owner", "decision": "pass", "approved": True}, {"name": "support-owner", "decision": "pass", "approved": True}], "evidence": {"domainStabilization": {"decision": "pass"}}}},
            "platform.domain_adoption_stabilization_review.completed",
            ["Phase 2 domain adoption stabilization vector with sanitized domain, health, support, regression-watch and approval metadata only"],
        ),
        (
            JobType.PLATFORM_PHASE_TWO_VALUE_REALIZATION_REVIEW,
            {"jobType": "platform.phase_two_value_realization_review", "idempotencyKey": "vector-phase-two-value-realization-v44-0001", "correlationId": "vector-correlation-value-realization", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v44-phase-2", "phase": "phase-2", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.domain_adoption_stabilization_review"], "valueMetrics": [{"name": "cycle-time", "decision": "pass", "value": 0.18, "target": 0.2, "realized": True}, {"name": "support-deflection", "decision": "pass", "value": 0.12, "target": 0.1, "realized": True}], "benefitBaselines": [{"name": "pilot-baseline", "decision": "pass", "approved": True}], "adoptionSummary": {"decision": "pass", "score": 0.88, "domainsStable": 2}, "executiveReviews": [{"name": "phase2-review", "decision": "pass", "completed": True}], "ownerApprovals": [{"name": "product", "decision": "pass", "approved": True}, {"name": "platform", "decision": "pass", "approved": True}], "evidence": {"valueRealization": {"decision": "pass"}}}},
            "platform.phase_two_value_realization_review.completed",
            ["Phase 2 value realization vector with sanitized value metrics, baselines, adoption summary, reviews and approvals only"],
        ),

        (
            JobType.PLATFORM_PHASE_TWO_CLOSURE_ACCEPTANCE_REVIEW,
            {"jobType": "platform.phase_two_closure_acceptance_review", "idempotencyKey": "vector-phase-two-closure-acceptance-v45-0001", "correlationId": "vector-correlation-phase2-closure", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v45-phase-2", "phase": "phase-2", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.phase_two_value_realization_review"], "closureCriteria": [{"name": "value-realization", "decision": "pass", "met": True}, {"name": "support-transition", "decision": "pass", "met": True}, {"name": "domain-stabilization", "decision": "pass", "met": True}], "acceptanceEvidence": [{"name": "closure-evidence", "decision": "pass", "attached": True, "approved": True}], "openRisks": [{"name": "residual-risk", "decision": "pass", "severity": "low", "closed": True}], "approvals": [{"name": "executive-sponsor", "decision": "pass", "approved": True}, {"name": "platform-owner", "decision": "pass", "approved": True}], "valueRealizationSummary": {"decision": "pass", "score": 0.88}, "supportTransition": {"decision": "pass", "ready": True}, "evidence": {"phase2Closure": {"decision": "pass"}}}},
            "platform.phase_two_closure_acceptance_review.completed",
            ["Phase 2 closure acceptance vector with sanitized criteria, evidence, risks and approvals only"],
        ),
        (
            JobType.PLATFORM_PHASE_THREE_TRANSITION_READINESS_REVIEW,
            {"jobType": "platform.phase_three_transition_readiness_review", "idempotencyKey": "vector-phase-three-transition-readiness-v45-0001", "correlationId": "vector-correlation-phase3-transition", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v45-phase-2", "phase": "phase-2", "nextPhase": "phase-3", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.phase_two_closure_acceptance_review"], "transitionMilestones": [{"name": "phase2-closeout", "decision": "pass", "completed": True}, {"name": "phase3-entry", "decision": "pass", "completed": True}], "dependencyReadiness": [{"name": "contracts", "decision": "pass", "ready": True}, {"name": "support", "decision": "pass", "ready": True}], "ownerHandoffs": [{"name": "platform-owner", "decision": "pass", "accepted": True}, {"name": "domain-owner", "decision": "pass", "accepted": True}], "rolloutGuardrails": [{"name": "slo", "decision": "pass", "enabled": True}, {"name": "rollback", "decision": "pass", "enabled": True}], "entryCriteria": [{"name": "phase3-charter", "decision": "pass", "met": True}], "approvals": [{"name": "program-lead", "decision": "pass", "approved": True}, {"name": "sre", "decision": "pass", "approved": True}], "evidence": {"phase3Transition": {"decision": "pass"}}}},
            "platform.phase_three_transition_readiness_review.completed",
            ["Phase 3 transition readiness vector with sanitized milestones, handoffs, guardrails and approvals only"],
        ),

        (
            JobType.PLATFORM_PHASE_THREE_DOMAIN_WAVE_READINESS_REVIEW,
            {"jobType": "platform.phase_three_domain_wave_readiness_review", "idempotencyKey": "vector-phase-three-domain-wave-readiness-v46-0001", "correlationId": "vector-correlation-phase3-wave", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v46-phase-3", "phase": "phase-3", "waveId": "phase3-wave-1", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.phase_three_transition_readiness_review"], "domains": [{"name": "admin", "decision": "pass", "waveReady": True, "ownerAck": True, "rollbackReady": True}, {"name": "scheduling", "decision": "pass", "waveReady": True, "ownerAck": True, "rollbackReady": True}], "waveCriteria": [{"name": "transition-readiness", "decision": "pass", "met": True}, {"name": "support-coverage", "decision": "pass", "met": True}], "guardrails": [{"name": "slo", "decision": "pass", "enabled": True}, {"name": "rollback", "decision": "pass", "enabled": True}], "supportCoverage": [{"name": "tier-1", "decision": "pass", "ready": True}], "rollbackCoverage": [{"name": "node-fallback", "decision": "pass", "tested": True}], "approvals": [{"name": "platform-lead", "decision": "pass", "approved": True}, {"name": "domain-owner", "decision": "pass", "approved": True}], "evidence": {"phase3Wave": {"decision": "pass"}}}},
            "platform.phase_three_domain_wave_readiness_review.completed",
            ["Phase 3 domain wave readiness vector with sanitized domains, criteria, guardrails, support, rollback and approvals only"],
        ),
        (
            JobType.PLATFORM_PHASE_THREE_OPERATING_MODEL_ALIGNMENT_REVIEW,
            {"jobType": "platform.phase_three_operating_model_alignment_review", "idempotencyKey": "vector-phase-three-operating-model-alignment-v46-0001", "correlationId": "vector-correlation-phase3-operating-model", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v46-phase-3", "phase": "phase-3", "operatingModel": "phase3-scale", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.phase_three_domain_wave_readiness_review"], "ownershipMatrix": [{"name": "platform-owner", "decision": "pass", "accepted": True}, {"name": "domain-owner", "decision": "pass", "accepted": True}], "supportModel": [{"name": "support-coverage", "decision": "pass", "ready": True}], "runbookCoverage": [{"name": "phase3-runbook", "decision": "pass", "published": True, "ownerAck": True}], "metricGovernance": [{"name": "executive-dashboard", "decision": "pass", "enabled": True, "ownerAck": True}], "trainingCoverage": [{"name": "ops-training", "decision": "pass", "completed": True}], "escalationModel": [{"name": "sre-escalation", "decision": "pass", "documented": True, "ownerAck": True}], "approvals": [{"name": "sre", "decision": "pass", "approved": True}, {"name": "program-lead", "decision": "pass", "approved": True}], "evidence": {"operatingModel": {"decision": "pass"}}}},
            "platform.phase_three_operating_model_alignment_review.completed",
            ["Phase 3 operating model alignment vector with sanitized ownership, support, runbook, metrics, training, escalation and approval metadata only"],
        ),
        (
            JobType.PLATFORM_PHASE_THREE_WAVE_EXECUTION_REVIEW,
            {"jobType": "platform.phase_three_wave_execution_review", "idempotencyKey": "vector-phase-three-wave-execution-v47-0001", "correlationId": "vector-correlation-phase3-wave-execution", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v47-phase-3", "phase": "phase-3", "waveId": "phase3-wave-1", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.phase_three_domain_wave_readiness_review"], "waveExecution": [{"name": "admin", "decision": "pass", "executed": True, "completed": True}, {"name": "scheduling", "decision": "pass", "executed": True, "completed": True}], "domainSignals": [{"name": "admin-health", "decision": "pass", "healthy": True}, {"name": "scheduling-health", "decision": "pass", "healthy": True}], "guardrailChecks": [{"name": "slo", "decision": "pass", "passed": True}, {"name": "rollback-trigger", "decision": "pass", "enabled": True}], "rollbackReadiness": [{"name": "node-fallback", "decision": "pass", "ready": True, "tested": True}], "supportIncidents": [{"name": "no-critical-incidents", "decision": "pass", "severity": "low", "closed": True}], "approvals": [{"name": "platform-lead", "decision": "pass", "approved": True}, {"name": "domain-owner", "decision": "pass", "approved": True}], "evidence": {"waveExecution": {"decision": "pass"}}}},
            "platform.phase_three_wave_execution_review.completed",
            ["Phase 3 wave execution vector with sanitized execution, health, guardrail, rollback, incident and approval metadata only"],
        ),
        (
            JobType.PLATFORM_PHASE_THREE_ADOPTION_VALUE_TRACKING_REVIEW,
            {"jobType": "platform.phase_three_adoption_value_tracking_review", "idempotencyKey": "vector-phase-three-adoption-value-tracking-v47-0001", "correlationId": "vector-correlation-phase3-adoption-value", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v47-phase-3", "phase": "phase-3", "waveId": "phase3-wave-1", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.phase_three_wave_execution_review"], "adoptionMetrics": [{"name": "admin-usage", "decision": "pass", "score": 0.82, "met": True}, {"name": "scheduling-usage", "decision": "pass", "score": 0.80, "met": True}], "valueMetrics": [{"name": "cycle-time", "decision": "pass", "score": 0.76, "realized": True}, {"name": "support-deflection", "decision": "pass", "score": 0.78, "realized": True}], "userFeedback": [{"name": "operator-feedback", "decision": "pass", "severity": "low", "addressed": True}], "benefitHypotheses": [{"name": "faster-ops", "decision": "pass", "validated": True}], "ownerReviews": [{"name": "product-owner", "decision": "pass", "completed": True}], "approvals": [{"name": "product", "decision": "pass", "approved": True}, {"name": "platform", "decision": "pass", "approved": True}], "evidence": {"adoptionValue": {"decision": "pass"}}}},
            "platform.phase_three_adoption_value_tracking_review.completed",
            ["Phase 3 adoption value tracking vector with sanitized adoption, value, feedback, hypothesis, owner review and approval metadata only"],
        ),
        (
            JobType.PLATFORM_PHASE_THREE_GAP_REMEDIATION_REVIEW,
            {"jobType": "platform.phase_three_gap_remediation_review", "idempotencyKey": "vector-phase-three-gap-remediation-v48-0001", "correlationId": "vector-correlation-phase3-gap-remediation", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v48-phase-3", "phase": "phase-3", "waveId": "phase3-wave-1", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.phase_three_adoption_value_tracking_review"], "remediationItems": [{"name": "ts-build-certification", "decision": "pass", "ownerAck": True, "closed": True}, {"name": "staging-e2e-smoke", "decision": "pass", "ownerAck": True, "closed": True}], "openRisks": [{"name": "residual-ci-risk", "decision": "pass", "severity": "low", "closed": True}], "riskAcceptances": [{"name": "no-high-residual-risk", "decision": "pass", "accepted": True, "ownerAck": True}], "ownerActions": [{"name": "platform-remediation-owner", "decision": "pass", "completed": True, "ownerAck": True}], "evidence": {"gapRemediation": {"decision": "pass"}}}},
            "platform.phase_three_gap_remediation_review.completed",
            ["Phase 3 gap remediation vector with sanitized remediation items, risk summary, owner actions and evidence only"],
        ),
        (
            JobType.PLATFORM_MIGRATION_STAGE_COMPLETION_READINESS_REVIEW,
            {"jobType": "platform.migration_stage_completion_readiness_review", "idempotencyKey": "vector-migration-stage-completion-readiness-v48-0001", "correlationId": "vector-correlation-stage-completion", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v48-phase-3", "stage": "python-migration-stage", "phase": "phase-3", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.phase_three_gap_remediation_review"], "completionCriteria": [{"name": "all-critical-gates", "decision": "pass", "met": True}, {"name": "domain-readiness", "decision": "pass", "met": True}, {"name": "operator-handoff", "decision": "pass", "met": True}], "validationResults": [{"name": "python-contract-suite", "decision": "pass", "passed": True}, {"name": "staging-e2e", "decision": "pass", "passed": True}], "closureApprovals": [{"name": "program-lead", "decision": "pass", "approved": True}, {"name": "sre", "decision": "pass", "approved": True}], "residualRisks": [{"name": "no-high-residual-risk", "decision": "pass", "severity": "low", "accepted": True}], "finalEvidence": {"stageCompletion": {"decision": "pass"}}}},
            "platform.migration_stage_completion_readiness_review.completed",
            ["Migration stage completion readiness vector with sanitized criteria, validations, approvals, residual risks and final evidence only"],
        ),
        (
            JobType.PLATFORM_PHASE_THREE_REMEDIATION_CLOSURE_REVIEW,
            {"jobType": "platform.phase_three_remediation_closure_review", "idempotencyKey": "vector-phase-three-remediation-closure-v49-0001", "correlationId": "vector-correlation-phase3-remediation-closure", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v49-phase-3", "stage": "python-migration-stage", "phase": "phase-3", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.migration_stage_completion_readiness_review"], "closureItems": [{"name": "critical-gap-closeout", "decision": "pass", "closed": True, "ownerAck": True}, {"name": "ci-staging-certification", "decision": "pass", "closed": True, "ownerAck": True}], "remediationEvidence": [{"name": "remediation-evidence-bundle", "decision": "pass", "validated": True}], "residualRisks": [{"name": "no-open-high-risk", "decision": "pass", "severity": "low", "closed": True}], "acceptanceRecords": [{"name": "risk-acceptance-record", "decision": "pass", "accepted": True, "ownerAck": True}], "ownerApprovals": [{"name": "platform-lead", "decision": "pass", "approved": True}, {"name": "sre-lead", "decision": "pass", "approved": True}], "evidence": {"remediationClosure": {"decision": "pass"}}}},
            "platform.phase_three_remediation_closure_review.completed",
            ["Phase 3 remediation closure vector with sanitized closure items, remediation evidence, residual risks, acceptance records and owner approvals only"],
        ),
        (
            JobType.PLATFORM_EXECUTIVE_OPERATIONAL_HANDOFF_REVIEW,
            {"jobType": "platform.executive_operational_handoff_review", "idempotencyKey": "vector-executive-operational-handoff-v49-0001", "correlationId": "vector-correlation-executive-operational-handoff", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v49-phase-3", "stage": "python-migration-stage", "phase": "phase-3", "domain": "platform", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.phase_three_remediation_closure_review"], "executiveSummary": {"name": "executive-closeout", "decision": "pass", "score": 0.92}, "handoffItems": [{"name": "ownership-model", "decision": "pass", "completed": True, "ownerAck": True}, {"name": "support-transition", "decision": "pass", "completed": True, "ownerAck": True}, {"name": "evidence-archive", "decision": "pass", "completed": True, "ownerAck": True}], "supportModel": [{"name": "sre-support", "decision": "pass", "ready": True, "ownerAck": True}], "kpiBaselines": [{"name": "slo-baseline", "decision": "pass", "baselined": True}, {"name": "adoption-baseline", "decision": "pass", "baselined": True}], "governanceDecisions": [{"name": "stage-exit-governance", "decision": "pass", "approved": True}], "approvals": [{"name": "executive-sponsor", "decision": "pass", "approved": True}, {"name": "platform-lead", "decision": "pass", "approved": True}], "evidence": {"executiveHandoff": {"decision": "pass"}}}},
            "platform.executive_operational_handoff_review.completed",
            ["Executive operational handoff vector with sanitized executive summary, handoff items, support model, KPI baselines, governance decisions and approvals only"],
        ),

        (
            JobType.PLATFORM_GLOBAL_TASK_STATUS_TRACKING_REVIEW,
            {"jobType": "platform.global_task_status_tracking_review", "idempotencyKey": "vector-global-task-status-v52-0001", "correlationId": "vector-correlation-global-task-status", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v52-phase-3", "stage": "python-migration-stage", "phase": "phase-3", "domain": "global", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.executive_operational_handoff_review"], "tasks": [{"name": "build-api-green", "decision": "pass", "status": "done", "ownerAck": True, "evidence": True}, {"name": "python-tests-deps", "decision": "pass", "status": "done", "ownerAck": True, "evidence": True}, {"name": "staging-smoke", "decision": "pass", "status": "done", "ownerAck": True, "evidence": True}], "milestones": [{"name": "phase-3-remediation", "decision": "pass", "completed": True}, {"name": "executive-handoff", "decision": "pass", "completed": True}], "owners": [{"name": "platform-owner", "decision": "pass", "ownerAck": True}, {"name": "program-owner", "decision": "pass", "ownerAck": True}], "blockers": [{"name": "no-open-critical-blocker", "decision": "pass", "severity": "low", "closed": True}], "approvals": [{"name": "platform-lead", "decision": "pass", "approved": True}, {"name": "program-lead", "decision": "pass", "approved": True}], "evidence": {"taskTracker": {"decision": "pass"}}}},
            "platform.global_task_status_tracking_review.completed",
            ["Global task status vector with sanitized task, milestone, blocker, owner, approval and evidence metadata only"],
        ),
        (
            JobType.PLATFORM_PROJECT_STATE_HEALTH_REVIEW,
            {"jobType": "platform.project_state_health_review", "idempotencyKey": "vector-project-state-health-v52-0001", "correlationId": "vector-correlation-project-state-health", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v52-phase-3", "stage": "python-migration-stage", "phase": "phase-3", "domain": "global", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.global_task_status_tracking_review"], "applications": [{"name": "Admin Web Portal", "decision": "pass", "completionPercent": 0.84, "ownerAck": True}, {"name": "Backend API", "decision": "pass", "completionPercent": 0.86, "ownerAck": True}, {"name": "Python Worker", "decision": "pass", "completionPercent": 0.90, "ownerAck": True}], "migrationStatus": {"decision": "pass", "completionPercent": 0.82}, "riskRegister": [{"name": "ci-staging-certification", "decision": "pass", "severity": "medium", "closed": True}], "closureCriteria": [{"name": "api-build", "decision": "pass", "satisfied": True}, {"name": "python-test-environment", "decision": "pass", "satisfied": True}, {"name": "evidence-bundle", "decision": "pass", "satisfied": True}], "approvals": [{"name": "executive-sponsor", "decision": "pass", "approved": True}, {"name": "platform-lead", "decision": "pass", "approved": True}], "evidence": {"projectTracker": {"decision": "pass"}}}},
            "platform.project_state_health_review.completed",
            ["Project state health vector with sanitized application status, migration status, risk, closure and approval metadata only"],
        ),

        (
            JobType.PLATFORM_FINAL_ACCEPTANCE_EVIDENCE_REVIEW,
            {"jobType": "platform.final_acceptance_evidence_review", "idempotencyKey": "vector-final-acceptance-evidence-v53-0001", "correlationId": "vector-correlation-final-acceptance", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v53-phase-3", "stage": "python-migration-stage", "phase": "phase-3", "domain": "global", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.project_state_health_review"], "acceptanceCriteria": [{"name": "api-build-green", "decision": "pass", "met": True}, {"name": "python-contract-tests", "decision": "pass", "met": True}, {"name": "evidence-bundle", "decision": "pass", "met": True}], "validationEvidence": [{"name": "ci-build", "decision": "pass", "validated": True}, {"name": "staging-smoke", "decision": "pass", "validated": True}], "testResults": [{"name": "api-build", "decision": "pass", "passed": True}, {"name": "worker-contracts", "decision": "pass", "passed": True}], "residualRisks": [{"name": "no-open-high-risk", "decision": "pass", "severity": "low", "accepted": True, "closed": True}], "signoffs": [{"name": "qa-lead", "decision": "pass", "approved": True}, {"name": "platform-lead", "decision": "pass", "approved": True}], "evidence": {"finalAcceptance": {"decision": "pass"}}}},
            "platform.final_acceptance_evidence_review.completed",
            ["Final acceptance evidence vector with sanitized criteria, validation evidence, test results, residual risks and signoffs only"],
        ),
        (
            JobType.PLATFORM_STAGE_EXIT_READINESS_REVIEW,
            {"jobType": "platform.stage_exit_readiness_review", "idempotencyKey": "vector-stage-exit-readiness-v53-0001", "correlationId": "vector-correlation-stage-exit", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v53-phase-3", "stage": "python-migration-stage", "phase": "phase-3", "targetState": "stage-complete", "domain": "global", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.final_acceptance_evidence_review"], "exitCriteria": [{"name": "final-acceptance", "decision": "pass", "satisfied": True}, {"name": "support-transition", "decision": "pass", "satisfied": True}, {"name": "evidence-archive", "decision": "pass", "satisfied": True}], "operationalHandoff": [{"name": "sre-handoff", "decision": "pass", "completed": True, "ownerAck": True}, {"name": "product-handoff", "decision": "pass", "completed": True, "ownerAck": True}], "evidenceBundle": {"name": "stage-exit-evidence", "decision": "pass", "archived": True, "checksumVerified": True}, "rollbackPlan": {"name": "node-fallback", "decision": "pass", "tested": True}, "supportReadiness": [{"name": "oncall", "decision": "pass", "ready": True}, {"name": "runbooks", "decision": "pass", "ready": True}], "approvals": [{"name": "executive-sponsor", "decision": "pass", "approved": True}, {"name": "sre-lead", "decision": "pass", "approved": True}], "evidence": {"stageExit": {"decision": "pass"}}}},
            "platform.stage_exit_readiness_review.completed",
            ["Stage exit readiness vector with sanitized exit criteria, handoff, evidence bundle, rollback plan, support readiness and approvals only"],
        ),

        (
            JobType.PLATFORM_STAGE_CLOSURE_CERTIFICATION_REVIEW,
            {"jobType": "platform.stage_closure_certification_review", "idempotencyKey": "vector-stage-closure-certification-v54-0001", "correlationId": "vector-correlation-stage-closure", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v54-stage-closure", "stage": "python-migration-stage", "phase": "phase-3", "domain": "global", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.stage_exit_readiness_review"], "certificationItems": [{"name": "api-build-green", "decision": "pass", "certified": True}, {"name": "worker-tests-green", "decision": "pass", "certified": True}, {"name": "evidence-archive", "decision": "pass", "certified": True}], "finalEvidence": [{"name": "acceptance-report", "decision": "pass", "validated": True}, {"name": "stage-exit-evidence", "decision": "pass", "validated": True}], "signoffs": [{"name": "executive-sponsor", "decision": "pass", "approved": True}, {"name": "qa-lead", "decision": "pass", "approved": True}], "releaseArtifacts": {"name": "v54-release-packet", "decision": "pass", "archived": True, "checksumVerified": True}, "residualRisks": [{"name": "no-high-risk", "decision": "pass", "severity": "low", "accepted": True, "closed": True}], "evidence": {"stageClosureCertification": {"decision": "pass"}}}},
            "platform.stage_closure_certification_review.completed",
            ["Stage closure certification vector with sanitized certification items, final evidence, signoffs, release artifacts and residual risks only"],
        ),
        (
            JobType.PLATFORM_POST_CLOSURE_OPERATIONAL_TRANSITION_REVIEW,
            {"jobType": "platform.post_closure_operational_transition_review", "idempotencyKey": "vector-post-closure-operational-transition-v54-0001", "correlationId": "vector-correlation-post-closure-transition", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v54-stage-closure", "stage": "post-closure", "phase": "phase-3", "domain": "global", "operatingMode": "steady-state-transition", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.stage_closure_certification_review"], "transitionItems": [{"name": "support-handoff", "decision": "pass", "completed": True, "ownerAck": True}, {"name": "ownership-registry", "decision": "pass", "completed": True, "ownerAck": True}], "monitoringPlan": {"name": "post-closure-monitoring", "decision": "pass", "ready": True}, "ownershipHandoff": {"name": "platform-sre-product", "decision": "pass", "completed": True, "ownerAck": True}, "supportReadiness": [{"name": "oncall", "decision": "pass", "ready": True}, {"name": "runbooks", "decision": "pass", "ready": True}], "kpiBaselines": [{"name": "availability", "decision": "pass", "baselined": True}, {"name": "adoption", "decision": "pass", "baselined": True}], "approvals": [{"name": "sre-lead", "decision": "pass", "approved": True}, {"name": "product-ops", "decision": "pass", "approved": True}], "evidence": {"postClosureTransition": {"decision": "pass"}}}},
            "platform.post_closure_operational_transition_review.completed",
            ["Post-closure operational transition vector with sanitized transition items, monitoring plan, ownership handoff, support readiness, KPI baselines and approvals only"],
        ),
        (
            JobType.PLATFORM_POST_CLOSURE_MONITORING_REVIEW,
            {"jobType": "platform.post_closure_monitoring_review", "idempotencyKey": "vector-post-closure-monitoring-v55-0001", "correlationId": "vector-correlation-post-closure-monitoring", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v55-post-closure", "stage": "post-closure", "phase": "phase-3", "domain": "global", "operatingMode": "post-closure-monitoring", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.post_closure_operational_transition_review"], "monitoringWindows": [{"name": "day-1", "decision": "pass", "completed": True}, {"name": "day-3", "decision": "pass", "completed": True}], "sloSignals": [{"name": "availability", "decision": "pass", "met": True, "breaches": 0}, {"name": "latency", "decision": "pass", "met": True, "breaches": 0}], "incidentSignals": [{"name": "support-sev1", "decision": "pass", "openIncidents": 0}], "adoptionSignals": [{"name": "operator-usage", "decision": "pass", "score": 0.92}], "regressionChecks": [{"name": "api-regression", "decision": "pass", "passed": True}, {"name": "worker-regression", "decision": "pass", "passed": True}], "approvals": [{"name": "sre-lead", "decision": "pass", "approved": True}, {"name": "product-ops", "decision": "pass", "approved": True}], "evidence": {"postClosureMonitoring": {"decision": "pass"}}}},
            "platform.post_closure_monitoring_review.completed",
            ["Post-closure monitoring vector with sanitized monitoring windows, SLO signals, incident signals, regression checks, approvals and evidence only"],
        ),
        (
            JobType.PLATFORM_STEADY_STATE_TRANSFER_VALIDATION_REVIEW,
            {"jobType": "platform.steady_state_transfer_validation_review", "idempotencyKey": "vector-steady-state-transfer-validation-v55-0001", "correlationId": "vector-correlation-steady-state-transfer", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v55-steady-state", "stage": "steady-state-transfer", "phase": "phase-3", "targetState": "stable-operations", "domain": "global", "operatingMode": "steady-state", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.post_closure_monitoring_review"], "transferItems": [{"name": "ops-ownership", "decision": "pass", "completed": True, "ownerAck": True}, {"name": "support-transition", "decision": "pass", "completed": True, "ownerAck": True}], "ownershipMatrix": [{"name": "platform-sre", "decision": "pass", "ownerAck": True}, {"name": "product-ops", "decision": "pass", "ownerAck": True}], "runbookCoverage": [{"name": "incident-runbook", "decision": "pass", "published": True}, {"name": "rollback-runbook", "decision": "pass", "published": True}], "monitoringReadiness": [{"name": "dashboards", "decision": "pass", "ready": True}, {"name": "alerts", "decision": "pass", "ready": True}], "knowledgeTransfer": [{"name": "ops-training", "decision": "pass", "completed": True}], "supportModel": {"name": "steady-state-support", "decision": "pass", "ready": True, "ownerAck": True}, "approvals": [{"name": "sre-lead", "decision": "pass", "approved": True}, {"name": "support-lead", "decision": "pass", "approved": True}], "evidence": {"steadyStateTransfer": {"decision": "pass"}}}},
            "platform.steady_state_transfer_validation_review.completed",
            ["Steady-state transfer validation vector with sanitized transfer items, ownership, runbook, monitoring, support, knowledge-transfer and approval metadata only"],
        ),
        (
            JobType.PLATFORM_STEADY_STATE_OPERATIONAL_ASSURANCE_REVIEW,
            {"jobType": "platform.steady_state_operational_assurance_review", "idempotencyKey": "vector-steady-state-operational-assurance-v56-0001", "correlationId": "vector-correlation-steady-state-assurance", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v56-operational-assurance", "stage": "steady-state-operations", "phase": "post-phase-3", "targetState": "stable-operations", "domain": "global", "operatingMode": "steady-state", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.steady_state_transfer_validation_review"], "operationalMetrics": [{"name": "availability", "decision": "pass", "met": True, "value": 0.999}, {"name": "latency", "decision": "pass", "met": True, "p95Ms": 180}], "sloHealth": [{"name": "availability-slo", "decision": "pass", "met": True, "breaches": 0}, {"name": "latency-slo", "decision": "pass", "met": True, "breaches": 0}], "incidentTrends": [{"name": "sev1", "decision": "pass", "openIncidents": 0, "severity": "sev1"}], "supportQueues": [{"name": "operator-support", "decision": "pass", "overdueItems": 0}], "runbookAudits": [{"name": "incident-runbook", "decision": "pass", "fresh": True}], "ownershipReviews": [{"name": "sre-ownership", "decision": "pass", "ownerAck": True}], "approvals": [{"name": "sre-lead", "decision": "pass", "approved": True}, {"name": "support-lead", "decision": "pass", "approved": True}], "evidence": {"steadyStateOperationalAssurance": {"decision": "pass"}}}},
            "platform.steady_state_operational_assurance_review.completed",
            ["Steady-state operational assurance vector with sanitized operational metrics, SLO health, incident trends, support queues, runbook audits, ownership reviews, approvals and evidence only"],
        ),
        (
            JobType.PLATFORM_CONTINUOUS_IMPROVEMENT_BACKLOG_REVIEW,
            {"jobType": "platform.continuous_improvement_backlog_review", "idempotencyKey": "vector-continuous-improvement-backlog-v56-0001", "correlationId": "vector-correlation-continuous-improvement", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v56-continuous-improvement", "stage": "continuous-improvement", "phase": "post-phase-3", "domain": "global", "operatingMode": "steady-state-improvement", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.steady_state_operational_assurance_review"], "improvementItems": [{"name": "dashboard-refinement", "decision": "pass", "prioritized": True}, {"name": "support-workflow-optimization", "decision": "pass", "prioritized": True}], "valueHypotheses": [{"name": "reduce-manual-review", "decision": "pass", "validated": True}], "technicalDebtItems": [{"name": "contract-fixture-cleanup", "decision": "pass", "accepted": True}], "riskItems": [{"name": "no-high-open-risk", "decision": "pass", "severity": "low", "closed": True}], "ownerCommitments": [{"name": "product-ops-owner", "decision": "pass", "ownerAck": True}], "governanceReviews": [{"name": "monthly-review", "decision": "pass", "approved": True}], "approvals": [{"name": "delivery-governance", "decision": "pass", "approved": True}], "evidence": {"continuousImprovementBacklog": {"decision": "pass"}}}},
            "platform.continuous_improvement_backlog_review.completed",
            ["Continuous-improvement backlog vector with sanitized improvement items, value hypotheses, technical debt, risks, owner commitments, governance reviews, approvals and evidence only"],
        ),

        (
            JobType.PLATFORM_STABLE_OPERATIONS_OPTIMIZATION_REVIEW,
            {"jobType": "platform.stable_operations_optimization_review", "idempotencyKey": "vector-stable-operations-optimization-v57-0001", "correlationId": "vector-correlation-stable-operations-optimization", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v57-stable-ops-optimization", "stage": "stable-operations-optimization", "phase": "post-phase-3", "domain": "global", "operatingMode": "steady-state-optimization", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.continuous_improvement_backlog_review"], "optimizationMetrics": [{"name": "latency-headroom", "decision": "pass", "met": True, "value": 0.82}, {"name": "manual-touch-reduction", "decision": "pass", "met": True, "value": 0.35}], "costSignals": [{"name": "worker-cost-baseline", "decision": "pass", "healthy": True}], "reliabilitySignals": [{"name": "queue-retry-rate", "decision": "pass", "healthy": True}], "automationOpportunities": [{"name": "evidence-pack-refresh", "decision": "pass", "ready": True}], "debtItems": [{"name": "fixture-normalization", "decision": "pass", "severity": "low", "accepted": True}], "guardrailReviews": [{"name": "no-slo-regression", "decision": "pass", "approved": True}], "approvals": [{"name": "sre-lead", "decision": "pass", "approved": True}], "evidence": {"stableOperationsOptimization": {"decision": "pass"}}}},
            "platform.stable_operations_optimization_review.completed",
            ["Stable-operations optimization vector with sanitized optimization metrics, cost/reliability signals, automation opportunities, debt, guardrails, approvals and evidence only"],
        ),
        (
            JobType.PLATFORM_RECURRING_MAINTENANCE_CYCLE_READINESS_REVIEW,
            {"jobType": "platform.recurring_maintenance_cycle_readiness_review", "idempotencyKey": "vector-recurring-maintenance-cycle-readiness-v57-0001", "correlationId": "vector-correlation-recurring-maintenance", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v57-recurring-maintenance", "stage": "recurring-maintenance", "phase": "steady-state", "targetCycle": "monthly-operations-maintenance", "domain": "global", "operatingMode": "recurring-maintenance", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.stable_operations_optimization_review"], "maintenanceWindows": [{"name": "monthly-window", "decision": "pass", "approved": True}], "patchCadence": {"name": "monthly-patch-cadence", "decision": "pass", "approved": True}, "dependencyUpdatePlan": {"name": "dependency-update-plan", "decision": "pass", "ready": True}, "backupValidation": {"name": "backup-validation", "decision": "pass", "validated": True}, "runbookSchedule": [{"name": "monthly-runbook-review", "decision": "pass", "scheduled": True}], "ownerRoster": [{"name": "platform-sre", "decision": "pass", "ownerAck": True}], "approvals": [{"name": "delivery-governance", "decision": "pass", "approved": True}], "evidence": {"recurringMaintenanceCycleReadiness": {"decision": "pass"}}}},
            "platform.recurring_maintenance_cycle_readiness_review.completed",
            ["Recurring-maintenance readiness vector with sanitized maintenance windows, patch cadence, dependency plan, backup validation, runbook schedule, owners, approvals and evidence only"],
        ),
        (
            JobType.PLATFORM_MAINTENANCE_CYCLE_EXECUTION_REVIEW,
            {"jobType": "platform.maintenance_cycle_execution_review", "idempotencyKey": "vector-maintenance-cycle-execution-v58-0001", "correlationId": "vector-correlation-maintenance-cycle-execution", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v58-maintenance-cycle-execution", "stage": "maintenance-cycle-execution", "phase": "steady-state", "cycleId": "monthly-operations-maintenance", "domain": "global", "operatingMode": "governed-maintenance-execution", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.recurring_maintenance_cycle_readiness_review"], "executionItems": [{"name": "monthly-maintenance-window", "decision": "pass", "completed": True}, {"name": "service-health-baseline", "decision": "pass", "completed": True}], "patchResults": [{"name": "security-patch-bundle", "decision": "pass", "verified": True}], "dependencyResults": [{"name": "python-worker-dependencies", "decision": "pass", "verified": True}], "backupResults": [{"name": "pre-maintenance-backup", "decision": "pass", "validated": True}], "validationResults": [{"name": "post-maintenance-smoke", "decision": "pass", "validated": True}, {"name": "contract-regression", "decision": "pass", "validated": True}], "rollbackReadiness": {"name": "rollback-playbook", "decision": "pass", "ready": True}, "communications": [{"name": "operator-summary", "decision": "pass", "sent": True}], "approvals": [{"name": "sre-lead", "decision": "pass", "approved": True}], "evidence": {"maintenanceCycleExecution": {"decision": "pass"}}}},
            "platform.maintenance_cycle_execution_review.completed",
            ["Maintenance-cycle execution vector with sanitized execution, patch, dependency, backup, validation, rollback, communication, approvals and evidence only"],
        ),
        (
            JobType.PLATFORM_LONG_TERM_OPERABILITY_SUSTAINABILITY_REVIEW,
            {"jobType": "platform.long_term_operability_sustainability_review", "idempotencyKey": "vector-long-term-operability-sustainability-v58-0001", "correlationId": "vector-correlation-long-term-sustainability", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v58-long-term-sustainability", "stage": "long-term-operability-sustainability", "phase": "steady-state", "horizon": "quarterly-sustainability", "domain": "global", "operatingMode": "long-term-sustainability", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.maintenance_cycle_execution_review"], "sustainabilityMetrics": [{"name": "slo-sustainability", "decision": "pass", "healthy": True}, {"name": "support-load-trend", "decision": "pass", "stable": True}], "ownershipSignals": [{"name": "platform-sre-owner", "decision": "pass", "ownerAck": True}], "knowledgeBaseReviews": [{"name": "operator-runbook-index", "decision": "pass", "current": True}], "dependencyLifecycle": {"name": "dependency-lifecycle", "decision": "pass", "ready": True}, "budgetSignals": [{"name": "worker-cost-envelope", "decision": "pass", "healthy": True}], "riskAcceptances": [{"name": "no-high-risk", "decision": "pass", "severity": "low", "accepted": True}], "improvementCadence": {"name": "quarterly-improvement-review", "decision": "pass", "ready": True}, "approvals": [{"name": "delivery-governance", "decision": "pass", "approved": True}], "evidence": {"longTermOperabilitySustainability": {"decision": "pass"}}}},
            "platform.long_term_operability_sustainability_review.completed",
            ["Long-term operability sustainability vector with sanitized metrics, ownership, knowledge, lifecycle, budget, risk, cadence, approvals and evidence only"],
        ),

        (
            JobType.PLATFORM_RECURRING_OPERATIONAL_MATURITY_AUDIT_REVIEW,
            {"jobType": "platform.recurring_operational_maturity_audit_review", "idempotencyKey": "vector-recurring-operational-maturity-audit-v59-0001", "correlationId": "vector-correlation-operational-maturity-audit", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v59-operational-maturity-audit", "stage": "recurring-operational-maturity-audit", "phase": "steady-state", "auditCycle": "quarterly-operations-maturity", "domain": "global", "operatingMode": "recurring-maturity-governance", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.long_term_operability_sustainability_review"], "maturityDimensions": [{"name": "incident-management", "decision": "pass", "score": 0.91, "met": True}, {"name": "change-governance", "decision": "pass", "score": 0.88, "met": True}], "controlChecks": [{"name": "runbook-control", "decision": "pass", "passed": True}, {"name": "access-review-control", "decision": "pass", "passed": True}], "incidentLearnings": [{"name": "no-repeat-sev1", "decision": "pass", "closed": True}], "supportSignals": [{"name": "support-backlog-health", "decision": "pass", "healthy": True}], "operatorEvidence": [{"name": "quarterly-evidence-pack", "decision": "pass", "complete": True}], "risks": [{"name": "no-high-open-risk", "decision": "pass", "severity": "low", "accepted": True}], "approvals": [{"name": "sre-lead", "decision": "pass", "approved": True}], "evidence": {"recurringOperationalMaturityAudit": {"decision": "pass"}}}},
            "platform.recurring_operational_maturity_audit_review.completed",
            ["Recurring operational maturity audit vector with sanitized maturity dimensions, controls, incident learnings, support signals, operator evidence, risks, approvals and evidence only"],
        ),
        (
            JobType.PLATFORM_STABLE_STATE_CONTINUITY_CONTROL_REVIEW,
            {"jobType": "platform.stable_state_continuity_control_review", "idempotencyKey": "vector-stable-state-continuity-control-v59-0001", "correlationId": "vector-correlation-stable-state-continuity", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v59-stable-state-continuity", "stage": "stable-state-continuity-control", "phase": "steady-state", "horizon": "quarterly-continuity", "domain": "global", "operatingMode": "stable-state-continuity", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.recurring_operational_maturity_audit_review"], "continuityControls": [{"name": "service-continuity-control", "decision": "pass", "passed": True}, {"name": "operator-coverage-control", "decision": "pass", "passed": True}], "drSignals": [{"name": "restore-drill-signal", "decision": "pass", "validated": True}], "dependencyContinuity": [{"name": "critical-provider-continuity", "decision": "pass", "healthy": True}], "operationalFallbacks": [{"name": "manual-processing-fallback", "decision": "pass", "ready": True}], "communicationChecks": [{"name": "stakeholder-communication-tree", "decision": "pass", "approved": True}], "risks": [{"name": "no-open-continuity-risk", "decision": "pass", "severity": "low", "accepted": True}], "approvals": [{"name": "business-continuity-owner", "decision": "pass", "approved": True}], "evidence": {"stableStateContinuityControl": {"decision": "pass"}}}},
            "platform.stable_state_continuity_control_review.completed",
            ["Stable-state continuity control vector with sanitized controls, DR signals, dependencies, fallbacks, communications, risks, approvals and evidence only"],
        ),
        (
            JobType.PLATFORM_OPERATIONAL_RESILIENCE_GOVERNANCE_REVIEW,
            {"jobType": "platform.operational_resilience_governance_review", "idempotencyKey": "vector-operational-resilience-governance-v60-0001", "correlationId": "vector-correlation-operational-resilience", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v60-operational-resilience", "stage": "operational-resilience-governance", "phase": "steady-state", "governanceCycle": "quarterly-resilience-governance", "domain": "global", "operatingMode": "resilience-governance", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.stable_state_continuity_control_review"], "resilienceControls": [{"name": "multi-zone-readiness", "decision": "pass", "passed": True}, {"name": "queue-drain-control", "decision": "pass", "healthy": True}], "chaosDrills": [{"name": "worker-restart-drill", "decision": "pass", "completed": True}], "failoverReadiness": [{"name": "primary-worker-failover", "decision": "pass", "ready": True}], "serviceOwnership": [{"name": "sre-service-owner", "decision": "pass", "ownerAck": True}], "riskItems": [{"name": "no-high-resilience-risk", "decision": "pass", "severity": "low", "accepted": True}], "governanceReviews": [{"name": "quarterly-resilience-board", "decision": "pass", "approved": True}], "approvals": [{"name": "business-continuity-owner", "decision": "pass", "approved": True}], "evidence": {"operationalResilienceGovernance": {"decision": "pass"}}}},
            "platform.operational_resilience_governance_review.completed",
            ["Operational resilience governance vector with sanitized controls, drills, failover readiness, service ownership, risks, governance reviews, approvals and evidence only"],
        ),
        (
            JobType.PLATFORM_RECOVERY_CAPABILITY_VALIDATION_REVIEW,
            {"jobType": "platform.recovery_capability_validation_review", "idempotencyKey": "vector-recovery-capability-validation-v60-0001", "correlationId": "vector-correlation-recovery-capability", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v60-recovery-capability", "stage": "recovery-capability-validation", "phase": "steady-state", "validationWindow": "quarterly-recovery-validation", "domain": "global", "operatingMode": "recovery-capability-validation", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.operational_resilience_governance_review"], "restoreTests": [{"name": "artifact-store-restore", "decision": "pass", "validated": True}], "rtoRpoChecks": [{"name": "worker-rto-rpo", "decision": "pass", "withinTarget": True}], "backupIntegrity": [{"name": "backup-sha-validation", "decision": "pass", "verified": True}], "incidentReplayResults": [{"name": "sev2-replay", "decision": "pass", "completed": True}], "dependencyRecovery": [{"name": "redis-recovery", "decision": "pass", "ready": True}], "communicationValidation": [{"name": "stakeholder-notification-tree", "decision": "pass", "approved": True}], "risks": [{"name": "no-high-recovery-risk", "decision": "pass", "severity": "low", "accepted": True}], "approvals": [{"name": "dr-owner", "decision": "pass", "approved": True}], "evidence": {"recoveryCapabilityValidation": {"decision": "pass"}}}},
            "platform.recovery_capability_validation_review.completed",
            ["Recovery capability validation vector with sanitized restore, RTO/RPO, backup, incident replay, dependency recovery, communications, risks, approvals and evidence only"],
        ),
        (
            JobType.PLATFORM_OPERATIONAL_RESILIENCE_OPTIMIZATION_REVIEW,
            {"jobType": "platform.operational_resilience_optimization_review", "idempotencyKey": "vector-operational-resilience-optimization-v61-0001", "correlationId": "vector-correlation-resilience-optimization", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v61-resilience-optimization", "stage": "operational-resilience-optimization", "phase": "steady-state", "optimizationCycle": "quarterly-resilience-optimization", "domain": "global", "operatingMode": "resilience-optimization", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.recovery_capability_validation_review"], "resilienceMetrics": [{"name": "queue-recovery-latency", "decision": "pass", "withinTarget": True}, {"name": "failover-error-rate", "decision": "pass", "healthy": True}], "optimizationActions": [{"name": "alert-noise-reduction", "decision": "pass", "approved": True}], "automationCandidates": [{"name": "continuity-drill-reminder", "decision": "pass", "ready": True}], "incidentPatterns": [{"name": "no-recurring-sev2-pattern", "decision": "pass", "reviewed": True}], "capacitySignals": [{"name": "worker-headroom", "decision": "pass", "withinTarget": True}], "riskItems": [{"name": "no-high-optimization-risk", "decision": "pass", "severity": "low", "accepted": True}], "approvals": [{"name": "resilience-governance-owner", "decision": "pass", "approved": True}], "evidence": {"operationalResilienceOptimization": {"decision": "pass"}}}},
            "platform.operational_resilience_optimization_review.completed",
            ["Operational resilience optimization vector with sanitized metrics, actions, automation candidates, patterns, capacity, risks, approvals and evidence only"],
        ),
        (
            JobType.PLATFORM_AUTOMATED_CONTINUITY_PREPAREDNESS_REVIEW,
            {"jobType": "platform.automated_continuity_preparedness_review", "idempotencyKey": "vector-automated-continuity-preparedness-v61-0001", "correlationId": "vector-correlation-automated-continuity", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v61-automated-continuity", "stage": "automated-continuity-preparedness", "phase": "steady-state", "preparednessWindow": "quarterly-continuity-automation", "domain": "global", "operatingMode": "automated-continuity-preparedness", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.operational_resilience_optimization_review"], "automationControls": [{"name": "scheduled-drill-control", "decision": "pass", "validated": True}, {"name": "escalation-auto-check", "decision": "pass", "ready": True}], "continuityRunbooks": [{"name": "continuity-automation-runbook", "decision": "pass", "current": True}], "schedulerReadiness": [{"name": "scheduler-dry-run", "decision": "pass", "ready": True}], "dependencyHooks": [{"name": "redis-health-hook", "decision": "pass", "validated": True}], "notificationTemplates": [{"name": "continuity-notification-template", "decision": "pass", "approved": True}], "risks": [{"name": "no-high-automation-risk", "decision": "pass", "severity": "low", "accepted": True}], "approvals": [{"name": "business-continuity-owner", "decision": "pass", "approved": True}], "evidence": {"automatedContinuityPreparedness": {"decision": "pass"}}}},
            "platform.automated_continuity_preparedness_review.completed",
            ["Automated continuity preparedness vector with sanitized controls, runbooks, scheduler, hooks, templates, risks, approvals and evidence only"],
        ),
        (
            JobType.PLATFORM_AUTOMATED_CONTINUITY_EXECUTION_VALIDATION_REVIEW,
            {"jobType": "platform.automated_continuity_execution_validation_review", "idempotencyKey": "vector-automated-continuity-execution-validation-v62-0001", "correlationId": "vector-correlation-continuity-execution", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v62-continuity-execution", "stage": "automated-continuity-execution-validation", "phase": "steady-state", "executionWindow": "quarterly-continuity-execution", "domain": "global", "operatingMode": "automated-continuity-execution-validation", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.automated_continuity_preparedness_review"], "executionRuns": [{"name": "continuity-scheduler-dry-run", "decision": "pass", "completed": True}], "schedulerEvents": [{"name": "scheduled-drill-event", "decision": "pass", "validated": True}], "dependencyHooks": [{"name": "redis-health-hook", "decision": "pass", "healthy": True}], "notificationDeliveries": [{"name": "ops-template-dry-run", "decision": "pass", "validated": True}], "runbookCheckpoints": [{"name": "continuity-runbook-checkpoint", "decision": "pass", "completed": True}], "riskItems": [{"name": "no-high-execution-risk", "decision": "pass", "severity": "low", "accepted": True}], "approvals": [{"name": "business-continuity-owner", "decision": "pass", "approved": True}], "evidence": {"automatedContinuityExecutionValidation": {"decision": "pass"}}}},
            "platform.automated_continuity_execution_validation_review.completed",
            ["Automated continuity execution validation vector with sanitized execution runs, scheduler events, hooks, notification checks, runbook checkpoints, risks, approvals and evidence only"],
        ),
        (
            JobType.PLATFORM_OPERATIONAL_RESILIENCE_FEEDBACK_LOOP_REVIEW,
            {"jobType": "platform.operational_resilience_feedback_loop_review", "idempotencyKey": "vector-operational-resilience-feedback-loop-v62-0001", "correlationId": "vector-correlation-resilience-feedback", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v62-resilience-feedback", "stage": "operational-resilience-feedback-loop", "phase": "steady-state", "feedbackCycle": "quarterly-resilience-feedback", "domain": "global", "operatingMode": "operational-resilience-feedback-loop", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.automated_continuity_execution_validation_review"], "feedbackSignals": [{"name": "post-drill-feedback", "decision": "pass", "reviewed": True}, {"name": "slo-feedback-signal", "decision": "pass", "healthy": True}], "remediationItems": [{"name": "documentation-follow-up", "decision": "pass", "ownerAck": True}], "learningItems": [{"name": "runbook-learning", "decision": "pass", "completed": True}], "metricAdjustments": [{"name": "continuity-slo-threshold-review", "decision": "pass", "approved": True}], "ownerResponses": [{"name": "sre-owner-response", "decision": "pass", "approved": True}], "risks": [{"name": "no-high-feedback-risk", "decision": "pass", "severity": "low", "accepted": True}], "approvals": [{"name": "resilience-governance-owner", "decision": "pass", "approved": True}], "evidence": {"operationalResilienceFeedbackLoop": {"decision": "pass"}}}},
            "platform.operational_resilience_feedback_loop_review.completed",
            ["Operational resilience feedback-loop vector with sanitized feedback, remediation, learning, metrics, owner responses, risks, approvals and evidence only"],
        ),
        (
            JobType.PLATFORM_FINAL_CLOSURE_EVIDENCE_PACKAGE_REVIEW,
            {"jobType": "platform.final_closure_evidence_package_review", "idempotencyKey": "vector-final-closure-evidence-package-v63-0001", "correlationId": "vector-correlation-final-closure-evidence", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v63-final-closure-evidence", "stage": "final-closure-evidence-package", "phase": "closure", "closureWindow": "pre-handover-final-evidence", "domain": "global", "operatingMode": "final-closure-evidence-package", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.operational_resilience_feedback_loop_review"], "versionSummary": [{"name": "versions-v1-to-v62", "decision": "pass", "completed": True}, {"name": "v63-evidence-package", "decision": "pass", "completed": True}], "validationResults": [{"name": "python-worker-contract-tests", "decision": "pass", "passed": True}, {"name": "zip-integrity", "decision": "pass", "verified": True}], "contractEvidence": [{"name": "contract-vectors-115-plus-v63", "decision": "pass", "validated": True}], "apiRouteEvidence": [{"name": "hybrid-python-routes", "decision": "pass", "validated": True}], "workerEvidence": [{"name": "python-worker-v63", "decision": "pass", "healthy": True}], "residualRisks": [{"name": "npm-build-env-validation", "decision": "pass", "severity": "medium", "accepted": True}], "signoffs": [{"name": "delivery-governance", "decision": "pass", "approved": True}, {"name": "operations-owner", "decision": "pass", "approved": True}], "evidence": {"finalClosureEvidencePackage": {"decision": "pass"}}}},
            "platform.final_closure_evidence_package_review.completed",
            ["Final closure evidence package vector with sanitized versions, validations, contracts, routes, worker evidence, risks, signoffs and evidence only"],
        ),
        (
            JobType.PLATFORM_GLOBAL_IMPLEMENTATION_COMPLETION_CHECKLIST_REVIEW,
            {"jobType": "platform.global_implementation_completion_checklist_review", "idempotencyKey": "vector-global-implementation-completion-checklist-v63-0001", "correlationId": "vector-correlation-global-completion-checklist", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v63-completion-checklist", "stage": "global-implementation-completion-checklist", "phase": "closure", "checklistScope": "option-b-python-progressive", "domain": "global", "operatingMode": "completion-checklist-review", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.final_closure_evidence_package_review"], "functionalAreas": [{"name": "python-worker", "decision": "pass", "completionPercent": 100}, {"name": "node-bridge", "decision": "pass", "completionPercent": 100}, {"name": "contracts", "decision": "pass", "completionPercent": 100}], "implementationTasks": [{"name": "contracts", "decision": "pass", "completed": True}, {"name": "processors", "decision": "pass", "completed": True}, {"name": "policies", "decision": "pass", "completed": True}, {"name": "routes", "decision": "pass", "completed": True}, {"name": "docs", "decision": "pass", "completed": True}], "validationTasks": [{"name": "compileall", "decision": "pass", "passed": True}, {"name": "contract-tests", "decision": "pass", "passed": True}, {"name": "zip-test", "decision": "pass", "passed": True}], "handoverTasks": [{"name": "evidence-package-ready", "decision": "pass", "completed": True}], "deferredItems": [{"name": "npm-build-in-target-env", "decision": "pass", "severity": "medium", "accepted": True}], "approvals": [{"name": "delivery-governance", "decision": "pass", "approved": True}], "evidence": {"globalImplementationCompletionChecklist": {"decision": "pass"}}}},
            "platform.global_implementation_completion_checklist_review.completed",
            ["Global implementation completion checklist vector with sanitized functional areas, tasks, validation, handover, deferred items, approvals and evidence only"],
        ),

        (
            JobType.PLATFORM_FINAL_OPERATIONAL_HANDOVER_REVIEW,
            {"jobType": "platform.final_operational_handover_review", "idempotencyKey": "vector-final-operational-handover-v64-0001", "correlationId": "vector-correlation-final-operational-handover", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v64-final-handover", "stage": "final-operational-handover", "phase": "closure", "handoverScope": "option-b-python-progressive", "domain": "global", "operatingMode": "final-operational-handover", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.global_implementation_completion_checklist_review"], "runbooks": [{"name": "final-runbook", "decision": "pass", "current": True}, {"name": "rollback-runbook", "decision": "pass", "approved": True}], "ownerAssignments": [{"name": "sre-owner", "decision": "pass", "assigned": True}, {"name": "support-owner", "decision": "pass", "assigned": True}], "supportModel": [{"name": "steady-state-support-model", "decision": "pass", "approved": True}], "monitoringControls": [{"name": "post-closure-monitoring", "decision": "pass", "healthy": True}], "escalationPaths": [{"name": "incident-escalation", "decision": "pass", "validated": True}], "operationalRisks": [{"name": "no-open-high-operational-risk", "decision": "pass", "severity": "low", "accepted": True}], "signoffs": [{"name": "operations-owner", "decision": "pass", "approved": True}, {"name": "support-owner", "decision": "pass", "approved": True}], "evidence": {"finalOperationalHandover": {"decision": "pass"}}}},
            "platform.final_operational_handover_review.completed",
            ["Final operational handover vector with sanitized runbooks, owners, support model, monitoring, escalation, risks, signoffs and evidence only"],
        ),
        (
            JobType.PLATFORM_PHASE_CLOSURE_CERTIFICATION_REVIEW,
            {"jobType": "platform.phase_closure_certification_review", "idempotencyKey": "vector-phase-closure-certification-v64-0001", "correlationId": "vector-correlation-phase-closure-certification", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"releaseId": "option-b-v64-phase-closure", "stage": "phase-closure-certification", "phase": "closure", "certificationScope": "option-b-python-progressive", "domain": "global", "operatingMode": "phase-closure-certification", "route": "/api/hybrid-python/jobs", "jobTypes": ["platform.final_operational_handover_review"], "closureCriteria": [{"name": "evidence-package-complete", "decision": "pass", "met": True}, {"name": "handover-complete", "decision": "pass", "met": True}], "evidencePackage": [{"name": "v1-to-v64-evidence", "decision": "pass", "complete": True}], "handoverEvidence": [{"name": "handover-approved", "decision": "pass", "approved": True}], "residualRisks": [{"name": "npm-build-target-env", "decision": "pass", "severity": "medium", "accepted": True}], "releaseArtifacts": [{"name": "v64-zip", "decision": "pass", "published": True}, {"name": "v64-sha256", "decision": "pass", "published": True}], "approvals": [{"name": "delivery-governance", "decision": "pass", "approved": True}, {"name": "executive-sponsor", "decision": "pass", "approved": True}], "nextPhaseBacklog": [{"name": "future-enhancements-separated", "decision": "pass", "separated": True}], "evidence": {"phaseClosureCertification": {"decision": "pass"}}}},
            "platform.phase_closure_certification_review.completed",
            ["Phase closure certification vector with sanitized closure criteria, evidence, handover, artifacts, risks, approvals and future backlog only"],
        ),
        (
            JobType.NOTIFICATIONS_DISPATCH,
            {"jobType": "notifications.dispatch", "idempotencyKey": "vector-notifications-dispatch-v14-0001", "correlationId": "vector-correlation-notifications", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"channel": "email", "templateId": "template-vector", "recipients": ["ops@example.com"], "variables": {"tenant": "vector"}}},
            "notifications.dispatch.planned",
            ["dry-run delivery planning vector; no provider send"],
        ),
        (
            JobType.AI_TRIAGE_PREVIEW,
            {"jobType": "ai.triage_preview", "idempotencyKey": "vector-ai-triage-preview-v14-0001", "correlationId": "vector-correlation-ai-preview", "organizationId": "org-vector", "actorUserId": "user-vector-admin", "dryRun": True, "payload": {"text": "Patient reports dizziness", "locale": "en", "context": {"source": "contract-vector"}}},
            "ai.triage_preview.generated",
            ["non-diagnostic preview vector; clinical review required"],
        ),
    ]
    results: list[ContractTestVector] = []
    for job_type, envelope_payload, expected, notes in vectors:
        contract = CONTRACTS[job_type]
        envelope = JobEnvelope.parse_obj(envelope_payload)
        results.append(
            ContractTestVector(
                vectorId=f"{contract.contract_id}.vector.v14",
                contractId=contract.contract_id,
                jobType=job_type,
                expectedResultType=expected,
                envelope=envelope,
                notes=notes,
            )
        )
    return results


def validate_contract_envelope(job: JobEnvelope) -> ContractValidationReport:
    contract = CONTRACTS[job.job_type]
    decision = evaluate_job_policy(job)
    errors: list[str] = []
    warnings: list[str] = list(decision.warnings)
    if contract.dry_run_only and not job.dry_run:
        errors.append("contract is dry-run-only; non-dry-run execution is not allowed")
    if not decision.allowed:
        errors.extend([f"blocked policy path: {path}" for path in decision.blocked_paths])
    if job.job_type == JobType.ADMIN_AUDIT_EXPORT and "filters" not in job.payload:
        errors.append("payload.filters is required for admin.audit_export")
    if job.job_type == JobType.ADMIN_ACCOUNTS_READ_MODEL and "rows" not in job.payload:
        warnings.append("admin.accounts_read_model received no rows; result will be plan-only")
    if job.job_type == JobType.SCHEDULING_AVAILABILITY_SNAPSHOT and "windows" not in job.payload:
        errors.append("payload.windows is required for scheduling.availability_snapshot")
    if job.job_type == JobType.MESSAGING_REMINDER_PLAN and "templateId" not in job.payload:
        errors.append("payload.templateId is required for messaging.reminder_plan")
    if job.job_type == JobType.BILLING_PAYMENT_RECONCILE and "rows" not in job.payload:
        warnings.append("billing.payment_reconcile received no rows; result will be plan-only")
    if job.job_type == JobType.CLINICAL_RECORDS_ACCESS_AUDIT and "events" not in job.payload:
        errors.append("payload.events is required for clinical.records_access_audit")
    if job.job_type == JobType.PLATFORM_DB_INDEX_ADVISORY and "queries" not in job.payload:
        warnings.append("platform.db_index_advisory received no query observations; baseline recommendations only")
    if job.job_type == JobType.PLATFORM_SLO_REGRESSION_REPORT and "currentSamplesMs" not in job.payload:
        errors.append("payload.currentSamplesMs is required for platform.slo_regression_report")
    if job.job_type == JobType.PLATFORM_CONTRACT_REPLAY and not any(key in job.payload for key in ("jobTypes", "contractIds", "vectorIds")):
        warnings.append("platform.contract_replay received no selectors; all sanitized vectors except replay will be evaluated")
    if job.job_type == JobType.PLATFORM_PRIVACY_PREFLIGHT and "candidates" not in job.payload:
        errors.append("payload.candidates is required for platform.privacy_preflight")

    if job.job_type == JobType.PLATFORM_RELEASE_DECISION and not any(key in job.payload for key in ("gate", "checklist", "contractReplay", "privacyPreflight", "sloRegression")):
        warnings.append("platform.release_decision received no release evidence; result will hold")
    if job.job_type == JobType.PLATFORM_ROLLBACK_DRILL and "route" not in job.payload:
        warnings.append("platform.rollback_drill received no route; default hybrid jobs route will be used")
    if job.job_type == JobType.PLATFORM_POST_DEPLOY_VERIFY and not any(key in job.payload for key in ("healthChecks", "smokeChecks", "sloRegression", "releaseDecision")):
        warnings.append("platform.post_deploy_verify received limited evidence; result will hold or rollback unless clean evidence is supplied")
    if job.job_type == JobType.PLATFORM_CHANGE_TICKET_BUNDLE and not any(key in job.payload for key in ("evidenceBundle", "releaseDecision", "rollbackDrill", "contractReplay", "privacyPreflight", "sloRegression")):
        warnings.append("platform.change_ticket_bundle received no evidence sections; ticket bundle will be incomplete")
    if job.job_type == JobType.PLATFORM_OPERATIONAL_HANDOFF and not any(key in job.payload for key in ("ownerContacts", "dashboardLinks", "alertPolicies", "runbookLinks")):
        warnings.append("platform.operational_handoff received incomplete handoff metadata; handoff pack will be incomplete")
    if job.job_type == JobType.PLATFORM_INCIDENT_SIMULATION and "scenario" not in job.payload:
        warnings.append("platform.incident_simulation received no scenario; default latency_regression drill will be used")
    if job.job_type == JobType.PLATFORM_CAPACITY_PLAN and "expectedRequestsPerMinute" not in job.payload:
        warnings.append("platform.capacity_plan received no workload estimate; result will be conservative")
    if job.job_type == JobType.PLATFORM_ALERT_POLICY_REVIEW and "alertPolicies" not in job.payload:
        warnings.append("platform.alert_policy_review received no alert policies; review will hold")
    if job.job_type == JobType.PLATFORM_DEPENDENCY_READINESS and "dependencies" not in job.payload:
        warnings.append("platform.dependency_readiness received no dependency evidence; readiness will hold")
    if job.job_type == JobType.PLATFORM_PRODUCTION_READINESS and "evidence" not in job.payload:
        warnings.append("platform.production_readiness received no release evidence; readiness will hold")
    if job.job_type == JobType.PLATFORM_DATA_RETENTION_REVIEW and not any(key in job.payload for key in ("retentionPolicies", "artifactSummary", "gcSummary")):
        warnings.append("platform.data_retention_review received no retention evidence; review will hold")
    if job.job_type == JobType.PLATFORM_AUDIT_TRAIL_REVIEW and "auditEvents" not in job.payload:
        warnings.append("platform.audit_trail_review received no audit events; review will hold")
    if job.job_type == JobType.PLATFORM_SECURITY_POSTURE_REVIEW and "controls" not in job.payload:
        warnings.append("platform.security_posture_review received no control evidence; review will hold")
    if job.job_type == JobType.PLATFORM_SUPPLY_CHAIN_REVIEW and "scans" not in job.payload:
        warnings.append("platform.supply_chain_review received no scan evidence; review will hold")
    if job.job_type == JobType.PLATFORM_SCHEMA_MIGRATION_REHEARSAL and not any(key in job.payload for key in ("migrations", "schemaDrift", "rehearsalEvidence")):
        warnings.append("platform.schema_migration_rehearsal received no migration rehearsal evidence; review will hold")
    if job.job_type == JobType.PLATFORM_BACKUP_RESTORE_DRILL and not any(key in job.payload for key in ("backups", "restoreTests")):
        warnings.append("platform.backup_restore_drill received no backup/restore evidence; review will hold")
    if job.job_type == JobType.PLATFORM_OBSERVABILITY_COVERAGE_REVIEW and not any(key in job.payload for key in ("traces", "metrics", "dashboards")):
        warnings.append("platform.observability_coverage_review received no observability evidence; review will hold")
    if job.job_type == JobType.PLATFORM_FEATURE_FLAG_REVIEW and "flags" not in job.payload:
        warnings.append("platform.feature_flag_review received no feature flag evidence; review will hold")
    if job.job_type == JobType.PLATFORM_DOMAIN_MIGRATION_READINESS and not any(key in job.payload for key in ("evidence", "shadowComparisonSummary", "canaryGate")):
        warnings.append("platform.domain_migration_readiness received limited evidence; readiness will hold")
    if job.job_type == JobType.PLATFORM_CUTOVER_PLAN and "rollbackTriggers" not in job.payload:
        warnings.append("platform.cutover_plan received no rollback triggers; default rollback triggers will be used")
    if job.job_type == JobType.PLATFORM_OWNER_REGISTRY_REVIEW and not any(key in job.payload for key in ("domains", "ownerRegistry")):
        warnings.append("platform.owner_registry_review received no owner records; review will hold")
    if job.job_type == JobType.PLATFORM_POST_CUTOVER_MONITOR and "metrics" not in job.payload:
        warnings.append("platform.post_cutover_monitor received no metrics; monitor will hold")
    if job.job_type == JobType.PLATFORM_LEGACY_PATH_DECOMMISSION and "legacyPaths" not in job.payload:
        warnings.append("platform.legacy_path_decommission received no legacy paths; review will hold")
    if job.job_type == JobType.PLATFORM_STEADY_STATE_OPERATIONS_REVIEW and not any(key in job.payload for key in ("runbookLinks", "dashboardLinks", "alertPolicies", "metrics")):
        warnings.append("platform.steady_state_operations_review received limited operations evidence; review will hold")
    if job.job_type == JobType.PLATFORM_QUEUE_RESILIENCE_REVIEW and "queues" not in job.payload:
        warnings.append("platform.queue_resilience_review received no queue telemetry; review will hold")
    if job.job_type == JobType.PLATFORM_ARTIFACT_INTEGRITY_REVIEW and "artifacts" not in job.payload:
        warnings.append("platform.artifact_integrity_review received no artifact metadata; review will hold")
    if job.job_type == JobType.PLATFORM_RUNBOOK_FRESHNESS_REVIEW and "runbooks" not in job.payload:
        warnings.append("platform.runbook_freshness_review received no runbook metadata; review will hold")
    if job.job_type == JobType.PLATFORM_SUPPORT_ESCALATION_REVIEW and not any(key in job.payload for key in ("supportTiers", "escalationPaths")):
        warnings.append("platform.support_escalation_review received limited support metadata; review will hold")
    if job.job_type == JobType.PLATFORM_CI_STAGING_VALIDATION_REVIEW and not any(key in job.payload for key in ("checks", "builds", "docker", "hmac", "evidence")):
        warnings.append("platform.ci_staging_validation_review received limited CI/staging evidence; review will hold")
    if job.job_type == JobType.PLATFORM_RELEASE_CLOSURE_REVIEW and not any(key in job.payload for key in ("gateResults", "evidenceBundle", "validationSummary", "approvals")):
        warnings.append("platform.release_closure_review received limited closure evidence; review will hold")
    if job.job_type == JobType.PLATFORM_TRAFFIC_PROMOTION_READINESS_REVIEW and not any(key in job.payload for key in ("gateEvidence", "productionObservation", "incidentReadiness", "approvals", "rollbackPlan")):
        warnings.append("platform.traffic_promotion_readiness_review received limited promotion evidence; review will hold")
    if job.job_type == JobType.PLATFORM_EVIDENCE_RETENTION_AUDIT_REVIEW and not any(key in job.payload for key in ("artifacts", "evidenceBundle", "retentionPolicy")):
        warnings.append("platform.evidence_retention_audit_review received limited artifact metadata; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_SLO_ERROR_BUDGET_REVIEW and not any(key in job.payload for key in ("metrics", "services", "sloTargets")):
        warnings.append("platform.slo_error_budget_review received limited SLO/error-budget evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_AUTO_ROLLBACK_SAFEGUARD_REVIEW and not any(key in job.payload for key in ("safeguards", "rollbackTriggers", "featureFlags", "runbook")):
        warnings.append("platform.auto_rollback_safeguard_review received limited rollback safeguard evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_THIRD_PARTY_DEPENDENCY_REVIEW and not any(key in job.payload for key in ("dependencies", "providers", "incidents", "statusPages")):
        warnings.append("platform.third_party_dependency_review received limited dependency evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_CAPACITY_SCALING_READINESS_REVIEW and not any(key in job.payload for key in ("metrics", "queues", "workers", "autoscaling", "loadTest")):
        warnings.append("platform.capacity_scaling_readiness_review received limited capacity evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_COMPLIANCE_PRIVACY_EVIDENCE_REVIEW and not any(key in job.payload for key in ("evidence", "artifacts", "privacyReviews", "complianceControls", "dpia", "dpaRecords", "approvals")):
        warnings.append("platform.compliance_privacy_evidence_review received limited privacy/compliance evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_RUNBOOK_DRILL_VERIFICATION_REVIEW and not any(key in job.payload for key in ("runbooks", "drills", "scenarios", "evidence")):
        warnings.append("platform.runbook_drill_verification_review received limited runbook/drill evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_DISASTER_RECOVERY_BACKUP_REVIEW and not any(key in job.payload for key in ("backups", "restoreDrills", "rpoRtoTargets", "evidence")):
        warnings.append("platform.disaster_recovery_backup_review received limited DR/backup evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_CHANGE_MIGRATION_READINESS_REVIEW and not any(key in job.payload for key in ("migrations", "changeTickets", "approvals", "rollbackPlan", "rolloutPlan", "evidence")):
        warnings.append("platform.change_migration_readiness_review received limited change/migration evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_CONFIGURATION_SECRET_ROTATION_REVIEW and not any(key in job.payload for key in ("secrets", "configItems", "rotations", "evidence")):
        warnings.append("platform.configuration_secret_rotation_review received limited configuration/secret evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_MAINTENANCE_WINDOW_READINESS_REVIEW and not any(key in job.payload for key in ("maintenanceWindows", "tasks", "approvals", "comms", "evidence")):
        warnings.append("platform.maintenance_window_readiness_review received limited maintenance-window evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_AUDIT_FORENSICS_READINESS_REVIEW and not any(key in job.payload for key in ("auditTrails", "forensicArtifacts", "investigationDrills", "chainOfCustody", "evidence")):
        warnings.append("platform.audit_forensics_readiness_review received limited audit/forensics evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_BUSINESS_CONTINUITY_READINESS_REVIEW and not any(key in job.payload for key in ("continuityPlans", "teams", "communications", "fallbackProcedures", "exercises", "evidence")):
        warnings.append("platform.business_continuity_readiness_review received limited continuity evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_POST_INCIDENT_LEARNING_REVIEW and not any(key in job.payload for key in ("incidents", "postmortems", "actionItems", "regressions", "evidence")):
        warnings.append("platform.post_incident_learning_review received limited post-incident learning evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_TECH_DEBT_GOVERNANCE_REVIEW and not any(key in job.payload for key in ("debtItems", "waivers", "ownership", "remediationPlan", "evidence")):
        warnings.append("platform.tech_debt_governance_review received limited technical-debt governance evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_VENDOR_RESILIENCE_REVIEW and not any(key in job.payload for key in ("vendors", "services", "incidents", "exitPlans", "evidence")):
        warnings.append("platform.vendor_resilience_review received limited vendor/dependency resilience evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_KNOWLEDGE_TRANSFER_READINESS_REVIEW and not any(key in job.payload for key in ("knowledgeArtifacts", "owners", "trainingSessions", "handoffChecklists", "evidence")):
        warnings.append("platform.knowledge_transfer_readiness_review received limited knowledge-transfer evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_ARCHITECTURE_OWNERSHIP_REVIEW and not any(key in job.payload for key in ("architectureArtifacts", "serviceBoundaries", "owners", "decisionRecords", "evidence")):
        warnings.append("platform.architecture_ownership_review received limited architecture/ownership evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_EXECUTIVE_METRICS_GOVERNANCE_REVIEW and not any(key in job.payload for key in ("metricDefinitions", "dashboards", "reviewCadence", "owners", "evidence")):
        warnings.append("platform.executive_metrics_governance_review received limited executive-metrics governance evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_DOMAIN_ADOPTION_READINESS_REVIEW and "domains" not in job.payload:
        warnings.append("platform.domain_adoption_readiness_review received no domain readiness entries; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_PHASE_TWO_ROLLOUT_GOVERNANCE_REVIEW and not any(key in job.payload for key in ("milestones", "approvals", "guardrails")):
        warnings.append("platform.phase_two_rollout_governance_review received limited Phase 2 rollout governance evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_DOMAIN_PILOT_EXECUTION_REVIEW and not any(key in job.payload for key in ("pilotDomains", "pilotRuns", "acceptanceCriteria", "operatorApprovals")):
        warnings.append("platform.domain_pilot_execution_review received limited Phase 2 pilot execution evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_PHASE_TWO_EXPANSION_CONTROL_REVIEW and not any(key in job.payload for key in ("waves", "trafficLimits", "rollbackTriggers", "checkpoints", "approvals")):
        warnings.append("platform.phase_two_expansion_control_review received limited Phase 2 expansion control evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_DOMAIN_OUTCOME_MEASUREMENT_REVIEW and not any(key in job.payload for key in ("outcomeMetrics", "baselines", "adoptionSignals", "supportSignals", "evidence")):
        warnings.append("platform.domain_outcome_measurement_review received limited Phase 2 outcome measurement evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_PHASE_TWO_FEEDBACK_ADOPTION_REVIEW and not any(key in job.payload for key in ("feedbackItems", "adoptionDecisions", "ownerResponses", "communications", "evidence")):
        warnings.append("platform.phase_two_feedback_adoption_review received limited Phase 2 feedback/adoption evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_DOMAIN_GRADUATION_READINESS_REVIEW and not any(key in job.payload for key in ("graduationCandidates", "graduationCriteria", "outcomeSummary", "riskRegister", "approvals", "evidence")):
        warnings.append("platform.domain_graduation_readiness_review received limited Phase 2 graduation evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_PHASE_TWO_LEARNING_CONSOLIDATION_REVIEW and not any(key in job.payload for key in ("learnings", "experiments", "decisions", "playbookUpdates", "owners", "evidence")):
        warnings.append("platform.phase_two_learning_consolidation_review received limited Phase 2 learning consolidation evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_DOMAIN_WIDE_ADOPTION_READINESS_REVIEW and not any(key in job.payload for key in ("adoptionDomains", "rolloutEvidence", "ownerApprovals", "supportReadiness", "rollbackPlan", "evidence")):
        warnings.append("platform.domain_wide_adoption_readiness_review received limited Phase 2 broad-adoption evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_PHASE_TWO_SUPPORT_TRANSITION_REVIEW and not any(key in job.payload for key in ("supportQueues", "escalationPaths", "trainingArtifacts", "runbookUpdates", "ownerApprovals", "evidence")):
        warnings.append("platform.phase_two_support_transition_review received limited Phase 2 support-transition evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_DOMAIN_ADOPTION_STABILIZATION_REVIEW and not any(key in job.payload for key in ("stabilizationDomains", "healthSignals", "supportSignals", "regressionWatch", "approvals", "evidence")):
        warnings.append("platform.domain_adoption_stabilization_review received limited Phase 2 stabilization evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_PHASE_TWO_VALUE_REALIZATION_REVIEW and not any(key in job.payload for key in ("valueMetrics", "benefitBaselines", "adoptionSummary", "executiveReviews", "ownerApprovals", "evidence")):
        warnings.append("platform.phase_two_value_realization_review received limited Phase 2 value-realization evidence; review will rollback or hold")

    if job.job_type == JobType.PLATFORM_PHASE_TWO_CLOSURE_ACCEPTANCE_REVIEW and not any(key in job.payload for key in ("closureCriteria", "acceptanceEvidence", "openRisks", "approvals", "valueRealizationSummary", "supportTransition", "evidence")):
        warnings.append("platform.phase_two_closure_acceptance_review received limited Phase 2 closure evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_PHASE_THREE_TRANSITION_READINESS_REVIEW and not any(key in job.payload for key in ("transitionMilestones", "dependencyReadiness", "ownerHandoffs", "rolloutGuardrails", "entryCriteria", "approvals", "evidence")):
        warnings.append("platform.phase_three_transition_readiness_review received limited Phase 3 transition evidence; review will rollback or hold")

    if job.job_type == JobType.PLATFORM_PHASE_THREE_DOMAIN_WAVE_READINESS_REVIEW and not any(key in job.payload for key in ("domains", "waveCriteria", "guardrails", "supportCoverage", "rollbackCoverage", "approvals", "evidence")):
        warnings.append("platform.phase_three_domain_wave_readiness_review received limited Phase 3 domain-wave readiness evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_PHASE_THREE_OPERATING_MODEL_ALIGNMENT_REVIEW and not any(key in job.payload for key in ("ownershipMatrix", "supportModel", "runbookCoverage", "metricGovernance", "trainingCoverage", "escalationModel", "approvals", "evidence")):
        warnings.append("platform.phase_three_operating_model_alignment_review received limited Phase 3 operating-model alignment evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_PHASE_THREE_WAVE_EXECUTION_REVIEW and not any(key in job.payload for key in ("waveExecution", "domainSignals", "guardrailChecks", "rollbackReadiness", "supportIncidents", "approvals", "evidence")):
        warnings.append("platform.phase_three_wave_execution_review received limited Phase 3 wave execution evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_PHASE_THREE_ADOPTION_VALUE_TRACKING_REVIEW and not any(key in job.payload for key in ("adoptionMetrics", "valueMetrics", "userFeedback", "benefitHypotheses", "ownerReviews", "approvals", "evidence")):
        warnings.append("platform.phase_three_adoption_value_tracking_review received limited Phase 3 adoption value evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_GLOBAL_TASK_STATUS_TRACKING_REVIEW and not any(key in job.payload for key in ("tasks", "milestones", "owners", "blockers", "approvals", "evidence")):
        warnings.append("platform.global_task_status_tracking_review received limited task status evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_PROJECT_STATE_HEALTH_REVIEW and not any(key in job.payload for key in ("applications", "migrationStatus", "riskRegister", "closureCriteria", "approvals", "evidence")):
        warnings.append("platform.project_state_health_review received limited project state health evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_FINAL_ACCEPTANCE_EVIDENCE_REVIEW and not any(key in job.payload for key in ("acceptanceCriteria", "validationEvidence", "testResults", "residualRisks", "signoffs", "evidence")):
        warnings.append("platform.final_acceptance_evidence_review received limited final acceptance evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_STAGE_EXIT_READINESS_REVIEW and not any(key in job.payload for key in ("exitCriteria", "operationalHandoff", "evidenceBundle", "rollbackPlan", "supportReadiness", "approvals", "evidence")):
        warnings.append("platform.stage_exit_readiness_review received limited stage-exit evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_STAGE_CLOSURE_CERTIFICATION_REVIEW and not any(key in job.payload for key in ("certificationItems", "finalEvidence", "signoffs", "releaseArtifacts", "residualRisks", "evidence")):
        warnings.append("platform.stage_closure_certification_review received limited closure certification evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_POST_CLOSURE_OPERATIONAL_TRANSITION_REVIEW and not any(key in job.payload for key in ("transitionItems", "monitoringPlan", "ownershipHandoff", "supportReadiness", "kpiBaselines", "approvals", "evidence")):
        warnings.append("platform.post_closure_operational_transition_review received limited post-closure transition evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_POST_CLOSURE_MONITORING_REVIEW and not any(key in job.payload for key in ("monitoringWindows", "sloSignals", "incidentSignals", "adoptionSignals", "regressionChecks", "approvals", "evidence")):
        warnings.append("platform.post_closure_monitoring_review received limited post-closure monitoring evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_STEADY_STATE_TRANSFER_VALIDATION_REVIEW and not any(key in job.payload for key in ("transferItems", "ownershipMatrix", "runbookCoverage", "monitoringReadiness", "supportModel", "knowledgeTransfer", "approvals", "evidence")):
        warnings.append("platform.steady_state_transfer_validation_review received limited steady-state transfer evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_STEADY_STATE_OPERATIONAL_ASSURANCE_REVIEW and not any(key in job.payload for key in ("operationalMetrics", "sloHealth", "incidentTrends", "supportQueues", "runbookAudits", "ownershipReviews", "approvals", "evidence")):
        warnings.append("platform.steady_state_operational_assurance_review received limited steady-state operational assurance evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_CONTINUOUS_IMPROVEMENT_BACKLOG_REVIEW and not any(key in job.payload for key in ("improvementItems", "valueHypotheses", "technicalDebtItems", "riskItems", "ownerCommitments", "governanceReviews", "approvals", "evidence")):
        warnings.append("platform.continuous_improvement_backlog_review received limited continuous-improvement backlog evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_STABLE_OPERATIONS_OPTIMIZATION_REVIEW and not any(key in job.payload for key in ("optimizationMetrics", "costSignals", "reliabilitySignals", "automationOpportunities", "debtItems", "guardrailReviews", "approvals", "evidence")):
        warnings.append("platform.stable_operations_optimization_review received limited stable-operations optimization evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_RECURRING_MAINTENANCE_CYCLE_READINESS_REVIEW and not any(key in job.payload for key in ("maintenanceWindows", "patchCadence", "dependencyUpdatePlan", "backupValidation", "runbookSchedule", "ownerRoster", "approvals", "evidence")):
        warnings.append("platform.recurring_maintenance_cycle_readiness_review received limited recurring-maintenance readiness evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_MAINTENANCE_CYCLE_EXECUTION_REVIEW and not any(key in job.payload for key in ("executionItems", "patchResults", "dependencyResults", "backupResults", "validationResults", "rollbackReadiness", "communications", "approvals", "evidence")):
        warnings.append("platform.maintenance_cycle_execution_review received limited maintenance-cycle execution evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_LONG_TERM_OPERABILITY_SUSTAINABILITY_REVIEW and not any(key in job.payload for key in ("sustainabilityMetrics", "ownershipSignals", "knowledgeBaseReviews", "dependencyLifecycle", "budgetSignals", "riskAcceptances", "improvementCadence", "approvals", "evidence")):
        warnings.append("platform.long_term_operability_sustainability_review received limited long-term operability sustainability evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_RECURRING_OPERATIONAL_MATURITY_AUDIT_REVIEW and not any(key in job.payload for key in ("maturityDimensions", "controlChecks", "incidentLearnings", "supportSignals", "operatorEvidence", "risks", "approvals", "evidence")):
        warnings.append("platform.recurring_operational_maturity_audit_review received limited recurring operational maturity evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_STABLE_STATE_CONTINUITY_CONTROL_REVIEW and not any(key in job.payload for key in ("continuityControls", "drSignals", "dependencyContinuity", "operationalFallbacks", "communicationChecks", "risks", "approvals", "evidence")):
        warnings.append("platform.stable_state_continuity_control_review received limited stable-state continuity evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_OPERATIONAL_RESILIENCE_GOVERNANCE_REVIEW and not any(key in job.payload for key in ("resilienceControls", "chaosDrills", "failoverReadiness", "serviceOwnership", "riskItems", "governanceReviews", "approvals", "evidence")):
        warnings.append("platform.operational_resilience_governance_review received limited operational resilience governance evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_RECOVERY_CAPABILITY_VALIDATION_REVIEW and not any(key in job.payload for key in ("restoreTests", "rtoRpoChecks", "backupIntegrity", "incidentReplayResults", "dependencyRecovery", "communicationValidation", "risks", "approvals", "evidence")):
        warnings.append("platform.recovery_capability_validation_review received limited recovery capability validation evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_OPERATIONAL_RESILIENCE_OPTIMIZATION_REVIEW and not any(key in job.payload for key in ("resilienceMetrics", "optimizationActions", "automationCandidates", "incidentPatterns", "capacitySignals", "riskItems", "approvals", "evidence")):
        warnings.append("platform.operational_resilience_optimization_review received limited resilience optimization evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_AUTOMATED_CONTINUITY_PREPAREDNESS_REVIEW and not any(key in job.payload for key in ("automationControls", "continuityRunbooks", "schedulerReadiness", "dependencyHooks", "notificationTemplates", "risks", "approvals", "evidence")):
        warnings.append("platform.automated_continuity_preparedness_review received limited automated continuity preparedness evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_AUTOMATED_CONTINUITY_EXECUTION_VALIDATION_REVIEW and not any(key in job.payload for key in ("executionRuns", "schedulerEvents", "dependencyHooks", "notificationDeliveries", "runbookCheckpoints", "riskItems", "approvals", "evidence")):
        warnings.append("platform.automated_continuity_execution_validation_review received limited automated continuity execution evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_OPERATIONAL_RESILIENCE_FEEDBACK_LOOP_REVIEW and not any(key in job.payload for key in ("feedbackSignals", "remediationItems", "learningItems", "metricAdjustments", "ownerResponses", "risks", "approvals", "evidence")):
        warnings.append("platform.operational_resilience_feedback_loop_review received limited operational resilience feedback evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_FINAL_CLOSURE_EVIDENCE_PACKAGE_REVIEW and not any(key in job.payload for key in ("versionSummary", "validationResults", "contractEvidence", "apiRouteEvidence", "workerEvidence", "residualRisks", "signoffs", "evidence")):
        warnings.append("platform.final_closure_evidence_package_review received limited final closure evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_GLOBAL_IMPLEMENTATION_COMPLETION_CHECKLIST_REVIEW and not any(key in job.payload for key in ("functionalAreas", "implementationTasks", "validationTasks", "handoverTasks", "deferredItems", "approvals", "evidence")):
        warnings.append("platform.global_implementation_completion_checklist_review received limited implementation completion checklist evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_FINAL_OPERATIONAL_HANDOVER_REVIEW and not any(key in job.payload for key in ("runbooks", "ownerAssignments", "supportModel", "monitoringControls", "escalationPaths", "operationalRisks", "signoffs", "evidence")):
        warnings.append("platform.final_operational_handover_review received limited final operational handover evidence; review will rollback or hold")
    if job.job_type == JobType.PLATFORM_PHASE_CLOSURE_CERTIFICATION_REVIEW and not any(key in job.payload for key in ("closureCriteria", "evidencePackage", "handoverEvidence", "residualRisks", "releaseArtifacts", "approvals", "nextPhaseBacklog", "evidence")):
        warnings.append("platform.phase_closure_certification_review received limited phase closure certification evidence; review will rollback or hold")
    if job.job_type == JobType.ANALYTICS_SNAPSHOT and "values" not in job.payload:
        warnings.append("analytics.snapshot received no values; result will be empty aggregate")
    payload_keys = sorted(str(key) for key in job.payload.keys())
    return ContractValidationReport(
        allowed=not errors,
        contractId=contract.contract_id,
        jobType=job.job_type,
        idempotencyKey=job.idempotency_key,
        dryRun=job.dry_run,
        dataClassification=contract.data_classification,
        dryRunOnly=contract.dry_run_only,
        canaryMaxPercent=contract.canary_max_percent,
        payloadKeys=payload_keys,
        expectedResultType=contract.expected_result_type,
        contractHash=contract_hash(),
        errors=errors,
        warnings=warnings,
        safeguards=list(contract.safeguards),
    )


def _next_stage(current: int, target: int, cap: int) -> int:
    bounded_target = max(0, min(target, cap))
    if current >= bounded_target:
        return current
    stages = sorted({0, 1, 5, 10, 25, 50, 100, bounded_target})
    for stage in stages:
        if current < stage <= bounded_target:
            return stage
    return bounded_target


def build_rollout_readiness_report(
    *,
    gate: CanaryGateDecision,
    current_canary_percent: int,
    target_canary_percent: int,
    job_type: JobType | None,
    signature_required: bool,
) -> RolloutReadinessReport:
    contract = CONTRACTS[job_type] if job_type else None
    max_percent = contract.canary_max_percent if contract else min(target_canary_percent, 50)
    prerequisites = [
        {"name": "shadow-comparison-gate", "passed": gate.allowed, "detail": gate.recommendation},
        {"name": "signed-bridge", "passed": signature_required, "detail": "HMAC signature required in production or explicit setting"},
        {"name": "canary-cap", "passed": target_canary_percent <= max_percent, "detail": f"target <= max {max_percent}"},
    ]
    reasons = list(gate.reasons)
    if target_canary_percent > max_percent:
        reasons.append(f"target canary percent {target_canary_percent} exceeds contract cap {max_percent}")
    if not signature_required:
        reasons.append("bridge signature is not required; hold before production promotion")

    prereqs_ok = all(item["passed"] for item in prerequisites)
    if gate.recommendation == "rollback":
        decision = "rollback"
        next_percent = 0
    elif prereqs_ok:
        decision = "advance"
        next_percent = _next_stage(current_canary_percent, target_canary_percent, max_percent)
    else:
        decision = "hold"
        next_percent = current_canary_percent

    return RolloutReadinessReport(
        decision=decision,
        recommendation=gate.recommendation,
        currentCanaryPercent=current_canary_percent,
        targetCanaryPercent=target_canary_percent,
        nextCanaryPercent=next_percent,
        maxCanaryPercent=max_percent,
        contractId=contract.contract_id if contract else None,
        jobType=job_type,
        gate=gate,
        prerequisites=prerequisites,
        reasons=reasons,
        rollback=contract.rollback if contract else "Set HYBRID_PYTHON_ENABLED=false or HYBRID_PYTHON_CANARY_PERCENT=0.",
    )
