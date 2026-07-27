import {
  availableFieldOptions,
  filterableFields,
  filterableIdentifierKinds,
  isFieldVisible,
  type MaterialFilterValues,
} from "@certtrace/library-engine";
import type { FieldSchemaV1 } from "@certtrace/types";
import { Button, Input, Select } from "@certtrace/ui";

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
  const fields = filterableFields(schema).filter((field) => isFieldVisible(field, values.fields));
  const identifierKinds = filterableIdentifierKinds(schema);
  const hasActiveFilters = [
    ...Object.values(values.fields),
    ...Object.values(values.identifiers),
  ].some(Boolean);

  if (fields.length === 0 && identifierKinds.length === 0) {
    return null;
  }

  function setField(key: string, value: string) {
    const fields = { ...values.fields };
    if (value) {
      fields[key] = value;
    } else {
      delete fields[key];
    }
    onChange({
      ...values,
      fields: sanitizeFilterFieldValues(schema, fields),
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
              {availableFieldOptions(field, values.fields).map((option) => (
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

function sanitizeFilterFieldValues(
  schema: FieldSchemaV1,
  values: Record<string, string>,
): Record<string, string> {
  const sanitized = { ...values };

  for (let pass = 0; pass < schema.fields.length; pass += 1) {
    let changed = false;
    for (const field of filterableFields(schema)) {
      const value = sanitized[field.key];
      if (!value) {
        continue;
      }

      const availableOptions = availableFieldOptions(field, sanitized);
      const unavailable =
        !isFieldVisible(field, sanitized) ||
        (field.options && !availableOptions.some((option) => option.id === value));
      if (unavailable) {
        delete sanitized[field.key];
        changed = true;
      }
    }

    if (!changed) {
      break;
    }
  }

  return sanitized;
}
