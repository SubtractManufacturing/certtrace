export interface DirectoryEntry {
  name: string;
  isDirectory: boolean;
}

/** Minimal filesystem port used by library-engine (Node in tests, Tauri in desktop). */
export interface FileSystem {
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  readBinary(path: string): Promise<Uint8Array>;
  writeBinary(path: string, data: Uint8Array): Promise<void>;
  /** Remove a file or directory. Directory removal is recursive. */
  remove(path: string): Promise<void>;
  copyFile(from: string, to: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  readdir(path: string): Promise<DirectoryEntry[]>;
}
