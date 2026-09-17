# CarePoint v1 — Staging Activation Runbook

## Purpose

This runbook activates the `release/v1-go-live` candidate on a single staging VPS using the repository deployment stack. It contains variable names and operating steps only. Secret values must remain in the approved runtime secret/config channel and must never be copied into git, issues, PR comments, screenshots, or documentation.

## Release invariants

- Deploy only the exact 40-character SHA approved for the release candidate.
- `release/v1-go-live` must point to that SHA and GitHub CI must be green for the same SHA.
- Public ingress is limited to TCP 22, TCP 80, TCP 443 and UDP 443 where HTTP/3 is allowed.
- PostgreSQL, Redis, API, web applications and Python worker ports are not directly published to the public host interface.
- Public traffic terminates at Caddy and uses HTTPS.
- `NODE_ENV=production`.
- `ALLOW_LOCALHOST_CORS_WILDCARD=false`.
- `ALLOW_AUDIT_FALLBACK_IN_PRODUCTION=false`.
- `NEXT_PUBLIC_ALLOW_DEMO_SIGNIN=false`.

## Public endpoint inventory

Five DNS records are required and must resolve to the staging ingress before deployment:

| Variable | Purpose | Public route |
| --- | --- | --- |
| `CAREPOINT_API_HOST` | API | `https://<api-host>` |
| `CAREPOINT_ADMIN_HOST` | Admin portal | `https://<admin-host>` |
| `CAREPOINT_PROVIDER_HOST` | Provider portal | `https://<provider-host>` |
| `CAREPOINT_PATIENT_HOST` | Patient web | `https://<patient-host>` |
| `CAREPOINT_PROVIDER_MOBILE_HOST` | Provider mobile web | `https://<provider-mobile-host>` |

`ACME_EMAIL` is required for certificate operations. DNS must be live before the deployment preflight is allowed to pass.

## Required secret/config names

The deployment requires the following sensitive runtime values. Values are intentionally omitted here:

- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `MEDICAL_PROFILE_ENCRYPTION_KEY`
- `PYTHON_SERVICES_SHARED_SECRET`
- Provider credentials that are enabled for the release scope, such as email/SMS, payments, telehealth or SSO credentials.

First installation can generate the six core platform secrets locally on the server. Subsequent deploys preserve them. Rotation is a separate controlled operation; never rotate the medical encryption key implicitly.

## Non-secret deployment inputs

Pass these values to `deploy/vps/deploy.sh` through the operator environment:

- `EXPECTED_RELEASE_SHA`
- `CAREPOINT_BRANCH` — normally `release/v1-go-live`
- `CAREPOINT_API_HOST`
- `CAREPOINT_ADMIN_HOST`
- `CAREPOINT_PROVIDER_HOST`
- `CAREPOINT_PATIENT_HOST`
- `CAREPOINT_PROVIDER_MOBILE_HOST`
- `ACME_EMAIL`
- Optional `INSTALL_DIR` and `REPO_URL`

The script reconciles public HTTPS URLs and strict release flags on every deploy without printing or replacing existing secrets.

## Host preparation

1. Use a supported Linux VPS with persistent disk.
2. Ensure DNS for all five public hosts resolves before deployment.
3. Allow inbound SSH and HTTPS edge traffic only. Provider/cloud firewall rules should match the host firewall policy.
4. Ensure outbound HTTPS and DNS are available for image pulls, GitHub access and ACME certificate issuance.
5. Ensure sufficient disk exists for PostgreSQL, Redis AOF, container images, Caddy certificates and worker artifacts.
6. Ensure the operating owner has an external backup destination before production promotion.

The deployment script sets `vm.overcommit_memory=1`, which Redis requires for reliable background persistence under memory pressure.

## Deployment procedure

1. Select the exact release SHA after CI is green.
2. Set the non-secret deployment inputs listed above in the operator session.
3. Run `deploy/vps/deploy.sh` as root on the staging VPS.
4. The script checks out the release branch, requires an exact SHA match and a clean worktree.
5. `deploy/vps/preflight.sh` validates DNS, HTTPS configuration, strict security flags, required secret presence/length and `docker compose config` before firewall or container changes.
6. The script builds the pinned source, starts the stack, waits for API health and verifies all five public HTTPS endpoints.

Do not override or bypass a failed preflight. Correct the underlying release configuration and rerun from the same approved SHA, or approve a new SHA through CI.

## Acceptance checks

The staging gate is not complete until all of the following are recorded against issue #12 without secret values:

- Exact deployed SHA.
- GitHub CI run for that SHA is green.
- All five DNS names resolve and serve HTTPS with trusted certificates.
- `/livez` and `/readyz` on the API return success through the public TLS endpoint.
- Admin, Provider, Patient and Provider Mobile Web load over HTTPS.
- PostgreSQL and Redis have no host-level public port publishing.
- Data written to PostgreSQL survives an application-container restart.
- Redis persistence survives a Redis-container restart where expected by the release scope.
- Provider/cloud firewall exposes no direct application/database/cache ports.
- Runtime secret/config file on the host is permission-restricted and is not committed.
- No default credentials are used.

## Evidence to capture

Capture only non-sensitive evidence:

- release SHA and CI URL/run ID;
- DNS names and certificate issuer/expiry;
- `docker compose ps` with service health, without environment dumps;
- firewall/security-group rule summary;
- API `/livez` and `/readyz` results;
- restart/persistence test result;
- backup timestamp and restore-rehearsal reference once that gate is executed.

Never attach runtime environment dumps, database URLs containing credentials, tokens, private keys, session cookies, PHI or patient records.

## Remaining external actions for #11 and #12

Repository-side controls can enforce secure defaults, but these actions require the actual staging/provider accounts:

- revoke/rotate any historical or previously exposed real credentials;
- load current provider credentials into the approved runtime secret channel;
- create/update the five DNS records;
- provision the VPS/provider firewall and persistent storage;
- execute the deployment on the actual host;
- record persistence and TLS evidence.

Until those external actions are evidenced, #11 and #12 remain open P0 gates.
