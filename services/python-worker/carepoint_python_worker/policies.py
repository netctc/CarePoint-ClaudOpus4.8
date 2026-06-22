from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .models import JobEnvelope, JobType

SECRET_KEYS = {
    "accesstoken",
    "authorization",
    "cookie",
    "password",
    "refreshtoken",
    "secret",
    "token",
    "apikey",
    "api_key",
    "cvv",
    "cardnumber",
    "creditcard",
}

PHI_KEYS = {
    "address",
    "chart",
    "clinicalnote",
    "dateofbirth",
    "diagnosis",
    "dob",
    "fullchart",
    "labresult",
    "medicalrecord",
    "note",
    "patientemail",
    "patientphone",
    "phone",
    "prescription",
    "ssn",
    "socialsecuritynumber",
}


def _normalize_key(key: str) -> str:
    return "".join(ch for ch in key.lower() if ch.isalnum() or ch == "_")


@dataclass(frozen=True)
class JobPolicy:
    owner: str
    data_classification: str
    max_payload_bytes: int
    allowed_sensitive_keys: frozenset[str]
    dry_run_only: bool = False
    notes: tuple[str, ...] = ()


@dataclass(frozen=True)
class PolicyDecision:
    allowed: bool
    data_classification: str
    warnings: tuple[str, ...]
    blocked_paths: tuple[str, ...] = ()


