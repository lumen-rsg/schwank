#!/bin/sh
set -eu

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 /path/to/backup.tar.gz.age /path/to/age-identity.txt" >&2
  exit 2
fi

encrypted_backup=$1
identity_file=$2
script_directory=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
verify_script=${SCHWANK_VERIFY_BACKUP_SCRIPT:-$script_directory/verify-backup.sh}

if [ ! -f "$encrypted_backup" ]; then
  echo "Encrypted backup does not exist: $encrypted_backup" >&2
  exit 1
fi
if [ ! -f "$identity_file" ]; then
  echo "Age identity does not exist: $identity_file" >&2
  exit 1
fi
if ! command -v age >/dev/null 2>&1; then
  echo "age is required to verify an encrypted backup." >&2
  exit 1
fi

verification_directory=$(mktemp -d)
plain_backup="$verification_directory/schwank-state.tar.gz"
cleanup() {
  rm -rf "$verification_directory"
}
trap cleanup EXIT INT TERM

age --decrypt --identity "$identity_file" --output "$plain_backup" "$encrypted_backup"
"$verify_script" "$plain_backup" >/dev/null
echo "Encrypted backup verified: $encrypted_backup"
