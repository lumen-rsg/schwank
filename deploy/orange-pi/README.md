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

Useful checks:

```sh
systemctl status schwank
journalctl -u schwank -n 100 --no-pager
curl http://127.0.0.1:3000/api/health
```

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

Restoration remains an explicit operator action: stop `schwank`, preserve the
current `.wrangler/state`, extract the selected archive from the server root,
then restart and check `/api/health`. Never restore while the service is
running.
