#!/bin/sh
set -eu

server_directory=${SCHWANK_SERVER_DIR:-/home/orangepi/schwank-server}
backup_directory=${SCHWANK_BACKUP_DIR:-/home/orangepi/schwank-backups}
backup_script=${SCHWANK_BACKUP_SCRIPT:-$server_directory/deploy/orange-pi/backup.sh}
verify_script=${SCHWANK_VERIFY_BACKUP_SCRIPT:-$server_directory/deploy/orange-pi/verify-backup.sh}
recipient=${SCHWANK_BACKUP_RECIPIENT:-}
retention_days=${SCHWANK_BACKUP_RETENTION_DAYS:-30}

if [ -z "$recipient" ]; then
  echo "SCHWANK_BACKUP_RECIPIENT must contain an age public recipient." >&2
  exit 2
fi
if [ -z "$backup_directory" ] || [ "$backup_directory" = '/' ]; then
  echo "Refusing to use an unsafe backup directory." >&2
  exit 2
fi
case "$retention_days" in
  ''|*[!0-9]*)
    echo "SCHWANK_BACKUP_RETENTION_DAYS must be a whole number." >&2
    exit 2
    ;;
esac
if ! command -v age >/dev/null 2>&1; then
  echo "age is required for encrypted backups." >&2
  exit 1
fi

umask 077
plain_backup=$("$backup_script")
"$verify_script" "$plain_backup" >/dev/null
encrypted_backup="$plain_backup.age"
partial_backup="$encrypted_backup.partial"

cleanup() {
  rm -f "$partial_backup"
  if [ -n "$plain_backup" ] && [ -f "$plain_backup" ]; then
    rm -f "$plain_backup"
  fi
}
trap cleanup EXIT INT TERM

age --encrypt --recipient "$recipient" --output "$partial_backup" "$plain_backup"
chmod 600 "$partial_backup"
mv "$partial_backup" "$encrypted_backup"
rm -f "$plain_backup"
plain_backup=

# The directory is validated as non-root and the filename prefix is fixed,
# preventing pruning from broadening beyond schwank backup files.
find "$backup_directory" -type f -name 'schwank-state-*.tar.gz.age' \
  -mtime "+$retention_days" -exec rm -f {} \;

echo "$encrypted_backup"
