import { mkdir, readDir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import type { FileSystem } from "@certtrace/file-storage";

export function createTauriFileSystem(): FileSystem {
  return {
    mkdir(path, options) {
      return mkdir(path, { recursive: options?.recursive ?? false });
    },
    readFile(path) {
      return readTextFile(path);
    },
    writeFile(path, content) {
      return writeTextFile(path, content);
    },
    async readdir(path) {
      const entries = await readDir(path);
      return entries.map((entry) => ({
        name: entry.name,
        isDirectory: entry.isDirectory ?? false,
      }));
    },
  };
}
