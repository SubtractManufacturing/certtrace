import type { MaterialMetadataV1 } from "@certtrace/types";

export interface SearchIndex {
  materials: MaterialMetadataV1[];
}

export interface SearchResult {
  material: MaterialMetadataV1;
  score: number;
}

const normalizeQuery = (query: string): string[] =>
  query.trim().toLowerCase().split(/\s+/).filter(Boolean);

function identifierValues(material: MaterialMetadataV1): string[] {
  return Object.values(material.identifiers).filter(Boolean);
}

/** Search haystack: material ID plus every identifier value (ADR-0004). */
export function materialSearchText(material: MaterialMetadataV1): string {
  return [material.id, ...identifierValues(material)].join(" ").toLowerCase();
}

export function buildSearchIndex(materials: MaterialMetadataV1[]): SearchIndex {
  return {
    materials: [...materials],
  };
}

export function searchMaterials(index: SearchIndex, query: string): MaterialMetadataV1[] {
  const terms = normalizeQuery(query);
  if (terms.length === 0) {
    return [...index.materials];
  }

  return index.materials.filter((material) => {
    const haystack = materialSearchText(material);
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
    const haystack = materialSearchText(material);
    let score = 0;

    for (const term of terms) {
      if (material.id.toLowerCase() === term) {
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
