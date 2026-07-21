# CertTrace Release Runbook

This runbook covers updater signing, CI secrets, version bumps, and the beta updater dry run.

## Version synchronization

release-please tracks a single shippable package: `apps/desktop` (component `desktop`, tags `desktop-vX.Y.Z`) with `"separate-pull-requests": true`. Release PRs are titled `chore: release desktop-vX.Y.Z`. The private workspace root `package.json` is not versioned.

release-please bumps:

- `apps/desktop/package.json`
- `apps/desktop/CHANGELOG.md`
- `apps/desktop/src-tauri/tauri.conf.json` (via `extra-files`)
- `apps/desktop/src-tauri/Cargo.toml` (via `extra-files` + `x-release-please-version`)

Root `CHANGELOG.md` is a historical archive only.

CI fails if those Tauri/Cargo versions drift from `apps/desktop/package.json`:

```bash
pnpm sync:version:check
```

After a manual version bump (or if release-please did not touch Tauri/Cargo), sync and commit:

```bash
pnpm sync:version
```

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

macOS release builds use `--target universal-apple-darwin` (Apple Silicon + Intel) on `macos-latest`. After each macOS publish, spot-check Gatekeeper on a clean install:

```bash
# Mount the DMG, then find the app (volume name can vary):
find /Volumes -name 'CertTrace.app' 2>/dev/null
APP="$(find /Volumes -name 'CertTrace.app' 2>/dev/null | head -1)"
codesign -dv --verbose=4 "$APP"
spctl -a -vv "$APP"
# Expect Developer ID + notarized / accepted
```

Windows code signing can be added later via SignPath or a purchased certificate. Unsigned Windows builds may still publish, but SmartScreen warnings are expected until signing is configured.

## Desktop preview builds (`/build`)

Use **Desktop preview** to produce downloadable installers from a PR **before** merging or cutting a release-please release. Artifacts are kept for **7 days** and are **not** published to GitHub Releases / `latest.json`.

### From a PR comment (same-repo branches only)

Comment on the PR (OWNERS / MEMBERS / COLLABORATORS):

```text
/build
```

Builds macOS (universal, signed/notarized when Apple secrets are set), Windows, and Linux.

Scope platforms to save minutes:

```text
/build --mac
/build --macos
/build --windows
/build --linux
/build --mac --windows
```

`--win` is accepted as an alias for `--windows`.

The command must be on its own line. Fork PRs are refused (signing secrets must not run on untrusted heads).

### From the Actions tab

Run **Desktop preview** via `workflow_dispatch`: choose platforms, optionally a PR number (otherwise builds the selected branch ref).

### First-time enablement

`issue_comment` workflows load from the **default branch**. The Desktop preview workflow is on `main`; `/build` on open same-repo PRs will trigger.

### macOS Gatekeeper QA (issue #43)

Before treating Developer ID signing/notarization as confirmed:

1. On a PR, comment `/build --mac` and wait for the Desktop preview run.
2. Download the macOS DMG artifact from the run.
3. Mount it, then verify:

```bash
APP="$(find /Volumes -name 'CertTrace.app' 2>/dev/null | head -1)"
codesign -dv --verbose=4 "$APP"
spctl -a -vv "$APP"
```

4. Copy the app to `/Applications` and open it from Finder (not Terminal). Confirm Gatekeeper does not require ad-hoc workarounds.
5. Close [#43](https://github.com/SubtractManufacturing/certtrace/issues/43) when steps 3–4 pass.

## Release flow

1. Merge feature work to `main`.
2. Let release-please open or update its version PR (`chore: release desktop-vX.Y.Z`).
3. Merge that PR to create the desktop GitHub release. The tag remains `desktop-vX.Y.Z` (for example `desktop-v1.0.0`), and the release is renamed to `CertTrace Desktop: vX.Y.Z`.
4. `.github/workflows/release-please.yml` reads the exact `apps/desktop--tag_name` output from that run (not a newest-release lookup), renames that release, and dispatches `.github/workflows/release.yml` with `tag` set to that same tag. GitHub releases created by `GITHUB_TOKEN` do not trigger other workflows directly, so the build is chained via `workflow_dispatch`.
5. `release.yml` resolves that tag with `getReleaseByTag` and uploads assets / `latest.json` only for that release via `tauri-apps/tauri-action`.
6. Verify the `CertTrace Desktop: vX.Y.Z` release page contains platform installers, `.sig` files, and `latest.json`.

To rebuild installers for an existing release:

```bash
gh workflow run release.yml -f tag=desktop-v1.0.0
```

### Future install targets

When another shippable app exists (for example `apps/web`), add it under both `.github/release-please-config.json` (path, `component`, changelog) and `.github/release-please-manifest.json` (path → initial version). Keep `"separate-pull-requests": true` so each target gets a clear PR title (`chore: release desktop-v…` vs `chore: release web-v…`). Dispatch/build for the new target should follow the same `--tag_name` / `--release_created` pattern as desktop. Do not reintroduce a root umbrella package as a fake “core” release.

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
