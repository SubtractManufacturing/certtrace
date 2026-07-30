import {
  type AddFieldOptionInput,
  type AddFieldOptionResult,
  availableFieldOptions,
  isFieldVisible,
  sanitizeDependentFieldValues,
  validateMaterialValues,
} from "@certtrace/library-engine";
import type { FieldSchemaV1, FieldValueV1 } from "@certtrace/types";
import { Button, Input, Label, Select, Textarea } from "@certtrace/ui";
import { Plus } from "lucide-react";
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
  const [openSelectField, setOpenSelectField] = useState<string | null>(null);
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
      fields: sanitizeDependentFieldValues(currentSchema, fields),
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

  function resetAddOptionState(fieldKey?: string) {
    if (fieldKey === undefined || addingToField === fieldKey) {
      setAddingToField(null);
      setNewOptionLabel("");
      setOptionError(null);
    }
  }

  function handleSelectOpenChange(fieldKey: string, nextOpen: boolean) {
    setOpenSelectField(nextOpen ? fieldKey : null);
    if (!nextOpen) {
      resetAddOptionState(fieldKey);
    }
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
      resetAddOptionState(fieldKey);
      setOpenSelectField(null);
    } catch (err) {
      setOptionError(err instanceof Error ? err.message : String(err));
    } finally {
      setAddingOption(false);
    }
  }

  function addOptionFooter(fieldKey: string, fieldLabel: string, multiSelect: boolean) {
    if (!onAddOption) {
      return undefined;
    }

    if (addingToField === fieldKey) {
      const newOptionId = `${idPrefix}-${fieldKey}-new-option`;
      return (
        <div
          className="space-y-2 p-2"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <Label htmlFor={newOptionId} className="text-xs">
            New {fieldLabel}
          </Label>
          <Input
            id={newOptionId}
            value={newOptionLabel}
            autoFocus
            onChange={(event) => setNewOptionLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && newOptionLabel.trim() !== "") {
                event.preventDefault();
                void confirmAddOption(fieldKey, multiSelect);
              }
            }}
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
              onClick={() => resetAddOptionState(fieldKey)}
            >
              Cancel
            </Button>
          </div>
        </div>
      );
    }

    return (
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:text-slate-300 dark:hover:bg-slate-800 dark:focus-visible:ring-slate-500"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          setAddingToField(fieldKey);
          setNewOptionLabel("");
          setOptionError(null);
        }}
      >
        <Plus className="h-4 w-4 shrink-0" aria-hidden />
        <span>Add {fieldLabel}</span>
      </button>
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
        const canAddOption = Boolean(onAddOption) && !field.disabled;

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
                open={canAddOption ? openSelectField === field.key : undefined}
                onOpenChange={
                  canAddOption
                    ? (nextOpen) => handleSelectOpenChange(field.key, nextOpen)
                    : undefined
                }
                footer={canAddOption ? addOptionFooter(field.key, field.label, false) : undefined}
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
                disabled={field.disabled}
                value={selected}
                footer={canAddOption ? addOptionFooter(field.key, field.label, true) : undefined}
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
