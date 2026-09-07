import type { RegisteredPrinterV1 } from "@certtrace/types";
import { Button, Input, Label, Select } from "@certtrace/ui";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { usePrinterSettings } from "../contexts/PrinterSettingsContext";
import { ErrorBanner } from "./ErrorBanner";

export function PrinterForm({
  printer,
  onCancel,
  onSave,
}: {
  printer?: RegisteredPrinterV1;
  onCancel: () => void;
  onSave: (name: string, queueName: string) => Promise<void>;
}) {
  const { printers, osQueues } = usePrinterSettings();
  const availableQueues = osQueues.filter(
    (queue) => queue === printer?.queueName || !printers.some((entry) => entry.queueName === queue),
  );
  const initialQueue = printer?.queueName ?? availableQueues[0] ?? "";
  const [name, setName] = useState(printer?.name ?? initialQueue);
  const [queueName, setQueueName] = useState(initialQueue);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const firstQueue = availableQueues[0];
    if (!queueName && firstQueue) {
      setQueueName(firstQueue);
      if (!name) {
        setName(firstQueue);
      }
    }
  }, [availableQueues, queueName, name]);

  return (
    <div className="space-y-3 rounded-md border border-slate-200 p-3 dark:border-slate-700">
      <div>
        <Label htmlFor={`printer-queue-${printer?.id ?? "new"}`}>OS queue</Label>
        <Select
          id={`printer-queue-${printer?.id ?? "new"}`}
          value={queueName}
          onChange={(event) => {
            setQueueName(event.target.value);
            if (!printer || name === printer.queueName) {
              setName(event.target.value);
            }
          }}
        >
          {availableQueues.map((queue) => (
            <option key={queue} value={queue}>
              {queue}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor={`printer-name-${printer?.id ?? "new"}`}>Printer name</Label>
        <Input
          id={`printer-name-${printer?.id ?? "new"}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      {availableQueues.length === 0 ? (
        <p className="text-sm text-slate-500">No unused OS printer queues are available.</p>
      ) : null}
      {error ? <ErrorBanner message={error} /> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={saving || !queueName || !name.trim()}
          onClick={() => {
            setSaving(true);
            setError(null);
            void onSave(name, queueName)
              .catch((reason) =>
                setError(reason instanceof Error ? reason.message : String(reason)),
              )
              .finally(() => setSaving(false));
          }}
        >
          Save printer
        </Button>
      </div>
    </div>
  );
}

export function PrinterManager() {
  const {
    printers,
    osQueues,
    queuesError,
    refreshQueues,
    addPrinter,
    updatePrinter,
    deletePrinter,
  } = usePrinterSettings();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Printers</h2>
        <Button type="button" variant="ghost" size="sm" onClick={() => void refreshQueues()}>
          Refresh queues
        </Button>
      </div>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Register OS printer queues as destinations on this computer.
      </p>
      {queuesError ? (
        <div className="mt-3">
          <ErrorBanner message={queuesError} />
        </div>
      ) : null}
      {error ? (
        <div className="mt-3">
          <ErrorBanner message={error} />
        </div>
      ) : null}
      <ul className="mt-4 space-y-2">
        {printers.map((printer) => (
          <li key={printer.id}>
            {editingId === printer.id ? (
              <PrinterForm
                printer={printer}
                onCancel={() => setEditingId(null)}
                onSave={async (name, queueName) => {
                  await updatePrinter({ ...printer, name, queueName });
                  setEditingId(null);
                }}
              />
            ) : (
              <div className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2 dark:border-slate-700">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{printer.name}</p>
                  <p className="truncate text-xs text-slate-500">{printer.queueName}</p>
                </div>
                {!osQueues.includes(printer.queueName) ? (
                  <span className="text-xs text-amber-700 dark:text-amber-300">Queue missing</span>
                ) : null}
                <button
                  type="button"
                  aria-label={`Edit ${printer.name}`}
                  onClick={() => setEditingId(printer.id)}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${printer.name}`}
                  className="text-red-600"
                  onClick={() => {
                    setError(null);
                    void deletePrinter(printer.id).catch((reason) =>
                      setError(reason instanceof Error ? reason.message : String(reason)),
                    );
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {printers.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No Printers registered.</p>
      ) : null}
      {adding ? (
        <div className="mt-4">
          <PrinterForm
            onCancel={() => setAdding(false)}
            onSave={async (name, queueName) => {
              await addPrinter(name, queueName);
              setAdding(false);
            }}
          />
        </div>
      ) : (
        <Button type="button" variant="outline" className="mt-4" onClick={() => setAdding(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add printer
        </Button>
      )}
    </section>
  );
}
