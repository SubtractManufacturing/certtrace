import {
  availableFieldOptions,
  isFieldVisible,
  sanitizeDependentSelectValues,
  validateMaterialValues,
} from "@certtrace/library-engine";
import type { FieldSchemaV1, FieldValueV1 } from "@certtrace/types";
import { Input, Label, Select, Textarea } from "@certtrace/ui";

export { validateMaterialValues };

export interface MaterialFormValues {
  fields: Record<string, FieldValueV1>;
  identifiers: Record<string, string>;
}

interface MaterialSchemaFormProps {
  schema: FieldSchemaV1;
  values: MaterialFormValues;
  onChange: (values: MaterialFormValues) => void;
  idPrefix?: string;
}

export function MaterialSchemaForm({
  schema,
  values,
  onChange,
  idPrefix = "material-field",
}: MaterialSchemaFormProps) {
  function setField(key: string, value: FieldValueV1 | undefined) {
    const fields = { ...values.fields };
    if (value === undefined || value === "") {
      delete fields[key];
    } else {
      fields[key] = value;
    }
    onChange({
      fields: sanitizeDependentSelectValues(schema, fields),
      identifiers: values.identifiers,
    });
  }

  function setIdentifier(key: string, value: string) {
    const identifiers = { ...values.identifiers };
    if (value === "") {
      delete identifiers[key];
    } else {
      identifiers[key] = value;
    }
    onChange({ fields: values.fields, identifiers });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {schema.fields.map((field) => {
        if (!isFieldVisible(field, values.fields)) {
          return null;
        }

        const inputId = `${idPrefix}-${field.key}`;
        const raw = values.fields[field.key];
        const stringValue = typeof raw === "string" || typeof raw === "number" ? String(raw) : "";
        const options = availableFieldOptions(field, values.fields);

        if (field.type === "long_text") {
          return (
            <div key={field.key} className="space-y-1 text-sm sm:col-span-2">
              <Label htmlFor={inputId}>{field.label}</Label>
              <Textarea
                id={inputId}
                rows={3}
                value={stringValue}
                onChange={(event) => setField(field.key, event.target.value)}
              />
            </div>
          );
        }

        if (field.type === "single_select") {
          return (
            <div key={field.key} className="space-y-1 text-sm">
              <Label htmlFor={inputId}>{field.label}</Label>
              <Select
                id={inputId}
                value={stringValue}
                onChange={(event) => setField(field.key, event.target.value || undefined)}
              >
                <option value="">Select…</option>
                {options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          );
        }

        if (field.type === "multi_select") {
          const selected = Array.isArray(raw) ? raw : [];
          return (
            <div key={field.key} className="space-y-1 text-sm sm:col-span-2">
              <Label htmlFor={inputId}>{field.label}</Label>
              <Select
                id={inputId}
                multiple
                value={selected}
                onChange={(event) => {
                  const next = Array.from(event.target.selectedOptions, (option) => option.value);
                  setField(field.key, next.length > 0 ? next : undefined);
                }}
              >
                {options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          );
        }

        const inputType =
          field.type === "date" ? "date" : field.type === "number" ? "number" : "text";

        return (
          <div key={field.key} className="space-y-1 text-sm">
            <Label htmlFor={inputId}>{field.label}</Label>
            <Input
              id={inputId}
              type={inputType}
              value={stringValue}
              onChange={(event) => {
                if (field.type === "number") {
                  const next = event.target.value;
                  setField(field.key, next === "" ? undefined : Number(next));
                  return;
                }
                setField(field.key, event.target.value);
              }}
            />
          </div>
        );
      })}

      {schema.identifierKinds.map((kind) => {
        const inputId = `${idPrefix}-id-${kind.key}`;
        return (
          <div key={kind.key} className="space-y-1 text-sm">
            <Label htmlFor={inputId}>{kind.label}</Label>
            <Input
              id={inputId}
              value={values.identifiers[kind.key] ?? ""}
              onChange={(event) => setIdentifier(kind.key, event.target.value)}
            />
          </div>
        );
      })}
    </div>
  );
}
