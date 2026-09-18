# CarePoint v1 — Critical Staging E2E Runbook

Status: execution pack for issue #15. This document prepares the test sequence; it does **not** constitute staging evidence by itself.

## 1. Purpose

Validate the critical CarePoint v1 workflows against the real staging deployment and real staging dependencies using synthetic test identities/data only. The objective is to prove that the exact approved release SHA behaves correctly end-to-end, persists intended writes, fails safely on negative paths, and does not silently fall back to mock data.

## 2. Hard prerequisites

Do not start the E2E gate until all of the following are true:

- #13 has deployed the exact approved release SHA to the real staging environment.
- The deployed SHA exactly matches the current approved candidate recorded in PR #23 / tracker #22 and has a green CarePoint CI run.
- `/livez` and `/readyz` are green through the public staging HTTPS API origin.
- Admin, Provider, Patient and Provider Mobile Web staging surfaces load over trusted HTTPS.
- `ADMIN_ALLOW_MOCK_DATA=false`, `NEXT_PUBLIC_ALLOW_DEMO_SIGNIN=false`, `ALLOW_AUDIT_FALLBACK_IN_PRODUCTION=false` and strict CORS were validated by deployment preflight.
- #17 has an explicit IN/OUT decision for email, payments, telehealth, SMS and SSO.
- A real email provider is configured for v1 OTP/MFA delivery.
- Only synthetic test accounts and synthetic clinical/business data are used.
- Test operators know the incident/escalation path from `V1_INCIDENT_RUNBOOK.md`.

If any prerequisite is not met, stop and record the blocker rather than bypassing a release control.

## 3. Evidence and privacy rules

For every step record only:

- UTC start/end time;
- exact deployed SHA;
- surface/workflow name;
- synthetic actor label (for example `patient-a`, not an email address);
- expected result and observed result;
- HTTP status or UI outcome when useful;
- synthetic resource ID only when it is needed to prove persistence and does not encode personal data;
- PASS / FAIL / BLOCKED;
- related defect issue number for any P0/P1 finding.

Never attach or paste:

- passwords, OTP values, API keys, access/refresh tokens, cookies or authorization headers;
- `.env` or runtime environment dumps;
- real patient/provider identities;
- medical records, document contents, intake answers or message bodies;
- webhook payloads or provider secrets.

Screenshots must be reviewed/redacted before being attached to an issue.

## 4. Synthetic identity set

Prepare synthetic accounts through governed staging provisioning. Suggested labels:

| Label | Purpose |
| --- | --- |
| `super-admin` | global Admin workflow |
| `company-admin-a` | organization-scoped Admin workflow |
| `provider-a` | Provider workflow in Org A |
| `patient-a` | Patient workflow in Org A |
| `company-admin-b` | negative cross-org check support |
| `provider-b` / `patient-b` | optional Org B isolation support for #16 |

Do not put the actual credentials or email addresses in this document or GitHub issues.

## 5. Pre-run baseline

Before functional testing:

1. Record the exact deployed SHA and matching green CI run number.
2. Run `deploy/vps/health-report.sh` and retain only its sanitized output.
3. Confirm public `/livez` and `/readyz` are successful.
4. Confirm the four user-facing web surfaces load via HTTPS.
5. Confirm the #17 integration matrix is fixed for this run. Changing an integration from IN to OUT (or vice versa) invalidates affected E2E evidence and requires rerunning those paths.
6. Record the starting count/state of synthetic resources required to prove persistence, without copying clinical payloads.

## 6. Admin critical workflow

Use a synthetic privileged account and the governed privileged sign-in flow.

| Step | Expected result |
| --- | --- |
| Start privileged sign-in | Password alone does not create a session; email verification challenge is required. |
| Complete delivered email OTP | Session is created only after the valid challenge; Admin surface opens. |
| Open Admin dashboard | Live API-backed data loads; no mock/demo fallback is shown. |
| Open organizations | Organization list/detail is available according to role. |
| Open provider/user administration | Synthetic provider/user records are visible only within allowed scope. |
| Open patient/user lookup where exposed | Synthetic lookup succeeds only within authorized scope. |
| Perform one safe governed IAM action if required for the pilot | Change is persisted and audited; use a reversible synthetic action only. |
| Open audit surface | Corresponding audit activity is visible and attributable to the synthetic actor. |
| Refresh the browser | Session and persisted state behave as expected; no mock fallback appears. |

Any unexpected cross-organization visibility is P0 and the E2E run stops immediately for containment under #16.

## 7. Patient critical workflow

Use `patient-a` and synthetic booking/intake data.

| Step | Expected result |
| --- | --- |
| Request patient email OTP | Request is accepted without exposing whether unrelated accounts exist. |
| Complete delivered OTP | Patient session is established. |
| Reach Patient home | Live dashboard loads without mock data. |
| Open Find Care | Provider search returns only real staging data. |
| Search/select a provider | Provider profile and available service context load. |
| Select an available slot | Slot/hold behavior succeeds or gives an explicit business conflict; no placeholder success. |
| Complete intake | Synthetic intake data is accepted according to validation rules. |
| Upload/attach booking document only if required for the v1 path | Use a non-sensitive synthetic fixture; metadata persists. |
| Continue through review/payment gate according to #17 | IN integration is exercised for real staging; OUT integration degrades explicitly and does not fake success. |
| Create booking | Booking is persisted and a stable synthetic booking/appointment identifier is returned/displayed. |
| Refresh/reopen appointment | The created booking remains visible with the expected status. |

