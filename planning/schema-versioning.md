# CertTrace — JSON Schema Versioning

> **Status:** Draft  
> **Last updated:** 2026-05-28  
> **Related:** [decisions.md](decisions.md), [id-system.md](id-system.md), [spec.md](spec.md)

All CertTrace metadata on disk is human-readable JSON with an explicit **`version`** integer. The app uses this field to migrate older libraries forward without breaking portability.

---

## Versioned files

| File | Location | Purpose |
|------|----------|---------|
| `library.json` | `.certtrace/library.json` | Library name, active ID strategy, label template, search options |
| `naming-rules.json` | `.certtrace/naming-rules.json` | ID template strategies |
| `word-lists.json` | `.certtrace/word-lists.json` | Named word categories for ID generation |
| `metadata.json` | `materials/<id>/metadata.json` | Per-material fields |

Each file includes a top-level `"version": <integer>`.

---

## Version numbering rules

- Start all new file types at **`version: 1`**.
- Increment when making **breaking** or **structural** changes (field rename, type change, required field added without default).
- Non-breaking additions (optional new fields) may stay on same version if old app versions ignore unknown fields safely — prefer bumping version when in doubt.
- App version (SemVer) and JSON schema version are **independent**. Document compatibility in the changelog below.

---

## Migration policy

### On library open

1. Read each config file's `version`.
2. If `version` < app's supported version for that file type, run migrator chain (`v1 → v2 → … → current`).
3. Write migrated file back to disk **only after** successful validation.
4. Log migration actions to a local app log (not sent anywhere).

### On material read

1. If `metadata.json` version is older, migrate in memory first.
2. Persist upgraded metadata on next explicit save (or prompt if migration is non-trivial).

### User safety

| Scenario | Behavior |
|----------|----------|
| Add optional field | Silent migration; backup optional |
| Rename/remove field | Migrate with backup; show summary if data transformed |
| Destructive change | Prompt user before write; offer export backup |
| Unknown newer version | Read-only mode with clear message: "Library created with newer CertTrace" |

### Backups

Before any on-disk migration, copy affected files to:

```txt
.certtrace/backups/<ISO8601-timestamp>/
```

Retain last N backups (configurable in app settings, default 5).

---

## Initial schemas (v1)

### `library.json` v1

```json
{
  "version": 1,
  "name": "Main Shop Materials",
  "idStrategy": "material-animal-number",
  "labelTemplate": "standard-qr",
  "searchAllFields": true
}
```

### `naming-rules.json` v1

See [id-system.md](id-system.md).

### `word-lists.json` v1

See [id-system.md](id-system.md).

### `metadata.json` v1

```json
{
  "version": 1,
  "id": "AL-falcon-104",
  "material": "6061-T6",
  "supplier": "McMaster",
  "heat": "A4921",
  "location": "Rack B2",
  "tags": ["aluminum"],
  "notes": "",
  "barcode": "AL-falcon-104",
  "createdAt": "2026-05-28T12:00:00.000Z",
  "updatedAt": "2026-05-28T12:00:00.000Z"
}
```

---

## Schema changelog

Document every bump here before implementation ships.

### `library.json`

| Version | App intro | Changes |
|---------|-----------|---------|
| **1** | v0.1.0 | Initial fields: name, idStrategy, labelTemplate, searchAllFields |

### `naming-rules.json`

| Version | App intro | Changes |
|---------|-----------|---------|
| **1** | v0.1.0 | strategies array, activeStrategyId, template tokens |

### `word-lists.json`

| Version | App intro | Changes |
|---------|-----------|---------|
| **1** | v0.1.0 | lists map of listId → { label, words[] } |

### `metadata.json`

| Version | App intro | Changes |
|---------|-----------|---------|
| **1** | v0.1.0 | Core material fields per spec |

---

## Implementation notes (Phase 1+)

- Define JSON Schema (or Zod) validators per file type per version in `packages/types`.
- Migrators live in `packages/library-engine` as pure functions: `(doc: v1) => v2`.
- Unit test each migrator with golden fixtures in `fixtures/libraries/`.
- Never migrate silently across major material identity changes (ID rename) without explicit user action.

---

## Revision history

| Date | Change |
|------|--------|
| 2026-05-28 | Initial versioning policy and v1 schemas |
