# Single Desktop Release-Please Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse release-please to one `apps/desktop` package with `chore: release desktop-vX.Y.Z` PR titles, while keeping `desktop-v*` tags and exact-tag dispatch.

**Architecture:** Remove the root `certtrace` package from release-please config/manifest; drop root `package.json` version; archive root CHANGELOG; update runbook. Keep path-based packages so a future `apps/web` can be added later.

**Tech Stack:** release-please manifest config, GitHub Actions, pnpm workspace root.

**Spec:** `docs/superpowers/specs/2026-07-20-single-desktop-release-please-design.md`

## Global Constraints

- Tags remain `desktop-vX.Y.Z` (no cutover to bare `v*`)
- Exact-tag dispatch for `apps/desktop` (#48) must remain
- Do not version workspace libraries via release-please
- Root `CHANGELOG.md` stays as historical archive

---

### Task 1: Release-please config + root package

**Files:**
- Modify: `.github/release-please-config.json`
- Modify: `.github/release-please-manifest.json`
- Modify: `package.json`
- Modify: `CHANGELOG.md` (archive note only)
- Modify: `planning/release-runbook.md`
- Modify: `docs/superpowers/specs/2026-07-20-single-desktop-release-please-design.md` (status → approved)

- [x] **Step 1:** Update release-please config to desktop-only + title patterns
- [x] **Step 2:** Manifest only `apps/desktop`; remove root `version` from `package.json`
- [x] **Step 3:** Archive note on root CHANGELOG; update runbook
- [x] **Step 4:** Confirm `release-please.yml` still uses `apps/desktop--*` outputs
- [x] **Step 5:** Run `pnpm test:scripts` (sync-version tests unrelated but smoke)
- [ ] **Step 6:** Commit

### Task 2: Cutover notes (post-merge, manual)

- [ ] Close open dual-component release PR `#26` after this lands on `main`
- [ ] Let Release Please open a new `chore: release desktop-vX.Y.Z` PR
