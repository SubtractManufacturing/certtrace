import {
  parseTemplateToSegments,
  previewMaterialId,
  segmentsToTemplate,
  strategyFromSegments,
  type TemplateSegment,
} from "@certtrace/id-generator";
import type { NamingStrategyV1, WordListsV1 } from "@certtrace/types";
import { defaultWordListsV1 } from "@certtrace/types";
import { Button, Input, Label, Select } from "@certtrace/ui";
import { Plus, Trash2 } from "lucide-react";
import { useMemo } from "react";

interface IdTemplateBuilderProps {
  strategy: NamingStrategyV1;
  wordLists?: WordListsV1;
  onChange: (strategy: NamingStrategyV1) => void;
}

const SEGMENT_OPTIONS: Array<{ value: TemplateSegment["type"]; label: string }> = [
  { value: "material", label: "Material option" },
  { value: "number", label: "Number" },
  { value: "word", label: "Word list" },
  { value: "year", label: "Year" },
  { value: "month", label: "Month" },
  { value: "day", label: "Day" },
  { value: "separator", label: "Separator" },
];

export function IdTemplateBuilder({
  strategy,
  wordLists = defaultWordListsV1,
  onChange,
}: IdTemplateBuilderProps) {
  const segments = useMemo(() => parseTemplateToSegments(strategy.template), [strategy.template]);

  const preview = useMemo(() => {
    try {
      return previewMaterialId({
        strategy,
        wordLists,
        materialOption: { id: "aluminum", label: "Aluminum", shortCode: "AL" },
      });
    } catch {
      return "Invalid template";
    }
  }, [strategy, wordLists]);

  function updateSegments(nextSegments: TemplateSegment[]) {
    onChange(
      strategyFromSegments(strategy.id, strategy.label, nextSegments, {
        case: strategy.case,
        numberPad: strategy.numberPad,
        numberStart: strategy.numberStart,
      }),
    );
  }

  function updateSegment(index: number, segment: TemplateSegment) {
    const next = [...segments];
    next[index] = segment;
    updateSegments(next);
  }

  function addSegment(type: TemplateSegment["type"]) {
    const segment: TemplateSegment =
      type === "material"
        ? { type: "material" }
        : type === "number"
          ? { type: "number", numberPad: strategy.numberPad, numberStart: strategy.numberStart }
          : type === "word"
            ? { type: "word", listId: Object.keys(wordLists.lists)[0] ?? "animals" }
            : type === "separator"
              ? { type: "separator", value: "-" }
              : { type };
    updateSegments([...segments, segment]);
  }

  function removeSegment(index: number) {
    updateSegments(segments.filter((_, current) => current !== index));
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <Label>Strategy name</Label>
          <Input
            value={strategy.label}
            onChange={(event) => onChange({ ...strategy, label: event.target.value })}
          />
        </label>
        <label className="space-y-1 text-sm">
          <Label>Template preview</Label>
          <Input readOnly value={preview} className="font-mono" />
        </label>
      </div>

      <p className="text-xs text-slate-500">
        Template: <code className="font-mono">{segmentsToTemplate(segments)}</code>
      </p>

      <div className="space-y-2">
        {segments.map((segment, index) => (
          <div
            // Template segments are an ordered list without stable ids; index is identity.
            // biome-ignore lint/suspicious/noArrayIndexKey: ordered segment list
            key={`${segment.type}-${index}`}
            className="flex flex-wrap items-end gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-700"
          >
            <label className="space-y-1 text-sm">
              <Label>Segment</Label>
              <Select
                value={segment.type}
                onChange={(event) => {
                  const type = event.target.value as TemplateSegment["type"];
                  addSegment(type);
                  removeSegment(index);
                }}
              >
                {SEGMENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>

            {segment.type === "word" ? (
              <label className="min-w-[10rem] space-y-1 text-sm">
                <Label>Word list</Label>
                <Select
                  value={segment.listId}
                  onChange={(event) =>
                    updateSegment(index, { type: "word", listId: event.target.value })
                  }
                >
                  {Object.entries(wordLists.lists).map(([id, entry]) => (
                    <option key={id} value={id}>
                      {entry.label}
                    </option>
                  ))}
                </Select>
              </label>
            ) : null}

            {segment.type === "separator" ? (
              <label className="space-y-1 text-sm">
                <Label>Separator</Label>
                <Input
                  value={segment.value}
                  onChange={(event) =>
                    updateSegment(index, { type: "separator", value: event.target.value })
                  }
                  className="w-20"
                />
              </label>
            ) : null}

            {segment.type === "number" ? (
              <>
                <label className="space-y-1 text-sm">
                  <Label>Pad</Label>
                  <Input
                    type="number"
                    min={0}
                    value={segment.numberPad ?? strategy.numberPad ?? 0}
                    onChange={(event) =>
                      updateSegment(index, {
                        type: "number",
                        numberPad: Number(event.target.value),
                        numberStart: segment.numberStart ?? strategy.numberStart,
                      })
                    }
                    className="w-20"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <Label>Start</Label>
                  <Input
                    type="number"
                    value={segment.numberStart ?? strategy.numberStart ?? 1}
                    onChange={(event) =>
                      updateSegment(index, {
                        type: "number",
                        numberPad: segment.numberPad ?? strategy.numberPad,
                        numberStart: Number(event.target.value),
                      })
                    }
                    className="w-24"
                  />
                </label>
              </>
            ) : null}

            <Button type="button" variant="ghost" size="sm" onClick={() => removeSegment(index)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {SEGMENT_OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addSegment(option.value)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
