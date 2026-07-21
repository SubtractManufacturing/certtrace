import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { checkAppVersions, syncAppVersions } from "./sync-app-version.mjs";

const fixtures = [];

function createFixture({ desktopVersion, tauriVersion, cargoVersion }) {
  const root = mkdtempSync(path.join(tmpdir(), "certtrace-sync-version-"));
  fixtures.push(root);

  const desktopDir = path.join(root, "apps/desktop");
  const tauriDir = path.join(desktopDir, "src-tauri");
  mkdirSync(tauriDir, { recursive: true });

  writeFileSync(
    path.join(desktopDir, "package.json"),
    `${JSON.stringify({ name: "@certtrace/desktop", version: desktopVersion }, null, 2)}\n`,
  );
  writeFileSync(
    path.join(tauriDir, "tauri.conf.json"),
    `${JSON.stringify({ productName: "CertTrace", version: tauriVersion }, null, 2)}\n`,
  );
  writeFileSync(
    path.join(tauriDir, "Cargo.toml"),
    `[package]\nname = "certtrace-desktop"\nversion = "${cargoVersion}"\n`,
  );

  return root;
}

afterEach(() => {
  while (fixtures.length > 0) {
    rmSync(fixtures.pop(), { recursive: true, force: true });
  }
});

describe("checkAppVersions", () => {
  it("reports no drift when Tauri and Cargo match desktop package.json", () => {
    const root = createFixture({
      desktopVersion: "1.2.3",
      tauriVersion: "1.2.3",
      cargoVersion: "1.2.3",
    });

    const result = checkAppVersions(root);

    assert.equal(result.ok, true);
    assert.equal(result.version, "1.2.3");
    assert.deepEqual(result.mismatches, []);
  });

  it("reports drift when Tauri or Cargo versions differ", () => {
    const root = createFixture({
      desktopVersion: "1.0.2",
      tauriVersion: "0.0.0",
      cargoVersion: "0.0.0",
    });

    const result = checkAppVersions(root);

    assert.equal(result.ok, false);
    assert.equal(result.version, "1.0.2");
    assert.deepEqual(result.mismatches, [
      { file: "apps/desktop/src-tauri/tauri.conf.json", actual: "0.0.0" },
      { file: "apps/desktop/src-tauri/Cargo.toml", actual: "0.0.0" },
    ]);
  });
});

describe("syncAppVersions", () => {
  it("writes desktop package.json version into Tauri and Cargo files", () => {
    const root = createFixture({
      desktopVersion: "1.0.2",
      tauriVersion: "0.0.0",
      cargoVersion: "0.0.0",
    });

    const result = syncAppVersions(root);

    assert.equal(result.version, "1.0.2");
    assert.equal(
      JSON.parse(readFileSync(path.join(root, "apps/desktop/src-tauri/tauri.conf.json"), "utf8"))
        .version,
      "1.0.2",
    );
    assert.match(
      readFileSync(path.join(root, "apps/desktop/src-tauri/Cargo.toml"), "utf8"),
      /^version = "1\.0\.2"$/m,
    );
    assert.equal(checkAppVersions(root).ok, true);
  });

  it("preserves release-please annotation on the Cargo version line", () => {
    const root = createFixture({
      desktopVersion: "2.0.0",
      tauriVersion: "1.0.0",
      cargoVersion: "1.0.0",
    });
    const cargoPath = path.join(root, "apps/desktop/src-tauri/Cargo.toml");
    writeFileSync(
      cargoPath,
      `[package]\nname = "certtrace-desktop"\nversion = "1.0.0" # x-release-please-version\n`,
    );

    syncAppVersions(root);

    assert.equal(
      readFileSync(cargoPath, "utf8"),
      `[package]\nname = "certtrace-desktop"\nversion = "2.0.0" # x-release-please-version\n`,
    );
    assert.equal(checkAppVersions(root).ok, true);
  });

  it("succeeds when Tauri and Cargo are already at the desktop version", () => {
    const root = createFixture({
      desktopVersion: "1.0.2",
      tauriVersion: "1.0.2",
      cargoVersion: "1.0.2",
    });
    const cargoPath = path.join(root, "apps/desktop/src-tauri/Cargo.toml");
    writeFileSync(
      cargoPath,
      `[package]\nname = "certtrace-desktop"\nversion = "1.0.2" # x-release-please-version\n`,
    );

    const result = syncAppVersions(root);

    assert.equal(result.version, "1.0.2");
    assert.equal(
      readFileSync(cargoPath, "utf8"),
      `[package]\nname = "certtrace-desktop"\nversion = "1.0.2" # x-release-please-version\n`,
    );
    assert.equal(checkAppVersions(root).ok, true);
  });
});
