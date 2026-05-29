/** True when a filesystem error indicates a missing path (Node ENOENT, Tauri NotFound). */
export function isNotFoundError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const code = "code" in error ? String((error as { code?: unknown }).code) : "";
  return code === "ENOENT" || code === "NotFound";
}
