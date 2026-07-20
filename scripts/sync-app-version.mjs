#!/usr/bin/env node
/**
 * Keep desktop app version fields aligned with apps/desktop/package.json.
 * release-please bumps package.json (and Tauri/Cargo via extra-files); run this
 * after manual bumps, or use --check in CI to fail on drift.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TAURI_CONF = "apps/desktop/src-tauri/tauri.conf.json";
const CARGO_TOML = "apps/desktop/src-tauri/Cargo.toml";

function readDesktopVersion(repoRoot) {
  const desktopPkgPath = path.join(repoRoot, "apps/desktop/package.json");
  const desktopPkg = JSON.parse(readFileSync(desktopPkgPath, "utf8"));
  const version = desktopPkg.version;

  if (!version || typeof version !== "string") {
    throw new Error("apps/desktop/package.json is missing a version string");
  }

  return version;
}

function readTauriVersion(repoRoot) {
  const data = JSON.parse(readFileSync(path.join(repoRoot, TAURI_CONF), "utf8"));
  return typeof data.version === "string" ? data.version : null;
}

function readCargoVersion(repoRoot) {
  const contents = readFileSync(path.join(repoRoot, CARGO_TOML), "utf8");
  const match = contents.match(/^version = "([^"]*)"/m);
  return match?.[1] ?? null;
}

export function checkAppVersions(repoRoot) {
  const version = readDesktopVersion(repoRoot);
  const mismatches = [];

  const tauriVersion = readTauriVersion(repoRoot);
  if (tauriVersion !== version) {
    mismatches.push({ file: TAURI_CONF, actual: tauriVersion });
  }

  const cargoVersion = readCargoVersion(repoRoot);
  if (cargoVersion !== version) {
    mismatches.push({ file: CARGO_TOML, actual: cargoVersion });
  }

  return { ok: mismatches.length === 0, version, mismatches };
}

function syncJson(repoRoot, relativePath, version) {
  const filePath = path.join(repoRoot, relativePath);
  const data = JSON.parse(readFileSync(filePath, "utf8"));
  data.version = version;
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function syncToml(repoRoot, relativePath, version) {
  const filePath = path.join(repoRoot, relativePath);
  const contents = readFileSync(filePath, "utf8");
  // Preserve trailing comments (e.g. release-please annotations).
  const next = contents.replace(/^version = "[^"]*"/m, `version = "${version}"`);
  if (next === contents) {
    throw new Error(`Could not find version field in ${relativePath}`);
  }
  writeFileSync(filePath, next);
}

export function syncAppVersions(repoRoot) {
  const version = readDesktopVersion(repoRoot);
  syncJson(repoRoot, TAURI_CONF, version);
  syncToml(repoRoot, CARGO_TOML, version);
  return { version, files: [TAURI_CONF, CARGO_TOML] };
}

function defaultRepoRoot() {
  return fileURLToPath(new URL("..", import.meta.url));
}

function main(argv = process.argv.slice(2), repoRoot = defaultRepoRoot()) {
  const checkOnly = argv.includes("--check");

  try {
    if (checkOnly) {
      const result = checkAppVersions(repoRoot);
      if (!result.ok) {
        console.error(
          `App version drift detected (expected ${result.version} from apps/desktop/package.json):`,
        );
        for (const mismatch of result.mismatches) {
          console.error(`  ${mismatch.file}: ${mismatch.actual ?? "(missing)"}`);
        }
        console.error("Run `pnpm sync:version` and commit the result.");
        process.exitCode = 1;
        return;
      }
      console.log(`App versions in sync at ${result.version}`);
      return;
    }

    const result = syncAppVersions(repoRoot);
    for (const file of result.files) {
      console.log(`Updated ${file} -> ${result.version}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

const isDirectRun = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectRun) {
  main();
}
