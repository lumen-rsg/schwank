#!/bin/sh
set -eu

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "Usage: $0 /path/to/backup.tar.gz[.age] [/path/to/age-identity.txt]" >&2
  exit 2
fi

backup_path=$1
identity_file=${2:-}
script_directory=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
verify_script=${SCHWANK_VERIFY_BACKUP_SCRIPT:-$script_directory/verify-backup.sh}
drill_directory=$(mktemp -d)
plain_backup=$backup_path

cleanup() {
  rm -rf "$drill_directory"
}
trap cleanup EXIT INT TERM

case "$backup_path" in
  *.age)
    if [ -z "$identity_file" ]; then
      echo "An age identity is required for an encrypted restore drill." >&2
      exit 2
    fi
    if ! command -v age >/dev/null 2>&1; then
      echo "age is required for an encrypted restore drill." >&2
      exit 1
    fi
    plain_backup="$drill_directory/schwank-state.tar.gz"
    age --decrypt --identity "$identity_file" --output "$plain_backup" "$backup_path"
    ;;
esac

"$verify_script" "$plain_backup" >/dev/null
mkdir "$drill_directory/restored"
tar -xzf "$plain_backup" -C "$drill_directory/restored"
database_path=$(find "$drill_directory/restored/.wrangler/state" -type f \
  -path '*/d1/miniflare-D1DatabaseObject/*.sqlite' ! -name 'metadata.sqlite' -print -quit)
integrity=$(sqlite3 "$database_path" 'PRAGMA quick_check;')
migrations=$(sqlite3 "$database_path" \
  "SELECT COUNT(*) FROM __schwank_migrations;" 2>/dev/null || echo 0)

if [ "$integrity" != 'ok' ]; then
  echo "Restored database integrity check failed: $integrity" >&2
  exit 1
fi

echo "Restore drill passed: integrity=ok migrations=$migrations source=$backup_path"
