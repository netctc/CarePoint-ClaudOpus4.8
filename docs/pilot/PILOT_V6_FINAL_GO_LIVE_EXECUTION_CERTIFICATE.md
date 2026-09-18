# PILOT-V6 Final Go-Live Execution Certificate

## Purpose

This document is the formal CarePoint v1 Go/No-Go decision record for release gate #21. It **does not** certify that the controlled pilot is complete merely because the document exists.

The record is intentionally fail-closed. Until every required P0 gate has real operational evidence, all critical owners are named, the final deployed SHA is immutable and green, and the decision table is completed, the release status remains:

**Current status: PENDING / NO-GO BY DEFAULT**

Historical QA/UAT or pilot-planning artifacts may support this decision, but they cannot substitute for the real staging, provider, recovery, monitoring, resilience and cutover evidence required by the active v1 release backlog.

## Mandatory gate state

A GO decision is invalid unless all of the following are true at the decision time:

- #10 — baseline / full CI: CLOSED.
- #11 — real secret revocation/rotation and production security configuration: CLOSED.
- #12 — real staging infrastructure, DNS, TLS, PostgreSQL and Redis: CLOSED.
- #13 — exact release candidate deployed to staging with migrations/readiness validated: CLOSED.
- #14 — backup timer, off-host copy and isolated restore drill with measured RPO/RTO: CLOSED.
- #15 — Admin/Patient/Provider critical E2E on real staging: CLOSED.
- #16 — authorization, organization isolation, audit/log review and privileged-session cutover evidence: CLOSED.
- #17 — Email OTP IN validated with the real provider; SMS/Daily/Stripe/SSO OUT verified fail-closed: CLOSED.
- #18 — Patient/Provider Mobile regression gate: CLOSED, or an explicit approved web-only deferral exists. The current v1 release branch has #18 closed.
- #19 — external monitoring/alert delivery, centralized logging, named incident ownership and alert exercise: CLOSED.
- #20 — real staging performance, resilience and rollback exercise: CLOSED.
- #26 — runtime image security scan/remediation complete; any residual HIGH/CRITICAL finding is unfixable at decision time and has explicit accountable Go/No-Go acceptance: CLOSED.

No open P0 is compatible with GO.

## Immutable release identity

Before the decision, record all of the following and ensure they refer to the same release:

- final 40-character Git SHA;
- green CarePoint CI run number/reference for that SHA;
- deployed environment;
- immutable image/tag references where applicable;
- staging/prod deployment evidence showing the same SHA;
- database backup/restore evidence tied to the release window;
- rollback target SHA/image/tag.

A branch name alone is not an immutable release identity.

## Runtime security exception requirement

A residual runtime-image vulnerability is **not** accepted merely because the scanner reports it as `unfixed`. Before #26 can close through an exception rather than remediation, every accepted finding or tightly scoped finding group must record:

- CVE/finding identifier and affected runtime surface/package;
- scanner evidence tied to the exact release SHA/image digest;
- why the finding is not currently remediable and its relevant exploitability/exposure in the CarePoint deployment;
- compensating mitigation and rollback/containment action;
- accountable security/release owner;
- target remediation date and mandatory review date;
- explicit Go/No-Go approval reference.

A `TBD`, blanket “accept all unfixed findings”, missing owner/date, or an exception not tied to the exact release SHA is invalid. Until these requirements are complete, #26 remains open and the decision remains NO-GO by default.

## Privileged cutover requirement

Before privileged pilot access is opened:

1. Run `deploy/vps/revoke-privileged-sessions.sh` in dry-run mode and record only non-sensitive counts.
2. During the approved cutover window, run the explicit confirmed revocation.
3. Verify the script reports zero active privileged refresh tokens.
4. Wait at least one configured access-token TTL before opening privileged pilot access, because existing access tokens are not stored server-side for immediate revocation.
5. Execute the #16 synthetic Admin/Provider Org A/Org B matrix after the cutover and confirm audit/log behavior.

