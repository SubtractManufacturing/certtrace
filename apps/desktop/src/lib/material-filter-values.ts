import type { MaterialMetadataV1 } from "@certtrace/types";

export function distinctMaterialFieldValues(
  materials: MaterialMetadataV1[],
  fieldKey: string,
): string[] {
  const values = new Set<string>();

  for (const material of materials) {
    const value = material.fields[fieldKey];
    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry !== "") {
          values.add(String(entry));
        }
      }
      continue;
    }

    values.add(String(value));
  }

  return [...values].sort((left, right) => left.localeCompare(right));
}
