import {
  addLabelTemplate,
  deleteLabelTemplate,
  type OpenLibraryResult,
  setDefaultLabelTemplate,
  updateLabelTemplate,
} from "@certtrace/library-engine";
import {
  createStarterLabelTemplates,
  LABEL_SIZE_CATALOG,
  type LabelDisplayUnit,
  type LabelSizeCatalogId,
  type LabelTemplate,
  labelTemplateSchema,
  labelTemplateSizeInches,
  type MaterialMetadataV1,
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
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@certtrace/ui";
import { Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { formatDimensionInput, parseDimensionInput } from "../lib/label-dimensions";
import {
  createSampleLabelMaterial,
  labelContentOptions,
  moveContentKey,
} from "../lib/label-template-content";
import { fetchMaterials, updateLibraryConfigPartial } from "../lib/library-client";
import { ErrorBanner } from "./ErrorBanner";
import { LabelLivePreview } from "./LabelLivePreview";

const SAMPLE_PREVIEW_VALUE = "__sample__";

interface LabelTemplatesEditorProps {
  library: OpenLibraryResult;
  onLibraryUpdated: (library: OpenLibraryResult) => void;
  onRefreshLibrary: () => Promise<void>;
}

type EditorMode = { kind: "create"; draft: LabelTemplate } | { kind: "edit"; draft: LabelTemplate };

function newTemplateId(): string {
  return `label-${crypto.randomUUID()}`;
}

function createBlankTemplate(): LabelTemplate {
  const starter = createStarterLabelTemplates()[0]!;
  return {
    ...structuredClone(starter),
    id: newTemplateId(),
    name: "New template",
  };
}

function paperSizeSelectValue(template: LabelTemplate): string {
  return template.size.kind === "catalog" ? template.size.catalogId : "custom";
}

function templateSizeLabel(template: LabelTemplate): string {
  const { widthIn, heightIn } = labelTemplateSizeInches(template.size);
  return `${formatDimensionInput(widthIn, template.displayUnit)} × ${formatDimensionInput(heightIn, template.displayUnit)} ${template.displayUnit}`;
}

export function LabelTemplatesEditor({
  library,
  onLibraryUpdated,
  onRefreshLibrary,
}: LabelTemplatesEditorProps) {
  const [editor, setEditor] = useState<EditorMode | null>(null);
  const [widthText, setWidthText] = useState("");
  const [heightText, setHeightText] = useState("");
  const [materials, setMaterials] = useState<MaterialMetadataV1[]>([]);
  const [previewMaterialId, setPreviewMaterialId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchMaterials(library)
      .then((entries) => {
        if (!cancelled) {
          setMaterials(entries);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMaterials([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [library]);

  useEffect(() => {
    if (!editor) {
      setWidthText("");
      setHeightText("");
      setModalError(null);
      return;
    }
    const inches = labelTemplateSizeInches(editor.draft.size);
    setWidthText(formatDimensionInput(inches.widthIn, editor.draft.displayUnit));
    setHeightText(formatDimensionInput(inches.heightIn, editor.draft.displayUnit));
    setModalError(null);
  }, [editor?.kind, editor?.draft.id]);

  const sampleMaterial = createSampleLabelMaterial();
  const previewMaterial =
    previewMaterialId === null
      ? sampleMaterial
      : (materials.find((entry) => entry.id === previewMaterialId) ?? sampleMaterial);

  const draft = editor?.draft ?? null;

  async function persistConfig(nextConfig: {
    labelTemplates: LabelTemplate[];
    defaultLabelTemplateId: string;
  }) {
    setBusy(true);
    setError(null);
    try {
      const updated = await updateLibraryConfigPartial(library, nextConfig);
      onLibraryUpdated(updated);
      await onRefreshLibrary();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setBusy(false);
    }
  }

  function openCreate() {
    setError(null);
    setEditor({ kind: "create", draft: createBlankTemplate() });
  }

  function openEdit(template: LabelTemplate) {
    setError(null);
    setEditor({ kind: "edit", draft: structuredClone(template) });
  }

  function closeEditor() {
    setEditor(null);
    setModalError(null);
  }

  function patchDraft(updater: (template: LabelTemplate) => LabelTemplate) {
    setModalError(null);
    setEditor((current) => {
      if (!current) {
        return current;
      }
      return { ...current, draft: updater(current.draft) };
    });
  }

  async function handleSetDefault(templateId: string) {
    try {
      const next = setDefaultLabelTemplate(library.config, templateId);
      await persistConfig({
        labelTemplates: next.labelTemplates,
        defaultLabelTemplateId: next.defaultLabelTemplateId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDelete(templateId: string) {
    try {
      const next = deleteLabelTemplate(library.config, templateId);
      await persistConfig({
        labelTemplates: next.labelTemplates,
        defaultLabelTemplateId: next.defaultLabelTemplateId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function handlePaperSizeChange(value: string) {
    if (!draft) {
      return;
    }
    if (value === "custom") {
      const inches = labelTemplateSizeInches(draft.size);
      patchDraft((template) => ({
        ...template,
        size: { kind: "custom", widthIn: inches.widthIn, heightIn: inches.heightIn },
      }));
      setWidthText(formatDimensionInput(inches.widthIn, draft.displayUnit));
      setHeightText(formatDimensionInput(inches.heightIn, draft.displayUnit));
      return;
    }

    const catalogId = value as LabelSizeCatalogId;
    patchDraft((template) => ({
      ...template,
      size: { kind: "catalog", catalogId },
    }));
  }

  function handleDisplayUnitChange(unit: LabelDisplayUnit) {
    if (!draft) {
      return;
    }
    const inches = labelTemplateSizeInches(draft.size);
    patchDraft((template) => ({ ...template, displayUnit: unit }));
    setWidthText(formatDimensionInput(inches.widthIn, unit));
    setHeightText(formatDimensionInput(inches.heightIn, unit));
  }

  function handleDimensionChange(axis: "width" | "height", raw: string) {
    if (!draft) {
      return;
    }
    if (axis === "width") {
      setWidthText(raw);
    } else {
      setHeightText(raw);
    }

    const parsed = parseDimensionInput(raw, draft.displayUnit);
    if (!parsed) {
      return;
    }

    const inches = labelTemplateSizeInches(draft.size);
    const nextWidth = axis === "width" ? parsed.valueInches : inches.widthIn;
    const nextHeight = axis === "height" ? parsed.valueInches : inches.heightIn;
    const unitChanged = parsed.displayUnit !== draft.displayUnit;

    patchDraft((template) => ({
      ...template,
      displayUnit: parsed.displayUnit,
      size: { kind: "custom", widthIn: nextWidth, heightIn: nextHeight },
    }));

    if (unitChanged) {
      if (axis === "width") {
        setHeightText(formatDimensionInput(inches.heightIn, parsed.displayUnit));
      } else {
        setWidthText(formatDimensionInput(inches.widthIn, parsed.displayUnit));
      }
    }
  }

  async function handleSubmitEditor() {
    if (!editor) {
      return;
    }
    setBusy(true);
    setModalError(null);
    try {
      const validated = labelTemplateSchema.parse(editor.draft);
      const next =
        editor.kind === "create"
          ? addLabelTemplate(library.config, validated)
          : updateLabelTemplate(library.config, validated);
      const updated = await updateLibraryConfigPartial(library, {
        labelTemplates: next.labelTemplates,
        defaultLabelTemplateId: next.defaultLabelTemplateId,
      });
      onLibraryUpdated(updated);
      await onRefreshLibrary();
      closeEditor();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-xl text-sm text-slate-600 dark:text-slate-400">
          Manage Label Templates for this library. One template is always the default for print and
          export.
        </p>
        <Button type="button" onClick={openCreate} disabled={busy}>
          <Plus className="mr-2 h-4 w-4" />
          Add template
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
        <Table aria-label="Label Templates">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Size</TableHead>
              <TableHead className="w-28">Default</TableHead>
              <TableHead className="w-44 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {library.config.labelTemplates.map((template) => {
              const isDefault = template.id === library.config.defaultLabelTemplateId;
              return (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-400">
                    {templateSizeLabel(template)}
                  </TableCell>
                  <TableCell>
                    {isDefault ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        <Star className="h-3 w-3 fill-current" aria-hidden />
                        Default
                      </span>
                    ) : (
                      <span className="sr-only">Not default</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Edit ${template.name}`}
                        disabled={busy}
                        onClick={() => openEdit(template)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Set ${template.name} as default`}
                        disabled={busy || isDefault}
                        onClick={() => void handleSetDefault(template.id)}
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Delete ${template.name}`}
                        disabled={busy || library.config.labelTemplates.length <= 1}
                        onClick={() => void handleDelete(template.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
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
        <DialogContent className="flex max-h-[min(90vh,44rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0">
          <div className="relative shrink-0 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
            <DialogHeader>
              <DialogTitle>
                {editor?.kind === "create" ? "Create Label Template" : "Edit Label Template"}
              </DialogTitle>
              <DialogDescription>
                {editor?.kind === "create"
                  ? "Configure a new Label Template and preview it before creating."
                  : "Update this Label Template. Changes apply when you save."}
              </DialogDescription>
            </DialogHeader>
            <DialogClose aria-label="Close" disabled={busy}>
              <X className="h-4 w-4" />
            </DialogClose>
          </div>

          {draft ? (
            <div className="flex min-h-0 flex-1">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                <div className="space-y-1.5">
                  <Label htmlFor="label-template-name">Template name</Label>
                  <Input
                    id="label-template-name"
                    aria-label="Template name"
                    value={draft.name}
                    onChange={(event) =>
                      patchDraft((template) => ({ ...template, name: event.target.value }))
                    }
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="label-template-label-size">Label size</Label>
                    <Select
                      id="label-template-label-size"
                      aria-label="Label size"
                      value={paperSizeSelectValue(draft)}
                      onChange={(event) => handlePaperSizeChange(event.target.value)}
                    >
                      {(Object.keys(LABEL_SIZE_CATALOG) as LabelSizeCatalogId[]).map(
                        (catalogId) => {
                          const size = LABEL_SIZE_CATALOG[catalogId];
                          return (
                            <option key={catalogId} value={catalogId}>
                              {size.widthIn}×{size.heightIn} in
                            </option>
                          );
                        },
                      )}
                      <option value="custom">Custom</option>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="label-template-display-unit">Display unit</Label>
                    <Select
                      id="label-template-display-unit"
                      aria-label="Display unit"
                      value={draft.displayUnit}
                      onChange={(event) =>
                        handleDisplayUnitChange(event.target.value as LabelDisplayUnit)
                      }
                    >
                      <option value="in">in</option>
                      <option value="mm">mm</option>
                    </Select>
                  </div>
                </div>

                {draft.size.kind === "custom" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="label-template-width">Width ({draft.displayUnit})</Label>
                      <Input
                        id="label-template-width"
                        aria-label="Width"
                        value={widthText}
                        onChange={(event) => handleDimensionChange("width", event.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="label-template-height">Height ({draft.displayUnit})</Label>
                      <Input
                        id="label-template-height"
                        aria-label="Height"
                        value={heightText}
                        onChange={(event) => handleDimensionChange("height", event.target.value)}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Content</p>
                  <div className="space-y-1 rounded-md border border-slate-200 p-2 dark:border-slate-700">
                    {labelContentOptions(library.fieldSchema).map((option) => {
                      const checked = draft.contentKeys.includes(option.key);
                      const includedIndex = draft.contentKeys.indexOf(option.key);
                      return (
                        <div
                          key={option.key}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <label className="flex min-w-0 flex-1 items-center gap-2">
                            <input
                              type="checkbox"
                              aria-label={`Include ${option.label}`}
                              checked={checked}
                              onChange={(event) => {
                                if (event.target.checked) {
                                  patchDraft((template) => ({
                                    ...template,
                                    contentKeys: [...template.contentKeys, option.key],
                                  }));
                                  return;
                                }
                                if (draft.contentKeys.length <= 1) {
                                  setModalError(
                                    "A Label Template must include at least one content slot.",
                                  );
                                  return;
                                }
                                patchDraft((template) => ({
                                  ...template,
                                  contentKeys: template.contentKeys.filter(
                                    (key) => key !== option.key,
                                  ),
                                }));
                              }}
                            />
                            <span className="truncate">{option.label}</span>
                          </label>
                          {checked ? (
                            <div className="flex shrink-0 gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                aria-label={`Move ${option.label} up`}
                                disabled={includedIndex <= 0}
                                onClick={() => {
                                  const next = moveContentKey(
                                    draft.contentKeys,
                                    option.key,
                                    -1,
                                  );
                                  if (next) {
                                    patchDraft((template) => ({
                                      ...template,
                                      contentKeys: next,
                                    }));
                                  }
                                }}
                              >
                                Up
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                aria-label={`Move ${option.label} down`}
                                disabled={
                                  includedIndex < 0 ||
                                  includedIndex >= draft.contentKeys.length - 1
                                }
                                onClick={() => {
                                  const next = moveContentKey(draft.contentKeys, option.key, 1);
                                  if (next) {
                                    patchDraft((template) => ({
                                      ...template,
                                      contentKeys: next,
                                    }));
                                  }
                                }}
                              >
                                Down
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {modalError ? <ErrorBanner message={modalError} /> : null}
              </div>

              <aside className="flex w-80 shrink-0 flex-col gap-3 border-l border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-900/50">
                <div className="space-y-1.5">
                  <Label htmlFor="label-template-preview-with">Preview with</Label>
                  <Select
                    id="label-template-preview-with"
                    aria-label="Preview with"
                    value={previewMaterialId ?? SAMPLE_PREVIEW_VALUE}
                    onChange={(event) => {
                      const value = event.target.value;
                      setPreviewMaterialId(value === SAMPLE_PREVIEW_VALUE ? null : value);
                    }}
                  >
                    <option value={SAMPLE_PREVIEW_VALUE}>Sample Material</option>
                    {materials.map((material) => (
                      <option key={material.id} value={material.id}>
                        {material.id}
                      </option>
                    ))}
                  </Select>
                </div>
                <section aria-label="Label preview" className="min-h-0 flex-1 overflow-hidden">
                  <LabelLivePreview
                    template={draft}
                    material={previewMaterial}
                    fieldSchema={library.fieldSchema}
                    className="max-w-none"
                  />
                </section>
              </aside>
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
    </div>
  );
}
