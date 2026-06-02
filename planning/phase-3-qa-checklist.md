# CertTrace Phase 3 QA Checklist

Use this checklist before publishing `v0.1.0` and again when validating the updater dry run to `v0.1.1`.

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

- [ ] With automatic updates enabled, confirm the app checks on launch without blocking library work
- [ ] Manual “Look for updates” in Settings reports current/latest state correctly
- [ ] Update dialog shows version and release notes snippet
- [ ] “Later” dismisses the dialog without side effects

## Updater dry run (`v0.1.0` → `v0.1.1`)

- [ ] Install the published `v0.1.0` build on each target platform
- [ ] Publish `v0.1.1` with signed updater artifacts and `latest.json`
- [ ] Confirm in-app update downloads, installs, and relaunches successfully
- [ ] Confirm library data and settings survive the update

## Privacy verification

- [ ] Review outbound network traffic during normal use and update checks
- [ ] Confirm there is no telemetry, analytics, or crash reporting
- [ ] Confirm update checks only occur when enabled by the user

## Release artifacts

- [ ] GitHub Release contains macOS, Windows, and Linux installers
- [ ] GitHub Release contains `latest.json` and signature sidecars
- [ ] README install instructions match the published asset names