JOB_POLICIES: dict[JobType, JobPolicy] = {
    JobType.ADMIN_AUDIT_EXPORT: JobPolicy(
        owner="Admin & Governance",
        data_classification="metadata-only-until-node-delivery",
        max_payload_bytes=2_000_000,
        allowed_sensitive_keys=frozenset(),
        notes=(
            "Python prepares export plans only; Node owns audit authorization, row fetch, signed URL and delivery.",
            "includePhi is treated as a policy request, not as permission to send PHI rows to Python.",
        ),
    ),
    JobType.ADMIN_ACCOUNTS_BULK_VALIDATE: JobPolicy(
        owner="Accounts & Organizations",
        data_classification="pii-limited-admin-input",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"email", "displayname", "organizationid"}),
        notes=(
            "Bulk validation may include account identifiers required for admin import checks.",
            "Python validates shape only; Node remains owner of account mutation and authorization.",
        ),
    ),

    JobType.ADMIN_ACCOUNTS_READ_MODEL: JobPolicy(
        owner="Accounts & Organizations",
        data_classification="minimized-admin-read-model",
        max_payload_bytes=1_500_000,
        allowed_sensitive_keys=frozenset({"email", "displayname", "organizationid", "status", "role"}),
        notes=(
            "Python may shape only Node-prefiltered account rows into a minimized read model.",
            "Raw email is masked before artifact/result output; Node remains owner of Prisma queries and object authorization.",
        ),
    ),
    JobType.ADMIN_PROVIDER_ROLE_RECONCILE: JobPolicy(
        owner="Accounts & Organizations",
        data_classification="schema-metadata-only",
        max_payload_bytes=500_000,
        allowed_sensitive_keys=frozenset({"displayname", "organizationid"}),
        notes=(
            "Python performs advisory reconciliation only; it does not mutate Prisma schema, migrations, users or provider profiles.",
        ),
    ),
    JobType.SCHEDULING_AVAILABILITY_SNAPSHOT: JobPolicy(
        owner="Scheduling",
        data_classification="schedule-metadata-minimized",
        max_payload_bytes=1_000_000,
        allowed_sensitive_keys=frozenset(),
        notes=(
            "Python receives only provider/resource hashes and availability windows prefiltered by Node.",
            "No patient identifiers, notes or appointment clinical details are allowed in this slice.",
        ),
    ),
    JobType.MESSAGING_REMINDER_PLAN: JobPolicy(
        owner="Messaging & Notifications",
        data_classification="recipient-hash-planning",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"recipients", "recipienthashes", "templateid"}),
        dry_run_only=True,
        notes=(
            "Python plans reminder batches only; delivery provider send remains disabled and Node-owned.",
            "Prefer recipientHashes over raw recipients; raw recipient values are not persisted in artifacts.",
        ),
    ),
    JobType.BILLING_PAYMENT_RECONCILE: JobPolicy(
        owner="Billing & Coverage",
        data_classification="billing-metadata-minimized",
        max_payload_bytes=1_500_000,
        allowed_sensitive_keys=frozenset({"externalidhash", "paymentidhash", "organizationid", "gateway", "status"}),
        notes=(
            "Python receives Node-prefiltered payment metadata only; no PAN, CVV, card tokens or gateway secrets are allowed.",
            "Python produces reconciliation advisory output; Node remains owner of payment mutations and Stripe/webhook idempotency.",
        ),
    ),
    JobType.CLINICAL_RECORDS_ACCESS_AUDIT: JobPolicy(
        owner="Clinical Records",
        data_classification="clinical-access-metadata-hashed",
        max_payload_bytes=1_500_000,
        allowed_sensitive_keys=frozenset({"actorhash", "patienthash", "resourcehash", "reasoncode", "organizationid"}),
        notes=(
            "Python receives hashed clinical access metadata only; no chart content, notes, diagnoses, prescriptions or lab results are allowed.",
            "Python computes access-risk indicators; Node remains owner of record access enforcement and audit-log writes.",
        ),
    ),
    JobType.PLATFORM_DB_INDEX_ADVISORY: JobPolicy(
        owner="Platform & DevOps",
        data_classification="schema-query-metadata-only",
        max_payload_bytes=1_000_000,
        allowed_sensitive_keys=frozenset({"endpoint", "model", "filterfields", "orderbyfields", "selectfields"}),
        dry_run_only=True,
        notes=(
            "Python generates index advisory output only from schema/query metadata.",
            "Node/Prisma remain owner of migrations; validate recommendations with EXPLAIN ANALYZE before applying.",
        ),
    ),
    JobType.PLATFORM_SLO_REGRESSION_REPORT: JobPolicy(
        owner="Platform & DevOps",
        data_classification="aggregate-telemetry-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"route", "dimensions"}),
        dry_run_only=True,
        notes=(
            "Python evaluates aggregate latency/error samples only.",
            "Do not include request bodies, headers, tokens, PHI or raw logs in SLO regression payloads.",
        ),
    ),
    JobType.PLATFORM_CONTRACT_REPLAY: JobPolicy(
        owner="Platform & DevOps",
        data_classification="contract-vector-metadata-only",
        max_payload_bytes=250_000,
        allowed_sensitive_keys=frozenset({"jobtypes", "contractids", "vectorids"}),
        dry_run_only=True,
        notes=(
            "Python replays built-in sanitized contract vectors only; caller payloads are selectors, not raw domain data.",
            "Use this in CI/release gates before canary promotion.",
        ),
    ),
    JobType.PLATFORM_PRIVACY_PREFLIGHT: JobPolicy(
        owner="Platform & DevOps",
        data_classification="payload-shape-metadata-only",
        max_payload_bytes=500_000,
        allowed_sensitive_keys=frozenset({"route", "payloadkeys", "jobtype", "classification"}),
        dry_run_only=True,
        notes=(
            "Python evaluates payload key shapes before bridge enqueue; raw payload values should not be sent.",
            "This job is advisory and complements the hard policy gate in /api/v1/jobs/enqueue.",
        ),
    ),

    JobType.PLATFORM_RELEASE_DECISION: JobPolicy(
        owner="Platform & DevOps",
        data_classification="release-evidence-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"gate", "checklist", "contractreplay", "privacypreflight", "sloregression", "rollout", "evidence"}),
        dry_run_only=True,
        notes=(
            "Python computes a release decision from sanitized gate outputs and aggregate evidence only.",
            "This is an advisory release gate; Node/CI remains owner of deployment execution and rollback switches.",
        ),
    ),
    JobType.PLATFORM_ROLLBACK_DRILL: JobPolicy(
        owner="Platform & DevOps",
        data_classification="rollback-procedure-metadata-only",
        max_payload_bytes=500_000,
        allowed_sensitive_keys=frozenset({"route", "jobtypes", "trigger", "observedmetrics", "operators"}),
        dry_run_only=True,
        notes=(
            "Python generates a rollback drill plan and validation checklist only.",
            "The drill must not execute production rollback or mutate rollout state.",
        ),
    ),

    JobType.PLATFORM_POST_DEPLOY_VERIFY: JobPolicy(
        owner="Platform & DevOps",
        data_classification="post-deploy-evidence-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"route", "releaseid", "jobtypes", "healthchecks", "smokechecks", "sloregression", "releasedecision", "rollout", "jobsummary", "comparisonsummary", "privacypreflight"}),
        dry_run_only=True,
        notes=(
            "Python evaluates post-deploy rollout evidence and smoke summaries only.",
            "Do not include headers, request bodies, tokens, PHI, raw logs or patient identifiers in post-deploy verification payloads.",
        ),
    ),
    JobType.PLATFORM_CHANGE_TICKET_BUNDLE: JobPolicy(
        owner="Platform & DevOps",
        data_classification="change-ticket-evidence-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"changeid", "releaseid", "route", "jobtypes", "evidencebundle", "releasedecision", "rollbackdrill", "contractreplay", "privacypreflight", "sloregression", "artifactrefs", "approvals"}),
        dry_run_only=True,
        notes=(
            "Python composes a sanitized change ticket evidence bundle only.",
            "Ticket creation, approval workflow, deployment and rollback remain owned by Node/CI/operators.",
        ),
    ),
    JobType.PLATFORM_OPERATIONAL_HANDOFF: JobPolicy(
        owner="Platform & DevOps",
        data_classification="operational-handoff-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "route", "jobtypes", "ownercontacts", "dashboardlinks", "alertpolicies", "runbooklinks", "knownrisks", "supportwindows", "artifactrefs"}),
        dry_run_only=True,
        notes=(
            "Python composes an operational handoff pack only from sanitized metadata.",
            "Do not include pager tokens, private phone numbers, raw incident logs or PHI in handoff payloads.",
        ),
    ),
    JobType.PLATFORM_INCIDENT_SIMULATION: JobPolicy(
        owner="Platform & DevOps",
        data_classification="incident-drill-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"scenario", "route", "jobtypes", "observedmetrics", "gate", "slo", "privacy", "rollout", "operators"}),
        dry_run_only=True,
        notes=(
            "Python generates an incident simulation and response playbook only.",
            "Simulation must not mutate rollout state, send notifications or execute rollback commands.",
        ),
    ),
    JobType.PLATFORM_CAPACITY_PLAN: JobPolicy(
        owner="Platform / DevOps",
        data_classification="operational-capacity-metadata-only",
        max_payload_bytes=250_000,
        allowed_sensitive_keys=frozenset(),
        dry_run_only=True,
        notes=(
            "Capacity planning uses aggregate workload, queue and service metrics only.",
            "Python produces advisory sizing; infrastructure changes remain CI/operator-owned.",
        ),
    ),
    JobType.PLATFORM_ALERT_POLICY_REVIEW: JobPolicy(
        owner="Platform / DevOps",
        data_classification="operational-alert-policy-metadata-only",
        max_payload_bytes=250_000,
        allowed_sensitive_keys=frozenset(),
        dry_run_only=True,
        notes=(
            "Alert policy review inspects alert metadata and coverage only.",
            "Python does not create monitors, notifications or paging rules.",
        ),
    ),
    JobType.PLATFORM_DEPENDENCY_READINESS: JobPolicy(
        owner="Platform / DevOps",
        data_classification="operational-dependency-metadata-only",
        max_payload_bytes=250_000,
        allowed_sensitive_keys=frozenset({"releaseid", "route", "jobtypes", "dependencies", "requireddependencies"}),
        dry_run_only=True,
        notes=(
            "Dependency readiness reviews sanitized service/dependency health metadata only.",
            "Python does not call dependencies or mutate infrastructure; operators own remediation.",
        ),
    ),
    JobType.PLATFORM_PRODUCTION_READINESS: JobPolicy(
        owner="Platform / DevOps",
        data_classification="production-readiness-evidence-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "route", "jobtypes", "evidence", "requiredevidence", "artifactrefs"}),
        dry_run_only=True,
        notes=(
            "Production readiness aggregates sanitized gate outputs only.",
            "Deployment execution, traffic switches and rollback remain Node/CI/operator-owned.",
        ),
    ),
    JobType.PLATFORM_DATA_RETENTION_REVIEW: JobPolicy(
        owner="Platform / Compliance",
        data_classification="retention-policy-metadata-only",
        max_payload_bytes=500_000,
        allowed_sensitive_keys=frozenset({"releaseid", "route", "jobtypes", "retentionpolicies", "artifactsummary", "jobsummary", "gcsummary"}),
        dry_run_only=True,
        notes=(
            "Data retention review uses sanitized artifact/job retention metadata only.",
            "Python does not delete artifacts or mutate retention settings; GC execution remains operator-owned.",
        ),
    ),
    JobType.PLATFORM_AUDIT_TRAIL_REVIEW: JobPolicy(
        owner="Platform / Compliance",
        data_classification="audit-trail-metadata-only",
        max_payload_bytes=500_000,
        allowed_sensitive_keys=frozenset({"releaseid", "route", "jobtypes", "auditevents", "requiredeventfields", "evidence"}),
        dry_run_only=True,
        notes=(
            "Audit trail review inspects sanitized operational event metadata only.",
            "Python does not write audit logs, approve releases or change access policy.",
        ),
    ),

    JobType.PLATFORM_SECURITY_POSTURE_REVIEW: JobPolicy(
        owner="Platform / Security",
        data_classification="security-posture-metadata-only",
        max_payload_bytes=500_000,
        allowed_sensitive_keys=frozenset({"releaseid", "route", "jobtypes", "controls", "findings", "requiredcontrols"}),
        dry_run_only=True,
        notes=(
            "Security posture review evaluates sanitized control and finding metadata only.",
            "Python does not mutate auth, RBAC, cookies, CORS, rate limits or WAF controls.",
        ),
    ),
    JobType.PLATFORM_SUPPLY_CHAIN_REVIEW: JobPolicy(
        owner="Platform / Security",
        data_classification="supply-chain-scan-summary-only",
        max_payload_bytes=500_000,
        allowed_sensitive_keys=frozenset({"releaseid", "route", "jobtypes", "scans", "sbompresent", "lockfilespresent", "imagescanpresent"}),
        dry_run_only=True,
        notes=(
            "Supply chain review evaluates aggregated scan counts and evidence metadata only.",
            "Python does not pull images, update packages, create SBOMs or publish artifacts.",
        ),
    ),

    JobType.PLATFORM_SCHEMA_MIGRATION_REHEARSAL: JobPolicy(
        owner="Platform & DevOps",
        data_classification="schema-migration-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "route", "jobtypes", "migrations", "schemadrift", "rehearsalevidence"}),
        dry_run_only=True,
        notes=(
            "Python reviews sanitized migration metadata and rehearsal evidence only.",
            "Prisma migrations, schema changes and rollback execution remain Node/CI/operator-owned.",
        ),
    ),
    JobType.PLATFORM_BACKUP_RESTORE_DRILL: JobPolicy(
        owner="Platform & DevOps",
        data_classification="backup-restore-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "route", "jobtypes", "backups", "restoretests", "requiredstores"}),
        dry_run_only=True,
        notes=(
            "Python evaluates backup and restore drill metadata only, never backup contents.",
            "Database, Redis and artifact-store backup/restore execution remains infrastructure-owned.",
        ),
    ),

    JobType.PLATFORM_OBSERVABILITY_COVERAGE_REVIEW: JobPolicy(
        owner="Platform / Observability",
        data_classification="observability-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "route", "jobtypes", "traces", "metrics", "logs", "dashboards", "requiredsignals"}),
        dry_run_only=True,
        notes=(
            "Observability coverage review evaluates sanitized trace, metric, log and dashboard metadata only.",
            "Python does not create monitors, dashboards or instrumentation; operators own remediation.",
        ),
    ),
    JobType.PLATFORM_FEATURE_FLAG_REVIEW: JobPolicy(
        owner="Platform / Release Engineering",
        data_classification="feature-flag-metadata-only",
        max_payload_bytes=250_000,
        allowed_sensitive_keys=frozenset({"releaseid", "route", "jobtypes", "flags", "expectedsettings", "requiredflags"}),
        dry_run_only=True,
        notes=(
            "Feature flag review uses sanitized flag names and values; secret-like values are redacted in artifacts.",
            "Python does not mutate feature flags or traffic routing; Node/CI remains owner of rollout settings.",
        ),
    ),
    JobType.PLATFORM_DOMAIN_MIGRATION_READINESS: JobPolicy(
        owner="Platform / Release Engineering",
        data_classification="domain-migration-evidence-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "domain", "route", "jobtypes", "candidateowner", "evidence", "requiredevidence", "shadowcomparisonsummary", "canarygate"}),
        dry_run_only=True,
        notes=(
            "Domain migration readiness reviews sanitized gate outputs and owner approvals only.",
            "Node remains production owner until cutover is separately approved and executed by CI/operators.",
        ),
    ),
    JobType.PLATFORM_CUTOVER_PLAN: JobPolicy(
        owner="Platform / Release Engineering",
        data_classification="cutover-plan-metadata-only",
        max_payload_bytes=500_000,
        allowed_sensitive_keys=frozenset({"releaseid", "domain", "route", "jobtypes", "fromowner", "toowner", "evidence", "rollbacktriggers", "operatorapprovals"}),
        dry_run_only=True,
        notes=(
            "Cutover planning creates a dry-run plan only and must not mutate rollout state.",
            "Traffic promotion, owner changes and rollback remain Node/CI/operator-owned.",
        ),
    ),
    JobType.PLATFORM_OWNER_REGISTRY_REVIEW: JobPolicy(
        owner="Platform / Release Engineering",
        data_classification="owner-registry-metadata-only",
        max_payload_bytes=500_000,
        allowed_sensitive_keys=frozenset({"releaseid", "domain", "domains", "route", "jobtypes", "ownerregistry", "requiredowners", "approvals"}),
        dry_run_only=True,
        notes=(
            "Owner registry review checks domain/route ownership metadata before a cutover is accepted.",
            "Python does not mutate ownership, RBAC, on-call, ticketing or runtime routing configuration.",
        ),
    ),
    JobType.PLATFORM_POST_CUTOVER_MONITOR: JobPolicy(
        owner="Platform / Release Engineering",
        data_classification="post-cutover-telemetry-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "domain", "route", "jobtypes", "metrics", "thresholds", "evidence", "rollbacktriggers"}),
        dry_run_only=True,
        notes=(
            "Post-cutover monitor evaluates aggregate operational telemetry only.",
            "Python does not change rollout state; Node/CI/operators keep rollback authority.",
        ),
    ),
    JobType.PLATFORM_LEGACY_PATH_DECOMMISSION: JobPolicy(
        owner="Platform / Release Engineering",
        data_classification="legacy-path-decommission-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "domain", "route", "jobtypes", "legacypaths", "evidence", "requiredevidence", "fallbackplan", "rollbacktriggers"}),
        dry_run_only=True,
        notes=(
            "Legacy path decommission readiness evaluates sanitized path metadata only.",
            "Python does not remove routes, feature flags, Node handlers or deployments; CI/operators own code cleanup.",
        ),
    ),
    JobType.PLATFORM_STEADY_STATE_OPERATIONS_REVIEW: JobPolicy(
        owner="Platform / Operations",
        data_classification="steady-state-ops-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "domain", "route", "jobtypes", "runbooklinks", "dashboardlinks", "alertpolicies", "incidenthistory", "metrics", "thresholds", "evidence", "requiredoperationalcontrols"}),
        dry_run_only=True,
        notes=(
            "Steady-state operations review evaluates runbook/dashboard/alert and aggregate telemetry evidence only.",
            "Python produces an advisory operating report and cannot change ownership, on-call or traffic routing.",
        ),
    ),
    JobType.PLATFORM_QUEUE_RESILIENCE_REVIEW: JobPolicy(
        owner="Platform / DevOps",
        data_classification="queue-resilience-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "domain", "route", "jobtypes", "queues", "retrypolicy", "dlqpolicy", "idempotencyevidence", "metrics", "thresholds", "evidence"}),
        dry_run_only=True,
        notes=(
            "Queue resilience review evaluates aggregate queue and worker telemetry only.",
            "Python does not mutate Redis, Celery, workers, DLQs, rollout state or traffic routing.",
        ),
    ),
    JobType.PLATFORM_ARTIFACT_INTEGRITY_REVIEW: JobPolicy(
        owner="Platform / Security",
        data_classification="artifact-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "domain", "route", "jobtypes", "artifacts", "evidence", "requiredfields", "allowedpiiclasses"}),
        dry_run_only=True,
        notes=(
            "Artifact integrity review evaluates artifact metadata only and never reads artifact payloads.",
            "Node remains owner of artifact authorization, delivery and access auditing.",
        ),
    ),
    JobType.PLATFORM_RUNBOOK_FRESHNESS_REVIEW: JobPolicy(
        owner="Platform / Operations",
        data_classification="runbook-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "domain", "route", "jobtypes", "runbooks", "evidence", "thresholds", "ownerregistry"}),
        dry_run_only=True,
        notes=("Runbook freshness review evaluates metadata only.", "Python does not mutate docs, ownership or rollout state."),
    ),
    JobType.PLATFORM_SUPPORT_ESCALATION_REVIEW: JobPolicy(
        owner="Platform / Support",
        data_classification="support-escalation-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "domain", "route", "jobtypes", "supporttiers", "escalationpaths", "evidence", "thresholds", "ownerregistry"}),
        dry_run_only=True,
        notes=("Support escalation review checks sanitized support tier metadata only.", "Python does not page teams or mutate ticketing/on-call config."),
    ),

    JobType.PLATFORM_COST_GUARDRAIL_REVIEW: JobPolicy(owner="Platform & FinOps", data_classification="finops-aggregate-cost-metadata-only", max_payload_bytes=750_000, allowed_sensitive_keys=frozenset({"releaseid", "route", "jobtypes", "costs", "budgets", "forecast", "thresholds", "evidence"}), dry_run_only=True, notes=("Python reviews aggregate FinOps evidence only; it cannot mutate cloud or provider billing configuration.",)),
    JobType.PLATFORM_ENVIRONMENT_PARITY_REVIEW: JobPolicy(owner="Platform & Release Engineering", data_classification="environment-config-metadata-only", max_payload_bytes=750_000, allowed_sensitive_keys=frozenset({"releaseid", "route", "jobtypes", "staging", "production", "requiredkeys", "requiredservices", "driftallowlist", "evidence"}), dry_run_only=True, notes=("Python compares environment metadata and secret fingerprints only; secret values must never be included.",)),
    JobType.PLATFORM_ACCESS_CONTROL_REVIEW: JobPolicy(owner="Platform & Security", data_classification="authorization-evidence-metadata-only", max_payload_bytes=1_000_000, allowed_sensitive_keys=frozenset({"releaseid", "domain", "route", "jobtypes", "controls", "authorizationmatrix", "abacpolicies", "objectaccesstests", "negativetests", "testresults", "evidence", "thresholds", "requiredcontrols"}), dry_run_only=True, notes=("Python reviews RBAC/ABAC/object-level authorization evidence only; Node remains the authz source of truth.", "Use hashed actor/resource identifiers and negative-test outcomes only; no request cookies, bearer tokens or raw clinical records.")),
    JobType.PLATFORM_DATA_QUALITY_REVIEW: JobPolicy(owner="Platform & Data", data_classification="data-quality-aggregate-metadata-only", max_payload_bytes=1_000_000, allowed_sensitive_keys=frozenset({"releaseid", "domain", "route", "jobtypes", "datasets", "metrics", "thresholds", "evidence", "requiredchecks", "allowedpiiclasses"}), dry_run_only=True, notes=("Python reviews aggregate freshness/null/duplicate/schema/redaction metrics only.", "Dataset samples must be redacted or omitted; Node/data pipelines remain owners of source reads and repairs.")),

    JobType.PLATFORM_CI_STAGING_VALIDATION_REVIEW: JobPolicy(
        owner="Platform & DevOps",
        data_classification="ci-staging-validation-metadata-only",
        max_payload_bytes=1_000_000,
        allowed_sensitive_keys=frozenset({"releaseid", "domain", "route", "jobtypes", "checks", "builds", "docker", "hmac", "redis", "artifactregistry", "canary", "observability", "evidence", "requiredchecks"}),
        dry_run_only=True,
        notes=(
            "Python reviews sanitized CI/staging evidence only; it does not run npm, Docker, migrations, deployments or smoke traffic.",
            "Use this gate to close the V24+ technical checklist before any canary increase.",
        ),
    ),
    JobType.PLATFORM_RELEASE_CLOSURE_REVIEW: JobPolicy(
        owner="Platform & DevOps",
        data_classification="release-closure-evidence-metadata-only",
        max_payload_bytes=1_000_000,
        allowed_sensitive_keys=frozenset({"releaseid", "domain", "route", "jobtypes", "gateresults", "evidencebundle", "validationsummary", "risks", "approvals", "requiredgates"}),
        dry_run_only=True,
        notes=(
            "Python composes a final closure decision from sanitized gate summaries and artifact references only.",
            "Deployment approval, release ticket closure and rollback execution remain CI/operator-owned.",
        ),
    ),

    JobType.PLATFORM_PRODUCTION_CANARY_OBSERVATION_REVIEW: JobPolicy(
        owner="Platform & SRE",
        data_classification="production-canary-observation-metadata-only",
        max_payload_bytes=1_000_000,
        allowed_sensitive_keys=frozenset({"releaseid", "domain", "route", "jobtypes", "windowminutes", "currentcanarypercent", "targetcanarypercent", "metrics", "thresholds", "signals", "evidence", "rollbacktriggers", "requiredsignals"}),
        dry_run_only=True,
        notes=(
            "Python reviews sanitized production canary telemetry only; it does not change rollout percentages or route traffic.",
            "Metrics must be aggregates or artifact references; no request payloads, PHI, cookies or tokens are allowed.",
        ),
    ),
    JobType.PLATFORM_INCIDENT_RESPONSE_READINESS_REVIEW: JobPolicy(
        owner="Platform & SRE",
        data_classification="incident-response-readiness-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "domain", "route", "jobtypes", "oncall", "escalationpaths", "runbooks", "comms", "drills", "thresholds", "evidence", "requiredcoverage"}),
        dry_run_only=True,
        notes=(
            "Python reviews incident-response readiness metadata only; it does not page responders or mutate on-call/ticketing systems.",
            "Use hashed owner identifiers and links/artifact ids rather than secrets, tokens or patient data.",
        ),
    ),
    JobType.PLATFORM_TRAFFIC_PROMOTION_READINESS_REVIEW: JobPolicy(
        owner="Platform & SRE",
        data_classification="traffic-promotion-readiness-metadata-only",
        max_payload_bytes=1_000_000,
        allowed_sensitive_keys=frozenset({"releaseid", "domain", "route", "jobtypes", "currentcanarypercent", "targetcanarypercent", "maxpromotionsteppercent", "gateevidence", "productionobservation", "incidentreadiness", "approvals", "freezewindows", "rollbackplan", "evidence", "thresholds", "requiredgates"}),
        dry_run_only=True,
        notes=("Python reviews sanitized promotion readiness evidence only; it cannot increase traffic or mutate rollout state.", "Node/control-plane remains source of truth for feature flags, canary percentages and production routing."),
    ),
    JobType.PLATFORM_EVIDENCE_RETENTION_AUDIT_REVIEW: JobPolicy(
        owner="Platform & Compliance",
        data_classification="evidence-retention-audit-metadata-only",
        max_payload_bytes=1_000_000,
        allowed_sensitive_keys=frozenset({"releaseid", "domain", "route", "jobtypes", "artifacts", "evidencebundle", "retentionpolicy", "allowedpiiclasses", "requiredartifacttypes", "requirechecksums", "requireprotecteddownloads", "requireredaction", "evidence"}),
        dry_run_only=True,
        notes=("Python audits artifact metadata, checksums, retention and redaction flags only; it does not delete or expose artifacts.", "Use artifact ids, sha256 values and piiClass labels rather than raw logs, PHI, tokens or payload bodies."),
    ),
    JobType.PLATFORM_SLO_ERROR_BUDGET_REVIEW: JobPolicy(
        owner="Platform & SRE",
        data_classification="slo-error-budget-metadata-only",
        max_payload_bytes=1_000_000,
        allowed_sensitive_keys=frozenset({"releaseid", "domain", "route", "jobtypes", "windowminutes", "slotargets", "metrics", "services", "thresholds", "evidence", "requiredsignals"}),
        dry_run_only=True,
        notes=("Python evaluates sanitized SLO/error-budget evidence only; it does not change alerting, paging or rollout state.", "Use aggregate metrics and service names, not request bodies, patient data, tokens or raw logs."),
    ),
    JobType.PLATFORM_AUTO_ROLLBACK_SAFEGUARD_REVIEW: JobPolicy(
        owner="Platform & SRE",
        data_classification="auto-rollback-safeguard-metadata-only",
        max_payload_bytes=1_000_000,
        allowed_sensitive_keys=frozenset({"releaseid", "domain", "route", "jobtypes", "rolloutid", "canarypercent", "safeguards", "rollbacktriggers", "featureflags", "runbook", "evidence", "requiredsafeguards"}),
        dry_run_only=True,
        notes=("Python verifies rollback safeguard evidence only; Node/control-plane owns rollback execution and feature flag mutation.", "Submit trigger status, drill evidence and kill-switch metadata, not credentials or raw production payloads."),
    ),
    JobType.PLATFORM_THIRD_PARTY_DEPENDENCY_REVIEW: JobPolicy(
        owner="Platform & SRE",
        data_classification="third-party-dependency-metadata-only",
        max_payload_bytes=1_000_000,
        allowed_sensitive_keys=frozenset({"releaseid", "domain", "route", "jobtypes", "dependencies", "providers", "incidents", "statuspages", "thresholds", "evidence", "requireddependencies"}),
        dry_run_only=True,
        notes=("Python reviews external dependency health and readiness metadata only; it does not call vendors or change configuration.", "Submit status, latency, error-rate, rate-limit and failover evidence only; never include API keys, tokens, webhook secrets or PHI."),
    ),
    JobType.PLATFORM_CAPACITY_SCALING_READINESS_REVIEW: JobPolicy(
        owner="Platform & SRE",
        data_classification="capacity-scaling-readiness-metadata-only",
        max_payload_bytes=1_000_000,
        allowed_sensitive_keys=frozenset({"releaseid", "domain", "route", "jobtypes", "targetcanarypercent", "currentcanarypercent", "metrics", "queues", "workers", "autoscaling", "loadtest", "thresholds", "evidence", "requiredsignals"}),
        dry_run_only=True,
        notes=("Python evaluates sanitized capacity and scaling evidence only; it cannot change autoscaling or traffic.", "Use aggregate queue, worker, CPU, memory and load-test metrics; exclude request bodies, credentials, raw logs and patient data."),
    ),
    JobType.PLATFORM_COMPLIANCE_PRIVACY_EVIDENCE_REVIEW: JobPolicy(
        owner="Platform & Compliance",
        data_classification="compliance-privacy-evidence-metadata-only",
        max_payload_bytes=1_000_000,
        allowed_sensitive_keys=frozenset({"releaseid", "domain", "route", "jobtypes", "evidence", "artifacts", "privacyreviews", "compliancecontrols", "dpia", "dparecords", "approvals", "requiredevidence", "allowedpiiclasses"}),
        dry_run_only=True,
        notes=("Python reviews sanitized compliance/privacy evidence only; it does not mutate privacy systems, approvals or artifact ACLs.", "Submit gate decisions, artifact metadata, DPA/DPIA state and approval names only; exclude PHI, raw logs, secrets and tokens."),
    ),
    JobType.PLATFORM_RUNBOOK_DRILL_VERIFICATION_REVIEW: JobPolicy(
        owner="Platform & SRE",
        data_classification="runbook-drill-verification-metadata-only",
        max_payload_bytes=1_000_000,
        allowed_sensitive_keys=frozenset({"releaseid", "domain", "route", "jobtypes", "runbooks", "drills", "scenarios", "evidence", "requiredrunbooks", "requireddrills"}),
        dry_run_only=True,
        notes=("Python verifies runbook/drill metadata only; it does not mutate runbooks, ticketing, incidents or paging systems.", "Use links, artifact ids, owner acknowledgement flags and drill outcomes; exclude credentials, private incident notes and PHI."),
    ),
    JobType.PLATFORM_DISASTER_RECOVERY_BACKUP_REVIEW: JobPolicy(
        owner="Platform & SRE",
        data_classification="disaster-recovery-backup-metadata-only",
        max_payload_bytes=1_000_000,
        allowed_sensitive_keys=frozenset({"releaseid", "domain", "route", "jobtypes", "backups", "restoredrills", "dependencies", "rportotargets", "thresholds", "evidence", "requiredbackups", "requireencryption", "requirerestoredrill", "requireoffsitecopy"}),
        dry_run_only=True,
        notes=("Python reviews DR/backup metadata only; it does not start restores, touch backups or mutate secrets.", "Submit backup ids, age, checksum, encryption, offsite and restore-drill outcomes only; exclude secrets, PHI, raw dumps and credentials."),
    ),
    JobType.PLATFORM_CHANGE_MIGRATION_READINESS_REVIEW: JobPolicy(
        owner="Platform & DevOps",
        data_classification="change-migration-readiness-metadata-only",
        max_payload_bytes=1_000_000,
        allowed_sensitive_keys=frozenset({"releaseid", "domain", "route", "jobtypes", "migrations", "changetickets", "approvals", "rollbackplan", "rolloutplan", "databackfill", "evidence", "requiredmigrations", "requireapproval", "requirerollbackplan", "requirebackupbeforemigration", "requiredryrunrehearsal"}),
        dry_run_only=True,
        notes=("Python reviews change/migration readiness metadata only; it does not apply migrations, approve tickets or mutate schemas.", "Submit sanitized ticket ids, migration names, dry-run status, approvals and rollback/backout metadata only; exclude SQL dumps, secrets, raw logs and PHI."),
    ),
    JobType.PLATFORM_CONFIGURATION_SECRET_ROTATION_REVIEW: JobPolicy(
        owner="Platform & Security",
        data_classification="configuration-secret-rotation-metadata-only",
        max_payload_bytes=1_000_000,
        allowed_sensitive_keys=frozenset({"releaseid", "domain", "route", "jobtypes", "secrets", "configitems", "rotations", "evidence", "requiredsecrets", "maxsecretagedays", "maxconfigdriftcount", "requirerotationwindow", "requireexternalsecretstore", "requirebreakglass"}),
        dry_run_only=True,
        notes=("Python reviews sanitized configuration and secret-rotation metadata only; it does not read, rotate or expose secret values.", "Submit secret names, age, store, rotation status and config drift counts only; exclude secret values, tokens, PHI, raw env dumps and credentials."),
    ),
    JobType.PLATFORM_MAINTENANCE_WINDOW_READINESS_REVIEW: JobPolicy(
        owner="Platform & SRE",
        data_classification="maintenance-window-readiness-metadata-only",
        max_payload_bytes=1_000_000,
        allowed_sensitive_keys=frozenset({"releaseid", "domain", "route", "jobtypes", "maintenancewindows", "tasks", "freezeperiods", "approvals", "comms", "evidence", "requiredtasks", "maxwindowagedays", "requireapproval", "requirecomms", "requirerollbacktask", "requirelowtrafficwindow"}),
        dry_run_only=True,
        notes=("Python reviews maintenance-window readiness metadata only; it does not schedule maintenance, page operators or change traffic.", "Submit window ids, timings, approvals, comms status and task completion flags only; exclude private incident notes, raw logs, PHI and credentials."),
    ),
    JobType.PLATFORM_AUDIT_FORENSICS_READINESS_REVIEW: JobPolicy(
        owner="Platform & Security",
        data_classification="audit-forensics-readiness-metadata-only",
        max_payload_bytes=1_000_000,
        allowed_sensitive_keys=frozenset({"releaseid", "domain", "route", "jobtypes", "audittrails", "forensicartifacts", "investigationdrills", "chainofcustody", "evidence", "requiredsources", "maxauditgapminutes", "maxartifactagedays", "requireimmutablestorage", "requirechainofcustody", "requireinvestigationdrill"}),
        dry_run_only=True,
        notes=("Python reviews sanitized audit and forensic readiness metadata only; it does not query logs, export evidence or mutate incident investigations.", "Submit audit source names, gap minutes, immutability, artifact ids, redaction flags and drill outcomes only; exclude raw logs, PHI, credentials and tokens."),
    ),
    JobType.PLATFORM_BUSINESS_CONTINUITY_READINESS_REVIEW: JobPolicy(
        owner="Platform & Operations",
        data_classification="business-continuity-readiness-metadata-only",
        max_payload_bytes=1_000_000,
        allowed_sensitive_keys=frozenset({"releaseid", "domain", "route", "jobtypes", "continuityplans", "teams", "communications", "fallbackprocedures", "exercises", "evidence", "requiredplans", "maxexerciseagedays", "requireownerack", "requirecomms", "requirefallback", "requireexercise"}),
        dry_run_only=True,
        notes=("Python reviews business-continuity readiness metadata only; it does not page teams, send customer communications or execute fallback procedures.", "Submit plan names, owner acknowledgements, roster coverage, comms status, fallback and exercise outcomes only; exclude private customer data, PHI, raw incident notes and credentials."),
    ),
    JobType.PLATFORM_POST_INCIDENT_LEARNING_REVIEW: JobPolicy(
        owner="Platform & SRE",
        data_classification="post-incident-learning-metadata-only",
        max_payload_bytes=1_000_000,
        allowed_sensitive_keys=frozenset({"releaseid", "domain", "route", "jobtypes", "incidents", "postmortems", "actionitems", "regressions", "evidence", "requiredincidentclasses", "maxopenactionitemagedays", "requirepostmortem", "requireownerack", "requireregressiontest"}),
        dry_run_only=True,
        notes=("Python reviews sanitized post-incident learning metadata only; it does not mutate incident tickets, postmortems or remediation backlog.", "Submit incident classes, postmortem status, action item ages and regression guard outcomes only; exclude PHI, raw incident notes, secrets and credentials."),
    ),
    JobType.PLATFORM_TECH_DEBT_GOVERNANCE_REVIEW: JobPolicy(
        owner="Platform & Engineering",
        data_classification="tech-debt-governance-metadata-only",
        max_payload_bytes=1_000_000,
        allowed_sensitive_keys=frozenset({"releaseid", "domain", "route", "jobtypes", "debtitems", "waivers", "ownership", "remediationplan", "evidence", "requiredcategories", "maxcriticaldebtitems", "maxwaiveragedays", "requireownerack", "requireremediationplan"}),
        dry_run_only=True,
        notes=("Python reviews sanitized technical-debt governance metadata only; it does not mutate backlog, waivers or remediation plans.", "Submit category, severity, ownership, waiver and remediation-plan metadata only; exclude source secrets, raw customer data, PHI and credentials."),
    ),
    JobType.PLATFORM_VENDOR_RESILIENCE_REVIEW: JobPolicy(
        owner="Platform & SRE",
        data_classification="vendor-resilience-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "domain", "route", "jobtypes", "vendors", "services", "incidents", "exitplans", "evidence"}),
        dry_run_only=True,
        notes=(
            "Python reviews sanitized vendor/dependency resilience metadata only; no credentials, contracts or raw support threads are allowed.",
            "Vendor remediation, escalation, procurement and provider configuration remain owned by Node/control-plane and operators.",
        ),
    ),
    JobType.PLATFORM_KNOWLEDGE_TRANSFER_READINESS_REVIEW: JobPolicy(
        owner="Platform & Engineering",
        data_classification="knowledge-transfer-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "domain", "route", "jobtypes", "knowledgeartifacts", "owners", "trainingsessions", "handoffchecklists", "evidence"}),
        dry_run_only=True,
        notes=(
            "Python reviews sanitized handoff, training and ownership metadata only; no customer data or proprietary runbook secrets are required.",
            "Ownership changes, calendar invites, training assignments and documentation publication remain operator-owned outside Python.",
        ),
    ),
    JobType.PLATFORM_ARCHITECTURE_OWNERSHIP_REVIEW: JobPolicy(
        owner="Platform & Architecture",
        data_classification="architecture-ownership-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "domain", "route", "jobtypes", "architectureartifacts", "serviceboundaries", "owners", "decisionrecords", "evidence"}),
        dry_run_only=True,
        notes=("Python reviews sanitized architecture, ownership and ADR metadata only; no source code, secrets or customer data are required.", "Architecture changes and ownership assignment remain owned by Node/control-plane and operators."),
    ),
    JobType.PLATFORM_EXECUTIVE_METRICS_GOVERNANCE_REVIEW: JobPolicy(
        owner="Platform & Leadership",
        data_classification="executive-metrics-governance-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "domain", "route", "jobtypes", "metricdefinitions", "dashboards", "reviewcadence", "owners", "evidence"}),
        dry_run_only=True,
        notes=("Python reviews sanitized metrics-governance metadata only; no raw events, PHI or financial ledgers are required.", "Metric publication, executive reporting and dashboard ownership remain operator-owned outside Python."),
    ),

    JobType.PLATFORM_DOMAIN_ADOPTION_READINESS_REVIEW: JobPolicy(
        owner="Platform & Domain Owners",
        data_classification="domain-adoption-readiness-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "phase", "domain", "route", "jobtypes", "domains", "owners", "rollbackplan", "evidence"}),
        dry_run_only=True,
        notes=("Python reviews sanitized Phase 2 domain-adoption metadata only; no tenant data, secrets or patient data are required.", "Domain adoption, feature flag changes and routing promotion remain operator-owned outside Python."),
    ),
    JobType.PLATFORM_PHASE_TWO_ROLLOUT_GOVERNANCE_REVIEW: JobPolicy(
        owner="Platform & Release Governance",
        data_classification="phase-two-rollout-governance-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "phase", "domain", "route", "jobtypes", "milestones", "approvals", "cohorts", "guardrails", "communicationsplan", "supportplan", "evidence"}),
        dry_run_only=True,
        notes=("Python reviews sanitized Phase 2 rollout-governance metadata only; no user lists, PHI or customer communications are required.", "Traffic promotion, user notification, cohort mutation and final approvals remain operator-owned outside Python."),
    ),

    JobType.PLATFORM_DOMAIN_PILOT_EXECUTION_REVIEW: JobPolicy(
        owner="Platform & Domain Owners",
        data_classification="domain-pilot-execution-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "phase", "domain", "route", "jobtypes", "pilotdomains", "pilotruns", "acceptancecriteria", "operatorapprovals", "rollbackplan", "evidence"}),
        dry_run_only=True,
        notes=("Python reviews sanitized Phase 2 pilot execution metadata only; no tenant data, PHI, secrets or production user lists are required.", "Pilot execution, domain enablement, traffic allocation and final promotion remain operator-owned outside Python."),
    ),
    JobType.PLATFORM_PHASE_TWO_EXPANSION_CONTROL_REVIEW: JobPolicy(
        owner="Platform & Release Governance",
        data_classification="phase-two-expansion-control-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "phase", "domain", "route", "jobtypes", "waves", "trafficlimits", "rollbacktriggers", "checkpoints", "approvals", "evidence"}),
        dry_run_only=True,
        notes=("Python reviews sanitized Phase 2 expansion-control metadata only; no patient data, customer lists or secrets are required.", "Expansion waves, traffic percentages, rollback activation and approvals remain operator-owned outside Python."),
    ),
    JobType.PLATFORM_DOMAIN_OUTCOME_MEASUREMENT_REVIEW: JobPolicy(
        owner="Platform & Domain Owners",
        data_classification="domain-outcome-measurement-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "phase", "domain", "route", "jobtypes", "outcomemetrics", "baselines", "adoptionsignals", "supportsignals", "evidence"}),
        dry_run_only=True,
        notes=("Python reviews sanitized Phase 2 outcome metrics only; no raw events, tenant records, PHI, secrets or customer lists are required.", "Outcome publication, product decisions, domain promotion and remediation remain operator-owned outside Python."),
    ),
    JobType.PLATFORM_PHASE_TWO_FEEDBACK_ADOPTION_REVIEW: JobPolicy(
        owner="Platform & Product Operations",
        data_classification="phase-two-feedback-adoption-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "phase", "domain", "route", "jobtypes", "feedbackitems", "adoptiondecisions", "ownerresponses", "communications", "evidence"}),
        dry_run_only=True,
        notes=("Python reviews sanitized Phase 2 feedback/adoption metadata only; no support-thread bodies, PHI, user lists or secrets are required.", "Feedback triage, customer communication, roadmap decisions and rollout changes remain operator-owned outside Python."),
    ),
    JobType.PLATFORM_DOMAIN_GRADUATION_READINESS_REVIEW: JobPolicy(
        owner="Platform & Domain Owners",
        data_classification="domain-graduation-readiness-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "phase", "domain", "route", "jobtypes", "graduationcandidates", "graduationcriteria", "outcomesummary", "riskregister", "approvals", "evidence"}),
        dry_run_only=True,
        notes=("Python reviews sanitized Phase 2 graduation metadata only; no raw events, PHI, tenant records, secrets or customer lists are required.", "Domain graduation, traffic changes, feature enablement and rollback actions remain operator-owned outside Python."),
    ),
    JobType.PLATFORM_PHASE_TWO_LEARNING_CONSOLIDATION_REVIEW: JobPolicy(
        owner="Platform & Product Operations",
        data_classification="phase-two-learning-consolidation-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "phase", "domain", "route", "jobtypes", "learnings", "experiments", "decisions", "playbookupdates", "owners", "evidence"}),
        dry_run_only=True,
        notes=("Python reviews sanitized Phase 2 learning metadata only; no user feedback bodies, PHI, support transcripts, secrets or raw telemetry are required.", "Playbook changes, roadmap choices, communications and rollout state remain operator-owned outside Python."),
    ),
    JobType.PLATFORM_DOMAIN_WIDE_ADOPTION_READINESS_REVIEW: JobPolicy(
        owner="Platform & Domain Owners",
        data_classification="domain-wide-adoption-readiness-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "phase", "domain", "route", "jobtypes", "adoptiondomains", "rolloutevidence", "ownerapprovals", "supportreadiness", "rollbackplan", "evidence"}),
        dry_run_only=True,
        notes=("Python reviews sanitized Phase 2 broad-adoption metadata only; no raw events, PHI, tenant records, secrets or customer lists are required.", "Domain-wide adoption, traffic expansion, feature enablement and rollback actions remain operator-owned outside Python."),
    ),
    JobType.PLATFORM_PHASE_TWO_SUPPORT_TRANSITION_REVIEW: JobPolicy(
        owner="Platform & Support Operations",
        data_classification="phase-two-support-transition-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "phase", "domain", "route", "jobtypes", "supportqueues", "escalationpaths", "trainingartifacts", "runbookupdates", "ownerapprovals", "evidence"}),
        dry_run_only=True,
        notes=("Python reviews sanitized Phase 2 support-transition metadata only; no support transcript bodies, PHI, user lists or secrets are required.", "Support ownership, escalation routing, communications and queue changes remain operator-owned outside Python."),
    ),
    JobType.PLATFORM_DOMAIN_ADOPTION_STABILIZATION_REVIEW: JobPolicy(
        owner="Platform & Domain Owners",
        data_classification="domain-adoption-stabilization-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "phase", "domain", "route", "jobtypes", "stabilizationdomains", "healthsignals", "supportsignals", "regressionwatch", "approvals", "evidence"}),
        dry_run_only=True,
        notes=("Python reviews sanitized Phase 2 stabilization metadata only; no raw telemetry, PHI, tenant records, support transcripts, user lists or secrets are required.", "Stabilization actions, traffic changes, user communications and rollback remain operator-owned outside Python."),
    ),
    JobType.PLATFORM_PHASE_TWO_VALUE_REALIZATION_REVIEW: JobPolicy(
        owner="Platform, Product & Executive Sponsors",
        data_classification="phase-two-value-realization-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "phase", "domain", "route", "jobtypes", "valuemetrics", "benefitbaselines", "adoptionsummary", "executivereviews", "ownerapprovals", "evidence"}),
        dry_run_only=True,
        notes=("Python reviews sanitized value-realization metadata only; no raw financial records, PHI, tenant records, user lists or secrets are required.", "Executive reporting, ROI decisions, roadmap choices and adoption commitments remain operator-owned outside Python."),
    ),

    JobType.PLATFORM_PHASE_TWO_CLOSURE_ACCEPTANCE_REVIEW: JobPolicy(
        owner="Platform, Product & Executive Sponsors",
        data_classification="phase-two-closure-acceptance-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "phase", "domain", "route", "jobtypes", "closurecriteria", "acceptanceevidence", "openrisks", "approvals", "valuerealizationsummary", "supporttransition", "evidence"}),
        dry_run_only=True,
        notes=("Python reviews sanitized Phase 2 closure acceptance metadata only; no raw financial records, PHI, tenant records, support transcripts, user lists or secrets are required.", "Phase closure, executive signoff, adoption commitments and next-phase entry remain operator-owned outside Python."),
    ),
    JobType.PLATFORM_PHASE_THREE_TRANSITION_READINESS_REVIEW: JobPolicy(
        owner="Platform & Program Operations",
        data_classification="phase-three-transition-readiness-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "phase", "nextphase", "domain", "route", "jobtypes", "transitionmilestones", "dependencyreadiness", "ownerhandoffs", "rolloutguardrails", "entrycriteria", "approvals", "evidence"}),
        dry_run_only=True,
        notes=("Python reviews sanitized Phase 3 transition-readiness metadata only; no raw telemetry, PHI, tenant records, secrets or customer lists are required.", "Phase transition, traffic changes, ownership transfer and roadmap commitments remain operator-owned outside Python."),
    ),

    JobType.PLATFORM_PHASE_THREE_DOMAIN_WAVE_READINESS_REVIEW: JobPolicy(
        owner="Platform & Domain Rollout Leads",
        data_classification="phase-three-domain-wave-readiness-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "phase", "waveid", "domain", "route", "jobtypes", "domains", "wavecriteria", "guardrails", "supportcoverage", "rollbackcoverage", "approvals", "evidence"}),
        dry_run_only=True,
        notes=("Python reviews sanitized Phase 3 domain-wave readiness metadata only; no raw tenant records, PHI, customer lists, support transcripts, feature flag secrets or credentials are required.", "Wave launch, traffic increase, customer communications and rollback execution remain operator-owned outside Python."),
    ),
    JobType.PLATFORM_PHASE_THREE_OPERATING_MODEL_ALIGNMENT_REVIEW: JobPolicy(
        owner="Platform, SRE & Domain Operations",
        data_classification="phase-three-operating-model-alignment-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "phase", "operatingmodel", "domain", "route", "jobtypes", "ownershipmatrix", "supportmodel", "runbookcoverage", "metricgovernance", "trainingcoverage", "escalationmodel", "approvals", "evidence"}),
        dry_run_only=True,
        notes=("Python reviews sanitized Phase 3 operating-model alignment metadata only; no raw HR data, customer records, secrets, PHI, ticket transcripts or private staffing details are required.", "Operating model changes, staffing assignments, support queues and executive governance remain operator-owned outside Python."),
    ),
    JobType.PLATFORM_PHASE_THREE_WAVE_EXECUTION_REVIEW: JobPolicy(
        owner="Platform & Domain Rollout Leads",
        data_classification="phase-three-wave-execution-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "phase", "waveid", "domain", "route", "jobtypes", "waveexecution", "domainsignals", "guardrailchecks", "rollbackreadiness", "supportincidents", "approvals", "evidence"}),
        dry_run_only=True,
        notes=("Python reviews sanitized Phase 3 wave-execution metadata only; no raw telemetry, PHI, tenant records, feature flag secrets, support transcripts or customer lists are required.", "Wave execution, traffic expansion, feature flags, customer communication and rollback execution remain operator-owned outside Python."),
    ),
    JobType.PLATFORM_PHASE_THREE_ADOPTION_VALUE_TRACKING_REVIEW: JobPolicy(
        owner="Platform, Product & Domain Owners",
        data_classification="phase-three-adoption-value-tracking-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "phase", "waveid", "domain", "route", "jobtypes", "adoptionmetrics", "valuemetrics", "userfeedback", "benefithypotheses", "ownerreviews", "approvals", "evidence"}),
        dry_run_only=True,
        notes=("Python reviews sanitized Phase 3 adoption/value metadata only; no raw user lists, support transcripts, financial records, PHI, tenant records or secrets are required.", "Metrics stores, executive reporting, roadmap changes, traffic decisions and customer communications remain operator-owned outside Python."),
    ),
    JobType.PLATFORM_PHASE_THREE_GAP_REMEDIATION_REVIEW: JobPolicy(
        owner="Platform, Program Operations & Domain Owners",
        data_classification="phase-three-gap-remediation-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "phase", "waveid", "domain", "route", "jobtypes", "remediationitems", "openrisks", "riskacceptances", "owneractions", "evidence"}),
        dry_run_only=True,
        notes=("Python reviews sanitized Phase 3 remediation metadata only; no raw tickets, support transcripts, PHI, tenant records, secrets or financial records are required.", "Backlog updates, risk acceptance, remediation execution and rollout decisions remain operator-owned outside Python."),
    ),
    JobType.PLATFORM_MIGRATION_STAGE_COMPLETION_READINESS_REVIEW: JobPolicy(
        owner="Platform, Product & Executive Sponsors",
        data_classification="migration-stage-completion-readiness-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "stage", "phase", "domain", "route", "jobtypes", "completioncriteria", "validationresults", "closureapprovals", "residualrisks", "finalevidence"}),
        dry_run_only=True,
        notes=("Python reviews sanitized migration-stage completion metadata only; no raw operational logs, PHI, tenant records, secrets, or customer data are required.", "Stage closeout, executive approval, roadmap state and rollout state remain operator-owned outside Python."),
    ),
    JobType.PLATFORM_PHASE_THREE_REMEDIATION_CLOSURE_REVIEW: JobPolicy(
        owner="Platform, Program Operations & Domain Owners",
        data_classification="phase-three-remediation-closure-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "stage", "phase", "domain", "route", "jobtypes", "closureitems", "remediationevidence", "residualrisks", "acceptancerecords", "ownerapprovals", "evidence"}),
        dry_run_only=True,
        notes=("Python reviews sanitized Phase 3 remediation closure metadata only; no raw tickets, logs, PHI, tenant records, secrets or financial records are required.", "Ticket closure, risk approval, backlog state and rollout decisions remain operator-owned outside Python."),
    ),
    JobType.PLATFORM_EXECUTIVE_OPERATIONAL_HANDOFF_REVIEW: JobPolicy(
        owner="Platform, Product, SRE & Executive Sponsors",
        data_classification="executive-operational-handoff-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "stage", "phase", "domain", "route", "jobtypes", "executivesummary", "handoffitems", "supportmodel", "kpibaselines", "governancedecisions", "approvals", "evidence"}),
        dry_run_only=True,
        notes=("Python reviews sanitized executive and operational handoff metadata only; no raw personnel data, customer data, PHI, secrets, or financial records are required.", "Ownership assignment, support queue changes, KPI publication and stage closure remain operator-owned outside Python."),
    ),

    JobType.PLATFORM_GLOBAL_TASK_STATUS_TRACKING_REVIEW: JobPolicy(
        owner="Platform, Program Operations & PMO",
        data_classification="global-task-status-tracking-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "stage", "phase", "domain", "route", "jobtypes", "tasks", "milestones", "owners", "blockers", "approvals", "evidence"}),
        dry_run_only=True,
        notes=(
            "Python reviews sanitized global task status metadata only; no raw support transcripts, PHI, tenant records, secrets or personal task comments are required.",
            "Task assignment, ticket mutation, executive reporting and project closure remain operator-owned outside Python.",
        ),
    ),
    JobType.PLATFORM_PROJECT_STATE_HEALTH_REVIEW: JobPolicy(
        owner="Platform, Product & Executive Sponsors",
        data_classification="project-state-health-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "stage", "phase", "domain", "route", "jobtypes", "applications", "migrationstatus", "riskregister", "closurecriteria", "approvals", "evidence"}),
        dry_run_only=True,
        notes=(
            "Python reviews sanitized project-state health metadata only; no raw customer data, PHI, payroll/financial records, secrets or user lists are required.",
            "Global project status, resourcing, acceptance and phase-exit decisions remain operator-owned outside Python.",
        ),
    ),

    JobType.PLATFORM_FINAL_ACCEPTANCE_EVIDENCE_REVIEW: JobPolicy(
        owner="Platform, PMO, QA & Executive Sponsors",
        data_classification="final-acceptance-evidence-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "stage", "phase", "domain", "route", "jobtypes", "acceptancecriteria", "validationevidence", "testresults", "residualrisks", "signoffs", "approvals", "evidence"}),
        dry_run_only=True,
        notes=(
            "Python reviews sanitized final-acceptance evidence metadata only; no raw test logs, support transcripts, PHI, tenant records, secrets or personal comments are required.",
            "Acceptance, risk approval, QA signoff, evidence archiving and stage exit remain operator-owned outside Python.",
        ),
    ),
    JobType.PLATFORM_STAGE_EXIT_READINESS_REVIEW: JobPolicy(
        owner="Platform, SRE, Product & Executive Sponsors",
        data_classification="stage-exit-readiness-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "stage", "phase", "targetstate", "domain", "route", "jobtypes", "exitcriteria", "operationalhandoff", "evidencebundle", "rollbackplan", "supportreadiness", "approvals", "evidence"}),
        dry_run_only=True,
        notes=(
            "Python reviews sanitized stage-exit readiness metadata only; no raw operational logs, customer data, PHI, support transcripts, secrets or financial records are required.",
            "Stage exit, release state, roadmap, ownership and support queue changes remain operator-owned outside Python.",
        ),
    ),

    JobType.PLATFORM_STAGE_CLOSURE_CERTIFICATION_REVIEW: JobPolicy(
        owner="Platform, PMO, QA & Executive Sponsors",
        data_classification="stage-closure-certification-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "stage", "phase", "domain", "route", "jobtypes", "certificationitems", "finalevidence", "signoffs", "releaseartifacts", "residualrisks", "evidence"}),
        dry_run_only=True,
        notes=(
            "Python reviews sanitized closure-certification metadata only; no raw test logs, customer data, PHI, credentials, secrets or support transcripts are required.",
            "Formal stage certification, risk closure, release approval and executive publication remain operator-owned outside Python.",
        ),
    ),
    JobType.PLATFORM_POST_CLOSURE_OPERATIONAL_TRANSITION_REVIEW: JobPolicy(
        owner="Platform, SRE, Product Operations & Support",
        data_classification="post-closure-operational-transition-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "stage", "phase", "domain", "operatingmode", "route", "jobtypes", "transitionitems", "monitoringplan", "ownershiphandoff", "supportreadiness", "kpibaselines", "approvals", "evidence"}),
        dry_run_only=True,
        notes=(
            "Python reviews sanitized post-closure transition metadata only; no incident transcripts, PHI, support tickets, alert secrets or production logs are required.",
            "Ownership, support queues, monitoring configuration, roadmap updates and operating-mode changes remain operator-owned outside Python.",
        ),
    ),
    JobType.PLATFORM_POST_CLOSURE_MONITORING_REVIEW: JobPolicy(
        owner="Platform, SRE, Product Operations & Support",
        data_classification="post-closure-monitoring-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "stage", "phase", "domain", "operatingmode", "route", "jobtypes", "monitoringwindows", "slosignals", "incidentsignals", "adoptionsignals", "regressionchecks", "approvals", "evidence"}),
        dry_run_only=True,
        notes=(
            "Python reviews sanitized post-closure monitoring metadata only; no incident transcripts, PHI, support ticket bodies, alert secrets or production logs are required.",
            "Alert configuration, traffic state, support queues, release state and operating-mode changes remain operator-owned outside Python.",
        ),
    ),
    JobType.PLATFORM_STEADY_STATE_TRANSFER_VALIDATION_REVIEW: JobPolicy(
        owner="Platform, SRE, Product Operations & Support",
        data_classification="steady-state-transfer-validation-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "stage", "phase", "targetstate", "domain", "operatingmode", "route", "jobtypes", "transferitems", "ownershipmatrix", "runbookcoverage", "monitoringreadiness", "supportmodel", "knowledgetransfer", "approvals", "evidence"}),
        dry_run_only=True,
        notes=(
            "Python reviews sanitized steady-state transfer metadata only; no private contacts, incident transcripts, PHI, secrets, production logs or support ticket bodies are required.",
            "Ownership reassignment, support queue configuration, runbook publication, status publishing and operational acceptance remain operator-owned outside Python.",
        ),
    ),
    JobType.PLATFORM_STEADY_STATE_OPERATIONAL_ASSURANCE_REVIEW: JobPolicy(
        owner="Platform, SRE, Product Operations & Support",
        data_classification="steady-state-operational-assurance-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "stage", "phase", "targetstate", "domain", "operatingmode", "route", "jobtypes", "operationalmetrics", "slohealth", "incidenttrends", "supportqueues", "runbookaudits", "ownershipreviews", "approvals", "evidence"}),
        dry_run_only=True,
        notes=(
            "Python reviews sanitized steady-state operational assurance metadata only; no incident transcripts, PHI, production logs, secrets or support ticket bodies are required.",
            "SLO ownership, support queue mutation, alert policy changes, staffing changes and operational acceptance remain operator-owned outside Python.",
        ),
    ),
    JobType.PLATFORM_CONTINUOUS_IMPROVEMENT_BACKLOG_REVIEW: JobPolicy(
        owner="Platform, Product Operations, SRE & Delivery Governance",
        data_classification="continuous-improvement-backlog-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "stage", "phase", "domain", "operatingmode", "route", "jobtypes", "improvementitems", "valuehypotheses", "technicaldebtitems", "riskitems", "ownercommitments", "governancereviews", "approvals", "evidence"}),
        dry_run_only=True,
        notes=(
            "Python reviews sanitized continuous-improvement backlog metadata only; no PHI, customer messages, credentials, secrets or private support transcripts are required.",
            "Backlog prioritization, ticket mutation, budget assignment, risk acceptance and roadmap publication remain operator-owned outside Python.",
        ),
    ),

    JobType.PLATFORM_STABLE_OPERATIONS_OPTIMIZATION_REVIEW: JobPolicy(
        owner="Platform, SRE, FinOps, Product Operations & Delivery Governance",
        data_classification="stable-operations-optimization-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "stage", "phase", "domain", "operatingmode", "route", "jobtypes", "optimizationmetrics", "costsignals", "reliabilitysignals", "automationopportunities", "debtitems", "guardrailreviews", "approvals", "evidence"}),
        dry_run_only=True,
        notes=(
            "Python reviews sanitized stable-operations optimization metadata only; no PHI, customer messages, credentials, secrets, raw production logs or private support transcripts are required.",
            "Optimization execution, cost policy changes, automation rollout, backlog mutation and risk acceptance remain operator-owned outside Python.",
        ),
    ),
    JobType.PLATFORM_RECURRING_MAINTENANCE_CYCLE_READINESS_REVIEW: JobPolicy(
        owner="Platform, SRE, Security Operations & Delivery Governance",
        data_classification="recurring-maintenance-cycle-readiness-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "stage", "phase", "targetcycle", "domain", "operatingmode", "route", "jobtypes", "maintenancewindows", "patchcadence", "dependencyupdateplan", "backupvalidation", "runbookschedule", "ownerroster", "approvals", "evidence"}),
        dry_run_only=True,
        notes=(
            "Python reviews sanitized recurring maintenance readiness metadata only; no secrets, credentials, PHI, raw logs, incident transcripts or support ticket bodies are required.",
            "Patch execution, dependency upgrades, backup/restore operations, calendar scheduling and owner assignments remain operator-owned outside Python.",
        ),
    ),
    JobType.PLATFORM_MAINTENANCE_CYCLE_EXECUTION_REVIEW: JobPolicy(
        owner="Platform, SRE, Security Operations & Delivery Governance",
        data_classification="maintenance-cycle-execution-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "stage", "phase", "cycleid", "domain", "operatingmode", "route", "jobtypes", "executionitems", "patchresults", "dependencyresults", "backupresults", "validationresults", "rollbackreadiness", "communications", "approvals", "evidence"}),
        dry_run_only=True,
        notes=(
            "Python reviews sanitized maintenance execution metadata only; no secrets, credentials, PHI, raw production logs, incident transcripts or support ticket bodies are required.",
            "Patch execution, dependency upgrades, backup/restore operations, calendar scheduling, ticket mutation and owner assignment remain operator-owned outside Python.",
        ),
    ),
    JobType.PLATFORM_LONG_TERM_OPERABILITY_SUSTAINABILITY_REVIEW: JobPolicy(
        owner="Platform, SRE, Product Operations, FinOps & Delivery Governance",
        data_classification="long-term-operability-sustainability-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "stage", "phase", "horizon", "domain", "operatingmode", "route", "jobtypes", "sustainabilitymetrics", "ownershipsignals", "knowledgebasereviews", "dependencylifecycle", "budgetsignals", "riskacceptances", "improvementcadence", "approvals", "evidence"}),
        dry_run_only=True,
        notes=(
            "Python reviews sanitized long-term sustainability metadata only; no PHI, customer messages, credentials, secrets, raw logs or private support transcripts are required.",
            "Budget changes, owner assignments, roadmap changes, dependency lifecycle execution, knowledge-base publication and risk acceptance remain operator-owned outside Python.",
        ),
    ),

    JobType.PLATFORM_RECURRING_OPERATIONAL_MATURITY_AUDIT_REVIEW: JobPolicy(
        owner="Platform, SRE, Product Operations, Security Operations & Delivery Governance",
        data_classification="recurring-operational-maturity-audit-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "stage", "phase", "auditcycle", "domain", "operatingmode", "route", "jobtypes", "maturitydimensions", "controlchecks", "incidentlearnings", "supportsignals", "operatorevidence", "risks", "approvals", "evidence"}),
        dry_run_only=True,
        notes=(
            "Python reviews sanitized recurring operational maturity audit metadata only; no PHI, credentials, secrets, raw production logs or private support transcripts are required.",
            "Maturity scoring, risk acceptance, remediation ownership and governance publication remain operator-owned outside Python.",
        ),
    ),
    JobType.PLATFORM_STABLE_STATE_CONTINUITY_CONTROL_REVIEW: JobPolicy(
        owner="Platform, SRE, Security Operations, Business Continuity & Delivery Governance",
        data_classification="stable-state-continuity-control-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "stage", "phase", "horizon", "domain", "operatingmode", "route", "jobtypes", "continuitycontrols", "drsignals", "dependencycontinuity", "operationalfallbacks", "communicationchecks", "risks", "approvals", "evidence"}),
        dry_run_only=True,
        notes=(
            "Python reviews sanitized stable-state continuity control metadata only; no PHI, credentials, secrets, raw logs, incident transcripts or support ticket bodies are required.",
            "Business continuity execution, failover operations, dependency remediation, communications and risk acceptance remain operator-owned outside Python.",
        ),
    ),
    JobType.PLATFORM_OPERATIONAL_RESILIENCE_GOVERNANCE_REVIEW: JobPolicy(
        owner="Platform, SRE, Security Operations, Business Continuity & Delivery Governance",
        data_classification="operational-resilience-governance-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "stage", "phase", "governancecycle", "domain", "operatingmode", "route", "jobtypes", "resiliencecontrols", "chaosdrills", "failoverreadiness", "serviceownership", "riskitems", "governancereviews", "approvals", "evidence"}),
        dry_run_only=True,
        notes=(
            "Python reviews sanitized operational resilience governance metadata only; no PHI, credentials, secrets, raw production logs or private support transcripts are required.",
            "Control ownership, failover execution, risk acceptance, governance publication and operational remediation remain operator-owned outside Python.",
        ),
    ),
    JobType.PLATFORM_RECOVERY_CAPABILITY_VALIDATION_REVIEW: JobPolicy(
        owner="Platform, SRE, Security Operations, Disaster Recovery & Delivery Governance",
        data_classification="recovery-capability-validation-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "stage", "phase", "validationwindow", "domain", "operatingmode", "route", "jobtypes", "restoretests", "rtorpochecks", "backupintegrity", "incidentreplayresults", "dependencyrecovery", "communicationvalidation", "risks", "approvals", "evidence"}),
        dry_run_only=True,
        notes=(
            "Python reviews sanitized recovery capability validation metadata only; no PHI, credentials, secrets, raw production logs or backup contents are required.",
            "Actual restore execution, dependency failover, incident replay operation, communication sends and risk acceptance remain operator-owned outside Python.",
        ),
    ),
    JobType.PLATFORM_OPERATIONAL_RESILIENCE_OPTIMIZATION_REVIEW: JobPolicy(
        owner="Platform, SRE, Security Operations, Business Continuity & Delivery Governance",
        data_classification="operational-resilience-optimization-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "stage", "phase", "optimizationcycle", "domain", "operatingmode", "route", "jobtypes", "resiliencemetrics", "optimizationactions", "automationcandidates", "incidentpatterns", "capacitysignals", "riskitems", "approvals", "evidence"}),
        dry_run_only=True,
        notes=(
            "Python reviews sanitized operational resilience optimization metadata only; no PHI, credentials, secrets, raw logs, incident transcripts or private support ticket bodies are required.",
            "Resilience control changes, automation enablement, capacity changes, risk acceptance, runbook updates and ownership changes remain operator-owned outside Python.",
        ),
    ),
    JobType.PLATFORM_AUTOMATED_CONTINUITY_PREPAREDNESS_REVIEW: JobPolicy(
        owner="Platform, SRE, Security Operations, Business Continuity & Delivery Governance",
        data_classification="automated-continuity-preparedness-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "stage", "phase", "preparednesswindow", "domain", "operatingmode", "route", "jobtypes", "automationcontrols", "continuityrunbooks", "schedulerreadiness", "dependencyhooks", "notificationtemplates", "risks", "approvals", "evidence"}),
        dry_run_only=True,
        notes=(
            "Python reviews sanitized automated continuity preparedness metadata only; no PHI, credentials, secrets, raw production logs or notification recipient payloads are required.",
            "Scheduler enablement, dependency hook mutation, notification publication, runbook publication, risk acceptance and ownership changes remain operator-owned outside Python.",
        ),
    ),
    JobType.PLATFORM_AUTOMATED_CONTINUITY_EXECUTION_VALIDATION_REVIEW: JobPolicy(
        owner="Platform, SRE, Security Operations, Business Continuity & Delivery Governance",
        data_classification="automated-continuity-execution-validation-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "stage", "phase", "executionwindow", "domain", "operatingmode", "route", "jobtypes", "executionruns", "schedulerevents", "dependencyhooks", "notificationdeliveries", "runbookcheckpoints", "riskitems", "approvals", "evidence"}),
        dry_run_only=True,
        notes=(
            "Python reviews sanitized automated continuity execution metadata only; no PHI, credentials, secrets, raw logs, notification recipient payloads or incident transcripts are required.",
            "Scheduler execution, hook mutation, notification sends, failover actions, risk acceptance and owner changes remain operator-owned outside Python.",
        ),
    ),
    JobType.PLATFORM_OPERATIONAL_RESILIENCE_FEEDBACK_LOOP_REVIEW: JobPolicy(
        owner="Platform, SRE, Product Operations, Security Operations & Delivery Governance",
        data_classification="operational-resilience-feedback-loop-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "stage", "phase", "feedbackcycle", "domain", "operatingmode", "route", "jobtypes", "feedbacksignals", "remediationitems", "learningitems", "metricadjustments", "ownerresponses", "risks", "approvals", "evidence"}),
        dry_run_only=True,
        notes=(
            "Python reviews sanitized resilience feedback-loop metadata only; no PHI, credentials, secrets, raw production logs or private support ticket bodies are required.",
            "Metric baseline changes, roadmap decisions, remediation ownership, risk acceptance and governance publication remain operator-owned outside Python.",
        ),
    ),
    JobType.PLATFORM_FINAL_CLOSURE_EVIDENCE_PACKAGE_REVIEW: JobPolicy(
        owner="Platform, SRE, Product Operations, Delivery Governance & Executive Sponsors",
        data_classification="final-closure-evidence-package-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "stage", "phase", "closurewindow", "domain", "operatingmode", "route", "jobtypes", "versionsummary", "validationresults", "contractevidence", "apirouteevidence", "workerevidence", "residualrisks", "signoffs", "evidence"}),
        dry_run_only=True,
        notes=(
            "Python reviews sanitized final closure evidence metadata only; no PHI, customer messages, credentials, secrets, raw production logs or support transcripts are required.",
            "Final release certification, risk acceptance, task mutation, handover publication and owner assignment remain operator-owned outside Python.",
        ),
    ),
    JobType.PLATFORM_GLOBAL_IMPLEMENTATION_COMPLETION_CHECKLIST_REVIEW: JobPolicy(
        owner="Platform, Product Operations, SRE, Support & Delivery Governance",
        data_classification="global-implementation-completion-checklist-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "stage", "phase", "checklistscope", "domain", "operatingmode", "route", "jobtypes", "functionalareas", "implementationtasks", "validationtasks", "handovertasks", "deferreditems", "approvals", "evidence"}),
        dry_run_only=True,
        notes=(
            "Python reviews sanitized global implementation completion checklist metadata only; no PHI, customer messages, credentials, secrets, raw logs or private tickets are required.",
            "Task closure, completion percentages, deferred-item acceptance, handover publication and final release declaration remain operator-owned outside Python.",
        ),
    ),

    JobType.PLATFORM_FINAL_OPERATIONAL_HANDOVER_REVIEW: JobPolicy(
        owner="Platform, SRE, Product Operations, Support, Security Operations & Delivery Governance",
        data_classification="final-operational-handover-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "stage", "phase", "handoverscope", "domain", "operatingmode", "route", "jobtypes", "runbooks", "ownerassignments", "supportmodel", "monitoringcontrols", "escalationpaths", "operationalrisks", "signoffs", "evidence"}),
        dry_run_only=True,
        notes=(
            "Python reviews sanitized final operational handover metadata only; no PHI, credentials, secrets, raw logs, customer messages or support transcripts are required.",
            "Ownership assignment, production handover publication, support rota activation, risk acceptance and operational control changes remain operator-owned outside Python.",
        ),
    ),
    JobType.PLATFORM_PHASE_CLOSURE_CERTIFICATION_REVIEW: JobPolicy(
        owner="Platform, Product Operations, SRE, Delivery Governance & Executive Sponsors",
        data_classification="phase-closure-certification-metadata-only",
        max_payload_bytes=750_000,
        allowed_sensitive_keys=frozenset({"releaseid", "stage", "phase", "certificationscope", "domain", "operatingmode", "route", "jobtypes", "closurecriteria", "evidencepackage", "handoverevidence", "residualrisks", "releaseartifacts", "approvals", "nextphasebacklog", "evidence"}),
        dry_run_only=True,
        notes=(
            "Python reviews sanitized phase closure certification metadata only; no PHI, credentials, secrets, raw production logs, customer messages or private tickets are required.",
            "Final certification, executive approval, risk acceptance, release tagging, backlog ownership and phase closure declaration remain operator-owned outside Python.",
        ),
    ),
    JobType.NOTIFICATIONS_DISPATCH: JobPolicy(
        owner="Messaging & Notifications",
        data_classification="pii-limited-recipient-planning",
        max_payload_bytes=500_000,
        allowed_sensitive_keys=frozenset({"recipients", "email", "phone"}),
        dry_run_only=True,
        notes=("v3 only plans dispatches; provider delivery is intentionally disabled.",),
    ),
    JobType.ANALYTICS_SNAPSHOT: JobPolicy(
        owner="Analytics",
        data_classification="aggregate-non-phi",
        max_payload_bytes=250_000,
        allowed_sensitive_keys=frozenset(),
        notes=("Analytics snapshots should receive numeric aggregates or anonymized dimensions only.",),
    ),
    JobType.AI_TRIAGE_PREVIEW: JobPolicy(
        owner="AI preview",
        data_classification="clinical-preview-minimized",
        max_payload_bytes=16_000,
        allowed_sensitive_keys=frozenset({"text", "locale", "context"}),
        dry_run_only=True,
        notes=(
            "Non-diagnostic preview only; requires clinical review.",
            "Do not persist source text outside the request/job result boundary.",
        ),
    ),
}


