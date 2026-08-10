import { buildSearchIndex, type SearchIndex, searchMaterials } from "@certtrace/core";
import type { OpenLibraryResult } from "@certtrace/library-engine";
import type { MaterialMetadataV1, RecentLibraryEntryV1 } from "@certtrace/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchMaterials, openLibraryAtPath } from "../lib/library-client";

export interface IndexedMaterial extends MaterialMetadataV1 {
  libraryPath: string;
  libraryName: string;
}

export interface UseSearchIndexOptions {
  sessionLibraries: Map<string, OpenLibraryResult>;
  activeLibraryPath: string | "all" | null;
  recentLibraries: RecentLibraryEntryV1[];
  /** When false (default), text search excludes Archived Materials. */
  includeArchivedMaterialsInSearch?: boolean;
}

export function useSearchIndex({
  sessionLibraries,
  activeLibraryPath,
  recentLibraries,
  includeArchivedMaterialsInSearch = false,
}: UseSearchIndexOptions) {
  const [materialsByLibrary, setMaterialsByLibrary] = useState<Map<string, MaterialMetadataV1[]>>(
    () => new Map(),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLibraryMaterials = useCallback(async (path: string, library?: OpenLibraryResult) => {
    const opened = library ?? (await openLibraryAtPath(path));
    const materials = await fetchMaterials(opened);
    setMaterialsByLibrary((current) => new Map(current).set(path, materials));
    return materials;
  }, []);

  const refreshLibraryMaterials = useCallback(
    async (path: string) => {
      const library = sessionLibraries.get(path);
      if (!library) {
        return;
      }
      await loadLibraryMaterials(path, library);
    },
    [loadLibraryMaterials, sessionLibraries],
  );

  useEffect(() => {
    if (!activeLibraryPath) {
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (activeLibraryPath === "all") {
          const paths = new Set<string>([
            ...sessionLibraries.keys(),
            ...recentLibraries.map((entry) => entry.path),
          ]);

          await Promise.all(
            [...paths].map(async (path) => {
              const library = sessionLibraries.get(path);
              if (library) {
                await loadLibraryMaterials(path, library);
                return;
              }
              if (!cancelled) {
                await loadLibraryMaterials(path);
              }
            }),
          );
        } else if (activeLibraryPath) {
          const libraryPath = activeLibraryPath;
          const library = sessionLibraries.get(libraryPath);
          if (library) {
            await loadLibraryMaterials(libraryPath, library);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [activeLibraryPath, loadLibraryMaterials, recentLibraries, sessionLibraries]);

  const indexedMaterials = useMemo((): IndexedMaterial[] => {
    if (!activeLibraryPath) {
      return [];
    }

    const paths =
      activeLibraryPath === "all"
        ? [...new Set([...sessionLibraries.keys(), ...recentLibraries.map((entry) => entry.path)])]
        : [activeLibraryPath];

    const rows: IndexedMaterial[] = [];
    for (const path of paths) {
      const materials = materialsByLibrary.get(path) ?? [];
      const libraryName =
        sessionLibraries.get(path)?.config.name ??
        recentLibraries.find((entry) => entry.path === path)?.name ??
        path;
      for (const material of materials) {
        rows.push({ ...material, libraryPath: path, libraryName });
      }
    }
    return rows;
  }, [activeLibraryPath, materialsByLibrary, recentLibraries, sessionLibraries]);

  const searchableMaterials = useMemo(
    () =>
      includeArchivedMaterialsInSearch
        ? indexedMaterials
        : indexedMaterials.filter((material) => !material.archived),
    [includeArchivedMaterialsInSearch, indexedMaterials],
  );

  const searchIndex = useMemo(
    (): SearchIndex => buildSearchIndex(searchableMaterials),
    [searchableMaterials],
  );

  const filterMaterials = useCallback(
    (query: string) => {
      if (!query.trim()) {
        // Empty query browses the shelf; archive inclusion is the shelf filter's job.
        return indexedMaterials;
      }
      const matches = new Set(searchMaterials(searchIndex, query));
      return searchableMaterials.filter((material) => matches.has(material));
    },
    [indexedMaterials, searchableMaterials, searchIndex],
  );

  return {
    indexedMaterials,
    searchIndex,
    filterMaterials,
    loading,
    error,
    refreshLibraryMaterials,
  };
}
