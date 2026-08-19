import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNodeFileSystem } from "@certtrace/file-storage/node";
import {
  FIELD_SCHEMA_JSON,
  LIBRARY_JSON,
  NAMING_RULES_JSON,
  WORD_LISTS_JSON,
} from "@certtrace/types";
import { describe, expect, it } from "vitest";
import { LibraryError } from "../src/errors.js";
import {
  assertRestoreDestinationFree,
  findLibraryRootPrefix,
  libraryBackupSuggestedFileName,
  libraryRestoreDestination,
  normalizeZipPath,
  parseLibraryNameFromConfigJson,
  shouldIncludeInLibraryBackup,
} from "../src/library-backup.js";

const REQUIRED = [LIBRARY_JSON, NAMING_RULES_JSON, WORD_LISTS_JSON, FIELD_SCHEMA_JSON] as const;

function requiredAtPrefix(prefix: string): string[] {
  if (!prefix) {
    return [...REQUIRED];
  }
  return REQUIRED.map((file) => `${prefix}/${file}`);
}

describe("normalizeZipPath", () => {
  it("uses forward slashes and strips a leading ./", () => {
    expect(normalizeZipPath(".\\.certtrace\\library.json")).toBe(".certtrace/library.json");
    expect(normalizeZipPath("./materials/AL-1/metadata.json")).toBe("materials/AL-1/metadata.json");
  });
});

describe("shouldIncludeInLibraryBackup", () => {
  it("omits internal config snapshots and desktop junk files", () => {
    expect(shouldIncludeInLibraryBackup(".certtrace/library.json")).toBe(true);
    expect(shouldIncludeInLibraryBackup("materials/AL-1/cert.pdf")).toBe(true);
    expect(shouldIncludeInLibraryBackup(".certtrace/backups")).toBe(false);
    expect(shouldIncludeInLibraryBackup(".certtrace/backups/2026-01-01/library.json")).toBe(false);
    expect(shouldIncludeInLibraryBackup(".DS_Store")).toBe(false);
    expect(shouldIncludeInLibraryBackup("materials/.DS_Store")).toBe(false);
    expect(shouldIncludeInLibraryBackup("Thumbs.db")).toBe(false);
    expect(shouldIncludeInLibraryBackup("materials/Thumbs.db")).toBe(false);
  });
});

describe("findLibraryRootPrefix", () => {
  it("returns an empty prefix for files at the ZIP root", () => {
    expect(findLibraryRootPrefix(requiredAtPrefix(""))).toBe("");
  });

  it("returns a single wrapping folder prefix", () => {
    expect(findLibraryRootPrefix(requiredAtPrefix("Shop Materials"))).toBe("Shop Materials");
  });

  it("rejects a ZIP that is not a CertTrace library", () => {
    expect(() => findLibraryRootPrefix(requiredAtPrefix("").slice(0, 3))).toThrow(
      new LibraryError("This ZIP is not a CertTrace library."),
    );
    expect(() => findLibraryRootPrefix(requiredAtPrefix("nested/Shop Materials"))).toThrow(
      new LibraryError("This ZIP is not a CertTrace library."),
    );
  });

  it("rejects a ZIP that contains more than one CertTrace library", () => {
    expect(() =>
      findLibraryRootPrefix([...requiredAtPrefix("LibA"), ...requiredAtPrefix("LibB")]),
    ).toThrow(new LibraryError("This ZIP contains more than one CertTrace library."));
  });
});

describe("libraryBackupSuggestedFileName", () => {
  it("uses the library folder name and the local calendar date", () => {
    expect(libraryBackupSuggestedFileName("Main Shop", new Date(2026, 7, 19, 22, 0, 0))).toBe(
      "Main Shop backup 2026-08-19.zip",
    );
  });
});

describe("libraryRestoreDestination", () => {
  it("places a sanitized library folder under the chosen parent", () => {
    expect(libraryRestoreDestination("C:\\Users\\shop\\Documents", "Main Shop")).toBe(
      "C:\\Users\\shop\\Documents\\Main Shop",
    );
  });
});

describe("parseLibraryNameFromConfigJson", () => {
  it("reads the library name from library.json", () => {
    expect(parseLibraryNameFromConfigJson('{"name":"Main Shop","version":4}')).toBe("Main Shop");
  });

  it("rejects config that is not a readable library name", () => {
    expect(() => parseLibraryNameFromConfigJson("{")).toThrow(
      new LibraryError("This ZIP is not a CertTrace library."),
    );
    expect(() => parseLibraryNameFromConfigJson('{"version":4}')).toThrow(
      new LibraryError("This ZIP is not a CertTrace library."),
    );
  });
});

describe("assertRestoreDestinationFree", () => {
  it("rejects a destination that already exists and allows a missing path", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-restore-dest-"));

    try {
      const occupied = join(parentDir, "Main Shop");
      await fs.mkdir(occupied, { recursive: true });
      await expect(assertRestoreDestinationFree(fs, occupied)).rejects.toThrow(
        new LibraryError(`A folder already exists at ${occupied}`),
      );

      const asFile = join(parentDir, "file-in-the-way");
      await writeFile(asFile, "nope");
      await expect(assertRestoreDestinationFree(fs, asFile)).rejects.toThrow(
        new LibraryError(`A folder already exists at ${asFile}`),
      );

      await expect(
        assertRestoreDestinationFree(fs, join(parentDir, "Fresh Copy")),
      ).resolves.toBeUndefined();
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });
});
