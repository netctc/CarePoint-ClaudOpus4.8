from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path
from threading import RLock
from typing import Any

from .compat import model_dump, model_validate
from .config import get_settings
from .models import (
    CanaryAssignment,
    CanaryAssignmentRequest,
    CanaryGateDecision,
    CanaryRolloutAction,
    CanaryRolloutPlanRequest,
    CanaryRolloutState,
)

DEFAULT_ROUTE = "/api/hybrid-python/jobs"
DEFAULT_STAGES = [0, 1, 5, 10, 25, 50]
TERMINAL_DISABLED_STATUSES = {"disabled", "rollback"}
PAUSED_STATUSES = {"paused"}
ACTIVE_STATUSES = {"planned", "active", "advancing", "hold"}


def utc_now_iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def deterministic_bucket(route: str, subject_key: str) -> int:
    digest = hashlib.sha256(f"{route}:{subject_key}".encode("utf-8")).digest()
    return digest[0] % 100


def normalize_stages(stage_percents: list[int], target_percent: int) -> list[int]:
    values = {0, max(0, min(100, target_percent))}
    for value in stage_percents or DEFAULT_STAGES:
        values.add(max(0, min(100, int(value))))
    return sorted(values)


def next_stage(current_percent: int, target_percent: int, stage_percents: list[int]) -> int:
    current = max(0, min(100, int(current_percent)))
    target = max(0, min(100, int(target_percent)))
    if current >= target:
        return current
    for stage in normalize_stages(stage_percents, target):
        if current < stage <= target:
            return stage
    return target


