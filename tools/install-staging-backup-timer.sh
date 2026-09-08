#!/bin/sh
set -eu

if [ "$(id -u)" -ne 0 ]; then
  echo "Execute como root." >&2
  exit 1
fi

project_root=${STREAMOS_DEPLOY_ROOT:-/opt/streamos/current}
deploy_user=${STREAMOS_DEPLOY_USER:-streamos}
test -f "$project_root/tools/backup-staging.sh"
test -f "$project_root/tools/verify-staging-backup.sh"
test -f "$project_root/.env.staging"

cat > /etc/systemd/system/streamos-backup.service <<EOF
[Unit]
Description=Backup verificado do StreamOS staging
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
User=$deploy_user
WorkingDirectory=$project_root
Environment=STAGING_ENV_FILE=$project_root/.env.staging
ExecStart=/bin/sh $project_root/tools/backup-staging.sh
ExecStartPost=/bin/sh $project_root/tools/verify-staging-backup.sh
EOF

cat > /etc/systemd/system/streamos-backup.timer <<'EOF'
[Unit]
Description=Backup diario do StreamOS staging

[Timer]
OnCalendar=*-*-* 04:15:00
Persistent=true
RandomizedDelaySec=10m

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now streamos-backup.timer
systemctl list-timers streamos-backup.timer --no-pager
