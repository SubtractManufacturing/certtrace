import { execSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

function syncPublicAssets() {
  copyFileSync(APP_ICON_SVG, join(PUBLIC_DIR, "app-icon.svg"));
  copyFileSync(LOGO_HORIZONTAL_SVG, join(PUBLIC_DIR, "logo-horizontal.svg"));
}

function runTauriIcon(inputSvg, outputDir) {
  mkdirSync(outputDir, { recursive: true });
  execSync(`pnpm tauri icon "${inputSvg}" -o "${outputDir}"`, {
    cwd: DESKTOP_ROOT,
    stdio: "inherit",
  });
}

function main() {
  rmSync(TEMP, { recursive: true, force: true });
  const macosOut = join(TEMP, "macos");

  console.log("Generating Windows/Linux PNG + ICO from windows-icon.svg...");
  runTauriIcon(WINDOWS_SVG, ICONS_DIR);

  console.log("Generating macOS ICNS from macos-icon.svg...");
  runTauriIcon(MACOS_SVG, macosOut);
  copyFileSync(join(macosOut, "icon.icns"), join(ICONS_DIR, "icon.icns"));

  console.log("Syncing public branding assets...");
  syncPublicAssets();

  rmSync(TEMP, { recursive: true, force: true });
  console.log("App icons written to src-tauri/icons/");
}

main();
