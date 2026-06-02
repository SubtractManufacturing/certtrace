function filesystemErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }

  return String(error);
}

function isWindowsMissingPathMessage(message: string): boolean {
  const lower = message.toLowerCase();
  if (lower.includes("os error 2") || lower.includes("os error 3")) {
    return true;
  }

  if (
    lower.includes("cannot find the file specified") ||
    lower.includes("cannot find the path specified")
  ) {
    return true;
  }

  const tauriFs =
    lower.includes("failed to open file") || lower.includes("failed to read directory");
  const missing =
    lower.includes("cannot find the file") ||
    lower.includes("cannot find the path") ||
    lower.includes("os error 2") ||
    lower.includes("os error 3");
  return tauriFs && missing;
}

/** True when a filesystem error indicates a missing path (Node ENOENT, Tauri NotFound, Windows os error 2/3). */
export function isNotFoundError(error: unknown): boolean {
  if (typeof error === "object" && error !== null) {
    const code = "code" in error ? String((error as { code?: unknown }).code) : "";
    if (code === "ENOENT" || code === "NotFound") {
      return true;
    }
  }

  return isWindowsMissingPathMessage(filesystemErrorMessage(error));
}
