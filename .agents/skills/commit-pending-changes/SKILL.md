---
name: commit-pending-changes
description: Split pending git changes into small Conventional Commits and commit them in order. Use when the user asks to commit work, check in changes, land commits, or split a large diff into manageable commits.
disable-model-invocation: true
---

# Commit pending changes

Check in the working tree as **several small commits**, each one feature- or fix-scoped. Write every message with [conventional-commits](../conventional-commits/SKILL.md).

Only commit when the user asks (or a skill explicitly tells you to). Never push unless asked.

## Workflow

### 1. Inventory

Run in parallel:

```bash
git status
git diff
git diff --cached
git log -5 --oneline
```

Read the output before planning commits.

**Exclude from every commit:** build artifacts (`target/`, `dist/` unless intentional), local env files, secrets, unrelated WIP. Warn if the user asked to commit those.

### 2. Plan chunks

Group changes into **atomic commits**. Each commit should:

- Build and pass tests on its own when possible
- Have a single `feat` / `fix` / `refactor` / `test` / `chore` / `ci` story
- Touch the minimum files needed for that story

**Split order (dependencies first):**

1. Shared types / schemas / pure libs
2. Engine or package logic
3. UI wiring
4. Tests that lock behavior (same commit as the code they cover, unless tests-only commit is clearer)
5. Docs / CONTEXT / ADR (often `chore` or bundled with the feature they document)

**Keep together:** a component + its tests for one behavior change.

**Separate commits:** unrelated features, refactors mixed with fixes, generated lockfiles unless they're the only change.

Present a numbered plan before committing (commit type + subject + files). If the user gave no plan approval, still show the plan briefly then proceed unless they said to wait.

### 3. Commit each chunk

For each planned commit, sequentially:

```bash
git add <paths-for-this-chunk-only>
git commit -m "$(cat <<'EOF'
<type>: <subject>

<optional body>
EOF
)"
git status
```

Rules:

- Stage **only** files for the current chunk
- Follow [conventional-commits](../conventional-commits/SKILL.md)
- If a pre-commit hook fails, **fix and create a new commit** — do not `--amend` unless user rules allow
- Never `--no-verify`, never force-push, never rewrite shared history without explicit request

### 4. Finish

After the last commit:

- `git status` should be clean (or only intentionally untracked files remain)
- Summarize commits created (hash + subject list)

## Chunk sizing guide

| Good | Too large |
|------|-----------|
| One bug fix + its test | Whole feature branch in one commit |
| Label template UI filter | UI + unrelated overlay stack refactor |
| Types change + consumers updated | "Everything from the session" |
| Docs-only CONTEXT update | Mixed feat + fix + chore |

When unsure, **prefer more commits** over one vague commit.

## CertTrace hints

- Desktop UI: `apps/desktop/src/components/`, `apps/desktop/src/lib/`
- Shared UI primitives: `packages/ui/`
- Domain types: `packages/types/`
- Label/size/shape work often spans `types`, `core`, and `apps/desktop` — split by layer when commits would otherwise mix concerns