If a write appears successful but disappears after refresh, treat it as a P0/P1 persistence defect depending on impact; do not continue by recreating data repeatedly.

## 8. Provider critical workflow

Use `provider-a` and the synthetic appointment created or prepared for `patient-a`.

| Step | Expected result |
| --- | --- |
| Start privileged sign-in | Password-only session issuance is blocked; delivered email challenge is required. |
| Complete delivered email OTP | Provider session is created and Provider dashboard opens. |
| Open dashboard/calendar | Live schedule data loads. |
| Open queue/appointment | Synthetic appointment is visible to the assigned/authorized provider. |
| Open patient context/chart | Only the authorized synthetic patient/subject context is visible. |
| Create/update encounter context when part of pilot workflow | Write persists without leaking data to another organization. |
| Create order and/or prescription when applicable | Synthetic order/prescription persists and appears on the expected downstream surface. |
| Refresh/reopen the resource | Persisted state remains consistent. |

Do not create real prescriptions, orders, lab requests or clinical instructions for a real person during staging validation.

## 9. Integration-conditional workflow

The #17 matrix is authoritative for the current run.

### Email — required for current v1 authentication

Email delivery is operationally required because Patient OTP and privileged verification use real delivered email. Confirm controlled delivery for the synthetic Patient and one privileged user without recording the OTP value.

### Telehealth

- If #17 marks telehealth **IN**, execute the real vendor-backed staging session flow, including room/session creation and controlled failure/recovery behavior.
- If #17 marks telehealth **OUT**, confirm the production-mode staging API/UI fails explicitly and does not generate or present a fake/placeholder successful session.

Current release hardening intentionally fails closed for production-mode telehealth until a real vendor adapter is declared ready; a later approved change may alter this behavior and must update #17/E2E evidence.

### Payments

- If **IN**, exercise the provider-approved staging/test payment flow and relevant callback/webhook without posting payload contents.
- If **OUT**, confirm booking remains within the documented pilot scope and no UI/API reports a fabricated successful charge.

### SMS and SSO

Exercise only when explicitly **IN**. Otherwise confirm the disabled/out-of-scope behavior does not block the critical v1 path.

## 10. Negative-path matrix

Run these against synthetic data after the happy paths are understood:

| Case | Expected result |
| --- | --- |
| No access token on protected endpoint | 401; no protected payload returned. |
| Valid token with insufficient role | 403 or intentionally non-enumerating 404 according to endpoint policy; no protected payload. |
| Org A scoped actor requests known Org B resource | no cross-org data; expected 403/404 according to endpoint policy. |
| Invalid request payload | 400-class validation response; no 5xx. |
| Non-existent resource | 404; no unrelated record data. |
| Revoked/invalid refresh token | authentication rejected; no new access token. |
| Account suspended/archived after session creation | refresh/challenge completion does not recreate an active session. |
| Privileged password-only login | rejected; no session cookie/token minted. |
| Telehealth OUT path, when OUT | explicit unavailable/degraded result, never placeholder success. |

Unexpected 5xx responses must be triaged. An unexplained 5xx on a critical path blocks #15 until understood and either corrected or explicitly proven non-release-impacting.

## 11. Persistence checks

At minimum prove persistence for the writes actually included in the pilot:

- booking/appointment created by `patient-a`;
- one governed Admin/IAM change when safely applicable;
- provider-side order/prescription/encounter write when applicable;
- audit entries expected from the tested privileged/admin actions.

Prove persistence by reloading/re-reading through the application/API, not by pasting database rows into GitHub.

A container restart persistence test belongs primarily to #12/#13/#14/#20; if one occurs during this E2E window, repeat the affected critical read/write check afterward and record the result.

## 12. Mock/fallback verification

The E2E run fails if a critical surface silently substitutes synthetic application fallback data for an unavailable backend.

Verify explicitly:

- Admin is running with `ADMIN_ALLOW_MOCK_DATA=false`;
- demo sign-in is disabled;
- production audit fallback is disabled;
- an unavailable critical API/integration produces a visible/controlled error state rather than a fake success.

Do not prove these flags by posting the runtime environment file. Use deployment/preflight evidence and observed behavior.

## 13. Evidence matrix template

Copy only this sanitized structure into #15 or the approved release evidence location:

| UTC | SHA | Flow | Synthetic actor | Result | Persistence/negative check | Defect |
| --- | --- | --- | --- | --- | --- | --- |
| `<time>` | `<40-char SHA>` | Admin / Patient / Provider / Negative / Integration | `<label>` | PASS/FAIL/BLOCKED | `<sanitized observation>` | `#<issue>` or `none` |

Also record:

- total critical flows passed / failed / blocked;
- count of unexplained 5xx (must be zero at closure);
- integration matrix revision/reference from #17;
- health-report reference before/after the run;
- any P0/P1 defects and their fix/retest SHA.

## 14. Completion criteria for #15

#15 may close only when real staging evidence against one exact green release candidate shows:

- Admin critical workflow passes;
- Patient authentication → Find Care → slot/intake/document → booking passes for the pilot scope;
- Provider login → calendar/appointment → patient context → applicable order/prescription path passes;
- every integration affecting those flows is handled according to the frozen #17 IN/OUT matrix;
- negative authorization/validation/session/resource cases fail safely;
- intended writes persist after reload/re-read;
- zero unexplained 5xx remain on critical paths;
- zero accidental mock/demo fallbacks are observed;
- every discovered P0/P1 has its own issue, fix and successful retest.

Repository CI, unit/integration tests, mobile widget tests and this runbook support the gate but cannot substitute for the real staging execution required by #15.
