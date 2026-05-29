# Contributing to CertTrace

Thank you for contributing. CertTrace is MIT-licensed open source from Subtract LLC.

## Workflow

1. Branch from `main` (short-lived feature branches)
2. Make changes with focused commits
3. Open a pull request against `main`
4. Ensure CI passes on macOS, Windows, and Linux
5. Merge via PR (squash or merge commit — use Conventional Commit title)

## Commit messages

All merge commits to `main` must follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — new feature
- `fix:` — bug fix
- `chore:` — tooling, deps, docs-only maintenance
- `ci:` — CI/CD changes
- `refactor:` — code change without behavior change
- `test:` — tests only

Examples:

```txt
feat: add library open dialog
fix: handle missing metadata on material load
chore: update pnpm lockfile
```

Release versioning is automated by [release-please](https://github.com/googleapis/release-please) from these commits.

## Privacy constraint

CertTrace has **no telemetry**. Do not add analytics, crash reporting, or network calls that phone home. Update checks (Phase 3+) are the only intentional outbound network feature and must remain optional.

## Development

See [README.md](README.md) for setup. Run `pnpm dev` from the repo root to start the desktop app.

## Issues

When filing bugs, paste any error trace from the app (copy-to-clipboard) — nothing is uploaded automatically.
