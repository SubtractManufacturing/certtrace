import { invoke } from "@tauri-apps/api/core";

export async function listOsPrinterQueues(): Promise<string[]> {
  return invoke<string[]>("list_printer_queues");
}
