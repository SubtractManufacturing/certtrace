import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { Jimp, ResizeStrategy } from "jimp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(__dirname, "source");
const INSTALLER = join(__dirname, "installer");
const PUBLIC = join(__dirname, "..", "public");

/** Matches WixUI / NSIS default light chrome so black wizard text stays readable. */
const WHITE = 0xffffffff;
const SLATE_50 = 0xf8fafcff;

/**
 * NSIS is DPI-aware and stretches welcome/header bitmaps. Generate @3x so
 * HiDPI displays stay sharp and closer to the MSI's crisp mark.
 */
const NSIS_SCALE = 3;

/** Tauri default DMG icon centers (bundle.macOS.dmg appPosition / applicationFolderPosition). */
const DMG_WIDTH = 660;
const DMG_HEIGHT = 400;
const DMG_APP_ICON = { x: 180, y: 170 };
const DMG_APPLICATIONS_ICON = { x: 480, y: 170 };

mkdirSync(INSTALLER, { recursive: true });
mkdirSync(PUBLIC, { recursive: true });

function renderSvg(filename, width) {
  const svg = readFileSync(join(SOURCE, filename), "utf8");
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    background: "transparent",
  });
  return resvg.render().asPng();
}

function createCanvas(width, height, color) {
  return new Jimp({ width, height, color });
}

async function readPng(buffer) {
  return Jimp.read(buffer);
}

/** High-quality downscale — default nearest-neighbor makes installer marks look jagged. */
async function fitWithin(image, maxWidth, maxHeight) {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  if (scale < 1) {
    image.resize({
      w: Math.max(1, Math.round(image.width * scale)),
      h: Math.max(1, Math.round(image.height * scale)),
      mode: ResizeStrategy.BICUBIC,
    });
  }
  return image;
}

/** Square app icon for tight header/banner slots (inner wizard pages). */
async function renderAppIcon(maxSize) {
  const renderWidth = Math.max(512, maxSize * 4);
  return fitWithin(await readPng(renderSvg("app-icon.svg", renderWidth)), maxSize, maxSize);
}

/**
 * Stacked installer mark (icon + wordmark). Use separate width/height bounds —
 * a square box shrinks tall artwork and makes the text unreadable.
 */
async function renderMark(maxWidth, maxHeight) {
  const renderWidth = Math.max(512, maxWidth * 4);
  return fitWithin(
    await readPng(renderSvg("installer-mark.svg", renderWidth)),
    maxWidth,
    maxHeight,
  );
}

async function writeAsset(canvas, filename) {
  await canvas.write(join(INSTALLER, filename));
}

/**
 * WiX dialogImagePath is a FULL-BLEED background for Welcome + Finish.
 * Wizard title/body text is drawn on top — keep the upper-right area empty and light.
 */
async function createWixDialogBackground() {
  const canvas = createCanvas(493, 312, WHITE);
  const mark = await renderMark(160, 250);
  canvas.composite(mark, 24, 16);
  return canvas;
}

/**
 * WiX bannerPath sits behind page titles on inner pages.
 * Titles are left-aligned — brand only on the far right.
 */
async function createWixBanner() {
  const canvas = createCanvas(493, 58, WHITE);
  const icon = await renderAppIcon(48);
  canvas.composite(icon, 493 - icon.width - 12, Math.round((58 - icon.height) / 2));
  return canvas;
}

/**
 * NSIS welcome/finish left strip — text lives to the right of this panel.
 * Use white (not brand blue) so the page reads like the MSI all-white welcome,
 * with a top-aligned mark beside the heading.
 */
async function createNsisSidebar() {
  const width = 164 * NSIS_SCALE;
  const height = 314 * NSIS_SCALE;
  const canvas = createCanvas(width, height, WHITE);
  const mark = await renderMark(148 * NSIS_SCALE, 255 * NSIS_SCALE);
  const x = Math.round((width - mark.width) / 2);
  const y = 16 * NSIS_SCALE;
  canvas.composite(mark, x, y);
  return canvas;
}

/**
 * NSIS headerImage sits beside page titles on inner pages (left of title text).
 * Keep white chrome + a small crisp mark, MSI-like in weight.
 */
async function createNsisHeader() {
  const width = 150 * NSIS_SCALE;
  const height = 57 * NSIS_SCALE;
  const canvas = createCanvas(width, height, WHITE);
  const icon = await renderAppIcon(44 * NSIS_SCALE);
  const x = 10 * NSIS_SCALE;
  const y = Math.round((height - icon.height) / 2);
  canvas.composite(icon, x, y);
  return canvas;
}

