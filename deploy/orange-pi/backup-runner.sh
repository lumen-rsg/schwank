#!/bin/sh
set -eu

server_directory=${SCHWANK_SERVER_DIR:-/home/orangepi/schwank-server}
service_name=${SCHWANK_SERVICE_NAME:-schwank}
health_url=${SCHWANK_HEALTH_URL:-http://127.0.0.1:3000/api/health}
backup_user=${SCHWANK_BACKUP_USER:-orangepi}
backup_recipient=${SCHWANK_BACKUP_RECIPIENT:-}
retention_days=${SCHWANK_BACKUP_RETENTION_DAYS:-30}
backup_script="$server_directory/deploy/orange-pi/encrypted-backup.sh"
service_stopped=0

restart_service() {
  if [ "$service_stopped" -eq 1 ]; then
    systemctl start "$service_name"
  fi
}
trap restart_service EXIT INT TERM

systemctl stop "$service_name"
service_stopped=1
runuser -u "$backup_user" -- env \
  SCHWANK_MANAGE_SERVICE=0 \
  SCHWANK_BACKUP_RECIPIENT="$backup_recipient" \
  SCHWANK_BACKUP_RETENTION_DAYS="$retention_days" \
  "$backup_script"
systemctl start "$service_name"
service_stopped=0

curl --fail --silent --show-error --retry 45 --retry-delay 1 \
  --retry-connrefused "$health_url" >/dev/null
