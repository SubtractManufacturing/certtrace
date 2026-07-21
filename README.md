# CertTrace

Lightweight desktop material certification tracking for CNC manufacturing job shops.

CertTrace organizes material certifications (PDF, PNG, JPG, scans) on disk with human-readable JSON metadata. Open a library folder, assign IDs, attach certs, search instantly, and export label PDFs — no server required.

## Privacy

**CertTrace is offline-first by design.**

- All library data lives on your filesystem
- No telemetry, analytics, or crash reporting
- No phone home — the app never requires network access for daily use
- Update checks (when enabled) are optional and never block library operations

This is a feature, not an omission.

## Platforms

macOS (Apple Silicon and Intel via a universal DMG), Windows, and Linux are supported.

## Installing CertTrace

Download the latest release for your platform from [GitHub Releases](https://github.com/SubtractManufacturing/certtrace/releases).

### macOS

1. Download the `.dmg` from the latest release (universal: Apple Silicon and Intel).
2. Open the disk image and drag **CertTrace** into Applications.
3. Open **CertTrace** from Applications. A notarized build should pass Gatekeeper; if macOS still blocks the app, use **System Settings → Privacy & Security** to allow it and report the release tag.

### Windows

1. Download the `.exe` installer (NSIS) from the latest release.
2. Run the installer and follow the prompts.
3. Launch **CertTrace** from the Start menu or desktop shortcut.

### Linux

1. Download the `.AppImage`, `.deb`, or distribution-specific bundle from the latest release.
2. For AppImage: make it executable (`chmod +x CertTrace_*.AppImage`) and run it.
3. For `.deb`: install with your package manager, for example `sudo dpkg -i certtrace_*.deb`.

### In-app updates

When automatic updates are enabled in Settings, CertTrace checks GitHub Releases for signed updates and can install them in-app. Update checks are optional and never block library operations.

See [planning/release-runbook.md](planning/release-runbook.md) for maintainer release steps.

## Development setup

### Prerequisites

- [Node.js](https://nodejs.org/) 20+ (LTS recommended)
- [pnpm](https://pnpm.io/installation) — install via standalone script or `corepack enable && corepack prepare pnpm@latest --activate`
- [Rust](https://www.rust-lang.org/tools/install) — required for Tauri
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS

If `pnpm` is not found after install, reload your shell:

```bash
source ~/.zshrc   # macOS / Linux
# or open a new terminal tab
```

The standalone installer sets `PNPM_HOME` (commonly `~/Library/pnpm` on macOS and `~/.local/share/pnpm` on Linux). Ensure `$PNPM_HOME` is on your `PATH`.

Rust installs `cargo` under `~/.cargo/bin`; make sure `~/.cargo/env` is sourced in your shell before running `pnpm dev` / Tauri commands.

### Commands

```bash
pnpm install
pnpm dev           # start desktop app in dev mode
pnpm build         # production build
pnpm lint          # Biome check (lint + format + import sorting)
pnpm format        # apply Biome formatting
pnpm format:check  # verify formatting without writing
pnpm typecheck     # TypeScript check
pnpm test          # run tests (when configured)

# Rust checks for the Tauri crate (apps/desktop/src-tauri)
cd apps/desktop/src-tauri
cargo clippy --all-targets -- -D warnings
cargo test
```

## Project structure

```txt
certtrace/
  apps/
    desktop/      # Tauri + React desktop shell
  packages/       # shared libraries (Phase 1+)
  planning/       # design docs and roadmap
```

See [planning/spec.md](planning/spec.md) for architecture and [planning/roadmap.md](planning/roadmap.md) for delivery phases.

## Contributing

We use [Conventional Commits](https://www.conventionalcommits.org/) for all merge commits to `main` (`feat:`, `fix:`, `chore:`, etc.). See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow.

## License

[MIT](LICENSE) — Copyright (c) 2026 Subtract LLC