Never record tokens, cookies, credentials, OTP values, private keys or real patient identifiers as evidence.

## Decision record

All critical `TBD` fields below are blockers while this certificate is pending. They must be replaced with real non-sensitive values before GO.

| Field | Value |
| --- | --- |
| Decision | PENDING — allowed final values: GO / NO-GO / HOLD / ROLLBACK |
| Decision owner | TBD — required before GO |
| Release owner | TBD — required before GO |
| Support owner | TBD — required before GO |
| Pilot owner | TBD — required before GO |
| Incident owner | TBD — required before GO |
| Recovery owner | TBD — required before GO |
| Environment | TBD — required before GO |
| Decision date/time UTC | TBD — required before GO |
| Final release SHA | TBD — required before GO |
| Green CI run | TBD — required before GO |
| Deployed image/tag references | TBD — required before GO |
| Rollback target | TBD — required before GO |
| Initial cohort | TBD — required before GO |
| Expansion criteria | TBD — required before GO |
| Rollback criteria | TBD — required before GO |
| Open P1 waivers | TBD — list issue + owner + mitigation, or NONE |
| Accepted residual risks | TBD — for each accepted item/group list CVE/finding + surface/package + exploitability rationale + mitigation + owner + target/review date + approval reference, or NONE |
| #14 recovery evidence | PENDING |
| #15 E2E evidence | PENDING |
| #16 authorization/audit evidence | PENDING |
| #17 integration evidence | PENDING |
| #19 observability evidence | PENDING |
| #20 resilience/rollback evidence | PENDING |
| #26 runtime security evidence / exception approval | PENDING |
| Privileged-session revocation | PENDING |
| Access-token TTL wait completed | PENDING |
| Signature/approval reference | TBD — required before GO |

## Go/No-Go checklist

Before changing `Decision` to `GO`, the decision owner must confirm:

- [ ] Every mandatory P0 gate listed above is closed with real evidence.
- [ ] There are no open P0 issues in the v1 release backlog.
- [ ] The final SHA is exact, immutable, deployed and green in CI.
- [ ] No critical decision/owner/environment/release field remains `TBD` or `PENDING`.
- [ ] Any accepted P1 has an owner, mitigation and review date.
- [ ] Recovery owners, incident owners and support escalation paths are active.
- [ ] Backup/restore evidence meets the approved RPO/RTO objectives.
- [ ] Critical E2E, tenant isolation, integrations and alert delivery all passed on the deployed release.
- [ ] The real rollback exercise passed and the rollback target is still available.
- [ ] #26 is closed: all fixable HIGH/CRITICAL runtime findings are remediated, and every accepted residual unfixable finding has the required scoped exception evidence and explicit approval.
- [ ] Privileged refresh sessions were revoked and the access-token TTL wait completed.
- [ ] Initial cohort size, expansion criteria and rollback criteria are explicit.
- [ ] Hypercare coverage and the Day-0/Day-1 review cadence are active.

If any item is false, the allowed decision is `HOLD`, `NO-GO` or `ROLLBACK`, not GO.

## Day-0 / Day-1 decision evidence

After a GO decision, record non-sensitive pilot evidence in the controlled operations record:

- pilot start UTC;
- cohort size and roles;
- health/readiness status;
- alert delivery status;
- unexplained 5xx count;
- security/audit exceptions;
- support incidents by severity;
- rollback triggers observed, if any;
- Day-1 decision: continue cohort / hold expansion / expand / rollback.

Do not use this section to store PHI, secrets, session data, provider payloads or patient-level operational detail.

## Certification statement

This certificate authorizes **nothing** while its status is `PENDING / NO-GO BY DEFAULT` or while any mandatory P0 gate is open. The controlled CarePoint v1 pilot becomes authorized only after an accountable decision owner completes this record with real evidence and records an explicit GO decision that satisfies every gate above.

Until then, Phase 4 / controlled go-live remains operationally open.
