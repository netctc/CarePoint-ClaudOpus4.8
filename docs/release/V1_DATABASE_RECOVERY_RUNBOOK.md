# CarePoint v1 — PostgreSQL Recovery Runbook

## Purpose

This runbook is the operational procedure for release gate #14. It turns the repository backup/restore helpers into a repeatable recovery drill for the staging/pilot database.

Repository tooling is necessary but does not prove recoverability. #14 remains open until the backup timer is active on the real staging host, an off-host copy exists, and a real isolated restore drill has been completed and evidenced.

Never paste database URLs, passwords, environment files, dump contents, patient records, tokens, or private keys into GitHub issues, PRs, screenshots, or this document.

## Initial pilot recovery objectives

The v1 pilot starts with these conservative objectives:

- **RPO target: <= 24 hours.** The default backup timer runs once per day. An off-host copy must complete successfully after each local backup for this target to be meaningful.
- **RTO target: <= 4 hours.** Measure from declaration of database recovery through a restored database, integrity validation, application readiness, and operator sign-off.
- **Recovery owner: TBD — required before Go/No-Go.** A named primary owner and backup owner must be recorded in the controlled operations channel before #21.

These are release objectives, not guarantees. The restore drill must record the observed RPO/RTO. If the observed values miss the objectives, #14 remains open and the schedule/process must be corrected before Go/No-Go.

## Repository controls

The release branch provides:

- `deploy/vps/backup-postgres.sh` — custom-format `pg_dump`, archive validation, SHA-256 metadata, protected local files, and local retention cleanup.
- `deploy/vps/restore-postgres.sh` — isolated restore by default, archive validation, refusal to overwrite the live database unless explicitly overridden, `_prisma_migrations` verification, and public-table verification.
- `deploy/vps/install-ops-timers.sh` — installs/enables the PostgreSQL backup timer and health timer.

The backup helper defaults to `RETENTION_DAYS=14`. Local retention is not a substitute for an off-host copy.

## Required preconditions

Do not start the drill until all are true:

1. #12 staging infrastructure is operational.
2. The exact deployed SHA is recorded and its CI is green.
3. The PostgreSQL persistent volume is healthy.
4. The runtime config file exists on the host with restricted permissions.
5. An approved off-host backup destination is configured outside the staging VPS/provider failure domain.
6. The recovery owner and backup owner are named in the controlled operations channel.
7. Synthetic staging records exist for at least one organization, user, appointment, and medical record so integrity can be checked without real PHI.

## Activate automated backups

From the staging host, using the approved operator environment and without printing secret values:

```bash
sudo INSTALL_DIR=/opt/carepoint \
  BACKUP_ON_CALENDAR='*-*-* 02:15:00' \
  /opt/carepoint/deploy/vps/install-ops-timers.sh

systemctl is-enabled carepoint-postgres-backup.timer
systemctl is-active carepoint-postgres-backup.timer
systemctl list-timers --all carepoint-postgres-backup.timer --no-pager
```

The timer must show enabled/active and a next-run time. Record only non-sensitive timer status.

## Create the release backup

Run one manual backup immediately before the restore rehearsal:

```bash
sudo INSTALL_DIR=/opt/carepoint \
  RETENTION_DAYS=14 \
  /opt/carepoint/deploy/vps/backup-postgres.sh
```

Record from the command output/metadata only:

- UTC creation time;
- release SHA;
- backup filename (not contents);
- size in bytes;
- SHA-256 checksum;
- configured retention window;
- backup duration measured by the operator.

Do not attach the dump file to GitHub.

## Verify the off-host copy

Copy the completed `.dump` and its `.meta` file to the approved off-host destination using the organization's secure backup mechanism. The destination must not rely on the same VPS disk or the same single-host failure domain.

Record only:

- destination class/provider, not credentials or signed URLs;
- object/reference identifier if non-sensitive;
- copy completion timestamp;
- checksum comparison result;
- retention policy;
- encryption-at-rest status as reported by the backup provider.

The checksum of the off-host copy must match the local SHA-256 metadata before the local file is considered protected.

## Isolated restore drill

