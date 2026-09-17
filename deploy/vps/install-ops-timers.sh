#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "OPS TIMER INSTALL FAILED: run as root" >&2
  exit 1
fi

INSTALL_DIR="${INSTALL_DIR:-/opt/carepoint}"
BACKUP_ON_CALENDAR="${BACKUP_ON_CALENDAR:-*-*-* 02:15:00}"
HEALTH_INTERVAL_SECONDS="${HEALTH_INTERVAL_SECONDS:-300}"

fail() {
  echo "OPS TIMER INSTALL FAILED: $*" >&2
  exit 1
}

[[ "$INSTALL_DIR" != *[[:space:]]* ]] || fail "INSTALL_DIR cannot contain whitespace for systemd unit generation"
[[ "$HEALTH_INTERVAL_SECONDS" =~ ^[0-9]+$ ]] || fail "HEALTH_INTERVAL_SECONDS must be an integer"
[ "$HEALTH_INTERVAL_SECONDS" -ge 60 ] || fail "HEALTH_INTERVAL_SECONDS must be at least 60"
[ -f "${INSTALL_DIR}/deploy/vps/backup-postgres.sh" ] || fail "backup helper is missing"
[ -f "${INSTALL_DIR}/deploy/vps/health-report.sh" ] || fail "health helper is missing"
command -v systemctl >/dev/null 2>&1 || fail "systemctl is required"

cat > /etc/systemd/system/carepoint-postgres-backup.service <<EOF
[Unit]
Description=CarePoint PostgreSQL backup
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
Environment=INSTALL_DIR=${INSTALL_DIR}
ExecStart=/bin/bash ${INSTALL_DIR}/deploy/vps/backup-postgres.sh
PrivateTmp=true
NoNewPrivileges=true
EOF

cat > /etc/systemd/system/carepoint-postgres-backup.timer <<EOF
[Unit]
Description=Run CarePoint PostgreSQL backup on schedule

[Timer]
OnCalendar=${BACKUP_ON_CALENDAR}
Persistent=true
RandomizedDelaySec=5m
Unit=carepoint-postgres-backup.service

[Install]
WantedBy=timers.target
EOF

cat > /etc/systemd/system/carepoint-health.service <<EOF
[Unit]
Description=CarePoint release health verification
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
Environment=INSTALL_DIR=${INSTALL_DIR}
ExecStart=/bin/bash ${INSTALL_DIR}/deploy/vps/health-report.sh
PrivateTmp=true
NoNewPrivileges=true
EOF

cat > /etc/systemd/system/carepoint-health.timer <<EOF
[Unit]
Description=Run CarePoint release health verification periodically

[Timer]
OnBootSec=2m
OnUnitActiveSec=${HEALTH_INTERVAL_SECONDS}s
Persistent=true
Unit=carepoint-health.service

[Install]
WantedBy=timers.target
EOF

chmod 644 \
  /etc/systemd/system/carepoint-postgres-backup.service \
  /etc/systemd/system/carepoint-postgres-backup.timer \
  /etc/systemd/system/carepoint-health.service \
  /etc/systemd/system/carepoint-health.timer

systemctl daemon-reload
systemctl enable --now carepoint-postgres-backup.timer carepoint-health.timer

# Validate unit syntax/config without exposing runtime secrets.
systemd-analyze verify \
  /etc/systemd/system/carepoint-postgres-backup.service \
  /etc/systemd/system/carepoint-postgres-backup.timer \
  /etc/systemd/system/carepoint-health.service \
  /etc/systemd/system/carepoint-health.timer >/dev/null

echo "CarePoint operations timers installed."
systemctl list-timers --all carepoint-postgres-backup.timer carepoint-health.timer --no-pager
