import asyncio

from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from carepoint_python_worker.artifacts import artifact_store
from carepoint_python_worker.compat import model_dump
from carepoint_python_worker.jobs.shadow_store import shadow_store
from carepoint_python_worker.jobs.shadow_compare_store import shadow_comparison_store
from carepoint_python_worker.jobs.store import job_store
from carepoint_python_worker.metrics import metrics as worker_metrics
from carepoint_python_worker.rollout import rollout_store
from carepoint_python_worker.main import (
    app,
    enqueue_job,
    get_artifact_metadata,
    get_job,
    jobs_summary,
    livez,
    manifest,
    metrics_snapshot,
    policies,
    recent_shadow_jobs,
    record_shadow_job,
    record_shadow_comparison_direct,
    recent_shadow_comparisons,
    canary_gate_decision,
    artifact_gc_direct,
    contracts_manifest_direct,
    contract_test_vectors_direct,
    validate_contract_direct,
    rollout_readiness_direct,
    get_canary_rollout_direct,
    plan_canary_rollout_direct,
    advance_canary_rollout_direct,
    rollback_canary_rollout_direct,
    canary_assignment_direct,
    pause_canary_rollout_direct,
    resume_canary_rollout_direct,
    release_checklist_direct,
    evidence_bundle_direct,
)
from carepoint_python_worker.jobs.processors import process_job
from carepoint_python_worker.models import CanaryAssignmentRequest, CanaryRolloutAction, CanaryRolloutPlanRequest, JobEnvelope, ShadowComparisonInput, ShadowRecord
from carepoint_python_worker.security import build_bridge_signature, verify_bridge_signature


def run(coro):
    return asyncio.run(coro)


def setup_function():
    job_store.reset()
    shadow_store.reset()
    shadow_comparison_store.reset()
    worker_metrics.reset()
    artifact_store.reset_for_tests()
    rollout_store.reset()


def envelope(payload: dict) -> JobEnvelope:
    return JobEnvelope.parse_obj(payload)


def as_json(model):
    return model_dump(model, by_alias=True, mode="json") if hasattr(model, "dict") else model


def test_livez_returns_service_metadata():
    body = run(livez())
    assert body["ok"] is True
    assert body["service"] == "carepoint-python-worker"
    assert body["version"] == "0.64.0"


def test_manifest_lists_v3_capabilities_and_job_types():
    body = as_json(run(manifest()))
    assert "admin.audit_export" in body["jobTypes"]
    assert "admin-audit-export-preparation" in body["capabilities"]
    assert "hmac-signed-bridge-requests" in body["capabilities"]
    assert "payload-data-minimization-guard" in body["capabilities"]
    assert "prometheus-compatible-metrics" in body["capabilities"]
    assert "shadow-result-comparison" in body["capabilities"]
    assert "canary-gate-decision" in body["capabilities"]
    assert "artifact-retention-gc" in body["capabilities"]
    assert "platform-cost-guardrail-review" in body["capabilities"]
    assert "platform-environment-parity-review" in body["capabilities"]
    assert "platform-access-control-review" in body["capabilities"]
    assert "platform-data-quality-review" in body["capabilities"]
    assert "platform.cost_guardrail_review" in body["jobTypes"]
    assert "platform.environment_parity_review" in body["jobTypes"]
    assert "platform.traffic_promotion_readiness_review" in body["jobTypes"]
    assert "platform.evidence_retention_audit_review" in body["jobTypes"]
    assert "platform.slo_error_budget_review" in body["jobTypes"]
    assert "platform.auto_rollback_safeguard_review" in body["jobTypes"]
    assert "platform-slo-error-budget-review" in body["capabilities"]
    assert "platform-auto-rollback-safeguard-review" in body["capabilities"]
    assert "canary-rollout-controller" in body["capabilities"]
    assert "deterministic-canary-assignment" in body["capabilities"]
    assert "rollout-audit-ledger" in body["capabilities"]
    assert body["queueEnabled"] is False


def test_policies_expose_data_minimization_boundaries():
    body = run(policies())
    policy = body["jobPolicies"]["analytics.snapshot"]
    assert policy["dataClassification"] == "aggregate-non-phi"
    assert policy["maxPayloadBytes"] > 0


def test_audit_export_dry_run_executes_inline_stores_status_and_writes_artifact():
    accepted = run(
        enqueue_job(
            envelope(
                {
                    "jobType": "admin.audit_export",
                    "idempotencyKey": "audit-export-smoke-0001",
                    "correlationId": "test-correlation-0001",
                    "dryRun": True,
                    "payload": {
                        "format": "csv",
                        "maxRows": 1000,
                        "filters": {"from": "2026-01-01", "to": "2026-01-31", "resource": "Appointment"},
                    },
                }
            )
        )
    )
    body = as_json(accepted)
    assert body["accepted"] is True
    assert body["queued"] is False
    assert body["status"] == "succeeded"
    assert body["routedTo"] == "python.admin.audit_export.v14"
    assert body["result"]["resultType"] == "admin.audit_export.prepared"
    assert body["result"]["data"]["artifactName"] == "audit-export-2026-01-01-2026-01-31.csv"
    assert body["result"]["artifacts"][0]["artifactType"] == "admin.audit_export.plan"

    artifact_id = body["result"]["artifacts"][0]["artifactId"]
    artifact_body = run(get_artifact_metadata(artifact_id))
    assert artifact_body["artifactId"] == artifact_id
    assert artifact_body["metadata"]["source"] == "python-plan"

    status_body = as_json(run(get_job("audit-export-smoke-0001")))
    assert status_body["status"] == "succeeded"
    assert status_body["result"]["data"]["delivery"]["mode"] == "node-owned"


def test_duplicate_idempotency_replays_existing_result():
    payload = {
        "jobType": "analytics.snapshot",
        "idempotencyKey": "analytics-snapshot-smoke-0001",
        "dryRun": True,
        "payload": {"metric": "latency", "values": [10, 20, 30]},
    }
    first = as_json(run(enqueue_job(envelope(payload))))
    second = as_json(run(enqueue_job(envelope(payload))))
    assert first["duplicate"] is False
    assert second["duplicate"] is True
    assert second["result"]["data"]["avg"] == 20


def test_bulk_account_validation_reports_row_errors_and_artifact():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "admin.accounts_bulk_validate",
                        "idempotencyKey": "bulk-validate-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "allowedRoles": ["PROVIDER", "STAFF"],
                            "requireOrganization": True,
                            "rows": [
                                {"email": "provider@example.com", "role": "PROVIDER", "organizationId": "org-1"},
                                {"email": "broken", "role": "ADMIN"},
                            ],
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert result["totalRows"] == 2
    assert result["validRows"] == 1
    assert result["invalidRows"] == 1
    assert result["artifact"]["artifactType"] == "admin.accounts_bulk_validate.report"


def test_policy_rejects_secret_payloads_before_processing():
    with pytest.raises(HTTPException) as exc:
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "analytics.snapshot",
                        "idempotencyKey": "policy-secret-smoke-0001",
                        "dryRun": True,
                        "payload": {"metric": "latency", "accessToken": "must-not-cross-bridge", "values": [1]},
                    }
                )
            )
        )
    assert exc.value.status_code == 422


def test_ai_triage_preview_is_non_diagnostic():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "ai.triage_preview",
                        "idempotencyKey": "triage-preview-smoke-0001",
                        "dryRun": True,
                        "payload": {"text": "Patient reports fever and dizziness", "locale": "en"},
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert result["riskLevel"] == "elevated_review"
    assert result["nonDiagnostic"] is True
    assert result["requiresClinicalReview"] is True


def test_metrics_summary_and_shadow_inspection_endpoints():
    run(
        enqueue_job(
            envelope(
                {
                    "jobType": "analytics.snapshot",
                    "idempotencyKey": "metrics-smoke-0001",
                    "dryRun": True,
                    "payload": {"metric": "queue_depth", "values": [1, 3]},
                }
            )
        )
    )
    summary = run(jobs_summary())
    assert summary["totalJobs"] == 1
    assert summary["byStatus"]["succeeded"] == 1

    snapshot = run(metrics_snapshot())
    assert any(item["name"] == "carepoint_python_worker_job_events_total" and item["labels"].get("status") == "succeeded" for item in snapshot["counters"])

    shadow = ShadowRecord.parse_obj(
        {
            "route": "/api/hybrid-python/jobs",
            "method": "POST",
            "correlationId": "shadow-correlation-1",
            "payloadShape": {"jobType": "analytics.snapshot", "payloadKeys": ["metric", "values"]},
        }
    )
    accepted = run(record_shadow_job(shadow))
    assert accepted["accepted"] is True
    records = run(recent_shadow_jobs(limit=20))
    assert records["records"][0]["correlationId"] == "shadow-correlation-1"


def test_bridge_hmac_signature_accepts_valid_and_rejects_invalid():
    body = b'{"jobType":"analytics.snapshot"}'
    signature = build_bridge_signature(
        shared_secret="secret-value-minimum-32-characters",
        timestamp="1000",
        method="POST",
        path="/api/v1/jobs/enqueue",
        body=body,
    )
    verify_bridge_signature(
        shared_secret="secret-value-minimum-32-characters",
        timestamp="1000",
        signature=signature,
        method="POST",
        path="/api/v1/jobs/enqueue",
        body=body,
        now=1000,
        window_seconds=300,
    )
    with pytest.raises(HTTPException) as exc:
        verify_bridge_signature(
            shared_secret="secret-value-minimum-32-characters",
            timestamp="1000",
            signature="sha256=bad",
            method="POST",
            path="/api/v1/jobs/enqueue",
            body=body,
            now=1000,
            window_seconds=300,
        )
    assert exc.value.status_code == 401


def test_non_dry_run_requires_queue_enabled():
    with pytest.raises(HTTPException) as exc:
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "admin.audit_export",
                        "idempotencyKey": "audit-export-live-smoke-0001",
                        "dryRun": False,
                        "payload": {"format": "csv", "filters": {"from": "2026-01-01", "to": "2026-01-31"}},
                    }
                )
            )
        )
    assert exc.value.status_code == 409


def test_shadow_comparison_match_and_canary_gate_advances():
    comparison = ShadowComparisonInput.parse_obj(
        {
            "route": "/api/hybrid-python/admin/audit-export/prepare",
            "method": "POST",
            "correlationId": "cmp-correlation-1",
            "subjectKey": "audit-export-smoke-0001",
            "jobType": "admin.audit_export",
            "nodeStatus": "succeeded",
            "pythonStatus": "succeeded",
            "nodeResult": {"status": "ok", "count": 2, "updatedAt": "node-time"},
            "pythonResult": {"status": "ok", "count": 2, "updatedAt": "python-time"},
            "ignoredFields": ["updatedAt"],
        }
    )
    accepted = run(record_shadow_comparison_direct(comparison))
    assert accepted["accepted"] is True
    assert accepted["record"]["outcome"] == "match"

    comparisons = run(recent_shadow_comparisons(limit=10))
    assert comparisons["totalComparisons"] == 1
    assert comparisons["matchedComparisons"] == 1

    gate = as_json(run(canary_gate_decision(minComparisons=1)))
    assert gate["allowed"] is True
    assert gate["recommendation"] == "advance"


def test_shadow_comparison_mismatch_blocks_canary_gate():
    comparison = ShadowComparisonInput.parse_obj(
        {
            "route": "/api/hybrid-python/analytics/snapshot/prepare",
            "jobType": "analytics.snapshot",
            "nodeResult": {"metric": "latency", "avg": 20},
            "pythonResult": {"metric": "latency", "avg": 21},
        }
    )
    accepted = run(record_shadow_comparison_direct(comparison))
    assert accepted["record"]["outcome"] == "value_mismatch"
    assert "avg" in accepted["record"]["valueMismatchKeys"]

    gate = as_json(run(canary_gate_decision(maxMismatchRate=0.0, minComparisons=1)))
    assert gate["allowed"] is False
    assert gate["recommendation"] == "rollback"


def test_shadow_comparison_rejects_sensitive_payloads():
    comparison = ShadowComparisonInput.parse_obj(
        {
            "route": "/api/hybrid-python/jobs",
            "nodeResult": {"accessToken": "must-not-be-compared"},
            "pythonResult": {"accessToken": "must-not-be-compared"},
        }
    )
    with pytest.raises(HTTPException) as exc:
        run(record_shadow_comparison_direct(comparison))
    assert exc.value.status_code == 422


def test_artifact_gc_reports_retention_scan():
    run(
        enqueue_job(
            envelope(
                {
                    "jobType": "analytics.snapshot",
                    "idempotencyKey": "gc-smoke-0001",
                    "dryRun": True,
                    "payload": {"metric": "latency", "values": [1, 2]},
                }
            )
        )
    )
    result = run(artifact_gc_direct(dryRun=True))
    assert result["dryRun"] is True
    assert result["scanned"] >= 0
    assert result["removed"] == 0


def test_contract_manifest_vectors_and_validation_are_safe():
    manifest_body = as_json(run(contracts_manifest_direct()))
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    assert manifest_body["contractHash"]
    assert any(item["jobType"] == "analytics.snapshot" for item in manifest_body["contracts"])

    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    assert len(vectors) == 119
    assert all("accessToken" not in str(item) for item in vectors)

    report = as_json(run(validate_contract_direct(envelope(vectors[0]["envelope"]))))
    assert report["allowed"] is True
    assert report["contractHash"] == manifest_body["contractHash"]
    assert report["expectedResultType"]


def test_contract_validation_blocks_policy_violations_without_enqueueing():
    report = as_json(
        run(
            validate_contract_direct(
                envelope(
                    {
                        "jobType": "analytics.snapshot",
                        "idempotencyKey": "contract-validation-secret-v7",
                        "dryRun": True,
                        "payload": {"metric": "latency", "values": [1], "refreshToken": "blocked"},
                    }
                )
            )
        )
    )
    assert report["allowed"] is False
    assert any("blocked policy path" in item for item in report["errors"])
    assert run(jobs_summary())["totalJobs"] == 0


def test_rollout_readiness_advances_only_when_gate_and_prerequisites_pass():
    from carepoint_python_worker.contracts import build_rollout_readiness_report
    from carepoint_python_worker.canary import evaluate_canary_gate

    comparison = ShadowComparisonInput.parse_obj(
        {
            "route": "/api/hybrid-python/analytics/snapshot/prepare",
            "jobType": "analytics.snapshot",
            "nodeResult": {"metric": "latency", "avg": 20},
            "pythonResult": {"metric": "latency", "avg": 20},
        }
    )
    run(record_shadow_comparison_direct(comparison))
    gate = evaluate_canary_gate(
        job_summary=job_store.summary(),
        comparison_summary=shadow_comparison_store.summary(),
        max_mismatch_rate=0.05,
        max_failed_jobs=0,
        min_comparisons=1,
    )
    job_type = JobEnvelope.parse_obj({"jobType": "analytics.snapshot", "idempotencyKey": "tmp-v7-jobtype", "payload": {}}).job_type
    report = as_json(
        build_rollout_readiness_report(
            gate=gate,
            current_canary_percent=0,
            target_canary_percent=5,
            job_type=job_type,
            signature_required=True,
        )
    )
    assert report["decision"] == "advance"
    assert report["nextCanaryPercent"] == 1

    held = as_json(run(rollout_readiness_direct(currentCanaryPercent=0, targetCanaryPercent=5, jobType=None, minComparisons=1)))
    assert held["decision"] in {"hold", "rollback"}


def test_canary_rollout_controller_advances_assigns_and_rolls_back():
    plan = CanaryRolloutPlanRequest.parse_obj(
        {
            "route": "/api/hybrid-python/jobs",
            "currentPercent": 0,
            "targetPercent": 10,
            "stagePercents": [0, 5, 10],
            "minComparisons": 0,
            "maxMismatchRate": 0.05,
            "maxFailedJobs": 0,
            "createdBy": "operator-1",
            "reason": "v7 staged rollout smoke",
            "dryRun": False,
            "jobType": "analytics.snapshot",
        }
    )
    planned = as_json(run(plan_canary_rollout_direct(plan)))
    assert planned["status"] == "planned"
    assert planned["currentPercent"] == 0
    assert planned["targetPercent"] == 10
    assert planned["nextPercent"] == 5

    comparison = ShadowComparisonInput.parse_obj(
        {
            "route": "/api/hybrid-python/analytics/snapshot/prepare",
            "jobType": "analytics.snapshot",
            "nodeResult": {"metric": "latency", "avg": 20},
            "pythonResult": {"metric": "latency", "avg": 20},
        }
    )
    run(record_shadow_comparison_direct(comparison))

    advanced = as_json(
        run(
            advance_canary_rollout_direct(
                CanaryRolloutAction.parse_obj(
                    {"actorUserId": "operator-1", "reason": "shadow comparisons are clean", "dryRun": False}
                )
            )
        )
    )
    assert advanced["status"] == "advancing"
    assert advanced["currentPercent"] == 5
    assert advanced["nextPercent"] == 10
    assert advanced["lastDecision"]["allowed"] is True

    assignment_request = CanaryAssignmentRequest.parse_obj(
        {
            "route": "/api/hybrid-python/jobs",
            "subjectKey": "analytics-rollout-subject-0001",
            "organizationId": "org-1",
            "actorUserId": "user-1",
            "jobType": "analytics.snapshot",
        }
    )
    first = as_json(run(canary_assignment_direct(assignment_request)))
    second = as_json(run(canary_assignment_direct(assignment_request)))
    assert first["bucket"] == second["bucket"]
    assert first["canaryPercent"] == 5
    assert first["routeToPython"] == (first["bucket"] < 5)
    assert first["reason"] in {"canary-selected", "canary-not-selected"}

    rolled_back = as_json(
        run(
            rollback_canary_rollout_direct(
                CanaryRolloutAction.parse_obj(
                    {"actorUserId": "operator-1", "reason": "rollback drill", "dryRun": False}
                )
            )
        )
    )
    assert rolled_back["status"] == "rollback"
    assert rolled_back["currentPercent"] == 0

    after_rollback = as_json(run(canary_assignment_direct(assignment_request)))
    assert after_rollback["routeToPython"] is False
    assert after_rollback["reason"] == "rollout-rollback"


def test_canary_rollout_dry_run_does_not_commit_state():
    preview = as_json(
        run(
            plan_canary_rollout_direct(
                CanaryRolloutPlanRequest.parse_obj(
                    {
                        "route": "/api/hybrid-python/jobs",
                        "currentPercent": 0,
                        "targetPercent": 25,
                        "stagePercents": [0, 1, 5, 25],
                        "minComparisons": 0,
                        "createdBy": "operator-2",
                        "reason": "dry run only",
                        "dryRun": True,
                    }
                )
            )
        )
    )
    assert preview["targetPercent"] == 25
    current = as_json(run(get_canary_rollout_direct()))
    assert current["status"] == "disabled"
    assert current["currentPercent"] == 0



def test_v6_route_scoped_rollout_actions_and_evidence_bundle():
    route = "/api/hybrid-python/admin/audit-export/prepare"
    planned = run(plan_canary_rollout_direct(CanaryRolloutPlanRequest.parse_obj({
        "route": route,
        "currentPercent": 0,
        "targetPercent": 5,
        "stagePercents": [0, 1, 5],
        "minComparisons": 0,
        "dryRun": False,
        "reason": "v6-route-scoped-plan",
    })))
    assert planned.route == route
    assert planned.status == "planned"

    advanced = run(advance_canary_rollout_direct(CanaryRolloutAction.parse_obj({
        "route": route,
        "dryRun": False,
        "reason": "v6-route-scoped-advance",
    })))
    assert advanced.route == route
    assert advanced.current_percent == 1

    assignment = run(canary_assignment_direct(CanaryAssignmentRequest.parse_obj({
        "route": route,
        "subjectKey": "carepoint-v6-stable-subject",
        "jobType": "admin.audit_export",
    })))
    assert assignment.route == route
    assert assignment.canary_percent == 1

    paused = run(pause_canary_rollout_direct(CanaryRolloutAction.parse_obj({
        "route": route,
        "dryRun": False,
        "reason": "v6-route-scoped-pause",
    })))
    assert paused.status == "paused"
    paused_assignment = run(canary_assignment_direct(CanaryAssignmentRequest.parse_obj({
        "route": route,
        "subjectKey": "carepoint-v6-stable-subject",
    })))
    assert paused_assignment.route_to_python is False
    assert paused_assignment.shadow_mode is True

    resumed = run(resume_canary_rollout_direct(CanaryRolloutAction.parse_obj({
        "route": route,
        "dryRun": False,
        "reason": "v6-route-scoped-resume",
    })))
    assert resumed.route == route
    assert resumed.status in {"active", "advancing"}

    checklist = run(release_checklist_direct())
    checklist_json = as_json(checklist)
    assert checklist_json["schemaVersion"].startswith("2026-05-option-b")
    assert checklist_json["overallStatus"] in {"pass", "warn", "fail"}
    assert any(item["checkId"] == "contracts-manifest" for item in checklist_json["checks"])

    bundle = run(evidence_bundle_direct())
    bundle_json = as_json(bundle)
    assert bundle_json["contractHash"]
    assert "rollout" in bundle_json
    assert "checklist" in bundle_json


def test_v7_admin_accounts_read_model_masks_email_and_writes_artifact():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "admin.accounts_read_model",
                        "idempotencyKey": "accounts-read-model-smoke-0001",
                        "dryRun": True,
                        "organizationId": "org-1",
                        "payload": {
                            "limit": 10,
                            "filters": {"role": "PROVIDER"},
                            "rows": [
                                {
                                    "id": "user-1",
                                    "email": "provider@example.com",
                                    "role": "PROVIDER",
                                    "status": "ACTIVE",
                                    "organizationId": "org-1",
                                    "displayName": "Dr Example",
                                }
                            ],
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert body["routedTo"] == "python.admin.accounts_read_model.v14"
    assert result["rowCount"] == 1
    assert result["rows"][0]["emailMasked"] == "p***@example.com"
    assert "email" not in result["rows"][0]
    assert result["roleCounts"]["PROVIDER"] == 1
    assert body["result"]["artifacts"][0]["artifactType"] == "admin.accounts_read_model.page"


def test_v7_provider_role_reconcile_reports_schema_drift_without_mutation():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "admin.provider_role_reconcile",
                        "idempotencyKey": "provider-role-reconcile-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "schemaModels": ["ProviderProfile"],
                            "schemaFields": {"ProviderProfile": ["id", "userId"]},
                            "migrationModels": ["ProviderRoleCatalog"],
                            "codeReferences": ["ProviderRoleCatalog", "roleCatalogId"],
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert result["readyForCanary"] is False
    assert any("ProviderRoleCatalog" in item for item in result["blockers"])
    assert result["nodeOwnedMutation"] is True


def test_v7_scheduling_availability_snapshot_computes_aggregate_only():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "scheduling.availability_snapshot",
                        "idempotencyKey": "availability-snapshot-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "timezone": "UTC",
                            "groupBy": "status",
                            "windows": [
                                {
                                    "providerHash": "providerhash001",
                                    "startsAt": "2026-05-05T09:00:00Z",
                                    "endsAt": "2026-05-05T09:30:00Z",
                                    "status": "available",
                                },
                                {
                                    "providerHash": "providerhash001",
                                    "startsAt": "2026-05-05T10:00:00Z",
                                    "endsAt": "2026-05-05T10:30:00Z",
                                    "status": "booked",
                                },
                            ],
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert result["windowCount"] == 2
    assert result["statusCounts"]["available"] == 1
    assert result["statusCounts"]["booked"] == 1
    assert result["totalWindowMinutes"] == 60
    assert result["nodeOwnedCalendarQuery"] is True


def test_v7_messaging_reminder_plan_is_dry_run_and_hash_based():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "messaging.reminder_plan",
                        "idempotencyKey": "reminder-plan-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "channel": "email",
                            "templateId": "appointment-reminder",
                            "recipientHashes": ["hash-a", "hash-a", "hash-b"],
                            "batchSize": 2,
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert result["deliveryMode"] == "disabled-dry-run-plan"
    assert result["recipientHashCount"] == 2
    assert result["batchCount"] == 1
    assert body["result"]["artifacts"][0]["artifactType"] == "messaging.reminder_plan.report"


def test_billing_payment_reconcile_reports_mismatch_without_card_data():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "billing.payment_reconcile",
                        "idempotencyKey": "billing-reconcile-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "gateway": "stripe",
                            "rows": [
                                {"paymentIdHash": "payhash-1", "externalIdHash": "exthash-1", "gateway": "stripe", "status": "COMPLETED", "gatewayStatus": "succeeded", "amountMinor": 15000, "currency": "USD"},
                                {"paymentIdHash": "payhash-2", "externalIdHash": "exthash-2", "gateway": "stripe", "status": "COMPLETED", "gatewayStatus": "failed", "amountMinor": 2200, "currency": "USD"},
                            ],
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert body["routedTo"] == "python.billing.payment_reconcile.v14"
    assert result["mismatchCount"] == 1
    assert result["totalsByCurrencyMinor"]["USD"] == 17200
    assert result["nodeOwnedPaymentMutation"] is True
    assert body["result"]["artifacts"][0]["artifactType"] == "billing.payment_reconcile.report"


def test_clinical_records_access_audit_uses_hashed_metadata_only():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "clinical.records_access_audit",
                        "idempotencyKey": "clinical-access-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "window": {"from": "2026-05-01", "to": "2026-05-05"},
                            "anomalyThresholds": {"maxPatientsPerActor": 1, "maxDeniedPerActor": 1},
                            "events": [
                                {"actorHash": "actor-1", "patientHash": "patient-1", "resourceHash": "record-1", "action": "read", "outcome": "allowed", "createdAt": "2026-05-05T02:30:00Z", "breakGlass": True},
                                {"actorHash": "actor-1", "patientHash": "patient-2", "resourceHash": "record-2", "action": "read", "outcome": "denied", "createdAt": "2026-05-05T12:30:00Z"},
                                {"actorHash": "actor-1", "patientHash": "patient-2", "resourceHash": "record-3", "action": "read", "outcome": "denied", "createdAt": "2026-05-05T13:30:00Z"},
                            ],
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert body["routedTo"] == "python.clinical.records_access_audit.v14"
    assert result["riskIndicators"]["breakGlassCount"] == 1
    assert result["riskIndicators"]["missingReasonBreakGlassCount"] == 1
    assert result["riskIndicators"]["outsideHoursCount"] == 1
    assert result["riskIndicators"]["highFanoutActors"][0]["actorHash"] == "actor-1"
    assert result["nodeOwnedRecordAuthorization"] is True


def test_contract_manifest_contains_v14_billing_clinical_and_platform_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    assert "billing.payment_reconcile" in job_types
    assert "clinical.records_access_audit" in job_types
    assert "platform.db_index_advisory" in job_types
    assert "platform.slo_regression_report" in job_types


def test_policy_rejects_chart_content_for_clinical_access_audit():
    with pytest.raises(HTTPException) as exc:
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "clinical.records_access_audit",
                        "idempotencyKey": "clinical-policy-smoke-0001",
                        "dryRun": True,
                        "payload": {"events": [], "chart": "must not cross python bridge"},
                    }
                )
            )
        )
    assert exc.value.status_code == 422


