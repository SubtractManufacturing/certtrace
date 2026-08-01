# CertTrace Phase 3 QA Checklist

Use this checklist before beta releases on the **0.0.x** line and when validating in-app updates (`older → newer` on published builds).

## Core workflow smoke test

Run on macOS, Windows, and Linux:

- [ ] Create a new library
- [ ] Add a material
- [ ] Attach a PDF or image certification file
- [ ] Search for the material by ID and metadata
- [ ] Export a label PDF
- [ ] Open the material folder in the system file manager

## Offline behavior

- [ ] Disconnect from the network
- [ ] Open an existing library
- [ ] Search, edit metadata, attach files, and export labels without errors
- [ ] Confirm no unexpected network requests during core library operations

## Shared / network library

- [ ] Open a library on a network share or synced folder (SMB, Google Drive, OneDrive, etc.)
- [ ] Add or edit a material on machine A
- [ ] Confirm machine B sees the change after refresh or file-watch update

## Large library stress

- [ ] Open or create a library with approximately 5,000 materials
- [ ] Confirm search remains responsive
- [ ] Confirm library refresh/file-watch does not freeze the UI

## Linux desktop environments

- [ ] Smoke test on at least one major Linux desktop environment (GNOME or KDE)
- [ ] Confirm file dialogs, folder open, and printing behave acceptably

## Update UX

- [x] With automatic updates enabled, confirm the app checks on launch without blocking library work
- [x] Manual “Look for updates” in Settings reports current/latest state correctly
- [x] Update dialog shows version and release notes snippet
- [x] “Later” dismisses the dialog without side effects

## Updater dry run (`0.0.x` published builds)

Verified 2026-07-31 on a maintainer test machine (in-app dialog, download, install, relaunch).

- [x] Install a published older build on a test machine
- [x] Publish a newer release with signed updater artifacts and `latest.json` (`desktop-v0.0.1` → `desktop-v0.0.3`)
- [x] Confirm in-app update downloads, installs, and relaunches successfully
- [ ] Confirm library data and settings survive the update (not explicitly re-checked after last dry run)
- [ ] Repeat on each target platform (macOS, Windows, Linux)

## Privacy verification

- [ ] Review outbound network traffic during normal use and update checks
- [ ] Confirm there is no telemetry, analytics, or crash reporting
- [ ] Confirm update checks only occur when enabled by the user

## Release artifacts

- [x] GitHub Release contains macOS, Windows, and Linux installers
- [x] GitHub Release contains `latest.json` and signature sidecars
- [x] README install instructions match the published asset names
