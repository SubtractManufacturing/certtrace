# DMG Installer Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Regenerate the macOS DMG background so it keeps light slate, drops the top horizontal logo, shows a bottom-centered submark, and draws a solid `#0C5390` drag arrow between the default Finder icon slots.

**Architecture:** All artwork stays in `apps/desktop/branding/generate-installer-assets.mjs`. The script paints a 660×400 slate canvas, composites a Resvg-rendered arrow SVG between Tauri’s default icon positions (app at 180,170; Applications at 480,170), composites `submark.svg` near the bottom, and writes `installer/dmg-background.png`. Tauri config path is unchanged.

**Tech Stack:** Node ESM, `@resvg/resvg-js`, `jimp` ^1.6, existing `pnpm branding:installer` script.

## Global Constraints

- Canvas: 660×400, background `#F8FAFC` (`SLATE_50`)
- Arrow color: solid `#0C5390`
- Submark source: `apps/desktop/branding/source/submark.svg`
- Do not use `logo-horizontal.svg` on the DMG background
- Do not change Windows NSIS/WiX assets
- Do not commit unless the user asks

---

### Task 1: Update DMG background generation

**Files:**
- Modify: `apps/desktop/branding/generate-installer-assets.mjs`
- Modify: `apps/desktop/branding/installer/dmg-background.png` (regenerated output)
- Test: run generator + inspect PNG dimensions/content
- Reference: `docs/superpowers/specs/2026-07-21-dmg-installer-background-design.md`

**Interfaces:**
- Consumes: existing `renderSvg`, `createCanvas`, `fitWithin`, `readPng`, `BRAND_BLUE` / slate constants, Tauri default icon centers `(180,170)` and `(480,170)`
- Produces: `createDmgBackground()` writing `dmg-background.png`; helper that renders a filled left-to-right arrow PNG via inline SVG + Resvg

- [x] **Step 1: Add arrow + DMG helpers in the generator**

Replace the inline DMG block in `main()` with a dedicated `createDmgBackground()` that:

1. Creates 660×400 canvas with `SLATE_50`
2. Renders an inline SVG arrow (~160×40) filled `#0C5390` (thick shaft + triangular head)
3. Composites the arrow centered between icon slots: midpoint x `((180+480)/2)=330`, y `170`
4. Renders `submark.svg` (~280px wide max), composites centered near bottom (~y 330)
5. Does not composite `logo-horizontal.svg`

```js
const DMG_WIDTH = 660;
const DMG_HEIGHT = 400;
const DMG_APP_ICON = { x: 180, y: 170 };
const DMG_APPLICATIONS_ICON = { x: 480, y: 170 };

function renderArrowPng(width, height) {
  const shaftH = Math.round(height * 0.28);
  const headW = Math.round(width * 0.28);
  const shaftW = width - headW;
  const cy = height / 2;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="0" y="${cy - shaftH / 2}" width="${shaftW}" height="${shaftH}" fill="#0C5390"/>
  <polygon points="${shaftW},0 ${width},${cy} ${shaftW},${height}" fill="#0C5390"/>
</svg>`;
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: width }, background: "transparent" });
  return resvg.render().asPng();
}

async function createDmgBackground() {
  const canvas = createCanvas(DMG_WIDTH, DMG_HEIGHT, SLATE_50);

  const arrow = await readPng(renderArrowPng(160, 48));
  const arrowX = Math.round((DMG_APP_ICON.x + DMG_APPLICATIONS_ICON.x) / 2 - arrow.width / 2);
  const arrowY = Math.round(DMG_APP_ICON.y - arrow.height / 2);
  canvas.composite(arrow, arrowX, arrowY);

  const submark = await fitWithin(await readPng(renderSvg("submark.svg", 640)), 280, 48);
  const submarkX = Math.round((DMG_WIDTH - submark.width) / 2);
  const submarkY = DMG_HEIGHT - submark.height - 36;
  canvas.composite(submark, submarkX, submarkY);

  return canvas;
}
```

Wire `main()` to `await writeAsset(await createDmgBackground(), "dmg-background.png")` (or equivalent `.write` path used today).

- [x] **Step 2: Regenerate the asset**

Run: `pnpm --filter @certtrace/desktop branding:installer`  
Expected: exits 0; `apps/desktop/branding/installer/dmg-background.png` updated.

- [x] **Step 3: Verify output**

- PNG is 660×400
- No horizontal logo at top
- Blue arrow near vertical center between left/right icon slots
- Submark near bottom center
- Windows `.bmp` outputs still regenerated unchanged in role

- [x] **Step 4: Mark spec status approved**

Set `Status: approved` in `docs/superpowers/specs/2026-07-21-dmg-installer-background-design.md`.

- [ ] **Step 5: Commit only if user asks**

Do not commit by default.
