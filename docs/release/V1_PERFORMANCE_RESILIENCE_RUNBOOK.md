# CarePoint v1 Performance, Resilience and Rollback Drill

Status: staging-only execution pack for issue #20. Do not execute destructive portions against production or with real patient data.

## Preconditions

Do not start this drill until the staging deployment is pinned to the approved release SHA and the operational prerequisites from #14 and #19 are available.

Required before execution:

- exact deployed SHA recorded;
- staging backup completed and isolated restore drill already proven;
- external monitoring/alert destination active;
- incident owner/channel active;
- synthetic/test accounts only — no real PHI;
- Patient and Staff access credentials/tokens injected through the approved secret channel, never committed or pasted into issues;
- acceptance thresholds agreed **before** the load run.

## Acceptance values to decide before the run

Set all of these explicitly at execution time. Do not change them after seeing results just to make a run pass.

- `CAREPOINT_LOAD_MAX_P95_MS`: maximum accepted p95 latency in milliseconds.
- `CAREPOINT_LOAD_MAX_ERROR_RATE`: accepted fraction from `0` to `1` for HTTP 4xx/5xx plus transport failures.
- `CAREPOINT_LOAD_MAX_5XX`: maximum accepted 5xx count per scenario.
- `CAREPOINT_LOAD_DURATION_SECONDS`: representative pilot interval; default is 60 seconds.
- `CAREPOINT_LOAD_CONCURRENCY`: modest pilot concurrency; default is 4 and the harness caps it at 50.

The objective is controlled pilot confidence, not maximum-capacity benchmarking.

## Safe load harness

Use:

`node scripts/release/pilot-load.mjs`

The harness uses Node built-in `fetch` only and never prints bearer tokens, refresh tokens, request bodies, response bodies, or clinical data. It outputs aggregate counts, request rate, errors, 4xx/5xx and p50/p95/max latency.

Required target:

- `CAREPOINT_LOAD_BASE_URL` — trusted staging API HTTPS origin.

Scenarios are selected with `CAREPOINT_LOAD_SCENARIOS`, comma-separated:

- `health` — `/livez` + `/readyz`, no token.
- `find-care` — `GET /api/providers`, requires `CAREPOINT_LOAD_PATIENT_TOKEN`.
- `patient-dashboard` — `GET /api/dashboard/patient`, requires `CAREPOINT_LOAD_PATIENT_TOKEN`.
- `booking-summary` — `GET /api/bookings/summary`, requires `CAREPOINT_LOAD_STAFF_TOKEN` for an allowed staff role.
- `session-refresh` — `POST /api/auth/refresh`, requires `CAREPOINT_LOAD_REFRESH_TOKEN`.

Paths may be overridden through their named `CAREPOINT_LOAD_*_PATH` variables when staging routing differs. The script does not print path query strings or response content.

### Why privileged OTP login is not synthetic-load tested

CarePoint v1 privileged login deliberately sends a real email OTP. Repeated challenge creation would exercise the external mail provider, rate limits and user inboxes rather than just CarePoint application capacity, and could create avoidable operational noise. Validate privileged login end-to-end as part of #15/#16 with a small number of controlled attempts. For authentication pressure in the load profile, use `session-refresh` with a staging-only refresh token.

Patient OTP registration/sign-in should likewise remain a controlled E2E path, not a bulk benchmark.

## Suggested load sequence

1. Run `deploy/vps/health-report.sh` and record its sanitized output.
2. Run `health` alone to establish network/edge baseline.
3. Run `find-care,patient-dashboard` with a staging patient test token.
4. Run `booking-summary` with a staging staff test token.
5. Run `session-refresh` separately so authentication/session latency is visible rather than blended with reads.
6. Run the agreed mixed read profile for the initial pilot cohort.
7. Run `deploy/vps/health-report.sh` again; compare restart count, OOM state, memory and disk pressure.
8. Record UTC start/end, exact SHA, scenario names, concurrency, duration, pre-agreed thresholds and sanitized aggregate output in #20. Do not attach tokens or application response bodies.

## Controlled resilience exercises

Execute one change at a time and keep external monitoring active.

### API restart

- Record UTC start.
- Restart only the API service through Docker Compose on staging.
- Measure time until `/livez` and `/readyz` are healthy again.
- Confirm critical smoke/E2E checks after recovery.
- Check restart count in `health-report.sh`.

### Redis and worker recovery

- Record current queue/worker health without dumping job payloads.
- Restart Redis in a controlled staging window, then worker API/Celery as required by the exercise.
- Confirm auth challenge/session behavior fails safely during dependency loss and recovers afterward.
- Confirm no unexplained duplicate/corrupt processing.

### Included external integration failure

Only test integrations explicitly declared IN by #17.

- simulate or coordinate temporary unavailability through the provider-approved staging mechanism;
- confirm CarePoint surfaces an explicit failure/degraded state rather than fake success;
- confirm retry/recovery does not create duplicate writes;
- do not manipulate a real production provider account for this drill.

## Rollback drill

Use the existing pinned `deploy/vps/rollback-release.sh` procedure. Do not replace it with ad-hoc `git checkout` or manual container edits.

Required evidence:

- current SHA and rollback target SHA;
- validated pre-rollback PostgreSQL backup;
- UTC rollback start/end;
- health report after rollback;
- critical smoke/E2E results on the rollback target;
- measured recovery time;
- if returning to the candidate afterward, repeat pinned deployment + health verification.

## Pass criteria for #20

Repository tooling alone does not close #20. The issue can close only after real staging evidence shows:

- the agreed load profile meets the predeclared p95/error/5xx thresholds;
- controlled API/Redis/worker recovery is understood and does not reveal data-integrity problems;
- an IN integration fails safely and recovers, when applicable;
- rollback to the approved prior release is actually executed and measured;
- no unresolved P0 is found;
- all evidence is sanitized and references the exact tested SHA.
