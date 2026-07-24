import { execSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { Jimp, ResizeStrategy } from "jimp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DESKTOP_ROOT = join(__dirname, "..");
const SOURCE = join(__dirname, "source");
const ICONS_DIR = join(DESKTOP_ROOT, "src-tauri", "icons");
const PUBLIC_DIR = join(DESKTOP_ROOT, "public");
const TEMP = join(__dirname, ".icon-gen-temp");

const MACOS_SVG = join(SOURCE, "macos-icon.svg");
const WINDOWS_SVG = join(SOURCE, "windows-icon.svg");
const APP_ICON_SVG = join(SOURCE, "app-icon.svg");
const LOGO_HORIZONTAL_SVG = join(SOURCE, "logo-horizontal.svg");

/**
 * macOS Dock does not auto-mask Tauri .icns icons. Bake Apple's content
 * extent + rounded-square silhouette into the master before `tauri icon`.
 *
 * - Canvas: 1024×1024
 * - Content extent: 824×824 centered (≈100px padding)
 * - Corner radius: 228 × (824/1024) ≈ 183 (Big Sur template proportion)
 */
const MACOS_CANVAS = 1024;
const MACOS_CONTENT = 824;
const MACOS_CORNER_RADIUS = Math.round((228 / MACOS_CANVAS) * MACOS_CONTENT);

function syncPublicAssets() {
  copyFileSync(APP_ICON_SVG, join(PUBLIC_DIR, "app-icon.svg"));
  copyFileSync(LOGO_HORIZONTAL_SVG, join(PUBLIC_DIR, "logo-horizontal.svg"));
}

function runTauriIcon(inputPath, outputDir) {
  mkdirSync(outputDir, { recursive: true });
  execSync(`pnpm tauri icon "${inputPath}" -o "${outputDir}"`, {
    cwd: DESKTOP_ROOT,
    stdio: "inherit",
  });
}

function renderSvgToPng(svgPath, width) {
  const svg = readFileSync(svgPath, "utf8");
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    background: "transparent",
  });
  return resvg.render().asPng();
}

/**
 * Coverage of pixel center (x+0.5, y+0.5) against an axis-aligned rounded rect.
 * Returns 1 inside, 0 outside, with ~1px AA at the edge.
 */
function roundedRectCoverage(px, py, left, top, size, radius) {
  const right = left + size;
  const bottom = top + size;
  const r = Math.min(radius, size / 2);

  const x = px + 0.5;
  const y = py + 0.5;

  // Distance to rounded-rect exterior (negative = inside).
  const cx = clamp(x, left + r, right - r);
  const cy = clamp(y, top + r, bottom - r);
  let dist;
  if (x >= left + r && x <= right - r && y >= top + r && y <= bottom - r) {
    dist = -Math.min(x - left, right - x, y - top, bottom - y);
  } else {
    const dx = x - cx;
    const dy = y - cy;
    dist = Math.hypot(dx, dy) - r;
  }

  // Soft 1px edge.
  return clamp(0.5 - dist, 0, 1);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function applyRoundedRectAlpha(image, left, top, size, radius) {
  image.scan((x, y, idx) => {
    const coverage = roundedRectCoverage(x, y, left, top, size, radius);
    const data = image.bitmap.data;
    data[idx + 3] = Math.round(data[idx + 3] * coverage);
  });
}

/**
 * Full-bleed master → Dock-correct PNG (inset + rounded-square alpha).
 */
async function shapeMacosIconMaster(svgPath, outPngPath) {
  const source = await Jimp.read(renderSvgToPng(svgPath, MACOS_CANVAS));
  if (source.width !== MACOS_CANVAS || source.height !== MACOS_CANVAS) {
    source.resize({
      w: MACOS_CANVAS,
      h: MACOS_CANVAS,
      mode: ResizeStrategy.BICUBIC,
    });
  }

  source.resize({
    w: MACOS_CONTENT,
    h: MACOS_CONTENT,
    mode: ResizeStrategy.BICUBIC,
  });

  const canvas = new Jimp({
    width: MACOS_CANVAS,
    height: MACOS_CANVAS,
    color: 0x00000000,
  });
  const offset = Math.round((MACOS_CANVAS - MACOS_CONTENT) / 2);
  canvas.composite(source, offset, offset);
  applyRoundedRectAlpha(canvas, offset, offset, MACOS_CONTENT, MACOS_CORNER_RADIUS);

  await canvas.write(outPngPath);
}

async function main() {
  rmSync(TEMP, { recursive: true, force: true });
  mkdirSync(TEMP, { recursive: true });
  const macosOut = join(TEMP, "macos");
  const shapedMaster = join(TEMP, "macos-icon-shaped.png");

  console.log("Generating Windows/Linux PNG + ICO from windows-icon.svg...");
  runTauriIcon(WINDOWS_SVG, ICONS_DIR);

  console.log(
    `Shaping macOS icon (content ${MACOS_CONTENT}px, radius ${MACOS_CORNER_RADIUS}px)...`,
  );
  await shapeMacosIconMaster(MACOS_SVG, shapedMaster);

  console.log("Generating macOS ICNS from shaped master...");
  runTauriIcon(shapedMaster, macosOut);
  copyFileSync(join(macosOut, "icon.icns"), join(ICONS_DIR, "icon.icns"));

  console.log("Syncing public branding assets...");
  syncPublicAssets();

  rmSync(TEMP, { recursive: true, force: true });
  console.log("App icons written to src-tauri/icons/");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
