import type { FileSystem } from "@certtrace/file-storage";
import {
  copyFile,
  mkdir,
  readDir,
  readFile,
  readTextFile,
  remove,
  rename,
  writeFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";

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
    async readBinary(path) {
      return readFile(path);
    },
    async writeBinary(path, data) {
      await writeFile(path, data);
    },
    remove(path) {
      return remove(path);
    },
    copyFile(from, to) {
      return copyFile(from, to);
    },
    rename(from, to) {
      return rename(from, to);
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
