import type { CreateLibraryOptions, OpenLibraryResult } from "@certtrace/library-engine";
import { useCallback, useState } from "react";
import {
  createLibraryWithOptions,
  openLibraryAtPath,
  reloadLibraryAtPath,
} from "../lib/library-client";

export type ActiveLibraryPath = string | "all" | null;

export function useLibrarySession() {
  const [sessionLibraries, setSessionLibraries] = useState<Map<string, OpenLibraryResult>>(
    () => new Map(),
  );
  const [activeLibraryPath, setActiveLibraryPath] = useState<ActiveLibraryPath>(null);

  const openLibrary = useCallback(async (path: string) => {
    let library: OpenLibraryResult | undefined;
    setSessionLibraries((current) => {
      library = current.get(path);
      return current;
    });
    if (!library) {
      library = await openLibraryAtPath(path);
    }
    setSessionLibraries((current) => new Map(current).set(path, library!));
    setActiveLibraryPath(path);
    return library;
  }, []);

  const createLibrary = useCallback(async (parentDir: string, options: CreateLibraryOptions) => {
    const library = await createLibraryWithOptions(parentDir, options);
    setSessionLibraries((current) => new Map(current).set(library.paths.root, library));
    setActiveLibraryPath(library.paths.root);
    return library;
  }, []);

  const refreshLibrary = useCallback(async (path: string) => {
    const library = await reloadLibraryAtPath(path);
    setSessionLibraries((current) => new Map(current).set(path, library));
    return library;
  }, []);

  const updateLibraryInSession = useCallback((library: OpenLibraryResult) => {
    setSessionLibraries((current) => new Map(current).set(library.paths.root, library));
  }, []);

  const removeLibraryFromSession = useCallback((path: string) => {
    setSessionLibraries((current) => {
      const next = new Map(current);
      next.delete(path);
      setActiveLibraryPath((active) => {
        if (active === path) {
          return [...next.keys()][0] ?? null;
        }
        return active;
      });
      return next;
    });
  }, []);

  const clearSession = useCallback(() => {
    setSessionLibraries(new Map());
    setActiveLibraryPath(null);
  }, []);

  const hasSession = sessionLibraries.size > 0;

  return {
    sessionLibraries,
    activeLibraryPath,
    setActiveLibraryPath,
    openLibrary,
    createLibrary,
    refreshLibrary,
    updateLibraryInSession,
    removeLibraryFromSession,
    clearSession,
    hasSession,
  };
}