class RolloutStore:
    def __init__(self) -> None:
        self._lock = RLock()
        self._states: dict[str, CanaryRolloutState] = {}
        self._audit: list[dict[str, Any]] = []

    def reset(self) -> None:
        with self._lock:
            self._states.clear()
            self._audit.clear()
        self._delete_state_file()

    def current(self, route: str = DEFAULT_ROUTE) -> CanaryRolloutState:
        with self._lock:
            state = self._states.get(route)
        if state is not None:
            return state
        loaded = self._load(route)
        if loaded is not None:
            return loaded
        now = utc_now_iso()
        return CanaryRolloutState(
            route=route,
            status="disabled",
            currentPercent=0,
            targetPercent=0,
            stagePercents=list(DEFAULT_STAGES),
            nextPercent=0,
            minComparisons=10,
            maxMismatchRate=0.05,
            maxFailedJobs=0,
            dryRun=True,
            jobType=None,
            createdBy=None,
            updatedBy=None,
            reason="default-disabled-state",
            lastDecision=None,
            createdAt=now,
            updatedAt=now,
            history=[],
        )

    def plan(self, request: CanaryRolloutPlanRequest) -> CanaryRolloutState:
        now = utc_now_iso()
        stages = normalize_stages(request.stage_percents, request.target_percent)
        nxt = next_stage(request.current_percent, request.target_percent, stages)
        status = "planned" if request.target_percent > 0 else "disabled"
        state = CanaryRolloutState(
            route=request.route,
            status=status,
            currentPercent=request.current_percent,
            targetPercent=request.target_percent,
            stagePercents=stages,
            nextPercent=nxt,
            minComparisons=request.min_comparisons,
            maxMismatchRate=request.max_mismatch_rate,
            maxFailedJobs=request.max_failed_jobs,
            dryRun=request.dry_run,
            jobType=request.job_type,
            createdBy=request.created_by,
            updatedBy=request.created_by,
            reason=request.reason,
            lastDecision=None,
            createdAt=now,
            updatedAt=now,
            history=[self._audit_event("plan", request.created_by, request.reason, now, dry_run=request.dry_run, current=request.current_percent, target=request.target_percent)],
        )
        if not request.dry_run:
            self._save(state)
        return state

    def advance(self, action: CanaryRolloutAction, gate: CanaryGateDecision, route: str = DEFAULT_ROUTE) -> CanaryRolloutState:
        state = self.current(route)
        now = utc_now_iso()
        gate_payload = model_dump(gate, by_alias=True, mode="json")
        updated = state.copy(deep=True)
        updated.updated_at = now
        updated.updated_by = action.actor_user_id
        updated.reason = action.reason
        updated.last_decision = gate_payload
        updated.dry_run = action.dry_run

        if gate.recommendation == "rollback":
            updated.status = "rollback"
            updated.current_percent = 0
            updated.next_percent = 0
        elif not gate.allowed:
            updated.status = "hold"
            updated.next_percent = updated.current_percent
        else:
            updated.current_percent = next_stage(updated.current_percent, updated.target_percent, updated.stage_percents)
            updated.next_percent = next_stage(updated.current_percent, updated.target_percent, updated.stage_percents)
            updated.status = "active" if updated.current_percent >= updated.target_percent else "advancing"

        updated.history = [*updated.history, self._audit_event("advance", action.actor_user_id, action.reason, now, dry_run=action.dry_run, decision=gate_payload, current=updated.current_percent, target=updated.target_percent)]
        if not action.dry_run:
            self._save(updated)
        return updated

    def pause(self, action: CanaryRolloutAction, route: str = DEFAULT_ROUTE) -> CanaryRolloutState:
        return self._transition(route, action, "paused", "pause")

    def resume(self, action: CanaryRolloutAction, route: str = DEFAULT_ROUTE) -> CanaryRolloutState:
        state = self.current(route)
        target_status = "active" if state.current_percent >= state.target_percent and state.target_percent > 0 else "advancing"
        return self._transition(route, action, target_status, "resume")

    def rollback(self, action: CanaryRolloutAction, route: str = DEFAULT_ROUTE) -> CanaryRolloutState:
        state = self.current(route)
        now = utc_now_iso()
        updated = state.copy(deep=True)
        updated.status = "rollback"
        updated.current_percent = 0
        updated.next_percent = 0
        updated.updated_at = now
        updated.updated_by = action.actor_user_id
        updated.reason = action.reason
        updated.dry_run = action.dry_run
        updated.history = [*updated.history, self._audit_event("rollback", action.actor_user_id, action.reason, now, dry_run=action.dry_run, current=0, target=updated.target_percent)]
        if not action.dry_run:
            self._save(updated)
        return updated

    def assign(self, request: CanaryAssignmentRequest) -> CanaryAssignment:
        state = self.current(request.route)
        bucket = deterministic_bucket(request.route, request.subject_key)
        current = max(0, min(100, int(state.current_percent)))
        status = state.status
        if status in TERMINAL_DISABLED_STATUSES:
            route_to_python = False
            shadow = False
            reason = "rollout-rollback" if status == "rollback" else "rollout-disabled"
        elif status in PAUSED_STATUSES:
            route_to_python = False
            shadow = True
            reason = "rollout-paused"
        elif current <= 0:
            route_to_python = False
            shadow = True
            reason = "shadow-only"
        else:
            route_to_python = bucket < current
            shadow = not route_to_python
            reason = "canary-selected" if route_to_python else "canary-not-selected"
        return CanaryAssignment(
            route=request.route,
            subjectKey=request.subject_key,
            organizationId=request.organization_id,
            actorUserId=request.actor_user_id,
            jobType=request.job_type,
            bucket=bucket,
            canaryPercent=current,
            routeToPython=route_to_python,
            shadowMode=shadow,
            reason=reason,
        )

    def audit(self, limit: int = 50) -> dict[str, Any]:
        with self._lock:
            events = list(reversed(self._audit[-max(1, min(limit, 200)) :]))
        return {"events": events, "count": len(events)}

    def _transition(self, route: str, action: CanaryRolloutAction, status: str, event: str) -> CanaryRolloutState:
        state = self.current(route)
        now = utc_now_iso()
        updated = state.copy(deep=True)
        updated.status = status
        updated.updated_at = now
        updated.updated_by = action.actor_user_id
        updated.reason = action.reason
        updated.dry_run = action.dry_run
        updated.next_percent = next_stage(updated.current_percent, updated.target_percent, updated.stage_percents)
        updated.history = [*updated.history, self._audit_event(event, action.actor_user_id, action.reason, now, dry_run=action.dry_run, current=updated.current_percent, target=updated.target_percent)]
        if not action.dry_run:
            self._save(updated)
        return updated

    def _audit_event(self, event: str, actor: str | None, reason: str, at: str, **extra: Any) -> dict[str, Any]:
        item = {"event": event, "actorUserId": actor, "reason": reason, "at": at, **extra}
        with self._lock:
            self._audit.append(item)
            self._audit = self._audit[-500:]
        return item

    def _save(self, state: CanaryRolloutState) -> None:
        with self._lock:
            self._states[state.route] = state
        self._write_all()

    def _state_path(self) -> Path:
        return get_settings().rollout_state_file

    def _delete_state_file(self) -> None:
        try:
            self._state_path().unlink(missing_ok=True)
        except Exception:
            return

    def _load(self, route: str) -> CanaryRolloutState | None:
        path = self._state_path()
        try:
            if not path.exists():
                return None
            payload = json.loads(path.read_text(encoding="utf-8"))
            states = payload.get("states", {})
            raw = states.get(route)
            if raw is None:
                return None
            state = model_validate(CanaryRolloutState, raw)
            with self._lock:
                self._states[route] = state
                self._audit = list(payload.get("audit", []))[-500:]
            return state
        except Exception:
            return None

    def _write_all(self) -> None:
        path = self._state_path()
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            with self._lock:
                payload = {
                    "states": {route: model_dump(state, by_alias=True, mode="json") for route, state in self._states.items()},
                    "audit": list(self._audit[-500:]),
                }
            path.write_text(json.dumps(payload, sort_keys=True, indent=2, default=str), encoding="utf-8")
        except Exception:
            return


rollout_store = RolloutStore()
