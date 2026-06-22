from __future__ import annotations

from typing import Any

from .models import CanaryGateDecision


def evaluate_canary_gate(
    *,
    job_summary: dict[str, Any],
    comparison_summary: dict[str, Any],
    max_mismatch_rate: float,
    max_failed_jobs: int,
    min_comparisons: int,
) -> CanaryGateDecision:
    reasons: list[str] = []
    failed_jobs = int(job_summary.get("failedJobs") or 0)
    total_comparisons = int(comparison_summary.get("totalComparisons") or 0)
    mismatch_rate = float(comparison_summary.get("mismatchRate") or 0)

    if failed_jobs > max_failed_jobs:
        reasons.append(f"failedJobs {failed_jobs} exceeds threshold {max_failed_jobs}")
    if mismatch_rate > max_mismatch_rate:
        reasons.append(f"mismatchRate {mismatch_rate:.4f} exceeds threshold {max_mismatch_rate:.4f}")

    if reasons:
        recommendation = "rollback"
        allowed = False
    elif total_comparisons < min_comparisons:
        recommendation = "hold"
        allowed = False
        reasons.append(f"insufficient shadow comparisons {total_comparisons}/{min_comparisons}")
    else:
        recommendation = "advance"
        allowed = True
        reasons.append("all canary thresholds passed")

    return CanaryGateDecision(
        allowed=allowed,
        recommendation=recommendation,
        reasons=reasons,
        jobSummary=job_summary,
        comparisonSummary=comparison_summary,
        thresholds={
            "maxMismatchRate": max_mismatch_rate,
            "maxFailedJobs": max_failed_jobs,
            "minComparisons": min_comparisons,
        },
    )
