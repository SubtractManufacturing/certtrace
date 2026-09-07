import { createDefaultAppSettingsV1 } from "@certtrace/types";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listOsPrinterQueues } from "../lib/printer-client";
import { PrinterSettingsProvider, usePrinterSettings } from "./PrinterSettingsContext";

vi.mock("../lib/printer-client", () => ({
  listOsPrinterQueues: vi.fn(async () => ["Zebra ZD421"]),
}));

function QueueAvailabilityProbe({ queueName }: { queueName: string }) {
  const { isQueueAvailable, queuesError, refreshQueues } = usePrinterSettings();
  return (
    <div>
      <p>{isQueueAvailable(queueName) ? "available" : "unavailable"}</p>
      {queuesError ? <p>{queuesError}</p> : null}
      <button type="button" onClick={() => void refreshQueues()}>
        Refresh
      </button>
    </div>
  );
}

describe("PrinterSettingsProvider", () => {
  beforeEach(() => {
    vi.mocked(listOsPrinterQueues).mockReset();
    vi.mocked(listOsPrinterQueues).mockResolvedValue(["Zebra ZD421"]);
  });

  it("clears cached OS queues when discovery fails", async () => {
    vi.mocked(listOsPrinterQueues)
      .mockResolvedValueOnce(["Zebra ZD421"])
      .mockRejectedValueOnce(new Error("cups down"));

    render(
      <PrinterSettingsProvider
        settings={createDefaultAppSettingsV1()}
        onSettingsChange={async () => undefined}
      >
        <QueueAvailabilityProbe queueName="Zebra ZD421" />
      </PrinterSettingsProvider>,
    );

    await waitFor(() => expect(screen.getByText("available")).toBeTruthy());
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(screen.getByText("unavailable")).toBeTruthy());
    expect(screen.getByText("cups down")).toBeTruthy();
  });
});
