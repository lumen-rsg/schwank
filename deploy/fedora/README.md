# Fedora-family ARM64 deployment

This profile targets the clean Fedora-based board at `lumina@192.168.1.23`.
It intentionally uses `/home/lumina/schwank-server` and distribution-provided
Node.js instead of the retired Ubuntu/`orangepi` paths.

## Prerequisites

Install the small runtime set and confirm Node.js 22.13 or newer:

```sh
sudo dnf install -y age nodejs npm sqlite tar
node --version
```

The application does not need Electron or build tools on the board. Assemble
`dist` on a development machine and transfer this layout:

```text
/home/lumina/schwank-server/
  .dev.vars                 # optional, mode 600; never transfer through Git
  .wrangler/state/          # created on first start; preserve forever
  deploy/
  dist/
  node_modules/
  package.json
  package-lock.json
```

Copy `deploy/server-runtime/package.json` and its lock file to the top-level
`package.json` and `package-lock.json` in that runtime directory, then install
only the pinned Wrangler runtime:

```sh
cd /home/lumina/schwank-server
npm ci --omit=dev
mkdir -p .wrangler/state node_modules/.mf /home/lumina/.config/.wrangler
chmod 700 /home/lumina/.config /home/lumina/.config/.wrangler
```

The first transfer may copy `.dev.vars.example` to the private `.dev.vars`
file. Replace its placeholder `AI_API_KEY` value locally on the board, keep the
file at mode `600`, and restart `schwank`; the service command loads this exact
file explicitly.

## Service installation

Install the service, reload systemd, and open TCP port 3000 only when a firewall
service is actually present:

```sh
sudo install -m 644 deploy/fedora/schwank.service /etc/systemd/system/schwank.service
sudo systemctl daemon-reload
sudo systemctl enable --now schwank

if command -v firewall-cmd >/dev/null 2>&1; then
  sudo firewall-cmd --permanent --add-port=3000/tcp
  sudo firewall-cmd --reload
fi
```

Check both probes from the board and another LAN machine:

```sh
curl http://127.0.0.1:3000/api/health/live
curl http://127.0.0.1:3000/api/health
curl http://192.168.1.23:3000/api/health
```

The supplied service has a narrow writable set and works with SELinux in the
board's currently detected permissive mode. Before changing SELinux to
enforcing, inspect denials from a restart with `sudo ausearch -m AVC -ts recent`
and label only the exact runtime paths that require it; do not disable SELinux
globally for schwank.

## Staged upgrades

Build and test the server on the workstation. Transfer a fresh `dist` into a
new staging directory; never copy files over the build currently serving
requests.

```sh
npm ci
npm run check
release_commit=$(git rev-parse --short=12 HEAD)
tar -C dist -czf "/tmp/schwank-dist-$release_commit.tar.gz" .
scp "/tmp/schwank-dist-$release_commit.tar.gz" lumina@192.168.1.23:/home/lumina/
```

On the board, replace `<commit>` below with the exact value printed by the
workstation. First stage the archive and validate its expected entry points:

```sh
mkdir /home/lumina/schwank-server/dist.next-<commit>
tar -xzf /home/lumina/schwank-dist-<commit>.tar.gz \
  -C /home/lumina/schwank-server/dist.next-<commit>
test -f /home/lumina/schwank-server/dist.next-<commit>/server/wrangler.json
test -d /home/lumina/schwank-server/dist.next-<commit>/client
```

Run and verify an encrypted backup before the swap. Then stop the service,
rename the complete old build for rollback, move the staged build into place,
and start it again:

```sh
sudo systemctl start schwank-backup
test "$(systemctl show schwank-backup --property=Result --value)" = success

test ! -e /home/lumina/schwank-server/dist.rollback-<commit>
sudo systemctl stop schwank
mv /home/lumina/schwank-server/dist \
  /home/lumina/schwank-server/dist.rollback-<commit>
mv /home/lumina/schwank-server/dist.next-<commit> \
  /home/lumina/schwank-server/dist
printf '%s\n' '<commit>' > /home/lumina/schwank-server/RELEASE
sudo systemctl start schwank

curl --fail http://127.0.0.1:3000/api/health/live
curl --fail http://127.0.0.1:3000/api/health
```

The readiness response must report the intended application version,
`database: ready`, and identical applied/expected migration counts. Repeat the
readiness request from another LAN machine. Restart `schwank` once more and
repeat both checks before deleting the transferred archive. Keep the rollback
build and verified encrypted backup through household acceptance.

If `deploy/server-runtime/package-lock.json` changed, stage its package files
as well. After the backup and service stop, install them as the runtime
`package.json` and `package-lock.json` and run `npm ci --omit=dev` from
`/home/lumina/schwank-server` before starting the new build. Never transfer the
development workstation's `node_modules` to the ARM64 board.

## Rollback

For a failure before the new build has changed the migration ledger, restore
the retained build atomically:

```sh
sudo systemctl stop schwank
mv /home/lumina/schwank-server/dist \
  /home/lumina/schwank-server/dist.failed-<commit>
mv /home/lumina/schwank-server/dist.rollback-<commit> \
  /home/lumina/schwank-server/dist
sudo systemctl start schwank
curl --fail http://127.0.0.1:3000/api/health
```

If the new build applied migrations, or users wrote data after it started, a
binary-only rollback is not enough. Announce a maintenance window: restoring
the pre-upgrade archive intentionally discards records written after that
snapshot. Decrypt the verified `.age` archive only on the trusted workstation,
copy the temporary plaintext archive to the board with mode `600`, restore the
old `dist`, and run:

```sh
SCHWANK_SERVER_DIR=/home/lumina/schwank-server \
  SCHWANK_SERVICE_NAME=schwank \
  /home/lumina/schwank-server/deploy/orange-pi/restore-backup.sh \
  /home/lumina/pre-upgrade-state.tar.gz
```

The restore script verifies SQLite before stopping the service and retains the
replaced state as `.wrangler/state-before-restore-<timestamp>`. Remove the
temporary plaintext archive immediately after readiness passes. Retain the
replaced state until private and shared records have been checked by users.

## Backups

The portable scripts under `deploy/orange-pi` accept environment overrides and
remain the canonical implementation. The Fedora unit supplies the `lumina`
paths and account explicitly. Follow `docs/operations.md` to create an age
identity off-board, then install the root-owned runner and enable the timer:

```sh
sudo install -D -m 755 deploy/orange-pi/backup-runner.sh /usr/local/libexec/schwank-backup-runner
sudo install -m 644 deploy/fedora/schwank-backup.service /etc/systemd/system/
sudo install -m 644 deploy/fedora/schwank-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now schwank-backup.timer
```

Do not enable the timer until
`/home/lumina/.config/schwank/backup.env` contains the public
`SCHWANK_BACKUP_RECIPIENT`. Keep the matching private identity off the board.

After enabling it, require a successful manual run and copy the resulting
archive off-device:

```sh
sudo systemctl start schwank-backup
systemctl show schwank-backup --property=Result --value
systemctl list-timers schwank-backup.timer
find /home/lumina/schwank-backups -maxdepth 1 -type f \
  -name 'schwank-state-*.tar.gz.age' -print
```

There must be no remaining `schwank-state-*.tar.gz` plaintext archive. Verify
and drill the off-device copy with the private identity as described in
`docs/operations.md`.
