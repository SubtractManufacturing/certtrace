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

async function main() {
  await writeAsset(await createNsisSidebar(), "nsis-sidebar.bmp");
  await writeAsset(await createNsisHeader(), "nsis-header.bmp");
  await writeAsset(await createWixBanner(), "wix-banner.bmp");
  await writeAsset(await createWixDialogBackground(), "wix-dialog.bmp");

  const dmgBackground = createCanvas(660, 400, SLATE_50);
  const logo = await fitWithin(await readPng(renderSvg("logo-horizontal.svg", 640)), 300, 64);
  dmgBackground.composite(logo, Math.round((660 - logo.width) / 2), 56);
  await dmgBackground.write(join(INSTALLER, "dmg-background.png"));

  copyFileSync(join(SOURCE, "app-icon.svg"), join(PUBLIC, "app-icon.svg"));
  copyFileSync(join(SOURCE, "logo-horizontal.svg"), join(PUBLIC, "logo-horizontal.svg"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
