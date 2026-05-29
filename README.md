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

macOS, Windows, and Linux are equally supported targets for v0.1.

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
pnpm dev          # start desktop app in dev mode
pnpm build        # production build
pnpm lint         # lint (when configured)
pnpm typecheck    # TypeScript check
pnpm test         # run tests (when configured)
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
