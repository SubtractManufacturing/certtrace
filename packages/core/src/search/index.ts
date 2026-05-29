import type { MaterialMetadataV1 } from "@certtrace/types";

export interface SearchIndexOptions {
  searchAllFields?: boolean;
}

export interface SearchIndex {
  materials: MaterialMetadataV1[];
  searchAllFields: boolean;
}

export interface SearchResult {
  material: MaterialMetadataV1;
  score: number;
}

const normalizeQuery = (query: string): string[] =>
  query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

export function materialSearchText(
  material: MaterialMetadataV1,
  searchAllFields: boolean,
): string {
  const parts = [material.id, material.material, material.barcode];

  if (searchAllFields) {
    parts.push(material.supplier, material.heat, material.location, material.notes, ...material.tags);
  }

  return parts.join(" ").toLowerCase();
}

export function buildSearchIndex(
  materials: MaterialMetadataV1[],
  options: SearchIndexOptions = {},
): SearchIndex {
  return {
    materials: [...materials],
    searchAllFields: options.searchAllFields ?? true,
  };
}

export function searchMaterials(index: SearchIndex, query: string): MaterialMetadataV1[] {
  const terms = normalizeQuery(query);
  if (terms.length === 0) {
    return [...index.materials];
  }

  return index.materials.filter((material) => {
    const haystack = materialSearchText(material, index.searchAllFields);
    return terms.every((term) => haystack.includes(term));
  });
}

export function rankSearchResults(index: SearchIndex, query: string): SearchResult[] {
  const terms = normalizeQuery(query);
  if (terms.length === 0) {
    return index.materials.map((material) => ({ material, score: 0 }));
  }

  const results: SearchResult[] = [];

  for (const material of index.materials) {
    const haystack = materialSearchText(material, index.searchAllFields);
    let score = 0;

    for (const term of terms) {
      if (material.id.toLowerCase() === term || material.barcode.toLowerCase() === term) {
        score += 100;
      } else if (material.id.toLowerCase().startsWith(term)) {
        score += 50;
      } else if (haystack.includes(term)) {
        score += 10;
      } else {
        score = -1;
        break;
      }
    }

    if (score >= 0) {
      results.push({ material, score });
    }
  }

  return results.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.material.id.localeCompare(right.material.id);
  });
}
