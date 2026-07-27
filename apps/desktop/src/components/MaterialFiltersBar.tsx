import type {
  FieldDefinitionV1,
  FieldSchemaV1,
  FieldValueV1,
  MaterialMetadataV1,
} from "@certtrace/types";
import { Button, Input, Select } from "@certtrace/ui";

export interface MaterialFilterValues {
  fields: Record<string, string>;
  identifiers: Record<string, string>;
}

interface MaterialFiltersBarProps {
  schema: FieldSchemaV1;
  values: MaterialFilterValues;
  onChange: (values: MaterialFilterValues) => void;
}

export const emptyMaterialFilters: MaterialFilterValues = {
  fields: {},
  identifiers: {},
};

export function MaterialFiltersBar({ schema, values, onChange }: MaterialFiltersBarProps) {
  const fields = schema.fields.filter((field) => field.filterable && !field.disabled);
  const identifierKinds = schema.identifierKinds.filter(
    (kind) => kind.filterable && !kind.disabled,
  );
  const hasActiveFilters = [
    ...Object.values(values.fields),
    ...Object.values(values.identifiers),
  ].some(Boolean);

  if (fields.length === 0 && identifierKinds.length === 0) {
    return null;
  }

  function setField(key: string, value: string) {
    onChange({
      ...values,
      fields: { ...values.fields, [key]: value },
    });
  }

  function setIdentifier(key: string, value: string) {
    onChange({
      ...values,
      identifiers: { ...values.identifiers, [key]: value },
    });
  }

  return (
    <div
      role="group"
      aria-label="Material filters"
      className="mt-3 flex items-end gap-2 overflow-x-auto pb-1"
    >
      {fields.map((field) => (
        <div key={field.key} className="w-40 shrink-0 space-y-1">
          <span aria-hidden className="block text-xs font-medium">
            {field.label}
          </span>
          {field.options ? (
            <Select
              id={`material-filter-field-${field.key}`}
              aria-label={`Filter by ${field.label}`}
              fieldSize="sm"
              value={values.fields[field.key] ?? ""}
              onChange={(event) => setField(field.key, event.target.value)}
            >
              <option value="">Any</option>
              {field.options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              id={`material-filter-field-${field.key}`}
              aria-label={`Filter by ${field.label}`}
              className="h-8 text-xs"
              type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
              value={values.fields[field.key] ?? ""}
              onChange={(event) => setField(field.key, event.target.value)}
            />
          )}
        </div>
      ))}

      {identifierKinds.map((kind) => (
        <div key={kind.key} className="w-40 shrink-0 space-y-1">
          <span aria-hidden className="block text-xs font-medium">
            {kind.label}
          </span>
          <Input
            id={`material-filter-identifier-${kind.key}`}
            aria-label={`Filter by ${kind.label}`}
            className="h-8 text-xs"
            value={values.identifiers[kind.key] ?? ""}
            onChange={(event) => setIdentifier(kind.key, event.target.value)}
          />
        </div>
      ))}

      {hasActiveFilters ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={() => onChange(emptyMaterialFilters)}
        >
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}

export function filterMaterialsBySchema<T extends MaterialMetadataV1>(
  materials: T[],
  schema: FieldSchemaV1,
  filters: MaterialFilterValues,
): T[] {
  const fieldsByKey = new Map(
    schema.fields
      .filter((field) => field.filterable && !field.disabled)
      .map((field) => [field.key, field]),
  );
  const identifierKeys = new Set(
    schema.identifierKinds
      .filter((kind) => kind.filterable && !kind.disabled)
      .map((kind) => kind.key),
  );

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
