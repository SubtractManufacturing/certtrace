import {
  type AddFieldOptionInput,
  type AddFieldOptionResult,
  availableFieldOptions,
  getShapeDimensionKeys,
  hasFilledShapeDimensions,
  isDimensionFieldKey,
  isFieldVisible,
  sanitizeDependentFieldValues,
  validateMaterialValues,
} from "@certtrace/library-engine";
import type { FieldSchemaV1, FieldValueV1, SizeUnit } from "@certtrace/types";
import { Button, cn, Input, Label, Select, Textarea } from "@certtrace/ui";
import { Plus } from "lucide-react";
import { Fragment, useState } from "react";
import { formatDimensionInput, parseSizeDimensionInput } from "../lib/size-input";

export { validateMaterialValues };

export interface MaterialFormValues {
  fields: Record<string, FieldValueV1>;
  identifiers: Record<string, string>;
  sizeUnit?: SizeUnit;
}

interface MaterialSchemaFormProps {
  schema: FieldSchemaV1;
  values: MaterialFormValues;
  onChange: (values: MaterialFormValues) => void;
  onAddOption?: (input: AddFieldOptionInput) => Promise<AddFieldOptionResult>;
  /** Resolved unit for bare dimension numbers (install + library defaults). */
  resolvedDefaultUnit?: SizeUnit;
  idPrefix?: string;
}

function isDimensionField(schema: FieldSchemaV1, field: FieldSchemaV1["fields"][number]): boolean {
  return isDimensionFieldKey(schema, field.key);
}

function SizeUnitToggle({
  id,
  value,
  onChange,
}: {
  id: string;
  value: SizeUnit;
  onChange: (unit: SizeUnit) => void;
}) {
  return (
    <div
      className="inline-flex shrink-0 rounded-full border border-slate-200 p-0.5 dark:border-slate-700"
      role="group"
      aria-label="Size unit"
    >
      {(["in", "mm"] as const).map((unit) => {
        const selected = value === unit;
        return (
          <button
            key={unit}
            id={unit === value ? id : undefined}
            type="button"
            aria-pressed={selected}
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              selected
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
            )}
            onClick={() => onChange(unit)}
          >
            {unit}
          </button>
        );
      })}
    </div>
  );
}

function allDimensionKeys(schema: FieldSchemaV1): Set<string> {
  const keys = new Set<string>();
  const shapeField = schema.fields.find((field) => field.key === "shape");
  for (const option of shapeField?.options ?? []) {
    for (const key of option.dimensionKeys ?? []) {
      keys.add(key);
    }
  }
  return keys;
}

