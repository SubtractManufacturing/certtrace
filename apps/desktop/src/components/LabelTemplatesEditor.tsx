import {
  addLabelTemplate,
  deleteLabelTemplate,
  type OpenLibraryResult,
  setDefaultLabelTemplate,
} from "@certtrace/library-engine";
import {
  createStarterLabelTemplates,
  LABEL_SIZE_CATALOG,
  type LabelDisplayUnit,
  type LabelSizeCatalogId,
  type LabelTemplate,
  type LibraryConfigV1,
  labelTemplateSizeInches,
  libraryConfigV1Schema,
  type MaterialMetadataV1,
} from "@certtrace/types";
import { Button, Input, Label, Select } from "@certtrace/ui";
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

function cloneConfig(config: LibraryConfigV1): LibraryConfigV1 {
  return structuredClone(config);
}

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

export function LabelTemplatesEditor({
  library,
  onLibraryUpdated,
  onRefreshLibrary,
}: LabelTemplatesEditorProps) {
  const [draft, setDraft] = useState<LibraryConfigV1>(() => cloneConfig(library.config));
  const [selectedId, setSelectedId] = useState(library.config.defaultLabelTemplateId);
  const [widthText, setWidthText] = useState("");
  const [heightText, setHeightText] = useState("");
  const [materials, setMaterials] = useState<MaterialMetadataV1[]>([]);
  const [previewMaterialId, setPreviewMaterialId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(cloneConfig(library.config));
    setSelectedId((current) =>
      library.config.labelTemplates.some((template) => template.id === current)
        ? current
        : library.config.defaultLabelTemplateId,
    );
  }, [library.config]);

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

  const selected = draft.labelTemplates.find((template) => template.id === selectedId) ?? null;
  const sampleMaterial = createSampleLabelMaterial();
  const previewMaterial =
    previewMaterialId === null
      ? sampleMaterial
      : (materials.find((entry) => entry.id === previewMaterialId) ?? sampleMaterial);

  useEffect(() => {
    if (!selected) {
      setWidthText("");
      setHeightText("");
      return;
    }
    const inches = labelTemplateSizeInches(selected.size);
    setWidthText(formatDimensionInput(inches.widthIn, selected.displayUnit));
    setHeightText(formatDimensionInput(inches.heightIn, selected.displayUnit));
    // Intentionally sync dimension text only when switching templates.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedId is the sync key
  }, [selectedId]);

  const dirty =
    JSON.stringify(draft.labelTemplates) !== JSON.stringify(library.config.labelTemplates) ||
    draft.defaultLabelTemplateId !== library.config.defaultLabelTemplateId;

  function patchSelected(updater: (template: LabelTemplate) => LabelTemplate) {
    if (!selected) {
      return;
    }
    setError(null);
    setDraft({
      ...draft,
      labelTemplates: draft.labelTemplates.map((template) =>
        template.id === selected.id ? updater(template) : template,
      ),
    });
  }

  function handleCreate() {
    try {
      setError(null);
      const template = createBlankTemplate();
      const next = addLabelTemplate(draft, template);
      setDraft(next);
      setSelectedId(template.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleDelete() {
    if (!selected) {
      return;
    }
    try {
      setError(null);
      const next = deleteLabelTemplate(draft, selected.id);
      setDraft(next);
      setSelectedId(next.defaultLabelTemplateId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleSetDefault() {
    if (!selected) {
      return;
    }
    try {
      setError(null);
      setDraft(setDefaultLabelTemplate(draft, selected.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function handlePaperSizeChange(value: string) {
    if (!selected) {
      return;
    }
    if (value === "custom") {
      const inches = labelTemplateSizeInches(selected.size);
      patchSelected((template) => ({
        ...template,
        size: { kind: "custom", widthIn: inches.widthIn, heightIn: inches.heightIn },
      }));
      setWidthText(formatDimensionInput(inches.widthIn, selected.displayUnit));
      setHeightText(formatDimensionInput(inches.heightIn, selected.displayUnit));
      return;
    }

    const catalogId = value as LabelSizeCatalogId;
    patchSelected((template) => ({
      ...template,
      size: { kind: "catalog", catalogId },
    }));
  }

  function handleDisplayUnitChange(unit: LabelDisplayUnit) {
    if (!selected) {
      return;
    }
    const inches = labelTemplateSizeInches(selected.size);
    patchSelected((template) => ({ ...template, displayUnit: unit }));
    setWidthText(formatDimensionInput(inches.widthIn, unit));
    setHeightText(formatDimensionInput(inches.heightIn, unit));
  }

  function handleDimensionChange(axis: "width" | "height", raw: string) {
    if (!selected) {
      return;
    }
    if (axis === "width") {
      setWidthText(raw);
    } else {
      setHeightText(raw);
    }

    const parsed = parseDimensionInput(raw, selected.displayUnit);
    if (!parsed) {
      return;
    }

    const inches = labelTemplateSizeInches(selected.size);
    const nextWidth = axis === "width" ? parsed.valueInches : inches.widthIn;
    const nextHeight = axis === "height" ? parsed.valueInches : inches.heightIn;
    const unitChanged = parsed.displayUnit !== selected.displayUnit;

    patchSelected((template) => ({
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

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const validated = libraryConfigV1Schema.parse(draft);
      const updated = await updateLibraryConfigPartial(library, {
        labelTemplates: validated.labelTemplates,
        defaultLabelTemplateId: validated.defaultLabelTemplateId,
      });
      onLibraryUpdated(updated);
      await onRefreshLibrary();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Manage Label Templates for this library. One template is always the default for print and
        export.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={handleCreate}>
          New template
        </Button>
        <Button type="button" disabled={saving || !dirty} onClick={() => void handleSave()}>
          Save templates
        </Button>
      </div>

      <ul
        aria-label="Label Templates"
        className="space-y-1 rounded-md border border-slate-200 p-2 dark:border-slate-700"
      >
        {draft.labelTemplates.map((template) => {
          const isDefault = template.id === draft.defaultLabelTemplateId;
          const isSelected = template.id === selectedId;
          return (
            <li key={template.id}>
              <div
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                  isSelected
                    ? "bg-slate-100 dark:bg-slate-800"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                }`}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left font-medium"
                  aria-label={`Edit ${template.name}`}
                  aria-current={isSelected ? "true" : undefined}
                  onClick={() => setSelectedId(template.id)}
                >
                  {template.name}
                </button>
                <label className="flex shrink-0 items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <input
                    type="radio"
                    name="default-label-template"
                    aria-label={`Default template: ${template.name}`}
                    checked={isDefault}
                    onChange={() => {
                      try {
                        setError(null);
                        setDraft(setDefaultLabelTemplate(draft, template.id));
                      } catch (err) {
                        setError(err instanceof Error ? err.message : String(err));
                      }
                    }}
                  />
                  Default
                </label>
              </div>
            </li>
          );
        })}
      </ul>

      {selected ? (
        <div className="space-y-4 rounded-md border border-slate-200 p-4 dark:border-slate-700">
          <div className="space-y-1.5">
            <Label htmlFor="label-template-name">Template name</Label>
            <Input
              id="label-template-name"
              aria-label="Template name"
              value={selected.name}
              onChange={(event) =>
                patchSelected((template) => ({ ...template, name: event.target.value }))
              }
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="label-template-paper-size">Paper size</Label>
              <Select
                id="label-template-paper-size"
                aria-label="Paper size"
                value={paperSizeSelectValue(selected)}
                onChange={(event) => handlePaperSizeChange(event.target.value)}
              >
                {(Object.keys(LABEL_SIZE_CATALOG) as LabelSizeCatalogId[]).map((catalogId) => {
                  const size = LABEL_SIZE_CATALOG[catalogId];
                  return (
                    <option key={catalogId} value={catalogId}>
                      {size.widthIn}×{size.heightIn} in
                    </option>
                  );
                })}
                <option value="custom">Custom</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="label-template-display-unit">Display unit</Label>
              <Select
                id="label-template-display-unit"
                aria-label="Display unit"
                value={selected.displayUnit}
                onChange={(event) =>
                  handleDisplayUnitChange(event.target.value as LabelDisplayUnit)
                }
              >
                <option value="in">in</option>
                <option value="mm">mm</option>
              </Select>
            </div>
          </div>

          {selected.size.kind === "custom" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="label-template-width">Width ({selected.displayUnit})</Label>
                <Input
                  id="label-template-width"
                  aria-label="Width"
                  value={widthText}
                  onChange={(event) => handleDimensionChange("width", event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="label-template-height">Height ({selected.displayUnit})</Label>
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
            <div className="max-h-64 space-y-1 overflow-auto rounded-md border border-slate-200 p-2 dark:border-slate-700">
              {labelContentOptions(library.fieldSchema).map((option) => {
                const checked = selected.contentKeys.includes(option.key);
                const includedIndex = selected.contentKeys.indexOf(option.key);
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
                            patchSelected((template) => ({
                              ...template,
                              contentKeys: [...template.contentKeys, option.key],
                            }));
                            return;
                          }
                          if (selected.contentKeys.length <= 1) {
                            setError("A Label Template must include at least one content slot.");
                            return;
                          }
                          patchSelected((template) => ({
                            ...template,
                            contentKeys: template.contentKeys.filter((key) => key !== option.key),
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
                            const next = moveContentKey(selected.contentKeys, option.key, -1);
                            if (next) {
                              patchSelected((template) => ({ ...template, contentKeys: next }));
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
                            includedIndex < 0 || includedIndex >= selected.contentKeys.length - 1
                          }
                          onClick={() => {
                            const next = moveContentKey(selected.contentKeys, option.key, 1);
                            if (next) {
                              patchSelected((template) => ({ ...template, contentKeys: next }));
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

          <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/50">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Preview</p>
              <div className="min-w-48 space-y-1.5">
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
            </div>
            <section aria-label="Label preview">
              <LabelLivePreview
                template={selected}
                material={previewMaterial}
                fieldSchema={library.fieldSchema}
              />
            </section>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={selected.id === draft.defaultLabelTemplateId}
              onClick={handleSetDefault}
            >
              Set as default
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={draft.labelTemplates.length <= 1}
              onClick={handleDelete}
            >
              Delete template
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <ErrorBanner message={error} /> : null}
    </div>
  );
}
