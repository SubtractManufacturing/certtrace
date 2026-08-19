---
name: conventional-commits
description: Write Conventional Commit messages for CertTrace. Use when drafting commit messages, titling PRs, or when another skill needs commit/PR message format.
---

# Conventional Commits

CertTrace follows [Conventional Commits](https://www.conventionalcommits.org/) on merge to `main`. See [CONTRIBUTING.md](../../../CONTRIBUTING.md).

## Format

```txt
<type>: <short imperative summary>
```

Optional body (blank line after subject) for non-obvious *why* — keep subject under ~72 characters.

## Types

| Type | Use for |
|------|---------|
| `feat` | New user-visible capability |
| `fix` | Bug fix |
| `refactor` | Behavior-preserving restructure |
| `test` | Tests only |
| `chore` | Tooling, deps, docs-only maintenance |
| `ci` | CI/CD only |

Pick the type that matches **this commit's** primary intent, not the whole branch.

## Subject line rules

- Imperative mood: `add`, `fix`, `remove` — not `added`, `fixes`, `adding`
- No trailing period
- Scope optional (`feat(desktop): …`) when it disambiguates; omit when obvious
- One logical change per commit — subject should describe that change alone

## Examples

```txt
feat: add overlay dismiss stack for nested dialogs

fix: exclude dimension fields from label template slots

refactor: simplify size pattern parser helpers

test: cover dimensions dropdown dismiss in ShapesEditor

chore: update pnpm lockfile
```

## Anti-patterns

- `wip`, `misc`, `updates`, `address review` — split or be specific
- Combining unrelated work: `feat: label templates and fix modal z-index` — two commits
- Past tense or issue-only titles without what changed
