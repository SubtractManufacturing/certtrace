# CertTrace — Design & Architecture Specification (v0.2 Draft)

> **Planning docs:** Locked decisions → [decisions.md](decisions.md) · UI direction → [ui-direction.md](ui-direction.md) · Phases → [roadmap.md](roadmap.md) · ID system → [id-system.md](id-system.md) · Schema versioning → [schema-versioning.md](schema-versioning.md)

## Overview

**CertTrace** is a lightweight desktop-first material certification tracking system for CNC manufacturing job shops.

It provides a fast UI for organizing and retrieving material certifications stored directly on disk.

Primary file types:

- PDF
- PNG
- JPG
- screenshots / scans
- optional other attachments

CertTrace is:

- local-first
- filesystem-backed
- portable
- installable on Windows, macOS, and Linux (all equally supported in v0.1)
- designed for multi-computer sync via shared folders
- architected to support a future server/web edition

Core workflow:

1. receive material
2. assign identifier
3. attach certification files
4. print QR/barcode label
5. store material
6. scan/search later
7. retrieve cert instantly

---

# Core principles

## 1. Local-first

All data can live entirely on disk.

No internet required.

No hosted backend required.

---

## 2. Human-readable

All metadata is stored as JSON.

Files remain directly accessible.

Nothing proprietary.

Users can inspect folders manually.

---

## 3. Thin UI over storage

CertTrace organizes files.

It does not hide them.

Everything remains visible in Finder / Explorer.

---

## 4. Portable libraries

A material library can live anywhere:

- local disk
- Google Drive
- OneDrive
- Dropbox
- NAS / SMB share
- external drive

Open library from any supported machine.

---

## 5. Future server compatibility

Desktop and future server/web versions share core logic.

Single codebase.

No rewrite required.

---

# Tech stack

## Desktop app

- Tauri
- React
- TypeScript
- Vite
- Tailwind CSS

---

## Shared packages

Monorepo architecture.

---

## Future server

Planned but not implemented.

Likely:

- Node + Fastify
- PostgreSQL
- S3 / MinIO

---

## Updates

GitHub Releases + updater

---

# Monorepo structure

```txt
certtrace/
  apps/
    desktop/
    web/
    server/

  packages/
    core/
    ui/
    types/
    library-engine/
    id-generator/
    file-storage/
    api-client/
```

---

# Package responsibilities

## packages/types

Shared TS types.

Examples:

- Material
- LibraryConfig
- AttachedFile
- LabelTemplate

---

## packages/core

Business logic.

Examples:

- search
- filtering
- metadata validation
- label rendering

---

## packages/library-engine

Library lifecycle.

Examples:

- open library
- validate structure
- load config
- file watching
- save metadata

---

## packages/id-generator

Generates identifiers.

Supports presets + templates.

---

## packages/file-storage

Storage abstraction.

Interface:

```ts
interface StorageProvider {
  list();
  read();
  write();
  delete();
}
```

Implementations:

- local filesystem
- shared drive
- future API
- future S3

---

## packages/ui

Reusable React components.

Examples:

- search bar
- material table
- file preview
- label preview

---

## packages/api-client

Future server communication.

Unused initially.

---

# Library architecture

CertTrace supports multiple independent libraries.

Examples:

- Main Shop Materials
- QA Archive
- Customer-owned Stock
- Personal Sandbox

Each library is self-contained.

---

# Library folder structure

Example:

```txt
Main Shop/
  .certtrace/
    library.json
    naming-rules.json
    labels/

  materials/
    AL-falcon-104/
      metadata.json
      cert.pdf
      photo.png
```

---

# Library config

Stored inside:

```txt
.certtrace/library.json
```

Example:

```json
{
  "name": "Main Shop Materials",
  "version": 1,
  "idStrategy": "material-animal-number",
  "labelTemplate": "standard-qr",
  "searchAllFields": true
}
```

Portable between machines.

---

# App settings

Stored per-machine.

Examples:

- theme
- update preferences
- recent libraries
- window layout
- scanner settings

Not stored inside library.

---

# Library management

## Startup screen

Show:

Recent libraries

Example:

```txt
Main Shop Materials
QA Archive
Sandbox
```

Actions:

- open library
- create library
- remove from recent

---

## Create library wizard

Steps:

1. library name
2. choose folder
3. naming convention
4. label template
5. create

