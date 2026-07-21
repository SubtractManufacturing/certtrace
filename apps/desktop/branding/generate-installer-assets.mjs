import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { Jimp } from "jimp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(__dirname, "source");
const INSTALLER = join(__dirname, "installer");
const PUBLIC = join(__dirname, "..", "public");

/** Matches WixUI / NSIS default light chrome so black wizard text stays readable. */
const WHITE = 0xffffffff;
const SLATE_50 = 0xf8fafcff;
const BRAND_BLUE = 0x0c5390ff;

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

async function fitWithin(image, maxWidth, maxHeight) {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  if (scale < 1) {
    image.scale(scale);
  }
  return image;
}

async function writeAsset(canvas, filename) {
  await canvas.write(join(INSTALLER, filename));
}

/**
 * WiX dialogImagePath is a FULL-BLEED background for Welcome + Finish.
 * Wizard title/body text is drawn on top — keep the upper area empty and light.
 */
async function createWixDialogBackground() {
  const canvas = createCanvas(493, 312, WHITE);
  const icon = await fitWithin(await readPng(renderSvg("app-icon.svg", 256)), 100, 100);
  // Top-left, aligned with welcome/finish heading (text sits to the right).
  canvas.composite(icon, 36, 28);
  return canvas;
}

/**
 * WiX bannerPath sits behind page titles on inner pages.
 * Titles are left-aligned — brand only on the far right.
 */
async function createWixBanner() {
  const canvas = createCanvas(493, 58, WHITE);
  const icon = await fitWithin(await readPng(renderSvg("app-icon.svg", 128)), 40, 40);
  canvas.composite(icon, 493 - icon.width - 12, Math.round((58 - icon.height) / 2));
  return canvas;
}

/** NSIS welcome/finish left strip — text lives to the right of this panel. */
async function createNsisSidebar() {
  const canvas = createCanvas(164, 314, BRAND_BLUE);
  const icon = await fitWithin(await readPng(renderSvg("app-icon.svg", 256)), 88, 88);
  canvas.composite(icon, Math.round((164 - icon.width) / 2), Math.round((314 - icon.height) / 2));
  return canvas;
}

/**
 * NSIS headerImage is a small top-right bitmap; page titles sit to its left.
 * Keep it light with a modest mark.
 */
async function createNsisHeader() {
  const canvas = createCanvas(150, 57, WHITE);
  const icon = await fitWithin(await readPng(renderSvg("app-icon.svg", 128)), 36, 36);
  canvas.composite(icon, Math.round((150 - icon.width) / 2), Math.round((57 - icon.height) / 2));
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
  copyFileSync(join(SOURCE, "logo-horizontal.svg"), join(PUBLIC, "logo-horizontal.svg"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
