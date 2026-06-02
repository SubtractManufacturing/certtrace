#!/usr/bin/env node
/**
 * Keep desktop app version fields aligned with apps/desktop/package.json.
 * release-please bumps root + apps/desktop package.json; run this after those bumps.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const desktopPkgPath = path.join(repoRoot, "apps/desktop/package.json");
const desktopPkg = JSON.parse(readFileSync(desktopPkgPath, "utf8"));
const version = desktopPkg.version;

if (!version || typeof version !== "string") {
  console.error("apps/desktop/package.json is missing a version string");
  process.exit(1);
}

function syncJson(relativePath, mutator) {
  const filePath = path.join(repoRoot, relativePath);
  const data = JSON.parse(readFileSync(filePath, "utf8"));
  mutator(data);
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Updated ${relativePath} -> ${version}`);
}

function syncToml(relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  const contents = readFileSync(filePath, "utf8");
  const next = contents.replace(/^version = ".*"$/m, `version = "${version}"`);
  if (next === contents) {
    console.error(`Could not find version field in ${relativePath}`);
    process.exit(1);
  }
  writeFileSync(filePath, next);
  console.log(`Updated ${relativePath} -> ${version}`);
}

syncJson("apps/desktop/src-tauri/tauri.conf.json", (data) => {
  data.version = version;
});

syncToml("apps/desktop/src-tauri/Cargo.toml");
