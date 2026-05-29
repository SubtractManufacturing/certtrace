import { SCHEMA_VERSION } from "@certtrace/types";
import { LibraryError } from "../errors.js";

export function getDocumentVersion(doc: unknown): number {
  if (typeof doc !== "object" || doc === null || !("version" in doc)) {
    throw new LibraryError("Missing version field");
  }

  const version = doc.version;
  if (typeof version !== "number" || !Number.isInteger(version)) {
    throw new LibraryError("Invalid version field");
  }

  return version;
}

export function assertSupportedVersion(doc: unknown, label: string): number {
  const version = getDocumentVersion(doc);

  if (version > SCHEMA_VERSION) {
    throw new LibraryError(`Library created with newer CertTrace (${label} version ${version})`);
  }

  return version;
}

export function migrateToCurrent<T>(
  doc: unknown,
  label: string,
  steps: Record<number, (value: unknown) => unknown>,
  parse: (value: unknown) => T,
): T {
  let current = doc;
  let version = assertSupportedVersion(current, label);

  while (version < SCHEMA_VERSION) {
    const step = steps[version];
    if (!step) {
      throw new LibraryError(`Unsupported ${label} version: ${version}`);
    }
    current = step(current);
    version = getDocumentVersion(current);
  }

  return parse(current);
}
