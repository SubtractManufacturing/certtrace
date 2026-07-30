import { describe, expect, it } from "vitest";
import { isNotFoundError } from "../src/errors.js";

const WINDOWS_SETTINGS_READ_ERROR =
  "failed to open file at path: C:\\Users\\test\\AppData\\Roaming\\com.subtractmanufacturing.certtrace/settings.json with error: The system cannot find the path specified. (os error 3)";

const WINDOWS_SETTINGS_FILE_MISSING_ERROR =
  "failed to open file at path: C:\\Users\\test\\AppData\\Roaming\\com.subtractmanufacturing.certtrace/settings.json with error: The system cannot find the file specified. (os error 2)";

const WINDOWS_READDIR_ERROR =
  "failed to read directory at path: C:\\Users\\test\\Documents\\Main Shop Materials with error: The system cannot find the path specified. (os error 3)";

const MACOS_METADATA_ERROR =
  "failed to get metadata of path: /Users/jacobm/Documents/Sandbox with error: No such file or directory (os error 2)";

describe("isNotFoundError", () => {
  it("recognizes Node and Tauri not-found error codes", () => {
    expect(isNotFoundError({ code: "ENOENT" })).toBe(true);
    expect(isNotFoundError({ code: "NotFound" })).toBe(true);
  });

  it("recognizes Windows Tauri missing file and directory messages", () => {
    expect(isNotFoundError(WINDOWS_SETTINGS_READ_ERROR)).toBe(true);
    expect(isNotFoundError(WINDOWS_SETTINGS_FILE_MISSING_ERROR)).toBe(true);
    expect(isNotFoundError(WINDOWS_READDIR_ERROR)).toBe(true);
    expect(isNotFoundError(MACOS_METADATA_ERROR)).toBe(true);
  });

  it("does not treat unrelated failures as missing paths", () => {
    expect(isNotFoundError(new Error("disk full"))).toBe(false);
    expect(isNotFoundError("")).toBe(false);
    expect(isNotFoundError(null)).toBe(false);
    expect(
      isNotFoundError(
        "failed to open file at path: C:\\Users\\test\\Documents\\library.json with error: Access is denied. (os error 5)",
      ),
    ).toBe(false);
  });
});
