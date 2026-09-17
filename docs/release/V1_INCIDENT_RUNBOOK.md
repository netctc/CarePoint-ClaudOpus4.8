# CarePoint v1 Pilot Incident Runbook

Status: release-controlled. This runbook supports issue #19 and must be exercised in real staging before #21 Go/No-Go.

## 1. Required pilot ownership

The following values must be assigned outside source control before pilot activation. Do not place credentials, tokens, patient data, or private contact details in this file.

- Incident commander: **TBD — required before Go/No-Go**
- Technical responder: **TBD — required before Go/No-Go**
- Clinical/business escalation owner: **TBD — required before Go/No-Go**
- Primary incident channel: **TBD — required before Go/No-Go**
- External monitoring destination: **TBD — required before Go/No-Go**

Any `TBD` above is a release blocker for #19/#21.

## 2. Severity model

### P0 — critical

Use P0 for complete pilot outage, confirmed cross-organization exposure, confirmed secret/clinical-data disclosure, database corruption/data loss, or an authentication/authorization bypass affecting privileged access.

Target behavior: stop pilot traffic or affected capability immediately, preserve evidence, begin rollback/containment, and escalate to all assigned owners.

### P1 — major

Use P1 for severe degradation of a critical workflow, repeated 5xx on login/booking/provider workflows, sustained readiness failure with partial service, failed critical worker processing, or an included external integration outage without safe degradation.

Target behavior: contain the affected workflow, diagnose quickly, rollback if mitigation is not clearly lower-risk, and keep pilot owners informed.

### P2 — minor

Use P2 for non-critical defects with a safe workaround, isolated UI issues, or operational warnings that do not threaten security, data integrity, or the critical pilot path.

Target behavior: record, triage, and schedule remediation without destabilizing the release candidate.

## 3. Detection sources

Minimum signals:

- Public HTTPS checks for API, Admin, Provider, Patient Web, and Provider Mobile Web.
- API `/livez` and `/readyz`.
- `deploy/vps/health-report.sh` for container state/health, restart count, OOM state, host memory and root-disk pressure.
- External uptime/alert destination configured for the pilot.
- Centralized service logs for API, Caddy/web surfaces, PostgreSQL/Redis, Python worker API and Celery worker.
- Provider/integration-specific monitoring for every integration explicitly declared IN for v1.

The health report must never dump runtime environment variables or credentials.

## 4. First 10 minutes

1. Record UTC detection time, affected surface, alert source and current release SHA.
2. Classify P0/P1/P2 using the definitions above.
3. Run `deploy/vps/health-report.sh`; attach only its sanitized output to the incident record.
4. Check `/livez` and `/readyz`; distinguish process availability from dependency readiness.
5. Check container state, restart count, OOM signal, host memory and disk pressure.
6. Identify the smallest affected boundary: edge/TLS, API, PostgreSQL, Redis, worker, portal, or external integration.
7. Do not paste `.env`, tokens, cookies, authorization headers, full clinical records, or request bodies into chat/issues/log notes.
8. If security/data isolation is suspected, treat as P0 and stop the affected pilot path before deeper debugging.

## 5. Component triage

### API / edge

- Confirm Caddy/edge and API containers are running.
- Compare `/livez` with `/readyz`.
- Review recent 5xx/status trends. Production access logs intentionally omit URL/query strings to reduce PHI/PII exposure.
- If a new release introduced the failure, prefer the pinned rollback procedure over ad-hoc production edits.

### PostgreSQL

- Confirm container health and disk pressure.
- Do not run destructive repair commands during triage.
- Before restore/recovery exercises, use the #14 backup/restore procedure and an isolated restore target.
- Escalate any suspected corruption/data loss as P0.

### Redis

- Confirm health and host `vm.overcommit_memory=1`.
- Determine whether the failure affects sessions/auth challenges, queues, or cached state.
- Restart only after recording current symptoms and release SHA.

### Python worker / Celery

- Confirm both worker API and Celery service state.
- Check failed/retried jobs without logging clinical payloads.
- If queue processing is unsafe, pause the affected feature rather than replaying unknown jobs blindly.

### External integration

- Confirm the integration is explicitly IN for the pilot.
- If it is OUT, the application must fail closed/explicitly rather than simulate success.
- If IN and unavailable, verify safe degradation and no partial/corrupt write before retrying.

## 6. Containment and rollback

Use the repository rollback helper for release regression recovery. The rollback must remain pinned to an approved prior SHA/tag and must preserve the pre-rollback database backup required by the helper.

Rollback is preferred when:

- a new release causes repeated critical 5xx/readiness failures;
- authorization/authentication behavior is uncertain;
- data integrity cannot be established quickly;
- mitigation would require an unreviewed production-only code/config edit.

After rollback, run the health reporter and critical smoke/E2E checks before reopening pilot traffic.

## 7. Security and privacy handling

Never include in operational logs/incident notes:

- passwords, refresh/access tokens, cookies or API keys;
- runtime environment dumps;
- complete medical/clinical records or uploaded documents;
- unnecessary patient/provider identifiers or search query contents.

If a secret may have been exposed, treat it as compromised and rotate/revoke through #11 procedures. If cross-organization or clinical-data exposure is suspected, classify P0 and preserve audit evidence without copying the exposed data into the incident record.

## 8. Recovery criteria

An incident may move to recovered only when:

- required public surfaces and `/readyz` are healthy;
- critical containers are running/healthy with no unexplained OOM/restart loop;
- critical pilot workflow smoke checks pass;
- no ongoing cross-organization/security concern remains;
- data persistence/integrity is confirmed where writes were involved;
- monitoring shows the condition has cleared.

## 9. Required alert exercise before Go/No-Go

Execute at least one end-to-end critical alert test in real staging and record, outside secrets/PHI:

- UTC trigger time;
- trigger condition;
- monitoring system/destination;
- UTC receive time;
- time-to-detection;
- responder/owner acknowledgment;
- recovery/clear time.

#19 remains open until this exercise, centralized log handling, monitoring destination, owner and incident channel are real and evidenced.
