# CertTrace Release Runbook

This runbook covers updater signing, CI secrets, version bumps, and the beta updater dry run.

## Version synchronization

release-please tracks a single shippable package: `apps/desktop` (component `desktop`, tags `desktop-vX.Y.Z`) with `"separate-pull-requests": true`. Release PRs are titled `chore: release desktop-vX.Y.Z`. The private workspace root `package.json` is not versioned.

The desktop app is currently at **0.0.0** (reset from the 1.0.x test-release cycle). Pre-1.0 bump rules in `.github/release-please-config.json` apply:

- `fix:` → patch (`0.0.1`, `0.0.2`, …)
- `feat:` → minor (`0.1.0`, `0.2.0`, …)
- `feat!` / `BREAKING CHANGE` → minor under 1.0 (not accidental `1.0.0`)

When ready for stable **1.0.0**, add a one-time `"release-as": "1.0.0"` under the `apps/desktop` package in `.github/release-please-config.json`, merge that release PR, then remove `release-as`.

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
| `AZURE_CLIENT_ID` | Entra app client ID for Artifact Signing (GitHub OIDC) |
| `AZURE_TENANT_ID` | Entra tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription that owns the Artifact Signing account |
| `AZURE_ARTIFACT_SIGNING_ACCOUNT` | Artifact Signing account name (e.g. `CertTrace`) |
| `AZURE_ARTIFACT_SIGNING_PROFILE` | Public Trust certificate profile name |
| `AZURE_ARTIFACT_SIGNING_ENDPOINT` | Regional endpoint (e.g. `https://wus2.codesigning.azure.net`) |
| `DISCORD_WEBHOOK_URL` | Discord channel webhook URL for release announcements |

macOS release builds use `--target universal-apple-darwin` (Apple Silicon + Intel) on `macos-latest`. After each macOS publish, spot-check Gatekeeper on a clean install:

```bash
# Mount the DMG, then find the app (volume name can vary):
find /Volumes -name 'CertTrace.app' 2>/dev/null
APP="$(find /Volumes -name 'CertTrace.app' 2>/dev/null | head -1)"
codesign -dv --verbose=4 "$APP"
spctl -a -vv "$APP"
# Expect Developer ID + notarized / accepted
```

Windows release builds Authenticode-sign NSIS (and MSI when published) via **Azure Artifact Signing** on `windows-latest`. The release workflow uses GitHub OIDC (`azure/login`) and Tauri `signCommand` (`apps/desktop/src-tauri/scripts/sign-windows.ps1` with the `dotnet sign` tool). Updater minisign (`TAURI_SIGNING_*`) is separate from Authenticode.

### Windows Authenticode setup (one-time)

1. Artifact Signing account with **Completed** Public Trust identity validation.
2. **Public Trust** certificate profile bound to that identity.
3. Entra app registration with **GitHub Actions federated credential** (branch `main` on `SubtractManufacturing/certtrace`).
4. **Artifact Signing Certificate User** role on the app service principal (at the account or profile scope).
5. GitHub Actions secrets listed in the table above.

Identity validation expires (check the portal). Renew before expiry or signing stops. The Artifact Signing account bills ~$9.99/mo Basic while active.

### Windows Authenticode QA (issue #44)

After a release build, download the NSIS installer from the GitHub release page and verify on Windows:

```powershell
Get-AuthenticodeSignature .\CertTrace_*-setup.exe | Format-List
```

Expect **Status: Valid** and a publisher matching the validated legal entity (e.g. Subtract LLC). Install from the signed installer on a clean VM; SmartScreen may still warn on early builds until publisher reputation builds.

Desktop preview (`/build`) Windows artifacts remain **unsigned** unless signing is added to that workflow separately.

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
   - Prefer a **squash merge**. Replace GitHub’s auto-generated commit body (the dump of every branch commit) with a short customer-facing summary, or clear the body and keep only the conventional subject (`feat: …` / `fix: …`). That subject is what release-please turns into the first changelog draft.
