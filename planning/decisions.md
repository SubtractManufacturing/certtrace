# CertTrace — Locked Decisions Register

> **Status:** Active  
> **Last updated:** 2026-05-28  
> **Related:** [spec.md](spec.md) (architecture reference), [roadmap.md](roadmap.md) (phases)

This document is the single source of truth for product and engineering decisions. When the spec and this document conflict, **this document wins** for implementation choices.

---

## Product

| Decision | Choice |
|----------|--------|
| **UI direction** | Simple, non-opinionated, neutral palette. shadcn/ui + sidebar nav (Obsidian / Stripe Dashboard tone). See [ui-direction.md](ui-direction.md). |
| **Platforms (v0.1)** | macOS, Windows, and Linux are **equally important**. All three must build and run for v0.1 release. |
| **Primary dev machines** | Developer tests on both macOS and Windows as features land. |
| **Scanner integration** | **Deferred** from v0.1. No USB wedge or camera scanning until hardware/testing path is available. |
| **Search scope** | When the library view is set to **All libraries**, the search box searches across all open/recent libraries. When a single library is selected, search is scoped to that library. |
| **Label output** | **PDF export** is sufficient for v0.1. System print dialog via exported PDF. |

---

## Storage & data

| Decision | Choice |
|----------|--------|
| **Storage model** | Local-first, filesystem-backed libraries (unchanged from [spec.md](spec.md)). |
| **Metadata format** | Human-readable JSON on disk. |
| **Schema versioning** | All JSON config and metadata files carry a `version` field. See [schema-versioning.md](schema-versioning.md). |
| **App settings** | Stored per-machine in OS canonical app-data directories (not inside library folders). |

### App settings locations (canonical)

| OS | Path |
|----|------|
| **macOS** | `~/Library/Application Support/com.subtractmanufacturing.certtrace/` |
| **Windows** | `%APPDATA%\SubtractManufacturing\CertTrace\` |
| **Linux** | `~/.local/share/certtrace/` (XDG data home) |

Settings include: theme, update preferences, recent libraries, window layout, and future scanner preferences.

---

## Architecture

| Decision | Choice |
|----------|--------|
| **Desktop stack** | Tauri + React + TypeScript + Vite + Tailwind CSS (unchanged from spec). |
| **Tauri / Rust boundary** | Use **Rust for anything performant or backend-like**: filesystem I/O, file watching, printing hooks, native dialogs, heavy indexing. Business logic that is not perf-critical may live in TypeScript packages. |
| **Search engine** | **In-memory index** built from cached JSON metadata on library open. Rebuild on file-watch events. Acceptable for libraries of thousands of materials. |
| **File watching** | No strong preference locked yet. **Default recommendation:** Rust `notify` crate via Tauri, for reliability on network shares. Final choice documented in an ADR at implement time. |
| **Monorepo tooling** | **pnpm workspaces only** for now. No Turborepo or Nx until build times justify it. |
| **Future server** | Planned but not v0.1. Node + Fastify + PostgreSQL + S3/MinIO remain speculative. |

---

## Identifier system

| Decision | Choice |
|----------|--------|
| **Configurability** | Highly configurable. Users define their own word-list categories (Animals, Cities, Adjectives, Colors, etc.) and compose templates via a wizard UI. |
| **Built-in presets** | Ship working defaults using the **same mechanism** as user configs. Users can duplicate, modify, or delete built-in presets. |
| **Uniqueness** | Generator guarantees unique IDs against existing materials in the library. |
| **Details** | See [id-system.md](id-system.md). |

---

## Release, versioning, and Git

| Decision | Choice |
|----------|--------|
| **Versioning** | **SemVer** (`MAJOR.MINOR.PATCH`). |
| **Commit messages** | **Conventional Commits** (`feat:`, `fix:`, `chore:`, etc.) — strict pattern. |
| **Release automation** | **release-please** on GitHub to auto-version and cut releases from conventional commits. |
| **Branch strategy** | **Trunk-based:** `main` is always releasable. Short-lived feature branches merge via PR. |
| **License** | **MIT** — fully open source, use however you please. |

---

## GitHub organization and repository

| Decision | Choice |
|----------|--------|
| **Organization** | Tied to **subtractmanufacturing.com**. Confirm exact GitHub org slug at repo creation (e.g. `SubtractManufacturing`). |
| **Repository name** | `certtrace` (recommended) |
| **Remote URL pattern** | `https://github.com/<org>/certtrace` |

---

## Updates

| Decision | Choice |
|----------|--------|
| **Update source** | **GitHub Releases** via Tauri built-in updater. |
| **UX** | Simple in-app popup when a new version is available. User chooses to update or dismiss. |
| **Offline behavior** | Core app works **fully offline**. Update checks are optional/periodic and never block library operations. No network required for daily use. |

---

## Privacy and telemetry

| Decision | Choice |
|----------|--------|
| **Telemetry** | **None.** No crash reporting, no analytics, no phone home. |
| **Error reporting** | User can copy error trace to clipboard and file a GitHub issue manually if they choose. |
| **Documentation** | README must prominently state offline-first and no-telemetry as a **feature**, not an omission. |

---

## Code signing (informational — not required for Phase 0)

Signing is deferred until pre-beta. Budget guidance:

| Item | Typical cost | Notes |
|------|--------------|-------|
| Apple Developer Program | **$99 USD / year** | Required for notarized macOS builds and updater |
| Windows code signing (OV) | **~$200–400 / year** | Reduces SmartScreen warnings; reputation builds slowly |
| Windows EV certificate | **~$300–500+ / year** | Faster SmartScreen trust; often requires hardware token |
| Open-source signing | **$0** via [SignPath](https://signpath.io/) | Apply when ready; worth evaluating before purchasing Windows cert |

---

## Explicit deferrals (v0.1)

Do not implement these in v0.1:

- USB barcode scanner / camera scanning
- Server edition (`apps/server`)
- Browser UI (`apps/web`)
- OCR and auto metadata extraction
- Crash telemetry / analytics
- User permissions / multi-user auth
- Mobile companion

These remain on the future roadmap in [spec.md](spec.md).

---

## Open items (resolve at implement time)

| Item | When | Default if undecided |
|------|------|----------------------|
| GitHub org slug | Phase 0 repo creation | Confirm with org admin |
| File watching library | Phase 1 `library-engine` | Rust `notify` via Tauri |
| Update check frequency | Phase 3 updater | Manual "Check for updates" + optional weekly background check |