def test_v14_platform_db_index_advisory_recommends_indices_without_db_mutation():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.db_index_advisory",
                        "idempotencyKey": "db-index-advisory-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "models": [
                                {"model": "Appointment", "rowCount": 500000, "indexes": [["id"], ["providerId"]]},
                            ],
                            "queries": [
                                {
                                    "endpoint": "/api/admin/accounts",
                                    "model": "Appointment",
                                    "filterFields": ["organizationId"],
                                    "orderByFields": ["startsAt"],
                                    "estimatedRows": 50000,
                                    "p95DurationMs": 1200,
                                    "fullScan": True,
                                }
                            ],
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert body["routedTo"] == "python.platform.db_index_advisory.v14"
    assert result["recommendationCount"] >= 1
    assert result["highPriorityCount"] >= 1
    assert result["migrationOwner"] == "Node/Prisma"
    assert result["requiresExplainAnalyze"] is True
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.db_index_advisory.report"


def test_v14_platform_slo_regression_report_recommends_rollback_on_latency_regression():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.slo_regression_report",
                        "idempotencyKey": "slo-regression-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "route": "/api/hybrid-python/analytics/snapshot/prepare",
                            "baselineSamplesMs": [100, 120, 140, 160],
                            "currentSamplesMs": [800, 900, 1000, 1100],
                            "baselineRequestCount": 1000,
                            "currentRequestCount": 1000,
                            "baselineErrorCount": 1,
                            "currentErrorCount": 25,
                            "thresholds": {"targetP95Ms": 500, "maxErrorRate": 0.01, "maxP95RegressionPercent": 20},
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert body["routedTo"] == "python.platform.slo_regression_report.v14"
    assert result["recommendation"] == "rollback"
    assert result["current"]["errorRate"] == 0.025
    assert result["canaryGateInput"] is True
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.slo_regression_report.report"



def test_v14_contract_replay_runs_sanitized_vectors_and_writes_artifact():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.contract_replay",
                        "idempotencyKey": "contract-replay-smoke-0001",
                        "dryRun": True,
                        "payload": {"jobTypes": ["analytics.snapshot", "platform.slo_regression_report"], "maxVectors": 10},
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert body["routedTo"] == "python.platform.contract_replay.v14"
    assert result["selectedVectorCount"] == 2
    assert result["passed"] == 2
    assert result["failed"] == 0
    assert result["ciGateReady"] is True
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.contract_replay.report"


def test_v14_privacy_preflight_blocks_secret_and_phi_key_shapes():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.privacy_preflight",
                        "idempotencyKey": "privacy-preflight-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "candidates": [
                                {
                                    "route": "/api/hybrid-python/analytics/snapshot/prepare",
                                    "jobType": "analytics.snapshot",
                                    "classification": "aggregate-non-phi",
                                    "payloadKeys": ["metric", "values", "accessToken"],
                                },
                                {
                                    "route": "/api/hybrid-python/clinical/records/access-audit/prepare",
                                    "jobType": "clinical.records_access_audit",
                                    "classification": "clinical-access-metadata-hashed",
                                    "payloadKeys": ["events.actorHash", "events.chart"],
                                },
                            ]
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert body["routedTo"] == "python.platform.privacy_preflight.v14"
    assert result["decision"] == "block"
    assert result["blockedCandidates"] == 2
    assert result["rawValuesAllowed"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.privacy_preflight.report"


def test_contract_manifest_contains_v14_release_gate_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    assert "platform.contract_replay" in job_types
    assert "platform.privacy_preflight" in job_types



def test_v14_release_decision_advances_with_clean_evidence_and_writes_artifact():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.release_decision",
                        "idempotencyKey": "release-decision-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "releaseId": "option-b-v14-smoke",
                            "targetCanaryPercent": 5,
                            "route": "/api/hybrid-python/analytics/snapshot/prepare",
                            "jobTypes": ["analytics.snapshot"],
                            "gate": {"allowed": True, "recommendation": "advance"},
                            "checklist": {"overallStatus": "pass"},
                            "contractReplay": {"decision": "pass", "failed": 0, "passed": 2},
                            "privacyPreflight": {"decision": "pass", "blockedCandidates": 0},
                            "sloRegression": {"recommendation": "advance"},
                            "rollout": {"status": "planned", "currentPercent": 0, "targetPercent": 5},
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert body["routedTo"] == "python.platform.release_decision.v14"
    assert result["decision"] == "advance"
    assert result["nodeOwnsDeployment"] is True
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.release_decision.report"


def test_v14_release_decision_rolls_back_when_privacy_or_slo_blocks():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.release_decision",
                        "idempotencyKey": "release-decision-block-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "releaseId": "option-b-v14-block",
                            "gate": {"allowed": False, "recommendation": "rollback"},
                            "privacyPreflight": {"decision": "block", "blockedCandidates": 1},
                            "sloRegression": {"recommendation": "rollback"},
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert result["decision"] == "rollback"
    assert len(result["blockers"]) >= 2
    assert any("rollback" in action.lower() for action in result["nextActions"])


def test_v14_rollback_drill_is_procedure_only_and_includes_acceptance_checks():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.rollback_drill",
                        "idempotencyKey": "rollback-drill-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "route": "/api/hybrid-python/analytics/snapshot/prepare",
                            "jobTypes": ["analytics.snapshot"],
                            "trigger": "slo-regression",
                            "observedMetrics": {"p95Ms": 900, "errorRate": 0.02},
                            "operators": ["release-manager"],
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert body["routedTo"] == "python.platform.rollback_drill.v14"
    assert result["mutatesState"] is False
    assert result["dryRunOnly"] is True
    assert len(result["steps"]) >= 5
    assert "Evidence bundle" in " ".join(result["acceptanceChecks"])
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.rollback_drill.plan"


def test_contract_manifest_contains_v14_release_decision_and_rollback_drill_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    assert "platform.release_decision" in job_types
    assert "platform.rollback_drill" in job_types



def test_v14_post_deploy_verify_passes_with_clean_evidence_and_writes_artifact():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.post_deploy_verify",
                        "idempotencyKey": "post-deploy-verify-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "releaseId": "option-b-v14-smoke",
                            "route": "/api/hybrid-python/analytics/snapshot/prepare",
                            "jobTypes": ["analytics.snapshot"],
                            "targetCanaryPercent": 5,
                            "healthChecks": [{"name": "readyz", "ok": True, "status": "ok"}],
                            "smokeChecks": [{"name": "analytics-smoke", "statusCode": 200, "expectedStatus": 200, "latencyMs": 120}],
                            "sloRegression": {"recommendation": "advance"},
                            "releaseDecision": {"decision": "advance"},
                            "rollout": {"status": "advancing", "currentPercent": 5, "targetPercent": 5},
                            "jobSummary": {"failedJobs": 0},
                            "comparisonSummary": {"mismatchRate": 0},
                            "privacyPreflight": {"decision": "pass", "blockedCandidates": 0},
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert body["routedTo"] == "python.platform.post_deploy_verify.v14"
    assert result["decision"] == "pass"
    assert result["nodeOwnsRollback"] is True
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.post_deploy_verify.report"


def test_v14_post_deploy_verify_rolls_back_on_failed_smoke_or_slo():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.post_deploy_verify",
                        "idempotencyKey": "post-deploy-verify-rollback-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "releaseId": "option-b-v14-rollback",
                            "route": "/api/hybrid-python/analytics/snapshot/prepare",
                            "smokeChecks": [{"name": "analytics-smoke", "statusCode": 500, "expectedStatus": 200}],
                            "sloRegression": {"recommendation": "rollback"},
                            "releaseDecision": {"decision": "advance"},
                            "jobSummary": {"failedJobs": 1},
                            "comparisonSummary": {"mismatchRate": 0.1},
                            "privacyPreflight": {"decision": "pass", "blockedCandidates": 0},
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert result["decision"] == "rollback"
    assert len(result["blockers"]) >= 3
    assert any("Rollback" in action or "rollback" in action for action in result["nextActions"])


def test_v14_change_ticket_bundle_marks_ready_with_complete_evidence():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.change_ticket_bundle",
                        "idempotencyKey": "change-ticket-bundle-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "changeId": "CHG-OPTION-B-V14",
                            "releaseId": "option-b-v14-smoke",
                            "route": "/api/hybrid-python/analytics/snapshot/prepare",
                            "jobTypes": ["analytics.snapshot"],
                            "evidenceBundle": {"contractHash": "hash", "schemaVersion": "2026-05-option-b-v15"},
                            "releaseDecision": {"decision": "advance"},
                            "rollbackDrill": {"mutatesState": False},
                            "contractReplay": {"decision": "pass", "failed": 0},
                            "privacyPreflight": {"decision": "pass", "blockedCandidates": 0},
                            "sloRegression": {"recommendation": "advance"},
                            "artifactRefs": [{"artifactId": "artifact-1", "artifactType": "platform.release_decision.report", "sha256": "abc123", "redactionApplied": True}],
                            "approvals": [{"role": "release-manager", "status": "approved"}],
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert body["routedTo"] == "python.platform.change_ticket_bundle.v14"
    assert result["ticketStatus"] == "ready_for_review"
    assert result["evidenceCompletenessPercent"] == 100
    assert result["nodeOwnsTicketWorkflow"] is True
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.change_ticket_bundle.report"


def test_v14_change_ticket_bundle_reports_missing_evidence_and_manifest_contracts():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.change_ticket_bundle",
                        "idempotencyKey": "change-ticket-bundle-incomplete-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "changeId": "CHG-OPTION-B-V14-INCOMPLETE",
                            "releaseId": "option-b-v14-incomplete",
                            "route": "/api/hybrid-python/analytics/snapshot/prepare",
                            "releaseDecision": {"decision": "hold"},
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert result["ticketStatus"] == "incomplete"
    assert "evidenceBundle" in result["missingEvidence"]
    manifest_body = as_json(run(contracts_manifest_direct()))
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    assert "platform.post_deploy_verify" in job_types
    assert "platform.change_ticket_bundle" in job_types



def test_v14_operational_handoff_marks_ready_with_required_sections_and_artifact():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.operational_handoff",
                        "idempotencyKey": "operational-handoff-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "releaseId": "option-b-v14-smoke",
                            "route": "/api/hybrid-python/analytics/snapshot/prepare",
                            "jobTypes": ["analytics.snapshot"],
                            "ownerContacts": [{"role": "release-manager", "name": "CarePoint Release"}],
                            "dashboardLinks": [{"name": "Hybrid status", "url": "/api/hybrid-python/status"}],
                            "alertPolicies": [{"name": "canary rollback", "status": "active"}],
                            "runbookLinks": [{"name": "rollback drill", "url": "/docs/option-b/IMPLEMENTATION_V14.md"}],
                            "artifactRefs": [{"artifactId": "artifact-ops", "artifactType": "platform.change_ticket_bundle.report", "sha256": "abc123", "redactionApplied": True}],
                        },
                    }
                )
            )
        )
    )
    assert body["routedTo"] == "python.platform.operational_handoff.v14"
    result = body["result"]["data"]
    assert result["handoffStatus"] == "ready_for_handoff"
    assert result["handoffCompletenessPercent"] == 100
    assert result["artifact"]["artifactType"] == "platform.operational_handoff.pack"
    assert result["nodeOwnsOperationsExecution"] is True


def test_v14_operational_handoff_reports_missing_sections():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.operational_handoff",
                        "idempotencyKey": "operational-handoff-missing-0001",
                        "dryRun": True,
                        "payload": {"releaseId": "option-b-v14-missing"},
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert result["handoffStatus"] == "incomplete"
    assert "ownerContacts" in result["missingSections"]
    assert "artifactRefs" in result["missingSections"]


def test_v14_incident_simulation_recommends_rollback_on_privacy_block():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.incident_simulation",
                        "idempotencyKey": "incident-simulation-rollback-0001",
                        "dryRun": True,
                        "payload": {
                            "scenario": "privacy_block",
                            "route": "/api/hybrid-python/analytics/snapshot/prepare",
                            "jobTypes": ["analytics.snapshot"],
                            "privacy": {"decision": "block"},
                            "operators": ["release-manager"],
                        },
                    }
                )
            )
        )
    )
    assert body["routedTo"] == "python.platform.incident_simulation.v14"
    result = body["result"]["data"]
    assert result["recommendation"] == "rollback"
    assert result["severity"] == "sev2"
    assert result["mutatesState"] is False
    assert result["artifact"]["artifactType"] == "platform.incident_simulation.report"


def test_v14_contract_manifest_contains_operational_handoff_and_incident_simulation():
    manifest_body = as_json(run(contracts_manifest_direct()))
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert "platform.operational_handoff" in job_types
    assert "platform.incident_simulation" in job_types

    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.operational_handoff" in vector_types
    assert "platform.incident_simulation" in vector_types



def test_v14_capacity_plan_holds_when_current_capacity_is_insufficient():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.capacity_plan",
                        "idempotencyKey": "capacity-plan-hold-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "releaseId": "option-b-v14-smoke",
                            "route": "/api/hybrid-python/analytics/snapshot/prepare",
                            "jobTypes": ["analytics.snapshot"],
                            "targetCanaryPercent": 10,
                            "expectedRequestsPerMinute": 1200,
                            "averageDurationMs": 1000,
                            "p95DurationMs": 2000,
                            "queueDepth": 500,
                            "maxQueueWaitSeconds": 60,
                            "currentWorkerCount": 1,
                            "workerConcurrency": 2,
                            "targetUtilization": 0.7,
                            "observedErrorRate": 0.002,
                            "backlogGrowthPerMinute": 10,
                        },
                    }
                )
            )
        )
    )
    assert body["routedTo"] == "python.platform.capacity_plan.v14"
    result = body["result"]["data"]
    assert result["recommendation"] == "hold"
    assert result["estimates"]["recommendedWorkerCount"] > result["input"]["currentWorkerCount"]
    assert result["nodeOwnsInfraChange"] is True
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.capacity_plan.report"


def test_v14_capacity_plan_rolls_back_on_error_rate_or_dependency_failure():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.capacity_plan",
                        "idempotencyKey": "capacity-plan-rollback-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "expectedRequestsPerMinute": 20,
                            "averageDurationMs": 100,
                            "p95DurationMs": 200,
                            "currentWorkerCount": 4,
                            "workerConcurrency": 8,
                            "observedErrorRate": 0.05,
                            "dependencies": [{"name": "redis", "status": "degraded"}],
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert result["recommendation"] == "rollback"
    assert result["unhealthyDependencies"][0]["name"] == "redis"


def test_v14_alert_policy_review_passes_with_required_signal_coverage():
    policies = [
        {"name": "python worker down readyz", "status": "active", "onCall": "platform"},
        {"name": "error-rate 5xx failed-jobs", "status": "active"},
        {"name": "latency-p95 duration", "status": "active"},
        {"name": "queue-backlog queue-depth", "status": "active"},
        {"name": "shadow-mismatch comparison", "status": "active"},
        {"name": "privacy-block privacy preflight", "status": "active"},
        {"name": "artifact-leak redaction", "status": "active"},
    ]
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.alert_policy_review",
                        "idempotencyKey": "alert-policy-review-pass-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "releaseId": "option-b-v14-smoke",
                            "route": "/api/hybrid-python/analytics/snapshot/prepare",
                            "jobTypes": ["analytics.snapshot"],
                            "alertPolicies": policies,
                            "dashboardLinks": [{"name": "Hybrid Python", "url": "/api/hybrid-python/status"}],
                        },
                    }
                )
            )
        )
    )
    assert body["routedTo"] == "python.platform.alert_policy_review.v14"
    result = body["result"]["data"]
    assert result["decision"] == "pass"
    assert result["missingSignals"] == []
    assert result["onCallPresent"] is True
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.alert_policy_review.report"


def test_v14_alert_policy_review_holds_when_signals_are_missing_and_manifest_has_contracts():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.alert_policy_review",
                        "idempotencyKey": "alert-policy-review-hold-smoke-0001",
                        "dryRun": True,
                        "payload": {"alertPolicies": [{"name": "python worker down readyz", "status": "active"}]},
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert result["decision"] == "hold"
    assert "error-rate" in result["missingSignals"]
    manifest_body = as_json(run(contracts_manifest_direct()))
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert "platform.capacity_plan" in job_types
    assert "platform.alert_policy_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.capacity_plan" in vector_types
    assert "platform.alert_policy_review" in vector_types



def test_v15_dependency_readiness_passes_with_required_dependencies_healthy():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.dependency_readiness",
                        "idempotencyKey": "dependency-readiness-pass-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "releaseId": "option-b-v15-smoke",
                            "route": "/api/hybrid-python/analytics/snapshot/prepare",
                            "jobTypes": ["analytics.snapshot"],
                            "requiredDependencies": ["python-worker", "node-api", "redis", "artifact-store"],
                            "dependencies": [
                                {"name": "python-worker", "status": "ok", "critical": True},
                                {"name": "node-api", "status": "ok", "critical": True},
                                {"name": "redis", "status": "ok", "critical": True},
                                {"name": "artifact-store", "status": "healthy", "critical": False},
                            ],
                        },
                    }
                )
            )
        )
    )
    assert body["routedTo"] == "python.platform.dependency_readiness.v15"
    result = body["result"]["data"]
    assert result["decision"] == "pass"
    assert result["missingDependencies"] == []
    assert result["criticalUnhealthyDependencies"] == []
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.dependency_readiness.report"


def test_v15_dependency_readiness_rolls_back_on_critical_dependency_failure():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.dependency_readiness",
                        "idempotencyKey": "dependency-readiness-rollback-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "requiredDependencies": ["python-worker", "redis"],
                            "dependencies": [
                                {"name": "python-worker", "status": "ok", "critical": True},
                                {"name": "redis", "status": "degraded", "critical": True},
                            ],
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert result["decision"] == "rollback"
    assert result["criticalUnhealthyDependencies"][0]["name"] == "redis"


def test_v15_production_readiness_advances_with_clean_gate_evidence():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.production_readiness",
                        "idempotencyKey": "production-readiness-advance-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "releaseId": "option-b-v15-smoke",
                            "route": "/api/hybrid-python/analytics/snapshot/prepare",
                            "jobTypes": ["analytics.snapshot"],
                            "targetCanaryPercent": 5,
                            "evidence": {
                                "contractReplay": {"decision": "pass", "failed": 0},
                                "privacyPreflight": {"decision": "pass", "blockedCandidates": 0},
                                "sloRegression": {"recommendation": "advance"},
                                "capacityPlan": {"recommendation": "advance"},
                                "alertPolicyReview": {"decision": "pass"},
                                "dependencyReadiness": {"decision": "pass"},
                                "rollbackDrill": {"status": "ready"},
                            },
                        },
                    }
                )
            )
        )
    )
    assert body["routedTo"] == "python.platform.production_readiness.v15"
    result = body["result"]["data"]
    assert result["decision"] == "advance"
    assert result["missingEvidence"] == []
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.production_readiness.report"


def test_v15_production_readiness_rolls_back_on_privacy_or_contract_failure_and_manifest_has_contracts():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.production_readiness",
                        "idempotencyKey": "production-readiness-rollback-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "evidence": {
                                "contractReplay": {"decision": "pass", "failed": 1},
                                "privacyPreflight": {"decision": "pass", "blockedCandidates": 2},
                                "sloRegression": {"recommendation": "advance"},
                                "capacityPlan": {"recommendation": "advance"},
                                "alertPolicyReview": {"decision": "pass"},
                                "dependencyReadiness": {"decision": "pass"},
                                "rollbackDrill": {"status": "ready"},
                            }
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert result["decision"] == "rollback"
    assert any(item["section"] == "privacyPreflight" for item in result["blockers"])
    manifest_body = as_json(run(contracts_manifest_direct()))
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert "platform.dependency_readiness" in job_types
    assert "platform.production_readiness" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.dependency_readiness" in vector_types
    assert "platform.production_readiness" in vector_types



def test_v16_data_retention_review_passes_with_ttl_redaction_and_gc_metadata():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.data_retention_review",
                        "idempotencyKey": "data-retention-pass-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "releaseId": "option-b-v16-smoke",
                            "route": "/api/hybrid-python/analytics/snapshot/prepare",
                            "jobTypes": ["analytics.snapshot"],
                            "retentionPolicies": [
                                {"name": "hybrid-artifacts", "artifactType": "platform.*", "ttlSeconds": 86400, "redactionRequired": True, "gcEnabled": True}
                            ],
                            "artifactSummary": {"totalArtifacts": 3, "unredactedArtifacts": 0, "highRiskArtifacts": 0, "maxTtlSeconds": 86400},
                            "gcSummary": {"dryRun": True, "expiredArtifacts": 0},
                            "maxArtifactTtlSeconds": 604800,
                        },
                    }
                )
            )
        )
    )
    assert body["routedTo"] == "python.platform.data_retention_review.v16"
    result = body["result"]["data"]
    assert result["decision"] == "pass"
    assert result["policyCount"] == 1
    assert result["blockers"] == []
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.data_retention_review.report"


def test_v16_data_retention_review_rolls_back_on_unredacted_high_risk_artifacts():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.data_retention_review",
                        "idempotencyKey": "data-retention-rollback-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "retentionPolicies": [{"name": "bad-policy", "ttlSeconds": 9999999, "redactionRequired": False, "gcEnabled": False}],
                            "artifactSummary": {"totalArtifacts": 2, "unredactedArtifacts": 1, "highRiskArtifacts": 1, "maxTtlSeconds": 9999999},
                            "maxArtifactTtlSeconds": 604800,
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert result["decision"] == "rollback"
    assert any(item["section"] == "artifactSummary" for item in result["blockers"])


def test_v16_audit_trail_review_passes_with_required_event_metadata():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.audit_trail_review",
                        "idempotencyKey": "audit-trail-pass-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "releaseId": "option-b-v16-smoke",
                            "route": "/api/hybrid-python/analytics/snapshot/prepare",
                            "jobTypes": ["analytics.snapshot"],
                            "auditEvents": [
                                {
                                    "eventType": "canary.plan",
                                    "actorUserId": "release-operator",
                                    "correlationId": "corr-v16-audit",
                                    "route": "/api/hybrid-python/canary/rollout/plan",
                                    "timestamp": "2026-05-05T00:00:00Z",
                                    "dryRun": True,
                                }
                            ],
                        },
                    }
                )
            )
        )
    )
    assert body["routedTo"] == "python.platform.audit_trail_review.v16"
    result = body["result"]["data"]
    assert result["decision"] == "pass"
    assert result["eventCount"] == 1
    assert result["missingByEvent"] == []
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.audit_trail_review.report"


def test_v16_audit_trail_review_rolls_back_on_missing_required_fields_and_manifest_has_contracts():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.audit_trail_review",
                        "idempotencyKey": "audit-trail-rollback-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "auditEvents": [{"eventType": "canary.advance", "route": "/api/hybrid-python/canary/rollout/advance"}]
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert result["decision"] == "rollback"
    assert result["missingByEvent"][0]["missingFields"]
    manifest_body = as_json(run(contracts_manifest_direct()))
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert "platform.data_retention_review" in job_types
    assert "platform.audit_trail_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.data_retention_review" in vector_types
    assert "platform.audit_trail_review" in vector_types



