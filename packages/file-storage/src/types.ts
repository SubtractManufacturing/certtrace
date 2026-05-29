export interface DirectoryEntry {
  name: string;
  isDirectory: boolean;
}

/** Minimal filesystem port used by library-engine (Node in tests, Tauri in desktop). */
export interface FileSystem {
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  readdir(path: string): Promise<DirectoryEntry[]>;
}
