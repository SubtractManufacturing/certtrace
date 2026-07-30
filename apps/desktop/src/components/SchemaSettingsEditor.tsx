import {
  canReplaceFieldDefinition,
  changeFieldType,
  createAttachmentKind,
  createFieldDefinition,
  createFieldOption,
  createIdentifierKind,
  type RemoveSchemaDefinitionInput,
  type SchemaDefinitionRemovalStrategy,
  type SchemaDefinitionType,
} from "@certtrace/library-engine";
import type { FieldSchemaV1, FieldType } from "@certtrace/types";
import { Button, Input, Label, Select, Switch } from "@certtrace/ui";
import { useState } from "react";

interface SchemaSettingsEditorProps {
  schema: FieldSchemaV1;
  onChange: (schema: FieldSchemaV1) => void;
  onRemoveDefinition?: (input: RemoveSchemaDefinitionInput) => Promise<void>;
}

function moveItem<T>(items: T[], index: number, offset: -1 | 1): T[] | null {
  const target = index + offset;
  if (target < 0 || target >= items.length) {
    return null;
  }
  const reordered = [...items];
  [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
  return reordered;
}

interface FieldOptionsEditorProps {
  field: FieldSchemaV1["fields"][number];
  onChange: (field: FieldSchemaV1["fields"][number]) => void;
}

function FieldOptionsEditor({ field, onChange }: FieldOptionsEditorProps) {
  const [newOptionLabel, setNewOptionLabel] = useState("");

  if (field.type !== "single_select" && field.type !== "multi_select") {
    return null;
  }

  function updateOption(
    optionId: string,
    update: (
      option: NonNullable<typeof field.options>[number],
    ) => NonNullable<typeof field.options>[number],
  ) {
    onChange({
      ...field,
      options: field.options?.map((option) => (option.id === optionId ? update(option) : option)),
    });
  }

  function addOption() {
    const label = newOptionLabel.trim();
    if (!label) {
      return;
    }
    const option = createFieldOption(field, label);
    onChange({ ...field, options: [...(field.options ?? []), option] });
    setNewOptionLabel("");
  }

  return (
    <div className="space-y-2 rounded-md bg-slate-50 p-3 dark:bg-slate-950">
      <p className="text-sm font-medium">Options</p>
      {field.options?.map((option) => (
        <div key={option.id} className="grid gap-2 sm:grid-cols-[1fr_8rem_8rem]">
          <Input
            aria-label={`Option label ${option.id} for field ${field.key}`}
            value={option.label}
            onChange={(event) =>
              updateOption(option.id, (current) => ({ ...current, label: event.target.value }))
            }
          />
          <Input
            aria-label={`Option short code ${option.id} for field ${field.key}`}
            placeholder="Short code"
            value={option.shortCode ?? ""}
            onChange={(event) =>
              updateOption(option.id, (current) => {
                const shortCode = event.target.value;
                return shortCode
                  ? { ...current, shortCode }
                  : { id: current.id, label: current.label };
              })
            }
          />
          <Input value={option.id} readOnly className="font-mono" aria-label="Stable option id" />
        </div>
      ))}
      <div className="flex gap-2">
        <Input
          aria-label={`New option label for field ${field.key}`}
          placeholder="New option"
          value={newOptionLabel}
          onChange={(event) => setNewOptionLabel(event.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={!newOptionLabel.trim()}
          onClick={addOption}
        >
          Add option
        </Button>
      </div>
    </div>
  );
}

interface FieldDependencyEditorProps {
  schema: FieldSchemaV1;
  field: FieldSchemaV1["fields"][number];
  onChange: (field: FieldSchemaV1["fields"][number]) => void;
}

function FieldDependencyEditor({ schema, field, onChange }: FieldDependencyEditorProps) {
  const parentFields = schema.fields.filter(
    (candidate) =>
      candidate.key !== field.key &&
      (candidate.type === "single_select" || candidate.type === "multi_select"),
  );
  const parent = parentFields.find((candidate) => candidate.key === field.dependsOn?.fieldKey);
  const childIsSelect = field.type === "single_select" || field.type === "multi_select";

  function setParent(fieldKey: string) {
    if (!fieldKey) {
      const { dependsOn: _dependsOn, ...withoutDependency } = field;
      onChange(withoutDependency);
      return;
    }
    onChange({
      ...field,
      dependsOn: {
        fieldKey,
        ...(childIsSelect ? { filterOptionsBy: {} } : { visibleWhen: [] }),
      },
    });
  }

  function toggleOption(parentOptionId: string, childOptionId: string, checked: boolean) {
    const current = field.dependsOn?.filterOptionsBy?.[parentOptionId] ?? [];
    const next = checked
      ? [...current, childOptionId]
      : current.filter((optionId) => optionId !== childOptionId);
    onChange({
      ...field,
      dependsOn: {
        fieldKey: parent!.key,
        ...field.dependsOn,
        filterOptionsBy: {
          ...field.dependsOn?.filterOptionsBy,
          [parentOptionId]: next,
        },
      },
    });
  }

  function toggleVisibility(parentOptionId: string, checked: boolean) {
    const current = field.dependsOn?.visibleWhen ?? [];
    onChange({
      ...field,
      dependsOn: {
        fieldKey: parent!.key,
        ...field.dependsOn,
        visibleWhen: checked
          ? [...current, parentOptionId]
          : current.filter((optionId) => optionId !== parentOptionId),
      },
    });
  }

  return (
    <div className="space-y-2 rounded-md bg-slate-50 p-3 dark:bg-slate-950">
      <Label htmlFor={`dependency-parent-${field.key}`}>Depends on</Label>
      <Select
        id={`dependency-parent-${field.key}`}
        aria-label={`Dependency parent for field ${field.key}`}
        value={field.dependsOn?.fieldKey ?? ""}
        onChange={(event) => setParent(event.target.value)}
      >
        <option value="">No dependency</option>
        {parentFields.map((candidate) => (
          <option key={candidate.key} value={candidate.key}>
            {candidate.label}
          </option>
        ))}
      </Select>
      {parent && childIsSelect ? (
        <div className="space-y-3 pt-1">
          <p className="text-xs text-slate-500">
            Choose which {field.label} options are available for each {parent.label}.
          </p>
          {parent.options?.map((parentOption) => (
            <div key={parentOption.id}>
              <p className="text-sm font-medium">{parentOption.label}</p>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-2">
                {field.options?.map((option) => {
                  const checked =
                    field.dependsOn?.filterOptionsBy?.[parentOption.id]?.includes(option.id) ??
                    false;
                  const inputId = `dependency-${field.key}-${parentOption.id}-${option.id}`;
                  return (
                    <label key={option.id} className="flex items-center gap-1 text-sm">
                      <input
                        id={inputId}
                        type="checkbox"
                        aria-label={`Allow ${option.label} for ${parentOption.label} in ${field.label}`}
                        checked={checked}
                        onChange={(event) =>
                          toggleOption(parentOption.id, option.id, event.target.checked)
                        }
                      />
                      {option.label}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {parent && !childIsSelect ? (
        <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
          {parent.options?.map((option) => (
            <label key={option.id} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                aria-label={`Show ${field.label} for ${option.label}`}
                checked={field.dependsOn?.visibleWhen?.includes(option.id) ?? false}
                onChange={(event) => toggleVisibility(option.id, event.target.checked)}
              />
              {option.label}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface DefinitionRemovalControlsProps {
  definitionType: SchemaDefinitionType;
  definitionKey: string;
  label: string;
  targets: Array<{ key: string; label: string }>;
  targetNoun: string;
  onRemove: (input: RemoveSchemaDefinitionInput) => Promise<void>;
}

function DefinitionRemovalControls({
  definitionType,
  definitionKey,
  label,
  targets,
  targetNoun,
  onRemove,
}: DefinitionRemovalControlsProps) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [targetKey, setTargetKey] = useState(targets[0]?.key ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply(strategy: SchemaDefinitionRemovalStrategy) {
    setBusy(true);
    setError(null);
    try {
      await onRemove({ definitionType, key: definitionKey, strategy });
      setOpen(false);
      setConfirmation("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={`Remove ${label}`}
        onClick={() => setOpen(true)}
      >
        Remove
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">Remove {label}?</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>

      <div className="space-y-1">
        <p className="text-sm">
          Keep values already saved, but hide this {targetNoun} on new materials.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void apply({ type: "disable" })}
        >
          Disable new entries
        </Button>
      </div>

      <div className="space-y-2 border-t border-amber-200 pt-3 dark:border-amber-900">
        <p className="text-sm">
          Permanently erase this {targetNoun} and its values from every material.
        </p>
        <Label htmlFor={`delete-confirm-${definitionType}-${definitionKey}`}>
          Type {label} to confirm
        </Label>
        <Input
          id={`delete-confirm-${definitionType}-${definitionKey}`}
          aria-label={`Type ${label} to confirm`}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || confirmation !== label}
          onClick={() => void apply({ type: "delete" })}
        >
          Delete all values
        </Button>
      </div>

      <div className="space-y-2 border-t border-amber-200 pt-3 dark:border-amber-900">
        <p className="text-sm">
          Move every saved value to another {targetNoun}, then remove this one.
        </p>
        <Label htmlFor={`replacement-${definitionType}-${definitionKey}`}>Replace with</Label>
        <Select
          id={`replacement-${definitionType}-${definitionKey}`}
          aria-label={`Replacement for ${label}`}
          value={targetKey}
          onChange={(event) => setTargetKey(event.target.value)}
        >
          {targets.map((target) => (
            <option key={target.key} value={target.key}>
              {target.label}
            </option>
          ))}
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || !targetKey}
          onClick={() => void apply({ type: "replace", targetKey })}
        >
          Replace saved values
        </Button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

function IdentifierKindsEditor({
  schema,
  onChange,
  onRemoveDefinition,
}: SchemaSettingsEditorProps) {
  const [newLabel, setNewLabel] = useState("");

  function updateKind(
    key: string,
    update: (
      kind: FieldSchemaV1["identifierKinds"][number],
    ) => FieldSchemaV1["identifierKinds"][number],
  ) {
    onChange({
      ...schema,
      identifierKinds: schema.identifierKinds.map((kind) =>
        kind.key === key ? update(kind) : kind,
      ),
    });
  }

  function moveKind(index: number, offset: -1 | 1) {
    const nextKinds = moveItem(schema.identifierKinds, index, offset);
    if (!nextKinds) {
      return;
    }
    onChange({ ...schema, identifierKinds: nextKinds });
  }

  function addKind() {
    const label = newLabel.trim();
    if (!label) {
      return;
    }
    const kind = createIdentifierKind(schema, label);
    onChange({
      ...schema,
      identifierKinds: [...schema.identifierKinds, kind],
    });
    setNewLabel("");
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Identifier kinds</h3>
      {schema.identifierKinds.map((kind, index) => (
        <div
          key={kind.key}
          className="space-y-3 rounded-md border border-slate-200 p-3 dark:border-slate-700"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium">{kind.label}</p>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Move ${kind.label} up`}
                disabled={index === 0}
                onClick={() => moveKind(index, -1)}
              >
                Up
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Move ${kind.label} down`}
                disabled={index === schema.identifierKinds.length - 1}
                onClick={() => moveKind(index, 1)}
              >
                Down
              </Button>
              {kind.disabled ? (
                <span className="self-center text-xs text-slate-500">Disabled for new entries</span>
              ) : null}
              {onRemoveDefinition ? (
                <DefinitionRemovalControls
                  definitionType="identifierKind"
                  definitionKey={kind.key}
                  label={kind.label}
                  targetNoun="identifier kind"
                  targets={schema.identifierKinds
                    .filter((candidate) => candidate.key !== kind.key && !candidate.disabled)
                    .map((candidate) => ({ key: candidate.key, label: candidate.label }))}
                  onRemove={onRemoveDefinition}
                />
              ) : null}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1 text-sm">
              <Label htmlFor={`identifier-label-${kind.key}`}>Label</Label>
              <Input
                id={`identifier-label-${kind.key}`}
                aria-label={`Label for identifier ${kind.key}`}
                value={kind.label}
                onChange={(event) =>
                  updateKind(kind.key, (current) => ({ ...current, label: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1 text-sm">
              <Label htmlFor={`identifier-key-${kind.key}`}>Stable key</Label>
              <Input
                id={`identifier-key-${kind.key}`}
                value={kind.key}
                readOnly
                className="font-mono"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Switch
                id={`identifier-required-${kind.key}`}
                aria-label={`Required identifier ${kind.label}`}
                checked={kind.required}
                onCheckedChange={(required) =>
                  updateKind(kind.key, (current) => ({ ...current, required }))
                }
              />
              <Label htmlFor={`identifier-required-${kind.key}`}>Required</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id={`identifier-filterable-${kind.key}`}
                aria-label={`Filterable identifier ${kind.label}`}
                checked={kind.filterable}
                onCheckedChange={(filterable) =>
                  updateKind(kind.key, (current) => ({ ...current, filterable }))
                }
              />
              <Label htmlFor={`identifier-filterable-${kind.key}`}>Filterable</Label>
            </div>
          </div>
        </div>
      ))}
      <div className="flex gap-2 rounded-md border border-dashed border-slate-300 p-3 dark:border-slate-600">
        <Input
          aria-label="New identifier label"
          placeholder="New identifier kind"
          value={newLabel}
          onChange={(event) => setNewLabel(event.target.value)}
        />
        <Button type="button" disabled={!newLabel.trim()} onClick={addKind}>
          Add identifier
        </Button>
      </div>
    </div>
  );
}

function AttachmentKindsEditor({ schema, onChange }: SchemaSettingsEditorProps) {
  const [newLabel, setNewLabel] = useState("");

  function addKind() {
    const label = newLabel.trim();
    if (!label) {
      return;
    }
    onChange({
      ...schema,
      attachmentKinds: [...schema.attachmentKinds, createAttachmentKind(schema, label)],
    });
    setNewLabel("");
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Attachment kinds</h3>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Labels describe each attachment's role, independently of its file format.
      </p>
      {schema.attachmentKinds.map((kind) => (
        <div
          key={kind.key}
          className="grid gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-700 sm:grid-cols-[1fr_10rem_auto]"
        >
          <Input
            aria-label={`Label for attachment kind ${kind.key}`}
            value={kind.label}
            onChange={(event) =>
              onChange({
                ...schema,
                attachmentKinds: schema.attachmentKinds.map((candidate) =>
                  candidate.key === kind.key
                    ? { ...candidate, label: event.target.value }
                    : candidate,
                ),
              })
            }
          />
          <Input
            value={kind.key}
            readOnly
            className="font-mono"
            aria-label="Stable attachment key"
          />
          <Button
            type="button"
            variant="outline"
            aria-label={`Remove ${kind.label}`}
            onClick={() =>
              onChange({
                ...schema,
                attachmentKinds: schema.attachmentKinds.filter(
                  (candidate) => candidate.key !== kind.key,
                ),
              })
            }
          >
            Remove
          </Button>
        </div>
      ))}
      <div className="flex gap-2 rounded-md border border-dashed border-slate-300 p-3 dark:border-slate-600">
        <Input
          aria-label="New attachment kind label"
          placeholder="New attachment kind"
          value={newLabel}
          onChange={(event) => setNewLabel(event.target.value)}
        />
        <Button type="button" disabled={!newLabel.trim()} onClick={addKind}>
          Add attachment kind
        </Button>
      </div>
    </div>
  );
}

export function SchemaSettingsEditor({
  schema,
  onChange,
  onRemoveDefinition,
}: SchemaSettingsEditorProps) {
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState<FieldType>("text");

  function updateField(
    key: string,
    update: (field: FieldSchemaV1["fields"][number]) => FieldSchemaV1["fields"][number],
  ) {
    onChange({
      ...schema,
      fields: schema.fields.map((field) => (field.key === key ? update(field) : field)),
    });
  }

  function moveField(index: number, offset: -1 | 1) {
    const nextFields = moveItem(schema.fields, index, offset);
    if (!nextFields) {
      return;
    }
    onChange({ ...schema, fields: nextFields });
  }

  function addField() {
    const label = newFieldLabel.trim();
    if (!label) {
      return;
    }

    const field = createFieldDefinition(schema, label, newFieldType);
    onChange({
      ...schema,
      fields: [...schema.fields, field],
    });
    setNewFieldLabel("");
    setNewFieldType("text");
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Fields</h3>
      {schema.fields.map((field, index) => (
        <div
          key={field.key}
          className="space-y-3 rounded-md border border-slate-200 p-3 dark:border-slate-700"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium">{field.label}</p>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Move ${field.label} up`}
                disabled={index === 0}
                onClick={() => moveField(index, -1)}
              >
                Up
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Move ${field.label} down`}
                disabled={index === schema.fields.length - 1}
                onClick={() => moveField(index, 1)}
              >
                Down
              </Button>
              {field.disabled ? (
                <span className="self-center text-xs text-slate-500">Disabled for new entries</span>
              ) : null}
              {onRemoveDefinition ? (
                <DefinitionRemovalControls
                  definitionType="field"
                  definitionKey={field.key}
                  label={field.label}
                  targetNoun="field"
                  targets={schema.fields
                    .filter(
                      (candidate) =>
                        candidate.key !== field.key &&
                        !candidate.disabled &&
                        canReplaceFieldDefinition(field, candidate),
                    )
                    .map((candidate) => ({ key: candidate.key, label: candidate.label }))}
                  onRemove={onRemoveDefinition}
                />
              ) : null}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 text-sm">
              <Label htmlFor={`field-label-${field.key}`}>Label</Label>
              <Input
                id={`field-label-${field.key}`}
                aria-label={`Label for field ${field.key}`}
                value={field.label}
                onChange={(event) =>
                  updateField(field.key, (current) => ({
                    ...current,
                    label: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1 text-sm">
              <Label htmlFor={`field-key-${field.key}`}>Stable key</Label>
              <Input
                id={`field-key-${field.key}`}
                value={field.key}
                readOnly
                className="font-mono"
              />
            </div>
            <div className="space-y-1 text-sm">
              <Label htmlFor={`field-type-${field.key}`}>Type</Label>
              <Select
                id={`field-type-${field.key}`}
                aria-label={`Type for field ${field.key}`}
                value={field.type}
                onChange={(event) =>
                  updateField(field.key, (current) =>
                    changeFieldType(current, event.target.value as FieldType),
                  )
                }
              >
                <option value="text">Text</option>
                <option value="long_text">Long text</option>
                <option value="single_select">Single select</option>
                <option value="multi_select">Multi select</option>
                <option value="date">Date</option>
                <option value="number">Number</option>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Switch
                id={`field-required-${field.key}`}
                aria-label={`Required field ${field.label}`}
                checked={field.required}
                onCheckedChange={(required) =>
                  updateField(field.key, (current) => ({ ...current, required }))
                }
              />
              <Label htmlFor={`field-required-${field.key}`}>Required</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id={`field-filterable-${field.key}`}
                aria-label={`Filterable field ${field.label}`}
                checked={field.filterable}
                onCheckedChange={(filterable) =>
                  updateField(field.key, (current) => ({ ...current, filterable }))
                }
              />
              <Label htmlFor={`field-filterable-${field.key}`}>Filterable</Label>
            </div>
          </div>
          <FieldOptionsEditor
            field={field}
            onChange={(nextField) => updateField(field.key, () => nextField)}
          />
          <FieldDependencyEditor
            schema={schema}
            field={field}
            onChange={(nextField) => updateField(field.key, () => nextField)}
          />
        </div>
      ))}
      <div className="grid gap-3 rounded-md border border-dashed border-slate-300 p-3 dark:border-slate-600 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
        <div className="space-y-1 text-sm">
          <Label htmlFor="new-field-label">New field label</Label>
          <Input
            id="new-field-label"
            value={newFieldLabel}
            onChange={(event) => setNewFieldLabel(event.target.value)}
          />
        </div>
        <div className="space-y-1 text-sm">
          <Label htmlFor="new-field-type">New field type</Label>
          <Select
            id="new-field-type"
            value={newFieldType}
            onChange={(event) => setNewFieldType(event.target.value as FieldType)}
          >
            <option value="text">Text</option>
            <option value="long_text">Long text</option>
            <option value="single_select">Single select</option>
            <option value="multi_select">Multi select</option>
            <option value="date">Date</option>
            <option value="number">Number</option>
          </Select>
        </div>
        <Button type="button" disabled={!newFieldLabel.trim()} onClick={addField}>
          Add field
        </Button>
      </div>
      <IdentifierKindsEditor
        schema={schema}
        onChange={onChange}
        onRemoveDefinition={onRemoveDefinition}
      />
      <AttachmentKindsEditor schema={schema} onChange={onChange} />
    </div>
  );
}
