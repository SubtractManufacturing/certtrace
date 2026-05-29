import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import type { FileSystem } from "./types.js";

export function createNodeFileSystem(): FileSystem {
  return {
    async mkdir(path, options) {
      await mkdir(path, options);
    },
    readFile(path) {
      return readFile(path, "utf8");
    },
    async writeFile(path, content) {
      await writeFile(path, content, "utf8");
    },
    async readdir(path) {
      const entries = await readdir(path, { withFileTypes: true });
      return entries.map((entry) => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
      }));
    },
  };
}