def _payload_size(payload: dict[str, Any]) -> int:
    import json

    return len(json.dumps(payload, sort_keys=True, default=str).encode("utf-8"))


def _collect_blocked_paths(value: Any, *, path: str, allowed_sensitive_keys: frozenset[str]) -> list[str]:
    blocked: list[str] = []
    if isinstance(value, dict):
        for raw_key, nested in value.items():
            key = str(raw_key)
            normalized = _normalize_key(key)
            next_path = f"{path}.{key}" if path else key
            if normalized in SECRET_KEYS:
                blocked.append(next_path)
                continue
            if normalized in PHI_KEYS and normalized not in allowed_sensitive_keys:
                blocked.append(next_path)
                continue
            blocked.extend(
                _collect_blocked_paths(nested, path=next_path, allowed_sensitive_keys=allowed_sensitive_keys)
            )
    elif isinstance(value, list):
        for index, item in enumerate(value):
            blocked.extend(
                _collect_blocked_paths(item, path=f"{path}[{index}]", allowed_sensitive_keys=allowed_sensitive_keys)
            )
    return blocked


def evaluate_job_policy(job: JobEnvelope) -> PolicyDecision:
    policy = JOB_POLICIES[job.job_type]
    warnings = list(policy.notes)
    if policy.dry_run_only and not job.dry_run:
        return PolicyDecision(
            allowed=False,
            data_classification=policy.data_classification,
            warnings=tuple(warnings),
            blocked_paths=("dryRun",),
        )

    size = _payload_size(job.payload)
    if size > policy.max_payload_bytes:
        return PolicyDecision(
            allowed=False,
            data_classification=policy.data_classification,
            warnings=tuple(warnings),
            blocked_paths=(f"payload:size:{size}>{policy.max_payload_bytes}",),
        )

    blocked_paths = tuple(
        _collect_blocked_paths(job.payload, path="payload", allowed_sensitive_keys=policy.allowed_sensitive_keys)
    )
    return PolicyDecision(
        allowed=not blocked_paths,
        data_classification=policy.data_classification,
        warnings=tuple(warnings),
        blocked_paths=blocked_paths,
    )


def policy_manifest() -> dict[str, Any]:
    return {
        job_type.value: {
            "owner": policy.owner,
            "dataClassification": policy.data_classification,
            "maxPayloadBytes": policy.max_payload_bytes,
            "dryRunOnly": policy.dry_run_only,
            "allowedSensitiveKeys": sorted(policy.allowed_sensitive_keys),
            "notes": list(policy.notes),
        }
        for job_type, policy in sorted(JOB_POLICIES.items(), key=lambda item: item[0].value)
    }
