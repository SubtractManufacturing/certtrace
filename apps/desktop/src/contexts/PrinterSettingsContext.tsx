import {
  addRegisteredPrinter,
  assignLabelTemplatePrinter,
  deleteRegisteredPrinter,
  updateRegisteredPrinter,
} from "@certtrace/core";
import type { AppSettingsV1, RegisteredPrinterV1 } from "@certtrace/types";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { listOsPrinterQueues } from "../lib/printer-client";

interface PrinterSettingsValue {
  printers: RegisteredPrinterV1[];
  osQueues: string[];
  queuesError: string | null;
  refreshQueues: () => Promise<void>;
  addPrinter: (
    name: string,
    queueName: string,
    assignment?: { libraryPath: string; labelTemplateId: string },
  ) => Promise<RegisteredPrinterV1>;
  updatePrinter: (printer: RegisteredPrinterV1) => Promise<void>;
  deletePrinter: (printerId: string) => Promise<void>;
  assignedPrinterId: (libraryPath: string, labelTemplateId: string) => string | null;
  assignPrinter: (
    libraryPath: string,
    labelTemplateId: string,
    printerId: string | null,
  ) => Promise<void>;
  isQueueAvailable: (queueName: string) => boolean;
}

const emptyValue: PrinterSettingsValue = {
  printers: [],
  osQueues: [],
  queuesError: null,
  refreshQueues: async () => undefined,
  addPrinter: async () => {
    throw new Error("Printer settings are unavailable.");
  },
  updatePrinter: async () => undefined,
  deletePrinter: async () => undefined,
  assignedPrinterId: () => null,
  assignPrinter: async () => undefined,
  isQueueAvailable: () => false,
};

const PrinterSettingsContext = createContext<PrinterSettingsValue>(emptyValue);

export function PrinterSettingsProvider({
  settings,
  onSettingsChange,
  children,
}: {
  settings: AppSettingsV1;
  onSettingsChange: (settings: AppSettingsV1) => Promise<void>;
  children: ReactNode;
}) {
  const [osQueues, setOsQueues] = useState<string[]>([]);
  const [queuesError, setQueuesError] = useState<string | null>(null);

  const refreshQueues = useCallback(async () => {
    try {
      setOsQueues(await listOsPrinterQueues());
      setQueuesError(null);
    } catch (error) {
      setQueuesError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    void refreshQueues();
  }, [refreshQueues]);

  const value = useMemo<PrinterSettingsValue>(
    () => ({
      printers: settings.printers,
      osQueues,
      queuesError,
      refreshQueues,
      addPrinter: async (name, queueName, assignment) => {
        const printer = { id: crypto.randomUUID(), name, queueName };
        const registered = addRegisteredPrinter(settings, printer);
        await onSettingsChange(
          assignment
            ? assignLabelTemplatePrinter(
                registered,
                assignment.libraryPath,
                assignment.labelTemplateId,
                printer.id,
              )
            : registered,
        );
        return printer;
      },
      updatePrinter: async (printer) => {
        await onSettingsChange(updateRegisteredPrinter(settings, printer));
      },
      deletePrinter: async (printerId) => {
        await onSettingsChange(deleteRegisteredPrinter(settings, printerId));
      },
      assignedPrinterId: (libraryPath, labelTemplateId) =>
        settings.labelTemplatePrinters.find(
          (entry) => entry.libraryPath === libraryPath && entry.labelTemplateId === labelTemplateId,
        )?.printerId ?? null,
      assignPrinter: async (libraryPath, labelTemplateId, printerId) => {
        await onSettingsChange(
          assignLabelTemplatePrinter(settings, libraryPath, labelTemplateId, printerId),
        );
      },
      isQueueAvailable: (queueName) => osQueues.includes(queueName),
    }),
    [settings, osQueues, queuesError, refreshQueues, onSettingsChange],
  );

  return (
    <PrinterSettingsContext.Provider value={value}>{children}</PrinterSettingsContext.Provider>
  );
}

export function usePrinterSettings(): PrinterSettingsValue {
  return useContext(PrinterSettingsContext);
}