export function MaterialSchemaForm({
  schema,
  values,
  onChange,
  onAddOption,
  resolvedDefaultUnit = "in",
  idPrefix = "material-field",
}: MaterialSchemaFormProps) {
  const [openSelectField, setOpenSelectField] = useState<string | null>(null);
  const [addingToField, setAddingToField] = useState<string | null>(null);
  const [newOptionLabel, setNewOptionLabel] = useState("");
  const [optionError, setOptionError] = useState<string | null>(null);
  const [addingOption, setAddingOption] = useState(false);
  const [dimensionDrafts, setDimensionDrafts] = useState<Record<string, string>>({});
  const [sizeInputError, setSizeInputError] = useState<string | null>(null);

  const shapeId = typeof values.fields.shape === "string" ? values.fields.shape : undefined;

  function emit(nextFields: Record<string, FieldValueV1>, nextSizeUnit?: SizeUnit) {
    onChange({
      fields: sanitizeDependentFieldValues(schema, nextFields),
      identifiers: values.identifiers,
      sizeUnit: nextSizeUnit,
    });
  }

  function setField(key: string, value: FieldValueV1 | undefined) {
    const fields = { ...values.fields };
    if (value === undefined || value === "") {
      delete fields[key];
    } else {
      fields[key] = value;
    }

    if (key === "shape") {
      const nextShapeId = typeof value === "string" ? value : undefined;
      if (!nextShapeId) {
        for (const dimensionKey of allDimensionKeys(schema)) {
          delete fields[dimensionKey];
        }
        setDimensionDrafts({});
        emit(fields, undefined);
        return;
      }

      if (nextShapeId !== shapeId) {
        if (hasFilledShapeDimensions(schema, values.fields)) {
          const confirmed = window.confirm(
            "Changing Shape clears dimension values. Keep the current unit and continue?",
          );
          if (!confirmed) {
            return;
          }
        }
        for (const dimensionKey of allDimensionKeys(schema)) {
          delete fields[dimensionKey];
        }
      }
      setDimensionDrafts({});
      emit(fields, values.sizeUnit);
      return;
    }

    emit(fields, values.sizeUnit);
  }

  function setIdentifier(key: string, value: string) {
    const identifiers = { ...values.identifiers };
    if (value === "") {
      delete identifiers[key];
    } else {
      identifiers[key] = value;
    }
    onChange({ ...values, identifiers });
  }

  function dimensionDisplayValue(key: string): string {
    if (key in dimensionDrafts) {
      return dimensionDrafts[key] ?? "";
    }
    const raw = values.fields[key];
    return typeof raw === "number" ? formatDimensionInput(raw) : "";
  }

  function commitDimensionInput(key: string, raw: string) {
    setSizeInputError(null);
    const trimmed = raw.trim();
    if (!trimmed) {
      const fields = { ...values.fields };
      delete fields[key];
      const nextDrafts = { ...dimensionDrafts };
      delete nextDrafts[key];
      setDimensionDrafts(nextDrafts);
      const hasRemaining = getShapeDimensionKeys(schema, shapeId).some(
        (dimensionKey) => typeof fields[dimensionKey] === "number",
      );
      emit(fields, hasRemaining ? values.sizeUnit : undefined);
      return;
    }

    const parsed = parseSizeDimensionInput(trimmed, values.sizeUnit ?? resolvedDefaultUnit);
    if (!parsed) {
      setSizeInputError(`Could not parse "${trimmed}".`);
      return;
    }

    const nextUnit = parsed.unit ?? values.sizeUnit ?? resolvedDefaultUnit;
    if (values.sizeUnit && parsed.unit && parsed.unit !== values.sizeUnit) {
      setSizeInputError(`Mixed units are not allowed. This Size uses ${values.sizeUnit}.`);
      return;
    }

    const fields = { ...values.fields, [key]: parsed.value };
    const nextDrafts = { ...dimensionDrafts };
    delete nextDrafts[key];
    setDimensionDrafts(nextDrafts);
    emit(fields, nextUnit);
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
      setField(fieldKey, nextValue);
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

  const sizeUnit = values.sizeUnit ?? resolvedDefaultUnit;
  const sizeDimensionFields = getShapeDimensionKeys(schema, shapeId)
    .map((key) => schema.fields.find((field) => field.key === key))
    .filter((field): field is FieldSchemaV1["fields"][number] => Boolean(field));

  function renderSizeDimensionField(field: FieldSchemaV1["fields"][number]) {
    const inputId = `${idPrefix}-${field.key}`;
    return (
      <div key={field.key} className="space-y-1 text-sm">
        <Label htmlFor={inputId} className="block whitespace-nowrap">
          {field.label}
        </Label>
        <div className="relative w-[4.75rem]">
          <Input
            id={inputId}
            type="text"
            inputMode="decimal"
            disabled={field.disabled}
            className="w-[4.75rem] px-2 pr-7"
            value={dimensionDisplayValue(field.key)}
            onChange={(event) =>
              setDimensionDrafts((current) => ({ ...current, [field.key]: event.target.value }))
            }
            onBlur={(event) => commitDimensionInput(field.key, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitDimensionInput(field.key, event.currentTarget.value);
              }
            }}
          />
          <span className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-xs text-slate-500 dark:text-slate-400">
            {sizeUnit}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {schema.fields.map((field) => {
        if (isDimensionField(schema, field)) {
          return null;
        }

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
          const select = (
            <>
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
            </>
          );

          if (field.key !== "shape" || sizeDimensionFields.length === 0) {
            return (
              <div key={field.key} className="space-y-1 text-sm">
                {select}
              </div>
            );
          }

          return (
            <Fragment key={field.key}>
              <div className="space-y-1 text-sm">{select}</div>
              <div className="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-2">
                {sizeDimensionFields.map((dimensionField) =>
                  renderSizeDimensionField(dimensionField),
                )}
                <div className="flex h-9 items-center">
                  <SizeUnitToggle
                    id={`${idPrefix}-size-unit`}
                    value={sizeUnit}
                    onChange={(nextUnit) => {
                      if (nextUnit === sizeUnit) {
                        return;
                      }
                      const populatedKeys = sizeDimensionFields
                        .filter((field) => typeof values.fields[field.key] === "number")
                        .map((field) => field.key);
                      if (populatedKeys.length > 0) {
                        const confirmed = window.confirm(
                          "Changing the Size unit clears dimension values. Continue?",
                        );
                        if (!confirmed) {
                          return;
                        }
                      }
                      const nextFields = { ...values.fields };
                      for (const key of populatedKeys) {
                        delete nextFields[key];
                      }
                      setDimensionDrafts({});
                      emit(nextFields, nextUnit);
                    }}
                  />
                </div>
              </div>
            </Fragment>
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

      {sizeInputError ? (
        <p className="text-sm text-red-600 sm:col-span-2">{sizeInputError}</p>
      ) : null}

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
