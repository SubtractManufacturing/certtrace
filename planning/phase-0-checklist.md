# CertTrace — Phase 0 Checklist

> **Status:** Historical (complete)  
> **Completed:** 2026 (repo, CI, release-please, and Tauri shell are live)  
> **Last updated:** 2026-08-01  
> **Related:** [roadmap.md](roadmap.md), [decisions.md](decisions.md)

Executable runbook for Phase 0 scaffolding. **Do not treat unchecked boxes as open work** — this doc is kept as a historical record of how the repo was bootstrapped. Current delivery status lives in [roadmap.md](roadmap.md); release mechanics live in [release-runbook.md](release-runbook.md).

---

## What Phase 0 delivered

- GitHub repo under SubtractManufacturing with MIT license and planning docs
- pnpm workspace + Tauri v2 desktop shell (`apps/desktop`)
- Cross-platform CI (macOS, Windows, Linux): lint, typecheck, test, build
- release-please + signed GitHub Releases / updater path (see release-runbook)
- README privacy stance (offline-first, no telemetry)

---

## Original runbook (archived)

The step-by-step checklist below is frozen for archaeology. Prefer `pnpm` scripts and workflows in the repo root over these bootstrap commands.

### Prerequisites

- GitHub org access, Node.js LTS, pnpm, Rust, Tauri platform deps

### Steps (summary)

1. Planning docs reviewed and committed
2. Git repository initialized (`.gitignore`, `LICENSE`, `README.md`)
3. GitHub repository created and pushed
4. pnpm workspace + Tauri scaffold in `apps/desktop`
5. CI workflow (`.github/workflows/ci.yml`)
6. release-please + Conventional Commits
7. Repository hygiene (CONTRIBUTING, issue/PR templates)
8. Phase 0 exit criteria verified
9. Handoff to Phase 1 packages

### Commands reference (still valid)

| Task | Command |
|------|---------|
| Dev | `pnpm dev` |
| Build desktop | `pnpm build` / Tauri build via CI or local `apps/desktop` |
| Run tests | `pnpm test` |
| Typecheck | `pnpm typecheck` |
| Lint | `pnpm lint` |

---

## Revision history

| Date | Change |
|------|--------|
| 2026-05-28 | Initial Phase 0 runbook |
| 2026-08-01 | Marked historical; Phase 0 scaffolding is shipped |
