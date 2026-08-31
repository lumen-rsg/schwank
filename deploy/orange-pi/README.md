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