def test_v17_security_posture_review_passes_with_required_controls():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.security_posture_review",
                        "idempotencyKey": "security-posture-pass-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "releaseId": "option-b-v17-smoke",
                            "route": "/api/hybrid-python/analytics/snapshot/prepare",
                            "jobTypes": ["analytics.snapshot"],
                            "controls": {
                                "signedBridge": True,
                                "csrfForCookieAuth": True,
                                "rateLimitAuth": True,
                                "objectLevelAuthTests": True,
                                "secretScanPassing": True,
                                "corsProdWhitelist": True,
                                "httpOnlyCookies": True,
                            },
                            "findings": [],
                        },
                    }
                )
            )
        )
    )
    assert body["routedTo"] == "python.platform.security_posture_review.v17"
    result = body["result"]["data"]
    assert result["decision"] == "pass"
    assert result["missingControls"] == []
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.security_posture_review.report"


def test_v17_security_posture_review_rolls_back_on_missing_controls_and_critical_findings():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.security_posture_review",
                        "idempotencyKey": "security-posture-rollback-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "controls": {"signedBridge": True},
                            "findings": [{"id": "sec-001", "severity": "critical", "component": "cookies"}],
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert result["decision"] == "rollback"
    assert result["missingControls"]
    assert any(item["section"] == "findings" for item in result["blockers"])


def test_v17_supply_chain_review_passes_with_clean_scan_evidence():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.supply_chain_review",
                        "idempotencyKey": "supply-chain-pass-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "releaseId": "option-b-v17-smoke",
                            "route": "/api/hybrid-python/analytics/snapshot/prepare",
                            "jobTypes": ["analytics.snapshot"],
                            "sbomPresent": True,
                            "lockfilesPresent": True,
                            "imageScanPresent": True,
                            "scans": [
                                {"type": "npm-audit", "critical": 0, "high": 0, "medium": 1, "low": 2},
                                {"type": "pip-audit", "critical": 0, "high": 0, "medium": 0, "low": 0},
                                {"type": "container", "critical": 0, "high": 0, "medium": 0, "low": 3},
                            ],
                        },
                    }
                )
            )
        )
    )
    assert body["routedTo"] == "python.platform.supply_chain_review.v17"
    result = body["result"]["data"]
    assert result["decision"] == "pass"
    assert result["vulnerabilityTotals"]["critical"] == 0
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.supply_chain_review.report"


def test_v17_supply_chain_review_rolls_back_on_missing_sbom_image_scan_and_critical_vulns():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.supply_chain_review",
                        "idempotencyKey": "supply-chain-rollback-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "sbomPresent": False,
                            "lockfilesPresent": True,
                            "imageScanPresent": False,
                            "scans": [{"type": "container", "critical": 1, "high": 2}],
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert result["decision"] == "rollback"
    assert any(item["section"] == "sbom" for item in result["blockers"])
    assert any(item["section"] == "imageScan" for item in result["blockers"])
    manifest_body = as_json(run(contracts_manifest_direct()))
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert "platform.security_posture_review" in job_types
    assert "platform.supply_chain_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.security_posture_review" in vector_types
    assert "platform.supply_chain_review" in vector_types



def test_v18_schema_migration_rehearsal_passes_with_clean_rehearsal_evidence():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.schema_migration_rehearsal",
                        "idempotencyKey": "schema-migration-pass-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "releaseId": "option-b-v18-smoke",
                            "route": "/api/hybrid-python/admin/accounts/read-model/prepare",
                            "jobTypes": ["admin.accounts_read_model"],
                            "migrations": [
                                {"name": "20260505_add_account_bulk_job", "operation": "create-table", "destructive": False, "rollbackPlan": True, "backfillPlan": True, "estimatedRows": 0}
                            ],
                            "schemaDrift": {"status": "pass"},
                            "rehearsalEvidence": {"prismaValidate": True, "migrateStatus": True, "rollbackPlan": True, "backfillPlan": True, "seedSafe": True, "shadowReplay": True},
                        },
                    }
                )
            )
        )
    )
    assert body["routedTo"] == "python.platform.schema_migration_rehearsal.v18"
    result = body["result"]["data"]
    assert result["decision"] == "pass"
    assert result["destructiveStepCount"] == 0
    assert result["blockers"] == []
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.schema_migration_rehearsal.report"


def test_v18_schema_migration_rehearsal_rolls_back_on_drift_and_destructive_step():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.schema_migration_rehearsal",
                        "idempotencyKey": "schema-migration-rollback-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "migrations": [{"name": "drop_legacy_tokens", "operation": "drop-table", "destructive": True}],
                            "schemaDrift": {"status": "failed"},
                            "rehearsalEvidence": {"prismaValidate": False},
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert result["decision"] == "rollback"
    assert result["destructiveStepCount"] == 1
    assert any(item["section"] == "schemaDrift" for item in result["blockers"])


def test_v18_backup_restore_drill_passes_with_fresh_backups_and_integrity_checks():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.backup_restore_drill",
                        "idempotencyKey": "backup-restore-pass-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "releaseId": "option-b-v18-smoke",
                            "route": "/api/hybrid-python/analytics/snapshot/prepare",
                            "jobTypes": ["analytics.snapshot"],
                            "rpoMinutes": 60,
                            "rtoMinutes": 120,
                            "backups": [
                                {"store": "postgres", "ok": True, "ageMinutes": 15},
                                {"store": "redis", "ok": True, "ageMinutes": 10},
                                {"store": "artifact_store", "ok": True, "ageMinutes": 20},
                            ],
                            "restoreTests": [
                                {"store": "postgres", "ok": True, "durationMinutes": 45, "integrityOk": True},
                                {"store": "redis", "ok": True, "durationMinutes": 5, "integrityOk": True},
                                {"store": "artifact_store", "ok": True, "durationMinutes": 20, "integrityOk": True},
                            ],
                        },
                    }
                )
            )
        )
    )
    assert body["routedTo"] == "python.platform.backup_restore_drill.v18"
    result = body["result"]["data"]
    assert result["decision"] == "pass"
    assert len(result["storeSummaries"]) == 3
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.backup_restore_drill.report"


def test_v18_backup_restore_drill_rolls_back_on_missing_restore_and_manifest_has_contracts():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.backup_restore_drill",
                        "idempotencyKey": "backup-restore-rollback-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "requiredStores": ["postgres", "redis"],
                            "rpoMinutes": 60,
                            "backups": [{"store": "postgres", "ok": True, "ageMinutes": 120}],
                            "restoreTests": [],
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert result["decision"] == "rollback"
    assert any(item["section"] == "restoreTests" for item in result["blockers"])
    manifest_body = as_json(run(contracts_manifest_direct()))
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert "platform.schema_migration_rehearsal" in job_types
    assert "platform.backup_restore_drill" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.schema_migration_rehearsal" in vector_types
    assert "platform.backup_restore_drill" in vector_types



def test_v19_observability_coverage_review_passes_with_correlated_signals():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.observability_coverage_review",
                        "idempotencyKey": "observability-coverage-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "releaseId": "option-b-v19-smoke",
                            "route": "/api/hybrid-python/analytics/snapshot/prepare",
                            "jobTypes": ["analytics.snapshot"],
                            "traces": [{"name": "trace_id", "coveragePercent": 99.5}, {"name": "request_id", "coveragePercent": 99.5}],
                            "metrics": [{"metric": "p95_latency"}, {"metric": "error_rate"}, {"metric": "queue_depth"}],
                            "logs": [{"traceId": "trace-1", "requestId": "req-1"}],
                            "dashboards": [{"name": "hybrid-python", "url": "https://dashboards.example.invalid/hybrid-python"}],
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert body["routedTo"] == "python.platform.observability_coverage_review.v19"
    assert result["decision"] == "pass"
    assert result["missingSignals"] == []
    assert result["nodeOwnsRuntimeInstrumentation"] is True
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.observability_coverage_review.report"


def test_v19_feature_flag_review_blocks_unsafe_canary_or_unsigned_bridge():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.feature_flag_review",
                        "idempotencyKey": "feature-flag-review-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "releaseId": "option-b-v19-smoke",
                            "route": "/api/hybrid-python/analytics/snapshot/prepare",
                            "jobTypes": ["analytics.snapshot"],
                            "maxCanaryPercent": 5,
                            "flags": {
                                "HYBRID_PYTHON_ENABLED": "true",
                                "HYBRID_PYTHON_SHADOW_MODE": "true",
                                "HYBRID_PYTHON_CANARY_PERCENT": "25",
                                "PYTHON_SERVICES_BASE_URL": "http://python-worker-api:8080",
                                "PYTHON_WORKER_REQUIRE_SIGNATURE": "false",
                            },
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert body["routedTo"] == "python.platform.feature_flag_review.v19"
    assert result["decision"] == "rollback"
    assert result["canaryPercent"] == 25
    assert len(result["blockers"]) >= 2
    assert result["nodeOwnsFeatureFlagApplication"] is True
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.feature_flag_review.report"


def test_contract_manifest_contains_v19_observability_and_feature_flag_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    assert "platform.observability_coverage_review" in job_types
    assert "platform.feature_flag_review" in job_types


def test_v20_domain_migration_readiness_advances_with_clean_evidence():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.domain_migration_readiness",
                        "idempotencyKey": "domain-migration-readiness-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "releaseId": "option-b-v20-smoke",
                            "domain": "analytics",
                            "route": "/api/hybrid-python/analytics/snapshot/prepare",
                            "jobTypes": ["analytics.snapshot"],
                            "targetCanaryPercent": 5,
                            "maxCanaryPercent": 10,
                            "evidence": {
                                "contractReplay": {"decision": "pass", "failed": 0},
                                "privacyPreflight": {"decision": "pass", "blockedCandidates": 0},
                                "sloRegression": {"recommendation": "advance"},
                                "observabilityCoverage": {"decision": "pass"},
                                "featureFlagReview": {"decision": "pass"},
                                "productionReadiness": {"decision": "advance"},
                                "nodeFallbackAvailable": True,
                                "ownerApproved": True,
                            },
                            "shadowComparisonSummary": {"mismatchRate": 0},
                            "canaryGate": {"allowed": True, "recommendation": "advance"},
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert body["routedTo"] == "python.platform.domain_migration_readiness.v20"
    assert result["decision"] == "advance"
    assert result["nodeOwnsProductionTrafficUntilCutover"] is True
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.domain_migration_readiness.report"


def test_v20_cutover_plan_builds_staged_dry_run_and_requires_operator_evidence():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.cutover_plan",
                        "idempotencyKey": "cutover-plan-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "releaseId": "option-b-v20-smoke",
                            "domain": "analytics",
                            "route": "/api/hybrid-python/analytics/snapshot/prepare",
                            "jobTypes": ["analytics.snapshot"],
                            "targetCanaryPercent": 10,
                            "stages": [0, 1, 5, 10],
                            "evidence": {"domainMigrationReadiness": {"decision": "advance"}, "productionReadiness": {"decision": "advance"}},
                            "rollbackTriggers": ["shadow mismatch rate exceeds 5%"],
                            "operatorApprovals": [{"role": "release-manager", "status": "approved"}],
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert body["routedTo"] == "python.platform.cutover_plan.v20"
    assert result["decision"] == "ready"
    assert result["stages"] == [0, 1, 5, 10]
    assert result["mutatesState"] is False
    assert result["nodeOwnsCutoverExecution"] is True
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.cutover_plan.report"


def test_contract_manifest_contains_v20_domain_migration_and_cutover_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    assert "platform.domain_migration_readiness" in job_types
    assert "platform.cutover_plan" in job_types



def test_v21_owner_registry_review_passes_with_complete_owners():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.owner_registry_review",
                        "idempotencyKey": "owner-registry-review-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "releaseId": "option-b-v21-smoke",
                            "domain": "analytics",
                            "route": "/api/hybrid-python/analytics/snapshot/prepare",
                            "jobTypes": ["analytics.snapshot"],
                            "domains": [
                                {
                                    "domain": "analytics",
                                    "route": "/api/hybrid-python/analytics/snapshot/prepare",
                                    "nodeApiOwner": "api-team",
                                    "pythonWorkerOwner": "platform-python",
                                    "dataOwner": "analytics-owner",
                                    "securityOwner": "security",
                                    "rollbackOwner": "release-manager",
                                    "incidentOwner": "on-call",
                                    "approved": True,
                                }
                            ],
                            "approvals": [{"role": "release-manager", "status": "approved"}],
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert body["routedTo"] == "python.platform.owner_registry_review.v21"
    assert result["decision"] == "pass"
    assert result["ownerSummaries"][0]["hasRollbackOwner"] is True
    assert result["nodeOwnsFallbackUntilFullCutover"] is True
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.owner_registry_review.report"


def test_v21_post_cutover_monitor_rolls_back_on_slo_breach():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.post_cutover_monitor",
                        "idempotencyKey": "post-cutover-monitor-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "releaseId": "option-b-v21-smoke",
                            "domain": "analytics",
                            "route": "/api/hybrid-python/analytics/snapshot/prepare",
                            "jobTypes": ["analytics.snapshot"],
                            "targetCanaryPercent": 10,
                            "metrics": {"requestCount": 1000, "p95Ms": 900, "errorRate": 0.02, "mismatchRate": 0.0, "failedJobs": 1, "queueDepth": 5},
                            "thresholds": {"maxP95Ms": 500, "maxErrorRate": 0.01, "maxMismatchRate": 0.05, "maxFailedJobs": 0},
                            "evidence": {"nodeFallbackAvailable": True},
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert body["routedTo"] == "python.platform.post_cutover_monitor.v21"
    assert result["decision"] == "rollback"
    assert len(result["blockers"]) >= 3
    assert result["nodeOwnsRollback"] is True
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.post_cutover_monitor.report"


def test_contract_manifest_contains_v21_owner_registry_and_post_cutover_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    assert "platform.owner_registry_review" in job_types
    assert "platform.post_cutover_monitor" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.owner_registry_review" in vector_types
    assert "platform.post_cutover_monitor" in vector_types



def test_v22_legacy_path_decommission_ready_with_zero_traffic_and_evidence():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.legacy_path_decommission",
                        "idempotencyKey": "legacy-path-decommission-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "releaseId": "option-b-v22-smoke",
                            "domain": "analytics",
                            "route": "/api/hybrid-python/analytics/snapshot/prepare",
                            "jobTypes": ["analytics.snapshot"],
                            "legacyPaths": [
                                {
                                    "path": "/api/analytics/snapshot",
                                    "replacementRoute": "/api/hybrid-python/analytics/snapshot/prepare",
                                    "trafficPercent": 0,
                                    "fallbackAvailable": True,
                                    "decommissionApproved": True,
                                    "owner": "api-team",
                                }
                            ],
                            "evidence": {
                                "postCutoverMonitor": {"decision": "continue"},
                                "ownerRegistry": {"decision": "pass"},
                                "rollbackDrill": {"decision": "ready"},
                                "observabilityCoverage": {"decision": "pass"},
                                "productionReadiness": {"decision": "advance"},
                            },
                            "fallbackPlan": {"available": True, "rollbackTested": True, "owner": "release-manager"},
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert body["routedTo"] == "python.platform.legacy_path_decommission.v22"
    assert result["decision"] == "ready"
    assert result["mutatesCodeOrTraffic"] is False
    assert result["nodeOwnsFallbackUntilDecommissionComplete"] is True
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.legacy_path_decommission.report"


