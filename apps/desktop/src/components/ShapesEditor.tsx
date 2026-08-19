import {
  createFieldDefinition,
  createFieldOption,
  getShapeField,
  listReusableDimensionFields,
  type OpenLibraryResult,
} from "@certtrace/library-engine";
import {
  type FieldDefinitionV1,
  type FieldOptionV1,
  isShippedDimensionKey,
  SHIPPED_SHAPE_PACKING,
  stripTokenFromSizePattern,
} from "@certtrace/types";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@certtrace/ui";
import { ChevronDown, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import {
  fetchMaterials,
  removeLibrarySchemaDefinition,
  updateLibraryFieldSchema,
} from "../lib/library-client";
import { AnchoredMenu } from "./AnchoredMenu";
import { ErrorBanner } from "./ErrorBanner";
import { SizePatternEditor } from "./SizePatternEditor";

interface ShapesEditorProps {
  library: OpenLibraryResult;
  onLibraryUpdated: (library: OpenLibraryResult) => void;
  onRefreshLibrary: () => Promise<void>;
}

type EditorMode = {
  kind: "create" | "edit";
  option: FieldOptionV1;
  newFields: FieldDefinitionV1[];
  fieldLabels: Record<string, string>;
};

type PendingShapeDelete = { optionId: string; optionLabel: string; count: number | null };

type PendingDimensionDelete = {
  key: string;
  label: string;
  shapeLabels: string[];
  materialCount: number | null;
  countError?: string;
};

function lockedDimensionKeys(optionId: string): string[] {
  return SHIPPED_SHAPE_PACKING[optionId]?.dimensionKeys ?? [];
}

function knownDimensionKeys(option: FieldOptionV1, fields: FieldDefinitionV1[]): string[] {
  const fieldByKey = new Map(fields.map((field) => [field.key, field] as const));
  return (option.dimensionKeys ?? []).filter((key) => fieldByKey.has(key));
}

function dimensionSummary(fields: FieldDefinitionV1[], option: FieldOptionV1): string {
  const keys = knownDimensionKeys(option, fields);
  if (keys.length === 0) {
    return "No dimensions";
  }
  return keys.map((key) => fields.find((field) => field.key === key)?.label ?? key).join(", ");
}

function withLockedKeys(optionId: string, keys: string[]): string[] {
  const locked = lockedDimensionKeys(optionId);
  const extra = keys.filter((key) => !locked.includes(key));
  return [...locked, ...extra];
}

export function ShapesEditor({ library, onLibraryUpdated, onRefreshLibrary }: ShapesEditorProps) {
  const [editor, setEditor] = useState<EditorMode | null>(null);
  const [newDimensionLabel, setNewDimensionLabel] = useState("");
  const [addingDimension, setAddingDimension] = useState(false);
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [dimensionsOpen, setDimensionsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingShapeDelete | null>(null);
  const [pendingDimensionDelete, setPendingDimensionDelete] =
    useState<PendingDimensionDelete | null>(null);
  const dimensionsTriggerRef = useRef<HTMLButtonElement>(null);

  const shapeField = getShapeField(library.fieldSchema);
  const options = shapeField?.options ?? [];
  const draft = editor?.option ?? null;
  const draftSchema = (() => {
    if (!editor || !shapeField) {
      return library.fieldSchema;
    }
    const nextOptions =
      editor.kind === "create"
        ? [...options, editor.option]
        : options.map((option) => (option.id === editor.option.id ? editor.option : option));
    return {
      ...library.fieldSchema,
      fields: [
        ...library.fieldSchema.fields.map((field) =>
          field.key === "shape" ? { ...field, options: nextOptions } : field,
        ),
        ...editor.newFields,
      ],
    };
  })();

  async function persistSchema(nextSchema: typeof library.fieldSchema) {
    setBusy(true);
    setError(null);
    try {
      const updated = await updateLibraryFieldSchema(library, nextSchema);
      onLibraryUpdated(updated);
      await onRefreshLibrary();
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setBusy(false);
    }
  }

  function updateShapeOptions(nextOptions: FieldOptionV1[], extraFields: FieldDefinitionV1[] = []) {
    const labeledFields = library.fieldSchema.fields.map((field) => {
      const label = editor?.fieldLabels[field.key];
      return label ? { ...field, label } : field;
    });
    return {
      ...library.fieldSchema,
      fields: [
        ...labeledFields.map((field) =>
          field.key === "shape" ? { ...field, options: nextOptions } : field,
        ),
        ...extraFields,
      ],
    };
  }

  function openCreate() {
    if (!shapeField) {
      return;
    }
    setError(null);
    setModalError(null);
    setNewDimensionLabel("");
    setAddingDimension(false);
    setRenamingKey(null);
    setDimensionsOpen(false);
    setEditor({
      kind: "create",
      option: { id: "", label: "" },
      newFields: [],
      fieldLabels: {},
    });
  }

  function openEdit(option: FieldOptionV1) {
    setError(null);
    setModalError(null);
    setNewDimensionLabel("");
    setAddingDimension(false);
    setRenamingKey(null);
    setDimensionsOpen(false);
    setEditor({
      kind: "edit",
      option: structuredClone(option),
      newFields: [],
      fieldLabels: {},
    });
  }

  function closeEditor() {
    setEditor(null);
    setModalError(null);
    setNewDimensionLabel("");
    setAddingDimension(false);
    setRenamingKey(null);
    setDimensionsOpen(false);
    setPendingDimensionDelete(null);
  }

  function patchOption(updater: (option: FieldOptionV1) => FieldOptionV1) {
    setModalError(null);
    setEditor((current) => (current ? { ...current, option: updater(current.option) } : current));
  }

  function dimensionLabel(key: string, fallback: string): string {
    return editor?.fieldLabels[key] ?? fallback;
  }

  function toggleDimension(key: string, checked: boolean) {
    if (!draft) {
      return;
    }
    if (!checked && lockedDimensionKeys(draft.id).includes(key)) {
      return;
    }
    patchOption((current) => {
      const keys = new Set(withLockedKeys(current.id, current.dimensionKeys ?? []));
      if (checked) {
        keys.add(key);
      } else {
        keys.delete(key);
      }
      const dimensionKeys = withLockedKeys(current.id, [...keys]);
      const sizePattern =
        !checked && current.sizePattern
          ? stripTokenFromSizePattern(current.sizePattern, key) || undefined
          : current.sizePattern;
      return {
        ...current,
        dimensionKeys: dimensionKeys.length > 0 ? dimensionKeys : undefined,
        sizePattern,
      };
    });
  }

  function addDimensionField() {
    if (!editor) {
      return;
    }
    const label = newDimensionLabel.trim();
    if (!label) {
      return;
    }
    const created = createFieldDefinition(draftSchema, label, "number");
    setEditor({
      ...editor,
      newFields: [...editor.newFields, created],
      option: {
        ...editor.option,
        dimensionKeys: withLockedKeys(editor.option.id, [
          ...(editor.option.dimensionKeys ?? []),
          created.key,
        ]),
      },
    });
    setNewDimensionLabel("");
    setAddingDimension(false);
  }

  async function handleSubmitEditor() {
    if (!editor || !shapeField) {
      return;
    }
    const label = editor.option.label.trim();
    if (!label) {
      setModalError("Shape name cannot be empty.");
      return;
    }
    const duplicate = options.find(
      (option) =>
        option.id !== editor.option.id &&
        option.label.toLocaleLowerCase() === label.toLocaleLowerCase(),
    );
    if (duplicate) {
      setModalError(`Shape already has an option named "${duplicate.label}".`);
      return;
    }

    const validFieldKeys = new Set(draftSchema.fields.map((field) => field.key));
    const cleanedDimensionKeys = (editor.option.dimensionKeys ?? []).filter((key) =>
      validFieldKeys.has(key),
    );
    const nextOption: FieldOptionV1 =
      editor.kind === "create"
        ? {
            ...createFieldOption(shapeField, label),
            dimensionKeys: cleanedDimensionKeys.length > 0 ? cleanedDimensionKeys : undefined,
            sizePattern: editor.option.sizePattern?.trim() || undefined,
          }
        : {
            ...editor.option,
            label,
            dimensionKeys:
              cleanedDimensionKeys.length > 0
                ? withLockedKeys(editor.option.id, cleanedDimensionKeys)
                : undefined,
            sizePattern: editor.option.sizePattern?.trim() || undefined,
          };

    const nextOptions =
      editor.kind === "create"
        ? [...options, nextOption]
        : options.map((option) => (option.id === nextOption.id ? nextOption : option));

    try {
      await persistSchema(updateShapeOptions(nextOptions, editor.newFields));
      closeEditor();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : String(err));
    }
  }

  async function openDelete(option: FieldOptionV1) {
    setError(null);
    setPendingDelete({ optionId: option.id, optionLabel: option.label, count: null });
    try {
      const materials = await fetchMaterials(library);
      const count = materials.filter((material) => material.fields.shape === option.id).length;
      setPendingDelete((current) =>
        current?.optionId === option.id ? { ...current, count } : current,
      );
    } catch {
      setPendingDelete((current) =>
        current?.optionId === option.id ? { ...current, count: null } : current,
      );
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) {
      return;
    }
    try {
      await persistSchema(
        updateShapeOptions(options.filter((option) => option.id !== pendingDelete.optionId)),
      );
      setPendingDelete(null);
    } catch {
      // persistSchema already recorded the error
    }
  }

  function dropDimensionFromDraft(key: string) {
    setEditor((current) => {
      if (!current) {
        return current;
      }
      const sizePattern = current.option.sizePattern
        ? stripTokenFromSizePattern(current.option.sizePattern, key) || undefined
        : undefined;
      return {
        ...current,
        newFields: current.newFields.filter((field) => field.key !== key),
        option: {
          ...current.option,
          dimensionKeys: current.option.dimensionKeys?.filter((entry) => entry !== key),
          sizePattern,
        },
      };
    });
  }

  async function openDimensionDelete(key: string, label: string) {
    const shapeLabels = (getShapeField(draftSchema)?.options ?? [])
      .filter((option) => option.dimensionKeys?.includes(key))
      .map((option) => option.label);
    const isUnsavedField = editor?.newFields.some((field) => field.key === key) ?? false;
    setModalError(null);
    setPendingDimensionDelete({
      key,
      label,
      shapeLabels,
      materialCount: isUnsavedField ? 0 : null,
    });
    if (isUnsavedField) {
      return;
    }
    try {
      const materials = await fetchMaterials(library);
      const materialCount = materials.filter(
        (material) => material.fields[key] !== undefined,
      ).length;
      setPendingDimensionDelete((current) =>
        current?.key === key ? { ...current, materialCount } : current,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPendingDimensionDelete((current) =>
        current?.key === key ? { ...current, countError: message } : current,
      );
    }
  }

  async function confirmDeleteDimension() {
    if (!pendingDimensionDelete) {
      return;
    }
    const key = pendingDimensionDelete.key;
    if (editor?.newFields.some((field) => field.key === key)) {
      dropDimensionFromDraft(key);
      setPendingDimensionDelete(null);
      return;
    }
    setBusy(true);
    setModalError(null);
    try {
      dropDimensionFromDraft(key);
      const updated = await removeLibrarySchemaDefinition(library, {
        definitionType: "field",
        key,
        strategy: { type: "delete" },
      });
      onLibraryUpdated(updated);
      await onRefreshLibrary();
      setPendingDimensionDelete(null);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!shapeField) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">This library has no Shape field.</p>
    );
  }

  const reusableDimensions = listReusableDimensionFields(draftSchema);
  const countText =
    pendingDelete?.count == null
      ? "materials that used it"
      : `${pendingDelete.count} material${pendingDelete.count === 1 ? "" : "s"}`;
  const dimensionShapeText =
    pendingDimensionDelete?.shapeLabels.length === 0
      ? "no Shapes"
      : (pendingDimensionDelete?.shapeLabels.join(", ") ?? "");
  const dimensionMaterialText = pendingDimensionDelete?.countError
    ? "an unknown number of Materials"
    : pendingDimensionDelete?.materialCount == null
      ? "Loading affected Material count…"
      : `${pendingDimensionDelete.materialCount} Material${
          pendingDimensionDelete.materialCount === 1 ? "" : "s"
        }`;
  const selectedDimensionValues = (draft?.dimensionKeys ?? [])
    .map((key) => {
      const field = reusableDimensions.find((dimension) => dimension.key === key);
      if (!field) {
        return undefined;
      }
      return { key, label: dimensionLabel(key, field.label) };
    })
    .filter((entry): entry is { key: string; label: string } => Boolean(entry));
  const dimensionTriggerLabel =
    selectedDimensionValues.map((entry) => entry.label).join(", ") || "Choose dimensions";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-xl text-sm text-slate-600 dark:text-slate-400">
          Each Shape names the dimensions a Size uses and how that Size is written on labels.
        </p>
        <Button type="button" onClick={openCreate} disabled={busy}>
          <Plus className="mr-2 h-4 w-4" />
          Add Shape
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
        <Table aria-label="Shapes">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Dimensions</TableHead>
              <TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {options.map((option) => (
              <TableRow key={option.id}>
                <TableCell className="font-medium">{option.label}</TableCell>
                <TableCell className="text-slate-600 dark:text-slate-400">
                  {dimensionSummary(library.fieldSchema.fields, option)}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Edit ${option.label}`}
                      disabled={busy}
                      onClick={() => openEdit(option)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Delete ${option.label}`}
                      disabled={busy}
                      onClick={() => void openDelete(option)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      <Dialog
        open={editor !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeEditor();
          }
        }}
      >
        <DialogContent className="flex max-h-[min(90vh,42rem)] max-w-xl flex-col gap-0 overflow-hidden p-0">
          <div className="relative shrink-0 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
            <DialogHeader>
              <DialogTitle>{editor?.kind === "create" ? "Add Shape" : "Edit Shape"}</DialogTitle>
              <DialogDescription>
                Choose the dimensions this Shape uses and how Size is written on labels.
              </DialogDescription>
            </DialogHeader>
            <DialogClose aria-label="Close" disabled={busy}>
              <X className="h-4 w-4" />
            </DialogClose>
          </div>

          {draft ? (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="shape-option-name">Name</Label>
                <Input
                  id="shape-option-name"
                  aria-label="Shape name"
                  value={draft.label}
                  onChange={(event) =>
                    patchOption((current) => ({ ...current, label: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>Dimensions</Label>
                <div className="relative">
                  <button
                    type="button"
                    ref={dimensionsTriggerRef}
                    aria-expanded={dimensionsOpen}
                    aria-label={`Dimensions for ${draft.label || "this Shape"}`}
                    className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 text-left text-sm shadow-sm dark:border-slate-700 dark:bg-slate-950"
                    onClick={() => setDimensionsOpen((open) => !open)}
                  >
                    <span className="truncate text-slate-800 dark:text-slate-100">
                      {dimensionTriggerLabel}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
                  </button>
                  <AnchoredMenu
                    open={dimensionsOpen}
                    anchorRef={dimensionsTriggerRef}
                    matchAnchorWidth
                    role="group"
                    onClose={() => {
                      setDimensionsOpen(false);
                      setAddingDimension(false);
                      setRenamingKey(null);
                    }}
                  >
                    {reusableDimensions.map((dimension) => {
                      const locked = lockedDimensionKeys(draft.id).includes(dimension.key);
                      const checked = draft.dimensionKeys?.includes(dimension.key) ?? false;
                      const label = dimensionLabel(dimension.key, dimension.label);
                      const canDelete = !isShippedDimensionKey(dimension.key);
                      return (
                        <div key={dimension.key} className="flex items-center gap-2 px-2 py-1.5">
                          <input
                            type="checkbox"
                            aria-label={`Use ${label} on ${draft.label || "this Shape"}`}
                            checked={checked || locked}
                            disabled={locked}
                            onChange={(event) =>
                              toggleDimension(dimension.key, event.target.checked)
                            }
                          />
                          {renamingKey === dimension.key ? (
                            <Input
                              aria-label={`Rename ${label}`}
                              className="h-7 flex-1"
                              autoFocus
                              value={label}
                              onChange={(event) =>
                                setEditor((current) =>
                                  current
                                    ? {
                                        ...current,
                                        fieldLabels: {
                                          ...current.fieldLabels,
                                          [dimension.key]: event.target.value,
                                        },
                                        newFields: current.newFields.map((field) =>
                                          field.key === dimension.key
                                            ? { ...field, label: event.target.value }
                                            : field,
                                        ),
                                      }
                                    : current,
                                )
                              }
                              onBlur={() => setRenamingKey(null)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === "Escape") {
                                  event.preventDefault();
                                  setRenamingKey(null);
                                }
                              }}
                            />
                          ) : (
                            <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
                          )}
                          {renamingKey === dimension.key ? null : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              aria-label={`Rename ${label}`}
                              onClick={() => setRenamingKey(dimension.key)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {canDelete ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              aria-label={`Delete ${label}`}
                              onClick={() => void openDimensionDelete(dimension.key, label)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                        </div>
                      );
                    })}
                    {addingDimension ? (
                      <div className="space-y-2 border-t border-slate-200 p-2 dark:border-slate-700">
                        <Label htmlFor="new-shape-dimension" className="text-xs">
                          New dimension
                        </Label>
                        <Input
                          id="new-shape-dimension"
                          aria-label={`New dimension field for ${draft.label || "this Shape"}`}
                          value={newDimensionLabel}
                          autoFocus
                          onChange={(event) => setNewDimensionLabel(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && newDimensionLabel.trim() !== "") {
                              event.preventDefault();
                              addDimensionField();
                            }
                          }}
                        />
                        <p className="text-xs text-slate-500">
                          Confirming adds this dimension to the library for future materials.
                        </p>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={!newDimensionLabel.trim()}
                            aria-label={`Add dimension field to ${draft.label || "this Shape"}`}
                            onClick={addDimensionField}
                          >
                            Confirm add
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setAddingDimension(false);
                              setNewDimensionLabel("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 border-t border-slate-200 px-2 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        onClick={() => {
                          setAddingDimension(true);
                          setNewDimensionLabel("");
                        }}
                      >
                        <Plus className="h-4 w-4 shrink-0" aria-hidden />
                        <span>Add dimension</span>
                      </button>
                    )}
                  </AnchoredMenu>
                </div>
              </div>

              <SizePatternEditor
                pattern={draft.sizePattern ?? ""}
                values={[
                  ...selectedDimensionValues,
                  ...reusableDimensions
                    .filter((dimension) => !draft.dimensionKeys?.includes(dimension.key))
                    .map((dimension) => ({
                      key: dimension.key,
                      label: dimensionLabel(dimension.key, dimension.label),
                    })),
                ]}
                onChange={(sizePattern) => {
                  const validKeys = new Set(reusableDimensions.map((dimension) => dimension.key));
                  const keys = new Set(
                    (draft.dimensionKeys ?? []).filter((key) => validKeys.has(key)),
                  );
                  for (const match of sizePattern.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)) {
                    const key = match[1];
                    if (key && key !== "unit" && validKeys.has(key)) {
                      keys.add(key);
                    }
                  }
                  patchOption((current) => ({
                    ...current,
                    sizePattern: sizePattern || undefined,
                    dimensionKeys:
                      keys.size > 0 ? withLockedKeys(current.id, [...keys]) : undefined,
                  }));
                }}
              />

              {modalError ? <p className="text-sm text-red-600">{modalError}</p> : null}
            </div>
          ) : null}

          <DialogFooter className="shrink-0 border-t border-slate-200 px-6 py-4 sm:justify-end dark:border-slate-700">
            <Button type="button" variant="outline" disabled={busy} onClick={closeEditor}>
              Cancel
            </Button>
            <Button type="button" disabled={busy} onClick={() => void handleSubmitEditor()}>
              {editor?.kind === "create" ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {pendingDelete?.optionLabel}?</DialogTitle>
            <DialogDescription>This clears Shape and Size on {countText}.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setPendingDelete(null)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={busy} onClick={() => void confirmDelete()}>
              Delete Shape
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingDimensionDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDimensionDelete(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {pendingDimensionDelete?.label}?</DialogTitle>
            <DialogDescription>
              Used by {dimensionShapeText} and {dimensionMaterialText}. This removes the dimension
              from those Shapes, their Size patterns, and affected Materials. Shipped dimensions
              cannot be deleted.
            </DialogDescription>
            {pendingDimensionDelete?.countError ? (
              <p className="text-sm text-red-600 dark:text-red-400">
                {pendingDimensionDelete.countError}
              </p>
            ) : null}
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setPendingDimensionDelete(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                busy ||
                (pendingDimensionDelete?.materialCount == null &&
                  !pendingDimensionDelete?.countError)
              }
              onClick={() => void confirmDeleteDimension()}
            >
              Delete dimension
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
