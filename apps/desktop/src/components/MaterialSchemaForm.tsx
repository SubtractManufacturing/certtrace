import {
  type AddFieldOptionInput,
  type AddFieldOptionResult,
  availableFieldOptions,
  isFieldVisible,
  sanitizeDependentSelectValues,
  validateMaterialValues,
} from "@certtrace/library-engine";
import type { FieldSchemaV1, FieldValueV1 } from "@certtrace/types";
import { Button, Input, Label, Select, Textarea } from "@certtrace/ui";
import { useState } from "react";

export { validateMaterialValues };

export interface MaterialFormValues {
  fields: Record<string, FieldValueV1>;
  identifiers: Record<string, string>;
}

interface MaterialSchemaFormProps {
  schema: FieldSchemaV1;
  values: MaterialFormValues;
  onChange: (values: MaterialFormValues) => void;
  onAddOption?: (input: AddFieldOptionInput) => Promise<AddFieldOptionResult>;
  idPrefix?: string;
}

export function MaterialSchemaForm({
  schema,
  values,
  onChange,
  onAddOption,
  idPrefix = "material-field",
}: MaterialSchemaFormProps) {
  const [addingToField, setAddingToField] = useState<string | null>(null);
  const [newOptionLabel, setNewOptionLabel] = useState("");
  const [optionError, setOptionError] = useState<string | null>(null);
  const [addingOption, setAddingOption] = useState(false);

  function setField(
    key: string,
    value: FieldValueV1 | undefined,
    currentSchema: FieldSchemaV1 = schema,
  ) {
    const fields = { ...values.fields };
    if (value === undefined || value === "") {
      delete fields[key];
    } else {
      fields[key] = value;
    }
    onChange({
      fields: sanitizeDependentSelectValues(currentSchema, fields),
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

  async function confirmAddOption(fieldKey: string, multiSelect: boolean) {
    const label = newOptionLabel.trim();
    if (!onAddOption || !label) {
      return;
    }

    setAddingOption(true);
    setOptionError(null);
    try {
      const result = await onAddOption({
        fieldKey,
        label,
        currentValues: values.fields,
      });
      const current = values.fields[fieldKey];
      const nextValue = multiSelect
        ? [...(Array.isArray(current) ? current : []), result.option.id]
        : result.option.id;
      setField(fieldKey, nextValue, result.fieldSchema);
      setAddingToField(null);
      setNewOptionLabel("");
    } catch (err) {
      setOptionError(err instanceof Error ? err.message : String(err));
    } finally {
      setAddingOption(false);
    }
  }

  function addOptionControls(fieldKey: string, fieldLabel: string, multiSelect: boolean) {
    if (!onAddOption) {
      return null;
    }

    if (addingToField !== fieldKey) {
      return (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setAddingToField(fieldKey);
            setNewOptionLabel("");
            setOptionError(null);
          }}
        >
          Add {fieldLabel} option
        </Button>
      );
    }

    const newOptionId = `${idPrefix}-${fieldKey}-new-option`;
    return (
      <div className="space-y-2 rounded-md border border-slate-200 p-2 dark:border-slate-700">
        <Label htmlFor={newOptionId}>New {fieldLabel} option</Label>
        <Input
          id={newOptionId}
          value={newOptionLabel}
          onChange={(event) => setNewOptionLabel(event.target.value)}
        />
        <p className="text-xs text-slate-500">
          Confirming adds this option to the library for future materials.
        </p>
        {optionError ? <p className="text-xs text-red-600">{optionError}</p> : null}
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            disabled={addingOption || newOptionLabel.trim() === ""}
            onClick={() => void confirmAddOption(fieldKey, multiSelect)}
          >
            Confirm add
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={addingOption}
            onClick={() => {
              setAddingToField(null);
              setNewOptionLabel("");
              setOptionError(null);
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {schema.fields.map((field) => {
        const raw = values.fields[field.key];
        if (
          (field.disabled && raw === undefined) ||
          (!field.disabled && !isFieldVisible(field, values.fields))
        ) {
          return null;
        }

        const inputId = `${idPrefix}-${field.key}`;
        const stringValue = typeof raw === "string" || typeof raw === "number" ? String(raw) : "";
        const options = availableFieldOptions(field, values.fields);

        if (field.type === "long_text") {
          return (
            <div key={field.key} className="space-y-1 text-sm sm:col-span-2">
              <Label htmlFor={inputId}>{field.label}</Label>
              <Textarea
                id={inputId}
                rows={3}
                disabled={field.disabled}
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
                disabled={field.disabled}
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
              {field.disabled ? null : addOptionControls(field.key, field.label, false)}
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
                disabled={field.disabled}
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
              {field.disabled ? null : addOptionControls(field.key, field.label, true)}
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
              disabled={field.disabled}
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
        const value = values.identifiers[kind.key];
        if (kind.disabled && value === undefined) {
          return null;
        }
        const inputId = `${idPrefix}-id-${kind.key}`;
        return (
          <div key={kind.key} className="space-y-1 text-sm">
            <Label htmlFor={inputId}>{kind.label}</Label>
            <Input
              id={inputId}
              disabled={kind.disabled}
              value={value ?? ""}
              onChange={(event) => setIdentifier(kind.key, event.target.value)}
            />
          </div>
        );
      })}
    </div>
  );
}
