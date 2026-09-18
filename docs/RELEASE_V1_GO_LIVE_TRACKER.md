# CarePoint v1 Go-Live — Execution Tracker

Branch: `release/v1-go-live`

Master GitHub tracker: #22

## Release rule

This branch is a release-hardening branch. Do not add new product scope unless it is required to close a P0/P1 release blocker.

## Gates in dependency order

1. #10 — P0 baseline and full CI green.
2. #11 — P0 rotate secrets and lock production security configuration.
3. #12 — P0 provision real staging, domains/TLS, PostgreSQL and Redis.
4. #13 — P0 deploy the release candidate and validate migrations/readiness.
5. #14 — P0 configure backups and complete a PostgreSQL restore drill.
6. #15 — P0 run critical end-to-end workflows in staging.
7. #16 — P0 verify authorization, organization isolation and audit behavior.
8. #17 — P0 validate in-scope external integrations or explicitly disable them.
9. #18 — P1 add minimal Patient/Provider Flutter smoke/widget tests.
10. #19 — P0 activate observability, alerts and incident runbook.
11. #20 — P0 run performance, resilience and rollback exercises.
12. #26 — P0 scan/remediate release runtime images; any residual unfixable HIGH/CRITICAL risk requires an explicit, accountable Go/No-Go exception.
13. #21 — P0 close Go/No-Go and execute the controlled pilot.

## Critical path

`#10 -> (#11 + #12) -> #13 -> (#14 + #15 + #16 + #17 + #19 + #26) -> #20 -> #21`

#18 may run in parallel and may be deferred only if v1 is explicitly web-only.

#26 repository scanning/remediation may run in parallel before staging, but it cannot close until any runtime changes that affect edge/static delivery are validated in staging and every residual HIGH/CRITICAL finding is either remediated or explicitly accepted under the #26 criteria.

## Go-Live policy

- No open P0 at launch, including #26.
- Any deferred P1 requires an owner, mitigation and documented decision.
- Any accepted residual runtime-security risk must identify the CVE/finding, affected surface, exploitability rationale, mitigation, accountable owner, target/review date and explicit approval reference.
- The final deployed SHA must match a green CI result.
- Do not commit credentials or secrets to git, docs or issues.
- Production configuration must use exact allowed origins and must not enable localhost CORS wildcard or audit fallback.
- Preserve the previous deployable image/tag and a verified database backup before promotion.

## Recommended v1 scope

- API
- Admin Web
- Provider Web
- Patient Web
- Provider Mobile Web
- PostgreSQL
- Redis
- Python workers required by in-scope flows

Native-store publication and non-critical enhancements can move to v1.1 if they delay the controlled web pilot.
