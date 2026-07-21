import type { WordListEntryV1, WordListsV1 } from "@certtrace/types";
import { Button, Input, Label, Textarea } from "@certtrace/ui";
import { Plus, Trash2 } from "lucide-react";

interface WordListEditorProps {
  wordLists: WordListsV1;
  onChange: (wordLists: WordListsV1) => void;
}

export function WordListEditor({ wordLists, onChange }: WordListEditorProps) {
  function updateList(listId: string, entry: WordListEntryV1) {
    onChange({
      ...wordLists,
      lists: { ...wordLists.lists, [listId]: entry },
    });
  }

  function removeList(listId: string) {
    const nextLists = { ...wordLists.lists };
    delete nextLists[listId];
    onChange({ ...wordLists, lists: nextLists });
  }

  function addList() {
    const baseId = `category-${Object.keys(wordLists.lists).length + 1}`;
    let listId = baseId;
    let counter = 1;
    while (wordLists.lists[listId]) {
      listId = `${baseId}-${counter}`;
      counter += 1;
    }
    updateList(listId, { label: "New category", words: ["example"] });
  }

  return (
    <div className="space-y-4">
      {Object.entries(wordLists.lists).map(([listId, entry]) => (
        <div
          key={listId}
          className="space-y-3 rounded-md border border-slate-200 p-4 dark:border-slate-700"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="grid flex-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <Label>Category ID</Label>
                <Input value={listId} readOnly className="font-mono" />
              </label>
              <label className="space-y-1 text-sm">
                <Label>Display name</Label>
                <Input
                  value={entry.label}
                  onChange={(event) => updateList(listId, { ...entry, label: event.target.value })}
                />
              </label>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => removeList(listId)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <label className="block space-y-1 text-sm">
            <Label>Words (one per line or comma-separated)</Label>
            <Textarea
              rows={5}
              value={entry.words.join("\n")}
              onChange={(event) => {
                const words = event.target.value
                  .split(/[\n,]+/)
                  .map((word) => word.trim())
                  .filter(Boolean);
                updateList(listId, { ...entry, words: words.length > 0 ? words : ["example"] });
              }}
            />
          </label>
        </div>
      ))}

      <Button type="button" variant="outline" onClick={addList}>
        <Plus className="mr-2 h-4 w-4" />
        Add category
      </Button>
    </div>
  );
}
