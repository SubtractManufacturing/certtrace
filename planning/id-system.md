# CertTrace — Identifier System Design

> **Status:** Draft  
> **Last updated:** 2026-05-28  
> **Related:** [decisions.md](decisions.md), [schema-versioning.md](schema-versioning.md), [spec.md](spec.md) §Identifier generation

This document extends the spec's identifier section with the **wizard-driven, user-configurable** model.

---

## Goals

1. Non-technical shop staff can set up ID rules without editing JSON.
2. Built-in presets work out of the box and use the **same format** as user-created configs.
3. Users can duplicate, rename, modify, or delete any preset (including shipped defaults).
4. Generated IDs are **unique** within a library.
5. Config files are versioned for forward migration.

---

## Storage layout (per library)

```txt
Main Shop/
  .certtrace/
    library.json          # library name, active idStrategy ref, etc.
    naming-rules.json     # template definitions
    word-lists.json       # named word categories
  materials/
    AL-falcon-104/
      metadata.json
      cert.pdf
```

---

## Word lists (`word-lists.json`)

Users define named categories of words. Examples:

- `animals` → falcon, river, hammer, …
- `adjectives` → blue, swift, …
- `colors` → red, slate, …
- `cities` → denver, toledo, …

Users may create **any category name** they want. The wizard labels these in plain language ("Word category: Animals").

### Example structure (v1)

```json
{
  "version": 1,
  "lists": {
    "animals": {
      "label": "Animals",
      "words": ["falcon", "river", "hammer", "oak"]
    },
    "adjectives": {
      "label": "Adjectives",
      "words": ["blue", "swift", "prime"]
    }
  }
}
```

### Built-in defaults

Ship a default `word-lists.json` (or embedded seed) with common categories. On library creation, copy defaults into the library. User edits do not affect other libraries.

---

## Naming rules (`naming-rules.json`)

A **naming rule** (strategy) defines how new material IDs are composed.

### Example structure (v1)

```json
{
  "version": 1,
  "strategies": [
    {
      "id": "material-animal-number",
      "label": "Material + Animal + Number",
      "template": "{material}-{animal}-{number}",
      "numberPad": 3,
      "case": "lower"
    },
    {
      "id": "numeric",
      "label": "Numeric only",
      "template": "{number}",
      "numberStart": 10001,
      "numberPad": 0
    }
  ],
  "activeStrategyId": "material-animal-number"
}
```

### Template tokens

| Token | Source | Notes |
|-------|--------|-------|
| `{number}` | Auto-increment counter | Unique per library; optional pad/start |
| `{material}` | User input at material creation | Often alloy or stock code (e.g. `6061`, `AL`) |
| `{year}` | Current year | `2026` |
| `{month}` | Current month | `05` |
| `{day}` | Current day | `28` |
| `{word:<listId>}` | Random pick from word list | e.g. `{word:animals}` → `falcon` |
| Literal text | `-`, `.`, `_` between tokens | Separators in template string |

Legacy shorthand from spec (`{animal}`) maps to `{word:animals}` when that list exists.

### Shipped presets (same mechanism)

All spec presets are entries in `strategies`:

| Preset ID | Template (conceptual) |
|-----------|------------------------|
| `numeric` | `{number}` |
| `prefix-numeric` | `{material}-{number}` |
| `date-based` | `{material}-{year}{month}{day}-{number}` |
| `word-pair` | `{word:adjectives}-{word:animals}` |
| `three-word` | `{word:adjectives}.{word:animals}.{word:cities}` |
| `animal-number` | `{word:animals}-{number}` |
| `material-animal-number` | `{material}-{word:animals}-{number}` |

Users duplicate any preset to create `{material}-{word:adjectives}-{word:colors}-{number}` or similar.

---

## ID generation algorithm

1. Load active strategy from `naming-rules.json`.
2. Resolve each token:
   - `{number}`: next available integer (respect `numberStart`, `numberPad`).
   - `{word:*}`: cryptographically fair or simple random pick from list.
   - `{material}`: from intake form field.
   - Date tokens: from current date at generation time.
3. Apply `case` rule (`lower`, `upper`, `preserve`).
4. Check uniqueness against existing material folder names / IDs.
5. If collision, retry (increment `{number}` or re-roll word tokens) up to a sensible limit.
6. Return final ID string; create `materials/<id>/` on commit.

---

## Wizard UX (summary)

### Create library — ID step

1. Show preset cards with **live preview samples** (e.g. `AL-falcon-104`, `10042`).
2. "Custom" opens template builder.
3. Selected strategy ID saved to `library.json` as `idStrategy`.

### Template builder

1. Name the strategy.
2. Add segments via UI:
   - "Material field" → `{material}`
   - "Random from category" → pick list → `{word:animals}`
   - "Sequential number" → `{number}` with optional padding
   - "Separator" → `-` or `.`
3. Live preview regenerates sample IDs on each change.
4. Save to `naming-rules.json`.

### Word list editor

1. Pick or create category name.
2. Add words (textarea bulk paste or single add).
3. Save to `word-lists.json`.

---

## Barcode field

Material `barcode` defaults to the material `id` unless overridden. Label PDF uses barcode + QR encoding the ID (see spec §Labels).

---

## Validation rules

- Strategy `id` must be unique within `naming-rules.json`.
- Word list keys must be unique; non-empty `words` arrays.
- Template must include at least one `{number}` **or** sufficient entropy tokens to avoid exhaustion (warn in UI if only two short word lists).
- Material folder name must match ID (filesystem-safe characters only — document allowed charset in schema v1).

---

## Migration

When `naming-rules.json` or `word-lists.json` version is older than app support, run migrator on library open. See [schema-versioning.md](schema-versioning.md).

Existing materials are **never renamed** automatically when rules change; new rules apply only to new materials.

---

## Revision history

| Date | Change |
|------|--------|
| 2026-05-28 | Initial design: word lists, naming rules, wizard UX, built-in presets |
