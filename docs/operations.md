# Operations

This runbook covers the operational controls introduced in Pass 8. The Orange
Pi-specific commands and exact installation paths live in
`deploy/orange-pi/README.md`.

## Service checks

- `GET /api/health/live` is a liveness probe. It does not access SQLite and can
  distinguish a dead HTTP process from a database problem.
- `GET /api/health` is a readiness probe. A `200` requires the database to be
  available and every migration bundled with this build to be applied.
- Both responses expose only the service name, application/API version, server
  time, and non-sensitive schema counts. They use `cache-control: no-store` and
  return or create a bounded `x-request-id`.

Use readiness before switching clients to a new build. A build is not ready if
its applied and expected migration counts differ.

## Logs and retention

The systemd service writes stdout/stderr to journald with the identifier
`schwank`. API mutation records are single-line JSON containing the timestamp,
event, request ID, action, status, duration, and numeric user ID. They never log
request bodies, session cookies, labels, chat text, addresses, medication
details, or AI keys.

```sh
journalctl -u schwank -n 100 --no-pager
journalctl SYSLOG_IDENTIFIER=schwank --since today -o cat
```

The checked-in journald drop-in bounds the dedicated board's complete journal
to 200 MB and 14 days. Because this is a system-wide limit, review it before
installing schwank alongside unrelated services.

## Backup trust model

Scheduled backups use `age` public-key encryption. Generate the identity on a
trusted workstation, keep that identity in the workstation's encrypted secret
storage, and copy only its `age1...` public recipient to the Orange Pi. Anyone
with board access can create a backup, but cannot decrypt one from the recipient
alone.

Each scheduled run performs this sequence:

1. Stop schwank briefly.
2. Archive the complete persistent Wrangler state with mode `600`.
3. Verify the archived D1 database with `PRAGMA quick_check`.
4. Encrypt to the configured recipient and remove the plaintext archive.
5. Start schwank and wait for migration-aware readiness.
6. Remove encrypted archives older than the configured retention window.

An off-device copy is still required for media failure protection.

## Restore policy

Run `restore-drill.sh` after first setup, after a migration change, and at least
quarterly. It decrypts into a temporary directory, extracts the exact state
tree, checks SQLite integrity, and reports its migration ledger without changing
the live service.

A real restore is deliberately manual and requires a previously verified
archive. `restore-backup.sh` performs a cold replacement and retains the old
state beside the restored state for rollback. Do not remove that rollback copy
until users have signed in and checked private and shared records after a
restart.