2. Let release-please open or update its version PR (`chore: release desktop-vX.Y.Z`). The CI build matrix does not run on that PR (version/changelog bumps only); it still runs after the PR merges to `main`.
3. **Before merging the release PR**, edit `apps/desktop/CHANGELOG.md` on that branch into the customer-facing notes you want on GitHub/Discord (collapse internals, merge iterative commits into one bullet per feature). Merge soon after editing — another push to `main` can make release-please regenerate the draft.
4. Merge that PR to create the desktop GitHub release. The tag remains `desktop-vX.Y.Z` (for example `desktop-v1.0.0`), and the release is renamed to `CertTrace Desktop: vX.Y.Z`.
5. `.github/workflows/release-please.yml` reads the exact `apps/desktop--tag_name` output from that run (not a newest-release lookup), renames that release, and dispatches `.github/workflows/release.yml` with `tag` set to that same tag. GitHub releases created by `GITHUB_TOKEN` do not trigger other workflows directly, so the build is chained via `workflow_dispatch`.
6. `release.yml` resolves that tag with `getReleaseByTag` and uploads assets / `latest.json` only for that release via `tauri-apps/tauri-action`.
7. Verify the `CertTrace Desktop: vX.Y.Z` release page contains platform installers, `.sig` files, and `latest.json`.
8. After **all** platform builds succeed, `release.yml` polls `latest.json` every minute until `pub_date` + 30 minutes has elapsed (same gate as the in-app update modal in `isReleaseReady`), then posts a Discord embed (`Version X.Y.Z is now available` + release changelog). Re-running the workflow after that window posts immediately. Manual rebuilds use the same message. A failed Discord notify job fails the Release run but does not remove published assets.

Set `DISCORD_WEBHOOK_URL` before the first release that should announce. Create the webhook in Discord channel settings; never commit the URL.

To rebuild installers for an existing release:

```bash
gh workflow run release.yml -f tag=desktop-v0.0.1
```

### Version reset (0.0.0 baseline)

The project was reset from 1.0.x to **0.0.0** with no beta/prerelease channel. All installs use the same `releases/latest` updater endpoint; `0.x` builds update to `1.0.0` via semver when that release ships.

**Re-anchoring release-please after a reset:** Deleting tags alone is not enough — release-please still finds the last merged release PR. After merging the reset to `main`:

1. Delete all GitHub releases and tags (before or around merge).
2. Tag the reset commit: `desktop-v0.0.0` (lightweight tag only; no GitHub Release or build).
3. Add `"last-release-sha": "<reset-commit-sha>"` to `.github/release-please-config.json` (top-level). Remove it after the first good post-reset release PR merges.
4. Close any wrong release PR opened on the merge push (e.g. still bumping from 1.0.7).

Machines on old **1.0.x** builds will not downgrade via the updater; reinstall manually.

### Future install targets

When another shippable app exists (for example `apps/web`), add it under both `.github/release-please-config.json` (path, `component`, changelog) and `.github/release-please-manifest.json` (path → initial version). Keep `"separate-pull-requests": true` so each target gets a clear PR title (`chore: release desktop-v…` vs `chore: release web-v…`). Dispatch/build for the new target should follow the same `--tag_name` / `--release_created` pattern as desktop. Do not reintroduce a root umbrella package as a fake “core” release.

## Updater dry run (`0.0.x` published builds)

1. Install a published older build on a test machine (for example `desktop-v0.0.1`).
2. Open Settings and confirm automatic updates are enabled.
3. Publish a newer release through release-please and wait for release assets + `latest.json`.
4. Launch the installed older app and trigger an update check (or wait for the launch check after the 30-minute release-ready window).
5. Confirm the update dialog appears with the new version and release notes snippet.
6. Choose **Update now** and confirm the app downloads, installs, and relaunches on the new version.
7. Verify libraries, settings, and recent-library data remain intact.

Maintainer verified steps 4–6 on 2026-07-31 across the `0.0.1` → `0.0.3` line. Repeat per platform before calling the ship path fully proven.

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
