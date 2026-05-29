# CertTrace — Phase 0 Checklist

> **Status:** Ready to execute  
> **Last updated:** 2026-05-28  
> **Related:** [roadmap.md](roadmap.md), [decisions.md](decisions.md)

Executable runbook for Phase 0. Complete steps in order. Check boxes as done.

---

## Prerequisites

- [ ] GitHub org access for **subtractmanufacturing.com** (confirm org slug, e.g. `SubtractManufacturing`)
- [ ] Node.js LTS installed (20+)
- [ ] pnpm installed (`corepack enable && corepack prepare pnpm@latest --activate`)
- [ ] Rust toolchain installed (`rustup`) — required for Tauri
- [ ] Platform deps for Tauri ([Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)) on macOS, Windows, and/or Linux

---

## Step 1 — Planning docs (this commit)

- [ ] All files in `planning/` reviewed and approved:
  - [decisions.md](decisions.md)
  - [ui-direction.md](ui-direction.md)
  - [id-system.md](id-system.md)
  - [schema-versioning.md](schema-versioning.md)
  - [roadmap.md](roadmap.md)
  - [phase-0-checklist.md](phase-0-checklist.md)
  - [spec.md](spec.md) (cross-links + MVP tweaks)

---

## Step 2 — Initialize git repository

```bash
cd /path/to/CertTrace
git init
git branch -M main
```

- [ ] Create root `.gitignore` (Node, Rust, Tauri, OS junk, `.certtrace/` test libs)
- [ ] Add MIT `LICENSE` (Copyright Subtract Manufacturing or org name)
- [ ] Add root `README.md` with sections:
  - What CertTrace is
  - **Privacy:** offline-first, no telemetry, no phone home
  - Dev setup (Node, pnpm, Rust, Tauri prerequisites)
  - Contributing (Conventional Commits link)
  - License (MIT)
- [ ] Initial commit: planning docs + LICENSE + README + .gitignore

```bash
git add .
git commit -m "chore: add planning documentation and project foundation"
```

---

## Step 3 — Create GitHub repository

- [ ] Create repo `certtrace` under org (private or public — **public** recommended for MIT OSS)
- [ ] Do not add README/license via GitHub UI (already local)
- [ ] Add remote and push:

```bash
git remote add origin https://github.com/<ORG>/certtrace.git
git push -u origin main
```

- [ ] Enable branch protection on `main`:
  - Require PR before merge (optional for solo dev — still recommended)
  - Require status checks to pass (after CI exists)

---

## Step 4 — pnpm workspace + Tauri scaffold

- [ ] Initialize pnpm workspace at repo root (`pnpm-workspace.yaml` → `apps/*`, `packages/*`)
- [ ] Scaffold Tauri v2 app in `apps/desktop`:

```bash
pnpm create tauri-app apps/desktop --template react-ts
# Or: manual create-tauri-app flow with React + TypeScript + Vite
```

- [ ] Root `package.json` scripts:
  - `dev` → desktop dev
  - `build` → desktop build
  - `lint` / `typecheck` / `test` → placeholders OK initially
- [ ] Minimal UI: app name + "Phase 0 scaffold" text (proves React renders)
- [ ] Verify locally:

```bash
pnpm install
pnpm dev          # opens window
pnpm tauri build  # produces installer/bundle
```

- [ ] Commit: `feat: scaffold Tauri desktop shell`

---

## Step 5 — CI workflow

Create `.github/workflows/ci.yml`:

- [ ] Triggers: `push` to `main`, `pull_request`
- [ ] Matrix: `macos-latest`, `windows-latest`, `ubuntu-latest`
- [ ] Steps: checkout → install Node → pnpm → Rust → `pnpm install` → `pnpm lint` (if configured) → `pnpm typecheck` → `pnpm test` → `pnpm tauri build`
- [ ] Cache: pnpm store, Rust/cargo, Tauri target dir
- [ ] Push branch, open PR, confirm all three OS jobs green
- [ ] Commit: `ci: add cross-platform build workflow`

---

## Step 6 — release-please + Conventional Commits

- [ ] Add `.github/release-please-config.json` for root package / desktop app
- [ ] Add `.github/workflows/release-please.yml` (creates release PR with version bumps)
- [ ] Add `.github/workflows/release.yml` (on release published → build + upload artifacts) — may stub artifact upload until Phase 3
- [ ] Document in README: all merge commits to `main` use Conventional Commits
- [ ] Merge a `feat:` commit to verify release-please opens a Release PR (optional smoke test)
- [ ] Commit: `ci: add release-please automation`

**Do not manually tag v0.1.0 yet** — release-please handles first release after meaningful `feat`/`fix` lands.

---

## Step 7 — Repository hygiene

- [ ] Add `CONTRIBUTING.md` (short: branch from main, Conventional Commits, PR process)
- [ ] Add GitHub issue templates (bug report with "paste error trace" field — no auto-upload)
- [ ] Add `.github/PULL_REQUEST_TEMPLATE.md` (checklist: tests, no telemetry, conventional commit title)
- [ ] Optional: dependabot for npm + GitHub Actions

---

## Step 8 — Phase 0 verification

Run through exit criteria from [roadmap.md](roadmap.md):

- [ ] `main` on GitHub contains planning docs + scaffold
- [ ] CI green on macOS, Windows, Linux
- [ ] `pnpm dev` opens Tauri window on your dev machine(s)
- [ ] README states offline/no-telemetry clearly
- [ ] release-please workflow present (even if first release PR not yet merged)

---

## Step 9 — Handoff to Phase 1

Before starting Phase 1:

- [ ] Create GitHub issues or project board for Phase 1 packages (types → library-engine → …)
- [ ] Write implementation plan for first vertical slice (`packages/types` + library folder contract)
- [ ] Confirm no open blockers in [decisions.md](decisions.md) open items

---

## Commands reference

| Task | Command |
|------|---------|
| Dev | `pnpm dev` |
| Build desktop | `pnpm tauri build` (from `apps/desktop` or root script) |
| Run tests | `pnpm test` |
| Typecheck | `pnpm typecheck` |

---

## Revision history

| Date | Change |
|------|--------|
| 2026-05-28 | Initial Phase 0 runbook |
