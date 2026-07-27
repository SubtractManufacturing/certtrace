import type { MaterialMetadataV1 } from "@certtrace/types";

/** Display a field value as text (option ids / free text for interim UI). */
export function fieldDisplay(material: MaterialMetadataV1, key: string): string {
  const value = material.fields[key];
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return "";
}

export function identifierDisplay(material: MaterialMetadataV1, key: string): string {
  return material.identifiers[key] ?? "";
}
