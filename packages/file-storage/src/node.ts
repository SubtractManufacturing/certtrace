import { copyFile, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
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
    async readBinary(path) {
      const buffer = await readFile(path);
      return new Uint8Array(buffer);
    },
    async writeBinary(path, data) {
      await writeFile(path, data);
    },
    async remove(path) {
      await rm(path, { force: true });
    },
    async copyFile(from, to) {
      await copyFile(from, to);
    },
    async rename(from, to) {
      await rename(from, to);
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