def test_v22_steady_state_operations_review_operates_with_clean_controls():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.steady_state_operations_review",
                        "idempotencyKey": "steady-state-ops-review-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "releaseId": "option-b-v22-smoke",
                            "domain": "analytics",
                            "route": "/api/hybrid-python/analytics/snapshot/prepare",
                            "jobTypes": ["analytics.snapshot"],
                            "runbookLinks": [{"name": "hybrid analytics runbook", "url": "https://docs.example.invalid/runbook"}],
                            "dashboardLinks": [{"name": "hybrid analytics dashboard", "url": "https://dashboards.example.invalid/hybrid"}],
                            "alertPolicies": [{"name": "p95 latency", "enabled": True}],
                            "incidentHistory": [{"id": "INC-1", "status": "resolved", "severity": "sev2"}],
                            "metrics": {"p95Ms": 220, "errorRate": 0.001, "failedJobs": 0, "incidentCount": 1},
                            "thresholds": {"maxP95Ms": 500, "maxErrorRate": 0.01, "maxFailedJobs": 0, "maxOpenIncidents": 0},
                            "evidence": {
                                "onCall": True,
                                "ownerRegistry": {"decision": "pass"},
                                "rollbackDrill": {"decision": "ready"},
                                "postCutoverMonitor": {"decision": "continue"},
                            },
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert body["routedTo"] == "python.platform.steady_state_operations_review.v22"
    assert result["decision"] == "operate"
    assert result["operationalControls"]["onCall"] is True
    assert result["mutatesOwnershipOrRouting"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.steady_state_operations_review.report"


def test_contract_manifest_contains_v22_decommission_and_steady_state_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    assert "platform.legacy_path_decommission" in job_types
    assert "platform.steady_state_operations_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.legacy_path_decommission" in vector_types
    assert "platform.steady_state_operations_review" in vector_types



def test_v23_queue_resilience_review_passes_with_healthy_queue_controls():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.queue_resilience_review",
                        "idempotencyKey": "queue-resilience-review-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "releaseId": "option-b-v23-smoke",
                            "domain": "analytics",
                            "route": "/api/hybrid-python/analytics/snapshot/prepare",
                            "jobTypes": ["analytics.snapshot"],
                            "queues": [
                                {
                                    "name": "hybrid-python-default",
                                    "depth": 4,
                                    "oldestAgeSeconds": 25,
                                    "consumers": 2,
                                    "processed": 1000,
                                    "failed": 0,
                                    "retryEnabled": True,
                                    "dlqEnabled": True,
                                    "drainRatePerMinute": 120,
                                }
                            ],
                            "retryPolicy": {"enabled": True, "maxAttempts": 3},
                            "dlqPolicy": {"enabled": True, "destination": "hybrid-python-dlq"},
                            "idempotencyEvidence": {"enabled": True},
                            "thresholds": {"maxQueueDepth": 1000, "maxOldestAgeSeconds": 300, "minConsumers": 1, "maxErrorRate": 0.01},
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert body["routedTo"] == "python.platform.queue_resilience_review.v23"
    assert result["decision"] == "pass"
    assert result["totalQueueDepth"] == 4
    assert result["mutatesQueuesOrWorkers"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.queue_resilience_review.report"


def test_v23_artifact_integrity_review_holds_on_missing_redaction_metadata():
    body = as_json(
        run(
            enqueue_job(
                envelope(
                    {
                        "jobType": "platform.artifact_integrity_review",
                        "idempotencyKey": "artifact-integrity-review-smoke-0001",
                        "dryRun": True,
                        "payload": {
                            "releaseId": "option-b-v23-smoke",
                            "domain": "analytics",
                            "route": "/api/hybrid-python/analytics/snapshot/prepare",
                            "jobTypes": ["analytics.snapshot"],
                            "artifacts": [
                                {
                                    "artifactId": "artifact-smoke-001",
                                    "artifactType": "platform.release_decision.report",
                                    "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                                    "sizeBytes": 512,
                                    "redactionApplied": False,
                                    "piiClass": "metadata-only",
                                    "expiresAt": "2026-05-12T00:00:00Z",
                                }
                            ],
                        },
                    }
                )
            )
        )
    )
    result = body["result"]["data"]
    assert body["routedTo"] == "python.platform.artifact_integrity_review.v23"
    assert result["decision"] == "hold"
    assert len(result["blockers"]) >= 1
    assert result["mutatesArtifactsOrAccess"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.artifact_integrity_review.report"


def test_contract_manifest_contains_v23_queue_and_artifact_integrity_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    assert "platform.queue_resilience_review" in job_types
    assert "platform.artifact_integrity_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.queue_resilience_review" in vector_types
    assert "platform.artifact_integrity_review" in vector_types



def test_v24_runbook_freshness_review_passes_with_current_required_runbooks():
    body = as_json(run(enqueue_job(envelope({"jobType": "platform.runbook_freshness_review", "idempotencyKey": "runbook-freshness-review-smoke-0001", "dryRun": True, "payload": {"releaseId": "option-b-v24-smoke", "domain": "analytics", "route": "/api/hybrid-python/analytics/snapshot/prepare", "jobTypes": ["analytics.snapshot"], "runbooks": [{"name": "deploy", "category": "deploy", "owner": "platform", "url": "https://docs.example.invalid/deploy", "lastReviewedAt": "2026-05-01T00:00:00Z", "approved": True}, {"name": "rollback", "category": "rollback", "owner": "release-manager", "url": "https://docs.example.invalid/rollback", "lastReviewedAt": "2026-05-01T00:00:00Z", "approved": True}, {"name": "incident", "category": "incident", "owner": "on-call", "url": "https://docs.example.invalid/incident", "lastReviewedAt": "2026-05-01T00:00:00Z", "approved": True}, {"name": "privacy", "category": "privacy", "owner": "security", "url": "https://docs.example.invalid/privacy", "lastReviewedAt": "2026-05-01T00:00:00Z", "approved": True}, {"name": "support", "category": "support", "owner": "support", "url": "https://docs.example.invalid/support", "lastReviewedAt": "2026-05-01T00:00:00Z", "approved": True}], "thresholds": {"maxStalenessDays": 365}}}))))
    result = body["result"]["data"]
    assert body["routedTo"] == "python.platform.runbook_freshness_review.v24"
    assert result["decision"] == "pass"
    assert result["missingRequiredRunbooks"] == []
    assert result["mutatesDocumentationOrOwnership"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.runbook_freshness_review.report"


def test_v24_support_escalation_review_rolls_back_when_24x7_required_but_missing():
    body = as_json(run(enqueue_job(envelope({"jobType": "platform.support_escalation_review", "idempotencyKey": "support-escalation-review-smoke-0001", "dryRun": True, "payload": {"releaseId": "option-b-v24-smoke", "domain": "analytics", "route": "/api/hybrid-python/analytics/snapshot/prepare", "jobTypes": ["analytics.snapshot"], "supportTiers": [{"name": "L1", "owner": "support", "coverage": "business-hours", "ackMinutes": 15, "customerComms": True}], "escalationPaths": [{"name": "L1-to-L2", "fromTier": "L1", "toTier": "L2", "trigger": "unresolved-after-30m", "maxMinutes": 30, "enabled": True}], "thresholds": {"maxAckMinutes": 30, "maxEscalationMinutes": 60}, "require24x7": True}}))))
    result = body["result"]["data"]
    assert body["routedTo"] == "python.platform.support_escalation_review.v24"
    assert result["decision"] == "rollback"
    assert result["mutatesOnCallOrTicketing"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.support_escalation_review.report"


def test_contract_manifest_contains_v24_runbook_and_support_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    assert "platform.runbook_freshness_review" in job_types
    assert "platform.support_escalation_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.runbook_freshness_review" in vector_types
    assert "platform.support_escalation_review" in vector_types


def test_v25_cost_guardrail_and_environment_parity_reviews_pass_with_clean_evidence():
    cost = run(enqueue_job(envelope({"jobType":"platform.cost_guardrail_review","idempotencyKey":"cost-v25-smoke-0001","dryRun":True,"payload":{"costs":{"dailyCost":100,"workerCost":10,"queueCost":2,"artifactStorageCost":1},"budgets":{"monthlyBudget":5000},"forecast":{"monthlyForecast":3000},"thresholds":{"maxDailyCost":200}}})))
    cost_body = as_json(cost)
    assert cost_body["result"]["resultType"] == "platform.cost_guardrail_review.completed"
    assert cost_body["result"]["data"]["decision"] == "pass"
    env = run(enqueue_job(envelope({"jobType":"platform.environment_parity_review","idempotencyKey":"env-v25-smoke-0001","dryRun":True,"payload":{"staging":{"env":{"PYTHON_SERVICES_BASE_URL":"http://python","PYTHON_WORKER_REQUIRE_SIGNATURE":"true","HYBRID_PYTHON_ENABLED":"true","HYBRID_PYTHON_CANARY_PERCENT":"5"},"services":["node-api","python-worker-api","python-worker-celery","redis"],"secretFingerprints":{"bridge":"abc"}},"production":{"env":{"PYTHON_SERVICES_BASE_URL":"http://python","PYTHON_WORKER_REQUIRE_SIGNATURE":"true","HYBRID_PYTHON_ENABLED":"true","HYBRID_PYTHON_CANARY_PERCENT":"5"},"services":["node-api","python-worker-api","python-worker-celery","redis"],"secretFingerprints":{"bridge":"abc"}}}})))
    env_body = as_json(env)
    assert env_body["result"]["resultType"] == "platform.environment_parity_review.completed"
    assert env_body["result"]["data"]["decision"] == "pass"

def test_v26_access_control_review_passes_with_negative_bola_and_cross_org_denies():
    body = as_json(run(enqueue_job(envelope({
        "jobType": "platform.access_control_review",
        "idempotencyKey": "access-control-review-smoke-0001",
        "dryRun": True,
        "payload": {
            "releaseId": "option-b-v26-smoke",
            "domain": "platform",
            "route": "/api/hybrid-python/admin/accounts/read-model/prepare",
            "jobTypes": ["admin.accounts_read_model"],
            "controls": [{"name": "rbac", "enabled": True}, {"name": "abac", "enabled": True}, {"name": "objectLevelAuth", "enabled": True}],
            "authorizationMatrix": {"roles": ["SUPER_ADMIN", "COMPANY_ADMIN"]},
            "abacPolicies": [{"name": "organization-scope", "enabled": True}],
            "objectAccessTests": [{"name": "BOLA cross-org record deny", "objectLevel": True, "negative": True, "crossOrg": True, "expectedOutcome": "denied", "actualOutcome": "denied", "passed": True}],
            "negativeTests": [{"name": "cross-org account deny", "crossOrg": True, "negative": True, "expectedOutcome": "denied", "actualOutcome": "denied", "passed": True}],
        },
    }))))
    result = body["result"]["data"]
    assert body["routedTo"] == "python.platform.access_control_review.v26"
    assert result["decision"] == "pass"
    assert result["mutatesAuthorization"] is False
    assert result["nodeOwnsAuthzAndObjectScope"] is True
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.access_control_review.report"


def test_v26_data_quality_review_passes_with_clean_aggregate_metrics():
    body = as_json(run(enqueue_job(envelope({
        "jobType": "platform.data_quality_review",
        "idempotencyKey": "data-quality-review-smoke-0001",
        "dryRun": True,
        "payload": {
            "releaseId": "option-b-v26-smoke",
            "domain": "platform",
            "route": "/api/hybrid-python/jobs",
            "jobTypes": ["analytics.snapshot"],
            "expectedSchemaVersion": "v1",
            "datasets": [{"name": "hybrid_jobs", "freshnessMinutes": 5, "nullRate": 0.0, "duplicateRate": 0.0, "schemaVersion": "v1", "expectedSchemaVersion": "v1", "redactionApplied": True, "piiClass": "metadata-only"}],
            "thresholds": {"maxFreshnessMinutes": 60, "maxNullRate": 0.05, "maxDuplicateRate": 0.001},
        },
    }))))
    result = body["result"]["data"]
    assert body["routedTo"] == "python.platform.data_quality_review.v26"
    assert result["decision"] == "pass"
    assert result["failureSummary"]["redactionFailures"] == 0
    assert result["mutatesDataOrSchemas"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.data_quality_review.report"


def test_contract_manifest_contains_v25_v26_release_gate_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    assert "platform.cost_guardrail_review" in job_types
    assert "platform.environment_parity_review" in job_types
    assert "platform.access_control_review" in job_types
    assert "platform.data_quality_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.cost_guardrail_review" in vector_types
    assert "platform.environment_parity_review" in vector_types
    assert "platform.access_control_review" in vector_types
    assert "platform.data_quality_review" in vector_types



def test_v27_ci_staging_validation_review_passes_with_clean_closure_evidence():
    body = as_json(run(enqueue_job(envelope({
        "jobType": "platform.ci_staging_validation_review",
        "idempotencyKey": "ci-staging-validation-review-smoke-0001",
        "dryRun": True,
        "payload": {
            "releaseId": "option-b-v27-smoke",
            "domain": "platform",
            "route": "/api/hybrid-python/jobs",
            "jobTypes": ["platform.cost_guardrail_review", "platform.environment_parity_review", "platform.access_control_review", "platform.data_quality_review"],
            "checks": [
                {"name": "npm-ci", "status": "passed"},
                {"name": "build-contracts", "status": "passed"},
                {"name": "build-api", "status": "passed"},
                {"name": "python-tests", "status": "passed"},
                {"name": "docker-compose-smoke", "status": "passed"},
                {"name": "signed-hmac", "status": "passed"},
                {"name": "redis-status-store", "status": "passed"},
                {"name": "artifact-registry", "status": "passed"},
                {"name": "canary-rollback", "status": "passed"},
                {"name": "observability", "status": "passed"},
                {"name": "node-bridge-routes", "status": "passed"},
            ],
            "builds": {"npmCi": {"status": "passed"}, "contracts": {"status": "passed"}, "api": {"status": "passed"}},
            "docker": {"status": "passed"},
            "hmac": {"signatureRequired": True, "rejectsUnsigned": True, "acceptsSigned": True},
            "redis": {"status": "passed"},
            "artifactRegistry": {"status": "passed"},
            "canary": {"status": "passed"},
            "observability": {"status": "passed"},
            "evidence": {"pythonTests": {"status": "passed"}},
        },
    }))))
    result = body["result"]["data"]
    assert body["routedTo"] == "python.platform.ci_staging_validation_review.v27"
    assert result["decision"] == "pass"
    assert result["failedRequiredChecks"] == 0
    assert result["mutatesCiOrStaging"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.ci_staging_validation_review.report"


def test_v27_release_closure_review_passes_with_required_gates_and_approval():
    body = as_json(run(enqueue_job(envelope({
        "jobType": "platform.release_closure_review",
        "idempotencyKey": "release-closure-review-smoke-0001",
        "dryRun": True,
        "payload": {
            "releaseId": "option-b-v27-smoke",
            "domain": "platform",
            "route": "/api/hybrid-python/jobs",
            "jobTypes": ["platform.cost_guardrail_review", "platform.environment_parity_review", "platform.access_control_review", "platform.data_quality_review", "platform.ci_staging_validation_review"],
            "gateResults": {
                "costGuardrail": {"decision": "pass"},
                "environmentParity": {"decision": "pass"},
                "accessControl": {"decision": "pass"},
                "dataQuality": {"decision": "pass"},
                "ciStagingValidation": {"decision": "pass"},
                "releaseDecision": {"decision": "pass"},
                "rollbackDrill": {"status": "passed"},
                "postDeployVerify": {"decision": "pass"},
                "changeTicketBundle": {"status": "passed"},
            },
            "evidenceBundle": {"artifactId": "bundle-v27", "sha256": "abc"},
            "validationSummary": {"status": "passed"},
            "risks": [{"name": "ts-build-external", "severity": "low", "status": "accepted"}],
            "approvals": [{"name": "release-owner", "status": "approved"}],
        },
    }))))
    result = body["result"]["data"]
    assert body["routedTo"] == "python.platform.release_closure_review.v27"
    assert result["decision"] == "pass"
    assert result["closureState"] == "closed-ready"
    assert result["mutatesReleaseTicketOrDeployment"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.release_closure_review.report"


def test_contract_manifest_contains_v27_closure_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    assert "platform.ci_staging_validation_review" in job_types
    assert "platform.release_closure_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.ci_staging_validation_review" in vector_types
    assert "platform.release_closure_review" in vector_types



def test_v28_production_canary_observation_review_passes_with_clean_aggregate_signals():
    body = as_json(run(enqueue_job(envelope({
        "jobType": "platform.production_canary_observation_review",
        "idempotencyKey": "production-canary-observation-review-smoke-0001",
        "dryRun": True,
        "payload": {
            "releaseId": "option-b-v28-smoke",
            "domain": "platform",
            "route": "/api/hybrid-python/jobs",
            "jobTypes": ["platform.release_closure_review"],
            "windowMinutes": 30,
            "currentCanaryPercent": 5,
            "targetCanaryPercent": 10,
            "metrics": {"errorRate": 0.001, "p95LatencyMs": 450, "mismatchRate": 0.0, "failedJobs": 0, "queueLagSeconds": 2, "hmacRejects": 3, "artifactFailures": 0, "sampleSize": 100},
            "thresholds": {"maxErrorRate": 0.01, "maxP95LatencyMs": 2000, "maxMismatchRate": 0.005, "maxFailedJobs": 0, "maxQueueLagSeconds": 60, "maxArtifactFailures": 0, "minSampleSize": 25},
            "signals": [
                {"name": "errorRate", "status": "passed"},
                {"name": "p95LatencyMs", "status": "passed"},
                {"name": "mismatchRate", "status": "passed"},
                {"name": "failedJobs", "status": "passed"},
                {"name": "queueLagSeconds", "status": "passed"},
                {"name": "hmacRejects", "status": "passed"},
                {"name": "artifactFailures", "status": "passed"},
            ],
            "rollbackTriggers": [{"name": "error-budget-breach", "enabled": True, "fired": False}],
        },
    }))))
    result = body["result"]["data"]
    assert body["routedTo"] == "python.platform.production_canary_observation_review.v28"
    assert result["decision"] == "pass"
    assert result["mutatesCanaryOrTraffic"] is False
    assert result["nodeRolloutOwnsTraffic"] is True
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.production_canary_observation_review.report"


def test_v28_incident_response_readiness_review_passes_with_complete_coverage():
    body = as_json(run(enqueue_job(envelope({
        "jobType": "platform.incident_response_readiness_review",
        "idempotencyKey": "incident-response-readiness-review-smoke-0001",
        "dryRun": True,
        "payload": {
            "releaseId": "option-b-v28-smoke",
            "domain": "platform",
            "route": "/api/hybrid-python/jobs",
            "jobTypes": ["platform.release_closure_review"],
            "oncall": [
                {"name": "primaryOncall", "enabled": True, "ackMinutes": 5},
                {"name": "secondaryOncall", "enabled": True, "ackMinutes": 10},
                {"name": "incidentCommander", "enabled": True},
                {"name": "rollbackOwner", "enabled": True},
            ],
            "escalationPaths": [{"name": "pagerRoute", "enabled": True, "maxMinutes": 15}],
            "runbooks": [{"name": "runbook", "status": "passed", "enabled": True}],
            "comms": {"customerComms": True, "status": "passed"},
            "drills": [{"name": "rollback-drill", "status": "passed"}],
            "thresholds": {"maxAckMinutes": 15, "maxEscalationMinutes": 30},
        },
    }))))
    result = body["result"]["data"]
    assert body["routedTo"] == "python.platform.incident_response_readiness_review.v28"
    assert result["decision"] == "pass"
    assert result["mutatesOncallOrTickets"] is False
    assert result["operatorsOwnIncidentResponse"] is True
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.incident_response_readiness_review.report"


def test_contract_manifest_contains_v28_post_release_hardening_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    assert "platform.production_canary_observation_review" in job_types
    assert "platform.incident_response_readiness_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.production_canary_observation_review" in vector_types
    assert "platform.incident_response_readiness_review" in vector_types


def test_v29_traffic_promotion_readiness_review_passes_with_clean_gate_evidence():
    body = as_json(run(enqueue_job(envelope({"jobType":"platform.traffic_promotion_readiness_review","idempotencyKey":"traffic-promotion-readiness-review-smoke-0001","dryRun":True,"payload":{"releaseId":"option-b-v29-smoke","domain":"platform","route":"/api/hybrid-python/jobs","jobTypes":["platform.production_canary_observation_review","platform.incident_response_readiness_review"],"currentCanaryPercent":10,"targetCanaryPercent":20,"maxPromotionStepPercent":10,"gateEvidence":{"releaseClosure":{"decision":"pass"},"productionCanaryObservation":{"decision":"pass"},"incidentResponseReadiness":{"decision":"pass"},"rollbackPlan":{"decision":"pass"},"operatorApproval":{"decision":"pass"}},"productionObservation":{"decision":"pass"},"incidentReadiness":{"decision":"pass"},"approvals":[{"name":"release-owner","status":"approved"}],"freezeWindows":[],"rollbackPlan":{"ready":True,"decision":"pass"}}}))))
    result = body["result"]["data"]
    assert body["routedTo"] == "python.platform.traffic_promotion_readiness_review.v29"
    assert result["decision"] == "pass"
    assert result["mutatesTrafficOrRollout"] is False
    assert result["nodeControlPlaneOwnsPromotion"] is True
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.traffic_promotion_readiness_review.report"


def test_v29_evidence_retention_audit_review_passes_with_protected_artifact_metadata():
    artifacts=[{"artifactType":"platform.release_closure_review.report","sha256":"abc123","piiClass":"release-closure-evidence-metadata-only","redactionApplied":True,"downloadProtected":True,"expiresAt":"2026-06-06T00:00:00Z"},{"artifactType":"platform.production_canary_observation_review.report","sha256":"def456","piiClass":"production-canary-observation-metadata-only","redactionApplied":True,"downloadProtected":True,"expiresAt":"2026-06-06T00:00:00Z"},{"artifactType":"platform.incident_response_readiness_review.report","sha256":"ghi789","piiClass":"incident-response-readiness-metadata-only","redactionApplied":True,"downloadProtected":True,"expiresAt":"2026-06-06T00:00:00Z"}]
    body = as_json(run(enqueue_job(envelope({"jobType":"platform.evidence_retention_audit_review","idempotencyKey":"evidence-retention-audit-review-smoke-0001","dryRun":True,"payload":{"releaseId":"option-b-v29-smoke","domain":"platform","route":"/api/hybrid-python/jobs","jobTypes":["platform.release_closure_review"],"artifacts":artifacts,"retentionPolicy":{"retentionDays":45},"minRetentionDays":30}}))))
    result = body["result"]["data"]
    assert body["routedTo"] == "python.platform.evidence_retention_audit_review.v29"
    assert result["decision"] == "pass"
    assert result["mutatesArtifactsOrRetention"] is False
    assert result["nodeArtifactRegistryOwnsDownloads"] is True
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.evidence_retention_audit_review.report"


def test_contract_manifest_contains_v29_traffic_promotion_and_retention_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    assert "platform.traffic_promotion_readiness_review" in job_types
    assert "platform.evidence_retention_audit_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.traffic_promotion_readiness_review" in vector_types
    assert "platform.evidence_retention_audit_review" in vector_types


def test_v30_slo_error_budget_review_passes_with_clean_aggregate_metrics():
    body = as_json(run(enqueue_job(envelope({"jobType":"platform.slo_error_budget_review","idempotencyKey":"slo-error-budget-review-smoke-0001","dryRun":True,"payload":{"releaseId":"option-b-v30-smoke","domain":"platform","route":"/api/hybrid-python/jobs","jobTypes":["platform.traffic_promotion_readiness_review"],"windowMinutes":60,"sloTargets":{"availability":99.9},"metrics":{"availability":99.95,"errorRate":0.001,"p95LatencyMs":420,"burnRate":0.8,"errorBudgetRemaining":65,"sampleSize":1000,"alertCoverage":True},"services":[{"name":"python-worker-api","availability":99.96,"errorRate":0.001,"p95LatencyMs":400,"burnRate":0.7,"errorBudgetRemaining":70,"sampleSize":500}],"evidence":{"alertCoverage":True}}}))))
    result = body["result"]["data"]
    assert body["routedTo"] == "python.platform.slo_error_budget_review.v30"
    assert result["decision"] == "pass"
    assert result["mutatesAlertsOrRollout"] is False
    assert result["nodeControlPlaneOwnsRollout"] is True
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.slo_error_budget_review.report"


def test_v30_auto_rollback_safeguard_review_passes_with_ready_controls():
    body = as_json(run(enqueue_job(envelope({"jobType":"platform.auto_rollback_safeguard_review","idempotencyKey":"auto-rollback-safeguard-review-smoke-0001","dryRun":True,"payload":{"releaseId":"option-b-v30-smoke","domain":"platform","route":"/api/hybrid-python/jobs","jobTypes":["platform.slo_error_budget_review"],"rolloutId":"option-b-v30-rollout","canaryPercent":20,"safeguards":[{"name":"automatictrigger","enabled":True,"ready":True},{"name":"manualoverride","enabled":True,"ready":True},{"name":"nodefallback","enabled":True,"ready":True},{"name":"rollbackrunbook","enabled":True,"ready":True},{"name":"recentdrill","enabled":True,"ready":True}],"rollbackTriggers":[{"name":"error-budget-breach","enabled":True,"fired":False,"detectionMinutes":2}],"featureFlags":[{"name":"hybrid-python-enabled","killSwitch":True,"enabled":True}],"runbook":{"name":"rollback-runbook","ready":True,"decision":"pass"},"evidence":{"manualOverride":True,"nodeFallback":True,"rollbackMinutes":8}}}))))
    result = body["result"]["data"]
    assert body["routedTo"] == "python.platform.auto_rollback_safeguard_review.v30"
    assert result["decision"] == "pass"
    assert result["mutatesRollbackOrFlags"] is False
    assert result["nodeControlPlaneOwnsRollback"] is True
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.auto_rollback_safeguard_review.report"


def test_contract_manifest_contains_v30_slo_and_auto_rollback_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    assert "platform.slo_error_budget_review" in job_types
    assert "platform.auto_rollback_safeguard_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.slo_error_budget_review" in vector_types
    assert "platform.auto_rollback_safeguard_review" in vector_types



def test_v31_third_party_dependency_review_passes_with_clean_dependencies():
    payload = {
        "jobType": "platform.third_party_dependency_review",
        "idempotencyKey": "third-party-dependency-review-smoke-0001",
        "dryRun": True,
        "payload": {
            "releaseId": "option-b-v31-smoke",
            "domain": "platform",
            "route": "/api/hybrid-python/jobs",
            "jobTypes": ["platform.slo_error_budget_review"],
            "dependencies": [
                {"name": "redis", "status": "operational", "errorRate": 0, "p95LatencyMs": 25, "rateLimitHeadroomPercent": 80, "failoverReady": True},
                {"name": "objectStorage", "status": "operational", "errorRate": 0, "p95LatencyMs": 120, "rateLimitHeadroomPercent": 75, "failoverReady": True},
                {"name": "database", "status": "operational", "errorRate": 0, "p95LatencyMs": 35, "rateLimitHeadroomPercent": 70, "failoverReady": True},
                {"name": "observability", "status": "operational", "errorRate": 0, "p95LatencyMs": 80, "rateLimitHeadroomPercent": 65, "failoverReady": True},
                {"name": "authProvider", "status": "operational", "errorRate": 0, "p95LatencyMs": 90, "rateLimitHeadroomPercent": 60, "failoverReady": True},
            ],
            "incidents": [],
            "statusPages": [{"name": "core-dependencies", "status": "operational"}],
        },
    }
    body = as_json(run(enqueue_job(envelope(payload))))
    assert body["routedTo"] == "python.platform.third_party_dependency_review.v31"
    assert body["result"]["resultType"] == "platform.third_party_dependency_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.third_party_dependency_review.report"


def test_v31_capacity_scaling_readiness_review_passes_with_capacity_evidence():
    payload = {
        "jobType": "platform.capacity_scaling_readiness_review",
        "idempotencyKey": "capacity-scaling-readiness-review-smoke-0001",
        "dryRun": True,
        "payload": {
            "releaseId": "option-b-v31-smoke",
            "domain": "platform",
            "route": "/api/hybrid-python/jobs",
            "jobTypes": ["platform.third_party_dependency_review"],
            "currentCanaryPercent": 20,
            "targetCanaryPercent": 35,
            "metrics": {"queueLagSeconds": 2, "cpuPercent": 45, "memoryPercent": 55, "p95LatencyMs": 420, "workerConcurrency": 8},
            "queues": [{"name": "python-worker-celery", "queueLagSeconds": 2, "backlog": 0}],
            "workers": [
                {"name": "python-worker-api", "cpuPercent": 40, "memoryPercent": 50, "workerConcurrency": 4},
                {"name": "python-worker-celery", "cpuPercent": 48, "memoryPercent": 58, "workerConcurrency": 8},
            ],
            "autoscaling": {"enabled": True, "ready": True, "minReplicas": 2, "maxReplicas": 8},
            "loadTest": {"passed": True, "decision": "pass", "peakRps": 100},
        },
    }
    body = as_json(run(enqueue_job(envelope(payload))))
    assert body["routedTo"] == "python.platform.capacity_scaling_readiness_review.v31"
    assert body["result"]["resultType"] == "platform.capacity_scaling_readiness_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.capacity_scaling_readiness_review.report"


def test_contract_manifest_contains_v31_dependency_and_capacity_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert "platform.third_party_dependency_review" in job_types
    assert "platform.capacity_scaling_readiness_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.third_party_dependency_review" in vector_types
    assert "platform.capacity_scaling_readiness_review" in vector_types


def test_v32_compliance_privacy_evidence_review_passes_with_sanitized_evidence():
    payload = {
        "jobType": "platform.compliance_privacy_evidence_review",
        "idempotencyKey": "compliance-privacy-evidence-review-smoke-0001",
        "dryRun": True,
        "payload": {
            "releaseId": "option-b-v32-smoke",
            "domain": "platform",
            "route": "/api/hybrid-python/jobs",
            "jobTypes": ["platform.capacity_scaling_readiness_review"],
            "evidence": {
                "privacyPreflight": {"decision": "pass"},
                "dataRetention": {"decision": "pass"},
                "auditTrail": {"decision": "pass"},
                "securityPosture": {"decision": "pass"},
                "accessControl": {"decision": "pass"},
                "dataQuality": {"decision": "pass"},
            },
            "artifacts": [{"artifactType": "platform.release_closure_review.report", "sha256": "abc123", "piiClass": "metadata-only", "redactionApplied": True, "downloadProtected": True}],
            "complianceControls": [{"name": "minimum-necessary", "decision": "pass"}],
            "dpia": {"approved": True, "decision": "pass"},
            "dpaRecords": [{"name": "vendor-dpa", "status": "active"}],
            "approvals": [{"name": "privacy-owner", "status": "approved"}],
        },
    }
    body = as_json(run(enqueue_job(envelope(payload))))
    assert body["routedTo"] == "python.platform.compliance_privacy_evidence_review.v32"
    assert body["result"]["resultType"] == "platform.compliance_privacy_evidence_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["data"]["mutatesPrivacyOrComplianceSystems"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.compliance_privacy_evidence_review.report"


def test_v32_runbook_drill_verification_review_passes_with_recent_drills():
    payload = {
        "jobType": "platform.runbook_drill_verification_review",
        "idempotencyKey": "runbook-drill-verification-review-smoke-0001",
        "dryRun": True,
        "payload": {
            "releaseId": "option-b-v32-smoke",
            "domain": "platform",
            "route": "/api/hybrid-python/jobs",
            "jobTypes": ["platform.compliance_privacy_evidence_review"],
            "runbooks": [
                {"name": "rollback", "ready": True, "ownerAck": True, "ageDays": 10, "url": "runbook://rollback"},
                {"name": "incident", "ready": True, "ownerAck": True, "ageDays": 12, "url": "runbook://incident"},
                {"name": "supportEscalation", "ready": True, "ownerAck": True, "ageDays": 7, "url": "runbook://support"},
                {"name": "artifactRecovery", "ready": True, "ownerAck": True, "ageDays": 14, "url": "runbook://artifact"},
                {"name": "dataPrivacy", "ready": True, "ownerAck": True, "ageDays": 8, "url": "runbook://privacy"},
            ],
            "drills": [
                {"name": "rollback", "passed": True, "ageDays": 15},
                {"name": "incident", "passed": True, "ageDays": 20},
                {"name": "restore", "passed": True, "ageDays": 18},
                {"name": "supportEscalation", "passed": True, "ageDays": 21},
            ],
            "evidence": {"operatorReview": {"decision": "pass"}},
        },
    }
    body = as_json(run(enqueue_job(envelope(payload))))
    assert body["routedTo"] == "python.platform.runbook_drill_verification_review.v32"
    assert body["result"]["resultType"] == "platform.runbook_drill_verification_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["data"]["mutatesRunbooksOrIncidents"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.runbook_drill_verification_review.report"


def test_contract_manifest_contains_v32_compliance_and_runbook_drill_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    assert "platform.compliance_privacy_evidence_review" in job_types
    assert "platform.runbook_drill_verification_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.compliance_privacy_evidence_review" in vector_types
    assert "platform.runbook_drill_verification_review" in vector_types


def test_v33_disaster_recovery_backup_review_passes_with_recent_backups_and_restore_drill():
    payload = {
        "jobType": "platform.disaster_recovery_backup_review",
        "idempotencyKey": "disaster-recovery-backup-review-smoke-0001",
        "dryRun": True,
        "payload": {
            "releaseId": "option-b-v33-smoke",
            "domain": "platform",
            "route": "/api/hybrid-python/jobs",
            "jobTypes": ["platform.runbook_drill_verification_review"],
            "backups": [
                {"name": "database", "verified": True, "encrypted": True, "offsiteCopy": True, "ageHours": 4, "sha256": "db"},
                {"name": "redis", "verified": True, "encrypted": True, "offsiteCopy": True, "ageHours": 3, "sha256": "redis"},
                {"name": "artifactStorage", "verified": True, "encrypted": True, "offsiteCopy": True, "ageHours": 5, "sha256": "artifact"},
                {"name": "configuration", "verified": True, "encrypted": True, "offsiteCopy": True, "ageHours": 2, "sha256": "config"},
            ],
            "restoreDrills": [{"name": "restore", "passed": True, "ageDays": 10, "rpoMinutes": 15, "rtoMinutes": 90}],
            "rpoRtoTargets": {"maxRpoMinutes": 60, "maxRtoMinutes": 240},
            "evidence": {"operatorReview": {"decision": "pass"}},
        },
    }
    body = as_json(run(enqueue_job(envelope(payload))))
    assert body["routedTo"] == "python.platform.disaster_recovery_backup_review.v33"
    assert body["result"]["resultType"] == "platform.disaster_recovery_backup_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["data"]["mutatesBackupOrRestoreSystems"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.disaster_recovery_backup_review.report"


def test_v33_change_migration_readiness_review_passes_with_approval_and_rehearsal():
    payload = {
        "jobType": "platform.change_migration_readiness_review",
        "idempotencyKey": "change-migration-readiness-review-smoke-0001",
        "dryRun": True,
        "payload": {
            "releaseId": "option-b-v33-smoke",
            "domain": "platform",
            "route": "/api/hybrid-python/jobs",
            "jobTypes": ["platform.disaster_recovery_backup_review"],
            "migrations": [
                {"name": "schema", "decision": "pass", "dryRunPassed": True, "reversible": True, "destructive": False, "backupBeforeMigration": True},
                {"name": "contracts", "decision": "pass", "dryRunPassed": True, "reversible": True, "backupBeforeMigration": True},
            ],
            "changeTickets": [{"name": "CHG-option-b-v33", "status": "approved", "ageDays": 2}],
            "approvals": [{"name": "release-manager", "status": "approved"}],
            "rollbackPlan": {"decision": "pass"},
            "rolloutPlan": {"decision": "pass"},
            "dataBackfill": {"decision": "pass"},
            "evidence": {"migrationDryRun": {"decision": "pass"}},
        },
    }
    body = as_json(run(enqueue_job(envelope(payload))))
    assert body["routedTo"] == "python.platform.change_migration_readiness_review.v33"
    assert body["result"]["resultType"] == "platform.change_migration_readiness_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["data"]["mutatesSchemaOrChangeSystems"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.change_migration_readiness_review.report"


def test_contract_manifest_contains_v33_dr_and_change_migration_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    assert "platform.disaster_recovery_backup_review" in job_types
    assert "platform.change_migration_readiness_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.disaster_recovery_backup_review" in vector_types
    assert "platform.change_migration_readiness_review" in vector_types

def test_v34_configuration_secret_rotation_review_passes_with_sanitized_secret_metadata():
    payload = {"jobType":"platform.configuration_secret_rotation_review","idempotencyKey":"configuration-secret-rotation-review-smoke-0001","dryRun":True,"payload":{"releaseId":"option-b-v34-smoke","domain":"platform","route":"/api/hybrid-python/jobs","jobTypes":["platform.change_migration_readiness_review"],"secrets":[{"name":"pythonWorkerHmac","decision":"pass","ageDays":12,"externalStore":True,"rotationDue":False,"breakGlassReady":True},{"name":"redis","decision":"pass","ageDays":20,"externalStore":True,"rotationDue":False,"breakGlassReady":True},{"name":"database","decision":"pass","ageDays":25,"externalStore":True,"rotationDue":False,"breakGlassReady":True},{"name":"artifactStorage","decision":"pass","ageDays":8,"externalStore":True,"rotationDue":False,"breakGlassReady":True}],"configItems":[{"name":"PYTHON_WORKER_REQUIRE_SIGNATURE","decision":"pass","drift":False,"redacted":True},{"name":"HYBRID_PYTHON_CANARY_PERCENT","decision":"pass","drift":False,"redacted":True}],"rotations":[{"name":"quarterly-secret-rotation","decision":"pass","completed":True,"scheduled":True}],"evidence":{"secretManager":{"decision":"pass"}}}}
    body = as_json(run(enqueue_job(envelope(payload))))
    assert body["routedTo"] == "python.platform.configuration_secret_rotation_review.v34"
    assert body["result"]["resultType"] == "platform.configuration_secret_rotation_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["data"]["mutatesSecretsOrConfiguration"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.configuration_secret_rotation_review.report"


def test_v34_maintenance_window_readiness_review_passes_with_approval_tasks_and_comms():
    # Use a recent approval timestamp so the window stays within the default
    # 30-day freshness threshold regardless of when the suite runs (previously
    # a hardcoded date aged past the threshold and flipped the decision to hold).
    recent_approved_at = (datetime.now(timezone.utc) - timedelta(days=2)).strftime("%Y-%m-%dT%H:%M:%SZ")
    payload = {"jobType":"platform.maintenance_window_readiness_review","idempotencyKey":"maintenance-window-readiness-review-smoke-0001","dryRun":True,"payload":{"releaseId":"option-b-v34-smoke","domain":"platform","route":"/api/hybrid-python/jobs","jobTypes":["platform.configuration_secret_rotation_review"],"maintenanceWindows":[{"name":"low-traffic-window","decision":"pass","lowTraffic":True,"approvedAt":recent_approved_at}],"tasks":[{"name":"preflight","decision":"pass","passed":True,"ownerAck":True},{"name":"backup","decision":"pass","passed":True,"ownerAck":True},{"name":"rollback","decision":"pass","passed":True,"ownerAck":True},{"name":"postVerify","decision":"pass","passed":True,"ownerAck":True}],"approvals":[{"name":"sre-lead","status":"approved"}],"comms":{"decision":"pass"},"evidence":{"changeCalendar":{"decision":"pass"}}}}
    body = as_json(run(enqueue_job(envelope(payload))))
    assert body["routedTo"] == "python.platform.maintenance_window_readiness_review.v34"
    assert body["result"]["resultType"] == "platform.maintenance_window_readiness_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["data"]["mutatesSchedulesOrTraffic"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.maintenance_window_readiness_review.report"


def test_contract_manifest_contains_v34_configuration_and_maintenance_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    assert "platform.configuration_secret_rotation_review" in job_types
    assert "platform.maintenance_window_readiness_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.configuration_secret_rotation_review" in vector_types
    assert "platform.maintenance_window_readiness_review" in vector_types




def test_v35_audit_forensics_readiness_review_passes_with_immutable_audit_and_drill_metadata():
    payload = {"jobType":"platform.audit_forensics_readiness_review","idempotencyKey":"audit-forensics-readiness-review-smoke-0001","dryRun":True,"payload":{"releaseId":"option-b-v35-smoke","domain":"platform","route":"/api/hybrid-python/jobs","jobTypes":["platform.maintenance_window_readiness_review"],"auditTrails":[{"name":"apiAudit","decision":"pass","gapMinutes":2,"immutable":True,"complete":True},{"name":"authAudit","decision":"pass","gapMinutes":3,"immutable":True,"complete":True},{"name":"workerAudit","decision":"pass","gapMinutes":2,"immutable":True,"complete":True},{"name":"artifactAccessAudit","decision":"pass","gapMinutes":4,"immutable":True,"complete":True}],"forensicArtifacts":[{"name":"incident-evidence-bundle","decision":"pass","ageDays":1,"redactionApplied":True,"immutable":True,"verified":True}],"investigationDrills":[{"name":"forensics-drill","decision":"pass","passed":True,"ageDays":7}],"chainOfCustody":{"decision":"pass","verified":True},"evidence":{"siemExport":{"decision":"pass"}}}}
    body = as_json(run(enqueue_job(envelope(payload))))
    assert body["routedTo"] == "python.platform.audit_forensics_readiness_review.v35"
    assert body["result"]["resultType"] == "platform.audit_forensics_readiness_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["data"]["mutatesAuditOrForensicSystems"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.audit_forensics_readiness_review.report"


def test_v35_business_continuity_readiness_review_passes_with_plans_comms_fallback_and_exercise():
    payload = {"jobType":"platform.business_continuity_readiness_review","idempotencyKey":"business-continuity-readiness-review-smoke-0001","dryRun":True,"payload":{"releaseId":"option-b-v35-smoke","domain":"platform","route":"/api/hybrid-python/jobs","jobTypes":["platform.audit_forensics_readiness_review"],"continuityPlans":[{"name":"support","decision":"pass","approved":True,"ownerAck":True},{"name":"operations","decision":"pass","approved":True,"ownerAck":True},{"name":"billing","decision":"pass","approved":True,"ownerAck":True},{"name":"clinical","decision":"pass","approved":True,"ownerAck":True}],"teams":[{"name":"sre","decision":"pass","coverageReady":True,"primaryOnCall":True,"backupOnCall":True}],"communications":{"decision":"pass"},"fallbackProcedures":[{"name":"manual-intake","decision":"pass","tested":True}],"exercises":[{"name":"continuity-tabletop","decision":"pass","passed":True,"ageDays":30}],"evidence":{"continuityReview":{"decision":"pass"}}}}
    body = as_json(run(enqueue_job(envelope(payload))))
    assert body["routedTo"] == "python.platform.business_continuity_readiness_review.v35"
    assert body["result"]["resultType"] == "platform.business_continuity_readiness_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["data"]["mutatesContinuityOrCustomerComms"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.business_continuity_readiness_review.report"


def test_contract_manifest_contains_v35_audit_forensics_and_business_continuity_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    assert "platform.audit_forensics_readiness_review" in job_types
    assert "platform.business_continuity_readiness_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.audit_forensics_readiness_review" in vector_types
    assert "platform.business_continuity_readiness_review" in vector_types


def test_v36_post_incident_learning_review_passes_with_postmortem_actions_and_regression_guard():
    payload = {"jobType":"platform.post_incident_learning_review","idempotencyKey":"post-incident-learning-review-smoke-0001","dryRun":True,"payload":{"releaseId":"option-b-v36-smoke","domain":"platform","route":"/api/hybrid-python/jobs","jobTypes":["platform.business_continuity_readiness_review"],"incidents":[{"name":"sev1","decision":"pass","postmortemLinked":True,"ownerAck":True},{"name":"sev2","decision":"pass","postmortemLinked":True,"ownerAck":True},{"name":"rollback","decision":"pass","postmortemLinked":True,"ownerAck":True},{"name":"privacy","decision":"pass","postmortemLinked":True,"ownerAck":True}],"postmortems":[{"name":"may-release-learning","decision":"pass","completed":True,"ownerAck":True}],"actionItems":[{"name":"add-regression-guard","decision":"pass","status":"closed","ownerAck":True,"ageDays":5}],"regressions":[{"name":"rollback-path-regression","decision":"pass","passed":True}],"evidence":{"learningReview":{"decision":"pass"}}}}
    body = as_json(run(enqueue_job(envelope(payload))))
    assert body["routedTo"] == "python.platform.post_incident_learning_review.v36"
    assert body["result"]["resultType"] == "platform.post_incident_learning_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["data"]["mutatesIncidentsOrTickets"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.post_incident_learning_review.report"


def test_v36_tech_debt_governance_review_passes_with_register_waiver_and_plan():
    payload = {"jobType":"platform.tech_debt_governance_review","idempotencyKey":"tech-debt-governance-review-smoke-0001","dryRun":True,"payload":{"releaseId":"option-b-v36-smoke","domain":"platform","route":"/api/hybrid-python/jobs","jobTypes":["platform.post_incident_learning_review"],"debtItems":[{"name":"security-debt-register","category":"security","severity":"medium","decision":"pass","ownerAck":True,"remediationPlanned":True},{"name":"reliability-debt-register","category":"reliability","severity":"medium","decision":"pass","ownerAck":True,"remediationPlanned":True},{"name":"contract-debt-register","category":"contracts","severity":"low","decision":"pass","ownerAck":True,"remediationPlanned":True},{"name":"observability-debt-register","category":"observability","severity":"low","decision":"pass","ownerAck":True,"remediationPlanned":True}],"waivers":[{"name":"temporary-waiver","decision":"pass","approved":True,"ageDays":10,"expiresAt":"2026-06-01T00:00:00Z"}],"ownership":[{"name":"platform-eng","status":"approved"}],"remediationPlan":{"decision":"pass"},"evidence":{"debtReview":{"decision":"pass"}}}}
    body = as_json(run(enqueue_job(envelope(payload))))
    assert body["routedTo"] == "python.platform.tech_debt_governance_review.v36"
    assert body["result"]["resultType"] == "platform.tech_debt_governance_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["data"]["mutatesBacklogOrWaivers"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.tech_debt_governance_review.report"


def test_contract_manifest_contains_v36_post_incident_and_tech_debt_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    assert "platform.post_incident_learning_review" in job_types
    assert "platform.tech_debt_governance_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.post_incident_learning_review" in vector_types
    assert "platform.tech_debt_governance_review" in vector_types



def test_v37_vendor_resilience_review_passes_with_vendor_status_incident_and_exit_plan():
    payload = {"jobType":"platform.vendor_resilience_review","idempotencyKey":"vendor-resilience-review-smoke-0001","dryRun":True,"payload":{"releaseId":"option-b-v37-smoke","domain":"platform","route":"/api/hybrid-python/jobs","jobTypes":["platform.tech_debt_governance_review"],"vendors":[{"name":"payments","decision":"pass","statusAgeMinutes":5,"slaReady":True,"statusGreen":True,"ownerAck":True},{"name":"messaging","decision":"pass","statusAgeMinutes":10,"slaReady":True,"statusGreen":True,"ownerAck":True},{"name":"artifactStorage","decision":"pass","statusAgeMinutes":8,"slaReady":True,"statusGreen":True,"ownerAck":True}],"services":[{"name":"queue-provider","decision":"pass","degraded":False,"redundancyReady":True}],"incidents":[{"name":"vendor-status-sample","decision":"pass","resolved":True,"ageDays":1}],"exitPlans":[{"name":"payments-contingency","decision":"pass","tested":True,"ownerAck":True}],"evidence":{"vendorReview":{"decision":"pass"}}}}
    body = as_json(run(enqueue_job(envelope(payload))))
    assert body["routedTo"] == "python.platform.vendor_resilience_review.v37"
    assert body["result"]["resultType"] == "platform.vendor_resilience_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["data"]["mutatesVendorsOrProviderConfig"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.vendor_resilience_review.report"


def test_v37_knowledge_transfer_readiness_review_passes_with_artifacts_owners_training_and_handoff():
    payload = {"jobType":"platform.knowledge_transfer_readiness_review","idempotencyKey":"knowledge-transfer-readiness-review-smoke-0001","dryRun":True,"payload":{"releaseId":"option-b-v37-smoke","domain":"platform","route":"/api/hybrid-python/jobs","jobTypes":["platform.vendor_resilience_review"],"knowledgeArtifacts":[{"name":"runbooks","decision":"pass","reviewed":True,"redacted":True,"ageDays":10},{"name":"oncall","decision":"pass","reviewed":True,"redacted":True,"ageDays":7},{"name":"rollback","decision":"pass","reviewed":True,"redacted":True,"ageDays":5},{"name":"privacy","decision":"pass","reviewed":True,"redacted":True,"ageDays":12}],"owners":[{"name":"platform-primary","role":"primary","decision":"pass","acknowledged":True},{"name":"platform-secondary","role":"secondary","decision":"pass","acknowledged":True}],"trainingSessions":[{"name":"sustained-ops-training","decision":"pass","completed":True,"coveragePercent":95}],"handoffChecklists":[{"name":"v37-handoff","decision":"pass","completed":True}],"evidence":{"handoffReview":{"decision":"pass"}}}}
    body = as_json(run(enqueue_job(envelope(payload))))
    assert body["routedTo"] == "python.platform.knowledge_transfer_readiness_review.v37"
    assert body["result"]["resultType"] == "platform.knowledge_transfer_readiness_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["data"]["mutatesDocsOrOwnership"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.knowledge_transfer_readiness_review.report"


def test_contract_manifest_contains_v37_vendor_resilience_and_knowledge_transfer_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    assert "platform.vendor_resilience_review" in job_types
    assert "platform.knowledge_transfer_readiness_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.vendor_resilience_review" in vector_types
    assert "platform.knowledge_transfer_readiness_review" in vector_types


def test_v38_architecture_ownership_review_passes_with_artifacts_boundaries_owners_and_adr():
    payload = {"jobType":"platform.architecture_ownership_review","idempotencyKey":"architecture-ownership-review-smoke-0001","dryRun":True,"payload":{"releaseId":"option-b-v38-smoke","domain":"platform","route":"/api/hybrid-python/jobs","jobTypes":["platform.knowledge_transfer_readiness_review"],"architectureArtifacts":[{"name":"api-architecture","decision":"pass","approved":True,"redacted":True,"ageDays":10},{"name":"worker-architecture","decision":"pass","approved":True,"redacted":True,"ageDays":12},{"name":"contracts-architecture","decision":"pass","approved":True,"redacted":True,"ageDays":8},{"name":"observability-architecture","decision":"pass","approved":True,"redacted":True,"ageDays":7}],"serviceBoundaries":[{"name":"node-python-boundary","decision":"pass","documented":True,"drift":False}],"owners":[{"name":"architecture-owner","role":"primary","decision":"pass","acknowledged":True}],"decisionRecords":[{"name":"adr-option-b-ownership","decision":"pass","approved":True,"linked":True}],"evidence":{"architectureReview":{"decision":"pass"}}}}
    body = as_json(run(enqueue_job(envelope(payload))))
    assert body["routedTo"] == "python.platform.architecture_ownership_review.v38"
    assert body["result"]["resultType"] == "platform.architecture_ownership_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["data"]["mutatesArchitectureOrOwnership"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.architecture_ownership_review.report"


def test_v38_executive_metrics_governance_review_passes_with_metrics_dashboard_cadence_and_owner():
    payload = {"jobType":"platform.executive_metrics_governance_review","idempotencyKey":"executive-metrics-governance-review-smoke-0001","dryRun":True,"payload":{"releaseId":"option-b-v38-smoke","domain":"platform","route":"/api/hybrid-python/jobs","jobTypes":["platform.architecture_ownership_review"],"metricDefinitions":[{"name":"availability","decision":"pass","approved":True,"ownerAck":True,"redacted":True,"ageDays":5},{"name":"latency","decision":"pass","approved":True,"ownerAck":True,"redacted":True,"ageDays":5},{"name":"errorRate","decision":"pass","approved":True,"ownerAck":True,"redacted":True,"ageDays":5},{"name":"cost","decision":"pass","approved":True,"ownerAck":True,"redacted":True,"ageDays":6},{"name":"privacy","decision":"pass","approved":True,"ownerAck":True,"redacted":True,"ageDays":6}],"dashboards":[{"name":"exec-readiness-dashboard","decision":"pass","linked":True,"fresh":True,"accessReviewed":True}],"reviewCadence":{"decision":"pass","ownerAck":True},"owners":[{"name":"platform-lead","role":"executive-owner","decision":"pass","acknowledged":True}],"evidence":{"metricsGovernance":{"decision":"pass"}}}}
    body = as_json(run(enqueue_job(envelope(payload))))
    assert body["routedTo"] == "python.platform.executive_metrics_governance_review.v38"
    assert body["result"]["resultType"] == "platform.executive_metrics_governance_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["data"]["mutatesDashboardsOrReports"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.executive_metrics_governance_review.report"


def test_contract_manifest_contains_v38_architecture_ownership_and_executive_metrics_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    assert "platform.architecture_ownership_review" in job_types
    assert "platform.executive_metrics_governance_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.architecture_ownership_review" in vector_types
    assert "platform.executive_metrics_governance_review" in vector_types


def test_v39_domain_adoption_readiness_review_passes_with_domains_owner_and_rollback():
    payload = {"jobType":"platform.domain_adoption_readiness_review","idempotencyKey":"domain-adoption-readiness-review-smoke-0001","dryRun":True,"payload":{"releaseId":"option-b-v39-phase-2","phase":"phase-2","domain":"platform","route":"/api/hybrid-python/jobs","jobTypes":["platform.executive_metrics_governance_review"],"domains":[{"name":"admin","decision":"pass","readinessScore":95,"ownerAck":True,"rollbackReady":True,"redacted":True},{"name":"scheduling","decision":"pass","readinessScore":92,"ownerAck":True,"rollbackReady":True,"redacted":True},{"name":"messaging","decision":"pass","readinessScore":91,"ownerAck":True,"rollbackReady":True,"redacted":True},{"name":"billing","decision":"pass","readinessScore":90,"ownerAck":True,"rollbackReady":True,"redacted":True},{"name":"clinical","decision":"pass","readinessScore":94,"ownerAck":True,"rollbackReady":True,"redacted":True}],"owners":[{"name":"domain-adoption-owner","decision":"pass","acknowledged":True}],"rollbackPlan":{"decision":"pass","tested":True,"ownerAck":True},"evidence":{"phase2Adoption":{"decision":"pass"}}}}
    body = as_json(run(enqueue_job(envelope(payload))))
    assert body["routedTo"] == "python.platform.domain_adoption_readiness_review.v39"
    assert body["result"]["resultType"] == "platform.domain_adoption_readiness_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["data"]["mutatesDomainRoutingOrFlags"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.domain_adoption_readiness_review.report"


def test_v39_phase_two_rollout_governance_review_passes_with_milestones_approvals_guardrails_and_plans():
    payload = {"jobType":"platform.phase_two_rollout_governance_review","idempotencyKey":"phase-two-rollout-governance-review-smoke-0001","dryRun":True,"payload":{"releaseId":"option-b-v39-phase-2","phase":"phase-2","domain":"platform","route":"/api/hybrid-python/jobs","jobTypes":["platform.domain_adoption_readiness_review"],"milestones":[{"name":"phase-2-entry","decision":"pass","completed":True},{"name":"domain-adoption-gate","decision":"pass","completed":True}],"approvals":[{"name":"product","decision":"pass","approved":True},{"name":"platform","decision":"pass","approved":True},{"name":"support","decision":"pass","approved":True}],"cohorts":[{"name":"internal-users","decision":"pass","defined":True,"rollbackReady":True}],"guardrails":[{"name":"slo","decision":"pass","enabled":True},{"name":"privacy","decision":"pass","enabled":True},{"name":"support","decision":"pass","enabled":True}],"communicationsPlan":{"decision":"pass","approved":True,"redacted":True},"supportPlan":{"decision":"pass","approved":True,"ownerAck":True},"evidence":{"phase2Governance":{"decision":"pass"}}}}
    body = as_json(run(enqueue_job(envelope(payload))))
    assert body["routedTo"] == "python.platform.phase_two_rollout_governance_review.v39"
    assert body["result"]["resultType"] == "platform.phase_two_rollout_governance_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["data"]["mutatesTrafficCohortsOrApprovals"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.phase_two_rollout_governance_review.report"


def test_contract_manifest_contains_v39_phase_two_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    assert "platform.domain_adoption_readiness_review" in job_types
    assert "platform.phase_two_rollout_governance_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.domain_adoption_readiness_review" in vector_types
    assert "platform.phase_two_rollout_governance_review" in vector_types



def test_v40_domain_pilot_execution_review_passes_with_runs_criteria_approvals_and_rollback():
    payload = {"jobType":"platform.domain_pilot_execution_review","idempotencyKey":"domain-pilot-execution-review-smoke-0001","dryRun":True,"payload":{"releaseId":"option-b-v40-phase-2","phase":"phase-2","domain":"platform","route":"/api/hybrid-python/jobs","jobTypes":["platform.domain_adoption_readiness_review"],"pilotDomains":[{"name":"admin","decision":"pass","enabled":True,"ownerAck":True},{"name":"scheduling","decision":"pass","enabled":True,"ownerAck":True}],"pilotRuns":[{"name":"admin-pilot","decision":"pass","completed":True,"successRate":0.99,"errorRate":0.001,"openBlockers":0},{"name":"scheduling-pilot","decision":"pass","completed":True,"successRate":0.98,"errorRate":0.002,"openBlockers":0}],"acceptanceCriteria":[{"name":"slo","decision":"pass","met":True},{"name":"support","decision":"pass","met":True}],"operatorApprovals":[{"name":"domain-owner","decision":"pass","approved":True},{"name":"platform-owner","decision":"pass","approved":True}],"rollbackPlan":{"decision":"pass","tested":True,"ownerAck":True},"evidence":{"pilotExecution":{"decision":"pass"}}}}
    body = as_json(run(enqueue_job(envelope(payload))))
    assert body["routedTo"] == "python.platform.domain_pilot_execution_review.v40"
    assert body["result"]["resultType"] == "platform.domain_pilot_execution_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["data"]["mutatesPilotTrafficOrDomains"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.domain_pilot_execution_review.report"


def test_v40_phase_two_expansion_control_review_passes_with_waves_limits_triggers_checkpoints_and_approvals():
    payload = {"jobType":"platform.phase_two_expansion_control_review","idempotencyKey":"phase-two-expansion-control-review-smoke-0001","dryRun":True,"payload":{"releaseId":"option-b-v40-phase-2","phase":"phase-2","domain":"platform","route":"/api/hybrid-python/jobs","jobTypes":["platform.domain_pilot_execution_review"],"waves":[{"name":"wave-1","decision":"pass","targetPercent":10,"completed":True},{"name":"wave-2","decision":"pass","targetPercent":20,"completed":True}],"trafficLimits":{"decision":"pass","maxTargetPercent":25,"currentPercent":10,"targetPercent":20},"rollbackTriggers":[{"name":"slo-breach","decision":"pass","configured":True},{"name":"privacy-block","decision":"pass","configured":True}],"checkpoints":[{"name":"slo","decision":"pass","passed":True},{"name":"support","decision":"pass","passed":True}],"approvals":[{"name":"release-manager","decision":"pass","approved":True},{"name":"sre","decision":"pass","approved":True}],"evidence":{"expansionControl":{"decision":"pass"}}}}
    body = as_json(run(enqueue_job(envelope(payload))))
    assert body["routedTo"] == "python.platform.phase_two_expansion_control_review.v40"
    assert body["result"]["resultType"] == "platform.phase_two_expansion_control_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["data"]["mutatesTrafficOrRollbackState"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.phase_two_expansion_control_review.report"


def test_contract_manifest_contains_v40_phase_two_pilot_and_expansion_control_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    assert "platform.domain_pilot_execution_review" in job_types
    assert "platform.phase_two_expansion_control_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.domain_pilot_execution_review" in vector_types
    assert "platform.phase_two_expansion_control_review" in vector_types


def test_v41_domain_outcome_measurement_review_passes_with_metrics_baselines_adoption_and_support():
    payload = {"jobType":"platform.domain_outcome_measurement_review","idempotencyKey":"domain-outcome-measurement-review-smoke-0001","dryRun":True,"payload":{"releaseId":"option-b-v41-phase-2","phase":"phase-2","domain":"platform","route":"/api/hybrid-python/jobs","jobTypes":["platform.domain_pilot_execution_review"],"outcomeMetrics":[{"name":"success_rate","decision":"pass","value":0.99,"regressionPercent":0.5},{"name":"latency","decision":"pass","value":180,"target":250,"regressionPercent":1.0},{"name":"satisfaction","decision":"pass","value":0.9,"regressionPercent":0.0}],"baselines":[{"name":"pilot-baseline","decision":"pass","approved":True}],"adoptionSignals":[{"name":"admin-activation","decision":"pass","score":0.86}],"supportSignals":[{"name":"support-load","decision":"pass","ticketRate":0.01,"openBlockers":0}],"evidence":{"outcomeMeasurement":{"decision":"pass"}}}}
    body = as_json(run(enqueue_job(envelope(payload))))
    assert body["routedTo"] == "python.platform.domain_outcome_measurement_review.v41"
    assert body["result"]["resultType"] == "platform.domain_outcome_measurement_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["data"]["mutatesMetricsOrDomains"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.domain_outcome_measurement_review.report"


def test_v41_phase_two_feedback_adoption_review_passes_with_feedback_decisions_owners_and_comms():
    payload = {"jobType":"platform.phase_two_feedback_adoption_review","idempotencyKey":"phase-two-feedback-adoption-review-smoke-0001","dryRun":True,"payload":{"releaseId":"option-b-v41-phase-2","phase":"phase-2","domain":"platform","route":"/api/hybrid-python/jobs","jobTypes":["platform.domain_outcome_measurement_review"],"feedbackItems":[{"name":"pilot-feedback","decision":"pass","severity":"medium","closed":True}],"adoptionDecisions":[{"name":"expand-admin","decision":"pass","approved":True,"rollbackReady":True}],"ownerResponses":[{"name":"domain-owner","decision":"pass","responded":True},{"name":"support-owner","decision":"pass","responded":True}],"communications":[{"name":"operator-update","decision":"pass","approved":True,"redacted":True}],"evidence":{"feedbackAdoption":{"decision":"pass"}}}}
    body = as_json(run(enqueue_job(envelope(payload))))
    assert body["routedTo"] == "python.platform.phase_two_feedback_adoption_review.v41"
    assert body["result"]["resultType"] == "platform.phase_two_feedback_adoption_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["data"]["mutatesFeedbackOrAdoptionState"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.phase_two_feedback_adoption_review.report"


def test_contract_manifest_contains_v41_outcome_and_feedback_adoption_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    assert "platform.domain_outcome_measurement_review" in job_types
    assert "platform.phase_two_feedback_adoption_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.domain_outcome_measurement_review" in vector_types
    assert "platform.phase_two_feedback_adoption_review" in vector_types



def test_v42_domain_graduation_readiness_review_passes_with_candidates_criteria_risks_and_approvals():
    payload = {"jobType":"platform.domain_graduation_readiness_review","idempotencyKey":"domain-graduation-readiness-review-smoke-0001","dryRun":True,"payload":{"releaseId":"option-b-v42-phase-2","phase":"phase-2","domain":"platform","route":"/api/hybrid-python/jobs","jobTypes":["platform.domain_outcome_measurement_review"],"graduationCandidates":[{"name":"admin","decision":"pass","ownerAck":True,"rollbackReady":True},{"name":"scheduling","decision":"pass","ownerAck":True,"rollbackReady":True}],"graduationCriteria":[{"name":"outcomes","decision":"pass","met":True},{"name":"support","decision":"pass","met":True}],"outcomeSummary":{"decision":"pass","score":0.91},"riskRegister":[{"name":"pilot-risk","decision":"pass","severity":"medium","closed":True}],"approvals":[{"name":"domain-owner","decision":"pass","approved":True},{"name":"release-manager","decision":"pass","approved":True}],"evidence":{"domainGraduation":{"decision":"pass"}}}}
    body = as_json(run(enqueue_job(envelope(payload))))
    assert body["routedTo"] == "python.platform.domain_graduation_readiness_review.v43"
    assert body["result"]["resultType"] == "platform.domain_graduation_readiness_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["data"]["mutatesDomainGraduationState"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.domain_graduation_readiness_review.report"


def test_v42_phase_two_learning_consolidation_review_passes_with_learnings_decisions_playbooks_and_owners():
    payload = {"jobType":"platform.phase_two_learning_consolidation_review","idempotencyKey":"phase-two-learning-consolidation-review-smoke-0001","dryRun":True,"payload":{"releaseId":"option-b-v42-phase-2","phase":"phase-2","domain":"platform","route":"/api/hybrid-python/jobs","jobTypes":["platform.phase_two_feedback_adoption_review"],"learnings":[{"name":"support-triage","decision":"pass","captured":True},{"name":"domain-handoff","decision":"pass","captured":True}],"experiments":[{"name":"admin-pilot","decision":"pass","analyzed":True}],"decisions":[{"name":"graduation-path","decision":"pass","approved":True}],"playbookUpdates":[{"name":"phase2-playbook","decision":"pass","approved":True,"ownerAck":True}],"owners":[{"name":"platform-owner","decision":"pass","acknowledged":True},{"name":"support-owner","decision":"pass","acknowledged":True}],"evidence":{"learningConsolidation":{"decision":"pass"}}}}
    body = as_json(run(enqueue_job(envelope(payload))))
    assert body["routedTo"] == "python.platform.phase_two_learning_consolidation_review.v43"
    assert body["result"]["resultType"] == "platform.phase_two_learning_consolidation_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["data"]["mutatesPlaybooksOrRollout"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.phase_two_learning_consolidation_review.report"


def test_v43_domain_wide_adoption_readiness_review_passes_with_domains_support_rollback_and_approvals():
    payload = {"jobType":"platform.domain_wide_adoption_readiness_review","idempotencyKey":"domain-wide-adoption-readiness-review-smoke-0001","dryRun":True,"payload":{"releaseId":"option-b-v43-phase-2","phase":"phase-2","domain":"platform","route":"/api/hybrid-python/jobs","jobTypes":["platform.domain_graduation_readiness_review"],"adoptionDomains":[{"name":"admin","decision":"pass","ownerAck":True,"rollbackReady":True,"openBlockers":0},{"name":"scheduling","decision":"pass","ownerAck":True,"rollbackReady":True,"openBlockers":0}],"rolloutEvidence":[{"name":"graduated-pilot-evidence","decision":"pass","validated":True}],"ownerApprovals":[{"name":"domain-owner","decision":"pass","approved":True},{"name":"support-owner","decision":"pass","approved":True}],"supportReadiness":{"decision":"pass","ready":True},"rollbackPlan":{"decision":"pass","tested":True},"evidence":{"domainWideAdoption":{"decision":"pass"}}}}
    body = as_json(run(enqueue_job(envelope(payload))))
    assert body["routedTo"] == "python.platform.domain_wide_adoption_readiness_review.v43"
    assert body["result"]["resultType"] == "platform.domain_wide_adoption_readiness_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["data"]["mutatesDomainAdoptionOrTraffic"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.domain_wide_adoption_readiness_review.report"


def test_v43_phase_two_support_transition_review_passes_with_queues_escalations_training_runbooks_and_approvals():
    payload = {"jobType":"platform.phase_two_support_transition_review","idempotencyKey":"phase-two-support-transition-review-smoke-0001","dryRun":True,"payload":{"releaseId":"option-b-v43-phase-2","phase":"phase-2","domain":"platform","route":"/api/hybrid-python/jobs","jobTypes":["platform.domain_wide_adoption_readiness_review"],"supportQueues":[{"name":"tier-1","decision":"pass","ready":True}],"escalationPaths":[{"name":"platform-escalation","decision":"pass","documented":True,"ownerAck":True}],"trainingArtifacts":[{"name":"support-training","decision":"pass","completed":True},{"name":"rollback-training","decision":"pass","completed":True}],"runbookUpdates":[{"name":"phase2-support-runbook","decision":"pass","approved":True,"published":True}],"ownerApprovals":[{"name":"support-owner","decision":"pass","approved":True},{"name":"platform-owner","decision":"pass","approved":True}],"evidence":{"supportTransition":{"decision":"pass"}}}}
    body = as_json(run(enqueue_job(envelope(payload))))
    assert body["routedTo"] == "python.platform.phase_two_support_transition_review.v43"
    assert body["result"]["resultType"] == "platform.phase_two_support_transition_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["data"]["mutatesSupportQueuesOrEscalations"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.phase_two_support_transition_review.report"


def test_contract_manifest_contains_v43_broad_adoption_and_support_transition_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    assert "platform.domain_wide_adoption_readiness_review" in job_types
    assert "platform.phase_two_support_transition_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.domain_wide_adoption_readiness_review" in vector_types
    assert "platform.phase_two_support_transition_review" in vector_types


def test_v44_manifest_includes_stabilization_and_value_realization():
    client = TestClient(app)
    manifest_body = client.get("/api/v1/contracts/manifest").json()
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert "platform.domain_adoption_stabilization_review" in job_types
    assert "platform.phase_two_value_realization_review" in job_types
    vectors = client.get("/api/v1/contracts/test-vectors").json()
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.domain_adoption_stabilization_review" in vector_types
    assert "platform.phase_two_value_realization_review" in vector_types
    assert len(vectors) == 119



def test_v45_phase_two_closure_acceptance_review_passes_with_criteria_evidence_value_support_and_approvals():
    payload = {"jobType":"platform.phase_two_closure_acceptance_review","idempotencyKey":"phase-two-closure-acceptance-review-smoke-0001","dryRun":True,"payload":{"releaseId":"option-b-v45-phase-2","phase":"phase-2","domain":"platform","route":"/api/hybrid-python/jobs","jobTypes":["platform.phase_two_value_realization_review"],"closureCriteria":[{"name":"value-realization","decision":"pass","met":True},{"name":"support-transition","decision":"pass","met":True},{"name":"domain-stabilization","decision":"pass","met":True}],"acceptanceEvidence":[{"name":"closure-evidence","decision":"pass","attached":True,"approved":True}],"openRisks":[{"name":"residual-risk","decision":"pass","severity":"low","closed":True}],"approvals":[{"name":"executive-sponsor","decision":"pass","approved":True},{"name":"platform-owner","decision":"pass","approved":True}],"valueRealizationSummary":{"decision":"pass","score":0.88},"supportTransition":{"decision":"pass","ready":True},"evidence":{"phase2Closure":{"decision":"pass"}}}}
    body = as_json(run(enqueue_job(envelope(payload))))
    assert body["routedTo"] == "python.platform.phase_two_closure_acceptance_review.v45"
    assert body["result"]["resultType"] == "platform.phase_two_closure_acceptance_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["data"]["mutatesPhaseClosureOrRoadmap"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.phase_two_closure_acceptance_review.report"


def test_v45_phase_three_transition_readiness_review_passes_with_milestones_handoffs_guardrails_and_approvals():
    payload = {"jobType":"platform.phase_three_transition_readiness_review","idempotencyKey":"phase-three-transition-readiness-review-smoke-0001","dryRun":True,"payload":{"releaseId":"option-b-v45-phase-2","phase":"phase-2","nextPhase":"phase-3","domain":"platform","route":"/api/hybrid-python/jobs","jobTypes":["platform.phase_two_closure_acceptance_review"],"transitionMilestones":[{"name":"phase2-closeout","decision":"pass","completed":True},{"name":"phase3-entry","decision":"pass","completed":True}],"dependencyReadiness":[{"name":"contracts","decision":"pass","ready":True},{"name":"support","decision":"pass","ready":True}],"ownerHandoffs":[{"name":"platform-owner","decision":"pass","accepted":True},{"name":"domain-owner","decision":"pass","accepted":True}],"rolloutGuardrails":[{"name":"slo","decision":"pass","enabled":True},{"name":"rollback","decision":"pass","enabled":True}],"entryCriteria":[{"name":"phase3-charter","decision":"pass","met":True}],"approvals":[{"name":"program-lead","decision":"pass","approved":True},{"name":"sre","decision":"pass","approved":True}],"evidence":{"phase3Transition":{"decision":"pass"}}}}
    body = as_json(run(enqueue_job(envelope(payload))))
    assert body["routedTo"] == "python.platform.phase_three_transition_readiness_review.v45"
    assert body["result"]["resultType"] == "platform.phase_three_transition_readiness_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["data"]["mutatesPhaseTransitionOrTraffic"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.phase_three_transition_readiness_review.report"


def test_v45_contract_manifest_contains_phase_closure_and_phase_three_transition_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    assert "platform.phase_two_closure_acceptance_review" in job_types
    assert "platform.phase_three_transition_readiness_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.phase_two_closure_acceptance_review" in vector_types
    assert "platform.phase_three_transition_readiness_review" in vector_types
    assert len(vectors) == 119



def test_v46_phase_three_domain_wave_readiness_review_passes_with_domains_guardrails_support_and_approvals():
    payload = {"jobType":"platform.phase_three_domain_wave_readiness_review","idempotencyKey":"phase-three-domain-wave-readiness-review-smoke-0001","dryRun":True,"payload":{"releaseId":"option-b-v46-phase-3","phase":"phase-3","waveId":"phase3-wave-1","domain":"platform","route":"/api/hybrid-python/jobs","jobTypes":["platform.phase_three_transition_readiness_review"],"domains":[{"name":"admin","decision":"pass","waveReady":True,"ownerAck":True,"rollbackReady":True},{"name":"scheduling","decision":"pass","waveReady":True,"ownerAck":True,"rollbackReady":True}],"waveCriteria":[{"name":"transition-readiness","decision":"pass","met":True},{"name":"support-coverage","decision":"pass","met":True}],"guardrails":[{"name":"slo","decision":"pass","enabled":True},{"name":"rollback","decision":"pass","enabled":True}],"supportCoverage":[{"name":"tier-1","decision":"pass","ready":True}],"rollbackCoverage":[{"name":"node-fallback","decision":"pass","tested":True}],"approvals":[{"name":"platform-lead","decision":"pass","approved":True},{"name":"domain-owner","decision":"pass","approved":True}],"evidence":{"phase3Wave":{"decision":"pass"}}}}
    body = as_json(run(enqueue_job(envelope(payload))))
    assert body["routedTo"] == "python.platform.phase_three_domain_wave_readiness_review.v46"
    assert body["result"]["resultType"] == "platform.phase_three_domain_wave_readiness_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["data"]["mutatesWaveTrafficOrFlags"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.phase_three_domain_wave_readiness_review.report"


def test_v46_phase_three_operating_model_alignment_review_passes_with_ownership_support_runbooks_metrics_training_and_approvals():
    payload = {"jobType":"platform.phase_three_operating_model_alignment_review","idempotencyKey":"phase-three-operating-model-alignment-review-smoke-0001","dryRun":True,"payload":{"releaseId":"option-b-v46-phase-3","phase":"phase-3","operatingModel":"phase3-scale","domain":"platform","route":"/api/hybrid-python/jobs","jobTypes":["platform.phase_three_domain_wave_readiness_review"],"ownershipMatrix":[{"name":"platform-owner","decision":"pass","accepted":True},{"name":"domain-owner","decision":"pass","accepted":True}],"supportModel":[{"name":"support-coverage","decision":"pass","ready":True}],"runbookCoverage":[{"name":"phase3-runbook","decision":"pass","published":True,"ownerAck":True}],"metricGovernance":[{"name":"executive-dashboard","decision":"pass","enabled":True,"ownerAck":True}],"trainingCoverage":[{"name":"ops-training","decision":"pass","completed":True}],"escalationModel":[{"name":"sre-escalation","decision":"pass","documented":True,"ownerAck":True}],"approvals":[{"name":"sre","decision":"pass","approved":True},{"name":"program-lead","decision":"pass","approved":True}],"evidence":{"operatingModel":{"decision":"pass"}}}}
    body = as_json(run(enqueue_job(envelope(payload))))
    assert body["routedTo"] == "python.platform.phase_three_operating_model_alignment_review.v46"
    assert body["result"]["resultType"] == "platform.phase_three_operating_model_alignment_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["data"]["mutatesOperatingModelSupportOrStaffing"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.phase_three_operating_model_alignment_review.report"


def test_v46_contract_manifest_contains_phase_three_wave_and_operating_model_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    assert "platform.phase_three_domain_wave_readiness_review" in job_types
    assert "platform.phase_three_operating_model_alignment_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.phase_three_domain_wave_readiness_review" in vector_types
    assert "platform.phase_three_operating_model_alignment_review" in vector_types
    assert len(vectors) == 119


def test_v47_phase_three_wave_execution_review_passes_with_execution_signals_guardrails_and_approvals():
    payload = {"jobType":"platform.phase_three_wave_execution_review","idempotencyKey":"phase-three-wave-execution-review-smoke-0001","dryRun":True,"payload":{"releaseId":"option-b-v47-phase-3","phase":"phase-3","waveId":"phase3-wave-1","domain":"platform","route":"/api/hybrid-python/jobs","jobTypes":["platform.phase_three_domain_wave_readiness_review"],"waveExecution":[{"name":"admin","decision":"pass","executed":True,"completed":True},{"name":"scheduling","decision":"pass","executed":True,"completed":True}],"domainSignals":[{"name":"admin-health","decision":"pass","healthy":True},{"name":"scheduling-health","decision":"pass","healthy":True}],"guardrailChecks":[{"name":"slo","decision":"pass","passed":True},{"name":"rollback-trigger","decision":"pass","enabled":True}],"rollbackReadiness":[{"name":"node-fallback","decision":"pass","ready":True,"tested":True}],"supportIncidents":[{"name":"no-critical-incidents","decision":"pass","severity":"low","closed":True}],"approvals":[{"name":"platform-lead","decision":"pass","approved":True},{"name":"domain-owner","decision":"pass","approved":True}],"evidence":{"waveExecution":{"decision":"pass"}}}}
    body = as_json(run(enqueue_job(envelope(payload))))
    assert body["routedTo"] == "python.platform.phase_three_wave_execution_review.v47"
    assert body["result"]["resultType"] == "platform.phase_three_wave_execution_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["data"]["mutatesWaveExecutionOrTraffic"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.phase_three_wave_execution_review.report"


def test_v47_phase_three_adoption_value_tracking_review_passes_with_metrics_feedback_and_approvals():
    payload = {"jobType":"platform.phase_three_adoption_value_tracking_review","idempotencyKey":"phase-three-adoption-value-tracking-review-smoke-0001","dryRun":True,"payload":{"releaseId":"option-b-v47-phase-3","phase":"phase-3","waveId":"phase3-wave-1","domain":"platform","route":"/api/hybrid-python/jobs","jobTypes":["platform.phase_three_wave_execution_review"],"adoptionMetrics":[{"name":"admin-usage","decision":"pass","score":0.82,"met":True},{"name":"scheduling-usage","decision":"pass","score":0.80,"met":True}],"valueMetrics":[{"name":"cycle-time","decision":"pass","score":0.76,"realized":True},{"name":"support-deflection","decision":"pass","score":0.78,"realized":True}],"userFeedback":[{"name":"operator-feedback","decision":"pass","severity":"low","addressed":True}],"benefitHypotheses":[{"name":"faster-ops","decision":"pass","validated":True}],"ownerReviews":[{"name":"product-owner","decision":"pass","completed":True}],"approvals":[{"name":"product","decision":"pass","approved":True},{"name":"platform","decision":"pass","approved":True}],"evidence":{"adoptionValue":{"decision":"pass"}}}}
    body = as_json(run(enqueue_job(envelope(payload))))
    assert body["routedTo"] == "python.platform.phase_three_adoption_value_tracking_review.v47"
    assert body["result"]["resultType"] == "platform.phase_three_adoption_value_tracking_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["data"]["mutatesAdoptionMetricsOrRoadmap"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.phase_three_adoption_value_tracking_review.report"


def test_v47_contract_manifest_contains_phase_three_execution_and_value_tracking_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    assert "platform.phase_three_wave_execution_review" in job_types
    assert "platform.phase_three_adoption_value_tracking_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.phase_three_wave_execution_review" in vector_types
    assert "platform.phase_three_adoption_value_tracking_review" in vector_types
    assert len(vectors) == 119


def test_v48_phase_three_gap_remediation_review_passes_with_remediation_risks_owner_actions_and_evidence():
    client = TestClient(app)
    payload = {"jobType":"platform.phase_three_gap_remediation_review","idempotencyKey":"phase-three-gap-remediation-review-smoke-0001","dryRun":True,"payload":{"releaseId":"option-b-v48-phase-3","phase":"phase-3","waveId":"phase3-wave-1","domain":"platform","route":"/api/hybrid-python/jobs","jobTypes":["platform.phase_three_adoption_value_tracking_review"],"remediationItems":[{"name":"ts-build-certification","decision":"pass","ownerAck":True,"closed":True},{"name":"staging-e2e-smoke","decision":"pass","ownerAck":True,"closed":True}],"openRisks":[{"name":"residual-ci-risk","decision":"pass","severity":"low","closed":True}],"riskAcceptances":[{"name":"no-high-residual-risk","decision":"pass","accepted":True,"ownerAck":True}],"ownerActions":[{"name":"platform-remediation-owner","decision":"pass","completed":True,"ownerAck":True}],"evidence":{"gapRemediation":{"decision":"pass"}}}}
    response = client.post("/api/v1/jobs/enqueue", json=payload)
    assert response.status_code in (200, 202)
    body = response.json()
    assert body["routedTo"] == "python.platform.phase_three_gap_remediation_review.v48"
    assert body["result"]["resultType"] == "platform.phase_three_gap_remediation_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.phase_three_gap_remediation_review.report"


def test_v48_migration_stage_completion_readiness_review_passes_with_criteria_validations_approvals_and_evidence():
    client = TestClient(app)
    payload = {"jobType":"platform.migration_stage_completion_readiness_review","idempotencyKey":"migration-stage-completion-readiness-review-smoke-0001","dryRun":True,"payload":{"releaseId":"option-b-v48-phase-3","stage":"python-migration-stage","phase":"phase-3","domain":"platform","route":"/api/hybrid-python/jobs","jobTypes":["platform.phase_three_gap_remediation_review"],"completionCriteria":[{"name":"all-critical-gates","decision":"pass","met":True},{"name":"domain-readiness","decision":"pass","met":True},{"name":"operator-handoff","decision":"pass","met":True}],"validationResults":[{"name":"python-contract-suite","decision":"pass","passed":True},{"name":"staging-e2e","decision":"pass","passed":True}],"closureApprovals":[{"name":"program-lead","decision":"pass","approved":True},{"name":"sre","decision":"pass","approved":True}],"residualRisks":[{"name":"no-high-residual-risk","decision":"pass","severity":"low","accepted":True}],"finalEvidence":{"stageCompletion":{"decision":"pass"}}}}
    response = client.post("/api/v1/jobs/enqueue", json=payload)
    assert response.status_code in (200, 202)
    body = response.json()
    assert body["routedTo"] == "python.platform.migration_stage_completion_readiness_review.v48"
    assert body["result"]["resultType"] == "platform.migration_stage_completion_readiness_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.migration_stage_completion_readiness_review.report"


def test_v48_contract_manifest_contains_gap_remediation_and_stage_completion_contracts():
    manifest_body = run(contracts_manifest_direct()).dict(by_alias=True)
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert "platform.phase_three_gap_remediation_review" in job_types
    assert "platform.migration_stage_completion_readiness_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.phase_three_gap_remediation_review" in vector_types
    assert "platform.migration_stage_completion_readiness_review" in vector_types
    assert len(vectors) == 119


def test_v49_phase_three_remediation_closure_review_passes_with_closure_evidence_risks_and_approvals():
    payload = {"jobType":"platform.phase_three_remediation_closure_review","idempotencyKey":"phase-three-remediation-closure-review-smoke-0001","dryRun":True,"payload":{"releaseId":"option-b-v49-phase-3","stage":"python-migration-stage","phase":"phase-3","domain":"platform","route":"/api/hybrid-python/jobs","jobTypes":["platform.migration_stage_completion_readiness_review"],"closureItems":[{"name":"critical-gap-closeout","decision":"pass","closed":True,"ownerAck":True},{"name":"ci-staging-certification","decision":"pass","closed":True,"ownerAck":True}],"remediationEvidence":[{"name":"evidence-bundle","decision":"pass","validated":True}],"residualRisks":[{"name":"no-open-high-risk","decision":"pass","severity":"low","closed":True}],"acceptanceRecords":[{"name":"risk-acceptance","decision":"pass","accepted":True,"ownerAck":True}],"ownerApprovals":[{"name":"platform-lead","decision":"pass","approved":True},{"name":"sre-lead","decision":"pass","approved":True}],"evidence":{"remediationClosure":{"decision":"pass"}}}}
    body = as_json(run(enqueue_job(envelope(payload))))
    assert body["routedTo"] == "python.platform.phase_three_remediation_closure_review.v49"
    assert body["result"]["resultType"] == "platform.phase_three_remediation_closure_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["data"]["mutatesRemediationTicketsOrRisks"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.phase_three_remediation_closure_review.report"


def test_v49_executive_operational_handoff_review_passes_with_handoff_support_kpis_and_approvals():
    payload = {"jobType":"platform.executive_operational_handoff_review","idempotencyKey":"executive-operational-handoff-review-smoke-0001","dryRun":True,"payload":{"releaseId":"option-b-v49-phase-3","stage":"python-migration-stage","phase":"phase-3","domain":"platform","route":"/api/hybrid-python/jobs","jobTypes":["platform.phase_three_remediation_closure_review"],"executiveSummary":{"name":"executive-closeout","decision":"pass","score":0.92},"handoffItems":[{"name":"ownership-model","decision":"pass","completed":True,"ownerAck":True},{"name":"support-transition","decision":"pass","completed":True,"ownerAck":True},{"name":"evidence-archive","decision":"pass","completed":True,"ownerAck":True}],"supportModel":[{"name":"sre-support","decision":"pass","ready":True,"ownerAck":True}],"kpiBaselines":[{"name":"slo-baseline","decision":"pass","baselined":True},{"name":"adoption-baseline","decision":"pass","baselined":True}],"governanceDecisions":[{"name":"stage-exit-governance","decision":"pass","approved":True}],"approvals":[{"name":"executive-sponsor","decision":"pass","approved":True},{"name":"platform-lead","decision":"pass","approved":True}],"evidence":{"executiveHandoff":{"decision":"pass"}}}}
    body = as_json(run(enqueue_job(envelope(payload))))
    assert body["routedTo"] == "python.platform.executive_operational_handoff_review.v49"
    assert body["result"]["resultType"] == "platform.executive_operational_handoff_review.completed"
    assert body["result"]["data"]["decision"] == "pass"
    assert body["result"]["data"]["mutatesOwnershipSupportOrMetrics"] is False
    assert body["result"]["artifacts"][0]["artifactType"] == "platform.executive_operational_handoff_review.report"


def test_v49_contract_manifest_contains_remediation_closure_and_executive_handoff_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert "platform.phase_three_remediation_closure_review" in job_types
    assert "platform.executive_operational_handoff_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.phase_three_remediation_closure_review" in vector_types
    assert "platform.executive_operational_handoff_review" in vector_types
    assert len(vectors) == 119


def test_v52_global_task_status_tracking_and_project_state_health_vectors():
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.global_task_status_tracking_review" in vector_types
    assert "platform.project_state_health_review" in vector_types
    assert len(vectors) == 119


def test_v52_global_task_status_tracking_direct_processor_passes():
    payload = {
        "releaseId": "option-b-v52-phase-3",
        "tasks": [
            {"name": "build-api-green", "decision": "pass", "completed": True, "ownerAck": True},
            {"name": "python-test-deps", "decision": "pass", "completed": True, "ownerAck": True},
            {"name": "staging-smoke", "decision": "pass", "completed": True, "ownerAck": True},
        ],
        "milestones": [{"name": "stage-closeout", "decision": "pass", "completed": True}],
        "owners": [{"name": "platform-owner", "decision": "pass", "ownerAck": True}],
        "blockers": [{"name": "no-critical", "decision": "pass", "severity": "low", "closed": True}],
        "approvals": [{"name": "platform-lead", "decision": "pass", "approved": True}],
        "evidence": {"tracker": {"decision": "pass"}},
    }
    result = process_job(JobEnvelope(jobType="platform.global_task_status_tracking_review", idempotencyKey="test-v52-global-task", dryRun=True, payload=payload))
    body = as_json(result)
    assert body["resultType"] == "platform.global_task_status_tracking_review.completed"
    assert body["data"]["decision"] == "pass"


def test_v52_project_state_health_direct_processor_passes():
    payload = {
        "releaseId": "option-b-v52-phase-3",
        "applications": [
            {"name": "Admin Web Portal", "decision": "pass", "completionPercent": 0.84, "ownerAck": True},
            {"name": "Backend API", "decision": "pass", "completionPercent": 0.86, "ownerAck": True},
            {"name": "Python Worker", "decision": "pass", "completionPercent": 0.90, "ownerAck": True},
        ],
        "migrationStatus": {"decision": "pass", "completionPercent": 0.82},
        "riskRegister": [{"name": "ci-staging", "decision": "pass", "severity": "medium", "closed": True}],
        "closureCriteria": [{"name": "api-build", "decision": "pass", "satisfied": True}, {"name": "evidence", "decision": "pass", "satisfied": True}],
        "approvals": [{"name": "executive-sponsor", "decision": "pass", "approved": True}],
        "evidence": {"projectTracker": {"decision": "pass"}},
    }
    result = process_job(JobEnvelope(jobType="platform.project_state_health_review", idempotencyKey="test-v52-project-health", dryRun=True, payload=payload))
    body = as_json(result)
    assert body["resultType"] == "platform.project_state_health_review.completed"
    assert body["data"]["decision"] == "pass"



def test_v53_final_acceptance_evidence_direct_processor_passes():
    payload = {
        "releaseId": "option-b-v53-phase-3",
        "stage": "python-migration-stage",
        "phase": "phase-3",
        "domain": "global",
        "acceptanceCriteria": [
            {"name": "api-build-green", "decision": "pass", "met": True},
            {"name": "python-contract-tests", "decision": "pass", "met": True},
            {"name": "evidence-bundle", "decision": "pass", "met": True},
        ],
        "validationEvidence": [
            {"name": "ci-build", "decision": "pass", "validated": True},
            {"name": "staging-smoke", "decision": "pass", "validated": True},
        ],
        "testResults": [
            {"name": "api-build", "decision": "pass", "passed": True},
            {"name": "worker-contracts", "decision": "pass", "passed": True},
        ],
        "residualRisks": [{"name": "no-high-risk", "decision": "pass", "severity": "low", "accepted": True}],
        "signoffs": [{"name": "qa-lead", "decision": "pass", "approved": True}, {"name": "platform-lead", "decision": "pass", "approved": True}],
        "evidence": {"finalAcceptance": {"decision": "pass"}},
    }
    result = process_job(JobEnvelope(jobType="platform.final_acceptance_evidence_review", idempotencyKey="test-v53-final-acceptance", dryRun=True, payload=payload))
    body = as_json(result)
    assert body["resultType"] == "platform.final_acceptance_evidence_review.completed"
    assert body["data"]["decision"] == "pass"
    assert body["data"]["mutatesReleaseQaOrRiskSystems"] is False


def test_v53_stage_exit_readiness_direct_processor_passes():
    payload = {
        "releaseId": "option-b-v53-phase-3",
        "stage": "python-migration-stage",
        "phase": "phase-3",
        "targetState": "stage-complete",
        "domain": "global",
        "exitCriteria": [
            {"name": "final-acceptance", "decision": "pass", "satisfied": True},
            {"name": "support-transition", "decision": "pass", "satisfied": True},
            {"name": "evidence-archive", "decision": "pass", "satisfied": True},
        ],
        "operationalHandoff": [{"name": "sre", "decision": "pass", "completed": True, "ownerAck": True}, {"name": "product", "decision": "pass", "completed": True, "ownerAck": True}],
        "evidenceBundle": {"name": "stage-exit-evidence", "decision": "pass", "archived": True},
        "rollbackPlan": {"name": "node-fallback", "decision": "pass", "tested": True},
        "supportReadiness": [{"name": "oncall", "decision": "pass", "ready": True}, {"name": "runbooks", "decision": "pass", "ready": True}],
        "approvals": [{"name": "executive-sponsor", "decision": "pass", "approved": True}, {"name": "sre-lead", "decision": "pass", "approved": True}],
        "evidence": {"stageExit": {"decision": "pass"}},
    }
    result = process_job(JobEnvelope(jobType="platform.stage_exit_readiness_review", idempotencyKey="test-v53-stage-exit", dryRun=True, payload=payload))
    body = as_json(result)
    assert body["resultType"] == "platform.stage_exit_readiness_review.completed"
    assert body["data"]["decision"] == "pass"
    assert body["data"]["mutatesRoadmapReleaseSupportOrOwnership"] is False


def test_v53_contract_manifest_contains_final_acceptance_and_stage_exit_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert "platform.final_acceptance_evidence_review" in job_types
    assert "platform.stage_exit_readiness_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.final_acceptance_evidence_review" in vector_types
    assert "platform.stage_exit_readiness_review" in vector_types
    assert len(vectors) == 119



def test_v54_stage_closure_certification_direct_processor_passes():
    payload = {
        "releaseId": "option-b-v54-stage-closure",
        "stage": "python-migration-stage",
        "phase": "phase-3",
        "domain": "global",
        "certificationItems": [
            {"name": "api-build-green", "decision": "pass", "certified": True},
            {"name": "worker-tests-green", "decision": "pass", "certified": True},
            {"name": "evidence-archive", "decision": "pass", "certified": True},
        ],
        "finalEvidence": [
            {"name": "acceptance-report", "decision": "pass", "validated": True},
            {"name": "stage-exit-evidence", "decision": "pass", "validated": True},
        ],
        "signoffs": [{"name": "executive-sponsor", "decision": "pass", "approved": True}, {"name": "qa-lead", "decision": "pass", "approved": True}],
        "releaseArtifacts": {"name": "v54-release-packet", "decision": "pass", "archived": True, "checksumVerified": True},
        "residualRisks": [{"name": "no-high-risk", "decision": "pass", "severity": "low", "accepted": True, "closed": True}],
        "evidence": {"stageClosureCertification": {"decision": "pass"}},
    }
    result = process_job(JobEnvelope(jobType="platform.stage_closure_certification_review", idempotencyKey="test-v54-stage-closure", dryRun=True, payload=payload))
    body = as_json(result)
    assert body["resultType"] == "platform.stage_closure_certification_review.completed"
    assert body["data"]["decision"] == "pass"
    assert body["data"]["mutatesReleaseCertificationRiskOrTickets"] is False


def test_v54_post_closure_operational_transition_direct_processor_passes():
    payload = {
        "releaseId": "option-b-v54-stage-closure",
        "stage": "post-closure",
        "phase": "phase-3",
        "domain": "global",
        "operatingMode": "steady-state-transition",
        "transitionItems": [{"name": "support-handoff", "decision": "pass", "completed": True, "ownerAck": True}, {"name": "ownership-registry", "decision": "pass", "completed": True, "ownerAck": True}],
        "monitoringPlan": {"name": "post-closure-monitoring", "decision": "pass", "ready": True},
        "ownershipHandoff": {"name": "platform-sre-product", "decision": "pass", "completed": True, "ownerAck": True},
        "supportReadiness": [{"name": "oncall", "decision": "pass", "ready": True}, {"name": "runbooks", "decision": "pass", "ready": True}],
        "kpiBaselines": [{"name": "availability", "decision": "pass", "baselined": True}, {"name": "adoption", "decision": "pass", "baselined": True}],
        "approvals": [{"name": "sre-lead", "decision": "pass", "approved": True}, {"name": "product-ops", "decision": "pass", "approved": True}],
        "evidence": {"postClosureTransition": {"decision": "pass"}},
    }
    result = process_job(JobEnvelope(jobType="platform.post_closure_operational_transition_review", idempotencyKey="test-v54-post-closure-transition", dryRun=True, payload=payload))
    body = as_json(result)
    assert body["resultType"] == "platform.post_closure_operational_transition_review.completed"
    assert body["data"]["decision"] == "pass"
    assert body["data"]["mutatesOwnershipSupportAlertsOrReleaseState"] is False


def test_v54_contract_manifest_contains_stage_closure_and_post_closure_transition_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert "platform.stage_closure_certification_review" in job_types
    assert "platform.post_closure_operational_transition_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.stage_closure_certification_review" in vector_types
    assert "platform.post_closure_operational_transition_review" in vector_types
    assert len(vectors) == 119



def test_v55_post_closure_monitoring_direct_processor_passes():
    payload = {
        "releaseId": "option-b-v55-post-closure",
        "stage": "post-closure",
        "phase": "phase-3",
        "domain": "global",
        "operatingMode": "post-closure-monitoring",
        "route": "/api/hybrid-python/jobs",
        "jobTypes": ["platform.post_closure_operational_transition_review"],
        "monitoringWindows": [{"name": "day-1", "decision": "pass", "completed": True}, {"name": "day-3", "decision": "pass", "completed": True}],
        "sloSignals": [{"name": "availability", "decision": "pass", "met": True, "breaches": 0}, {"name": "latency", "decision": "pass", "met": True, "breaches": 0}],
        "incidentSignals": [{"name": "sev1-watch", "decision": "pass", "openIncidents": 0}],
        "adoptionSignals": [{"name": "operator-usage", "decision": "pass", "score": 0.92}],
        "regressionChecks": [{"name": "api-regression", "decision": "pass", "passed": True}, {"name": "worker-regression", "decision": "pass", "passed": True}],
        "approvals": [{"name": "sre-lead", "decision": "pass", "approved": True}, {"name": "product-ops", "decision": "pass", "approved": True}],
        "evidence": {"postClosureMonitoring": {"decision": "pass"}},
    }
    result = process_job(JobEnvelope(jobType="platform.post_closure_monitoring_review", idempotencyKey="test-v55-post-closure-monitoring", dryRun=True, payload=payload))
    body = as_json(result)
    assert body["resultType"] == "platform.post_closure_monitoring_review.completed"
    assert body["data"]["decision"] == "pass"
    assert body["data"]["artifact"]["artifactType"] == "platform.post_closure_monitoring_review.report"


def test_v55_steady_state_transfer_validation_direct_processor_passes():
    payload = {
        "releaseId": "option-b-v55-steady-state",
        "stage": "steady-state-transfer",
        "phase": "phase-3",
        "targetState": "stable-operations",
        "domain": "global",
        "operatingMode": "steady-state",
        "route": "/api/hybrid-python/jobs",
        "jobTypes": ["platform.post_closure_monitoring_review"],
        "transferItems": [{"name": "ops-ownership", "decision": "pass", "completed": True, "ownerAck": True}, {"name": "support-transition", "decision": "pass", "completed": True, "ownerAck": True}],
        "ownershipMatrix": [{"name": "platform-sre", "decision": "pass", "ownerAck": True}, {"name": "product-ops", "decision": "pass", "ownerAck": True}],
        "runbookCoverage": [{"name": "incident-runbook", "decision": "pass", "published": True}, {"name": "rollback-runbook", "decision": "pass", "published": True}],
        "monitoringReadiness": [{"name": "dashboards", "decision": "pass", "ready": True}, {"name": "alerts", "decision": "pass", "ready": True}],
        "knowledgeTransfer": [{"name": "ops-training", "decision": "pass", "completed": True}],
        "supportModel": {"name": "steady-state-support", "decision": "pass", "ready": True, "ownerAck": True},
        "approvals": [{"name": "sre-lead", "decision": "pass", "approved": True}, {"name": "support-lead", "decision": "pass", "approved": True}],
        "evidence": {"steadyStateTransfer": {"decision": "pass"}},
    }
    result = process_job(JobEnvelope(jobType="platform.steady_state_transfer_validation_review", idempotencyKey="test-v55-steady-state-transfer", dryRun=True, payload=payload))
    body = as_json(result)
    assert body["resultType"] == "platform.steady_state_transfer_validation_review.completed"
    assert body["data"]["decision"] == "pass"
    assert body["data"]["artifact"]["artifactType"] == "platform.steady_state_transfer_validation_review.report"


def test_v55_contract_manifest_contains_post_closure_monitoring_and_steady_state_transfer_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert "platform.post_closure_monitoring_review" in job_types
    assert "platform.steady_state_transfer_validation_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.post_closure_monitoring_review" in vector_types
    assert "platform.steady_state_transfer_validation_review" in vector_types
    assert len(vectors) == 119



def test_v56_steady_state_operational_assurance_direct_processor_passes():
    payload = {
        "releaseId": "option-b-v56-operational-assurance",
        "stage": "steady-state-operations",
        "phase": "post-phase-3",
        "targetState": "stable-operations",
        "domain": "global",
        "operatingMode": "steady-state",
        "route": "/api/hybrid-python/jobs",
        "jobTypes": ["platform.steady_state_transfer_validation_review"],
        "operationalMetrics": [{"name": "availability", "decision": "pass", "met": True, "value": 0.999}, {"name": "latency", "decision": "pass", "met": True, "p95Ms": 180}],
        "sloHealth": [{"name": "availability-slo", "decision": "pass", "met": True, "breaches": 0}, {"name": "latency-slo", "decision": "pass", "met": True, "breaches": 0}],
        "incidentTrends": [{"name": "sev1", "decision": "pass", "openIncidents": 0, "severity": "sev1"}],
        "supportQueues": [{"name": "operator-support", "decision": "pass", "overdueItems": 0}],
        "runbookAudits": [{"name": "incident-runbook", "decision": "pass", "fresh": True}],
        "ownershipReviews": [{"name": "sre-ownership", "decision": "pass", "ownerAck": True}],
        "approvals": [{"name": "sre-lead", "decision": "pass", "approved": True}, {"name": "support-lead", "decision": "pass", "approved": True}],
        "evidence": {"steadyStateOperationalAssurance": {"decision": "pass"}},
    }
    result = process_job(JobEnvelope(jobType="platform.steady_state_operational_assurance_review", idempotencyKey="test-v56-steady-state-operational-assurance", dryRun=True, payload=payload))
    body = as_json(result)
    assert body["resultType"] == "platform.steady_state_operational_assurance_review.completed"
    assert body["data"]["decision"] == "pass"
    assert body["data"]["mutatesSloAlertSupportStaffingOrStatus"] is False


def test_v56_continuous_improvement_backlog_direct_processor_passes():
    payload = {
        "releaseId": "option-b-v56-continuous-improvement",
        "stage": "continuous-improvement",
        "phase": "post-phase-3",
        "domain": "global",
        "operatingMode": "steady-state-improvement",
        "route": "/api/hybrid-python/jobs",
        "jobTypes": ["platform.steady_state_operational_assurance_review"],
        "improvementItems": [{"name": "dashboard-refinement", "decision": "pass", "prioritized": True}, {"name": "support-workflow-optimization", "decision": "pass", "prioritized": True}],
        "valueHypotheses": [{"name": "reduce-manual-review", "decision": "pass", "validated": True}],
        "technicalDebtItems": [{"name": "contract-fixture-cleanup", "decision": "pass", "accepted": True}],
        "riskItems": [{"name": "no-high-open-risk", "decision": "pass", "severity": "low", "closed": True}],
        "ownerCommitments": [{"name": "product-ops-owner", "decision": "pass", "ownerAck": True}],
        "governanceReviews": [{"name": "monthly-review", "decision": "pass", "approved": True}],
        "approvals": [{"name": "delivery-governance", "decision": "pass", "approved": True}],
        "evidence": {"continuousImprovementBacklog": {"decision": "pass"}},
    }
    result = process_job(JobEnvelope(jobType="platform.continuous_improvement_backlog_review", idempotencyKey="test-v56-continuous-improvement-backlog", dryRun=True, payload=payload))
    body = as_json(result)
    assert body["resultType"] == "platform.continuous_improvement_backlog_review.completed"
    assert body["data"]["decision"] == "pass"
    assert body["data"]["mutatesTicketsRoadmapBudgetOwnersOrRisks"] is False


def test_v56_contract_manifest_contains_operational_assurance_and_improvement_backlog_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert "platform.steady_state_operational_assurance_review" in job_types
    assert "platform.continuous_improvement_backlog_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.steady_state_operational_assurance_review" in vector_types
    assert "platform.continuous_improvement_backlog_review" in vector_types
    assert len(vectors) == 119



def test_v57_stable_operations_optimization_direct_processor_passes():
    payload = {
        "releaseId": "option-b-v57-stable-ops-optimization",
        "stage": "stable-operations-optimization",
        "phase": "post-phase-3",
        "domain": "global",
        "operatingMode": "steady-state-optimization",
        "route": "/api/hybrid-python/jobs",
        "jobTypes": ["platform.continuous_improvement_backlog_review"],
        "optimizationMetrics": [
            {"name": "latency-headroom", "decision": "pass", "met": True, "value": 0.82},
            {"name": "manual-touch-reduction", "decision": "pass", "met": True, "value": 0.35},
        ],
        "costSignals": [{"name": "worker-cost-baseline", "decision": "pass", "healthy": True}],
        "reliabilitySignals": [{"name": "queue-retry-rate", "decision": "pass", "healthy": True}],
        "automationOpportunities": [{"name": "evidence-pack-refresh", "decision": "pass", "ready": True}],
        "debtItems": [{"name": "fixture-normalization", "decision": "pass", "severity": "low", "accepted": True}],
        "guardrailReviews": [{"name": "no-slo-regression", "decision": "pass", "approved": True}],
        "approvals": [{"name": "sre-lead", "decision": "pass", "approved": True}],
        "evidence": {"stableOperationsOptimization": {"decision": "pass"}},
    }
    result = process_job(JobEnvelope(jobType="platform.stable_operations_optimization_review", idempotencyKey="test-v57-stable-operations-optimization", dryRun=True, payload=payload))
    body = as_json(result)
    assert body["resultType"] == "platform.stable_operations_optimization_review.completed"
    assert body["data"]["decision"] == "pass"
    assert body["data"]["mutatesTicketsBudgetsAutomationInfraSloAlertsOrRisks"] is False


def test_v57_recurring_maintenance_cycle_readiness_direct_processor_passes():
    payload = {
        "releaseId": "option-b-v57-recurring-maintenance",
        "stage": "recurring-maintenance",
        "phase": "steady-state",
        "targetCycle": "monthly-operations-maintenance",
        "domain": "global",
        "operatingMode": "recurring-maintenance",
        "route": "/api/hybrid-python/jobs",
        "jobTypes": ["platform.stable_operations_optimization_review"],
        "maintenanceWindows": [{"name": "monthly-window", "decision": "pass", "approved": True}],
        "patchCadence": {"name": "monthly-patch-cadence", "decision": "pass", "approved": True},
        "dependencyUpdatePlan": {"name": "dependency-update-plan", "decision": "pass", "ready": True},
        "backupValidation": {"name": "backup-validation", "decision": "pass", "validated": True},
        "runbookSchedule": [{"name": "monthly-runbook-review", "decision": "pass", "scheduled": True}],
        "ownerRoster": [{"name": "platform-sre", "decision": "pass", "ownerAck": True}],
        "approvals": [{"name": "delivery-governance", "decision": "pass", "approved": True}],
        "evidence": {"recurringMaintenanceCycleReadiness": {"decision": "pass"}},
    }
    result = process_job(JobEnvelope(jobType="platform.recurring_maintenance_cycle_readiness_review", idempotencyKey="test-v57-recurring-maintenance-cycle-readiness", dryRun=True, payload=payload))
    body = as_json(result)
    assert body["resultType"] == "platform.recurring_maintenance_cycle_readiness_review.completed"
    assert body["data"]["decision"] == "pass"
    assert body["data"]["mutatesCalendarsPatchesDependenciesBackupsSecretsOrOwners"] is False


def test_v57_contract_manifest_contains_stable_operations_and_maintenance_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert "platform.stable_operations_optimization_review" in job_types
    assert "platform.recurring_maintenance_cycle_readiness_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.stable_operations_optimization_review" in vector_types
    assert "platform.recurring_maintenance_cycle_readiness_review" in vector_types
    assert len(vectors) == 119



def test_v58_maintenance_cycle_execution_direct_processor_passes():
    payload = {
        "releaseId": "option-b-v58-maintenance-cycle-execution",
        "stage": "maintenance-cycle-execution",
        "phase": "steady-state",
        "cycleId": "monthly-operations-maintenance",
        "domain": "global",
        "operatingMode": "governed-maintenance-execution",
        "route": "/api/hybrid-python/jobs",
        "jobTypes": ["platform.recurring_maintenance_cycle_readiness_review"],
        "executionItems": [
            {"name": "monthly-maintenance-window", "decision": "pass", "completed": True},
            {"name": "service-health-baseline", "decision": "pass", "completed": True},
        ],
        "patchResults": [{"name": "security-patch-bundle", "decision": "pass", "verified": True}],
        "dependencyResults": [{"name": "python-worker-dependencies", "decision": "pass", "verified": True}],
        "backupResults": [{"name": "pre-maintenance-backup", "decision": "pass", "validated": True}],
        "validationResults": [
            {"name": "post-maintenance-smoke", "decision": "pass", "validated": True},
            {"name": "contract-regression", "decision": "pass", "validated": True},
        ],
        "rollbackReadiness": {"name": "rollback-playbook", "decision": "pass", "ready": True},
        "communications": [{"name": "operator-summary", "decision": "pass", "sent": True}],
        "approvals": [{"name": "sre-lead", "decision": "pass", "approved": True}],
        "evidence": {"maintenanceCycleExecution": {"decision": "pass"}},
    }
    result = process_job(JobEnvelope(jobType="platform.maintenance_cycle_execution_review", idempotencyKey="test-v58-maintenance-cycle-execution", dryRun=True, payload=payload))
    body = as_json(result)
    assert body["resultType"] == "platform.maintenance_cycle_execution_review.completed"
    assert body["data"]["decision"] == "pass"
    assert body["data"]["mutatesPatchesDependenciesBackupsCalendarsSecretsTicketsOrOwners"] is False


def test_v58_long_term_operability_sustainability_direct_processor_passes():
    payload = {
        "releaseId": "option-b-v58-long-term-sustainability",
        "stage": "long-term-operability-sustainability",
        "phase": "steady-state",
        "horizon": "quarterly-sustainability",
        "domain": "global",
        "operatingMode": "long-term-sustainability",
        "route": "/api/hybrid-python/jobs",
        "jobTypes": ["platform.maintenance_cycle_execution_review"],
        "sustainabilityMetrics": [
            {"name": "slo-sustainability", "decision": "pass", "healthy": True},
            {"name": "support-load-trend", "decision": "pass", "stable": True},
        ],
        "ownershipSignals": [{"name": "platform-sre-owner", "decision": "pass", "ownerAck": True}],
        "knowledgeBaseReviews": [{"name": "operator-runbook-index", "decision": "pass", "current": True}],
        "dependencyLifecycle": {"name": "dependency-lifecycle", "decision": "pass", "ready": True},
        "budgetSignals": [{"name": "worker-cost-envelope", "decision": "pass", "healthy": True}],
        "riskAcceptances": [{"name": "no-high-risk", "decision": "pass", "severity": "low", "accepted": True}],
        "improvementCadence": {"name": "quarterly-improvement-review", "decision": "pass", "ready": True},
        "approvals": [{"name": "delivery-governance", "decision": "pass", "approved": True}],
        "evidence": {"longTermOperabilitySustainability": {"decision": "pass"}},
    }
    result = process_job(JobEnvelope(jobType="platform.long_term_operability_sustainability_review", idempotencyKey="test-v58-long-term-operability-sustainability", dryRun=True, payload=payload))
    body = as_json(result)
    assert body["resultType"] == "platform.long_term_operability_sustainability_review.completed"
    assert body["data"]["decision"] == "pass"
    assert body["data"]["mutatesBudgetsOwnersRoadmapDependenciesKnowledgeBaseOrRisks"] is False


def test_v58_contract_manifest_contains_maintenance_execution_and_sustainability_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert "platform.maintenance_cycle_execution_review" in job_types
    assert "platform.long_term_operability_sustainability_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.maintenance_cycle_execution_review" in vector_types
    assert "platform.long_term_operability_sustainability_review" in vector_types
    assert len(vectors) == 119



def test_v59_recurring_operational_maturity_audit_direct_processor_passes():
    payload = {
        "releaseId": "option-b-v59-operational-maturity-audit",
        "stage": "recurring-operational-maturity-audit",
        "phase": "steady-state",
        "auditCycle": "quarterly-operations-maturity",
        "domain": "global",
        "operatingMode": "recurring-maturity-governance",
        "route": "/api/hybrid-python/jobs",
        "jobTypes": ["platform.long_term_operability_sustainability_review"],
        "maturityDimensions": [
            {"name": "incident-management", "decision": "pass", "score": 0.91, "met": True},
            {"name": "change-governance", "decision": "pass", "score": 0.88, "met": True},
        ],
        "controlChecks": [
            {"name": "runbook-control", "decision": "pass", "passed": True},
            {"name": "access-review-control", "decision": "pass", "passed": True},
        ],
        "incidentLearnings": [{"name": "no-repeat-sev1", "decision": "pass", "closed": True}],
        "supportSignals": [{"name": "support-backlog-health", "decision": "pass", "healthy": True}],
        "operatorEvidence": [{"name": "quarterly-evidence-pack", "decision": "pass", "complete": True}],
        "risks": [{"name": "no-high-open-risk", "decision": "pass", "severity": "low", "accepted": True}],
        "approvals": [{"name": "sre-lead", "decision": "pass", "approved": True}],
        "evidence": {"recurringOperationalMaturityAudit": {"decision": "pass"}},
    }
    result = process_job(JobEnvelope(jobType="platform.recurring_operational_maturity_audit_review", idempotencyKey="test-v59-recurring-operational-maturity-audit", dryRun=True, payload=payload))
    body = as_json(result)
    assert body["resultType"] == "platform.recurring_operational_maturity_audit_review.completed"
    assert body["data"]["decision"] == "pass"
    assert body["data"]["mutatesMaturityRisksTicketsOwnersRoadmapsControlsOrSupportQueues"] is False


def test_v59_stable_state_continuity_control_direct_processor_passes():
    payload = {
        "releaseId": "option-b-v59-stable-state-continuity",
        "stage": "stable-state-continuity-control",
        "phase": "steady-state",
        "horizon": "quarterly-continuity",
        "domain": "global",
        "operatingMode": "stable-state-continuity",
        "route": "/api/hybrid-python/jobs",
        "jobTypes": ["platform.recurring_operational_maturity_audit_review"],
        "continuityControls": [
            {"name": "service-continuity-control", "decision": "pass", "passed": True},
            {"name": "operator-coverage-control", "decision": "pass", "passed": True},
        ],
        "drSignals": [{"name": "restore-drill-signal", "decision": "pass", "validated": True}],
        "dependencyContinuity": [{"name": "critical-provider-continuity", "decision": "pass", "healthy": True}],
        "operationalFallbacks": [{"name": "manual-processing-fallback", "decision": "pass", "ready": True}],
        "communicationChecks": [{"name": "stakeholder-communication-tree", "decision": "pass", "approved": True}],
        "risks": [{"name": "no-open-continuity-risk", "decision": "pass", "severity": "low", "accepted": True}],
        "approvals": [{"name": "business-continuity-owner", "decision": "pass", "approved": True}],
        "evidence": {"stableStateContinuityControl": {"decision": "pass"}},
    }
    result = process_job(JobEnvelope(jobType="platform.stable_state_continuity_control_review", idempotencyKey="test-v59-stable-state-continuity-control", dryRun=True, payload=payload))
    body = as_json(result)
    assert body["resultType"] == "platform.stable_state_continuity_control_review.completed"
    assert body["data"]["decision"] == "pass"
    assert body["data"]["mutatesFailoversDependenciesCommunicationsRisksRunbooksOrOwners"] is False


def test_v59_contract_manifest_contains_operational_maturity_and_continuity_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert "platform.recurring_operational_maturity_audit_review" in job_types
    assert "platform.stable_state_continuity_control_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.recurring_operational_maturity_audit_review" in vector_types
    assert "platform.stable_state_continuity_control_review" in vector_types
    assert len(vectors) == 119



def test_v60_operational_resilience_governance_direct_processor_passes():
    payload = {
        "releaseId": "option-b-v60-operational-resilience",
        "stage": "operational-resilience-governance",
        "phase": "steady-state",
        "governanceCycle": "quarterly-resilience-governance",
        "domain": "global",
        "operatingMode": "resilience-governance",
        "route": "/api/hybrid-python/jobs",
        "jobTypes": ["platform.stable_state_continuity_control_review"],
        "resilienceControls": [{"name": "multi-zone-readiness", "decision": "pass", "passed": True}, {"name": "queue-drain-control", "decision": "pass", "healthy": True}],
        "chaosDrills": [{"name": "worker-restart-drill", "decision": "pass", "completed": True}],
        "failoverReadiness": [{"name": "primary-worker-failover", "decision": "pass", "ready": True}],
        "serviceOwnership": [{"name": "sre-service-owner", "decision": "pass", "ownerAck": True}],
        "riskItems": [{"name": "no-high-resilience-risk", "decision": "pass", "severity": "low", "accepted": True}],
        "governanceReviews": [{"name": "quarterly-resilience-board", "decision": "pass", "approved": True}],
        "approvals": [{"name": "business-continuity-owner", "decision": "pass", "approved": True}],
        "evidence": {"operationalResilienceGovernance": {"decision": "pass"}},
    }
    result = process_job(JobEnvelope(jobType="platform.operational_resilience_governance_review", idempotencyKey="test-v60-operational-resilience-governance", dryRun=True, payload=payload))
    body = as_json(result)
    assert body["resultType"] == "platform.operational_resilience_governance_review.completed"
    assert body["data"]["decision"] == "pass"
    assert body["data"]["pythonOperationalResilienceGovernanceReviewIsAdvisory"] is True


def test_v60_recovery_capability_validation_direct_processor_passes():
    payload = {
        "releaseId": "option-b-v60-recovery-capability",
        "stage": "recovery-capability-validation",
        "phase": "steady-state",
        "validationWindow": "quarterly-recovery-validation",
        "domain": "global",
        "operatingMode": "recovery-capability-validation",
        "route": "/api/hybrid-python/jobs",
        "jobTypes": ["platform.operational_resilience_governance_review"],
        "restoreTests": [{"name": "artifact-store-restore", "decision": "pass", "validated": True}],
        "rtoRpoChecks": [{"name": "worker-rto-rpo", "decision": "pass", "withinTarget": True}],
        "backupIntegrity": [{"name": "backup-sha-validation", "decision": "pass", "verified": True}],
        "incidentReplayResults": [{"name": "sev2-replay", "decision": "pass", "completed": True}],
        "dependencyRecovery": [{"name": "redis-recovery", "decision": "pass", "ready": True}],
        "communicationValidation": [{"name": "stakeholder-notification-tree", "decision": "pass", "approved": True}],
        "risks": [{"name": "no-high-recovery-risk", "decision": "pass", "severity": "low", "accepted": True}],
        "approvals": [{"name": "dr-owner", "decision": "pass", "approved": True}],
        "evidence": {"recoveryCapabilityValidation": {"decision": "pass"}},
    }
    result = process_job(JobEnvelope(jobType="platform.recovery_capability_validation_review", idempotencyKey="test-v60-recovery-capability-validation", dryRun=True, payload=payload))
    body = as_json(result)
    assert body["resultType"] == "platform.recovery_capability_validation_review.completed"
    assert body["data"]["decision"] == "pass"
    assert body["data"]["pythonRecoveryCapabilityValidationReviewIsAdvisory"] is True


def test_v60_contract_manifest_contains_resilience_and_recovery_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert "platform.operational_resilience_governance_review" in job_types
    assert "platform.recovery_capability_validation_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.operational_resilience_governance_review" in vector_types
    assert "platform.recovery_capability_validation_review" in vector_types
    assert len(vectors) == 119



def test_v61_operational_resilience_optimization_direct_processor_passes():
    payload = {
        "releaseId": "option-b-v61-resilience-optimization",
        "stage": "operational-resilience-optimization",
        "phase": "steady-state",
        "optimizationCycle": "quarterly-resilience-optimization",
        "domain": "global",
        "operatingMode": "resilience-optimization",
        "route": "/api/hybrid-python/jobs",
        "jobTypes": ["platform.recovery_capability_validation_review"],
        "resilienceMetrics": [{"name": "queue-recovery-latency", "decision": "pass", "withinTarget": True}, {"name": "failover-error-rate", "decision": "pass", "healthy": True}],
        "optimizationActions": [{"name": "alert-noise-reduction", "decision": "pass", "approved": True}],
        "automationCandidates": [{"name": "continuity-drill-reminder", "decision": "pass", "ready": True}],
        "incidentPatterns": [{"name": "no-recurring-sev2-pattern", "decision": "pass", "reviewed": True}],
        "capacitySignals": [{"name": "worker-headroom", "decision": "pass", "withinTarget": True}],
        "riskItems": [{"name": "no-high-optimization-risk", "decision": "pass", "severity": "low", "accepted": True}],
        "approvals": [{"name": "resilience-governance-owner", "decision": "pass", "approved": True}],
        "evidence": {"operationalResilienceOptimization": {"decision": "pass"}},
    }
    result = process_job(JobEnvelope(jobType="platform.operational_resilience_optimization_review", idempotencyKey="test-v61-operational-resilience-optimization", dryRun=True, payload=payload))
    body = as_json(result)
    assert body["resultType"] == "platform.operational_resilience_optimization_review.completed"
    assert body["data"]["decision"] == "pass"
    assert body["data"]["pythonOperationalResilienceOptimizationReviewIsAdvisory"] is True


def test_v61_automated_continuity_preparedness_direct_processor_passes():
    payload = {
        "releaseId": "option-b-v61-automated-continuity",
        "stage": "automated-continuity-preparedness",
        "phase": "steady-state",
        "preparednessWindow": "quarterly-continuity-automation",
        "domain": "global",
        "operatingMode": "automated-continuity-preparedness",
        "route": "/api/hybrid-python/jobs",
        "jobTypes": ["platform.operational_resilience_optimization_review"],
        "automationControls": [{"name": "scheduled-drill-control", "decision": "pass", "validated": True}, {"name": "escalation-auto-check", "decision": "pass", "ready": True}],
        "continuityRunbooks": [{"name": "continuity-automation-runbook", "decision": "pass", "current": True}],
        "schedulerReadiness": [{"name": "scheduler-dry-run", "decision": "pass", "ready": True}],
        "dependencyHooks": [{"name": "redis-health-hook", "decision": "pass", "validated": True}],
        "notificationTemplates": [{"name": "continuity-notification-template", "decision": "pass", "approved": True}],
        "risks": [{"name": "no-high-automation-risk", "decision": "pass", "severity": "low", "accepted": True}],
        "approvals": [{"name": "business-continuity-owner", "decision": "pass", "approved": True}],
        "evidence": {"automatedContinuityPreparedness": {"decision": "pass"}},
    }
    result = process_job(JobEnvelope(jobType="platform.automated_continuity_preparedness_review", idempotencyKey="test-v61-automated-continuity-preparedness", dryRun=True, payload=payload))
    body = as_json(result)
    assert body["resultType"] == "platform.automated_continuity_preparedness_review.completed"
    assert body["data"]["decision"] == "pass"
    assert body["data"]["pythonAutomatedContinuityPreparednessReviewIsAdvisory"] is True


def test_v61_contract_manifest_contains_resilience_optimization_and_automated_continuity_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert "platform.operational_resilience_optimization_review" in job_types
    assert "platform.automated_continuity_preparedness_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.operational_resilience_optimization_review" in vector_types
    assert "platform.automated_continuity_preparedness_review" in vector_types
    assert len(vectors) == 119



def test_v62_automated_continuity_execution_validation_direct_processor_passes():
    payload = {
        "releaseId": "option-b-v62-continuity-execution",
        "stage": "automated-continuity-execution-validation",
        "phase": "steady-state",
        "executionWindow": "quarterly-continuity-execution",
        "domain": "global",
        "operatingMode": "automated-continuity-execution-validation",
        "route": "/api/hybrid-python/jobs",
        "jobTypes": ["platform.automated_continuity_preparedness_review"],
        "executionRuns": [{"name": "continuity-scheduler-dry-run", "decision": "pass", "completed": True}],
        "schedulerEvents": [{"name": "scheduled-drill-event", "decision": "pass", "validated": True}],
        "dependencyHooks": [{"name": "redis-health-hook", "decision": "pass", "healthy": True}],
        "notificationDeliveries": [{"name": "ops-template-dry-run", "decision": "pass", "validated": True}],
        "runbookCheckpoints": [{"name": "continuity-runbook-checkpoint", "decision": "pass", "completed": True}],
        "riskItems": [{"name": "no-high-execution-risk", "decision": "pass", "severity": "low", "accepted": True}],
        "approvals": [{"name": "business-continuity-owner", "decision": "pass", "approved": True}],
        "evidence": {"automatedContinuityExecutionValidation": {"decision": "pass"}},
    }
    result = process_job(JobEnvelope(jobType="platform.automated_continuity_execution_validation_review", idempotencyKey="test-v62-automated-continuity-execution", dryRun=True, payload=payload))
    body = as_json(result)
    assert body["resultType"] == "platform.automated_continuity_execution_validation_review.completed"
    assert body["data"]["decision"] == "pass"
    assert body["data"]["pythonAutomatedContinuityExecutionValidationReviewIsAdvisory"] is True


def test_v62_operational_resilience_feedback_loop_direct_processor_passes():
    payload = {
        "releaseId": "option-b-v62-resilience-feedback",
        "stage": "operational-resilience-feedback-loop",
        "phase": "steady-state",
        "feedbackCycle": "quarterly-resilience-feedback",
        "domain": "global",
        "operatingMode": "operational-resilience-feedback-loop",
        "route": "/api/hybrid-python/jobs",
        "jobTypes": ["platform.automated_continuity_execution_validation_review"],
        "feedbackSignals": [{"name": "post-drill-feedback", "decision": "pass", "reviewed": True}, {"name": "slo-feedback-signal", "decision": "pass", "healthy": True}],
        "remediationItems": [{"name": "documentation-follow-up", "decision": "pass", "ownerAck": True}],
        "learningItems": [{"name": "runbook-learning", "decision": "pass", "completed": True}],
        "metricAdjustments": [{"name": "continuity-slo-threshold-review", "decision": "pass", "approved": True}],
        "ownerResponses": [{"name": "sre-owner-response", "decision": "pass", "approved": True}],
        "risks": [{"name": "no-high-feedback-risk", "decision": "pass", "severity": "low", "accepted": True}],
        "approvals": [{"name": "resilience-governance-owner", "decision": "pass", "approved": True}],
        "evidence": {"operationalResilienceFeedbackLoop": {"decision": "pass"}},
    }
    result = process_job(JobEnvelope(jobType="platform.operational_resilience_feedback_loop_review", idempotencyKey="test-v62-operational-resilience-feedback", dryRun=True, payload=payload))
    body = as_json(result)
    assert body["resultType"] == "platform.operational_resilience_feedback_loop_review.completed"
    assert body["data"]["decision"] == "pass"
    assert body["data"]["pythonOperationalResilienceFeedbackLoopReviewIsAdvisory"] is True


def test_v62_contract_manifest_contains_continuity_execution_and_feedback_loop_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert "platform.automated_continuity_execution_validation_review" in job_types
    assert "platform.operational_resilience_feedback_loop_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.automated_continuity_execution_validation_review" in vector_types
    assert "platform.operational_resilience_feedback_loop_review" in vector_types
    assert len(vectors) == 119



def test_v63_final_closure_evidence_package_direct_processor_passes():
    payload = {
        "releaseId": "option-b-v63-final-closure-evidence",
        "stage": "final-closure-evidence-package",
        "phase": "closure",
        "closureWindow": "pre-handover-final-evidence",
        "domain": "global",
        "operatingMode": "final-closure-evidence-package",
        "route": "/api/hybrid-python/jobs",
        "jobTypes": ["platform.operational_resilience_feedback_loop_review"],
        "versionSummary": [{"name": "versions-v1-to-v62", "decision": "pass", "completed": True}, {"name": "v63-evidence-package", "decision": "pass", "completed": True}],
        "validationResults": [{"name": "python-worker-contract-tests", "decision": "pass", "passed": True}, {"name": "zip-integrity", "decision": "pass", "verified": True}],
        "contractEvidence": [{"name": "contract-vectors", "decision": "pass", "validated": True}],
        "apiRouteEvidence": [{"name": "hybrid-python-routes", "decision": "pass", "validated": True}],
        "workerEvidence": [{"name": "python-worker-v63", "decision": "pass", "healthy": True}],
        "residualRisks": [{"name": "npm-build-env-validation", "decision": "pass", "severity": "medium", "accepted": True}],
        "signoffs": [{"name": "delivery-governance", "decision": "pass", "approved": True}, {"name": "operations-owner", "decision": "pass", "approved": True}],
        "evidence": {"finalClosureEvidencePackage": {"decision": "pass"}},
    }
    result = process_job(JobEnvelope(jobType="platform.final_closure_evidence_package_review", idempotencyKey="test-v63-final-closure-evidence-package", dryRun=True, payload=payload))
    body = as_json(result)
    assert body["resultType"] == "platform.final_closure_evidence_package_review.completed"
    assert body["data"]["decision"] == "pass"
    assert body["data"]["pythonFinalClosureEvidencePackageReviewIsAdvisory"] is True


def test_v63_global_implementation_completion_checklist_direct_processor_passes():
    payload = {
        "releaseId": "option-b-v63-completion-checklist",
        "stage": "global-implementation-completion-checklist",
        "phase": "closure",
        "checklistScope": "option-b-python-progressive",
        "domain": "global",
        "operatingMode": "completion-checklist-review",
        "route": "/api/hybrid-python/jobs",
        "jobTypes": ["platform.final_closure_evidence_package_review"],
        "functionalAreas": [{"name": "python-worker", "decision": "pass", "completionPercent": 100}, {"name": "node-bridge", "decision": "pass", "completionPercent": 100}, {"name": "contracts", "decision": "pass", "completionPercent": 100}],
        "implementationTasks": [{"name": "contracts", "decision": "pass", "completed": True}, {"name": "processors", "decision": "pass", "completed": True}, {"name": "policies", "decision": "pass", "completed": True}, {"name": "routes", "decision": "pass", "completed": True}, {"name": "docs", "decision": "pass", "completed": True}],
        "validationTasks": [{"name": "compileall", "decision": "pass", "passed": True}, {"name": "contract-tests", "decision": "pass", "passed": True}, {"name": "zip-test", "decision": "pass", "passed": True}],
        "handoverTasks": [{"name": "evidence-package-ready", "decision": "pass", "completed": True}],
        "deferredItems": [{"name": "npm-build-in-target-env", "decision": "pass", "severity": "medium", "accepted": True}],
        "approvals": [{"name": "delivery-governance", "decision": "pass", "approved": True}],
        "evidence": {"globalImplementationCompletionChecklist": {"decision": "pass"}},
    }
    result = process_job(JobEnvelope(jobType="platform.global_implementation_completion_checklist_review", idempotencyKey="test-v63-global-completion-checklist", dryRun=True, payload=payload))
    body = as_json(result)
    assert body["resultType"] == "platform.global_implementation_completion_checklist_review.completed"
    assert body["data"]["decision"] == "pass"
    assert body["data"]["pythonGlobalImplementationCompletionChecklistReviewIsAdvisory"] is True


def test_v63_contract_manifest_contains_closure_evidence_and_completion_checklist_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert "platform.final_closure_evidence_package_review" in job_types
    assert "platform.global_implementation_completion_checklist_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.final_closure_evidence_package_review" in vector_types
    assert "platform.global_implementation_completion_checklist_review" in vector_types
    assert len(vectors) == 119



def test_v64_final_operational_handover_direct_processor_passes():
    payload = {
        "releaseId": "option-b-v64-final-handover",
        "stage": "final-operational-handover",
        "phase": "closure",
        "handoverScope": "option-b-python-progressive",
        "domain": "global",
        "operatingMode": "final-operational-handover",
        "route": "/api/hybrid-python/jobs",
        "jobTypes": ["platform.global_implementation_completion_checklist_review"],
        "runbooks": [{"name": "final-runbook", "decision": "pass", "current": True}, {"name": "rollback-runbook", "decision": "pass", "approved": True}],
        "ownerAssignments": [{"name": "sre-owner", "decision": "pass", "assigned": True}, {"name": "support-owner", "decision": "pass", "assigned": True}],
        "supportModel": [{"name": "steady-state-support-model", "decision": "pass", "approved": True}],
        "monitoringControls": [{"name": "post-closure-monitoring", "decision": "pass", "healthy": True}],
        "escalationPaths": [{"name": "incident-escalation", "decision": "pass", "validated": True}],
        "operationalRisks": [{"name": "no-open-high-operational-risk", "decision": "pass", "severity": "low", "accepted": True}],
        "signoffs": [{"name": "operations-owner", "decision": "pass", "approved": True}, {"name": "support-owner", "decision": "pass", "approved": True}],
        "evidence": {"finalOperationalHandover": {"decision": "pass"}},
    }
    result = process_job(JobEnvelope(jobType="platform.final_operational_handover_review", idempotencyKey="test-v64-final-operational-handover", dryRun=True, payload=payload))
    body = as_json(result)
    assert body["resultType"] == "platform.final_operational_handover_review.completed"
    assert body["data"]["decision"] == "pass"
    assert body["data"]["pythonFinalOperationalHandoverReviewIsAdvisory"] is True


def test_v64_phase_closure_certification_direct_processor_passes():
    payload = {
        "releaseId": "option-b-v64-phase-closure",
        "stage": "phase-closure-certification",
        "phase": "closure",
        "certificationScope": "option-b-python-progressive",
        "domain": "global",
        "operatingMode": "phase-closure-certification",
        "route": "/api/hybrid-python/jobs",
        "jobTypes": ["platform.final_operational_handover_review"],
        "closureCriteria": [{"name": "evidence-package-complete", "decision": "pass", "met": True}, {"name": "handover-complete", "decision": "pass", "met": True}],
        "evidencePackage": [{"name": "v1-to-v64-evidence", "decision": "pass", "complete": True}],
        "handoverEvidence": [{"name": "handover-approved", "decision": "pass", "approved": True}],
        "residualRisks": [{"name": "npm-build-target-env", "decision": "pass", "severity": "medium", "accepted": True}],
        "releaseArtifacts": [{"name": "v64-zip", "decision": "pass", "published": True}, {"name": "v64-sha256", "decision": "pass", "published": True}],
        "approvals": [{"name": "delivery-governance", "decision": "pass", "approved": True}, {"name": "executive-sponsor", "decision": "pass", "approved": True}],
        "nextPhaseBacklog": [{"name": "future-enhancements-separated", "decision": "pass", "separated": True}],
        "evidence": {"phaseClosureCertification": {"decision": "pass"}},
    }
    result = process_job(JobEnvelope(jobType="platform.phase_closure_certification_review", idempotencyKey="test-v64-phase-closure-certification", dryRun=True, payload=payload))
    body = as_json(result)
    assert body["resultType"] == "platform.phase_closure_certification_review.completed"
    assert body["data"]["decision"] == "pass"
    assert body["data"]["pythonPhaseClosureCertificationReviewIsAdvisory"] is True


def test_v64_contract_manifest_contains_final_handover_and_certification_contracts():
    manifest_body = as_json(run(contracts_manifest_direct()))
    assert manifest_body["schemaVersion"] == "2026-05-option-b-v64"
    job_types = {item["jobType"] for item in manifest_body["contracts"]}
    assert "platform.final_operational_handover_review" in job_types
    assert "platform.phase_closure_certification_review" in job_types
    vectors = [as_json(item) for item in run(contract_test_vectors_direct())]
    vector_types = {item["jobType"] for item in vectors}
    assert "platform.final_operational_handover_review" in vector_types
    assert "platform.phase_closure_certification_review" in vector_types
    assert len(vectors) == 119
