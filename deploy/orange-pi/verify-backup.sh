#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 /path/to/schwank-state-TIMESTAMP.tar.gz" >&2
  exit 2
fi

backup_path=$1
if [ ! -f "$backup_path" ]; then
  echo "Backup does not exist: $backup_path" >&2
  exit 1
fi
if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "sqlite3 is required to verify the database backup." >&2
  exit 1
fi

verification_directory=$(mktemp -d)
cleanup() {
  rm -rf "$verification_directory"
}
trap cleanup EXIT INT TERM

tar -xzf "$backup_path" -C "$verification_directory"
database_path=$(find "$verification_directory/.wrangler/state" -type f -path '*/d1/miniflare-D1DatabaseObject/*.sqlite' ! -name 'metadata.sqlite' -print -quit)
if [ -z "$database_path" ]; then
  echo "Backup contains no D1 SQLite database." >&2
  exit 1
fi

integrity=$(sqlite3 "$database_path" 'PRAGMA quick_check;')
if [ "$integrity" != 'ok' ]; then
  echo "Database integrity check failed: $integrity" >&2
  exit 1
fi

echo "Backup verified: $backup_path"