Never restore the rehearsal over the live staging database. Use the helper's isolated default database:

```bash
sudo INSTALL_DIR=/opt/carepoint \
  BACKUP_FILE=/var/backups/carepoint/postgres/<approved-backup>.dump \
  RESTORE_DATABASE=care_center_restore_drill \
  KEEP_RESTORE_DATABASE=true \
  /opt/carepoint/deploy/vps/restore-postgres.sh
```

`ALLOW_IN_PLACE_RESTORE` must remain unset/false for the drill.

The helper must complete with archive validation, a non-zero public-table count, and `_prisma_migrations` present.

## Integrity verification

With the isolated restore retained temporarily, validate counts for the synthetic release dataset. Prisma uses the quoted table names below:

```bash
docker compose -f /opt/carepoint/deploy/vps/docker-compose.yml \
  --env-file /opt/carepoint/deploy/vps/.env exec -T postgres \
  psql -U "$(grep '^POSTGRES_USER=' /opt/carepoint/deploy/vps/.env | tail -n1 | cut -d= -f2-)" \
  -d care_center_restore_drill -At -v ON_ERROR_STOP=1 \
  -c 'SELECT count(*) FROM "Organization"; SELECT count(*) FROM "User"; SELECT count(*) FROM "Appointment"; SELECT count(*) FROM "MedicalRecord";'
```

Do not paste row contents. Record counts only. At minimum, the synthetic organization/user/appointment/medical-record counts expected for the drill must be present.

Also record:

- latest `_prisma_migrations` entry exists;
- no restore errors occurred;
- the restored database was isolated from live application traffic.

## Cleanup

After evidence has been captured, remove the isolated drill database by rerunning the restore helper with the same backup and `KEEP_RESTORE_DATABASE=false`, or explicitly drop only `care_center_restore_drill` through the PostgreSQL container. Never target the live database name.

Verify normal staging readiness after cleanup:

```bash
curl --fail --silent --show-error "https://${CAREPOINT_API_HOST}/livez" >/dev/null
curl --fail --silent --show-error "https://${CAREPOINT_API_HOST}/readyz" >/dev/null
```

## RPO/RTO measurement

For the drill record:

- **Observed RPO:** restore-start time minus the backup's creation time. It must be <= 24 hours for the initial pilot objective.
- **Observed RTO:** time from the declared start of the restore drill until integrity validation and application readiness are both complete. It must be <= 4 hours for the initial pilot objective.

A fast `pg_restore` alone is not the RTO; validation and readiness are part of recovery.

## Evidence template for #14

Post only non-sensitive evidence:

```text
Release SHA: <40-char SHA>
CI run: <run number>
Backup timer enabled/active: PASS/FAIL
Backup UTC: <timestamp>
Backup size bytes: <number>
Backup SHA-256: <checksum>
Local retention days: <number>
Off-host copy: PASS/FAIL
Off-host checksum match: PASS/FAIL
Off-host retention: <policy summary>
Restore database: care_center_restore_drill
Archive validation: PASS/FAIL
Prisma migrations present: PASS/FAIL
Synthetic Organization count: <number>
Synthetic User count: <number>
Synthetic Appointment count: <number>
Synthetic MedicalRecord count: <number>
Observed RPO: <duration>
Observed RTO: <duration>
RPO <= 24h: PASS/FAIL
RTO <= 4h: PASS/FAIL
Primary recovery owner: <name/role in controlled ops channel>
Backup recovery owner: <name/role in controlled ops channel>
Final /livez + /readyz: PASS/FAIL
```

## Closure rule

#14 may close only when all of the following are evidenced on the real staging environment:

- automated backup timer is active;
- a release backup exists and validates;
- a checksum-matching off-host copy exists with defined retention;
- an isolated restore completes successfully;
- synthetic organization/user/appointment/medical-record integrity is verified;
- observed RPO/RTO meet the pilot objectives or an explicitly approved stricter replacement;
- primary and backup recovery owners are named;
- staging returns healthy/readiness after cleanup.

Repository CI or shell syntax checks cannot substitute for this real recovery exercise.
