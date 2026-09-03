# schwank server and desktop clients

schwank now has two deployment roles:

- The **server** runs on the Orange Pi. It owns authentication, the D1/SQLite state, uploads, AI access, and the HTTP API. It also continues to serve the browser interface.
- The **desktop client** is an Electron shell for macOS, Windows, and Linux. It stores only the server origin and loads the interface from that server, so every client sees the same household data.

Electron is a desktop runtime. It does not produce iOS or Android applications. A future mobile app can use the same versioned server API without moving the database away from the Orange Pi.

## Run the server on the LAN

The server requires Node.js 22.13 or newer.

```bash
npm ci
npm run server:build
npm run server:start:lan
```

It listens on `0.0.0.0:3000`. Connect with the Orange Pi's LAN address, for example `http://192.168.1.25:3000`. Preserve `.wrangler/state` because it contains the local database. Keep `.dev.vars` private if AI is enabled.

For an always-on Linux installation, copy `deploy/schwank.service.example` to `/etc/systemd/system/schwank.service`, adjust the user and working directory, then enable it with systemd. The service file deliberately remains an example because `/opt/schwank` and the `schwank` system user must exist first.

HTTP is accepted by the desktop client only for localhost, private IP ranges, `.local` names, and single-label LAN hostnames. HTTPS is recommended even on the LAN and is required for public hostnames.

## Use the desktop client

On first launch, enter the server's LAN address. The client checks `/api/health`, saves the compatible origin in its OS-specific application-data directory, and opens the regular schwank login screen. Change the address later with **Server Settings** in the native application menu or `Cmd/Ctrl+,`.

If the saved server is unavailable at launch or a page load loses its connection, the client shows a bilingual offline screen instead of a browser error. The address stays saved. Choose **Try again** after the Orange Pi or network returns, or **Change server** if its address changed. Connection feedback is intentionally concise and never displays raw network or server internals.

The app checks a small privacy-scoped update cursor every five seconds while active instead of downloading the complete household dataset on a timer. Ordinary changes reload only their authorized `/api/data` sections, while chat uses its smaller snapshot. Successful saves merge the same affected section directly instead of returning the full household aggregate. A full catch-up is reserved for first load, reconnect/visibility recovery, or a pruned cursor. Hidden browser tabs back off to 30 seconds. Expense, private nutrition, and private hydration records are bounded to 100 rows per stable cursor page; nutrition and hydration charts use compact exact daily summaries instead of depending on the loaded page.

Electron creates a system tray item and keeps the renderer alive when its window is closed. Choose **Open schwank** to restore it, **Server Settings** to change the Orange Pi address, or **Quit** to stop it. Background throttling is disabled so the local 30-second due-event clock and five-second update cursor continue to run while the window is hidden. The tray tooltip and operating-system badge show the current attention count. Native notification clicks restore the window and focus the exact record.

For development, start the server and desktop shell in separate terminals:

```bash
npm run server:build
npm run server:start
```

```bash
npm run desktop:dev -- --server-url=http://localhost:8787
```

`SCHWANK_SERVER_URL` provides the same temporary override. A server selected in the first-run screen is remembered automatically.

## Build desktop installers

The installers contain only the desktop shell; the Orange Pi server is deployed separately.

```bash
# Apple Silicon macOS: DMG and ZIP
npm run desktop:dist:mac

# x86-64 Linux: AppImage
npm run desktop:dist:linux

# x86-64 Windows: NSIS installer
npm run desktop:dist:windows
```

Artifacts are written to `release/desktop`. Run each production build on its target operating system. macOS signing/notarization and Windows code signing require certificates owned by the publisher; unsigned local builds are suitable for household testing but will trigger OS warnings.

The **Desktop builds** GitHub Actions workflow builds all three requested targets on native runners. Push a release-candidate tag such as `desktop-v1.0.0-rc.1` to test and retain the matrix artifacts without publishing a release. A final tag such as `v1.0.0` runs the same matrix and publishes its installers to the GitHub Release only after every platform succeeds.

## Security boundary

The Electron renderer has Node.js integration disabled, context isolation enabled, Chromium sandboxing enabled, and permission requests denied. Navigation and IPC calls are checked against the selected server origin. The preload bridge exposes no filesystem, shell, process, or general-purpose IPC access—only connection setup and retry, native notifications, their bounded badge count, click navigation, and reopening server settings.

The client allows private-LAN HTTP because the Orange Pi is intended to run locally. HTTPS still provides meaningful protection against other devices on the LAN intercepting sessions, so it should be the next deployment improvement before exposing schwank beyond a trusted network.
