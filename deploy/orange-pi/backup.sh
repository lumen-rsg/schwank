#!/bin/sh
set -eu

server_directory=${SCHWANK_SERVER_DIR:-/home/orangepi/schwank-server}
backup_directory=${SCHWANK_BACKUP_DIR:-/home/orangepi/schwank-backups}
service_name=${SCHWANK_SERVICE_NAME:-schwank}
health_url=${SCHWANK_HEALTH_URL:-http://127.0.0.1:3000/api/health}
manage_service=${SCHWANK_MANAGE_SERVICE:-1}
state_directory="$server_directory/.wrangler/state"

if [ ! -d "$state_directory" ]; then
  echo "schwank state directory does not exist: $state_directory" >&2
  exit 1
fi

umask 077
mkdir -p "$backup_directory"
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_path="$backup_directory/schwank-state-$timestamp.tar.gz"
partial_path="$backup_path.partial"
service_stopped=0

restart_service() {
  if [ "$service_stopped" -eq 1 ]; then
    sudo systemctl start "$service_name"
  fi
  rm -f "$partial_path"
}
trap restart_service EXIT INT TERM

if [ "$manage_service" -eq 1 ]; then
  sudo systemctl stop "$service_name"
  service_stopped=1
fi
tar -C "$server_directory" -czf "$partial_path" .wrangler/state
mv "$partial_path" "$backup_path"
if [ "$manage_service" -eq 1 ]; then
  sudo systemctl start "$service_name"
  service_stopped=0
fi

if [ "$manage_service" -eq 1 ]; then
  curl --fail --silent --show-error --retry 30 --retry-delay 1 --retry-connrefused "$health_url" >/dev/null
fi
echo "$backup_path"
