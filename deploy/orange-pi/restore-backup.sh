#!/bin/sh
set -eu

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "Usage: $0 /path/to/backup.tar.gz[.age] [/path/to/age-identity.txt]" >&2
  exit 2
fi

backup_path=$1
identity_file=${2:-}
server_directory=${SCHWANK_SERVER_DIR:-/home/orangepi/schwank-server}
service_name=${SCHWANK_SERVICE_NAME:-schwank}
health_url=${SCHWANK_HEALTH_URL:-http://127.0.0.1:3000/api/health}
script_directory=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
verify_script=${SCHWANK_VERIFY_BACKUP_SCRIPT:-$script_directory/verify-backup.sh}
state_directory="$server_directory/.wrangler/state"
restore_directory=$(mktemp -d)
plain_backup=$backup_path
rollback_directory=
restore_in_progress=0
restore_complete=0

cleanup() {
  rm -rf "$restore_directory"
  if [ "$restore_in_progress" -eq 1 ]; then
    sudo systemctl stop "$service_name"
    if [ -n "$rollback_directory" ] && [ -d "$rollback_directory" ]; then
      rm -rf "$state_directory"
      mv "$rollback_directory" "$state_directory"
    fi
    sudo systemctl start "$service_name"
  fi
}
trap cleanup EXIT INT TERM

case "$backup_path" in
  *.age)
    if [ -z "$identity_file" ]; then
      echo "An age identity is required to restore an encrypted backup." >&2
      exit 2
    fi
    if ! command -v age >/dev/null 2>&1; then
      echo "age is required to restore an encrypted backup." >&2
      exit 1
    fi
    plain_backup="$restore_directory/schwank-state.tar.gz"
    age --decrypt --identity "$identity_file" --output "$plain_backup" "$backup_path"
    ;;
esac

"$verify_script" "$plain_backup" >/dev/null
if [ ! -d "$state_directory" ]; then
  echo "Current state directory does not exist: $state_directory" >&2
  exit 1
fi

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
rollback_directory="$server_directory/.wrangler/state-before-restore-$timestamp"
if [ -e "$rollback_directory" ]; then
  echo "Rollback directory already exists: $rollback_directory" >&2
  exit 1
fi

sudo systemctl stop "$service_name"
restore_in_progress=1
mv "$state_directory" "$rollback_directory"
tar -xzf "$plain_backup" -C "$server_directory"
if [ ! -d "$state_directory" ]; then
  echo "Backup did not restore a state directory." >&2
  exit 1
fi
sudo systemctl start "$service_name"

curl --fail --silent --show-error --retry 45 --retry-delay 1 \
  --retry-connrefused "$health_url" >/dev/null
restore_in_progress=0
restore_complete=1
echo "Backup restored. Previous state retained at: $rollback_directory"

if [ "$restore_complete" -eq 1 ]; then
  trap - EXIT INT TERM
  rm -rf "$restore_directory"
fi
