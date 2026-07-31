# Changelog

## [0.0.3](https://github.com/SubtractManufacturing/certtrace/compare/desktop-v0.0.2...desktop-v0.0.3) (2026-07-31)


### Features

* Add library-owned Label Templates — named recipes of label size plus Material content (optional QR/barcode), with starters (`4×6 in` default, `8.5×11 in`, `3×1 in`) and migration from the old `standard-qr` setting ([#100](https://github.com/SubtractManufacturing/certtrace/pull/100))
* Edit Label Templates in Library Settings — create/rename/delete, set the default, choose catalog or custom size (in/mm), toggle and reorder content with per-slot align and size, and preview live with a sample or real Material ([#100](https://github.com/SubtractManufacturing/certtrace/pull/100))
* Preview Labels before print or export — pick a template, see overflow warnings, print via the system dialog, save PDF, or jump to Edit templates ([#100](https://github.com/SubtractManufacturing/certtrace/pull/100))
* Add **Print and Add** when creating a Material — save and open the Label preview in one step without interrupting bulk entry ([#100](https://github.com/SubtractManufacturing/certtrace/pull/100))
* Pack wide/short labels into columns so more content stays readable on sizes like `3×1` ([#100](https://github.com/SubtractManufacturing/certtrace/pull/100))

### Bug Fixes

* Honor barcode left/center/right alignment on Labels ([#100](https://github.com/SubtractManufacturing/certtrace/pull/100))
* Keep Label PDF export if a QR or barcode fails to render — skip the failed code and show a warning instead of aborting ([#100](https://github.com/SubtractManufacturing/certtrace/pull/100))

## [0.0.2](https://github.com/SubtractManufacturing/certtrace/compare/desktop-v0.0.1...desktop-v0.0.2) (2026-07-31)


### Bug Fixes

* Await library refresh before closing deleted material ([ea82e43](https://github.com/SubtractManufacturing/certtrace/commit/ea82e438b9e35fe8a402eee04cdc1324ec39b5a2))
* Delete individual materials from the detail panel ([ea82e43](https://github.com/SubtractManufacturing/certtrace/commit/ea82e438b9e35fe8a402eee04cdc1324ec39b5a2))
* Re-enable deleting individual materials from the detail panel ([ea82e43](https://github.com/SubtractManufacturing/certtrace/commit/ea82e438b9e35fe8a402eee04cdc1324ec39b5a2))

## [0.0.1](https://github.com/SubtractManufacturing/certtrace/compare/desktop-v0.0.0...desktop-v0.0.1) (2026-07-30)


### Bug Fixes

* Test version bump with release-please ([4215a35](https://github.com/SubtractManufacturing/certtrace/commit/4215a351bc899c1ac6443a39eb31251000b76a0e))

## Changelog
