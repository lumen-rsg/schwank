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