/** Classic drag arrow for the DMG middle band (app → Applications). */
function renderArrowPng(width, height) {
  const pad = 2;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const shaftH = Math.round(innerH * 0.28);
  const headW = Math.round(innerW * 0.3);
  const cy = pad + innerH / 2;
  const tailR = 3;
  // Small, deliberate head radii — enough to soften, not enough to blob.
  const tipR = 4;
  const baseR = 4;
  const headBaseX = pad + innerW - headW;
  const tipX = pad + innerW;
  const headTop = pad;
  const headBot = pad + innerH;
  const shaftEnd = headBaseX + Math.round(headW * 0.22);
  const shaftTop = cy - shaftH / 2;
  const shaftBot = cy + shaftH / 2;

  // Triangle A (top base) → B (tip) → C (bottom base), with short quadratic fillets.
  const abLen = Math.hypot(tipX - headBaseX, cy - headTop);
  const cbLen = Math.hypot(tipX - headBaseX, cy - headBot);
  const abx = (tipX - headBaseX) / abLen;
  const aby = (cy - headTop) / abLen;
  const cbx = (tipX - headBaseX) / cbLen;
  const cby = (cy - headBot) / cbLen;
  const tipFromA = { x: tipX - abx * tipR, y: cy - aby * tipR };
  const tipFromC = { x: tipX - cbx * tipR, y: cy - cby * tipR };
  const aAlongAB = { x: headBaseX + abx * baseR, y: headTop + aby * baseR };
  const cAlongCB = { x: headBaseX + cbx * baseR, y: headBot + cby * baseR };

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <path
    fill="#0C5390"
    d="M ${pad + tailR} ${shaftTop}
       H ${shaftEnd}
       V ${shaftBot}
       H ${pad + tailR}
       A ${tailR} ${tailR} 0 0 1 ${pad} ${shaftBot - tailR}
       V ${shaftTop + tailR}
       A ${tailR} ${tailR} 0 0 1 ${pad + tailR} ${shaftTop}
       Z"
  />
  <path
    fill="#0C5390"
    d="M ${aAlongAB.x} ${aAlongAB.y}
       L ${tipFromA.x} ${tipFromA.y}
       Q ${tipX} ${cy} ${tipFromC.x} ${tipFromC.y}
       L ${cAlongCB.x} ${cAlongCB.y}
       Q ${headBaseX} ${headBot} ${headBaseX} ${headBot - baseR}
       V ${headTop + baseR}
       Q ${headBaseX} ${headTop} ${aAlongAB.x} ${aAlongAB.y}
       Z"
  />
</svg>`;
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    background: "transparent",
  });
  return resvg.render().asPng();
}

/**
 * DMG window background: light slate, blue drag arrow between default icon slots,
 * submark centered near the bottom. Finder draws the interactive icons on top.
 */
async function createDmgBackground() {
  const canvas = createCanvas(DMG_WIDTH, DMG_HEIGHT, SLATE_50);

  const arrow = await readPng(renderArrowPng(120, 44));
  const arrowX = Math.round((DMG_APP_ICON.x + DMG_APPLICATIONS_ICON.x) / 2 - arrow.width / 2);
  const arrowY = Math.round(DMG_APP_ICON.y - arrow.height / 2);
  canvas.composite(arrow, arrowX, arrowY);

  // ~15% smaller than the first pass; extra bottom inset clears Finder's status bar.
  const submark = await fitWithin(await readPng(renderSvg("submark.svg", 640)), 240, 40);
  const submarkX = Math.round((DMG_WIDTH - submark.width) / 2);
  const submarkY = DMG_HEIGHT - submark.height - 72;
  canvas.composite(submark, submarkX, submarkY);

  return canvas;
}

async function main() {
  await writeAsset(await createNsisSidebar(), "nsis-sidebar.bmp");
  await writeAsset(await createNsisHeader(), "nsis-header.bmp");
  await writeAsset(await createWixBanner(), "wix-banner.bmp");
  await writeAsset(await createWixDialogBackground(), "wix-dialog.bmp");
  await writeAsset(await createDmgBackground(), "dmg-background.png");

  copyFileSync(join(SOURCE, "app-icon.svg"), join(PUBLIC, "app-icon.svg"));
  copyFileSync(join(SOURCE, "installer-mark.svg"), join(PUBLIC, "installer-mark.svg"));
  copyFileSync(join(SOURCE, "logo-horizontal.svg"), join(PUBLIC, "logo-horizontal.svg"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
