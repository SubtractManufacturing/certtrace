import {
  availableFieldOptions,
  filterableFields,
  isFieldVisible,
  type MaterialFilterValues,
  sanitizeMaterialFilterFields,
} from "@certtrace/library-engine";
import type { FieldDefinitionV1, FieldSchemaV1, MaterialMetadataV1 } from "@certtrace/types";
import { Button, Label, Select } from "@certtrace/ui";
import { distinctMaterialFieldValues } from "../lib/material-filter-values";

interface MaterialFiltersPanelProps {
  schema: FieldSchemaV1;
  materials: MaterialMetadataV1[];
  values: MaterialFilterValues;
  onChange: (values: MaterialFilterValues) => void;
}

export const emptyMaterialFilters: MaterialFilterValues = {
  fields: {},
  identifiers: {},
};

export function MaterialFiltersPanel({
  schema,
  materials,
  values,
  onChange,
}: MaterialFiltersPanelProps) {
  const fields = filterableFields(schema)
    .filter((field) => field.type !== "date")
    .filter((field) => isFieldVisible(field, values.fields));
  const hasActiveFilters = Object.values(values.fields).some(Boolean);

  if (fields.length === 0) {
    return <p className="text-sm text-slate-500">No filters available for this library.</p>;
  }

  function setField(key: string, value: string) {
    const nextFields = { ...values.fields };
    if (value) {
      nextFields[key] = value;
    } else {
      delete nextFields[key];
    }
    onChange({
      fields: sanitizeMaterialFilterFields(schema, nextFields),
      identifiers: {},
    });
  }

  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <label key={field.key} className="block space-y-1.5 text-sm">
          <Label htmlFor={`material-filter-field-${field.key}`}>{field.label}</Label>
          <FilterFieldSelect
            field={field}
            materials={materials}
            selectedFields={values.fields}
            value={values.fields[field.key] ?? ""}
            onChange={(value) => setField(field.key, value)}
          />
        </label>
      ))}

      {hasActiveFilters ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(emptyMaterialFilters)}
        >
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}

function FilterFieldSelect({
  field,
  materials,
  selectedFields,
  value,
  onChange,
}: {
  field: FieldDefinitionV1;
  materials: MaterialMetadataV1[];
  selectedFields: Record<string, string>;
  value: string;
  onChange: (value: string) => void;
}) {
  const optionValues = field.options
    ? availableFieldOptions(field, selectedFields).map((option) => ({
        value: option.id,
        label: option.label,
      }))
    : distinctMaterialFieldValues(materials, field.key).map((entry) => ({
        value: entry,
        label: entry,
      }));

  return (
    <Select
      id={`material-filter-field-${field.key}`}
      aria-label={`Filter by ${field.label}`}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Any</option>
      {optionValues.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}