---

# Material model

Example:

```json
{
  "id": "AL-falcon-104",
  "material": "6061-T6",
  "supplier": "McMaster",
  "heat": "A4921",
  "location": "Rack B2",
  "tags": ["aluminum"],
  "notes": "",
  "barcode": "AL-falcon-104",
  "createdAt": "",
  "updatedAt": ""
}
```

Stored:

```txt
materials/<id>/metadata.json
```

---

# File attachments

Stored alongside metadata.

Example:

```txt
metadata.json
cert.pdf
mill-test-report.pdf
photo.png
```

Supported:

- PDF
- PNG
- JPG
- TIFF optional
- generic attachments optional

---

# Identifier generation

Configurable per library. User-defined word lists and template wizards; built-in presets ship as editable defaults. Full design: [id-system.md](id-system.md).

---

## Presets

### Numeric

```txt
10001
```

---

### Prefix + numeric

```txt
AL-10001
```

---

### Date-based

```txt
AL-20260528-001
```

---

### Word pair

```txt
blue-hammer
```

---

### Three-word

```txt
blue.hammer.river
```

---

### Animal + number

```txt
falcon-104
```

---

### Material-aware

```txt
AL-falcon-104
```

---

## Custom templates

Examples:

```txt
{material}-{animal}-{number}
```

```txt
{year}-{word1}-{word2}
```

Generator guarantees uniqueness.

---

# Search

Search by:

- ID
- material
- supplier
- heat
- tags
- notes

Modes:

- current library (when a single library is selected in the sidebar)
- all libraries (when the library view is set to **All libraries** — search spans every open/recent library)

Instant filtering.

---

# Material detail view

Display:

- metadata
- attachments
- previews
- label preview

Actions:

- edit
- add files
- remove files
- regenerate label
- open folder

---

# Labels

Generate:

- QR code
- barcode

Contents:

- ID
- optional material
- optional rack location

Example:

```txt
[ QR ]

AL-falcon-104
6061-T6
Rack B2
```

Print:

- label printer
- normal printer

v0.1 delivers **PDF export**; printing via system print dialog. See [decisions.md](decisions.md).

---

# Scanning

> **v0.1:** Deferred. No USB scanner or camera integration in the first release. See [decisions.md](decisions.md).

Planned primary behavior:

USB barcode scanner → search field → open material

Future:

camera scanning

---

# File watching

Watch active libraries.

When files change externally:

- refresh automatically

Supports:

- Google Drive sync
- OneDrive sync
- network shares

---

# Error handling

Missing files

→ warning

Duplicate IDs

→ prompt

Invalid metadata

→ repair option

Unavailable network path

→ reconnect prompt

---

# Performance targets

Startup:

<2 sec

Search:

instant

Folder refresh:

<1 sec

Large library:

thousands of materials

---

# Future server architecture

Not part of MVP.

Planned support:

---

## apps/server

Provides API.

Examples:

```txt
GET /materials
POST /materials
```

---

## apps/web

Browser UI.

Shares components.

---

## Storage options

Server may use:

- PostgreSQL
- S3
- MinIO
- mounted disk

---

## Desktop connection mode

Later:

Settings:

```txt
Mode

○ Local Library
○ Connect to CertTrace Server
```

Same UI.

Different provider.

---

# MVP scope

Version 0.1

**Platforms:** macOS, Windows, and Linux (equal priority).

- library creation (wizard-driven; see [ui-direction.md](ui-direction.md))
- recent libraries
- configurable ID strategies and word lists (wizard-driven; see [id-system.md](id-system.md))
- metadata editing
- file attachments
- search (scoped to selected library or all libraries when view = all)
- label generation (PDF export)
- printing (via exported PDF / system print dialog)
- file preview
- file watching
- in-app update notification (GitHub Releases; optional check, offline-safe)

**Deferred from v0.1:**

- USB barcode scanner / camera scanning

---

# Future roadmap

- OCR on cert PDFs
- auto metadata extraction
- audit export
- customer/job linking
- server mode
- browser UI
- user permissions
- mobile companion

---

# Success criteria

Users can:

- create/open libraries quickly
- add certs in under 30 sec
- search and retrieve certs in under 5 sec
- print labels easily
- move libraries between machines
- work offline

CertTrace should feel:

- fast
- dependable
- obvious
- lightweight
- easy to maintain
