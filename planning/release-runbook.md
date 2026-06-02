# CertTrace Release Runbook

This runbook covers updater signing, CI secrets, version bumps, and the beta updater dry run.

## Version synchronization

release-please bumps:

- root `package.json`
- `apps/desktop/package.json`

After those bumps, sync Tauri/Cargo versions:

```bash
pnpm sync:version
```

This updates:

- `apps/desktop/src-tauri/tauri.conf.json`
- `apps/desktop/src-tauri/Cargo.toml`

## Updater signing keys

Generate a keypair once and store the private key securely:

```bash
cd apps/desktop
pnpm tauri signer generate -w .updater-keys/certtrace-updater.key
```

Commit only the public key. The repo stores the public key in:

- `apps/desktop/src-tauri/updater.pub`
- `apps/desktop/src-tauri/tauri.conf.json` (`plugins.updater.pubkey`)

Never commit the private key file. Add the private key contents to GitHub Actions secrets instead.

### Required GitHub Actions secrets

| Secret | Purpose |
|--------|---------|
| `TAURI_SIGNING_PRIVATE_KEY` | Updater artifact signing private key |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for the updater private key (empty string if none) |
| `APPLE_CERTIFICATE` | Base64 `.p12` for macOS signing (when available) |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the Apple certificate |
| `APPLE_SIGNING_IDENTITY` | macOS signing identity name |
| `APPLE_ID` | Apple ID for notarization |
| `APPLE_PASSWORD` | App-specific password for notarization |
| `APPLE_TEAM_ID` | Apple Developer Team ID |

Windows code signing can be added later via SignPath or a purchased certificate. Unsigned Windows builds may still publish, but SmartScreen warnings are expected until signing is configured.

## Release flow

1. Merge feature work to `main`.
2. Let release-please open or update its version PR.
3. Merge the release-please PR to create the release tag (for example `desktop-v1.0.0`).
4. Release Please dispatches `.github/workflows/release.yml` for the new `desktop-v*` tag. GitHub releases created by `GITHUB_TOKEN` do not trigger other workflows directly, so the build is chained via `workflow_dispatch`.
5. The workflow uploads release assets and `latest.json` via `tauri-apps/tauri-action`.
6. Verify the `desktop-v*` release page contains platform installers, `.sig` files, and `latest.json`.

To rebuild installers for an existing release:

```bash
gh workflow run release.yml -f tag=desktop-v1.0.0
```

## Updater dry run (`v0.1.0` → `v0.1.1`)

1. Install the published `v0.1.0` build on a test machine.
2. Open Settings and confirm automatic updates are enabled.
3. Publish `v0.1.1` through release-please and wait for release assets.
4. Launch the installed `v0.1.0` app and trigger an update check.
5. Confirm the update dialog appears with the new version.
6. Choose **Update now** and confirm the app downloads, installs, and relaunches as `v0.1.1`.
7. Verify libraries, settings, and recent-library data remain intact.

## Local validation before tagging

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm sync:version
pnpm build
```

If updater signing secrets are configured locally, you can also verify bundle signing:

```bash
export TAURI_SIGNING_PRIVATE_KEY="..."
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
pnpm build
```

## Recovery notes

- Losing the updater private key means existing installs cannot verify future updates. Generate a new keypair only as a last resort and plan a manual reinstall path for beta users.
- If `latest.json` is missing from a release, the in-app updater cannot install even if installers exist on the release page.
