# Design: Single desktop release-please package

Date: 2026-07-20  
Status: approved

## Problem

Release Please currently tracks two packages:

1. `.` / component `certtrace` — root workspace `package.json` (GitHub release skipped)
2. `apps/desktop` / component `desktop` — the real product release (`desktop-v*`)

There is only one shippable app today. The root entry shows up as a second “core” line on release PRs (`certtrace: X.Y.Z` alongside `desktop: A.B.C`) and produces titles like `chore: release main`, which obscure what is shipping. Root is not a second install target and should not be versioned by release-please.

A future web app will need its own build/release path. Collapsing to one **real** package must not block adding another path later.

## Goals

- One release-please package: `apps/desktop`
- Keep published tags as `desktop-vX.Y.Z` (no updater/tag cutover)
- Release PR titles like `chore: release desktop-v1.0.3`
- Drop root `package.json` `version` (not a released artifact)
- Desktop changelog only at `apps/desktop/CHANGELOG.md`; root `CHANGELOG.md` becomes historical
- Preserve the #48 exact-tag dispatch chain for desktop builds
- Leave a clear path to add `apps/web` (or similar) later without redesign

## Non-goals

- Changing tag prefix away from `desktop-v`
- Publishing GitHub Releases for workspace libraries (`@certtrace/core`, etc.)
- Implementing the web app or its CI in this change
- Rewriting historical root `CHANGELOG.md` content into the desktop changelog

## Design

### Package model

`.github/release-please-config.json` keeps only:

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "pull-request-title-pattern": "chore: release ${component}-v${version}",
  "group-pull-request-title-pattern": "chore: release ${component}-v${version}",
  "packages": {
    "apps/desktop": {
      "release-type": "node",
      "component": "desktop",
      "changelog-path": "CHANGELOG.md",
      "extra-files": [
        {
          "type": "json",
          "path": "src-tauri/tauri.conf.json",
          "jsonpath": "$.version"
        },
        {
          "type": "generic",
          "path": "src-tauri/Cargo.toml"
        }
      ]
    }
  },
  "plugins": ["sentence-case"]
}
```

`.github/release-please-manifest.json` becomes:

```json
{
  "apps/desktop": "<current-desktop-version>"
}
```

(Remove the `"."` key entirely.)

Both title patterns are set so grouped and non-grouped release PRs parse `${component}` and `${version}` on merge (avoids the known `chore: release main` / missing-`${version}` failure mode).

### Root package.json

Remove the `"version"` field from the private workspace root `package.json`. Root remains the pnpm workspace scripts host; it is not a release unit.

`scripts/sync-app-version.mjs` already reads only `apps/desktop/package.json` — no change required for versioning logic.

### Changelogs

- **Active:** `apps/desktop/CHANGELOG.md` (release-please continues to update this)
- **Archive:** root `CHANGELOG.md` — leave in place; add a short note at the top that new entries go under `apps/desktop/CHANGELOG.md`. Do not delete history.

### Workflows

`.github/workflows/release-please.yml` already dispatches on `apps/desktop--release_created` / `apps/desktop--tag_name` (#48). No structural change required beyond runbook wording that no longer mentions a root `certtrace-v*` release.

`.github/workflows/release.yml` continues to accept `desktop-v*` only.

### Docs

Update `planning/release-runbook.md`:

- Version sync list: desktop `package.json` + Tauri/Cargo only (drop root `package.json`)
- Release flow: one package, PR title form, exact-tag dispatch
- Short “Future install targets” note: add another `packages` entry (e.g. `apps/web` with `component: "web"`); prefer `separate-pull-requests: true` once more than one shippable app exists

### Open release PR cutover

After this config lands on `main`:

1. Close the open dual-component release-please PR (currently titled like `chore: release main`) with a short explanation.
2. Push (or wait for) a `main` run of Release Please so it opens a new single-package PR titled `chore: release desktop-vX.Y.Z`.

Do not merge the old dual-component PR after the config change.

## Future: web (or other install targets)

When a second shippable app exists:

1. Add `apps/web` (example) under `packages` with its own `component`, changelog, and version.
2. Set `"separate-pull-requests": true` so each target gets an obvious PR title (`chore: release desktop-v…` vs `chore: release web-v…`).
3. Add a sibling dispatch/build workflow (or extend dispatch) keyed on that package’s `--tag_name` / `--release_created` outputs — same pattern as desktop today.

Path-based packages are the extension point; root must not become a fake umbrella release.

## Acceptance criteria

- [ ] Release-please config/manifest list only `apps/desktop`
- [ ] Root `package.json` has no `version` field
- [ ] Title patterns produce `chore: release desktop-vX.Y.Z`
- [ ] Tags remain `desktop-vX.Y.Z`; release build dispatch still uses exact desktop tag
- [ ] Runbook matches the single-package model and documents future multi-target path
- [ ] Root changelog marked historical; desktop changelog remains the active one
- [ ] Dual-component release PR closed; regenerated PR is single-package

## Out of scope follow-ups

- Filing the GitHub issue / implementation PR (after this design is approved)
- Enabling `separate-pull-requests` before a second app exists (optional; not required for one package)
