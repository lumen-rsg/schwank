# Orange Pi LAN deployment

The production-like LAN server runs from `/home/orangepi/schwank-server` and
listens on port `3000`. Only the compiled `dist` output, the small Wrangler
runtime, and the persistent `.wrangler/state` directory are needed on the
board. Electron is not installed on the server.

The checked-in service targets an ARM64 Orange Pi with Node.js 22.14.0 unpacked
at `/home/orangepi/.local/node-v22.14.0-linux-arm64`. Install it as
`/etc/systemd/system/schwank.service`, then run:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now schwank
```

The replaceable `dist/server` subtree is writable because Wrangler creates a
build-local `.wrangler/tmp` directory beside its compiled configuration. This
lets an atomic replacement of `dist` start without pre-creating transient
directories. Persistent D1 data lives in the separate top-level
`.wrangler/state` path and is never part of the swap.

The service uses `Restart=always` so the notification scheduler and live-update
feed return after either an unexpected clean exit or a failure. An explicit
`systemctl stop schwank` remains stopped as normal.

Useful checks:

```sh
systemctl status schwank
journalctl -u schwank -n 100 --no-pager
curl http://127.0.0.1:3000/api/health
curl http://127.0.0.1:3000/api/health/live
```

`/api/health/live` proves that the HTTP process is alive without touching the
database. `/api/health` is the readiness check: it verifies database access and
reports the application version plus applied and expected migration counts.
Every readiness response includes an `x-request-id`; mutation timing and errors
are emitted as one-line JSON records under the `schwank` journal identifier.

The service rate-limits repeated log bursts. To also bound journal storage on a
dedicated Orange Pi, install `journald-schwank.conf` as
`/etc/systemd/journald.conf.d/schwank.conf` and restart `systemd-journald`. The
provided policy compresses logs, retains at most 14 days, and caps the entire
system journal—not only schwank—at 200 MB.

Desktop clients should use `http://<orange-pi-lan-address>:3000` as their server
URL. Keep port 3000 restricted to the trusted LAN; the service intentionally
uses HTTP so it can work without local TLS certificate management.

For DeepSeek meal planning, create `/home/orangepi/schwank-server/.dev.vars`
with mode `600`:

```dotenv
AI_PROVIDER=deepseek
AI_API_KEY=
AI_MODEL=deepseek-v4-pro
```

Enter the key directly on the board, then restart `schwank`. Never commit or
transfer the populated file. The server runtime passes this file explicitly to
Wrangler because the compiled configuration lives under `dist/server`.

## Backups before upgrades

Install `sqlite3` on the board once so backups can be checked:

```sh
sudo apt-get install sqlite3
```

Before replacing `dist`, changing the runtime, or applying a schema change, run
the checked-in cold-backup script from the repository checkout:

```sh
./deploy/orange-pi/backup.sh
./deploy/orange-pi/verify-backup.sh /home/orangepi/schwank-backups/schwank-state-TIMESTAMP.tar.gz
```

The backup script briefly stops `schwank`, archives only the persistent
Wrangler/D1 state with mode `600`, restarts the service even when archiving
fails, and waits for the health endpoint before reporting success. It never
copies `.dev.vars` or the AI key. Keep at least the latest verified backup
until the upgraded server has passed its restart smoke test.

## Automated encrypted backups

The unattended path encrypts every backup to an `age` public recipient before
the plaintext archive is removed. Keep the corresponding private identity off
the Orange Pi. Install `age`, place only the public recipient in
`/home/orangepi/.config/schwank/backup.env`, and install the root-owned runner
plus the systemd units:

```sh
sudo apt-get install age
sudo install -d -m 700 -o orangepi -g orangepi /home/orangepi/.config/schwank
printf '%s\n' 'SCHWANK_BACKUP_RECIPIENT=age1...' > /home/orangepi/.config/schwank/backup.env
chmod 600 /home/orangepi/.config/schwank/backup.env
sudo install -D -m 755 deploy/orange-pi/backup-runner.sh /usr/local/libexec/schwank-backup-runner
sudo install -m 644 deploy/orange-pi/schwank-backup.service /etc/systemd/system/
sudo install -m 644 deploy/orange-pi/schwank-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now schwank-backup.timer
```

The runner is installed root-owned so the unprivileged checkout cannot replace
the code that controls `systemctl`. It runs the archive/encryption work as
`orangepi`, briefly stops the server for a consistent snapshot, always starts
it again, and waits for readiness. The timer runs daily around 04:15, catches up
after downtime, and retains 30 days by default. Test it immediately with
`sudo systemctl start schwank-backup` and inspect `journalctl -u schwank-backup
-n 100 --no-pager`.

Copy `.age` archives off the Orange Pi: encryption protects their contents but
a backup stored only on the same SD card does not protect against card failure.
On the trusted machine holding the identity, run:

```sh
./deploy/orange-pi/verify-encrypted-backup.sh backup.tar.gz.age identity.txt
./deploy/orange-pi/restore-drill.sh backup.tar.gz.age identity.txt
```

For a real recovery, decrypt on the trusted machine, transfer the temporary
plaintext archive to the board during maintenance, and run
`restore-backup.sh`. The script verifies integrity before stopping the service,
retains the replaced state as `state-before-restore-TIMESTAMP`, rolls back if
extraction or readiness fails, and never touches `.dev.vars`.
