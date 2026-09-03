# Releasing schwank

This runbook turns one reviewed commit into the Orange Pi server build and the
three desktop distributions. A release is complete only when the quality gate,
native build matrix, backup check, server readiness check, and release artifact
inspection all pass on the intended commit.

## Version sources

schwank uses semantic versions. Keep these files on the same version:

- `package.json` and the root entries in `package-lock.json` — browser/server
  version returned by `/api/health`;
- `desktop/package.json` — Electron application and installer version;
- `deploy/server-runtime/package.json` and its lock file — the minimal runtime
  package deployed to the board.

The API compatibility number is separate. Do not change `apiVersion` merely
because the application version changes. Raise it only for an intentionally
incompatible client/server contract and update the Electron health check in the
same release.

For a release candidate, use a tag such as `desktop-v1.0.0-rc.1`. It runs and
uploads the full native build matrix but does not create a public GitHub
Release. The standard final tag is `v1.0.0`; it runs the same matrix and creates
the GitHub Release only after every native build succeeds.

## Release preparation

1. Update every version source above and add `docs/releases/<version>.md`.
2. Run `npm install --package-lock-only` if the root version changed, then run
   `npm run check`.
3. Confirm `git status` is clean and push the reviewed commit to `main`.
4. Confirm the **Quality** workflow passes on that exact commit.
5. Create a release-candidate tag and inspect its **Desktop builds** run.

The matrix must contain all of these non-empty files:

- macOS arm64: `.dmg` and `.zip`;
- Linux x64: `.AppImage`;
- Windows x64: NSIS `.exe`.

Household-test builds are unsigned, so macOS and Windows can show publisher
warnings. Public distribution should add publisher-owned Apple notarization and
Windows code-signing credentials before advertising the installers beyond the
household.

## Server release gate

Before an Orange Pi upgrade:

1. Start `schwank-backup.service` and require a successful result.
2. Confirm there is a new `.tar.gz.age` archive and no plaintext `.tar.gz`.
3. Copy the encrypted archive off the board.
4. Run `verify-encrypted-backup.sh` and `restore-drill.sh` on the workstation
   holding the private identity.
5. Follow the staged upgrade in `deploy/fedora/README.md`.
6. Require `/api/health` to report the intended application version,
   `database: ready`, and equal applied/expected migration counts.
7. Restart the board service once more and repeat both liveness and readiness
   checks from the board and another LAN client.

Do not remove the pre-upgrade `dist.rollback-*`, the encrypted backup, or the
`state-before-restore-*` directory from a recovery until housemates have signed
in and checked private plus shared records.

## Final publication

After the candidate and server gate pass, create and push the final annotated
tag:

```sh
git tag -a v1.0.0 -m "schwank 1.0.0"
git push origin v1.0.0
```

The tag starts the native matrix. The `publish` job downloads only its three
matrix artifacts and creates the GitHub Release using
`docs/releases/1.0.0.md`. It cannot run if any build leg fails. Inspect the
release page, download each installer once, and confirm its filename and size
before announcing the release.

If publication fails before creating a Release, fix the workflow in a new
commit and use a new patch version or release-candidate tag. Do not move or
reuse a published final tag.
