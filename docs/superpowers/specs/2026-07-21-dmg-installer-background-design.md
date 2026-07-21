# Design: macOS DMG installer background

Date: 2026-07-21  
Status: approved

## Problem

The macOS DMG window background currently places the horizontal CertTrace logo (`logo-horizontal.svg`) near the top of a light slate canvas. In the mounted Finder window that logo sits between the app icon and Applications alias and reads as small and tucked away. There is no drag arrow, so the install affordance is weaker than common macOS installer patterns (e.g. Firefox).

## Goals

- Keep the existing light slate DMG background (`#F8FAFC`)
- Remove the horizontal logo from the DMG background
- Place the submark (`submark.svg`) centered near the bottom of the window
- Draw a classic left-to-right drag arrow in brand blue `#0C5390` between the app icon and Applications alias
- Continue generating `dmg-background.png` from `apps/desktop/branding/generate-installer-assets.mjs`
- Keep Tauri’s existing `bundle.macOS.dmg.background` path unchanged

## Non-goals

- Changing Windows NSIS/WiX installer artwork
- Redesigning Finder icon positions unless a rebuild shows clear misalignment
- Hand-authored Figma/PNG as the source of truth (generator remains the pipeline)
- Colored/gradient DMG backgrounds (Firefox-style color field)

## Design

### Visual layout (660×400)

| Region | Content |
| --- | --- |
| Background | Solid light slate `#F8FAFC` |
| Top | Empty (no horizontal logo) |
| Middle | Clear space for Finder-drawn CertTrace.app (left) and Applications alias (right); solid `#0C5390` arrow between them |
| Bottom | `submark.svg` centered, large enough to read clearly without crowding icon labels |

Finder (via Tauri’s DMG bundler) still draws the interactive icons and labels. Only the static background PNG carries branding and the arrow.

### Arrow

- Style: classic thick horizontal shaft + triangular head (Firefox-like), not a thin chevron
- Color: solid `#0C5390` (same brand blue as the “Trace” portion of the submark)
- Placement: horizontally between the two icon slots; vertically aligned with the icons
- Implementation: drawn in the generator (Jimp geometry / filled polygons), not a separate source SVG unless later needed

### Submark

- Source: `apps/desktop/branding/source/submark.svg`
- Composite onto the canvas near the bottom center
- Do not use `logo-horizontal.svg` on the DMG background

### Pipeline

1. Update the DMG background generation in `apps/desktop/branding/generate-installer-assets.mjs`
2. Regenerate `apps/desktop/branding/installer/dmg-background.png`
3. Leave `apps/desktop/src-tauri/tauri.conf.json` `bundle.macOS.dmg.background` pointing at that file
4. Verify by building/opening a DMG (or mounting a local bundle) that arrow and submark clear the Finder icons and labels

### Alignment fallback

Default Tauri/Finder icon positions are assumed sufficient. If a rebuild shows the arrow or submark colliding with icons/labels, adjust arrow/submark coordinates in the generator first; only then consider explicit DMG window/icon position config if Tauri exposes it and defaults are wrong.

## Success criteria

- DMG window keeps light slate look
- No small top horizontal logo
- Submark visible and centered below the icons
- Blue drag arrow clearly indicates app → Applications
- Asset still produced by the existing generator script
