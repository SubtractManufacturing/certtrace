import type {
  FieldDefinitionV1,
  FieldSchemaV1,
  FieldValueV1,
  IdentifierKindV1,
  MaterialMetadataV1,
} from "@certtrace/types";
import { sanitizeDependentFieldValues } from "./field-dependencies.js";
import type { MaterialFilterValues } from "./types.js";

export function filterableFields(schema: FieldSchemaV1): FieldDefinitionV1[] {
  return schema.fields.filter((field) => field.filterable && !field.disabled);
}

export function filterableIdentifierKinds(schema: FieldSchemaV1): IdentifierKindV1[] {
  return schema.identifierKinds.filter((kind) => kind.filterable && !kind.disabled);
}

export function sanitizeMaterialFilterFields(
  schema: FieldSchemaV1,
  values: Record<string, string>,
): Record<string, string> {
  return sanitizeDependentFieldValues(schema, values, { removeHidden: true });
}

export function filterMaterialsBySchema<T extends MaterialMetadataV1>(
  materials: T[],
  schema: FieldSchemaV1,
  filters: MaterialFilterValues,
): T[] {
  const fieldsByKey = new Map(filterableFields(schema).map((field) => [field.key, field]));
  const identifierKeys = new Set(filterableIdentifierKinds(schema).map((kind) => kind.key));

  return materials.filter((material) => {
    for (const [key, filter] of Object.entries(filters.fields)) {
      if (!filter || !fieldsByKey.has(key)) {
        continue;
      }
      if (!matchesFieldFilter(material.fields[key], fieldsByKey.get(key)!, filter)) {
        return false;
      }
    }

    for (const [key, filter] of Object.entries(filters.identifiers)) {
      if (!filter || !identifierKeys.has(key)) {
        continue;
      }
      if (!includesCaseInsensitive(material.identifiers[key], filter)) {
        return false;
      }
    }

    return true;
  });
}

function matchesFieldFilter(
  value: FieldValueV1 | undefined,
  field: FieldDefinitionV1,
  filter: string,
): boolean {
  if (value === undefined) {
    return false;
  }

  if (field.options) {
    return Array.isArray(value) ? value.includes(filter) : String(value) === filter;
  }

  if (field.type === "date" || field.type === "number") {
    return String(value) === filter;
  }

  const text = Array.isArray(value) ? value.join(" ") : String(value);
  return includesCaseInsensitive(text, filter);
}

function includesCaseInsensitive(value: string | undefined, filter: string): boolean {
  return value?.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase()) ?? false;
}
