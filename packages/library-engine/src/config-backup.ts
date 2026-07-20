import type { FileSystem } from "@certtrace/file-storage";
import { BACKUPS_DIR, joinPath } from "@certtrace/types";

const MAX_BACKUPS = 5;

export async function backupConfigFile(
  fs: FileSystem,
  libraryRoot: string,
  relativePath: string,
): Promise<void> {
  const sourcePath = joinPath(libraryRoot, relativePath);
  let raw: string;
  try {
    raw = await fs.readFile(sourcePath);
  } catch {
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = joinPath(libraryRoot, BACKUPS_DIR, timestamp);
  await fs.mkdir(backupDir, { recursive: true });
  await fs.writeFile(joinPath(backupDir, relativePath.split("/").pop() ?? "config.json"), raw);

  const backupsRoot = joinPath(libraryRoot, BACKUPS_DIR);
  try {
    const entries = await fs.readdir(backupsRoot);
    const folders = entries
      .filter((entry) => entry.isDirectory)
      .map((entry) => entry.name)
      .sort()
      .reverse();

    for (const folder of folders.slice(MAX_BACKUPS)) {
      const folderPath = joinPath(backupsRoot, folder);
      try {
        const files = await fs.readdir(folderPath);
        for (const file of files) {
          if (!file.isDirectory) {
            await fs.remove(joinPath(folderPath, file.name));
          }
        }
        await fs.remove(folderPath);
      } catch {
        // Best-effort cleanup.
      }
    }
  } catch {
    // Backups directory may not exist yet.
  }
}
